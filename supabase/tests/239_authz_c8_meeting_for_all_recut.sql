-- =============================================================================
-- AUTHZ · Gate 2 · Stage C · C8 — the four meeting `FOR ALL` write policies are
-- re-cut to WRITE-ONLY, so their `USING` no longer side-doors SELECT past the
-- `*_select` boundary. ADR 0078 A13, plan lines 473–483, keystones 18 / 21.
--
-- WHY THIS MATTERS (§7.6 — the FOR ALL PERMISSIVE blind spot). A `FOR ALL`
-- policy's `USING` applies to SELECT and permissive policies OR, so each
-- `*_staff_admin_write` was silently ALSO a read grant. C8 splits each into
-- INSERT/UPDATE/DELETE with the identical predicate; SELECT then flows ONLY
-- through `*_select`.
--
-- ⭐ FALSIFIABILITY (§7.1, A33). The load-bearing over-grant keystone is K18:
-- a principal admitted ONLY by the write `USING` (a non-member `schedule_meetings`
-- delegate) reads ZERO meetings after C8. Revert C8 (restore the FOR ALL) and she
-- reads 1 — proven by supabase/tests/mutation, and by the lead's pre/post row
-- probe (meetings 1 → 0). The no-regression twins (K21) are pins: they read via
-- `*_select`, which C8 does not touch, so they cannot fake the over-grant.
--
-- ⭐ THE FIXTURE IS MADE, NOT BORROWED (§7.1·3). `st_y` is a foreign staff (member
-- of comm_y, NOT comm_x) MADE a non-member administrativo delegate by direct
-- insert — the product's `appoint_administrativo` requires a `staff` membership,
-- so a non-member delegate is not product-reachable; this fixture isolates the
-- `member_can` write-USING arm the policy nonetheless grants read through. The
-- PRE-FLIGHT block proves she holds NONE of the natural arms before the arm is
-- measured, so a green K18 cannot be a wrong-arm artifact.
-- =============================================================================
begin;
select plan(19);

update app.feature_flags set enabled = true
  where key in ('meetings', 'administrativo', 'case_participants');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,     -- coordinator (staff_admin) of comm_x
         (v->>'st_x')::uuid   as st_x,     -- plain member of comm_x
         (v->>'st_y')::uuid   as st_y,     -- FOREIGN staff (member of comm_y, not comm_x)
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- FIXTURE — a meeting on comm_x with one of each child row, plus a
-- commission_default case so meeting_cases_select admits members.
-- ---------------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-00000000c801', (select comm_x from k), 98001,
        (select sa_x from k), 'commission_default');

insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-00000000c830', (select comm_x from k), 9801, 'Reunião C8', now());

insert into public.meeting_agenda_items (id, meeting_id, position, title)
values ('00000000-0000-0000-0000-00000000c831', '00000000-0000-0000-0000-00000000c830', 1, 'Item C8');

insert into public.meeting_attendees (id, meeting_id, user_id)
values ('00000000-0000-0000-0000-00000000c832', '00000000-0000-0000-0000-00000000c830', (select sa_x from k));

insert into public.meeting_cases (meeting_id, case_id)
values ('00000000-0000-0000-0000-00000000c830', '00000000-0000-0000-0000-00000000c801');

