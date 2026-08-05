-- PCI/M7 (process-case integrity audit, finding M7) — make the cluster's RLS
-- predicates evaluate `auth.uid()` ONCE per query instead of once per row.
--
-- `cases_select` already reads `app.can_read_case(id, ( SELECT auth.uid() AS uid))`
-- — the scalar subquery makes the planner hoist it into an InitPlan. Every CHILD
-- policy passes `auth.uid()` bare, so it is re-invoked per row. The inconsistency
-- is the tell: one table got the treatment and the other thirteen policies did not.
--
-- Honest sizing: the per-row `app.can_read_case(case_id, ...)` call is NOT removed
-- by this — case_id varies per row, so the capability resolver still runs per row.
-- What is removed is the per-row GUC read inside auth.uid(). This is a real but
-- modest win, and it is also what Supabase's own `auth_rls_initplan` advisor flags.
--
-- ── WHY THIS MIGRATION REWRITES ITSELF FROM THE CATALOG ────────────────────────
--
-- ⚠ Hand-retyping fourteen RLS predicates is how you ship an authorization bug. A
-- single dropped conjunct in a `staff_admin_write` policy is a silent privilege
-- widening that every existing test would still pass — this repo has already lived
-- that (BUG-AUTHZ-001), and ADR 0078's standing lesson is that a no-regression
-- test passes a widening BY CONSTRUCTION.
--
-- So no predicate is typed here. The block below reads each policy's deparsed
-- expression out of pg_policies, applies ONE targeted substitution, and rebuilds
-- the policy. Then — before the transaction can commit — it re-reads what it
-- created and asserts that NORMALISING the new predicate (unwrapping the scalar
-- subquery) reproduces the old predicate EXACTLY. Any deviation raises and the
-- whole migration rolls back.
--
-- That check is the point of the design: it is not possible for this migration to
-- both succeed and change the meaning of a policy.
--
-- The substitution is idempotent — already-wrapped occurrences are unwrapped first,
-- so re-running produces no nesting and `cases_select` is left byte-identical.
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- The in-migration assertion is itself the primary proof and it runs on every
-- deploy. supabase/tests/296_process_case_integrity.sql §M7 adds the behavioural
-- pair that a catalog check cannot give: a foreign-commission principal still
-- reads ZERO rows from every rewritten table, and a permitted principal still
-- reads NON-ZERO from each (without the second half the first is vacuous).

do $$
declare
  r         record;
  v_qual    text;
  v_check   text;
  v_roles   text;
  v_for     text;
  v_sql     text;
  v_new     text;
  v_old     text;
  v_count   integer := 0;
  tables constant text[] := array[
    'cases', 'case_phases', 'case_narratives', 'case_narrative_revisions',
    'case_custom_field_values', 'case_offered_outcomes',
    'case_phase_allowed_results', 'case_phase_offered_results'
  ];
begin
  -- Snapshot the pre-state so the post-check has something to compare against.
  create temp table _pci_policy_before on commit drop as
  select tablename, policyname, cmd, permissive, roles, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = any (tables);

  for r in
    select * from _pci_policy_before
    where coalesce(qual, '') like '%auth.uid()%'
       or coalesce(with_check, '') like '%auth.uid()%'
  loop
    -- Unwrap-then-wrap => idempotent, and no nesting on an already-wrapped policy.
    v_qual := replace(
                replace(r.qual, '( SELECT auth.uid() AS uid)', 'auth.uid()'),
                'auth.uid()', '( SELECT auth.uid() AS uid)');
    v_check := replace(
                 replace(r.with_check, '( SELECT auth.uid() AS uid)', 'auth.uid()'),
                 'auth.uid()', '( SELECT auth.uid() AS uid)');

    v_roles := array_to_string(r.roles::text[], ', ');
    v_for   := case r.cmd when 'ALL' then 'all' else lower(r.cmd) end;

    v_sql := format('create policy %I on public.%I as %s for %s to %s',
                    r.policyname, r.tablename,
                    lower(r.permissive), v_for, v_roles);
    if v_qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute v_sql;
    v_count := v_count + 1;
  end loop;

  raise notice 'PCI/M7: rewrote % policies', v_count;

  -- ── The self-check. Normalise the NEW predicate back down and require it to be
  -- byte-identical to the OLD one. This is what makes the rewrite trustworthy.
  for r in
    select b.tablename, b.policyname, b.qual as old_qual, b.with_check as old_check,
           a.qual as new_qual, a.with_check as new_check,
           b.cmd as old_cmd, a.cmd as new_cmd,
           b.roles::text as old_roles, a.roles::text as new_roles
    from _pci_policy_before b
    join pg_policies a
      on a.schemaname = 'public'
     and a.tablename = b.tablename
     and a.policyname = b.policyname
  loop
    v_new := replace(coalesce(r.new_qual, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()');
    v_old := replace(coalesce(r.old_qual, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()');
    if v_new is distinct from v_old then
      raise exception
        'PCI/M7 ABORT: USING predicate changed meaning on %.% — old [%] new [%]',
        r.tablename, r.policyname, v_old, v_new;
    end if;

    v_new := replace(coalesce(r.new_check, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()');
    v_old := replace(coalesce(r.old_check, ''), '( SELECT auth.uid() AS uid)', 'auth.uid()');
    if v_new is distinct from v_old then
      raise exception
        'PCI/M7 ABORT: WITH CHECK predicate changed meaning on %.% — old [%] new [%]',
        r.tablename, r.policyname, v_old, v_new;
    end if;

    if r.old_cmd is distinct from r.new_cmd or r.old_roles is distinct from r.new_roles then
      raise exception
        'PCI/M7 ABORT: cmd/roles changed on %.% — cmd % -> %, roles % -> %',
        r.tablename, r.policyname, r.old_cmd, r.new_cmd, r.old_roles, r.new_roles;
    end if;
  end loop;

  -- No policy may have gone missing.
  if (select count(*) from _pci_policy_before)
     <> (select count(*) from pg_policies
         where schemaname = 'public' and tablename = any (tables)) then
    raise exception 'PCI/M7 ABORT: policy count changed on the rewritten tables';
  end if;
end
$$;
