-- NSP-per-org sub-phase B support deltas (ADR 0042; migration 20260630000000).
-- Sub-phase B (the per-org NSP console at /o/[org]/nsp/**) needed three DB seams
-- that A6 did not cover. This file guards them against the SEEDED two-org world
-- (mirrors 171/173 — fixed-UUID personas, NOT bootstrap):
--
--   §A organizations_select broadening — the getNspAccessByOrg seam. An enrolled
--      pqs_member / nsp_coordinator who is NOT also a commission/org member must be
--      able to read THEIR OWN org's `organizations` row (the console resolves the org
--      by slug → would 404 the exact user who needs it). A FOREIGN-org PQS/coordinator
--      still cannot read it (no isolation leak).
--   §B list_org_eligible_users_for_pqs(org) — DEFINER picker for the roster
--      enroll-UI + the appoint-coordinator UI; gated to coordinator OR org_admin of
--      the org (plain member → 42501).
--   §D commissions_select PQS/coordinator broadening (BUG-NSP-005 fix) — a PQS-only
--      user reads its org's commissions (the per-org QPS dashboard's org-scope source);
--      0 cross-org; and the KEYSTONE NEGATIVE: a plain non-PQS member's reach is NOT
--      widened (still only its own commission via the unchanged is_member_of arm).
--   §C appointNspCoordinator's DB substrate — the org's nsp_coordinator is the sole
--      roster writer (pqs_members_coordinator_all; no platform/org_admin escape
--      hatch), and organization_members accepts the nsp_coordinator role. (The TS
--      "refuse to demote a current org_admin" orphan-the-org guard lives in the
--      action layer — covered by the equipe-nsp E2E, not here.)
--
-- Seeded NSP personas (password Test1234!):
--   pqs.a    (c2): enrolled pqs_member of rede-a (NO commission membership)
--   pqs.b    (c4): enrolled pqs_member of rede-b
--   nspcoord.a (c1): nsp_coordinator of rede-a (NOT enrolled, NO commission membership)
--   nspcoord.b (c3): nsp_coordinator of rede-b
--   orgadmin.a (b1): org_admin of rede-a
--   chefe.ccih (02): staff_admin of CCIH (rede-a) — a plain org "member" via commission
--   staff1.ccih (03): staff of CCIH (rede-a)

begin;
select plan(29);

-- Fixed-UUID personas + org constants (from seed.sql).
create temp table personas on commit drop as select
  '00000000-0000-0000-0000-0000000000c2'::uuid as pqs_a,
  '00000000-0000-0000-0000-0000000000c4'::uuid as pqs_b,
  '00000000-0000-0000-0000-0000000000c1'::uuid as nspcoord_a,
  '00000000-0000-0000-0000-0000000000c3'::uuid as nspcoord_b,
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_ccih,
  '00000000-0000-0000-0000-000000000003'::uuid as staff_ccih,
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b;
grant select on personas to authenticated;

-- ============================================================================
-- §A: organizations_select broadening — PQS/coordinator reads OWN org only.
--     The policy: is_admin OR is_org_admin_of OR is_org_member OR
--                 is_pqs_member_of OR is_nsp_coordinator_of.
--     pqs.a / nspcoord.a hold NO commission or org-admin membership → before the
--     broadening they could NOT read their org row (the console-seam 404 bug).
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
-- §B: list_org_eligible_users_for_pqs(org) — coordinator OR org_admin only.
-- ============================================================================
-- The coordinator (nspcoord.a) CAN list rede-a eligible users (non-empty).
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
create temp table elig_coord on commit drop as
  select public.list_org_eligible_users_for_pqs((select org_a from personas)) as j;
reset role;
grant select on elig_coord to authenticated;
select ok(
  jsonb_array_length((select j from elig_coord)) >= 1,
  'B1: the org coordinator CAN list eligible users (non-empty roster picker)');
-- The list contains chefe.ccih (a CCIH commission member of rede-a → eligible via
-- the commission_members arm of the union). NOTE pqs.a is NOT eligible: it holds
-- only a pqs_members row, and the picker unions organization_members ∪
-- commission_members (NOT the roster), so an enrolled-but-membership-less user
-- correctly does not appear.
select ok(
  (select j::text from elig_coord) like '%' || (select chefe_ccih from personas)::text || '%',
  'B1b: the eligible-users list includes a known rede-a commission member (chefe.ccih)');

-- The org_admin (orgadmin.a) CAN also list (serves the appoint-coordinator picker).
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select lives_ok(
  format($$ select public.list_org_eligible_users_for_pqs(%L::uuid) $$, (select org_a from personas)),
  'B2: the org_admin CAN list eligible users (appoint-coordinator picker)');
reset role;

-- A plain commission member (staff1.ccih) is NEITHER coordinator nor org_admin → 42501.
select test_helpers.claims_for((select staff_ccih from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_org_eligible_users_for_pqs(%L::uuid) $$, (select org_a from personas)),
  '42501', null,
  'B3: a plain commission member calling list_org_eligible_users_for_pqs raises 42501');
reset role;

-- A staff_admin (chefe.ccih) is also not a coordinator/org_admin → 42501.
select test_helpers.claims_for((select chefe_ccih from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_org_eligible_users_for_pqs(%L::uuid) $$, (select org_a from personas)),
  '42501', null,
  'B3b: a staff_admin (not coordinator/org_admin) calling list_org_eligible_users_for_pqs raises 42501');
reset role;

-- Cross-org: nspcoord.a (rede-a coordinator) CANNOT list rede-b eligible users.
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.list_org_eligible_users_for_pqs(%L::uuid) $$, (select org_b from personas)),
  '42501', null,
  'B4 ISOLATION: rede-a coordinator CANNOT list rede-b eligible users (cross-org denied)');
reset role;

-- anon cannot execute the picker.
select is(
  has_function_privilege('anon', 'public.list_org_eligible_users_for_pqs(uuid)', 'execute'),
  false,
  'B5: anon has NO EXECUTE on list_org_eligible_users_for_pqs');

-- ============================================================================
-- §C: appointNspCoordinator's DB substrate. The TS action upserts a
--     nsp_coordinator organization_members row (RLS = organization_members_write,
--     keyed on is_org_admin_of(org)). The orphan-the-org REFUSAL is a TS guard
--     (equipe-nsp E2E); here we prove the DB allows the org_admin to write the
--     coordinator role onto a plain member, and the role CHECK accepts it.
-- ============================================================================
-- The role CHECK on organization_members admits nsp_coordinator (the appointment seam).
select is(
  (select count(*)::int
   from information_schema.check_constraints cc
   join information_schema.constraint_column_usage ccu
     on cc.constraint_name = ccu.constraint_name
   where ccu.table_name = 'organization_members'
     and ccu.column_name = 'role'
     and cc.check_clause like '%nsp_coordinator%'),
  1,
  'C1: organization_members.role CHECK admits nsp_coordinator (appointment seam)');

-- An org_admin of rede-a CAN insert a nsp_coordinator row for a plain member
-- (staff1.ccih) — the appoint happy path at the RLS layer. Done as the org_admin
-- persona under RLS (proves organization_members_write permits it).
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select lives_ok(
  format($$ insert into public.organization_members (organization_id, user_id, role)
            values (%L::uuid, %L::uuid, 'nsp_coordinator') $$,
         (select org_a from personas), (select staff_ccih from personas)),
  'C2: an org_admin CAN insert a nsp_coordinator row for a plain member (appoint happy path, RLS allows)');
select ok(
  app.is_nsp_coordinator_of_for((select org_a from personas), (select staff_ccih from personas)),
  'C2b: the newly-appointed user is recognized by is_nsp_coordinator_of_for');
reset role;

-- A FOREIGN org_admin (orgadmin.a) CANNOT appoint a coordinator in rede-b
-- (organization_members_write is keyed on is_org_admin_of(THAT org)).
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.organization_members (organization_id, user_id, role)
            values (%L::uuid, %L::uuid, 'nsp_coordinator') $$,
         (select org_b from personas), (select staff_ccih from personas)),
  '42501', null,
  'C3 ISOLATION: a rede-a org_admin CANNOT appoint a coordinator in rede-b (cross-org write denied)');
reset role;

-- The coordinator is the SOLE roster writer: a plain member (even an org_admin)
-- cannot directly INSERT into pqs_members. orgadmin.a is org_admin of rede-a but
-- NOT a coordinator → the pqs_members_coordinator_all policy denies the write.
select test_helpers.claims_for((select orgadmin_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.pqs_members (organization_id, user_id, added_by)
            values (%L::uuid, %L::uuid, %L::uuid) $$,
         (select org_a from personas), (select staff_ccih from personas), (select orgadmin_a from personas)),
  '42501', null,
  'C4: an org_admin (not a coordinator) CANNOT directly write pqs_members (no escape hatch; duty separation)');
reset role;

-- The enrolled member (pqs.a) is NOT a coordinator → also cannot write the roster.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.pqs_members (organization_id, user_id, added_by)
            values (%L::uuid, %L::uuid, %L::uuid) $$,
         (select org_a from personas), (select staff_ccih from personas), (select pqs_a from personas)),
  '42501', null,
  'C5: an enrolled PQS member (not coordinator) CANNOT directly write pqs_members (curation ≠ enrollment)');
reset role;

-- The coordinator (nspcoord.a) CAN write its org's roster (the positive control).
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select lives_ok(
  format($$ insert into public.pqs_members (organization_id, user_id, added_by)
            values (%L::uuid, %L::uuid, %L::uuid) $$,
         (select org_a from personas), (select staff_ccih from personas), (select nspcoord_a from personas)),
  'C6: the org coordinator CAN write its org roster (positive control for the coordinator-only policy)');
reset role;

-- Cross-org: nspcoord.a CANNOT write rede-b's roster.
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.pqs_members (organization_id, user_id, added_by)
            values (%L::uuid, %L::uuid, %L::uuid) $$,
         (select org_b from personas), (select staff_ccih from personas), (select nspcoord_a from personas)),
  '42501', null,
  'C7 ISOLATION: rede-a coordinator CANNOT write rede-b roster (cross-org write denied)');
reset role;

-- ============================================================================
-- §D: commissions_select PQS/coordinator broadening (BUG-NSP-005 fix). The page
--     org-scopes the per-org QPS referral dashboard by intersecting the referral
--     list with listCommissionsForOrg() — invoker-RLS — so a PQS-member-only user
--     who could NOT read commissions saw an empty intersection → ZERO referrals.
--     Fix: commissions_select_member_or_admin += is_pqs_member_of(org) OR
--     is_nsp_coordinator_of(org), KEEPING the is_member_of arm unchanged. The
--     NEGATIVE assertion (a plain member's reach is NOT widened) is the keystone.
--     rede-a has 2 commissions (ccih, farmacia); chefe.ccih is a member of ccih ONLY.
-- ============================================================================
-- (D1) pqs.a (PQS member of rede-a, NO commission membership) now reads BOTH rede-a
-- commissions (was 0 pre-fix), and ZERO rede-b commissions.
select test_helpers.claims_for((select pqs_a from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_a from personas)),
  2,
  'D1: pqs.a (PQS-only) reads BOTH rede-a commissions via the broadened policy (was 0 pre-fix)');
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_b from personas)),
  0,
  'D1 ISOLATION: pqs.a reads ZERO rede-b commissions (cross-org denied)');
reset role;

-- (D2) nspcoord.a (coordinator of rede-a, NOT enrolled, NO commission membership)
-- also reads rede-a's commissions; zero cross-org.
select test_helpers.claims_for((select nspcoord_a from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions where organization_id = (select org_a from personas)),
  2,
  'D2: nspcoord.a (coordinator) reads rede-a commissions via the broadened policy');
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

-- (D4) the policy text actually carries all four arms (defense against a future revert
-- that drops the PQS terms).
select ok(
  (select count(*)::int from pg_policies
   where tablename = 'commissions' and policyname = 'commissions_select_member_or_admin'
     and qual like '%is_pqs_member_of%' and qual like '%is_nsp_coordinator_of%'
     and qual like '%is_member_of%' and qual like '%is_org_admin_of%') = 1,
  'D4: commissions_select carries all four arms (is_member_of + is_org_admin_of + is_pqs_member_of + is_nsp_coordinator_of)');

select * from finish();
rollback;
