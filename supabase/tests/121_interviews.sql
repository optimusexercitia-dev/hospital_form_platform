-- Phase 11: Interviews.
-- Covers: per-commission interview_number minting; create staff_admin-only
-- (bootstrap, 42501); the NEW participant-write grant (a plain-staff registered
-- interviewer CAN write, a non-interviewer staff CANNOT — HC039); lifecycle
-- schedule/start/conclude/reopen/cancel + wrong-state HC038; content + child-lock
-- freeze once concluida; phase-in-case guard; HC021 registered interviewer not a
-- member; HC041 conclude with no subject; conclude writes a case_events
-- kind='interview' row and re-conclude UPDATES the SAME row (no duplicate); HC040
-- invalid attachment; cross-commission RLS isolation.

begin;
select plan(28);

-- Enable the interviews flag for the whole test (it ships ON in-phase, but a
-- hermetic test must not depend on migration order).
update app.feature_flags set enabled = true where key = 'interviews';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on k to authenticated;

-- A case in comm_x and one in comm_y (inserted directly as superuser, like the
-- meetings seed; the interview's phase-in-case guard only needs a real case row).
create temp table cs on commit drop as
  select gen_random_uuid() as case_x, gen_random_uuid() as case_y;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by)
values
  ((select case_x from cs), (select comm_x from k), 9001, 'Caso X', (select sa_x from k)),
  ((select case_y from cs), (select comm_y from k), 9001, 'Caso Y', (select sa_y from k));

-- A phase belonging to case_y (used to prove the phase-in-case guard rejects a
-- cross-case phase link). It needs a form + published version (FK + pin); reuse Y's.
create temp table cp on commit drop as
  select gen_random_uuid() as phase_y;
grant select on cp to authenticated;
insert into public.case_phases (id, case_id, position, form_id, form_version_id, title, status)
values ((select phase_y from cp), (select case_y from cs), 0,
        (select (v->>'form_y')::uuid from ctx), (select (v->>'ver_y')::uuid from ctx),
        'Fase Y', 'pendente');

-- =========================================================================
-- create_interview: staff_admin-only bootstrap + minting.
-- =========================================================================
-- A plain staff member cannot create (42501).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_interview((select case_x from cs), 'nope', null, 'presencial', null, null, null, null) $$,
  '42501', null, 'staff (non-admin) cannot create an interview');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table i1 on commit drop as
  select * from public.create_interview((select case_x from cs), 'Entrevista 1', null,
                                         'presencial', null, null, null, null);
reset role;
grant select on i1 to authenticated;

select is((select interview_number from i1), 1, 'first interview minted number 1');
select is((select status from i1), 'rascunho', 'new interview starts rascunho');
select is((select commission_id from i1), (select comm_x from k),
  'create derives commission_id from the case');

-- Second interview in comm_x mints 2 (per-commission counter).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table i2 on commit drop as
  select * from public.create_interview((select case_x from cs), 'Entrevista 2', null,
                                         'remoto', null, null, null, null);
reset role;
grant select on i2 to authenticated;
select is((select interview_number from i2), 2,
  'second interview minted number 2 (per-commission counter)');

-- =========================================================================
-- Phase-in-case guard: attaching case_y's phase to a comm_x interview fails.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_interview((select id from i1), 'E1', (select phase_y from cp),
       'presencial', null, null, null, null) $$,
  '23514', null, 'phase-in-case guard: a foreign-case phase link is rejected');
reset role;

-- =========================================================================
-- Participant write grant: add st_x (a plain staff member) as a REGISTERED
-- interviewer of i1 → st_x can now write i1; st_x2 (not an interviewer) cannot.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- HC021: a non-member registered interviewer is rejected (sa_y is not in comm_x).
select throws_ok(
  $$ select public.add_interview_interviewer((select id from i1), (select sa_y from k), null, null, 'entrevistador', null) $$,
  'HC021', null, 'registered interviewer must be a member of the commission (HC021)');
-- st_x is a comm_x member: OK, and gains write.
select lives_ok(
  $$ select public.add_interview_interviewer((select id from i1), (select st_x from k), null, null, 'entrevistador_principal', null) $$,
  'staff_admin adds st_x as a registered interviewer');
reset role;

-- st_x (plain staff, now a registered interviewer) CAN edit i1.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.update_interview_summary((select id from i1), 'Resumo pelo entrevistador') $$,
  'a registered interviewer (plain staff) CAN write the interview');
reset role;

-- st_x2 (plain staff, NOT an interviewer) CANNOT edit i1 (HC039).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_interview_summary((select id from i1), 'tentativa') $$,
  'HC039', null, 'a non-interviewer staff CANNOT write the interview (HC039)');
