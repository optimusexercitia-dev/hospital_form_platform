-- NSP-per-hospital sub-phase B support deltas (ADR 0052; migration 20260710000000).
-- Sub-phase B (the NSP console) needed DB seams that A6 did not cover. This file
-- guards them against the SEEDED two-org / multi-hospital world (mirrors 171 —
-- fixed-UUID personas, NOT bootstrap). Re-keyed org -> hospital: the NSP operator
-- (member OR coordinator) is now scoped per HOSPITAL; pqs.a / nspcoord.a operate
-- central-a specifically, not all of rede-a.
--
--   §A organizations_select broadening — the getNspAccess seam. An enrolled
--      pqs_member / nsp_coordinator (per hospital) who is NOT also a commission/org
--      member must still resolve THEIR OWN org's `organizations` row (the console
--      resolves the org by slug → would 404 the exact user who needs it), via
--      is_pqs_operator_in_org. A FOREIGN-org PQS/coordinator still cannot read it.
--   §B list_org_eligible_users(org) — DEFINER picker for the ORG-LEVEL appointment
--      UI; gated to org_admin OR nsp_org_admin of the org (plain member/staff_admin →
--      42501). (The per-hospital roster picker is list_hospital_eligible_users_for_pqs,
--      gated coordinator OR nsp_org_admin — a small block guards it too.)
--   §D commissions_select PQS/coordinator broadening — a PQS-only user reads its
--      HOSPITAL's commissions (per-hospital QPS scope source); 0 cross-org; and the
--      KEYSTONE NEGATIVE: a plain non-PQS member's reach is NOT widened (still only its
--      own commission via the unchanged is_member_of arm). NOTE (per-hospital): pqs.a /
--      nspcoord.a now see only central-a's commissions (CCIH + Farmácia), NOT
--      secundario-a's (Ética / Segurança A2) — that is the correct per-hospital scope.
--   §C appointNspCoordinator's DB substrate — the hospital's nsp_coordinator (or the
--      org's nsp_org_admin) is the roster writer (pqs_members_curator_all; no
--      platform/org_admin escape hatch), and organization_members accepts the
--      hospital-scoped nsp_coordinator role. (The TS orphan-the-org guard lives in the
--      action layer — covered by E2E, not here.)
--
-- Seeded NSP personas (password Test1234!):
--   pqs.a    (c2): enrolled pqs_member of central-a (NO commission membership)
--   pqs.b    (c4): enrolled pqs_member of central-b
--   nspcoord.a (c1): nsp_coordinator of central-a (NOT enrolled, NO commission membership)
--   nspcoord.b (c3): nsp_coordinator of central-b
--   nsporg.a (e2): nsp_org_admin of rede-a (org-level; enrolled in NO roster)
--   orgadmin.a (b1): org_admin of rede-a
--   chefe.ccih (02): staff_admin of CCIH (central-a) — a plain org "member" via commission
--   staff1.ccih (03): staff of CCIH (central-a)

begin;
select plan(33);

-- Fixed-UUID personas + org/hospital constants (from seed.sql).
create temp table personas on commit drop as select
  '00000000-0000-0000-0000-0000000000c2'::uuid as pqs_a,        -- enrolled pqs_member of central-a
  '00000000-0000-0000-0000-0000000000c4'::uuid as pqs_b,        -- enrolled pqs_member of central-b
  '00000000-0000-0000-0000-0000000000c1'::uuid as nspcoord_a,   -- nsp_coordinator of central-a
  '00000000-0000-0000-0000-0000000000c3'::uuid as nspcoord_b,   -- nsp_coordinator of central-b
  '00000000-0000-0000-0000-0000000000e2'::uuid as nsporg_a,     -- nsp_org_admin of rede-a (org-level)
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_ccih,
  '00000000-0000-0000-0000-000000000003'::uuid as staff_ccih,
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  '05000000-0000-0000-0000-00000000000a'::uuid as hosp_central_a,   -- org-a hospital 1
  '05000000-0000-0000-0000-0000000000a2'::uuid as hosp_secundario_a, -- org-a hospital 2
  '05000000-0000-0000-0000-00000000000b'::uuid as hosp_central_b;   -- org-b hospital
