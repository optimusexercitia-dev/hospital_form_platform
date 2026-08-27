-- AE1.3 — `app.can_administer_person_for`, the SQL twin of `personScopeAllows`.
-- Contract: docs/plans/authz-ae1-person-doors.md §3 + §8 (pgTAP 384), ruled in §12 R0/R4.
--
-- ⭐ THIS FILE TESTS THE PREDICATE, NOT THE DOORS. A correct predicate is not a correct
-- door (the recorded three-shapes lesson) — the doors are 385's subject. What lives here
-- is the capability x footprint matrix, driven directly, so a corner case has somewhere
-- to be asserted that does not depend on a door existing to reach it.
--
-- ⚠ EVERY DENY ARM IS PAIRED WITH AN ALLOW THAT DIFFERS IN EXACTLY ONE INPUT. A deny that
-- stands alone is satisfied by any blanket refusal — a wrong-arm fixture, a preamble
-- return, a mis-typed uuid — and reads as coverage. The §0 preconditions exist for the
-- same reason: they measure the fixture properties every later arm's meaning depends on,
-- so a seed change that quietly flattens a footprint reds HERE, naming itself, instead of
-- turning a differential into two identical calls.
--
-- ⚠ THE SPANNING PERSON IS MANDATORY (§1). A sole-footprint fixture passes under EITHER
-- bound, so an INTERSECTION/SUBSET swap — the single most dangerous mutation in this
-- surface — is invisible to it. Only `{H1,H2}` with an actor holding `{H1}` inverts.

begin;
select plan(55);

create temp table k on commit drop as select
  -- Targets (footprints MEASURED in §0, never assumed).
  '00000000-0000-0000-0000-0000000000a1'::uuid as spanning,    -- dr.john      {central_a, sec_a}
  '00000000-0000-0000-0000-000000000003'::uuid as sole,        -- staff1.ccih  {central_a}
  '00000000-0000-0000-0000-000000000004'::uuid as tier_ctor,   -- staff2.ccih  {central_a}, org-tier CONSTRUCTED in §4
  '00000000-0000-0000-0000-0000000000d4'::uuid as empty_fp,    -- desativado.conta  {}
  '00000000-0000-0000-0000-0000000000d1'::uuid as aff_only,    -- novato.pendente {central_a}, AFFILIATION-ONLY source
  '00000000-0000-0000-0000-0000000000c7'::uuid as hosp_tier,   -- pqsdual.a    {central_a} + hospital-tier seats
  '00000000-0000-0000-0000-0000000000b3'::uuid as person_b,    -- staff1.qual.b (org B) {central_b}
  -- Actors.
  '00000000-0000-0000-0000-0000000000e1'::uuid as admin_h1,    -- hospital_admin of central_a ONLY
  '00000000-0000-0000-0000-0000000000e3'::uuid as admin_dual,  -- hospital_admin of central_a AND sec_a
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as org_admin_b,
  '00000000-0000-0000-0000-0000000000b0'::uuid as platform,    -- platform_admin
  '00000000-0000-0000-0000-0000000000f5'::uuid as actor_b,     -- quality.b — gets a CONSTRUCTED hospital hat in §8
  -- Tenancy.
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as sec_a,
  '05000000-0000-0000-0000-00000000000b'::uuid as central_b,
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b;

-- ============================================================================
-- §0 PRECONDITIONS — the fixture properties every later arm's meaning rests on.
-- ============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_administer_person_for'
      and p.prosecdef and p.provolatile = 's'
      and pg_get_function_result(p.oid) = 'boolean'), 1,
  '0.1 PRECONDITION: app.can_administer_person_for exists as a SECURITY DEFINER, STABLE, boolean function — the three properties that put it in the census + policy domains');

select is(
  (select string_agg(distinct x.h::text, ',' order by x.h::text) from (
     select ha.hospital_id h from public.hospital_affiliations ha
      where ha.principal_id = (select spanning from k)
        and ha.ended_on is null and ha.voided_at is null and ha.hospital_id is not null
     union
     select c.hospital_id from public.memberships m
       join public.commissions c on c.id = m.commission_id
      where m.principal_id = (select spanning from k) and m.commission_id is not null
        and (m.expires_at is null or m.expires_at > now()) and c.hospital_id is not null
   ) x),
  (select central_a::text || ',' || sec_a::text from k),
  '0.2 PRECONDITION: the SPANNING person''s footprint is exactly {central_a, sec_a} — the only shape in which an INTERSECTION/SUBSET swap is observable');

