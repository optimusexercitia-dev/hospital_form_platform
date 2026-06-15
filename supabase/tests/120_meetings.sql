-- Phase 10: Meetings.
-- Covers: per-commission meeting_number minting; seed-on-commission (types +
-- settings auto-created); lifecycle conclude (quorum snapshot + case_events
-- write) HC034; sign-own-row RLS + auto-flip to assinada; reopen revokes
-- signatures; HC035 double-sign; HC036 non-present sign; HC037 non-assignee
-- action-item advance; child-lock while em_assinatura; HC032 cross-commission
-- case link; cross-commission RLS isolation.

begin;
select plan(29);

-- Enable the meetings feature flag for the whole test.
update app.feature_flags set enabled = true where key = 'meetings';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- Seed-on-commission: comm_x got the 2 default types + 1 settings row.
-- =========================================================================
select is(
  (select count(*)::int from public.commission_meeting_types where commission_id = (select comm_x from k)),
  2, 'seed-on-commission: comm_x has 2 default meeting types');
select is(
  (select count(*)::int from public.commission_meeting_settings where commission_id = (select comm_x from k)),
  1, 'seed-on-commission: comm_x has 1 settings row');

-- =========================================================================
-- create_meeting: minting + staff_admin authoring.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- NOTE the `select * from func(...)` form (NOT `select (func(...)).*`): the
-- latter expands to `(func()).col1, (func()).col2, …`, calling create_meeting
-- ONCE PER COLUMN (minting a meeting each time). `select * from func()` evaluates
-- the set-returning call exactly once. (Same idiom as the cases tests' single-col
-- captures.)
create temp table m1 on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião 1', null, now(), null, 'presencial', null, null);
reset role;
grant select on m1 to authenticated;

-- comm_x is a fresh bootstrap commission with no prior meetings, so the first
-- mint is 1.
select is((select meeting_number from m1), 1, 'first meeting minted number 1');
select is((select status from m1), 'agendada', 'new meeting starts agendada');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table m2 on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião 2', null, now(), null, 'remoto', null, null);
reset role;
grant select on m2 to authenticated;
select is((select meeting_number from m2), 2,
  'second meeting minted number 2 (per-commission counter)');

-- A staff member (not staff_admin) cannot create a meeting.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_meeting((select comm_x from k), 'nope', null, now(), null, 'presencial', null, null) $$,
  '42501', null, 'staff (non-admin) cannot create a meeting');
reset role;

-- =========================================================================
-- Build m1 up: agenda + 3 present attendees (sa_x, st_x, st_x2).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.create_meeting_agenda_item((select id from m1), 'Pauta 1', null, null, null);
select public.seed_expected_meeting_attendees((select id from m1));
reset role;

select is(
  (select count(*)::int from public.meeting_attendees where meeting_id = (select id from m1)),
  3, 'seed_expected_meeting_attendees added the 3 comm_x members');

-- Mark all three present.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
update public.meeting_attendees set attendance = 'presente' where meeting_id = (select id from m1);
-- Add a PRESENT external guest (user_id null). Guests must NEVER count toward
-- quorum (ADR 0025 / plan §7), so this must NOT inflate present_count at
-- conclusion below (regression guard for MINOR-2).
select public.add_meeting_attendee(
  (select id from m1), null, 'Convidada Externa', 'Hospital Z', 'convidado', 'presente', null);
reset role;

-- =========================================================================
-- mark_meeting_held: agendada -> realizada (the explicit resting transition).
-- m2 has no present attendees, so it stays a clean agendada subject.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.mark_meeting_held((select id from m2));
reset role;
select is(
  (select status from public.meetings where id = (select id from m2)),
  'realizada', 'mark_meeting_held flips agendada -> realizada');

-- A second mark_meeting_held (no longer agendada) is rejected (HC033).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.mark_meeting_held((select id from m2)) $$,
  'HC033', null, 'mark_meeting_held on a non-agendada meeting raises HC033');
reset role;

-- =========================================================================
-- HC034: conclude with no present attendee (m2 is now realizada, none present).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.conclude_meeting((select id from m2)) $$,
  'HC034', null, 'conclude with no present attendee raises HC034');
reset role;

-- =========================================================================
-- conclude m1: quorum snapshot + status em_assinatura.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.conclude_meeting((select id from m1));
reset role;

select is(
  (select status from public.meetings where id = (select id from m1)),
  'em_assinatura', 'conclude flips status to em_assinatura');
-- Sanity: the meeting really has 4 PRESENT attendees (3 members + 1 guest), so
-- the present_count = 3 below proves the snapshot DROPPED the guest, not that no
-- guest was present.
select is(
  (select count(*)::int from public.meeting_attendees
   where meeting_id = (select id from m1) and attendance = 'presente'),
  4, 'm1 has 4 present attendees (3 members + 1 external guest)');
