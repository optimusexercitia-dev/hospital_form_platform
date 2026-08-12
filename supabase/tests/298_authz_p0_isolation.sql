-- AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079) — FIX-C isolation keystones,
-- Batch 4: the FUP-AUTHZ-2 backlog.
--
-- The 2026-08-04 full ARM-1 sweep returned INVARIANT VIOLATED with 15 BLIND gates.
-- Dating each by its creating migration gave 20 allowlisted (all <= 2026-07-17) and
-- 15 violations (all >= 2026-07-18) with ZERO overlap: the violations were not 15
-- oversights, they were *every RLS policy added since the invariant last ran*. This
-- file keystones all 15. None is allowlisted — every one is an ordinary tenant- or
-- case-isolation policy, and an allowlist entry for those would be a silent cap.
--
-- Rules inherited from 250/251/252, each of which HID A REAL RESULT elsewhere:
--   * non-vacuity — the row the DENY cannot see must EXIST (seeded right here), or
--     "reads 0 rows" is true for the boring reason.
--   * assert ROWS / RAISE under `set local role authenticated`, never a predicate
--     call — a correct predicate is not a correct policy (three leak shapes).
--   * every DENY carries a POSITIVE twin, so a fail-closed regression cannot
--     masquerade as passing isolation.
--   * ADR 0079 decision 2 — a WRITE-policy keystone needs a reader-non-writer
--     principal, because row location applies the SELECT policy too. INSERT has no
--     SELECT dependency, so the two ALL policies here are driven by INSERT and a
--     fully-foreign principal is sound for them.
--   * mutation-proven by p0b-isolation-mutation-audit.sh (Batch 4 block) — opening
--     each policy to using(true)/with check(true) must redden ITS keystone.
--
-- Principals (seed personas — this file does NOT call test_helpers.bootstrap(),
-- which truncates the tenant tree the fixtures below hang off):
--   foreign_b  ..b3  staff1.qual.b  — rede B. Foreign to every rede-A commission,
--                                     case, referral and org vocabulary here.
--   sa         ..02  chefe.ccih     — staff_admin of CCIH (a0..a1): the source
--                                     committee of ENC-0001, reader of case d0..c1.
--   farm       ..06  staff1.farm    — staff of Farmácia A (b0..b1). Used twice: the
--                                     referral assignee, and — because he is NOT a
--                                     CCIH member — the TARGETED respondent, so the
--                                     targeted policies are the sole grant (F0).
--   platform   ..b0  platform@      — the real platform_admin (is_admin = true;
--                                     admin@test.local is NOT one).
--   member_a   ..03  enf1.ccih      — a plain `staff` of CCIH (a0..a1). The
--                                     READER-NON-WRITER for GROUP G's write policy
--                                     (ADR 0079 D2): he passes the SELECT gate, so a
--                                     denied INSERT is attributable to the WRITE
--                                     policy and to nothing else.
--
-- Assertion count: 36

begin;
select plan(36);

-- ═══════════════════════════════════════════════════════════════════════════
-- FIXTURES (superuser — setup, not the system under test)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Referral family ────────────────────────────────────────────────────────
-- All five hang off ENC-0001 (efa0..a1): source CCIH a0..a1, target Farmácia A
-- b0..b1, status 'completed'. `can_read_referral_metadata` therefore admits both
-- committees (target only because status <> 'draft') and the hospital's PQS
-- operators — and nobody in rede B.
insert into public.referral_assignments
  (id, referral_id, commission_id, assignee_user_id, assignment_role, status)
values
  ('4b000000-0000-0000-0000-000000000001','efa00000-0000-0000-0000-0000000000a1',
   'b0000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000006',
   'primary_reviewer','pending');

insert into public.referral_case_links
  (id, referral_id, case_id, commission_id, relationship_type, created_by)
values
  ('4b000000-0000-0000-0000-000000000002','efa00000-0000-0000-0000-0000000000a1',
   'dc000000-0000-0000-0000-0000000000a2','a0000000-0000-0000-0000-0000000000a1',
   'related_case','00000000-0000-0000-0000-000000000002');

-- committee_id = the SOURCE commission: `can_read_referral_internal_note` admits a
-- member of the note's OWN committee only (the target committee's members read the
-- target's notes, never the source's).
insert into public.referral_internal_notes
  (id, referral_id, committee_id, author_user_id, body_md)
