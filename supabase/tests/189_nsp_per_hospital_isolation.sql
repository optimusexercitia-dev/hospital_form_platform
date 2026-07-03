-- NSP-per-HOSPITAL cross-hospital PHI isolation gate (ADR 0052; migration
-- 20260710000000). The per-hospital successor to 173_nsp_per_org_isolation.
--
-- SECURITY MANDATE: an ADVERSARIAL proof that every PHI door denies CROSS-HOSPITAL
-- access, EVEN WITHIN ONE ORG. A central-a NSP operator must get zero/null/false on
-- secundário-a's PHI (same org!), and vice versa; the org-level nsp_org_admin must
-- get ZERO PHI on EVERY hospital while still reading PHI-free aggregates + curating.
-- If any door leaks across hospitals, that is a BLOCKER application bug.
--
-- Fixture: the SEEDED two-org world where org-A now has TWO hospitals (central-a +
-- secundário-a). Personas + entities are FIXED UUIDs from seed.sql.
--
-- Personas (all password Test1234!):
--   pqs.a      (c2): enrolled in CENTRAL-A roster        → reads central-a PHI ONLY
--   pqs.a2     (c6): enrolled in SECUNDÁRIO-A roster     → reads secundário-a PHI ONLY
--   pqs.b      (c4): enrolled in CENTRAL-B roster        → reads central-b PHI ONLY
--   nspcoord.a (c1): coordinator of CENTRAL-A, UNENROLLED → reads via the COORDINATOR
--                     arm (full local operator, decision 12) despite no membership
--   nspcoord.a2(c5): coordinator of SECUNDÁRIO-A
--   nsporg.a   (e2): nsp_org_admin of org-A, enrolled in NO roster → ZERO PHI, but
--                     curates every hospital + reads PHI-free aggregates
--   orgadmin.a (b1): org_admin of org-A → NO PHI (duty separation)
--
-- Entities:
--   ev_a1  (e1…a1): central-a event, event_patient PRT-0099123
--   ev_a2  (e5…a2): secundário-a event, event_patient PRT-A2-0001
--   ev_b   (e4…b1): central-b event, event_patient PRT-B-0001
--   ref_x  (efa…a4): CROSS-HOSPITAL referral central-a CCIH → secundário-a Segurança
--                    A2, referral_patient PRT-A2-0002 (dual-hospital read)
--   ref_b  (efa…b1): central-b ENC-0003 referral

begin;
select plan(42);

update app.feature_flags set enabled = true where key = 'patient_index';

create temp table personas on commit drop as select
  '00000000-0000-0000-0000-0000000000c2'::uuid as pqs_a,
  '00000000-0000-0000-0000-0000000000c6'::uuid as pqs_a2,
  '00000000-0000-0000-0000-0000000000c4'::uuid as pqs_b,
  '00000000-0000-0000-0000-0000000000c1'::uuid as nspcoord_a,
  '00000000-0000-0000-0000-0000000000c5'::uuid as nspcoord_a2,
  '00000000-0000-0000-0000-0000000000e2'::uuid as nsporg_a,
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-000000000001'::uuid as admin,
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  '05000000-0000-0000-0000-00000000000a'::uuid as hosp_a1,   -- central-a
  '05000000-0000-0000-0000-0000000000a2'::uuid as hosp_a2,   -- secundário-a
  '05000000-0000-0000-0000-00000000000b'::uuid as hosp_b,    -- central-b
  'e1000000-0000-0000-0000-0000000000a1'::uuid as ev_a1,     -- central-a event (PHI)
  'e5000000-0000-0000-0000-0000000000a2'::uuid as ev_a2,     -- secundário-a event (PHI)
  'e4000000-0000-0000-0000-0000000000b1'::uuid as ev_b,      -- central-b event (PHI)
  'efa00000-0000-0000-0000-0000000000a4'::uuid as ref_x,     -- cross-hospital referral (PHI)
  'efa00000-0000-0000-0000-0000000000b1'::uuid as ref_b;     -- central-b referral (PHI)
grant select on personas to authenticated;

-- ============================================================================
-- §1: PQS membership predicate boundary — enrollment is PER HOSPITAL.
-- ============================================================================
select ok(
  app.is_pqs_member_of_for((select hosp_a1 from personas), (select pqs_a from personas)),
  'BOUNDARY: is_pqs_member_of_for(central-a, pqs.a) = true');
