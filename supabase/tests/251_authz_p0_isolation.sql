-- AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14) — FIX-C isolation keystones, Batch 2.
--
-- Closes the remaining high-risk direct-DML WRITE policies flagged BLIND by the
-- write-path sweep (docs/reviews/authz-writepath-audit-findings.md): the meeting
-- family, rca, capa_plan, case_interviews, responses draft-delete, section
-- sign-offs, profile admin-insert, and own-notification-prefs. Companion to 250;
-- same discipline (ADR 0079):
--   * Non-vacuity (§7.10): every DENY runs against a row that EXISTS — seeded, or a
--     throwaway inserted here as an authorized writer. Destructive DELETE tests use
--     DEDICATED throwaway rows so no seed FK dependency (e.g. capa.source_rca_id →
--     rca RESTRICT) can make a positive twin fail for the wrong reason.
--   * Assert the ROWS/RAISE, never a predicate's boolean.
--   * reader-non-writer principal for every UPDATE/DELETE (ADR 0079): an UPDATE/
--     DELETE … WHERE also applies the table's SELECT policy to locate the row, so a
--     fully-foreign principal is stopped by the SELECT gate — not the write policy.
--     The chosen principal CAN read the row (passes SELECT) but is NOT authorized to
--     write it; the write policy is then the sole gate under test.
--   * Every DENY is paired with a POSITIVE twin (the authorized principal DOES act),
--     so a fail-closed regression cannot pass as isolation.
-- Each assertion is MUTATION-PROVEN by p0b-isolation-mutation-audit.sh: open the
-- target policy → the matching `<polname> DENY` keystone reddens; twins stay green.
--
-- Seed topology (fixed UUIDs, supabase/seed.sql):
--   CCIH a0..a1 (rede-A): staff_admin chefe.ccih (..02); members staff1.ccih (..03),
--     staff2.ccih (..04). Meeting f1..e1 (held) + children. Interview f2..e1 (case d0..c1).
--     rca f3..a3 (event e3..a3, hospital 05..a; members ..02 lead, ..03 sme).
--     capa ca..a3 (hospital 05..a). Submitted resp 6bac0a51 + in_progress 0f60692e (both by ..03).
--   Farm b0..b1: staff_admin chefe.farm (..05). in_progress resp e0..e1 (by ..06) w/ signoff section c0..b004.
--   NSP: capa writer nspcoord.a (..c1). Foreign: staff.qual.b (..b3, rede-B).
--   Reader-non-writers: ..03 (meetings/interviews/responses/notif), ..04 (rca/capa).

begin;
-- NOTE: two write policies the lead listed for this batch are DELIBERATELY NOT
-- keystoned here and remain in authz-blind-allowlist.txt as backstopped follow-ups:
--   * responses_delete_own_draft — its status='in_progress' term is independently
--     enforced by trigger guard_submitted_response (deleting a submitted response
--     raises regardless of RLS); its created_by term is SELECT-masked (only the
--     creator/commission_admin see a draft, and the admin deletes via the FOR ALL
--     responses_admin_all). Opening the policy changes nothing observable — not a leak.
--   * notification_preferences_update_own — fully backstopped by select_own: a
--     reassign to another user is blocked by the SELECT policy (the new row must stay
--     visible), not by this policy's WITH CHECK. Reverting it reddens no assertion.
-- Neither can be mutation-proven by reverting ITS gate (ADR 0079: a keystone that
-- cannot redden is not evidence), so they are tracked, not force-fit.
select plan(40);

-- ── Fixtures (as postgres; rolled back at end) ──────────────────────────────
-- Throwaway CCIH meetings: M2 hosts child DELETE fixtures; M_del is the meetings-
-- delete target; M_ins is the child INSERT-positive target; M_sig is in_signature
-- for the signature test. 'held'/'scheduled' leave children unlocked; INSERT does
-- not fire the status-transition guard, so M_sig can start in_signature.
-- M_sig starts 'held' so its attendee can be inserted (child-lock bites only on
-- in_signature+); it is flipped to in_signature below under the RPC-context GUC.
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start, status) values
  ('eb100000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-0000000000a1',9002,'M2 held',   now(),'held'),
  ('eb100000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-0000000000a1',9003,'M_del held',now(),'held'),
  ('eb100000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-0000000000a1',9005,'M_ins held',now(),'held'),
  ('eb100000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-0000000000a1',9004,'M_sig sig', now(),'held');
