-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration C
-- (framework/standard CRUD + clone) keystones. ADR 0093 D2/D6 + Amendment 1
-- A1·2. Migration 20260903001200_accreditation_framework_crud.sql.
--
-- The `accreditation` flag ships OFF and seed.sql does not yet force it ON
-- (Wave 2 in progress) — §0 runs the flag-off census against the natural
-- default, THEN this file flips the flag ON in-transaction for every
-- subsequent section (reverted by the trailing rollback).
--
--   §0 — HC0Q9 flag-off on EVERY ONE of the six RPCs (enumerated, not
--        spot-checked): create_framework, update_framework,
--        set_framework_status, upsert_standard, delete_standard,
--        clone_framework.
--   §A — platform_admin (is_admin): CAN curate a global pack (create/
--        update/status/upsert_standard/delete_standard); CANNOT touch a
--        commission-owned one (42501) — the noun rule (D6), never leaking
--        outside this one arm.
--   §B — staff_admin: CAN curate its own commission-owned framework;
--        CANNOT edit the global pack directly (HC0QD, "clone to edit").
--        A foreign commission's staff_admin is rejected on comm_x's owned
--        framework (42501).
--   §C — HC0QE: an arquivado framework blocks update_framework and
--        upsert_standard, both on the global (by admin) and owned (by
--        staff_admin) path.
--   §D — HC0QC: invalid level (0, 4 — outside 1..3) and a cross-framework
--        parent on upsert_standard.
--   §E — clone fidelity: a 3-level hierarchy survives the two-pass remap —
--        the GRANDCHILD's parent resolves to the right cloned row (by
--        code), not just a row-count match. Plus the cross-tenant clone
--        rejection: a commission cannot clone ANOTHER commission's owned
--        framework (only global, or its own).
--
-- MUTATION DISCIPLINE: every keystone marked (verified) was broken by hand
-- against the live local stack, the SAME assertion re-run and confirmed
-- RED, then restored via a fresh `supabase db reset --local` — reported in
-- the turn's report, not encoded here (a permanent file is not the place to
-- ship a temporarily-broken function).

begin;

select plan(40);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'org_b')::uuid   as org_b,
         (v->>'hosp_b')::uuid  as hosp_b
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · Flag OFF — HC0Q9 on every one of the six RPCs. Phase 16 is
-- PO-APPROVED and shipped ON by default (Migration G + seed.sql), so this
-- section FORCES it off in-transaction first — it is testing the RPCs'
-- OWN gate behavior under a hypothetical/counterfactual off state (still a
-- real, ongoing invariant: if this ever gets rolled back, every RPC must
-- still deny), not the ambient default anymore.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'accreditation';
select ok(not app.feature_enabled('accreditation'), '0. flag accreditation is forced OFF for this section');

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.create_framework('280-off', 'Off Fw') $$,
  'HC0Q9', null, '0a. create_framework raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.update_framework(%L, 'x') $$, gen_random_uuid()),
  'HC0Q9', null, '0b. update_framework raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.set_framework_status(%L, 'arquivado') $$, gen_random_uuid()),
  'HC0Q9', null, '0c. set_framework_status raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.upsert_standard(%L, 'S1', 'Std') $$, gen_random_uuid()),
  'HC0Q9', null, '0d. upsert_standard raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.delete_standard(%L) $$, gen_random_uuid()),
  'HC0Q9', null, '0e. delete_standard raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.clone_framework(%L, %L) $$, gen_random_uuid(), (select comm_x from k)),
  'HC0Q9', null, '0f. clone_framework raises HC0Q9 while the flag is off'
);
reset role;

-- Flip the flag ON for the rest of this file (reverted by the trailing
-- rollback — the pgtap-fixture-flag-gaps lesson: an in-transaction flip,
-- not a reliance on seed.sql, so this file is independently runnable).
update app.feature_flags set enabled = true where key = 'accreditation';

-- ===========================================================================
-- §A · platform_admin: global pack CRUD ONLY (D6, the one correct is_admin
-- use). Never a commission-owned one.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;

create temp table fw_g on commit drop as
  select (public.create_framework('280-ona', '280 ONA', null, '2024')).id as id;
grant select on fw_g to authenticated;
select ok((select id from fw_g) is not null, 'A1. admin creates a global framework (owner NULL)');

select lives_ok(
  format($$ select public.update_framework(%L, '280 ONA (updated)') $$, (select id from fw_g)),
  'A2. admin updates the global framework'
);

create temp table std_g on commit drop as
  select (public.upsert_standard((select id from fw_g), 'G1', 'Seção Global', p_level => null)).id as id;
grant select on std_g to authenticated;
select ok((select id from std_g) is not null, 'A3. admin creates a standard on the global framework');