select is(
  (select count(*)::int from public.memberships m
    where m.principal_id = (select spanning from k) and m.commission_id is null), 0,
  '0.3 PRECONDITION: the spanning person holds NO org/hospital-tier seat, so D2 is not what decides §1');

select ok(
  app.is_hospital_admin_of_for((select central_a from k), (select admin_h1 from k))
  and not app.is_hospital_admin_of_for((select sec_a from k), (select admin_h1 from k)),
  '0.4 PRECONDITION: admin_h1 administers central_a and NOT sec_a — the asymmetry §1 measures');

select ok(
  app.is_hospital_admin_of_for((select central_a from k), (select admin_dual from k))
  and app.is_hospital_admin_of_for((select sec_a from k), (select admin_dual from k)),
  '0.5 PRECONDITION: admin_dual administers BOTH — so §1.5/§1.6 differ from §1.3/§1.4 in the ACTOR alone');

select is(
  (select count(*)::int from public.hospital_affiliations ha
    where ha.principal_id = (select empty_fp from k) and ha.ended_on is null and ha.voided_at is null)
  + (select count(*)::int from public.memberships m
      where m.principal_id = (select empty_fp from k)), 0,
  '0.6 PRECONDITION: the empty-footprint person holds NO active affiliation and NO membership at all — so §3 measures the footprint rule, not D2');

-- ⚠ CORRECTED BY THE FIRST RED RUN. This originally required an ACTIVE AFFILIATION at
-- central_a and failed: `pqsdual.a`'s footprint comes from a COMMISSION SEAT, not an
-- affiliation. Requiring the wrong source would have made §4 red for a fixture reason and
-- read as a defect in D2.
select ok(
  exists (select 1 from public.memberships m
           where m.principal_id = (select hosp_tier from k) and m.commission_id is null)
  and (select central_a from k) = any (array(
        select ha.hospital_id from public.hospital_affiliations ha
         where ha.principal_id = (select hosp_tier from k)
           and ha.ended_on is null and ha.voided_at is null and ha.hospital_id is not null
        union
        select c.hospital_id from public.memberships m
          join public.commissions c on c.id = m.commission_id
         where m.principal_id = (select hosp_tier from k) and m.commission_id is not null
           and (m.expires_at is null or m.expires_at > now()) and c.hospital_id is not null)),
  '0.7 PRECONDITION: the hospital-tier target has a tier seat AND a NON-EMPTY footprint containing central_a — so §4 measures D2 and not emptiness');

-- ⚠ SINGLE-SOURCE, AND THAT IS WHAT §5.6 NEEDS. `dr.john`'s two hospitals are each
-- covered REDUNDANTLY (an affiliation AND a commission seat at both), so removing one
-- source there changes nothing — a transition arm built on him would have failed while
-- the conjunct under test was perfectly intact. The sole person's footprint has exactly
-- one source, which is why the expiry transition is measurable on him and not on the
-- spanning fixture.
select ok(
  (select count(*)::int from public.hospital_affiliations ha
    where ha.principal_id = (select sole from k) and ha.ended_on is null and ha.voided_at is null) = 0
  and (select count(*)::int from public.memberships m join public.commissions c on c.id = m.commission_id
        where m.principal_id = (select sole from k) and c.hospital_id = (select central_a from k)) = 1,
  '0.8 PRECONDITION: the sole person''s footprint has EXACTLY ONE source — a commission seat at central_a and no affiliation — so §5.6''s expiry transition is observable at all');

-- …and its mirror image: the affiliation arms need a person whose one hospital comes
-- ONLY from an affiliation, and who is ACTIVE (the first run used the deactivated
-- zero-footprint person and the affiliation door refused it with `conta desativada`).
select ok(
  (select is_active from public.profiles where id = (select aff_only from k))
  and (select count(*)::int from public.hospital_affiliations ha
        where ha.principal_id = (select aff_only from k)
          and ha.ended_on is null and ha.voided_at is null
          and ha.hospital_id = (select central_a from k)) = 1
  and (select count(*)::int from public.memberships m
        where m.principal_id = (select aff_only from k)) = 0,
  '0.9 PRECONDITION: the affiliation-only person is ACTIVE and holds exactly one active affiliation at central_a and NO membership of any kind — so §5.2/§5.4 measure the affiliation conjuncts and nothing else keeps the hospital in scope');

