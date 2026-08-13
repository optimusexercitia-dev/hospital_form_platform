-- Meeting actual-occurrence time (`held_at` / `held_end`) — ADR 0062.
-- Migration 20260715000100_meeting_held_time.
--
-- Proves:
--   (COL) held_at / held_end exist on public.meetings and are nullable.
--   (T)   mark_meeting_held(p_held_at, p_held_end) persists the window at the
--         scheduled -> held transition; conclude_meeting likewise (from
--         scheduled, one-step) persists it while flipping to in_signature;
--         concluded_at stays now() (distinct from held_at); a null held_at is
--         accepted at the transition (allow-null, fill-later).
--   (V)   HC082 future held_at rejected; HC081 held_end < held_at rejected; HC084
--         held_end with a null held_at rejected — in both the transition RPC and
--         the edit RPC.
--   (E)   set_meeting_held_window: staff_admin-only (42501 for plain staff);
--         status gate = held ONLY (HC083 on in_signature); happy path on
--         held writes ONLY held_* (schedule untouched).
--   (A)   audit: mark_meeting_held emits meeting.held_changed (null -> value) AND
--         meeting.status_changed (non-exclusive branches); set_meeting_held_window
--         emits meeting.held_changed on a subsequent edit.

begin;
select plan(21);

update app.feature_flags set enabled = true where key in ('meetings', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- (COL) Columns exist and are nullable.
-- =========================================================================
select has_column('public', 'meetings', 'held_at', 'meetings.held_at exists');
select has_column('public', 'meetings', 'held_end', 'meetings.held_end exists');
select col_is_null('public', 'meetings', 'held_at', 'meetings.held_at is nullable');
select col_is_null('public', 'meetings', 'held_end', 'meetings.held_end is nullable');

-- =========================================================================
-- (T) mark_meeting_held persists the occurrence window at scheduled -> held.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- (V) HC084 on the TRANSITION RPC: held_end with a null held_at is rejected
-- (an end with no start). m0 is a throwaway scheduled meeting.
create temp table m0 on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião held 0', null,
    now() + interval '1 day', null, 'presencial', null, null);
grant select on m0 to authenticated;
select throws_ok(
  $$ select public.mark_meeting_held((select id from m0), null, now() - interval '1 hour') $$,
  'HC084', null, 'mark_meeting_held rejects held_end with a null held_at (HC084)');

create temp table m1 on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião held 1', null,
    now() + interval '2 days', null, 'presencial', null, null);
grant select on m1 to authenticated;

-- Held one hour ago, ran 90 minutes (in the past — valid).
select public.mark_meeting_held(
  (select id from m1),
  now() - interval '1 hour',
  now() - interval '1 hour' + interval '90 minutes');
reset role;

select is(
  (select status from public.meetings where id = (select id from m1)),
  'held', 'mark_meeting_held flips to held');
select ok(
  (select held_at is not null and held_end is not null
   from public.meetings where id = (select id from m1)),
  'mark_meeting_held persists held_at + held_end');
select ok(
  (select held_end > held_at from public.meetings where id = (select id from m1)),
  'held_end is after held_at');

-- (V) HC082: future held_at rejected in the edit RPC (m1 is held).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_meeting_held_window((select id from m1), now() + interval '1 day', null) $$,
  'HC082', null, 'set_meeting_held_window rejects a future held_at (HC082)');
-- (V) HC081: held_end < held_at rejected.
select throws_ok(
  $$ select public.set_meeting_held_window((select id from m1),
       now() - interval '1 hour', now() - interval '2 hours') $$,
  'HC081', null, 'set_meeting_held_window rejects held_end < held_at (HC081)');
-- (V) HC084: held_end present while held_at is null (an end with no start).
select throws_ok(
  $$ select public.set_meeting_held_window((select id from m1),
       null, now() - interval '1 hour') $$,
  'HC084', null, 'set_meeting_held_window rejects held_end with a null held_at (HC084)');
