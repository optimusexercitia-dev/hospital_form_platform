-- =============================================================================
-- AUTHZ · EXCLUSION PERIMETER — Unit 1 keystones. ADR 0078.
-- Migration: 20260731000000_authz_exclusion_perimeter_u1.sql
--
-- WHAT THIS PROVES. The READ/ADMINISTER half of the exclusion perimeter is closed:
-- a recused/respondent coordinator can no longer grant/revoke/list case access nor
-- create an interview on the case she is excluded from (at the RPC AND the direct
-- table), and the legacy `case-documents` / `interview-attachments` storage member
-- arms no longer leak case bytes to a commission member.
--
-- ⛔ §7.7 — a NARROWING passes its negative BY CONSTRUCTION, so the POSITIVE TWIN is
-- the review: every deny is paired with the legitimate principal that MUST still pass
-- (a clean coordinator still grants/creates; the referral-snapshot recipient still
-- reads the case-documents object via the OTHER arm, `can_read_snapshot_document`).
--
-- ⛔ §7.1 trap #3 — THE FIXTURE IS THE TRAP. No seeded persona is both EXCLUDED and
-- AUTHORIZED, so an exclusion keystone on a seeded coordinator would die on authority
-- (42501) and assert NOTHING about the exclusion gate. Both excluded principals below
-- are MADE staff_admins, and BOTH legs of the deny (respondent AND recused) are
-- asserted (PRE ⭐) before any door is called. Bootstrap builds a clean world (it
-- truncates), so the referral-snapshot twin is built here, not borrowed from the seed.
-- =============================================================================
begin;
select plan(21);

update app.feature_flags set enabled = true
  where key in ('case_access', 'interviews', 'case_referrals', 'audit_trail', 'attachments');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,   -- clean coordinator (positive twin)
         (v->>'st_x')::uuid   as st_x,   -- respondent_doctor + made staff_admin
         (v->>'st_x2')::uuid  as st_x2,  -- recused + made staff_admin
         (v->>'sa_y')::uuid   as sa_y,   -- coordinator of comm_y = referral recipient
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- FIXTURE · one explicit_grants_only case in comm_x.
--   st_x  = respondent_doctor (excluded via the RESPONDENT leg) + staff_admin
--   st_x2 = recused           (excluded via the RECUSAL  leg)  + staff_admin
--   sa_x  = clean coordinator (not excluded) — the positive twin
--   sa_y  = coordinator of comm_y, the target of a completed referral (snapshot twin)
-- ---------------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-0000000f7001', (select comm_x from k), 99700,
        (select sa_x from k), 'explicit_grants_only');

-- respondent chain for st_x (leg 1)
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000f7101', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000f7102', (select org_x from k), (select st_x from k), 'Dr. Réu');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000f7101', '00000000-0000-0000-0000-0000000f7102');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000f7103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);
insert into public.case_participants (id, case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000f7104', '00000000-0000-0000-0000-0000000f7001',
        '00000000-0000-0000-0000-0000000f7101', '00000000-0000-0000-0000-0000000f7103', true);

-- recusal for st_x2 (leg 2)
insert into public.case_recusals (case_id, user_id, source)
values ('00000000-0000-0000-0000-0000000f7001', (select st_x2 from k), 'coordinator');

-- ⭐⭐ THE PRECONDITION — both excluded principals ALSO hold staff_admin, so the doors
-- reach the EXCLUSION gate (HC0F1) instead of dying on authority (42501).
insert into public.memberships (principal_id, commission_id, role)
values ((select st_x from k),  (select comm_x from k), 'staff_admin'),
       ((select st_x2 from k), (select comm_x from k), 'staff_admin')
on conflict do nothing;

-- storage objects on comm_x's legacy paths (commission-anchored).
--   obj1 (probe.pdf)  = UNSHARED — proves the member arm is gone.
--   obj2 (shared.pdf) = shared into a completed referral to comm_y (snapshot twin).
insert into storage.buckets (id, name) values
  ('case-documents','case-documents'), ('interview-attachments','interview-attachments')
  on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner) values
 ('case-documents',        (select comm_x from k)::text || '/00000000-0000-0000-0000-0000000f7001/probe.pdf',  (select sa_x from k)),
 ('case-documents',        (select comm_x from k)::text || '/00000000-0000-0000-0000-0000000f7001/shared.pdf', (select sa_x from k)),
 ('interview-attachments', (select comm_x from k)::text || '/ffffffff-0000-0000-0000-0000000f7001/probe.pdf',  (select sa_x from k));

-- a completed referral comm_x -> comm_y sharing obj2 as a document snapshot item
select set_config('app.in_referral_rpc', 'on', true);
insert into public.case_referral (id, source_case_id, source_commission_id, target_commission_id,
   type_label, subject, status, response_expected, has_patient)
values ('00000000-0000-0000-0000-0000000f7200', '00000000-0000-0000-0000-0000000f7001',
   (select comm_x from k), (select comm_y from k), 'x', 'x', 'completed', false, false);
insert into public.referral_shared_item (id, referral_id, kind, position, frozen_storage_path)
values ('00000000-0000-0000-0000-0000000f7201', '00000000-0000-0000-0000-0000000f7200', 'document', 0,
   (select comm_x from k)::text || '/00000000-0000-0000-0000-0000000f7001/shared.pdf');
select set_config('app.in_referral_rpc', 'off', true);