grant select on personas to authenticated;

-- ============================================================================
-- §A: organizations_select broadening — PQS operator reads OWN org only.
--     The policy: is_admin OR is_org_admin_of OR is_org_member OR
--                 is_pqs_operator_in_org OR is_nsp_org_admin_of OR is_org_level_admin_within.
--     pqs.a / nspcoord.a hold NO commission or org-admin membership → before the
--     broadening they could NOT read their org row (the console-seam 404 bug). Under
--     per-hospital (ADR 0052) they resolve their org via is_pqs_operator_in_org.
-- ============================================================================
-- pqs.a reads its OWN org (rede-a) row.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.organizations where id = (select org_a from personas)),
  1,
  'A1: enrolled pqs.a (no commission/org membership) CAN read its OWN org (rede-a) row');
-- pqs.a CANNOT read the FOREIGN org (rede-b) row — no cross-org leak.
select is(
  (select count(*)::int from public.organizations where id = (select org_b from personas)),
  0,
  'A1 ISOLATION: pqs.a CANNOT read the foreign org (rede-b) row');
reset role;

-- nspcoord.a (coordinator, not enrolled, no commission membership) reads its OWN org.
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.organizations where id = (select org_a from personas)),
  1,
  'A2: nspcoord.a (coordinator only) CAN read its OWN org (rede-a) row');
select is(
  (select count(*)::int from public.organizations where id = (select org_b from personas)),
  0,
  'A2 ISOLATION: nspcoord.a CANNOT read the foreign org (rede-b) row');
reset role;

-- The inverse direction: pqs.b reads rede-b only, not rede-a.
select test_helpers.claims_for((select pqs_b from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.organizations where id = (select org_b from personas)),
  1,
  'A3: pqs.b CAN read its OWN org (rede-b) row');
select is(
  (select count(*)::int from public.organizations where id = (select org_a from personas)),
  0,
  'A3 ISOLATION: pqs.b CANNOT read the foreign org (rede-a) row');
reset role;

-- ============================================================================
-- §B: list_org_eligible_users(org) — the ORG-WIDE appointment picker. RENAMED from
-- list_org_eligible_users_for_pqs (dropped by ADR 0052) and RE-GATED: now
-- is_org_admin_of OR is_nsp_org_admin_of (NOT coordinator). A coordinator uses the
-- per-hospital picker list_hospital_eligible_users_for_pqs instead (guarded at the tail).
-- ============================================================================
-- The org_admin (orgadmin.a) CAN list rede-a eligible users (non-empty).
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
create temp table elig_org on commit drop as
  select public.list_org_eligible_users((select org_a from personas)) as j;
reset role;
grant select on elig_org to authenticated;
select ok(
  jsonb_array_length((select j from elig_org)) >= 1,
  'B1: the org_admin CAN list eligible users (non-empty org-wide picker)');
-- The list contains chefe.ccih (a CCIH commission member of rede-a → eligible via
-- the commission_members arm of the union). NOTE pqs.a is NOT eligible: it holds
-- only a pqs_members row, and the picker unions organization_members ∪
-- commission_members (NOT the roster), so an enrolled-but-membership-less user
-- correctly does not appear.
select ok(
  (select j::text from elig_org) like '%' || (select chefe_ccih from personas)::text || '%',
  'B1b: the eligible-users list includes a known rede-a commission member (chefe.ccih)');

-- The org's nsp_org_admin (nsporg.a) CAN also list (serves the org-level appointment UI).
select test_helpers.claims_for((select nsporg_a from personas), false);
set local role authenticated;
select lives_ok(
  format($$ select public.list_org_eligible_users(%L::uuid) $$, (select org_a from personas)),
  'B2: the nsp_org_admin CAN list eligible users (org-level appointment picker)');
reset role;

-- A plain commission member (staff1.ccih) is neither org_admin nor nsp_org_admin → 42501.
select test_helpers.claims_for((select staff_ccih from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_org_eligible_users(%L::uuid) $$, (select org_a from personas)),
  '42501', null,
  'B3: a plain commission member calling list_org_eligible_users raises 42501');
reset role;

