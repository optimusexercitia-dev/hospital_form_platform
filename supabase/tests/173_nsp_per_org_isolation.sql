-- NSP-per-org cross-org PHI isolation gate (ADR 0042; migration 20260630000000).
-- REPLACES 173_multi_org_phi_guard.sql (which asserted the now-lifted global-PQS
-- inert behavior; its assertions would now FAIL because patient_safety_enabled() and
-- referrals_enabled() are TRUE again with 2 orgs + the per-org binding).
--
-- SECURITY MANDATE: This is an ADVERSARIAL proof — not just "the tests pass", but
-- "every PHI door provably denies cross-org access". pqs.a must read rede-a PHI
-- and get zero/null/false on rede-b's, and vice versa. If any door leaks, that is
-- a BLOCKER application bug, not a fixture issue.
--
-- Fixture: the SEEDED two-org world (rede-a + rede-b); personas are FIXED UUIDs
-- from seed.sql. Mirrors the 171_cross_org_isolation.sql persona pattern.
--
-- Personas (all password Test1234!):
--   pqs.a    (c2): enrolled in rede-a PQS roster → reads rede-a PHI ONLY
--   pqs.b    (c4): enrolled in rede-b PQS roster → reads rede-b PHI ONLY
--   nspcoord.a (c1): nsp_coordinator of rede-a, NOT enrolled → curate but NOT read
--   nspcoord.b (c3): nsp_coordinator of rede-b, NOT enrolled → curate but NOT read
--   orgadmin.a (b1): org_admin of rede-a → NO PHI (duty separation)
--
-- Entities:
--   ev_a (e1000000…a1): rede-a event with event_patient PRT-0099123 (reported by CCIH)
--   ev_b (e4000000…b1): rede-b event with event_patient PRT-B-0001 (reported by Qualidade B)
--   ref_a (efa0…a1): rede-a ENC-0001, referral_patient PRT-0099123 (CCIH → Farmácia)
--   ref_b (efa0…b1): rede-b ENC-0003, referral_patient PRT-B-0001 (Qualidade B → Farmácia B)

begin;
select plan(53);

-- All feature flags are ON in the seeded DB (migration 20260624130000).
-- The patient_index flag: flip ON so the §D patient_index assertions can run.
update app.feature_flags set enabled = true where key = 'patient_index';

-- Fixed-UUID personas + org/entity constants (from seed.sql).
create temp table personas on commit drop as select
  '00000000-0000-0000-0000-0000000000c2'::uuid as pqs_a,         -- pqs.a@test.local
  '00000000-0000-0000-0000-0000000000c4'::uuid as pqs_b,         -- pqs.b@test.local
  '00000000-0000-0000-0000-0000000000c1'::uuid as nspcoord_a,    -- nspcoord.a@test.local
  '00000000-0000-0000-0000-0000000000c3'::uuid as nspcoord_b,    -- nspcoord.b@test.local
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,    -- orgadmin.a@test.local
  '00000000-0000-0000-0000-000000000001'::uuid as admin,         -- admin@test.local (enrolled in rede-a PQS)
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,         -- Rede Hospitalar A
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,         -- Rede Hospitalar B
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih,     -- CCIH (rede-a)
  'c0000000-0000-0000-0000-0000000000c1'::uuid as comm_qual_b,   -- Qualidade B (rede-b)
  'e1000000-0000-0000-0000-0000000000a1'::uuid as ev_a,          -- rede-a event (has PHI)
  'e4000000-0000-0000-0000-0000000000b1'::uuid as ev_b,          -- rede-b event (has PHI)
  'efa00000-0000-0000-0000-0000000000a1'::uuid as ref_a,         -- ENC-0001 (rede-a, concluida)
  'efa00000-0000-0000-0000-0000000000b1'::uuid as ref_b;         -- ENC-0003 (rede-b, enviada)
grant select on personas to authenticated;

