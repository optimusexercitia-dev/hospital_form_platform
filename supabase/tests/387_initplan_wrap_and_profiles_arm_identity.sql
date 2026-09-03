-- AE1.5 (docs/plans/authz-evolution.md § AE1.5, ADR 0155 D9) — the keystone for
-- the initplan wrap (migration 20261003004710).  A second migration,
-- 20261003004700, was written and WITHDRAWN; see Claim 2 below, which is the
-- more useful half of this file's record.
-- Triage record: docs/design/authz-ae1-initplan-triage.md
--
-- ============================================================================
-- WHAT THIS SUITE HAS TO PROVE, AND WHY IT IS SPLIT THE WAY IT IS
-- ============================================================================
-- AE1.5 ships ONE claim, and this file's design is mostly about the SECOND one
-- it does NOT ship:
--
--   Claim 1 — SHIPPED.  Every `auth.uid()` in the hot subset (52 policies) is
--             now hoisted to an InitPlan, and the predicate is otherwise
--             untouched.  Migration 20261003004710.
--
--   Claim 2 — ⛔ PROPOSED, MEASURED, AND WITHDRAWN 2026-08-27 (PO-ruled).
--             Migration 20261003004700 would have removed four VERBATIM-
--             duplicated arms from `profiles_admin_select`.  It was identity —
--             the per-persona md5s in §B were bit-identical with it applied —
--             and it was still withdrawn, for two reasons worth carrying:
--
--             (a) The benefit did not exist.  AE0's F-AE0-6 attributed a "~4x
--                 cost, today" to the duplication.  Measured: the three
--                 duplicate SubPlans read `never executed` in the BEFORE plan
--                 (short-circuited by earlier OR arms), executed work was
--                 IDENTICAL on both sides, buffers moved 652 -> 650, and wall
--                 time did not move.  The real 4x is `SubPlan 3` at `loops=14`
--                 — arm 3, NOT a duplicate, which survives either way.
--                 ⭐ A plan node that EXISTS is not a plan node that RUNS.
--
--             (b) The duplication was load-bearing — for DETECTION, not for
--                 authorization.  `371_offboarded_person_visibility.sql` §5
--                 pins the affiliation leg in EACH profiles policy BY NAME,
--                 because both are permissive and OR'd, so widening either one
--                 alone makes every ALLOW arm pass — §5 is the only thing that
--                 can tell a fully-applied migration from a half-applied one.
--                 ⭐ An edit can be perfectly behaviour-preserving and still
--                 destroy the instrument that proves behaviour was preserved.
--
--             ⛔ Do not "restore" 004700 as an optimisation without re-reading
--             371's §5 header first.  The identity argument for it is correct
--             and is not the issue.
--
-- §A  FIX DETECTORS — RED before the migration, and that was OBSERVED, not
--     assumed: A1 read 52, A2 read `(id = auth.uid())`, D2 read 113.  A keystone
--     that is green on its first run is vacuous
--     (docs/progress/authz-handoff.md § 7.1).
--
-- §B  BEHAVIOUR IDENTITY — the per-persona set of `profiles.id` a principal can
--     actually SEE, pinned as an md5 captured from the live catalog BEFORE the
--     migrations.
--     ⚠ IT STANDS ALONE, and a qual-text pin (§C) is NEVER a substitute: the
--     text is not the behaviour, and pinning the text instead of the rows is the
--     wrong-grain trap wearing a test's clothes.
--     ⚠ STATED, NOT HIDDEN: §B is GREEN BEFORE the migration too, by design.
--     It is a REGRESSION INVARIANT, not a fix detector.  §D1 proves it is
--     capable of failing; without §D1 a green §B would be indistinguishable from
--     an instrument that cannot move.
--     ⭐ These pins were what proved the WITHDRAWN 004700 was identity — the
--     reason it was withdrawn was never that they moved.  They are kept because
--     the wrap touches `profiles_update_self`, and because they are the cheapest
--     standing guard on profiles read visibility this repo has.
--
-- §C  QUAL-TEXT IDENTITY — the SECOND assertion for claim 1, never the only
--     one.  Un-wraps `( SELECT auth.x() AS x)` back to `auth.x()` across every
--     policy on the hot tables and pins the aggregate md5.  If the substitution
--     was the only edit this md5 is unchanged by construction; if any predicate
--     was restructured — an arm added, dropped, reordered, a column renamed —
--     it moves.
--
-- §D  VACUITY CONTROLS — every detector above is shown able to FAIL.
--
-- ============================================================================
-- ⚠ EVERY PERSONA BELOW PASSES ITS HAT EXPLICITLY.  `claims_for(user, admin)`
--    DERIVES `active_role` and mints it only when the principal holds exactly
--    ONE live role — so a persona who later gains a second membership silently
--    loses its hat, every `app.is_*_of()` returns false, and the assertion then
--    measures the SELF-ONLY arm while still passing.  That is not theoretical:
--    `orgadmin.b@test.local` (…b2) already holds {org_admin, staff_admin}, so
--    `claims_for('…b2', false)` mints NO hat at all.  Measured 2026-08-27 while
--    capturing these pins — B6 would have pinned the wrong arm.
--    A derived hat is a fixture whose arm can change when seed data changes,
--    with nothing able to notice.  Pass it explicitly, always.
--
-- ⛔ NOT ASSERTED HERE, stated rather than faked: this suite proves nothing
--    about PLAN SHAPE.  Whether the wrap actually produced an InitPlan is an
--    EXPLAIN question; the before/after plan diffs are the acceptance evidence
--    for that, recorded in the triage doc § 6.  A pgTAP suite claiming to prove
--    hoisting would be claiming more than it can see.
-- ============================================================================

