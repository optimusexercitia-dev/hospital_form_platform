-- Cross-org isolation gate (Phase E) — the keystone security assertion for
-- the multi-tenancy phase. Exercises every access path against the SEEDED
-- personas (platform@, orgadmin.a@, orgadmin.b@, chefe.ccih@, staff1.qual.b@)
-- whose UUIDs are FIXED in seed.sql and whose org/commission topology is:
--
--   org rede-a (0c000000-…000a):
--     hospital central-a → CCIH (a0…a1) + Farmácia (b0…b1)
--   org rede-b (0c000000-…000b):
--     hospital central-b → Qualidade (c0…c1)
--
-- Personas:
--   platform@  (b0): is_admin=TRUE, NO commission/org membership  → 0 tenant rows
--   orgadmin.a (b1): org_admin of rede-a ONLY                     → sees rede-a, 0 rede-b
--   orgadmin.b (b2): org_admin of rede-b ONLY                     → sees rede-b, 0 rede-a
--   chefe.ccih (02): staff_admin of CCIH (rede-a) ONLY            → sees CCIH, 0 Farmácia, 0 rede-b
--   staff1.qual.b (b3): staff of Qualidade (rede-b) ONLY          → sees Qualidade, 0 rede-a
--
-- This file targets the seed dataset (NOT bootstrap()) because the PHI duty-
-- separation assertions, the audit-chain verification, and the slug-collision
-- proof all depend on the seeded commissions and their committed responses/events.
-- All assertions run INSIDE a transaction (rollback at end) so writes in this
-- test do not persist.
--
-- NOTE: 160_phase_results.sql is a known-parked failure (product decision
-- pending); it is NOT parked by this file and is excluded from the green bar.

begin;
select plan(74);

-- All feature flags are ON in the seeded DB (20260624130000_feature_flags_default_on.sql).

-- Convenience constants (UUIDs from seed.sql).
create temp table personas on commit drop as select
  '00000000-0000-0000-0000-0000000000b0'::uuid as platform,
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as orgadmin_b,
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_ccih,
  '00000000-0000-0000-0000-0000000000b3'::uuid as staff_qual_b,
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih,
  'b0000000-0000-0000-0000-0000000000b1'::uuid as comm_farm,
  'c0000000-0000-0000-0000-0000000000c1'::uuid as comm_qual;
grant select on personas to authenticated;

-- ============================================================================
-- (1) KEYSTONE: platform_admin sees ZERO rows of EVERY tenant table.
--     The wall holds — this is the inverse of pre-multi-tenancy behaviour.
-- ============================================================================

select test_helpers.claims_for((select platform from personas), true);
set local role authenticated;

-- Core form/response tables
select is((select count(*)::int from public.forms), 0,
  'WALL: platform sees 0 forms');
select is((select count(*)::int from public.form_versions), 0,
  'WALL: platform sees 0 form_versions');
select is((select count(*)::int from public.form_sections), 0,
  'WALL: platform sees 0 form_sections');
select is((select count(*)::int from public.form_items), 0,
  'WALL: platform sees 0 form_items');
select is((select count(*)::int from public.responses), 0,
  'WALL: platform sees 0 responses');
select is((select count(*)::int from public.answers), 0,
  'WALL: platform sees 0 answers');
select is((select count(*)::int from public.response_section_signoffs), 0,
  'WALL: platform sees 0 response_section_signoffs');

-- Cases and case-adjacent tables
select is((select count(*)::int from public.cases), 0,
  'WALL: platform sees 0 cases');
select is((select count(*)::int from public.case_phases), 0,
  'WALL: platform sees 0 case_phases');
select is((select count(*)::int from public.case_events), 0,
  'WALL: platform sees 0 case_events');
select is((select count(*)::int from public.case_documents), 0,
  'WALL: platform sees 0 case_documents');
select is((select count(*)::int from public.case_narratives), 0,
  'WALL: platform sees 0 case_narratives');
