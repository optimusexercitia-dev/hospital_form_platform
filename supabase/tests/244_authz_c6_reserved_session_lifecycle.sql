-- =============================================================================
-- AUTHZ · Gate 2 · Stage C · C6 — reserved-session lifecycle (O7/O8).
-- Opening a reserved session is COORDINATOR-ONLY (an access-granting act) — NOT
-- an administrativo capability, NOT Organization-User administration. A recused
-- coordinator cannot author reserved content on her own case; case-less reader
-- lists take members only.
-- =============================================================================
begin;
select plan(7);

update app.feature_flags set enabled = true
  where key in ('meetings', 'administrativo', 'case_participants', 'case_access', 'case_patient');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'sa_y')::uuid as sa_y, (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- FIXTURE ---------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy) values
  ('00000000-0000-0000-0000-00000000c6c1', (select comm_x from k), 9771, (select sa_x from k), 'commission_default'),
  ('00000000-0000-0000-0000-00000000c6d2', (select comm_x from k), 9772, (select sa_x from k), 'commission_default');
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-00000000c6a0', (select comm_x from k), 9773, 'Reunião C6', now());
insert into public.meeting_closed_sessions (id, meeting_id, opened_by)
values ('00000000-0000-0000-0000-00000000c6b0', '00000000-0000-0000-0000-00000000c6a0', (select sa_x from k));

-- sa_x (coordinator) recused from c6r2 (for the exclusion guard).
insert into public.case_recusals (case_id, user_id, source)
values ('00000000-0000-0000-0000-00000000c6d2', (select sa_x from k), 'conflict');

-- st_x2 made a schedule_meetings delegate (must NOT be able to open).
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
values ((select comm_x from k), (select st_x2 from k), (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability)
values ((select comm_x from k), (select st_x2 from k), 'schedule_meetings');

-- GATE — open_reserved_session is coordinator-only ---------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.open_reserved_session('00000000-0000-0000-0000-00000000c6a0') $$,
  '42501', null, 'GATE ⭐: a plain member CANNOT open a reserved session');
reset role;
select set_config('request.jwt.claims', '', true);

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.open_reserved_session('00000000-0000-0000-0000-00000000c6a0') $$,
  '42501', null, 'GATE ⭐ OVER-GRANT: a schedule_meetings delegate CANNOT open — opening is not administrativo');
reset role;
select set_config('request.jwt.claims', '', true);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.open_reserved_session('00000000-0000-0000-0000-00000000c6a0') $$,
  'GATE: the coordinator CAN open a reserved session');

-- add_reserved_item: coordinator authors; recused coordinator is denied on HER case.
select lives_ok(
  $$ select public.add_reserved_item('00000000-0000-0000-0000-00000000c6b0',
       '00000000-0000-0000-0000-00000000c6c1', 'substância', 'decisão', 'retirou-se X') $$,
  'the coordinator authors a reserved item on a case she is NOT recused from');
select throws_ok(
  $$ select public.add_reserved_item('00000000-0000-0000-0000-00000000c6b0',
       '00000000-0000-0000-0000-00000000c6d2', 'x') $$,
  'HC0F1', null,
  'EXCLUSION ⭐: the RECUSED coordinator cannot author reserved content on her own case');

-- case-less reader list takes MEMBERS only (sa_y is not a member of comm_x).
create temp table ri on commit drop as
  select public.add_reserved_item('00000000-0000-0000-0000-00000000c6b0',
    null, 'pré-formal', null, null, true,
    array[(select st_x from k), (select sa_y from k)]::uuid[]) as item_id;
reset role;
select set_config('request.jwt.claims', '', true);

select is((select count(*)::int from public.meeting_closed_session_item_readers
           where item_id = (select item_id from ri)), 1,
  'READER LIST ⭐: only the commission MEMBER became a reader (the non-member was filtered)');
select is((select user_id from public.meeting_closed_session_item_readers
           where item_id = (select item_id from ri)), (select st_x from k),
  'READER LIST ⭐: …and it is st_x, the member');

select * from finish();
rollback;
