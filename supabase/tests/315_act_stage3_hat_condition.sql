-- ACT Stage 3 (ADR 0106) — the revert-twin keystone.
--
-- Plan §4 Stage 3 gate: "a pgTAP test that goes RED when the active-role
-- condition is removed from has_role... must assert through a table reached
-- ONLY via has_role — no OR'd permissive sibling grant."
--
-- Tables: TWO probes since AE4.7b, and the split is the point.
--
--   public.meeting_minutes_jobs — EXACTLY ONE policy (SELECT, PERMISSIVE, to
--     authenticated): `app.is_staff_admin_of(app.commission_of_meeting(meeting_id))`.
--     ⚠ THAT WRAPPER IS NO LONGER ROUTED THROUGH has_role. AE4.6 re-pointed it at the
--     authz catalog and AE4.7b collapsed it onto `authz.holds_role`, which carries its
--     own hat conjunct. So this probe still proves the hat gate BEHAVES (the two
--     baselines below), but a has_role mutation can neither open nor close it — which is
--     exactly what the ARM-SPLIT CONTROL asserts, and why the revert-twin moved.
--
--   public.form_block_library — the REVERT-TWIN's probe. Derived from pg_policy, not
--     chosen: EXACTLY ONE policy of any command (SELECT, PERMISSIVE, to authenticated),
--     no triggers, two arms —
--       `app.is_staff_admin_of(commission_id) OR app.is_tenancy_admin_of(commission_id)`
--     — the first CATALOG-routed, the second still has_role-routed
--     (`is_active(p_uid) AND has_role('organization', org, 'org_admin', p_uid)`), over
--     the SAME row for the SAME caller. `sa_x` is dual-hat and bootstrap homes comm_x
--     under org_b, so which arm is intact decides whether the row is visible.
--
-- ⛔ Shape 6 (authz-handoff §7.1) is satisfied by MEASUREMENT here, not by structure: the
-- second arm is not eliminated, it is asserted shut. That is strictly stronger than the
-- single-clause table this file used to rely on — an OR'd sibling that is PROVEN false
-- under the mutation cannot mask the widening, and proving it is also how this file now
-- records why the original twin was orphaned.

begin;
select plan(25);

-- ── TRIPWIRE (ADR 0106 D11 no-op argument): the empirical claim behind D11's
--    hat condition being safe to ship as a no-op today is "0 platform_admins
--    hold any membership" — an argument that rests on DATA, not on schema.
--    This assertion checks the REAL, PERSISTED seed data directly (run
--    BEFORE test_helpers.bootstrap() below truncates it — every later pgTAP
--    file that calls bootstrap() cannot see seed.sql's rows, per the Stage 1
--    buildnotes finding on bootstrap()'s own truncate-cascade). If a future
--    seed.sql change (or a migration, or — pre-pilot only — direct prod
--    data) ever gives a platform_admin a real membership row, this specific
--    assertion goes RED on the next `db reset` + `test:db`, which is exactly
--    the guard an argument resting on "today's data has zero of these" needs.
select is(
  (select count(*)::int from public.memberships m
     join public.profiles p on p.id = m.principal_id
   where p.is_admin = true),
  0,
  'TRIPWIRE (D11): no platform_admin holds any membership row (seed.sql, pre-bootstrap)');

update app.feature_flags set enabled = true where key = 'meetings';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid as org_b, (v->>'admin')::uuid as admin,
         (v->>'hosp_b')::uuid as hosp_b from ctx;
grant select on k to authenticated;

-- Make sa_x genuinely multi-role (staff_admin@comm_x from bootstrap + org_admin@org_b
-- here) so the "no explicit hat" claims_for call below cannot auto-derive one
-- (D11's implicit single-role derive only fires for a genuinely single-role
-- principal — a real single-role user is NEVER hatless in production, so testing
-- the hatless-caller denial path honestly requires a multi-role fixture, not a
-- single-role one with the hat simply omitted).
insert into public.memberships (organization_id, principal_id, role)
  select (select org_b from k), (select sa_x from k), 'org_admin';

create temp table m on commit drop as
  select gen_random_uuid() as meeting_id, gen_random_uuid() as job_id;
grant select on m to authenticated;

insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start, status)
  select meeting_id, (select comm_x from k), 1, 'Reunião Teste', now(), 'held' from m;
