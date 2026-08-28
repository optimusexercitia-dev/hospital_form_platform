-- AE2.4 INCREMENT 1 — THE CIRCULAR PAIR: tenant containment moves from creation
-- time to the DESTRUCTIVE EVENT, and BOTH affiliation-creating doors lose their
-- column gate.  Ruling: ADR 0164 (amends 0151 D10 and 0163).  Security context:
-- ADR 0159 D1/D2.  Re-expression + rejected alternative: ADR 0165.  Phase record:
-- docs/progress/authz-ae2.md § AE2.4 increment 1.
--
-- ============================================================================
-- ⛔⛔ WHY THE SECURITY CONTEXT IS THE SUBJECT OF THIS FILE
-- ============================================================================
-- `public.assert_profile_tenant_has_org` was a pure NULL check on `new` — it read
-- NO TABLE, which is the only reason `prosecdef = f` was harmless.  Re-predicating
-- it onto `organization_affiliations` gives it a table read, and that table's
-- SELECT policy is `principal_id = auth.uid() OR app.is_org_admin_of(organization_id)`
-- — no hospital tier AND no cross-org arm, by design (ADR 0151 D1).
--
-- A DEFERRABLE INITIALLY DEFERRED constraint trigger fires at COMMIT, i.e.
-- OUTSIDE the DEFINER door that queued it, with `current_user` back to the
-- session role.  That is the exact mechanism of BUG-D5-REHIRE-HOSPADMIN-001
-- (ADR 0159): an INVOKER backstop reads under the caller's RLS, cannot see a row
-- that provably exists, and raises a FALSE POSITIVE — A REJECTION WHERE THE
-- ANSWER IS ACCEPT.  ⛔ A suite that only tests rejects is GREEN while the path
-- is broken.  § 2.5 is this suite's accept cell and it is why the file exists.
--
-- ⭐⭐ AND HERE THAT PREDICTION IS ONLY HALF RIGHT, WHICH THE FIRST MUTATION RUN
--     CAUGHT.  Measured under an INVOKER build: `current_user = authenticated`,
--     zero visible non-voided rows — but the trigger never REACHED its
--     containment check, because PROFILE VISIBILITY IS ITSELF AFFILIATION-DERIVED
--     since AE2.2, so the caller could not see the subject's `profiles` row
--     either.  The two blindnesses are CORRELATED.  With the draft's
--     `if not found then return null` escape hatch that produced a SILENT ACCEPT
--     — a fail-OPEN that orphans the person, strictly worse than a false
--     positive, and INVISIBLE to an accept cell.  ⛔ § 2.5 was green under
--     `security invoker` until the trigger was made FAIL-CLOSED (a subject that
--     cannot be resolved is treated as non-admin and refused).  The keystone that
--     could not fail was in THIS file, found by mutation and not by reading.
--
-- ============================================================================
-- ⛔ WHERE THIS SUITE DISAGREES WITH ITS BRIEF — MEASURED, NOT ASSUMED
-- ============================================================================
-- The AE2.4 brief asks for "the `hospital_admin` containment-ACCEPT cell".
-- **That cell has no subject, and § 4.3 MEASURES why rather than asserting it.**
-- `authenticated` holds only `r` on `public.organization_affiliations` and the
-- table carries no INSERT/UPDATE/DELETE policy, so every write goes through a
-- DEFINER door.  Of those doors exactly ONE writes `voided_at`
-- (`app.void_org_affiliation_impl`) and its authority arm is
-- `app.is_org_admin_of_for` ONLY — no hospital arm (creation-symmetric,
-- ADR 0151 D8).  `app.affiliate_person_impl`, the hospital-reachable door, only
-- INSERTs org affiliations, which cannot fire a void/delete trigger.
--
-- ⭐ The INVOKER regression is REAL here, but its victim is a different actor:
--    an `org_admin` of A voiding a row of a person who is ALSO active in org B —
--    a row A's admin cannot see, because the policy has no cross-org arm either.
--    § 2.5 is that cell.  The `hospital_admin` rehire survives as § 4.1, labelled
--    a REGRESSION CONTROL over the HOSPITAL tier and NOT this trigger's keystone.
--    Calling it the keystone would be the keystone-that-could-not-fail shape: it
--    cannot reach the object under test.
--
-- ============================================================================
-- THE TWO PREDICATES, OLD → NEW, REPRODUCED FROM THE CATALOG BEFORE THE CHANGE
-- ============================================================================
-- CONTAINMENT (`public.assert_profile_tenant_has_org`)
--   OLD  on `profiles`, AFTER INSERT OR UPDATE OF home_organization_id, is_admin:
--        `new.home_organization_id is null and not new.is_admin` → raise
--   NEW  on `organization_affiliations`, AFTER UPDATE OF voided_at OR DELETE:
--        `old.principal_id` must keep ≥ 1 NON-VOIDED org affiliation unless is_admin.
--   ⚠ NON-VOIDED, not ACTIVE.  An ENDED, non-voided row satisfies containment —
--     ADR 0163's own derivation domain (bound 1: void is not end).  § 2.3 / § 2.4
--     differ in exactly that one column, which is what makes § 2.3 a statement
--     about `voided_at` rather than about "some row exists".
--
-- TENANT GATE (`app.affiliate_person_to_org_impl` AND `app.affiliate_person_impl`)
--   OLD  `v_person_org is null or v_person_org is distinct from <org>` → HC0R0
--   NEW  the person has ≥ 1 non-voided affiliation AND none is in <org> → HC0R0
--   ⚠ "not found" and "wrong organisation" stay DELIBERATELY the same error —
--     splitting them makes the door a cross-tenant existence oracle over
--     `profiles.id`.  § 3.6 / § 3.7 pin the code and the pt-BR message.
--   ⭐ BOTH SIBLINGS MOVE TOGETHER.  Lifted from the catalog and diffed, the two
--     gates were byte-identical apart from how the organisation is obtained.
--     § 5.7 re-derives that identity from `pg_proc` so it cannot drift.
--
-- ---------------------------------------------------------------------------
-- THE PRE-DECLARED DELTA.  An undeclared widening is a RED.
-- ---------------------------------------------------------------------------
--   ORG TIER (§ 3)                         HOSPITAL TIER (§ 5)
--   W5 column B, NO affiliation  WIDENING  H4 column B, NO affiliation, taken
--   W6 column B, only a VOIDED row            through the HOSPITAL_ADMIN arm  WIDENING
--   W7 column NULL, a true ORPHAN          H6 the SAME state through the
--   W9 only ENDED in B          NARROWING     ORG_ADMIN arm                   WIDENING
--                                          H5 only ENDED in B          NARROWING
--
--   The three widenings share ONE reason: after the column drops there is NO FACT
--   anchoring such a person to any organisation, so refusing every organisation
--   would make them permanently unreachable.  It is also the only recovery path
--   for the creation-time window ADR 0164 accepts.  Measured 2026-08-28 (ADR
--   0165): no non-`platform_admin` caller can ENUMERATE such a person — § 1.8 and
--   § 1.9 re-measure the two roster paths here rather than citing that.
--   The narrowing's reason: the substrate is the truth (392 CA×T8).
--
-- ⭐ W8 (active in A **and** B) is `=`, NOT a narrowing, and that is a DELIBERATE
--    refinement of the predicate.  A naive "no affiliation outside <org>" gate
--    would have broken the door's own IDEMPOTENT path for every multi-org person.
--
-- ============================================================================
-- ⭐⭐ THE ACTOR AXIS — WHY § 5 CARRIES ONE AND § 3 DOES NOT
-- ============================================================================
-- The hospital door's authority check is a DISJUNCTION —
-- `is_org_admin_of_for(org_of(hospital), actor) OR is_hospital_admin_of_for(hospital, actor)`
-- — and Hospital Central A is in org A.  Driving § 5 with `orgadmin.a` therefore
-- SHORT-CIRCUITS on the FIRST arm, and `is_hospital_admin_of_for` is never
-- evaluated on any H-cell.  Such a cell cannot distinguish "a hospital_admin can
-- claim an orphan" from "an org_admin can, through the hospital door", and only
-- the first is the widening ADR 0165 declares as the materially wider one.
-- ⛔ THE AXIS WAS STRUCTURALLY ABSENT, NOT MERELY UNPOPULATED: `ae24_gate` had no
--    actor column, so NO mutation of `is_hospital_admin_of_for` could move any
--    cell in this file, and the arm's absence was indistinguishable from its
--    presence.  QA finding B2.
--
-- `ae24_gate.actor` is that axis, and the two seed principals are COMPLEMENTARY
-- over this door — MEASURED in § 5.0, never assumed:
--     orgadmin.a       …00b1   org_admin of A = TRUE,  hospital_admin of Central A = FALSE
--     hospitaladmin.a1 …00e1   org_admin of A = FALSE, hospital_admin of Central A = TRUE
-- so each takes EXACTLY ONE arm and neither can stand in for the other.  H1-H5 run
-- on …00e1; H6 re-runs H4's state on …00b1, so the pair measures the SAME state
-- through BOTH arms instead of replacing one measurement with the other.
--
-- ============================================================================
-- ⛔ 'ok|' IS NOT A SUCCESS SIGNAL — IT IS "THE DOOR DID NOT RAISE"
-- ============================================================================
-- A door that returns early WITHOUT INSERTING — a `return null` ahead of the
-- insert, an idempotency branch matching too broadly — satisfies every
-- `measured_new` cell in this file.  That is the "accepts and silently does
-- nothing" regression, and on the orphan-claiming widenings it is the one that
-- matters: those are the cells where the new gate admits a state the column gate
-- refused, so nothing else in the estate would notice the write never landed.
-- QA finding B3.  The door's RETURN VALUE is therefore captured into
-- `ae24_gate.new_aff_id`, and the four declared widenings assert that the id
-- NAMES A LIVE ROW of the right kind, anchored to that cell's person and to the
-- target organisation/hospital — {W5,W6,W7} in § 3.10, {H4,H6} in § 5.8, exactly
-- the standard § 3.8 already held W3 to.
-- ⚠ `coalesce(v_id::text,'')` in `try_gate` is deliberate: `'ok|' || null` is NULL
--   in plpgsql, which would red § 3.1/§ 5.1 and attribute the regression to the
--   wrong assertion.  The write-through cells must be the ONLY thing that moves.
--
-- ============================================================================
-- ⚠ RUN SHAPE.  This suite cannot be run alone — `schema "test_helpers" does not
--   exist` gives a FAIL-SHAPED ABORT indistinguishable from a hold.  Correct
--   invocation: `00_setup.sql` + this file.  Expected shape `Files=2, Tests=49`.
--   A shape below 49 is an ERROR, never a hold.
--
-- Assertion count: 48
-- ============================================================================
begin;
select plan(48);