-- ============================================================================
-- §1 ⭐ THE SPANNING DIFFERENTIAL — the INTERSECTION/SUBSET keystone.
--
-- Person {central_a, sec_a}; actor administers {central_a}. Swap the two bounds in the
-- predicate and EXACTLY this pair inverts, and nothing else in the suite does.
-- ============================================================================
select is(app.can_administer_person_for('fields', (select spanning from k), (select admin_h1 from k)), true,
  '1.1 ⭐ INTERSECTION: `fields` on a {H1,H2} person is ALLOWED for an admin of {H1}');
select is(app.can_administer_person_for('credentials', (select spanning from k), (select admin_h1 from k)), true,
  '1.2 ⭐ INTERSECTION: `credentials` likewise — a council registration is a LOCAL fact (ADR 0133 D3 + Amdt 1 r1)');
select is(app.can_administer_person_for('cpf_change', (select spanning from k), (select admin_h1 from k)), false,
  '1.3 ⭐ SUBSET: `cpf_change` on the SAME person by the SAME actor is REFUSED — a person-key identity event needs the ENTIRE footprint');
select is(app.can_administer_person_for('lifecycle', (select spanning from k), (select admin_h1 from k)), false,
  '1.4 ⭐ SUBSET: `lifecycle` likewise — `app.is_active` is a PLATFORM-WIDE kill switch, not a local offboarding');
select is(app.can_administer_person_for('cpf_change', (select spanning from k), (select admin_dual from k)), true,
  '1.5 ⭐ …and the SAME call by an admin of {H1,H2} is ALLOWED — 1.3 is the FOOTPRINT rule, not a blanket refusal of cpf_change');
select is(app.can_administer_person_for('lifecycle', (select spanning from k), (select admin_dual from k)), true,
  '1.6 ⭐ …same for `lifecycle` — the differential is the actor''s coverage, one input apart');

-- ============================================================================
-- §2 SOLE FOOTPRINT — both bounds coincide, which is why §1 cannot be replaced by it.
-- ============================================================================
select is(app.can_administer_person_for('fields', (select sole from k), (select admin_h1 from k)), true,
  '2.1 sole-footprint {central_a}: `fields` allowed');
select is(app.can_administer_person_for('credentials', (select sole from k), (select admin_h1 from k)), true,
  '2.2 sole-footprint: `credentials` allowed');
select is(app.can_administer_person_for('cpf_change', (select sole from k), (select admin_h1 from k)), true,
  '2.3 sole-footprint: `cpf_change` allowed — the SUBSET bound is satisfied, which is exactly why this fixture cannot detect a bound swap');
select is(app.can_administer_person_for('lifecycle', (select sole from k), (select admin_h1 from k)), true,
  '2.4 sole-footprint: `lifecycle` allowed');

-- ============================================================================
-- §3 EMPTY FOOTPRINT — the vacuous-subset inversion, pinned.
--
-- ⚠ Delete the `cardinality(v_footprint) = 0` statement and 3.3/3.4 flip to TRUE, because
-- `∅ ⊆ anything` holds: a zero-footprint person would become MORE manageable than a
-- sole-hospital one. 3.1/3.2 would stay green (∅ ∩ X = ∅) — which is precisely why the
-- rule must not be left to the set maths.
-- ============================================================================
select is(app.can_administer_person_for('fields', (select empty_fp from k), (select admin_h1 from k)), false,
  '3.1 empty footprint: `fields` refused');
select is(app.can_administer_person_for('credentials', (select empty_fp from k), (select admin_h1 from k)), false,
  '3.2 empty footprint: `credentials` refused');
select is(app.can_administer_person_for('cpf_change', (select empty_fp from k), (select admin_h1 from k)), false,
  '3.3 ⭐ empty footprint: `cpf_change` refused — the vacuous-subset inversion is pinned EXPLICITLY, not derived');
