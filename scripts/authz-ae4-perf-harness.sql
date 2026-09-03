-- ============================================================================
-- AE4 PERFORMANCE ACCEPTANCE — MEASUREMENT HARNESS
--
--   Obligation:  FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH (audit IA-F9)
--   Acceptance:  docs/design/authz-ae4-performance-acceptance.md   <- READ FIRST
--   Requires:    scripts/authz-ae4-perf-fixture.sql already loaded + ANALYZEd
--
-- RUN IT — PASS A (required), capture the whole stdout as the artifact:
--
--   docker exec -i supabase_db_azkbbhskturikxpgmafq \
--     psql -U postgres -d postgres -X -f - \
--     < scripts/authz-ae4-perf-harness.sql \
--     > docs/design/authz-ae4-perf-run-passA.txt 2>&1
--
-- ⚠ SECTION ORDER (changed after run 1): gates + controls -> PASS A -> PASS B
--   -> DC2/P4/P5 -> DC1 -> postflight. Pass B is deliberately AHEAD of the
--   sections that can abort: in run 1 it sat after them, psql died in section 7
--   under ON_ERROR_STOP, and P1/P2/P3 were left with no evidence at all.
--
-- RUN IT — PASS B (nested body plans; required for pass conditions P1-P3):
--
--   docker exec -i supabase_db_azkbbhskturikxpgmafq \
--     psql -U postgres -d postgres -X -v NESTED=1 -f - \
--     < scripts/authz-ae4-perf-harness.sql \
--     > docs/design/authz-ae4-perf-run-passB.txt 2>&1
--
-- ============================================================================
-- WHAT THIS MEASURES, AND THE ONE TRAP IT IS BUILT AROUND
-- ----------------------------------------------------------------------------
-- The final path, catalog-verified 2026-09-02:
--
--   RLS policy predicate
--     -> app.can_edit_commission_forms / app.can_read_professional_profile
--        (LAYER 3, SECURITY DEFINER, STABLE, non-inlinable)
--        -> authz.has_permission                        (LAYER 2)
--           -> authz.entailed_grants                    (LAYER 2)
--              -> authz.assignment_facts                (LAYER 1, DEFINER SRF)
--              -> authz.scope_reaches                   (per assignment fact)
--              -> authz.roles / role_permissions / permission_implication_closure
--
-- ⛔ NEVER `authz.holds_role` alone. It is not even ON this path: has_permission
--    reaches assignment_facts directly through entailed_grants. holds_role is
--    the layer-1 sibling used by app.is_staff_admin_of{,_for}. Measuring it
--    measures the pre-D6 world.
--
-- ⛔ THE TRAP. Each layer-3 authorizer retains a RESIDUAL LEGACY ARM (ADR 0178
--    §2), and a disjunction short-circuits. A principal who passes the legacy
--    arm may never reach the permission arm at all, so a "the seam is cheap"
--    number taken on such a principal has measured NOTHING. Section 2 PROVES
--    (does not assert) that the measured principal's only grant path is the
--    permission arm, and section 3 proves it by ABLATION: disable layer 2's
--    state gate and the authorizer must go FALSE. If it stays TRUE, some other
--    arm is granting and this whole run is VOID.
-- ============================================================================

\set ON_ERROR_STOP on
\timing on
\pset pager off

-- --------------------------------------------------------------------------
-- Identities and claims, read back from the fixture manifest so this file
-- cannot drift from the fixture that is actually loaded.
-- --------------------------------------------------------------------------
select
  (select v from ae4perf.fixture_meta where k = 'principal_id')         as p_perm,
  (select v from ae4perf.fixture_meta where k = 'legacy_principal_id')  as p_legacy,
  (select v from ae4perf.fixture_meta where k = 'target_commission_id') as t_comm,
  (select v from ae4perf.fixture_meta where k = 'target_org_id')        as t_org,
  (select v from ae4perf.fixture_meta where k = 'target_form_id')       as t_form,
  (select v from ae4perf.fixture_meta where k = 'target_version_id')    as t_ver,
  (select v from ae4perf.fixture_meta where k = 'target_profile_id')    as t_prof
\gset

-- Claims payloads, one line each (a trailing comment would become part of the
-- value, and a multi-line literal invites a CRLF checkout to smuggle in \r).
--   C_PERM   the measured principal: staff_admin hat, permission arm only
--   C_LEGACY org_admin of the same org: reaches the same rows via the LEGACY arm
--   C_NOHAT  C_PERM with active_role absent — the hat control
select
  json_build_object('sub', :'p_perm',   'role','authenticated','is_admin',false,'active_role','staff_admin')::text as c_perm,
  json_build_object('sub', :'p_legacy', 'role','authenticated','is_admin',false,'active_role','org_admin')::text   as c_legacy,
  json_build_object('sub', :'p_perm',   'role','authenticated','is_admin',false)::text                             as c_nohat,
  json_build_object('sub', :'p_perm',   'role','authenticated','is_admin',false,'active_role','staff')::text       as c_wronghat
\gset


\echo ''
\echo '################################################################'
\echo '## SECTION 0 — FIXTURE GATE                                   ##'
\echo '##  A fixture that did not fully load, or was never ANALYZEd, ##'
\echo '##  cannot reach the failing state this acceptance is written ##'
\echo '##  against. Nothing below runs unless both hold.             ##'
\echo '################################################################'

do $$
declare
  v_bad text := '';
  v_c bigint; v_want bigint; v_never text;
  r record;
begin
  if to_regnamespace('ae4perf') is null then
    raise exception 'AE4 perf fixture is NOT loaded — run scripts/authz-ae4-perf-fixture.sql first.';
  end if;

  -- Declared scale vs live census.
  for r in
    select 'public.commissions'           as rel, 'n_comm' as key union all
    select 'public.professional_profiles',       'n_prof'      union all
    select 'public.forms',                       'n_form'      union all
    select 'public.form_items',                  'n_item'
  loop
    execute format('select count(*) from %s', r.rel) into v_c;
    select v::bigint into v_want from ae4perf.fixture_meta where k = r.key;
    -- Live count includes the seed rows, so the fixture must account for AT
    -- LEAST its declared scale. A count BELOW the declared scale means a
    -- partial load.
    if v_c < v_want then
      v_bad := v_bad || format('%s has %s rows, fixture declares %s; ', r.rel, v_c, v_want);
    end if;
  end loop;

  -- The measured principal's fan-out.
  select count(*) into v_c from public.memberships
   where principal_id = (select v::uuid from ae4perf.fixture_meta where k = 'principal_id');
  select v::bigint into v_want from ae4perf.fixture_meta where k = 'n_fanout';
  if v_c <> v_want then
    v_bad := v_bad || format('principal fan-out is %s, declared %s; ', v_c, v_want);
  end if;

  -- ANALYZE state on every table the catalog-verified chain reads.
  select string_agg(c.relname, ', ') into v_never
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_all_tables s on s.relid = c.oid
   where ((n.nspname = 'public' and c.relname in
            ('memberships','profiles','commissions','hospitals','professional_profiles',
             'forms','form_versions','form_sections','form_items'))
       or (n.nspname = 'authz' and c.relname in
            ('roles','role_permissions','permissions','permission_implication_closure')))
     and s.last_analyze is null and s.last_autoanalyze is null;
  if v_never is not null then
    v_bad := v_bad || format('NEVER ANALYZED: %s; ', v_never);
  end if;

  if v_bad <> '' then
    raise exception 'AE4 FIXTURE GATE FAILED (run is VOID, not failing): %', v_bad;
  end if;
  raise notice 'AE4 fixture gate OK — declared scale present, chain tables analyzed.';
end $$;

-- --------------------------------------------------------------------------
-- THE VERDICT TABLE (added after run 2).
--
-- ⛔ Run 2's P5 raised in section 7 under ON_ERROR_STOP and killed psql, so
--    DC1 -- the control that excludes a dead instrument -- never ran, AGAIN.
--    The control that validates a condition sat DOWNSTREAM of it and could not
--    run in exactly the case where it matters: a failing condition. P4's
--    verdict was collateral: a P5 failure hid whatever P4 would have said.
--
--    So conditions no longer raise where they are evaluated. They record a
--    verdict, everything runs, and section 10 raises ONCE at the end -- after
--    the controls and after the postflight.
--
-- ⛔ AND the verdict carries a DEPENDENCY RULE: a condition whose controls did
--    not PASS is recorded VOID, never PASS and never FAIL. That is the
--    structural answer to "a reproducible failure is still not reportable as a
--    verdict" -- the table says so, and says why, instead of a human arguing
--    it from the fact that the numbers looked discriminating.
drop table if exists pg_temp.ae4_verdict;
create temp table ae4_verdict(
  id      text primary key,
  kind    text not null check (kind in ('CONTROL','CONDITION')),
  status  text not null check (status in ('PASS','FAIL','VOID','UNRUN')),
  detail  text
);

