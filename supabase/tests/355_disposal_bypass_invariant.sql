-- =============================================================================
-- 355 — the `app.in_disposal_rpc` bypass INVARIANT, made detectable.
--
-- WHAT THIS PINS, AND WHY IT IS NOT A COUNT. The child locks refuse every writer on a
-- locked/terminal parent; exactly one flag stands them aside, and the bound on that
-- bypass has never been the number of readers — it is that **ONLY THE LGPD DISPOSAL
-- DOORS SET THE FLAG** (ADR 0129 Decision 1, corrected by its Amendment 1). The setter
-- count is what bounds it, so the setter SET is what this suite asserts.
--
-- ⛔ WHY `is(count(*), 3)` IS THE WRONG SHAPE, and it is the reason this file exists in
-- this form. A count reds identically for two opposite events — someone smuggled a
-- non-disposal door into the setter set, and the team legitimately shipped a fourth
-- disposal door — and the reflex fix for both is to edit the digit. **The bump is the
-- defect.** `set_eq` on the NAMES cannot be silenced that way: adding a setter forces a
-- human to write the new door's name into this file, which is the review moment the
-- invariant exists to create.
--
-- ⭐ t4 IS THE ONE THAT CARRIES THE STAR, because it is a PROPERTY and not a list. Every
-- reader of this flag must be a TRIGGER function. That rules out the actual escalation —
-- a *door* (invoker or DEFINER) learning to read the flag and stand itself aside, which
-- would convert a narrow trigger-level stand-aside into a general-purpose bypass — and it
-- needs NO edit when a fourth child lock is legitimately added. An assertion that
-- survives correct change is worth more than one that reds on it.
--
-- ⛔ t1/t2 ARE NOT DECORATION: THE DETECTOR MUST BE PROVEN ABLE TO FIND SOMETHING.
-- t3 and t4 are both satisfied by a predicate that matches NOTHING — a renamed GUC, a
-- quoting slip, a `prosrc` column that stopped containing what we think it contains, and
-- every assertion below goes green having measured an empty set. This repo has shipped
-- that exact defect more than once. t1/t2 run the IDENTICAL predicate shape against a
-- sibling flag (`app.in_meeting_rpc`) that is known to have many setters and at least one
-- reader, and REQUIRE a non-empty answer, before anything else is believed.
--
-- ⚠⚠ THE BOUND OF THIS SUITE, STATED SO NOBODY TRUSTS IT FURTHER THAN IT GOES. Every
-- query below matches the LITERAL text of `pg_proc.prosrc`. A setter that composes the
-- GUC name dynamically —
--     perform set_config('app.in_' || v_kind || '_rpc', 'on', true);
-- — is INVISIBLE to it. This suite therefore pins the **literal setter set**; it is NOT a
-- proof that no code path can set the flag. Mistaking the second for the first is exactly
-- the over-read this file's own subject matter is about. If a dynamic setter is ever
-- introduced, this suite goes green and the invariant is gone.
--
-- ⚠⚠ AND THIS SUITE IS INVISIBLE TO THE REPO’S VACUITY GATE, so nothing outside this
-- file checks that its assertions can fail. `npm run lint:vacuous`
-- (`scripts/check-vacuous-assertions.mjs`) globs /\.spec\.tsx?$|\.test\.tsx?$/ over `e2e/`
-- and `src/` ONLY — it NEVER scans `supabase/tests/`. The non-vacuity of everything below
-- therefore rests ENTIRELY on t1/t2 (the detector is proven able to find something) and
-- t5 (the population is proven non-empty), inside this file. A reader who assumes the
-- repo’s vacuity gate is watching this file will trust it further than it goes — the
-- same class of over-read as the dynamic-GUC caveat directly above.
--
-- ⚠ Comments are stripped (`--` to end of line) before every match, because `prosrc`
-- INCLUDES comments and a comment naming the flag would otherwise be counted as a setter
-- or a reader. That has produced a false finding in this repo before.
-- ⚠ Deliberately UNSCOPED by schema: a setter hiding in a third schema is precisely what
-- a `where nspname in ('app','public')` filter would miss, and the `like` predicate makes
-- the wider sweep free.
-- ⭐⭐ AND THE CLASS THIS SUITE EXISTS FOR WAS FOUND INSIDE THIS SUITE (QA r2, R2-4).
-- t6's comment described a `tgtype` check and a wrong-table check that its SQL does not
-- implement — a comment asserting a property the code beside it does not have. That is
-- character-for-character the defect that produced the tenth erasure statement
-- (`dispose_case_phi`'s `-- for meeting_cases child-lock`, naming a flag its guard never
-- read), reproduced in the file written to stop it, by the author who had just fixed it
-- twice. ⛔ THE COMMENT WAS CORRECTED TO THE ASSERTION, never the reverse. Left visible
-- here because the pattern is the lesson: prose drifts toward what you MEANT to check,
-- and nothing reds when it does — no gate compares a comment to the SQL beneath it.
-- =============================================================================

