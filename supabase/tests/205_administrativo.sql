-- Administrativo delegated-capability role (ADR 0061) — the full DB-side test.
-- Migration 20260714000000_administrativo_capabilities.
--
-- Proves:
--   (P) POSITIVE — a coordinator appoints a `staff` member + grants each capability;
--       the holder can create a meeting, create + edit-meta a case, activate +
--       reassign a phase (the assignee gets case READ + phase-form write, NO
--       case_access write — revised ADR 0061), and read the signoff queue.
--   (N) NEGATIVE / ESCALATION — a holder (or a plain staff) can neither appoint nor
--       grant (to self or others); an Administrativo can NOT close/cancel a case,
--       can NOT flip case status directly (RLS), can NOT sign a section or set an
--       outcome; a capability cannot be granted to an unappointed member; a
--       staff_admin cannot be appointed.
--   (K) KILL SWITCH — with the flag OFF, member_can is false (the holder is blocked),
--       while the coordinator arm of update_case_meta stays fully functional.
--   (V) VISIBILITY — the SELECT-only door: self + coordinator read the rows; a
--       foreign coordinator reads none.
--   (B) BOARD — list_cases_board: a coordinator sees the whole board; a create_cases
--       Administrativo sees ONLY cases they can already read (app.can_read_case); a
--       foreign coordinator sees none.
--   (VOC) VOCABULARY — the allowed capability set is enforced in exactly TWO catalog
--       places (measured 2026-08-22 by property, not recall: the CHECK constraint
--       `commission_administrativo_capabilities_capability_check`, and
--       `public.grant_member_capability`'s `not in (...)` whitelist —
--       `revoke_member_capability` has NO whitelist and is not one of them). Until
--       ADR 0134 Increment 2, NOTHING anywhere asserted that an INVALID capability is
--       refused, so the two could have diverged silently. Both are now pinned in both
--       directions, and the two 23514s are told apart by MESSAGE — a whitelist removed
--       from the RPC would still raise 23514 from the CHECK underneath it, which is
--       exactly how this keystone would have gone green while asserting nothing.
--   (A5) AUTO-GRANT — ADR 0134 Amendment 5: `appoint_administrativo` grants
--       `read_cases` (and only that) with the appointment. A DIRECT-INSERT appointment
--       (the seed's path) bypasses the door and therefore grants nothing; re-appointing
--       an appointee who ALREADY STANDS grants nothing either (ADR 0134 Amendment 1
--       §A1.1's no-backfill ruling still governs existing appointees); but re-appointing
--       AFTER A REVOKE does grant — that is a genuinely new appointment. ⛔ The last two
--       are the SAME RPC CALL and only one is a no-op, so both directions are pinned:
--       a pin on either alone would read as a pin on both.
--
-- ⭐ NEUTRALIZATION RECORD (2026-08-22) — every pin above was proven able to fail, and
-- the two that matter are recorded here because a later reader will otherwise assume the
-- obvious mutation is the only one:
--   N1 · drop the CHECK constraint                -> the CHECK negative RED, RPC pin green
--   N2 · delete grant_member_capability's whitelist -> the RPC negative RED, CHECK pin green.
--        ⛔ It still raised 23514 — from the CHECK underneath. An errcode-only throws_ok
--        would have stayed GREEN with the validator gone. The pt-BR message is the
--        assertion.
--   N3 · make the auto-grant unconditional        -> the no-backfill pin RED
--   N4 · move the auto-grant from the DOOR to a table TRIGGER -> the direct-INSERT pin RED.
--        N4 is the one that stops "the door grants it" from being demonstrated by
--        something that is not the door; N3 alone cannot tell those apart.
--   N5 · delete the auto-grant entirely           -> the appoint pin and the
--        re-appoint-after-revoke pin RED
--
-- Personas (bootstrap): sa_x coordinator, st_x + st_x2 plain staff of X, sa_y
-- foreign coordinator. Plus sa_x2 = a SECOND coordinator of X (to test the
-- "appoint a staff_admin" rejection without self-grant noise). st_x is the HOLDER.

begin;
select plan(67);

-- The capability chokepoint is flag-aware; enable the surface + its dependencies.
update app.feature_flags set enabled = true
  where key in ('administrativo', 'cases_multi_phase', 'processless_cases',
                'cases_extras', 'meetings', 'case_access', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u,
         (v->>'form_s')::uuid as form_s,
         (v->>'ver_s')::uuid  as ver_s,
         (v->>'it_gate')::uuid as it_gate,
         (v->>'it_req')::uuid  as it_req,
         (v->>'sec_signoff_a')::uuid as sec_signoff_a,
         (v->>'org_b')::uuid  as org_b
  from ctx;
grant select on k to authenticated;

-- A SECOND coordinator of X (the "appoint a staff_admin target" persona) + a SECOND
-- Administrativo `adm2` (create_cases, but no grant/attribution to the holder's case
-- — the creator-self-grant boundary persona).
create temp table p on commit drop as
  select gen_random_uuid() as sa_x2, gen_random_uuid() as adm2;
grant select on p to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated',
       'authenticated', u || '@test', now(), now()
from (select sa_x2 as u from p union all select adm2 from p) s;
update public.profiles set full_name = 'StaffAdmin X2'
  where id = (select sa_x2 from p);
update public.profiles set full_name = 'Administrativo 2'
  where id = (select adm2 from p);
insert into public.memberships (commission_id, principal_id, role) values
  ((select comm_x from k), (select sa_x2 from p), 'staff_admin'),
  ((select comm_x from k), (select adm2 from p), 'staff');
-- adm2 is appointed with create_cases (built as table owner — bypasses the guarded
-- doors, like the seed does; the appoint/grant RPCs are tested elsewhere here).
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values ((select comm_x from k), (select adm2 from p), (select sa_x from k));
insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values ((select comm_x from k), (select adm2 from p), 'create_cases', (select sa_x from k));

-- =========================================================================
-- (P) The coordinator appoints st_x + grants all four capabilities.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.appoint_administrativo(%L, %L) $$,
         (select comm_x from k), (select st_x from k)),
  'appoint_administrativo: coordinator appoints a staff member');
-- ⭐ A5 KEYSTONE (ADR 0134 Amendment 5) — the appointment ITSELF granted `read_cases`,
-- and NOTHING else. Asserted here, BEFORE the four explicit grants below, because
-- after them the set is indistinguishable from "the coordinator granted five".
-- Vacuity note: an `array_agg` equality (not a count, not an `exists`) is what makes
-- the "and nothing else" half falsifiable — a count of 1 would pass on the wrong
-- literal, and an `exists` would pass on a five-capability auto-grant.
select is(
  (select array_agg(capability order by capability)
     from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select st_x from k)),
  array['read_cases'],
  'A5: appoint_administrativo granted read_cases — exactly that one capability');
