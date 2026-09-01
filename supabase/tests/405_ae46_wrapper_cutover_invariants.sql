-- 405 — AE4.6: the CUTOVER WRAPPERS' own invariants.
-- Subjects: app.is_staff_admin_of(uuid) and app.is_staff_admin_of_for(uuid, uuid) after
-- 20261003007200 re-pointed both at authz.assignment_facts.
--
-- ⛔ THIS FILE EXISTS BECAUSE 007200 CITED IT TWICE AND IT DID NOT EXIST. The cutover migration's
-- header names "pgTAP 405" as its compensating control in two places — for the hat gate's BOTH
-- POLARITIES, and for the comment-stripped `prosrc` grep proving no `legacy OR new` survived.
-- Tests ran 400-404. A named control that does not exist is prose rot at its most dangerous:
-- it reads as coverage, it is cited in a gate record, and nothing can contradict it.
-- (QA 2026-09-01, finding F6.)
--
-- ⚠ 401 §16 IS NOT THIS. §16 asserts the hat gate inside `authz.has_direct_permission` — the
-- RESOLVER. The wrappers do not call the resolver; 007200 ruled they delegate to
-- `authz.assignment_facts`, which carries three of has_role's four gates and NOT the fourth, so
-- each wrapper HAND-COPIES the active-role conjunct into its own body. Inheriting a property is
-- not evidence you inherited it, and a hand-copied conjunct is exactly the thing that rots. Post
-- cutover, nothing asserted the wrappers' own hat conjunct anywhere.
--
-- ⚠ `absent` (no active_role claim) IS NOT CONSTRUCTIBLE for these personas and is deliberately
-- not asserted. Both seeded staff_admins hold exactly ONE role type, and
-- test_helpers.claims_for(uid, false, null) DERIVES the single role and sets it — the hook
-- behaving correctly (AE0.5 Axis 3; the same exclusion the 403 generator names). A cell asserting
-- a denial there would assert a state the system cannot produce.
--
-- RUN SHAPE: `Files=2, Tests=16` (15 here + 00_setup.sql's one).

begin;
select plan(15);

-- ============================================================================
-- §1 — the fixture. Two staff_admins in the SAME org, at DIFFERENT commissions,
-- each holding exactly one role. The second is what makes a third-party check
-- constructible without inventing a principal.
-- ============================================================================

create temp table f405 on commit drop as
select
  (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')            as holder,
  (select m.commission_id from public.memberships m join public.profiles p on p.id = m.principal_id
    where p.email = 'chefe.ccih@test.local' and m.role = 'staff_admin' limit 1)           as held_cid,
  (select p.id from public.profiles p where p.email = 'chefe.farm@test.local')            as other,
  (select m.commission_id from public.memberships m join public.profiles p on p.id = m.principal_id
    where p.email = 'chefe.farm@test.local' and m.role = 'staff_admin' limit 1)           as other_cid;

select ok((select holder from f405) is not null and (select held_cid from f405) is not null
          and (select other from f405) is not null and (select other_cid from f405) is not null
          and (select holder from f405) <> (select other from f405)
          and (select held_cid from f405) <> (select other_cid from f405),
  '1.1 FIXTURE CONTROL: two DISTINCT staff_admins at two DISTINCT commissions resolve. Every '
  'assertion below is attributable only if the caller and the principal can actually differ — a '
  'third-party arm written where caller == principal is a self-check wearing a third-party '
  'label, which is how 403 §5.2 first went red.');

-- ============================================================================
-- §2 — app.is_staff_admin_of. THE SELF-CHECK WRAPPER: its principal is always the
-- caller, so the active-role filter ALWAYS applies. 007200 wrote that conjunct
-- unconditionally rather than transcribing has_role's constant-false disjunct.
-- ============================================================================

select test_helpers.claims_for((select holder from f405), false, 'staff_admin');
select ok(app.is_staff_admin_of((select held_cid from f405)),
  '2.1 HAT GATE POSITIVE: the holder, wearing the staff_admin hat, at the commission they hold '
  '-> TRUE. On its own this is satisfied by a wrapper that dropped the hat gate entirely, which '
  'is why 2.2 is the assertion that matters.');

select test_helpers.claims_for((select holder from f405), false, 'quality_reviewer');
select ok(not app.is_staff_admin_of((select held_cid from f405)),
  '2.2 ⭐⭐ HAT GATE NEGATIVE — THE POLARITY 007200 CLAIMED WAS ASSERTED HERE. Same principal, '
  'same commission, same membership; only the ACTIVE ROLE differs -> FALSE. ⛔ The cutover moved '
  'this gate out of app.has_role and HAND-COPIED it into the wrapper body. A wrapper delegating '
  'to authz.assignment_facts ALONE would pass 2.1 and RED HERE, and that "never-apply" half of '
  'matrix §6A would have been introduced BY the cutover, silently, across ~151 self-check sites.');

select test_helpers.claims_for((select holder from f405), false, 'staff_admin');
select ok(not app.is_staff_admin_of((select other_cid from f405)),
  '2.3 SCOPE: the right hat at the WRONG commission -> FALSE. Without this, a wrapper that had '
  'stopped comparing af.scope_id would pass 2.1 and 2.2 both, answering TRUE for every commission '
  'in the database — the over-grant a hat-only pair of assertions cannot see.');

-- ============================================================================
-- §3 — app.is_staff_admin_of_for. THE ASYMMETRIC WRAPPER, and the whole reason
-- the two bodies are not the same text: the filter applies only when the
-- principal IS the caller (matrix §6A row 7).
-- ============================================================================

select test_helpers.claims_for((select holder from f405), false, 'staff_admin');
select ok(app.is_staff_admin_of_for((select held_cid from f405), (select holder from f405)),
  '3.1 SELF, matching hat -> TRUE.');

select test_helpers.claims_for((select holder from f405), false, 'quality_reviewer');
select ok(not app.is_staff_admin_of_for((select held_cid from f405), (select holder from f405)),
  '3.2 ⭐ SELF, WRONG HAT -> FALSE. p_user_id = auth.uid(), so the `is distinct from` disjunct is '
  'false and the active-role conjunct decides. This is the `_for` wrapper''s own copy of the gate '
  '— asserting 2.2 does not assert this one.');

select test_helpers.claims_for((select other from f405), false, 'quality_reviewer');
select ok(app.is_staff_admin_of_for((select held_cid from f405), (select holder from f405)),
  '3.3 ⭐⭐ THIRD-PARTY, WRONG HAT -> TRUE, AND THIS LOOKS LIKE A BUG AND IS NOT. The caller is a '
  'DIFFERENT person wearing a non-staff_admin hat, and the answer is still TRUE, because '
  'p_user_id is distinct from auth.uid() short-circuits the filter entirely. ⛔ Do not "fix" it: '
  'applying the filter uniformly breaks all 27 `_for` call sites while reading as a tightening, '
  'and never applying it drops the gate for the ~151 self-check sites. Neither uniform choice is '
  'correct — the asymmetry is the design (matrix §6A), and both halves need an assertion or the '
  'suite passes while pinning whichever half is broken.');

select ok(not app.is_staff_admin_of_for((select held_cid from f405), (select other from f405)),
  '3.4 THIRD-PARTY, NON-HOLDER -> FALSE. ⛔ The differential for 3.3: same caller, same hat, same '
  'scope; only the PRINCIPAL changes. Without it, 3.3''s TRUE is equally explained by a wrapper '
  'that short-circuits to TRUE for every third-party call — which would be a total authorization '
  'bypass reading as a passing test.');

select test_helpers.reset_role_and_claims();

-- ============================================================================
-- §4 — the prosrc grep 007200's header names: no `legacy OR new`, no
-- caller-selectable evaluator, the legacy predicate GONE from both bodies.
-- ⚠ COMMENTS ARE STRIPPED BEFORE THE MATCH (the house idiom, 231:409). A raw
-- prosrc regex counts `--` text as code, so a body that merely MENTIONS
-- has_role in a comment would read as an un-cut-over wrapper — and the
-- opposite failure is worse: a line-filtered prosrc silently drops disjuncts.
-- ============================================================================

select ok(
  not (regexp_replace('select app.has_role(x) -- and the legacy predicate' || chr(10) || 'from y',
                      '--[^' || chr(10) || ']*', '', 'g') ~ '\mlegacy predicate\M')
  and (regexp_replace('select app.has_role(x) -- and the legacy predicate' || chr(10) || 'from y',
                      '--[^' || chr(10) || ']*', '', 'g') ~ '\mhas_role\M'),
  '4.1 ⭐ INSTRUMENT CONTROL, and §4 is worth nothing without it. On a synthetic body the strip '
  'REMOVES what is behind `--` and KEEPS what is not. ⛔ A strip that silently removed everything '
  'would make 4.2/4.3 below pass no matter what the wrappers contain — a detector nobody has '
  'shown can find something, asserting an ABSENCE.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\mhas_role\M'),
  0,
  '4.2 ⭐ NEITHER WRAPPER STILL CALLS app.has_role. ⛔ 007200 rules out `legacy OR new` and any '
  'caller-selectable evaluator: a wrapper answering `has_role(...) or <catalog>` passes every '
  'behavioural assertion above while the cutover has not actually happened, and the differential '
  'oracle would agree with legacy for the most trivial of reasons.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'assignment_facts'),
  2,
  '4.3 ⭐ POSITIVE CONTROL ON THE SAME INSTRUMENT: BOTH wrappers do delegate to '
  'authz.assignment_facts. 4.2 asserts an absence, and an absence measured by an instrument that '
  'finds nothing is not evidence. This is the assertion that shows the grep reaches these two '
  'bodies at all — a renamed or dropped function makes 4.2 vacuously true and reds here.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'active_role'),
  2,
  '4.4 BOTH wrappers carry the active-role conjunct in their OWN body. ⚠ This is the structural '
  'half of §§2.2/3.2 and it is asserted separately on purpose: the hand-copied gate exists in '
  'FOUR phrasings across both wrappers, has_direct_permission and explain_direct_permission, and '
  'a behavioural test on one phrasing says nothing about the others. Collapsing them onto one '
  'helper is AE4.7b (authz.holds_role); until then, count the copies.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'is not distinct from'),
  2,
  '4.5 ⭐ THE NULL HAT IS COMPARED WITH `is not distinct from`, NOT `=`, IN BOTH BODIES. '
  '⛔ BUG-ACT-NULLHAT-1: `af.role_code = app.active_role()` is NULL — not false — when no hat is '
  'set, so an `exists` over it returns FALSE and the wrapper fails closed by accident rather than '
  'by decision. The cutover mirrored has_role''s shape here; a later editor "simplifying" it to '
  '`=` changes nothing observable today and everything the first time a site depends on it.');

-- ============================================================================
-- §5 — the properties `create or replace` PRESERVES, asserted because that is
-- exactly what makes them easy to lose later. Name, signature, prosecdef,
-- search_path and ACLs all persist through a replace — so nothing about a
-- future edit announces that one of them moved.
-- ============================================================================

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
      and p.prosecdef),
  2,
  '5.1 BOTH wrappers are still SECURITY DEFINER. ⛔ `prosecdef` belongs beside `pg_policies` '
  '(ADR 0078): these are the doors in front of a schema no application role holds USAGE on, so '
  'an INVOKER wrapper here does not weaken a check — it makes the function unreachable and the '
  'failure lands as a permission error far from its cause.');

select is(
  (select array_agg(has_function_privilege('anon', p.oid, 'EXECUTE') order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')),
  array[true, false],
  '5.2 ⚠ THE ACL ASYMMETRY, PINNED AS-IS — this assertion RECORDS a defect, it does not bless '
  'one. `is_staff_admin_of` carries `=X/postgres` (the empty grantee, which IS a PUBLIC grant, so '
  '`anon` holds EXECUTE); the `_for` sibling does not. AE1.2''s global revoke governs only '
  'NEWLY-CREATED functions and `create or replace` preserved this one. Not a live hole today — '
  'anon resolves auth.uid() to null and the wrapper answers false — but it is least-privilege '
  'debt and door-sweep domain noise: FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE. ⛔ WHEN THAT '
  'REVOKE LANDS (AE4.7b), THIS EXPECTATION MUST BECOME array[false, false] — a red here is the '
  'revoke working, not a regression. Asserted against each function''s OWN value rather than by '
  'comparing the siblings, which would pass while a PUBLIC grant silently vanished or spread.');

select * from finish();
rollback;