-- ---------------------------------------------------------------------------
-- Constants.  Seed ids only; every constructed id lives in a `0ae24…` namespace
-- disjoint from 390/391/392, so nothing is shared across cases and nothing is
-- deleted positionally.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (org_a uuid, org_b uuid, ca uuid, cb uuid, hosp_admin uuid,
               central_a uuid, secundario_a uuid, platform uuid)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- orgadmin.a
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- orgadmin.b
         '00000000-0000-0000-0000-0000000000e1'::uuid,  -- hospitaladmin.a1 (central-a ONLY)
         '05000000-0000-0000-0000-00000000000a'::uuid,  -- Hospital Central A
         '05000000-0000-0000-0000-0000000000a2'::uuid,  -- Hospital Secundário A (SAME org, NOT e1's)
         '00000000-0000-0000-0000-0000000000b0'::uuid;  -- platform@test.local
$$;
grant execute on function pg_temp.k() to authenticated;

-- ============================================================================
-- § 0 STRUCTURAL PINS — asserted before any fixture exists, so a fixture that
--     cannot be built against the OLD schema still leaves these verdicts legible.
-- ============================================================================
select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_tenant_has_org_trg'), 0,
  '0.1 the creation-time containment trigger on `profiles` is GONE — ADR 0164 drops the unsatisfiable arm rather than re-predicating it, because `handle_new_user` and the affiliation door run in two different transactions and DEFERRABLE defers only to its OWN commit');

select is(
  (select tgdeferrable::text || '|' || tginitdeferred::text || '|' || tgtype::text || '|' ||
          (pg_get_triggerdef(oid) ~ 'UPDATE OF voided_at')::text
     from pg_trigger
    where tgrelid = 'public.organization_affiliations'::regclass
      and tgname = 'org_affiliation_tenant_containment_trg'),
  'true|true|25|true',
  '0.2 the replacement is a DEFERRABLE INITIALLY DEFERRED constraint trigger on `organization_affiliations`, ROW-level AFTER UPDATE OF voided_at OR DELETE (tgtype 25) — the narrowest event set covering the invariant. END is deliberately NOT an event: an ended, non-voided row still satisfies containment');

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assert_profile_tenant_has_org'), true,
  '0.3 ⭐⭐ the containment trigger is SECURITY DEFINER — ADR 0159 D2: a function enforcing a DATA INVARIANT must not read that data through the caller''s RLS, because an invariant evaluated through a viewer''s lens is not an invariant. It reads no caller identity, so DEFINER grants nobody anything');

