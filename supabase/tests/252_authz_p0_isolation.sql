-- AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14) — FIX-C isolation keystones, Batch 3 (final).
--
-- Closes the remaining HIGH-RISK clinical / case-content write policies + a
-- representative read per predicate-group (ADR 0079 discipline). Same rules as
-- 250/251: non-vacuity (parent rows exist / seeded here), assert ROWS/RAISE under
-- `set local role`, reader-non-writer principal for every FOR-ALL/`*_write` policy so
-- the mutation reddens the WRITE gate (not the SELECT), DENY + POSITIVE twin, and
-- every keystone MUTATION-PROVEN by p0b-isolation-mutation-audit.sh.
--
-- WRITE keystones use INSERT: the reader-non-writer's INSERT fails the FOR-ALL
-- policy's WITH CHECK (42501); the authorized writer's INSERT lands. Opening the
-- policy reddens the DENY.
--
-- Principals: writer chefe.ccih (..02, rca member-lead / staff_admin), nspcoord.a
-- (..c1, pqs operator = capa writer), orgadmin.a (..b1, org_admin); reader-non-writer
-- staff2.ccih (..04, reads event/capa, cannot write) and staff1.ccih (..03, reads
-- case/interview, not staff_admin); foreign staff.qual.b (..b3, rede-B).
--
-- Predicate-group representation (lead-approved "one per group"): the rca_*_select
-- (can_read_event) and capa_*_select (can_read_capa) families are represented by
-- event_custody_select / capa_action_select; their siblings stay in
-- authz-blind-allowlist.txt with that rationale.

begin;
select plan(48);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into public.phase_results (id, commission_id, label, position) values
  ('ed100000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-0000000000a1','Resultado Teste',1);
insert into public.case_tags (id, commission_id, name) values
  ('ed200000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-0000000000a1','Tag Teste');
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start, status) values
  ('ed300000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-0000000000a1',9201,'MA held',now(),'held');
-- Fresh rca factor (no why-chain yet) so the why_chain POS insert is unique.
insert into public.rca_factors (id, rca_id, category, text, position) values
  ('ed400000-0000-0000-0000-000000000001','f3000000-0000-0000-0000-0000000000a3','people','wc-factor',97);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000b3'::uuid as foreign_uid,
  '00000000-0000-0000-0000-000000000002'::uuid as sa,          -- chefe.ccih
  '00000000-0000-0000-0000-000000000004'::uuid as reader_rc,   -- staff2.ccih (rca/capa reader)
  '00000000-0000-0000-0000-000000000003'::uuid as reader_case, -- staff1.ccih (case/interview reader; doc approver)
  '00000000-0000-0000-0000-0000000000c1'::uuid as capa_writer, -- nspcoord.a
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin;   -- orgadmin.a
grant select on k to authenticated;

-- ============================================================================
-- RCA family — FOR ALL `_write` gates on can_write_rca(rca_id). Writer = chefe.ccih
-- (rca member-lead); reader-non-writer = staff2.ccih (reads event, cannot write).
-- ============================================================================
select test_helpers.claims_for((select reader_rc from k), false); set local role authenticated;
select throws_ok($$ insert into public.rca_evidence(rca_id,kind,title,external_url) values('f3000000-0000-0000-0000-0000000000a3','link','t','https://x') $$,'42501',null,
  'rca_evidence_write DENY 42501: reader-non-writer cannot INSERT rca evidence');
select throws_ok($$ insert into public.rca_factors(rca_id,category,text,position) values('f3000000-0000-0000-0000-0000000000a3','process','t',99) $$,'42501',null,
  'rca_factors_write DENY 42501: reader-non-writer cannot INSERT an rca factor');
select throws_ok($$ insert into public.rca_members(rca_id,role,user_id) values('f3000000-0000-0000-0000-0000000000a3','observer','00000000-0000-0000-0000-000000000006') $$,'42501',null,
  'rca_members_write DENY 42501: reader-non-writer cannot INSERT an rca member');
select throws_ok($$ insert into public.rca_root_causes(rca_id,text,position) values('f3000000-0000-0000-0000-0000000000a3','t',99) $$,'42501',null,
  'rca_root_causes_write DENY 42501: reader-non-writer cannot INSERT a root cause');
select throws_ok($$ insert into public.rca_timeline_entries(rca_id,occurred_at,description,position) values('f3000000-0000-0000-0000-0000000000a3',now(),'t',99) $$,'42501',null,
  'rca_timeline_write DENY 42501: reader-non-writer cannot INSERT a timeline entry');
