-- 426 — AE5 increment 1, T6: the CONSTRUCTED differential for `staff`'s single-role wrapper.
--
-- ADR 0211 D2 part 2 and part 3. Owner: backend (the tester owns `424` / `425`, A4).
--
-- ⛔⛔ WHY THIS SUITE IS "CONSTRUCTED" AND NOT A CANDIDATE DIFFERENTIAL. The permission plane has a
-- candidate evaluator (`authz.candidate_has_permission`, which also admits `test_validation`); the
-- ROLE plane has none — measured, `authz` holds ten functions and not one is a candidate twin of
-- `holds_role`, whose body requires `r.state = 'authoritative'`. So the wrapper cannot be
-- differentialled BEFORE its own cutover, and this suite runs AFTER the flip in the migration
-- chain. What it compares is the wrapper against the LEGACY PREDICATE RESTRICTED TO `staff` ROWS.
--
-- ⛔ THE RESTRICTION IS THE WHOLE CONTENT. `app.has_role_any('commission', C, u)` is a role-SET
-- predicate: it is satisfied by a `staff_admin` row as readily as by a `staff` one. An UNRESTRICTED
-- comparison against a single-role wrapper reports every `staff_admin`-only membership as a
-- divergence — and the cheapest way to make that green is to loosen the expected value, which is
-- exactly how a set predicate gets silently substituted for a single-role one. § 1 asserts the
-- unrestricted comparison DOES disagree, so the restriction is shown to be load-bearing rather
-- than asserted to be.
--
-- ⚠ STATED BOUND, inherited from ADR 0211 D2 part 2: this proves the wrapper agrees with the legacy
-- predicate's `staff` SLICE. It does ⛔ NOT prove anything about `holds_role` under
-- `test_validation` — it cannot, because `holds_role` refuses that state by design.
--
-- ⭐ WHERE `is_active` SITS IS DIFFERENT ON THE TWO SIDES, AND THE RESTRICTED PREDICATE MUST SAY SO
-- (condition A2). Measured on the live catalog:
--     app.has_role_any        does NOT call app.is_active
--     app.is_member_of        DOES  — at the WRAPPER level
--     authz.holds_role        does NOT call app.is_active
--     authz.assignment_facts  DOES  — at the FACTS level
-- Both sides therefore apply it and the ANSWERS agree; the LEVELS differ. ⛔ That is why the
-- restricted legacy expression below spells out `app.is_active(u) and …` instead of calling
-- `has_role_any` alone: without it the two sides would be unequal by construction on every
-- inactive principal, and the natural "fix" would be to drop the is_active cells — deleting the
-- coverage A2 exists to add. ⚠ It also means a future change to `has_role_any` ALONE would not
-- move the wrapper, so the two are not one predicate wearing two names.

begin;
select plan(37);

-- ---------------------------------------------------------------------------
-- FIXTURE — every principal is a `staff` of CCIH and nothing else in that scope.
-- ⛔ Named, never derived by a filter: a filter that silently matched zero rows would make every
-- assertion below vacuous, and `count(*) = 0` reads identically to "they all agreed".
-- ---------------------------------------------------------------------------
create temp table f426 on commit drop as
select
  'a0000000-0000-0000-0000-0000000000a1'::uuid as ccih,
  'b0000000-0000-0000-0000-0000000000b1'::uuid as farm,          -- sibling, same org
  'c0000000-0000-0000-0000-0000000000c2'::uuid as farmb,         -- another org
  '00000000-0000-0000-0000-00000000000a'::uuid as st_active,     -- staff4.ccih   — clean, active
  '00000000-0000-0000-0000-0000000000d3'::uuid as st_suspended,  -- suspenso.temp — suspended
  'a5f00000-0000-0000-0000-0000000000e3'::uuid as st_pending,    -- gap.pending   — unconfirmed
  'a5f00000-0000-0000-0000-0000000000e4'::uuid as st_deactivated,-- gap.deactivated
  '00000000-0000-0000-0000-000000000002'::uuid as sa_only,       -- chefe.ccih — staff_admin, NOT staff
  -- ⭐ THE ONLY PRINCIPAL FOR WHICH "NO HAT" IS CONSTRUCTIBLE. `test_helpers.claims_for`
  -- MINTS a hat implicitly when the principal holds exactly ONE role type, so for every
  -- single-role persona `active_role()` comes back non-null and the `absent` arm silently
  -- measures a MATCHING hat instead. `staff1.qual.b` holds `staff` at Qualidade B AND
  -- `staff_admin` at Farmácia B, so the mint does not fire (measured: uid set, hat NULL).
  '00000000-0000-0000-0000-0000000000b3'::uuid as dual_hat,      -- staff + staff_admin
  'c0000000-0000-0000-0000-0000000000c1'::uuid as dual_cid;      -- ...their `staff` commission