select ok(
  not app.is_pqs_member_of_for((select hosp_a2 from personas), (select pqs_a from personas)),
  'BOUNDARY: is_pqs_member_of_for(secundário-a, pqs.a) = false — SAME ORG, different hospital');
select ok(
  app.is_pqs_member_of_for((select hosp_a2 from personas), (select pqs_a2 from personas)),
  'BOUNDARY: is_pqs_member_of_for(secundário-a, pqs.a2) = true');
select ok(
  not app.is_pqs_member_of_for((select hosp_a1 from personas), (select pqs_a2 from personas)),
  'BOUNDARY: is_pqs_member_of_for(central-a, pqs.a2) = false');

-- ============================================================================
-- §2: coordinator predicate + operator (coordinator = full local operator, dec 12)
-- ============================================================================
select ok(
  app.is_nsp_coordinator_of_for((select hosp_a1 from personas), (select nspcoord_a from personas)),
  'BOUNDARY: is_nsp_coordinator_of_for(central-a, nspcoord.a) = true');
select ok(
  not app.is_nsp_coordinator_of_for((select hosp_a2 from personas), (select nspcoord_a from personas)),
  'BOUNDARY: is_nsp_coordinator_of_for(secundário-a, nspcoord.a) = false');
select ok(
  not app.is_pqs_member_of_for((select hosp_a1 from personas), (select nspcoord_a from personas)),
  'BOUNDARY: nspcoord.a is NOT enrolled in central-a roster (curate/operate ≠ member)');
select ok(
  app.is_pqs_operator_of_for((select hosp_a1 from personas), (select nspcoord_a from personas)),
  'OPERATOR: is_pqs_operator_of_for(central-a, nspcoord.a) = true via the COORDINATOR arm');

-- ============================================================================
-- §3: nsp_org_admin predicate — org-level, and it is NOT a member of any roster.
-- ============================================================================
select ok(
  app.is_nsp_org_admin_of_for((select org_a from personas), (select nsporg_a from personas)),
  'BOUNDARY: is_nsp_org_admin_of_for(org-a, nsporg.a) = true');
select ok(
  not app.is_pqs_member_of_any((select nsporg_a from personas)),
  'ZERO-PHI: is_pqs_member_of_any(nsporg.a) = false — enrolled in NO roster');

-- ============================================================================
-- §4: can_read_event / can_read_event_patient — CROSS-HOSPITAL isolation (same org)
-- ============================================================================
select ok(
  app.can_read_event_patient((select ev_a1 from personas), (select pqs_a from personas)),
  'ISOLATION: can_read_event_patient(central-a ev, pqs.a) = true');
select ok(
  not app.can_read_event_patient((select ev_a2 from personas), (select pqs_a from personas)),
  'ISOLATION PROOF: can_read_event_patient(secundário-a ev, pqs.a) = false — SAME ORG, PHI BLOCKED');
select ok(
  app.can_read_event_patient((select ev_a2 from personas), (select pqs_a2 from personas)),
  'ISOLATION: can_read_event_patient(secundário-a ev, pqs.a2) = true');
select ok(
  not app.can_read_event_patient((select ev_a1 from personas), (select pqs_a2 from personas)),
  'ISOLATION PROOF: can_read_event_patient(central-a ev, pqs.a2) = false — SAME ORG, PHI BLOCKED');
-- the coordinator (unenrolled) reads via the operator arm on its own hospital only.
select ok(
  app.can_read_event_patient((select ev_a1 from personas), (select nspcoord_a from personas)),
  'OPERATOR: can_read_event_patient(central-a ev, nspcoord.a) = true (coordinator arm, unenrolled)');
select ok(
  not app.can_read_event_patient((select ev_a2 from personas), (select nspcoord_a from personas)),
  'ISOLATION: can_read_event_patient(secundário-a ev, nspcoord.a) = false (not its hospital)');

-- ============================================================================
-- §5: nsp_org_admin ZERO-PHI keystone — false on EVERY event across BOTH hospitals.
-- ============================================================================
select ok(
  not app.can_read_event_patient((select ev_a1 from personas), (select nsporg_a from personas)),
  'ZERO-PHI KEYSTONE: can_read_event_patient(central-a ev, nsporg.a) = false');