select lives_ok(
  format($$ select public.grant_member_capability(%L, %L, 'schedule_meetings') $$,
         (select comm_x from k), (select st_x from k)),
  'grant_member_capability: schedule_meetings');
select lives_ok(
  format($$ select public.grant_member_capability(%L, %L, 'create_cases') $$,
         (select comm_x from k), (select st_x from k)),
  'grant_member_capability: create_cases');
select lives_ok(
  format($$ select public.grant_member_capability(%L, %L, 'assign_case_phases') $$,
         (select comm_x from k), (select st_x from k)),
  'grant_member_capability: assign_case_phases');
select lives_ok(
  format($$ select public.grant_member_capability(%L, %L, 'view_signoffs') $$,
         (select comm_x from k), (select st_x from k)),
  'grant_member_capability: view_signoffs');
reset role;

-- Audit: the appointment + grants each emitted a row (Rule 11).
select cmp_ok(
  (select count(*)::int from public.audit_log
   where action = 'administrativo.appointed' and entity_id = (select st_x from k)),
  '>=', 1, 'audit: administrativo.appointed emitted');
-- ⚠ FIVE, not four, since ADR 0134 Amendment 5: the appointment's own `read_cases`
-- auto-grant fires the same AFTER INSERT audit trigger as the four explicit grants.
-- This number is test-local (it counts rows this test created), but the auto-grant is
-- a NEW row on the appoint path, so it moved.
select is(
  (select count(*)::int from public.audit_log
   where action = 'administrativo_capability.granted' and entity_id = (select st_x from k)),
  5, 'audit: five administrativo_capability.granted rows emitted (4 explicit + the A5 auto-grant)');