-- ⛔ THE FIXTURE MUST BE READABLE BY THE ROLE THE ASSERTIONS RUN AS. §§ 4–5 read `f426` INLINE
-- while `set local role service_role` is in force, and a temp table is owned by the session role,
-- so without this the suite dies at the first such cell with `permission denied for table f426` —
-- observed exactly that on the first post-cutover run. ⚠ `424` does not need it because it reads
-- its fixture inside a plpgsql function, which runs as the owner; the difference is the read SITE,
-- not the table. Granting it does not weaken any assertion: `f426` holds only literal ids that are
-- already public knowledge in this suite's own source.
grant select on f426 to service_role;

-- The restricted legacy predicate, as a function so both sides are written once.
-- ⛔ `m.role = 'staff'` is the restriction; `app.is_active` is the level-matching conjunct above.
create or replace function pg_temp.legacy_staff_at(p_commission uuid, p_uid uuid)
returns boolean language sql stable as $$
  select app.is_active(p_uid) and exists (
    select 1 from public.memberships m
     where m.principal_id = p_uid
       and m.commission_id = p_commission
       and m.role = 'staff'
       and (m.expires_at is null or m.expires_at > now())
  );
$$;
-- ⛔ Same reason as the `f426` grant above, and it is the SECOND half of the same mistake: the
-- comparison cells call this helper INSIDE `set local role service_role`, and a `pg_temp` function
-- is owned by the session role like the temp table is. Measured: without it the suite dies at
-- § 4.3 with `permission denied for function legacy_staff_at`. ⚠ Granting a helper EXECUTE does not
-- widen what it can see — it is `stable` and reads `public.memberships`, which RLS still governs
-- for whatever role calls it.
grant execute on function pg_temp.legacy_staff_at(uuid, uuid) to service_role;

-- ===========================================================================
-- § 0  FIXTURE CONTROLS — the population is non-empty and is what it claims.
-- ===========================================================================
select is((select count(*)::int from public.memberships m, f426 f
            where m.commission_id = f.ccih and m.role = 'staff'
              and m.principal_id in (f.st_active, f.st_suspended, f.st_pending, f.st_deactivated)),
          4,
  '0.1 FIXTURE CONTROL: all four principalState principals hold a `staff` membership at CCIH. '
  '⛔ Without this every § 3 cell could agree by both sides returning false for the ABSENCE OF A '
  'GRANT — the shape measured at r1, where the pending persona scored DENIED for the wrong reason.');

select is((select count(*)::int from public.memberships m, f426 f
            where m.commission_id = f.ccih and m.principal_id = f.sa_only and m.role = 'staff_admin'),
          1,
  '0.2 FIXTURE CONTROL: the set-predicate probe is a `staff_admin` of CCIH who is NOT a `staff` '
  'there — `memberships_one_commission_role_uq` makes holding both impossible, which is what makes '
  'this persona the right instrument for § 1.');

select is((select state::text from authz.roles where code = 'staff'), 'authoritative',
  '0.3 FIXTURE CONTROL: `staff` is `authoritative`. ⛔ `authz.holds_role` refuses a '
  'non-authoritative role, so before the cutover EVERY wrapper cell below would be false and the '
  'whole suite would agree with a restricted predicate that is also false — two wrongs reading as '
  'a green. This assertion is what stops 426 passing on a catalog where nothing happened.');

-- ===========================================================================
-- § 1  THE RESTRICTION IS LOAD-BEARING — shown, not asserted.
-- ===========================================================================
select is(app.is_member_of_for((select ccih from f426), (select sa_only from f426)), true,
  '1.1 the UNRESTRICTED legacy predicate says TRUE for a `staff_admin`-only principal — because it '
  'is a role-SET predicate.');

