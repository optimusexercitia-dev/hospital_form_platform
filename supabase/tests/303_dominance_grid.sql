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
-- ⚠ FOUR THINGS A NAIVE VERSION OF THIS FILE GETS WRONG, each of which cost a real
-- finding here. The fourth is stated at the classifier itself, where the fix lives, and
-- it is the one that invalidated the paragraph directly above this line for three weeks:
-- "adjudicated automatically" was FALSE for every door built in the actor-kernel shape.
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
-- Assertion count: 17

begin;
select plan(17);

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

-- ⭐ THE ACTOR-KERNEL TRIPLE, SYNTHESISED — the shape that was invisible until 2026-08-26.
-- Both wrappers below are `public` + prosecdef and neither NAMES a hospital arm; the whole
-- authority sits in the `app` kernel each delegates to. Before the widening, both were
-- absent from the population entirely — so the gap one contains could not be reported, and
-- neither could the compliance of the other. Anchored on things that are correct BY
-- CONSTRUCTION, per lesson 3 above: they do not evaporate when a real defect is fixed.
create function app.__grid_kernel_gap(p uuid) returns boolean
  language sql stable security definer set search_path to 'app','public','pg_catalog'
  as $$ select app.is_hospital_admin_of(p) $$;

create function app.__grid_kernel_ok(p uuid) returns boolean
  language sql stable security definer set search_path to 'app','public','pg_catalog'
  as $$ select app.is_hospital_admin_of(p) or app.is_org_admin_of(p) $$;

create function public.__grid_probe_wrapper_gap(p uuid) returns boolean
  language sql stable security definer set search_path to 'app','public','pg_catalog'
  as $$ select app.__grid_kernel_gap(p) $$;

create function public.__grid_probe_wrapper_ok(p uuid) returns boolean
  language sql stable security definer set search_path to 'app','public','pg_catalog'
  as $$ select app.__grid_kernel_ok(p) $$;