insert into public.meeting_minutes_jobs (id, meeting_id, status, requested_by)
  select job_id, meeting_id, 'done', (select sa_x from k) from m;

-- ── AE4.7b: THE SECOND PROBE, and why this file needed one ─────────────────
-- `meeting_minutes_jobs_select` = app.is_staff_admin_of(...), and AE4.6 re-pointed that
-- wrapper at the authz catalog. So the mutation below — which neutralizes app.has_role —
-- NO LONGER REACHES IT, and the REVERT-TWIN went red on the branch and stayed red. It was
-- ORPHANED, not wrong: same claim, chokepoint moved out from under it.
--
-- ⚠ It failed LOUDLY, which is the only reason this is a repair and not a silent hole. Had
-- the mutation left the assertion satisfied, a hat control that no longer tests the hat would
-- have gone green forever.
--
-- ⭐ THE FIX IS NOT TO MUTATE THE NEW CHOKEPOINT HERE. `app.has_role` is still LIVE for the
-- ELEVEN legacy roles and ~151 self-check sites, and ADR 0106 Stage 3's gate sentence names
-- has_role BY NAME: "goes RED when the active-role condition is removed from has_role". Move
-- this file's PROBE to a table still reached through has_role for a LEGACY role, and the
-- sentence stays satisfied by something. The wrappers' own new chokepoint gets its own twins,
-- at their own site, in pgTAP 405 §7.
--
-- ⭐⭐ WHY `form_block_library`, derived from pg_policy rather than chosen: it carries EXACTLY
-- ONE policy of any command (SELECT, permissive, to authenticated) —
--     is_staff_admin_of(commission_id) OR is_tenancy_admin_of(commission_id)
-- — and no triggers. Both arms reach memberships, which is what makes it BETTER than a
-- single-arm table rather than worse: post-cutover the first arm is CATALOG-routed and the
-- second is has_role-routed, over the SAME row, for the SAME caller. So the mutation's effect
-- is attributable by construction, and the attribution is asserted (the arm-split control
-- below) instead of argued. `sa_x` is dual-hat (staff_admin@comm_x + org_admin@org_b) and
-- bootstrap homes comm_x under org_b, so ONE row is visible through either arm depending only
-- on which gate is intact.
create temp table fbl on commit drop as select gen_random_uuid() as blk_id;
grant select on fbl to authenticated;
insert into public.form_block_library
  (id, commission_id, name, snapshot, saved_by_id, saved_by_name, source_form_title, source_version_number)
  select blk_id, (select comm_x from k), 'AE4.7b probe', '{}'::jsonb,
         (select sa_x from k), 'sa_x', 'Formulário de origem', 1
    from fbl;

-- BASELINE: sa_x holds staff_admin@comm_x (bootstrap). WITHOUT an active hat,
-- has_role's caller-only condition denies — 0 rows. WITH the matching hat, it
-- admits — 1 row. Both sides of the condition, proven live, before touching it.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.meeting_minutes_jobs where meeting_id = (select meeting_id from m)),
  0,
  'BASELINE (no hat): meeting_minutes_jobs_select denies a hatless staff_admin caller');
reset role;

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.meeting_minutes_jobs where meeting_id = (select meeting_id from m)),
  1,
  'BASELINE (matching hat): meeting_minutes_jobs_select admits the staff_admin-hatted caller');
reset role;

-- AE4.7b — the SECOND probe's own both-sides baseline, on the has_role-routed arm. Same
-- shape, same caller, different gate: without these the revert-twin's post-mutation 1 could
-- be a row that was always visible.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.form_block_library where id = (select blk_id from fbl)),
  0,
  'BASELINE (no hat): form_block_library_select denies a hatless caller through BOTH arms — the catalog-routed staff_admin arm AND the has_role-routed tenancy arm');