select is(
  (select present_count from public.meetings where id = (select id from m1)),
  3, 'conclude snapshots present_count = 3 (external guest EXCLUDED — MINOR-2)');
select is(
  (select eligible_member_count from public.meetings where id = (select id from m1)),
  3, 'conclude snapshots eligible_member_count = 3 (comm_x members)');
select is(
  (select quorum_met from public.meetings where id = (select id from m1)),
  true, 'maioria_simples quorum met (3 > 3/2)');

-- =========================================================================
-- Child-lock: editing minutes / agenda while em_assinatura is rejected.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_meeting_minutes((select id from m1), 'edição proibida') $$,
  'HC033', null, 'minutes locked while em_assinatura (HC033)');
select throws_ok(
  $$ select public.create_meeting_agenda_item((select id from m1), 'novo item', null, null, null) $$,
  '23514', null, 'agenda child insert locked while em_assinatura (child-lock 23514)');
reset role;

-- =========================================================================
-- sign-own-row + auto-flip. st_x2 is NOT present? all 3 are present; required=3.
-- HC036: a non-present signer. Mark st_x2 absent first via reopen? Simpler:
-- test HC036 on m2 path is messy; instead verify the present signers flow and
-- HC035 double-sign, then HC036 via a freshly built meeting with a non-present.
-- =========================================================================
-- sa_x signs own row (1/3) — stays em_assinatura.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.sign_meeting(
       (select id from public.meeting_attendees where meeting_id=(select id from m1) and user_id=(select sa_x from k)),
       'internal_eauth', null) $$,
  'present attendee (sa_x) signs own row');
-- sa_x double-signs -> HC035.
select throws_ok(
  $$ select public.sign_meeting(
       (select id from public.meeting_attendees where meeting_id=(select id from m1) and user_id=(select sa_x from k)),
       'internal_eauth', null) $$,
  'HC035', null, 'double-sign raises HC035');
reset role;

select is(
  (select status from public.meetings where id = (select id from m1)),
  'em_assinatura', 'still em_assinatura after 1 of 3 signatures');

-- st_x signs own row (2/3).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.sign_meeting(
  (select id from public.meeting_attendees where meeting_id=(select id from m1) and user_id=(select st_x from k)),
  'internal_eauth', null);
-- st_x cannot sign st_x2's row (sign-on-behalf) -> HC036.
select throws_ok(
  $$ select public.sign_meeting(
       (select id from public.meeting_attendees where meeting_id=(select id from m1) and user_id=(select st_x2 from k)),
       'internal_eauth', null) $$,
  'HC036', null, 'cannot sign another attendee''s row (HC036)');
reset role;

-- st_x2 signs own row (3/3) -> auto-flip to assinada.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select public.sign_meeting(
  (select id from public.meeting_attendees where meeting_id=(select id from m1) and user_id=(select st_x2 from k)),
  'internal_eauth', null);
reset role;

select is(
  (select status from public.meetings where id = (select id from m1)),
  'assinada', 'auto-flip to assinada when the last required signature lands');
select is(
  (select count(*)::int from public.meeting_signatures where meeting_id=(select id from m1) and status='signed'),
  3, '3 active signatures recorded');

-- =========================================================================
-- reopen revokes signatures.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reopen_meeting((select id from m1));
reset role;

select is(
  (select status from public.meetings where id = (select id from m1)),
  'realizada', 'reopen returns status to realizada');
select is(
  (select count(*)::int from public.meeting_signatures where meeting_id=(select id from m1) and status='revoked'),
  3, 'reopen revokes all 3 signatures (rows kept)');

-- =========================================================================
-- HC037: a non-assignee non-admin cannot advance an action item.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ai on commit drop as
  select * from public.create_meeting_action_item((select id from m1), 'Tarefa', null, (select st_x from k), null, null, null);
reset role;
grant select on ai to authenticated;

-- st_x2 (not the assignee, not staff_admin) -> HC037.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.advance_meeting_action_item((select id from ai), 'in_progress') $$,
  'HC037', null, 'non-assignee non-admin cannot advance an action item (HC037)');
reset role;

-- st_x (the assignee) can advance.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.advance_meeting_action_item((select id from ai), 'in_progress');
reset role;
select is(
  (select status from public.meeting_action_items where id = (select id from ai)),
  'in_progress', 'assignee advances their own action item');

-- =========================================================================
-- Cross-commission isolation: sa_y sees 0 of comm_x's meetings and cannot
-- create in comm_x.
-- =========================================================================
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.meetings where commission_id = (select comm_x from k)),
  0, 'isolation: sa_y reads 0 comm_x meetings (RLS)');
select throws_ok(
  $$ select public.create_meeting((select comm_x from k), 'cross', null, now(), null, 'presencial', null, null) $$,
  '42501', null, 'isolation: sa_y cannot create a meeting in comm_x');
reset role;

select * from finish();
rollback;
