-- AE2.4 INCREMENT 1 — TENANT CONTAINMENT ON THE DESTRUCTIVE EVENT, AND THE
-- THREE-DOOR SPLIT.  Ruling: ADR 0164 (amends 0151 D10 and 0163) · ADR 0168
-- (+ Amendment 1, PO-ruled 2026-08-28).  Security context: ADR 0159 D1/D2.
-- Re-expression + rejected alternative: ADR 0165.  Phase record:
-- docs/progress/authz-ae2.md § AE2.4 increment 1.
--
-- ⛔⛔ RE-CUT FOR THE `profiles.home_organization_id` DROP — AND THIS FILE IS NO
--     LONGER A DIFFERENTIAL AGAINST THAT COLUMN.  It used to difference every door
--     against the gen-0 COLUMN gate; with the column gone that comparison has no
--     second side.  DELETED, therefore: the `expected_old` / `measured_old` axis, the
--     RLS-free column snapshot, the widening/narrowing delta aggregates and their
--     independent declaration list, the expected-vs-declared cross-check, and the
--     gen-0 halves of the two floors.
--
--     ⭐ THE FILE SURVIVES BECAUSE ALMOST NONE OF IT WAS THAT DIFFERENTIAL.  Of the
--     55 original cells only 2 were purely about the column and 9 were hybrids; the
--     other 36 are ORTHOGONAL to it — the containment trigger, the orphan detector,
--     THE THREE-DOOR SPLIT, the actor pin and the write-through halves — and most are
--     unique estate-wide.  What is left states the LIVE predicates directly instead
--     of deriving them by subtraction from a dead one.
--
-- ⭐ THE SPLIT IS STILL MEASURED AS A SPLIT, NOT AS A LIST OF REFUSALS.  The
--    anchorless disjunct that admits W3/W5/W6/W7/H1/H4/H6 and § 5.5's F1 write is
--    absent from the two ORDINARY doors and lives, unchanged, behind two
--    `service_role` CREATION doors.  Every one of those cells is run through BOTH
--    doors, on the same row, the same actor and the same target, and asserted as
--    *refused by the ordinary door AND admitted by the creation door* (§ 3.11).  A
--    suite that recorded only the refusals would leave those cells reading as
--    evidence for "person creation is broken" and for "person creation moved" alike.
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
-- THE PREDICATES, REPRODUCED FROM THE CATALOG BEFORE EACH CHANGE
-- ============================================================================
-- CONTAINMENT (`public.assert_profile_tenant_has_org`) — UNCHANGED by ADR 0168
--   on `organization_affiliations`, AFTER UPDATE OF voided_at OR DELETE:
--   `old.principal_id` must keep ≥ 1 NON-VOIDED org affiliation unless is_admin.
--   ⚠ NON-VOIDED, not ACTIVE.  An ENDED, non-voided row satisfies containment —
--     ADR 0163's own derivation domain (bound 1: void is not end).  § 2.3 / § 2.4
--     differ in exactly that one column, which is what makes § 2.3 a statement
--     about `voided_at` rather than about "some row exists".
--
-- THE TENANT GATE — TWO LIVE PREDICATES, MEASURED AGAINST EACH OTHER
--   ORDINARY doors (ADR 0168 D1) — `app.affiliate_person_to_org_impl` and
--          `app.affiliate_person_impl`: `app.person_known_to_org(<person>, <org>)`
--          and nothing else.  Measured as `measured_new`.
--   CREATION doors (ADR 0168 Amdt 1) — `app.affiliate_new_person_to_org_impl` and
--          `app.affiliate_new_person_impl`, `service_role` only:
--          `person_known_to_org(…) OR app.person_is_anchorless(<person>)`.
--          Measured as `measured_creation`.  These are AE2.4 increment 1's own
--          semantics ("known HERE, or known NOWHERE") preserved verbatim — ADR 0168
--          did not delete them, it moved them behind an ACL.
--
--   ⚠ "not found" and "wrong organisation" stay DELIBERATELY the same error across
--     ALL doors — splitting them makes the door a cross-tenant existence oracle
--     over `profiles.id`.  § 3.6 / § 3.6b / § 3.7 pin the code and the pt-BR message
--     on the ordinary AND the creation door alike.  ⭐ W10 (no profile row at all)
--     is refused by the `not found` on `profiles`, NOT by either predicate — which
--     is why it must keep arriving with the identical code and message.
--   ⭐ THE SIBLING PIN — that both predicates move together across all five doors of
--     the family — used to live here as § 5.7, keyed on a hand-written five-name
--     list.  It is now `399 § 3.1`, which derives the same domain from the bodies
--     that write `organization_affiliations` instead of from a list.  Dropped here
--     rather than kept in two places, one of which cannot notice a sixth door.
--
-- ---------------------------------------------------------------------------
-- WHAT THE TWO DOORS DIFFER ON.  Declared here, asserted in § 3.11.
-- ---------------------------------------------------------------------------
--   ORDINARY refuses / CREATION admits:  W3 W5 W6 W7 (org)   H1 H4 H6 (hospital)
--                                        + § 5.5's F1, which is not an `ae24_gate` row
--   ORDINARY admits / CREATION refuses:  NOTHING — the creation door is a strict
--                                        superset of its ordinary sibling, never a
--                                        different door wearing the name.
--
--   ⭐⭐ THE EMPTY HALF IS ANCHORED BY THE NON-EMPTY ONE.  An empty aggregate is
--   exactly the shape that passes while proving nothing, so § 3.11 asserts the
--   populated forward set and the empty reverse set IN ONE STRING, from the SAME
--   query shape over the SAME table.
--
--   W3/H1 are the PERSON-CREATION pair, and they are NOT a capability being removed:
--   they are a capability being MOVED to `app.affiliate_new_person_*_impl`.  § 3.11 is
--   the assertion that says so, and without it this file would read as "ADR 0168 broke
--   person creation" — which is what ADR 0168 Amdt 1 records the two-door form as
--   actually doing.
--
-- ⭐ W8 (active in A **and** B) is admitted by BOTH doors, and that is a DELIBERATE
--    refinement.  A naive "no affiliation outside <org>" gate would have broken the
--    door's own IDEMPOTENT path for every multi-org person.
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
-- ⚠ THE AXIS SURVIVES ADR 0168 INTACT, and it had to: the creation doors' authority
--   arms are IDENTICAL to their ordinary siblings' by construction, so H4 (hospital
--   arm) and H6 (org arm) must stay a PAIR through the creation door too, or the
--   creation door's hospital arm is unmeasured exactly as the ordinary door's was.
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
-- `measured_*` cell in this file.  That is the "accepts and silently does
-- nothing" regression, and on the orphan-claiming cells it is the one that
-- matters.  QA finding B3.  Each door's RETURN VALUE is therefore captured, and
-- the declared admits assert that the id NAMES A LIVE ROW of the right kind,
-- anchored to that cell's person and to the target organisation/hospital —
-- {W3,W5,W6,W7} in § 3.10, {H1,H4,H6} in § 5.8.
-- ⚠ `coalesce(v_id::text,'')` in `try_gate` is deliberate: `'ok|' || null` is NULL
--   in plpgsql, which would red § 3.1/§ 5.1 and attribute the regression to the
--   wrong assertion.  The write-through cells must be the ONLY thing that moves.
-- ⭐ AND THE NEGATIVE HALF IS ASSERTED TOO (§ 3.12 / § 5.9), from a SNAPSHOT taken
--   BETWEEN the two loops: the ordinary door must have written NOTHING for the split
--   cells.  A refusal is a claim about an absence, and this file's own history is
--   that absences get asserted by not looking.
--
-- ============================================================================
-- ⚠ RUN SHAPE.  This suite cannot be run alone — `schema "test_helpers" does not
--   exist` gives a FAIL-SHAPED ABORT indistinguishable from a hold.  Correct
--   invocation: `00_setup.sql` + this file.  Expected shape `Files=2, Tests=48`
--   (47 here + `00_setup.sql`'s own one).  A shape below 48 is an ERROR, never a hold.
--
-- Assertion count: 47
-- ============================================================================
begin;
select plan(47);

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

-- ⛔ § 0.6 (the containment body no longer names the column) and § 0.7 (the five
--   affiliation-creating doors exist AND none names it) were the ONLY two cells in
--   this file that were purely about `home_organization_id`.  Both are deleted with
--   the column: their `(none)` halves are unfalsifiable once no such column exists,
--   and § 0.7's surviving half — that all FIVE doors of the family are present — is
--   already carried by `398 § 1.1`, which asserts the same family membership without
--   a dead needle attached to it.
--
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
--        FALSE (QA finding B5) — and ⭐ ADR 0168 HAS NOW MADE IT TRUE, which is
--        exactly the kind of reversal that would otherwise leave a corrected
--        comment reading as a live correction of something that no longer holds.
--        The history, kept because it is the reason the cell exists: all six person
--        doors gate solely on `app.can_administer_person_for`, which has NO
--        `platform_admin` arm by deliberate design (the ADR 0041 noun rule;
--        `384 § 6` asserts a platform admin is REFUSED). Under ADR 0164/0165 the
--        recovery path was ADR 0165 D1's widening: ANY org_admin — or, through the
--        hospital sibling, any hospital_admin — WHO HELD THE PERSON'S UUID could
--        claim them. ADR 0168 REMOVES that: the ordinary doors now require
--        `person_known_to_org`, and orphan recovery is
--        `app.recover_orphan_person_to_org_impl`, platform_admin-only, asserted in
--        `398`. ⚠ The window is therefore now "nobody but a platform_admin can reach
--        them, through one named door that says so in the audit trail".
--
--     ⭐ AND WHY IT IS REQUIRED IS THE INTERESTING PART: AN ORPHAN IS
--        SHAPE-IDENTICAL TO A LEGITIMATE ROW.  Exactly one profile has no
--        non-voided org affiliation and it is the `platform_admin` — correct by
--        design, since the outgoing rule was conditional on `is_admin`.  A
--        detector keyed on absence alone would flag it forever; one tuned to
--        ignore "no affiliation at all" would ignore exactly the shape it hunts.
--        `is_admin` is ORTHOGONAL to affiliation presence, which is what lets it
--        exclude the legitimate row without excluding a mechanism.
--        ⚠ That `is_admin` arm is ALSO why `app.tenant_orphan_profiles()` keeps its
--        own inline anchorless expression rather than calling
--        `app.person_is_anchorless`: the detector and the doors ask different
--        questions and must not be "unified".
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
-- AFFILIATION SUBSTRATE below is then the ONLY thing that distinguishes one case
-- from another, because it is the only thing either live predicate reads.
-- ⛔ W3, W5 and W7 are consequently SUBSTRATE-IDENTICAL after the column drop —
--   all three are "a profile exists, with no affiliation row of any tense".  They
--   used to differ in `home_organization_id` (A / B / NULL).  All three are KEPT:
--   § 3.11's expected set is quoted from ADR 0168 Amdt 1's own enumeration of the
--   cells that depend on the anchorless branch, and shrinking the measured set to
--   fit a smaller fixture is how a quoted list stops being a quote.  Their
--   redundancy is stated here rather than left for a later reader to rediscover.
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
-- ⭐ `expected_creation` / `measured_creation` and their companions carry the ADR 0168
--    axis.  The SAME row, the SAME actor, the SAME target — only the DOOR changes —
--    which is what makes § 3.11 a statement about the split rather than about two
--    unrelated populations.
-- ⛔ `expected_old` / `measured_old` are GONE with the column.  They held the gen-0
--    COLUMN gate, reproduced from an RLS-free snapshot; there is no longer a second
--    side to difference against, and a column that does not exist cannot be
--    reproduced.  Every remaining expectation is a claim about a LIVE predicate.
create temp table ae24_gate (
  label             text primary key,
  tier              text,
  person            uuid,
  actor             uuid,
  note              text,
  expected_new      boolean,
  expected_creation boolean,
  measured_new      boolean,
  measured_creation boolean,
  new_aff_id        uuid,
  creation_aff_id   uuid,
  code_seen         text,
  msg_seen          text,
  creation_code     text,
  creation_msg      text
);
insert into ae24_gate (label, tier, person, actor, note, expected_new, expected_creation) values
  ('W1',  'org', '00000000-0000-0000-0000-0ae2403a0001', '00000000-0000-0000-0000-0000000000b1', 'ACTIVE in A',                                   true,  true),
  ('W2',  'org', '00000000-0000-0000-0000-0ae2403a0002', '00000000-0000-0000-0000-0000000000b1', 'ENDED non-voided in A (REHIRE)',                true,  true),
  ('W3',  'org', '00000000-0000-0000-0000-0ae2403a0003', '00000000-0000-0000-0000-0000000000b1', 'NO affiliation (PERSON CREATION)',              false, true),
  ('W4',  'org', '00000000-0000-0000-0000-0ae2403a0004', '00000000-0000-0000-0000-0000000000b1', 'ACTIVE in B',                                   false, false),
  ('W5',  'org', '00000000-0000-0000-0000-0ae2403a0005', '00000000-0000-0000-0000-0000000000b1', 'NO affiliation (== W3/W7 post-drop; see fixtures)', false, true),
  ('W6',  'org', '00000000-0000-0000-0000-0ae2403a0006', '00000000-0000-0000-0000-0000000000b1', 'only a VOIDED row in B',                        false, true),
  ('W7',  'org', '00000000-0000-0000-0000-0ae2403a0007', '00000000-0000-0000-0000-0000000000b1', 'NO affiliation of any tense — the ORPHAN',      false, true),
  ('W8',  'org', '00000000-0000-0000-0000-0ae2403a0008', '00000000-0000-0000-0000-0000000000b1', 'ACTIVE in A and B (IDEMPOTENT)',                true,  true),
  ('W9',  'org', '00000000-0000-0000-0000-0ae2403a0009', '00000000-0000-0000-0000-0000000000b1', 'only ENDED non-voided in B',                    false, false),
  ('W10', 'org', '00000000-0000-0000-0000-0ae2403a000f', '00000000-0000-0000-0000-0000000000b1', 'no profile at all (existence conflation)',      false, false),
  -- HOSPITAL TIER on `hospitaladmin.a1` — org_admin of A = FALSE (§ 5.0), so the
  -- door's first arm CANNOT admit and the hospital arm is the one being taken.
  ('H1',  'hosp','00000000-0000-0000-0000-0ae2405b0001', '00000000-0000-0000-0000-0000000000e1', 'NO affiliation (CREATION), hospital_admin arm',              false, true),
  ('H2',  'hosp','00000000-0000-0000-0000-0ae2405b0002', '00000000-0000-0000-0000-0000000000e1', 'ENDED non-voided in A (D5 REHIRE), hospital_admin arm',      true,  true),
  ('H3',  'hosp','00000000-0000-0000-0000-0ae2405b0003', '00000000-0000-0000-0000-0000000000e1', 'ACTIVE in B, hospital_admin arm',                            false, false),
  ('H4',  'hosp','00000000-0000-0000-0000-0ae2405b0004', '00000000-0000-0000-0000-0000000000e1', 'NO affiliation, hospital_admin arm — ADR 0165''s cell',      false, true),
  ('H5',  'hosp','00000000-0000-0000-0000-0ae2405b0005', '00000000-0000-0000-0000-0000000000e1', 'only ENDED non-voided in B, hospital_admin arm',             false, false),
  -- …and H4's state re-run through the OTHER arm.  Keeping both is what makes the
  -- actor an axis: drop H6 and the org_admin path through this door is unmeasured;
  -- drop H4 and ADR 0165''s declared widening is unmeasured.
  ('H6',  'hosp','00000000-0000-0000-0000-0ae2405b0006', '00000000-0000-0000-0000-0000000000b1', 'NO affiliation, ORG_ADMIN arm (H4''s state, other arm)',     false, true);

-- ⛔ `ae24_declared` — the independently-written widening/narrowing list, and the
--    § 3.4 cross-check that compared it against the expectation table — IS DELETED.
--    Both artefacts described deltas AGAINST THE GEN-0 COLUMN GATE, and "widening"
--    and "narrowing" are not defined without it.  What replaces them is not a
--    smaller version of the same thing: it is `ae24_split`, which differences the
--    two LIVE doors against each other (§ 3.11) and needs no dead second side.

-- ⭐⭐ THE SPLIT ITSELF, HAND-WRITTEN.  These are the cells ADR 0168 Amdt 1 enumerates
--     as "the eight cells that depend on the anchorless branch", minus F1 (which is
--     not a `ae24_gate` row — it is § 5.5's own subject and is measured there).
--     § 3.11 asserts the MEASURED split equals this list, over BOTH tiers at once.
create temp table ae24_split (label text primary key, tier text, reason text);
insert into ae24_split values
  ('W3', 'org',  'PERSON CREATION, org tier — labelled (PERSON CREATION) since AE2.4 inc 1'),
  ('W5', 'org',  'anchorless — no affiliation row of any tense'),
  ('W6', 'org',  'anchorless because the only row is VOIDED'),
  ('W7', 'org',  'the true orphan — no row at all'),
  ('H1', 'hosp', 'PERSON CREATION, hospital tier — W3''s sibling, one tier up'),
  ('H4', 'hosp', 'anchorless through the HOSPITAL_ADMIN arm'),
  ('H6', 'hosp', 'the same state through the ORG_ADMIN arm');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated',
       x.id || '@ae24.test', now(), now()
from (select id from ae24_people union all select person from ae24_gate where label <> 'W10') x;

update public.profiles set is_active = true, full_name = 'AE24 fixture'
 where id in (select id from ae24_people union all select person from ae24_gate where label <> 'W10');

-- ⛔ THE TWO `home_organization_id` FIXTURE WRITES THAT USED TO SIT HERE ARE GONE
--   WITH THE COLUMN.  Nothing replaces them: no surviving cell needs a person to be
--   "associated with an organisation" by any means other than an
--   `organization_affiliations` row, and every case that needs one gets it below.
--   D1 and W7 keep the affiliation-less state the detector exists to find — which
--   was never the column's NULL, only ever the ABSENT ROW.

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
--   Under ADR 0164/0165 this bound carried the whole widening: any org (or
--   hospital) admin could affiliate an orphan, and that was only tolerable because
--   an orphan is in NO roster.  ⭐ ADR 0168 REMOVES the widening, so these two cells
--   are no longer load-bearing for a widening — they are now the measurement that
--   says the RECOVERY door is genuinely the only route to such a person, because
--   nothing else can even NAME them.  Both roster paths are re-measured here, each
--   with a positive control, because a zero from a door that returns nothing at all
--   would prove the opposite of what it reads.
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
--     § 2.8) and on the ACTOR axis (§ 2.5-2.7).  UNTOUCHED by ADR 0168.
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
-- § 3 THE TENANT GATE, ORG TIER — the two LIVE doors, evaluated per case against
--     each other in ONE transaction.
--
--     ⛔ THE GEN-0 COLUMN SNAPSHOT THAT USED TO SIT HERE IS GONE.  It reproduced a
--        gate that read `profiles.home_organization_id` inside a DEFINER door
--        against the row already in hand; with the column dropped there is nothing
--        to snapshot and nothing to reproduce.  § 3 is now a statement about what
--        the ORDINARY and the CREATION door do, not about what either used to.
-- ============================================================================

-- ⭐ The ACTOR comes from the ROW, not from a literal.  Hard-coding `…00b1` here
--    is what made the hospital tier's authority arm unobservable (B2): every
--    H-cell short-circuited on `is_org_admin_of_for` and the hospital arm was
--    never evaluated, so no mutation of it could move any cell.
-- ⭐ The DOOR is a parameter for the same reason the actor is: the ordinary and the
--    creation door differ ONLY in their containment predicate, so routing both
--    through one helper with one fixture is what makes § 3.11 a controlled
--    comparison rather than two loosely-related runs.
-- ⭐ The door's RETURN VALUE is captured, not discarded by `perform` (B3): 'ok|'
--    alone means only "did not raise", which a door that returns early WITHOUT
--    INSERTING also satisfies.  ⚠ `coalesce(…,'')` keeps such a door reporting
--    `measured_* = true` on purpose, so § 3.10 / § 5.8 are the ONLY assertions
--    that move — `'ok|' || null` is NULL and would red § 3.1/§ 5.1 instead,
--    pinning the regression on the wrong cell.
create or replace function pg_temp.try_gate(p_label text, p_door text)
returns text language plpgsql as $$
declare v_msg text; v_row record; v_id uuid;
begin
  select g.tier, g.person, g.actor into v_row from ae24_gate g where g.label = p_label;
  if p_door = 'ordinary' then
    if v_row.tier = 'org' then
      select app.affiliate_person_to_org_impl(
        v_row.actor, v_row.person,
        '0c000000-0000-0000-0000-00000000000a'::uuid, null) into v_id;
    else
      select app.affiliate_person_impl(
        v_row.actor, v_row.person,
        '05000000-0000-0000-0000-00000000000a'::uuid, null, null, null, null, null) into v_id;
    end if;
  else
    if v_row.tier = 'org' then
      select app.affiliate_new_person_to_org_impl(
        v_row.actor, v_row.person,
        '0c000000-0000-0000-0000-00000000000a'::uuid, null) into v_id;
    else
      select app.affiliate_new_person_impl(
        v_row.actor, v_row.person,
        '05000000-0000-0000-0000-00000000000a'::uuid, null, null, null, null, null) into v_id;
    end if;
  end if;
  return 'ok|' || coalesce(v_id::text, '');
exception when others then
  get stacked diagnostics v_msg = message_text;
  return sqlstate || '|' || v_msg;
end;
$$;

-- PASS 1 — the ORDINARY doors.
do $$
declare r record; v text;
begin
  for r in select label from ae24_gate order by tier desc, label loop
    v := pg_temp.try_gate(r.label, 'ordinary');
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

-- ⛔ THE SNAPSHOT BETWEEN THE PASSES IS THE NEGATIVE HALF OF THE DIFFERENTIAL.
--   § 3.12 / § 5.9 assert that the ORDINARY door wrote NOTHING for the split cells,
--   and they cannot be asserted after pass 2 because pass 2 is what writes those
--   rows.  Taking the measurement here — rather than trusting the refusal — is the
--   same discipline § 3.10 applies to the accepts: a refusal is a claim about an
--   absence, and absences in this file's history have been asserted by not looking.
create temp table ae24_after_ordinary as
  select g.label,
         (select count(*)::int from public.organization_affiliations oa
           where oa.principal_id = g.person
             and oa.organization_id = (select org_a from pg_temp.k())
             and oa.voided_at is null) as org_a_rows,
         (select count(*)::int from public.hospital_affiliations ha
           where ha.principal_id = g.person
             and ha.hospital_id = (select central_a from pg_temp.k())
             and ha.voided_at is null) as central_a_rows
    from ae24_gate g;

-- PASS 2 — the CREATION doors.  Same rows, same actors, same targets.
do $$
declare r record; v text;
begin
  for r in select label from ae24_gate order by tier desc, label loop
    v := pg_temp.try_gate(r.label, 'creation');
    update ae24_gate
       set measured_creation = (v like 'ok|%'),
           creation_aff_id   = case when v like 'ok|%'
                                    then nullif(split_part(v, '|', 2), '')::uuid end,
           creation_code     = split_part(v, '|', 1),
           creation_msg      = split_part(v, '|', 2)
     where label = r.label;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- § 3.0 DRAIN THE QUEUE THE TWO PASSES FILLED, AS AN ASSERTION.
--   Two reasons, and the second is the one that bites:
--     • it is a real claim — ADR 0151 D4's deferred `hospital_affiliation_has_org_trg`
--       holds for every hospital row the two passes wrote, including the ones the
--       CREATION door wrote for an anchorless person, where the org parent has to
--       have been ensured inside the same door; and
--     • § 5.5 is this file's flush non-vacuity cell, and QA finding M8 was precisely
--       that its verdict had been decided by an unrelated statement draining the
--       queue first.  Draining HERE, loudly, leaves § 5.5's queue holding F1 alone.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$set constraints all immediate;$$,
  '3.0 ⭐ the deferred queue from BOTH passes flushes clean: every hospital affiliation either pass created has an active org parent (ADR 0151 D4). ⚠ This also leaves the queue EMPTY, which is what makes § 5.5''s later flush a statement about F1 and nothing else — QA finding M8''s repair, kept working after the split doubled the number of writes');
