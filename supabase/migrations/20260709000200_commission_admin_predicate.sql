-- =============================================================================
-- Phase A · A2 — Combined commission-admin predicate + the mechanical swap
-- (ADR 0051 Decision 1 & 3)
-- =============================================================================
-- Introduces `app.is_hospital_admin_of(hospital)`/`_for` and
-- `app.is_commission_admin_of(commission)`/`_for` (= org_admin-of-org OR
-- hospital_admin-of-hospital, both single-hop off the denormalized keys on
-- `commissions`), then MECHANICALLY swaps every commission-scoped
-- `is_org_admin_of_commission[_for]` OR-term to the combined predicate so future
-- admin tiers edit ONE function body, not ~60 policies (ADR 0051 rejected
-- alternative rationale).
--
-- The swap is done PROGRAMMATICALLY off the LIVE catalog (pg_get_functiondef /
-- pg_policies) rather than by hand-transcribing ~145 objects: this captures the
-- AUTHORITATIVE CURRENT definition of each object (which may live in a post-
-- baseline incremental, e.g. the is_active() fold from 20260702), so we never
-- swap a stale baseline copy. `replace(def, 'is_org_admin_of_commission',
-- 'is_commission_admin_of')` also correctly rewrites the `_for` variant
-- (`is_org_admin_of_commission_for` -> `is_commission_admin_of_for`).
--
-- All membership SD-helpers fold `app.is_active(...)` (20260702000000); the new
-- predicates below follow the SAME pattern so activity gating is preserved.
--
-- THE ONE DOCUMENTED EXCEPTION (Q5): the two `commissions` policies are keyed on
-- `organization_id` (not a commission id) — a hospital_admin arm is added by a
-- TWO-ARM REWRITE reading the keys off the row (`is_admin() OR
-- is_org_admin_of(organization_id) OR is_hospital_admin_of(hospital_id)`), NOT
-- the name-swap: `is_commission_admin_of(id)` on an INSERT WITH CHECK would
-- self-SELECT the not-yet-visible NEW row. They carry `is_org_admin_of`, not
-- `is_org_admin_of_commission`, so the mechanical swap does not touch them; they
-- are rewritten explicitly at the end of this migration.
-- =============================================================================

-- 1. is_hospital_admin_of(hospital) / _for — a caller (or p_user) is a
--    hospital_admin of the given hospital. is_active-gated like every peer.
create or replace function app.is_hospital_admin_of(p_hospital_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1 from public.organization_members
    where hospital_id = p_hospital_id
      and user_id = auth.uid()
      and role = 'hospital_admin'
  );
$$;
alter function app.is_hospital_admin_of(uuid) owner to postgres;
comment on function app.is_hospital_admin_of(uuid) is
  'ADR 0051: the caller is a hospital_admin of the given hospital. is_active-gated (mirrors the other membership SD-helpers).';

create or replace function app.is_hospital_admin_of_for(p_hospital_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.organization_members
    where hospital_id = p_hospital_id
      and user_id = p_user_id
      and role = 'hospital_admin'
  );
$$;
alter function app.is_hospital_admin_of_for(uuid, uuid) owner to postgres;
comment on function app.is_hospital_admin_of_for(uuid, uuid) is
  'ADR 0051: p_user is a hospital_admin of the given hospital. is_active(p_user)-gated.';

-- 2. is_commission_admin_of(commission) / _for — the COMBINED predicate: org_admin
--    of the commission's org OR hospital_admin of the commission's hospital. Both
--    arms single-hop off the denormalized `commissions.organization_id` /
--    `commissions.hospital_id`. is_active-gated like `is_org_admin_of_commission`
--    was (20260702 fold) — the activity gate stays on the caller/p_user.
create or replace function app.is_commission_admin_of(p_commission_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1
    from public.commissions c
    join public.organization_members om
      on (om.role = 'org_admin'
            and om.organization_id = c.organization_id
            and om.hospital_id is null)
      or (om.role = 'hospital_admin'
            and om.hospital_id = c.hospital_id)
    where c.id = p_commission_id
      and om.user_id = auth.uid()
  );
$$;
alter function app.is_commission_admin_of(uuid) owner to postgres;
comment on function app.is_commission_admin_of(uuid) is
  'ADR 0051 combined commission-admin predicate: org_admin(org-of-commission) OR hospital_admin(hospital-of-commission). Both arms single-hop off the denormalized keys on commissions. is_active-gated. The single OR-term swapped in across every commission-scoped site (replaces is_org_admin_of_commission).';

create or replace function app.is_commission_admin_of_for(p_commission_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1
    from public.commissions c
    join public.organization_members om
      on (om.role = 'org_admin'
            and om.organization_id = c.organization_id
            and om.hospital_id is null)
      or (om.role = 'hospital_admin'
            and om.hospital_id = c.hospital_id)
    where c.id = p_commission_id
      and om.user_id = p_user_id
  );
$$;
alter function app.is_commission_admin_of_for(uuid, uuid) owner to postgres;
comment on function app.is_commission_admin_of_for(uuid, uuid) is
  'ADR 0051 combined commission-admin predicate (for a specified user). org_admin OR hospital_admin of the commission. is_active(p_user)-gated. Replaces is_org_admin_of_commission_for.';