select is((select count(*)::int from public.case_access), 0,
  'WALL: platform sees 0 case_access');
select is((select count(*)::int from public.case_action_items), 0,
  'WALL: platform sees 0 case_action_items');
select is((select count(*)::int from public.case_tags), 0,
  'WALL: platform sees 0 case_tags');

-- Meetings + interviews
select is((select count(*)::int from public.meetings), 0,
  'WALL: platform sees 0 meetings');
select is((select count(*)::int from public.meeting_agenda_items), 0,
  'WALL: platform sees 0 meeting_agenda_items');
select is((select count(*)::int from public.meeting_attendees), 0,
  'WALL: platform sees 0 meeting_attendees');
select is((select count(*)::int from public.meeting_cases), 0,
  'WALL: platform sees 0 meeting_cases');
select is((select count(*)::int from public.meeting_action_items), 0,
  'WALL: platform sees 0 meeting_action_items');
select is((select count(*)::int from public.case_interviews), 0,
  'WALL: platform sees 0 case_interviews');

-- NSP / patient-safety PHI tables
select is((select count(*)::int from public.patient_safety_event), 0,
  'WALL: platform sees 0 patient_safety_event');
-- event_patient, referral_patient, case_patient have NO SELECT grant to authenticated —
-- they are accessed only through SECURITY DEFINER doors. A direct query raises 42501
-- (permission denied), which is STRONGER than RLS returning 0; assert that.
select throws_ok(
  $$ select count(*) from public.event_patient $$,
  '42501', null,
  'WALL: platform cannot SELECT event_patient (no grant — stronger than 0 rows)');
select is((select count(*)::int from public.event_triage), 0,
  'WALL: platform sees 0 event_triage');
select is((select count(*)::int from public.rca), 0,
  'WALL: platform sees 0 rca');
select is((select count(*)::int from public.capa_plan), 0,
  'WALL: platform sees 0 capa_plan');

-- Referral PHI tables
select is((select count(*)::int from public.case_referral), 0,
  'WALL: platform sees 0 case_referral');
select throws_ok(
  $$ select count(*) from public.referral_patient $$,
  '42501', null,
  'WALL: platform cannot SELECT referral_patient (no grant — stronger than 0 rows)');
select is((select count(*)::int from public.referral_reply), 0,
  'WALL: platform sees 0 referral_reply');
select is((select count(*)::int from public.referral_shared_item), 0,
  'WALL: platform sees 0 referral_shared_item');

-- case_patient PHI (the third PHI module)
select throws_ok(
  $$ select count(*) from public.case_patient $$,
  '42501', null,
  'WALL: platform cannot SELECT case_patient (no grant — stronger than 0 rows)');

-- Phase results
select is((select count(*)::int from public.phase_results), 0,
  'WALL: platform sees 0 phase_results');

-- Audit: platform sees ONLY the platform chain (org NULL, commission NULL).
-- It sees ZERO org-tier and commission-tier rows.
select is(
  (select count(*)::int from public.audit_log
   where organization_id is not null or commission_id is not null),
  0,
  'WALL: platform sees 0 org/commission-chain audit rows (tenant chain invisible)');

-- DEFINER RPCs fail closed for platform_admin.
select is((select count(*)::int from public.commission_overview()), 0,
  'WALL: commission_overview() returns 0 rows for platform_admin');

reset role;

-- ============================================================================
-- (2) org_admin of rede-a (orgadmin.a) sees ALL of rede-a, ZERO of rede-b.
-- ============================================================================

select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;

-- Sees rede-a commissions (2: CCIH + Farmácia), not rede-b (Qualidade).
select is(
  (select count(*)::int from public.commissions
   where organization_id = (select org_a from personas)),
  2,
  'org_admin A: sees 2 rede-a commissions (CCIH + Farmácia)');
select is(
  (select count(*)::int from public.commissions
   where organization_id = (select org_b from personas)),
  0,
  'org_admin A: sees 0 rede-b commissions');

