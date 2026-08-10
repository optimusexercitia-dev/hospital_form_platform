-- NSP-per-hospital PQS membership management (ADR 0052; migration 20260710000000).
-- REPLACES the old file (which tested the dropped GLOBAL roster + admin-only add/remove).
-- Now: roster is PER-HOSPITAL; curation is coordinator (of the hospital) OR the org's
-- nsp_org_admin; a plain org_admin cannot curate.
--
-- Covers:
--   * add_pqs_member(hospital, user) — coordinator-only (42501 for non-coordinator)
--   * remove_pqs_member(hospital, user) — coordinator-only
--   * list_pqs_members(hospital) — coordinator-only (42501 for plain member + non-coord)
--   * set_pqs_rca_due_window(hospital, days) — coordinator OR enrolled member; range enforced
--   * is_pqs_member_of_for / is_nsp_coordinator_of_for — enrollment tracks access
--   * is_pqs_member_of_any — the nav-level "show NSP at all" predicate
--   * Three-way duty separation: org_admin appoints coordinator ≠ coordinator curates
--     roster ≠ enrolled member reads PHI
--   * §H — event PHI-door matrix (can_read_event_patient + get_event_patient),
--     restored from the pre-NSP-per-org 145 and re-homed here (the 140 comment
--     delegates this matrix to 145): a broad can_read_event reader who is NOT
--     can_read_event_patient gets NULL from get_event_patient (event-side analog
--     of the referral BUG-NSP-002 guard).

begin;
select plan(42);   -- QO·FUP F8: +§I (I1-I7) — the list_my_nsp_hospitals door

update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,   -- plain member of comm_x, untouched by §G (the §H non-PHI reader)
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,      -- bootstrap org (both comm_x and comm_y are under it)
         (v->>'hosp_b')::uuid as hosp_b      -- bootstrap hospital (both comm_x and comm_y hang under it)
  from ctx;
grant select on k to authenticated;

-- Set up an NSP coordinator for hosp_b (bootstrap's single hospital). We'll use sa_y as
-- the coordinator persona (plain staff_admin — not admin), and insert directly as
-- superuser. The nsp_coordinator role is now HOSPITAL-scoped (hospital_id NOT NULL).
insert into public.memberships (organization_id, principal_id, role, hospital_id)
  values ((select org_b from k), (select sa_y from k), 'nsp_coordinator', (select hosp_b from k));

-- Enroll admin into the roster so we can test revocation. Direct superuser insert.
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
  values ((select org_b from k), (select hosp_b from k), (select admin from k), 'pqs_member', (select sa_y from k));

-- ============================================================================
-- §A: is_pqs_member_of_for reflects enrollment state
-- ============================================================================
select ok(
  app.is_pqs_member_of_for((select hosp_b from k), (select admin from k)),
  'A1: admin enrolled → is_pqs_member_of_for(hosp_b, admin) = true');
select ok(
  not app.is_pqs_member_of_for((select hosp_b from k), (select sa_x from k)),
  'A2: sa_x not enrolled → is_pqs_member_of_for(hosp_b, sa_x) = false');

-- ============================================================================
-- §B: is_pqs_member_of_any (nav-level predicate)
-- ============================================================================
select ok(
  app.is_pqs_member_of_any((select admin from k)),
  'B1: is_pqs_member_of_any(admin) = true (enrolled in at least one org)');
select ok(
  not app.is_pqs_member_of_any((select sa_x from k)),
  'B2: is_pqs_member_of_any(sa_x) = false (not enrolled anywhere)');

-- ============================================================================
-- §C: add_pqs_member — coordinator-only; non-coordinator gets 42501
-- ============================================================================
-- A plain staff_admin (not coordinator) cannot enroll.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select st_x from k)),
  '42501', null,
  'C1: non-coordinator calling add_pqs_member(hospital, user) raises 42501');
reset role;

-- Plain staff cannot enroll.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select st_y from k)),
  '42501', null,
  'C2: plain staff calling add_pqs_member raises 42501');
reset role;