set constraints all deferred;

select is(
  (select coalesce(string_agg(label || ':new=' || measured_new::text || '/' || expected_new::text, ' ' order by label), '')
     from ae24_gate
    where tier = 'org' and measured_new is distinct from expected_new), '',
  '3.1 ⭐ every one of the ten ORG-TIER cells matches its PRE-DECLARED ORDINARY-door expectation — the table was written from ADR 0164 and re-declared from ADR 0168 before the first behavioural run, so a match is a measurement and not a fit. ⚠ The `old=` half is gone with the column, and with it the ONLY thing in this cell that was a differential: what remains is the per-cell verdict of a live predicate, which is what the cell was mostly always doing');

select is(
  (select coalesce(string_agg(label || ':creation=' || measured_creation::text || '/' || expected_creation::text, ' ' order by label), '')
     from ae24_gate
    where tier = 'org' and measured_creation is distinct from expected_creation), '',
  '3.1b ⭐ …and every ORG-TIER cell matches its pre-declared CREATION-door expectation. ⛔ This is the half a refusal-only re-cut would have dropped: without it, "the ordinary door refuses W3" is equally consistent with "person creation moved" and with "person creation is broken", which is the two-door form ADR 0168 Amdt 1 rejects');

-- ⛔ § 3.2 / § 3.3 (the org-tier widening and narrowing aggregates, both doors
--   differenced against the gen-0 column gate) and § 3.4 (the cross-check between the
--   expectation table and the hand-written declaration list) ARE DELETED WITH THE
--   COLUMN.  Every one of them was `measured_* AND NOT measured_old`: with `old` gone
--   the direction words have no referent, and re-pointing them at the OTHER live door
--   would not restore them — it would duplicate § 3.11, which already differences the
--   two live doors and does so over BOTH tiers with both directions asserted.