select is(
  (select array_to_string(p.proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assert_profile_tenant_has_org'),
  'search_path=public, pg_catalog',
  '0.4 …with a PINNED search_path, set in the SAME migration as the DEFINER flip — a DEFINER without one is the resolution-hijack shape');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text || '|' ||
          has_function_privilege('service_role', p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assert_profile_tenant_has_org'),
  'false|false',
  '0.5 …and EXECUTE is owner-only, asserted POSITIVELY via has_function_privilege rather than by reading proacl for an absence — a NULL proacl includes PUBLIC, the guard that reads right and fails open');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assert_profile_tenant_has_org'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'home_organization_id'), 0,
  '0.6 the containment body no longer names `home_organization_id` — measured with `--` comments STRIPPED, because the replacement comment deliberately QUOTES the predicate it replaced and a raw grep cannot tell a live read from a historical quote');

select is(
  (select coalesce(string_agg(p.proname, ',' order by p.proname), '(none)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('affiliate_person_to_org_impl', 'affiliate_person_impl')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'home_organization_id'), '(none)',
  '0.7 ⭐ NEITHER affiliation-creating door names the column — the other half of the circular pair, and BOTH SIBLINGS, because splitting identical siblings across increments is exactly how this phase produced "one axis was swept, its sibling was not" three times');

-- ---------------------------------------------------------------------------
-- ⭐ THE SEED ORPHAN SNAPSHOT IS TAKEN **BEFORE** THE FIXTURES EXIST.  This file
--    deliberately CONSTRUCTS orphans in § 1.5/§ 1.6; measuring the live
--    population afterwards would make § 1.2's "zero" impossible, and a later
--    refactor could then make it pass by counting the fixtures.
-- ---------------------------------------------------------------------------
create temp table ae24_seed_orphans as
  select * from app.tenant_orphan_profiles();

-- ============================================================================
-- § 1 THE REQUIRED MITIGATION — the orphan detector, AND PROOF IT CAN FIRE.
--
--     ⛔ Creation-time containment is genuinely lost (ADR 0164 § Consequences):
--        a half-failed person creation leaves a profile with no affiliation, in
--        NO roster, and administrable through the six person doors by NOBODY.
--        That is why ADR 0164 makes a mitigation REQUIRED rather than advised.
--
--     ⛔ THIS COMMENT SAID "administrable by `platform_admin` alone" AND THAT WAS
--        FALSE (QA finding B5).  Measured: all six person doors gate solely on
--        `app.can_administer_person_for`, which has NO `platform_admin` arm by
--        deliberate design (the ADR 0041 noun rule; `384 § 6` asserts a platform
--        admin is REFUSED) and returns false outright on an empty located-org
--        set.  The claim was wrong in the NARROWING direction, which is exactly
--        why it read as care and survived four documents.  The actual recovery
--        path is ADR 0165 D1's widening: any `org_admin` — or, through the
--        hospital sibling, any `hospital_admin` — WHO HOLDS THE PERSON'S UUID may
--        claim them.  ⚠ The window is not "only the most privileged actor can
--        reach them"; it is "nobody can, until somebody with the id takes them".
--
--     ⭐ AND WHY IT IS REQUIRED IS THE INTERESTING PART: AN ORPHAN IS
--        SHAPE-IDENTICAL TO A LEGITIMATE ROW.  Exactly one profile has no
--        non-voided org affiliation and it is the `platform_admin` — correct by
--        design, since the outgoing rule was conditional on `is_admin`.  A
--        detector keyed on absence alone would flag it forever; one tuned to
--        ignore "no affiliation at all" would ignore exactly the shape it hunts.
--        `is_admin` is ORTHOGONAL to affiliation presence, which is what lets it
--        exclude the legitimate row without excluding a mechanism.
-- ============================================================================
select is(
  (select p.prosecdef::text || '|' ||
          has_function_privilege('authenticated', p.oid, 'execute')::text || '|' ||
          has_function_privilege('service_role', p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'tenant_orphan_profiles'),
  'true|false|false',
  '1.1 the detector is DEFINER (it must see rows no single admin can) and `postgres`-only — a row-returning DEFINER reachable by `authenticated` is an enumeration oracle, and this one returns precisely the ids no roster shows. Same gating as `app.person_authority_orgs`, for the same reason');

select is(
  (select count(*)::int from ae24_seed_orphans), 0,
  '1.2 ⭐ the SEED population contains ZERO tenant orphans — the standing assertion the mitigation exists to carry, snapshotted before this file constructs any of its own');

select is(
  (select count(*)::int from public.organization_affiliations oa
    where oa.principal_id = (select platform from pg_temp.k()) and oa.voided_at is null), 0,
  '1.3 ⛔ NON-VACUITY OF THE DISCRIMINATION: the platform_admin genuinely HAS no non-voided org affiliation. Without this, 1.4 would be green because its subject does not exist rather than because the detector discriminates');

select is(
  (select count(*)::int from ae24_seed_orphans where profile_id = (select platform from pg_temp.k())), 0,
  '1.4 ⭐ …and the platform_admin is NOT flagged. 1.3 + 1.4 together ARE the discrimination claim: same shape, different verdict, decided on the `is_admin` axis');

-- ---------------------------------------------------------------------------
-- Fixtures.  `handle_new_user` mints each profile from `auth.users`; the
-- `home_organization_id` metadata key is deliberately ABSENT, so the column
-- starts NULL and each case then sets exactly what it needs.  ⛔ The COLUMN and
-- the SUBSTRATE are set INDEPENDENTLY: § 3 and § 5's whole point is the cells
-- where they disagree, and a fixture keeping them aligned would measure a
-- snapshot instead of a differential.
-- ---------------------------------------------------------------------------
create temp table ae24_people (id uuid primary key, note text);
insert into ae24_people values
  ('00000000-0000-0000-0000-0ae2401d0001', 'D1 ORPHAN: never affiliated, column NULL'),
  ('00000000-0000-0000-0000-0ae2401d0002', 'D2 ORPHAN: only a VOIDED row'),
  ('00000000-0000-0000-0000-0ae2401d0003', 'D3 not an orphan: ENDED, non-voided (also § 1.9''s positive control)'),
  ('00000000-0000-0000-0000-0ae2402c0001', 'K1 one ACTIVE row in A'),
  ('00000000-0000-0000-0000-0ae2402c0002', 'K2 ACTIVE in A and B'),
  ('00000000-0000-0000-0000-0ae2402c0003', 'K3 ENDED non-voided A + ACTIVE B'),
  ('00000000-0000-0000-0000-0ae2402c0004', 'K4 VOIDED A + ACTIVE B'),
  ('00000000-0000-0000-0000-0ae2402c0005', 'K5 ACTOR KEYSTONE: ACTIVE in A and B'),
  ('00000000-0000-0000-0000-0ae2402c0006', 'K6 is_admin, one ACTIVE row in A'),
  ('00000000-0000-0000-0000-0ae2402c0007', 'K7 DELETE probe, one ACTIVE row in A'),
  ('00000000-0000-0000-0000-0ae2404b0001', 'R1 § 4 hospital rehire subject: ENDED non-voided in A'),
  ('00000000-0000-0000-0000-0ae2405f0001', 'F1 § 5.5 flush subject: NO affiliation, written by § 5.5 ITSELF');

-- ⭐ `actor` is a REAL axis, not a constant column: within the hospital tier it
--    varies (H1-H5 on the hospital_admin, H6 on the org_admin) precisely so that
--    each arm of the door's authority disjunction is separately observable.  A
--    column holding one value everywhere would restate the defect B2 names.
create temp table ae24_gate (
  label         text primary key,
  tier          text,
  person        uuid,
  actor         uuid,
  note          text,
  expected_old  boolean,
  expected_new  boolean,
  measured_old  boolean,
  measured_new  boolean,
  new_aff_id    uuid,
  code_seen     text,
  msg_seen      text
);
insert into ae24_gate (label, tier, person, actor, note, expected_old, expected_new) values
  ('W1',  'org', '00000000-0000-0000-0000-0ae2403a0001', '00000000-0000-0000-0000-0000000000b1', 'column A, ACTIVE in A',                        true,  true),
  ('W2',  'org', '00000000-0000-0000-0000-0ae2403a0002', '00000000-0000-0000-0000-0000000000b1', 'column A, ENDED non-voided in A (REHIRE)',     true,  true),
  ('W3',  'org', '00000000-0000-0000-0000-0ae2403a0003', '00000000-0000-0000-0000-0000000000b1', 'column A, NO affiliation (PERSON CREATION)',   true,  true),
  ('W4',  'org', '00000000-0000-0000-0000-0ae2403a0004', '00000000-0000-0000-0000-0000000000b1', 'column B, ACTIVE in B',                        false, false),
  ('W5',  'org', '00000000-0000-0000-0000-0ae2403a0005', '00000000-0000-0000-0000-0000000000b1', 'column B, NO affiliation',                     false, true),
  ('W6',  'org', '00000000-0000-0000-0000-0ae2403a0006', '00000000-0000-0000-0000-0000000000b1', 'column B, only a VOIDED row in B',             false, true),
  ('W7',  'org', '00000000-0000-0000-0000-0ae2403a0007', '00000000-0000-0000-0000-0000000000b1', 'column NULL, true ORPHAN',                     false, true),
  ('W8',  'org', '00000000-0000-0000-0000-0ae2403a0008', '00000000-0000-0000-0000-0000000000b1', 'column A, ACTIVE in A and B (IDEMPOTENT)',     true,  true),
  ('W9',  'org', '00000000-0000-0000-0000-0ae2403a0009', '00000000-0000-0000-0000-0000000000b1', 'column A, only ENDED non-voided in B',         true,  false),
  ('W10', 'org', '00000000-0000-0000-0000-0ae2403a000f', '00000000-0000-0000-0000-0000000000b1', 'no profile at all (existence conflation)',     false, false),
  -- HOSPITAL TIER on `hospitaladmin.a1` — org_admin of A = FALSE (§ 5.0), so the
  -- door's first arm CANNOT admit and the hospital arm is the one being taken.
  ('H1',  'hosp','00000000-0000-0000-0000-0ae2405b0001', '00000000-0000-0000-0000-0000000000e1', 'column A, NO affiliation (CREATION), hospital_admin arm',         true,  true),
  ('H2',  'hosp','00000000-0000-0000-0000-0ae2405b0002', '00000000-0000-0000-0000-0000000000e1', 'column A, ENDED non-voided in A (D5 REHIRE), hospital_admin arm', true,  true),
  ('H3',  'hosp','00000000-0000-0000-0000-0ae2405b0003', '00000000-0000-0000-0000-0000000000e1', 'column B, ACTIVE in B, hospital_admin arm',                        false, false),
  ('H4',  'hosp','00000000-0000-0000-0000-0ae2405b0004', '00000000-0000-0000-0000-0000000000e1', 'column B, NO affiliation, hospital_admin arm — ADR 0165''s cell',  false, true),
  ('H5',  'hosp','00000000-0000-0000-0000-0ae2405b0005', '00000000-0000-0000-0000-0000000000e1', 'column A, only ENDED non-voided in B, hospital_admin arm',         true,  false),
  -- …and H4's state re-run through the OTHER arm.  Keeping both is what makes the
  -- actor an axis: drop H6 and the org_admin path through this door is unmeasured;
  -- drop H4 and ADR 0165's declared widening is unmeasured.
  ('H6',  'hosp','00000000-0000-0000-0000-0ae2405b0006', '00000000-0000-0000-0000-0000000000b1', 'column B, NO affiliation, ORG_ADMIN arm (H4''s state, other arm)', false, true);

-- ⭐ The delta lists are written HERE, from ADR 0164/0165, INDEPENDENTLY of the
--    expectation table above.  Deriving them from it would make § 3.2/§ 3.3 and
--    § 5.2/§ 5.3 restatements — green whenever the table is green.  § 3.4 is the
--    cross-check that reds if the two hand artefacts ever disagree.
create temp table ae24_declared (label text primary key, tier text, direction text, reason text);
insert into ae24_declared values
  ('W5', 'org',  'widening',  'no fact anchors a person with zero non-voided rows to any organisation'),
  ('W6', 'org',  'widening',  'a voided row is "was never true" — ADR 0163 bound 1'),
  ('W7', 'org',  'widening',  'the orphan recovery path ADR 0164 accepts the creation window for'),
  ('W9', 'org',  'narrowing', 'the substrate is the truth — retention lives in B, not in the column'),
  ('H4', 'hosp', 'widening',  'ADR 0165''s materially-wider cell: a HOSPITAL_ADMIN holding no org_admin membership claims an orphan through the hospital door'),
  ('H6', 'hosp', 'widening',  'the same state through the door''s OTHER authority arm — an org_admin, which is what the H-cells previously measured'),
  ('H5', 'hosp', 'narrowing', 'the substrate is the truth, hospital tier');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated',
       x.id || '@ae24.test', now(), now()
from (select id from ae24_people union all select person from ae24_gate where label <> 'W10') x;

update public.profiles set is_active = true, full_name = 'AE24 fixture'
 where id in (select id from ae24_people union all select person from ae24_gate where label <> 'W10');

update public.profiles set home_organization_id = (select org_a from pg_temp.k())
 where id in (select person from ae24_gate where label in ('W1','W2','W3','W8','W9','H1','H2','H5'))
    or id in (select id from ae24_people where id <> '00000000-0000-0000-0000-0ae2401d0001');
update public.profiles set home_organization_id = (select org_b from pg_temp.k())
 where id in (select person from ae24_gate where label in ('W4','W5','W6','H3','H4','H6'));
-- W7 and D1 keep `home_organization_id IS NULL` — the state the dropped trigger made
-- UNCONSTRUCTIBLE, and precisely the state the detector exists to find.

update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0ae2402c0006';

-- CPFs for § 1.9's identifier-first probe.  D1 is the orphan; D3 is the POSITIVE
-- CONTROL, so a zero for D1 cannot be the CPF path simply not working.
update public.profiles set cpf = '39053344705' where id = '00000000-0000-0000-0000-0ae2401d0001';
update public.profiles set cpf = '16899535009' where id = '00000000-0000-0000-0000-0ae2401d0003';

insert into public.organization_affiliations
  (id, principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason, created_by)
values
  -- § 1 detector fixtures --------------------------------------------------------------
  ('0aff0000-0000-0000-0000-00000000d201', '00000000-0000-0000-0000-0ae2401d0002', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), now(), (select ca from pg_temp.k()), 'lançamento equivocado', (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000d301', '00000000-0000-0000-0000-0ae2401d0003', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  -- § 2 containment fixtures -----------------------------------------------------------
  ('0aff0000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-0ae2402c0001', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c201', '00000000-0000-0000-0000-0ae2402c0002', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c202', '00000000-0000-0000-0000-0ae2402c0002', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c301', '00000000-0000-0000-0000-0ae2402c0003', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c302', '00000000-0000-0000-0000-0ae2402c0003', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c401', '00000000-0000-0000-0000-0ae2402c0004', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), now(), (select ca from pg_temp.k()), 'lançamento equivocado', (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c402', '00000000-0000-0000-0000-0ae2402c0004', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-0ae2402c0005', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c502', '00000000-0000-0000-0000-0ae2402c0005', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-0ae2402c0006', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000c701', '00000000-0000-0000-0000-0ae2402c0007', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  -- § 4 hospital rehire subject: org-offboarded, exactly the D5 state ------------------
  ('0aff0000-0000-0000-0000-00000000b101', '00000000-0000-0000-0000-0ae2404b0001', (select org_a from pg_temp.k()), date '2019-03-04', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  -- § 3 org-tier gate substrate ---------------------------------------------------------
  ('0aff0000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-0ae2403a0001', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000a201', '00000000-0000-0000-0000-0ae2403a0002', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000a401', '00000000-0000-0000-0000-0ae2403a0004', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000a601', '00000000-0000-0000-0000-0ae2403a0006', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select cb from pg_temp.k()), now(), (select cb from pg_temp.k()), 'lançamento equivocado', (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-0ae2403a0008', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000a802', '00000000-0000-0000-0000-0ae2403a0008', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000a901', '00000000-0000-0000-0000-0ae2403a0009', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select cb from pg_temp.k()), null, null, null, (select cb from pg_temp.k())),
  -- § 5 hospital-tier gate substrate ---------------------------------------------------
  ('0aff0000-0000-0000-0000-00000000b202', '00000000-0000-0000-0000-0ae2405b0002', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000b203', '00000000-0000-0000-0000-0ae2405b0003', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  ('0aff0000-0000-0000-0000-00000000b205', '00000000-0000-0000-0000-0ae2405b0005', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select cb from pg_temp.k()), null, null, null, (select cb from pg_temp.k()));
-- W3, W5, W7, H1, H4, H6, D1 and F1 deliberately get no affiliation row at all.

select is(
  (select profile_id::text || '|' || reason from app.tenant_orphan_profiles()
    where profile_id = '00000000-0000-0000-0000-0ae2401d0001'),
  '00000000-0000-0000-0000-0ae2401d0001|never_affiliated',
  '1.5 ⭐⭐ PROOF THE DETECTOR CAN FIRE: a CONSTRUCTED orphan — the exact shape a half-failed person creation leaves — IS flagged, with its mechanism named. A detector that finds nothing must be proven able to find something');

select is(
  (select profile_id::text || '|' || reason from app.tenant_orphan_profiles()
    where profile_id = '00000000-0000-0000-0000-0ae2401d0002'),
  '00000000-0000-0000-0000-0ae2401d0002|all_voided',
  '1.6 …and the SECOND orphan mechanism — every affiliation voided — is flagged separately. `reason` is what makes the output actionable rather than a count: one wants an affiliation, the other wants a human ruling');

select is(
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = '00000000-0000-0000-0000-0ae2401d0003'), 0,
  '1.7 ⭐ …while a person whose only row is ENDED and NON-VOIDED is NOT an orphan — the detector uses ADR 0163''s derivation domain (non-voided), not "active". If this ever flips, every fully-offboarded person in the estate is flagged and the signal is gone');

-- ---------------------------------------------------------------------------
-- § 1.8 / § 1.9 — THE REACHABILITY BOUND, MEASURED RATHER THAN ASSERTED.
--   The § 3/§ 5 widening lets any org (or hospital) admin affiliate an orphan.
--   That is only tolerable because an orphan is in NO roster, so claiming one
--   requires already knowing them from outside the system.  Both roster paths
--   are re-measured here, each with a positive control, because a zero from a
--   door that returns nothing at all would prove the opposite of what it reads.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false, 'org_admin');
set local role authenticated;

select is(
  (select count(*) filter (where user_id = '00000000-0000-0000-0000-0ae2401d0001')::text || '|' ||
          (count(*) > 0)::text
     from public.list_org_people((select org_a from pg_temp.k()), null, null, true)),
  '0|true',
  '1.8 ⭐ the orphan does NOT appear in `list_org_people` even under `p_include_ended` — the widener relaxes `ended_on is null` only, while `voided_at is null` and the affiliation `exists` are unconditional. The `> 0` half is the positive control: a zero from an empty result set would prove nothing');

select is(
  (select (select count(*)::int from public.list_org_people((select org_a from pg_temp.k()), null, '39053344705', true)) || '|' ||
          (select count(*)::int from public.list_org_people((select org_a from pg_temp.k()), null, '16899535009', true))),
  '0|1',
  '1.9 ⭐ nor by EXACT-MATCH CPF — the identifier-first path, which is the one that could plausibly reach a person no listing shows. The second half is the POSITIVE CONTROL: an ENDED, non-voided person with a CPF IS returned, so the zero is discrimination and not a broken probe');
reset role;

-- ============================================================================
-- § 2 THE CONTAINMENT TRIGGER — accept AND reject, on the STATE axis (§ 2.1-2.4,
--     § 2.8) and on the ACTOR axis (§ 2.5-2.7).
--
--     ⚠ THE DEFERRAL TRAP, inherited from 380 § 6 / 381 and restated because it
--       is load-bearing: the trigger is DEFERRABLE INITIALLY DEFERRED and every
--       pgTAP suite ends in `rollback`, so it NEVER fires on its own here. Every
--       arm forces `set constraints all immediate` in the SAME statement block.
--       Without that line the arms observe the write succeed and pass while
--       proving nothing.
-- ============================================================================
select throws_ok(
  $$update public.organization_affiliations
       set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000000b1',
           void_reason = 'lançamento equivocado'
     where id = '0aff0000-0000-0000-0000-00000000c101';
    set constraints all immediate;$$,
  '23514',
  'a non-admin profile must retain at least one non-voided organization affiliation (tenant anchor, ADR 0164): principal 00000000-0000-0000-0000-0ae2402c0001',
  '2.1 REJECT: voiding a person''s ONLY non-voided affiliation is refused — the destructive event the invariant now guards, and the entire reason enforcement could move off creation time. ⚠ The MESSAGE is matched, not just 23514: three other objects raise check_violation on this table, so a code-only assertion could be satisfied by the wrong refusal');
set constraints all deferred;

select lives_ok(
  $$update public.organization_affiliations
       set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000000b1',
           void_reason = 'lançamento equivocado'
     where id = '0aff0000-0000-0000-0000-00000000c201';
    set constraints all immediate;$$,
  '2.2 ACCEPT: voiding one of TWO active affiliations lives — containment means "reachable by someone", not "reachable by this organisation"');
set constraints all deferred;

select lives_ok(
  $$update public.organization_affiliations
       set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000000b2',
           void_reason = 'lançamento equivocado'
     where id = '0aff0000-0000-0000-0000-00000000c302';
    set constraints all immediate;$$,
  '2.3 ⭐ VOID vs END, accept side: an ENDED, NON-VOIDED row satisfies containment, so voiding the person''s only ACTIVE row lives. ADR 0163''s retention derivation is the domain — a fully offboarded person is still reachable');
set constraints all deferred;

select throws_ok(
  $$update public.organization_affiliations
       set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000000b2',
           void_reason = 'lançamento equivocado'
     where id = '0aff0000-0000-0000-0000-00000000c402';
    set constraints all immediate;$$,
  '23514',
  'a non-admin profile must retain at least one non-voided organization affiliation (tenant anchor, ADR 0164): principal 00000000-0000-0000-0000-0ae2402c0004',
  '2.4 ⭐ VOID vs END, reject side: the SAME shape with the A row VOIDED instead of ended is refused, and by THIS trigger (message-matched). 2.3 and 2.4 differ in exactly ONE column, which is what makes 2.3 a statement about `voided_at` rather than about "some row exists"');
set constraints all deferred;

-- ---------------------------------------------------------------------------
-- ⭐⭐ § 2.5 THE ACTOR KEYSTONE.  Same state, same door, and the actor is now a
--     real signed-in caller instead of the privileged suite role.  `orgadmin.a`
--     voids the A-row of a person who is ALSO active in org B — a row
--     `orgadmin.a` CANNOT SEE, because `organization_affiliations_select` has no
--     cross-org arm.  Under SECURITY INVOKER the deferred trigger reads zero
--     non-voided rows at COMMIT and raises a FALSE-POSITIVE 23514.  Under
--     DEFINER it sees the data it is asserting over, and accepts.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false, 'org_admin');
set local role authenticated;

select lives_ok(
  $$select public.void_org_affiliation(
      '0aff0000-0000-0000-0000-00000000c501'::uuid, 'lançamento equivocado');
    set constraints all immediate;$$,
  '2.5 ⭐⭐ KEYSTONE: an ORG ADMIN of A voids the A-row of a person also active in org B, and it LIVES. Under `security invoker` this raises a false-positive 23514 — A REJECTION WHERE THE ANSWER IS ACCEPT — and it does so ONLY because the trigger fails CLOSED on an unresolvable subject; the draft''s `if not found then return null` made the same blindness a SILENT ACCEPT and this cell green. Proven by mutation M2, not by reading');
set constraints all deferred;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = '00000000-0000-0000-0000-0ae2402c0005'
      and organization_id = (select org_b from pg_temp.k())), 0,
  '2.6 ⭐ …and that org admin STILL reads ZERO of the person''s org-B affiliations — so 2.5 passes because the TRIGGER stopped consulting caller RLS, NOT because a tenancy policy was widened for it. ADR 0164 § Consequences rejects exactly that fix and ADR 0158 D2 forbids it');
reset role;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = '00000000-0000-0000-0000-0ae2402c0005'
      and organization_id = (select org_b from pg_temp.k())
      and voided_at is null), 1,
  '2.7 non-vacuity: the row 2.6 cannot see DOES exist, measured without RLS. That 1-vs-0 gap IS the blindness — without this, 2.6 is satisfied by the row simply not being there');