create or replace function pg_temp.ae4_say(p_id text, p_kind text, p_status text, p_detail text)
returns void language sql as $$
  insert into pg_temp.ae4_verdict(id, kind, status, detail)
  values (p_id, p_kind, p_status, p_detail)
  on conflict (id) do update set kind = excluded.kind, status = excluded.status, detail = excluded.detail;
$$;

-- Pre-register every condition as UNRUN. An id that never gets written stays
-- UNRUN and is reported as such: a condition that silently vanished from the
-- table would otherwise read as a clean sheet.
select pg_temp.ae4_say('P1','CONDITION','UNRUN','VERDICT from scripts/authz-ae4-p1-index-path.sql (exit 0 = clear, 3 = fail/VOID; ADR 0181); the raw seq-scan census stays evidence from the nested region -- acceptance doc section 9.7');
select pg_temp.ae4_say('P2','CONDITION','UNRUN','VERDICT from scripts/authz-ae4-p2-invocation-count.sql (exit 0 = clear, 3 = fail/VOID; ADR 0183, acceptance doc section 16). ⛔ The section 9.7 loops= grep is RETIRED as a verdict: it counts loops VALUES, is invariant to the candidate count, and cannot fail.');
select pg_temp.ae4_say('P3','CONDITION','UNRUN','evaluated externally from the nested region -- acceptance doc section 9.7');
select pg_temp.ae4_say('P4','CONDITION','UNRUN','section 7 did not reach it');
select pg_temp.ae4_say('P5','CONDITION','UNRUN','section 7 did not reach it');
select pg_temp.ae4_say('DC1','CONTROL','UNRUN','section 8 did not reach it');
select pg_temp.ae4_say('DC2','CONTROL','UNRUN','section 7 did not reach it');

\echo '--- cardinalities the plans below are taken over ---'
select 'memberships' as t, count(*) from public.memberships
union all select 'profiles',              count(*) from public.profiles
union all select 'commissions',           count(*) from public.commissions
union all select 'hospitals',             count(*) from public.hospitals
union all select 'professional_profiles', count(*) from public.professional_profiles
union all select 'form_items',            count(*) from public.form_items
union all select 'audit_log (census)',    count(*) from public.audit_log
order by 1;


\echo ''
\echo '################################################################'
\echo '## SECTION 1 — POSITIVE CONTROL (AE0.2 idiom)                 ##'
\echo '##  If these arms do not DIFFER, the claims GUC is not        ##'
\echo '##  reaching the policies and every plan below is vacuous.    ##'
\echo '################################################################'

drop table if exists pg_temp.ae4_control;
create temp table ae4_control(arm text, prof_rows bigint, form_rows bigint, can_edit boolean);
grant insert, select on ae4_control to authenticated;

begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  insert into pg_temp.ae4_control
  select '1a MEASURED principal / hat=staff_admin',
         (select count(*) from public.professional_profiles),
         (select count(*) from public.form_items),
         app.can_edit_commission_forms(:'t_comm'::uuid, (select auth.uid()));
  reset role;
commit;

begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_legacy';
  insert into pg_temp.ae4_control
  select '1b LEGACY-arm principal / hat=org_admin',
         (select count(*) from public.professional_profiles),
         (select count(*) from public.form_items),
         app.can_edit_commission_forms(:'t_comm'::uuid, (select auth.uid()));
  reset role;
commit;

begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_nohat';
  insert into pg_temp.ae4_control
  select '1c MEASURED principal / NO active_role claim',
         (select count(*) from public.professional_profiles),
         (select count(*) from public.form_items),
         app.can_edit_commission_forms(:'t_comm'::uuid, (select auth.uid()));
  reset role;
commit;

begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_wronghat';
  insert into pg_temp.ae4_control
  select '1d MEASURED principal / WRONG hat=staff',
         (select count(*) from public.professional_profiles),
         (select count(*) from public.form_items),
         app.can_edit_commission_forms(:'t_comm'::uuid, (select auth.uid()));
  reset role;
commit;

begin;
  set local role authenticated;
  insert into pg_temp.ae4_control
  select '1e authenticated / NO claims at all', (select count(*) from public.professional_profiles),
         (select count(*) from public.form_items), null::boolean;
  reset role;
commit;

insert into pg_temp.ae4_control
select '1f postgres / RLS BYPASSED (the trap)',
       (select count(*) from public.professional_profiles),
       (select count(*) from public.form_items), null::boolean;

select * from pg_temp.ae4_control order by arm;

do $$
declare v_d int; v_a boolean; v_c boolean; v_dd boolean;
begin
  select count(distinct (prof_rows, form_rows)) into v_d from pg_temp.ae4_control;
  if v_d < 3 then
    raise exception 'AE4 POSITIVE CONTROL FAILED: only % distinct readings — the session context is not being applied; every plan below would be vacuous', v_d;
  end if;
  -- The hat is load-bearing: 1c (no hat) and 1d (wrong hat) must NOT grant.
  select can_edit into v_a  from pg_temp.ae4_control where arm like '1a%';
  select can_edit into v_c  from pg_temp.ae4_control where arm like '1c%';
  select can_edit into v_dd from pg_temp.ae4_control where arm like '1d%';
  if not coalesce(v_a, false) then
    raise exception 'AE4 CONTROL FAILED: the measured principal cannot edit — fixture or hat is wrong';
  end if;
  if coalesce(v_c, false) or coalesce(v_dd, false) then
    raise exception 'AE4 CONTROL FAILED: a missing/wrong hat still grants (1c=%, 1d=%) — the self-check conjunct is not live, so nothing below is measuring the production shape', v_c, v_dd;
  end if;
  raise notice 'AE4 positive control OK: % distinct readings; hat is load-bearing.', v_d;
end $$;


\echo ''
\echo '################################################################'
\echo '## SECTION 2 — THE PRINCIPAL PROOF                            ##'
\echo '##  "Its ONLY grant path is the permission arm" — proven, one ##'
\echo '##  assertion per competing arm, not asserted in prose.       ##'
\echo '################################################################'