begin;
select plan(25);

-- ---------------------------------------------------------------------------
-- The three instruments, defined once so §A, §C and §D provably share them.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.ae15_hot_subset()
returns table (tablename name, policyname name, qual text, with_check text)
language sql stable as $$
  select p.tablename, p.policyname, p.qual, p.with_check
    from pg_policies p
   where p.schemaname = 'public'
     and (
          p.tablename like 'case\_%'
       or p.tablename in ('responses', 'answers', 'response_group_instances',
                          'response_section_signoffs')
       or p.tablename in ('meeting_cases', 'meeting_signatures')
       or p.tablename in ('profiles', 'professional_credentials',
                          'professional_profiles', 'professional_participants')
       or p.tablename in ('form_items', 'form_sections', 'form_versions')
       or p.tablename in ('commission_administrativos',
                          'commission_administrativo_capabilities')
     );
$$;

-- The advisor-equivalent detector.  Proven byte-identical to Supabase's
-- `auth_rls_initplan` list (113 vs 113, EMPTY diff) — triage doc § 1.
create or replace function pg_temp.ae15_is_flagged(p_expr text)
returns boolean
language sql immutable as $$
  select coalesce(p_expr, '') ~ '(?<!SELECT )auth\.(uid|jwt|role|email)\(\)';
$$;

-- The un-wrap normalizer: turns the post-migration form back into the
-- pre-migration form.  If the substitution was the ONLY edit, this is exact.
create or replace function pg_temp.ae15_unwrap(p_expr text)
returns text
language sql immutable as $$
  select regexp_replace(coalesce(p_expr, '<null>'),
                        '\( SELECT auth\.(uid|jwt|role|email)\(\) AS \w+\)',
                        'auth.\1()', 'g');
$$;


-- ===========================================================================
-- §A  FIX DETECTORS — observed RED before 20261003004700 / 20261003004710
-- ===========================================================================

select is(
  (select count(*)::int from pg_temp.ae15_hot_subset()
    where pg_temp.ae15_is_flagged(coalesce(qual,'') || ' ' || coalesce(with_check,''))),
  0,
  'A1 no policy in the AE1.5 hot subset carries an unwrapped auth.*() call (read 52 before the migration)');