values
  ('4b000000-0000-0000-0000-000000000003','efa00000-0000-0000-0000-0000000000a1',
   'a0000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',
   'Nota interna do comitê de origem (keystone)');

insert into public.referral_messages
  (id, referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
values
  ('4b000000-0000-0000-0000-000000000004','efa00000-0000-0000-0000-0000000000a1',
   1,'a0000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',
   'general','Mensagem do encaminhamento (keystone)');
insert into public.referral_read_receipts (message_id, user_id, delivered_at, read_at)
values
  ('4b000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006', now(), now());

insert into public.referral_resolutions
  (id, referral_id, resolution_number, resolved_by_commission_id, resolved_by_user_id,
   summary_md, follow_up_required)
values
  ('4b000000-0000-0000-0000-000000000005','efa00000-0000-0000-0000-0000000000a1',
   1,'b0000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000006',
   'Resolução do encaminhamento (keystone)', false);

-- ── Case-scoped correction family (case d0..c1, CCIH) ──────────────────────
-- The three write guards accept a direct INSERT only under their RPC GUC; this is
-- the same escape the correction/reopen RPCs use, scoped to this transaction.
select set_config('app.in_correction_rpc','on',true);
insert into public.case_correction_requests
  (id, case_id, commission_id, kind, case_narrative_id, status, reason, classification, requested_by)
values
  ('4b000000-0000-0000-0000-000000000006','d0000000-0000-0000-0000-0000000000c1',
   'a0000000-0000-0000-0000-0000000000a1','correction','a2200000-0000-0000-0000-0000000000a1',
   'requested','Corrigir um dado clerical do resumo','clerical',
   '00000000-0000-0000-0000-000000000002');
insert into public.case_narrative_revisions
  (id, case_narrative_id, revision_number, body_md, snapshotted_by)
values
  ('4b000000-0000-0000-0000-000000000007','a2200000-0000-0000-0000-0000000000a1',
   1,'Corpo anterior da narrativa (keystone)','00000000-0000-0000-0000-000000000002');
select set_config('app.in_correction_rpc','off',true);

select set_config('app.in_reopen_rpc','on',true);
insert into public.case_reopenings (id, case_id, reason, reopened_by)
values
  ('4b000000-0000-0000-0000-000000000008','d0000000-0000-0000-0000-0000000000c1',
   'Reabertura para nova apuração (keystone)','00000000-0000-0000-0000-000000000002');
select set_config('app.in_reopen_rpc','off',true);

-- ── Accreditation (commission-OWNED framework) ─────────────────────────────
-- owner_commission_id is load-bearing: the policy admits everyone when the owner is
-- NULL (a licensed global catalogue), so a global framework would make the DENY
-- vacuous. E0 asserts the premise rather than trusting this comment.
insert into public.accreditation_frameworks
  (id, key, name, version, owner_commission_id, status)
values
  ('4b000000-0000-0000-0000-000000000009','ona-keystone','ONA (clone keystone)','1',
   'a0000000-0000-0000-0000-0000000000a1','ativo');
insert into public.accreditation_standards
  (id, framework_id, code, title, position, level)
values
  ('4b000000-0000-0000-0000-00000000000a','4b000000-0000-0000-0000-000000000009',
   '1.1','Padrão do framework clonado',1,1);

-- ── Targeted (ethics) lane ─────────────────────────────────────────────────
-- A published choice form on the seeded ethics case ca0..e1 (CCIH), with a response
-- TARGETED at a participant that resolves to staff1.farm (..06) — a Farmácia member,
-- deliberately NOT a CCIH member, so `form_item_options_select` (the member arm)
-- cannot grant him and the *_targeted policies are the sole grant. Options are
-- inserted BEFORE publish (guard_published_structure blocks them after).
insert into public.forms (id, commission_id, title, created_by)
values ('4b000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-0000000000a1',
        'Formulário dirigido (keystone)','00000000-0000-0000-0000-000000000002');
insert into public.form_versions (id, form_id, version_number, status)
values ('4b000000-0000-0000-0000-000000000011','4b000000-0000-0000-0000-000000000010',1,'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
values ('4b000000-0000-0000-0000-000000000012','4b000000-0000-0000-0000-000000000011',0,true);
insert into public.form_items (id, section_id, position, item_type, question_key, label)
values ('4b000000-0000-0000-0000-000000000013','4b000000-0000-0000-0000-000000000012',
        0,'multiple_choice','ks_escolha','Escolha'),
       ('4b000000-0000-0000-0000-00000000001c','4b000000-0000-0000-0000-000000000012',
        1,'multiple_choice','ks_escolha2','Escolha 2');
insert into public.form_item_options (id, item_id, position, code, label)
values ('4b000000-0000-0000-0000-000000000014','4b000000-0000-0000-0000-000000000013',0,'sim','Sim'),
       ('4b000000-0000-0000-0000-000000000015','4b000000-0000-0000-0000-000000000013',1,'nao','Não'),
       ('4b000000-0000-0000-0000-00000000001d','4b000000-0000-0000-0000-00000000001c',0,'a','A');
select public.publish_form_version('4b000000-0000-0000-0000-000000000011');

insert into public.case_phases (id, case_id, position, form_id, form_version_id)
values ('4b000000-0000-0000-0000-000000000016','ca000000-0000-0000-0000-0000000000e1',1,
        '4b000000-0000-0000-0000-000000000010','4b000000-0000-0000-0000-000000000011');

insert into public.participants
  (id, organization_id, participant_type, sensitivity_class, display_name)
values ('4b000000-0000-0000-0000-000000000017','0c000000-0000-0000-0000-00000000000a',
        'professional','professional_identity','Profissional Alvo (keystone)');
insert into public.professional_profiles
  (id, organization_id, user_id, full_name, link_state)
values ('4b000000-0000-0000-0000-000000000018','0c000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-000000000006','Profissional Alvo (keystone)','linked');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('4b000000-0000-0000-0000-000000000017','4b000000-0000-0000-0000-000000000018');
insert into public.case_participants (id, case_id, participant_id, role_id)
values ('4b000000-0000-0000-0000-000000000019','ca000000-0000-0000-0000-0000000000e1',
        '4b000000-0000-0000-0000-000000000017','fc000000-0000-0000-0000-0000000000e1');

insert into public.responses
  (id, form_version_id, commission_id, created_by, status, case_phase_id, target_case_participant_id)
values ('4b000000-0000-0000-0000-00000000001a','4b000000-0000-0000-0000-000000000011',
        'a0000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002',
        'in_progress','4b000000-0000-0000-0000-000000000016',
        '4b000000-0000-0000-0000-000000000019');

-- Answer 1 carries an EXISTING selection (the read keystones); answer 2 is empty and
-- is the INSERT target of the write keystones.
insert into public.answers (id, response_id, item_id, question_key, form_version_id)
values ('4b000000-0000-0000-0000-00000000001b','4b000000-0000-0000-0000-00000000001a',
        '4b000000-0000-0000-0000-000000000013','ks_escolha','4b000000-0000-0000-0000-000000000011'),
       ('4b000000-0000-0000-0000-00000000001e','4b000000-0000-0000-0000-00000000001a',
        '4b000000-0000-0000-0000-00000000001c','ks_escolha2','4b000000-0000-0000-0000-000000000011');
insert into public.answer_selected_options (answer_id, option_id)
values ('4b000000-0000-0000-0000-00000000001b','4b000000-0000-0000-0000-000000000014');

-- ── Referral note-type vocabulary (Referral registros redesign) ────────────
-- Commission-scoped, exactly like case_narrative_types. Owned by CCIH (a0..a1).
insert into public.referral_note_types (id, commission_id, label, description, position)
values
  ('4b000000-0000-0000-0000-00000000001f','a0000000-0000-0000-0000-0000000000a1',
   'Análise técnica (keystone)','Tipo de registro interno para o keystone',1);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000b3'::uuid as foreign_b,  -- staff1.qual.b (rede B)
  '00000000-0000-0000-0000-000000000002'::uuid as sa,         -- chefe.ccih
  '00000000-0000-0000-0000-000000000006'::uuid as farm,       -- staff1.farm = targeted
  '00000000-0000-0000-0000-000000000003'::uuid as member_a,   -- enf1.ccih = reader-non-writer
  '00000000-0000-0000-0000-0000000000b0'::uuid as platform;   -- platform_admin
grant select on k to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP A — referral metadata + internal notes (Referrals-v2 R3/R4/R5, 2026-07-19)
-- `can_read_referral_metadata` / `can_read_referral_internal_note`. DENY = rede B.
-- ═══════════════════════════════════════════════════════════════════════════
select test_helpers.claims_for((select foreign_b from k), false); set local role authenticated;
select is((select count(*)::int from public.referral_assignments
           where id = '4b000000-0000-0000-0000-000000000001'), 0,
  'referral_assignments_select_metadata DENY: a rede-B principal reads 0 of a rede-A referral''s assignments');
select is((select count(*)::int from public.referral_case_links
           where id = '4b000000-0000-0000-0000-000000000002'), 0,
  'referral_case_links_select_metadata DENY: a rede-B principal reads 0 of its case links');
select is((select count(*)::int from public.referral_internal_notes
           where id = '4b000000-0000-0000-0000-000000000003'), 0,
  'referral_internal_notes_select DENY: a rede-B principal reads 0 internal notes');
select is((select count(*)::int from public.referral_read_receipts
           where message_id = '4b000000-0000-0000-0000-000000000004'), 0,
  'referral_read_receipts_select_metadata DENY: a rede-B principal reads 0 read receipts');
select is((select count(*)::int from public.referral_resolutions
           where id = '4b000000-0000-0000-0000-000000000005'), 0,
  'referral_resolutions_select_metadata DENY: a rede-B principal reads 0 resolutions');
reset role;

select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select is((select count(*)::int from public.referral_assignments
           where id = '4b000000-0000-0000-0000-000000000001'), 1,
  'referral_assignments_select_metadata POS: the source committee DOES read the assignment');
select is((select count(*)::int from public.referral_case_links
           where id = '4b000000-0000-0000-0000-000000000002'), 1,
  'referral_case_links_select_metadata POS: the source committee DOES read the case link');
select is((select count(*)::int from public.referral_internal_notes
           where id = '4b000000-0000-0000-0000-000000000003'), 1,
  'referral_internal_notes_select POS: the note''s OWN committee DOES read it');
select is((select count(*)::int from public.referral_read_receipts
           where message_id = '4b000000-0000-0000-0000-000000000004'), 1,
  'referral_read_receipts_select_metadata POS: the source committee DOES read the receipt');
select is((select count(*)::int from public.referral_resolutions
           where id = '4b000000-0000-0000-0000-000000000005'), 1,
  'referral_resolutions_select_metadata POS: the source committee DOES read the resolution');
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP B — referral_requested_actions_write_admin (FOR ALL, app.is_admin())
-- The read arm is deliberately public (`_select_all` is qual=true), so the write
-- policy is the only gate. Driven by INSERT: a FOR-ALL WITH CHECK has no SELECT
-- dependency, so a non-admin tenant principal is a sound negative (ADR 0079 D2).
-- ═══════════════════════════════════════════════════════════════════════════
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select throws_ok(
  $$ insert into public.referral_requested_actions (key, label, position)
     values ('ks_acao_negada','Ação negada',90) $$, '42501', null,
  'referral_requested_actions_write_admin DENY 42501: a commission staff_admin cannot add to the platform vocabulary');
reset role;
select test_helpers.claims_for((select platform from k), true); set local role authenticated;
select lives_ok(
  $$ insert into public.referral_requested_actions (key, label, position)
     values ('ks_acao_permitida','Ação permitida',91) $$,
  'referral_requested_actions_write_admin POS: the platform_admin CAN add to the vocabulary');
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP C — org-scoped vocabulary (ETH·E2 BE-3/BE-6, 2026-07-18)
-- `app.is_org_member(organization_id) or app.is_admin()`. Both seeded rows belong
-- to rede A; the DENY principal is an org-B member and NOT an admin.
-- ═══════════════════════════════════════════════════════════════════════════
select test_helpers.claims_for((select foreign_b from k), false); set local role authenticated;
select is((select count(*)::int from public.case_assignment_roles
           where organization_id = '0c000000-0000-0000-0000-00000000000a'), 0,
  'case_assignment_roles_select DENY: an org-B member reads 0 of rede A''s assignment roles');
select is((select count(*)::int from public.ethics_sanction_types
           where organization_id = '0c000000-0000-0000-0000-00000000000a'), 0,
  'ethics_sanction_types_select DENY: an org-B member reads 0 of rede A''s sanction types');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select cmp_ok((select count(*)::int from public.case_assignment_roles
               where organization_id = '0c000000-0000-0000-0000-00000000000a'), '>', 0,
  'case_assignment_roles_select POS: a rede-A member DOES read rede A''s assignment roles');
select cmp_ok((select count(*)::int from public.ethics_sanction_types
               where organization_id = '0c000000-0000-0000-0000-00000000000a'), '>', 0,
  'ethics_sanction_types_select POS: a rede-A member DOES read rede A''s sanction types');
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP D — case-scoped correction family (Case Corrections, 2026-07-24)
-- All three gate on `app.can_read_case(case_id, auth.uid())`; the narrative-revision
-- policy reaches its case through case_narratives.
-- ═══════════════════════════════════════════════════════════════════════════
select test_helpers.claims_for((select foreign_b from k), false); set local role authenticated;
select is((select count(*)::int from public.case_correction_requests
           where id = '4b000000-0000-0000-0000-000000000006'), 0,
  'case_correction_requests_select DENY: a rede-B principal reads 0 correction requests of a rede-A case');
select is((select count(*)::int from public.case_narrative_revisions
           where id = '4b000000-0000-0000-0000-000000000007'), 0,
  'case_narrative_revisions_select DENY: a rede-B principal reads 0 narrative revisions');
select is((select count(*)::int from public.case_reopenings
           where id = '4b000000-0000-0000-0000-000000000008'), 0,
  'case_reopenings_select DENY: a rede-B principal reads 0 reopening records');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select is((select count(*)::int from public.case_correction_requests
           where id = '4b000000-0000-0000-0000-000000000006'), 1,
  'case_correction_requests_select POS: a reader of the case DOES read the correction request');
select is((select count(*)::int from public.case_narrative_revisions
           where id = '4b000000-0000-0000-0000-000000000007'), 1,
  'case_narrative_revisions_select POS: a reader of the case DOES read the narrative revision');
select is((select count(*)::int from public.case_reopenings
           where id = '4b000000-0000-0000-0000-000000000008'), 1,
  'case_reopenings_select POS: a reader of the case DOES read the reopening record');
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP E — accreditation_standards_select (Phase 16, 2026-08-03)
-- The sibling shape worth naming: accreditation_frameworks_select is COVERED while
-- this policy — which DELEGATES to it — was BLIND. Coverage does not propagate down
-- a delegation.
-- ═══════════════════════════════════════════════════════════════════════════
select is((select owner_commission_id from public.accreditation_frameworks
           where id = '4b000000-0000-0000-0000-000000000009'),
          'a0000000-0000-0000-0000-0000000000a1'::uuid,
  'E0. PREMISE: the keystone framework is commission-OWNED (an owner-NULL global would make the DENY vacuous)');
select test_helpers.claims_for((select foreign_b from k), false); set local role authenticated;
select is((select count(*)::int from public.accreditation_standards
           where id = '4b000000-0000-0000-0000-00000000000a'), 0,
  'accreditation_standards_select DENY: a non-member reads 0 standards of a commission-owned framework');
reset role;
select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select is((select count(*)::int from public.accreditation_standards
           where id = '4b000000-0000-0000-0000-00000000000a'), 1,
  'accreditation_standards_select POS: a member of the owning commission DOES read the standard');
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP F — the targeted (ethics) lane (ETH hotfix 4ee24c8, 2026-07-27)
-- 273 already drives all three POSITIVELY, which is exactly why they were BLIND:
-- ARM 1 OPENS a policy, and a widening is invisible to a suite that only asserts
-- the authorized principal succeeds. The negatives below are the missing half.
--
-- ⚠ ADR 0079 D2 in its predicted shape: answer_selected_options_write_targeted is a
-- FOR ALL policy, so an UPDATE/DELETE keystone would have located its row through
-- the SELECT policy and silently tested that instead. INSERT has no such dependency,
-- so the write gate is the sole gate under test here. The lane is DELETE-then-INSERT
-- (save_section_answers), which makes an INSERT-only widening data-corrupting rather
-- than merely over-permissive — the reason this one is not allowlistable.
-- ═══════════════════════════════════════════════════════════════════════════
select ok(not app.is_member_of_for('a0000000-0000-0000-0000-0000000000a1',
                                   (select farm from k)),
  'F0. PREMISE: the targeted respondent is NOT a member of the form''s commission, so the *_targeted policies are his SOLE grant');

select test_helpers.claims_for((select foreign_b from k), false); set local role authenticated;
select is((select count(*)::int from public.form_item_options
           where item_id = '4b000000-0000-0000-0000-000000000013'), 0,
  'form_item_options_select_targeted DENY: an untargeted foreign principal reads 0 options of the targeted form');
select is((select count(*)::int from public.answer_selected_options
           where answer_id = '4b000000-0000-0000-0000-00000000001b'), 0,
  'answer_selected_options_select_targeted DENY: an untargeted foreign principal reads 0 of the target''s selections');
select throws_ok(
  $$ insert into public.answer_selected_options (answer_id, option_id)
     values ('4b000000-0000-0000-0000-00000000001e','4b000000-0000-0000-0000-00000000001d') $$,
  '42501', null,
  'answer_selected_options_write_targeted DENY 42501: an untargeted foreign principal cannot INSERT a selection');
reset role;

select test_helpers.claims_for((select farm from k), false); set local role authenticated;
select is((select count(*)::int from public.form_item_options
           where item_id = '4b000000-0000-0000-0000-000000000013'), 2,
  'form_item_options_select_targeted POS: the targeted respondent DOES read the choice options');
select is((select count(*)::int from public.answer_selected_options
           where answer_id = '4b000000-0000-0000-0000-00000000001b'), 1,
  'answer_selected_options_select_targeted POS: the targeted respondent DOES read the recorded selection');
select lives_ok(
  $$ insert into public.answer_selected_options (answer_id, option_id)
     values ('4b000000-0000-0000-0000-00000000001e','4b000000-0000-0000-0000-00000000001d') $$,
  'answer_selected_options_write_targeted POS: the targeted respondent CAN INSERT a selection');
reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP G — referral_note_types (referral "Registros internos", 2026-08-11)
-- The vocabulary mirrors case_narrative_types: a member-scoped SELECT policy plus
-- a FOR ALL staff_admin write policy. Both are BRAND NEW, so neither is in any
-- BLIND set and both pass ARM=policy vacuously — ARM=census is what surfaces them
-- and these four assertions are what give them a verdict.
--
-- ⚠ ADR 0079 D2 applied properly: the write DENY uses member_a, a plain CCIH staff
-- who DOES pass the SELECT gate (G1 proves it). A fully-foreign principal would be
-- denied for the boring reason — not being a member at all — and the keystone would
-- not distinguish "not a coordinator" from "not in the tenant".
-- ═══════════════════════════════════════════════════════════════════════════
select test_helpers.claims_for((select foreign_b from k), false); set local role authenticated;
select is((select count(*)::int from public.referral_note_types
           where id = '4b000000-0000-0000-0000-00000000001f'), 0,
  'referral_note_types_select DENY: a rede-B principal reads 0 of rede A''s note types');
reset role;

select test_helpers.claims_for((select member_a from k), false); set local role authenticated;
select is((select count(*)::int from public.referral_note_types
           where id = '4b000000-0000-0000-0000-00000000001f'), 1,
  'referral_note_types_select POS: a plain member of the owning commission DOES read the note type');
select throws_ok(
  $$ insert into public.referral_note_types (commission_id, label, position)
     values ('a0000000-0000-0000-0000-0000000000a1','Tipo negado (keystone)',90) $$,
  '42501', null,
  'referral_note_types_staff_admin_write DENY 42501: a reader-non-writer member cannot add a note type');
reset role;

select test_helpers.claims_for((select sa from k), false); set local role authenticated;
select lives_ok(
  $$ insert into public.referral_note_types (commission_id, label, position)
     values ('a0000000-0000-0000-0000-0000000000a1','Tipo permitido (keystone)',91) $$,
  'referral_note_types_staff_admin_write POS: the commission staff_admin CAN add a note type');
reset role;

select * from finish();
rollback;