-- ---------------------------------------------------------------------------
-- ⭐⭐ THE EFFECTIVE DOOR BODY — the fix for the FOURTH thing (see the classifier below).
--
-- Materialised into its own temp table rather than folded into the classifier's WITH, and
-- built in TWO STAGES. Both are MEASUREMENTS, not style choices:
--   · As a correlated subquery inside the `with recursive` block, this logic planned
--     catastrophically: the file went from **1 s to 53 s**.
--   · Split out but resolving every door against every `app` function, it was still
--     **20 s** — 454 public DEFINER doors x ~600 app bodies of `strpos` + regex.
-- Two-staged (narrow to the doors that can possibly enter the population, THEN resolve
-- only those in full) it is ~1 s again. A 20x slowdown in a suite that runs on every phase
-- gate is how a correct check gets deleted by whoever meets it next.
--
-- ⚠ THE NARROWING IS EXACT, NOT AN APPROXIMATION. Population entry REQUIRES a hospital arm
-- somewhere in the effective body, so a door reaching no hospital-bearing kernel cannot
-- enter however its org side resolves — it keeps `src = own_src`, which is precisely what
-- this file did before the widening. Stage 2 then resolves the surviving doors against
-- ALL app functions, so the ORG side is judged on the complete effective body and nothing
-- is narrowed on the arm we are trying to prove present.
-- ---------------------------------------------------------------------------
create temp table door_src on commit drop as
with
  app_fn as (
    select p.proname, regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'),
  pub_door as (
    select p.proname, regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef),
  -- Stage 1: the small set of app kernels that carry a hospital arm at all.
  hosp_kern as (
    select proname, src from app_fn
     where src ~ 'is_hospital_admin_of' or src ~ '''hospital_admin'''),
  -- ... and the doors that can therefore enter the population: by their own body, or by
  -- naming one of those kernels. `strpos` prefilters the regex — `\mX\M` can only match
  -- where `X` is already a substring.
  candidate as (
    select d.proname from pub_door d
     where d.src ~ 'is_hospital_admin_of' or d.src ~ '''hospital_admin'''
        or exists (select 1 from hosp_kern k
                    where k.proname <> d.proname
                      and strpos(d.src, k.proname) > 0
                      and d.src ~ ('\m' || k.proname || '\M')))
-- Stage 2: full resolution, for the candidates only.
select d.proname as name,
       d.src as own_src,
       case when d.proname in (select proname from candidate)
            then d.src || ' ' || coalesce((
                   select string_agg(a.src, ' ') from app_fn a
                    where a.proname <> d.proname
                      and strpos(d.src, a.proname) > 0
                      and d.src ~ ('\m' || a.proname || '\M')), '')
            else d.src
       end as src
from pub_door d;

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
-- ⭐⭐ FOURTH THING A NAIVE VERSION GETS WRONG — FOUND 2026-08-26 (AFF4 B9), AND IT HAD
--    ALREADY SWALLOWED EVERY DOOR THIS PROJECT HAS BUILT SINCE AFF.
--
--    This file's header claims the population is "DERIVED FROM THE CATALOG at run time,
--    never listed, so a gate added next phase is adjudicated automatically". That claim
--    was FALSE for the actor-kernel triple (ADR 0098 §W2.1) — which is the shape of every
--    door built since. The authority predicate lives in `app.<door>_impl`; the
--    client-callable `public.<door>` wrapper just delegates, so its own body names neither
--    `is_hospital_admin_of` nor the literal, and the population filter below never saw it.
--    The `app` kernel was never a candidate either: the gate set is `public` only.
--
--    MEASURED before the fix: the door population was **13**; widening it to resolve a
--    wrapper's kernels makes it **32**. NINETEEN doors were being adjudicated by nothing,
--    including `void_affiliation`/`_for` (AFF4's hospital-tier door, the one this task was
--    sent to add), `affiliate_person`, `end_affiliation`, `update_affiliation`,
--    `grant_role`, `revoke_role` and their `_for` twins.
--
--    ⛔ BLIND, NOT VULNERABLE — and the distinction must survive any summary of this. All
--    45 gates in the widened population resolve as COMPLIANT; zero gaps, before and after.
--    What was broken is the detector's reach, not the doors.
--
--    ⚠ This is ADR 0079 Amendment 7's `ARM=wrapper` lesson on a different axis: an
--    INVOKER wrapper in front of a DEFINER body escaped the door sweep because every arm
--    bounded its domain by `prosecdef`; here a DEFINER wrapper in front of a DEFINER
--    kernel escaped the dominance grid because the grid bounded its domain by SCHEMA. The
--    generalisation is the same one both times: *the population's boundary must be the
--    PROPERTY, not a location.*
--
-- GATES, not helpers: RLS policies + every prosecdef function in public, EACH RESOLVED TO
-- ITS EFFECTIVE BODY — its own source plus the source of every `app` function it names.
-- `prosecdef` belongs beside `pg_policies` — a DEFINER's gate REPLACES RLS, so a
-- policy-shaped audit is structurally blind to it (ADR 0079).
--
-- ⚠ ONE HOP INTO `app`, DELIBERATELY, AND THE BOUND IS MEASURED. A transitive closure was
-- tried first: it inflates the population from 45 to 152 by dragging in every helper a
-- kernel reaches, takes ~52 s instead of ~0.9 s, and adjudicates doors on authority they
-- do not actually express. All 19 newly-covered doors are ONE hop (`public.X` ->
-- `app.X_impl`), which is what the triple shape guarantees. `strpos` prefilters the regex
-- because this is a cross join over every function in both schemas.
gate as (
  select 'policy'::text as kind, pol.tablename || '.' || pol.policyname as name,
         coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '') as src
  from pg_policies pol where pol.schemaname = 'public'
  union all
  select 'door', d.name, d.src from door_src d
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

-- ⭐ THE WIDENING'S OWN NON-VACUITY. Without this, resolving kernels could silently become
-- a no-op — a `strpos` typo, a schema rename — and 1.2 would keep reporting "no gaps"
-- exactly as it does now. This is the assertion that separates "adjudicated and clean"
-- from "not adjudicated at all", which is the failure the widening exists to fix.
select cmp_ok(
  (select count(*)::int from grid g join door_src d on d.name = g.name
    where g.kind = 'door'
      and g.name not like '\_\_grid\_probe%'
      and not (d.own_src ~ 'is_hospital_admin_of' or d.own_src ~ '''hospital_admin''')),
  '>=', 15,
  '1.7 ⭐ THE KERNEL RESOLUTION IS DOING WORK: 15+ real doors are in the population ONLY because their app kernel was resolved (measured 19 on 2026-08-26; 0 before the widening)');

select ok(
  (select bool_and(admits_org_admin) from grid
    where name in ('void_affiliation', 'void_affiliation_for')),
  '1.8 AFF4 (ADR 0151 D8): the void door and its service twin are IN the population and compliant — confirmed, not assumed');

-- ⛔ ABSENCE, STATED WITH ITS REASON, so it cannot be read as a half-swept class. The other
-- four AFF4 doors are org-tier and carry NO hospital_admin arm at all (ADR 0151 D2:
-- org_admin of that organisation only). The dominance property has nothing to say about a
-- gate that never admits hospital_admin, so their absence here is correct — and asserting
-- it means a future author who ADDS a hospital arm to one of them lands in 1.2, not in a
-- silence that looks the same as this.
select is(
  (select count(*)::int from grid where name in (
     'affiliate_person_to_org', 'end_org_affiliation', 'update_org_affiliation', 'void_org_affiliation')),
  0,
  '1.9 the four ORG-TIER AFF4 doors are correctly ABSENT — they admit no hospital_admin arm to dominate (D2)');

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

select is(
  (select admits_org_admin from grid where name = '__grid_probe_wrapper_gap'), false,
  '2.6 ⭐ KERNEL RESOLUTION FINDS SOMETHING: a public wrapper whose ONLY hospital arm is in its app kernel, with no org arm, is FLAGGED (before 2026-08-26 it was not even in the population)');

select is(
  (select admits_org_admin from grid where name = '__grid_probe_wrapper_ok'), true,
  '2.7 ... and does not over-flag: the same shape with an org arm in the kernel is compliant');

-- ===========================================================================
-- §3 THE ALLOWLIST
-- ===========================================================================
select is((select count(*)::int from grid_allowlist), 0,
  '3.1 the allowlist is EMPTY — a future exception must be added with a reason, which changes this assertion');

select * from finish();
rollback;