select is(app.is_commission_staff_of_for((select ccih from f426), (select sa_only from f426)), false,
  '1.2 ⭐ and the WRAPPER says FALSE for the same principal. ⛔ THIS PAIR IS WHY THE COMPARISON IS '
  'RESTRICTED: run unrestricted, every `staff_admin`-only membership would read as a divergence, '
  'and the cheapest green would be to loosen the expected value — which is how a set predicate '
  'gets silently substituted for a single-role one.');

select is(pg_temp.legacy_staff_at((select ccih from f426), (select sa_only from f426)), false,
  '1.3 the RESTRICTED legacy predicate agrees with the wrapper on that principal. § 1.1 vs § 1.3 '
  'is the measurement that the restriction changes the answer; without it § 2–§ 4 compare two '
  'predicates that were never in tension.');

-- ===========================================================================
-- § 2  AGREEMENT OVER EVERY SEEDED PRINCIPAL × EVERY COMMISSION (D2 part 2).
-- ===========================================================================
select is(
  (select count(*)::int
     from public.profiles p cross join public.commissions c
    where pg_temp.legacy_staff_at(c.id, p.id) is distinct from app.is_commission_staff_of_for(c.id, p.id)),
  0,
  '2.1 ⭐ THE DIFFERENTIAL: over EVERY seeded principal × EVERY commission, the restricted legacy '
  'predicate and the wrapper return the same answer. ⛔ A cross product, not a sample: a sampled '
  'set cannot distinguish "they agree" from "the sample missed the disagreement".');

select isnt((select count(*)::int from public.profiles p cross join public.commissions c), 0,
  '2.2 ⭐ CARDINALITY CONTROL for § 2.1, and § 2.1 is worth nothing without it. An empty cross '
  'product makes a `count(*) = 0` difference trivially true — the vacuous shape this tree gates '
  'against. ⛔ Never fold this into § 2.1: one assertion cannot both range over a population and '
  'prove the population exists.');

select isnt(
  (select count(*)::int from public.profiles p cross join public.commissions c
    where app.is_commission_staff_of_for(c.id, p.id)),
  0,
  '2.3 ⭐ POLARITY CONTROL: the wrapper says TRUE somewhere in that cross product. Without it a '
  'wrapper stuck on FALSE agrees with a restricted predicate that found nobody, and § 2.1 is green '
  'on two dead instruments.');

-- ===========================================================================
-- § 3  A2 — PRINCIPAL STATE, BY NAMED CELLS.
--
-- ⛔ Four states, four NAMED principals, and the agreement asserted on each. A `count(*) = 0` over
-- the whole population (§ 2.1) would pass even if every inactive principal were missing from the
-- fixture, because absent rows agree about nothing. These cells are what make § 2.1's zero mean
-- "they agree on the states that matter" rather than "the states that matter were not present".
-- ⭐ Each cell asserts BOTH sides' value, not merely that they match: a matching pair of wrong
-- answers is the failure a differential is least able to see.
-- ===========================================================================
select is(app.is_commission_staff_of_for((select ccih from f426), (select st_active from f426)), true,
  '3.1a principalState=active (staff4.ccih): the WRAPPER grants.');
select is(pg_temp.legacy_staff_at((select ccih from f426), (select st_active from f426)), true,
  '3.1b principalState=active (staff4.ccih): the RESTRICTED LEGACY predicate grants — they agree, '
  'and both say TRUE rather than merely matching.');

select is(app.is_commission_staff_of_for((select ccih from f426), (select st_suspended from f426)), false,
  '3.2a principalState=suspended (suspenso.temp): the WRAPPER denies. The gate is `app.is_active`, '
  'reached through `authz.assignment_facts` — the FACTS level.');
select is(pg_temp.legacy_staff_at((select ccih from f426), (select st_suspended from f426)), false,
  '3.2b principalState=suspended (suspenso.temp): the RESTRICTED LEGACY predicate denies. ⚠ Its '
  '`app.is_active` sits at the WRAPPER level (app.has_role_any does not call it) — same answer, '
  'different level, which is the A2 fact this pair records.');

select is(app.is_commission_staff_of_for((select ccih from f426), (select st_deactivated from f426)), false,
  '3.3a principalState=deactivated (gap.deactivated): the WRAPPER denies.');
select is(pg_temp.legacy_staff_at((select ccih from f426), (select st_deactivated from f426)), false,
  '3.3b principalState=deactivated (gap.deactivated): the RESTRICTED LEGACY predicate denies.');

