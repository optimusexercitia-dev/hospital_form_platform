-- =============================================================================
-- ETH·E2 (ADR 0073 D5/D8/D-appeals) — BE-4 gate: notifications/hearings/appeals RLS +
--   the participants_only hearing door (D14→Stage C isolation).
--
-- ⭐ THE ISOLATION KEYSTONE: schedule_ethics_hearing builds the hearing as a
-- participants_only meeting rostered to app.eligible_voters (members − recused −
-- respondent). Stage C's can_reach_meeting (member AND on-roster) then denies a
-- NON-ATTENDEE — the recused member, the respondent, and a foreign non-member each read
-- NOTHING of the meeting row / attendees. The companion mutation audit
-- (be4-hearing-roster-mutation-audit.sh) widens the roster (neutralizes the recusal /
-- respondent exclusion in eligible_voters) and REQUIRES the matching "reads 0" keystone
-- to go RED — i.e. an excluded member becomes rostered and reaches the hearing.
--
-- NOTE (lead-flagged, non-blocking): for explicit_grants_only cases eligible_voters =
-- ALL members − recused − respondent (ADR 0073 D4 + 0078 O9 "surfaces to the plenary"),
-- so a plain (non-recused, non-respondent) member IS rostered and CAN read the hearing —
-- that is CORRECT under the current spec; a future sub-group scoping is a one-function
-- change. This suite asserts isolation only for the three genuine non-attendees.
--
-- Fresh reset. Setup as superuser; the door + reads asserted per persona.
-- =============================================================================

begin;
select plan(21);

update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail', 'meetings');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture (superuser): an ethics case + a non-ethics case; the respondent (st_x) and a
-- recused member (st_x2) — both comm_x members, both excluded from the eligible panel.
-- ---------------------------------------------------------------------------
reset role;

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values
  ('00000000-0000-0000-0000-0000000e2001', (select comm_x from k), 92301, (select sa_x from k),
   'explicit_grants_only', 'ethics_investigation'),
  ('00000000-0000-0000-0000-0000000e2002', (select comm_x from k), 92302, (select sa_x from k),
   'commission_default', 'non_phi_internal');
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-0000000e2001');

-- Respondent st_x (respondent_doctor → excluded from eligible_voters).
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000e2103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000e2101', (select org_x from k), 'professional', 'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name, link_state)
values ('00000000-0000-0000-0000-0000000e2102', (select org_x from k), (select st_x from k), 'Dr. Réu', 'linked');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000e2101', '00000000-0000-0000-0000-0000000e2102');
insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2101',
        '00000000-0000-0000-0000-0000000e2103', true);

-- Recuse st_x2 (→ excluded from eligible_voters).
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ('00000000-0000-0000-0000-0000000e2001', (select st_x2 from k), 'coordinator', 'conflito');

-- A decision (for the appeal FK) + a notification + an appeal (for the table boundary).
insert into public.case_decisions (id, case_id, decision_type, summary_md, status)
values ('00000000-0000-0000-0000-0000000e2050', '00000000-0000-0000-0000-0000000e2001', 'ethics_ruling', 'x', 'issued');
insert into public.ethics_notifications (id, case_id, notification_type, delivery_method, due_at)
values ('00000000-0000-0000-0000-0000000e2400', '00000000-0000-0000-0000-0000000e2001',
        'respondent_notification', 'letter', now() + interval '15 days');
insert into public.ethics_appeals (id, case_id, decision_id, appeal_reason_md)
values ('00000000-0000-0000-0000-0000000e2500', '00000000-0000-0000-0000-0000000e2001',
        '00000000-0000-0000-0000-0000000e2050', 'Discordo da decisão.');

