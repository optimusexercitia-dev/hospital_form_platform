-- =============================================================================
-- 343 — DM5 S5.D: the PHI-disposal completion gap, PINNED.
--
-- ⛔⛔ READ THIS FIRST — THIS FILE PINS A GAP, AND A GAP PIN READS BACKWARDS.
--
-- Every assertion below asserts that something DOES NOT EXIST. That is not the
-- usual shape and it is easy to misread as "disposal is covered". It is the
-- opposite. What this file says, in one sentence:
--
--    ⭐ A `file_objects` row can ENTER `disposal_state = 'disposal_pending'`
--       from three separate doors, and NOTHING IN THIS DATABASE EVER TAKES IT
--       OUT. The completion door exists; nothing calls it; nothing schedules
--       it. PHI bytes that a coordinator has asked to be destroyed stay on the
--       substrate until a HUMAN runs the runbook by hand.
--
-- ⛔ THEREFORE: A FAILURE HERE IS (PROBABLY) GOOD NEWS. If K4/K5/K6 go RED,
-- someone has built the automated completion path — which is exactly what
-- SHOULD happen. The correct response is NOT to loosen the assertion. It is to:
--   1. delete this file, and
--   2. revisit `docs/deployment/phi-disposal-runbook.md` and
--      FUP-DM5-DISPOSAL-JOB, both of which document a manual mitigation that
--      would then be obsolete and actively misleading.
-- The pin exists so that step 2 cannot be forgotten. Prose cannot enforce that;
-- this file can. This program's record has REPEATED instances of a comment that
-- asserted a mechanism which did not exist (the count is deliberately not stated
-- here — an unverified number in a comment is the same defect as the comment it
-- describes) — including the one this slice corrected, at
-- `src/lib/documents/actions.ts:277-278`, which claimed in the PRESENT TENSE
-- that "the disposal job + service-only completion door do the verified
-- deletion." They did not. This file is that comment, made executable.
--
-- ## Why a pgTAP file can only see HALF the gap (stated, not hidden)
--
-- The other half is in TypeScript: `complete_document_disposal`'s single call
-- site is `src/lib/documents/actions.ts:377`, inside `reclassifyDocument` — an
-- unrelated copy-then-retire workflow, not the disposition path. pgTAP cannot
-- see `src/`. That half is pinned by the vitest source-invariant in
-- `src/lib/documents/disposal-gap.test.ts`. NEITHER FILE IS SUFFICIENT ALONE:
-- the job would most plausibly be built in TS (a route handler or a server
-- action with service-role reach), which this file would not notice, while a
-- pg_cron/trigger implementation is invisible to the vitest one.
--
-- ## The detector's own trap, found while writing this (do not "simplify" it)
--
-- The obvious detector — `prosrc ilike '%complete_document_disposal%'` — is
-- WRONG and returns a FALSE POSITIVE today: `public.dispose_case_phi` mentions
-- the door in a `--` COMMENT ("see complete_document_disposal's
-- provisional-retention gate") and calls nothing. Written naively, K4 would be
-- red on day one for a reason that is not the property, and the natural "fix"
-- would be to weaken it. Comments are therefore STRIPPED before matching, and
-- K3a/K3b are the controls that keep the stripping honest in BOTH directions:
-- a comment-only reference must NOT count, a real call MUST.
--
-- ## Vacuity discipline (FUP-PGTAP-VACUOUS: `lint:vacuous` scans TS, not SQL)
--
-- An "X does not exist" assertion is green when X is absent AND green when the
-- detector is broken. So the detector is proven able to find something IN EVERY
-- RUN, not once at authoring time: K2 creates a genuine caller, asserts the
-- census finds exactly it, and drops it. K8 is the other anchor — without it,
-- K4 would also be satisfied by a world where nothing ever enters
-- `disposal_pending` at all, i.e. a dead feature rather than a gap. K8 proves
-- rows really can enter the state, which is what makes the gap consequential.
-- K7b is K7a's permissive twin (an ACL check that answers "no" to everything
-- would pass K7a).
--
-- ## Red-first, as ACTUALLY OBSERVED (2026-08-17) — not as intended
--
-- The first version of this paragraph asserted a red-first observation that had
-- not happened: the file had never been executed, and it could not have passed
-- (see the detector's self-detection defect below, plus `plan(11)` against 12
-- assertions). Corrected to the measured record:
--   1. `create function public.dm5_s5_redfirst_probe(uuid)` calling the door, in
--      `public`, OUTSIDE this file's transaction — a real catalog mutation.
--   2. Re-ran the file: exit 1, `Failed tests: 2-3, 5`, with K4 reporting
--      `have: {public.dm5_s5_redfirst_probe}  want: {}`. K4 named the caller.
--   3. Dropped the probe; re-verified `pg_proc` holds no `dm5_s5%` row.
--   4. Re-ran: 12/12 PASS, exit 0.
-- So this file's central assertion is proven ABLE TO FAIL against the same
-- catalog it certifies, and to fail by NAMING what broke it. K2 re-proves the
-- detector half of that in every single run; step 1–3 above additionally proves
-- K4 itself, which K2 alone does not.
-- Full record: docs/progress/dm5-s5-operational-closure.md.
--
-- ADR 0120; ADR 0099 D10 (the "no new cron infrastructure" decision this gap
-- now stands in tension with); Rule 12 / LGPD / ANVISA-RDC / CFM 1821.
-- =============================================================================
begin;
-- ⚠ THE PLAN COUNT: `plan(12)`, restored from `no_plan()` after QA r1 — and the
-- reasoning that put `no_plan()` here was WRONG IN THE RISK DIRECTIONS, which is
-- worth recording because it is a subtle error, not a typo.
--
-- History. The file arrived declaring `plan(11)` with 12 assertions; pg_prove
-- reported `Failed tests: 2-3, 5, 12` with a leading PARSE ERROR ("Bad plan"),
-- and test 12 was listed as failed purely because of the count. That looked like
-- "the count is a second thing that can go red for a reason that is not the
-- property", so it was replaced with `no_plan()`.
--
-- ⛔ The comparison was against the wrong alternative. Both failure modes are
-- real, but they fail in OPPOSITE directions:
--   * a wrong `plan(N)` fails **SAFE** — a noisier red on a run that was ALREADY
--     failing and already exiting 1. It never produced a false green. The
--     "masking" it was accused of was a *reporting* artifact of a correct failure.
--   * silent assertion loss under `no_plan()` fails **OPEN** — delete a
--     `select ok(…)` and the file simply becomes smaller, with no complaint from
--     the file itself. `plan(N)` says "planned 12, ran 11"; `no_plan()` says
--     nothing.
-- So the change traded a fail-safe failure mode for a fail-open one, and
-- described that as protecting the file's ability to go red. The assertion set is
-- stable at 12, so the count is restored.
--
-- ⚠ IF YOU ADD OR REMOVE AN ASSERTION, RE-DERIVE THIS NUMBER IN THE SAME EDIT.
-- The count is 12 top-level assertion calls: K1, K2, K3a, K3b, K4, K5, K6a, K6b,
-- K7a, K7b, K8, K8b. Derive it, do not trust this list — the list is prose and
-- prose goes stale, which is the whole subject of this file.
--
-- (Recorded for completeness, since it was measured and someone may re-litigate
-- this: a `no_plan()` file that ABORTS mid-run does still FAIL — pg_prove reports
-- "Parse errors: No plan found in TAP output" + "Non-zero exit status: 3", exit 1.
-- That measurement was correct; it just answered a question that was not the
-- deciding one.)
select plan(12);