begin;
select plan(6);

-- ── t1/t2 — THE VACUITY CONTROLS: prove the detector can find something ─────────────
select cmp_ok(
  (select count(*)::int from pg_proc p
    where regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
          like '%set_config(''app.in_meeting_rpc''%'),
  '>', 10,
  't1 ⛔ VACUITY CONTROL: the SETTER predicate, run verbatim against the sibling flag `app.in_meeting_rpc`, finds many (>10) — so a zero from t3''s side would mean "none exist", not "the predicate matches nothing"');

select cmp_ok(
  (select count(*)::int from pg_proc p
    where regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
          like '%current_setting(''app.in_meeting_rpc''%'),
  '>', 0,
  't2 ⛔ VACUITY CONTROL: …and the READER predicate finds at least one for the same sibling flag. t4 counts readers that FAIL a property; with no readers at all it would pass having asserted nothing');

-- ── t3 — PIN A: the setter SET, by name ─────────────────────────────────────────────
-- ⛔ If this is RED because a new door legitimately sets the flag: do NOT add the name
-- without checking that the door is a DISPOSAL door. The invariant is not "three
-- setters", it is "every setter erases PHI". A door that merely wants to edit a child of
-- a locked parent is shape 1, and shape 1 is rejected (ADR 0129 Decision 1).
select set_eq(
  $$ select p.oid::regprocedure::text from pg_proc p
      where regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
            like '%set_config(''app.in_disposal_rpc''%' $$,
  $$ values ('dispose_case_phi(uuid,text)'),
            ('dispose_event_phi(uuid,text)'),
            ('dispose_meeting_minutes(uuid,text)') $$,
  't3 ⭐ PIN A: the flag is set by EXACTLY these three doors, and every one of them is an LGPD PHI-erasure door. Asserted as a SET, not a count — a new setter cannot be silenced by editing a number, it has to be NAMED here');

-- ── t4 — PIN B: the property that survives correct change ───────────────────────────
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
          like '%current_setting(''app.in_disposal_rpc''%'
      and p.prorettype <> 'pg_catalog.trigger'::regtype),
  0,
  't4 ⭐⭐ PIN B (the property, not a list): EVERY reader of the flag is a TRIGGER function — counted as "readers that are not triggers = 0". This is the escalation that matters: a DOOR reading the flag would turn a narrow trigger stand-aside into a general bypass. Needs no edit when a fourth child lock is legitimately added');

select cmp_ok(
  (select count(*)::int from pg_proc p
    where regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
          like '%current_setting(''app.in_disposal_rpc''%'),
  '>', 0,
  't5 ⛔ …and there ARE readers. t4 is a "rows failing the property = 0" assertion, which an empty reader set satisfies perfectly; this is the companion that stops it going vacuous the day the flag is renamed');

-- ── t6 — every reader is INSTALLED as a trigger somewhere ───────────────────────────
-- Stronger than t4's `prorettype` alone: a function can RETURN trigger and be attached
-- to nothing at all, in which case it is inert — and t4 happily counts it as a compliant
-- reader. t6 requires each reader to be wired to at least one non-internal trigger.
--
-- ⛔ AND HERE IS WHAT IT DOES **NOT** CHECK, spelled out because the comment that stood
-- here claimed both and the SQL implements neither (QA r2, R2-4):
--   · it reads NO `tgtype` bit, so it does not check the trigger's LEVEL or TIMING —
--     "row-level BEFORE" was an overclaim;
--   · it does not check WHICH TABLE the trigger sits on, so a reader installed on a
--     table under no child lock would pass this test.
--
-- ⚠ The wrong-table widening is deliberately LEFT UNPINNED rather than quietly implied.
-- Catching it needs an enumerated list of child-locked tables, and a list of names is
-- not a property: it rots silently every time a table is added, which is the exact
-- failure mode this suite exists to prevent. `353_disposal_child_lock_siblings.sql`
-- covers those lanes behaviourally instead, which is where that guarantee belongs.
-- ⚠ The tgtype check was measured before being declined: all 21 reader-triggers are
-- ROW+BEFORE (`tgtype = 31`) today, so the pin WOULD hold — it is omitted because a
-- violation is not a widening. An AFTER child lock still raises (only its stand-aside
-- return is ignored) and a STATEMENT one errors on `old`/`new` at runtime, i.e. it
-- fails LOUD. Pinning it would add maintenance for a correctness nit, not a bypass.
select is(
  (select count(*)::int from pg_proc p
    where regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
          like '%current_setting(''app.in_disposal_rpc''%'
      and not exists (select 1 from pg_trigger t
                       where t.tgfoid = p.oid and not t.tgisinternal)),
  0,
  't6 every reader is INSTALLED as a trigger on at least one table — counted as "readers installed nowhere = 0". With t5 holding, an empty reader set cannot satisfy it');

select * from finish();
rollback;