-- A staff_admin (chefe.ccih) is also neither org_admin nor nsp_org_admin → 42501.
select test_helpers.claims_for((select chefe_ccih from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_org_eligible_users(%L::uuid) $$, (select org_a from personas)),
  '42501', null,
  'B3b: a staff_admin (not org_admin/nsp_org_admin) calling list_org_eligible_users raises 42501');
reset role;

-- A hospital coordinator (nspcoord.a) is NOT admitted to the ORG-WIDE picker → 42501
-- (its picker is the per-hospital list_hospital_eligible_users_for_pqs, tested below).
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_org_eligible_users(%L::uuid) $$, (select org_a from personas)),
  '42501', null,
  'B3c: a hospital coordinator is NOT admitted to the ORG-WIDE picker (uses the per-hospital one)');
reset role;

-- Cross-org: rede-a org_admin CANNOT list rede-b eligible users.
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_org_eligible_users(%L::uuid) $$, (select org_b from personas)),
  '42501', null,
  'B4 ISOLATION: rede-a org_admin CANNOT list rede-b eligible users (cross-org denied)');
reset role;

-- anon cannot execute the picker.
select is(
  has_function_privilege('anon', 'public.list_org_eligible_users(uuid)', 'execute'),
  false,
  'B5: anon has NO EXECUTE on list_org_eligible_users');

-- Per-hospital roster picker: list_hospital_eligible_users_for_pqs(hospital) — gated
-- coordinator OR nsp_org_admin. nspcoord.a (central-a's coordinator) CAN list its
-- hospital's eligible users; the list carries chefe.ccih (a central-a CCIH member).
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
create temp table elig_hosp on commit drop as
  select public.list_hospital_eligible_users_for_pqs((select hosp_central_a from personas)) as j;
reset role;
grant select on elig_hosp to authenticated;
select ok(
  (select j::text from elig_hosp) like '%' || (select chefe_ccih from personas)::text || '%',
  'B6: the hospital coordinator CAN list its hospital''s eligible users (per-hospital picker)');

-- ============================================================================
-- §C: appointNspCoordinator's DB substrate. Per-hospital (ADR 0052): the
--     nsp_coordinator organization_members row is now HOSPITAL-scoped (hospital_id
--     NOT NULL); the roster (pqs_members) is written under pqs_members_curator_all =
--     is_nsp_org_admin_of(org_of_hospital) OR is_nsp_coordinator_of(hospital). Here we
--     prove: the role CHECK admits nsp_coordinator; an org_admin can write the
--     hospital-scoped coordinator row (organization_members_write); and the roster's
--     curator gate (coordinator of the hospital) is the sole roster writer — no
--     platform/org_admin/plain-member escape hatch.
-- ============================================================================
-- The role CHECK on memberships admits nsp_coordinator (the appointment seam;
-- MEM collapse successor of organization_members.role's CHECK). memberships_role_check
-- names the full role vocabulary (org_admin/nsp_org_admin/hospital_admin/
-- nsp_coordinator/staff_admin/staff/pqs_member); memberships_scope_shape's per-role
-- CASE arms also reference nsp_coordinator, so >=1 constraint clause names it.
select ok(
  (select count(*)::int
   from information_schema.check_constraints cc
   join information_schema.constraint_column_usage ccu
     on cc.constraint_name = ccu.constraint_name
   where ccu.table_name = 'memberships'
     and ccu.column_name = 'role'
     and cc.check_clause like '%nsp_coordinator%') >= 1,
  'C1: memberships.role CHECK admits nsp_coordinator (appointment seam)');

-- Appoint happy path — now via the guarded RPC (WS-1, 20260711000000): the
-- nsp_coordinator organization_members row is no longer directly writable by
-- authenticated (revoked DML + dropped organization_members_write policy). Per
-- decision 3 (ADR 0052) the appointer is the org's NSP-ORG-ADMIN, NOT a plain
-- org_admin: the org_admin appoints the nsp_org_admin; the nsp_org_admin appoints
-- the per-hospital coordinator. nsporg.a (nsp_org_admin of rede-a) appoints a plain
-- member (staff1.ccih; <> nsporg.a so the self-guard passes) as coordinator of
-- central-a; the RPC writes the hospital-scoped row.
select test_helpers.claims_for((select nsporg_a from personas), false);
set local role authenticated;
select lives_ok(
  format($$ select public.assign_nsp_coordinator(%L::uuid, %L::uuid) $$,
         (select hosp_central_a from personas), (select staff_ccih from personas)),
  'C2: the org nsp_org_admin CAN appoint a per-hospital nsp_coordinator via assign_nsp_coordinator (appoint happy path; direct write revoked by WS-1)');
select ok(
  app.is_nsp_coordinator_of_for((select hosp_central_a from personas), (select staff_ccih from personas)),
  'C2b: the newly-appointed user is recognized by is_nsp_coordinator_of_for(central-a)');
reset role;

-- Duty separation (decision 3): a plain org_admin (orgadmin.a) — who is NOT the org's
-- nsp_org_admin — CANNOT appoint a coordinator. This is the C-3a self-escalation
-- vector WS-1 closed: previously orgadmin.a could directly INSERT the coordinator row.
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_nsp_coordinator(%L::uuid, %L::uuid) $$,
         (select hosp_central_a from personas), (select staff_ccih from personas)),
  '42501', null,
  'C2c: a plain org_admin (NOT nsp_org_admin) CANNOT appoint a coordinator (decision 3 — assign_nsp_coordinator authority denies; C-3a closed)');
