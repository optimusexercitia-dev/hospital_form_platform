-- =============================================================================
-- AUTHZ · Gate 2 · Stage C · C3 — meetings.visibility_policy + reach gate.
-- ADR 0078 A2·1, plan lines 366–371, keystones 12 / 13. Lands the two
-- product-reachable over-grants C8 deferred (§7.1, rows read under set local role):
--   (a) a MEMBER schedule_meetings delegate who is NOT an attendee reads 0 from a
--       participants_only meeting;
--   (b) a coordinator who is NOT an attendee reads 0 from a participants_only
--       (sub-group) meeting — the "no coordinator OR-arm" binding (plan:369).
-- Both falsifiable: supabase/tests/mutation drops the visibility gate → RED.
-- Plus keystone 13: participants_only REQUIRES a non-empty roster (DB-enforced).
-- =============================================================================
begin;
select plan(16);

update app.feature_flags set enabled = true
  where key in ('meetings', 'administrativo', 'case_participants');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x,   (v->>'st_x')::uuid as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- FIXTURE ---------------------------------------------------------------------
-- Plenary (commission_default) meeting — no roster needed.
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-0000000c3c10', (select comm_x from k), 9731, 'Plenária', now());

-- Sub-group (participants_only) meeting: create default, add attendee st_x, flip.
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-0000000c3b20', (select comm_x from k), 9732, 'Sub-grupo', now());
insert into public.meeting_attendees (id, meeting_id, user_id)
values ('00000000-0000-0000-0000-0000000c3a21', '00000000-0000-0000-0000-0000000c3b20', (select st_x from k));
insert into public.meeting_agenda_items (id, meeting_id, position, title)
values ('00000000-0000-0000-0000-0000000c3d22', '00000000-0000-0000-0000-0000000c3b20', 1, 'Processo 097');
-- A case linked to the sub-group meeting, so the meeting_cases row-count keystone
-- is non-vacuous (the reach gate must hide the link, not just an empty table).
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-0000000c3e30', (select comm_x from k), 9733, (select sa_x from k), 'commission_default');
insert into public.meeting_cases (meeting_id, case_id, agenda_item_id)
values ('00000000-0000-0000-0000-0000000c3b20', '00000000-0000-0000-0000-0000000c3e30', '00000000-0000-0000-0000-0000000c3d22');
update public.meetings set visibility_policy = 'participants_only'
  where id = '00000000-0000-0000-0000-0000000c3b20';

-- st_x2 (a member) becomes a schedule_meetings delegate but is NOT an attendee of
-- the sub-group meeting.
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
values ((select comm_x from k), (select st_x2 from k), (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability)
values ((select comm_x from k), (select st_x2 from k), 'schedule_meetings');

-- PRE-FLIGHT ------------------------------------------------------------------
select is(app.is_member_of_for((select comm_x from k), (select st_x2 from k)), true,
  'PRE ⭐: the delegate IS a member (so only visibility, not membership, can deny her)');
select is(app.is_member_of_for((select comm_x from k), (select sa_x from k)), true,
  'PRE ⭐: the coordinator is a member');
select is((select count(*)::int from public.meeting_attendees
           where meeting_id='00000000-0000-0000-0000-0000000c3b20'
             and user_id in ((select st_x2 from k),(select sa_x from k))), 0,
  'PRE ⭐: neither the delegate nor the coordinator is an attendee of the sub-group meeting');

-- REACH GATE ------------------------------------------------------------------
select is(app.can_reach_meeting('00000000-0000-0000-0000-0000000c3b20', (select st_x from k)), true,
  'reach: the attendee reaches the participants_only meeting');
select is(app.can_reach_meeting('00000000-0000-0000-0000-0000000c3b20', (select st_x2 from k)), false,
  'reach: a member NON-attendee does NOT reach the participants_only meeting');
select is(app.can_reach_meeting('00000000-0000-0000-0000-0000000c3b20', (select sa_x from k)), false,
  'reach ⭐: the coordinator NON-attendee does NOT reach it — NO coordinator OR-arm');
select is(app.can_reach_meeting('00000000-0000-0000-0000-0000000c3c10', (select st_x2 from k)), true,
  'reach: any member reaches a commission_default meeting');

-- (a) OVER-GRANT — the member schedule_meetings delegate reads ZERO of the
--     participants_only meeting. This is the K18 over-grant C8 deferred.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-0000000c3b20'), 0,
  'K18/K12 ⭐ ROWS: member schedule delegate (non-attendee) reads 0 participants_only meetings');
select is((select count(*)::int from public.meeting_agenda_items where meeting_id='00000000-0000-0000-0000-0000000c3b20'), 0,
  'K12 ⭐ ROWS: …0 agenda items');
select is((select count(*)::int from public.meeting_cases where meeting_id='00000000-0000-0000-0000-0000000c3b20'), 0,
  'K12 ⭐ ROWS: …0 meeting_cases');
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-0000000c3c10'), 1,
  'K12 NO-REGRESSION: …but she still reads the commission_default plenary');
reset role;
select set_config('request.jwt.claims', '', true);

-- (b) OVER-GRANT — the coordinator (non-attendee) reads ZERO of the sub-group
--     meeting. No coordinator OR-arm; a recused coordinator is thus shut out.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-0000000c3b20'), 0,
  'K12 ⭐ ROWS: the coordinator (non-attendee) reads 0 participants_only meetings — no coordinator arm');
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-0000000c3c10'), 1,
  'K12 NO-REGRESSION: …but reads the plenary as its coordinator');
reset role;
select set_config('request.jwt.claims', '', true);

-- KEYSTONE 13 — participants_only requires a non-empty roster, DB-enforced.
select throws_ok(
  $$ update public.meetings set visibility_policy='participants_only'
     where id='00000000-0000-0000-0000-0000000c3c10' $$,
  'HC0C3', null,
  'K13: flipping an empty-roster meeting to participants_only is REJECTED at write time');
select throws_ok(
  $$ insert into public.meetings (commission_id, meeting_number, title, scheduled_start, visibility_policy)
     select comm_x, 9799, 'Vazia', now(), 'participants_only' from k $$,
  'HC0C3', null,
  'K13: creating a participants_only meeting with no roster is REJECTED');
select throws_ok(
  $$ delete from public.meeting_attendees where id='00000000-0000-0000-0000-0000000c3a21' $$,
  'HC0C3', null,
  'K13: removing the LAST attendee of a participants_only meeting is REJECTED');

select * from finish();
rollback;
