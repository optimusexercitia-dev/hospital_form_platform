-- AFF W2 / T2.4 — THE DOMINANCE GRID: org_admin dominates hospital_admin, enforced.
--
-- ADR 0097 D18 / finding 9. "org_admin dominates hospital_admin" has been asserted in
-- prose since ADR 0051 D1 and tested NOWHERE, which is why two gates drifted out of it
-- (`set_standard_ownership`, `standard_ownerships_select`, both fixed by
-- 20260909000800). That is BUG-AUTHZ-001's shape: a property everyone believes, that
-- nothing can falsify. This file makes it falsifiable.
--
-- Mechanically the ADR-0094 role-completeness grid (`291`/`292`/`293`): the population
-- is DERIVED FROM THE CATALOG at run time, never listed, so a gate added next phase is
-- adjudicated automatically instead of being absent from a hand-written list.
--
-- ⚠ THREE THINGS A NAIVE VERSION OF THIS FILE GETS WRONG, each of which cost a real
-- finding here:
--
--  1. **Surface text is not the property.** A regex census over `is_hospital_admin_of`
--     returned three hits and ONE IN THREE WAS A FALSE POSITIVE:
--     `list_approver_candidates` reaches org_admin through `is_tenancy_admin_of`,
--     whose `_for` variant resolves `has_role('organization', …, 'org_admin', …)` — a
--     spelling that contains neither `is_org_admin_of` nor anything a surface match
--     would catch. So the classifier resolves helper transitivity to a FIXPOINT, and
--     counts BOTH spellings of an org_admin arm. §2.3/§2.4 are the controls.
--  2. **The population's boundary must be the PROPERTY, not a syntax.** Sweeping only
--     for the helper NAME misses gates that inline the role literal. Adding the literal
--     arm found two gates the ADR's own census never saw (`assign_hospital_admin`,
--     `revoke_hospital_admin`) — both of which then resolve as compliant because they
--     delegate to `grant_role`/`revoke_role`. Neither would have been adjudicated at all
--     by a name-only sweep.
--  3. **A detector that finds nothing must be proven able to find something.** After
--     20260909000800 there are ZERO real gaps, so "0 gaps" is exactly what a broken
--     classifier also reports. §2 therefore builds SYNTHETIC gates inside this
--     transaction — one compliant, one not, one compliant-only-via-transitivity — and
--     requires the classifier to separate them. Anchoring the control on a real defect
--     would have evaporated the moment that defect was fixed (the recorded
--     vacuity-control lesson); these are anchored on things that are correct BY
--     CONSTRUCTION.
--
-- Assertion count: 12

begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- §2's synthetic controls, created BEFORE the classifier runs so they are part of the
-- same population it judges. Rolled back with the transaction.
-- ---------------------------------------------------------------------------
create function public.__grid_probe_gap(p uuid) returns boolean
  language sql stable security definer set search_path to 'app','public','pg_catalog'
  as $$ select app.is_hospital_admin_of(p) $$;

create function public.__grid_probe_ok(p uuid) returns boolean
  language sql stable security definer set search_path to 'app','public','pg_catalog'
  as $$ select app.is_hospital_admin_of(p) or app.is_org_admin_of(p) $$;

-- The `list_approver_candidates` shape: an org arm reachable ONLY through a helper.
create function public.__grid_probe_transitive(p uuid) returns boolean
  language sql stable security definer set search_path to 'app','public','pg_catalog'
  as $$ select app.is_hospital_admin_of(p) or app.is_tenancy_admin_of(p) $$;

-- ---------------------------------------------------------------------------
-- THE CLASSIFIER.
-- ---------------------------------------------------------------------------
create temp table grid on commit drop as
with recursive
-- ⚠ Comments stripped before ANY prosrc regex. A `--` line documenting an arm's REMOVAL
-- matches the arm; that trap has fired three times on this project, once inside the
-- comment warning about it.
fn as (
  select p.proname, regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public')
),
-- An org_admin arm, in EITHER spelling: the named helper family, or the inlined
-- has_role('organization', …, 'org_admin', …) that is_tenancy_admin_of_for uses.
direct as (
  select proname from fn
  where src ~ 'is_org_admin_of'
     or src ~ 'has_role\(\s*''organization''[^;]*''org_admin'''
),
-- Fixpoint over delegation, across BOTH schemas: a door that delegates to a door
-- inherits its authority (that is what clears assign_hospital_admin).
reaching as (
  select proname from direct
  union
  select f.proname from fn f join reaching r on f.src ~ ('\m' || r.proname || '\M')
  where f.proname <> r.proname
),
reach_re as (select '(' || string_agg(distinct proname, '|') || ')' as re from reaching),
-- GATES, not helpers: RLS policies + every prosecdef function in public. `prosecdef`
-- belongs beside `pg_policies` — a DEFINER's gate REPLACES RLS, so a policy-shaped
-- audit is structurally blind to it (ADR 0079).
gate as (
  select 'policy'::text as kind, pol.tablename || '.' || pol.policyname as name,
         coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '') as src
  from pg_policies pol where pol.schemaname = 'public'
  union all
  select 'door', p.proname, regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
)
select g.kind, g.name,
       (g.src ~ 'is_org_admin_of'
        or g.src ~ 'has_role\(\s*''organization''[^;]*''org_admin'''
        or g.src ~ ('\m' || (select re from reach_re) || '\M')) as admits_org_admin