reset role;

-- A FOREIGN nsp_org_admin CANNOT appoint a coordinator in the OTHER org. nsporg.a is
-- rede-a's nsp_org_admin, so it has no authority over rede-b's central-b hospital →
-- the RPC's is_nsp_org_admin_of(org_of_hospital) check denies it (42501).
select test_helpers.claims_for((select nsporg_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_nsp_coordinator(%L::uuid, %L::uuid) $$,
         (select hosp_central_b from personas), (select staff_ccih from personas)),
  '42501', null,
  'C3 ISOLATION: a rede-a nsp_org_admin CANNOT appoint a coordinator in rede-b (cross-org authority denied)');
reset role;

-- The roster is written ONLY through add_pqs_member (WS-1/MEM: memberships has no
-- direct write grant and NO write policy at all — RPC-only door, like case_access).
-- These negative controls prove no direct-write escape hatch survives; the reason is
-- "no grant / no policy" (42501 permission-denied) rather than a curator-policy WITH
-- CHECK, but the guarantee is identical and stronger. 190_membership_lockdown covers
-- the org_admin / nsp_org_admin direct-write vectors canonically; these add the
-- enrolled-member and cross-hospital-coordinator vectors 190 does not.
--
-- C4: orgadmin.a (org_admin, not coordinator/nsp_org_admin) cannot directly write.
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
            values (%L::uuid, %L::uuid, %L::uuid, 'pqs_member', %L::uuid) $$,
         (select org_a from personas), (select hosp_central_a from personas),
         (select staff_ccih from personas), (select orgadmin_a from personas)),
  '42501', null,
  'C4: an org_admin CANNOT directly write a pqs_member row into memberships (no grant, no policy — RPC-only door)');
reset role;

-- C5: the enrolled member (pqs.a) is NOT a coordinator → also cannot write directly.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
            values (%L::uuid, %L::uuid, %L::uuid, 'pqs_member', %L::uuid) $$,
         (select org_a from personas), (select hosp_central_a from personas),
         (select staff_ccih from personas), (select pqs_a from personas)),
  '42501', null,
  'C5: an enrolled PQS member CANNOT directly write a pqs_member row into memberships (curation ≠ enrollment; no direct-write escape hatch)');
reset role;

-- C6: the coordinator (nspcoord.a) CAN enroll into its HOSPITAL's roster via the RPC
-- (the positive control) — staff1.ccih <> nspcoord.a so the self-enrollment guard passes.
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select lives_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_central_a from personas), (select staff_ccih from personas)),
  'C6: the hospital coordinator CAN enroll its hospital roster via add_pqs_member (positive control; direct write revoked by WS-1)');
select ok(
  app.is_pqs_member_of_for((select hosp_central_a from personas), (select staff_ccih from personas)),
  'C6b: the enrolled user is recognized by is_pqs_member_of_for(central-a) (PHI read now resolves)');
