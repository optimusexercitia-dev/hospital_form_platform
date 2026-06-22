-- case_patient — Capture patient identifiers at Case creation (THIRD PHI module).
-- ADR 0038; migration 20260620017000_case_patient.sql. Mirrors 150_referrals.sql.
--
-- Proves:
--   * case_patient direct SELECT REVOKED from authenticated; only the audited door.
--   * can_read_case_patient = the BROAD can_read_case (coordinator / phase-assignee /
--     narrative-assignee / grantee / admin → TRUE; a foreign member → FALSE) — the
--     DELIBERATE broad-vs-tight contrast vs event/referral PHI predicates.
--   * get_case_patient: NULL + ZERO audit for an unentitled reader; exactly one
--     case_patient.read for an entitled COORDINATOR and an entitled ASSIGNEE.
--   * the case_patient.updated mutation-audit metadata is {} (NO identifier).
--   * WRITE asymmetry: an assignee (broad READ) gets 42501 on set_case_patient; a
--     coordinator succeeds + flips has_patient=true.
--   * patient_enabled snapshot true/false by the template's collects_patient; a
--     set on a non-enabled case raises check_violation.
--   * dispose_case_phi: happy path (clears identifiers + redacts narrative/event
--     free text + stamps + flips has_patient false) + second call HC056 + bad
--     reason check_violation + a non-coordinator 42501.
--   * flag-OFF ⇒ the writers raise check_violation.
--
-- The .read AUDIT rows are asserted directly: get_case_patient emits them INSIDE
-- the SECURITY DEFINER door, so a DB-side test can observe them (like referrals).

begin;
select plan(35);

-- Flags ON for the whole test (hermetic; must not depend on migration order).
update app.feature_flags set enabled = true where key = 'case_patient';
update app.feature_flags set enabled = true where key = 'case_access';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,    -- coordinator (staff_admin of X)
         (v->>'st_x')::uuid    as st_x,    -- PHASE assignee (broad read, no write)
         (v->>'st_x2')::uuid   as st_x2,   -- unrelated member of X (no attribution)
         (v->>'sa_y')::uuid    as sa_y,    -- foreign coordinator (commission Y)
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u,
         (v->>'ver_u')::uuid   as ver_u
  from ctx;
grant select on k to authenticated;

-- The bootstrap admin is the QPS/PQS operator (is_pqs_member real) for parity; the
-- case_patient predicate does not require PQS, but admin must still read broadly.
insert into public.pqs_members (user_id) select admin from k;

-- ---------------------------------------------------------------------------
-- One case in X with: patient_enabled = true, 1 phase (assigned st_x → the broad
-- READ persona), a narrative + an event (PHI free text to prove disposal redacts).
-- Built directly as table owner (case_phases/case_narratives/case_events INSERT is
-- unguarded — the state guards are BEFORE UPDATE/DELETE only).
-- ---------------------------------------------------------------------------
create temp table cs on commit drop as
  select gen_random_uuid() as case_x,    -- patient_enabled = true
         gen_random_uuid() as case_off,  -- patient_enabled = false (snapshot test)
         gen_random_uuid() as phase_x,
         gen_random_uuid() as narr_x,
         gen_random_uuid() as event_x;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by, patient_enabled)
values
  ((select case_x from cs),   (select comm_x from k), 9301, 'Caso PHI',     (select sa_x from k), true),
  ((select case_off from cs), (select comm_x from k), 9302, 'Caso sem PHI', (select sa_x from k), false);

insert into public.case_phases
  (id, case_id, position, form_id, form_version_id, status, assigned_to, blocks)
values
  ((select phase_x from cs), (select case_x from cs), 1, (select form_u from k),
   (select ver_u from k), 'ativa', (select st_x from k), '{}');

insert into public.case_narratives
  (id, case_id, type_label, display_position, status, body_md, created_by)
values
  ((select narr_x from cs), (select case_x from cs), 'Resumo', 2, 'aberta',
   'CORPO-SENSIVEL-NARRATIVA', (select sa_x from k));

insert into public.case_events (id, case_id, kind, body, created_by)
values ((select event_x from cs), (select case_x from cs), 'note',
        'NOTA-SENSIVEL-EVENTO', (select sa_x from k));