-- A2 — the ONE `profiles` policy AE1.5 actually rewrites.  (The withdrawn 004700
--      would have rewritten `profiles_admin_select`; that policy is now asserted
--      UNCHANGED, by 371 §5.1/§5.2 per-policy and by A3/A4 below.)
select is(
  (select qual from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_update_self'),
  '(id = ( SELECT auth.uid() AS uid))',
  'A2 profiles_update_self -- the only profiles policy in the hot subset -- now carries the hoisted form (it read `(id = auth.uid())` before the migration)');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'),
  2,
  'A3 profiles still has exactly TWO permissive SELECT policies -- the arm removal narrowed one, it did not merge or drop either');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
      and permissive = 'PERMISSIVE' and roles::text = '{authenticated}'),
  2,
  'A4 both remain PERMISSIVE / {authenticated}, so their disjunction is still closed within SELECT -- this is what makes A2 identity rather than merely plausible');


-- ===========================================================================
-- §B  BEHAVIOUR IDENTITY — the primary assertion, and it stands alone.
--     Pins captured from the live catalog on a FRESH `db reset` at head
--     20261003004620 -- i.e. with AE1.1's and AE1.3's migrations applied and
--     AE1.5's two held aside, so the ONLY delta between the pinned state and
--     the asserted state is this phase's own change.  Row counts are quoted so
--     a reader can judge how much each pin is worth.
-- ===========================================================================

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  'cded5a2d2aa30200459df9b1cf79fad8',
  'B1 hospital_admin (hospitaladmin.a1, 23 rows) sees the IDENTICAL set of profiles.id -- ⭐ the arm that FALLS THROUGH the whole disjunction, i.e. the one the removal could actually have broken');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false, 'org_admin');
set local role authenticated;
select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  '7954b32056d1c7103f45a8fa4dab6e81',
  'B2 org_admin (orgadmin.a, 29 rows) sees the IDENTICAL set of profiles.id');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0', true, 'platform_admin');
set local role authenticated;
select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  '8890048e7c71c8bc3f5f6fd36e94ba24',
  'B3 ⭐ platform_admin (36 rows = all) sees the IDENTICAL set -- app.is_admin() is the ONE arm KEPT in profiles_admin_select, so this is the persona the edit could most plausibly break, and AE0.2''s control set has no platform_admin arm at all');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002', false, 'staff_admin');
set local role authenticated;
select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  '17d08eadd7e1d99df2dbd88f3ad5ffd5',
  'B4 staff_admin (chefe.ccih, 10 rows) sees the IDENTICAL set of profiles.id');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003', false, 'staff');
set local role authenticated;
select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  '17d08eadd7e1d99df2dbd88f3ad5ffd5',
  'B5 staff (staff1.ccih, 10 rows) sees the IDENTICAL set of profiles.id');

-- ⚠ …b2 holds TWO live roles, so the hat MUST be passed explicitly here or
--    claims_for mints none and this measures the self-only arm.  See the header.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b2', false, 'org_admin');
set local role authenticated;
select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  '4acaab502f5a639f29a4e30a7c1b33f2',
  'B6 a DIFFERENT-org org_admin (orgadmin.b, 5 rows) sees the IDENTICAL set -- the negative direction: the edit did not WIDEN anyone either');

-- The wrap migration rewrites read policies on these tables too.  Arm-matched
-- by construction: one fixed persona, the same one before and after (F-AE0-8).
--
-- ⛔ WHY THESE FOUR ARE NOT ALL id-md5 PINS, unlike B1-B6.
--    `profiles` ids are seed LITERALS (36 of 36 match the `00000000-…` pattern),
--    so an id-set md5 there is reset-stable — measured across two consecutive
--    `db reset` runs, identical both times.  `case_events`, `responses` and
--    `answers` ids are `gen_random_uuid()` AT SEED TIME: their md5s changed
--    between two resets while the row COUNTS held (1 / 7 / 26 both times).
--    An id-md5 pin on those would red on every reset forever, and it would red
--    looking exactly like a real regression.  Caught here while re-capturing
--    pins after reset #1 — the pins from the provisional capture were already
--    stale.  `case_referral` ids ARE literals (`efa00000-…`), verified, so it
--    keeps the stronger md5 form.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002', false, 'staff_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.case_events),
  1,
  'B7 case_events -- 7 rewritten policies, the most of any table -- still reads 1 row for staff_admin. ⚠ WEAK BY CONSTRUCTION: the fixture holds exactly 1 row TOTAL (see B11), so this is a presence check and CANNOT demonstrate selectivity');