insert into public.meeting_cases (id, meeting_id, case_id, summary) values
  ('eb200000-0000-0000-0000-000000000002','eb100000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-0000000000c1','ORIG');
insert into public.meeting_attendees (id, meeting_id, user_id, attendance, note) values
  ('eb300000-0000-0000-0000-000000000002','eb100000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','present','ORIG'),
  ('eb300000-0000-0000-0000-000000000004','eb100000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','present','sig');
insert into public.meeting_agenda_items (id, meeting_id, position, title, description) values
  ('eb400000-0000-0000-0000-000000000002','eb100000-0000-0000-0000-000000000002',91,'AG2','ORIG');
-- Flip M_sig held -> in_signature (status transition needs RPC context; scope the GUC).
set local app.in_meeting_rpc = 'on';
update public.meetings set status='in_signature' where id='eb100000-0000-0000-0000-000000000004';
set local app.in_meeting_rpc = 'off';
-- Throwaway rca on event e2..a2 (no seeded rca there; rca has UNIQUE(event_id)) with a
-- non-observer member so an authorized writer (chefe.ccih) can delete it.
insert into public.rca (id, event_id, summary_md) values
  ('eb500000-0000-0000-0000-000000000002','e2000000-0000-0000-0000-0000000000a2','rca2');
insert into public.rca_members (rca_id, user_id, role) values
  ('eb500000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','lead');
-- Throwaway interview (CCIH, same case) for the delete test; category copied from seed.
insert into public.case_interviews (id, commission_id, case_id, interview_number, interview_category, summary_md)
  select 'eb600000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-0000000000a1',
         'd0000000-0000-0000-0000-0000000000c1', 9001, interview_category, 'i2'
  from public.case_interviews where id='f2000000-0000-0000-0000-0000000000e1';
-- Pre-set a known 'ORIG' on the reused seed rows exercised by UPDATE tests, so a
-- DENY (0 rows) leaves 'ORIG' and a POSITIVE lands 'edit' — unambiguous either way.
update public.meetings          set title='ORIG'          where id='f1000000-0000-0000-0000-0000000000e1';
update public.meeting_cases     set summary='ORIG'        where meeting_id='f1000000-0000-0000-0000-0000000000e1';
update public.meeting_attendees set note='ORIG'           where id='476c4eb2-1fcc-4979-8eab-a9d1f5d0f7a8';
update public.meeting_agenda_items set description='ORIG' where id='000a00a0-594f-4bcb-8d61-53bf4c91f0fc';
update public.rca               set summary_md='ORIG'     where id='f3000000-0000-0000-0000-0000000000a3';
update public.capa_plan         set lessons_learned_md='ORIG' where id='ca000000-0000-0000-0000-0000000000a3';
update public.case_interviews   set summary_md='ORIG'     where id='f2000000-0000-0000-0000-0000000000e1';

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000b3'::uuid as foreign_uid,
  '00000000-0000-0000-0000-000000000002'::uuid as sa,            -- chefe.ccih (CCIH staff_admin)
  '00000000-0000-0000-0000-000000000003'::uuid as reader_m,      -- staff1.ccih (meeting/interview/resp/notif reader)
  '00000000-0000-0000-0000-000000000004'::uuid as reader_rc,     -- staff2.ccih (rca/capa reader)
  '00000000-0000-0000-0000-0000000000c1'::uuid as capa_writer,   -- nspcoord.a
  '00000000-0000-0000-0000-000000000005'::uuid as signoff_writer,-- chefe.farm (Farm staff_admin)
  '00000000-0000-0000-0000-0000000000b0'::uuid as platform;      -- platform_admin (is_admin)