-- ============================================================================
-- §1: PQS membership predicate boundary (the workhorse)
--     is_pqs_member_of_for(org, uid): per-org enrollment gates ALL PHI reads.
-- ============================================================================
select ok(
  app.is_pqs_member_of_for((select org_a from personas), (select pqs_a from personas)),
  'BOUNDARY: is_pqs_member_of_for(rede_a, pqs.a) = true (pqs.a enrolled in rede-a)');
select ok(
  not app.is_pqs_member_of_for((select org_b from personas), (select pqs_a from personas)),
  'BOUNDARY: is_pqs_member_of_for(rede_b, pqs.a) = false (pqs.a NOT in rede-b roster)');
select ok(
  not app.is_pqs_member_of_for((select org_a from personas), (select pqs_b from personas)),
  'BOUNDARY: is_pqs_member_of_for(rede_a, pqs.b) = false (pqs.b NOT in rede-a roster)');
select ok(
  app.is_pqs_member_of_for((select org_b from personas), (select pqs_b from personas)),
  'BOUNDARY: is_pqs_member_of_for(rede_b, pqs.b) = true (pqs.b enrolled in rede-b)');

-- ============================================================================
-- §2: NSP-coordinator predicate boundary (curate ≠ read)
-- ============================================================================
select ok(
  app.is_nsp_coordinator_of_for((select org_a from personas), (select nspcoord_a from personas)),
  'BOUNDARY: is_nsp_coordinator_of_for(rede_a, nspcoord.a) = true');
select ok(
  not app.is_nsp_coordinator_of_for((select org_b from personas), (select nspcoord_a from personas)),
  'BOUNDARY: is_nsp_coordinator_of_for(rede_b, nspcoord.a) = false (cross-org coordinator false)');

-- ============================================================================
-- §3: can_read_event — org-A member true on A-event, false on B-event; symmetric.
-- ============================================================================
select ok(
  app.can_read_event((select ev_a from personas), (select pqs_a from personas)),
  'ISOLATION: can_read_event(ev_a, pqs.a) = true (pqs.a reads rede-a event)');
select ok(
  not app.can_read_event((select ev_b from personas), (select pqs_a from personas)),
  'ISOLATION: can_read_event(ev_b, pqs.a) = false — rede-b event INVISIBLE to pqs.a');
select ok(
  not app.can_read_event((select ev_a from personas), (select pqs_b from personas)),
  'ISOLATION: can_read_event(ev_a, pqs.b) = false — rede-a event INVISIBLE to pqs.b');
select ok(
  app.can_read_event((select ev_b from personas), (select pqs_b from personas)),
  'ISOLATION: can_read_event(ev_b, pqs.b) = true (pqs.b reads rede-b event)');

-- ============================================================================
-- §4: can_read_event_patient — the tighter identifier predicate
-- ============================================================================
select ok(
  app.can_read_event_patient((select ev_a from personas), (select pqs_a from personas)),
  'ISOLATION: can_read_event_patient(ev_a, pqs.a) = true');
select ok(
  not app.can_read_event_patient((select ev_b from personas), (select pqs_a from personas)),
  'ISOLATION PROOF: can_read_event_patient(ev_b, pqs.a) = false — PHI DOOR CLOSED for cross-org');
select ok(
  not app.can_read_event_patient((select ev_a from personas), (select pqs_b from personas)),
  'ISOLATION PROOF: can_read_event_patient(ev_a, pqs.b) = false — PHI DOOR CLOSED for cross-org');
select ok(
  app.can_read_event_patient((select ev_b from personas), (select pqs_b from personas)),
  'ISOLATION: can_read_event_patient(ev_b, pqs.b) = true');

-- ============================================================================
-- §5: get_event_patient (DEFINER door) — non-null on own-org, NULL on foreign org
-- ============================================================================
-- pqs.a reads rede-a event PHI (must return the row).
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select isnt(
  public.get_event_patient((select ev_a from personas)),
  null,
  'DEFINER DOOR: get_event_patient(ev_a) as pqs.a returns the PHI row (entitled)');
