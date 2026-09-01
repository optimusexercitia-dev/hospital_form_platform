-- 405 — AE4.6/AE4.7b: the CUTOVER WRAPPERS' invariants, and THE CHOKEPOINT they collapsed onto.
-- Subjects: app.is_staff_admin_of(uuid), app.is_staff_admin_of_for(uuid, uuid), and — since
-- 20261003007210 — authz.holds_role(uuid, text, text, uuid), which both now delegate to.
--
-- ⛔ THIS FILE EXISTS BECAUSE 007200 CITED IT TWICE AND IT DID NOT EXIST. The cutover migration's
-- header names "pgTAP 405" as its compensating control in two places — for the hat gate's BOTH
-- POLARITIES, and for the comment-stripped `prosrc` grep proving no `legacy OR new` survived.
-- Tests ran 400-404. A named control that does not exist is prose rot at its most dangerous:
-- it reads as coverage, it is cited in a gate record, and nothing can contradict it.
-- (QA 2026-09-01, finding F6.)
--
-- ⚠ 401 §16 IS NOT THIS. §16 asserts the hat gate inside `authz.has_direct_permission` — the
-- RESOLVER, which the wrappers do not call. AE4.6 had each wrapper HAND-COPY the active-role
-- conjunct into its own body (the adapter carries three of has_role's four gates, not the
-- fourth), so the gate existed in four phrasings and nothing asserted the wrappers' own copies.
-- AE4.7b collapsed them onto `authz.holds_role`. §4 therefore no longer COUNTS the copies: it
-- asserts the conjunct is present at the ONE site (4.4) and absent from both wrappers (4.5).
-- The behavioural assertions in §§2-3 are UNCHANGED across that collapse, which is the evidence
-- it was behaviour-preserving — they were written against the hand-copied bodies.
--
-- ⭐ §6 and §7 are AE4.7b's own surface: `authz.roles.state` stops being inert (a LEGACY role is
-- denied by the chokepoint even with a live membership and the right hat), and the gate finally
-- has MUTATION TWINS — one site, reaching both wrappers.
--
-- ⚠ `absent` (no active_role claim) IS NOT CONSTRUCTIBLE for these personas and is deliberately
-- not asserted. Both seeded staff_admins hold exactly ONE role type, and
-- test_helpers.claims_for(uid, false, null) DERIVES the single role and sets it — the hook
-- behaving correctly (AE0.5 Axis 3; the same exclusion the 403 generator names). A cell asserting
-- a denial there would assert a state the system cannot produce.
--
-- RUN SHAPE: `Files=2, Tests=27` (26 here + 00_setup.sql's one).

begin;
select plan(26);

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
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\mholds_role\M'),
  2,
  '4.3 ⭐ POSITIVE CONTROL ON THE SAME INSTRUMENT: BOTH wrappers delegate to authz.holds_role. '
  '4.2 asserts an absence, and an absence measured by an instrument that finds nothing is not '
  'evidence. This is the assertion that shows the grep reaches these two bodies at all — a '
  'renamed or dropped function makes 4.2 vacuously true and reds here. ⚠ Was `assignment_facts` '
  'until AE4.7b; the wrappers now reach the adapter THROUGH the chokepoint (4.7), so asserting '
  'the adapter''s name here would red on a correct collapse.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'holds_role'
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'active_role'),
  1,
  '4.4 ⭐ THE HAT CONJUNCT LIVES IN THE CHOKEPOINT. Structural half of §§2.2/3.2. Until AE4.7b '
  'this assertion COUNTED THE COPIES — the gate existed in four hand-written phrasings across '
  'both wrappers, has_direct_permission and explain_direct_permission, and a behavioural test on '
  'one phrasing said nothing about the others. It is now asserted at ONE site, which is the '
  'whole point of the collapse; 4.5 is the half that makes "one site" checkable.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'active_role'),
  0,
  '4.5 ⭐⭐ AND NEITHER WRAPPER KEEPS ITS OWN COPY. ⛔ Without this, 4.4 is satisfied by a tree '
  'where the helper exists AND both hand-copies survive — which is strictly worse than before '
  'the collapse: three phrasings that must agree, and a mutation twin on the helper (§7) that '
  'proves nothing about the two the wrappers actually evaluate. A re-introduced copy is the '
  'exact regression AE5''s eleven cutovers are most likely to commit.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'holds_role'
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'is not distinct from'),
  1,
  '4.6 ⭐ THE NULL HAT IS COMPARED WITH `is not distinct from`, NOT `=`. '
  '⛔ BUG-ACT-NULLHAT-1: `af.role_code = app.active_role()` is NULL — not false — when no hat is '
  'set, so an `exists` over it returns FALSE and the gate fails closed by accident rather than '
  'by decision. The cutover mirrored has_role''s shape here and the collapse carried it across; '
  'a later editor "simplifying" it to `=` changes nothing observable today and everything the '
  'first time a site depends on it. ⚠ Note the DELIBERATE ASYMMETRY two lines above it in the '
  'same body: the SCOPE comparison is `=`, because there a NULL must NOT match — '
  '`is not distinct from` would resolve the platform tier''s null scope_id.');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'holds_role'
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'assignment_facts'),
  1,
  '4.7 THE DELEGATION CHAIN IS INTACT END TO END: wrapper -> holds_role (4.3) -> the adapter, '
  'here. ⛔ Without this the chain is asserted only at its first hop, and a chokepoint that had '
  'stopped consulting memberships entirely — answering off authz.roles alone — would satisfy '
  '4.3-4.6 and every behavioural test that expects FALSE.');

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
  array[false, false],
  '5.2 ⭐ THE PUBLIC EXECUTE GRANT IS GONE — FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE, '
  'closed by AE4.7b. Until then `is_staff_admin_of` carried `=X/postgres` (the empty grantee, '
  'which IS a PUBLIC grant, so `anon` held EXECUTE) while the `_for` sibling did not: AE1.2''s '
  'global revoke governs only NEWLY-CREATED functions and `create or replace` preserved it '
  'through every rewrite. Never a live hole — anon resolves auth.uid() to null and the wrapper '
  'answers false — but least-privilege debt and door-sweep domain noise. ⛔ Asserted by '
  'EFFECTIVE PRIVILEGE and against each function''s OWN value: a NULL proacl includes PUBLIC '
  '(this repo has been fooled by that four times), and comparing the two siblings to each other '
  'passes while a PUBLIC grant silently vanishes or spreads.');

