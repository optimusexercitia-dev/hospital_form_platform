-- Phase 11 · Interviews — revised by IV2 (ADR 0070: sessions + reporting /
-- confidentiality). Covers: create staff_admin/commission-admin-only bootstrap
-- (42501) + per-commission interview_number minting; interview_category required
-- (HC0B1) + confidentiality_level default; the participant-write grant (a plain
-- registered interviewer CAN write, a non-interviewer staff CANNOT — HC039);
-- interview_sessions schema (CHECKs / uniqueness) + RLS (member read, non-member 0,
-- writer vs non-writer HC039); the §4 state machine (schedule/start/complete +
-- awaiting_follow_up derivation, HC038 wrong-state, HC0B0 schedule precondition);
-- relationship_to_case required (HC0B2); conclude widened precondition + ≥1-subject
-- (HC041) + exactly-one registry row (incl. re-conclude); content + session
-- child-lock freeze; cancel cascade + terminal; t19 REVOKE guards for every new
-- RPC; cross-commission isolation.

begin;
select plan(60);

-- Enable the interviews flag for the whole test (ships ON in-phase; a hermetic test
-- must not depend on migration order).
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

create temp table cs on commit drop as
  select gen_random_uuid() as case_x, gen_random_uuid() as case_y;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by)
values
  ((select case_x from cs), (select comm_x from k), 9001, 'Caso X', (select sa_x from k)),
  ((select case_y from cs), (select comm_y from k), 9001, 'Caso Y', (select sa_y from k));

-- =========================================================================
-- create_interview: bootstrap authz + interview_category required + minting.
-- =========================================================================
-- (1) A plain staff member cannot create (42501).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_interview((select case_x from cs), 'nope', null, 'clinical_team', 'standard') $$,
  '42501', null, 'staff (non-admin) cannot create an interview');
-- (2) create WITHOUT a category → HC0B1.
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_interview((select case_x from cs), 'sem categoria', null, null, 'standard') $$,
  'HC0B1', null, 'create without interview_category raises HC0B1');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table i1 on commit drop as
  select * from public.create_interview((select case_x from cs), 'Entrevista 1', null,
                                         'clinical_team', 'standard');
reset role;
grant select on i1 to authenticated;

select is((select interview_number from i1), 1, 'first interview minted number 1');           -- 3
select is((select status from i1), 'draft', 'new interview starts draft');                    -- 4
select is((select commission_id from i1), (select comm_x from k),
  'create derives commission_id from the case');                                              -- 5
select is((select confidentiality_level from i1), 'standard',
  'confidentiality_level defaults to standard');                                              -- 6
select is((select interview_category from i1), 'clinical_team',
  'interview_category is stored as given');                                                   -- 7

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table i2 on commit drop as
  select * from public.create_interview((select case_x from cs), 'Entrevista 2', null,
                                         'witness', 'standard');
reset role;
grant select on i2 to authenticated;
select is((select interview_number from i2), 2,
  'second interview minted number 2 (per-commission counter)');                               -- 8

-- =========================================================================
-- Participant write grant (unchanged core): st_x (plain staff) as a REGISTERED
-- interviewer CAN write i1; st_x2 (not an interviewer) CANNOT (HC039). HC021 for
-- a non-member.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.add_interview_interviewer((select id from i1), (select sa_y from k), null, null, 'entrevistador', null) $$,
  'HC021', null, 'registered interviewer must be a member of the commission (HC021)');        -- 9
select lives_ok(
  $$ select public.add_interview_interviewer((select id from i1), (select st_x from k), null, null, 'entrevistador_principal', null) $$,
  'staff_admin adds st_x as a registered interviewer');                                       -- 10
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.update_interview_summary((select id from i1), 'Resumo pelo entrevistador') $$,
  'a registered interviewer (plain staff) CAN write the interview');                          -- 11
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_interview_summary((select id from i1), 'tentativa') $$,
  'HC039', null, 'a non-interviewer staff CANNOT write the interview (HC039)');               -- 12
select is(public.interview_viewer_can_write((select id from i1)), false,
  'interview_viewer_can_write = false for a non-interviewer staff');                          -- 13
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(public.interview_viewer_can_write((select id from i1)), true,
  'interview_viewer_can_write = true for a registered interviewer');                          -- 14
reset role;

-- =========================================================================
-- Sessions: schedule → start → complete + the awaiting_follow_up derivation.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table s1 on commit drop as
  select * from public.schedule_session((select id from i1), null, 'presencial',
                                         now(), now() + interval '1 hour', 'Sala 1', null);
reset role;
grant select on s1 to authenticated;

select is((select sequence_number from s1), 1, 'first session minted sequence_number 1');     -- 15
select is((select session_type from s1), 'initial', 'seq-1 session defaults to initial');     -- 16
select is((select status from s1), 'scheduled', 'new session starts scheduled');              -- 17
select is((select status from public.case_interviews where id = (select id from i1)),
  'scheduled', 'scheduling the first session flips the interview draft → scheduled');          -- 18

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table s2 on commit drop as
  select * from public.schedule_session((select id from i1), null, 'remoto',
                                         now() + interval '2 days', null, null, 'https://x.test/m');
