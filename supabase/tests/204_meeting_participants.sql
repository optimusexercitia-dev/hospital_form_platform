-- pgTAP: Meeting participants — seed_selected_meeting_attendees
-- (migration 20260713000900_seed_selected_meeting_attendees.sql).
--
-- Coverage:
--   §1 subset seeded (attendance=convocado, role=membro) — only the chosen members.
--   §2 a non-member user_id in the array is IGNORED (join to commission_members).
--   §3 idempotent (re-run adds no duplicates; on conflict do nothing).
--   §4 empty array → no-op.
--   §5 non-staff_admin caller → 42501 (the assert_meeting_staff_admin gate).
--
-- Assertion count: 8

begin;
select plan(8);

update app.feature_flags set enabled = true where key = 'meetings';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'st_y')::uuid   as st_y,     -- a member of comm_y (NON-member of comm_x)
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- Author a meeting in comm_x as its staff_admin.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table m on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião P', null, now(), null, 'presencial', null, null);
grant select on m to authenticated;
reset role;

-- ===========================================================================
-- §1 · subset seeded — pick st_x + sa_x (NOT st_x2). Include st_y (comm_y member,
-- non-member of comm_x → must be ignored, §2).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.seed_selected_meeting_attendees(
  (select id from m),
  array[(select st_x from k), (select sa_x from k), (select st_y from k)]);
reset role;

select is(
  (select count(*)::int from public.meeting_attendees
   where meeting_id = (select id from m)),
  2, 'subset: exactly 2 attendees seeded (st_x + sa_x; st_x2 NOT chosen)');
select ok(
  exists (select 1 from public.meeting_attendees
          where meeting_id = (select id from m) and user_id = (select st_x from k)
            and attendance = 'summoned' and role = 'membro'),
  'subset: st_x seeded as convocado/membro');
select ok(
  exists (select 1 from public.meeting_attendees
          where meeting_id = (select id from m) and user_id = (select sa_x from k)),
  'subset: sa_x seeded');
select ok(
  not exists (select 1 from public.meeting_attendees
             where meeting_id = (select id from m) and user_id = (select st_x2 from k)),
  'subset: st_x2 (not chosen) is NOT seeded');

-- §2 · st_y (comm_y member, non-member of comm_x) was in the array but IGNORED.
select ok(
  not exists (select 1 from public.meeting_attendees
             where meeting_id = (select id from m) and user_id = (select st_y from k)),
  'non-member: st_y (member of another commission) is ignored by construction');

-- ===========================================================================
-- §3 · idempotent — re-run the same subset → still 2 rows (on conflict do nothing).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.seed_selected_meeting_attendees(
  (select id from m),
  array[(select st_x from k), (select sa_x from k)]);
reset role;
select is(
  (select count(*)::int from public.meeting_attendees
   where meeting_id = (select id from m)),
  2, 'idempotent: re-seeding the same subset adds no duplicates');

-- ===========================================================================
-- §4 · empty array → no-op (still 2 rows from before).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.seed_selected_meeting_attendees((select id from m), '{}'::uuid[]);
reset role;
select is(
  (select count(*)::int from public.meeting_attendees
   where meeting_id = (select id from m)),
  2, 'empty array: no-op (no rows added or removed)');

-- ===========================================================================
-- §5 · a non-staff_admin (plain staff of comm_x) → 42501.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.seed_selected_meeting_attendees(%L, array[%L]::uuid[]) $$,
         (select id from m), (select st_x2 from k)),
  '42501', null,
  'authz: a plain staff calling seed_selected_meeting_attendees is rejected (42501)');
reset role;

select finish();
rollback;