select is(
  (select array_agg(has_function_privilege('authenticated', p.oid, 'EXECUTE') order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('is_staff_admin_of', 'is_staff_admin_of_for')),
  array[true, true],
  '5.3 ⭐⭐ THE OVER-REVOKE TWIN, AND 5.2 IS WORTH LITTLE WITHOUT IT. `revoke execute ... from '
  'public` that had been written as `from public, authenticated` — or a global sweep aimed one '
  'grantee too wide — satisfies 5.2 perfectly while taking every RLS policy on this predicate '
  'offline. That is an OUTAGE reading as a successful least-privilege tightening. ⛔ Both '
  'wrappers are called from live policies; neither may lose authenticated EXECUTE.');

select is(
  (select array_agg(has_function_privilege(r, 'authz.holds_role(uuid, text, text, uuid)'::regprocedure, 'EXECUTE')
                    order by r)
     from unnest(array['anon', 'authenticated', 'service_role']) r),
  array[false, false, false],
  '5.4 THE CHOKEPOINT ITSELF IS UNREACHABLE BY ANY APPLICATION ROLE. It sits in `authz`, which '
  'no application role holds USAGE on (20261003007100), and carries no EXECUTE grant of its own. '
  '⛔ Its gate therefore protects nothing directly — it is reached only through the two `app` '
  'wrappers, which ARE client-reachable and ARE in the door-audit domain. Stated as an assertion '
  'rather than a comment because "nothing can call it" is the premise every compensating-control '
  'argument in 20261003007170''s closing block rests on.');

-- ============================================================================
-- §6 — `authz.roles.state` STOPS BEING INERT. AE4.7b makes the chokepoint require
-- `state = 'authoritative'`, so a role that AE5 has not yet substituted fails CLOSED
-- instead of granting through a half-finished cutover.
--
-- ⛔ THIS IS THE ASSERTION SET THAT DID NOT EXIST BEFORE. Until AE4.7b nothing read
-- `authz.roles.state` at all: the column could be flipped to any value on any row and no
-- behaviour changed anywhere, which made AE4.6's "atomic cutover" atomic only by coincidence
-- of the wrapper bodies moving in the same migration.
-- ============================================================================

create temp table f405_legacy on commit drop as
select
  (select p.id from public.profiles p where p.email = 'orgadmin.a@test.local')             as oa,
  (select m.organization_id from public.memberships m join public.profiles p on p.id = m.principal_id
    where p.email = 'orgadmin.a@test.local' and m.role = 'org_admin' limit 1)              as oa_org;

select ok((select oa from f405_legacy) is not null and (select oa_org from f405_legacy) is not null
          and (select state from authz.roles where code = 'org_admin') = 'legacy'
          and (select state from authz.roles where code = 'staff_admin') = 'authoritative',
  '6.1 FIXTURE CONTROL: a REAL, live, correctly-scoped org_admin membership exists, org_admin is '
  'still LEGACY, and staff_admin is AUTHORITATIVE. 6.2''s FALSE is only attributable to `state` '
  'if everything else about the assignment is genuinely grantable.');

select test_helpers.claims_for((select oa from f405_legacy), false, 'org_admin');
select ok(
  not authz.holds_role((select oa from f405_legacy), 'org_admin', 'organization',
                       (select oa_org from f405_legacy)),
  '6.2 ⭐⭐ A LEGACY ROLE IS DENIED BY THE CHOKEPOINT even with a live membership, the right '
  'scope and the matching hat. ⛔ This is a DELIBERATE BOUND, not a bug: authz.holds_role is not '
  'a general role predicate, and app.has_role remains the predicate for the eleven legacy roles. '
  'It is what makes a premature AE5 delegation fail closed and LOUDLY rather than granting '
  'through a substitution nobody finished.');

-- ⭐⭐ 6.2's VACUITY CONTROL, and the reason it is not optional: a FALSE is explained equally
-- well by a missing membership, a scope mismatch, a wrong hat, or a typo in the role code. Only
-- flipping `state` — changing NOTHING else — attributes the denial to the gate under test.
update authz.roles set state = 'authoritative' where code = 'org_admin';
select ok(
  authz.holds_role((select oa from f405_legacy), 'org_admin', 'organization',
                   (select oa_org from f405_legacy)),
  '6.3 ⭐⭐ VACUITY CONTROL: flip org_admin to `authoritative` and the SAME call — same '
  'principal, same scope, same hat, same everything — now returns TRUE. 6.2''s denial is caused '
  'by `state` and by nothing else. This is also the AE5 cutover rehearsed end to end: one UPDATE '
  'and the role is live.');
update authz.roles set state = 'legacy' where code = 'org_admin';
select test_helpers.reset_role_and_claims();

-- ============================================================================
-- §7 — THE MUTATION TWINS. The whole argument for a chokepoint is that the gate has ONE site
-- that can be neutralized; §7 is where that stops being an argument.
--
-- ⛔ WHY THESE ARE HERE AND NOT IN 315/319. Those two mutate `app.has_role`, which after AE4.6
-- no longer reaches the staff_admin wrappers — that is precisely how they went red (they are
-- ORPHANED, not wrong) and they keep mutating has_role for the eleven LEGACY roles that still
-- route through it. The wrappers' own gate had no twin anywhere. F6 named "pgTAP 405" as the
-- control for exactly this and 405 did not exist; F1 then measured two of 403's fail-proofs
-- VACUOUS. A twin that has not been shown to fire is a comment.
--
-- ⚠ EACH MUTATION ASSERTS THAT THE EDIT LANDED before observing anything: a `replace()` that
-- matched nothing leaves the original body in place and the twin then reports GREEN — a
-- mutation harness's most reassuring failure mode.
-- ============================================================================

do $mut$
declare
  v_orig text;
  v_new  text;
  v_cut  constant text :=
    'and (
         p_principal is distinct from (select auth.uid())
         or af.role_code is not distinct from app.active_role()
       )';