reset role;
grant select on s2 to authenticated;
select is((select sequence_number from s2), 2, 'second session minted sequence_number 2');    -- 19
select is((select session_type from s2), 'follow_up', 'seq>1 session defaults to follow_up'); -- 20

-- Uniqueness: a duplicate (interview_id, sequence_number) is rejected (23505).
select throws_ok(
  format($$ insert into public.interview_sessions (interview_id, sequence_number, session_type)
            values (%L, 1, 'clarification') $$, (select id from i1)),
  '23505', null, 'unique (interview_id, sequence_number) rejects a duplicate');                -- 21

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.start_session((select id from s1));
reset role;
select is((select status from public.interview_sessions where id = (select id from s1)),
  'in_progress', 'start_session → in_progress (actual_start set)');                            -- 22
select is((select status from public.case_interviews where id = (select id from i1)),
  'in_progress', 'start_session flips the interview scheduled → in_progress');                 -- 23

-- Complete s1 while s2 is still scheduled → interview derives awaiting_follow_up.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.complete_session((select id from s1));
reset role;
select is((select status from public.interview_sessions where id = (select id from s1)),
  'completed', 'complete_session → completed');                                               -- 24
select is((select status from public.case_interviews where id = (select id from i1)),
  'awaiting_follow_up',
  'complete with another scheduled session derives awaiting_follow_up');                       -- 25

-- Wrong-state session transitions (HC038).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.start_session((select id from s1)) $$,
  'HC038', null, 'start_session on a non-scheduled session raises HC038');                     -- 26
select throws_ok(
  $$ select public.complete_session((select id from s1)) $$,
  'HC038', null, 'complete_session on a non-in_progress session raises HC038');                -- 27
reset role;

-- Start s2 from awaiting_follow_up → interview back to in_progress; completing it
-- (no other scheduled) leaves the interview in_progress.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.start_session((select id from s2));
reset role;
select is((select status from public.case_interviews where id = (select id from i1)),
  'in_progress', 'start_session flips awaiting_follow_up → in_progress');                       -- 28
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.complete_session((select id from s2));
reset role;
select is((select status from public.case_interviews where id = (select id from i1)),
  'in_progress', 'completing the last session (no scheduled) leaves the interview in_progress'); -- 29

-- =========================================================================
-- conclude: ≥1-subject (HC041) + relationship_to_case required (HC0B2) + registry.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.conclude_interview((select id from i1)) $$,
  'HC041', null, 'conclude with no interviewee raises HC041');                                 -- 30
select throws_ok(
  $$ select public.add_interview_subject((select id from i1), (select st_x2 from k), null, 'Enf', null, null, null) $$,
  'HC0B2', null, 'add_interview_subject without relationship_to_case raises HC0B2');           -- 31
select public.add_interview_subject((select id from i1), (select st_x2 from k), null,
                                     'Enfermeiro(a)', null, null, 'nurse');
select public.conclude_interview((select id from i1));
reset role;

select is((select status from public.case_interviews where id = (select id from i1)),
  'completed', 'conclude (from in_progress) flips status to completed');                        -- 32
select is(
  (select count(*)::int from public.case_events
   where case_id = (select case_x from cs) and kind = 'interview'),
  1, 'conclude writes exactly one case_events kind=interview row');                            -- 33
select isnt(
  (select registry_event_id from public.case_interviews where id = (select id from i1)),
  null, 'concluded interview stores its registry_event_id');                                   -- 34

-- =========================================================================
-- Content + session child-lock freeze while completed.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_interview_summary((select id from i1), 'edição proibida') $$,
  'HC038', null, 'summary locked while completed (HC038)');                                    -- 35
select throws_ok(
  $$ select public.add_interview_subject((select id from i1), (select st_x from k), null, 'x', null, null, 'other') $$,
  '23514', null, 'subject child insert locked while completed (child-lock 23514)');            -- 36
select throws_ok(
  $$ select public.schedule_session((select id from i1), null, null, now(), null, null, null) $$,
  'HC0B0', null, 'scheduling a session on a completed interview raises HC0B0');                -- 37
reset role;
-- Direct session write while the interview is completed → session child-lock (23514).
select throws_ok(
  format($$ update public.interview_sessions set location_text = 'x' where id = %L $$,
         (select id from s1)),
  '23514', null, 'direct session write is frozen while the interview is completed (23514)');   -- 38

-- =========================================================================
-- reopen + re-conclude updates the SAME case_events row (registry stays one).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reopen_interview((select id from i1));
reset role;
select is((select status from public.case_interviews where id = (select id from i1)),
  'in_progress', 'reopen returns to in_progress');                                             -- 39
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.conclude_interview((select id from i1));
reset role;
select is(
  (select count(*)::int from public.case_events
   where case_id = (select case_x from cs) and kind = 'interview'),
  1, 're-conclude keeps exactly one registry row (no duplicate)');                             -- 40