select is(
  (select count(*)::int from public.responses),
  7,
  'B8 responses: staff_admin still reads 7 of the 13 rows in the table -- a genuine differential, so the count is filtered, not merely non-zero');

select is(
  (select count(*)::int from public.answers),
  26,
  'B9 answers: staff_admin still reads 26 of the 50 rows in the table -- the thickest differential in this suite');

select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.case_referral),
  '7bf430be328f500f801de50dda4a1ff7',
  'B10 case_referral (3 of 4 rows, 4 rewritten policies) reads the IDENTICAL id set -- seed ids are literals here, so this keeps the stronger set-identity form');

reset role;

-- B11 — the differential the four above are measured against, stated as data
--       rather than left in a comment.  Without it, "staff_admin sees 26" is
--       consistent with RLS filtering nothing at all.
select is(
  (select array[(select count(*) from public.case_events),
                (select count(*) from public.responses),
                (select count(*) from public.answers),
                (select count(*) from public.case_referral)]::int[]),
  array[1, 13, 50, 4]::int[],
  'B11 ⭐ the RLS-BYPASSED totals are 1 / 13 / 50 / 4 -- so B8 (7<13), B9 (26<50) and B10 (3<4) are real differentials, and B7 (1 of 1) demonstrably is NOT. The weakness is measured here instead of being unstated');


-- ===========================================================================
-- §C  QUAL-TEXT IDENTITY — the SECOND assertion for the wrap, never the only.
-- ===========================================================================