-- =========================================================================
-- REVOKE: direct SELECT on case_patient is denied to authenticated.
-- =========================================================================
select is(
  has_table_privilege('authenticated', 'public.case_patient', 'SELECT'),
  false, 'authenticated has NO direct SELECT on case_patient (REVOKE)');
select is(
  has_table_privilege('authenticated', 'public.case_patient', 'INSERT'),
  false, 'authenticated has NO direct INSERT on case_patient (REVOKE)');

-- =========================================================================
-- WRITE gate: an assignee (broad READ) cannot set_case_patient (42501); the
-- coordinator can, and flips has_patient = true.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_patient(
       (select case_x from cs), 'Tentativa', 'MRN-X', null, null, 'unknown', null, null, null) $$,
  '42501', null, 'a phase assignee CANNOT set_case_patient (42501) — writes are coordinators-only');
reset role;

-- A foreign coordinator cannot write either.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_patient(
       (select case_x from cs), 'Tentativa', 'MRN-Y', null, null, 'unknown', null, null, null) $$,
  '42501', null, 'a foreign coordinator CANNOT set_case_patient (42501)');
reset role;

-- The coordinator sets the identifiers.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_case_patient(
       (select case_x from cs), 'Paciente Teste', 'MRN-9', null, 70, 'male', null, 'UTI', 'Dr X') $$,
  'the coordinator CAN set_case_patient');
reset role;

select is(
  (select has_patient from public.cases where id = (select case_x from cs)),
  true, 'set_case_patient flips cases.has_patient = true');
select is(
  (select name from public.case_patient where case_id = (select case_x from cs)),
  'Paciente Teste', 'the identifier row was written');

-- =========================================================================
-- patient_enabled snapshot + non-enabled-case guard.
-- =========================================================================
select is(
  (select patient_enabled from public.cases where id = (select case_x from cs)),
  true, 'case_x snapshots patient_enabled = true');
select is(
  (select patient_enabled from public.cases where id = (select case_off from cs)),
  false, 'case_off snapshots patient_enabled = false');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_patient(
       (select case_off from cs), 'Nao', 'MRN-0', null, null, 'unknown', null, null, null) $$,
  '23514', null, 'set_case_patient on a non-enabled case raises check_violation');
reset role;

-- =========================================================================
-- can_read_case_patient (BROAD) — the deliberate broad-vs-tight contrast.
-- coordinator / phase-assignee / admin → TRUE; an unrelated member + foreign → FALSE.
-- =========================================================================
select is(app.can_read_case_patient((select case_x from cs), (select sa_x from k)), true,
  'can_read_case_patient: coordinator → true');
select is(app.can_read_case_patient((select case_x from cs), (select st_x from k)), true,
  'can_read_case_patient: phase ASSIGNEE → true (the broad scope; assignees need the MRN)');
select is(app.can_read_case_patient((select case_x from cs), (select admin from k)), true,
  'can_read_case_patient: admin → true');
select is(app.can_read_case_patient((select case_x from cs), (select st_x2 from k)), false,
  'can_read_case_patient: an unrelated member of the commission → FALSE');
select is(app.can_read_case_patient((select case_x from cs), (select sa_y from k)), false,
  'can_read_case_patient: a foreign coordinator → FALSE');

-- =========================================================================
-- get_case_patient door: NULL + ZERO audit for an unentitled reader.
-- =========================================================================
create temp table a0 on commit drop as
  select (select count(*) from public.audit_log where action = 'case_patient.read') as before;
grant select on a0 to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table p_foreign on commit drop as
  select public.get_case_patient((select case_x from cs)) as j;
reset role;
grant select on p_foreign to authenticated;
select ok((select j from p_foreign) is null,
  'get_case_patient returns NULL to an unentitled (foreign) reader');
select is(
  (select count(*) from public.audit_log where action = 'case_patient.read') - (select before from a0),
  0::bigint, 'an unentitled PHI read writes NO case_patient.read row');

-- =========================================================================
-- get_case_patient door: one case_patient.read for an entitled COORDINATOR.
-- =========================================================================
create temp table a1 on commit drop as
  select (select count(*) from public.audit_log where action = 'case_patient.read') as before;
grant select on a1 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table p_coord on commit drop as
  select public.get_case_patient((select case_x from cs)) as j;