-- Run as postgres with the principal's claims GUC set: authz.* carries no
-- `authenticated` EXECUTE, and setting the GUC (rather than switching role)
-- keeps auth.uid() = the principal, so entailed_grants still takes its SELF
-- branch and the hat conjunct still applies. This is the production semantics
-- with the schema-private layer made callable.
begin;
  set local request.jwt.claims = :'c_perm';

  select 'a. app.can_edit_commission_forms  (must be TRUE)'  as check,
         app.can_edit_commission_forms(:'t_comm'::uuid, :'p_perm'::uuid) as result
  union all
  select 'b. app.is_tenancy_admin_of_for    (must be FALSE — the ONLY other arm)',
         app.is_tenancy_admin_of_for(:'t_comm'::uuid, :'p_perm'::uuid)
  union all
  select 'c. authz.has_permission           (must be TRUE — the arm that grants)',
         authz.has_permission(:'p_perm'::uuid, 'commission', :'t_comm'::uuid, 'commission.forms.edit')
  union all
  select 'd. app.is_admin()                 (must be FALSE)',
         app.is_admin()
  union all
  select 'e. app.can_manage_professional    (must be FALSE — the org-authority arm)',
         app.can_manage_professional(:'t_org'::uuid, :'p_perm'::uuid)
  union all
  select 'f. app.can_read_professional_profile (must be TRUE)',
         app.can_read_professional_profile(:'t_prof'::uuid, :'p_perm'::uuid)
  union all
  select 'g. authz.has_permission org.professionals.read (must be TRUE)',
         authz.has_permission(:'p_perm'::uuid, 'organization', :'t_org'::uuid, 'org.professionals.read')
  union all
  select 'h. principal holds org_admin/hospital_admin anywhere (must be FALSE)',
         exists (select 1 from public.memberships m
                  where m.principal_id = :'p_perm'::uuid
                    and m.role in ('org_admin','hospital_admin'))
  union all
  select 'i. profiles.is_admin (must be FALSE)',
         (select p.is_admin from public.profiles p where p.id = :'p_perm'::uuid)
  union all
  select 'j. case-participant traversal arm of can_read_professional_profile (must be FALSE)',
         exists (select 1
                   from public.professional_participants pp
                   join public.case_participants cp
                     on cp.participant_id = pp.participant_id and cp.removed_at is null
                  where pp.professional_profile_id = :'t_prof'::uuid
                    and app.can_read_case_committee(cp.case_id, :'p_perm'::uuid));

  do $$
  declare v_bad text := '';
  begin
    if not app.can_edit_commission_forms(
             (select v::uuid from ae4perf.fixture_meta where k='target_commission_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'))
      then v_bad := v_bad || 'a(can_edit=false) '; end if;
    if app.is_tenancy_admin_of_for(
             (select v::uuid from ae4perf.fixture_meta where k='target_commission_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'))
      then v_bad := v_bad || 'b(LEGACY ARM GRANTS — measurement would be meaningless) '; end if;
    if coalesce(app.is_admin(), false) then v_bad := v_bad || 'd(is_admin) '; end if;
    if app.can_manage_professional(
             (select v::uuid from ae4perf.fixture_meta where k='target_org_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'))
      then v_bad := v_bad || 'e(ORG-AUTHORITY ARM GRANTS) '; end if;
    if not app.can_read_professional_profile(
             (select v::uuid from ae4perf.fixture_meta where k='target_profile_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'))
      then v_bad := v_bad || 'f(can_read=false) '; end if;
    if exists (select 1 from public.memberships m
                where m.principal_id = (select v::uuid from ae4perf.fixture_meta where k='principal_id')
                  and m.role in ('org_admin','hospital_admin'))
      then v_bad := v_bad || 'h(holds a tenancy-admin role) '; end if;
    if v_bad <> '' then
      raise exception 'AE4 PRINCIPAL PROOF FAILED (run is VOID): %', v_bad;
    end if;
    raise notice 'AE4 principal proof OK — every competing arm is FALSE and the authorizers are TRUE.';
  end $$;
rollback;


\echo ''
\echo '################################################################'
\echo '## SECTION 3 — THE ABLATION                                   ##'
\echo '##  Disable LAYER 2 only (authz.roles.state) and both         ##'
\echo '##  authorizers must go FALSE. Membership, hat, profile and   ##'
\echo '##  every legacy arm are untouched, so anything still TRUE    ##'
\echo '##  here is granted by an arm this measurement does not see.  ##'
\echo '##  Then ROLLBACK must bring both back to TRUE: a probe that  ##'
\echo '##  moves but does not restore is a broken harness, not a     ##'
\echo '##  finding.                                                  ##'
\echo '################################################################'

begin;
  update authz.roles set state = 'legacy' where code = 'staff_admin';

  set local request.jwt.claims = :'c_perm';

  select 'ABLATED: app.can_edit_commission_forms (must be FALSE)' as check,
         app.can_edit_commission_forms(:'t_comm'::uuid, :'p_perm'::uuid) as result
  union all
  select 'ABLATED: app.can_read_professional_profile (must be FALSE)',
         app.can_read_professional_profile(:'t_prof'::uuid, :'p_perm'::uuid);

  do $$
  declare v_e boolean; v_r boolean;
  begin
    v_e := app.can_edit_commission_forms(
             (select v::uuid from ae4perf.fixture_meta where k='target_commission_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'));
    v_r := app.can_read_professional_profile(
             (select v::uuid from ae4perf.fixture_meta where k='target_profile_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'));
    if coalesce(v_e, false) or coalesce(v_r, false) then
      raise exception
        'AE4 ABLATION FAILED (run is VOID): with layer 2 disabled, can_edit=% can_read=%. Some arm OTHER than the permission arm is granting, so no number below is a measurement of the seam.',
        v_e, v_r;
    end if;
    raise notice 'AE4 ablation OK — layer 2 off => both authorizers FALSE.';
  end $$;
rollback;

-- Restoration half. A probe that moves the answer but never brings it back
-- has not proven the rollback; it has proven the harness is destructive.
begin;
  set local request.jwt.claims = :'c_perm';
  do $$
  declare v_e boolean; v_r boolean;
  begin
    v_e := app.can_edit_commission_forms(
             (select v::uuid from ae4perf.fixture_meta where k='target_commission_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'));
    v_r := app.can_read_professional_profile(
             (select v::uuid from ae4perf.fixture_meta where k='target_profile_id'),
             (select v::uuid from ae4perf.fixture_meta where k='principal_id'));
    if not coalesce(v_e, false) or not coalesce(v_r, false) then
      raise exception 'AE4 ABLATION ROLLBACK FAILED: after rollback can_edit=% can_read=% (expected TRUE, TRUE)', v_e, v_r;
    end if;
    raise notice 'AE4 ablation rollback OK — both authorizers restored to TRUE.';
  end $$;
rollback;

select 'authz.roles.state restored' as check, code, state::text
from authz.roles where code = 'staff_admin';


\echo ''
\echo '################################################################'
\echo '## PASS A — EXPLAIN (ANALYZE, BUFFERS), 3 reps per path       ##'
\echo '##  Rep 1 pays the cold-cache cost; reps 2-3 are warm. All    ##'
\echo '##  three are reported: the difference is signal.             ##'
\echo '################################################################'

\echo ''
\echo '=== M1 — READ, unfiltered: public.professional_profiles ==='
\echo '=== sole permissive SELECT policy => can_read_professional_profile'
\echo '=== is evaluated ONCE PER ROW with nothing able to short-circuit it.'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) select count(*) from public.professional_profiles;
  explain (analyze, buffers) select count(*) from public.professional_profiles;
  explain (analyze, buffers) select count(*) from public.professional_profiles;
  reset role;
rollback;

\echo ''
\echo '=== M1b — READ, org-filtered (the realistic list read). THIS IS THE'
\echo '=== P5 STATEMENT: the same rows are reachable by the legacy-arm'
\echo '=== principal below, so the two runs differ ONLY in which arm grants.'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid;
  explain (analyze, buffers) select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid;
  explain (analyze, buffers) select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid;
  reset role;
rollback;

\echo ''
\echo '=== M1b-LEGACY — the SAME statement, the LEGACY-arm principal.'
\echo '=== org_admin reaches these rows through app.can_manage_professional'
\echo '=== and never evaluates authz.has_permission. P5 = M1b / M1b-LEGACY.'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_legacy';
  explain (analyze, buffers) select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid;
  explain (analyze, buffers) select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid;
  explain (analyze, buffers) select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid;
  reset role;
rollback;

\echo ''
\echo '=== M2 — WRITE, single row: public.forms.'
\echo '=== forms_staff_admin_write is the ONLY policy applicable to an UPDATE'
\echo '=== (forms_select is SELECT-only), so the permission arm cannot be'
\echo '=== short-circuited by a sibling policy the way a SELECT can be.'
\echo '=== Rolled back — EXPLAIN ANALYZE EXECUTES the statement.'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) update public.forms set title = title where id = :'t_form'::uuid;
  reset role;
rollback;
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) update public.forms set title = title where id = :'t_form'::uuid;
  reset role;
rollback;

\echo ''
\echo '=== M3 — WRITE, one version (200 items). The per-row write gate.'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) update public.form_items set position = position where form_version_id = :'t_ver'::uuid;
  reset role;
rollback;
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) update public.form_items set position = position where form_version_id = :'t_ver'::uuid;
  reset role;
rollback;

\echo ''
\echo '=== M3b — WRITE, every version of the measured commission (16 000 items).'
\echo '⛔ M2 / M3 / M3b TIMINGS MAY NOT BE USED FOR A RATIO. public.form_items'
\echo '   carries audit_form_items_trg, a FOR EACH ROW trigger that appends to'
\echo '   the hash-chained audit_log, and its per-row cost dwarfs the policy'
\echo '   predicate. A "linear growth" reading here would be a fact about the'
\echo '   AUDIT TRIGGER, not about the seam. These three paths contribute PLAN'
\echo '   SHAPE ONLY (pass condition P1). The linearity condition P4 is'
\echo '   measured on the READ path in section 7, where no trigger fires.'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) update public.form_items set position = position
   where form_version_id in (select v.id from public.form_versions v
                             join public.forms f on f.id = v.form_id
                            where f.commission_id = :'t_comm'::uuid);
  reset role;
