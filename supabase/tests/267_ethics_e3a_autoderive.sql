-- =============================================================================
-- ETH·E3a BE-5 — O-3 auto-derive: each of the 8 ethics procedure RPCs ALSO emits ONE
-- case_events row of the correct kind + visibility, with a PHI-free pt-BR body, in the
-- SAME transaction as the milestone (a failed/unauthorized RPC emits none).
--
-- The two coordinator_only kinds (finding_recorded, vote_cast) are invisible to an
-- ordinary can_read_case-true non-coordinator, and none are visible to a recused reader
-- (can_read_case floor). The coordinator_only keystones are MUTATION-PROVEN non-vacuous:
-- flipping the emitted row to case_readers makes the ordinary reader see it (the "can't
-- see" assertion would go RED), flipping back re-hides it.
--
-- Every free-text arg is fed the token 'SEGREDOXYZ'; no emitted body may contain it.
-- Fresh reset (pgtap-needs-fresh-reset). Fixture rows inserted as superuser; RPCs called
-- under sa_x's claims + role.
-- =============================================================================

begin;
select plan(20);

update app.feature_flags set enabled = true
  where key in ('ethics', 'audit_trail', 'cases_multi_phase', 'processless_cases', 'case_types');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- --- Fixture (superuser) ----------------------------------------------------
reset role;
-- The ethics case (explicit_grants_only) + its ethics_case_details marker.
insert into public.cases
  (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values ('00000000-0000-0000-0000-00000e3a5001', (select comm_x from k), 95001, (select sa_x from k),
        'explicit_grants_only', 'ethics_investigation');
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-00000e3a5001');
-- Allegation category (org_x), a hearing meeting type, and a quorum of 1 (so ONE vote issues).
insert into public.ethics_allegation_categories (id, organization_id, key, display_name, is_active)
values ('00000000-0000-0000-0000-00000e3a5002', (select org_x from k), 'conduta', 'Conduta profissional', true)
on conflict do nothing;
insert into public.commission_meeting_types (commission_id, name, position)
values ((select comm_x from k), 'Audiência', 1)
on conflict do nothing;
insert into public.commission_meeting_settings (commission_id, quorum_rule_type, quorum_value)
values ((select comm_x from k), 'fixed_count', 1)
on conflict (commission_id) do update set quorum_rule_type = 'fixed_count', quorum_value = 1;
-- st_x2 is an ordinary case grantee (can_read_case true, non-coordinator).
select test_helpers.grant_ca('00000000-0000-0000-0000-00000e3a5001', (select st_x2 from k), 'read', (select sa_x from k));

-- --- Happy path: call all 8 RPCs as the coordinator (sa_x) -------------------
-- claims_for sets auth.uid(); the DEFINER RPCs authorize on it. Free-text args carry
-- the SEGREDOXYZ token to prove it never reaches a body.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.decide_admissibility('00000000-0000-0000-0000-00000e3a5001', 'admissible', 'SEGREDOXYZ');
select public.add_ethics_allegation('00000000-0000-0000-0000-00000e3a5001',
       '00000000-0000-0000-0000-00000e3a5002', 'SEGREDOXYZ');
select public.record_ethics_finding(
       (select id from public.ethics_allegations where case_id = '00000000-0000-0000-0000-00000e3a5001' limit 1),
       'substantiated', 'SEGREDOXYZ', 'SEGREDOXYZ');
select public.issue_ethics_notification('00000000-0000-0000-0000-00000e3a5001', 'hearing_notice', 'email',
       null, null, null, null, 'SEGREDOXYZ');
select public.schedule_ethics_hearing('00000000-0000-0000-0000-00000e3a5001', 'initial_hearing');
select public.create_case_decision('00000000-0000-0000-0000-00000e3a5001', 'ethics_ruling', 'SEGREDOXYZ');
select public.cast_case_vote(
       (select id from public.case_decisions where case_id = '00000000-0000-0000-0000-00000e3a5001' limit 1),
       'approve', 'SEGREDOXYZ');
select public.issue_decision(
       (select id from public.case_decisions where case_id = '00000000-0000-0000-0000-00000e3a5001' limit 1));
select public.submit_ethics_appeal('00000000-0000-0000-0000-00000e3a5001',
       (select id from public.case_decisions where case_id = '00000000-0000-0000-0000-00000e3a5001' limit 1),
       'SEGREDOXYZ');
reset role;

-- --- Per-RPC emit: exactly one event of the right kind + visibility ----------
-- (is() over a scalar subquery fails unless exactly one row exists.)
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='admissibility_decided'),
  'case_readers', 'decide_admissibility emits one admissibility_decided (case_readers)');
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='allegation_added'),
  'case_readers', 'add_ethics_allegation emits one allegation_added (case_readers)');
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='finding_recorded'),
  'coordinator_only', 'record_ethics_finding emits one finding_recorded (coordinator_only)');
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='notification_issued'),
  'case_readers', 'issue_ethics_notification emits one notification_issued (case_readers)');
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='hearing_scheduled'),
  'case_readers', 'schedule_ethics_hearing emits one hearing_scheduled (case_readers)');
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='vote_cast'),
  'coordinator_only', 'cast_case_vote emits one vote_cast (coordinator_only)');
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='decision_issued'),
  'case_readers', 'issue_decision emits one decision_issued (case_readers)');