-- =========================================================================
-- (V) The SELECT-only door: self reads own capabilities; a foreign coordinator none.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_administrativo_capabilities
   where user_id = (select st_x from k)),
  5, 'RLS: the holder reads their own five capability rows (self arm)');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_administrativos
   where commission_id = (select comm_x from k)),
  0, 'RLS: a foreign coordinator reads 0 appointment rows');
reset role;

-- =========================================================================
-- (P) The holder performs the four delegated actions.
-- =========================================================================
-- 1) schedule a meeting.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_meeting(%L, 'Reunião do Administrativo') $$,
         (select comm_x from k)),
  'create_meeting: the holder (schedule_meetings) can schedule a meeting');

-- 2) create a (process-less) case, capture its id.
create temp table cs on commit drop as
  select (public.create_case((select comm_x from k), 'Caso do Administrativo')).id as case_id;
grant select on cs to authenticated;
reset role;
select ok((select case_id from cs) is not null,
  'create_case: the holder (create_cases) can open a case');

-- 3) edit the case meta through the single audited door.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.update_case_meta(%L, 'Caso do Administrativo (editado)') $$,
         (select case_id from cs)),
  'update_case_meta: the holder (create_cases) can edit label/department');
reset role;
select is(
  (select label from public.cases where id = (select case_id from cs)),
  'Caso do Administrativo (editado)', 'update_case_meta persisted the new label');

-- A pendente phase on the case (built as table owner) to activate/reassign.
create temp table ph on commit drop as select gen_random_uuid() as phase_id;
grant select on ph to authenticated;
insert into public.case_phases
  (id, case_id, position, form_id, form_version_id, status, blocks)
values
  ((select phase_id from ph), (select case_id from cs), 1, (select form_u from k),
   (select ver_u from k), 'pending', '{}');

-- 4a) activate the phase, assigning st_x2. Revised ADR 0061: assignment grants NO
-- case_access WRITE — only phase-form write (assigned_to) + case READ (assignee arm).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.activate_phase(%L, %L) $$,
         (select phase_id from ph), (select st_x2 from k)),
  'activate_phase: the holder (assign_case_phases) can activate + assign a phase');
reset role;
select ok(
  not exists (select 1 from public.case_access_grants
              where case_id = (select case_id from cs) and principal_id = (select st_x2 from k)
                and write_case_content),
  'activate_phase does NOT grant the assignee a write grant (revised ADR 0061)');
select ok(
  not app.can_write_case_content((select case_id from cs), (select st_x2 from k)),
  'activate_phase: the assignee has NO case-content write');
select ok(
  app.can_read_case((select case_id from cs), (select st_x2 from k)),
  'activate_phase: the assignee CAN read the case (assignee arm)');

-- 4b) reassign the phase to st_x — same revised model: read (assignee arm), no write.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.reassign_phase(%L, %L) $$,
         (select phase_id from ph), (select st_x from k)),
  'reassign_phase: the holder can reassign the phase');
reset role;
select ok(
  not exists (select 1 from public.case_access_grants
              where case_id = (select case_id from cs) and principal_id = (select st_x from k)
                and write_case_content),
  'reassign_phase does NOT grant the new assignee case_access write (revised ADR 0061)');
select ok(
  not app.can_write_case_content((select case_id from cs), (select st_x from k)),
  'reassign_phase: the new assignee has NO case-content write');
select ok(
  app.can_read_case((select case_id from cs), (select st_x from k)),
  'reassign_phase: the new assignee CAN read the case (assignee arm)');

-- 5) read the signoff queue. Build an in_progress response of form_s (sectioned,
-- with a staff_admin signoff section) so the queue is non-empty.
create temp table rq on commit drop as select gen_random_uuid() as resp_id;
grant select on rq to authenticated;
insert into public.responses
  (id, form_version_id, commission_id, created_by, status, started_at, updated_at)
values
  ((select resp_id from rq), (select ver_s from k), (select comm_x from k),
   (select st_x2 from k), 'in_progress', now(), now());
select test_helpers.add_selection((select resp_id from rq), (select it_gate from k), array['nao']);
select test_helpers.add_selection((select resp_id from rq), (select it_req from k), array['sim']);