grant select on k to authenticated;

-- Helper macro pattern used below for UPDATE/DELETE: set claims + role, run the bare
-- DML (RLS silently yields 0 rows when denied), reset role, then assert post-state as
-- postgres (independent of the actor's own SELECT visibility).

-- ============================================================================
-- MEETINGS  (is_staff_admin_of(commission_id) OR member_can(...,'schedule_meetings'))
-- ============================================================================
-- meetings_staff_admin_insert
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
select throws_ok($$ insert into public.meetings (commission_id, meeting_number, title, scheduled_start)
  values ('a0000000-0000-0000-0000-0000000000a1',9110,'x',now()) $$, '42501', null,
  'meetings_staff_admin_insert DENY 42501: non-staff_admin CCIH member cannot INSERT a meeting');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok($$ insert into public.meetings (commission_id, meeting_number, title, scheduled_start)
  values ('a0000000-0000-0000-0000-0000000000a1',9111,'x',now()) $$,
  'meetings_staff_admin_insert POS: staff_admin CAN insert a meeting');
reset role;
-- meetings_staff_admin_update
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
update public.meetings set title='hijack' where id='f1000000-0000-0000-0000-0000000000e1';
reset role;
select is((select title from public.meetings where id='f1000000-0000-0000-0000-0000000000e1'),'ORIG',
  'meetings_staff_admin_update DENY: reader-non-writer UPDATE left the meeting UNCHANGED');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
update public.meetings set title='edit' where id='f1000000-0000-0000-0000-0000000000e1';
reset role;
select is((select title from public.meetings where id='f1000000-0000-0000-0000-0000000000e1'),'edit',
  'meetings_staff_admin_update POS: staff_admin UPDATE landed');
-- meetings_staff_admin_delete (target M_del)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
delete from public.meetings where id='eb100000-0000-0000-0000-000000000003';
reset role;
select is((select count(*)::int from public.meetings where id='eb100000-0000-0000-0000-000000000003'),1,
  'meetings_staff_admin_delete DENY: reader-non-writer DELETE removed nothing (meeting survives)');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
delete from public.meetings where id='eb100000-0000-0000-0000-000000000003';
reset role;
select is((select count(*)::int from public.meetings where id='eb100000-0000-0000-0000-000000000003'),0,
  'meetings_staff_admin_delete POS: staff_admin DELETE removed the meeting');

-- ============================================================================
-- MEETING_CASES  (is_staff_admin_of(commission_of_meeting) AND can_read_case)
-- ============================================================================
-- insert (POS target M_ins; can_read_case d0..c1 holds for staff_admin)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
select throws_ok($$ insert into public.meeting_cases (meeting_id, case_id)
  values ('eb100000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-0000000000c1') $$, '42501', null,
  'meeting_cases_staff_admin_insert DENY 42501: non-staff_admin cannot link a case to a meeting');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok($$ insert into public.meeting_cases (meeting_id, case_id)
  values ('eb100000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-0000000000c1') $$,
  'meeting_cases_staff_admin_insert POS: staff_admin CAN link a readable case');
reset role;
-- update (reuse e1 meeting_case)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
update public.meeting_cases set summary='hijack' where meeting_id='f1000000-0000-0000-0000-0000000000e1';
reset role;
select is((select summary from public.meeting_cases where meeting_id='f1000000-0000-0000-0000-0000000000e1'),'ORIG',
  'meeting_cases_staff_admin_update DENY: reader-non-writer UPDATE left the link UNCHANGED');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
update public.meeting_cases set summary='edit' where meeting_id='f1000000-0000-0000-0000-0000000000e1';
reset role;
select is((select summary from public.meeting_cases where meeting_id='f1000000-0000-0000-0000-0000000000e1'),'edit',
  'meeting_cases_staff_admin_update POS: staff_admin UPDATE landed');
-- delete (target MC2 on M2)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
delete from public.meeting_cases where id='eb200000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.meeting_cases where id='eb200000-0000-0000-0000-000000000002'),1,
  'meeting_cases_staff_admin_delete DENY: reader-non-writer DELETE removed nothing');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