-- ---------------------------------------------------------------------------
-- The detector. Comment-stripped, so a mention is not mistaken for a call.
-- ---------------------------------------------------------------------------
-- ⛔ THE DETECTOR DETECTED ITSELF. Its first form (inherited uncommitted, never
-- run) omitted the temp-schema bound below, and K2/K3a/K4 were all RED on the
-- first execution — not because a caller existed, but because THESE TWO pg_temp
-- helper functions carry the literal `complete_document_disposal` in their own
-- bodies (in an `ilike` pattern here, inside an `execute` string below), and
-- `pg_temp_N` functions are ordinary `pg_proc` rows. Observed:
--   have: {pg_temp_44.dm5_s5_completion_callers, pg_temp_44.dm5_s5_scheduled_callers,
--          public.dm5_s5_gap_probe}   want: {public.dm5_s5_gap_probe}
-- A red for a reason that is not the property is the most dangerous kind: the
-- natural "fix" is to relax the assertion until it is green, which would have
-- neutered K4 permanently.
--
-- ⚠ WHAT THE TEMP BOUND COSTS, stated so it is not rediscovered as a surprise: a
-- caller defined in a SESSION-TEMP schema is invisible to this census. That is
-- the intended bound — a scheduled/production completion path cannot live in a
-- per-session temp schema — and K2 is the control that the bound did not
-- over-reach: its probe is created in `public` and MUST still be found.
--
-- The door's own row is excluded SCHEMA-QUALIFIED, not by bare name. Verified
-- against the live catalog (2026-08-17) that `public` holds the only function
-- with this name, so an `app.complete_document_disposal` appearing later is a
-- restructure of the door itself and SHOULD surface here as a red to look at,
-- rather than being silently excluded by a name match.
create or replace function pg_temp.dm5_s5_completion_callers()
returns text[] language sql stable as $fn$
  select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where not (n.nspname = 'public' and p.proname = 'complete_document_disposal')
     and n.nspname not like 'pg\_temp%'
     and n.nspname not like 'pg\_toast%'
     and regexp_replace(regexp_replace(p.prosrc, '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g')
         ilike '%complete_document_disposal%';
$fn$;

-- Scheduled callers. Dynamic because `cron.job` does not exist on this stack and
-- a static reference would fail at PARSE time, not at execution time.
create or replace function pg_temp.dm5_s5_scheduled_callers()
returns int language plpgsql stable as $fn$
declare n int;
begin
  if to_regclass('cron.job') is null then return 0; end if;
  execute 'select count(*) from cron.job where command ilike ''%complete_document_disposal%''' into n;
  return n;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- K1 — the anchor. If the door itself vanished, every "no caller" assertion
-- below would be vacuously true, so establish the subject exists first.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_document_disposal' and p.prosecdef),
  1,
  'K1 anchor: public.complete_document_disposal exists and is SECURITY DEFINER (subject of every assertion below)'
);