-- ⚠ NO policy is excluded from C1.  An earlier draft excluded
--    `profiles_admin_select`, because migration 004700 changed it on purpose and
--    an identity hash cannot cover a deliberate change.  004700 was withdrawn,
--    so the exclusion went with it -- and its removal MATTERS: the pin now
--    covers all 99 policies on the hot tables, which is exactly the claim AE1.5
--    is left making ("the wrap changed no predicate, anywhere on these tables").
--    ⛔ Re-introducing an exclusion is how an identity assertion decays into a
--    snapshot of whatever the migration happened to produce.
select is(
  (select md5(string_agg(h, '' order by h)) from (
     select md5(tablename || '|' || policyname || '|' ||
                pg_temp.ae15_unwrap(qual) || '|' ||
                pg_temp.ae15_unwrap(with_check)) as h
       from pg_temp.ae15_hot_subset()) s),
  -- ⭐ RE-CAPTURED 2026-08-27 by AE2.2 (migration 20261003005400), from
  --    7522eb73b2d4a6c257d3d7934711deec.  This pin is an IDENTITY assertion over
  --    predicate TEXT, and AE2.2 deliberately changed the text of three of these
  --    99 policies: the org-admin leg of `profiles_admin_select`,
  --    `profiles_select_self_or_admin` and `professional_credentials_select`
  --    moved off `profiles.home_organization_id` onto
  --    `app.can_administer_person_via_affiliation(...)` (ADR 0163 / 0155 D3).
  --    A deliberate predicate change is the ONE thing this pin cannot absorb, so
  --    the constant moves with it.
  --    ⚠ WHAT MAKES THAT SAFE IS NOT THIS COMMENT.  § B's per-persona
  --    BEHAVIOUR md5s (B1-B6) were re-run against the migration and did NOT
  --    move -- including B2/B6, the two org_admin personas whose visibility is
  --    dominated by the leg that changed.  Identical rows, different text, which
  --    is exactly the claim AE2.2 makes.  ⛔ Never re-capture this constant
  --    without that check: on its own it degenerates into a snapshot of whatever
  --    the last migration produced.
  --    ⭐ RE-CAPTURED 2026-09-02 by AE4.9 D6 (migration 20261003007300), from
  --    a115005b6106573c70d98a6aceb8a4fe.  D6 re-keys the `commission.forms.edit` write
  --    policies onto the layer-3 authorizer `app.can_edit_commission_forms`, and THREE of
  --    its four sites are on hot tables: `form_versions_staff_admin_write`,
  --    `form_sections_staff_admin_write`, `form_items_staff_admin_write`.  (`forms` is the
  --    fourth site and is NOT in the hot subset, which is why C2 stays 99 and only three
  --    entries move.)
  --    ⚠ WHAT MAKES THIS RE-CAPTURE SAFE IS NOT THIS COMMENT, AND NOT §B EITHER.  The pin
  --    was re-derived by INVERTING the change rather than by reading the new value off the
  --    catalog: in a rolled-back transaction the three policies were ALTERed back to their
  --    pre-D6 two-arm text (`is_staff_admin_of` OR `is_tenancy_admin_of`, in each policy's
  --    own arm order -- ⛔ `form_versions` lists the TENANCY arm FIRST, the other two list
  --    it second, and getting that order wrong moves the md5 exactly like a real
  --    regression), and the aggregate came back to a115005b6106573c70d98a6aceb8a4fe
  --    EXACTLY.  A 128-bit return is what licenses the claim that the other 96 policies are
  --    bit-identical and that D6 moved only what it declared.  ⛔ Re-capturing by pasting a
  --    freshly measured value proves nothing at all; invert the change or leave the pin red.
  --    ⚠ §B IS ARM-BLIND FOR THIS CHANGE, stated because a green §B could be mistaken for
  --    the corroboration AE2.2's note demands.  B1-B11 were re-run and did NOT move -- but
  --    §B pins `profiles`, `case_events`, `responses`, `answers`, `case_referral`, and D6
  --    touched NONE of those.  For AE2.2 §B was the right instrument because the changed leg
  --    was a `profiles` leg; here it is merely silent.  The behavioural cover for D6's three
  --    policies is `409` §2 (a WRITE, not a SELECT -- each of these tables also carries a
  --    permissive `*_select` policy a staff_admin passes, so a row-count probe would stay
  --    green with the write policy revoked entirely).
  --    ⛔ AND C1'S REACH NARROWED HERE, WHICH THE NEW VALUE HIDES.  Before D6 the two arms
  --    of each write policy were IN the predicate text, so C1 could see one added, dropped
  --    or reordered.  They now live inside `app.can_edit_commission_forms`'s BODY, where a
  --    policy-text hash cannot follow them: C1 would not move if the tenancy arm were
  --    deleted from that function tomorrow.  That gap is covered by `409` §2.2 (the
  --    authorizer names BOTH arms) and §2.1 (all four policies call it in BOTH halves).
  --    ⭐ Losing reach is not the same as losing the subject -- but it is exactly the kind of
  --    loss a re-captured constant makes invisible, so it is written down beside the value.
  --    ⭐ RE-CAPTURED 2026-09-03 by AE4/IA-F9's statement-scoped increment (migration
  --    20261003007320, ADR 0182), from 3901715193753db33f980f939c6467de.  ONE policy moved:
  --    `professional_profiles_select`, whose USING went from the bare
  --    `app.can_read_professional_profile(id, auth.uid())` to a CASE that tests the row's
  --    organization against `app.current_professional_read_organizations()` FIRST and falls
  --    back to that same authorizer for every other arm.
  --    ⚠ RE-DERIVED BY INVERSION, per the AE2.2/D6 rule directly above -- not read off the
  --    catalog.  In a rolled-back transaction the policy was ALTERed back to its pre-7320
  --    text and the aggregate returned 3901715193753db33f980f939c6467de EXACTLY, which is
  --    what licenses the claim that the other 98 policies are bit-identical and that 7320
  --    moved only what it declared.
  --    ⛔ AND C1 IS ARM-BLIND TO THIS CHANGE TOO, in the same way D6's note records.  The
  --    new predicate's first arm is a set-membership test whose CONTENT lives inside
  --    `app.current_professional_read_organizations` -> `authz.authorized_scope_ids`, where a
  --    policy-text hash cannot follow it: C1 would not move if that resolver started
  --    returning every organization tomorrow.  ⭐ The behavioural cover is `413` -- §2's
  --    differential against `authz.has_permission`, §4's base-table reads as `authenticated`,
  --    and §5's SUBSET invariant -- plus `413` §7, which plants exactly that over-broad body
  --    and requires the differential to go RED.  §B is silent here for D6's reason:
  --    `professional_profiles` is not one of its five pinned tables.
  'f2a0693be216cfe08eb6cf0283565e7c',
  'C1 un-wrapping every policy on the hot tables reproduces the pinned predicate set exactly -- no arm added, dropped or reordered beyond the three legs AE2.2 re-predicated and the three form-write policies AE4.9 D6 re-keyed, both on purpose');