select is(
  (select count(*) filter (where measured_new)::text || '|' ||
          count(*) filter (where not measured_new)::text || '|' ||
          count(*) filter (where measured_creation)::text || '|' ||
          count(*) filter (where not measured_creation)::text
     from ae24_gate where tier = 'org'),
  '3|7|7|3',
  '3.5 THE FLOOR: BOTH live predicates are genuinely mixed over the population (3/7 ordinary, 7/3 creation). Without this, 3.1/3.1b could be agreement between silently-CONSTANT predicates rather than between live ones, and § 3.11''s split could be the difference between two constants. ⚠ The gen-0 `5|5` half is gone with the column; the two surviving figures are the ones that bound the LIVE doors');

select is(
  (select coalesce(string_agg(distinct code_seen, ',' order by code_seen), '(none)')
     from ae24_gate where not measured_new), 'HC0R0',
  '3.6 ⭐ across BOTH tiers, every ORDINARY-door refusal is EXACTLY the documented HC0R0 — a door that stops raising a documented error is an API change, and a refusal arriving as another code surfaces in the UI as an unmapped raw Postgres error');

select is(
  (select coalesce(string_agg(distinct creation_code, ',' order by creation_code), '(none)')
     from ae24_gate where not measured_creation), 'HC0R0',
  '3.6b ⭐ …and so is every CREATION-door refusal. The new doors are copies of their siblings apart from one predicate, so the refusal SHAPE has to be copied too — a service_role door raising an undocumented code is a raw Postgres error surfacing in a registration flow');