select is((select visibility from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='appeal_submitted'),
  'case_readers', 'submit_ethics_appeal emits one appeal_submitted (case_readers)');

-- --- Totals + PHI-free + catalog-label body ---------------------------------
select is((select count(*)::int from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001'),
  8, 'exactly 8 auto-derived events — one per RPC, no duplicates');
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and body like '%SEGREDOXYZ%'),
  0, 'NO emitted body contains the free-text token (PHI-free / no rationale/finding/vote/notes)');
select ok((select body from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='allegation_added')
            like '%Conduta profissional%',
  'allegation_added body carries the catalog display_name (pt-BR controlled value)');

-- --- Visibility floor: ordinary granted non-coordinator reader (st_x2) -------
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and visibility='case_readers'),
  6, 'ordinary reader sees the 6 case_readers events');
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and kind in ('finding_recorded','vote_cast')),
  0, 'ordinary reader sees NEITHER coordinator_only auto-derived event');
reset role;

-- --- Transactionality: an unauthorized RPC emits ZERO events -----------------
select test_helpers.claims_for((select st_x from k), false);   -- st_x = plain member, NOT coordinator
set local role authenticated;
select throws_ok(
  $$ select public.decide_admissibility('00000000-0000-0000-0000-00000e3a5001', 'inadmissible', 'x') $$,
  'HC0J1', null,
  'a non-coordinator decide_admissibility is refused (HC0J1)');
reset role;
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='admissibility_decided'),
  1, 'transactionality: the refused RPC emitted NO extra event (still exactly 1)');

-- --- Mutation-proof the two coordinator_only keystones -----------------------
-- vote_cast: flip to case_readers → the ordinary reader NOW sees it (keystone non-vacuous).
update public.case_events set visibility='case_readers'
  where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='vote_cast';
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='vote_cast'),
  1, 'MUTATION vote_cast: flipped to case_readers, the ordinary reader now sees it (keystone non-vacuous)');
reset role;
update public.case_events set visibility='coordinator_only'
  where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='vote_cast';
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='vote_cast'),
  0, 'MUTATION vote_cast: reverted to coordinator_only, the ordinary reader can no longer see it');
reset role;

-- finding_recorded: same mutation proof.
update public.case_events set visibility='case_readers'
  where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='finding_recorded';
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='finding_recorded'),
  1, 'MUTATION finding_recorded: flipped to case_readers, the ordinary reader now sees it (keystone non-vacuous)');
reset role;
update public.case_events set visibility='coordinator_only'
  where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='finding_recorded';
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_events
             where case_id='00000000-0000-0000-0000-00000e3a5001' and kind='finding_recorded'),
  0, 'MUTATION finding_recorded: reverted to coordinator_only, the ordinary reader can no longer see it');
reset role;

-- --- Recusal is the floor: a recused reader sees NONE of the events ----------
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ('00000000-0000-0000-0000-00000e3a5001', (select st_x2 from k), 'coordinator', 'conflito');
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_events where case_id='00000000-0000-0000-0000-00000e3a5001'),
  0, 'a recused reader sees NONE of the auto-derived events (can_read_case floor)');
reset role;

select * from finish();
rollback;