reset role;

select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.form_block_library where id = (select blk_id from fbl)),
  1,
  'BASELINE (org_admin hat): the has_role-routed is_tenancy_admin_of arm admits — proving the row is REACHABLE through the arm the mutation targets, so a post-mutation 0 would be a real failure rather than an unreachable fixture');
reset role;

-- ── public.assume_role keystone (ARM=floor: the RPC must be CALLED, not just
--    reachable) ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_x from k), 'role', 'authenticated',
    'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok(
  $$ select public.assume_role('org_admin'::public.platform_role) $$,
  'assume_role: sa_x (a real org_admin) can assume the org_admin hat');
select throws_ok(
  $$ select public.assume_role('nsp_org_admin'::public.platform_role) $$,
  '42501', null,
  'assume_role: sa_x CANNOT assume a role he does not hold (nsp_org_admin)');
-- Capture the session_id before reset role drops the request.jwt.claims GUC scope.
create temp table sid on commit drop as
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')::uuid as v;
reset role;
-- Verified as postgres (superuser): the table has no SELECT grant to
-- `authenticated` by design (only the DEFINER RPC touches it) — a test-only
-- verification query, not a product read path.
select is(
  (select role::text from app.active_role_selections
    where user_id = (select sa_x from k) and session_id = (select v from sid)),
  'org_admin',
  'assume_role: the selection row lands with the chosen role');
select ok(
  (select count(*)::int from public.audit_log where action = 'active_role.assumed') > 0,
  'assume_role: the switch itself is audited (active_role.assumed, D8)');

-- ── ACT P0 (audit-scope ruling): assume_role's audit_write call stamps the
--    ASSUMED ROLE'S OWN scope (Architecture Rule 11), not the platform-tier
--    bucket — checked across all three scope tiers + the platform_admin
--    no-tenant carve-out, on the SAME fixtures already built above. Rationale
--    (not re-litigated here): an assumption of "org_admin of org_b" is an
--    event ABOUT org_b; leaving it unscoped both breaks tenancy-scoped audit
--    completeness and pollutes the platform-tier bucket with routine noise.
select is(
  (select organization_id from public.audit_log
    where action = 'active_role.assumed' and entity_id = (select v from sid)),
  (select org_b from k),
  'assume_role audit (org-tier): scoped to org_b (the assumed org_admin''s own org), not the platform bucket');
select ok(
  (select hospital_id is null and commission_id is null from public.audit_log
    where action = 'active_role.assumed' and entity_id = (select v from sid)),
  'assume_role audit (org-tier): hospital_id/commission_id stay NULL for an org-tier hat');

-- staff_admin@comm_x (bootstrap) — the COMMISSION-tier case, a different scope
-- shape than the org-tier one just checked (proves the fix isn't org-only).
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_x from k), 'role', 'authenticated',
    'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok(
  $$ select public.assume_role('staff_admin'::public.platform_role) $$,
  'assume_role: sa_x (a real staff_admin) can assume the staff_admin hat');
create temp table sid2 on commit drop as
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')::uuid as v;
reset role;
select is(
  (select commission_id from public.audit_log
    where action = 'active_role.assumed' and entity_id = (select v from sid2)),
  (select comm_x from k),
  'assume_role audit (commission-tier): scoped to comm_x (the assumed staff_admin''s own commission)');

-- admin — still a PURE platform_admin at THIS point in the file (the multi-role
-- insert for the is_admin() D11 keystone below runs LATER) — the PLATFORM
-- carve-out: no tenant, so NULL stays correct here, verified explicitly rather
-- than assumed as "whatever the default happens to be".
select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'role', 'authenticated',
    'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok(
  $$ select public.assume_role('platform_admin'::public.platform_role) $$,
  'assume_role: admin (a real platform_admin) can assume the platform_admin hat');