select throws_ok($$ insert into public.rca_why_chains(rca_id,factor_id) values('f3000000-0000-0000-0000-0000000000a3','fac00000-0000-0000-0000-0000000000a1') $$,'42501',null,
  'rca_why_chains_write DENY 42501: reader-non-writer cannot INSERT a why-chain');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok($$ insert into public.rca_evidence(rca_id,kind,title,external_url) values('f3000000-0000-0000-0000-0000000000a3','link','t','https://x') $$,
  'rca_evidence_write POS: rca member-lead CAN INSERT rca evidence');
select lives_ok($$ insert into public.rca_factors(rca_id,category,text,position) values('f3000000-0000-0000-0000-0000000000a3','process','t',98) $$,
  'rca_factors_write POS: rca member-lead CAN INSERT an rca factor');
select lives_ok($$ insert into public.rca_members(rca_id,role,user_id) values('f3000000-0000-0000-0000-0000000000a3','observer','00000000-0000-0000-0000-000000000006') $$,
  'rca_members_write POS: rca member-lead CAN INSERT an rca member');
select lives_ok($$ insert into public.rca_root_causes(rca_id,text,position) values('f3000000-0000-0000-0000-0000000000a3','t',98) $$,
  'rca_root_causes_write POS: rca member-lead CAN INSERT a root cause');
select lives_ok($$ insert into public.rca_timeline_entries(rca_id,occurred_at,description,position) values('f3000000-0000-0000-0000-0000000000a3',now(),'t',98) $$,
  'rca_timeline_write POS: rca member-lead CAN INSERT a timeline entry');
select lives_ok($$ insert into public.rca_why_chains(rca_id,factor_id) values('f3000000-0000-0000-0000-0000000000a3','ed400000-0000-0000-0000-000000000001') $$,
  'rca_why_chains_write POS: rca member-lead CAN INSERT a why-chain');
reset role;

-- ============================================================================
-- CAPA family — FOR ALL `_write` gates on can_write_capa(...). Writer = nspcoord.a
-- (pqs operator); reader-non-writer = staff2.ccih (reads capa, cannot write).
-- ============================================================================
select test_helpers.claims_for((select reader_rc from k), false); set local role authenticated;
select throws_ok($$ insert into public.capa_action(capa_id,title,position) values('ca000000-0000-0000-0000-0000000000a3','t',99) $$,'42501',null,
  'capa_action_write DENY 42501: reader-non-writer cannot INSERT a capa action');
select throws_ok($$ insert into public.capa_action_evidence(action_id,kind,title,external_url) values('caa00000-0000-0000-0000-0000000000a1','link','t','https://x') $$,'42501',null,
  'capa_action_evidence_write DENY 42501: reader-non-writer cannot INSERT capa action evidence');
select throws_ok($$ insert into public.capa_action_task(action_id,description,position) values('caa00000-0000-0000-0000-0000000000a1','t',99) $$,'42501',null,
  'capa_action_task_write DENY 42501: reader-non-writer cannot INSERT a capa action task');
select throws_ok($$ insert into public.capa_measure(capa_id,name,position) values('ca000000-0000-0000-0000-0000000000a3','m',99) $$,'42501',null,
  'capa_measure_write DENY 42501: reader-non-writer cannot INSERT a capa measure');
select throws_ok($$ insert into public.capa_measure_result(measure_id,period) values('cab00000-0000-0000-0000-0000000000a1','2026-07') $$,'42501',null,
  'capa_measure_result_write DENY 42501: reader-non-writer cannot INSERT a measure result');
select throws_ok($$ insert into public.capa_effectiveness(capa_id,verdict) values('ca000000-0000-0000-0000-0000000000a3','eficaz') $$,'42501',null,
  'capa_effectiveness_write DENY 42501: reader-non-writer cannot INSERT a capa effectiveness');
reset role;
select test_helpers.claims_for((select capa_writer from k), false); set local role authenticated;
select lives_ok($$ insert into public.capa_action(capa_id,title,position) values('ca000000-0000-0000-0000-0000000000a3','t',98) $$,
  'capa_action_write POS: pqs operator CAN INSERT a capa action');
select lives_ok($$ insert into public.capa_action_evidence(action_id,kind,title,external_url) values('caa00000-0000-0000-0000-0000000000a1','link','t','https://x') $$,
  'capa_action_evidence_write POS: pqs operator CAN INSERT capa action evidence');
select lives_ok($$ insert into public.capa_action_task(action_id,description,position) values('caa00000-0000-0000-0000-0000000000a1','t',98) $$,
  'capa_action_task_write POS: pqs operator CAN INSERT a capa action task');
select lives_ok($$ insert into public.capa_measure(capa_id,name,position) values('ca000000-0000-0000-0000-0000000000a3','m',98) $$,
  'capa_measure_write POS: pqs operator CAN INSERT a capa measure');