select is(app.can_administer_person_for('lifecycle', (select empty_fp from k), (select admin_h1 from k)), false,
  '3.4 ⭐ empty footprint: `lifecycle` refused, same pin');
select is(app.can_administer_person_for('lifecycle', (select empty_fp from k), (select org_admin_a from k)), true,
  '3.5 ⭐ …and an ORG ADMIN may still act on that same person — §3 measures the hospital_admin footprint bound, not "nobody may touch this person"');

-- ============================================================================
-- §4 D2 — ANY org-tier or hospital-tier seat is org_admin-only, for every capability.
-- ============================================================================
select is(app.can_administer_person_for('fields', (select hosp_tier from k), (select admin_h1 from k)), false,
  '4.1 D2: a HOSPITAL-TIER target is refused even for `fields`, and even by the admin of the very hospital they are seated at');
select is(app.can_administer_person_for('lifecycle', (select hosp_tier from k), (select admin_h1 from k)), false,
  '4.2 D2: …and for `lifecycle`');
select is(app.can_administer_person_for('lifecycle', (select hosp_tier from k), (select org_admin_a from k)), true,
  '4.3 D2 is org_admin-ONLY, not a wall: the org admin may still act — so 4.1/4.2 are D2 and not an unrelated deny');

-- ORG-TIER, CONSTRUCTED: the same person, one membership row apart.
select is(app.can_administer_person_for('fields', (select tier_ctor from k), (select admin_h1 from k)), true,
  '4.4 CONTROL: before any tier seat exists, this person is a plain sole-footprint target and `fields` is allowed');

insert into public.memberships (principal_id, organization_id, role, granted_by)
select tier_ctor, org_a, 'org_admin', org_admin_a from k;

select is(app.can_administer_person_for('fields', (select tier_ctor from k), (select admin_h1 from k)), false,
  '4.5 ⭐ …and ONE org-tier membership row later the SAME call is refused — D2 derived STRUCTURALLY (commission_id is null), never from a role-name list');

-- ============================================================================
-- §5 THE THREE ACTIVITY CONJUNCTS — ended_on, voided_at, and commission expiry.
--
-- ⚠ EACH IS MEASURED AS A TRANSITION, not as a state. Asserting only the end state is
-- satisfied by a fixture that was never in the start state.
-- ============================================================================
-- ⛔ THE FIXTURE MUST BE SINGLE-SOURCE OR THE TRANSITION IS UNOBSERVABLE, and this
-- section was rebuilt twice for that reason. The spanning person's two hospitals are each
-- covered REDUNDANTLY (an affiliation AND a commission seat at both), so ending one of
-- his affiliations changes nothing — an arm built on him would have gone red while the
-- conjunct under test was perfectly intact, i.e. a fabricated defect. The affiliation
-- arms therefore run on the affiliation-only person (§0.9) and the expiry arm on the
-- commission-only one (§0.8).
select is(app.can_administer_person_for('lifecycle', (select aff_only from k), (select admin_h1 from k)), true,
  '5.1 CANVAS: the affiliation-only person is a sole-footprint target and is allowed — every arm below is measured as a CHANGE FROM HERE');

update public.hospital_affiliations
   set ended_on = current_date
 where principal_id = (select aff_only from k) and hospital_id = (select central_a from k);

select is(app.can_administer_person_for('lifecycle', (select aff_only from k), (select admin_h1 from k)), false,
  '5.2 ⭐ an ENDED affiliation leaves the WRITE footprint — the arm that reds if `ended_on is null` is ever "aligned" with the ever-held READ rule (ADR 0148)');

update public.hospital_affiliations
   set ended_on = null
 where principal_id = (select aff_only from k) and hospital_id = (select central_a from k);

select is(app.can_administer_person_for('lifecycle', (select aff_only from k), (select admin_h1 from k)), true,
  '5.3 …and restoring `ended_on` restores the allow, so 5.2 measured the conjunct and not a one-way fixture');

update public.hospital_affiliations
   set voided_at = now(), voided_by = (select org_admin_a from k), void_reason = 'pgtap 384'
 where principal_id = (select aff_only from k) and hospital_id = (select central_a from k);