-- Grants mirror the existing org predicates.
revoke all on function app.is_hospital_admin_of(uuid) from public;
revoke all on function app.is_hospital_admin_of_for(uuid, uuid) from public;
revoke all on function app.is_commission_admin_of(uuid) from public;
revoke all on function app.is_commission_admin_of_for(uuid, uuid) from public;
grant execute on function app.is_hospital_admin_of(uuid) to authenticated, service_role;
grant execute on function app.is_hospital_admin_of_for(uuid, uuid) to authenticated, service_role;
grant execute on function app.is_commission_admin_of(uuid) to authenticated, service_role;
grant execute on function app.is_commission_admin_of_for(uuid, uuid) to authenticated, service_role;

-- 3. The mechanical swap, off the live catalog.
--    (a) Procs: regenerate each function that references is_org_admin_of_commission
--        via pg_get_functiondef, replacing the symbol, then re-execute. The four
--        NEW predicates above are excluded (they must NOT be rewritten). The old
--        is_org_admin_of_commission[_for] functions themselves are excluded — they
--        are DROPPED at the end once nothing references them.
do $swap$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid,
           n.nspname || '.' || p.proname
             || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosrc ilike '%is_org_admin_of_commission%'
      and n.nspname in ('app','public')
      -- never rewrite the swap targets or the soon-dropped originals
      and not (n.nspname = 'app' and p.proname in (
        'is_org_admin_of_commission','is_org_admin_of_commission_for',
        'is_commission_admin_of','is_commission_admin_of_for'
      ))
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'is_org_admin_of_commission', 'is_commission_admin_of');
    execute v_def;
  end loop;
end
$swap$;

--    (b) Policies: drop + recreate each policy whose USING/CHECK references the old
--        symbol, with the symbol swapped. Reconstructed from pg_policies (cmd,
--        roles, qual, with_check). PERMISSIVE only in this codebase.
do $swap$
declare
  r record;
  v_qual text;
  v_check text;
  v_roles text;
  v_cmd text;
  v_using text;
  v_withcheck text;
begin
  for r in
    select schemaname, tablename, policyname, cmd, roles, qual, with_check
    from pg_policies
    where qual ilike '%is_org_admin_of_commission%'
       or with_check ilike '%is_org_admin_of_commission%'
  loop
    v_qual := replace(coalesce(r.qual, ''), 'is_org_admin_of_commission', 'is_commission_admin_of');
    v_check := replace(coalesce(r.with_check, ''), 'is_org_admin_of_commission', 'is_commission_admin_of');
    v_roles := array_to_string(r.roles, ', ');
    -- pg_policies.cmd is 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'.
    v_cmd := case when r.cmd = 'ALL' then '' else ' for ' || r.cmd end;
    v_using := case when r.qual is not null then ' using (' || v_qual || ')' else '' end;
    v_withcheck := case when r.with_check is not null then ' with check (' || v_check || ')' else '' end;

    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute format(
      'create policy %I on %I.%I%s to %s%s%s',
      r.policyname, r.schemaname, r.tablename, v_cmd, v_roles, v_using, v_withcheck
    );
  end loop;
end
$swap$;

-- 4. Drop the now-unreferenced original predicates. If anything still references
--    them the DROP fails (RESTRICT) — a built-in belt-and-suspenders that the swap
--    was complete. (The A5 catalog-sweep pgTAP is the standing assertion.)
drop function if exists app.is_org_admin_of_commission(uuid);
drop function if exists app.is_org_admin_of_commission_for(uuid, uuid);

-- 5. THE ONE DOCUMENTED EXCEPTION (Q5) — the two `commissions` policies. Keyed on
--    organization_id (not a commission id); add the hospital_admin arm by reading
--    the keys off the row directly (single-hop; safe on INSERT WITH CHECK). The
--    SELECT policy also preserves its existing PQS / NSP-coordinator OR-terms
--    (added post-baseline — the LIVE definition, not the plan's stale snapshot).
drop policy if exists "commissions_admin_write" on public.commissions;
create policy "commissions_admin_write" on public.commissions
  to authenticated
  using (
    app.is_admin()
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(hospital_id)
  )
  with check (
    app.is_admin()
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(hospital_id)
  );
comment on policy "commissions_admin_write" on public.commissions is
  'ADR 0051 Q5 — the documented exception to the is_commission_admin_of name-swap. Two-arm rewrite reading organization_id/hospital_id off the NEW row (is_commission_admin_of(id) would self-SELECT the not-yet-visible row on INSERT WITH CHECK). hospital_admin creates/renames commissions inside its hospital (Decision 7).';

drop policy if exists "commissions_select_member_or_admin" on public.commissions;
create policy "commissions_select_member_or_admin" on public.commissions
  for select to authenticated
  using (
    app.is_member_of(id)
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(hospital_id)
    or app.is_pqs_member_of(organization_id)
    or app.is_nsp_coordinator_of(organization_id)
  );
comment on policy "commissions_select_member_or_admin" on public.commissions is
  'ADR 0051 Q5 — documented exception to the name-swap. Adds a hospital_admin arm (reads its hospital''s commissions, Decision 4) alongside the preserved member / org_admin / PQS-member / NSP-coordinator arms.';