-- ===========================================================================
-- PRE-FLIGHT — the fixture is load-bearing; assert it, never assume it.
-- ===========================================================================
select is((select exists (select 1 from app.feature_flags where key = 'case_access')), false, 'B4: case_access flag RETIRED (the grant-door arm is always live)');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f7001', (select st_x from k)), true,
  'PRE ⭐ leg 1/2: st_x is EXCLUDED via the RESPONDENT leg');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), true,
  'PRE ⭐ leg 1/2: st_x ALSO holds staff_admin (reaches the exclusion gate, §7.1 #3)');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f7001', (select st_x2 from k)), true,
  'PRE ⭐ leg 2/2: st_x2 is EXCLUDED via the RECUSAL leg');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x2 from k)), true,
  'PRE ⭐ leg 2/2: st_x2 ALSO holds staff_admin');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f7001', (select sa_x from k)), false,
  'PRE: sa_x is a CLEAN coordinator (not excluded) — the positive twin');
select is(app.can_read_snapshot_document(
    (select comm_x from k)::text || '/00000000-0000-0000-0000-0000000f7001/shared.pdf', (select sa_y from k)), true,
  'PRE: sa_y (target coordinator, NOT a member of comm_x) is a referral-snapshot reader — the twin is real');

-- ===========================================================================
-- ① GRANT / REVOKE / LIST — the recused/respondent coordinator is DENIED (HC0F1)
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$select public.grant_case_access('00000000-0000-0000-0000-0000000f7001', %L, 'read')$$, (select sa_x from k)),
  'HC0F1', null, '①a grant_case_access: RESPONDENT coordinator DENIED (HC0F1)');
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$select public.grant_case_access('00000000-0000-0000-0000-0000000f7001', %L, 'read')$$, (select sa_x from k)),
  'HC0F1', null, '①b grant_case_access: RECUSED coordinator DENIED (HC0F1)');
select throws_ok(
  $$select public.revoke_case_access('00000000-0000-0000-0000-0000000f7001', '00000000-0000-0000-0000-0000000f7001')$$,
  'HC0F1', null, '①c revoke_case_access: RECUSED coordinator DENIED (HC0F1)');
select throws_ok(
  $$select * from public.list_case_access('00000000-0000-0000-0000-0000000f7001')$$,
  'HC0F1', null, '①d list_case_access: RECUSED coordinator DENIED (HC0F1)');
reset role;

-- TWIN: a clean coordinator still administers
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$select public.grant_case_access('00000000-0000-0000-0000-0000000f7001', %L, 'read')$$, (select st_x2 from k)),
  '①TWIN grant_case_access: CLEAN coordinator still grants');
select lives_ok(
  $$select * from public.list_case_access('00000000-0000-0000-0000-0000000f7001')$$,
  '①TWIN list_case_access: CLEAN coordinator still lists');
reset role;

-- ===========================================================================
-- ② INTERVIEW CREATION — DENIED at the RPC and at the direct table (BUG-SUP-002)
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.create_interview('00000000-0000-0000-0000-0000000f7001', 't', null, 'other', 'standard')$$,
  'HC0F1', null, '②a create_interview RPC: RESPONDENT coordinator DENIED (HC0F1)');
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$select public.create_interview('00000000-0000-0000-0000-0000000f7001', 't', null, 'other', 'standard')$$,
  'HC0F1', null, '②b create_interview RPC: RECUSED coordinator DENIED (HC0F1)');
select throws_ok(
  format($$insert into public.case_interviews (commission_id, case_id, interview_number, interview_category, status)
           values (%L, '00000000-0000-0000-0000-0000000f7001', 9999, 'other', 'draft')$$, (select comm_x from k)),
  '42501', null, '②c direct-table INSERT: RECUSED coordinator DENIED by RLS (the DEFINER bypass is closed)');
reset role;

-- TWIN: a clean coordinator still creates an interview
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.create_interview('00000000-0000-0000-0000-0000000f7001', 't', null, 'other', 'standard')$$,
  '②TWIN create_interview: CLEAN coordinator still creates');
reset role;

-- ===========================================================================
-- ③ STORAGE — the legacy member arm is GONE (no member reads the bucket)
-- ===========================================================================
select test_helpers.claims_for((select st_x2 from k), false);  -- excluded member
set local role authenticated;
select is((select count(*)::int from storage.objects
   where bucket_id='case-documents' and name=(select comm_x from k)::text || '/00000000-0000-0000-0000-0000000f7001/probe.pdf'),
  0, '③a case-documents: EXCLUDED member reads 0 (member arm removed)');
select is((select count(*)::int from storage.objects
   where bucket_id='interview-attachments' and name=(select comm_x from k)::text || '/ffffffff-0000-0000-0000-0000000f7001/probe.pdf'),
  0, '③b interview-attachments: EXCLUDED member reads 0 (policy dropped)');
reset role;

select test_helpers.claims_for((select sa_x from k), false);  -- clean member (also a coordinator)
set local role authenticated;
select is((select count(*)::int from storage.objects
   where bucket_id='case-documents' and name=(select comm_x from k)::text || '/00000000-0000-0000-0000-0000000f7001/probe.pdf'),
  0, '③c case-documents: even a CLEAN member reads 0 — loser set is empty (no legit member reader)');
reset role;

-- ③ TWIN — the referral-snapshot arm SURVIVES: the recipient still reads via the OTHER arm.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from storage.objects
   where bucket_id='case-documents' and name=(select comm_x from k)::text || '/00000000-0000-0000-0000-0000000f7001/shared.pdf'),
  1, '③TWIN snapshot: the referral recipient STILL reads via can_read_snapshot_document (load-bearing arm preserved)');
reset role;

-- Close-flow note (the lead's twin): close_case / the case-content RPCs are NOT touched
-- by this unit; the two doors this unit guards (grant, create_interview) are proven above
-- to admit a CLEAN coordinator. A legitimate close by a non-excluded coordinator therefore
-- cannot be caught by the new exclusion checks.

select * from finish();
rollback;