reset role;

-- pqs.a on rede-b event — must return NULL (leak closed).
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select is(
  public.get_event_patient((select ev_b from personas)),
  null,
  'DEFINER DOOR PROOF: get_event_patient(ev_b) as pqs.a returns NULL — cross-org PHI BLOCKED');
reset role;

-- pqs.b reads rede-b event PHI (must return the row).
select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
select isnt(
  public.get_event_patient((select ev_b from personas)),
  null,
  'DEFINER DOOR: get_event_patient(ev_b) as pqs.b returns the PHI row (entitled)');
reset role;

-- pqs.b on rede-a event — must return NULL.
select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
select is(
  public.get_event_patient((select ev_a from personas)),
  null,
  'DEFINER DOOR PROOF: get_event_patient(ev_a) as pqs.b returns NULL — cross-org PHI BLOCKED');
reset role;

-- ============================================================================
-- §6: pqs_inbox() — org-A caller sees only rede-a events; zero rede-b.
-- ============================================================================
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
create temp table inbox_a on commit drop as
  select * from public.pqs_inbox();
reset role;
grant select on inbox_a to authenticated;

-- Must have ≥1 row from rede-a (ev_a is seeded, acknowledged).
select ok(
  (select count(*)::int from inbox_a) >= 1,
  'pqs_inbox: pqs.a sees ≥1 rede-a events');
-- Every event in the inbox must belong to rede-a.
select is(
  (select count(*)::int from inbox_a
   join public.commissions c on c.id = inbox_a.reporting_commission_id
   where c.organization_id != (select org_a from personas)),
  0,
  'pqs_inbox PROOF: all events visible to pqs.a are rede-a commissions (ZERO rede-b events)');
-- The rede-b event must NOT appear.
select is(
  (select count(*)::int from inbox_a where id = (select ev_b from personas)),
  0,
  'pqs_inbox PROOF: rede-b event ev_b is ABSENT from pqs.a''s inbox');

-- pqs.b sees rede-b events and zero rede-a.
select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
create temp table inbox_b on commit drop as
  select * from public.pqs_inbox();
reset role;
grant select on inbox_b to authenticated;

select ok(
  (select count(*)::int from inbox_b) >= 1,
  'pqs_inbox: pqs.b sees ≥1 rede-b events');
select is(
  (select count(*)::int from inbox_b
   join public.commissions c on c.id = inbox_b.reporting_commission_id
   where c.organization_id != (select org_b from personas)),
  0,
  'pqs_inbox PROOF: all events visible to pqs.b are rede-b commissions (ZERO rede-a events)');

-- ============================================================================
-- §7: Referral PHI doors (can_read_referral_phi, get_referral_patient,
--     get_referral_detail)
-- ============================================================================
select ok(
  app.can_read_referral_phi((select ref_a from personas), (select pqs_a from personas)),
  'ISOLATION: can_read_referral_phi(ref_a, pqs.a) = true');
select ok(
  not app.can_read_referral_phi((select ref_b from personas), (select pqs_a from personas)),
  'ISOLATION PROOF: can_read_referral_phi(ref_b, pqs.a) = false — cross-org referral PHI BLOCKED');
select ok(
  not app.can_read_referral_phi((select ref_a from personas), (select pqs_b from personas)),
  'ISOLATION PROOF: can_read_referral_phi(ref_a, pqs.b) = false — cross-org referral PHI BLOCKED');
select ok(
  app.can_read_referral_phi((select ref_b from personas), (select pqs_b from personas)),
  'ISOLATION: can_read_referral_phi(ref_b, pqs.b) = true');

-- get_referral_patient: non-null for own-org, NULL for foreign.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select isnt(
  public.get_referral_patient((select ref_a from personas)),
  null,
  'DEFINER DOOR: get_referral_patient(ref_a) as pqs.a returns the PHI row');
