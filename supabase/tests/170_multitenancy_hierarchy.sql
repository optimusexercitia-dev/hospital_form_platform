-- Multi-tenancy hierarchy (Phase A) — predicates, auto-derive trigger, per-org
-- slug uniqueness, and the THREE new management-table policies in isolation.
-- Phase A only: NO existing tenant policy is exercised here (that is the Phase E
-- cross-org leak suite, e.g. 171_cross_org_isolation.sql).
--
-- Fixtures: test_helpers.bootstrap() gives us personas (admin, sa_x, st_x, ...)
-- and two commissions (comm_x, comm_y) that are NOT yet attached to a hospital.
-- On top of it we build two orgs (A, B) each with a hospital, an org_admin, and
-- we re-home comm_x under org-A's hospital / comm_y under org-B's hospital so the
-- org-admin-of-commission predicates have real data.

begin;
select plan(41);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- New hierarchy fixtures (created as postgres; RLS bypassed for setup).
create temp table h on commit drop as
  select gen_random_uuid() as org_a,
         gen_random_uuid() as org_b,
         gen_random_uuid() as hosp_a,
         gen_random_uuid() as hosp_b,
         (v->>'admin')::uuid as admin,
         (v->>'sa_x')::uuid  as sa_x,
         (v->>'st_x')::uuid  as st_x,
         (v->>'sa_y')::uuid  as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on h to authenticated;

-- org_admin personas reuse existing profiles: sa_x will be org_admin of A,
-- sa_y will be org_admin of B. (They are also staff_admins of commissions, but
-- the org-admin predicates only look at organization_members.)
insert into public.organizations (id, name, slug, created_by)
  select org_a, 'Org A', 'org-a', admin from h
  union all
  select org_b, 'Org B', 'org-b', admin from h;

insert into public.hospitals (id, organization_id, name, slug)
  select hosp_a, org_a, 'Hospital A', 'hosp-a' from h
  union all
  select hosp_b, org_b, 'Hospital B', 'hosp-b' from h;

insert into public.organization_members (organization_id, user_id, role)
  select org_a, sa_x, 'org_admin' from h
  union all
  select org_b, sa_y, 'org_admin' from h;

-- Re-home the bootstrap commissions under the hospitals so the derive trigger
-- fills organization_id and is_org_admin_of_commission has data.
update public.commissions set hospital_id = (select hosp_a from h) where id = (select comm_x from h);
update public.commissions set hospital_id = (select hosp_b from h) where id = (select comm_y from h);

-- ============================================================================
-- (A) Auto-derive trigger: organization_id follows hospital_id, non-app-writable.
-- ============================================================================
select is(
  (select organization_id from public.commissions where id = (select comm_x from h)),
  (select org_a from h),
  'derive trigger: comm_x.organization_id derived from hospital A => org A');

select is(
  (select organization_id from public.commissions where id = (select comm_y from h)),
  (select org_b from h),
  'derive trigger: comm_y.organization_id derived from hospital B => org B');

-- App-supplied organization_id is OVERWRITTEN from the hospital (cannot drift).
update public.commissions
  set hospital_id = (select hosp_a from h), organization_id = (select org_b from h)
  where id = (select comm_x from h);
select is(
  (select organization_id from public.commissions where id = (select comm_x from h)),
  (select org_a from h),
  'derive trigger: app-supplied bogus organization_id is overwritten from hospital (no drift)');

-- Moving hospital_id to a hospital in a different org moves organization_id with it.
update public.commissions set hospital_id = (select hosp_b from h) where id = (select comm_x from h);
select is(
  (select organization_id from public.commissions where id = (select comm_x from h)),
  (select org_b from h),
  'derive trigger: changing hospital_id re-derives organization_id');
-- restore comm_x under hospital A for the remaining assertions
update public.commissions set hospital_id = (select hosp_a from h) where id = (select comm_x from h);

-- ============================================================================
-- (B) Per-org slug uniqueness on commissions: two orgs may both have `ccih`;
-- a duplicate within ONE org raises 23505.
-- ============================================================================
insert into public.commissions (name, slug, hospital_id) values ('CCIH A', 'ccih', (select hosp_a from h));
insert into public.commissions (name, slug, hospital_id) values ('CCIH B', 'ccih', (select hosp_b from h));
-- Scope to OUR two orgs (the committed seed may also have a `ccih` slug).
select is(
  (select count(*)::int from public.commissions
     where slug = 'ccih' and organization_id in ((select org_a from h), (select org_b from h))),
  2,
  'per-org slug uniqueness: two orgs may both have a `ccih` commission');

