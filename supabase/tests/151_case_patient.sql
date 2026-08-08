-- patient_identifiers — Capture patient identifiers at Case creation (THIRD PHI module).
-- ADR 0038 (original), re-keyed to N-per-case by ADR 0064 E0 / F1 (migrations
-- 20260716000100_patient_identifiers_rekey.sql). Mirrors 150_referrals.sql.
--
-- Proves (posture PRESERVED verbatim across the re-key — only cardinality + key change):
--   * patient_identifiers direct SELECT REVOKED from authenticated; only the audited door.
--   * can_read_case_patient = the BROAD can_read_case (coordinator / phase-assignee /
--     narrative-assignee / grantee → TRUE; a foreign member → FALSE) — the DELIBERATE
--     broad-vs-tight contrast vs event/referral PHI predicates (R1 gate inherited).
--   * get_participant_patient / get_case_patients: NULL + ZERO audit for an unentitled
--     reader; exactly one case_patient.read for an entitled COORDINATOR and ASSIGNEE.
--   * the case_patient.updated mutation-audit metadata is {} (NO identifier).
--   * WRITE asymmetry: an assignee (broad READ) gets 42501 on set_participant_patient;
--     a coordinator succeeds + flips has_patient=true.
--   * patient_enabled snapshot true/false; a set on a non-enabled case raises check_violation.
--   * dispose_case_phi: happy path (clears identifiers + redacts free text + stamps +
--     flips has_patient false) + second call HC056 + bad reason check_violation + a
--     non-coordinator 42501 + the org-scoped I1 gate.
--   * flag-OFF ⇒ the writers raise check_violation.

begin;
select plan(39);

update app.feature_flags set enabled = true where key = 'case_patient';
update app.feature_flags set enabled = true where key = 'case_access';
update app.feature_flags set enabled = true where key = 'audit_trail';
-- The participant layer must be reachable for the re-keyed doors/writer.
update app.feature_flags set enabled = true where key = 'case_participants';

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

insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
  select (select organization_id from public.hospitals where id = (v->>'hosp_b')::uuid),
         (v->>'hosp_b')::uuid, (v->>'admin')::uuid, 'pqs_member', (v->>'admin')::uuid
  from ctx;
insert into public.pqs_department (hospital_id, name, rca_default_due_days)
  select (v->>'hosp_b')::uuid, 'NSP Bootstrap', 30 from ctx
  on conflict (hospital_id) do nothing;

-- One case in X with patient_enabled = true, 1 phase (assigned st_x → broad READ),
-- a narrative + an event (PHI free text to prove disposal redacts). organization_id
-- is backfilled by the guard_case_org_matches_commission BEFORE trigger.
create temp table cs on commit drop as
  select gen_random_uuid() as case_x,
         gen_random_uuid() as case_off,
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
   (select ver_u from k), 'active', (select st_x from k), '{}');

insert into public.case_narratives
  (id, case_id, type_label, display_position, status, body_md, created_by)
values
  ((select narr_x from cs), (select case_x from cs), 'Resumo', 2, 'open',
   'CORPO-SENSIVEL-NARRATIVA', (select sa_x from k));

insert into public.case_events (id, case_id, kind, body, created_by)
values ((select event_x from cs), (select case_x from cs), 'note',
        'NOTA-SENSIVEL-EVENTO', (select sa_x from k));

-- =========================================================================
-- REVOKE: direct SELECT on patient_identifiers is denied to authenticated.
-- =========================================================================
select is(
  has_table_privilege('authenticated', 'public.patient_identifiers', 'SELECT'),
  false, 'authenticated has NO direct SELECT on patient_identifiers (REVOKE)');
select is(
  has_table_privilege('authenticated', 'public.patient_identifiers', 'INSERT'),
  false, 'authenticated has NO direct INSERT on patient_identifiers (REVOKE)');

-- =========================================================================
-- WRITE gate: an assignee (broad READ) cannot set_participant_patient (42501);
-- the coordinator can, and flips has_patient = true. Capture the participant id.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_participant_patient(
       (select case_x from cs), null, 'Tentativa', 'MRN-X') $$,
  '42501', null, 'a phase assignee CANNOT set_participant_patient (42501) — writes are coordinators-only');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_participant_patient(
       (select case_x from cs), null, 'Tentativa', 'MRN-Y') $$,
  '42501', null, 'a foreign coordinator CANNOT set_participant_patient (42501)');
reset role;

-- The coordinator sets the identifiers; remember the new participant_id.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table pw on commit drop as
  select public.set_participant_patient(
    (select case_x from cs), null, 'Paciente Teste', 'MRN-9', null, 70, 'male', null, 'UTI', 'Dr X'
  ) as pid;