delete from public.meeting_cases where id='eb200000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.meeting_cases where id='eb200000-0000-0000-0000-000000000002'),0,
  'meeting_cases_staff_admin_delete POS: staff_admin DELETE removed the link');

-- ============================================================================
-- MEETING_ATTENDEES  (is_staff_admin_of(commission_of_meeting))
-- ============================================================================
-- insert (target M_ins)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
select throws_ok($$ insert into public.meeting_attendees (meeting_id, user_id, attendance)
  values ('eb100000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','summoned') $$, '42501', null,
  'meeting_attendees_staff_admin_insert DENY 42501: non-staff_admin cannot add an attendee');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok($$ insert into public.meeting_attendees (meeting_id, user_id, attendance)
  values ('eb100000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','summoned') $$,
  'meeting_attendees_staff_admin_insert POS: staff_admin CAN add an attendee');
reset role;
-- update (reuse e1 attendee 476c4eb2)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
update public.meeting_attendees set note='hijack' where id='476c4eb2-1fcc-4979-8eab-a9d1f5d0f7a8';
reset role;
select is((select note from public.meeting_attendees where id='476c4eb2-1fcc-4979-8eab-a9d1f5d0f7a8'),'ORIG',
  'meeting_attendees_staff_admin_update DENY: reader-non-writer UPDATE left the attendee UNCHANGED');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
update public.meeting_attendees set note='edit' where id='476c4eb2-1fcc-4979-8eab-a9d1f5d0f7a8';
reset role;
select is((select note from public.meeting_attendees where id='476c4eb2-1fcc-4979-8eab-a9d1f5d0f7a8'),'edit',
  'meeting_attendees_staff_admin_update POS: staff_admin UPDATE landed');
-- delete (target AT2 on M2)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
delete from public.meeting_attendees where id='eb300000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.meeting_attendees where id='eb300000-0000-0000-0000-000000000002'),1,
  'meeting_attendees_staff_admin_delete DENY: reader-non-writer DELETE removed nothing');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
delete from public.meeting_attendees where id='eb300000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.meeting_attendees where id='eb300000-0000-0000-0000-000000000002'),0,
  'meeting_attendees_staff_admin_delete POS: staff_admin DELETE removed the attendee');

-- ============================================================================
-- MEETING_AGENDA_ITEMS  (is_staff_admin_of(commission_of_meeting))
-- ============================================================================
-- update (reuse e1 agenda 000a00a0)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
update public.meeting_agenda_items set description='hijack' where id='000a00a0-594f-4bcb-8d61-53bf4c91f0fc';
reset role;
select is((select description from public.meeting_agenda_items where id='000a00a0-594f-4bcb-8d61-53bf4c91f0fc'),'ORIG',
  'meeting_agenda_items_staff_admin_update DENY: reader-non-writer UPDATE left the item UNCHANGED');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
update public.meeting_agenda_items set description='edit' where id='000a00a0-594f-4bcb-8d61-53bf4c91f0fc';
reset role;
select is((select description from public.meeting_agenda_items where id='000a00a0-594f-4bcb-8d61-53bf4c91f0fc'),'edit',
  'meeting_agenda_items_staff_admin_update POS: staff_admin UPDATE landed');
-- delete (target AG2 on M2)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
delete from public.meeting_agenda_items where id='eb400000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.meeting_agenda_items where id='eb400000-0000-0000-0000-000000000002'),1,
  'meeting_agenda_items_staff_admin_delete DENY: reader-non-writer DELETE removed nothing');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
delete from public.meeting_agenda_items where id='eb400000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.meeting_agenda_items where id='eb400000-0000-0000-0000-000000000002'),0,
  'meeting_agenda_items_staff_admin_delete POS: staff_admin DELETE removed the item');