-- MAKE st_y a non-member schedule_meetings delegate of comm_x (direct insert,
-- bypassing appoint_administrativo's membership requirement — §7.1·3).
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
values ((select comm_x from k), (select st_y from k), (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability)
values ((select comm_x from k), (select st_y from k), 'schedule_meetings');

-- ===========================================================================
-- STRUCTURAL — no `FOR ALL` (cmd = ALL) policy remains on any of the four
-- tables; SELECT is served by exactly one policy each.
-- ===========================================================================
select is((select count(*)::int from pg_policies
           where schemaname='public'
             and tablename in ('meetings','meeting_agenda_items','meeting_attendees','meeting_cases')
             and cmd='ALL'), 0,
  'C8 STRUCTURAL: zero FOR ALL (cmd=ALL) policies remain on the four meeting tables');
select is((select count(*)::int from pg_policies
           where schemaname='public'
             and tablename in ('meetings','meeting_agenda_items','meeting_attendees','meeting_cases')
             and cmd='SELECT'), 4,
  'C8 STRUCTURAL: exactly one SELECT policy per table (the sole read path)');

-- ===========================================================================
-- PRE-FLIGHT — st_y holds NONE of the natural arms on comm_x; her only reach
-- into the write policy is the schedule_meetings capability. Without this, K18
-- could be measuring a plain non-member and assert nothing.
-- ===========================================================================
select is(app.is_member_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: the delegate is NOT a member of comm_x — meetings_select cannot admit her');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …NOT a staff_admin of comm_x');
select is(app.is_commission_admin_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …NOT a commission_admin of comm_x — so her ONLY write-policy arm is member_can(schedule_meetings)');
select is((select count(*)::int from public.commission_administrativo_capabilities
           where commission_id=(select comm_x from k) and user_id=(select st_y from k)
             and capability='schedule_meetings'), 1,
  'PRE ⭐: …and she DOES hold the schedule_meetings capability — the write policy''s member_can arm fires');

-- ===========================================================================
-- K18 — OVER-GRANT (the falsifiable core). The delegate reads ZERO rows from
-- every re-cut table. Pre-C8 she read the meeting via the FOR ALL USING.
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where commission_id=(select comm_x from k)), 0,
  'K18 ⭐ ROWS: the schedule_meetings delegate reads ZERO meetings — the FOR ALL side door is closed (was 1 pre-C8)');
select is((select count(*)::int from public.meeting_agenda_items
           where meeting_id='00000000-0000-0000-0000-00000000c830'), 0,
  'K18 ⭐ ROWS: ZERO agenda items');
select is((select count(*)::int from public.meeting_attendees
           where meeting_id='00000000-0000-0000-0000-00000000c830'), 0,
  'K18 ⭐ ROWS: ZERO attendees');
select is((select count(*)::int from public.meeting_cases
           where meeting_id='00000000-0000-0000-0000-00000000c830'), 0,
  'K18 ⭐ ROWS: ZERO meeting_cases');
-- K18b — NO-REGRESSION: scheduling is a WRITE capability and it is preserved.
select lives_ok(
  $$ insert into public.meetings (commission_id, meeting_number, title, scheduled_start)
     values ((select comm_x from k), 9899, 'Delegada agenda', now()) $$,
  'K18b: the delegate can STILL schedule (INSERT) a meeting — C8 removed her READ, not her write capability');
reset role;
select set_config('request.jwt.claims', '', true);

-- ===========================================================================
-- K21 — NO-REGRESSION. The coordinator and the plain member read the meeting
-- and every child exactly as before. (Pins — served by *_select, untouched by C8.)
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-00000000c830'), 1,
  'K21: the coordinator reads the meeting (via meetings_select — no regression)');
select is((select count(*)::int from public.meeting_agenda_items where id='00000000-0000-0000-0000-00000000c831'), 1,
  'K21: …the agenda item');
select is((select count(*)::int from public.meeting_attendees where id='00000000-0000-0000-0000-00000000c832'), 1,
  'K21: …the attendee');
select is((select count(*)::int from public.meeting_cases where meeting_id='00000000-0000-0000-0000-00000000c830'), 1,
  'K21: …the meeting_case');
-- K21 write preserved: the coordinator still manages agenda items.
select lives_ok(
  $$ insert into public.meeting_agenda_items (meeting_id, position, title)
     values ('00000000-0000-0000-0000-00000000c830', 2, 'Item C8 dois') $$,
  'K21: the coordinator can STILL write agenda items (write policies preserved by the re-cut)');
reset role;
select set_config('request.jwt.claims', '', true);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-00000000c830'), 1,
  'K21: the plain member reads the commission_default meeting (member-wide, no regression)');
select is((select count(*)::int from public.meeting_agenda_items where id='00000000-0000-0000-0000-00000000c831'), 1,
  'K21: …the agenda item');
select is((select count(*)::int from public.meeting_cases where meeting_id='00000000-0000-0000-0000-00000000c830'), 1,
  'K21: …the meeting_case (commission_default case → reachable on the member surface)');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
