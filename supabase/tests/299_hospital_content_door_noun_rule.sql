-- BUG-AUTHZ-002 — the noun rule at the hospital-tier DEFINER doors.
--
-- ADR 0078 A35: platform_admin may administer tenancy, identity, vocabulary and AUDIT;
-- it may not read commission CONTENT. `20260903000700` closed the five `dashboard_*`
-- DEFINERs (held by `270`); this file is its hospital-tier sibling, and
-- `20260908000100` is the fix it holds.
--
-- ⚠ WHY THIS IS NOT THE TEST THE BUG ASKED FOR. The bug prescribes "platform_admin gets
-- zero rows from *every* hospital-tier DEFINER". Enumerating that property live returns
-- FOUR doors, and one of them — `verify_audit_chain` — must NOT return zero, because its
-- `app.is_admin()` is a PLATFORM-tier branch (all args null) and the global audit chain
-- is exactly the noun platform_admin is granted. The literal test would have failed on a
-- correct function, or led someone to "fix" it. The property under test is commission
-- CONTENT, not hospital TIER.
--
-- ⚠ AND THE ENUMERATION IS COMPUTED, NOT LISTED (§4). The two doors were missed in the
-- first place because `20260903000700` swept by NAME PREFIX (`dashboard_*`) where the
-- real property is structural. A hand-written list of two here would repeat that mistake
-- one level down: the next hospital-tier content door added would be absent from it and
-- silently uncovered. §4 derives the door set from `pg_proc` at run time and FAILS on any
-- member it does not recognise, so a new one cannot land un-adjudicated.
--
-- Every assertion is a ROW COUNT under `set local role authenticated`, never a predicate
-- call: a correct predicate is not a correct door (the three-shapes lesson).
--
-- Assertion count: 11

begin;
select plan(11);

update app.feature_flags set enabled = true
  where key in ('controlled_docs', 'quality_indicators', 'audit_trail');

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000b0'::uuid as platform,    -- platform@ (is_admin)
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,  -- hospitaladmin.a1
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin,   -- orgadmin.a
  '05000000-0000-0000-0000-00000000000a'::uuid as hospital;    -- Hospital Central A
grant select on k to authenticated;

-- ============================================================================
-- §1 NON-VACUITY. If the hospital has no documents and no indicators, "platform_admin
-- reads 0" is true for the boring reason and §2 proves nothing. Asserted as the
-- LEGITIMATE authority, so it also fixes the expected counts §3 compares against.
-- ============================================================================
select test_helpers.claims_for((select hosp_admin from k), false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.hospital_document_register((select hospital from k))), '>', 0,
  '1.1 NON-VACUITY: the hospital_admin DOES read controlled documents for this hospital');
select cmp_ok(
  (select count(*)::int from public.hospital_indicator_rollup((select hospital from k))), '>', 0,
  '1.2 NON-VACUITY: the hospital_admin DOES read indicator rollups for this hospital');
reset role;

-- ============================================================================
-- §2 THE FIX. platform_admin reads ZERO commission content through either door.
-- Mutation oracle: restore the `app.is_admin() or` disjunct to either function and the
-- matching assertion goes red (3 and 2 rows respectively, measured live before the fix).
-- ============================================================================
select test_helpers.claims_for((select platform from k), true);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_document_register((select hospital from k))), 0,
  '2.1 NOUN RULE: platform_admin reads 0 controlled documents (read 3 before the fix)');
select is(
  (select count(*)::int from public.hospital_indicator_rollup((select hospital from k))), 0,
  '2.2 NOUN RULE: platform_admin reads 0 indicator rollups (read 2 before the fix)');
reset role;

-- ============================================================================
-- §3 THE TWINS. A door that returns nothing to ANYONE also satisfies §2. Both
-- legitimate authorities must still read exactly what §1 established.
-- ============================================================================
select test_helpers.claims_for((select org_admin from k), false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.hospital_document_register((select hospital from k))), '>', 0,
  '3.1 TWIN: the org_admin still reads the documents (the fix did not fail closed)');
select cmp_ok(
  (select count(*)::int from public.hospital_indicator_rollup((select hospital from k))), '>', 0,
  '3.2 TWIN: the org_admin still reads the rollups');
reset role;

-- The audit door, both directions. Its platform-tier arm is CORRECT and a
-- string-keyed sweep would have stripped it.
select test_helpers.claims_for((select platform from k), true);
set local role authenticated;
select throws_ok(
  format($$select * from public.verify_audit_chain(null, null, %L)$$, (select hospital from k)),
  '42501', null,
  '3.3 the audit door still REFUSES platform_admin at the HOSPITAL tier');
select lives_ok(
  $$select * from public.verify_audit_chain(null, null, null)$$,
  '3.4 ...and still ADMITS it at the PLATFORM tier — audit is platform_admin''s own noun');
reset role;

-- ============================================================================
-- §4 THE ENUMERATION, COMPUTED. Every authenticated-reachable DEFINER door that takes a
-- hospital argument and returns rows must be adjudicated: either it carries no
-- `app.is_admin()` arm, or it is the audit door whose arm is the platform tier. Anything
-- else is a NEW un-adjudicated hospital-tier door, and this reds the moment it lands —
-- which is the whole point, since a name-keyed sweep is what produced the bug.
-- ============================================================================
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and p.proretset
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and pg_get_function_identity_arguments(p.oid) ~ 'hospital'
     and p.prosrc ~ 'app\.is_admin\(\)'
     and p.proname <> 'verify_audit_chain'),
  '',
  '4.1 CENSUS: no hospital-tier row-returning DEFINER carries an app.is_admin() arm (audit door excepted, by tier)');

select cmp_ok(
  (select count(*)::int
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.proretset
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and pg_get_function_identity_arguments(p.oid) ~ 'hospital'),
  '>=', 4,
  '4.2 CENSUS is not vacuous: the enumeration still finds the door family it audits');

-- The stale comment `20260908000100` corrected. A comment is an assertion, and this one
-- described a platform-admin arm that no longer exists; left standing it reads as intent
-- and invites the arm back.
select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'hospital_indicator_rollup'
     and p.prosrc ~ 'Q3 gate: platform admin'),
  0,
  '4.3 the gate comment no longer advertises the removed platform-admin arm');

select * from finish();
rollback;