reset role;

-- C7: cross-hospital — central-a's coordinator CANNOT enroll into central-b's roster
-- (a hospital it is not the coordinator/nsp_org_admin of → add_pqs_member authority denies).
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_central_b from personas), (select staff_ccih from personas)),
  '42501', null,
  'C7 ISOLATION: central-a coordinator CANNOT enroll central-b roster (cross-hospital authority denied)');
reset role;

-- ============================================================================
-- §D: commissions_select PQS/coordinator broadening (BUG-NSP-005 fix), now PER-HOSPITAL
--     (ADR 0052). The page scopes the QPS referral dashboard by intersecting the
--     referral list with the readable commissions (invoker-RLS) — so a PQS-only user
--     who could NOT read commissions saw an empty intersection → ZERO referrals. Fix:
--     commissions_select_member_or_admin += is_pqs_operator_of(hospital_id) OR
--     is_nsp_org_admin_of(organization_id), KEEPING the is_member_of arm unchanged. The
--     NEGATIVE assertion (a plain member's reach is NOT widened) is the keystone.
--     NSP-per-hospital scope: a central-a operator reads central-a's 2 commissions
--     (CCIH + Farmácia), NOT secundario-a's (Ética / Segurança A2). chefe.ccih is a
--     member of CCIH ONLY.
-- ============================================================================
-- (D1) pqs.a (PQS member of central-a, NO commission membership) now reads central-a's
-- 2 commissions (was 0 pre-fix), NOT secundario-a's, and ZERO rede-b commissions.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_a from personas)),
  2,
  'D1: pqs.a (PQS-only) reads its HOSPITAL''s 2 commissions (central-a: CCIH + Farmácia), NOT secundario-a''s (per-hospital scope; was 0 pre-fix)');
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_b from personas)),
  0,
  'D1 ISOLATION: pqs.a reads ZERO rede-b commissions (cross-org denied)');
reset role;

-- (D2) nspcoord.a (coordinator of central-a, NOT enrolled, NO commission membership)
-- also reads central-a's 2 commissions; zero cross-org.
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_a from personas)),
  2,
  'D2: nspcoord.a (coordinator) reads central-a''s 2 commissions via the broadened policy (per-hospital scope)');
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_b from personas)),
  0,
  'D2 ISOLATION: nspcoord.a reads ZERO rede-b commissions');
reset role;

-- (D3) KEYSTONE NEGATIVE — a plain non-PQS commission member's reach is NOT widened.
-- chefe.ccih is a member of CCIH ONLY (the unchanged is_member_of arm). It must STILL
-- read exactly its own commission (CCIH), NOT the org's other commission (Farmácia),
-- and NOT cross-org. The broadening must add NO reach for a non-PQS member.
select test_helpers.claims_for((select chefe_ccih from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_a from personas)),
  1,
  'D3 NEGATIVE: a plain non-PQS member (chefe.ccih) STILL reads only its OWN commission (1, not the org''s 2) — broadening adds no reach');
select is(
  (select slug from public.commissions where organization_id = (select org_a from personas)),
  'ccih',
  'D3 NEGATIVE: …and that one commission is CCIH (its own), not Farmácia');
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_b from personas)),
  0,
  'D3 NEGATIVE: a plain member reads ZERO rede-b commissions (unchanged)');
reset role;

-- (D4) the policy text actually carries the per-hospital NSP arms (defense against a
-- future revert that drops them). Per ADR 0052 the PQS term is the single
-- is_pqs_operator_of(hospital_id) (coordinator OR member) plus is_nsp_org_admin_of, and
-- the unchanged is_member_of / is_org_admin_of arms.
select ok(
  (select count(*)::int from pg_policies
   where tablename = 'commissions' and policyname = 'commissions_select_member_or_admin'
     and qual like '%is_pqs_operator_of%' and qual like '%is_nsp_org_admin_of%'
     and qual like '%is_member_of%' and qual like '%is_org_admin_of%') = 1,
  'D4: commissions_select carries the per-hospital NSP arms (is_member_of + is_org_admin_of + is_pqs_operator_of + is_nsp_org_admin_of)');

select * from finish();
rollback;