-- The coordinator (sa_y) CAN enroll a user.
select test_helpers.claims_for((select sa_y from k), false, 'nsp_coordinator');
set local role authenticated;
select lives_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_x from k)),
  'C3: coordinator add_pqs_member enrolls sa_x (void return)');
reset role;
select ok(
  app.has_role('hospital', (select hosp_b from k), 'pqs_member', (select sa_x from k)),
  'C3b: sa_x now enrolled per app.has_role (hospital, pqs_member)');
select ok(
  app.is_pqs_member_of_for((select hosp_b from k), (select sa_x from k)),
  'C4: sa_x now enrolled → is_pqs_member_of_for = true after add_pqs_member');

-- Duplicate enrollment is idempotent. ⚠ NOT because the kernel does nothing: since
-- QO·FUP F1 (ADR 0102) the clause is `on conflict … do update set expires_at =
-- coalesce(excluded.expires_at, memberships.expires_at)`. It is idempotent HERE because
-- add_pqs_member takes no expiry argument, so coalesce(null, existing) writes the
-- existing value back. This comment said `on conflict do nothing` until 2026-08-07.
select test_helpers.claims_for((select sa_y from k), false, 'nsp_coordinator');
set local role authenticated;
select lives_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_x from k)),
  'C5: re-enrolling an already-enrolled user is idempotent (lives_ok)');
reset role;

-- ============================================================================
-- §D: remove_pqs_member — coordinator-only; revokes access on removal
-- ============================================================================
-- Non-coordinator cannot remove.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.remove_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select admin from k)),
  '42501', null,
  'D1: non-coordinator calling remove_pqs_member raises 42501');
reset role;

-- Coordinator removes sa_x (enrolled in §C).
select test_helpers.claims_for((select sa_y from k), false, 'nsp_coordinator');
set local role authenticated;
select lives_ok(
  format($$ select public.remove_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_x from k)),
  'D2: coordinator remove_pqs_member completes without error');
reset role;
select ok(
  not app.is_pqs_member_of_for((select hosp_b from k), (select sa_x from k)),
  'D3: sa_x no longer enrolled → is_pqs_member_of_for = false after remove_pqs_member');

-- ============================================================================
-- §E: list_pqs_members — coordinator-only
-- ============================================================================
-- Plain staff member cannot list.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_pqs_members(%L::uuid) $$, (select hosp_b from k)),
  '42501', null,
  'E1: non-coordinator calling list_pqs_members raises 42501');
reset role;

-- Enrolled member (not coordinator) cannot list (curation duty is coordinator-only).
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_pqs_members(%L::uuid) $$, (select hosp_b from k)),
  '42501', null,
  'E2: enrolled member (non-coordinator) calling list_pqs_members raises 42501');
reset role;

-- Coordinator can list; must contain admin (still enrolled from §A).
select test_helpers.claims_for((select sa_y from k), false, 'nsp_coordinator');
set local role authenticated;
create temp table members_list on commit drop as
  select public.list_pqs_members((select hosp_b from k)) as j;
reset role;
grant select on members_list to authenticated;
select ok(
  (select j::text from members_list) like '%' || (select admin from k)::text || '%',
  'E3: coordinator list_pqs_members returns JSON containing admin''s user_id');

-- ============================================================================
-- §F: set_pqs_rca_due_window(org, days) — coordinator OR enrolled member; range-validated
-- ============================================================================
-- set_pqs_rca_due_window requires an existing pqs_department row for the hospital.
-- The bootstrap() helper truncates pqs_department, so we seed one here as superuser.
insert into public.pqs_department (hospital_id, name, rca_default_due_days)
  values ((select hosp_b from k), 'NSP Test', 30);

-- A non-enrolled, non-coordinator user cannot set the window.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_pqs_rca_due_window(%L::uuid, 30) $$, (select hosp_b from k)),
  '42501', null,
  'F1: non-member, non-coordinator calling set_pqs_rca_due_window raises 42501');
reset role;