select is(
  public.get_referral_patient((select ref_b from personas)),
  null,
  'DEFINER DOOR PROOF: get_referral_patient(ref_b) as pqs.a returns NULL — cross-org BLOCKED');
reset role;

select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
select isnt(
  public.get_referral_patient((select ref_b from personas)),
  null,
  'DEFINER DOOR: get_referral_patient(ref_b) as pqs.b returns the PHI row');
select is(
  public.get_referral_patient((select ref_a from personas)),
  null,
  'DEFINER DOOR PROOF: get_referral_patient(ref_a) as pqs.b returns NULL — cross-org BLOCKED');
reset role;

-- ============================================================================
-- §8: patient_index — search_patient_xref and patient_access_audit org-scoped.
-- ============================================================================
-- pqs.a: searching rede-b MRN (PRT-B-0001) with rede-b org → returns 0 matches.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
create temp table srx_a_b on commit drop as
  select public.search_patient_xref('PRT-B-0001', null, (select org_b from personas)) as j;
reset role;
grant select on srx_a_b to authenticated;
select is(
  (select (j->>'matchCount')::int from srx_a_b),
  0,
  'patient_index PROOF: pqs.a searching rede-b MRN in rede-b org returns 0 — cross-org BLOCKED');

-- pqs.b: searching rede-b MRN with rede-b org → returns ≥1 (ev_b + ref_b share PRT-B-0001).
select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
create temp table srx_b_b on commit drop as
  select public.search_patient_xref('PRT-B-0001', null, (select org_b from personas)) as j;
reset role;
grant select on srx_b_b to authenticated;
select ok(
  (select (j->>'matchCount')::int from srx_b_b) >= 1,
  'patient_index: pqs.b searching rede-b MRN returns ≥1 match (entitled)');

-- pqs.b: searching rede-a MRN with rede-a org → returns 0 (cross-org blocked).
select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
create temp table srx_b_a on commit drop as
  select public.search_patient_xref('PRT-0099123', null, (select org_a from personas)) as j;
reset role;
grant select on srx_b_a to authenticated;
select is(
  (select (j->>'matchCount')::int from srx_b_a),
  0,
  'patient_index PROOF: pqs.b searching rede-a MRN in rede-a org returns 0 — cross-org BLOCKED');

-- patient_access_audit with cross-org org → returns [] for unentitled caller.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
create temp table paa_a_b on commit drop as
  select public.patient_access_audit('PRT-B-0001', null, (select org_b from personas)) as j;
reset role;
grant select on paa_a_b to authenticated;
select is(
  (select jsonb_array_length(coalesce(j, '[]'::jsonb)) from paa_a_b),
  0,
  'patient_access_audit PROOF: pqs.a auditing rede-b MRN returns [] — cross-org BLOCKED');

-- ============================================================================
-- §9: Duty separation — coordinator curates but cannot read PHI until enrolled.
-- ============================================================================
-- nspcoord.a is NOT enrolled → can_read_event_patient on rede-a event = false.
select ok(
  not app.can_read_event_patient((select ev_a from personas), (select nspcoord_a from personas)),
  'DUTY SEP: nspcoord.a (unenrolled) cannot read PHI on rede-a event (curate ≠ read)');

-- After self-enrollment (inside this txn), nspcoord.a gains PHI read.
-- Use a direct insert here (seed runs as superuser; inside the rollback, so it reverts).
insert into public.pqs_members (organization_id, user_id, added_by)
  values ((select org_a from personas), (select nspcoord_a from personas), (select admin from personas));

select ok(
  app.can_read_event_patient((select ev_a from personas), (select nspcoord_a from personas)),
  'DUTY SEP: after self-enrollment, nspcoord.a CAN read PHI on rede-a event (enrollment = the gate)');

-- Cross-org coordinator escalation denied: nspcoord.a cannot enroll into rede-b.
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select org_b from personas), (select pqs_a from personas)),
  '42501', null,
  'DUTY SEP: nspcoord.a calling add_pqs_member(rede_b, …) raises 42501 (cross-org curation denied)');
