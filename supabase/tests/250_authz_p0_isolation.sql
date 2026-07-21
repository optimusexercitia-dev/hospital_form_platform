-- AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14) — FIX-C isolation keystones, Batch 1.
--
-- These close the highest-risk BLIND write gates surfaced by the door/writepath
-- neutralization sweep (docs/reviews/authz-writepath-audit-findings.md): three
-- SECURITY DEFINER raise-guards and the `case_referral` direct-DML write family.
-- A BLIND gate is one that NO keystone asserts through — it ships green over a
-- live leak, the exact vector the known-3 rode. Each assertion here is
-- MUTATION-PROVEN by supabase/tests/mutation/p0b-isolation-mutation-audit.sh:
-- revert the gate to its OPEN form and the matching `KSn` keystone MUST go RED.
--
-- Discipline (ADR 0078 §7.10, [[eth-e1-rls-three-shapes]]):
--   * Non-vacuity: every DENY asserts against a row that EXISTS (we seed the
--     draft referrals first, as an authorized writer), so a `0 rows` / `throws`
--     is a real deny, never `0-from-empty`.
--   * We assert the ROWS/RAISE, not a predicate's boolean return.
--   * Every DENY is paired with a POSITIVE twin (the authorized principal DOES
--     act) so a fail-closed regression (e.g. the [[d11]] stale-status delete bug
--     that removed 0 rows for everyone) cannot masquerade as a passing isolation
--     test. The mutation harness requires the DENY to redden AND the twin to
--     stay green.
--
-- Seed topology (fixed UUIDs, supabase/seed.sql):
--   CCIH  a0..a1 (org rede-A) — source coord = chefe.ccih (..02, staff_admin)
--   Farm  b0..b1 (org rede-A) — target coord = chefe.farm (..05, staff_admin)
--   Qual  c0..c1 (org rede-B) — FOREIGN principal = staff.qual.b (..b3, staff)
--   sent referral CCIH->Farm  efa..a2 ; CCIH interview f2..e1 (session ed1..01 seeded
--   here on it, seq 3); CCIH case d0..c1

begin;
select plan(14);

-- ── Fixtures ───────────────────────────────────────────────────────────────
-- Seed three DRAFT referrals (source = CCIH) directly as postgres so the DENY
-- assertions below run against rows that genuinely EXIST (§7.10 non-vacuity).
insert into public.case_referral
  (id, status, source_case_id, source_commission_id, target_commission_id, type_label, subject)
values
  ('efc00000-0000-0000-0000-000000000001','draft','d0000000-0000-0000-0000-0000000000c1',
   'a0000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-0000000000b1','Tipo','Assunto KS1'),
  ('efc00000-0000-0000-0000-000000000003','draft','d0000000-0000-0000-0000-0000000000c1',
   'a0000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-0000000000b1','Tipo','Assunto KS5'),
  ('efc00000-0000-0000-0000-000000000004','draft','d0000000-0000-0000-0000-0000000000c1',
   'a0000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-0000000000b1','Tipo','Assunto KS6');
-- CCIH interview session on the seeded interview f2..e1 (seq 3 free; 1,2 seeded), so KS3
-- asserts against a session that EXISTS. Without it assert_session_writable raises
-- no_data_found (not HC039) and BOTH twins fail vacuously — a seed-random-id dependency.
insert into public.interview_sessions (id, interview_id, sequence_number, session_type) values
  ('ed100000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-0000000000e1',3,'initial');

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000b3'::uuid as foreign_uid,   -- staff.qual.b (rede-B)
  '00000000-0000-0000-0000-000000000002'::uuid as source_coord,  -- chefe.ccih  (CCIH src)
  '00000000-0000-0000-0000-000000000005'::uuid as target_coord,  -- chefe.farm  (Farm tgt)
  '00000000-0000-0000-0000-000000000003'::uuid as member_ccih,   -- staff1.ccih (CCIH member, NOT coordinator)
  'efc00000-0000-0000-0000-000000000001'::uuid as draft_ks1,
  'efc00000-0000-0000-0000-000000000003'::uuid as draft_ks5,
  'efc00000-0000-0000-0000-000000000004'::uuid as draft_ks6,
  'efa00000-0000-0000-0000-0000000000a2'::uuid as sent_ref,       -- CCIH->Farm, status 'sent'
  'ed100000-0000-0000-0000-000000000001'::uuid as session_ccih,
  'd0000000-0000-0000-0000-0000000000c1'::uuid as case_ccih,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih,
  'b0000000-0000-0000-0000-0000000000b1'::uuid as comm_farm,
  'e0832b5a-7c50-44d3-ad7f-b2bcad20d117'::uuid as ref_type;