-- ============================================================================
-- MEETING_SIGNATURES insert  (signer_id=auth.uid() AND can_sign_meeting(attendee_id))
--   M_sig is in_signature with attendee AT_sig (user ..03, present). No SELECT dep.
-- ============================================================================
select test_helpers.claims_for((select foreign_uid from k), false); set local role authenticated;
select throws_ok($$ insert into public.meeting_signatures (meeting_id, attendee_id, signer_id)
  values ('eb100000-0000-0000-0000-000000000004','eb300000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-0000000000b3') $$, '42501', null,
  'meeting_signatures_insert DENY 42501: a non-attendee cannot sign for an attendee');
reset role;
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
select lives_ok($$ insert into public.meeting_signatures (meeting_id, attendee_id, signer_id)
  values ('eb100000-0000-0000-0000-000000000004','eb300000-0000-0000-0000-000000000004',
          '00000000-0000-0000-0000-000000000003') $$,
  'meeting_signatures_insert POS: the present attendee CAN sign their own signature');
reset role;

-- ============================================================================
-- RCA  (can_write_rca = pqs_operator OR non-observer rca_member)
--   reader-non-writer = staff2.ccih (reads event, not member/operator).
-- ============================================================================
-- update (reuse f3..a3)
select test_helpers.claims_for((select reader_rc from k), false); set local role authenticated;
update public.rca set summary_md='hijack' where id='f3000000-0000-0000-0000-0000000000a3';
reset role;
select is((select summary_md from public.rca where id='f3000000-0000-0000-0000-0000000000a3'),'ORIG',
  'rca_update DENY: reader-non-writer UPDATE left the rca UNCHANGED');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
update public.rca set summary_md='edit' where id='f3000000-0000-0000-0000-0000000000a3';
reset role;
select is((select summary_md from public.rca where id='f3000000-0000-0000-0000-0000000000a3'),'edit',
  'rca_update POS: an rca lead (non-observer member) UPDATE landed');
-- delete (throwaway R2)
select test_helpers.claims_for((select reader_rc from k), false); set local role authenticated;
delete from public.rca where id='eb500000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.rca where id='eb500000-0000-0000-0000-000000000002'),1,
  'rca_delete DENY: reader-non-writer DELETE removed nothing');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
delete from public.rca where id='eb500000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.rca where id='eb500000-0000-0000-0000-000000000002'),0,
  'rca_delete POS: an rca lead DELETE removed the rca');

-- ============================================================================
-- CAPA_PLAN  (can_write_capa = pqs_operator of the plan hospital)
--   reader-non-writer = staff2.ccih (reads capa, not operator). writer = nspcoord.a.
-- ============================================================================
-- update (reuse ca..a3)
select test_helpers.claims_for((select reader_rc from k), false); set local role authenticated;
update public.capa_plan set lessons_learned_md='hijack' where id='ca000000-0000-0000-0000-0000000000a3';
reset role;
select is((select lessons_learned_md from public.capa_plan where id='ca000000-0000-0000-0000-0000000000a3'),'ORIG',
  'capa_plan_update DENY: reader-non-writer UPDATE left the capa UNCHANGED');
select test_helpers.claims_for((select capa_writer from k), false); set local role authenticated;
update public.capa_plan set lessons_learned_md='edit' where id='ca000000-0000-0000-0000-0000000000a3';
reset role;
select is((select lessons_learned_md from public.capa_plan where id='ca000000-0000-0000-0000-0000000000a3'),'edit',
  'capa_plan_update POS: pqs operator UPDATE landed');
-- delete (ca..a3 cascades cleanly; run after update)
select test_helpers.claims_for((select reader_rc from k), false); set local role authenticated;
delete from public.capa_plan where id='ca000000-0000-0000-0000-0000000000a3';
reset role;
select is((select count(*)::int from public.capa_plan where id='ca000000-0000-0000-0000-0000000000a3'),1,
  'capa_plan_delete DENY: reader-non-writer DELETE removed nothing');