select is(
  (select coalesce(string_agg(distinct m, ' / ' order by m), '(none)') from (
     select msg_seen as m from ae24_gate where not measured_new
     union
     select creation_msg from ae24_gate where not measured_creation) s),
  'pessoa não pertence a esta organização',
  '3.7 …with the pt-BR message preserved verbatim across BOTH doors and BOTH tiers, INCLUDING for W10 (no profile row at all): "not found" and "wrong organisation" stay deliberately indistinguishable, or the door becomes a cross-tenant existence oracle over profiles.id');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = '00000000-0000-0000-0000-0ae2403a0003'
      and organization_id = (select org_a from pg_temp.k())
      and ended_on is null and voided_at is null), 1,
  '3.8 ⭐⭐ NON-VACUITY OF THE PERSON-CREATION CELL: W3 — a person with NO affiliation row at all — was actually AFFILIATED, not merely "not refused". ⚠ THE WRITE IS NOW THE CREATION DOOR''S: under ADR 0168 the ordinary door refuses W3 (§ 3.1, § 3.11) and the creation door admits it, and this cell is what distinguishes "creation moved" from "creation broke". It stays a LIVE WRITE, which is the whole point of the section title');

select is(
  (select count(*) filter (where ended_on is null and voided_at is null)::text || '|' ||
          count(*) filter (where ended_on is not null and voided_at is null)::text
     from public.organization_affiliations
    where principal_id = '00000000-0000-0000-0000-0ae2403a0002'
      and organization_id = (select org_a from pg_temp.k())),
  '1|1',
  '3.9 …and ONE-STEP REHIRE still works through the ORDINARY gate: W2''s ended row is untouched and a NEW active row sits beside it (ADR 0151 D5 — no prior org_admin ticket). ⭐ This is the cell that shows the ADR 0168 narrowing did NOT collapse "known here" into "active here": a non-voided ENDED row is still known');