reset role;
grant select on pw to authenticated;
select ok((select pid from pw) is not null, 'the coordinator CAN set_participant_patient (returns a participant id)');

select is(
  (select has_patient from public.cases where id = (select case_x from cs)),
  true, 'set_participant_patient flips cases.has_patient = true');
select is(
  (select name from public.patient_identifiers where participant_id = (select pid from pw)),
  'Paciente Teste', 'the identifier row was written on the patient participant');

-- Q4 invariant: the participant registry row exposes NO raw identifier (surrogate label).
select is(
  (select display_name from public.participants where id = (select pid from pw)),
  'Paciente', 'the patient participant registry display_name is a SURROGATE, never the raw name (Q4)');

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
  $$ select public.set_participant_patient((select case_off from cs), null, 'Nao', 'MRN-0') $$,
  '23514', null, 'set_participant_patient on a non-enabled case raises check_violation');
reset role;

-- =========================================================================
-- can_read_case_patient (BROAD) — the deliberate broad-vs-tight contrast (R1 gate).
-- =========================================================================
select is(app.can_read_case_patient((select case_x from cs), (select sa_x from k)), true,
  'can_read_case_patient: coordinator → true');
-- ⬅ ADR 0078 defect ① / M3 (2026-07-15): FLIPPED true → false. A bare phase
-- assignment no longer confers patient identifiers — the ADR's confirmed defect ①
-- ("a bare phase or narrative assignment ... unqualified"), one of the three
-- justifications for the program. Assignment is CONTENT reach, never PHI
-- (Context·1 / D10); the assignee KEEPS can_read_case. Narrowing + positive twins
-- + mutation-proof live in 230_authz_m3_assignment_phi.sql.
select is(app.can_read_case_patient((select case_x from cs), (select st_x from k)), false,
  'can_read_case_patient: phase ASSIGNEE → FALSE (ADR 0078 defect ①/M3: assignment is content, never PHI)');
select is(app.can_read_case_patient((select case_x from cs), (select admin from k)), false,
  'can_read_case_patient: platform_admin → FALSE (PHI identifier; admin term dropped)');
select is(app.can_read_case_patient((select case_x from cs), (select st_x2 from k)), false,
  'can_read_case_patient: an unrelated member of the commission → FALSE');
select is(app.can_read_case_patient((select case_x from cs), (select sa_y from k)), false,
  'can_read_case_patient: a foreign coordinator → FALSE');

-- =========================================================================
-- get_participant_patient door: NULL + ZERO audit for an unentitled reader.
-- =========================================================================
create temp table a0 on commit drop as
  select (select count(*) from public.audit_log where action = 'case_patient.read') as before;
grant select on a0 to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table p_foreign on commit drop as
  select public.get_participant_patient((select pid from pw)) as j;
reset role;
grant select on p_foreign to authenticated;
select ok((select j from p_foreign) is null,
  'get_participant_patient returns NULL to an unentitled (foreign) reader');
select is(
  (select count(*) from public.audit_log where action = 'case_patient.read') - (select before from a0),
  0::bigint, 'an unentitled PHI read writes NO case_patient.read row');

-- =========================================================================
-- get_participant_patient door: one case_patient.read for an entitled COORDINATOR.
-- =========================================================================
create temp table a1 on commit drop as
  select (select count(*) from public.audit_log where action = 'case_patient.read') as before;
grant select on a1 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table p_coord on commit drop as
  select public.get_participant_patient((select pid from pw)) as j;
reset role;
grant select on p_coord to authenticated;
select is((select p_coord.j->>'name' from p_coord), 'Paciente Teste',
  'get_participant_patient returns the identifiers to the coordinator');
select is(
  (select count(*) from public.audit_log where action = 'case_patient.read') - (select before from a1),
  1::bigint, 'an entitled coordinator read writes exactly one case_patient.read row');

