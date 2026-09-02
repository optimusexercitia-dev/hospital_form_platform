-- =====================================================================================
-- AUTHZ ROLLBACK — OUT-OF-CHAIN SQL TEMPLATE
--
-- ⛔ THIS FILE IS DELIBERATELY *NOT* UNDER supabase/migrations, AND MUST NOT BE MOVED THERE.
--    A file in the migration tree is part of the ordered, forward-only applied chain —
--    committed means applied — so a "retained rollback migration" either undoes the cutover
--    on the next apply, is not a repository artifact, or hides behind a future timestamp and
--    fires unexpectedly. ADR 0162 §1 (which retracts ADR 0155 D7's retain-a-migration clause).
--
-- HOW TO USE
--    1. Work through docs/deployment/authz-rollback-runbook.md §1 (pre-flight) FIRST and paste
--       its output into the rollback record. Do not skip it: a rollback that assumes a
--       signature drops a function and silently invalidates its dependent policies.
--    2. npx supabase migration new authz_rollback_<what>
--    3. Copy the section(s) below into that new migration, fill every <PLACEHOLDER>, DELETE
--       every section you are not using, and delete this header.
--    4. Apply through the normal command. Verify per runbook §5 — on the CATALOG, and read
--       every exit code directly.
--
-- ⛔ NEVER `legacy OR new`. NEVER a caller-selectable evaluator. Runbook §3 — a disjunction of
--    the two evaluators is a permanent over-grant that passes every "did it work" check,
--    because the legacy side answers.
-- ⛔ NEVER delete catalog data. authz.roles / permissions / role_permissions and the assignment
--    projection stay exactly as they are. The catalog going quiet IS the rollback.
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- SECTION A — guard: fail loudly if the world is not what the pre-flight described.
-- Keep this. It is the difference between a rollback and a second incident.
-- -------------------------------------------------------------------------------------
do $$
begin
  -- A1. The object we are about to revert still exists with the signature we recorded.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = '<SCHEMA>' and p.proname = '<FUNCTION>'
       and pg_get_function_identity_arguments(p.oid) = '<RECORDED ARG LIST>'
  ) then
    raise exception
      'ROLLBACK ABORTED: %.% with args (%) is not present as recorded at pre-flight. '
      'Re-run the runbook §1 queries; the tree moved under this rollback.',
      '<SCHEMA>', '<FUNCTION>', '<RECORDED ARG LIST>';
  end if;

  -- A2. The DEFINER flag is what we recorded. A DEFINER's gate REPLACES RLS, so a silent
  --     flip here changes what the rollback means.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = '<SCHEMA>' and p.proname = '<FUNCTION>'
       and p.prosecdef is distinct from <TRUE|FALSE>
  ) then
    raise exception 'ROLLBACK ABORTED: %.% prosecdef differs from pre-flight.',
      '<SCHEMA>', '<FUNCTION>';
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- SECTION B — revert a RE-POINTED WRAPPER to the legacy adapter  (runbook §2a; AE4.6, AE5)
-- Delete this section if you are reverting an enforcement site instead.
-- -------------------------------------------------------------------------------------
create or replace function <SCHEMA>.<WRAPPER>(<RECORDED ARG LIST>)
returns <RECORDED RETURN TYPE>
language sql
stable
security definer
set search_path = <RECORDED SEARCH PATH>
as $fn$
  -- <THE PRE-CUTOVER PREDICATE, VERBATIM FROM THE PRE-FLIGHT CAPTURE.>
  -- ⛔ Not a paraphrase and not reconstructed from the migration file — migration text in
  --    this tree is stale by design (bodies are rewritten at runtime via
  --    pg_get_functiondef + replace + execute). Paste what pg_get_functiondef returned.
$fn$;