-- =========================================================================
-- cancel_interview cascades non-terminal sessions → cancelled; terminal.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table s3 on commit drop as
  select * from public.schedule_session((select id from i2), null, 'presencial',
                                         now() + interval '1 day', null, null, null);
reset role;
grant select on s3 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.cancel_interview((select id from i2));
reset role;
select is((select status from public.case_interviews where id = (select id from i2)),
  'cancelled', 'cancel flips the interview to cancelled');                                     -- 41
select is((select status from public.interview_sessions where id = (select id from s3)),
  'cancelled', 'cancel_interview cascades the non-terminal session to cancelled');             -- 42
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.reopen_interview((select id from i2)) $$,
  'HC038', null, 'a cancelled interview cannot be reopened (terminal; HC038)');                -- 43
select throws_ok(
  $$ select public.schedule_session((select id from i2), null, null, now(), null, null, null) $$,
  'HC0B0', null, 'scheduling a session on a cancelled interview raises HC0B0');                -- 44
reset role;

-- =========================================================================
-- Session RLS write: a registered interviewer (plain staff) can schedule; a
-- non-interviewer staff cannot (HC039). Plus no_show POS.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table i3 on commit drop as
  select * from public.create_interview((select case_x from cs), 'Entrevista 3', null,
                                         'expert', 'restricted');
reset role;
grant select on i3 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_interview_interviewer((select id from i3), (select st_x from k), null, null,
                                        'entrevistador_principal', null);
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table s4 on commit drop as
  select * from public.schedule_session((select id from i3), null, 'presencial',
                                         now() + interval '1 day', null, null, null);
reset role;
grant select on s4 to authenticated;
select ok((select id from s4) is not null,
  'a registered interviewer (plain staff) CAN schedule a session (RLS write)');                -- 45

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.schedule_session((select id from i3), null, 'presencial', now(), null, null, null) $$,
  'HC039', null, 'a non-interviewer staff CANNOT schedule a session (HC039)');                 -- 46
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.no_show_session((select id from s4), 'não compareceu');
reset role;
select is((select status from public.interview_sessions where id = (select id from s4)),
  'no_show', 'no_show_session → no_show');                                                     -- 47

-- =========================================================================
-- Cross-commission isolation: sa_y sees 0 of comm_x's sessions (RLS).
-- =========================================================================
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.interview_sessions s
   join public.case_interviews i on i.id = s.interview_id
   where i.commission_id = (select comm_x from k)),
  0, 'isolation: sa_y reads 0 comm_x sessions (RLS)');                                         -- 48
reset role;

-- =========================================================================
-- t19 REVOKE guards: PUBLIC has no EXECUTE on any new/reshaped RPC or helper.
-- =========================================================================
select is(has_function_privilege('public',
  'public.create_interview(uuid,text,uuid,text,text)', 'execute'), false,
  't19: PUBLIC cannot execute create_interview');                                              -- 49
select is(has_function_privilege('public',
  'public.update_interview(uuid,text,uuid,text,text)', 'execute'), false,
  't19: PUBLIC cannot execute update_interview');                                              -- 50
select is(has_function_privilege('public',
  'public.conclude_interview(uuid)', 'execute'), false,
  't19: PUBLIC cannot execute conclude_interview');                                            -- 51
select is(has_function_privilege('public',
  'public.cancel_interview(uuid)', 'execute'), false,
  't19: PUBLIC cannot execute cancel_interview');                                              -- 52
select is(has_function_privilege('public',
  'public.schedule_session(uuid,text,text,timestamptz,timestamptz,text,text)', 'execute'), false,
  't19: PUBLIC cannot execute schedule_session');                                              -- 53
select is(has_function_privilege('public',
  'public.update_session(uuid,text,text,timestamptz,timestamptz,text,text)', 'execute'), false,
  't19: PUBLIC cannot execute update_session');                                                -- 54
select is(has_function_privilege('public',
  'public.start_session(uuid)', 'execute'), false,
  't19: PUBLIC cannot execute start_session');                                                 -- 55
select is(has_function_privilege('public',
  'public.complete_session(uuid,timestamptz)', 'execute'), false,
  't19: PUBLIC cannot execute complete_session');                                              -- 56
select is(has_function_privilege('public',
  'public.cancel_session(uuid,text)', 'execute'), false,
  't19: PUBLIC cannot execute cancel_session');                                                -- 57
select is(has_function_privilege('public',
  'public.no_show_session(uuid,text)', 'execute'), false,
  't19: PUBLIC cannot execute no_show_session');                                               -- 58
select is(has_function_privilege('public',
  'public.add_interview_subject(uuid,uuid,text,text,text,text,text)', 'execute'), false,
  't19: PUBLIC cannot execute add_interview_subject');                                         -- 59
select is(has_function_privilege('public',
  'app.assert_session_writable(uuid)', 'execute'), false,
  't19: PUBLIC cannot execute app.assert_session_writable');                                   -- 60

select * from finish();
rollback;