-- ===========================================================================
-- Block A — table SELECT boundary (coordinator POS / foreign NEG).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_notifications where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_notifications: the coordinator reads the notice');
select is((select count(*)::int from public.ethics_appeals where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_appeals: the coordinator reads the appeal');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_notifications where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_notifications: a foreign-commission user reads ZERO');
select is((select count(*)::int from public.ethics_appeals where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_appeals: a foreign-commission user reads ZERO');
reset role;

-- ===========================================================================
-- Block B — schedule_ethics_hearing: the participants_only door.
-- ===========================================================================
-- Authority + validation NEGs first.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.schedule_ethics_hearing('00000000-0000-0000-0000-0000000e2001', 'initial_hearing') $$,
  'HC0J1', null,
  'schedule_ethics_hearing: a non-coordinator is refused with HC0J1');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.schedule_ethics_hearing('00000000-0000-0000-0000-0000000e2002', 'initial_hearing') $$,
  'HC0J0', null,
  'schedule_ethics_hearing: a non-ethics case is refused with HC0J0');
select throws_ok(
  $$ select public.schedule_ethics_hearing('00000000-0000-0000-0000-0000000e2001', 'bogus_type') $$,
  '23514', null,
  'schedule_ethics_hearing: an invalid hearing_type is rejected (check)');
-- The happy path: the coordinator schedules a hearing.
create temp table h on commit drop as
  select public.schedule_ethics_hearing('00000000-0000-0000-0000-0000000e2001', 'initial_hearing') as hid;
reset role;
grant select on h to authenticated;

create temp table hm on commit drop as
  select (select meeting_id from public.ethics_hearings where id = (select hid from h)) as mid;
grant select on hm to authenticated;

select ok((select hid from h) is not null, 'schedule_ethics_hearing: returns a hearing id');
select is((select visibility_policy from public.meetings where id = (select mid from hm)), 'participants_only',
  'schedule_ethics_hearing: the hearing meeting is participants_only');
select is((select count(*)::int from public.ethics_hearings where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'schedule_ethics_hearing: the ethics_hearings row exists');

-- Roster = eligible_voters: the coordinator is on it; the respondent + recused are NOT.
select is((select count(*)::int from public.meeting_attendees
           where meeting_id = (select mid from hm) and user_id = (select sa_x from k)), 1,
  'roster: the coordinator (eligible) is on the hearing roster');
select is((select count(*)::int from public.meeting_attendees
           where meeting_id = (select mid from hm) and user_id = (select st_x from k)), 0,
  'roster: the respondent is NOT on the hearing roster');
select is((select count(*)::int from public.meeting_attendees
           where meeting_id = (select mid from hm) and user_id = (select st_x2 from k)), 0,
  'roster: the recused member is NOT on the hearing roster');

-- ethics_hearings table boundary: a foreign user reads ZERO.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_hearings where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_hearings: a foreign-commission user reads ZERO');
reset role;

-- ===========================================================================
-- Block C — Stage C isolation: a NON-ATTENDEE reads NOTHING of the hearing meeting.
-- ===========================================================================
-- POS: the rostered coordinator reads the meeting + attendees.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id = (select mid from hm)), 1,
  'isolation POS: a rostered eligible member reads the hearing meeting');
select ok((select count(*)::int from public.meeting_attendees where meeting_id = (select mid from hm)) >= 1,
  'isolation POS: a rostered member reads the hearing attendee roster');
reset role;

-- ⭐ NEG (mutation keystones): the respondent + recused (both members, NOT rostered) read
-- ZERO of the hearing meeting; a foreign non-member too.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id = (select mid from hm)), 0,
  'isolation: the respondent reads ZERO of the hearing meeting (non-attendee)');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id = (select mid from hm)), 0,
  'isolation: the recused member reads ZERO of the hearing meeting (non-attendee)');
select is((select count(*)::int from public.meeting_attendees where meeting_id = (select mid from hm)), 0,
  'isolation: the recused member reads ZERO of the hearing attendees');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id = (select mid from hm)), 0,
  'isolation: a foreign non-member reads ZERO of the hearing meeting');
reset role;

-- ===========================================================================
-- Block D — flag-OFF: the door raises HC000.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'ethics';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.schedule_ethics_hearing('00000000-0000-0000-0000-0000000e2001', 'initial_hearing') $$,
  'HC000', null,
  'flag-OFF: schedule_ethics_hearing raises HC000 when the ethics flag is off');
reset role;

select * from finish();
rollback;