select is(app.can_administer_person_for('lifecycle', (select aff_only from k), (select admin_h1 from k)), false,
  '5.4 ⭐ a VOIDED affiliation leaves the footprint too (AFF4 D7) — the arm that reds if `voided_at is null` is dropped');

update public.hospital_affiliations
   set voided_at = null, voided_by = null, void_reason = null
 where principal_id = (select aff_only from k) and hospital_id = (select central_a from k);

select is(app.can_administer_person_for('lifecycle', (select aff_only from k), (select admin_h1 from k)), true,
  '5.5 …and un-voiding restores it — 5.4 was the transition');

-- COMMISSION-SEAT EXPIRY, on the person whose ONLY source is that seat (§0.8).
update public.memberships
   set expires_at = now() - interval '1 day'
 where principal_id = (select sole from k) and commission_id is not null;

select is(app.can_administer_person_for('fields', (select sole from k), (select admin_h1 from k)), false,
  '5.6 ⭐ an EXPIRED commission seat drops its hospital from the footprint — expiry is applied to what a membership GRANTS (this same call was allowed in 2.1)');

update public.memberships
   set expires_at = null
 where principal_id = (select sole from k) and commission_id is not null;

-- …and the DELIBERATE ASYMMETRY (QA R1): expiry is NOT applied to what a membership
-- WITHHOLDS. Reading an expired org-tier seat as untiered would WIDEN, so D2 ignores it.
update public.memberships
   set expires_at = now() - interval '1 day'
 where principal_id = (select tier_ctor from k) and commission_id is null;

select is(app.can_administer_person_for('fields', (select tier_ctor from k), (select admin_h1 from k)), false,
  '5.7 ⭐ an EXPIRED ORG-TIER seat STILL denies — expiry applies to what a membership grants, never to what it withholds. A "consistency" fix that applied expiry on both legs would WIDEN, and this is the only thing that would notice');

select is(app.can_administer_person_for('fields', (select sole from k), (select admin_h1 from k)), true,
  '5.8 …and the sole person is back to allowed, so 5.6 was restored and §6 starts from a known state');

-- ============================================================================
-- §6 THE ACTOR SIDE — and the deliberate absences.
-- ============================================================================
select is(app.can_administer_person_for('fields', (select sole from k), null), false,
  '6.1 a NULL actor is refused');
select is(app.can_administer_person_for('fields', '00000000-0000-0000-0000-0000000000ff'::uuid, (select admin_h1 from k)), false,
  '6.2 ⭐ a person who DOES NOT EXIST is refused by the same predicate as an unauthorized caller — non-existence is folded into the denial, never surfaced (F-B: not an enumeration oracle)');
select is(app.can_administer_person_for('fields', (select sole from k), (select platform from k)), false,
  '6.3 ⭐ a PLATFORM_ADMIN is refused — person records are not platform_admin''s (ADR 0041 noun rule). This is what reds if an "obviously missing superuser arm" is added back');
select is(app.can_administer_person_for('fields', (select sole from k), (select org_admin_b from k)), false,
  '6.4 an org_admin of ANOTHER organisation is refused — tenant isolation at the org arm');

update public.profiles set is_active = false where id = (select admin_h1 from k);
select is(app.can_administer_person_for('fields', (select sole from k), (select admin_h1 from k)), false,
  '6.5 ⭐ an INACTIVE actor is refused — the same call that was allowed in 2.1, one column apart (TS: context.isInactive)');
update public.profiles set is_active = true where id = (select admin_h1 from k);
select is(app.can_administer_person_for('fields', (select sole from k), (select admin_h1 from k)), true,
  '6.6 …and restoring the actor restores the allow, so 6.5 measured the activity check');