rollback;
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers) update public.form_items set position = position
   where form_version_id in (select v.id from public.form_versions v
                             join public.forms f on f.id = v.form_id
                            where f.commission_id = :'t_comm'::uuid);
  reset role;
rollback;

\echo ''
\echo '=== M4 — ATTRIBUTION ONLY, NOT THE ACCEPTANCE. The isolated seam:'
\echo '=== ~10 000 direct authz.has_permission calls. Reported so the'
\echo '=== per-call cost can be attributed, never as evidence about the'
\echo '=== final path (that is exactly the mistake the FUP forbids).'
\echo '⛔ The scope id VARIES per row on purpose. has_permission is STABLE, so'
\echo '   with four constant arguments the planner folds it to a single'
\echo '   InitPlan evaluation and the "10 000 calls" would be one call — a'
\echo '   measurement of nothing that reads as a spectacularly fast seam.'
\echo '⛔ M4 SEQ-SCANS public.commissions BY DESIGN — its own FROM clause asks'
\echo '   for every commission, and at 966 rows with loops=1 that is the'
\echo '   correct plan. It is NOT a P1 hit: P1 bounds access INSIDE the'
\echo '   DEFINER bodies, which only Pass B can show. Run 1 flagged this'
\echo '   line because the P1 grep was unscoped -- scope it to the nested'
\echo '   region sentinels (acceptance doc section 9.7).'
begin;
  set local request.jwt.claims = :'c_perm';
  explain (analyze, buffers)
  select count(*) filter (
           where authz.has_permission(:'p_perm'::uuid, 'commission', c.id, 'commission.forms.edit'))
    from public.commissions c, generate_series(1, 11) g;
rollback;


\echo ''
\echo '################################################################'
\echo '## PASS B — NESTED BODY PLANS  (opt-in:  -v NESTED=1)         ##'
\echo '##  A SECURITY DEFINER function is never inlined, so PASS A   ##'
\echo '##  shows only an outer Filter / Function Scan and the BODY   ##'
\echo '##  plan is invisible. Pass conditions P1, P2 and P3 are read ##'
\echo '##  from THIS output and nowhere else.                        ##'
\echo '##  ⛔ Row counts are deliberately BOUNDED here (200, not     ##'
\echo '##  10 000): auto_explain emits one plan per nested statement ##'
\echo '##  per row. These are their own named paths (M1-nested,      ##'
\echo '##  M3-nested) and their numbers are NOT M1s or M3s.          ##'
\echo '##                                                            ##'
\echo '##  ⛔ RUN 1 (2026-09-02) NEVER REACHED THIS BLOCK. It sat     ##'
\echo '##  AFTER sections 7-8 and psql died in section 7 under       ##'
\echo '##  ON_ERROR_STOP, so P1/P2/P3 had no evidence and the        ##'
\echo '##  absence was misread as "EXPLAIN cannot descend into a     ##'
\echo '##  DEFINER body" — true of PASS A, and the wrong mechanism.  ##'
\echo '##  Pass B now runs BEFORE anything that can abort, so the    ##'
\echo '##  structural evidence survives a later failure.             ##'
\echo '##  ⛔ AND: an absent subject must never read as a pass. The   ##'
\echo '##  SUBJECT-PRESENT markers below are what the P1/P2/P3 greps ##'
\echo '##  check FIRST; zero occurrences is VOID, never PASS.        ##'
\echo '################################################################'

\if :{?NESTED}
-- ⛔ SENTINELS, and why they look like this. Run 2's extraction returned a
--    48-line region and presence 0 -- not because auto_explain failed (it
--    emitted 229 939 lines) but because the OLD markers were plain words that
--    also appeared in the prose EXPLAINING them: the range opened on an
--    advisory line beside M4 and closed on this banner's own second line. A
--    detector matched its own documentation. These sentinels are tokenised,
--    alone on their line, and the token is NEVER written in prose anywhere in
--    this repository except the extraction command itself.
\echo '@@AE4_NESTED_BEGIN@@'
set auto_explain.log_min_duration = 0;
set auto_explain.log_nested_statements = on;
set auto_explain.log_analyze = on;
set auto_explain.log_buffers = on;
set auto_explain.log_timing = off;
set auto_explain.log_format = 'text';
set client_min_messages = log;

\echo '=== PASS B / M1-nested — 200 protected rows through the READ policy ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  select count(*) from (select 1 from public.professional_profiles limit 200) t;
  reset role;
rollback;

\echo '=== PASS B / M2-nested — the single-row WRITE gate ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  update public.forms set title = title where id = :'t_form'::uuid;
  reset role;
rollback;

\echo '=== PASS B / SEAM-nested — one direct authz.has_permission call ==='
\echo '=== the cleanest view of layers 2 and 1 with no policy noise ==='
begin;
  set local request.jwt.claims = :'c_perm';
  select authz.has_permission(:'p_perm'::uuid, 'commission', :'t_comm'::uuid, 'commission.forms.edit');
rollback;

reset auto_explain.log_min_duration;
reset auto_explain.log_nested_statements;
reset auto_explain.log_analyze;
reset auto_explain.log_buffers;
reset auto_explain.log_timing;
reset client_min_messages;

\echo '@@AE4_NESTED_END@@'
\echo '⛔ If the marker above is present but the subject greps in the'
\echo '   acceptance doc section 7 return ZERO, that is a finding about the'
\echo '   CAPTURE MECHANISM (auto_explain not reaching the client), not a'
\echo '   pass on P2/P3. Diagnose before evaluating any bound.'
\else
\echo '(Pass B skipped — re-run with  -v NESTED=1  to capture nested body plans.)'
\echo '⛔ P1, P2 and P3 are UNMEASURED in this run. They are not passed.'
\endif


\echo ''
\echo '################################################################'
\echo '## SECTION 7 — DC2 (N-differential), P4 (linearity), P5 (arms) ##'
\echo '##  All three are measured on the READ path, where no trigger  ##'
\echo '##  fires, so the number is the policy predicate and nothing   ##'
\echo '##  else. DC2 asks whether the cost tracks the protected-row   ##'
\echo '##  count at all (flat in N => the fixture did not scale, or   ##'
\echo '##  the SRF is hoisted, and a flat green number would be       ##'
\echo '##  indistinguishable from a dead instrument). P4 asks whether ##'
\echo '##  that growth is at worst linear. P5 compares the permission ##'
\echo '##  arm against the legacy arm on an IDENTICAL statement.      ##'
\echo '################################################################'

drop table if exists pg_temp.ae4_timing;
create temp table ae4_timing(label text primary key, ms_best numeric, reps int, measured_as name);
grant insert, select, update on ae4_timing to authenticated;

-- ⛔ RUN 1 (2026-09-02) DIED HERE: `permission denied for function ae4_time`.
--    The caller did `set local role authenticated` and THEN called a pg_temp
--    function, and `authenticated` holds no EXECUTE on it.
--
--    The fix is NOT a grant. `ae4_time` now OWNS the role switch and is called
--    as `postgres`, which removes THREE privilege dependencies at once —
--    EXECUTE on the function, INSERT/UPDATE on ae4_timing, and USAGE on the
--    session temp schema — instead of patching the one that happened to fire
--    first. Only `execute p_stmt` runs as `authenticated`, which is the whole
--    point: the plan is chosen under the impersonated role, so RLS applies to
--    the measured statement exactly as in production.
--
-- ⛔ AND NOT `security definer`, which is the obvious-looking alternative: that
--    would run the measured statement as postgres, RLS bypassed, measuring a
--    query that does not exist in production and reporting a spectacularly
--    fast seam. That failure would be SILENT. Hence `measured_as`: the
--    function records `current_user` AT THE MOMENT OF MEASUREMENT and the gate
--    below raises unless every row says `authenticated`. A privilege
--    regression must be loud, not fast.
create or replace function pg_temp.ae4_time(p_label text, p_claims text, p_stmt text, p_reps int default 5)
returns numeric language plpgsql as $$
declare i int; t0 timestamptz; v_best numeric := null; v_ms numeric; v_as name;
begin
  perform set_config('request.jwt.claims', p_claims, true);   -- transaction-local
  execute 'set local role authenticated';
  v_as := current_user;                                       -- captured UNDER the switch
  for i in 1..p_reps loop
    t0 := clock_timestamp();
    execute p_stmt;
    v_ms := extract(epoch from (clock_timestamp() - t0)) * 1000;
    if v_best is null or v_ms < v_best then v_best := v_ms; end if;
  end loop;
  execute 'reset role';
  insert into pg_temp.ae4_timing(label, ms_best, reps, measured_as)
       values (p_label, v_best, p_reps, v_as)
    on conflict (label) do update
       set ms_best = excluded.ms_best, reps = excluded.reps, measured_as = excluded.measured_as;
  return v_best;