select is(
  (select count(*)::int from pg_temp.ae15_hot_subset()),
  99,
  'C2 the hot tables still carry the same NUMBER of policies -- C1''s aggregate md5 would also match if policies had been DELETED, so cardinality is asserted separately');


-- ===========================================================================
-- §D  VACUITY CONTROLS — each detector shown able to FAIL.
-- ===========================================================================

-- D1 — the §B instrument is LIVE.  Add a restrictive deny-all policy,
--      re-measure, prove the md5 MOVES, then remove it.  Without this, a green
--      §B is indistinguishable from an md5 that cannot change.
create policy ae15_vacuity_probe on public.profiles
  as restrictive for select to authenticated using (false);

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select isnt(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  'cded5a2d2aa30200459df9b1cf79fad8',
  'D1a ⭐ VACUITY CONTROL: with a live restrictive deny-all policy the hospital_admin md5 MOVES -- B1 is measuring the visible row set, not a constant');
reset role;

drop policy ae15_vacuity_probe on public.profiles;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select is(
  (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.profiles),
  'cded5a2d2aa30200459df9b1cf79fad8',
  'D1b the probe RESTORED the original md5 -- the control moved the value and put it back, so D1a''s failure was the probe and not drift');
reset role;

-- D2 — the §A regex matches SOMETHING.  A1 reporting 0 is only meaningful if
--      the same detector is not silently matching nothing everywhere.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and pg_temp.ae15_is_flagged(coalesce(qual,'') || ' ' || coalesce(with_check,''))),
  61,
  'D2 ⭐ VACUITY CONTROL: the SAME detector still finds the 61 policies AE1.5 deliberately left (113 - 52) -- so A1''s zero is a fixed subset, not a regex that matches nothing');

select ok(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename in ('rca', 'capa_plan', 'ethics_findings')
      and pg_temp.ae15_is_flagged(coalesce(qual,'') || ' ' || coalesce(with_check,''))) >= 3,
  'D2b and it finds them BY NAME in the left-alone families (rca / capa_plan / ethics_findings), not merely by count');

-- D3 — the §C normalizer distinguishes a CHANGED predicate from a wrapped one.
select is(
  pg_temp.ae15_unwrap('(app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))'),
  '(app.can_read_case(case_id, auth.uid()))',
  'D3a the normalizer un-wraps the post-migration form back to the pre-migration form exactly');

select isnt(
  pg_temp.ae15_unwrap('(app.can_read_case(case_id, ( SELECT auth.uid() AS uid)) OR true)'),
  '(app.can_read_case(case_id, auth.uid()))',
  'D3b ⭐ VACUITY CONTROL: an EXTRA arm survives normalization and stays visible -- C1 would red on a widened predicate, it does not normalize the difference away');

select isnt(
  pg_temp.ae15_unwrap('(app.can_read_case(other_id, ( SELECT auth.uid() AS uid)))'),
  '(app.can_read_case(case_id, auth.uid()))',
  'D3c and a CHANGED column survives normalization too -- the D11 stranded-predicate class would be caught, not smoothed over');

-- D4 — the structural backstop, asserted rather than trusted.
select is(
  (select count(*)::int from pg_temp.ae15_hot_subset() h
     join pg_policies p on p.schemaname = 'public'
      and p.tablename = h.tablename and p.policyname = h.policyname
    where p.permissive <> 'PERMISSIVE'),
  0,
  'D4 every policy on the hot tables is still PERMISSIVE -- ALTER POLICY cannot change this, and this asserts the migration used nothing else');

select * from finish();
rollback;
