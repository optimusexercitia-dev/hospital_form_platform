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
select plan(32);

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

-- =========================================================================
-- §KC2 — C2-TIER1 BLIND command-door keystones (batch B, 2026-09-04).
--
-- ⭐ CATALOG READ, 2026-09-04 (specs §3.1 / §6.4 CONTRADICTION-1 RESOLVED, and
-- resolved AGAINST the spec's "most likely resolution"): public.create_case_decision
-- DOES delegate to app.assert_ethics_typed — its body's line 3, before its own
-- checks. So :92's arm genuinely enters the delegate. What it CANNOT do is measure
-- it: create_case_decision raises HC0J0 INLINE two lines later ("a decisão exige um
-- caso admissível") on this very fixture, and :92 passes `null` for the message.
-- Neutralize the delegate and the inline raise satisfies the arm with the SAME
-- CODE — which is exactly why app.assert_ethics_typed came back BLIND with a live
-- pin apparently on it.
-- ⚠ MEASURED 2026-09-04, and it corrects the obvious reading of specs §3.3: the
-- MESSAGE ALONE does not give this arm a subject either. 18 public/app functions
-- raise HC0J0 and FIVE carry this exact string (app.assert_ethics_typed,
-- cast_case_vote, schedule_ethics_hearing, submit_targeted_case_response,
-- target_case_response). What makes the arm attributable is the message PLUS the
-- CALL: create_case_decision's closure is assert_ethics_enabled →
-- assert_ethics_coordinator → assert_ethics_typed, and none of the other four
-- string-carriers is in it, so on THIS call the delegate is the only thing that can
-- raise it. The sweep is the independent check — mutating app.assert_ethics_typed
-- alone turns the suite red.
-- ⛔ The two sibling pins named alongside :92 —
-- 256:118 (schedule_ethics_hearing) and 255:137 (target_case_response) — are on
-- doors that DO NOT call assert_ethics_typed at all: they raise HC0J0 inline. That
-- part of the record was wrong about its subject.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_case_decision('00000000-0000-0000-0000-0000000e2002', 'x', 'y') $$,
  'HC0J0', 'ação inválida para o status atual do processo ético',
  '⭐⭐ KEYSTONE [PROPERTY: validation — NOT authorization]: app.assert_ethics_typed refuses a case with NO ethics_case_details row — the guard checks ROW EXISTENCE (its message''s "status" wording is itself a text-is-not-truth instance; the label follows the GUARD, not the string). ADR 0187 D2 (PO ruling 2026-09-04, class B provisionally): this COVERED is VALIDATION coverage; the ethics lane''s AUTHORIZATION is app.assert_ethics_coordinator (HC0J1), a separate worklist row pinned at :56. Same call and code as :92 — the MESSAGE is the whole difference. C2 BLIND 2026-09-02');
-- A second decision, left in `draft` (create_case_decision's default status), so the
-- appeal door's LIFECYCLE branch is reachable — `de` is issued then appealed and
-- never leaves the allowed set inside this file.
create temp table de2 on commit drop as select public.create_case_decision(
  '00000000-0000-0000-0000-0000000e2001', 'ethics_ruling', 'Sumário 2', 'Motivo 2') as did;
reset role;
grant select on de2 to authenticated;
select is((select status from public.case_decisions where id = (select did from de2)), 'draft',
  '§KC2 fixture: the second decision is in draft — outside submit_ethics_appeal''s (issued, appealed) set');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.submit_ethics_appeal('00000000-0000-0000-0000-0000000e2001', %L, 'Recurso') $$,
         (select did from de2)),
  'HC0J0', 'apenas decisões emitidas podem ser objeto de recurso',
  '⭐⭐ KEYSTONE [PROPERTY: lifecycle — NOT authorization]: submit_ethics_appeal refuses a decision outside (issued, appealed) with HC0J0 — the door''s OWN raise. ADR 0187 D2 (PO ruling 2026-09-04, class B provisionally): LIFECYCLE coverage; the door''s AUTHORIZATION is app.assert_ethics_coordinator (HC0J1), a delegate and a separate worklist row. All seven pre-existing HC0J0 pins in the suite are on OTHER doors and every one passes a null message. C2 BLIND 2026-09-02');
select throws_ok(
  format($$ select public.submit_ethics_appeal('00000000-0000-0000-0000-0000000e2001', %L, 'Recurso') $$,
         gen_random_uuid()),
  'HC0J0', 'decisão inválida para este caso',
  '⭐⭐ KEYSTONE [PROPERTY: validation — NOT authorization]: submit_ethics_appeal refuses a decision that does not belong to this case with HC0J0 — the door''s SECOND anchored raise, a cross-case object reference with NO caller input (specs §1.2(2), the door''s other B-class arm). Pinned alongside the lifecycle arm above so the verdict cannot survive on a technicality in either branch. C2 BLIND 2026-09-02');
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