select is(app.is_commission_staff_of_for((select ccih from f426), (select st_pending from f426)), true,
  '3.4a ⭐ principalState=pending (gap.pending): the WRAPPER GRANTS, and this is the cell most '
  'likely to be "fixed". `app.is_active` reads `is_active` and `suspended_until` and NEVER '
  '`email_confirmed_at`, so pending denies at no layer the resolver can see — the AE4.5 deny-class '
  'ruling, re-measured here on a persona that is unconfirmed in `auth.users` AND in `profiles`.');
select is(pg_temp.legacy_staff_at((select ccih from f426), (select st_pending from f426)), true,
  '3.4b principalState=pending (gap.pending): the RESTRICTED LEGACY predicate also grants.');

-- ===========================================================================
-- § 3.5 ⭐⭐ THE GRANT THE MIGRATION DELIBERATELY WITHHELD, PINNED AS A FACT.
--
-- ⛔ THIS IS WHY §§ 4–5 CALL THE WRAPPER AS `service_role` AND NOT AS `authenticated`, and the
-- reason is a ruling, not a convenience. `20261003007460` grants EXECUTE to `service_role` only:
-- adding `authenticated` would put two new `prosecdef` functions inside the BUDGET-ANCHOR
-- privilege ceiling (gate 15), which needs a PO ruling, so ADR 0211 defers it to T7.
-- ⚠ MEASURED, NOT ASSUMED: the first post-cutover run of this suite died with `permission denied
-- for function is_commission_staff_of` — the suite had been written against the grant it does not
-- have. The honest repair is to assert the ABSENCE and then call it as a role that may, never to
-- widen the grant so the suite goes green: that would move a privilege ceiling to satisfy a test.
-- ⭐ A SECURITY DEFINER wrapper's answer does not depend on the CALLER's role — `auth.uid()` and
-- `app.active_role()` come from the JWT claims, which `claims_for` sets identically under either
-- role (measured). So the hat cells below lose nothing by running as `service_role`.
-- ⇒ WHEN T7 GRANTS `authenticated`, THESE TWO CELLS GO RED and must be re-ruled, not deleted.
-- ===========================================================================
select is(has_function_privilege('authenticated', 'app.is_commission_staff_of(uuid)', 'execute'),
  false,
  '3.5a `authenticated` CANNOT execute the SELF wrapper — the grant is deferred to T7 pending the '
  'BUDGET-ANCHOR ruling (ADR 0211). ⛔ Goes RED the day T7 grants it, on purpose.');
select is(has_function_privilege('authenticated', 'app.is_commission_staff_of_for(uuid, uuid)', 'execute'),
  false,
  '3.5b ...and neither can it execute the `_for` wrapper. Both stated, because a grant added to '
  'one of a pair is exactly the asymmetry a single-sided assertion would miss.');

-- ===========================================================================
-- § 4  A1 — THE HAT, BOTH POLARITIES, UNDER ALL THREE CONTEXTS.
--
-- ⛔ ONE HAT PROVES ONE POLARITY ONLY. The SELF form must be measured under a matching hat, a
-- wrong hat and NO hat; the `_for` form must be shown hat-BLIND under the same three. A suite that
-- ran only the matching hat would pass on a wrapper that ignored the hat entirely, and one that
-- ran only the self form would pass on a wrapper that applied it uniformly — the two failures the
-- § 6A asymmetry sits between.
-- ===========================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-00000000000a', false, 'staff');
set local role service_role;
select is(app.is_commission_staff_of((select ccih from f426)), true,
  '4.1a SELF · hat=staff (matching): the wrapper GRANTS.');
select is(pg_temp.legacy_staff_at((select ccih from f426), (select st_active from f426)), true,
  '4.1b SELF · hat=staff: the restricted legacy predicate agrees. ⚠ It is hat-free BY SHAPE — the '
  'hat conjunct lives in `app.has_role_any`, which this expression deliberately does not call, so '
  '§ 4.2b/§ 4.3b below are the cells that say the two sides DIVERGE on the hat and by how much.');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-00000000000a', false, 'staff_admin');
set local role service_role;
select is(app.is_commission_staff_of((select ccih from f426)), false,
  '4.2a ⭐ SELF · hat=staff_admin (a role this principal does NOT hold at this scope): the wrapper '
  'DENIES. `authz.holds_role` binds the hat to the code asked about.');