-- ---------------------------------------------------------------------------
-- § 3.10 WRITE-THROUGH FOR THE ORG-TIER CREATION-DOOR ADMITS.  {W3,W5,W6,W7} are
--   the cells where the CREATION door admits a state the ORDINARY door refuses — so
--   if it accepted and silently wrote nothing, no other fact in the estate
--   contradicts it, and the split would read as working while person creation was
--   dead.  ⭐ The expectation NAMES ALL FOUR LABELS.  An `= ''` over a "rows that
--   failed" filter would be satisfied by a renamed label, a dropped cell or an empty
--   table exactly as it is by success: absence would look identical to not-listed.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(label || '=' || v, ' ' order by label), '(NO CELLS)')
     from (select g.label,
                  case when g.creation_aff_id is null then 'NO-ID-RETURNED'
                       when exists (select 1 from public.organization_affiliations oa
                                     where oa.id = g.creation_aff_id
                                       and oa.principal_id = g.person
                                       and oa.organization_id = (select org_a from pg_temp.k())
                                       and oa.ended_on is null and oa.voided_at is null)
                       then 'live-org-row' else 'NO-LIVE-ROW' end as v
             from ae24_gate g where g.label in ('W3','W5','W6','W7')) t),
  'W3=live-org-row W5=live-org-row W6=live-org-row W7=live-org-row',
  '3.10 ⭐⭐ WRITE-THROUGH, org tier, CREATION door: each admit returned an id that NAMES a live, non-ended, non-voided affiliation of THAT person to org A — not merely "the door did not raise". A `return null` ahead of the insert, or an idempotency branch matching too broadly, leaves every `measured_creation` cell green and reds only here');