reset role;

-- nspcoord.b cannot enroll into rede-a (inverse).
select test_helpers.claims_for((select nspcoord_b from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select org_a from personas), (select pqs_b from personas)),
  '42501', null,
  'DUTY SEP: nspcoord.b calling add_pqs_member(rede_a, …) raises 42501 (cross-org curation denied)');
reset role;

-- org_admin cannot directly write pqs_members — only appoints coordinators.
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select org_a from personas), (select orgadmin_a from personas)),
  '42501', null,
  'DUTY SEP: org_admin calling add_pqs_member raises 42501 (three-way separation: appoint ≠ curate)');
reset role;

-- ============================================================================
-- §10: Per-org event code (EV) sequences — rede-a and rede-b are independent.
-- ============================================================================
-- Both orgs have at least one event; check codes are prefixed EV- and non-empty.
select ok(
  (select count(*)::int from public.patient_safety_event
   where reporting_commission_id = (select comm_ccih from personas)
     and code like 'EV-%') >= 1,
  'per-org EV: rede-a has ≥1 EV-prefixed event (own sequence)');
select ok(
  (select count(*)::int from public.patient_safety_event
   where reporting_commission_id = (select comm_qual_b from personas)
     and code like 'EV-%') >= 1,
  'per-org EV: rede-b has ≥1 EV-prefixed event (own sequence)');

-- ============================================================================
-- §11: Flag reversions — with 2 orgs + flags ON, patient_safety_enabled() and
--      referrals_enabled() are now TRUE (the former multi-org guard is GONE).
--      This is the INVERSE of what 173_multi_org_phi_guard.sql asserted.
-- ============================================================================
select ok(
  public.patient_safety_enabled(),
  'REVERSION: patient_safety_enabled() = TRUE with 2 orgs + flag ON (multi-org guard lifted)');
select ok(
  public.referrals_enabled(),
  'REVERSION: referrals_enabled() = TRUE with 2 orgs + flag ON (multi-org guard lifted)');
-- The assert RPCs must NOT raise (module is active).
select lives_ok(
  $$ select app.assert_patient_safety_enabled() $$,
  'REVERSION: assert_patient_safety_enabled() does not raise (module live)');
select lives_ok(
  $$ select app.assert_referrals_enabled() $$,
  'REVERSION: assert_referrals_enabled() does not raise (module live)');

-- ============================================================================
-- §12: Per-org pqs_department config — two rows, different due-windows.
-- ============================================================================
select is(
  (select rca_default_due_days from public.pqs_department
   where organization_id = (select org_a from personas)),
  45,
  'per-org config: rede-a pqs_department.rca_default_due_days = 45');
select is(
  (select rca_default_due_days from public.pqs_department
   where organization_id = (select org_b from personas)),
  30,
  'per-org config: rede-b pqs_department.rca_default_due_days = 30 (DISTINCT from rede-a)');

-- ============================================================================
-- §13: Org-resolution helpers — deterministic, nullable-safe.
-- ============================================================================
select is(
  app.org_of_event((select ev_a from personas)),
  (select org_a from personas),
  'org_of_event(ev_a) resolves to org_a (via reporting_commission_id → commissions.organization_id)');
select is(
  app.org_of_event((select ev_b from personas)),
  (select org_b from personas),
  'org_of_event(ev_b) resolves to org_b');
select is(
  app.org_of_referral((select ref_a from personas)),
  (select org_a from personas),
  'org_of_referral(ref_a) resolves to org_a (via source_commission_id)');
select is(
  app.org_of_referral((select ref_b from personas)),
  (select org_b from personas),
  'org_of_referral(ref_b) resolves to org_b');
select is(
  app.org_of_commission((select comm_ccih from personas)),
  (select org_a from personas),
  'org_of_commission(comm_ccih) resolves to org_a');

select * from finish();
rollback;