reset role;

-- =========================================================================
-- (E) set_meeting_held_window authz + happy path (schedule untouched).
-- =========================================================================
-- A plain staff member cannot edit the window (42501).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_meeting_held_window((select id from m1), now() - interval '3 hours', null) $$,
  '42501', null, 'set_meeting_held_window is staff_admin-only (42501 for plain staff)');
reset role;

-- Happy path: coordinator corrects the window while held; schedule unchanged.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_meeting_held_window((select id from m1), now() - interval '3 hours', null);
reset role;
select ok(
  (select held_at < now() - interval '2 hours' and held_end is null
   from public.meetings where id = (select id from m1)),
  'set_meeting_held_window overwrites held_* (held_end cleared to null)');
select is(
  (select scheduled_start::date from public.meetings where id = (select id from m1)),
  (now() + interval '2 days')::date,
  'set_meeting_held_window leaves scheduled_start untouched (never overwrites the plan)');

-- =========================================================================
-- (A) Audit: the transition emitted BOTH status_changed and held_changed
-- (non-exclusive branches); the later edit emitted another held_changed.
-- =========================================================================
select cmp_ok(
  (select count(*)::int from public.audit_log
   where action = 'meeting.status_changed' and entity_id = (select id from m1)),
  '>=', 1, 'audit: meeting.status_changed emitted at the transition');
select cmp_ok(
  (select count(*)::int from public.audit_log
   where action = 'meeting.held_changed' and entity_id = (select id from m1)),
  '>=', 2, 'audit: meeting.held_changed emitted at transition AND on edit (>=2)');

-- =========================================================================
-- (E) HC083: the edit RPC is held-ONLY. Conclude m1 (needs a present
-- member) -> in_signature, then the edit must be rejected.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.seed_expected_meeting_attendees((select id from m1));
update public.meeting_attendees set attendance = 'present' where meeting_id = (select id from m1);
select public.conclude_meeting((select id from m1));
reset role;

select is(
  (select status from public.meetings where id = (select id from m1)),
  'in_signature', 'conclude flips m1 to in_signature');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_meeting_held_window((select id from m1), now() - interval '4 hours', null) $$,
  'HC083', null, 'set_meeting_held_window rejected while in_signature (held-only, HC083)');
reset role;

-- =========================================================================
-- (T) conclude_meeting (one-step from scheduled) persists the window; held_at may
-- be null; concluded_at stays now() (distinct concept).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table m2 on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião held 2', null,
    now(), null, 'presencial', null, null);
grant select on m2 to authenticated;
select public.seed_expected_meeting_attendees((select id from m2));
update public.meeting_attendees set attendance = 'present' where meeting_id = (select id from m2);
-- Held window supplied at conclude (one-step from scheduled).
select public.conclude_meeting((select id from m2), now() - interval '2 hours',
  now() - interval '1 hour');
reset role;

select is(
  (select status from public.meetings where id = (select id from m2)),
  'in_signature', 'conclude_meeting (one-step) flips to in_signature');
select ok(
  (select held_at is not null and concluded_at is not null and held_at <> concluded_at
   from public.meetings where id = (select id from m2)),
  'conclude_meeting persists held_at; concluded_at stays now() (distinct)');

-- A conclude with a NULL held_at is accepted (allow-null, fill-later).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table m3 on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião held 3', null,
    now(), null, 'presencial', null, null);
grant select on m3 to authenticated;
select public.seed_expected_meeting_attendees((select id from m3));
update public.meeting_attendees set attendance = 'present' where meeting_id = (select id from m3);
select public.conclude_meeting((select id from m3), null, null);
reset role;
select ok(
  (select status = 'in_signature' and held_at is null
   from public.meetings where id = (select id from m3)),
  'conclude_meeting accepts a null held_at (allow-null) and still concludes');

select * from finish();
rollback;
