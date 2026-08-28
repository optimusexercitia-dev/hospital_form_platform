-- AE2.2 (docs/plans/authz-evolution.md § AE2.2; ADR 0155 D8/D3) — the keystone for
-- re-predicating person authority off `profiles.home_organization_id` onto the
-- `organization_affiliations` substrate.  Ruling implemented: ADR 0163
-- (last-org retention).  Census this consumes: docs/design/authz-ae2-home-org-consumer-census.md
--
-- ============================================================================
-- WHAT THIS SUITE HAS TO PROVE
-- ============================================================================
-- Three RLS SELECT legs carried `((home_organization_id IS NOT NULL) AND
-- app.is_org_admin_of(home_organization_id))` (the `professional_credentials`
-- one wrapped in an EXISTS over `profiles`).  They now call ONE predicate,
-- `app.can_administer_person_via_affiliation(person)`, which is built in TWO
-- pieces on purpose:
--
--   app.person_authority_orgs(person)  -- LOCATES.  No caller term in its body
--                                         at all: it does not know who is
--                                         asking, so it cannot grant.
--   app.is_org_admin_of(org)           -- GRANTS.  A membership check, applied
--                                         to the org the affiliation located.
--
-- That split is the ADR 0155 D3 rule ("affiliations are visibility and lifecycle
-- inputs; they NEVER grant capabilities") made structural rather than
-- documentary.  §D6 is the assertion that pins it: a principal who SHARES an
-- active affiliation with the target — and holds no org_admin membership — gets
-- FALSE.  If someone ever collapses the two steps into one join, §D6 is what
-- reds.
--
-- ⭐ RED-FIRST, AND OBSERVED RED.  Written before the migration.  On its first
--    run §A1 could not even resolve `app.person_authority_orgs` and §B1 read the
--    live qual still carrying `home_organization_id`.  A keystone that is green
--    on its first run is vacuous (docs/progress/authz-handoff.md § 7.1).
--
-- §0  PRECONDITIONS / VACUITY GUARDS — every "the admin cannot see X" assertion
--     below is only worth something if X exists and no SIBLING leg could have
--     carried the read anyway.  §0.5–§0.7 buy that: the fixture persons hold
--     ZERO memberships and ZERO hospital affiliations, so the org-admin leg is
--     the only route into them, and the reader is not a platform admin.
--     ⚠ §0.2–§0.4 are the "a green gate can mean the FIXTURE cannot reach the
--     failing state" guard: the empty results in §C6/§C8 are asserted to come
--     from a person who HAS affiliation rows (voided) versus one who genuinely
--     has none — two different facts that would otherwise read identically.
--
-- §A  SURFACE — the two new objects exist with the shape the plan requires:
--     SECURITY DEFINER, STABLE, pinned `search_path`, and ACLs asserted
--     POSITIVELY through `has_function_privilege` (⛔ never by reading `proacl`
--     for absence — a NULL `proacl` includes PUBLIC).
--     ⚠ `person_authority_orgs` is deliberately NOT reachable by
--     `authenticated`: it is a row-returning DEFINER function, and a row-
--     returning door is a gate you can walk through.  Granting it would let any
--     authenticated caller enumerate any person's organizations by id.
--
-- §B  THE THREE LEGS — asserted from `pg_policies`, per leg, in BOTH directions
--     (the old text is gone AND the new call is present).  Per-leg rather than
--     aggregate because all three policies are permissive and OR'd, so a
--     half-applied migration passes any test that only asks "can the admin still
--     read" (the lesson 371 §5 records).  §B7 is the D11 re-sweep: no policy
--     ANYWHERE still names the column.  §B8/§B9 are the positive control on the
--     instrument — the sibling `is_hospital_admin_of` arms are still in the same
--     qual text, so §B1/§B3/§B5 are reading a real predicate, not an empty
--     string.
--
-- §C  ADR 0163's FOUR BOUNDS, on the locator alone, with no caller involved.
--     §C5 is bound 2 (ties yield ALL tied orgs — an arbitrary tie-break is a
--     silent NARROWING, and the AE2.3 differential only pre-declares widenings,
--     so nothing else would ever notice it).  §C7 is bound 1 done the hard way:
--     a VOIDED row with a LATER `ended_on` than the non-voided one.  An
--     implementation that computes `max(ended_on)` first and filters voided
--     afterwards returns EMPTY here instead of {A}.
--
-- §D  THE AUTHORIZATION DECISION, per caller.  §D7/§D8 are the proof that the
--     column stopped being an input: the subject's `home_organization_id` says
--     Rede A while their only affiliation is Rede B, and authority follows the
--     AFFILIATION.  Under the old leg §D7 was TRUE and §D8 FALSE — exactly
--     inverted.
--
-- §E  END TO END THROUGH RLS — the same facts as §D, but measured as rows the
--     principal can actually SELECT, on both re-predicated tables.  §D is truth
--     about the predicate and evidence about nothing downstream; §E is the half
--     that proves the policy calls it.
--
-- ⛔ NOT ASSERTED HERE, stated rather than faked: this suite says nothing about
--    `public.assert_profile_tenant_has_org`.  AE2.2 was ruled T3 — the
--    containment trigger is NOT re-predicated in this migration, because the
--    door that creates an org affiliation (`app.affiliate_person_to_org_impl`)
--    is itself gated on the column, so both halves must break in one move.  It
--    therefore gains no table read here and no security-context change is owed.
--    (It is `prosecdef = f`; the moment it DOES read a table that becomes a
--    live BUG-D5-REHIRE-HOSPADMIN-001 reproduction.  See the AE2.2 write-up.)
-- ============================================================================

begin;
select plan(55);

-- ---------------------------------------------------------------------------
-- Constants.  Fixture principals live in the `0000ae22….` uuid namespace so a
-- positional cleanup elsewhere can never mistake them for seed rows.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (
  org_a uuid, org_b uuid, oa_a uuid, oa_b uuid, plain_staff uuid,
  p_active_a uuid, p_dual uuid, p_ended_a uuid, p_ended_a_active_b uuid,
  p_tie uuid, p_voided_only uuid, p_voided_later uuid, p_none uuid,
  p_column_lies uuid
)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- orgadmin.a@test.local
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- orgadmin.b@test.local
         '00000000-0000-0000-0000-000000000003'::uuid,  -- staff1.ccih@test.local
         '00000000-0000-0000-0000-0000ae220001'::uuid,
         '00000000-0000-0000-0000-0000ae220002'::uuid,
         '00000000-0000-0000-0000-0000ae220003'::uuid,
         '00000000-0000-0000-0000-0000ae220004'::uuid,
         '00000000-0000-0000-0000-0000ae220005'::uuid,
         '00000000-0000-0000-0000-0000ae220006'::uuid,
         '00000000-0000-0000-0000-0000ae220007'::uuid,
         '00000000-0000-0000-0000-0000ae220008'::uuid,
         '00000000-0000-0000-0000-0000ae220009'::uuid;
$$;
-- §D and §E call this after `set local role authenticated`; a pg_temp function
-- is owned by postgres and carries no EXECUTE for that role by default.
grant execute on function pg_temp.k() to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture principals.  `handle_new_user` mints the profile row from the
-- auth.users insert; `home_organization_id` is then set EXPLICITLY, because it
-- is still a live NOT-NULL-by-trigger obligation in AE2.2 (the column drops in
-- AE2.4) — and because §D7/§D8 need one person whose column and whose
-- affiliation deliberately DISAGREE.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
       u || '@ae22.test', now(), now()
from (select unnest(array[
        (select p_active_a from pg_temp.k()), (select p_dual from pg_temp.k()),
        (select p_ended_a from pg_temp.k()), (select p_ended_a_active_b from pg_temp.k()),
        (select p_tie from pg_temp.k()), (select p_voided_only from pg_temp.k()),
        (select p_voided_later from pg_temp.k()), (select p_none from pg_temp.k()),
        (select p_column_lies from pg_temp.k())]) as u) s;

-- Everyone is anchored to Rede A by the COLUMN — including `p_column_lies`,
-- whose only affiliation will be Rede B.  That is the point: under the old leg
-- the column decided, so anchoring them all to A makes any residual
-- column-reading behaviour show up as a FALSE POSITIVE for orgadmin.a.
update public.profiles
   set home_organization_id = (select org_a from pg_temp.k()),
       full_name = 'AE22 fixture'
 where id in (select unnest(array[
        (select p_active_a from pg_temp.k()), (select p_dual from pg_temp.k()),
        (select p_ended_a from pg_temp.k()), (select p_ended_a_active_b from pg_temp.k()),
        (select p_tie from pg_temp.k()), (select p_voided_only from pg_temp.k()),
        (select p_voided_later from pg_temp.k()), (select p_none from pg_temp.k()),
        (select p_column_lies from pg_temp.k())]));

-- The affiliation substrate.  `started_on` is well before every `ended_on`
-- (organization_affiliations_period_ck), and every voided row carries a reason
-- (organization_affiliations_voided_shape).
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason, created_by)
values
  -- C1 — one active row in A.
  ((select p_active_a from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select oa_a from pg_temp.k())),
  -- C2 — active in BOTH orgs (the legitimate, pre-declared widening shape).
  ((select p_dual from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select oa_a from pg_temp.k())),
  ((select p_dual from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select oa_b from pg_temp.k())),
  -- C3 — fully offboarded: one ENDED, non-voided row in A.  ADR 0163's subject.
  ((select p_ended_a from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select oa_a from pg_temp.k()), null, null, null, (select oa_a from pg_temp.k())),
  -- C4 — ended in A, still ACTIVE in B.  Retention must NOT fire.
  ((select p_ended_a_active_b from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select oa_a from pg_temp.k()), null, null, null, (select oa_a from pg_temp.k())),
  ((select p_ended_a_active_b from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select oa_b from pg_temp.k())),
  -- C5 — the TIE: two orgs, same ended_on, nothing active.  Bound 2.
  ((select p_tie from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select oa_a from pg_temp.k()), null, null, null, (select oa_a from pg_temp.k())),
  ((select p_tie from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select oa_b from pg_temp.k()), null, null, null, (select oa_b from pg_temp.k())),
  -- C6 — the only row is VOIDED ("was never true").  Bound 1: NO retaining org.
  ((select p_voided_only from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select oa_a from pg_temp.k()), now(), (select oa_a from pg_temp.k()), 'lançamento equivocado', (select oa_a from pg_temp.k())),
  -- C7 — a non-voided row ending EARLY (A) and a voided row ending LATE (B).
  --      Correct answer {A}.  `max(ended_on)` computed before the void filter
  --      returns EMPTY, which is why this pair exists.
  ((select p_voided_later from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select oa_a from pg_temp.k()), null, null, null, (select oa_a from pg_temp.k())),
  ((select p_voided_later from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', date '2026-06-10', (select oa_b from pg_temp.k()), now(), (select oa_b from pg_temp.k()), 'lançamento equivocado', (select oa_b from pg_temp.k())),
  -- D7/D8 — the column says Rede A; the ONLY affiliation is Rede B.
  ((select p_column_lies from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select oa_b from pg_temp.k()));
-- p_none gets no row at all.

-- Credentials for §E6/§E7.  Without them "the admin cannot read the
-- credentials" would be trivially true in both directions.
insert into public.professional_credentials
  (user_id, issuing_country, issuing_state, issuing_authority, registration_number)
values
  ((select p_active_a from pg_temp.k()), 'BR', 'SP', 'COREN', 'AE22-CRED-1'),
  ((select p_column_lies from pg_temp.k()), 'BR', 'SP', 'COREN', 'AE22-CRED-2');

-- ============================================================================
-- §0  PRECONDITIONS AND VACUITY GUARDS
-- ============================================================================
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.1 PRECONDITION: audit_trail is enabled (the affiliation audit trigger fires on every fixture write above)');

select is(
  (select count(*)::int from public.organization_affiliations where principal_id = (select p_voided_only from pg_temp.k())), 1,
  '0.2 VACUITY GUARD: p_voided_only HAS an affiliation row — so §C6''s empty result means "voided is excluded", not "no fixture"');

select is(
  (select count(*)::int from public.organization_affiliations where principal_id = (select p_voided_later from pg_temp.k())), 2,
  '0.3 VACUITY GUARD: p_voided_later has BOTH rows — so §C7 measures the void filter, not a missing insert');

select is(
  (select count(*)::int from public.organization_affiliations where principal_id = (select p_none from pg_temp.k())), 0,
  '0.4 PRECONDITION: p_none genuinely has zero affiliation rows (the honest empty, distinct from §C6''s)');

select is(
  (select count(*)::int from public.memberships where principal_id in (
     (select p_active_a from pg_temp.k()), (select p_ended_a from pg_temp.k()),
     (select p_voided_only from pg_temp.k()), (select p_none from pg_temp.k()),
     (select p_column_lies from pg_temp.k()))), 0,
  '0.5 VACUITY GUARD: every fixture person holds ZERO memberships — no commission/tenancy leg can carry §E''s reads');

select is(
  (select is_admin from public.profiles where id = (select oa_a from pg_temp.k())), false,
  '0.6 VACUITY GUARD: orgadmin.a is NOT a platform admin (app.is_admin() would satisfy leg 1 of both profiles policies regardless of any affiliation)');

select is(
  (select count(*)::int from public.hospital_affiliations where principal_id in (
     (select p_active_a from pg_temp.k()), (select p_column_lies from pg_temp.k()))), 0,
  '0.7 VACUITY GUARD: the §E subjects hold ZERO hospital affiliations — the hospital-admin sibling legs cannot carry the read');

select is(
  (select count(*)::int from public.professional_credentials where user_id in (
     (select p_active_a from pg_temp.k()), (select p_column_lies from pg_temp.k()))), 2,
  '0.8 PRECONDITION: both §E subjects HAVE a credential, so §E6/§E7 measure a real read rather than an empty set');

-- ============================================================================
-- §A  SURFACE — the two new objects, and their ACLs asserted POSITIVELY
-- ============================================================================
select has_function('app', 'person_authority_orgs', array['uuid'],
  'A1 app.person_authority_orgs(uuid) exists');

select is((select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'person_authority_orgs'), true,
  'A2 person_authority_orgs is SECURITY DEFINER — it reads organization_affiliations, an RLS-protected table, on behalf of a policy');

select is((select p.provolatile::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'person_authority_orgs'), 's',
  'A3 person_authority_orgs is STABLE (it is read-only and is called per row inside a policy)');

select ok((select array_to_string(p.proconfig, ',') like '%search_path=%'
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'person_authority_orgs'),
  'A4 person_authority_orgs pins search_path (a DEFINER without one is a search-path hijack)');

select is((select has_function_privilege('authenticated', p.oid, 'EXECUTE')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'person_authority_orgs'), false,
  'A5 ⭐ person_authority_orgs is NOT executable by `authenticated` — a row-returning DEFINER is a gate you can walk through; it would enumerate any person''s orgs by id');

select is((select has_function_privilege('anon', p.oid, 'EXECUTE')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'person_authority_orgs'), false,
  'A6 person_authority_orgs is NOT executable by `anon`');

select has_function('app', 'can_administer_person_via_affiliation', array['uuid'],
  'A7 app.can_administer_person_via_affiliation(uuid) exists');

select is((select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_administer_person_via_affiliation'), true,
  'A8 can_administer_person_via_affiliation is SECURITY DEFINER');

select is((select p.provolatile::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_administer_person_via_affiliation'), 's',
  'A9 can_administer_person_via_affiliation is STABLE');

select ok((select array_to_string(p.proconfig, ',') like '%search_path=%'
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_administer_person_via_affiliation'),
  'A10 can_administer_person_via_affiliation pins search_path');

select is((select has_function_privilege('authenticated', p.oid, 'EXECUTE')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_administer_person_via_affiliation'), true,
  'A11 can_administer_person_via_affiliation IS executable by `authenticated` — three policy quals name it, and a policy qual runs with the CALLER''s privileges');

select is((select has_function_privilege('anon', p.oid, 'EXECUTE')
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_administer_person_via_affiliation'), false,
  'A12 can_administer_person_via_affiliation is NOT executable by `anon` (⛔ a NULL proacl would have included PUBLIC — asserted positively, never by reading proacl for absence)');

-- ============================================================================
-- §B  THE THREE LEGS, from pg_policies, per leg, in both directions
-- ============================================================================
create or replace function pg_temp.qual_of(p_table text, p_policy text)
returns text language sql stable as $$
  select qual from pg_policies
   where schemaname = 'public' and tablename = p_table and policyname = p_policy;
$$;

select is(pg_temp.qual_of('profiles', 'profiles_admin_select') ~ 'home_organization_id', false,
  'B1 profiles_admin_select no longer names home_organization_id');
select is(pg_temp.qual_of('profiles', 'profiles_admin_select') ~ 'can_administer_person_via_affiliation', true,
  'B2 profiles_admin_select calls the new predicate');

select is(pg_temp.qual_of('profiles', 'profiles_select_self_or_admin') ~ 'home_organization_id', false,
  'B3 profiles_select_self_or_admin no longer names home_organization_id');
select is(pg_temp.qual_of('profiles', 'profiles_select_self_or_admin') ~ 'can_administer_person_via_affiliation', true,
  'B4 profiles_select_self_or_admin calls the new predicate');

select is(pg_temp.qual_of('professional_credentials', 'professional_credentials_select') ~ 'home_organization_id', false,
  'B5 professional_credentials_select no longer names home_organization_id');
select is(pg_temp.qual_of('professional_credentials', 'professional_credentials_select') ~ 'can_administer_person_via_affiliation', true,
  'B6 professional_credentials_select calls the new predicate');

select is(
  (select count(*)::int from pg_policies
    where coalesce(qual, '') ~ 'home_organization_id' or coalesce(with_check, '') ~ 'home_organization_id'), 0,
  'B7 ⭐ D11 RE-SWEEP: NO policy anywhere in the database still references home_organization_id (unanchored match over qual AND with_check — a policy naming a dropped column fails only when evaluated)');

select is(pg_temp.qual_of('profiles', 'profiles_admin_select') ~ 'is_hospital_admin_of', true,
  'B8 POSITIVE CONTROL: the sibling hospital-admin arm is still in the same qual text — so B1 read a real predicate, and the migration replaced ONE leg rather than the policy');
select is(pg_temp.qual_of('professional_credentials', 'professional_credentials_select') ~ 'is_hospital_admin_of', true,
  'B9 POSITIVE CONTROL: same, for professional_credentials_select');

-- ============================================================================
-- §C  ADR 0163's BOUNDS, on the LOCATOR alone — no caller, no grant
-- ============================================================================
select is(
  (select array_agg(organization_id order by organization_id) from app.person_authority_orgs((select p_active_a from pg_temp.k()))),
  array[(select org_a from pg_temp.k())]::uuid[],
  'C1 active affiliation in A -> {A}');

select is(
  (select array_agg(organization_id order by organization_id) from app.person_authority_orgs((select p_dual from pg_temp.k()))),
  array[(select org_a from pg_temp.k()), (select org_b from pg_temp.k())]::uuid[],
  'C2 active in BOTH orgs -> {A,B} (the intended widening: a person genuinely affiliated twice is legitimately visible to both)');

select is(
  (select array_agg(organization_id order by organization_id) from app.person_authority_orgs((select p_ended_a from pg_temp.k()))),
  array[(select org_a from pg_temp.k())]::uuid[],
  'C3 ⭐ ADR 0163 LAST-ORG RETENTION: no active row, one ENDED non-voided row in A -> {A}');

select is(
  (select array_agg(organization_id order by organization_id) from app.person_authority_orgs((select p_ended_a_active_b from pg_temp.k()))),
  array[(select org_b from pg_temp.k())]::uuid[],
  'C4 ended in A but ACTIVE in B -> {B} only — retention fires ONLY when there is no active affiliation');

select is(
  (select array_agg(organization_id order by organization_id) from app.person_authority_orgs((select p_tie from pg_temp.k()))),
  array[(select org_a from pg_temp.k()), (select org_b from pg_temp.k())]::uuid[],
  'C5 ⭐ ADR 0163 BOUND 2: two rows tied on ended_on -> BOTH orgs. An `order by ended_on desc limit 1` returns one, and that silent NARROWING is invisible to a differential that only pre-declares widenings');

select is(
  (select count(*)::int from app.person_authority_orgs((select p_voided_only from pg_temp.k()))), 0,
  'C6 ⭐ ADR 0163 BOUND 1: the only row is VOIDED ("was never true") -> NO retaining org; the person is platform_admin-only');

select is(
  (select array_agg(organization_id order by organization_id) from app.person_authority_orgs((select p_voided_later from pg_temp.k()))),
  array[(select org_a from pg_temp.k())]::uuid[],
  'C7 ⭐ BOUND 1, THE HARD WAY: the VOIDED row ends LATER than the non-voided one -> {A}. An implementation that takes max(ended_on) before filtering voided returns EMPTY here');

select is(
  (select count(*)::int from app.person_authority_orgs((select p_none from pg_temp.k()))), 0,
  'C8 no affiliation rows at all -> empty');

-- ============================================================================
-- §D  THE AUTHORIZATION DECISION, per caller
-- ============================================================================
reset role;
select test_helpers.claims_for((select oa_a from pg_temp.k()), false, 'org_admin');
set local role authenticated;

select is(app.can_administer_person_via_affiliation((select p_active_a from pg_temp.k())), true,
  'D1 org_admin of A administers a person actively affiliated to A');
select is(app.can_administer_person_via_affiliation((select p_ended_a from pg_temp.k())), true,
  'D2 ⭐ RETENTION, end to end: org_admin of A still administers a FULLY OFFBOARDED person whose last non-voided affiliation was A');
select is(app.can_administer_person_via_affiliation((select p_voided_only from pg_temp.k())), false,
  'D3 BOUND 1: org_admin of A does NOT administer a person whose only A affiliation was voided');
select is(app.can_administer_person_via_affiliation((select p_none from pg_temp.k())), false,
  'D4 a person with no affiliation history at all is administered by nobody at the org tier');
select is(app.can_administer_person_via_affiliation((select p_column_lies from pg_temp.k())), false,
  'D5 ⭐ THE COLUMN IS NO LONGER AN INPUT: the subject''s home_organization_id IS Rede A and org_admin of A gets FALSE — under the old leg this was TRUE');
select is(app.can_administer_person_via_affiliation((select p_tie from pg_temp.k())), true,
  'D6 BOUND 2, caller side: org_admin of A administers the tied person');

reset role;
select test_helpers.claims_for((select oa_b from pg_temp.k()), false, 'org_admin');
set local role authenticated;

select is(app.can_administer_person_via_affiliation((select p_active_a from pg_temp.k())), false,
  'D7 org_admin of B does NOT administer a person affiliated only to A');
select is(app.can_administer_person_via_affiliation((select p_column_lies from pg_temp.k())), true,
  'D8 ⭐ …and org_admin of B DOES administer them — authority followed the AFFILIATION, not the column, which is exactly inverted from the old leg');
select is(app.can_administer_person_via_affiliation((select p_tie from pg_temp.k())), true,
  'D9 ⭐ BOUND 2: the OTHER tied org also administers. An arbitrary tie-break reds here and nowhere else');

reset role;
select test_helpers.claims_for((select plain_staff from pg_temp.k()), false, 'staff');
set local role authenticated;

select is(app.can_administer_person_via_affiliation((select p_active_a from pg_temp.k())), false,
  'D10 ⭐⭐ ADR 0155 D3: a principal who SHARES an active Rede A affiliation with the subject, but holds no org_admin MEMBERSHIP, gets FALSE. The affiliation LOCATES; the membership GRANTS. This is the assertion that reds if the two steps are ever collapsed into one join');

-- ============================================================================
-- §E  END TO END THROUGH RLS
-- ============================================================================
reset role;
select test_helpers.claims_for((select oa_a from pg_temp.k()), false, 'org_admin');
set local role authenticated;

select is((select count(id)::int from public.profiles where id = (select oa_a from pg_temp.k())), 1,
  'E1 VACUITY CONTROL: orgadmin.a can read at least their own profile — the §E instrument is not blanket-denying');
select is((select count(id)::int from public.profiles where id = (select p_active_a from pg_temp.k())), 1,
  'E2 orgadmin.a reads the profile of a person actively affiliated to A');
select is((select count(id)::int from public.profiles where id = (select p_ended_a from pg_temp.k())), 1,
  'E3 ⭐ RETENTION through RLS: the fully offboarded person is STILL readable by the retaining org''s admin');
select is((select count(id)::int from public.profiles where id = (select p_voided_only from pg_temp.k())), 0,
  'E4 BOUND 1 through RLS: the voided-only person is NOT readable');
select is((select count(id)::int from public.profiles where id = (select p_none from pg_temp.k())), 0,
  'E5 the never-affiliated person is NOT readable');
select is((select count(id)::int from public.profiles where id = (select p_column_lies from pg_temp.k())), 0,
  'E6 ⭐ the person whose COLUMN says Rede A but whose affiliation says Rede B is NOT readable by orgadmin.a');
select is((select count(*)::int from public.professional_credentials where user_id = (select p_active_a from pg_temp.k())), 1,
  'E7 professional_credentials_select: orgadmin.a reads the A-affiliated person''s credential');
select is((select count(*)::int from public.professional_credentials where user_id = (select p_column_lies from pg_temp.k())), 0,
  'E8 professional_credentials_select: …and NOT the Rede-B-affiliated person''s, even though their column says Rede A');

reset role;

select * from finish();
rollback;