-- Restore the recorded ACLs explicitly. Do not assume they survived.
-- ⚠ A REVOKE you are not entitled to make is a SILENT NO-OP — verify by effective privilege
--   (has_function_privilege), never by reading proacl text (a NULL proacl includes PUBLIC).
revoke all on function <SCHEMA>.<WRAPPER>(<RECORDED ARG LIST>) from public;
grant execute on function <SCHEMA>.<WRAPPER>(<RECORDED ARG LIST>) to <RECORDED GRANTEES>;

-- -------------------------------------------------------------------------------------
-- SECTION C — revert a RE-KEYED ENFORCEMENT SITE to the role wrapper  (runbook §2b; AE4.9 D6)
-- Delete this section if you are reverting a wrapper instead.
--
-- ⛔ RESTORE THE DISJUNCT, NOT THE WHOLE BODY. A re-keyed policy typically reads
--      <permission authorizer>(...) OR <other authority>(...)
--    where only the FIRST disjunct was re-keyed. The second (e.g. a tenancy-admin arm) was
--    never part of the cutover and must survive verbatim — replacing the whole body is how a
--    rollback becomes its own outage.
-- ⛔ A `FOR ALL` POLICY HAS TWO HALVES. USING gates WHICH ROWS may be touched; WITH CHECK
--    gates THE NEW ROW. Restore and verify BOTH. A gate present in only one half is a live
--    hole that reads as a completed rollback.
-- -------------------------------------------------------------------------------------
alter policy <POLICY NAME> on <SCHEMA>.<TABLE>
  using       ( <PRE-CUTOVER USING EXPRESSION, VERBATIM> )
  with check  ( <PRE-CUTOVER WITH CHECK EXPRESSION, VERBATIM> );

-- Repeat for EVERY site the cutover touched. Enumerate them from the pre-flight dependent-
-- policy query, never from memory: a rollback that reverts three of four sites reads as
-- complete and leaves the fourth enforcing the new authority alone.

-- The now-unused domain authorizer is left IN PLACE, inert. Dropping it invalidates dependent
-- policies for no benefit, and leaving it makes a re-forward a one-line policy change.

-- -------------------------------------------------------------------------------------
-- SECTION D — post-conditions, inside the same transaction. If one fails, nothing applies.
-- -------------------------------------------------------------------------------------
do $$
declare
  v_offenders text;
begin
  -- D1. No site may end up asking BOTH authorities. Runbook §3.
  select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ')
    into v_offenders
    from pg_policies
   where coalesce(qual,'') || coalesce(with_check,'') like '%<NEW PERMISSION AUTHORIZER>%'
     and coalesce(qual,'') || coalesce(with_check,'') like '%<LEGACY PREDICATE>%';
  if v_offenders is not null then
    raise exception 'ROLLBACK ABORTED: legacy OR new left in place on: %', v_offenders;
  end if;

  -- D2. Catalog data is intact. The rollback silences the catalog; it never empties it.
  if (select count(*) from authz.role_permissions) = 0
     or (select count(*) from authz.permissions) = 0 then
    raise exception 'ROLLBACK ABORTED: catalog data was deleted. This template never deletes it.';
  end if;
end $$;

commit;

-- =====================================================================================
-- AFTER APPLYING — runbook §5. Not optional, and not satisfiable from console output:
--   1. npx supabase db reset --local && npm run test:db   (authz suites green)
--   2. re-run the runbook §1 pre-flight and DIFF against the recorded pre-cutover output,
--      object for object, including prosecdef and EFFECTIVE ACLs
--   3. for a Section C revert, exercise the PRODUCTION DOOR on a WRITE — a permissive
--      sibling *_select policy keeps a SELECT-based check green with the write policy
--      fully revoked
--   4. record BOTH compatibility directions (app→db and db→app) in the rollback record
-- ⛔ Read every exit code DIRECTLY. A pipe, a `| tail`, or a trailing echo erases it — this
--    program has already recorded two runs reported as exit 0 that were exit 1.
-- =====================================================================================