begin
  v_orig := pg_get_functiondef('authz.holds_role(uuid, text, text, uuid)'::regprocedure);
  perform set_config('ae47b.orig_holds_role', v_orig, false);
  if position(v_cut in v_orig) = 0 then
    raise exception '405 §7: the hat conjunct was not found VERBATIM in authz.holds_role — the mutation would be a no-op and the twin would report green.'
      using errcode = 'check_violation';
  end if;
  v_new := replace(v_orig, v_cut, '');
  if v_new = v_orig then
    raise exception '405 §7: neutralizing the hat conjunct was a NO-OP.' using errcode = 'check_violation';
  end if;
  execute v_new;
  if position(v_cut in pg_get_functiondef('authz.holds_role(uuid, text, text, uuid)'::regprocedure)) <> 0 then
    raise exception '405 §7: the conjunct SURVIVED the execute — the edit did not land.'
      using errcode = 'check_violation';
  end if;
end $mut$;

select test_helpers.claims_for((select holder from f405), false, 'quality_reviewer');
select ok(app.is_staff_admin_of((select held_cid from f405)),
  '7.1 ⭐⭐ MUTATION TWIN — HAT CONJUNCT: with the active-role gate neutralized IN THE '
  'CHOKEPOINT, §2.2''s exact case (right principal, right commission, WRONG hat) flips from '
  'FALSE to WRONGLY TRUE. ⛔ This is what §2.2 is worth: it can fail, at the single site the '
  'collapse created, and one mutation reaches BOTH wrappers — which is the entire design claim '
  'of AE4.7b stated as a measurement.');