select lives_ok(
  $$update public.organization_affiliations
       set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000000b1',
           void_reason = 'lançamento equivocado'
     where id = '0aff0000-0000-0000-0000-00000000c601';
    set constraints all immediate;$$,
  '2.8 the `is_admin` exemption survives the re-predication: a platform admin needs no tenant anchor, which is why the one seed profile with no affiliation is correct by design — and why the detector had to discriminate on more than an absent affiliation');
set constraints all deferred;

select throws_ok(
  $$delete from public.organization_affiliations
     where id = '0aff0000-0000-0000-0000-00000000c701';
    set constraints all immediate;$$,
  '23514',
  'vínculos organizacionais não são excluídos; encerre com end_org_affiliation ou anule com void_org_affiliation (ADR 0151 D1/D7)',
  '2.9 ⛔ THE DELETE ARM IS UNREACHABLE, AND THIS ASSERTION SAYS SO RATHER THAN CLAIMING COVERAGE: the refusal comes from `guard_org_affiliation_no_delete` (BEFORE DELETE), matched on its MESSAGE because both raise 23514. The containment trigger''s DELETE arm is a backstop this suite has NOT shown able to fire');
set constraints all deferred;

-- ============================================================================
-- § 3 THE TENANT GATE, ORG TIER — AE2.3b's write/containment differential for
--     this increment.  Both predicates are evaluated in ONE transaction, per case.
--
--     ⛔ The OLD gate is REPRODUCED from an RLS-FREE snapshot of the column,
--        because it was a read inside a DEFINER door against the row already in
--        hand — never a re-read under the caller's RLS.  Re-reading it through
--        the caller would compare the new predicate with itself.
-- ============================================================================
create temp table ae24_snapshot as
  select p.id as person_id, p.home_organization_id from public.profiles p
   where p.id in (select person from ae24_gate);