-- ...and cannot read+write via can_write_interview either (the predicate is false).
select is(
  public.interview_viewer_can_write((select id from i1)),
  false, 'interview_viewer_can_write = false for a non-interviewer staff');
reset role;

-- st_x's viewerCanWrite signal is true.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  public.interview_viewer_can_write((select id from i1)),
  true, 'interview_viewer_can_write = true for a registered interviewer');
reset role;

-- =========================================================================
-- HC041: conclude with NO interviewee. Build i1 to em_andamento first.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.schedule_interview((select id from i1), now(), null);
select public.start_interview((select id from i1));
reset role;
select is((select status from public.case_interviews where id = (select id from i1)),
  'em_andamento', 'schedule + start advance to em_andamento');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.conclude_interview((select id from i1)) $$,
  'HC041', null, 'conclude with no interviewee raises HC041');
reset role;

-- =========================================================================
-- Add a subject, then conclude → writes a case_events kind='interview' row.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_interview_subject((select id from i1), (select st_x2 from k), null,
                                     'Enfermeiro(a)', null, null);
select public.conclude_interview((select id from i1));
reset role;

select is((select status from public.case_interviews where id = (select id from i1)),
  'concluida', 'conclude flips status to concluida');
select is(
  (select count(*)::int from public.case_events
   where case_id = (select case_x from cs) and kind = 'interview'),
  1, 'conclude writes exactly one case_events kind=interview row');
select isnt(
  (select registry_event_id from public.case_interviews where id = (select id from i1)),
  null, 'concluded interview stores its registry_event_id');

-- =========================================================================
-- Content + child-lock freeze while concluida.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_interview_summary((select id from i1), 'edição proibida') $$,
  'HC038', null, 'summary locked while concluida (HC038)');
select throws_ok(
  $$ select public.add_interview_subject((select id from i1), (select st_x from k), null, 'x', null, null) $$,
  '23514', null, 'subject child insert locked while concluida (child-lock 23514)');
reset role;

-- =========================================================================
-- reopen + re-conclude updates the SAME case_events row (no duplicate).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reopen_interview((select id from i1));
reset role;
select is((select status from public.case_interviews where id = (select id from i1)),
  'em_andamento', 'reopen returns to em_andamento');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.update_interview_summary((select id from i1), 'Resumo revisado');
select public.conclude_interview((select id from i1));
reset role;
select is(
  (select count(*)::int from public.case_events
   where case_id = (select case_x from cs) and kind = 'interview'),
  1, 're-conclude updates the SAME timeline row (still exactly 1, no duplicate)');

-- =========================================================================
-- cancel is terminal: cannot reopen a cancelled interview (HC038).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.cancel_interview((select id from i2));
reset role;
select is((select status from public.case_interviews where id = (select id from i2)),
  'cancelada', 'cancel flips status to cancelada');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.reopen_interview((select id from i2)) $$,
  'HC038', null, 'a cancelled interview cannot be reopened (terminal; HC038)');
reset role;

-- =========================================================================
-- HC040: invalid attachment (neither a file nor a link). i2 is cancelled, so use
-- a fresh em_andamento interview to avoid the freeze path masking HC040.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table i3 on commit drop as
  select * from public.create_interview((select case_x from cs), 'Entrevista 3', null,
                                         'presencial', null, null, null, null);
reset role;
grant select on i3 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.add_interview_attachment((select id from i3), 'outro', 'sem fonte', null, null, null, null) $$,
  'HC040', null, 'attachment with neither file nor link raises HC040');
select throws_ok(
  $$ select public.add_interview_attachment((select id from i3), 'gravacao_audio', 'link http', null, 'http://x.test/a.mp3', null, null) $$,
  'HC040', null, 'non-https external link raises HC040');
-- A valid https link is accepted.
select lives_ok(
  $$ select public.add_interview_attachment((select id from i3), 'gravacao_audio', 'gravação', null, 'https://x.test/a.mp3', null, null) $$,
  'a valid https link attachment is accepted');
reset role;

-- =========================================================================
-- Cross-commission isolation: sa_y sees 0 of comm_x's interviews and cannot
-- create one on comm_x's case.
-- =========================================================================
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_interviews where commission_id = (select comm_x from k)),
  0, 'isolation: sa_y reads 0 comm_x interviews (RLS)');
select throws_ok(
  $$ select public.create_interview((select case_x from cs), 'cross', null, 'presencial', null, null, null, null) $$,
  '42501', null, 'isolation: sa_y cannot create an interview on a comm_x case');
reset role;

select * from finish();
rollback;
