-- =============================================================================
-- ETH·E3a BE-7 — getEthicsDashboard RLS-scoping (the E3a gate keystone).
--
-- The dashboard read (src/lib/queries/ethics-dashboard.ts) is ordinary authenticated
-- `.from().select()` over ethics_case_details / case_decisions / ethics_decision_details
-- — each SELECT-gated `USING app.can_read_case(case_id, auth.uid())`. This file runs the
-- SAME aggregating queries under each role/uid and proves a viewer who cannot read a case
-- contributes ZERO to every count — no leak of a case's existence at the reporting layer.
--
-- Fixture (comm_x, all explicit_grants_only ethics cases):
--   A  pending,     no decision           — NON-GRANTED to every non-coordinator
--   B  admissible,  issued decision + S1  — granted to st_x & st_x2; st_x is RESPONDENT
--   C  admissible,  issued decision + S2  — granted to st_x & st_x2; st_x2 is RECUSED
-- Readable: sa_x(coord)=A,B,C(3) · st_x=C(1, B respondent-excluded, A non-granted) ·
--   st_x2=B(1, C recused, A non-granted) · sa_y(foreign)=0.
--
-- MUTATION-PROOF: the same totalCases query run UNSCOPED (superuser, RLS bypassed —
-- the service-role/unscoped path) returns 3 == coordinator, so the respondent's scoped 1
-- is RLS-driven; switching the read to that path makes the keystone (respondent<coord) RED.
-- Fresh reset (pgtap-needs-fresh-reset).
-- =============================================================================

begin;
select plan(14);

update app.feature_flags set enabled = true
  where key in ('ethics', 'case_access', 'cases_multi_phase', 'case_types');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

reset role;
-- Cases + ethics_case_details.
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values
  ('00000000-0000-0000-0000-00000e3a7001', (select comm_x from k), 97001, (select sa_x from k), 'explicit_grants_only', 'ethics_investigation'),
  ('00000000-0000-0000-0000-00000e3a7002', (select comm_x from k), 97002, (select sa_x from k), 'explicit_grants_only', 'ethics_investigation'),
  ('00000000-0000-0000-0000-00000e3a7003', (select comm_x from k), 97003, (select sa_x from k), 'explicit_grants_only', 'ethics_investigation');
insert into public.ethics_case_details (case_id, admissibility_status, complaint_received_at) values
  ('00000000-0000-0000-0000-00000e3a7001', 'pending',    now() - interval '30 days'),
  ('00000000-0000-0000-0000-00000e3a7002', 'admissible', now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000e3a7003', 'admissible', now() - interval '10 days');
-- Two sanction types + an issued decision + details on B and C.
insert into public.ethics_sanction_types (id, organization_id, key, display_name) values
  ('00000000-0000-0000-0000-00000e3a7011', (select org_x from k), 'advertencia', 'Advertência'),
  ('00000000-0000-0000-0000-00000e3a7012', (select org_x from k), 'censura',      'Censura');
insert into public.case_decisions (id, case_id, decision_type, summary_md, status, decided_at) values
  ('00000000-0000-0000-0000-00000e3a7021', '00000000-0000-0000-0000-00000e3a7002', 'ethics_ruling', 'x', 'issued', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000e3a7022', '00000000-0000-0000-0000-00000e3a7003', 'ethics_ruling', 'x', 'issued', now() - interval '1 days');
insert into public.ethics_decision_details (decision_id, case_id, sanction_type_id) values
  ('00000000-0000-0000-0000-00000e3a7021', '00000000-0000-0000-0000-00000e3a7002', '00000000-0000-0000-0000-00000e3a7011'),
  ('00000000-0000-0000-0000-00000e3a7022', '00000000-0000-0000-0000-00000e3a7003', '00000000-0000-0000-0000-00000e3a7012');

-- st_x = RESPONDENT on B.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-00000e3a7031', (select org_x from k), 'professional', 'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-00000e3a7032', (select org_x from k), (select st_x from k), 'Dr. Réu');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-00000e3a7031', '00000000-0000-0000-0000-00000e3a7032');
-- NOTE: the E1 respondent-exclusion (app.is_case_respondent) keys on r.key =
-- 'respondent_doctor' specifically — a custom key would NOT exclude, so with st_x also
-- granted read on B this row is what makes B respondent-excluded (not merely non-granted).
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-00000e3a7033', (select org_x from k), 'respondent_doctor', 'Médico denunciado', array['professional'], true);
insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-00000e3a7002', '00000000-0000-0000-0000-00000e3a7031', '00000000-0000-0000-0000-00000e3a7033', true);

-- Grants: st_x & st_x2 read B and C (NOT A). st_x2 RECUSED on C.
select test_helpers.grant_ca('00000000-0000-0000-0000-00000e3a7002', (select st_x from k),  'read', (select sa_x from k));
select test_helpers.grant_ca('00000000-0000-0000-0000-00000e3a7003', (select st_x from k),  'read', (select sa_x from k));
select test_helpers.grant_ca('00000000-0000-0000-0000-00000e3a7002', (select st_x2 from k), 'read', (select sa_x from k));
select test_helpers.grant_ca('00000000-0000-0000-0000-00000e3a7003', (select st_x2 from k), 'read', (select sa_x from k));
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ('00000000-0000-0000-0000-00000e3a7003', (select st_x2 from k), 'coordinator', 'conflito');

-- === totalCases per role (mirrors the dashboard's step-1 read) ===============
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k)), 3,
  'coordinator: totalCases = 3 (reads every ethics case)');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k)), 1,
  'respondent (st_x): totalCases = 1 (A non-granted, B respondent-excluded)');