create temp table sid3 on commit drop as
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')::uuid as v;
reset role;
select ok(
  (select organization_id is null and hospital_id is null and commission_id is null
   from public.audit_log where action = 'active_role.assumed' and entity_id = (select v from sid3)),
  'assume_role audit (platform tier): platform_admin genuinely has no tenant — all three scope columns correctly stay NULL');

-- THE REVERT-TWIN: temporarily neutralize has_role to the pre-Stage-3 shape
-- (the caller-only condition removed) and prove the SAME hatless-caller case
-- above flips to admitting — the detector can detect an over-grant, not just
-- assert a hat matched by construction.
do $do$
declare
  v_original text;
begin
  select pg_get_functiondef(p.oid) into v_original
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'has_role'
    and pg_get_function_identity_arguments(p.oid) = 'p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid';

  execute $sql$
    create or replace function app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)
     returns boolean
     language sql
     stable security definer
     set search_path to 'app', 'public', 'pg_catalog'
    as $body$
      select exists (
        select 1 from public.memberships m
        where m.principal_id = p_user_id
          and m.role = p_role
          and (m.expires_at is null or m.expires_at > now())
          and case p_scope_type
                when 'organization' then m.organization_id = p_scope_id
                when 'hospital'     then m.hospital_id     = p_scope_id
                when 'commission'   then m.commission_id   = p_scope_id
                else false
              end
      );
    $body$;
  $sql$;

  perform set_config('act.original_has_role', v_original, false);
end $do$;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.form_block_library where id = (select blk_id from fbl)),
  1,
  'REVERT-TWIN ⭐: with the caller-only condition REMOVED from has_role, the SAME hatless caller is now WRONGLY admitted (1, not 0) through form_block_library''s has_role-routed tenancy arm — proves the detector can detect the over-grant it exists to prevent');
select is(
  (select count(*)::int from public.meeting_minutes_jobs where meeting_id = (select meeting_id from m)),
  0,
  'ARM-SPLIT CONTROL ⭐⭐ (AE4.7b): under the SAME mutation the CATALOG-routed arm stays shut — the hatless caller is still denied meeting_minutes_jobs. ⛔ This is what makes the twin above attributable AND it is the measurement that explains why this file needed repairing at all: app.has_role no longer reaches app.is_staff_admin_of, so mutating it can neither open nor close the catalog path. A twin whose probe sat only on that path was asserting a flip nothing could produce');
reset role;

-- Restore, byte-for-byte, and verify.
do $do$
declare
  v_original text := current_setting('act.original_has_role', true);
begin
  execute v_original;
end $do$;

select is(
  (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'has_role'
     and pg_get_function_identity_arguments(p.oid) = 'p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid'),
  (select current_setting('act.original_has_role', true)),
  'RESTORE: has_role is byte-identical to its pre-mutation definition');

-- ── app.is_admin() D11 keystone ─────────────────────────────────────────
-- Makes the fixture's `admin` (bootstrap's platform_admin, is_admin=true,
-- no memberships) ALSO hold a real membership — the ONLY condition that can
-- distinguish D11's hat-gated is_admin() from the pre-D11 body (0
-- platform_admins hold one in real seed, per the TRIPWIRE above). Full
-- before/after matrix (8 cases incl. this construction) run manually against
-- the live catalog and recorded in docs/plans/act-as-buildnotes.md; this is
-- the PERMANENT keystone so the diff-scoped door sweep has a real path to
-- exercise (a single-role platform_admin, which is all any OTHER existing
-- pgTAP file constructs, can never distinguish the two implementations).
insert into public.memberships (organization_id, principal_id, role)
values ((select org_b from k), (select admin from k), 'org_admin');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'is_admin', true, 'active_role', 'platform_admin')::text, true);
set local role authenticated;
select ok(
  app.is_admin(),
  'is_admin() D11: multi-role admin WITH the platform_admin hat active -> TRUE');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'is_admin', true, 'active_role', 'org_admin')::text, true);
