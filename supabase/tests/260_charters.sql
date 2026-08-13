-- Committee Charters & Meeting Cadence (S4·CH, Phase 21) — commission_charters RLS
-- (CH-BE-2). Migration 20260818000000_charters_core.sql. ADR 0080; plan §9.
--
-- The table is member-READ (app.is_member_of(commission_id)) with NO authenticated
-- write policy (writes flow through the CH-BE-3 DEFINER upsert door). These asserts
-- prove ROW VISIBILITY under `set local role authenticated` + the JWT-claim GUC — NOT
-- the predicate's boolean return (ETH·E1 lesson: assert rows read, not the term).
--
-- Personas (bootstrap): comm_x members = sa_x (staff_admin) / st_x (staff); comm_y
-- members = sa_y / st_y. st_y is thus a FOREIGN-commission member vs comm_x. An
-- `outsider` (member of nothing) + `admin` (is_admin, member of nothing) cover the
-- plain non-member and the platform-admin cases. The `charters` feature flag is NOT
-- needed here — RLS on the table is independent of the flag (the flag gates the RPCs/UI).

begin;
select plan(11);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'org_b')::uuid   as org_b
  from ctx;
grant select on k to authenticated;

-- A clean non-member (authenticated, member of no commission), org-anchored to the
-- fixture org so it is a valid registered user.
create temp table o on commit drop as select gen_random_uuid() as outsider;
grant select on o to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', (select outsider from o),
         'authenticated', 'authenticated', (select outsider from o) || '@test', now(), now();
update public.profiles set full_name = 'Outsider', home_organization_id = (select org_b from k)
  where id = (select outsider from o);

-- Seed one charter per commission as the owner role (RLS bypassed → set up the world).
insert into public.commission_charters (commission_id, meeting_frequency, created_by)
  select comm_x, 'mensal', admin from k;
insert into public.commission_charters (commission_id, meeting_frequency, created_by)
  select comm_y, 'mensal', admin from k;

-- =========================================================================
-- Structure: table + RLS enabled + member-read-only policy shape.
-- =========================================================================
select has_table('public', 'commission_charters', 'commission_charters table exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.commission_charters'::regclass),
  true,
  'RLS is enabled on commission_charters'
);

select is(
  (select count(*)::int from pg_policy where polrelid = 'public.commission_charters'::regclass),
  1,
  'commission_charters has exactly one policy'
);

select is(
  (select count(*)::int from pg_policy
     where polrelid = 'public.commission_charters'::regclass and polcmd <> 'r'),
  0,
  'the only policy is SELECT — no INSERT/UPDATE/DELETE policy (DEFINER write door)'
);

-- =========================================================================
-- Member of comm_x reads comm_x's charter, and NOT comm_y's (isolation).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_charters where commission_id = (select comm_x from k)),
  1,
  'a member (staff) reads their own commission charter'
);
select is(
  (select count(*)::int from public.commission_charters where commission_id = (select comm_y from k)),
  0,
  'a member of comm_x cannot read a foreign commission charter (comm_y)'
);
reset role;

-- staff_admin (also a member) reads the charter.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_charters where commission_id = (select comm_x from k)),
  1,
  'the staff_admin (a member) reads the commission charter'
);
reset role;

-- =========================================================================
-- Foreign-commission member (st_y ∈ comm_y) is denied comm_x, but sees comm_y.
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_charters where commission_id = (select comm_x from k)),
  0,
  'a foreign-commission member (comm_y) is denied the comm_x charter'
);
select is(
  (select count(*)::int from public.commission_charters where commission_id = (select comm_y from k)),
  1,
  'that same member still reads their own comm_y charter (not a blanket deny)'
);
reset role;

-- =========================================================================
-- Plain non-member sees nothing; platform-admin (is_admin, no membership) too.
-- =========================================================================
select test_helpers.claims_for((select outsider from o), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_charters),
  0,
  'a non-member (member of no commission) sees zero charters'
);
reset role;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (select count(*)::int from public.commission_charters where commission_id = (select comm_x from k)),
  0,
  'platform_admin (is_admin, not a member) cannot read a commission charter (noun rule)'
);
reset role;

select * from finish();
rollback;