select cmp_ok((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k)), '<', 3,
  'respondent: totalCases STRICTLY LOWER than the coordinator');
select is((select count(*)::int from public.ethics_case_details where case_id='00000000-0000-0000-0000-00000e3a7002'), 0,
  'respondent contributes ZERO for case B (respondent-exclusion beats the grant)');
select is((select count(*)::int from public.ethics_case_details where case_id='00000000-0000-0000-0000-00000e3a7001'), 0,
  'respondent contributes ZERO for case A (non-granted explicit_grants_only)');
select is((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k) and d.admissibility_status='pending'), 0,
  'respondent byAdmissibilityStatus.pending = 0 (the excluded pending case A never counts)');
select is((select count(*)::int from public.case_decisions cd join public.cases c on c.id=cd.case_id
             where c.commission_id=(select comm_x from k) and cd.status='issued'), 1,
  'respondent byCaseDecisionStatus.issued = 1 (only case C''s decision is readable)');
select is((select count(*)::int from public.ethics_decision_details dd join public.case_decisions cd on cd.id=dd.decision_id
             join public.cases c on c.id=cd.case_id
             where c.commission_id=(select comm_x from k) and cd.status='issued'
               and dd.sanction_type_id='00000000-0000-0000-0000-00000e3a7011'), 0,
  'respondent sanctionOutcomeCounts: case B''s sanction (S1) is ZERO (its decision is unreadable)');
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select cmp_ok((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k)), '<', 3,
  'recused (st_x2): totalCases STRICTLY LOWER than the coordinator');
select is((select count(*)::int from public.ethics_case_details where case_id='00000000-0000-0000-0000-00000e3a7003'), 0,
  'recused contributes ZERO for case C (live recusal denies read)');
reset role;

-- === foreign commission → empty ============================================
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k)), 0,
  'foreign-commission staff_admin: totalCases = 0 (commission boundary + RLS)');
reset role;

-- === coordinator aggregates (full picture) =================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k) and d.admissibility_status='admissible'), 2,
  'coordinator byAdmissibilityStatus.admissible = 2');
select is((select count(*)::int from public.case_decisions cd join public.cases c on c.id=cd.case_id
             where c.commission_id=(select comm_x from k) and cd.status='issued'), 2,
  'coordinator byCaseDecisionStatus.issued = 2');
reset role;

-- === MUTATION-PROOF: the unscoped (service-role-equivalent) path ============
-- Superuser bypasses RLS — the identical totalCases query returns 3. This is what a
-- service-role / unscoped read would yield for ANY viewer, so the respondent's scoped 1
-- would jump to 3 (== coordinator) and the strictly-lower keystones above would go RED.
reset role;
select is((select count(*)::int from public.ethics_case_details d join public.cases c on c.id=d.case_id
             where c.commission_id=(select comm_x from k)), 3,
  'MUTATION: an UNSCOPED read returns 3 (== coordinator, > respondent) — the RLS scoping is the load-bearing filter');

select * from finish();
rollback;
