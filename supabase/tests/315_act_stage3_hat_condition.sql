-- ACT Stage 3 (ADR 0106) — the revert-twin keystone.
--
-- Plan §4 Stage 3 gate: "a pgTAP test that goes RED when the active-role
-- condition is removed from has_role... must assert through a table reached
-- ONLY via has_role — no OR'd permissive sibling grant."
--
-- Table: public.meeting_minutes_jobs. Verified live (not assumed) to carry
-- EXACTLY ONE policy for SELECT, PERMISSIVE, to authenticated:
--   meeting_minutes_jobs_select = app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
-- `app.is_staff_admin_of(p_commission_id)` = `is_active(auth.uid()) AND
-- has_role('commission', p_commission_id, 'staff_admin', auth.uid())` — a
-- direct, single-clause caller check through the 4-arg has_role this stage
-- amends. No is_admin()/other-door OR'd sibling exists on this policy, so a
-- widening in has_role's own caller-only condition cannot be masked by an
-- alternate admitting path (authz-handoff §7.1 shape 6).

begin;
select plan(14);

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
         (v->>'org_b')::uuid as org_b, (v->>'admin')::uuid as admin from ctx;
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
  (select count(*)::int from public.meeting_minutes_jobs where meeting_id = (select meeting_id from m)),
  1,
  'REVERT-TWIN ⭐: with the caller-only condition REMOVED from has_role, the SAME hatless caller is now WRONGLY admitted (1, not 0) — proves the detector can detect the over-grant it exists to prevent');
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

select * from finish();
rollback;