-- ---------------------------------------------------------------------------
-- ⭐⭐ § 3.11 THE SPLIT DIFFERENTIAL — THE ASSERTION ADR 0168 EXISTS FOR.
--   Every other cell in this file measures ONE door against the gen-0 column. This
--   one measures the two live doors against EACH OTHER, on the same rows, the same
--   actors and the same targets, and asserts the difference is EXACTLY the seven
--   `ae24_gate` cells ADR 0168 Amdt 1 enumerates (the eighth, F1, is § 5.5's).
--   ⛔ Both directions are asserted, not just one: a cell the ORDINARY door admits
--   and the CREATION door refuses would be a door that is NARROWER than the door it
--   is meant to be the permissive twin of, which no ADR declares and which would
--   silently break the registrars. That set must be EMPTY, and its emptiness is
--   anchored by the non-empty set beside it.
--   ⭐ AFTER THE COLUMN DROP THIS IS THE ONLY DIFFERENTIAL LEFT IN THE FILE, and it
--   is the one that always mattered: the deleted § 3.2/§ 3.3/§ 5.2/§ 5.3 differenced
--   each door against a gate that no longer exists, while this one differences the
--   two doors that DO.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(label, ',' order by label), '(none)')
     from ae24_gate where measured_creation and not measured_new)
  || ' // reverse:' ||
  (select coalesce(string_agg(label, ',' order by label), '(none)')
     from ae24_gate where measured_new and not measured_creation),
  (select coalesce(string_agg(label, ',' order by label), '(none)') from ae24_split)
  || ' // reverse:(none)',
  '3.11 ⭐⭐ THE SPLIT, MEASURED: exactly {H1,H4,H6,W3,W5,W6,W7} are refused by the ORDINARY door and admitted by the CREATION door — the seven `ae24_gate` cells ADR 0168 Amdt 1 names as depending on the anchorless branch (F1, the eighth, is § 5.5''s subject). And the REVERSE set is empty: the creation door is a strict superset of its ordinary sibling, never a different door wearing the name');

-- ---------------------------------------------------------------------------
-- ⛔ § 3.12 THE NEGATIVE HALF, FROM THE BETWEEN-PASSES SNAPSHOT.  A refusal is a
--   claim about an ABSENCE, and this file's own history (QA finding B3) is that the
--   presence side got asserted and the absence side got assumed. `measured_new =
--   false` says the door RAISED; it says nothing about what it had already written
--   before raising — an insert placed above the gate would leave the refusal intact
--   and the row behind.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(a.label || '=' || a.org_a_rows::text, ' ' order by a.label), '(NO CELLS)')
     from ae24_after_ordinary a join ae24_split s on s.label = a.label
    where s.tier = 'org')
  || ' | INSTRUMENT ' ||
  -- ⭐ THE POSITIVE CONTROL, IN THE SAME STRING SO IT CANNOT BE DROPPED SEPARATELY
  --   (FUP-AE2-393-ABSENCE-CELLS-NO-CONTROL, QA r3 F2). The claim above is ALL-ZERO, and
  --   all-zero is exactly what a MISAIMED COUNTER returns: `ae24_after_ordinary`'s counting
  --   subqueries are correlated on `g.person` and `pg_temp.k()`'s org, and a wrong literal
  --   in either makes every label read 0 while the cell stays green. `(NO CELLS)` does not
  --   catch it — the join still yields all four labels, each honestly reporting a count of
  --   nothing, taken from the wrong place.
  --   The anchor was already in this table and unused: the ordinary door ACCEPTED cells too,
  --   and their rows must be NON-zero. § 3.5 pins that population at 3 for this tier
  --   (`3|7|7|3`), so the magnitude below is derived from an assertion in this file rather
  --   than read off a passing run.
  --   ⛔ Ratio, not a bare count: `3/3` reds both if the counter goes blind (`0/3`) AND if
  --   a control cell is dropped (`2/2`).
  (select count(*) filter (where a.org_a_rows > 0)::text || '/' || count(*)::text
     from ae24_after_ordinary a join ae24_gate g on g.label = a.label
    where g.tier = 'org' and g.measured_new),
  'W3=0 W5=0 W6=0 W7=0 | INSTRUMENT 3/3',
  '3.12 ⛔ THE ORDINARY DOOR WROTE NOTHING for the org-tier split cells — measured from a snapshot taken BETWEEN the two passes, because pass 2 is what creates these rows. Labels are NAMED, so a dropped cell reds instead of shrinking the aggregate into agreement. ⭐ INSTRUMENT is the positive control this cell lacked: the same snapshot, read over the cells the ordinary door ACCEPTED, must be NON-zero — so a counter aimed at the wrong person or org reds here instead of confirming the absence it can no longer see');

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
  '4.1 REGRESSION CONTROL: a `hospital_admin` still performs ADR 0151 D5''s one-step rehire of an org-offboarded person THROUGH THE ORDINARY DOOR — the flow BUG-D5-REHIRE-HOSPADMIN-001 broke, and the flow ADR 0168 must NOT break (R1 has an ENDED, non-voided org-A row, so `person_known_to_org` is true). ⚠ This exercises the HOSPITAL-tier containment trigger (DEFINER since ADR 0159), NOT the trigger this increment adds; it is a control, never this suite''s keystone');
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
  '4.3 ⛔ THE MEASUREMENT THAT LICENSES § 2.5''s ACTOR: exactly ONE function writes `voided_at` on organization_affiliations and it carries NO hospital-admin arm. `authenticated` holds SELECT only on that table, so no hospital_admin can fire the new trigger by any path — the brief''s "hospital_admin containment-accept cell" HAS NO SUBJECT, and § 2.5 uses a cross-org-blind org_admin instead. ⚠ Re-derived every run over ALL of app+public, so the three doors ADR 0168 adds are inside its domain by construction rather than by an updated list');