-- coordinator count vs holder (view_signoffs) count vs a no-cap staff count.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table sq_coord on commit drop as
  select count(*)::int as n from public.list_signoff_queue((select comm_x from k));
grant select on sq_coord to authenticated;
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table sq_holder on commit drop as
  select count(*)::int as n from public.list_signoff_queue((select comm_x from k));
grant select on sq_holder to authenticated;
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
create temp table sq_nocap on commit drop as
  select count(*)::int as n from public.list_signoff_queue((select comm_x from k));
grant select on sq_nocap to authenticated;
reset role;

select cmp_ok((select n from sq_coord), '>=', 1,
  'list_signoff_queue: the coordinator sees at least one pending signoff');
select is((select n from sq_holder), (select n from sq_coord),
  'list_signoff_queue: the holder (view_signoffs) sees the SAME rows as the coordinator');
select is((select n from sq_nocap), 0,
  'list_signoff_queue: a plain staff (no view_signoffs) sees an empty queue');

-- Drill-in read parity: a view_signoffs holder can READ the response behind a queue
-- row (get_response_for_signoff); a no-cap staff cannot (404 → no_data_found P0002).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  public.get_response_for_signoff((select resp_id from rq)) is not null,
  'get_response_for_signoff: a view_signoffs holder can read the signoff response');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.get_response_for_signoff(%L) $$, (select resp_id from rq)),
  'P0002', null, 'get_response_for_signoff: a plain staff (no view_signoffs) is denied (no_data_found)');
reset role;

-- =========================================================================
-- (B) list_cases_board — coordinator sees all; a create_cases Administrativo sees
-- only cases they can already read (the holder is a phase ASSIGNEE of the case they
-- created, so it is readable). A second case, coordinator-created with NO holder
-- attribution, must NOT appear on the holder's board.
-- =========================================================================
create temp table cs2 on commit drop as select gen_random_uuid() as case_id;
grant select on cs2 to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select case_id from cs2), (select comm_x from k), 9301, 'Caso sem acesso',
        (select sa_x from k));
-- A LOCKED case, for the ADR 0134 Amendment 4 bound below.
create temp table cs2l on commit drop as select gen_random_uuid() as case_id;
grant select on cs2l to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by, visibility_policy)
values ((select case_id from cs2l), (select comm_x from k), 9302, 'Caso trancado',
        (select sa_x from k), 'explicit_grants_only');

-- Holder board: contains the readable (created + assigned) case, NOT the no-access one.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
          where b.case_id = (select case_id from cs)),
  'list_cases_board: the holder sees a case they can read (phase assignee)');
-- ⛔ RE-ANCHORED FOR ADR 0134 D6/S8 — A SUBSTITUTION, NOT NEW COVERAGE.
-- REPLACED: 'list_cases_board: the holder does NOT see a case they cannot read (no
--            broadening)'  — an ADR-0061 assertion that st_x, holding create_cases,
--            saw only cases they could already read.
-- WHY it had to go: st_x is appointed through the DOOR at :84, so since ADR 0134
--   Amendment 5 they also hold `read_cases`, and S8 gives them commission-wide read on
--   ordinary cases. The old sentence is now FALSE OF THIS PERSONA — the behaviour it
--   guarded did not regress, the persona changed underneath it.
-- REPLACED BY, in order:
--   (a) the same "create_cases does not broaden the board" claim, moved to the persona
--       for whom it is still true — `adm2`, who holds create_cases and NOT read_cases;
--   (b) an S8-EXPLICIT positive for st_x, with a zero-grant control so it names S8;
--   (c) the Amendment-4 bound, on a locked case S8 must not reach.
select ok(
  exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
          where b.case_id = (select case_id from cs2)),
  '(b) S8: the holder DOES now see a coordinator-created case with no attribution — commission-wide read (ADR 0134 D6)');
select is(
  (select count(*)::int from public.case_access_grants
    where case_id = (select case_id from cs2) and principal_id = (select st_x from k)),
  0, '(b) CONTROL: …and holds ZERO grants on it, so that reach is S8 and not S3');
select ok(
  not exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
             where b.case_id = (select case_id from cs2l)),
  '(c) S8 BOUND (ADR 0134 Amdt 4): …but an explicit_grants_only case stays off their board');