select lives_ok($$ insert into public.capa_measure_result(measure_id,period) values('cab00000-0000-0000-0000-0000000000a1','2026-08') $$,
  'capa_measure_result_write POS: pqs operator CAN INSERT a measure result');
select throws_ok($$ insert into public.capa_effectiveness(capa_id,verdict) values('ca000000-0000-0000-0000-0000000000a3','parcial') $$,'23505',null,
  'capa_effectiveness_write POS: pqs operator passes the policy (reaches the PK — one per capa, 23505 not 42501)');
reset role;

-- ============================================================================
-- CASE CONTENT writes.
--   case_participant_roles_admin_write  : is_admin OR is_org_admin_of(org).  ⚠ M1
--     history (org_admin re-key over direct DML) — a non-admin org member IS denied.
--   case_phase_allowed/offered_results, case_tag_assignments : staff_admin AND NOT
--     case-excluded.  interview_sessions : can_write_interview.
-- ============================================================================
-- case_participant_roles: DENY a non-admin (staff1.ccih); POS org_admin.
select test_helpers.claims_for((select reader_case from k), false); set local role authenticated;
select throws_ok($$ insert into public.case_participant_roles(organization_id,case_type_id,key,display_name,allowed_participant_types)
  values('0c000000-0000-0000-0000-00000000000a','ce000000-0000-0000-0000-0000000000e1','tk_deny','T','{}') $$,'42501',null,
  'case_participant_roles_admin_write DENY 42501: a non-admin org member cannot INSERT a participant role (M1)');
reset role;
select test_helpers.claims_for((select org_admin from k), false); set local role authenticated;
select lives_ok($$ insert into public.case_participant_roles(organization_id,case_type_id,key,display_name,allowed_participant_types)
  values('0c000000-0000-0000-0000-00000000000a','ce000000-0000-0000-0000-0000000000e1','tk_pos','T','{}') $$,
  'case_participant_roles_admin_write POS: org_admin CAN INSERT a participant role');
reset role;

-- case_phase_allowed_results / offered_results / case_tag_assignments: staff_admin writer.
select test_helpers.claims_for((select reader_case from k), false); set local role authenticated;
select throws_ok($$ insert into public.case_phase_allowed_results(case_phase_id,result_id,position)
  values('faf31839-06bf-4b90-86d2-ace11e8582d3','ed100000-0000-0000-0000-000000000001',99) $$,'42501',null,
  'case_phase_allowed_results_staff_admin_write DENY 42501: reader-non-writer cannot INSERT an allowed result');
select throws_ok($$ insert into public.case_phase_offered_results(case_id,result_id)
  values('d0000000-0000-0000-0000-0000000000c1','ed100000-0000-0000-0000-000000000001') $$,'42501',null,
  'case_phase_offered_results_staff_admin_write DENY 42501: reader-non-writer cannot INSERT an offered result');
select throws_ok($$ insert into public.case_tag_assignments(case_id,tag_id)
  values('d0000000-0000-0000-0000-0000000000c1','ed200000-0000-0000-0000-000000000001') $$,'42501',null,
  'case_tag_assignments_staff_admin_write DENY 42501: reader-non-writer cannot INSERT a tag assignment');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok($$ insert into public.case_phase_allowed_results(case_phase_id,result_id,position)
  values('faf31839-06bf-4b90-86d2-ace11e8582d3','ed100000-0000-0000-0000-000000000001',98) $$,
  'case_phase_allowed_results_staff_admin_write POS: staff_admin CAN INSERT an allowed result');
select lives_ok($$ insert into public.case_phase_offered_results(case_id,result_id)
  values('d0000000-0000-0000-0000-0000000000c1','ed100000-0000-0000-0000-000000000001') $$,
  'case_phase_offered_results_staff_admin_write POS: staff_admin CAN INSERT an offered result');
select lives_ok($$ insert into public.case_tag_assignments(case_id,tag_id)
  values('d0000000-0000-0000-0000-0000000000c1','ed200000-0000-0000-0000-000000000001') $$,
  'case_tag_assignments_staff_admin_write POS: staff_admin CAN INSERT a tag assignment');
reset role;

-- interview_sessions_write: can_write_interview. reader staff1.ccih; writer chefe.ccih.
select test_helpers.claims_for((select reader_case from k), false); set local role authenticated;
select throws_ok($$ insert into public.interview_sessions(interview_id,sequence_number,session_type)
  values('f2000000-0000-0000-0000-0000000000e1',99,'initial') $$,'42501',null,
  'interview_sessions_write DENY 42501: reader-non-writer cannot INSERT an interview session');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok($$ insert into public.interview_sessions(interview_id,sequence_number,session_type)
  values('f2000000-0000-0000-0000-0000000000e1',98,'initial') $$,
  'interview_sessions_write POS: staff_admin CAN INSERT an interview session');