end $$;

-- ⛔ P5's two arms must do the SAME WORK, or the ratio compares two different
--    statements wearing one label. Both principals must SEE THE SAME ROWS
--    through the org-filtered read; if they do not, the comparison is void
--    before any timing is taken.
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  insert into pg_temp.ae4_control
  select 'P5a permission-arm visible rows',
         (select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid),
         0, null::boolean;
  reset role;
commit;
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_legacy';
  insert into pg_temp.ae4_control
  select 'P5b legacy-arm visible rows',
         (select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid),
         0, null::boolean;
  reset role;
commit;

do $$
declare v_a bigint; v_b bigint;
begin
  select prof_rows into v_a from pg_temp.ae4_control where arm like 'P5a%';
  select prof_rows into v_b from pg_temp.ae4_control where arm like 'P5b%';
  if v_a is distinct from v_b or coalesce(v_a, 0) = 0 then
    raise exception
      'AE4 P5 PRECONDITION FAILED (run is VOID): the two arms see different row sets (permission=%, legacy=%). A ratio over unequal work is not a comparison.',
      v_a, v_b;
  end if;
  raise notice 'AE4 P5 precondition OK — both arms see the same % rows.', v_a;
end $$;

-- ⚠ The caller no longer switches role: ae4_time does, per measurement.
begin;
  -- ⭐ THESE FOUR ARE P4's, ON THE LIVE PREDICATE. P4 asks whether growth in protected rows is
  --    at worst linear, and after 20261003007320 the honest place to ask that is the shipped
  --    path. DC2's own copies are taken separately, below, under the pre-change predicate —
  --    see the block after this one for why they had to be split.
  select pg_temp.ae4_time('DC2/N=10',    :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 10) t');
  select pg_temp.ae4_time('DC2/N=100',   :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 100) t');
  select pg_temp.ae4_time('DC2/N=1000',  :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 1000) t');
  select pg_temp.ae4_time('DC2/N=10000', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 10000) t');
  -- ⛔ THE DC1 BASELINE MOVED TO SECTION 8 (acceptance §13.2, ADR 0182). It must be taken
  --    under the SAME policy predicate as the planted runs, and after 20261003007320 those
  --    run under the re-installed PRE-CHANGE predicate. Timing a new-predicate baseline
  --    against a legacy-predicate plant would report the POLICY CHANGE as the plant's effect
  --    — a ~3000x ratio that passes DC1 while measuring nothing it claims to measure.
  -- P5 pair, machine-checked (both read-only, so no rollback is needed).
  select pg_temp.ae4_time('P5/permission-arm', :'c_perm',
    'select count(*) from public.professional_profiles where organization_id = ' || quote_literal(:'t_org') || '::uuid');
  select pg_temp.ae4_time('P5/legacy-arm', :'c_legacy',
    'select count(*) from public.professional_profiles where organization_id = ' || quote_literal(:'t_org') || '::uuid');
commit;

-- ==========================================================================
-- DC2's OWN COPIES, under the PRE-CHANGE predicate — split out 2026-09-03, ADR 0182.
--
-- ⛔ DC2 AND P4 CANNOT SHARE TIMINGS ANY MORE, and run 6 pass A is what proved it. DC2 asks
--    "did the FIXTURE actually scale the work?" and fails when 1000x the rows costs < 5x.
--    After 20261003007320 the authorization cost is O(1) in protected rows, so on the live
--    predicate DC2 read **1.15x** and FAILED — i.e. it fired on exactly the state the change
--    set out to produce, which would have made P6 fail and the whole run VOID.
--    ⭐ That is the same trap as DC1's, and the amendment's first draft missed it here.
--    It was caught by RUNNING the harness, not by reading it.
--
-- So DC2 keeps its question and moves to the predicate where the question still has meaning,
-- exactly as DC1 did; P4 keeps the four LIVE timings above, because "is growth at worst
-- linear" is a question about the SHIPPED path and is answerable there.
-- ==========================================================================
begin;
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));
  select pg_temp.ae4_time('DC2L/N=10',    :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 10) t')::text as dc2l_10
\gset
  select pg_temp.ae4_time('DC2L/N=10000', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 10000) t')::text as dc2l_10k
\gset
rollback;

select label, ms_best, reps, measured_as from pg_temp.ae4_timing order by label;

-- The impersonation gate. A measurement taken as `postgres` is RLS-bypassed
-- and would report a seam that costs nothing.
do $$
declare v_bad text;
begin
  select string_agg(label || ' as ' || measured_as, ', ') into v_bad
    from pg_temp.ae4_timing where measured_as is distinct from 'authenticated';
  if v_bad is not null then
    raise exception
      'AE4 IMPERSONATION GATE FAILED (run is VOID): measurement(s) taken under the wrong role — %. An RLS-bypassed timing is not a measurement of the seam.',
      v_bad;
  end if;
  raise notice 'AE4 impersonation gate OK — every timing was taken as `authenticated`.';
end $$;

do $$
declare v10 numeric; v1k numeric; v10k numeric; vp numeric; vl numeric; r numeric;
begin
  select ms_best into v10  from pg_temp.ae4_timing where label = 'DC2/N=10';
  select ms_best into v1k  from pg_temp.ae4_timing where label = 'DC2/N=1000';
  select ms_best into v10k from pg_temp.ae4_timing where label = 'DC2/N=10000';

  -- DC2 is no longer computed here — it moved to the pre-change predicate and its verdict is
  -- an ordinary SQL statement below (psql cannot interpolate :'…' inside a dollar-quoted
  -- block, which is what killed section 10 in run 3). The LIVE N-differential is still
  -- reported, as evidence, because a reader comparing runs will look for it.
  r := round(v10k / nullif(v10, 0), 2);
  raise notice 'AE4 live-path N-differential (evidence, not DC2): 10 rows % ms, 10000 rows % ms, ratio %.', v10, v10k, r;

  -- P4 -- is that growth at worst LINEAR? Measured across the 1000 -> 10 000
  -- decade, where the fixed per-statement overhead has been amortised.
  r := round(v10k / nullif(v1k, 0), 2);
  if v10k > v1k * 30 then
    perform pg_temp.ae4_say('P4','CONDITION','FAIL',
      format('10x the protected rows cost %sx (%s ms -> %s ms), over the linear-plus-3x threshold of 30', r, v1k, v10k));
  else
    perform pg_temp.ae4_say('P4','CONDITION','PASS', format('decade ratio %s (threshold 30; linear = 10)', r));
  end if;
  raise notice 'AE4 P4 decade ratio (N=1000 -> N=10000) = % (% ms -> % ms). Threshold <= 30.', r, v1k, v10k;

  -- P5 -- the permission arm against the legacy arm, identical statement,
  -- identical rows. Valid ONLY because sections 2 and 3 proved the measured
  -- principal reaches those rows through the permission arm alone.
  select ms_best into vp from pg_temp.ae4_timing where label = 'P5/permission-arm';
  select ms_best into vl from pg_temp.ae4_timing where label = 'P5/legacy-arm';
  r := round(vp / nullif(vl, 0), 2);
  if vp > vl * 4 then
    perform pg_temp.ae4_say('P5','CONDITION','FAIL',
      format('the permission arm costs %sx the legacy arm on the identical statement (%s ms vs %s ms), over the threshold of 4x', r, vp, vl));
  else
    perform pg_temp.ae4_say('P5','CONDITION','PASS', format('ratio %s (threshold 4)', r));
  end if;
  raise notice 'AE4 P5 ratio (permission arm / legacy arm) = % (% ms / % ms). Threshold <= 4.', r, vp, vl;
end $$;