reset role;

-- (a) The ORIGINAL "create_cases does not broaden the board" claim, re-anchored on adm2,
-- who holds create_cases and NOT read_cases — the persona for whom it is still true.
select test_helpers.claims_for((select adm2 from p), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
             where b.case_id = (select case_id from cs2)),
  '(a) create_cases alone does NOT broaden the board — a create_cases-only Administrativo still sees only what they can read (the claim the re-anchored assertion above used to make)');
reset role;

-- Coordinator board: the whole commission board (both cases).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(
  exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
          where b.case_id = (select case_id from cs2)),
  'list_cases_board: the coordinator sees the no-access case (full board)');
select cmp_ok(
  (select count(*)::int from public.list_cases_board((select comm_x from k), 200)),
  '>=', 2, 'list_cases_board: the coordinator sees at least both cases');
reset role;

-- Boundary: a foreign coordinator sees nothing of this commission's board.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_cases_board((select comm_x from k), 200)),
  0, 'list_cases_board: a foreign coordinator sees an empty board (boundary)');
reset role;

-- =========================================================================
-- (B2) CREATOR SELF-GRANT (ADR 0061) — a create_cases Administrativo who creates a
-- case (process-less, NO phase/assignment) can still read it + see it on their board
-- via the create-time case_access self-grant. A second Administrativo (adm2, no grant
-- to this case) cannot. Proves the grant is per-creator and not a can_read_case
-- creator arm.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table cs3 on commit drop as
  select (public.create_case((select comm_x from k), 'Caso auto-concedido')).id as case_id;
grant select on cs3 to authenticated;
reset role;

-- The self-grant row exists at level READ (revised model — the mechanism is
-- case_access, not a can_read_case arm; read-only, NOT write).
select ok(
  exists (select 1 from public.case_access_grants
          where case_id = (select case_id from cs3) and principal_id = (select st_x from k)
            and read_case_content and not write_case_content),
  'create_case: a non-coordinator creator self-grants a READ grant');
-- can_read_case is true for the creator (via the read grant); content-write is FALSE.
select ok(app.can_read_case((select case_id from cs3), (select st_x from k)),
  'can_read_case: the creator can read their self-granted case (no creator arm needed)');
select ok(not app.can_write_case_content((select case_id from cs3), (select st_x from k)),
  'can_write_case_content: the creator has READ only, NOT write (revised ADR 0061)');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
          where b.case_id = (select case_id from cs3)),
  'list_cases_board: the creator sees the case they opened');
reset role;

-- adm2 — a DIFFERENT create_cases Administrativo with no grant to this case — cannot.
select ok(not app.can_read_case((select case_id from cs3), (select adm2 from p)),
  'can_read_case: a second Administrativo (no grant) cannot read the creator''s case');
select test_helpers.claims_for((select adm2 from p), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.list_cases_board((select comm_x from k), 200) b
             where b.case_id = (select case_id from cs3)),
  'list_cases_board: a second Administrativo does NOT see the creator''s case');
reset role;

-- =========================================================================
-- (N) ESCALATION / BOUNDARY — the holder can never escalate.
-- =========================================================================
-- A holder cannot appoint or grant (they are not a coordinator).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.appoint_administrativo(%L, %L) $$,
         (select comm_x from k), (select st_x2 from k)),
  '42501', null, 'appoint_administrativo: a HOLDER cannot appoint others (42501)');
select throws_ok(
  format($$ select public.grant_member_capability(%L, %L, 'create_cases') $$,
         (select comm_x from k), (select st_x from k)),
  '42501', null, 'grant_member_capability: a HOLDER cannot grant (even to self) (42501)');
-- A holder cannot conclude / cancel a case (coordinator-only, defense-in-depth).
select throws_ok(
  format($$ select public.close_case(%L) $$, (select case_id from cs)),
  '42501', null, 'close_case: an Administrativo cannot conclude a case (42501)');
select throws_ok(
  format($$ select public.cancel_case(%L) $$, (select case_id from cs)),
  '42501', null, 'cancel_case: an Administrativo cannot cancel a case (42501)');
