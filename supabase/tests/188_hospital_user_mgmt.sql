-- Hospital-scoped user management RLS gates (ADR 0051 Decision 7 / Q2; migrations
-- 20260709000500 self-read + 20260709000600 profiles hospital arm). These back the
-- A10 service-role TS actions (registerUser / manage-user), whose authz reads the
-- caller's hospitalAdminOf grant (self-read) and whose directory reads profiles
-- under the hospital arm. The TS home-hospital hard-set + per-committee scope are
-- covered by E2E (they are service-role/TS, not RLS); this file proves the RLS
-- reads those gates depend on resolve correctly AND isolate.
--
-- Personas: hospitaladmin.a1 (e1, central-a ONLY), hospitaladmin.dual (e3, both
-- org-a hospitals), orgadmin.a (b1), staff1.qual.b (b3, org-b).
begin;
select plan(11);

create temp table p on commit drop as select
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha1,
  '00000000-0000-0000-0000-0000000000e3'::uuid as ha_dual,
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b3'::uuid as staff_b,
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_ccih,   -- CCIH (central-a) member
  '00000000-0000-0000-0000-000000000005'::uuid as chefe_farm,   -- Farmácia (central-a) member
  '05000000-0000-0000-0000-00000000000a'::uuid as hosp_central_a;
grant select on p to authenticated;

-- ============================================================================
-- §1: organization_members self-read (20260709000500) — a hospital_admin reads
--     its OWN grant so getSessionContext resolves hospitalAdminOf.
-- ============================================================================
select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.organization_members where user_id = (select ha1 from p)),
  1,
  'SELF-READ: hospitaladmin.a1 reads its OWN grant row (1 = central-a)');
select is(
  (select count(*)::int from public.organization_members where user_id = (select orgadmin_a from p)),
  0,
  'SELF-READ ISOLATION: a1 reads ZERO of ANOTHER user''s grant rows (no roster leak)');
reset role;

select test_helpers.claims_for((select ha_dual from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.organization_members where user_id = (select ha_dual from p)),
  2,
  'SELF-READ: hospitaladmin.dual reads its TWO own grant rows (both hospitals)');
reset role;

-- ============================================================================
-- §2: profiles hospital arm (20260709000600) — a hospital_admin reads its own
--     hospital's users; NOT a sibling hospital's / org-b's.
-- ============================================================================
select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
select ok(
  exists(select 1 from public.profiles where id = (select chefe_ccih from p)),
  'PROFILES: a1 reads a CCIH member''s profile (central-a via commission arm)');
select ok(
  exists(select 1 from public.profiles where id = (select chefe_farm from p)),
  'PROFILES: a1 reads a Farmácia member''s profile (central-a via commission arm)');
select ok(
  not exists(select 1 from public.profiles where id = (select staff_b from p)),
  'PROFILES PROOF: a1 reads ZERO of an org-b user''s profile (cross-org denied)');
-- a1's directory read set (home_hospital match ∪ central-a commission members).
select ok(
  (select count(*)::int from public.profiles
   where home_hospital_id = (select hosp_central_a from p)
      or id in (
        select cm.user_id from public.commission_members cm
        join public.commissions c on c.id = cm.commission_id
        where c.hospital_id = (select hosp_central_a from p)
      )) >= 5,
  'DIRECTORY: a1 reads its hospital''s users (home-anchored ∪ central-a commission members)');
reset role;

-- ============================================================================
-- §3: an org-b user (staff) reads NONE of org-a's users; a plain member has no
--     hospital-admin read power.
-- ============================================================================
select test_helpers.claims_for((select staff_b from p), false);
set local role authenticated;
select ok(
  not exists(select 1 from public.profiles where id = (select chefe_ccih from p)),
  'PROFILES PROOF: org-b staff reads ZERO of an org-a user''s profile');
reset role;

-- ============================================================================
-- §4: org_admin still reads its whole org's users (org tier unchanged — the
--     hospital arm ADDED coverage, removed none).
-- ============================================================================
select test_helpers.claims_for((select orgadmin_a from p), false);
set local role authenticated;
select ok(
  exists(select 1 from public.profiles where id = (select chefe_ccih from p)),
  'PROFILES: org_admin.a reads a central-a user (org arm intact)');
-- org_admin's read is org-wide, not hospital-limited: it sees the secundario-a
-- commission (Ética) too — the org tier is unchanged by the hospital arm.
select ok(
  exists(select 1 from public.commissions where id = 'e0000000-0000-0000-0000-0000000000e1'),
  'PROFILES/ORG: org_admin.a reads the secundario-a (Ética) commission too (whole org, not hospital-limited)');
reset role;

-- ============================================================================
-- §5: profiles WRITE is NOT widened — a hospital_admin cannot UPDATE a user's
--     profile directly under RLS (mutations go through the service-role action,
--     TS-gated). Prove the direct RLS write affects ZERO rows (RLS filters the
--     row out of the UPDATE's scope).
-- ============================================================================
select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
-- Attempt the write (RLS scopes it to zero rows — no error, just a no-op), then
-- prove the column did NOT change: a hospital_admin has no profiles WRITE arm.
update public.profiles set hospital_employee_id = 'X-HACK'
where id = '00000000-0000-0000-0000-000000000002';
reset role;
-- Read back as an org_admin (who CAN read the row) and assert it was untouched.
select test_helpers.claims_for((select orgadmin_a from p), false);
set local role authenticated;
select isnt(
  (select hospital_employee_id from public.profiles where id = (select chefe_ccih from p)),
  'X-HACK',
  'WRITE GUARD: a hospital_admin''s direct RLS UPDATE of a user profile is a no-op (no WRITE arm; the service-role action is the only path)');
reset role;

select * from finish();
rollback;