-- DC2's verdict, on the pre-change predicate. Same question, same >= 5x threshold, same
-- meaning as runs 1-5; only the predicate under it is pinned back. See the DC2L block above.
select pg_temp.ae4_say('DC2', 'CONTROL',
  case
    when nullif(:'dc2l_10','') is null or nullif(:'dc2l_10k','') is null then 'VOID'
    when nullif(:'dc2l_10k','')::numeric < nullif(:'dc2l_10','')::numeric * 5 then 'FAIL'
    else 'PASS'
  end,
  format('1000x the protected rows: %s ms -> %s ms (%sx) on the PRE-CHANGE predicate. Threshold >= 5x. '
         'A ratio below it means the fixture did not scale, not that the optimisation worked — that is '
         'why this is measured where the per-row evaluation still happens (ADR 0182, acceptance §13.6).',
         :'dc2l_10', :'dc2l_10k',
         round(nullif(:'dc2l_10k','')::numeric / nullif(nullif(:'dc2l_10','')::numeric, 0), 2)));


\echo ''
\echo '################################################################'
\echo '## SECTION 8 — DISCRIMINATION CONTROL DC1 (planted cost)      ##'
\echo '##  THE control that answers "could this measurement have     ##'
\echo '##  shown a regression at all?". authz.assignment_facts is    ##'
\echo '##  replaced, inside a rolled-back transaction, by a body     ##'
\echo '##  returning the SAME rows for ~50x the work. If the measured ##'
\echo '##  statement does not slow by >=10x, the instrument is blind  ##'
\echo '##  and every green number above is uninterpretable.          ##'
\echo '################################################################'

-- ==========================================================================
-- ⭐ DC1 IS NOW A LEGACY-PREDICATE CONTROL (acceptance §13.2/§13.5, ADR 0182).
--
-- 20261003007320 made professional_profiles_select compute the permission answer ONCE PER
-- STATEMENT. DC1a and DC1b plant into terms that were paid 200x per statement and are now
-- paid ONCE, so on the live predicate neither arm could reach >=10x, DC1 would FAIL, P6
-- would fail, and the run would be VOID *because the optimisation worked*.
--
-- So each DC1 block re-installs the PRE-CHANGE predicate inside its own rolled-back
-- transaction, exactly as it already installs a planted function body. DC1 then measures in
-- run 6 what it measured in runs 1-5, and the eight readings stay comparable.
--
-- ⛔ THE BASELINE MUST BE TAKEN UNDER THE SAME PREDICATE AS THE PLANT. Otherwise the ratio
--    is dominated by the policy rewrite and reads as a spectacularly healthy control.
-- ⛔ WHAT DC1 NO LONGER BOUNDS: the converted path. After the change that path has almost no
--    authorization cost left to attribute, so no plant can move it. DC3 and P7 below are what
--    bound it, and neither is a timing ratio -- which is the point, because flattening the
--    timing IS the change.
-- ==========================================================================
-- ⛔ THE BASELINE IS CAPTURED WITH \gset, NOT READ BACK FROM pg_temp.ae4_timing.
--    A temp table's CONTENTS are transactional like any other table's, so the row
--    ae4_time inserts here is discarded by this block's own `rollback` — and the ratio
--    below would then divide by a NULL and report DC1 as VOID. (Found by construction
--    while writing this block, not by a run.)
begin;
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));
  select pg_temp.ae4_time('DC1/baseline', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 200) t')::text as dc1_base_ms
\gset
rollback;

begin;
  -- The pre-change predicate, re-installed for this measurement only. See the block above.
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));

  -- Same result set, deliberately expensive. The extra branch cannot be
  -- folded away: the md5 comparison is opaque to the planner, so it really
  -- scans the principal's memberships 50 times per call.
  create or replace function authz.assignment_facts(p_principal uuid)
  returns table(role_code text, scope_kind text, scope_id uuid)
  language sql stable security definer set search_path to '' as $ae4dc1$
    select m.role, m.scope_kind::text,
           case m.scope_kind
             when 'commission'   then m.commission_id
             when 'hospital'     then m.hospital_id
             when 'organization' then m.organization_id
           end
      from public.memberships m
     where app.is_active(p_principal)
       and m.principal_id = p_principal
       and (m.expires_at is null or m.expires_at > now())
       and m.scope_kind is not null
    union all
    select 'platform_admin', 'none', null::uuid
      from public.profiles p
     where p.id = p_principal and p.is_admin and app.is_active(p_principal)
    union all
    -- DC1a PLANTED COST — returns nothing, costs ~50 membership scans + md5s.
    select null::text, null::text, null::uuid
      from public.memberships m2, generate_series(1, 50) g
     where m2.principal_id = p_principal
       and md5(m2.id::text || g::text) = 'ae4dc1-never-matches'
  $ae4dc1$;

  select pg_temp.ae4_time('DC1a/planted', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 200) t');

  -- ⚠ The baseline comes from :'dc1_base_ms', not from pg_temp.ae4_timing: its row was rolled
  --    back with the block that took it. Reading the table here returns NULL and reports VOID.
  select round(
           (select ms_best from pg_temp.ae4_timing where label = 'DC1a/planted')
         / nullif(nullif(:'dc1_base_ms','')::numeric, 0), 2) as dc1a_ratio
\gset
rollback;

-- ==========================================================================
-- DC1b — THE SAME CONTROL, RE-AIMED AT authz.scope_reaches.
--
-- ⛔ Why this exists. Run 3's DC1 (now DC1a) moved the measurement 1.53x
--    against a >=10x threshold. That is NOT a dead instrument -- DC2 read 775x
--    on the same apparatus, the same statements and the same timing function,
--    and a dead instrument cannot produce 775x. It is a LIVE control planted
--    in a term that turned out not to be dominant: P2 shows assignment_facts
--    running at loops=1 per protected row, and P1 shows 8 240 sequential scans
--    of `hospitals` inside scope_reaches. DC1a's small movement MEASURES
--    assignment_facts' share of per-row cost; it does not validate the
--    instrument against the dominant term, and nothing else did either.
--
--    So the control is RE-AIMED, not reinterpreted. ⛔ A failed control may
--    never be argued into a pass -- that is the move this whole acceptance
--    exists to prevent. DC1a is KEPT (its 1.53x is now a reading, not an
--    anomaly) and DC1b plants in scope_reaches. Together they ATTRIBUTE cost
--    instead of merely detecting it.
--
-- ⛔ The pair passes only if at least one arm moves >=10x. If NEITHER moves,
--    the instrument really is blind and the run is VOID -- the pair must not
--    be able to pass by being spread across two small numbers.
--
-- ⚠ PREDICTION, recorded BEFORE the run so it cannot be fitted afterwards:
--    DC1a ~1.5x, DC1b >=10x. If DC1b also returns ~1.5x then the cost lives in
--    NEITHER term, P1's hospital-scan attribution is wrong too, and that is a
--    genuinely informative surprise rather than a tuning problem.
--
-- ⚠ If DC1b overshoots into minutes, lower the generate_series bound from 10
--    to 3 and re-run; the threshold is about detectability, not magnitude.
-- ==========================================================================
begin;
  -- The pre-change predicate, re-installed for this measurement only — same reason as DC1a,
  -- and doubly so here: after 20261003007320 the converted read path does not call
  -- authz.scope_reaches at all on its set arm, so on the live predicate this plant would
  -- move NOTHING and DC1b would read 1.00x.
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));

  -- Same answers, deliberately expensive. Two anti-optimiser properties, both
  -- load-bearing: (1) the planted subquery is the CASE SELECTOR, so it MUST be
  -- evaluated to choose a branch -- as an AND conjunct the planner would order
  -- it last and short-circuit past it on the ~19-in-20 calls that return false,
  -- under-planting exactly where the cost is; (2) it is CORRELATED on
  -- p_assignment_id, so it cannot be hoisted into a once-per-statement InitPlan.
  create or replace function authz.scope_reaches(p_assignment_kind text, p_assignment_id uuid, p_resolution_kind text, p_requested_id uuid)
  returns boolean language sql stable security definer set search_path to '' as $ae4dc1b$
    select case (select count(*)
                   from public.hospitals h, pg_catalog.generate_series(1, 10) g
                  where pg_catalog.md5(h.id::text || g::text || p_assignment_id::text) = 'ae4dc1b-never-matches')
      when 0 then
        case
          when p_assignment_kind = p_resolution_kind then
            p_assignment_id = p_requested_id
          when p_resolution_kind = 'organization' and p_assignment_kind = 'commission' then
            p_requested_id = (select h.organization_id
                                from public.commissions c
                                join public.hospitals h on h.id = c.hospital_id
                               where c.id = p_assignment_id)
          when p_resolution_kind = 'organization' and p_assignment_kind = 'hospital' then
            p_requested_id = (select h.organization_id from public.hospitals h where h.id = p_assignment_id)
          when p_resolution_kind = 'hospital' and p_assignment_kind = 'commission' then
            p_requested_id = (select c.hospital_id from public.commissions c where c.id = p_assignment_id)
          else false
        end
      else false
    end
  $ae4dc1b$;

  select pg_temp.ae4_time('DC1b/planted', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 200) t');

  select round(
           (select ms_best from pg_temp.ae4_timing where label = 'DC1b/planted')
         / nullif(nullif(:'dc1_base_ms','')::numeric, 0), 2) as dc1b_ratio