-- ============================================================================
-- § 5 THE TENANT GATE, HOSPITAL TIER — the sibling axis, swept in the SAME
--     increment.  Measured in § 3's two passes; asserted separately so a
--     hospital-tier regression cannot hide inside an org-tier aggregate.
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
--   ⚠ It covers the CREATION door too, whose authority arms are identical by
--     construction — which is exactly why § 5.1b, § 5.8 and § 3.11 must keep H4/H6
--     paired.
-- ---------------------------------------------------------------------------
select is(
  (select 'org_a=' || app.is_org_admin_of_for((select org_a from pg_temp.k()), (select hosp_admin from pg_temp.k()))::text ||
          '|central_a=' || app.is_hospital_admin_of_for((select central_a from pg_temp.k()), (select hosp_admin from pg_temp.k()))::text ||
          '|secundario_a=' || app.is_hospital_admin_of_for((select secundario_a from pg_temp.k()), (select hosp_admin from pg_temp.k()))::text),
  'org_a=false|central_a=true|secundario_a=false',
  '5.0 ⭐⭐ THE ACTOR PIN: the H1-H5 actor holds hospital_admin on Hospital Central A, holds NO org_admin on org A, and is NOT an admin of the OTHER hospital in that same org. The door''s authority disjunction therefore can only have admitted through the HOSPITAL arm — the arm the previous fixture short-circuited past by driving both tiers with `orgadmin.a`, which made every H-cell a statement about the org arm wearing a hospital label');

select is(
  (select coalesce(string_agg(label || ':new=' || measured_new::text || '/' || expected_new::text, ' ' order by label), '')
     from ae24_gate
    where tier = 'hosp' and measured_new is distinct from expected_new), '',
  '5.1 ⭐ every HOSPITAL-TIER cell matches its pre-declared ORDINARY-door expectation. The gate is the same predicate, but the door''s authority arm is wider (org_admin OR hospital_admin), so it had to be measured through this door and not inferred from § 3');

select is(
  (select coalesce(string_agg(label || ':creation=' || measured_creation::text || '/' || expected_creation::text, ' ' order by label), '')
     from ae24_gate
    where tier = 'hosp' and measured_creation is distinct from expected_creation), '',
  '5.1b ⭐ …and every HOSPITAL-TIER cell matches its pre-declared CREATION-door expectation. ⛔ H1 is the cell that matters most here: it is W3''s sibling — `(PERSON CREATION)` at the hospital tier — and it is the one `ensureActiveAffiliation`, the hospital_admin registrar, depends on. Without this cell the hospital registrar''s replacement path is UNMEASURED and only the org one is proven');

-- ⛔ § 5.2 / § 5.3 — the hospital-tier widening and narrowing aggregates — ARE
--   DELETED for § 3.2/§ 3.3's reason: both were `measured_* AND NOT measured_old`
--   against the gen-0 column gate.  ⚠ WHAT § 5.2 CARRIED AND WHERE IT WENT: its
--   claim was "the ORDINARY hospital door widens NOTHING, and the creation door keeps
--   {H4,H6} — the same state through BOTH authority arms". The H4/H6 PAIR survives
--   intact in § 3.11 (both are in `ae24_split`), in § 5.1b (per-cell creation-door
--   verdicts) and in § 5.8 (write-through through each arm). Only the comparison
--   against the dead column is gone.

select is(
  (select count(*) filter (where measured_new)::text || '|' ||
          count(*) filter (where not measured_new)::text || '|' ||
          count(*) filter (where measured_creation)::text || '|' ||
          count(*) filter (where not measured_creation)::text
     from ae24_gate where tier = 'hosp'),
  '1|5|4|2',
  '5.4 the hospital-tier floor over BOTH live predicates, so 5.1/5.1b are agreement between live predicates and not between constants. ⚠ The ordinary door''s 1/5 is deliberately lopsided and is NOT a degenerate constant: H2 accepts and five refuse, and 5.1 pins which is which. The gen-0 `3|3` half is gone with the column');