do $rst$ begin execute current_setting('ae47b.orig_holds_role', true); end $rst$;
select is(
  pg_get_functiondef('authz.holds_role(uuid, text, text, uuid)'::regprocedure),
  current_setting('ae47b.orig_holds_role', true),
  '7.2 RESTORE: authz.holds_role is byte-identical to its pre-mutation definition. ⛔ pg_proc '
  'carries no mtime, so a harness that left a door open could not be dated from the catalog '
  'afterwards — the restore is asserted, never assumed.');

do $mut2$
declare
  v_orig text;
  v_new  text;
  v_cut  constant text := 'and r.state       = ''authoritative''';
begin
  v_orig := pg_get_functiondef('authz.holds_role(uuid, text, text, uuid)'::regprocedure);
  perform set_config('ae47b.orig_holds_role2', v_orig, false);
  if position(v_cut in v_orig) = 0 then
    raise exception '405 §7: the authoritative-state conjunct was not found VERBATIM — the mutation would be a no-op.'
      using errcode = 'check_violation';
  end if;
  v_new := replace(v_orig, v_cut, '');
  execute v_new;
  if position(v_cut in pg_get_functiondef('authz.holds_role(uuid, text, text, uuid)'::regprocedure)) <> 0 then
    raise exception '405 §7: the state conjunct SURVIVED the execute — the edit did not land.'
      using errcode = 'check_violation';
  end if;
end $mut2$;

select test_helpers.claims_for((select oa from f405_legacy), false, 'org_admin');
select ok(
  authz.holds_role((select oa from f405_legacy), 'org_admin', 'organization',
                   (select oa_org from f405_legacy)),
  '7.3 ⭐ MUTATION TWIN — AUTHORITATIVE STATE: with `state = ''authoritative''` neutralized, the '
  'LEGACY role of §6.2 is WRONGLY ADMITTED. ⛔ §6.3 already showed the denial tracks the column; '
  'this shows it tracks the CONJUNCT — the two are different claims, and only this one fails if '
  'a future edit drops the join to authz.roles while the column keeps changing value.');

do $rst2$ begin execute current_setting('ae47b.orig_holds_role2', true); end $rst2$;
select is(
  pg_get_functiondef('authz.holds_role(uuid, text, text, uuid)'::regprocedure),
  current_setting('ae47b.orig_holds_role', true),
  '7.4 RESTORE: byte-identical to the ORIGINAL definition captured before §7.1 — not merely to '
  'the input of §7.3''s own mutation. ⛔ Chaining each restore to its immediate predecessor is '
  'how a two-mutation sequence leaves the FIRST edit resident while every restore assertion '
  'passes.');

select test_helpers.reset_role_and_claims();

select * from finish();
rollback;