-- ⭐ The ACTOR comes from the ROW, not from a literal.  Hard-coding `…00b1` here
--    is what made the hospital tier's authority arm unobservable (B2): every
--    H-cell short-circuited on `is_org_admin_of_for` and the hospital arm was
--    never evaluated, so no mutation of it could move any cell.
-- ⭐ The door's RETURN VALUE is captured, not discarded by `perform` (B3): 'ok|'
--    alone means only "did not raise", which a door that returns early WITHOUT
--    INSERTING also satisfies.  ⚠ `coalesce(…,'')` keeps such a door reporting
--    `measured_new = true` on purpose, so § 3.10 / § 5.8 are the ONLY assertions
--    that move — `'ok|' || null` is NULL and would red § 3.1/§ 5.1 instead,
--    pinning the regression on the wrong cell.
create or replace function pg_temp.try_gate(p_label text)
returns text language plpgsql as $$
declare v_msg text; v_row record; v_id uuid;
begin
  select g.tier, g.person, g.actor into v_row from ae24_gate g where g.label = p_label;
  if v_row.tier = 'org' then
    select app.affiliate_person_to_org_impl(
      v_row.actor, v_row.person,
      '0c000000-0000-0000-0000-00000000000a'::uuid, null) into v_id;
  else
    select app.affiliate_person_impl(
      v_row.actor, v_row.person,
      '05000000-0000-0000-0000-00000000000a'::uuid, null, null, null, null, null) into v_id;
  end if;
  return 'ok|' || coalesce(v_id::text, '');
