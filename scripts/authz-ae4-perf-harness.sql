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
\echo '   line because the P1 grep was unscoped. Scope it to the'
\echo '   AE4-PASSB-BEGIN/END region.'
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
\echo '=== AE4-PASSB-BEGIN — everything between this marker and'
\echo '=== AE4-PASSB-END is the P1/P2/P3 evidence region. Scope every'
\echo '=== structural grep to it with awk; the same file also contains'
\echo '=== PASS A, and M4 there legitimately seq-scans commissions.'
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

\echo '=== AE4-PASSB-END — nested capture completed ==='
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
  select pg_temp.ae4_time('DC2/N=10',    :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 10) t');
  select pg_temp.ae4_time('DC2/N=100',   :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 100) t');
  select pg_temp.ae4_time('DC2/N=1000',  :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 1000) t');
  select pg_temp.ae4_time('DC2/N=10000', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 10000) t');
  -- The DC1 baseline: the SAME statement DC1 will re-time under a planted cost.
  select pg_temp.ae4_time('DC1/baseline', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 200) t');
  -- P5 pair, machine-checked (both read-only, so no rollback is needed).
  select pg_temp.ae4_time('P5/permission-arm', :'c_perm',
    'select count(*) from public.professional_profiles where organization_id = ' || quote_literal(:'t_org') || '::uuid');
  select pg_temp.ae4_time('P5/legacy-arm', :'c_legacy',
    'select count(*) from public.professional_profiles where organization_id = ' || quote_literal(:'t_org') || '::uuid');
commit;

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
declare v10 numeric; v1k numeric; v10k numeric; vp numeric; vl numeric;
begin
  select ms_best into v10  from pg_temp.ae4_timing where label = 'DC2/N=10';
  select ms_best into v1k  from pg_temp.ae4_timing where label = 'DC2/N=1000';
  select ms_best into v10k from pg_temp.ae4_timing where label = 'DC2/N=10000';

  -- DC2 — is the instrument alive? 1000x the rows must cost meaningfully more.
  if v10k < v10 * 5 then
    raise exception
      'AE4 DC2 FAILED (run is VOID): 1000x the protected rows cost only %x (% ms -> % ms). Either the fixture did not scale or the per-row evaluation is not happening — a green number here would be indistinguishable from a dead instrument.',
      round(v10k / nullif(v10, 0), 2), v10, v10k;
  end if;
  raise notice 'AE4 DC2 OK — cost tracks N (10 rows: % ms, 10000 rows: % ms, ratio %).',
    v10, v10k, round(v10k / nullif(v10, 0), 2);

  -- P4 — is that growth at worst LINEAR? Measured across the 1000 -> 10 000
  -- decade, where the fixed per-statement overhead that distorts the N=10
  -- reading has already been amortised. Linear = 10x; the threshold allows 3x
  -- linear before calling it a regression.
  raise notice 'AE4 P4 decade ratio (N=1000 -> N=10000) = % (% ms -> % ms). Pass condition: <= 30.',
    round(v10k / nullif(v1k, 0), 2), v1k, v10k;
  if v10k > v1k * 30 then
    raise exception
      'AE4 PASS CONDITION P4 FAILED: 10x the protected rows cost %x (% ms -> % ms). Growth is super-linear in the protected-row count — this is the hazard AE5 multiplies across eleven roles.',
      round(v10k / nullif(v1k, 0), 2), v1k, v10k;
  end if;

  -- P5 — the permission arm against the legacy arm, identical statement,
  -- identical rows. Valid ONLY because sections 2 and 3 proved that the
  -- measured principal reaches these rows through the permission arm alone.
  select ms_best into vp from pg_temp.ae4_timing where label = 'P5/permission-arm';
  select ms_best into vl from pg_temp.ae4_timing where label = 'P5/legacy-arm';
  raise notice 'AE4 P5 ratio (permission arm / legacy arm) = % (% ms / % ms). Pass condition: <= 4.',
    round(vp / nullif(vl, 0), 2), vp, vl;
  if vp > vl * 4 then
    raise exception
      'AE4 PASS CONDITION P5 FAILED: the permission arm costs %x the legacy arm on the identical statement (% ms vs % ms), over the threshold of 4x.',
      round(vp / nullif(vl, 0), 2), vp, vl;
  end if;
end $$;


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

begin;
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
    -- DC1 PLANTED COST — returns nothing, costs ~50 membership scans + md5s.
    select null::text, null::text, null::uuid
      from public.memberships m2, generate_series(1, 50) g
     where m2.principal_id = p_principal
       and md5(m2.id::text || g::text) = 'ae4dc1-never-matches'
  $ae4dc1$;

  select pg_temp.ae4_time('DC1/planted', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 200) t');

  do $$
  declare v_base numeric; v_slow numeric;
  begin
    select ms_best into v_base from pg_temp.ae4_timing where label = 'DC1/baseline';
    select ms_best into v_slow from pg_temp.ae4_timing where label = 'DC1/planted';
    raise notice 'AE4 DC1: baseline % ms -> planted % ms (%x).', v_base, v_slow, round(v_slow / nullif(v_base, 0), 2);
    if v_slow < v_base * 10 then
      raise exception
        'AE4 DC1 FAILED (run is VOID): a deliberately ~50x-more-expensive assignment_facts moved the measurement only %x. The instrument cannot see an expensive seam, so no green number above can be distinguished from a dead instrument.',
        round(v_slow / nullif(v_base, 0), 2);
    end if;
  end $$;
rollback;

-- ⚠ `DC1/planted` is written inside the transaction above and therefore
--    disappears with the ROLLBACK. Its value is reported by the NOTICE and
--    asserted inside that transaction; it is deliberately not persisted,
--    because persisting it would require the mutation to survive.

-- Restoration half, same discipline as section 3.
do $$
declare v_src text;
begin
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz' and p.proname = 'assignment_facts';
  if v_src like '%ae4dc1%' then
    raise exception 'AE4 DC1 ROLLBACK FAILED: the planted body is still installed in authz.assignment_facts. FIX THIS BEFORE ANYTHING ELSE.';
  end if;
  raise notice 'AE4 DC1 rollback OK — authz.assignment_facts is the shipped body again.';
end $$;

begin;
  select pg_temp.ae4_time('DC1/restored', :'c_perm', 'select count(*) from (select 1 from public.professional_profiles limit 200) t');
commit;

do $$
declare v_base numeric; v_rest numeric;
begin
  select ms_best into v_base from pg_temp.ae4_timing where label = 'DC1/baseline';
  select ms_best into v_rest from pg_temp.ae4_timing where label = 'DC1/restored';
  if v_rest > v_base * 2 then
    raise exception 'AE4 DC1 RESTORE CHECK FAILED: after rollback the statement still costs % ms against a % ms baseline', v_rest, v_base;
  end if;
  raise notice 'AE4 DC1 restore OK — % ms vs % ms baseline.', v_rest, v_base;
end $$;




\echo ''
\echo '################################################################'
\echo '## SECTION 9 — POSTFLIGHT: THE STACK MUST BE UNMUTATED        ##'
\echo '################################################################'

select 'authz.assignment_facts prosrc contains DC1 planted body (must be f)' as check,
       (select p.prosrc like '%ae4dc1%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'authz' and p.proname = 'assignment_facts') as result
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
  if (select p.prosrc like '%ae4dc1%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'authz' and p.proname = 'assignment_facts')
    then v_bad := v_bad || 'DC1 planted body still installed; '; end if;
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