-- ============================================================================
-- §7 HC0T7 — the mirror-drift tripwire.
--
-- ⛔ Keystoned HERE and ONLY here. The predicate is STABLE, so it is outside the ADR 0156
-- door-SQLSTATE gate's kernel clause, and `HC0T7` must therefore NOT be added to pgTAP
-- 304 §6.6's declared literal — a declared code no in-domain body raises fails §6.6 in
-- the other direction (design §10.3, ruled in R0).
-- ============================================================================
select throws_ok(
  $$select app.can_administer_person_for('nonsense', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000e1')$$,
  'HC0T7', null,
  '7.1 ⭐ an unknown capability RAISES — it must never fall through: to SUBSET would be silently tighter (a passing test proving nothing), to INTERSECTION a widen');
select throws_ok(
  $$select app.can_administer_person_for('nonsense', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1')$$,
  'HC0T7', null,
  '7.2 ⭐ …and it raises for an ORG_ADMIN actor too — the org arm returns true before any dispatch, so a check placed only at the dispatch would be SILENT for exactly the caller most likely to try a new capability first');
select throws_ok(
  $$select app.can_administer_person_for(null, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000e1')$$,
  'HC0T7', null,
  '7.3 a NULL capability raises rather than returning a quiet false');

-- ============================================================================
-- §8 CROSS-ORG ACTOR — CONSTRUCTED, because no seeded persona holds a membership
-- outside its home org (a cross-org test written against a seeded persona passes while
-- proving nothing).
-- ============================================================================
insert into public.memberships (principal_id, organization_id, hospital_id, role, granted_by)
select actor_b, org_b, central_b, 'hospital_admin', org_admin_b from k;

select is(app.can_administer_person_for('fields', (select person_b from k), (select actor_b from k)), true,
  '8.1 CONTROL: the constructed hospital_admin hat is REAL — its holder may administer an in-org person with a {central_b} footprint');
select is(app.can_administer_person_for('fields', (select sole from k), (select actor_b from k)), false,
  '8.2 ⭐ …and that same hat gives NO claim on an org A person — the hospital arm is bounded to the TARGET''S home org');
select is(app.can_administer_person_for('lifecycle', (select spanning from k), (select actor_b from k)), false,
  '8.3 …for the SUBSET capabilities too');

insert into public.memberships (principal_id, organization_id, hospital_id, role, granted_by)
select actor_b, org_a, central_a, 'hospital_admin', org_admin_a from k;

select is(app.can_administer_person_for('fields', (select sole from k), (select actor_b from k)), true,
  '8.4 ⭐ …and granting the SAME actor a hat inside org A flips 8.2 — so 8.2 measured the organisation boundary, not "this actor can never administer anyone"');

-- ============================================================================
-- §9 ⭐⭐ THE SHARED TS↔SQL VECTORS (ADR 0161; design §3.7, lead ruling R4).
--
-- ADR 0133 D4 declined to build a SQL twin at all, and one of its stated reasons was that
-- a mirror is a DRIFT LIABILITY. ADR 0155 G11 reversed the refusal, so Architecture Rule 3
-- now genuinely attaches to `personScopeAllows` ↔ `app.can_administer_person_for`.
-- Creating the mirror WITHOUT the drift control would accept precisely the liability the
-- original prohibition warned about — two independently-authored case lists drift in
-- silence, because nothing compares them.
--
-- So there is ONE list: src/lib/users/__fixtures__/person-scope-vectors.json. The TS half
-- is driven by src/lib/users/person-scope-vectors.test.ts; this section drives the SQL
-- half from the SAME rows, compiled by scripts/gen-person-scope-vectors.mjs and pinned to
-- the JSON's bytes by a sha256 the vitest file verifies.
--
-- ⚠ RUNS LAST, AND MUTATES THE TWO PERSONAS IT DRIVES. The driver rebuilds the target's
-- footprint and the actor's administered set for every vector, so it destroys the state
-- §§1–8 depend on. Everything above must already have run.
--
-- ⚠ THE ABSTRACT KEYS ARE BOUND TO REAL ROWS, not simulated. H1/H2 resolve to two real
-- commissions at two real hospitals of the same organisation, so what is measured is the
-- predicate reading actual `memberships` and `commissions` — not a re-implementation of
-- it inside the test.
-- ============================================================================
\ir vectors/person_scope_vectors.psql

create temp table hmap on commit drop as
select 'H1'::text as key, c.hospital_id, c.id as commission_id
  from public.commissions c
 where c.hospital_id = (select central_a from k)
 order by c.id limit 1;
insert into hmap
select 'H2', c.hospital_id, c.id
  from public.commissions c
 where c.hospital_id = (select sec_a from k)
 order by c.id limit 1;

-- The driver: materialise one vector as real rows, ask the real predicate, return its
-- answer. VOLATILE because it writes; the predicate it calls is STABLE and is evaluated
-- in its own statement, so it sees the rows written just above it.
create or replace function pg_temp.vector_answer(
  p_capability text, p_footprint text[], p_tier boolean, p_administered text[]
) returns boolean
language plpgsql volatile as $va$
declare
  v_target uuid := '00000000-0000-0000-0000-000000000003';  -- staff1.ccih (no affiliations)
  v_actor  uuid := '00000000-0000-0000-0000-0000000000f4';  -- quality.a2 (never an org_admin)
  v_org    uuid := '0c000000-0000-0000-0000-00000000000a';
  v_by     uuid := '00000000-0000-0000-0000-0000000000b1';
  v_ans    boolean;
begin
  delete from public.memberships where principal_id in (v_target, v_actor);

  -- Footprint: commission-tier seats, whose hospitals are what the predicate resolves.
  insert into public.memberships (principal_id, commission_id, role, granted_by)
  select v_target, h.commission_id, 'staff', v_by
    from pg_temp.hmap h where h.key = any (p_footprint);

  -- D2: a non-commission-tier seat. It contributes NOTHING to the footprint — that is the
  -- point: it must deny on its own, whatever the footprint says.
  if p_tier then
    insert into public.memberships (principal_id, organization_id, hospital_id, role, granted_by)
    select v_target, v_org, h.hospital_id, 'pqs_member', v_by
      from pg_temp.hmap h where h.key = 'H1';
  end if;

  insert into public.memberships (principal_id, organization_id, hospital_id, role, granted_by)
  select v_actor, v_org, h.hospital_id, 'hospital_admin', v_by
    from pg_temp.hmap h where h.key = any (p_administered);

  select app.can_administer_person_for(p_capability, v_target, v_actor) into v_ans;
  return v_ans;
end $va$;

select ok(
  (select count(*)::int from hmap) = 2
  and (select count(distinct hospital_id)::int from hmap) = 2
  and (select count(*)::int from public.hospital_affiliations
        where principal_id = '00000000-0000-0000-0000-000000000003'
          and ended_on is null and voided_at is null) = 0
  and (select is_active from public.profiles where id = '00000000-0000-0000-0000-0000000000f4')
  and not app.is_org_admin_of_for('0c000000-0000-0000-0000-00000000000a',
                                  '00000000-0000-0000-0000-0000000000f4'),
  '9.1 PRECONDITION: H1/H2 bind to TWO DISTINCT hospitals, the target carries no affiliation the driver cannot clear, and the actor is active and is NOT an org_admin (an org_admin actor would short-circuit every vector to true)');

select ok(
  (select count(*)::int from person_scope_vectors) >= 32
  and (select count(distinct capability)::int from person_scope_vectors) = 4,
  '9.2 CARDINALITY CONTROL: the compiled vector list is populated and covers all four capabilities — §9.4 iterates it, so an empty or truncated list would pass having asserted nothing');

create temp table vector_results on commit drop as
select v.*, pg_temp.vector_answer(v.capability, v.footprint, v.tier, v.administered) as got
  from person_scope_vectors v;

select is(
  (select count(*)::int from vector_results where got is null), 0,
  '9.3 the driver returned an answer for EVERY vector — a NULL would fall out of the comparison in 9.4 and read as agreement');

select is(
  (select string_agg(shape || ' ' || capability
                     || ' fp=[' || array_to_string(footprint, ',') || ']'
                     || ' tier=' || tier::text
                     || ' adm=[' || array_to_string(administered, ',') || ']'
                     || ' expected=' || expect::text || ' got=' || got::text, ' | '
                     order by shape, capability)
     from vector_results where got is distinct from expect),
  null,
  '9.4 ⭐⭐ THE SQL PREDICATE AGREES WITH EVERY SHARED VECTOR — the same rows `personScopeAllows` is driven with. This is the assertion that reds when the two halves drift, naming the exact vectors that disagree');

select ok(
  (select count(*) filter (where got)) > 0 and (select count(*) filter (where not got)) > 0,
  '9.5 ⭐ …and the driver is DISCRIMINATING — it returned both answers. A driver stuck on one value could satisfy a same-answer vector list, and this is what stops that reading as agreement')
  from vector_results;

select * from finish();
rollback;