-- commission_overview() returns only rede-a.
select is(
  (select count(*)::int from public.commission_overview()
   where commission_id = (select comm_ccih from personas)),
  1,
  'org_admin A: commission_overview returns CCIH');
select is(
  (select count(*)::int from public.commission_overview()
   where commission_id = (select comm_qual from personas)),
  0,
  'org_admin A: commission_overview returns 0 of Qualidade (rede-b)');

-- Sees rede-a responses (seeded: 6 CCIH + 4 Farmácia + in_progress = ≥10 total).
select ok(
  (select count(*)::int from public.responses
   where commission_id = (select comm_ccih from personas)) > 0,
  'org_admin A: sees ≥1 CCIH responses');
select is(
  (select count(*)::int from public.responses
   where commission_id = (select comm_qual from personas)),
  0,
  'org_admin A: sees 0 Qualidade (rede-b) responses');

-- dashboard DEFINER RPC on rede-b form returns 0.
select is(
  (select count(*)::int from public.dashboard_form_totals((select comm_qual from personas))),
  0,
  'org_admin A: dashboard_form_totals on rede-b commission returns 0');

-- Sees rede-a cases (CCIH has seeded cases), 0 of rede-b.
select ok(
  (select count(*)::int from public.cases
   where commission_id = (select comm_ccih from personas)) > 0,
  'org_admin A: sees ≥1 CCIH cases');
select is(
  (select count(*)::int from public.cases
   where commission_id = (select comm_qual from personas)),
  0,
  'org_admin A: sees 0 rede-b cases');

-- Audit: reads org-a chain, zero org-b rows.
select is(
  (select count(*)::int from public.audit_log
   where organization_id = (select org_b from personas)),
  0,
  'org_admin A: sees 0 rede-b audit rows');

reset role;

-- ============================================================================
-- (3) PHI duty-separation: org_admin is NOT a PHI reader.
--     Even though org_admin sees everything else in its org, it is explicitly
--     excluded from the PHI-door predicates (can_read_case_patient, get_*_patient).
-- ============================================================================

-- (A) can_read_case_patient returns FALSE for org_admin on a case in their own org.
--     This is a SECURITY DEFINER function called as postgres (superuser), so the
--     role claim governs the INSIDE check, not the outer caller role.
select ok(
  not app.can_read_case_patient(
    'd0000000-0000-0000-0000-0000000000c1',
    (select orgadmin_a from personas)
  ),
  'PHI duty-sep: org_admin A cannot read case_patient on CCIH Caso 0001 (can_read_case_patient=FALSE)');

-- (B) get_case_patient returns NULL for org_admin (not a PQS member, not a
--     coordinator/assignee/grantee of the case).
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;

select is(
  public.get_case_patient('d0000000-0000-0000-0000-0000000000c1'::uuid),
  null,
  'PHI duty-sep: get_case_patient returns null for org_admin A on Caso 0001');

-- (C) get_event_patient returns NULL for org_admin (not a PQS member).
select is(
  public.get_event_patient('e1000000-0000-0000-0000-0000000000a1'::uuid),
  null,
  'PHI duty-sep: get_event_patient returns null for org_admin A on EV-0001');

-- (D) get_referral_patient returns NULL for org_admin (not PQS/source-coord of ENC-0001).
select is(
  public.get_referral_patient('efa00000-0000-0000-0000-0000000000a1'::uuid),
  null,
  'PHI duty-sep: get_referral_patient returns null for org_admin A on ENC-0001');

-- (E) event_patient: no SELECT grant to authenticated — permission denied (hard wall).
select throws_ok(
  $$ select count(*) from public.event_patient $$,
  '42501', null,
  'PHI duty-sep: org_admin A cannot SELECT event_patient (no grant to authenticated)');

-- (F) referral_patient: same hard wall.
select throws_ok(
  $$ select count(*) from public.referral_patient $$,
  '42501', null,
  'PHI duty-sep: org_admin A cannot SELECT referral_patient (no grant to authenticated)');