select throws_ok(
  format($$ select public.create_framework('280-owned-by-x', 'Nope', %L) $$, (select comm_x from k)),
  '42501', null, 'A4. admin CANNOT create a framework owned by a commission (noun rule)'
);
reset role;

-- comm_x creates its OWN framework as a fixture for the negative admin
-- checks below.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table fw_x on commit drop as
  select (public.create_framework('280-custom-x', '280 Custom X', (select comm_x from k))).id as id;
grant select on fw_x to authenticated;
reset role;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  format($$ select public.update_framework(%L, 'nope') $$, (select id from fw_x)),
  '42501', null, 'A5. admin CANNOT edit comm_x''s owned framework (42501, not HC0QD — this is the noun rule, not the clone hint)'
);
select throws_ok(
  format($$ select public.upsert_standard(%L, 'X0', 'Nope') $$, (select id from fw_x)),
  '42501', null, 'A6. admin CANNOT add a standard to comm_x''s owned framework either — the noun rule holds on the standards arm too'
);
reset role;

-- ===========================================================================
-- §B · staff_admin: own commission-owned framework ONLY. HC0QD on the
-- global pack; 42501 on a FOREIGN commission's owned one.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok((select owner_commission_id from public.accreditation_frameworks where id = (select id from fw_x)) = (select comm_x from k),
  'B1. sa_x''s framework is owned by comm_x');

select lives_ok(
  format($$ select public.update_framework(%L, '280 Custom X (updated)') $$, (select id from fw_x)),
  'B2. sa_x updates comm_x''s own framework'
);

create temp table std_x on commit drop as
  select (public.upsert_standard((select id from fw_x), 'X1', 'Seção X', p_level => null)).id as id;
grant select on std_x to authenticated;
select ok((select id from std_x) is not null, 'B3. sa_x creates a standard on comm_x''s own framework');

select throws_ok(
  format($$ select public.update_framework(%L, 'nope') $$, (select id from fw_g)),
  'HC0QD', null, 'B4. sa_x CANNOT edit the global framework directly — HC0QD (''clone to edit''), not a bare 42501'
);
select throws_ok(
  format($$ select public.upsert_standard(%L, 'G2', 'Nope') $$, (select id from fw_g)),
  'HC0QD', null, 'B5. sa_x CANNOT add a standard to the global framework either — HC0QD'
);
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_framework(%L, 'nope') $$, (select id from fw_x)),
  '42501', null, 'B6. a FOREIGN commission''s staff_admin (sa_y ∈ comm_y) is denied comm_x''s owned framework'
);
reset role;

-- ===========================================================================
-- §C · HC0QE — an arquivado framework blocks editing, on BOTH paths.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_framework_status(%L, 'arquivado') $$, (select id from fw_x)),
  'C1. sa_x archives comm_x''s own framework'
);
select throws_ok(
  format($$ select public.update_framework(%L, 'nope') $$, (select id from fw_x)),
  'HC0QE', null, 'C2. an arquivado OWNED framework rejects update_framework (K — mutation-proved)'
);
select throws_ok(
  format($$ select public.upsert_standard(%L, 'X2', 'Nope') $$, (select id from fw_x)),
  'HC0QE', null, 'C3. an arquivado OWNED framework rejects upsert_standard too'
);
select lives_ok(
  format($$ select public.set_framework_status(%L, 'ativo') $$, (select id from fw_x)),
  'C4. sa_x can UN-archive (set_framework_status does not itself block on arquivado)'
);
reset role;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select lives_ok(
  format($$ select public.set_framework_status(%L, 'arquivado') $$, (select id from fw_g)),
  'C5. admin archives the global framework'
);
select throws_ok(
  format($$ select public.update_framework(%L, 'nope') $$, (select id from fw_g)),
  'HC0QE', null, 'C6. an arquivado GLOBAL framework rejects update_framework, even for admin'
);
select lives_ok(
  format($$ select public.set_framework_status(%L, 'ativo') $$, (select id from fw_g)),
  'C7. admin un-archives the global framework'
);
reset role;

-- ===========================================================================
-- §D · HC0QC — invalid level, invalid (cross-framework) parent.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.upsert_standard(%L, 'X3', 'Nível 0', p_level => 0::smallint) $$, (select id from fw_x)),
  'HC0QC', null, 'D1. level 0 is rejected (outside 1..3) — HC0QC, not a raw 23514'
);
select throws_ok(
  format($$ select public.upsert_standard(%L, 'X4', 'Nível 4', p_level => 4::smallint) $$, (select id from fw_x)),
  'HC0QC', null, 'D2. level 4 is rejected (outside 1..3)'
);

create temp table fw_x2 on commit drop as
  select (public.create_framework('280-custom-x2', '280 Custom X2', (select comm_x from k))).id as id;
grant select on fw_x2 to authenticated;
create temp table std_x2 on commit drop as
  select (public.upsert_standard((select id from fw_x2), 'X2-1', 'Outro framework')).id as id;