-- Range validation: 0 and >365 are rejected (HC046).
select test_helpers.claims_for((select sa_y from k), false, 'nsp_coordinator');
set local role authenticated;
select throws_ok(
  format($$ select public.set_pqs_rca_due_window(%L::uuid, 0) $$, (select hosp_b from k)),
  'HC046', null,
  'F2: set_pqs_rca_due_window(hospital, 0) raises HC046 (below range)');
select throws_ok(
  format($$ select public.set_pqs_rca_due_window(%L::uuid, 400) $$, (select hosp_b from k)),
  'HC046', null,
  'F3: set_pqs_rca_due_window(hospital, 400) raises HC046 (above range)');
-- Valid update by coordinator.
select public.set_pqs_rca_due_window((select hosp_b from k), 60);
reset role;
select is(
  (select rca_default_due_days from public.pqs_department
   where hospital_id = (select hosp_b from k)),
  60,
  'F4: coordinator set_pqs_rca_due_window(hosp_b, 60) updates pqs_department.rca_default_due_days = 60');

-- Enrolled member (admin) can also set the window.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_pqs_rca_due_window(%L::uuid, 45) $$, (select hosp_b from k)),
  'F5: enrolled member calling set_pqs_rca_due_window succeeds (coordinator OR member gate)');
reset role;
select is(
  (select rca_default_due_days from public.pqs_department
   where hospital_id = (select hosp_b from k)),
  45,
  'F6: enrolled member set_pqs_rca_due_window(hosp_b, 45) takes effect');

-- ============================================================================
-- §G: Three-way duty separation verification
-- ============================================================================
-- (1) org_admin cannot call add_pqs_member (duty: appoint coordinators only).
-- Bootstrap sets admin as the bootstrap persona (is_admin=true) but it is also
-- enrolled in pqs_members — we need a PURE org_admin test; use a fresh persona.
-- Insert an org_admin org_member for st_y (plain staff, not a coordinator).
insert into public.memberships (organization_id, principal_id, role)
  values ((select org_b from k), (select st_y from k), 'org_admin');

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select st_x from k)),
  '42501', null,
  'G1: org_admin (no coordinator role) calling add_pqs_member raises 42501 (THREE-WAY duty separation)');
reset role;

-- (2) org_admin CAN appoint coordinators via organization_members (their own curation right).
-- The nsp_coordinator role is now HOSPITAL-scoped (hospital_id NOT NULL).
insert into public.memberships (organization_id, principal_id, role, hospital_id)
  values ((select org_b from k), (select st_x from k), 'nsp_coordinator', (select hosp_b from k))
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;
select ok(
  app.is_nsp_coordinator_of_for((select hosp_b from k), (select st_x from k)),
  'G2: a user appointed nsp_coordinator is recognized by is_nsp_coordinator_of_for');

-- (3) pqs_department SELECT is accessible to any authenticated member (non-PHI config).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.pqs_department
   where hospital_id = (select hosp_b from k)) >= 1,
  'G3: any authenticated member can read pqs_department (non-PHI config)');
reset role;

-- (4) anon cannot read pqs_department.
select ok(
  not has_table_privilege('anon', 'public.pqs_department', 'SELECT'),
  'G4: anon cannot SELECT pqs_department (authenticated-only policy)');

-- ============================================================================
-- §H: event PHI-door matrix — can_read_event_patient + get_event_patient.
-- RESTORED from the pre-NSP-per-org 145 (the rewrite dropped it) and re-homed
-- here per the 140_patient_safety.sql comment that delegates this matrix to 145.
-- This is the EVENT-side analog of the referral BUG-NSP-002 guard: a broad
-- can_read_event reader (plain reporting member) who is NOT can_read_event_patient
-- must get NULL from the get_event_patient PHI door. `admin` is enrolled in the
-- bootstrap hospital roster (§ top), so it is the per-hospital PQS reader here.
-- NSP-per-hospital (ADR 0052, decision 12): a coordinator is now a full operator
-- (PHI read via the operator arm), so the broad-but-not-PHI persona must be a plain
-- member with NO NSP role — st_x was appointed nsp_coordinator in §G2, so §H uses
-- st_x2 (an untouched plain member of comm_x) for the "broad, non-PHI" role.
-- ============================================================================
-- An event reported by comm_x (under org_b), PQS-held (NULL custodian), with an
-- isolated event_patient PHI row. Direct superuser inserts (mirrors seed).
create temp table ev on commit drop as select gen_random_uuid() as id;
grant select on ev to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select id from ev), 'EV-TEST-A', (select comm_x from k), current_date,
   'Evento de teste — PHI door', 'acknowledged', 'pqs', null, (select st_x from k));