-- A holder cannot set an outcome (conclude-adjacent → coordinator-only).
select throws_ok(
  format($$ select public.set_case_outcome(%L, null) $$, (select case_id from cs)),
  '42501', null, 'set_case_outcome: an Administrativo cannot set an outcome (42501)');
-- A holder cannot sign a section (signing stays coordinator-only).
select throws_ok(
  format($$ select public.sign_section(%L, %L) $$,
         (select resp_id from rq), (select sec_signoff_a from k)),
  '42501', null, 'sign_section: an Administrativo cannot sign a section (42501)');
-- A holder cannot flip case status by a DIRECT UPDATE (no cases write policy for
-- member_can — the leak guardrail). RLS filters the row → 0 rows, status unchanged.
update public.cases set status = 'completed' where id = (select case_id from cs);
reset role;
select isnt(
  (select status from public.cases where id = (select case_id from cs)),
  'completed', 'direct UPDATE by a holder does NOT conclude the case (cases_staff_admin_write unbroadened)');

-- A plain staff (no appointment) cannot create a case.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'x') $$, (select comm_x from k)),
  '42501', null, 'create_case: a plain staff (no create_cases) is denied (42501)');
-- A plain staff cannot appoint.
select throws_ok(
  format($$ select public.appoint_administrativo(%L, %L) $$,
         (select comm_x from k), (select st_x from k)),
  '42501', null, 'appoint_administrativo: a plain staff cannot appoint (42501)');
reset role;

-- A coordinator cannot grant a capability to an UNAPPOINTED member (FK: 23503).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.grant_member_capability(%L, %L, 'create_cases') $$,
         (select comm_x from k), (select st_x2 from k)),
  '23503', null, 'grant_member_capability: an unappointed member is rejected (FK 23503)');
-- A coordinator cannot appoint a staff_admin (only a `staff` member is eligible).
select throws_ok(
  format($$ select public.appoint_administrativo(%L, %L) $$,
         (select comm_x from k), (select sa_x2 from p)),
  '42501', null, 'appoint_administrativo: a staff_admin target is rejected (42501)');
reset role;

-- =========================================================================
-- (K) KILL SWITCH — flag OFF makes member_can false; the coordinator arm stays live.
-- =========================================================================
update app.feature_flags set enabled = false where key = 'administrativo';

-- The holder is now blocked (member_can flag-aware) from a delegated action.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_meeting(%L, 'Reunião no escuro') $$,
         (select comm_x from k)),
  '42501', null, 'flag OFF: the holder is blocked from create_meeting (kill switch)');
reset role;

-- The coordinator arm of update_case_meta is flag-INDEPENDENT (zero coordinator
-- behavior change while dark) — the coordinator still edits meta.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.update_case_meta(%L, 'Editado pelo coordenador') $$,
         (select case_id from cs)),
  'flag OFF: the coordinator arm of update_case_meta stays fully functional');
reset role;

update app.feature_flags set enabled = true where key = 'administrativo';

-- =========================================================================
-- (A5) NO BACKFILL — ADR 0134 Amendment 1 §A1.1 survives Amendment 5.
-- `adm2` was appointed by DIRECT INSERT at the top of this file holding exactly
-- `create_cases` — the shape of every appointee that predates the M1 migration.
-- Re-appointing them through the door must NOT hand them `read_cases`: the
-- auto-grant is bound to the appointment INSERT, and `on conflict do nothing`
-- means no appointment happened here.
-- ⚠ This runs LAST on purpose. It reads adm2's capability set, and the (VOC)
-- block below deliberately widens it.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.appoint_administrativo(%L, %L) $$,
         (select comm_x from k), (select adm2 from p)),
  'A5: re-appointing an existing appointee is accepted (idempotent no-op)');
reset role;
select is(
  (select array_agg(capability order by capability)
     from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select adm2 from p)),
  array['create_cases'],
  'A5 NO-BACKFILL: an appointee who already existed keeps exactly their original capabilities');

-- st_x2 is appointed by DIRECT INSERT — the seed's path (supabase/seed.sql runs as the
-- RLS-exempt owner and never calls the DEFINER doors). ADR 0134 §A5.3: that path gains
-- nothing from the auto-grant, and the two paths must be asserted separately or the
-- seed's row would be read as evidence about the door.
insert into public.commission_administrativos (commission_id, user_id, appointed_by)
values ((select comm_x from k), (select st_x2 from k), (select sa_x from k));
select is(
  (select count(*)::int from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select st_x2 from k)),
  0, 'A5: a DIRECT-INSERT appointment bypasses the door and confers ZERO capabilities');