reset role;

-- ⛔⛔ THE `absent` ARM RUNS ON A DUAL-ROLE PRINCIPAL, AND THE REASON IS A MEASURED TRAP.
-- `test_helpers.claims_for(u, false, null)` does NOT mean "no hat": when `u` holds exactly ONE
-- role type it MINTS that role as the hat. Measured on the first post-cutover run of this suite —
-- § 4.3a asserted DENY for `staff4.ccih` and got GRANT, because the hat it believed absent was
-- `staff`, i.e. the MATCHING hat. The cell was re-measuring § 4.1a under another name.
-- ⭐ The differential generator already carries this fact as the named skip
-- `absent_unreachable_for_single_role_principal`; this suite had to learn it independently, which
-- is the argument for naming such a rule where BOTH readers can see it.
select is((select app.active_role() from (select test_helpers.claims_for(
             (select st_active from f426), false, null)) _), 'staff',
  '4.3-control ⚠ THE TRAP, ASSERTED: asking for NO hat on a SINGLE-role principal yields the hat '
  '`staff` anyway — `claims_for` mints it. ⛔ Without this cell the arm below would look like a '
  'free choice of principal instead of the only one that can reach the state.');

select test_helpers.claims_for((select dual_hat from f426), false, null);
set local role service_role;
select is(app.is_commission_staff_of((select dual_cid from f426)), false,
  '4.3a ⭐ SELF · hat=ABSENT (and genuinely absent — a dual-role principal, so nothing is '
  'minted): the wrapper DENIES and fails CLOSED. `app.active_role()` is NULL and `is not distinct '
  'from` makes the comparison false rather than unknown.');
reset role;

select test_helpers.claims_for((select dual_hat from f426), false, 'staff');
set local role service_role;
select is(app.is_commission_staff_of((select dual_cid from f426)), true,
  '4.3a-pos ⭐ POSITIVE CONTROL ON THE SAME PRINCIPAL: with the MATCHING hat the very same call '
  'GRANTS. ⛔ Without it, § 4.3a''s DENY is equally explained by this principal simply having no '
  '`staff` membership at that commission — an absence proving the wrong thing.');
reset role;

-- the `_for` form, hat-BLIND under all three.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002', false, 'staff_admin');
set local role service_role;
select is(app.is_commission_staff_of_for((select ccih from f426), (select st_active from f426)), true,
  '4.4a THIRD-PARTY · caller hat=staff_admin: the wrapper GRANTS about `staff4`. The hat is the '
  'CALLER''s and the question is about someone else, so it is not consulted.');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002', false, 'staff');
set local role service_role;
select is(app.is_commission_staff_of_for((select ccih from f426), (select st_active from f426)), true,
  '4.4b THIRD-PARTY · caller hat=staff: same answer. ⛔ Two hats, one answer — that is what '
  '"hat-blind" means, and a single hat could not have shown it.');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002', false, null);
set local role service_role;
select is(app.is_commission_staff_of_for((select ccih from f426), (select st_active from f426)), true,
  '4.4c THIRD-PARTY · caller hat=ABSENT: STILL grants. ⚠ THIS LOOKS LIKE A BUG AND IS NOT — it is '
  'the § 6A asymmetry, ratified by ADR 0201 D1: a third-party question ignores the hat, a self '
  'question requires it. ⛔ A reviewer about to "fix" it would break every subject-keyed site.');
reset role;

-- ===========================================================================
-- § 5  D2 PART 3 — PA-F8-STAFF-2's CONDITION, AS CELLS.
--
-- ⛔ The hat-grain difference between `has_role_any` (the hat may match ANY role held in the scope)
-- and `holds_role` (the hat must match the code asked about) is unreachable ONLY while these two
-- structural facts hold. Dropping either re-opens it SILENTLY, which is why this is a cell and not
-- a sentence in an ADR.
-- ===========================================================================
select is(
  (select pg_get_indexdef(i.indexrelid)
     from pg_index i join pg_class c on c.oid = i.indexrelid
    where c.relname = 'memberships_one_commission_role_uq'),
  'CREATE UNIQUE INDEX memberships_one_commission_role_uq ON public.memberships USING btree '
  '(principal_id, commission_id) WHERE (commission_id IS NOT NULL)',
  '5.1 ⭐ ONE ROLE PER USER PER COMMISSION, pinned as the index DEFINITION and not as its existence. '
  'A same-named index on different columns would satisfy an existence check and re-open the '
  'divergence. This is what makes the dual-role state unconstructible and PA-F8-STAFF-2 an (a).');