exception when others then
  get stacked diagnostics v_msg = message_text;
  return sqlstate || '|' || v_msg;
end;
$$;

update ae24_gate g
   set measured_old = coalesce(
         (select s.home_organization_id = (select org_a from pg_temp.k())
            from ae24_snapshot s where s.person_id = g.person), false);

do $$
declare r record; v text;
begin
  for r in select label from ae24_gate order by tier desc, label loop
    v := pg_temp.try_gate(r.label);
    update ae24_gate
       set measured_new = (v like 'ok|%'),
           -- guarded cast: on a refusal the second field is the pt-BR message
           new_aff_id   = case when v like 'ok|%'
                               then nullif(split_part(v, '|', 2), '')::uuid end,
           code_seen    = split_part(v, '|', 1),
           msg_seen     = split_part(v, '|', 2)
     where label = r.label;
  end loop;
end $$;

select is(
  (select coalesce(string_agg(label || ':old=' || measured_old::text || '/' || expected_old::text ||
                              ',new=' || measured_new::text || '/' || expected_new::text, ' ' order by label), '')
     from ae24_gate
    where tier = 'org'
      and (measured_old is distinct from expected_old or measured_new is distinct from expected_new)), '',
  '3.1 ⭐ every one of the ten ORG-TIER cells matches its PRE-DECLARED old/new expectation — the table was written from ADR 0164 before the first behavioural run, so a match is a measurement and not a fit');

select is(
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_gate where tier = 'org' and measured_new and not measured_old),
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_declared where tier = 'org' and direction = 'widening'),
  '3.2 ⭐⭐ the measured WIDENINGS equal the hand-written declaration {W5,W6,W7} — an undeclared widening is a RED. Narrowing can be wrong and safe; unapproved widening cannot');

select is(
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_gate where tier = 'org' and measured_old and not measured_new),
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_declared where tier = 'org' and direction = 'narrowing'),
  '3.3 the measured NARROWINGS equal the declared {W9} — carried explicitly because a differential that only pre-declares widenings would let a silent narrowing through, which is exactly how an arbitrary tie-break would have shipped in 390');

select is(
  (select coalesce(string_agg(label || '=' || direction, ',' order by label), '')
     from (select label,
                  case when expected_new and not expected_old then 'widening'
                       when expected_old and not expected_new then 'narrowing' end as direction
             from ae24_gate) t
    where direction is not null),
  (select coalesce(string_agg(label || '=' || direction, ',' order by label), '') from ae24_declared),
  '3.4 CROSS-CHECK over BOTH tiers: the deltas IMPLIED by the expectation table equal the independently-written declaration list. 3.2/3.3 compare MEASURED against DECLARED; this compares EXPECTED against DECLARED, so the two hand artefacts cannot quietly drift into agreement with each other');

select is(
  (select count(*) filter (where measured_old)::text || '|' ||
          count(*) filter (where not measured_old)::text || '|' ||
          count(*) filter (where measured_new)::text || '|' ||
          count(*) filter (where not measured_new)::text
     from ae24_gate where tier = 'org'),
  '5|5|7|3',
  '3.5 THE FLOOR: both predicates are genuinely mixed over the population (5/5 old, 7/3 new). Without this, 3.1-3.3 could be agreement between two silently-CONSTANT predicates rather than between two live ones');

select is(
  (select coalesce(string_agg(distinct code_seen, ',' order by code_seen), '(none)')
     from ae24_gate where not measured_new), 'HC0R0',
  '3.6 ⭐ across BOTH tiers, every refusal is EXACTLY the documented HC0R0 — a door that stops raising a documented error is an API change, and a refusal arriving as another code surfaces in the UI as an unmapped raw Postgres error');