select ok(
  not app.can_read_event_patient((select ev_a2 from personas), (select nsporg_a from personas)),
  'ZERO-PHI KEYSTONE: can_read_event_patient(secundário-a ev, nsporg.a) = false');
select ok(
  not app.can_read_referral_phi((select ref_x from personas), (select nsporg_a from personas)),
  'ZERO-PHI KEYSTONE: can_read_referral_phi(cross-hosp ref, nsporg.a) = false');

-- ============================================================================
-- §6: get_event_patient DEFINER door — non-null own-hospital, NULL foreign hospital.
-- ============================================================================
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select isnt(public.get_event_patient((select ev_a1 from personas)), null,
  'DEFINER DOOR: get_event_patient(central-a ev) as pqs.a returns PHI (entitled)');
select is(public.get_event_patient((select ev_a2 from personas)), null,
  'DEFINER DOOR PROOF: get_event_patient(secundário-a ev) as pqs.a = NULL — cross-hospital BLOCKED');
reset role;

select test_helpers.claims_for((select nsporg_a from personas), false);
set local role authenticated;
select is(public.get_event_patient((select ev_a1 from personas)), null,
  'ZERO-PHI: get_event_patient(central-a ev) as nsporg.a = NULL');
select is(public.get_event_patient((select ev_a2 from personas)), null,
  'ZERO-PHI: get_event_patient(secundário-a ev) as nsporg.a = NULL');
reset role;

-- ============================================================================
-- §7: pqs_inbox — result set scoped to the caller's OPERATOR hospital(s).
-- ============================================================================
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.pqs_inbox()
   where reporting_commission_id in (
     select id from public.commissions where hospital_id = (select hosp_a2 from personas))),
  0,
  'INBOX SCOPE: pqs.a sees ZERO secundário-a events in pqs_inbox()');
select ok(
  (select count(*) from public.pqs_inbox()) >= 1,
  'INBOX SCOPE: pqs.a sees >= 1 central-a event in pqs_inbox()');
reset role;

-- nspcoord.a (unenrolled coordinator) still sees its hospital's inbox (operator arm).
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select ok(
  (select count(*) from public.pqs_inbox()) >= 1,
  'INBOX OPERATOR: nspcoord.a (unenrolled) sees central-a events via the coordinator arm');
reset role;

-- ============================================================================
-- §8: dual-hospital referral — BOTH endpoint hospitals' NSPs read; cross-org denied.
-- ============================================================================
select ok(
  app.can_read_referral_phi((select ref_x from personas), (select pqs_a from personas)),
  'DUAL-HOSPITAL: can_read_referral_phi(cross-hosp ref, pqs.a) = true (SOURCE hospital)');
select ok(
  app.can_read_referral_phi((select ref_x from personas), (select pqs_a2 from personas)),
  'DUAL-HOSPITAL: can_read_referral_phi(cross-hosp ref, pqs.a2) = true (TARGET hospital)');
select ok(
  not app.can_read_referral_phi((select ref_x from personas), (select pqs_b from personas)),
  'ISOLATION: can_read_referral_phi(cross-hosp ref, pqs.b) = false — other ORG');

-- ============================================================================
-- §9: nsp_org_admin PHI-free aggregate doors — curate/report, ZERO PHI columns.
-- ============================================================================
select test_helpers.claims_for((select nsporg_a from personas), false);
set local role authenticated;
-- event rollup: one row per org-a hospital, PHI-free (no patient/code/title keys).
select is(
  (select jsonb_array_length(public.nsp_org_event_rollup((select org_a from personas)))),
  2,
  'AGGREGATE: nsp_org_event_rollup(org-a) returns 2 hospital rows (central-a + secundário-a)');
-- assert the SELECT list carries NO PHI column key (qa keystone).
select is(
  (select bool_or(
     row_obj ? 'name' or row_obj ? 'mrn' or row_obj ? 'patient' or row_obj ? 'code'
     or row_obj ? 'title' or row_obj ? 'description' or row_obj ? 'attending')
   from jsonb_array_elements(public.nsp_org_event_rollup((select org_a from personas))) as row_obj),
  false,
  'PHI-FREE KEYSTONE: nsp_org_event_rollup exposes NO patient/code/title/narrative key');