reset role;

-- meeting_agenda_items_staff_admin_insert (completes the meeting family; MA is held).
select test_helpers.claims_for((select reader_case from k), false); set local role authenticated;
select throws_ok($$ insert into public.meeting_agenda_items(meeting_id,position,title)
  values('ed300000-0000-0000-0000-000000000001',99,'t') $$,'42501',null,
  'meeting_agenda_items_staff_admin_insert DENY 42501: non-staff_admin cannot INSERT an agenda item');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok($$ insert into public.meeting_agenda_items(meeting_id,position,title)
  values('ed300000-0000-0000-0000-000000000001',98,'t') $$,
  'meeting_agenda_items_staff_admin_insert POS: staff_admin CAN INSERT an agenda item');
reset role;

-- ============================================================================
-- READ reps — one per predicate group (foreign reads 0; authorized reads >=1).
-- ============================================================================
-- event_custody_select (can_read_event) — reps rca_*_select too.
select test_helpers.claims_for((select foreign_uid from k), false); set local role authenticated;
select is((select count(*)::int from public.event_custody where event_id='e1000000-0000-0000-0000-0000000000a1'),0,
  'event_custody_select DENY: foreign principal reads 0 event_custody rows');
reset role;
select test_helpers.claims_for((select reader_case from k), false); set local role authenticated;
select ok((select count(*)::int from public.event_custody where event_id='e1000000-0000-0000-0000-0000000000a1')>0,
  'event_custody_select POS: an event-commission member reads event_custody (can_read_event)');
reset role;
-- capa_action_select (can_read_capa) — reps capa_*_select too.
select test_helpers.claims_for((select foreign_uid from k), false); set local role authenticated;
select is((select count(*)::int from public.capa_action where id='caa00000-0000-0000-0000-0000000000a1'),0,
  'capa_action_select DENY: foreign principal reads 0 capa_action rows');
reset role;
select test_helpers.claims_for((select reader_rc from k), false); set local role authenticated;
select ok((select count(*)::int from public.capa_action where id='caa00000-0000-0000-0000-0000000000a1')>0,
  'capa_action_select POS: a capa reader reads capa_action (can_read_capa)');
reset role;
-- professional_profiles_select (can_read_professional_profile) — reps participants.
select test_helpers.claims_for((select foreign_uid from k), false); set local role authenticated;
select is((select count(*)::int from public.professional_profiles where id='fb000000-0000-0000-0000-0000000000e1'),0,
  'professional_profiles_select DENY: foreign principal reads 0 professional_profiles rows');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select ok((select count(*)::int from public.professional_profiles where id='fb000000-0000-0000-0000-0000000000e1')>0,
  'professional_profiles_select POS: a case-scoped reader reads the professional profile');
reset role;
-- interview_sessions_select (can_read_interview).
select test_helpers.claims_for((select foreign_uid from k), false); set local role authenticated;
select is((select count(*)::int from public.interview_sessions where interview_id='f2000000-0000-0000-0000-0000000000e1'),0,
  'interview_sessions_select DENY: foreign principal reads 0 interview_sessions rows');
reset role;
select test_helpers.claims_for((select reader_case from k), false); set local role authenticated;
select ok((select count(*)::int from public.interview_sessions where interview_id='f2000000-0000-0000-0000-0000000000e1')>0,
  'interview_sessions_select POS: an interview reader reads its sessions (can_read_interview)');
reset role;
-- case_participant_roles_select (is_org_member) — reader = org member (chefe.ccih).
select test_helpers.claims_for((select foreign_uid from k), false); set local role authenticated;
select is((select count(*)::int from public.case_participant_roles where organization_id='0c000000-0000-0000-0000-00000000000a'),0,
  'case_participant_roles_select DENY: a cross-org principal reads 0 participant-role rows');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select ok((select count(*)::int from public.case_participant_roles where organization_id='0c000000-0000-0000-0000-00000000000a')>0,
  'case_participant_roles_select POS: an org member reads the org participant roles (is_org_member)');
reset role;
-- document_approvals_select (approver_id OR can_read_document_of_version).
select test_helpers.claims_for((select foreign_uid from k), false); set local role authenticated;
select is((select count(*)::int from public.document_approvals where id='0a218158-827a-4a6e-b697-e97ca107722e'),0,
  'document_approvals_select DENY: foreign principal reads 0 document_approvals rows');
reset role;
select test_helpers.claims_for((select reader_case from k), false); set local role authenticated;
select ok((select count(*)::int from public.document_approvals where id='0a218158-827a-4a6e-b697-e97ca107722e')>0,
  'document_approvals_select POS: the approver reads their document approval');
reset role;

select * from finish();
rollback;