select is(
  (select coalesce(string_agg(distinct msg_seen, ' / ' order by msg_seen), '(none)')
     from ae24_gate where not measured_new),
  'pessoa não pertence a esta organização',
  '3.7 …with the pt-BR message preserved verbatim, INCLUDING for W10 (no profile row at all): "not found" and "wrong organisation" stay deliberately indistinguishable, or the door becomes a cross-tenant existence oracle over profiles.id');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = '00000000-0000-0000-0000-0ae2403a0003'
      and organization_id = (select org_a from pg_temp.k())
      and ended_on is null and voided_at is null), 1,
  '3.8 ⭐⭐ NON-VACUITY OF THE PERSON-CREATION CELL: W3 — a person with NO affiliation row at all — was actually AFFILIATED, not merely "not refused". This is the cell the circularity was about: the old gate could only pass it because `handle_new_user` had already written the column');

select is(
  (select count(*) filter (where ended_on is null and voided_at is null)::text || '|' ||
          count(*) filter (where ended_on is not null and voided_at is null)::text
     from public.organization_affiliations
    where principal_id = '00000000-0000-0000-0000-0ae2403a0002'
      and organization_id = (select org_a from pg_temp.k())),
  '1|1',
  '3.9 …and ONE-STEP REHIRE works through the new gate: W2''s ended row is untouched and a NEW active row sits beside it (ADR 0151 D5 — no prior org_admin ticket)');

-- ---------------------------------------------------------------------------
-- § 3.10 WRITE-THROUGH FOR THE ORG-TIER WIDENINGS.  {W5,W6,W7} are the cells
--   where the new gate admits a state the column gate REFUSED — so if the door
--   accepted and silently wrote nothing, no other fact in the estate contradicts
--   it.  ⭐ The expectation NAMES ALL THREE LABELS.  An `= ''` over a
--   "rows that failed" filter would be satisfied by a renamed label, a dropped
--   cell or an empty table exactly as it is by success: absence would look
--   identical to not-listed.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(label || '=' || v, ' ' order by label), '(NO CELLS)')
     from (select g.label,
                  case when g.new_aff_id is null then 'NO-ID-RETURNED'
                       when exists (select 1 from public.organization_affiliations oa
                                     where oa.id = g.new_aff_id
                                       and oa.principal_id = g.person
                                       and oa.organization_id = (select org_a from pg_temp.k())
                                       and oa.ended_on is null and oa.voided_at is null)
                       then 'live-org-row' else 'NO-LIVE-ROW' end as v
             from ae24_gate g where g.label in ('W5','W6','W7')) t),
  'W5=live-org-row W6=live-org-row W7=live-org-row',
  '3.10 ⭐⭐ WRITE-THROUGH, org tier: each declared widening returned an id that NAMES a live, non-ended, non-voided affiliation of THAT person to org A — not merely "the door did not raise". A `return null` ahead of the insert, or an idempotency branch matching too broadly, leaves every `measured_new` cell green and reds only here');

-- ============================================================================
-- § 4 REGRESSION CONTROLS — the hospital tier's own containment trigger, and the
--     measurement that licenses § 2.5's substitution of an org_admin for the
--     brief's hospital_admin.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;

select lives_ok(
  $$select public.affiliate_person(
      '00000000-0000-0000-0000-0ae2404b0001'::uuid,
      '05000000-0000-0000-0000-00000000000a'::uuid,
      null, '2019-03-04'::date, null, null, null);
    set constraints all immediate;$$,
  '4.1 REGRESSION CONTROL: a `hospital_admin` still performs ADR 0151 D5''s one-step rehire of an org-offboarded person — the flow BUG-D5-REHIRE-HOSPADMIN-001 broke. ⚠ This exercises the HOSPITAL-tier containment trigger (DEFINER since ADR 0159), NOT the trigger this increment adds; it is a control, never this suite''s keystone');
set constraints all deferred;
reset role;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = '00000000-0000-0000-0000-0ae2404b0001'
      and organization_id = (select org_a from pg_temp.k())
      and ended_on is null and voided_at is null), 1,
  '4.2 non-vacuity of 4.1: the org PARENT was actually created by the hospital door — 4.1 is a real write with a real deferred check behind it, not a no-op that cannot fail');

select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname || ':' ||
            (regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_hospital_admin')::text, ',' order by p.proname), '(none)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'organization_affiliations'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'set voided_at'),
  'app.void_org_affiliation_impl:false',
  '4.3 ⛔ THE MEASUREMENT THAT LICENSES § 2.5''s ACTOR: exactly ONE function writes `voided_at` on organization_affiliations and it carries NO hospital-admin arm. `authenticated` holds SELECT only on that table, so no hospital_admin can fire the new trigger by any path — the brief''s "hospital_admin containment-accept cell" HAS NO SUBJECT, and § 2.5 uses a cross-org-blind org_admin instead');

-- ============================================================================
-- § 5 THE TENANT GATE, HOSPITAL TIER — the sibling axis, swept in the SAME
--     increment.  Measured in § 3's loop; asserted separately so a hospital-tier
--     regression cannot hide inside an org-tier aggregate.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ⭐⭐ § 5.0 THE ACTOR PIN — WITHOUT IT EVERY H-CELL BELOW IS AMBIGUOUS.
--   The door admits on `is_org_admin_of_for(org_of(hospital)) OR
--   is_hospital_admin_of_for(hospital)`.  H1-H5 green tells us the disjunction
--   was true; it does not say WHICH arm made it true.  This cell removes the
--   ambiguity by pinning the actor's authority in BOTH directions:
--     • org_admin of A = FALSE  → the FIRST arm cannot have admitted, so an
--       H-cell that lives, lived through the hospital arm;
--     • hospital_admin of Central A = TRUE → the arm exists to be taken;
--     • hospital_admin of Hospital SECUNDÁRIO A = FALSE → and it is HOSPITAL-
--       scoped, not org-scoped.  ⭐ This third component is what makes the pin
--       two-directional: a helper mutated to return TRUE unconditionally leaves
--       the first two components intact and reds only here.
-- ---------------------------------------------------------------------------
select is(
  (select 'org_a=' || app.is_org_admin_of_for((select org_a from pg_temp.k()), (select hosp_admin from pg_temp.k()))::text ||
          '|central_a=' || app.is_hospital_admin_of_for((select central_a from pg_temp.k()), (select hosp_admin from pg_temp.k()))::text ||
          '|secundario_a=' || app.is_hospital_admin_of_for((select secundario_a from pg_temp.k()), (select hosp_admin from pg_temp.k()))::text),
  'org_a=false|central_a=true|secundario_a=false',
  '5.0 ⭐⭐ THE ACTOR PIN: the H1-H5 actor holds hospital_admin on Hospital Central A, holds NO org_admin on org A, and is NOT an admin of the OTHER hospital in that same org. The door''s authority disjunction therefore can only have admitted through the HOSPITAL arm — the arm the previous fixture short-circuited past by driving both tiers with `orgadmin.a`, which made every H-cell a statement about the org arm wearing a hospital label');

select is(
  (select coalesce(string_agg(label || ':old=' || measured_old::text || '/' || expected_old::text ||
                              ',new=' || measured_new::text || '/' || expected_new::text, ' ' order by label), '')
     from ae24_gate
    where tier = 'hosp'
      and (measured_old is distinct from expected_old or measured_new is distinct from expected_new)), '',
  '5.1 ⭐ every HOSPITAL-TIER cell matches its pre-declared expectation. The gate is the same predicate, but the door''s authority arm is wider (org_admin OR hospital_admin), so the delta had to be measured through this door and not inferred from § 3');