-- (G) case_patient: same hard wall.
select throws_ok(
  $$ select count(*) from public.case_patient $$,
  '42501', null,
  'PHI duty-sep: org_admin A cannot SELECT case_patient (no grant to authenticated)');

reset role;

-- ============================================================================
-- (4) REGRESSION: chefe.ccih (staff_admin of CCIH, rede-a) sees CCIH data,
--     ZERO of Farmácia (intra-org, different commission) and ZERO of rede-b.
--     Transitive staff_admin isolation survived the RLS rewrite.
-- ============================================================================

select test_helpers.claims_for((select chefe_ccih from personas), false);
set local role authenticated;

-- Sees own CCIH forms.
select ok(
  (select count(*)::int from public.forms
   where commission_id = (select comm_ccih from personas)) > 0,
  'REGRESSION: chefe.ccih sees ≥1 CCIH forms');

-- Does NOT see Farmácia forms (same org, different commission).
select is(
  (select count(*)::int from public.forms
   where commission_id = (select comm_farm from personas)),
  0,
  'REGRESSION: chefe.ccih sees 0 Farmácia forms (intra-org isolation holds)');

-- Does NOT see rede-b Qualidade forms.
select is(
  (select count(*)::int from public.forms
   where commission_id = (select comm_qual from personas)),
  0,
  'REGRESSION: chefe.ccih sees 0 rede-b Qualidade forms');

-- Does NOT see Farmácia responses.
select is(
  (select count(*)::int from public.responses
   where commission_id = (select comm_farm from personas)),
  0,
  'REGRESSION: chefe.ccih sees 0 Farmácia responses (intra-org isolation holds)');

-- Does NOT see Farmácia cases (none seeded there, but the RLS must return 0 too).
select is(
  (select count(*)::int from public.cases
   where commission_id = (select comm_farm from personas)),
  0,
  'REGRESSION: chefe.ccih sees 0 Farmácia cases (intra-org isolation holds)');

-- Does NOT see rede-b Qualidade responses.
select is(
  (select count(*)::int from public.responses
   where commission_id = (select comm_qual from personas)),
  0,
  'REGRESSION: chefe.ccih sees 0 rede-b Qualidade responses');

-- commission_overview() is org-admin only — chefe.ccih (not an org_admin) gets 0 rows.
-- The isolation is enforced by the RPC's org_admin gate; staff_admin visibility is via
-- the commissions table + RLS (tested above via forms/responses).
select is(
  (select count(*)::int from public.commission_overview()),
  0,
  'chefe.ccih: commission_overview returns 0 (RPC is org-admin only, not staff_admin)');

-- Via the commissions table, chefe.ccih sees exactly CCIH (their commission).
select is(
  (select count(*)::int from public.commissions where id = (select comm_ccih from personas)),
  1,
  'chefe.ccih: commissions table shows CCIH (their commission, 1 row)');
select is(
  (select count(*)::int from public.commissions where id = (select comm_farm from personas)),
  0,
  'chefe.ccih: commissions table shows 0 Farmácia rows (intra-org isolation)');

reset role;

-- ============================================================================
-- (5) Cross-org: staff1.qual.b (staff of Qualidade, rede-b) sees rede-b only.
-- ============================================================================

select test_helpers.claims_for((select staff_qual_b from personas), false);
set local role authenticated;

-- rede-a forms and responses are invisible.
select is(
  (select count(*)::int from public.forms
   where commission_id = (select comm_ccih from personas)),
  0,
  'staff.qual.b: sees 0 rede-a CCIH forms');
select is(
  (select count(*)::int from public.responses
   where commission_id = (select comm_ccih from personas)),
  0,
  'staff.qual.b: sees 0 rede-a CCIH responses');
select is(
  (select count(*)::int from public.cases
   where commission_id = (select comm_ccih from personas)),
  0,
  'staff.qual.b: sees 0 rede-a CCIH cases');

reset role;

-- ============================================================================
-- (6) Audit tier access: each persona reads only its authorized tier.
-- ============================================================================