-- =========================================================================
-- get_participant_patient door: one case_patient.read for an ENTITLED reader.
--
-- ⬅ ADR 0078 defect ① / M3: the persona was the phase ASSIGNEE, who is no longer
-- entitled. The assertion being made here is RULE 11 ("an entitled read emits
-- exactly ONE audit row"), and that coverage must SURVIVE — so it is re-pointed to
-- a genuinely entitled reader (the coordinator) rather than flipped to expect null,
-- which would have silently deleted the Rule 11 assertion. The assignee's new
-- null-and-no-audit behaviour is asserted in 230_authz_m3_assignment_phi.sql.
-- =========================================================================
create temp table a2 on commit drop as
  select (select count(*) from public.audit_log where action = 'case_patient.read') as before;
grant select on a2 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table p_assignee on commit drop as
  select public.get_participant_patient((select pid from pw)) as j;
reset role;
grant select on p_assignee to authenticated;
select is((select p_assignee.j->>'mrn' from p_assignee), 'MRN-9',
  'get_participant_patient returns the identifiers to an ENTITLED reader (coordinator)');
select is(
  (select count(*) from public.audit_log where action = 'case_patient.read') - (select before from a2),
  1::bigint, 'an entitled read writes exactly one case_patient.read row (Rule 11 — coverage preserved)');

-- =========================================================================
-- The case_patient.updated mutation-audit row carries NO identifier (metadata={}),
-- keyed on the CASE (entity_id = case_id, continuity with the C-4 dispatch).
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

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'porque_sim') $$,
  '23514', null, 'an invalid disposal reason raises check_violation');
reset role;

-- =========================================================================
-- §I1 (org-scoped disposal gate) — platform-admin DENIED · case's-org org_admin
-- ALLOWED · a DIFFERENT-org org_admin DENIED. (Carried forward across the re-key.)
-- =========================================================================
create temp table i1 on commit drop as
  select gen_random_uuid() as org_other, gen_random_uuid() as hosp_other,
         gen_random_uuid() as case_i1;
grant select on i1 to authenticated;
insert into public.organizations (id, name, slug)
  values ((select org_other from i1), 'Org Other', 'org-other-' || substr((select org_other from i1)::text,1,8));
insert into public.hospitals (id, organization_id, name, slug)
  values ((select hosp_other from i1), (select org_other from i1), 'Hosp Other',
          'hosp-other-' || substr((select hosp_other from i1)::text,1,8));
insert into public.memberships (organization_id, principal_id, role) values
  ((select (v->>'org_b')::uuid from ctx), (select st_x2 from k), 'org_admin'),
  ((select org_other from i1),            (select sa_y from k),  'org_admin');
insert into public.cases (id, commission_id, case_number, label, created_by, patient_enabled)
  values ((select case_i1 from i1), (select comm_x from k), 9309, 'Caso I1', (select sa_x from k), true);

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_i1 from i1), 'subject_request') $$,
  '42501', null,
  'I1 GUARD: platform-admin (is_admin, no tenant grant) is DENIED dispose_case_phi (42501)');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_i1 from i1), 'subject_request') $$,
  '42501', null,
  'I1 GUARD: a DIFFERENT-org org_admin is DENIED dispose_case_phi on this org''s case (42501)');
reset role;

-- ⛔ INVERTED BY QO·B (20260915), PO ruling Q9. This asserted the OPPOSITE: the
-- case's-own-org org_admin was ALLOWED to dispose PHI through the org-scoped grant.
-- ADR 0100 D12 + Q9 cut dispose_case_phi from the tenancy admin — destroying Rule 12
-- data is not a duty for a principal that holds ZERO PHI bits (D5). Disposal is now a
-- functional-role act: the happy path below runs as sa_x, a real staff_admin, so this
-- inversion does NOT leave the door unproven — it relocates who proves it.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_i1 from i1), 'subject_request') $$,
  '42501', null,
  'I1 GUARD ⭐ QO·B: the case''s-org org_admin is now DENIED dispose_case_phi (D12/Q9 — zero PHI bits, so no PHI destruction)');
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
  (select count(*)::int from public.patient_identifiers where participant_id = (select pid from pw)),
  0, 'dispose_case_phi deletes the isolated patient_identifiers row');
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

select is(
  (select metadata from public.audit_log
   where action = 'case_patient.disposed' and entity_id = (select case_x from cs)
   order by occurred_at desc limit 1),
  jsonb_build_object('reason', 'subject_request'),
  'case_patient.disposed audit metadata carries the reason enum only (no PHI)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi((select case_x from cs), 'duplicate') $$,
  'HC056', null, 'a second dispose_case_phi on the same case is rejected (HC056, one-shot)');
reset role;

-- =========================================================================
-- flag OFF ⇒ the writers raise check_violation.
-- =========================================================================
update app.feature_flags set enabled = false where key = 'case_patient';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_participant_patient((select case_off from cs), null, 'X', 'MRN') $$,
  '23514', null, 'flag OFF ⇒ set_participant_patient raises check_violation');
select throws_ok(
  $$ select public.dispose_case_phi((select case_off from cs), 'other') $$,
  '23514', null, 'flag OFF ⇒ dispose_case_phi raises check_violation');
reset role;
update app.feature_flags set enabled = true where key = 'case_patient';

select * from finish();
rollback;
