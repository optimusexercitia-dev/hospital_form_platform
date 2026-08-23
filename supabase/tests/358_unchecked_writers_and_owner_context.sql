-- TWO PREMISES NOTHING REDS WHEN THEY GO FALSE.
--
-- These two sections have nothing to do with each other domain-wise, and everything to do
-- with each other structurally: both are facts the rest of the suite RESTS on, both were
-- true when written, and until this file neither had anything that would notice if they
-- stopped being true. That is the shape this file exists to close, not a feature.
--
--   §A  `FUP-GRANT-CASE-ACCESS-UNCHECKED-HAS-NO-COVERAGE` — the `app` INVOKER writers that
--       write PHI / authorization-invariant tables with NO authority check of their own,
--       by design. ⚠ UNTESTED, NOT UNPROTECTED — two different claims. Their ACL is
--       `{postgres=X/postgres}` and schema `app` is not exposed to PostgREST, so nothing
--       is reachable today. What was missing is a pin that any of that is still true
--       TOMORROW: nothing reddened if the ACL widened, if one flipped to SECURITY
--       DEFINER, or if a new caller appeared.
--
--   §G  `FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS` — `reset role` restores the ROLE only.
--       A suite that then says "back in owner context, auth.uid() is NULL" may be
--       asserting AS THE LAST PERSONA. ⭐ A pin whose stated premise is false is the same
--       defect as a pin that cannot fail; this one is worse to find later, because the
--       comment above it reads like the verification.
--
-- ⛔ NO BOOTSTRAP, DELIBERATELY. `test_helpers.bootstrap()` opens with
-- `truncate public.organizations cascade` over ~150 tables. §A is pure catalog and §G
-- needs only a claims `sub` — which need not name a real profile, because
-- `claims_for` derives an `active_role` from `memberships` and simply mints no claim when
-- there are none. Neither section has any reason to pay for the truncate, and a fixture a
-- test does not need is a fixture that can fail it for an unrelated reason.

begin;
select plan(19);

-- =========================================================================
-- (A) THE UNCHECKED-WRITER CLASS — DERIVED BY PROPERTY, PINNED BY NAME.
--
-- ⭐ THE CLASS WAS DERIVED, NOT HAND-LISTED, AND THAT IS WHY IT HAS TWO MEMBERS.
-- Increment 2 added `app._set_participant_patient_unchecked` and it landed in no tracked
-- authorization class at all. Rather than invent a class around the new function, the
-- membership was derived by property — and the function the new one was MODELLED ON turned
-- out to be a member. `app._grant_case_access_unchecked` writes `case_access_grants`, the
-- table that decides who can reach a case, with no authority check, and had carried no
-- targeted coverage since it was written in 2026-07. ⛔ The class PREDATES the increment
-- that revealed it: the new helper did not create the gap, it made it visible by being the
-- second member of a class nobody had drawn.
--
-- ⛔ THE ACL IS NOT PART OF THE CLASS PREDICATE, ON PURPOSE. The follow-up's sweep included
-- "not executable by authenticated/anon" in the property. Reproducing that here would make
-- the census SELF-FULFILLING — widen a member's ACL and it silently LEAVES the set, so the
-- count assertion reds with the wrong message ("a member was removed") for the right event.
-- A1 therefore keys on the STRUCTURAL property alone, and every ACL fact is asserted
-- separately, per member, so a widening reds where it happened.
--
-- ⚠ THE TABLE SET IS THE PROPERTY'S PARAMETER, and it is stated by name — there is no
-- catalog column for "carries PHI or an authorization invariant". Measured 2026-08-22: the
-- set below is WIDER than the follow-up's (it adds the other two Class-1 PHI stores, the
-- `participants` registry, `memberships`, the administrativo tables and `audit_log`) and
-- still returns the SAME two members. Widening a domain and finding nothing new is
-- evidence; narrowing one to the members you expected is not.
--
-- ⚠ EXCLUSIONS, RECORDED. `app.save_instance_answers` and `app.seed_default_answers` are
-- `app` INVOKER writers too, and are out of the class on the STRONG ground: they write
-- response-plane CONTENT, which is neither PHI nor an authorization invariant. (They are
-- also `proacl`-NULL — the permissive default INCLUDING PUBLIC — which is the fail-open
-- shape this repo has hit four times. That is deliberately NOT asserted here: it would red
-- if someone FIXED it, and a gate that punishes the repair trains people to skip it. It is
-- tracked under FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.) If either ever enters
-- the class, A1 reds — which is the coverage that matters.
--
-- ⛔ DO NOT ACT ON `ARM=census`'s PRUNE HINT for these two. It lists both under "backlog
-- entries with no matching live gate (renamed/dropped — prune)". It is correct about its
-- own domain and WRONG AS ADVICE: the census's live-gate set is `prosecdef` booleans,
-- set-returning doors, `public` INVOKER plpgsql and policies, and these are `app` INVOKER
-- SCALARS — they match nothing in it, which is exactly why they are listed. Acting on the
-- hint deletes the admitted gap.
--
-- ⛔ IF A1 GOES RED, ESTABLISH **ADDED vs RENAMED** BEFORE YOU TOUCH THE ARRAY. This is a
-- NAME-KEYED verdict and a rename is precisely what orphans one; quietly updating the array
-- is the failure A1 exists to catch, performed by the person updating A1. A new member is a
-- new unchecked writer of PHI or of an authorization invariant and needs its own keystone,
-- not an array entry.
-- =========================================================================
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname),
                   array[]::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and not p.prosecdef and p.prokind = 'f'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?(patient_identifiers|patient_participants|event_patient|referral_patient|participants|case_access_grants|memberships|commission_administrativos|commission_administrativo_capabilities|audit_log)\M'),
  array['app._grant_case_access_unchecked', 'app._set_participant_patient_unchecked'],
  'A1 ⭐ CLASS, BY NAME: exactly these two `app` INVOKER routines write a PHI or '
  'authorization-invariant table with no authority check. coalesce => an empty result '
  'FAILS rather than passing on a NULL comparison');