insert into public.event_patient (event_id, name, mrn, sex)
values ((select id from ev), 'Paciente Teste', 'MRN-1', 'female');
update public.patient_safety_event set has_patient = true where id = (select id from ev);

-- A second event with NO PHI row (entitled-but-empty case).
create temp table ev2 on commit drop as select gen_random_uuid() as id;
grant select on ev2 to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select id from ev2), 'EV-TEST-B', (select comm_x from k), current_date,
   'Evento sem PHI', 'acknowledged', 'pqs', null, (select st_x from k));

-- (H1) can_read_event broad vs can_read_event_patient tight — the within-hospital gap.
select ok(
  app.can_read_event((select id from ev), (select st_x2 from k)),
  'H1: plain reporting member has BROAD read (can_read_event = true)');
select ok(
  not app.can_read_event_patient((select id from ev), (select st_x2 from k)),
  'H1: plain reporting member has NO PHI-identifier read (can_read_event_patient = false)');
select ok(
  app.can_read_event_patient((select id from ev), (select admin from k)),
  'H1: enrolled PQS member (admin) CAN read identifiers (can_read_event_patient = true)');

-- (H2) access-follows-custody: move custody to comm_x → its staff_admin gains the
-- panel; the plain member still does not.
update public.patient_safety_event
  set current_owner_kind = 'commission', current_owner_commission_id = (select comm_x from k)
  where id = (select id from ev);
select ok(
  app.can_read_event_patient((select id from ev), (select sa_x from k)),
  'H2: custodian-commission staff_admin CAN read identifiers (access-follows-custody)');
select ok(
  not app.can_read_event_patient((select id from ev), (select st_x2 from k)),
  'H2: plain member of the custodian commission still CANNOT read identifiers');
update public.patient_safety_event
  set current_owner_kind = 'pqs', current_owner_commission_id = null
  where id = (select id from ev);

-- (H3) get_event_patient door: entitled gets the row; the BROAD-but-not-PHI reader
-- gets NULL (the BUG-NSP-002-class guard for events); entitled-no-PHI gets NULL.
create temp table rc on commit drop as
  select count(*)::int as before from public.audit_log where action = 'event_patient.read';
grant select on rc to authenticated;

select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  (public.get_event_patient((select id from ev)) ->> 'name'),
  'Paciente Teste',
  'H3: get_event_patient returns the identifier row for an entitled (PQS) caller');
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select ok(
  public.get_event_patient((select id from ev)) is null,
  'H3 GUARD: get_event_patient returns NULL to a broad (can_read_event) but non-PHI reader');
reset role;

select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select ok(
  public.get_event_patient((select id from ev2)) is null,
  'H3: get_event_patient returns NULL to an entitled caller on a PHI-less event');
reset role;

-- (H4) the only mutations to event_patient.read are the ONE entitled read above:
-- the broad-non-PHI reader and the no-PHI read wrote no audit row.
select is(
  (select count(*)::int from public.audit_log where action = 'event_patient.read') - (select before from rc),
  1,
  'H4: exactly ONE event_patient.read row (broad-non-PHI + no-PHI reads write none)');