set local role authenticated;
select ok(
  not app.is_admin(),
  'is_admin() D11 ⭐ THE DISTINGUISHING CASE: multi-role admin acting under a DIFFERENT hat (org_admin) -> FALSE, not the pre-D11 TRUE');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select admin from k), 'is_admin', true)::text, true);
set local role authenticated;
select ok(
  not app.is_admin(),
  'is_admin() D11: multi-role admin with NO active hat -> FALSE (fail closed, D5)');
reset role;

-- BREAK-GLASS: a PURE (single-role) platform_admin never needs the picker —
-- the hook derives the hat implicitly, with no UI in the path (D11's own
-- explicit protection). Verified against the REAL custom_access_token_hook,
-- not a simulated claim, so a future change to the hook's own derivation
-- logic cannot silently break this.
select ok(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', (select admin from k),
    'claims', jsonb_build_object('sub', (select admin from k), 'session_id', gen_random_uuid()),
    'authentication_method', 'password'
  )) -> 'claims' ->> 'active_role') is null,
  'break-glass CONTROL: this exact multi-role admin now needs a real picker choice — hook mints NO claim (proves the hook genuinely re-evaluates live state, not a stale assumption)');

delete from public.memberships where principal_id = (select admin from k) and role = 'org_admin' and organization_id = (select org_b from k);

select ok(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', (select admin from k),
    'claims', jsonb_build_object('sub', (select admin from k), 'session_id', gen_random_uuid()),
    'authentication_method', 'password'
  )) -> 'claims' ->> 'active_role') = 'platform_admin',
  'break-glass ⭐: restored to a PURE platform_admin (no memberships) -> the hook derives active_role=platform_admin implicitly, no UI/picker involved (D11)');

-- ── list_my_nsp_hospitals() P0 keystone (BUG-ACT-HATBLIND-001 follow-up) ───
-- Found auditing session_context()'s consumers per the coordinator's P0
-- follow-up: this DEFINER RPC is the `/o/[org]/nsp` console's SOLE entry
-- gate (via getNspAccessByOrg -> listMyNspHospitals), and — unlike every
-- sibling PQS/NSP predicate (is_pqs_member_of_for, is_nsp_coordinator_of_for,
-- is_pqs_operator_*, all confirmed via the live catalog to delegate through
-- has_role, hence already hat-gated by Stage 3) — its body queried
-- public.memberships DIRECTLY, with no has_role/hat check anywhere. sa_x is
-- already multi-role (staff_admin@comm_x, org_admin@org_b); giving it a
-- THIRD role (pqs_member@hosp_b) makes it the fixture able to distinguish
-- "sees hosp_b because pqs_member is the active hat" from "sees hosp_b
-- regardless of hat" — exactly the shape used for is_admin() above.
insert into public.memberships (organization_id, hospital_id, principal_id, role)
values ((select org_b from k), (select hosp_b from k), (select sa_x from k), 'pqs_member');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_x from k), 'active_role', 'pqs_member')::text, true);
set local role authenticated;
select ok(
  exists (select 1 from jsonb_array_elements(public.list_my_nsp_hospitals()) g
           where (g->>'hospitalId')::uuid = (select hosp_b from k)),
  'list_my_nsp_hospitals() D12: pqs_member-hatted sa_x sees hosp_b (matching hat)');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_x from k), 'active_role', 'org_admin')::text, true);
set local role authenticated;
select ok(
  not exists (select 1 from jsonb_array_elements(public.list_my_nsp_hospitals()) g
               where (g->>'hospitalId')::uuid = (select hosp_b from k)),
  'list_my_nsp_hospitals() D12 ⭐ THE DISTINGUISHING CASE: sa_x wearing a DIFFERENT hat (org_admin, which he also genuinely holds) does NOT see hosp_b''s pqs_member grant — the /nsp console entry gate must not leak on the un-worn hat');
reset role;

select * from finish();
rollback;