select is(
  (select jsonb_array_length(public.nsp_org_roster((select org_a from personas)))),
  2,
  'AGGREGATE: nsp_org_roster(org-a) returns 2 hospital rows');
reset role;

-- a foreign nsp_org_admin gate: pqs.a (not nsp_org_admin) is denied the rollup.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.nsp_org_event_rollup(%L::uuid) $$, (select org_a from personas)),
  '42501',
  null,
  'GATE: nsp_org_event_rollup as pqs.a (not nsp_org_admin) raises 42501');
reset role;

-- ============================================================================
-- §10: roster curation duty separation (org tier) — nsporg.a curates any hospital,
--      still reads no PHI; a foreign coordinator cannot curate another hospital.
-- ============================================================================
-- nsporg.a can add a member to secundário-a's roster (curate).
select test_helpers.claims_for((select nsporg_a from personas), false);
set local role authenticated;
select lives_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
    (select hosp_a2 from personas), (select orgadmin_a from personas)),
  'CURATE: nsporg.a add_pqs_member(secundário-a, X) succeeds (org-wide curation)');
reset role;
-- but nsporg.a STILL reads no PHI after curating (curate ≠ read at the org tier).
select ok(
  not app.can_read_event_patient((select ev_a2 from personas), (select nsporg_a from personas)),
  'DUTY SEP: nsporg.a curates secundário-a but STILL reads no PHI there');

-- a central-a coordinator cannot curate secundário-a's roster (foreign hospital).
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
    (select hosp_a2 from personas), (select admin from personas)),
  '42501',
  null,
  'DUTY SEP: nspcoord.a cannot add_pqs_member to secundário-a (foreign hospital → 42501)');
reset role;

-- org_admin cannot write pqs_members directly (only appoints nsp_org_admin).
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
    (select hosp_a1 from personas), (select admin from personas)),
  '42501',
  null,
  'DUTY SEP: org_admin cannot add_pqs_member directly (→ 42501; appoints nsp_org_admin only)');
reset role;

-- ============================================================================
-- §11: dispose_referral_phi — commission-admin/operator of a hospital can dispose;
--      after disposal the PHI door returns null; cross-hospital denial holds.
-- ============================================================================
-- pqs.b (other org) cannot dispose the cross-hospital (org-a) referral.
select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.dispose_referral_phi(%L::uuid, 'other') $$, (select ref_x from personas)),
  '42501',
  null,
  'DISPOSAL GATE: pqs.b (other org) cannot dispose the cross-hospital referral (→ 42501)');
reset role;

-- pqs.a2 (target hospital operator) CAN dispose; then get_referral_patient → null.
select test_helpers.claims_for((select pqs_a2 from personas), false);
set local role authenticated;
select lives_ok(
  format($$ select public.dispose_referral_phi(%L::uuid, 'subject_request') $$, (select ref_x from personas)),
  'DISPOSAL: pqs.a2 (target-hospital operator) disposes the cross-hospital referral PHI');
select is(
  public.get_referral_patient((select ref_x from personas)),
  null,
  'DISPOSAL PROOF: get_referral_patient(cross-hosp ref) = NULL after disposal');
reset role;

-- ============================================================================
-- §12: per-hospital EV sequences are independent (central-a EV-0001 + secundário-a
--      EV-0001 coexist — the per-hospital mint + backstop constraint).
-- ============================================================================
select is(
  (select count(distinct reporting_commission_id)::int
   from public.patient_safety_event
   where code = 'EV-0001'),
  (select count(*)::int from public.patient_safety_event where code = 'EV-0001'),
  'PER-HOSPITAL EV: multiple EV-0001 codes coexist across hospitals (independent sequences)');

-- ============================================================================
-- §13: config is PER HOSPITAL — different RCA windows per hospital.
-- ============================================================================
select is(
  (select count(distinct rca_default_due_days)::int from public.pqs_department
   where hospital_id in ((select hosp_a1 from personas), (select hosp_a2 from personas))),
  2,
  'PER-HOSPITAL CONFIG: central-a and secundário-a have DIFFERENT rca_default_due_days');

select * from finish();
rollback;