select is(
  (select count(*)::int from public.memberships where commission_id is not null
     group by principal_id, commission_id having count(*) > 1 limit 1),
  null,
  '5.2 …and no principal holds two commission-tier rows at one commission TODAY. ⛔ The index is '
  'the mechanism and this is the state: an index created NOT VALID, or added after a violating '
  'row, would pass § 5.1 and fail here.');

select is(
  (select count(distinct role)::int from public.memberships where commission_id is not null),
  2,
  '5.3 the commission tier carries exactly TWO roles in live data. ⚠ Paired with § 5.4 on purpose: '
  'this counts what EXISTS, that one bounds what MAY exist, and a tier that grew a third role '
  'would break the equivalence the wrapper disjunction rests on (ADR 0211 D3).');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.memberships'::regclass and conname = 'memberships_scope_shape'
      and pg_get_constraintdef(oid) like '%WHEN ''staff''::text THEN%'
      and pg_get_constraintdef(oid) like '%WHEN ''staff_admin''::text THEN%'),
  1,
  '5.4 …and `memberships_scope_shape` still names BOTH commission-tier roles. ⛔ A CHECK can be '
  'altered, so the two-value tier is re-measured rather than inherited from the matrix.');

-- ===========================================================================
-- § 6  ABLE-TO-FAIL — the suite is shown to red on a real perturbation.
--
-- ⛔ NOT a bare SAVEPOINT: pgTAP discards assertions made after a rollback to one, so this mutates
-- directly and restores, mirroring 403 § 6 and 409's convention.
-- ===========================================================================
update public.memberships set role = 'staff_admin'
 where principal_id = '00000000-0000-0000-0000-00000000000a'::uuid
   and commission_id = 'a0000000-0000-0000-0000-0000000000a1'::uuid;

select is(app.is_commission_staff_of_for((select ccih from f426), (select st_active from f426)), false,
  '6.1 ⭐ ABLE-TO-FAIL, LOUD HALF: flip the clean principal''s CCIH row from `staff` to '
  '`staff_admin` and the wrapper stops granting. ⛔ Without this the whole suite could be green on '
  'a wrapper that returns a constant.');

select is(pg_temp.legacy_staff_at((select ccih from f426), (select st_active from f426)), false,
  '6.2 …and the restricted legacy predicate stops granting too — so § 2.1 would still find ZERO '
  'differences under the mutation. ⚠ THAT IS THE POINT AND IT IS WORTH SAYING: the differential '
  'proves AGREEMENT, and agreement survives a change that moves both sides. § 6.1/§ 6.2 are what '
  'stop a reader treating § 2.1''s zero as proof that the wrapper is CORRECT rather than proof '
  'that it MATCHES.');

update public.memberships set role = 'staff'
 where principal_id = '00000000-0000-0000-0000-00000000000a'::uuid
   and commission_id = 'a0000000-0000-0000-0000-0000000000a1'::uuid;

select is(app.is_commission_staff_of_for((select ccih from f426), (select st_active from f426)), true,
  '6.3 RESTORE CONTROL: the mutation is undone and the wrapper grants again — so § 6.1''s red was '
  'the mutation and not drift that happened to arrive during this suite.');

-- ===========================================================================
-- § 7  SCOPE — the wrapper is not scope-blind.
-- ===========================================================================
select is(app.is_commission_staff_of_for((select farm from f426), (select st_active from f426)), false,
  '7.1 a sibling commission in the SAME org: FALSE. The grant is keyed on `commission_id`.');

select is(app.is_commission_staff_of_for((select farmb from f426), (select st_active from f426)), false,
  '7.2 a commission in ANOTHER org: FALSE. ⚠ RECORDED WITH ITS REASON, which is not tenant '
  'isolation: there is no org term anywhere in this path. It is the `scope_id` not matching, and a '
  'gate record must never read this cell as "the resolver enforces tenant isolation".');

select test_helpers.reset_role_and_claims();

select * from finish();
rollback;