select is(
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_gate where tier = 'hosp' and measured_new and not measured_old),
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_declared where tier = 'hosp' and direction = 'widening'),
  '5.2 ⭐⭐ the hospital-tier WIDENINGS are the declared {H4,H6} — the SAME state through the door''s two authority arms. H4 carries ADR 0165''s "materially wider" claim and is the only cell in this file that measures it: its actor holds hospital_admin on this hospital and NO org_admin anywhere (§ 5.0), so the orphan-claiming capability really is in a hospital admin''s hands and not an org admin''s borrowed through this door. H6 keeps the org_admin arm measured rather than traded away');

select is(
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_gate where tier = 'hosp' and measured_old and not measured_new),
  (select coalesce(string_agg(label, ',' order by label), '')
     from ae24_declared where tier = 'hosp' and direction = 'narrowing'),
  '5.3 …and the hospital-tier NARROWING is the declared {H5}');

select is(
  (select count(*) filter (where measured_old)::text || '|' ||
          count(*) filter (where not measured_old)::text || '|' ||
          count(*) filter (where measured_new)::text || '|' ||
          count(*) filter (where not measured_new)::text
     from ae24_gate where tier = 'hosp'),
  '3|3|4|2',
  '5.4 the hospital-tier floor: both predicates are mixed here too, so 5.1-5.3 are agreement between two live predicates');

-- ---------------------------------------------------------------------------
-- ⛔ § 5.5 CARRIES ITS OWN WRITE, AND THAT IS THE WHOLE FIX (QA finding M8).
--   It used to be a bare `set constraints all immediate` sitting 50 lines after
--   § 4.1's flush, with NO DML in between.  § 4.1 had already drained the queue,
--   so § 5.5's flush had nothing to fire and succeeded unconditionally: its
--   verdict was decided by an unrelated regression control, never by its own
--   stated subject.  The file's own rule at § 2's header — "every arm forces
--   `set constraints all immediate` in the SAME statement block" — exists for
--   exactly this, and § 5.5 was the one arm that broke it.
--   ⭐ F1 is a FRESH person with no affiliation, so the org-parent ensure and the
--     deferred `hospital_affiliation_has_org_trg` both genuinely run; and because
--     no other cell touches F1, a mutation aimed at F1 alone moves § 5.5 alone.
--   ⚠ A `lives_ok` cannot see that its own write happened, which is the very
--     vacuity being repaired — § 5.5b is that half and the two are one assertion
--     split in two, not a control and a duplicate.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select app.affiliate_person_impl(
      '00000000-0000-0000-0000-0000000000e1'::uuid,
      '00000000-0000-0000-0000-0ae2405f0001'::uuid,
      '05000000-0000-0000-0000-00000000000a'::uuid, null, null, null, null, null);
    set constraints all immediate;$$,
  '5.5 ⭐ ADR 0151 D4: a hospital affiliation created through the hospital door has an active org parent, and the DEFERRED containment trigger says so at the flush in this same statement block. The write is F1''s and nothing else touches F1, so this cell''s verdict is now decided by its own subject rather than by whether § 4.1 happened to drain the queue first');
set constraints all deferred;

select is(
  (select (select count(*)::int from public.hospital_affiliations
            where principal_id = '00000000-0000-0000-0000-0ae2405f0001'
              and hospital_id = (select central_a from pg_temp.k())
              and ended_on is null and voided_at is null) || '|' ||
          (select count(*)::int from public.organization_affiliations
            where principal_id = '00000000-0000-0000-0000-0ae2405f0001'
              and organization_id = (select org_a from pg_temp.k())
              and ended_on is null and voided_at is null)),
  '1|1',
  '5.5b ⛔ NON-VACUITY OF 5.5''s FLUSH: F1''s hospital row AND its org parent both exist, so the flush above had a real deferred event to fire. Without this, a door that accepted and wrote nothing would leave 5.5 flushing an empty queue — which is precisely the defect 5.5 was rewritten to escape, reintroduced one level down');

select is(
  (select (select count(*)::int from public.organization_affiliations
            where principal_id = '00000000-0000-0000-0000-0ae2405b0002'
              and organization_id = (select org_a from pg_temp.k())
              and ended_on is null and voided_at is null) || '|' ||
          (select count(*)::int from public.hospital_affiliations
            where principal_id = '00000000-0000-0000-0000-0ae2405b0002'
              and hospital_id = (select central_a from pg_temp.k())
              and ended_on is null and voided_at is null)),
  '1|1',
  '5.6 non-vacuity: H2''s D5 one-step rehire actually created BOTH rows — the org parent the hospital door ensures, and the hospital affiliation itself. Without this, 5.1''s "new=true" could be a refusal that merely failed to raise');

select is(
  (select count(distinct pred)::text || '|' || count(*)::text from (
     select regexp_replace(
              substring(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g')
                        from 'if exists \(select 1 from public\.organization_affiliations.*?HC0R0'''),
              'p_organization|v_org', '<ORG>', 'g') as pred
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app'
        and p.proname in ('affiliate_person_to_org_impl', 'affiliate_person_impl')) s
    where pred is not null),
  '1|2',
  '5.7 ⭐⭐ THE SIBLING PIN, DERIVED FROM THE CATALOG: both doors carry the SAME containment predicate once the organisation expression is normalised (2 doors, 1 distinct predicate). "Identical" was verified by diffing the live bodies rather than transplanted — and this re-derives it every run, so a fix applied to one sibling and not the other reds here instead of shipping');

-- ---------------------------------------------------------------------------
-- § 5.8 WRITE-THROUGH FOR THE HOSPITAL-TIER WIDENINGS.  Asserted apart from
--   § 3.10 for § 5's standing reason: a hospital-tier regression must not be able
--   to hide inside an org-tier aggregate.  ⭐ The hospital door returns the
--   HOSPITAL affiliation id, so the org PARENT it also creates is checked by
--   existence — for an orphan-claiming cell that parent IS the effect under
--   discussion, since it is what stops the person being an orphan.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(label || '=' || v, ' ' order by label), '(NO CELLS)')
     from (select g.label,
                  case when g.new_aff_id is null then 'NO-ID-RETURNED'
                       when not exists (select 1 from public.hospital_affiliations ha
                                         where ha.id = g.new_aff_id
                                           and ha.principal_id = g.person
                                           and ha.hospital_id = (select central_a from pg_temp.k())
                                           and ha.ended_on is null and ha.voided_at is null)
                       then 'NO-LIVE-HOSPITAL-ROW'
                       when not exists (select 1 from public.organization_affiliations oa
                                         where oa.principal_id = g.person
                                           and oa.organization_id = (select org_a from pg_temp.k())
                                           and oa.ended_on is null and oa.voided_at is null)
                       then 'NO-ORG-PARENT'
                       else 'live-hospital-row+org-parent' end as v
             from ae24_gate g where g.label in ('H4','H6')) t),
  'H4=live-hospital-row+org-parent H6=live-hospital-row+org-parent',
  '5.8 ⭐⭐ WRITE-THROUGH, hospital tier: BOTH declared widenings returned an id naming a live hospital affiliation of that person to Hospital Central A, AND the person now has the active org-A parent — the orphan really was claimed, through the hospital_admin arm (H4) and the org_admin arm (H6) alike, rather than merely "not refused"');

select * from finish();
rollback;