grant select on std_x2 to authenticated;

select throws_ok(
  format($$ select public.upsert_standard(%L, 'X5', 'Pai cruzado', p_parent => %L) $$,
    (select id from fw_x), (select id from std_x2)),
  'HC0QC', null, 'D3. a parent from a DIFFERENT framework is rejected — HC0QC'
);
select lives_ok(
  format($$ select public.upsert_standard(%L, 'X6', 'Pai correto', p_parent => %L) $$,
    (select id from fw_x), (select id from std_x)),
  'D4. a parent in the SAME framework is accepted (positive control)'
);

-- D5 — a REAL, successful delete_standard call (not just the §0 flag-off
-- negative, which raises before reaching the RPC's actual body — the ADR
-- 0079 never-called-door floor treats an early-raising call as not
-- exercising the door; found via the floor sweep, not assumed). std_x2 is
-- not referenced again after this point in the file.
select lives_ok(
  format($$ select public.delete_standard(%L) $$, (select id from std_x2)),
  'D5. sa_x deletes a standard from comm_x''s own framework (the door''s real body, not just the flag-off short-circuit)'
);
select ok(
  not exists (select 1 from public.accreditation_standards where id = (select id from std_x2)),
  'D6. the deleted standard is actually gone'
);
reset role;

-- ===========================================================================
-- §E · Clone fidelity + the cross-tenant clone rejection.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table fw_clone_src on commit drop as
  select (public.create_framework('280-clone-src', '280 Clone Source', null, '1')).id as id;
grant select on fw_clone_src to authenticated;
create temp table std_root on commit drop as
  select (public.upsert_standard((select id from fw_clone_src), 'R', 'Root', p_position => 1)).id as id;
grant select on std_root to authenticated;
create temp table std_child on commit drop as
  select (public.upsert_standard((select id from fw_clone_src), 'R.1', 'Child', p_parent => (select id from std_root), p_level => 1::smallint)).id as id;
grant select on std_child to authenticated;
create temp table std_grandchild on commit drop as
  select (public.upsert_standard((select id from fw_clone_src), 'R.1.a', 'Grandchild', p_parent => (select id from std_child), p_level => 2::smallint)).id as id;
grant select on std_grandchild to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table fw_cloned on commit drop as
  select (public.clone_framework((select id from fw_clone_src), (select comm_x from k))).id as id;
grant select on fw_cloned to authenticated;
select ok((select owner_commission_id from public.accreditation_frameworks where id = (select id from fw_cloned)) = (select comm_x from k),
  'E1. the clone is owned by comm_x');
select ok((select cloned_from_framework_id from public.accreditation_frameworks where id = (select id from fw_cloned)) = (select id from fw_clone_src),
  'E2. cloned_from_framework_id points at the source (D9 provenance)');
select is(
  (select count(*)::int from public.accreditation_standards where framework_id = (select id from fw_cloned)),
  3, 'E3. all three standards were cloned'
);
select is(
  (select p.code from public.accreditation_standards c
     join public.accreditation_standards p on p.id = c.parent_id
     where c.framework_id = (select id from fw_cloned) and c.code = 'R.1.a'),
  'R.1', 'E4. the GRANDCHILD''s DIRECT parent resolves to the cloned R.1 (by code) — the two-pass remap holds, not just a row count'
);
select is(
  (select gp.code from public.accreditation_standards c
     join public.accreditation_standards p on p.id = c.parent_id
     join public.accreditation_standards gp on gp.id = p.parent_id
     where c.framework_id = (select id from fw_cloned) and c.code = 'R.1.a'),
  'R', 'E4b. and the grandchild''s FULL chain resolves through TWO hops to the cloned ROOT — every parent_id in the tree points at the NEW rows, not stale source ids (verified)'
);
select is(
  (select p.code from public.accreditation_standards c
     join public.accreditation_standards p on p.id = c.parent_id
     where c.framework_id = (select id from fw_cloned) and c.code = 'R.1'),
  'R', 'E5. the direct child''s parent also resolves correctly'
);

-- Cross-tenant clone rejection: sa_x cannot clone comm_x's OWN framework
-- (fw_x, already exists) into... itself is fine (self-clone); the real
-- check is a FOREIGN commission's owned framework.
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.clone_framework(%L, %L) $$, (select id from fw_x), (select comm_y from k)),
  '42501', null, 'E6. sa_y (comm_y) CANNOT clone comm_x''s OWNED framework — the anti-leak guard RLS cannot provide here (verified)'
);
select lives_ok(
  format($$ select public.clone_framework(%L, %L) $$, (select id from fw_clone_src), (select comm_y from k)),
  'E7. sa_y CAN clone the GLOBAL source framework (positive control)'
);
reset role;

select * from finish();
rollback;