-- =========================================================================
-- (VOC) THE CAPABILITY VOCABULARY — both validators, both directions.
-- Validator 1: the CHECK constraint (a direct INSERT as owner; RLS is not in play,
-- the appointment FK is satisfied by st_x2's row above, and the PK is free — so the
-- ONLY thing that can raise 23514 here is the CHECK itself).
-- =========================================================================
select throws_ok(
  format($$ insert into public.commission_administrativo_capabilities
              (commission_id, user_id, capability, granted_by)
            values (%L, %L, 'bogus_cap', %L) $$,
         (select comm_x from k), (select st_x2 from k), (select sa_x from k)),
  '23514', null,
  'VOC CHECK: an unknown capability literal is refused by the CHECK constraint (23514)');
select lives_ok(
  format($$ insert into public.commission_administrativo_capabilities
              (commission_id, user_id, capability, granted_by)
            values (%L, %L, 'read_cases', %L) $$,
         (select comm_x from k), (select st_x2 from k), (select sa_x from k)),
  'VOC CHECK: read_cases is accepted by the CHECK constraint');
select is(
  (select array_agg(capability order by capability)
     from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select st_x2 from k)),
  array['read_cases'],
  'VOC CHECK: …and the row actually landed (lives_ok alone would pass on a silent no-op)');

-- Validator 2: `public.grant_member_capability`'s `not in (...)` whitelist.
-- ⛔ THE MESSAGE IS LOAD-BEARING, NOT DECORATION. Removing the whitelist does not make
-- this call succeed — the INSERT underneath then trips the CHECK and raises 23514 too.
-- An errcode-only `throws_ok` would stay GREEN with the whitelist deleted, which is the
-- "a door can have two locks" vacuity shape. Pinning the pt-BR message is what makes
-- the assertion name the RPC's own arm.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.grant_member_capability(%L, %L, 'bogus_cap') $$,
         (select comm_x from k), (select adm2 from p)),
  '23514', 'capacidade inválida',
  'VOC RPC: grant_member_capability refuses an unknown capability with its OWN guard');
select lives_ok(
  format($$ select public.grant_member_capability(%L, %L, 'read_cases') $$,
         (select comm_x from k), (select adm2 from p)),
  'VOC RPC: grant_member_capability accepts read_cases');
reset role;
select is(
  (select array_agg(capability order by capability)
     from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select adm2 from p)),
  array['create_cases', 'read_cases'],
  'VOC RPC: …and the read_cases row actually landed (the door is idempotent, not inert)');

-- =========================================================================
-- (A5) REVOKE → RE-APPOINT **IS** A NEW APPOINTMENT — the other half of the
-- no-backfill pin. ⛔ These two are the SAME RPC CALL and only ONE of them is a
-- no-op, so a pin on either one alone READS as a pin on both: re-appointing a
-- STANDING appointee grants nothing (the appointment insert conflicts away);
-- re-appointing after a revoke grants `read_cases` again, because the revoke
-- FK-cascaded every capability row and the appointment is genuinely new.
-- The zero-capability check between them is a CONTROL, not decoration — without
-- it the final assertion could be satisfied by a surviving row rather than by
-- the door.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.revoke_administrativo(%L, %L) $$,
         (select comm_x from k), (select adm2 from p)),
  'A5: the coordinator revokes the appointment');
reset role;
select is(
  (select count(*)::int from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select adm2 from p)),
  0, 'A5 CONTROL: revoking the appointment FK-cascaded every capability row away');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.appoint_administrativo(%L, %L) $$,
         (select comm_x from k), (select adm2 from p)),
  'A5: the coordinator re-appoints them');
reset role;
select is(
  (select array_agg(capability order by capability)
     from public.commission_administrativo_capabilities
    where commission_id = (select comm_x from k) and user_id = (select adm2 from p)),
  array['read_cases'],
  'A5: re-appointing AFTER a revoke IS a new appointment — read_cases is granted again, and only that');

select * from finish();
rollback;