-- ============================================================================
-- §I: list_my_nsp_hospitals() — the door honours `is_active` and expiry
--     (QO·FUP F8 / FUP-QO-8; migration 20260912000100).
--
-- WHY HERE AND WHY AT ALL. This door read `public.memberships` RAW: no is_active
-- gate, no expiry filter, while EVERY sibling predicate in this very file carries
-- both (§A/§B assert them). In the console path the org read
-- (`organizations_select` -> `app.is_pqs_operator_in_org`) applies the correct
-- filters, so the laxity was masked there — but
-- src/components/indicators/capa-operator-gate.ts:26 calls the door DIRECTLY, and
-- an expired or deactivated member kept the CAPA affordance.
--
-- ⚠ The door was on authz-neverclled-door-allowlist.txt — i.e. NO pgTAP test
-- called it at all, which is precisely why its gate could drift below its
-- siblings' unnoticed. §I removes it from that allowlist by driving it for real.
--
-- ⛔ jsonb_array_length, never count(*): the door returns a SCALAR jsonb array, so
-- `select count(*) from list_my_nsp_hospitals()` is ALWAYS 1 and would report the
-- same value on both sides of the fix (the recorded 7.10 trap — a probe that does
-- not MOVE is measuring the wrong thing).
-- ============================================================================
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_nsp_hospitals()), 1,
  'I1 POSITIVE TWIN: the enrolled, active, unexpired member sees exactly 1 operator hospital (else every negative below is vacuous)');
reset role;

-- EXPIRED. Injected as postgres: no product path sets a PAST expiry (grant_role
-- refuses `p_expires_at <= now()` at the door — 306 4.4), so the only way to reach
-- this state is the same one an already-elapsed grant reaches by waiting.
update public.memberships set expires_at = now() - interval '1 hour'
 where principal_id = (select admin from k) and role = 'pqs_member';

select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_nsp_hospitals()), 0,
  'I2 ⭐ EXPIRED: an elapsed enrollment resolves to NO operator hospital (the door filtered nothing before F8)');
reset role;

-- Restore the expiry, then take the OTHER arm away: deactivate the principal.
update public.memberships set expires_at = null
 where principal_id = (select admin from k) and role = 'pqs_member';
update public.profiles set is_active = false where id = (select admin from k);

select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_nsp_hospitals()), 0,
  'I3 ⭐ DEACTIVATED: an inactive principal resolves to NO operator hospital, even with a live unexpired grant');
reset role;

update public.profiles set is_active = true where id = (select admin from k);

select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_nsp_hospitals()), 1,
  'I4 ⭐ THE PROBE MOVES BOTH WAYS: reactivating restores the hospital — so I3''s zero came from is_active, not from a broken fixture');
reset role;

-- The COORDINATOR arm is a SEPARATE union branch with its own filters. A fix applied
-- to one arm only passes I1-I4 and reds here.
select test_helpers.claims_for((select sa_y from k), false, 'nsp_coordinator');
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_nsp_hospitals()), 1,
  'I5 POSITIVE TWIN: the appointed coordinator sees exactly 1 operator hospital');
reset role;

update public.memberships set expires_at = now() - interval '1 hour'
 where principal_id = (select sa_y from k) and role = 'nsp_coordinator';

select test_helpers.claims_for((select sa_y from k), false, 'nsp_coordinator');
set local role authenticated;
select is(
  jsonb_array_length(public.list_my_nsp_hospitals()), 0,
  'I6 ⭐ EXPIRED (COORDINATOR ARM): the second union branch carries the same filters — a one-arm fix passes I1-I4 and reds here');
reset role;

update public.memberships set expires_at = null
 where principal_id = (select sa_y from k) and role = 'nsp_coordinator';

-- STRUCTURAL: the tightening must not have cost the door its reachability. A
-- DROP+CREATE would silently lose `authenticated=X` and the door would 42501 for
-- everyone — a failure this file's behavioural assertions cannot distinguish from
-- "correctly denied" once the caller is denied for any reason.
select ok(
  has_function_privilege('authenticated', 'public.list_my_nsp_hospitals()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_my_nsp_hospitals()', 'EXECUTE'),
  'I7 STRUCTURAL: the door keeps its authenticated EXECUTE grant and stays anon-non-executable (create-or-replace preserved the ACL)');

select * from finish();
rollback;