select test_helpers.claims_for((select capa_writer from k), false); set local role authenticated;
delete from public.capa_plan where id='ca000000-0000-0000-0000-0000000000a3';
reset role;
select is((select count(*)::int from public.capa_plan where id='ca000000-0000-0000-0000-0000000000a3'),0,
  'capa_plan_delete POS: pqs operator DELETE removed the capa');

-- ============================================================================
-- CASE_INTERVIEWS  (can_write_interview = NOT excluded AND (staff_admin OR interviewer))
--   reader-non-writer = staff1.ccih (reads interview, not staff_admin/interviewer).
-- ============================================================================
-- update (reuse f2..e1)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
update public.case_interviews set summary_md='hijack' where id='f2000000-0000-0000-0000-0000000000e1';
reset role;
select is((select summary_md from public.case_interviews where id='f2000000-0000-0000-0000-0000000000e1'),'ORIG',
  'case_interviews_update DENY: reader-non-writer UPDATE left the interview UNCHANGED');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
update public.case_interviews set summary_md='edit' where id='f2000000-0000-0000-0000-0000000000e1';
reset role;
select is((select summary_md from public.case_interviews where id='f2000000-0000-0000-0000-0000000000e1'),'edit',
  'case_interviews_update POS: staff_admin UPDATE landed');
-- delete (throwaway I2)
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
delete from public.case_interviews where id='eb600000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.case_interviews where id='eb600000-0000-0000-0000-000000000002'),1,
  'case_interviews_delete DENY: reader-non-writer DELETE removed nothing');
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
delete from public.case_interviews where id='eb600000-0000-0000-0000-000000000002';
reset role;
select is((select count(*)::int from public.case_interviews where id='eb600000-0000-0000-0000-000000000002'),0,
  'case_interviews_delete POS: staff_admin DELETE removed the interview');

-- ============================================================================
-- RESPONSE_SECTION_SIGNOFFS insert  (signed_by=auth.uid() AND can_sign_section)
--   resp e0..e1 in_progress, section c0..b004 (staff_admin role, Farm). No SELECT dep.
-- ============================================================================
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
select throws_ok($$ insert into public.response_section_signoffs (response_id, section_id, signed_by)
  values ('e0000000-0000-0000-0000-0000000000e1','c0000000-0000-0000-0000-00000000b004',
          '00000000-0000-0000-0000-000000000003') $$, '42501', null,
  'signoffs_insert DENY 42501: a non-(Farm staff_admin) cannot sign off the staff_admin section');
reset role;
select test_helpers.claims_for((select signoff_writer from k), false); set local role authenticated;
select lives_ok($$ insert into public.response_section_signoffs (response_id, section_id, signed_by)
  values ('e0000000-0000-0000-0000-0000000000e1','c0000000-0000-0000-0000-00000000b004',
          '00000000-0000-0000-0000-000000000005') $$,
  'signoffs_insert POS: the Farm staff_admin CAN sign off the staff_admin section');
reset role;

-- ============================================================================
-- PROFILES admin_insert  (with check is_admin())
--   Target an EXISTING profile id: a non-admin is blocked by the policy (42501); an
--   admin passes the policy and is then stopped by the PK (23505) — proving the arm.
-- ============================================================================
select test_helpers.claims_for((select reader_m from k), false); set local role authenticated;
select throws_ok($$ insert into public.profiles (id, email)
  values ('00000000-0000-0000-0000-000000000004','dup@test.local') $$, '42501', null,
  'profiles_admin_insert DENY 42501: a non-admin cannot INSERT a profile');
reset role;
select test_helpers.claims_for((select platform from k), true); set local role authenticated;
select throws_ok($$ insert into public.profiles (id, email)
  values ('00000000-0000-0000-0000-000000000004','dup@test.local') $$, '23505', null,
  'profiles_admin_insert POS: an admin passes the policy (reaches the PK — 23505, not 42501)');
reset role;

select * from finish();
rollback;