-- Write a row to each tier (as postgres/superuser so audit_write fires cleanly).
select app.audit_write(
  'e2e.plat_test', 'organization',
  (select org_a from personas), null,
  'platform tier test', '{}'::jsonb);

select app.audit_write(
  'e2e.org_test', 'organization',
  (select org_a from personas), null,
  'org tier test', '{}'::jsonb,
  (select org_a from personas));

select app.audit_write(
  'e2e.comm_test', 'commission',
  (select comm_ccih from personas), (select comm_ccih from personas),
  'commission tier test', '{}'::jsonb);

-- platform_admin reads the platform chain.
select test_helpers.claims_for((select platform from personas), true);
set local role authenticated;
select ok(
  (select count(*)::int from public.audit_log
   where action = 'e2e.plat_test' and organization_id is null and commission_id is null) > 0,
  'audit: platform_admin reads platform-chain rows');
-- verify_audit_chain on the platform tier.
select ok(
  (select ok from public.verify_audit_chain(null, null)),
  'audit: platform chain verifies ok for platform_admin');
reset role;

-- org_admin A reads the org chain (and commission chain within rede-a).
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.audit_log
   where action = 'e2e.org_test' and organization_id = (select org_a from personas) and commission_id is null) > 0,
  'audit: org_admin A reads org-A-chain rows');
select ok(
  (select count(*)::int from public.audit_log
   where action = 'e2e.comm_test' and commission_id = (select comm_ccih from personas)) > 0,
  'audit: org_admin A reads CCIH commission-chain rows');
-- verify_audit_chain on the org tier and commission tier.
select ok(
  (select ok from public.verify_audit_chain(null, (select org_a from personas))),
  'audit: org-A chain verifies ok for org_admin A');
select ok(
  (select ok from public.verify_audit_chain((select comm_ccih from personas), null)),
  'audit: CCIH commission chain verifies ok for org_admin A');
-- org_admin A sees 0 rede-b audit rows.
select is(
  (select count(*)::int from public.audit_log
   where organization_id = (select org_b from personas)),
  0,
  'audit: org_admin A sees 0 rede-b audit rows');
reset role;

-- chefe.ccih reads the CCIH commission chain only.
select test_helpers.claims_for((select chefe_ccih from personas), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.audit_log
   where action = 'e2e.comm_test' and commission_id = (select comm_ccih from personas)) > 0,
  'audit: chefe.ccih reads CCIH commission-chain rows');
-- Does NOT read Farmácia audit rows.
select is(
  (select count(*)::int from public.audit_log
   where commission_id = (select comm_farm from personas)),
  0,
  'audit: chefe.ccih sees 0 Farmácia commission-chain audit rows');
reset role;

-- ============================================================================
-- (7) Slug collision: two orgs may each have a "ccih" slug (per-org uniqueness);
--     a duplicate within ONE org raises 23505.
-- ============================================================================

-- Both rede-a (ccih) and rede-b (qualidade) already exist in the seed.
-- We insert "ccih" under rede-b to prove cross-org slug reuse is allowed.
insert into public.commissions (name, slug, hospital_id)
  values ('CCIH Rede-B', 'ccih',
          (select h.id from public.hospitals h
           join public.organizations o on o.id = h.organization_id
           where o.slug = 'rede-b'
           limit 1));

select is(
  (select count(*)::int from public.commissions
   where slug = 'ccih'),
  2,
  'slug uniqueness: two orgs may each have a "ccih" commission (per-org unique)');

-- A second "ccih" under rede-a raises 23505.
select throws_ok(
  $$ insert into public.commissions (name, slug, hospital_id)
     values ('CCIH Rede-A dup', 'ccih',
             (select h.id from public.hospitals h
              join public.organizations o on o.id = h.organization_id
              where o.slug = 'rede-a'
              limit 1)) $$,
  '23505',
  null,
  'slug uniqueness: a second "ccih" within rede-a raises 23505');

select * from finish();
rollback;
