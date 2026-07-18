-- =============================================================================
-- ETH·E2 (ADR 0073 D1-D10) — BE-6 gate: the HC0J DEFINER RPC lifecycle.
--
-- Happy path (admissibility → allegation/finding → decision → vote → issue → pin →
-- notification → hearing complete → appeal) + authority-first HC0J1 + the HC0J code
-- family (HC0J0/HC0J2/HC0J3/HC0J6/HC0J8) + t19 grants + flag-OFF. Fresh reset.
--
-- The companion mutation audit (be6-rpc-authority-mutation-audit.sh) proves the
-- authority-first keystone (a non-coordinator is refused) goes RED when the HC0J1 gate
-- is neutralized.
-- =============================================================================

begin;
select plan(28);

update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail', 'meetings', 'case_participants');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin, (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'sa_y')::uuid as sa_y, (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- An ethics case (marked) + a NON-ethics case; a category; a member to vote (st_x2).
reset role;
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values ('00000000-0000-0000-0000-0000000e2001', (select comm_x from k), 92501, (select sa_x from k),
        'explicit_grants_only', 'ethics_investigation'),
       ('00000000-0000-0000-0000-0000000e2002', (select comm_x from k), 92502, (select sa_x from k),
        'commission_default', 'non_phi_internal');
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-0000000e2001');
insert into public.ethics_allegation_categories (id, organization_id, key, display_name)
values ('00000000-0000-0000-0000-0000000e2010', (select org_x from k), 'professional_misconduct', 'Conduta');

-- ========================= D1 admissibility =========================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.upsert_ethics_case_details('00000000-0000-0000-0000-0000000e2001', 'internal', now(), 'Resumo') $$,
  'upsert_ethics_case_details: coordinator upserts intake');
select lives_ok(
  $$ select public.decide_admissibility('00000000-0000-0000-0000-0000000e2001', 'admissible', 'ok') $$,
  'decide_admissibility: coordinator marks admissible');
select throws_ok(
  $$ select public.decide_admissibility('00000000-0000-0000-0000-0000000e2001', 'bogus', 'x') $$,
  'HC0J0', null, 'decide_admissibility: an invalid status raises HC0J0');
reset role;
-- authority: a non-coordinator (st_x2) is refused HC0J1 (⭐ mutation keystone).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.decide_admissibility('00000000-0000-0000-0000-0000000e2001', 'admissible', 'x') $$,
  'HC0J1', null, 'authority: a non-coordinator is refused with HC0J1');
reset role;

-- ========================= D2 allegations / findings =========================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table al on commit drop as select public.add_ethics_allegation(
  '00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2010', 'Descrição', 'high') as aid;
reset role; grant select on al to authenticated;
select ok((select aid from al) is not null, 'add_ethics_allegation: coordinator adds an allegation');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_ethics_allegation('00000000-0000-0000-0000-0000000e2001', %L, 'x') $$, gen_random_uuid()),
  'HC0J2', null, 'add_ethics_allegation: an invalid category raises HC0J2');
select lives_ok(
  format($$ select public.record_ethics_finding(%L, 'substantiated', 'r') $$, (select aid from al)),
  'record_ethics_finding: coordinator records a finding');
select throws_ok(
  format($$ select public.record_ethics_finding(%L, 'dismissed', 'r2') $$, (select aid from al)),
  'HC0J3', null, 'record_ethics_finding: a second finding on the same allegation raises HC0J3');
select lives_ok(
  format($$ select public.update_ethics_allegation(%L, null, null, null, null, 'substantiated') $$, (select aid from al)),
  'update_ethics_allegation: coordinator updates status');
reset role;

-- ========================= D3 decision → vote → issue (+ pin, quorum) =========================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table de on commit drop as select public.create_case_decision(
  '00000000-0000-0000-0000-0000000e2001', 'ethics_ruling', 'Sumário', 'Motivo') as did;
reset role; grant select on de to authenticated;
select ok((select did from de) is not null, 'create_case_decision: coordinator opens a decision');
-- create_case_decision on a NON-ethics case → HC0J0 (assert_ethics_typed).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_case_decision('00000000-0000-0000-0000-0000000e2002', 'x', 'y') $$,
  'HC0J0', null, 'create_case_decision: a non-ethics case raises HC0J0');