grant select on k to authenticated;

-- ============================================================================
-- KS1 — app.assert_referral_draft_writable (via public.update_referral_draft).
--   Only the SOURCE-commission coordinator may edit a draft (errcode HC071).
-- ============================================================================
-- Valid referral_type_id supplied so a reverted guard lets the write REACH success
-- (a clean RED), rather than tripping the later type-validation check.
select test_helpers.claims_for((select foreign_uid from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_referral_draft('efc00000-0000-0000-0000-000000000001'::uuid,
       'e0832b5a-7c50-44d3-ad7f-b2bcad20d117'::uuid, 'x', 'y', true) $$,
  'HC071', null,
  'KS1a HC071: foreign principal (rede-B) cannot edit a CCIH draft referral (assert_referral_draft_writable denies)');
reset role;

select test_helpers.claims_for((select target_coord from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_referral_draft('efc00000-0000-0000-0000-000000000001'::uuid,
       'e0832b5a-7c50-44d3-ad7f-b2bcad20d117'::uuid, 'x', 'y', true) $$,
  'HC071', null,
  'KS1b HC071: target-commission coordinator cannot edit the SOURCE draft (assert_referral_draft_writable denies)');
reset role;

select test_helpers.claims_for((select source_coord from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.update_referral_draft('efc00000-0000-0000-0000-000000000001'::uuid,
       'e0832b5a-7c50-44d3-ad7f-b2bcad20d117'::uuid, 'x', 'y', true) $$,
  'KS1p twin: source-commission coordinator CAN edit its own draft (guard is not fail-closed)');
reset role;

-- ============================================================================
-- KS2 — app.assert_referral_target_acts (via public.receive_referral).
--   Only the TARGET-commission coordinator may act on a sent referral (HC072).
-- ============================================================================
select test_helpers.claims_for((select source_coord from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.receive_referral('efa00000-0000-0000-0000-0000000000a2'::uuid) $$,
  'HC072', null,
  'KS2a HC072: source coordinator cannot perform a TARGET action on a sent referral (assert_referral_target_acts denies)');
reset role;

select test_helpers.claims_for((select foreign_uid from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.receive_referral('efa00000-0000-0000-0000-0000000000a2'::uuid) $$,
  'HC072', null,
  'KS2b HC072: foreign principal (rede-B) cannot perform a TARGET action (assert_referral_target_acts denies)');
reset role;

select test_helpers.claims_for((select target_coord from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.receive_referral('efa00000-0000-0000-0000-0000000000a2'::uuid) $$,
  'KS2p twin: target-commission coordinator CAN receive the referral (guard is not fail-closed)');
reset role;

-- ============================================================================
-- KS3 — app.assert_session_writable (interview-session write guard, delegates
--   to assert_interview_writable → errcode HC039). No RPC drives it, so it is
--   exercised directly; called as postgres with the caller's JWT claim set.
-- ============================================================================
select test_helpers.claims_for((select foreign_uid from k), false);
select throws_ok(
  $$ select app.assert_session_writable('ed100000-0000-0000-0000-000000000001'::uuid) $$,
  'HC039', null,
  'KS3a HC039: foreign principal (rede-B) cannot write a CCIH interview session (assert_session_writable denies)');

select test_helpers.claims_for((select source_coord from k), false);
select lives_ok(
  $$ select app.assert_session_writable('ed100000-0000-0000-0000-000000000001'::uuid) $$,
  'KS3p twin: CCIH staff_admin CAN write the interview session (guard is not fail-closed)');

-- ============================================================================
-- KS4 — RLS policy case_referral_insert_source_coord (WITH CHECK
--   is_staff_admin_of_for(source_commission_id)). Direct-DML boundary: a
--   foreign INSERT naming CCIH as source violates the policy (SQLSTATE 42501).
-- ============================================================================
select test_helpers.claims_for((select foreign_uid from k), false);
set local role authenticated;
select throws_ok(
  $$ insert into public.case_referral
       (status, source_case_id, source_commission_id, target_commission_id, type_label, subject)
     values ('draft','d0000000-0000-0000-0000-0000000000c1',
             'a0000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-0000000000b1','X','Y') $$,
  '42501', null,
  'KS4a 42501: foreign principal cannot direct-INSERT a case_referral with CCIH as source (insert_source_coord policy denies)');
reset role;

select test_helpers.claims_for((select source_coord from k), false);
set local role authenticated;
select lives_ok(
  $$ insert into public.case_referral
       (status, source_case_id, source_commission_id, target_commission_id, type_label, subject)
     values ('draft','d0000000-0000-0000-0000-0000000000c1',
             'a0000000-0000-0000-0000-0000000000a1','b0000000-0000-0000-0000-0000000000b1','X','Y') $$,
  'KS4p twin: source-commission staff_admin CAN direct-INSERT (policy is not fail-closed)');
reset role;

-- ============================================================================
-- KS5 — RLS policy case_referral_update_coord (USING/WITH CHECK
--   can_manage_referral_source OR _target).
--   ⚠ An UPDATE ... WHERE also needs the row to pass the SELECT policy to be
--   located, so a rede-B foreign principal is stopped by the SELECT gate and
--   would NOT isolate this write policy (opening it alone can't redden the row —
--   the exact door-blindness this P0 is about). We therefore use a CCIH member
--   who CAN read the draft (is_member_of source) but is NOT a coordinator
--   (can_manage_referral_source = false): the write policy is the SOLE gate under
--   test. Post-state is read as postgres, independent of actor SELECT visibility.
-- ============================================================================
select test_helpers.claims_for((select member_ccih from k), false);
set local role authenticated;
update public.case_referral set subject = 'hijack'
  where id = 'efc00000-0000-0000-0000-000000000003';
reset role;
select is(
  (select subject from public.case_referral where id = 'efc00000-0000-0000-0000-000000000003'),
  'Assunto KS5',
  'KS5a: a CCIH member who is not a coordinator cannot direct-UPDATE the draft — left UNCHANGED (update_coord policy denies)');

select test_helpers.claims_for((select source_coord from k), false);
set local role authenticated;
update public.case_referral set subject = 'edit'
  where id = 'efc00000-0000-0000-0000-000000000003';
reset role;
select is(
  (select subject from public.case_referral where id = 'efc00000-0000-0000-0000-000000000003'),
  'edit',
  'KS5p twin: source coordinator direct-UPDATE CHANGED the draft (policy is not fail-closed)');

-- ============================================================================
-- KS6 — RLS policy case_referral_delete_draft_source (USING status='draft' AND
--   can_manage_referral_source). ⚠ [[d11]]: this exact family once fail-closed
--   (qual tested the pre-anglicization 'rascunho' → deleted 0 rows for EVERYONE).
--   The twin proves the 'draft' term is LIVE: the source coord DOES delete.
--   As in KS5, a DELETE ... WHERE needs SELECT visibility, so we use the CCIH
--   member (reader, non-coordinator) to isolate the delete policy as the sole
--   gate. KS6a must run before KS6p (it leaves the row; KS6p removes it).
-- ============================================================================
select test_helpers.claims_for((select member_ccih from k), false);
set local role authenticated;
delete from public.case_referral where id = 'efc00000-0000-0000-0000-000000000004';
reset role;
select is(
  (select count(*)::int from public.case_referral where id = 'efc00000-0000-0000-0000-000000000004'),
  1,
  'KS6a: a CCIH member who is not a coordinator cannot direct-DELETE the draft — it survives (delete_draft_source policy denies)');

select test_helpers.claims_for((select source_coord from k), false);
set local role authenticated;
delete from public.case_referral where id = 'efc00000-0000-0000-0000-000000000004';
reset role;
select is(
  (select count(*)::int from public.case_referral where id = 'efc00000-0000-0000-0000-000000000004'),
  0,
  'KS6p twin: source coordinator direct-DELETE removed the draft ([[d11]] fail-closed guard — the draft term is live)');

select * from finish();
rollback;