from gate g
-- The population: every gate that admits hospital_admin, by NAME or by role LITERAL.
where g.src ~ 'is_hospital_admin_of' or g.src ~ '''hospital_admin''';

-- ---------------------------------------------------------------------------
-- The allowlist. A deliberate exception goes here WITH its reason, and §3.1 asserts the
-- list is empty so that "fix" cannot be spelled "add a row here" without a reviewer
-- seeing an assertion change.
-- ---------------------------------------------------------------------------
create temp table grid_allowlist (name text primary key, reason text) on commit drop;
-- (empty — after 20260909000800 there are no deliberate exceptions)

-- ===========================================================================
-- §1 THE INVARIANT
-- ===========================================================================
select cmp_ok((select count(*)::int from grid where name not like '\_\_grid\_probe%'), '>', 15,
  '1.1 NON-VACUITY: the grid adjudicates a real population of hospital_admin gates (not an empty set)');

select is(
  (select coalesce(string_agg(name, ' | ' order by name), '')
     from grid
    where not admits_org_admin
      and name not like '\_\_grid\_probe%'
      and name not in (select name from grid_allowlist)), '',
  '1.2 ⭐ THE INVARIANT: every gate admitting hospital_admin also admits org_admin (names any that do not)');

select ok(
  (select admits_org_admin from grid where name = 'set_standard_ownership'),
  '1.3 GAP 1 FIXED: set_standard_ownership admits org_admin (it raised 42501 at one before 20260909000800)');

select ok(
  (select admits_org_admin from grid where name = 'standard_ownerships.standard_ownerships_select'),
  '1.4 GAP 2 FIXED: standard_ownerships_select admits org_admin');

select ok(
  (select admits_org_admin from grid where name = 'hospital_affiliations.hospital_affiliations_select'),
  '1.5 the AFF affiliation policy is IN the population and compliant (confirmed, not assumed)');

select ok(
  (select bool_and(admits_org_admin) from grid
    where name in ('profiles.profiles_admin_select', 'profiles.profiles_select_self_or_admin')),
  '1.6 both widened profiles policies are IN the population and compliant');

-- ===========================================================================
-- §2 CONTROLS — prove the classifier can SEPARATE, not merely return zero.
-- ===========================================================================
select is(
  (select admits_org_admin from grid where name = '__grid_probe_gap'), false,
  '2.1 ⭐ THE DETECTOR CAN FIND SOMETHING: a synthetic gate with a hospital arm and no org arm is flagged');

select is(
  (select admits_org_admin from grid where name = '__grid_probe_ok'), true,
  '2.2 ... and does not over-flag: a synthetic gate naming both arms is compliant');

select is(
  (select admits_org_admin from grid where name = '__grid_probe_transitive'), true,
  '2.3 HELPER TRANSITIVITY: an org arm reachable ONLY through is_tenancy_admin_of is resolved, not missed');

select ok(
  (select admits_org_admin from grid where name = 'list_approver_candidates'),
  '2.4 ... reproduced on the REAL historical false positive — the 1-in-3 a surface regex reported as a gap');

select cmp_ok(
  (select count(*)::int from grid where name in ('assign_hospital_admin', 'revoke_hospital_admin')), '=', 2,
  '2.5 POPULATION BOUNDARY: gates that INLINE the role literal are adjudicated too — a name-only sweep never saw these two');

-- ===========================================================================
-- §3 THE ALLOWLIST
-- ===========================================================================
select is((select count(*)::int from grid_allowlist), 0,
  '3.1 the allowlist is EMPTY — a future exception must be added with a reason, which changes this assertion');

select * from finish();
rollback;