-- ── A2-A6 · app._grant_case_access_unchecked — the member with NO targeted coverage
-- since 2026-07. It writes `case_access_grants`: the table that decides who can reach a case.
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_grant_case_access_unchecked'),
  false,
  'A2 _grant_case_access_unchecked is still SECURITY INVOKER. Flipped to DEFINER, its '
  'authority-free body would run with OWNER rights for anyone who ever gains EXECUTE — '
  'the ACL below would stop being the only thing between a caller and the grants table');
select is(
  (select coalesce(p.proacl::text, '<<NULL — the PERMISSIVE default, including PUBLIC>>')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_grant_case_access_unchecked'),
  '{postgres=X/postgres}',
  'A3 ⛔ _grant_case_access_unchecked''s ACL is EXACTLY the owner''s own grant. Pinned as '
  'the whole string, not as a boolean: a grant to service_role or to any future role reds '
  'here. And a NULL proacl — the default nobody writes, which INCLUDES PUBLIC — is '
  'rendered explicitly rather than collapsing to a passing NULL comparison');
select is(
  (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_grant_case_access_unchecked'),
  false, 'A4 …and the consequence, stated separately from the mechanism: `authenticated` '
         'holds NO EXECUTE on it');
select is(
  (select has_function_privilege('anon', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_grant_case_access_unchecked'),
  false, 'A5 …nor does `anon`');
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname),
                   array[]::text[])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\y_grant_case_access_unchecked\y'
      and p.proname <> '_grant_case_access_unchecked'),
  array['public.create_case', 'public.create_case_from_template', 'public.grant_case_access'],
  'A6 ⭐ CALLER SET, BY NAME: the authority-free body is reached from exactly these three '
  'gated doors. A fourth caller is a new authorization path into `case_access_grants` and '
  'reds here — the assertion `_set_participant_patient_unchecked` already has in 357 §1.1 '
  'and this member never had');

-- ── A7-A10 · app._set_participant_patient_unchecked — the precedent's second member.
-- ⚠ Its CALLER SET is deliberately NOT re-pinned here: `357` §1.1 already pins it at four,
-- beside the creation-scope reasoning that makes the number mean something. Restating it
-- would create a second place to update and a second place to go stale.
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_set_participant_patient_unchecked'),
  false,
  'A7 _set_participant_patient_unchecked is still SECURITY INVOKER — ⚠ DELIBERATELY, per '
  'ARCHITECTURE.md Rule 12: it is the second lock BEHIND the ACL, and must not be "fixed" '
  'to satisfy a prosecdef assertion. On the intended path (called from DEFINER bodies '
  'owned by postgres) INVOKER and DEFINER are indistinguishable; it bites only if the ACL '
  'in A8 ever leaks');