reset role;
grant select on p_coord to authenticated;
select is((select p_coord.j->>'name' from p_coord), 'Paciente Teste',
  'get_case_patient returns the identifiers to the coordinator');
select is(
  (select count(*) from public.audit_log where action = 'case_patient.read') - (select before from a1),
  1::bigint, 'an entitled coordinator read writes exactly one case_patient.read row');

-- =========================================================================
-- get_case_patient door: one case_patient.read for an entitled ASSIGNEE (broad).
-- =========================================================================
create temp table a2 on commit drop as
  select (select count(*) from public.audit_log where action = 'case_patient.read') as before;
grant select on a2 to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table p_assignee on commit drop as
  select public.get_case_patient((select case_x from cs)) as j;
reset role;
grant select on p_assignee to authenticated;
select is((select p_assignee.j->>'mrn' from p_assignee), 'MRN-9',
  'get_case_patient returns the identifiers to the phase ASSIGNEE (broad read)');
select is(
  (select count(*) from public.audit_log where action = 'case_patient.read') - (select before from a2),
  1::bigint, 'an entitled assignee read writes exactly one case_patient.read row');

-- =========================================================================
-- The case_patient.updated mutation-audit row carries NO identifier (metadata={}).
-- =========================================================================
select is(
  (select metadata from public.audit_log
   where action = 'case_patient.updated' and entity_id = (select case_x from cs)
   order by occurred_at desc limit 1),
  '{}'::jsonb, 'case_patient.updated audit metadata carries NO identifier');

-- =========================================================================
-- dispose_case_phi: a non-coordinator is rejected (42501).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'subject_request') $$,
  '42501', null, 'a non-coordinator CANNOT dispose_case_phi (42501)');
reset role;

-- A bad reason is rejected (check_violation) before any mutation.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'porque_sim') $$,
  '23514', null, 'an invalid disposal reason raises check_violation');
reset role;

-- =========================================================================
-- dispose_case_phi: happy path — deletes identifiers, redacts free text, stamps.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'subject_request') $$,
  'the coordinator CAN dispose_case_phi (happy path)');
reset role;

select is(
  (select count(*)::int from public.case_patient where case_id = (select case_x from cs)),
  0, 'dispose_case_phi deletes the isolated case_patient row');
select is(
  (select body_md from public.case_narratives where id = (select narr_x from cs)),
  null, 'dispose_case_phi NULLs the case narrative body_md (nullable column)');
select is(
  (select body from public.case_events where id = (select event_x from cs)),
  '[PHI removido]', 'dispose_case_phi REDACTS the case_events.body to the sentinel (NOT NULL column)');
select is(
  (select has_patient from public.cases where id = (select case_x from cs)),
  false, 'dispose_case_phi flips cases.has_patient = false');
select is(
  (select phi_disposed_reason from public.cases where id = (select case_x from cs)),
  'subject_request', 'dispose_case_phi stamps the constrained reason');
select ok(
  (select phi_disposed_at is not null from public.cases where id = (select case_x from cs)),
  'dispose_case_phi stamps phi_disposed_at');

-- The disposal mutation-audit row carries the reason ENUM only (no free text/PHI).
select is(
  (select metadata from public.audit_log
   where action = 'case_patient.disposed' and entity_id = (select case_x from cs)
   order by occurred_at desc limit 1),
  jsonb_build_object('reason', 'subject_request'),
  'case_patient.disposed audit metadata carries the reason enum only (no PHI)');

-- A second disposal on the same case is rejected (HC056, one-shot).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'duplicate') $$,
  'HC056', null, 'a second dispose_case_phi on the same case is rejected (HC056, one-shot)');
reset role;

-- =========================================================================
-- flag OFF ⇒ the writers raise check_violation (byte-identical-to-today posture).
-- =========================================================================
update app.feature_flags set enabled = false where key = 'case_patient';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_patient(
       (select case_off from cs), 'X', 'MRN', null, null, 'unknown', null, null, null) $$,
  '23514', null, 'flag OFF ⇒ set_case_patient raises check_violation');
select throws_ok(
  $$ select public.dispose_case_phi((select case_off from cs), 'other') $$,
  '23514', null, 'flag OFF ⇒ dispose_case_phi raises check_violation');
reset role;
update app.feature_flags set enabled = true where key = 'case_patient';

select * from finish();
rollback;