\gset
rollback;

-- ⚠ Both planted timings are written INSIDE their rolled-back transactions and
--    vanish with them. The RATIOS ride out in psql variables, which are client
--    state and survive a rollback.
--
-- ⛔ AND THE VERDICT BELOW IS PLAIN SQL, NOT A `do` BLOCK. psql does NOT
--    interpolate :'var' inside a dollar-quoted body -- the server received the
--    literal `:'dc1_ratio'` and raised `syntax error at or near ":"`, which is
--    why section 10 never executed in run 3. Interpolation works in ordinary
--    SQL statements, so the verdict is written as one. Measured: this is the
--    ONLY such site in the harness; sections 2 and 3 read fixture_meta through
--    subqueries precisely to avoid it.
select pg_temp.ae4_say(
  'DC1', 'CONTROL',
  case
    when nullif(:'dc1a_ratio','')::numeric is null or nullif(:'dc1b_ratio','')::numeric is null then 'VOID'
    when greatest(nullif(:'dc1a_ratio','')::numeric, nullif(:'dc1b_ratio','')::numeric) >= 10 then 'PASS'
    else 'FAIL'
  end,
  format('DC1a assignment_facts=%sx, DC1b scope_reaches=%sx (pair passes when EITHER >= 10x; if neither moves, the instrument is blind)',
         coalesce(nullif(:'dc1a_ratio',''), '(null)'), coalesce(nullif(:'dc1b_ratio',''), '(null)'))
);

\echo '--- DC1 ATTRIBUTION: which term carries the per-protected-row cost ---'
select :'dc1a_ratio' as assignment_facts_ratio,
       :'dc1b_ratio' as scope_reaches_ratio,
       'a large ratio localises the cost to that term; both small = it is in neither' as reading;

-- Restoration half, same discipline as section 3.
do $$
declare v_src text;
begin
  select string_agg(p.proname, ', ') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz' and p.proname in ('assignment_facts','scope_reaches')
     and p.prosrc like '%ae4dc1%';
  if v_src is not null then
    raise exception 'AE4 DC1 ROLLBACK FAILED: a planted body is still installed in authz.%. FIX THIS BEFORE ANYTHING ELSE.', v_src;
  end if;
  raise notice 'AE4 DC1 rollback OK — authz.assignment_facts is the shipped body again.';
end $$;

-- ⛔ THE RESTORE CHECK MUST USE THE SAME PREDICATE AS THE BASELINE. Left on the LIVE
--    predicate it would compare a ~4 ms statement against a ~40 ms legacy baseline, pass by a
--    factor of ten, and prove NOTHING about whether the planted body is gone — a vacuous
--    green produced by the policy rewrite, not by the restore.
begin;
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));
  select pg_temp.ae4_time('DC1/restored', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 200) t')::text as dc1_rest_ms
\gset
rollback;

-- ⚠ Both figures arrive as psql variables (the timing rows were rolled back with their
--    transactions), so the comparison is an ordinary SQL statement — psql does not
--    interpolate `:'…'` inside a dollar-quoted block, which is what killed section 10 in run 3.
select case
         when nullif(:'dc1_rest_ms','')::numeric > nullif(:'dc1_base_ms','')::numeric * 2
           then 'AE4 DC1 RESTORE CHECK FAILED: after rollback the statement still costs '
                || :'dc1_rest_ms' || ' ms against a ' || :'dc1_base_ms' || ' ms baseline'
         else 'AE4 DC1 restore OK — ' || :'dc1_rest_ms' || ' ms vs ' || :'dc1_base_ms' || ' ms baseline (both on the pre-change predicate)'
       end as dc1_restore_check;

do $$
begin
  if to_regclass('pg_temp.ae4_timing') is null then
    raise exception 'AE4 DC1: the timing table vanished';
  end if;
end $$;





\echo ''
\echo '################################################################'
\echo '## SECTION 8b — DC3 (semantic ablation) and P7 (short-circuit) ##'
\echo '##  Acceptance §13.2, ADR 0182. DC1 above is a LEGACY-PREDICATE ##'
\echo '##  control: it proves the harness can see a seam, on the path  ##'
\echo '##  20261003007320 replaced. These two bound the LIVE path,     ##'
\echo '##  and NEITHER is a timing ratio — flattening the timing IS    ##'
\echo '##  the change, so a ratio cannot be the instrument.            ##'
\echo '################################################################'

-- A genuinely foreign organization: one the measured principal does NOT hold
-- org.professionals.read at, and which actually carries professional_profiles rows.
-- ⛔ Without the second condition the over-broad half is vacuous — it would "fail to see
-- foreign rows" because there are none, not because the gate is shut.
select coalesce((
  select o.id::text
    from public.organizations o
   where not authz.has_permission(
           (select v::uuid from ae4perf.fixture_meta where k = 'principal_id'),
           'organization', o.id, 'org.professionals.read')
     and exists (select 1 from public.professional_profiles pp where pp.organization_id = o.id)
   order by o.id limit 1), '') as f_org
\gset

\echo '--- DC3 preflight: the foreign organization, and the two baselines ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  select (select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid)::text as dc3_own_base,
         (select count(*) from public.professional_profiles where organization_id = :'f_org'::uuid)::text as dc3_foreign_base
\gset
  reset role;
rollback;
select :'f_org' as foreign_org, :'dc3_own_base' as own_org_rows_visible, :'dc3_foreign_base' as foreign_org_rows_visible;

-- ==========================================================================
-- DC3a — THE EMPTY HALF. The set builder returns nothing.
-- ⛔ THE ROW COUNT MUST NOT MOVE. The policy's ELSE arm is the untouched authorizer, so an
--    empty set arm is a pure loss of the short-circuit, never a loss of the grant. A row
--    count that DROPS here means the rewrite NARROWED the policy — the one thing the subset
--    argument says it cannot do.
-- ⭐ And the cost must RISE, which is what shows the set arm was carrying the speed.
-- ==========================================================================
begin;
  create or replace function authz.authorized_scope_ids(p_principal uuid, p_resolution_kind text, p_permission_code text)
  returns setof uuid language sql stable security definer set search_path to ''
  as $ae4dc3$ select null::uuid where false $ae4dc3$;

  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  select (select count(*) from public.professional_profiles where organization_id = :'t_org'::uuid)::text as dc3a_own
\gset
  reset role;
  select pg_temp.ae4_time('DC3a/empty-set', :'c_perm',
    'select count(*) from public.professional_profiles where organization_id = ' || quote_literal(:'t_org') || '::uuid')::text as dc3a_ms
\gset
rollback;

-- ==========================================================================
-- DC3b — THE OVER-BROAD HALF. The set builder returns every organization.
-- ⛔ FOREIGN ROWS MUST BECOME VISIBLE. If they do not, the set arm is not being consulted at
--    all and every green above is about a predicate nothing evaluates.
-- ==========================================================================
begin;
  create or replace function authz.authorized_scope_ids(p_principal uuid, p_resolution_kind text, p_permission_code text)
  returns setof uuid language sql stable security definer set search_path to ''
  as $ae4dc3$ select o.id from public.organizations o $ae4dc3$;

  set local role authenticated;
  set local request.jwt.claims = :'c_perm';
  select (select count(*) from public.professional_profiles where organization_id = :'f_org'::uuid)::text as dc3b_foreign
\gset
  reset role;
rollback;