-- ---------------------------------------------------------------------------
-- ⛔ § 5.5 CARRIES ITS OWN WRITE, AND THAT IS THE WHOLE FIX (QA finding M8).
--   It used to be a bare `set constraints all immediate` sitting 50 lines after
--   § 4.1's flush, with NO DML in between.  § 4.1 had already drained the queue,
--   so § 5.5's flush had nothing to fire and succeeded unconditionally: its
--   verdict was decided by an unrelated regression control, never by its own
--   stated subject.  § 3.0 now drains the two passes explicitly and § 4.1 drains
--   its own, so the queue reaching this line is empty and this write refills it.
--   ⭐ F1 is a FRESH person with no affiliation, so the org-parent ensure and the
--     deferred `hospital_affiliation_has_org_trg` both genuinely run; and because
--     no other cell touches F1, a mutation aimed at F1 alone moves § 5.5 alone.
--   ⚠ ADR 0168 MOVES THIS WRITE TO THE CREATION DOOR, and it had to: F1 is
--     anchorless by construction, which is precisely the state the ordinary door
--     now refuses. Rewriting F1's fixture to give it an affiliation would have kept
--     the cell green while destroying its subject — the org-parent ensure would
--     become a no-op and the deferred trigger would fire on a row whose parent
--     already existed.
--   ⚠ A `lives_ok` cannot see that its own write happened, which is the very
--     vacuity being repaired — § 5.5b is that half and the two are one assertion
--     split in two, not a control and a duplicate.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select app.affiliate_new_person_impl(
      '00000000-0000-0000-0000-0000000000e1'::uuid,
      '00000000-0000-0000-0000-0ae2405f0001'::uuid,
      '05000000-0000-0000-0000-00000000000a'::uuid, null, null, null, null, null);
    set constraints all immediate;$$,
  '5.5 ⭐ ADR 0151 D4 THROUGH THE CREATION DOOR: a hospital affiliation created for an ANCHORLESS person has an active org parent, and the DEFERRED containment trigger says so at the flush in this same statement block. ⚠ The door changed (ADR 0168) but the subject did NOT: F1 is still the only cell that constructs the fresh-person state, which is the state where the org-parent ensure is the ONLY thing standing between the write and a 23514');
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
  '5.6 non-vacuity: H2''s D5 one-step rehire actually created BOTH rows through the ORDINARY door — the org parent the hospital door ensures, and the hospital affiliation itself. Without this, 5.1''s "new=true" could be a refusal that merely failed to raise');

-- ---------------------------------------------------------------------------
-- ⛔ § 5.7 — THE SIBLING PIN — IS DROPPED OUTRIGHT, SUPERSEDED BY `399 § 3.1`.
--   It asserted, over a HAND-WRITTEN five-name list, that the two ORDINARY doors
--   carry `person_known_to_org` alone, the two CREATION doors carry both predicates
--   and the RECOVERY door carries `person_is_anchorless` alone.  `399 § 3.1` asserts
--   the same three facts but DERIVES ITS DOMAIN from the bodies that actually write
--   `organization_affiliations`, so a sixth door added under any name reds there —
--   which is precisely the failure a five-name `in (…)` list cannot see, and the
--   failure that let a door be missed once already.  `399:290-293` records the
--   supersession from the other side.  Keeping both would have left the weaker one
--   green over a domain the stronger one had already outgrown.
-- ---------------------------------------------------------------------------
-- § 5.8 WRITE-THROUGH FOR THE HOSPITAL-TIER CREATION-DOOR ADMITS.  Asserted apart
--   from § 3.10 for § 5's standing reason: a hospital-tier regression must not be
--   able to hide inside an org-tier aggregate.  ⭐ The hospital door returns the
--   HOSPITAL affiliation id, so the org PARENT it also creates is checked by
--   existence — for a person-creation cell that parent IS the effect under
--   discussion, since it is what stops them being an orphan.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(label || '=' || v, ' ' order by label), '(NO CELLS)')
     from (select g.label,
                  case when g.creation_aff_id is null then 'NO-ID-RETURNED'
                       when not exists (select 1 from public.hospital_affiliations ha
                                         where ha.id = g.creation_aff_id
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
             from ae24_gate g where g.label in ('H1','H4','H6')) t),
  'H1=live-hospital-row+org-parent H4=live-hospital-row+org-parent H6=live-hospital-row+org-parent',
  '5.8 ⭐⭐ WRITE-THROUGH, hospital tier, CREATION door: all three admits returned an id naming a live hospital affiliation of that person to Hospital Central A, AND the person now has the active org-A parent — the anchorless person really was affiliated, through the hospital_admin arm (H1, H4) and the org_admin arm (H6) alike, rather than merely "not refused"');

select is(
  (select coalesce(string_agg(a.label || '=' || a.central_a_rows::text || '/' || a.org_a_rows::text, ' ' order by a.label), '(NO CELLS)')
     from ae24_after_ordinary a join ae24_split s on s.label = a.label
    where s.tier = 'hosp')
  || ' | INSTRUMENT ' ||
  -- ⭐ THE POSITIVE CONTROL — § 3.12's, one tier up (FUP-AE2-393-ABSENCE-CELLS-NO-CONTROL).
  --   ⚠ Anchored on `central_a_rows`, the HOSPITAL counter, because that is the one this
  --   cell's left half reads first and the one a wrong `central_a` literal would blind.
  --   § 5.4 pins the accepted population at 1 for this tier (`1|5|4|2`).
  (select count(*) filter (where a.central_a_rows > 0)::text || '/' || count(*)::text
     from ae24_after_ordinary a join ae24_gate g on g.label = a.label
    where g.tier = 'hosp' and g.measured_new),
  'H1=0/0 H4=0/0 H6=0/0 | INSTRUMENT 1/1',
  '5.9 ⛔ THE ORDINARY DOOR WROTE NOTHING for the hospital-tier split cells — neither the hospital row NOR the org parent, measured from the between-passes snapshot. ⭐ The ORG-PARENT half is the one worth having: the hospital door''s D5 ensure sits ABOVE the hospital insert, so a gate accidentally placed after it would refuse the hospital row while still anchoring the person — a partial write that every refusal-code assertion in this file would report as a clean refusal. ⭐ INSTRUMENT is the positive control this cell lacked: the same snapshot over the cell the ordinary door ACCEPTED must be NON-zero, so a counter aimed at the wrong hospital reds here rather than reporting an absence it can no longer see');

select * from finish();
rollback;