select throws_ok(
  format($$ insert into public.commissions (name, slug, hospital_id) values ('CCIH A dup', 'ccih', %L) $$,
         (select hosp_a from h)),
  '23505',
  null,
  'per-org slug uniqueness: a second `ccih` within the SAME org raises 23505');

-- hospitals slug uniqueness is per org too.
insert into public.hospitals (organization_id, name, slug) values ((select org_a from h), 'Hosp Two A', 'hosp-shared');
insert into public.hospitals (organization_id, name, slug) values ((select org_b from h), 'Hosp Two B', 'hosp-shared');
select is(
  (select count(*)::int from public.hospitals where slug = 'hosp-shared'),
  2,
  'hospitals slug uniqueness: two orgs may both have a `hosp-shared`');
select throws_ok(
  format($$ insert into public.hospitals (organization_id, name, slug) values (%L, 'dup', 'hosp-shared') $$,
         (select org_a from h)),
  '23505',
  null,
  'hospitals slug uniqueness: duplicate within the SAME org raises 23505');

-- ============================================================================
-- (C) The four predicates (called directly — DEFINER, bypass RLS).
-- ============================================================================
-- is_org_admin_of / _for: sa_x admins A, not B; sa_y admins B, not A.
select ok(app.is_org_admin_of_for((select org_a from h), (select sa_x from h)),
  'is_org_admin_of_for: sa_x is org_admin of A');
select ok(not app.is_org_admin_of_for((select org_b from h), (select sa_x from h)),
  'is_org_admin_of_for: sa_x is NOT org_admin of B');
select ok(app.is_org_admin_of_for((select org_b from h), (select sa_y from h)),
  'is_org_admin_of_for: sa_y is org_admin of B');
select ok(not app.is_org_admin_of_for((select org_a from h), (select sa_y from h)),
  'is_org_admin_of_for: sa_y is NOT org_admin of A');
-- a platform_admin (admin) and a plain member are NOT org_admins (real DB read, no is_admin fallback).
select ok(not app.is_org_admin_of_for((select org_a from h), (select admin from h)),
  'is_org_admin_of_for: platform_admin is NOT an org_admin (no is_admin fallback)');
select ok(not app.is_org_admin_of_for((select org_a from h), (select st_x from h)),
  'is_org_admin_of_for: a plain staff member is NOT an org_admin');

-- is_org_admin_of_commission / _for: comm_x is under org A (sa_x), comm_y under B (sa_y).
select ok(app.is_org_admin_of_commission_for((select comm_x from h), (select sa_x from h)),
  'is_org_admin_of_commission_for: sa_x admins comm_x (under org A)');
select ok(not app.is_org_admin_of_commission_for((select comm_y from h), (select sa_x from h)),
  'is_org_admin_of_commission_for: sa_x does NOT admin comm_y (under org B)');
select ok(app.is_org_admin_of_commission_for((select comm_y from h), (select sa_y from h)),
  'is_org_admin_of_commission_for: sa_y admins comm_y (under org B)');
select ok(not app.is_org_admin_of_commission_for((select comm_x from h), (select sa_y from h)),
  'is_org_admin_of_commission_for: sa_y does NOT admin comm_x (under org A)');
select ok(not app.is_org_admin_of_commission_for((select comm_x from h), (select admin from h)),
  'is_org_admin_of_commission_for: platform_admin does NOT admin a commission (no is_admin fallback)');

-- The auth.uid() variants resolve via the JWT claim. Act as sa_x.
select test_helpers.claims_for((select sa_x from h), false);
set local role authenticated;
select ok(app.is_org_admin_of((select org_a from h)),
  'is_org_admin_of (auth.uid): sa_x sees org A');
select ok(not app.is_org_admin_of((select org_b from h)),
  'is_org_admin_of (auth.uid): sa_x does NOT see org B');
select ok(app.is_org_admin_of_commission((select comm_x from h)),
  'is_org_admin_of_commission (auth.uid): sa_x admins comm_x');
select ok(not app.is_org_admin_of_commission((select comm_y from h)),
  'is_org_admin_of_commission (auth.uid): sa_x does NOT admin comm_y');
reset role;

-- ============================================================================
-- (D) Management-table RLS in isolation.
-- ============================================================================

-- --- org_admin of A (sa_x): reads own org, 0 of B; writes into A only. ---
select test_helpers.claims_for((select sa_x from h), false);
set local role authenticated;