-- Restoration proof: the shipped body must be back, and no DC3 marker may survive.
do $$
declare v_src text;
begin
  select string_agg(p.proname, ', ') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz' and p.prosrc like '%ae4dc3%';
  if v_src is not null then
    raise exception 'AE4 DC3 ROLLBACK FAILED: a planted body is still installed in authz.%. FIX THIS BEFORE ANYTHING ELSE.', v_src;
  end if;
  raise notice 'AE4 DC3 rollback OK — authz.authorized_scope_ids is the shipped body again.';
end $$;

select pg_temp.ae4_say('DC3', 'CONTROL',
  case
    when nullif(:'dc3_own_base','') is null or nullif(:'dc3a_own','') is null or nullif(:'dc3b_foreign','') is null then 'VOID'
    when nullif(:'dc3_foreign_base','')::bigint <> 0 then 'VOID'
    when nullif(:'dc3a_own','')::bigint <> nullif(:'dc3_own_base','')::bigint then 'FAIL'
    when nullif(:'dc3b_foreign','')::bigint = 0 then 'FAIL'
    else 'PASS'
  end,
  format('DC3a empty-set: own-org rows %s -> %s (MUST NOT move: the ELSE arm still grants) at %s ms. DC3b over-broad: foreign-org rows %s -> %s (MUST become > 0: the set arm is consulted and load-bearing).',
         :'dc3_own_base', :'dc3a_own', :'dc3a_ms', :'dc3_foreign_base', :'dc3b_foreign'));

-- ==========================================================================
-- P7 — THE SHORT-CIRCUIT IS REAL, asserted on the plan rather than on a timing.
-- A policy that silently stopped short-circuiting would pass the re-stated P2/P3 vacuously
-- (their subjects simply would not run) and surface only as a slow P5.
-- ⚠ Reads fixture_meta through subqueries: psql does not interpolate inside `do $$`.
-- ==========================================================================
-- ⛔ P7 SHIPS ITS OWN VACUITY CONTROL, and §12.6 property 3 is why: a new check must be proven
--    able to return BOTH verdicts, or "the short-circuit is real" and "the probe is broken" are
--    the same string. DC3b earned that proof (0 -> 1 foreign rows); P7's first form did not,
--    and QA review 2026-09-03 caught the omission. The control re-installs the PRE-CHANGE
--    predicate — a shape that provably has no set subplan at all — and requires the probe to
--    report FAIL there. If it reports PASS against a policy with no subplan, it is measuring
--    nothing and the run is VOID.
create or replace function pg_temp.ae4_p7_probe() returns text language plpgsql as $$
declare
  r record; v_plan text := ''; v_org uuid; v_claims text;
begin
  select v::uuid into v_org from ae4perf.fixture_meta where k = 'target_org_id';
  select json_build_object('sub', (select v from ae4perf.fixture_meta where k = 'principal_id'),
                           'role','authenticated','is_admin',false,'active_role','staff_admin')::text
    into v_claims;
  perform set_config('request.jwt.claims', v_claims, true);
  execute 'set local role authenticated';
  for r in execute format(
      'explain (analyze, buffers) select count(*) from public.professional_profiles where organization_id = %L::uuid', v_org)
  loop
    v_plan := v_plan || r."QUERY PLAN" || chr(10);
  end loop;
  execute 'reset role';

  -- ⛔ PARENTHESISED. `~` and `||` share a precedence level and associate LEFT, so
  --    `v_plan ~ 'a[^' || chr(10) || ']*b'` parses as `((v_plan ~ 'a[^') || …)` and the
  --    regex engine sees an unterminated bracket expression: "brackets [] not balanced".
  --    Found by running it — pass A of run 6 died here.
  return format('hashed=%s,loops1=%s,never=%s',
                v_plan like '%hashed SubPlan%',
                v_plan ~ ('ProjectSet[^' || chr(10) || ']*loops=1'),
                v_plan like '%never executed%');
end $$;

begin;
  alter policy professional_profiles_select on public.professional_profiles
    using (app.can_read_professional_profile(id, ( select auth.uid() )));
  select pg_temp.ae4_p7_probe() as p7_control
\gset
rollback;

select pg_temp.ae4_p7_probe() as p7_live
\gset

select pg_temp.ae4_say('P7', 'CONDITION',
  case
    when :'p7_control' = 'hashed=t,loops1=t,never=t' then 'VOID'
    when :'p7_live'    = 'hashed=t,loops1=t,never=t' then 'PASS'
    else 'FAIL'
  end,
  format('live [%s] — all three required: an uncorrelated set built ONCE, and the row authorizer not reached. '
         'CONTROL on the pre-change predicate [%s] MUST NOT be all-true, or the probe is not measuring the subplan at all.',
         :'p7_live', :'p7_control'));

\echo ''
\echo '################################################################'
\echo '## SECTION 9 — POSTFLIGHT: THE STACK MUST BE UNMUTATED        ##'
\echo '################################################################'

select 'any authz body still contains a DC1 planted marker (must be f)' as check,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'authz' and p.prosrc like '%ae4dc1%') as result
union all
select 'authz.roles staff_admin state is authoritative (must be t)',
       (select state::text = 'authoritative' from authz.roles where code = 'staff_admin')
union all
select 'any public trigger left DISABLED (must be f)',
       exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                 join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and not t.tgisinternal and t.tgenabled = 'D');

do $$
declare v_bad text := '';
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'authz' and p.prosrc like '%ae4dc1%')
    then v_bad := v_bad || 'a DC1 planted body is still installed; '; end if;
  if (select state::text from authz.roles where code = 'staff_admin') <> 'authoritative'
    then v_bad := v_bad || 'authz.roles.staff_admin.state not restored; '; end if;
  if exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
               join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and not t.tgisinternal and t.tgenabled = 'D')
    then v_bad := v_bad || 'a public trigger is DISABLED; '; end if;
  if v_bad <> '' then
    raise exception 'AE4 HARNESS LEFT THE STACK MUTATED: %', v_bad;
  end if;
  raise notice 'AE4 harness: stack unmutated.';
end $$;

\echo ''
\echo '=== AE4 perf harness complete. Evaluate P1-P6 per'
\echo '=== docs/design/authz-ae4-performance-acceptance.md section 6. ==='


\echo ''
\echo '################################################################'
\echo '## SECTION 10 — THE VERDICT. One raise, at the end, after the ##'
\echo '##  controls AND after the postflight, so no condition can    ##'
\echo '##  abort the run before the control that validates it.       ##'
\echo '################################################################'

-- THE DEPENDENCY RULE. A condition whose controls did not PASS is VOID --
-- never PASS, never FAIL. A failing P5 measured on an unvalidated instrument
-- is not a finding about the seam; it is an unfinished measurement, and the
-- table has to say so rather than leaving a human to argue it from the fact
-- that the numbers looked discriminating.
do $$
declare v_ctl_bad text;
begin
  select string_agg(id || '=' || status, ', ' order by id) into v_ctl_bad
    from pg_temp.ae4_verdict where kind = 'CONTROL' and status <> 'PASS';
  if v_ctl_bad is not null then
    update pg_temp.ae4_verdict
       set status = 'VOID',
           detail = detail || format('  [VOIDED: controls not passing -- %s]', v_ctl_bad)
     where kind = 'CONDITION' and status in ('PASS','FAIL');
    raise notice 'AE4: conditions VOIDED because controls did not pass (%).', v_ctl_bad;
  end if;
end $$;

\echo '--- AE4 VERDICT TABLE ---'
select kind, id, status, detail from pg_temp.ae4_verdict order by kind desc, id;

do $$
declare v_bad text; v_pass int; v_tot int;
begin
  select count(*) filter (where status = 'PASS'), count(*) into v_pass, v_tot from pg_temp.ae4_verdict;
  select string_agg(id || '=' || status, ', ' order by id) into v_bad
    from pg_temp.ae4_verdict where status <> 'PASS';
  if v_bad is not null then
    raise exception E'AE4 ACCEPTANCE NOT MET (% of % rows PASS).\nNot passing: %\nRead the verdict table above: FAIL is a regression, VOID means nothing was measured and the run is repeated, UNRUN means the row was never reached.',
      v_pass, v_tot, v_bad;
  end if;
  raise notice 'AE4 ACCEPTANCE MET — all % verdict rows PASS.', v_tot;
end $$;