select lives_ok(
  format($$ select public.set_ethics_decision_details(%L, null, null, null, true, 'treinar', true, 'cfm', now()+interval '30 days', true, now()+interval '15 days') $$, (select did from de)),
  'set_ethics_decision_details: coordinator sets sanction/remediation/reporting');
-- issue WITHOUT quorum → HC0J8 (no votes cast; eligible >= 1 so required >= 1).
select throws_ok(
  format($$ select public.issue_decision(%L) $$, (select did from de)),
  'HC0J8', null, 'issue_decision: no quorum of votes raises HC0J8');
reset role;
-- Cast enough votes to meet quorum (sa_x + st_x + st_x2 are eligible members; cast all).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(format($$ select public.cast_case_vote(%L, 'approve') $$, (select did from de)),
  'cast_case_vote: coordinator votes (BE-3)');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(format($$ select public.cast_case_vote(%L, 'approve') $$, (select did from de)),
  'cast_case_vote: a member votes');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok(format($$ select public.cast_case_vote(%L, 'reject') $$, (select did from de)),
  'cast_case_vote: another member votes');
reset role;
-- Now quorum is met → issue succeeds.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(format($$ select public.issue_decision(%L) $$, (select did from de)),
  'issue_decision: with quorum, the decision is issued');
reset role;
select is((select status from public.case_decisions where id = (select did from de)), 'issued',
  'issue_decision: the decision status is issued');

-- ========================= D5 notifications =========================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table no on commit drop as select public.issue_ethics_notification(
  '00000000-0000-0000-0000-0000000e2001', 'respondent_notification', 'letter', null, null, now()+interval '15 days') as nid;
reset role; grant select on no to authenticated;
select ok((select nid from no) is not null, 'issue_ethics_notification: coordinator issues a notice');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(format($$ select public.acknowledge_ethics_notification(%L) $$, (select nid from no)),
  'acknowledge_ethics_notification: coordinator acknowledges');
select throws_ok(format($$ select public.acknowledge_ethics_notification(%L) $$, (select nid from no)),
  'HC0J6', null, 'acknowledge_ethics_notification: a second ack raises HC0J6');
reset role;

-- ========================= D8 hearing complete (schedule = BE-4) =========================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table he on commit drop as select public.schedule_ethics_hearing(
  '00000000-0000-0000-0000-0000000e2001', 'initial_hearing') as hid;
reset role; grant select on he to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(format($$ select public.complete_ethics_hearing(%L, 'resumo', 'desfecho', true, false, true) $$, (select hid from he)),
  'complete_ethics_hearing: coordinator records the outcome');
reset role;

-- ========================= D-appeals =========================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ap on commit drop as select public.submit_ethics_appeal(
  '00000000-0000-0000-0000-0000000e2001', (select did from de), 'Discordo') as apid;
reset role; grant select on ap to authenticated;
select ok((select apid from ap) is not null, 'submit_ethics_appeal: an appeal is submitted');
select is((select status from public.case_decisions where id = (select did from de)), 'appealed',
  'submit_ethics_appeal: the decision status flips to appealed');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(format($$ select public.review_ethics_appeal(%L, 'rejected', 'mantida', 'sem fundamento') $$, (select apid from ap)),
  'review_ethics_appeal: coordinator reviews the appeal');
reset role;

-- ========================= t19 grants + flag-OFF =========================
select is(has_function_privilege('anon', 'public.issue_decision(uuid)', 'EXECUTE'), false,
  't19: anon cannot EXECUTE issue_decision');
select is(has_function_privilege('authenticated', 'public.issue_decision(uuid)', 'EXECUTE'), true,
  't19: authenticated can EXECUTE issue_decision');

update app.feature_flags set enabled = false where key = 'ethics';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.decide_admissibility('00000000-0000-0000-0000-0000000e2001', 'admissible', 'x') $$,
  'HC000', null, 'flag-OFF: an ethics RPC raises HC000 when the flag is off');
reset role;

select * from finish();
rollback;