select is(
  (select coalesce(p.proacl::text, '<<NULL — the PERMISSIVE default, including PUBLIC>>')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_set_participant_patient_unchecked'),
  '{postgres=X/postgres}',
  'A8 ⛔ …and the ACL A7''s second lock is conditional on is EXACTLY the owner''s own grant');
select is(
  (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_set_participant_patient_unchecked'),
  false, 'A9 `authenticated` holds NO EXECUTE on the PHI writer');
select is(
  (select has_function_privilege('anon', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_set_participant_patient_unchecked'),
  false, 'A10 …nor does `anon`');

-- ⛔ A11 — THE PROBE ITSELF MUST BE ABLE TO RETURN TRUE. Every ACL assertion above is an
-- ABSENCE, and a detector that only ever reports absence is indistinguishable from one
-- that cannot detect. This runs the IDENTICAL `has_function_privilege(role, oid, 'EXECUTE')`
-- shape against an `app` routine that IS deliberately granted, so a mistyped probe (or an
-- oid lookup silently resolving to nothing) cannot read as "locked down".
select is(
  (select has_function_privilege('authenticated', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'member_can_for'),
  true, 'A11 ⭐ PROBE POSITIVE CONTROL: the same probe returns TRUE for app.member_can_for, '
        'which IS granted to authenticated — so A4/A5/A9/A10 are refusals, not a dead probe');

-- =========================================================================
-- (G) THE OWNER-CONTEXT PREMISE — THE HAZARD AND THE FIX, PINNED TOGETHER.
--
-- ⭐ THIS IS THE RED-FIRST GATE THE FOLLOW-UP REQUIRED, IN ITS ONLY SHIPPABLE FORM.
-- The follow-up says: "write a suite that asserts an owner-context property after a bare
-- `reset role` and require it to RED before the helper lands." That assertion is
-- PERMANENTLY red — it states something false about Postgres — so it cannot be committed
-- as-is. What ships is the same measurement INVERTED: G4 asserts what is actually true
-- (the persona survives a bare `reset role`), and G7 asserts that the new verb is what
-- makes it stop being true. Flip G4 to `auth.uid() is null` and it reds; that is the
-- red-first proof, and it is reproducible from this comment by anyone who doubts it.
--
-- ⛔ G4 IS NOT A TEST OF POSTGRES. It is the executable form of a sentence 136 files can
-- state falsely in a comment. If it ever goes GREEN-as-null, the hazard is gone and the
-- verb is redundant — which is a finding worth a red, not a silent simplification.
--
-- ⚠ current_user is compared to session_user, never to the literal 'postgres': pg_prove's
-- connection user is a property of the harness, not of the property under test.
-- =========================================================================
select has_function('test_helpers', 'reset_role_and_claims', array[]::text[],
  'G1 the root-fix verb exists — one call doing BOTH halves, so they cannot drift apart '
  'the way 136 hand-paired edits would');
select is(
  has_function_privilege('authenticated',
    'test_helpers.reset_role_and_claims()', 'EXECUTE'),
  true, 'G2 …and `authenticated` may EXECUTE it — it is called while acting AS a persona, '
        'so a verb the persona cannot call is a verb no suite can adopt');

create temp table g on commit drop as
  select '5eeded00-0000-4000-8000-00000000ba5e'::uuid as persona;
grant select on g to authenticated;

-- ── The HAZARD.
select test_helpers.claims_for((select persona from g), false);
set local role authenticated;
select is(auth.uid(), (select persona from g),
  'G3 PRE / ANTI-VACUITY: the persona really IS resolvable here. Without this, G4 could be '
  'green because claims_for never took, and G7 could be green for the same reason');
reset role;
select is(auth.uid(), (select persona from g),
  'G4 ⭐ THE HAZARD: after a BARE `reset role`, auth.uid() STILL returns the persona. '
  '`claims_for` writes request.jwt.claims with set_config(is_local => true), which is '
  'scoped to the TRANSACTION, not to the role — so every "back in owner context" comment '
  'standing alone above a `reset role` is a FALSE PREMISE');
select is(current_user::text, session_user::text,
  'G5 …while the ROLE genuinely did reset. This is what makes G4 a claim about CLAIMS and '
  'not about a `reset role` that failed — without it, both could be explained by one bug');

-- ── The FIX.
select test_helpers.claims_for((select persona from g), false);
set local role authenticated;
select is(auth.uid(), (select persona from g),
  'G6 PRE / ANTI-VACUITY: the persona is resolvable again, so G7 measures the verb rather '
  'than a fixture that never set anything');
select test_helpers.reset_role_and_claims();
select ok(auth.uid() is null,
  'G7 ⭐ THE FIX: after test_helpers.reset_role_and_claims(), auth.uid() is NULL — the '
  'premise 356 §0.5 pins and 1.5c depends on is TRUE by construction, not by comment');
select is(current_user::text, session_user::text,
  'G8 …and the role reset too, so the verb is a REPLACEMENT for `reset role` and not an '
  'addition to it. ⚠ Measured, not assumed: a RESET ROLE issued inside a function sticks '
  'after the function returns, and sticks even with a SET search_path clause attached');

select * from finish();
rollback;