-- ---------------------------------------------------------------------------
-- K2 — POSITIVE CONTROL, run every time. A detector that finds nothing must be
-- proven able to find something, in the same run, against this same catalog.
-- ---------------------------------------------------------------------------
create function public.dm5_s5_gap_probe(p_id uuid) returns void language plpgsql as $probe$
begin
  perform public.complete_document_disposal(p_id);
end;
$probe$;

select is(
  pg_temp.dm5_s5_completion_callers(),
  array['public.dm5_s5_gap_probe']::text[],
  'K2 positive control: the detector FINDS a genuine caller (proves K4 below is capable of failing)'
);

drop function public.dm5_s5_gap_probe(uuid);

-- ---------------------------------------------------------------------------
-- K3 — the detector must not be fooled by a MENTION. Both directions.
-- ---------------------------------------------------------------------------
create function public.dm5_s5_gap_comment_probe() returns void language plpgsql as $probe$
begin
  -- complete_document_disposal is named here and NEVER called.
  perform 1;
end;
$probe$;

select is(
  pg_temp.dm5_s5_completion_callers(),
  '{}'::text[],
  'K3a a comment-only mention is NOT counted as a caller (the trap this detector was rewritten to avoid)'
);

drop function public.dm5_s5_gap_comment_probe();

-- K3b — the same property against a LIVE, shipped instance rather than a
-- manufactured one: dispose_case_phi's body genuinely mentions the door in a
-- comment. This doubles as the pin that goes red the day dispose_case_phi is
-- wired to actually call it.
select ok(
  not ('public.dispose_case_phi' = any(pg_temp.dm5_s5_completion_callers()))
  and (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') not ilike '%complete_document_disposal%'
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'dispose_case_phi'),
  'K3b live instance: dispose_case_phi MENTIONS the completion door in a comment and does not call it'
);

-- ---------------------------------------------------------------------------
-- K4 — ⛔ THE GAP ITSELF. Zero in-database callers of the completion door.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.dm5_s5_completion_callers(),
  '{}'::text[],
  'K4 THE GAP: NOTHING in this database calls complete_document_disposal — a disposal_pending row is never completed automatically'
);

-- ---------------------------------------------------------------------------
-- K5 — nor is it reached from a trigger.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_trigger t
     join pg_proc p on p.oid = t.tgfoid
    where regexp_replace(regexp_replace(p.prosrc, '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g')
          ilike '%complete_document_disposal%'),
  0,
  'K5 no trigger anywhere invokes the completion door'
);

-- ---------------------------------------------------------------------------
-- K6 — nor is anything scheduled. Two assertions, deliberately.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.dm5_s5_scheduled_callers(),
  0,
  'K6a no scheduled job invokes the completion door'
);

-- ⚠ A tripwire, not a preference. ADR 0099 D10 ruled "no new cron
-- infrastructure" for this codebase; pg_cron IS in shared_preload_libraries, so
-- enabling it is one CREATE EXTENSION away. If this goes red, a scheduler now
-- exists and the D10 decision — and this gap's mitigation — must be re-reasoned
-- even if the new scheduler was installed for something unrelated.
select ok(
  to_regclass('cron.job') is null and not exists (select 1 from pg_extension where extname = 'pg_cron'),
  'K6b no scheduler exists at all (pg_cron not installed) — so "nothing is scheduled" is not a claim about an empty job table'
);

-- ---------------------------------------------------------------------------
-- K7 — the ACL shape, which is itself the evidence of intent: this door was
-- built expecting an operational caller with service-role reach. None exists.
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.complete_document_disposal(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.complete_document_disposal(uuid)', 'EXECUTE'),
  'K7a no user-facing role can execute the completion door — it is not reachable from a request path'
);

select ok(
  has_function_privilege('service_role', 'public.complete_document_disposal(uuid)', 'EXECUTE'),
  'K7b permissive twin: service_role CAN execute it — the ACL is not simply denying everyone'
);

-- ---------------------------------------------------------------------------
-- K8 — the anchor that makes the gap CONSEQUENTIAL rather than academic: rows
-- really can enter `disposal_pending`, from three separate doors.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('request_document_disposition', 'dispose_case_phi', 'dispose_referral_phi')
      and regexp_replace(regexp_replace(p.prosrc, '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g')
          ilike '%disposal_pending%'),
  3,
  'K8 anchor: all THREE disposition doors write disposal_state = disposal_pending — the gap has an inflow, it is not a dead feature'
);

select is(
  (select count(*)::int from pg_constraint c
    where c.conrelid = 'public.file_objects'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%disposal_pending%'
      and pg_get_constraintdef(c.oid) ilike '%disposed%'),
  1,
  'K8b anchor: the disposal_state CHECK still admits both disposal_pending and disposed (the state machine the gap sits inside)'
);

select * from finish();
rollback;