select is((select count(*)::int from public.organizations where id = (select org_a from h)), 1,
  'org_admin A: SELECT sees its own organization');
select is((select count(*)::int from public.organizations where id = (select org_b from h)), 0,
  'org_admin A: SELECT sees 0 of org B');
select is((select count(*)::int from public.hospitals where organization_id = (select org_a from h)), 2,
  'org_admin A: SELECT sees org A hospitals (Hospital A + Hosp Two A)');
select is((select count(*)::int from public.hospitals where organization_id = (select org_b from h)), 0,
  'org_admin A: SELECT sees 0 of org B hospitals');
select is((select count(*)::int from public.organization_members where organization_id = (select org_a from h)), 1,
  'org_admin A: SELECT sees org A members');
select is((select count(*)::int from public.organization_members where organization_id = (select org_b from h)), 0,
  'org_admin A: SELECT sees 0 of org B members');

-- org_admin A CAN insert a hospital into A.
prepare oa_insert_hosp_a as
  insert into public.hospitals (organization_id, name, slug)
  values ((select org_a from h), 'Hosp Three A', 'hosp-three-a');
select lives_ok('execute oa_insert_hosp_a', 'org_admin A CAN insert a hospital into org A');
deallocate oa_insert_hosp_a;

-- org_admin A CANNOT insert a hospital into B (WITH CHECK violation => 42501).
select throws_ok(
  format($$ insert into public.hospitals (organization_id, name, slug) values (%L, 'Sneaky B', 'sneaky-b') $$,
         (select org_b from h)),
  '42501',
  null,
  'org_admin A CANNOT insert a hospital into org B (WITH CHECK blocks)');

-- org_admin A CANNOT create an organization (no write policy for non-admin => 42501).
select throws_ok(
  $$ insert into public.organizations (name, slug) values ('Rogue Org', 'rogue-org') $$,
  '42501',
  null,
  'org_admin A CANNOT create an organization (provisioning is vendor-only)');

-- org_admin A CAN add an org member to A, CANNOT to B.
prepare oa_add_member_a as
  insert into public.organization_members (organization_id, user_id, role)
  values ((select org_a from h), (select st_x from h), 'org_admin');
select lives_ok('execute oa_add_member_a', 'org_admin A CAN add an org member to org A');
deallocate oa_add_member_a;

select throws_ok(
  format($$ insert into public.organization_members (organization_id, user_id, role) values (%L, %L, 'org_admin') $$,
         (select org_b from h), (select st_x from h)),
  '42501',
  null,
  'org_admin A CANNOT add an org member to org B (WITH CHECK blocks)');

reset role;

-- --- platform_admin (admin): can create an org; reads all. ---
select test_helpers.claims_for((select admin from h), true);
set local role authenticated;

prepare admin_insert_org as
  insert into public.organizations (name, slug) values ('Org C', 'org-c');
select lives_ok('execute admin_insert_org', 'platform_admin CAN create an organization');
deallocate admin_insert_org;

select is((select count(*)::int from public.organizations where slug in ('org-a','org-b','org-c')), 3,
  'platform_admin: SELECT sees all organizations');
-- By now: org A has hosp-a + hosp-shared + hosp-three-a (3); org B has hosp-b +
-- hosp-shared (2) => 5 across A+B.
select is((select count(*)::int from public.hospitals where organization_id in ((select org_a from h),(select org_b from h))), 5,
  'platform_admin: SELECT sees all orgs hospitals');

reset role;

-- --- plain staff (st_x, no org role): 0 SELECT, no INSERT. ---
-- NOTE: st_x was added as an org_admin of A above; use st_y instead, a clean
-- no-org-role persona.
select test_helpers.claims_for((select (v->>'st_y')::uuid from ctx), false);
set local role authenticated;

select is((select count(*)::int from public.organizations), 0,
  'plain staff: SELECT sees 0 organizations');
select is((select count(*)::int from public.hospitals), 0,
  'plain staff: SELECT sees 0 hospitals');
select is((select count(*)::int from public.organization_members), 0,
  'plain staff: SELECT sees 0 organization_members');

select throws_ok(
  format($$ insert into public.hospitals (organization_id, name, slug) values (%L, 'nope', 'nope-slug') $$,
         (select org_a from h)),
  '42501',
  null,
  'plain staff CANNOT insert a hospital (no write grant via policy)');

reset role;

select * from finish();
rollback;
