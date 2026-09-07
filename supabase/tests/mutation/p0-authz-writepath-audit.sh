#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14). WRITE-PATH companion to
# p0-authz-door-audit.sh. That harness audits the READ layer (boolean predicates +
# SELECT/ALL read policies). This one audits the WRITE layer: the value-returning authz
# RAISE-GUARDS (assert_*_writable / assert_referral_*) and the INSERT/UPDATE/DELETE
# policies. Same method, same verdict semantics:
#
#   NEUTRALIZE each write-path authz gate (open it so it grants/allows regardless), run
#   the FULL pgTAP suite end-to-end, and read whether ANY keystone noticed.
#
#   Result: FAIL  -> a keystone asserts THROUGH this gate           = COVERED (good)
#   Result: PASS  -> NO keystone exercises it; opening it is silent = BLIND  (a finding)
#   run-shape != baseline (Files/Tests drop, or Dubious)            = ERROR  (harness bug)
#
# This is the INVERSE of m1/m5/u2 (revert ONE fix, require ONE keystone red). Here we open
# ONE gate and ask the WHOLE SUITE whether ANYONE asserts through it. We mutate the LIVE,
# COMMITTED catalog (never migration text — memory: migration file text is STALE) and run
# `supabase test db`.
#
# ── ARM 1: the authz RAISE-GUARDS — 11, NOT the 7 this header used to claim ─────────
# ⚠ Corrected 2026-08-29, surfaced by the new ARM-DOMAIN line printing `guard=N/11`.
# The 7 documented below are the ORIGINAL set; `GUARD_KEYS` has since gained
# set_commission_oversight, ensure_professional_participant, create_external_participant
# and set_primary_subject without this header moving. ⛔ GUARD_KEYS is the truth — a
# count in a comment is an assertion, and this one was false for four additions.
# These are plpgsql, RETURN a value (uuid / case_referral) AND `raise … '42501'`(or an HC*
# code) on unauthorized. The main door-audit EXCLUDES them from its auto-sweep because a
# blanket body-swap on a value-returning raise-guard risks a NULL-propagation ABORT
# downstream (§7.15). So we neutralize them BESPOKE, hand-written from the captured
# pg_get_functiondef snapshot: remove ONLY the authorization `raise` block(s) while
# PRESERVING the real `return <expr>` AND any non-authz guard (no_data_found lookups,
# workflow-STATE checks like status='draft'). This opens the authz gate while returning
# the correct type — no abort, so a PASS is a true BLIND, not a masked ERROR.
#
#   assert_capa_writable(uuid)            -> void ; drop can_write_capa raise
#   assert_meeting_staff_admin(uuid)      -> uuid ; drop is_staff_admin_of raise; keep return
#   assert_interview_writable(uuid)       -> uuid ; drop can_write_interview raise; keep return
#   assert_rca_writable(uuid)             -> uuid ; drop can_write_rca raise; keep return
#   assert_session_writable(uuid)         -> uuid ; SPECIAL (see below)
#   assert_referral_draft_writable(uuid)  -> case_referral ; drop can_manage_referral_source
#                                           raise; KEEP status='draft' state guard
#   assert_referral_target_acts(uuid,text[]) -> case_referral ; drop can_manage_referral_target
#                                           raise; KEEP status=any(expected) state guard
#
#   ⚠ assert_session_writable is SPECIAL: it has NO direct authz raise — its authz is the
#   DELEGATED final call `return app.assert_interview_writable(v_interview_id)`. If we left
#   that call intact, the (un-neutralized) interview guard would still enforce authz and
#   MASK any session-specific blindness (a false COVERED). So we replace the delegated call
#   with a direct, un-gated commission lookup that returns the SAME value the interview
#   guard would — isolating and opening the SESSION gate. (Flagged for lead review.)
#
#   EXCLUDED as non-authz validators (like the door-audit's is_valid_* config validators):
#     assert_meeting_roster_nonempty, assert_condition_value_codes  — DATA validation, not
#     authorization; opening them proves nothing about an authz keystone.
#
# ── ARM 2: every policy that can PERMIT A WRITE — from the LIVE CATALOG ─────────────
#
# ⛔ THE BOUND IS THE PROPERTY, NOT A SYNTAX (fixed 2026-09-02, Gate AE4 blocker 3;
# FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Part 3's remaining half). Until this change ARM 2's
# domain was an EMBEDDED 33-ROW SNAPSHOT whose rows were all `cmd in (INSERT,UPDATE,DELETE)`.
# That is a SYNTAX bound, and it is not the property: **`FOR ALL` is a write command too.**
# Measured on the live catalog 2026-09-02: 107 policies can permit a write — 62 `ALL`,
# 17 `INSERT`, 17 `UPDATE`, 11 `DELETE` — so the snapshot held 33 of 107 and reported the
# other 74 as "matched no gate". At the AE4.9 D6 gate that produced `policy=0/33`, ZERO
# gates selected, exit 3: the arm could not tell "no blind gate" from "no gate looked at".
#
# THE DOMAIN IS NOW: every row of `pg_policy` whose `polcmd <> 'r'` — i.e. every RLS policy
# that can permit an INSERT, UPDATE or DELETE — read from the catalog at run time, in every
# schema (`public` AND `storage`; the 3 `storage.objects` INSERT policies are in no other
# arm's domain, the census included, because that one bounds itself to `public`).
# ⛔ It EXCLUDES `FOR SELECT` policies (no write semantics — the read arm's domain) and,
# for an `ALL` policy, the `using` half (see the open rule below).
#
# ── THE OPEN RULE — open ONLY the clause that gates the WRITE ────────────────────────
#   INSERT -> `with check (true)`                 (INSERT has no USING)
#   DELETE -> `using (true)`                      (DELETE has no WITH CHECK; its USING *is*
#                                                  the write gate — it chooses which rows die)
#   UPDATE -> `using (true) with check (true)`    (both are write gates for UPDATE)
#   ALL    -> `with check (true)` **ONLY**
#
# ⭐ WHY `ALL` OPENS THE WITH-CHECK HALF ALONE, and it is not conservatism. An `ALL` policy's
# `using` clause ALSO gates SELECT, and `p0-authz-door-audit.sh` already sweeps it: its policy
# arm's domain is `pol.polcmd in ('r','*')` and it opens `using (true)` — ⛔ **the `using` half
# ALONE since 2026-09-05 (ADR 0191 D2 / `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS`).
# This comment used to read "(plus `with check (true)` when one exists)", which described the
# read arm before that fix; it is corrected here rather than deleted because the two arms'
# halves only add up if both files state the same split.** If this arm also opened `using`, a
# COVERED here could be earned by a READ keystone and would say nothing about the write path —
# a false coverage claim, the exact failure this harness exists to prevent. Opening the WITH
# CHECK alone isolates the INSERT / UPDATE-new-row half, which is the half no read keystone
# can reach.
# ⚠ STATED, not hidden: the DELETE and UPDATE-row-visibility half of an `ALL` policy is
# governed by that same `using` clause and is therefore NOT opened by this arm. It is opened
# by the read arm — ⭐ and since 2026-09-05 the read arm's COVERED for an `ALL` policy is
# NO LONGER ambiguous in the other direction: it is a claim about the READ half and nothing
# else. The two halves are now disjoint and jointly exhaustive, which is what makes the split
# a partition rather than an overlap. ⚠ Still true: neither arm attributes an `ALL` policy's
# verdict by COMMAND — the read arm's `using` covers SELECT and DELETE-row-visibility together.
# ⚠ Measured 2026-09-02: all 62 live `ALL` policies carry an EXPLICIT `with_check`, so the
# open and its restore are both plain `ALTER POLICY` and round-trip byte-exact. An `ALL`
# policy with a NULL `with_check` (its WITH CHECK defaulting to its USING) cannot be opened
# on the write half by ALTER at all — `ALTER POLICY` cannot reset WITH CHECK back to NULL, so
# the restore would not round-trip. That case is reported ERROR, never SKIPPED: zero exist
# today, and "the arm cannot reach it" must never be recorded as "nothing to do".
#
# Only the clauses the rule opens are touched. A case whose openable clause is ALREADY `true`
# is vacuous and SKIPPED (listed).
#
# ⚠ THE EMBEDDED 33-ROW SNAPSHOT SURVIVES — as a DRIFT TRIPWIRE ONLY (§7.2), never as the
# domain. For a policy it names, the live predicate must still byte-match it or the case is
# ERROR (its committed verdict was earned against different text). For the other 74 there is
# nothing to drift against, and each such case is marked `snapshot:ABSENT` in the report so
# a reader can see which verdicts carry that protection and which do not.
#
# ── Lessons baked in (mirror p0-authz-door-audit.sh; each HID A REAL RESULT) ─────────
#  §7.15  the assertion that NEVER RAN is a THIRD "green". We guard Files/Tests==baseline
#         and absence of "Dubious"; a shape drift is verdict=ERROR, never a BLIND.
#  §7.1   detect on the SUITE Result:, not `grep '^not ok'`.
#  §7.3   baseline Files/Tests are CAPTURED at preflight (not hardcoded) and MUST be
#         Result: PASS or we abort (a dirty baseline invalidates every case).
#  §7.5   restore is verified: after EVERY case re-fetch pg_get_functiondef / pg_get_expr
#         and BYTE-COMPARE against the captured original; a mismatch is a LOUD abort
#         (a botched restore silently contaminates every later case).
#  §7.2   value, not noun: guards keyed by regprocedure->OID (survives rename); policies by
#         name+table. The embedded snapshot is a DRIFT tripwire, not the restore source.
#
# ── EXIT CODES — four-way, NOT boolean. Read them DIRECTLY; a pipe erases them. ──────
#   0  CLEAN     a NON-EMPTY selection was swept and every case came back COVERED.
#   1  DIRTY     ≥1 BLIND and/or ERROR (also: baseline not green). ⛔ ERROR IS NOT A PASS.
#   2  ABORT     the harness could not run / a restore did not round-trip. Nothing may
#                be concluded.
#   3  UNPROVEN  nothing was measured — zero cases selected, or a CASES token that
#                matched no gate in either arm. ⛔ An UNPROVEN run is NOT a pass.
#
#   ⛔ These were added 2026-08-29 (FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Parts 2+3). Before
#   that this file ended on an echo, so EVERY run exited 0 — including the AE1.5 run with
#   13 ERROR and 0 COVERED. Identical semantics to p0-authz-door-audit.sh **on purpose**:
#   two harnesses meant to be halves of one gate must not handle the same shortfall in
#   opposite ways, which is precisely how this survived.
#
# ── Modes ────────────────────────────────────────────────────────────────────────────
#   DRYRUN=1  PRINT every neutralization (guards: full CREATE OR REPLACE; policies: the
#             ALTER POLICY) and EXIT — ZERO DB access. Eyeball the 7 bespoke guards here.
#   CASES="…" subset filter; matches a guard proname OR a policy name (space-separated).
#
# Run from repo root:   bash supabase/tests/mutation/p0-authz-writepath-audit.sh
# Dry run:              DRYRUN=1 bash supabase/tests/mutation/p0-authz-writepath-audit.sh
# Subset:               CASES="assert_capa_writable rca_delete" bash .../p0-authz-writepath-audit.sh
#   ⭐ A subset run writes its report + BLIND tsv to SCRATCH under $WORK and NEVER opens
#   the committed findings md for write (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE). There
#   is nothing to `git checkout --` afterwards; older instructions saying otherwise
#   describe the pre-2026-08-26 behaviour.
#
# ⚠ COST: full sweep = one ~23s suite run per guard (13) + per policy (107 as of
# 2026-09-02) = ~50 min, up from ~19 min when the policy domain was the 33-row snapshot.
# ⛔ That increase is the fix, not a regression: the previous figure was the cost of
# sweeping a third of the domain. The DIFF-SCOPED run (`CASES=`) is unaffected — it costs
# one suite run per SELECTED gate, exactly as before.
# The LEAD runs the full loop in the background (a background process dies at turn-end).
#
# ── ⛔ IF A RUN OF THIS ARM IS KILLED — the recovery step (ADR 0192; the deliverable
#    FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Part 4 owes). READ ALL FIVE STEPS BEFORE ACTING. ─────
#
#  ⛔ FIRST, THE STANDING RULE: do not kill a running sweep. A contaminated run is allowed to
#  FINISH and its verdicts are discarded. These steps are for a run that died anyway.
#  ⛔ DO NOT DELETE THE SENTINEL. It restores nothing and it is the ONLY record that a gate is
#  open on this shared stack.
#
#  1. `ls -l "$AUTHZ_SWEEP_SENTINEL"` (default /tmp/authz-writepath-INFLIGHT.sql). Non-empty
#     means an RLS policy or a raise-guard is OPEN RIGHT NOW to `authenticated`. Beside it,
#     `.probe` / `.want` identify the original catalog state, so the restore can be VERIFIED
#     from the catalog instead of believed from psql's exit code.
#  2. `RECOVER=1 WORK=<the run's WORK> AUTHZ_SWEEP_SENTINEL=<the run's sentinel> bash "$0"`.
#     ⚠ There is no role to choose and no `.role` sidecar: this harness connects as exactly one
#     role, so the restore uses the role that opened the gate BY CONSTRUCTION (ADR 0192).
#  3. ⛔ VERIFY IN THE CATALOG, NEVER FROM THE MESSAGE:
#       select schemaname||'.'||tablename||'.'||policyname||' ('||cmd||')' from pg_policies
#        where (coalesce(qual,'')='true' or coalesce(with_check,'')='true') and cmd <> 'SELECT';
#     must return ZERO ROWS. ⛔ ENUMERATE — a bare COUNT without the `cmd <> 'SELECT'`
#     discriminator returns ~11 on a clean stack because ten vocabulary SELECT policies are
#     `true` BY DESIGN, and reading that as a baseline is how the AE1.5 fully-open UPDATE
#     policy was nearly missed.
#  4. If the restore refuses, or the sentinel is absent and a degenerate NON-SELECT policy
#     exists anyway: `supabase db reset --local` **from the repo root**. ⛔ The `cd` is
#     load-bearing — `db reset` applies the migrations of the DIRECTORY YOU STAND IN, and this
#     machine has a second, unrelated stack up.
#  5. ⛔ THE COMMITTED BASELINE MAY BE HALF-REWRITTEN. `emit_report` runs after EVERY case, and
#     on a FULL run its target IS the committed file. Restore it with:
#       git checkout -- docs/reviews/authz-writepath-audit-findings.md
#     (A SUBSET run never opens it; there is nothing to restore after one.)
#  6. ⛔ THE KILLED RUN'S VERDICTS ARE DISCARDED — its `writepath_progress.tsv` is never merged.
#
#  ⚠ AND THE CONTAMINATION SURFACE IS THE WORKING TREE, NOT ONLY THE DATABASE. This sweep's
#  baseline is the suite's SHAPE (`Files=`/`Tests=`), so ADDING ONE FILE UNDER `supabase/tests/`
#  invalidates a run exactly as effectively as touching the DB — and it looks nothing like DB
#  activity. Freeze the tree for the duration. ⛔ Never edit this script while a run executes it.
set -u

# ⚠ Overridable for two reasons, neither of them a way to skip anything: this machine runs
# more than one local stack (`supabase_db_escalume` sits beside this one), and the domain
# lift's ABORT path has to be PROVABLE — a control that cannot be made to fire has not been
# shown to work. Point it at a container that does not exist and the lift fails, which is
# how that ABORT was demonstrated rather than asserted.
DB="${AUTHZ_SWEEP_DB:-supabase_db_azkbbhskturikxpgmafq}"
# Repo root = three levels up from supabase/tests/mutation/.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-${TMPDIR:-/tmp}/authz-audit}"
# ⚠ distinct writepath_* names so this NEVER clobbers the running door-audit's outputs.
PROGRESS="$WORK/writepath_progress.tsv"     # per-case log, written AS WE GO (mid-run kill)
RUNLOGS="$WORK/writepath_runlogs"           # full suite output per case, for forensics
POLWL="$WORK/writepath_worklist_pol.tsv"    # the DOMAIN — derived from the LIVE CATALOG
POLSNAP="$WORK/writepath_snapshot_pol.tsv"  # the embedded 33 — DRIFT TRIPWIRE ONLY (§7.2)
# ⛔ FIXED path, deliberately NOT under $WORK — see the Part 4 note on the trap below.
# $WORK is fresh per run by recipe, so a $WORK-relative sentinel is invisible to the next
# run and its check would pass vacuously. This one is found by whoever runs next.
SENTINEL="${AUTHZ_SWEEP_SENTINEL:-${TMPDIR:-/tmp}/authz-writepath-INFLIGHT.sql}"
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ CASES: SET-NESS, NOT VALUE — captured BEFORE the default (ADR 0192; the same distinction
# ADR 0189 D6 made for RESET_EVERY, and for the same reason). Until 2026-09-07 this line read
# `CASES="${CASES:-}"` and EVERY branch keyed on `[ -n "$CASES" ]`, so `CASES=""` was
# INDISTINGUISHABLE FROM `CASES` UNSET. That is not a cosmetic gap:
#
#   CASES="$(bash scripts/door-sweep-cases.sh …)"   # deriver emitted nothing / exited 1 or 3
#
# — the caller CLAUDE.md §6 step 1 actually prescribes, and whose exit code IS the "no gate
# changed" claim — yields the empty string, which then selected EVERYTHING: a full ~120-case
# sweep, opening the COMMITTED baseline for write (SUBSET_RUN came from `[ -n "$CASES" ]`),
# with the `exit 3 UNPROVEN` door below UNREACHABLE from that caller. A correct door nothing
# can reach, composed with reading a gate instead of gating on it.
#
# THE RULE: three states, never two.
#   CASES unset              -> FULL run   (selects everything; may write the committed baseline)
#   CASES set, non-empty     -> SUBSET run (scratch only)
#   CASES set, EMPTY         -> SUBSET run, selects NOTHING -> SEL_TOTAL=0 -> exit 3 UNPROVEN
# ⚠ `CASES=` set-and-empty is treated as a SUBSET run for placement purposes on purpose: an
# explicitly-empty selection must never be able to open the committed baseline for write, even
# if a later change let it past the domain gate.
# ⛔ p0-authz-door-audit.sh carries the IDENTICAL defect at its own `[ -n "$CASES" ]`. It is
# FILED, NOT FIXED here (FUP-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN): that harness was
# closed by Batch 2 and QA-approved, and fixing one of two would read as fixing the class.
# ─────────────────────────────────────────────────────────────────────────────────────
CASES_EXPLICIT=0; [ -n "${CASES+x}" ] && CASES_EXPLICIT=1
CASES="${CASES:-}"                          # optional subset filter
if [ "$CASES_EXPLICIT" = "1" ] && [ -z "$CASES" ]; then
  SELECTION_SOURCE="CASES set and EMPTY -> selects NOTHING (UNPROVEN, exit 3). ⛔ NOT a full run."
elif [ "$CASES_EXPLICIT" = "1" ]; then
  SELECTION_SOURCE="CASES set to \"$CASES\" -> SUBSET run (scratch report only)."
else
  SELECTION_SOURCE="CASES UNSET -> FULL run over the whole domain."
fi
DRYRUN="${DRYRUN:-0}"
FINDINGS_COMMITTED="$ROOT/docs/reviews/authz-writepath-audit-findings.md"

# ─────────────────────────────────────────────────────────────────────────────────────
# BOUNDED TAIL DRIFT — RESET_EVERY, ported from p0-authz-door-audit.sh (ADR 0191 D8),
# which took it from c2-command-door-neutralizer.sh. ⛔ PORTED, NOT INHERITED: Batch 0's
# closure was mis-scoped to the C2 harness alone and Batch 2's run 1 was VOIDED by a 78-row
# drift tail with no originating case. This arm had ZERO occurrences of RESET_EVERY until
# 2026-09-07, so a 120-case sweep here carried unbounded drift.
#
# §7.15 is a DETECTOR, not a PREVENTER: BASE_FILES/BASE_TESTS are captured once, so drift is
# converted into ERROR and the tail is simply NOT MEASURED. Two mechanisms, neither covering
# the other:
#   · RESET_EVERY  — reset the DB every N cases and RE-CAPTURE the baseline, bounding the
#                    drift any verdict can carry to N cases instead of to the whole run;
#   · the retry net — a shape-moved ERROR resets and re-runs that ONE case: a GENUINE
#                    neutralization failure reproduces after a fresh reset, drift does not.
#
# ⛔ SET-NESS, NOT VALUE, captured BEFORE the default: one line later, `RESET_EVERY=20` typed
# by an operator and `RESET_EVERY` defaulted to 20 are the SAME STRING, which is the exact
# fact this gate turns on. THE RULE (ADR 0189 D6 as re-ruled 2026-09-04, adopted unchanged):
# a NON-SUBSET run resets every RESET_EVERY (default 20); a SUBSET run resets ONLY if
# RESET_EVERY is set EXPLICITLY; `0` disables everywhere.
#
# ⚠ WHY 20, stated honestly: there is NO tuning rationale on record anywhere in this program.
# 20 is Batch 0's value, adopted unchanged by C2 and by the door arm; the only recorded
# reasoning is about SET-NESS, not magnitude. Keeping it unchanged is the conservative choice
# and it keeps this run's figures comparable with the door sweep's. Consequences HERE:
# 5 scheduled resets over 120 cases (DONE ∈ {21,41,61,81,101}), ~15 min, and any verdict's
# accumulated drift bounded to ≤20 preceding suite runs. The reset is cheap insurance whose
# value is a BOUND, not an observed symptom — and its ABSENCE is what voided the door run 1.
# ─────────────────────────────────────────────────────────────────────────────────────
RESET_EVERY_EXPLICIT=0; [ -n "${RESET_EVERY+x}" ] && RESET_EVERY_EXPLICIT=1
RESET_EVERY="${RESET_EVERY:-20}"   # 0 disables
RESETS=0
DONE=0
# ⛔ ONE predicate, derived once and read by all three sites (the gate inside periodic_reset,
# the retry net, the summary banner). Three hand-written copies of the same condition is how a
# banner comes to describe a rule the code no longer implements.
resets_enabled () {   # rc 0 = a reset is allowed on this run; rc 1 = suppressed
  [ "$RESET_EVERY" != "0" ] || return 1
  [ "$SUBSET_RUN" != "1" ] || [ "$RESET_EVERY_EXPLICIT" = "1" ]
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ A SUBSET RUN MUST NOT WRITE THE COMMITTED BASELINE
#    (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE — fix (a), 2026-08-26; identical in all
#     four p0-authz-*-audit.sh sweeps, which share the defect by construction.)
#
# `emit_report` ends in a TRUNCATING redirect into the file above, which is COMMITTED.
# With `CASES=` set — the diff-scoped run CLAUDE.md §6 step 1 mandates EVERY PHASE — that
# redirect replaced the full audit with the subset (measured on the door sweep 2026-08-25:
# 699 lines -> 90). ⛔ Silent AND self-concealing: `FROMFINDINGS=1` arms of
# p0-authz-invariant.sh compare this committed file to an allowlist and RE-MEASURE
# NOTHING, so against a truncated file they see fewer gates, find them all allowlisted,
# and report HOLDS — the arm gets GREENER as the baseline gets EMPTIER.
# ⚠ $BLINDS_TSV moves too: the invariant's non-FROMFINDINGS arm reads
# `$WORK/blinds_writepath.tsv` as a FULL-sweep result. The property is "never overwrite
# the artefact a later arm reads back as a baseline"; committed vs scratch is not part of it.
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ KEYED ON SET-NESS (`CASES_EXPLICIT`), NOT on `[ -n "$CASES" ]`. With the old value test an
# explicitly-EMPTY CASES took the else-branch and pointed $FINDINGS at the COMMITTED baseline.
# ⛔ A FUNCTION, so SELFTEST can EXERCISE the placement rule rather than restate it. A second
# hand-written copy of this condition inside the self-test would prove only that I can type the
# same `if` twice.
set_placement () {   # reads CASES_EXPLICIT -> sets SUBSET_RUN, FINDINGS, BLINDS_TSV
  if [ "$CASES_EXPLICIT" = "1" ]; then
    SUBSET_RUN=1
    FINDINGS="$WORK/authz-writepath-audit-findings.SUBSET.md"
    BLINDS_TSV="$WORK/blinds_writepath.SUBSET.tsv"
  else
    SUBSET_RUN=0
    FINDINGS="$FINDINGS_COMMITTED"
    BLINDS_TSV="$WORK/blinds_writepath.tsv"
  fi
}
set_placement


# ⛔ WORKSPACE PRECONDITION — a hard failure, never a warning.
# Until 2026-08-24 the default above was one Windows session's scratchpad path, committed:
# on every other machine `mkdir -p` failed, `set -e` is deliberately off here, and each
# arm's `comm`/`wc` against the missing files produced EMPTY sets — which every arm reads
# as "nothing unaccounted for". The gate printed `INVARIANT HOLDS` and exited 0 having
# measured nothing at all. ⚠ This is CLAUDE.md §6 step 1, so the vacuous pass was wearing
# the badge of a mandatory gate. The default is now TMPDIR-based (matching
# `e2e-prod-gate.sh`), but a bad `WORK=` from the environment would re-create the hole —
# so the WRITABILITY of the directory is asserted, not assumed. Probe, never infer.
if ! mkdir -p "$WORK" 2>/dev/null || ! : > "$WORK/.writable" 2>/dev/null; then
  echo "FATAL: WORK directory is not usable: $WORK" >&2
  echo "       Every arm writes its census/findings there; without it this gate reports" >&2
  echo "       INVARIANT HOLDS having measured NOTHING. Set WORK=<writable dir> and re-run." >&2
  exit 2
fi
rm -f "$WORK/.writable"
mkdir -p "$RUNLOGS"

# ─────────────────────────────────────────────────────────────────────────────────────
# A FULL RUN MERGES, IT DOES NOT REPLACE (FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-
# ANNOTATIONS). ADR 0153 sent a SUBSET run's report to scratch — the subset half only, by
# design. The FULL half still emitted the committed file through a truncating redirect, and
# these baselines are NOT purely generated. `emit_report` now writes the GENERATED report to
# $WORK and the shared helper folds it into a snapshot of the committed baseline.
# ⛔ THE SNAPSHOT IS TAKEN ONCE, HERE. `emit_report` runs after EVERY case; merging into an
# already-merged file would compound the CARRIED block and make the result depend on how many
# cases had run. Merging always against the ORIGINAL baseline makes each emit idempotent —
# and it means a mid-run kill leaves a coherent PARTIAL report that still carries the
# hand-authored material.
# ─────────────────────────────────────────────────────────────────────────────────────
MERGE_LIB="$ROOT/scripts/lib/merge-findings-baseline.sh"
GENERATED="$WORK/authz-writepath-audit-findings.generated.md"
BASELINE_SNAPSHOT="$WORK/authz-writepath-audit-findings.baseline.md"
MERGE_FAILED=0
if [ -f "$FINDINGS_COMMITTED" ]; then cp "$FINDINGS_COMMITTED" "$BASELINE_SNAPSHOT"; else : > "$BASELINE_SNAPSHOT"; fi

# THE SECOND LOCK — a different KIND from the first: repointing $FINDINGS states the
# INTENT, this measures the OUTCOME (bytes checksummed now, re-checked on every exit).
baseline_sum () {
  if [ -f "$FINDINGS_COMMITTED" ]; then cksum < "$FINDINGS_COMMITTED"; else echo "ABSENT"; fi
}
BASELINE_SUM="$(baseline_sum)"
verify_baseline_untouched () {   # subset runs only; a mismatch ESCALATES to ABORT (2)
  [ "$SUBSET_RUN" = "1" ] || return 0
  local now; now="$(baseline_sum)"
  if [ "$now" != "$BASELINE_SUM" ]; then
    echo "*** FATAL: the COMMITTED baseline CHANGED during a subset run:" >&2
    echo "      $FINDINGS_COMMITTED" >&2
    echo "    A CASES= run must never write it (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE)." >&2
    echo "    Restore it and re-run before reading ANY later FROMFINDINGS arm:" >&2
    echo "      git checkout -- $FINDINGS_COMMITTED" >&2
    return 1
  fi
  echo "    committed baseline VERIFIED unchanged (cksum): $FINDINGS_COMMITTED"
  return 0
}
trap 'verify_baseline_untouched || exit 2' EXIT

echo "SELECTION-SOURCE: $SELECTION_SOURCE"
if [ "$SUBSET_RUN" = "1" ]; then
  echo "--------------------------------------------------------------------------------"
  echo "⚠ SUBSET RUN — CASES=\"$CASES\". This run writes to SCRATCH, never to the baseline."
  echo "    subset report : $FINDINGS"
  echo "    subset BLINDs : $BLINDS_TSV"
  echo "    COMMITTED baseline is NOT opened for write and stays UNTOUCHED:"
  echo "      $FINDINGS_COMMITTED"
  echo "    ⛔ A FROMFINDINGS arm does NOT cover this run: it re-measures nothing and reads"
  echo "       the COMMITTED file, which this run deliberately did not update."
  echo "    To fold these verdicts in, MERGE them into the baseline (ADR 0079 Amendment 1)"
  echo "    — never copy the subset file over it."
  echo "--------------------------------------------------------------------------------"
else
  # ⛔ THIS DETECTOR UNDER-REPORTED, WHICH IS WORSE THAN FINDING NOTHING — it printed a
  # number, and the number was wrong. Measured on HEAD 2026-09-02: the committed baseline
  # carries TWO hand-added blocks and the pattern matched ONE. The miss is the block that
  # matters most: `> ⚠ **HAND-MERGED, 2026-08-06 …`, a BLOCKQUOTE (neither `<!--` nor
  # `## Note`), which carries the `set_commission_oversight` verdict that has nowhere else
  # ⛔ THIS WARNING USED TO COUNT WITH A FILTER, AND THE NUMBER WAS WRONG. On the door
  # baseline `^(<!--|## Note)` matched 8 and this file's own wider pattern matched 16 (both
  # measured 2026-09-05) — and by the property ("any line this generator did not produce")
  # that file carries eight KINDS, most of which neither pattern sees. A warning whose number
  # comes from a filter is only as true as the filter, so the COUNT has moved to the merge,
  # where the complement is actually computable, and this line no longer asks the operator to
  # do anything by hand.
  echo "--------------------------------------------------------------------------------"
  echo "FULL SWEEP — this run MERGES into the committed baseline; it does not replace it."
  echo "    baseline  : $FINDINGS_COMMITTED  (snapshotted to \$WORK before the first case)"
  echo "    generated : $GENERATED"
  echo "    Every line of the baseline this generator does not produce is re-inserted, and"
  echo "    the merge ABORTS rather than write an output that lost one. The count of"
  echo "    preserved hand-authored lines is printed by the merge itself, per emit."
  echo "--------------------------------------------------------------------------------"
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ ONE CONNECTION ROLE, AND A DETECTOR THAT SAYS SO WHEN THAT IS NOT ENOUGH (ADR 0192).
#
# ⚠ THE HISTORY IS THE LESSON, so it is kept rather than tidied away. A superuser escalation
# was designed, approved and BUILT here on 2026-09-07, on this inference:
#
#   `ALTER POLICY` requires ownership; measured on the live catalog, `storage.objects` is owned
#   by `supabase_storage_admin`, `pg_has_role('postgres', relowner, 'USAGE')` = **f**, `postgres`
#   is `rolsuper=f` and is not a member of that role. ⇒ the three `storage.objects` INSERT
#   policies (in this arm's domain since 2026-09-02, and in NO other arm's domain at all) must
#   land as `ERROR — must be owner of table objects`, and stay unverdicted.
#
# EVERY MEASURED FACT ABOVE IS TRUE AND THE CONCLUSION IS FALSE. The harness at HEAD, with no
# escalation, swept all three end to end as plain `postgres`: opened, suite ran, COVERED ×3,
# restores byte-exact, bare rc 0. THE MECHANISM, named rather than left as "it works somehow":
# **supautils**. This stack sets `supautils.policy_grants = {"postgres":[… "storage.objects" …]}`
# and the extension's utility hook grants POLICY DDL on Supabase-managed tables to the
# privileged role ENTIRELY OUTSIDE `pg_class.relowner`.
#
# ⭐ THE TRANSFERABLE RULE: **ownership is a proxy, not the property.** A permission question is
# answered by ATTEMPTING the permission, or by reading EVERY grant path — never by reading
# `relowner` alone. (Same shape as: a predicate quoted at the wrong grain; text is not truth —
# resolve the VALUE, not the noun.)
#
# SO: no escalation, no superuser, no second connection. `psql_c`/`psql_f` connect as $PSQL_ROLE
# for all 107 policies and all 13 guards, exactly as they did before. The corrected predicate is
# kept — it is better than the ownership test — but DEMOTED FROM A ROUTER TO A DETECTOR:
#
#   * it never chooses a role and never works around anything;
#   * when it says a policy is unopenable it emits a LOUD FINDING naming WHICH HALF failed and
#     for WHICH ROLE, and that policy is recorded UNVERDICTED (an ERROR row, which makes the run
#     DIRTY at exit 1). Silence, or a quiet workaround, is exactly what this must never do.
#
# ⚠ IT FIRES ON 0 OF 107 ON THIS STACK. A detector that finds nothing is a dead instrument
# reading as an all-clear until it is PROVEN able to find something, so it is proven by a PLANT
# in a scratch copy (never the real tree), paired with a clean-tree negative control and a
# discrimination half. See ADR 0192 and FUP-WRITEPATH-BASELINE-POLICY-DDL-DETECTOR-DORMANT.
# ─────────────────────────────────────────────────────────────────────────────────────
PSQL_ROLE="${AUTHZ_SWEEP_ROLE:-postgres}"              # the ONLY connection role

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U "$PSQL_ROLE" -d postgres -tA -P pager=off "$@"; }
# Run an SQL file inside the container (avoids all shell-quoting of quals/bodies).
psql_f () {
  docker cp "$1" "$DB:/tmp/_wp_p0mut.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U "$PSQL_ROLE" -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_wp_p0mut.sql 2>&1
}

# The two grant routes to POLICY DDL, each read LIVE from the server, each reported SEPARATELY
# so a failure can name its half. ⛔ Never a schema name, never a list of policy names: both
# halves come from the catalog/GUC at run time, so a change on either route is followed.
#   (a) OWNERSHIP     — the role has privs of `pg_class.relowner`;
#   (b) SUPAUTILS     — `nsp.tbl` is in `supautils.policy_grants` for that role.
POLICY_DDL_OWNER_SQL="(pg_has_role('§ROLE§', c.relowner, 'USAGE'))"
POLICY_DDL_SUPAUTILS_SQL="(coalesce((current_setting('supautils.policy_grants', true)::jsonb -> '§ROLE§')
                                     @> to_jsonb(n.nspname||'.'||c.relname), false))"
ddl_sql_for () {  # $1 = one of the two templates above, $2 = role literal
  printf '%s' "${1//§ROLE§/$2}"
}

# ⛔ A DETECTOR, NOT A ROUTER. rc 0 = $PSQL_ROLE can ALTER POLICY here (the ordinary case, 107
# of 107 on this stack). rc 1 = it CANNOT, and DDL_BLOCK_WHY names which half said no, for which
# role, with the owner — the caller then emits the loud finding and leaves the policy UNVERDICTED.
# It does not escalate, substitute a role, skip, or otherwise make the condition go away.
DDL_OWNER=""; DDL_OWNER_OK=""; DDL_SUPAUTILS_OK=""; DDL_WHY=""; DDL_BLOCK_WHY=""
policy_ddl_detector () {   # $1 = schema   $2 = table
  local r
  DDL_OWNER=""; DDL_OWNER_OK=""; DDL_SUPAUTILS_OK=""; DDL_WHY=""; DDL_BLOCK_WHY=""
  r=$(psql_c -c "select pg_get_userbyid(c.relowner)||'|'||
                        (case when $(ddl_sql_for "$POLICY_DDL_OWNER_SQL"     "$PSQL_ROLE") then 1 else 0 end)||'|'||
                        (case when $(ddl_sql_for "$POLICY_DDL_SUPAUTILS_SQL" "$PSQL_ROLE") then 1 else 0 end)
                   from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = '$1' and c.relname = '$2';" 2>/dev/null | head -1)
  DDL_OWNER="$(printf '%s' "$r" | cut -d'|' -f1)"
  DDL_OWNER_OK="$(printf '%s' "$r" | cut -d'|' -f2)"
  DDL_SUPAUTILS_OK="$(printf '%s' "$r" | cut -d'|' -f3)"
  if [ -z "$DDL_OWNER" ]; then
    DDL_BLOCK_WHY="relowner lookup FAILED for $1.$2 as role=$PSQL_ROLE (the relation did not resolve)"
    return 1
  fi
  if [ "$DDL_OWNER_OK" = "1" ]; then
    DDL_WHY="role=$PSQL_ROLE via ownership (owner=$DDL_OWNER)"; return 0
  fi
  if [ "$DDL_SUPAUTILS_OK" = "1" ]; then
    DDL_WHY="role=$PSQL_ROLE via supautils.policy_grants (owner=$DDL_OWNER)"; return 0
  fi
  DDL_BLOCK_WHY="role=$PSQL_ROLE can ALTER POLICY on $1.$2 by NEITHER route — ownership=NO (owner=$DDL_OWNER, pg_has_role USAGE false), supautils.policy_grants=NO ($1.$2 absent from the GUC for '$PSQL_ROLE')"
  return 1
}
# The loud finding. ⛔ stderr AND stdout: a run's log is read as one stream, and a finding that
# only reaches stderr is invisible to a caller that captured stdout.
ddl_block_finding () {   # $1 = schema  $2 = table  $3 = policy name
  echo "*** POLICY-DDL BLOCKED — $1.$2.$3 is UNVERDICTED. NOT swept, NOT a pass, NOT skipped."
  echo "    $DDL_BLOCK_WHY"
  echo "    ⛔ This case was NOT worked around. The harness has no second role and does not want"
  echo "       one: the previous design escalated to a superuser on a premise that measurement"
  echo "       refuted (ADR 0192). Fix the grant, or record this policy as out of reach and say"
  echo "       which arm covers it instead. An unverdicted policy is a hole, not a result."
  echo "*** POLICY-DDL BLOCKED — $1.$2.$3 UNVERDICTED: $DDL_BLOCK_WHY" >&2
}
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' ; }

# ⛔ THREE STATES, NOT TWO. The old body was `[ -z "$CASES" ] && return 0`, which selects
# EVERYTHING for an explicitly-empty CASES — the defect above. An UNSET CASES still selects
# everything (that is a full run); a SET-and-EMPTY CASES selects NOTHING, which is what makes
# the SEL_TOTAL==0 / exit 3 UNPROVEN door reachable from the caller that produces it.
want () {  # $1 = match key (guard proname or policy name); rc 0 = selected
  [ "$CASES_EXPLICIT" = "1" ] || return 0      # CASES unset -> full run, everything selected
  [ -n "$CASES" ] || return 1                  # CASES set and EMPTY -> nothing selected
  local k
  for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 1 data: the 7 guards. Keyed by proname. guard_sig -> the regprocedure identity used
# to resolve the OID (value, not noun — survives rename). emit_neut_guard -> the FULL
# hand-written neutralized CREATE OR REPLACE, header copied BYTE-FOR-BYTE from the
# pg_get_functiondef snapshot (⚠ assert_meeting_staff_admin is STABLE and NOT SECURITY
# DEFINER — do not "fix" it), body with the authz raise removed.
# ─────────────────────────────────────────────────────────────────────────────────────
GUARD_KEYS="assert_capa_writable assert_meeting_staff_admin assert_interview_writable assert_rca_writable assert_session_writable assert_referral_draft_writable assert_referral_target_acts set_commission_oversight ensure_professional_participant create_external_participant set_primary_subject create_professional_profile set_professional_link_state"

guard_sig () {
  case "$1" in
    assert_capa_writable)           echo "app.assert_capa_writable(uuid)";;
    assert_meeting_staff_admin)     echo "app.assert_meeting_staff_admin(uuid)";;
    assert_interview_writable)      echo "app.assert_interview_writable(uuid)";;
    assert_rca_writable)            echo "app.assert_rca_writable(uuid)";;
    assert_session_writable)        echo "app.assert_session_writable(uuid)";;
    assert_referral_draft_writable) echo "app.assert_referral_draft_writable(uuid)";;
    assert_referral_target_acts)    echo "app.assert_referral_target_acts(uuid,text[])";;
    # QO·A (ADR 0100 D9; Amendment 5 frozen-list scope-in): the oversight door is a
    # raise-guard-shaped write door — its 42501 authority block is the whole boundary.
    set_commission_oversight)       echo "public.set_commission_oversight(uuid,text)";;
    # ETH·E4 (ADR 0108). Three write doors whose 42501/HC0E4 authority block IS the
    # whole boundary. They are scoped in here because NO other arm can see them:
    # ARM=census's domain is `prosecdef` functions returning bool or rows, and these
    # return uuid/void (FUP-AFF-1 / ADR 0079 Amendment 5); the door audit's predicate
    # arm is boolean-only for the same reason. Without these entries their coverage
    # was one-time and by hand, not standing.
    ensure_professional_participant) echo "public.ensure_professional_participant(uuid)";;
    create_external_participant)     echo "public.create_external_participant(uuid,text,text)";;
    set_primary_subject)             echo "public.set_primary_subject(uuid)";;
    # AE4.7c (matrix § 12.8.5) — the two remaining doors of the SAME family, scoped in for
    # the SAME reason the three above were: they return uuid/void, so ARM=census's domain
    # (prosecdef returning bool or rows) and the door audit's boolean-only predicate arm both
    # exclude them, and their 42501 authority block IS the whole boundary.
    # ⭐ These two are where AE4.7c's semantics actually LIVE — one gained the new row-43 gate,
    # the other gained the `link_state = 'unknown'` bound. Leaving them out would have meant the
    # increment's own doors were the ones with no standing arm.
    create_professional_profile)     echo "public.create_professional_profile(uuid,text,text,text,text,text,text,uuid)";;
    set_professional_link_state)     echo "public.set_professional_link_state(uuid,text,uuid)";;
    *) echo "";;
  esac
}

emit_neut_guard () {
  case "$1" in
    assert_capa_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_capa_writable(p_capa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
begin
  if (select id from public.capa_plan where id = p_capa_id) is null then
    raise exception 'plano de ação não encontrado' using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_capa gate opened).
end;
$function$;
SQL
    ;;
    assert_meeting_staff_admin) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_meeting_staff_admin(p_meeting_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
begin
  v_commission_id := app.commission_of_meeting(p_meeting_id);
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.is_staff_admin_of gate opened); return kept.
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_interview_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_interview_writable(p_interview_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id
  from public.case_interviews where id = p_interview_id;
  if v_commission_id is null then
    raise exception 'entrevista % não encontrada', p_interview_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_interview gate opened); return kept.
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_rca_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_rca_writable(p_rca_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.rca where id = p_rca_id;
  if v_event_id is null then
    raise exception 'análise de causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_rca gate opened); return kept.
  return v_event_id;
end;
$function$;
SQL
    ;;
    assert_session_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_session_writable(p_session_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_interview_id uuid;
  v_commission_id uuid;
begin
  select interview_id into v_interview_id
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT (SPECIAL): the original body's ONLY authz is the delegated call
  -- `return app.assert_interview_writable(v_interview_id)`. Leaving it intact would let the
  -- un-neutralized interview guard enforce authz and MASK session blindness. We replace it
  -- with a direct, un-gated commission lookup returning the SAME value -> the session gate
  -- is isolated and opened.
  select commission_id into v_commission_id
  from public.case_interviews where id = v_interview_id;
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_referral_draft_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_referral_draft_writable(p_referral_id uuid)
 RETURNS case_referral
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_manage_referral_source gate opened);
  -- the non-authz workflow-STATE guard (status = 'draft') is PRESERVED.
  if v_referral.status <> 'draft' then
    raise exception 'o encaminhamento não está em rascunho' using errcode = 'HC070';
  end if;
  return v_referral;
end;
$function$;
SQL
    ;;
    assert_referral_target_acts) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_referral_target_acts(p_referral_id uuid, p_expected text[])
 RETURNS case_referral
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_manage_referral_target gate opened);
  -- the non-authz workflow-STATE guard (status = any(p_expected)) is PRESERVED.
  if not (v_referral.status = any (p_expected)) then
    raise exception 'o encaminhamento não está no estado necessário para esta ação'
      using errcode = 'HC070';
  end if;
  return v_referral;
end;
$function$;
SQL
    ;;
    set_commission_oversight) cat <<'SQL'
CREATE OR REPLACE FUNCTION public.set_commission_oversight(p_commission_id uuid, p_oversight text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_comm public.commissions;
begin
  select * into v_comm from public.commissions where id = p_commission_id;
  if v_comm.id is null then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;

  -- P0-WRITEPATH-NEUT: authz raise removed (the is_hospital_admin_of OR
  -- is_org_admin_of 42501 block — ADR 0100 D9 — opened). Validation, the GUC
  -- bracket and the audit verb are PRESERVED (non-authz workflow).
  if p_oversight is null or p_oversight not in ('visible', 'excluded') then
    raise exception 'classificação de supervisão inválida' using errcode = 'HC0L0';
  end if;

  perform set_config('app.in_commission_rpc', 'on', true);
  update public.commissions set quality_oversight = p_oversight where id = p_commission_id;
  perform set_config('app.in_commission_rpc', 'off', true);

  perform app.audit_write('commission.oversight_changed', 'commission', p_commission_id, p_commission_id,
    'Supervisão da qualidade alterada',
    jsonb_build_object(
      'quality_oversight', p_oversight,
      'previous_quality_oversight', v_comm.quality_oversight));
end;
$function$;
SQL
    ;;
    # ─────────────────────────────────────────────────────────────────────────────
    # ETH·E4 doors. These three are neutralized from the LIVE CATALOG rather than
    # from a transcribed heredoc, deliberately: every other case above pins a full
    # body, which silently goes stale the moment the door is edited, and a stale
    # body reads as `ERROR run-shape!=baseline` (or, worse, as a false COVERED
    # because the suite failed for the wrong reason). Fetching `pg_get_functiondef`
    # and excising ONLY the authority raise keeps the neutralization faithful no
    # matter how the body evolves — and the splice ASSERTS it matched, so a renamed
    # gate aborts loudly instead of neutralizing nothing and reporting BLIND.
    # Restore is unaffected: the harness restores the bytes it captured beforehand.
    ensure_professional_participant|create_external_participant|set_primary_subject|create_professional_profile|set_professional_link_state)
      # ⛔ THESE `gate` STRINGS ARE A COPY OF THE LIVE BODY, AND AE4.7c FALSIFIED TWO OF THEM.
      # The neutralizer asserts its own match and exits ERROR when it fails, which is what
      # happened on the first AE4.7c sweep: `can_manage_professional` had been replaced by the
      # split's per-family gates and this harness still looked for the old text. ⚠ ERROR is not
      # a pass and it is not BLIND either — it means nothing was measured. Any migration that
      # rewrites one of these authority blocks owes an edit here in the same commit.
      case "$1" in
        ensure_professional_participant)
          sig='public.ensure_professional_participant(uuid)'
          gate='if not app.can_create_professional(v_prof.organization_id, auth.uid()) then' ;;
        create_external_participant)
          sig='public.create_external_participant(uuid,text,text)'
          gate='if not app.can_manage_external_participant(p_org, auth.uid()) then' ;;
        set_primary_subject)
          sig='public.set_primary_subject(uuid)'
          gate='if not (app.is_staff_admin_of(v_commission)) then' ;;
        create_professional_profile)
          sig='public.create_professional_profile(uuid,text,text,text,text,text,text,uuid)'
          gate='if not app.can_create_professional(p_org, auth.uid()) then' ;;
        # ⚠ THIS DOOR HAS TWO AUTHORITY BLOCKS AND THIS NEUTRALIZES THE POPULATION ONE.
        # AE4.7c added a second: `staff_admin` may act only while link_state = 'unknown'. The
        # arm's premise is "the authority block IS the whole boundary", and for this door that
        # is now two blocks — so a COVERED verdict here says the POPULATION gate is asserted
        # through, and says nothing about the bound. ⛔ The bound has its own deterministic
        # mutation twin (pgTAP 406 §5), which is named here so the partial coverage is a
        # recorded division of labour rather than an unnoticed half.
        set_professional_link_state)
          sig='public.set_professional_link_state(uuid,text,uuid)'
          gate='if not app.can_create_professional(v_org, auth.uid()) then' ;;
      esac
      cat <<SQL
do \$neut\$
declare v text;
begin
  select pg_get_functiondef('${sig}'::regprocedure) into v;
  -- P0-WRITEPATH-NEUT: open the authority gate (\`if false\` ⇒ the raise is dead).
  v := replace(v, '${gate}', 'if false then');
  if position('if false then' in v) = 0 then
    raise exception 'writepath neutralization did not match for ${sig} — the gate text '
                    'changed; fix guard_sig/emit_neut_guard rather than reporting a verdict';
  end if;
  execute v;
end
\$neut\$;
SQL
      ;;
    *) echo "-- unknown guard: $1" ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 2 data, part 1 of 2: THE DRIFT TRIPWIRE (§7.2) — 33 write policies, captured
# snapshot, embedded self-contained. ⛔ THIS IS NO LONGER THE DOMAIN. It was, and that is
# the defect this file's ARM 2 header records: a 33-row list bounded on
# `cmd in (INSERT,UPDATE,DELETE)` while 107 live policies can permit a write.
# Its remaining job is narrow and worth keeping: for a policy it names, the live predicate
# must byte-match it, else the committed verdict for that policy was earned against
# different text and neutralizing is unsafe (ERROR, do not open).
# Pipe-delimited (no '|' occurs in any qual/with_check of these 33); '-' = clause absent.
# Columns:  tbl | polname | cmd | qual | with_check
# The restore source is the live capture, never the snapshot.
# ─────────────────────────────────────────────────────────────────────────────────────
write_pol_snapshot () {
  cat > "$POLSNAP" <<'TSV'
capa_plan|capa_plan_delete|DELETE|app.can_write_capa(id, auth.uid())|-
capa_plan|capa_plan_update|UPDATE|app.can_write_capa(id, auth.uid())|app.can_write_capa(id, auth.uid())
case_interviews|case_interviews_delete|DELETE|app.can_write_interview(id, ( SELECT auth.uid() AS uid))|-
case_interviews|case_interviews_insert|INSERT|-|(app.is_staff_admin_of(commission_id) AND (NOT app.is_case_excluded(case_id, ( SELECT auth.uid() AS uid))))
case_interviews|case_interviews_update|UPDATE|app.can_write_interview(id, ( SELECT auth.uid() AS uid))|app.can_write_interview(id, ( SELECT auth.uid() AS uid))
case_referral|case_referral_delete_draft_source|DELETE|((status = 'draft'::text) AND app.can_manage_referral_source(id, ( SELECT auth.uid() AS uid)))|-
case_referral|case_referral_insert_source_coord|INSERT|-|app.is_staff_admin_of_for(source_commission_id, ( SELECT auth.uid() AS uid))
case_referral|case_referral_update_coord|UPDATE|(app.can_manage_referral_source(id, ( SELECT auth.uid() AS uid)) OR app.can_manage_referral_target(id, ( SELECT auth.uid() AS uid)))|(app.can_manage_referral_source(id, ( SELECT auth.uid() AS uid)) OR app.can_manage_referral_target(id, ( SELECT auth.uid() AS uid)))
meeting_agenda_items|meeting_agenda_items_staff_admin_delete|DELETE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|-
meeting_agenda_items|meeting_agenda_items_staff_admin_insert|INSERT|-|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_agenda_items|meeting_agenda_items_staff_admin_update|UPDATE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_attendees|meeting_attendees_staff_admin_delete|DELETE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|-
meeting_attendees|meeting_attendees_staff_admin_insert|INSERT|-|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_attendees|meeting_attendees_staff_admin_update|UPDATE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_cases|meeting_cases_staff_admin_delete|DELETE|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))|-
meeting_cases|meeting_cases_staff_admin_insert|INSERT|-|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))
meeting_cases|meeting_cases_staff_admin_update|UPDATE|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))
meeting_signatures|meeting_signatures_insert|INSERT|-|((signer_id = ( SELECT auth.uid() AS uid)) AND app.can_sign_meeting(attendee_id, ( SELECT auth.uid() AS uid)))
meetings|meetings_staff_admin_delete|DELETE|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))|-
meetings|meetings_staff_admin_insert|INSERT|-|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))
meetings|meetings_staff_admin_update|UPDATE|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))
notification_preferences|notification_preferences_insert_own|INSERT|-|(user_id = ( SELECT auth.uid() AS uid))
notification_preferences|notification_preferences_update_own|UPDATE|(user_id = ( SELECT auth.uid() AS uid))|(user_id = ( SELECT auth.uid() AS uid))
notifications|notifications_update_own|UPDATE|(user_id = ( SELECT auth.uid() AS uid))|(user_id = ( SELECT auth.uid() AS uid))
profiles|profiles_admin_insert|INSERT|-|app.is_admin()
profiles|profiles_admin_update|UPDATE|app.is_admin()|app.is_admin()
profiles|profiles_update_self|UPDATE|(id = ( SELECT auth.uid() AS uid))|(id = ( SELECT auth.uid() AS uid))
rca|rca_delete|DELETE|app.can_write_rca(id, auth.uid())|-
rca|rca_update|UPDATE|app.can_write_rca(id, auth.uid())|app.can_write_rca(id, auth.uid())
response_section_signoffs|signoffs_insert|INSERT|-|((signed_by = ( SELECT auth.uid() AS uid)) AND app.can_sign_section(response_id, section_id, ( SELECT auth.uid() AS uid)))
responses|responses_delete_own_draft|DELETE|((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'in_progress'::text))|-
responses|responses_insert_own|INSERT|-|((created_by = ( SELECT auth.uid() AS uid)) AND app.is_member_of(commission_id))
responses|responses_update_own_draft|UPDATE|((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'in_progress'::text))|(created_by = ( SELECT auth.uid() AS uid))
TSV
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 2 data, part 2 of 2: THE DOMAIN — every policy that can PERMIT A WRITE, read from
# the LIVE CATALOG. This is the fix for FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Part 3's
# remaining half; the ARM 2 header states the bound and what it excludes.
#
# Columns (8, pipe-delimited, every field newline-free BY CONSTRUCTION — identities and
# 0/1 flags only, never predicate text):
#   nsp | tbl | polname | cmd | haveq | havew | qtrue | wtrue
#
# ⛔ PREDICATE TEXT IS DELIBERATELY NOT IN THIS FILE, and that is not tidiness. A real
# qual spans lines — `form_versions_staff_admin_write`'s contains two newlines — so a
# line-oriented worklist carrying predicate text CANNOT represent the domain it is now
# bounded by. The per-case capture already fetches the live text into its own file; that
# stays the restore source, as it always was.
#
# ⛔ ON A LIVE RUN, A FAILED LIFT IS AN ABORT, NEVER A FALLBACK TO THE SNAPSHOT. Falling
# back would silently reinstate the 33-row blind domain and print a number about it — the
# precise shape of the defect being repaired here. (DRYRUN may fall back, LOUDLY, because
# its documented contract is zero DB access; it prints DOMAIN-SOURCE either way.)
# ⛔ AND THE ROW SHAPE IS ASSERTED, not assumed: a value carrying a newline or a `|` would
# split a row and shrink the domain silently. A malformed row aborts the lift.
# ─────────────────────────────────────────────────────────────────────────────────────
POLWL_SOURCE="(not built)"
build_pol_worklist () {
  local n bad
  psql_c -c "
    select n.nspname||'|'||c.relname||'|'||pol.polname||'|'||
           (case pol.polcmd when '*' then 'ALL' when 'a' then 'INSERT'
                            when 'w' then 'UPDATE' when 'd' then 'DELETE' end)||'|'||
           (case when pol.polqual      is null then 0 else 1 end)||'|'||
           (case when pol.polwithcheck is null then 0 else 1 end)||'|'||
           (case when pg_get_expr(pol.polqual,      pol.polrelid) = 'true' then 1 else 0 end)||'|'||
           (case when pg_get_expr(pol.polwithcheck, pol.polrelid) = 'true' then 1 else 0 end)
    from pg_policy pol
    join pg_class     c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where pol.polcmd <> 'r'
    order by 1;" 2>/dev/null | awk 'NF' > "$POLWL" || true
  n="$(grep -c . "$POLWL" 2>/dev/null | tr -d '[:space:]')"; n="${n:-0}"
  bad="$(awk -F'|' 'NF!=8' "$POLWL" 2>/dev/null | wc -l | tr -d '[:space:]')"; bad="${bad:-0}"
  if [ "$n" -eq 0 ] || [ "$bad" != "0" ]; then
    POLWL_SOURCE="LIFT FAILED (rows=$n malformed=$bad)"
    return 1
  fi
  POLWL_SOURCE="live catalog (pg_policy, polcmd <> 'r') — $n write-capable policies"
  return 0
}

# DRYRUN-ONLY fallback: reshape the drift snapshot into worklist columns so `DRYRUN=1`
# keeps its zero-DB contract on a machine with no stack. ⛔ It is an INCOMPLETE domain by
# construction and every caller says so out loud; it is never used on a live run.
snapshot_as_worklist () {
  awk -F'|' 'NF>=5 && $1 !~ /^#/ && $1 != "" {
      haveq = ($4 == "-") ? 0 : 1; havew = ($5 == "-") ? 0 : 1;
      qt = ($4 == "true") ? 1 : 0; wt = ($5 == "true") ? 1 : 0;
      printf "public|%s|%s|%s|%d|%d|%d|%d\n", $1, $2, $3, haveq, havew, qt, wt
    }' "$POLSNAP" > "$POLWL"
  POLWL_SOURCE="EMBEDDED SNAPSHOT — INCOMPLETE DOMAIN, DRYRUN fallback only"
}

# THE OPEN RULE (ARM 2 header). Sets OPENQ / OPENW: which clauses THIS arm opens for a
# given command. ⛔ `ALL` opens the WITH CHECK half only — its `using` also gates SELECT
# and belongs to the read arm, which already sweeps `polcmd in ('r','*')`.
open_rule () {   # $1=cmd  $2=haveq  $3=havew
  OPENQ=0; OPENW=0
  case "$1" in
    INSERT) OPENW="$3" ;;
    DELETE) OPENQ="$2" ;;
    UPDATE) OPENQ="$2"; OPENW="$3" ;;
    ALL)    OPENW="$3" ;;
  esac
}

# The drift reference for ONE policy, or empty when the snapshot does not name it.
# Matching is on (tbl, polname): the snapshot predates schema-qualification and every row
# in it is a `public` table.
snap_row () { awk -F'|' -v t="$1" -v p="$2" '$1==t && $2==p {print; exit}' "$POLSNAP"; }

# ─────────────────────────────────────────────────────────────────────────────────────
# DRYRUN — print every neutralization, ZERO DB access. Print BEFORE any preflight so the
# lead can eyeball the 7 bespoke guard bodies without a running stack.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "$DRYRUN" = "1" ]; then
  write_pol_snapshot
  # ⭐ DRYRUN IS NOW A FAITHFUL, ZERO-MUTATION PROBE OF THE **SELECTION**, which is what a
  # two-direction vacuity check on the domain needs: it prints the same ARM-DOMAIN line,
  # the same REQUESTED-BUT-MATCHED-NOTHING block and the same empty-domain verdict as the
  # live path, without opening a gate or running the suite. It reads the catalog (one
  # read-only SELECT) when a stack is up, and falls back to the snapshot — LOUDLY, and
  # with the domain named INCOMPLETE — when there is none, so its documented "runs without
  # a stack" contract survives.
  # ⛔ It exits 3 on an empty selection, exactly as the live path does. A "printed nothing,
  # exited 0" dry run is the same unreadable artefact as a sweep that measures nothing.
  if ! build_pol_worklist; then snapshot_as_worklist; fi
  echo "=== DRYRUN — neutralizations only, NO GATE OPENED, NO SUITE RUN ==="
  echo "DOMAIN-SOURCE policy arm: $POLWL_SOURCE"
  echo
  # ⛔ DERIVED FROM GUARD_KEYS, NEVER RE-TYPED (ADR 0192). This banner read a hardcoded `7`
  # while GUARD_KEYS held 13 and the loop directly beneath iterated all 13 — an EXECUTED code
  # path, and precisely what a human reads to decide a run is aimed correctly. This file's own
  # header warns about this exact recurrence ("a count in a comment is an assertion, and this
  # one was false for four additions"); it recurred, in the banner instead of the comment.
  # ⛔ A fresh literal would be the same defect with a newer number, so there is no literal.
  dr_gtot=$(printf '%s\n' $GUARD_KEYS | grep -c .)
  echo "############## ARM 1: $dr_gtot authz raise-guards (full neutralized CREATE OR REPLACE) ##############"
  for k in $GUARD_KEYS; do
    want "$k" || continue
    echo
    echo "===== $k  ->  $(guard_sig "$k") ====="
    emit_neut_guard "$k"
  done
  echo
  echo "############## ARM 2: write policies (ALTER POLICY opening the write clause) ##############"
  dr_gsel=0; for k in $GUARD_KEYS; do want "$k" && dr_gsel=$((dr_gsel + 1)); done
  dr_ptot=0; dr_psel=0
  while IFS='|' read -r nsp tbl polname cmd haveq havew qtrue wtrue; do
    [ -n "${polname:-}" ] || continue
    dr_ptot=$((dr_ptot + 1))
    want "$polname" || continue
    dr_psel=$((dr_psel + 1))
    open_rule "$cmd" "$haveq" "$havew"
    if [ "$OPENQ" = 0 ] && [ "$OPENW" = 0 ]; then
      printf -- '-- ⛔ NOT OPENABLE BY THIS ARM (reported ERROR on a live run): %s.%s.%s (%s)\n' \
        "$nsp" "$tbl" "$polname" "$cmd"
      continue
    fi
    vac=1
    { [ "$OPENQ" = 1 ] && [ "$qtrue" != 1 ]; } && vac=0
    { [ "$OPENW" = 1 ] && [ "$wtrue" != 1 ]; } && vac=0
    if [ "$vac" = 1 ]; then
      printf -- '-- SKIP (vacuous, the clause this arm opens is already true): %s.%s.%s (%s)\n' \
        "$nsp" "$tbl" "$polname" "$cmd"
      continue
    fi
    stmt="alter policy \"$polname\" on \"$nsp\".\"$tbl\""
    [ "$OPENQ" = 1 ] && stmt="$stmt using (true)"
    [ "$OPENW" = 1 ] && stmt="$stmt with check (true)"
    printf '%s;   -- %s%s\n' "$stmt" "$cmd" \
      "$([ -z "$(snap_row "$tbl" "$polname")" ] && printf '%s' '  [snapshot:ABSENT — no drift check]')"
  done < "$POLWL"
  echo
  echo "ARM-DOMAIN guard=$dr_gsel/$dr_gtot policy=$dr_psel/$dr_ptot"
  # ⚠ Same accounting as the live path (§7.17). A DRYRUN that silently ignores a requested
  # token is the Part-3 defect wearing a different hat.
  dr_unmatched=""
  if [ -n "$CASES" ]; then
    for tok in $CASES; do
      printf '%s\n' $GUARD_KEYS | grep -qxF "$tok" && continue
      cut -d'|' -f3 "$POLWL" | grep -qxF "$tok" && continue
      dr_unmatched="$dr_unmatched $tok"
    done
  fi
  [ -n "$dr_unmatched" ] && echo "    ⚠ REQUESTED BUT IN NO ARM'S DOMAIN:$dr_unmatched"
  if [ $((dr_gsel + dr_psel)) -eq 0 ]; then
    echo "=== DRYRUN RESULT: UNPROVEN (3) — the SELECTION is EMPTY. Nothing would be measured. ==="
    exit 3
  fi
  echo "=== DRYRUN done — a SELECTION, not a verdict. Guards in domain: $dr_gtot (2 excluded:"
  echo "    assert_meeting_roster_nonempty, assert_condition_value_codes = data validators). ==="
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# LIVE run.  Restore-on-exit trap (§7.5 shared-stack single-owner): a kill mid-run must
# not leave a gate OPEN. INFLIGHT points at the SQL that restores the current gate; cleared
# the instant its inline restore verifies. Set BEFORE neutralizing/opening.
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ This initializer must NOT touch $SENTINEL. A crashed previous run's sentinel is the
# ONLY evidence that a gate is open, and clearing it here would erase that evidence before
# the startup check above ever read it — a control deleting its own witness. The sentinel
# is removed at exactly one kind of moment: after a restore has been applied.
#
# ⛔ "ATTEMPTED" IS NOT "VERIFIED", 2026-09-04 (FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE).
# The old body dropped the sentinel once the restore had been ATTEMPTED — its own comment
# said so. The sentinel does survive a SIGKILL (no trap runs). It did NOT survive the
# incident's actual signal, a job-tree SIGTERM: there the trap DOES run, its `psql` child
# dies with the process group, the restore fails, and the only record that a gate is open is
# deleted in the same breath. Both p0 siblings had this shape.
#
# Now the sentinel is dropped only when psql_f exits 0 AND a probe re-read FROM THE CATALOG
# returns exactly the value captured before the gate was opened. arm_inflight records that
# probe beside the sentinel ($SENTINEL.probe / .want) so RECOVER=1 in a later process can
# verify too, instead of believing psql's exit code alone.
# ⛔ THERE IS NO `.role` SIDECAR, AND THAT IS DELIBERATE (ADR 0192, superseding the escalated
# design). The harness has ONE connection role, so a role recorded beside the sentinel could
# only ever hold one value — and a field that can only ever hold one value is a guard that can
# only ever read one value. It would look like a check and check nothing. The restore uses the
# same `psql_f` as the open, which is the same role by construction, not by agreement.
INFLIGHT=""
INFLIGHT_PROBE=""
INFLIGHT_WANT=""
arm_inflight () {   # $1 = restore .sql   $2 = probe SQL identifying the ORIGINAL catalog state
  INFLIGHT="$1"; INFLIGHT_PROBE="$2"
  INFLIGHT_WANT="$(psql_c -c "$2" 2>/dev/null)"
  cp -f "$1" "$SENTINEL"                            # Part 4: survives SIGKILL, which no trap does
  printf '%s' "$2"             > "$SENTINEL.probe"
  printf '%s' "$INFLIGHT_WANT" > "$SENTINEL.want"
}
disarm_inflight () {  # only ever after a restore has been VERIFIED
  INFLIGHT=""; INFLIGHT_PROBE=""; INFLIGHT_WANT=""
  rm -f "$SENTINEL" "$SENTINEL.probe" "$SENTINEL.want" 2>/dev/null || true
}
restore_inflight () {
  [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ] || return 0
  echo "  (trap: restoring the in-flight gate from $INFLIGHT as role $PSQL_ROLE)"
  local rc live
  psql_f "$INFLIGHT" >/dev/null 2>&1; rc=$?
  live=""
  [ -n "${INFLIGHT_PROBE:-}" ] && live="$(psql_c -c "$INFLIGHT_PROBE" 2>/dev/null)"
  if [ "$rc" = "0" ] && [ -n "${INFLIGHT_WANT:-}" ] && [ "$live" = "$INFLIGHT_WANT" ]; then
    echo "  restore VERIFIED against the catalog (psql rc=0, probe=$live)"
    disarm_inflight
    return 0
  fi
  cp -f "$INFLIGHT" "$SENTINEL.attempted" 2>/dev/null || true
  echo "*** RESTORE FAILED (psql rc=$rc; catalog probe='${live:-<unreadable>}' want='${INFLIGHT_WANT:-<none captured>}')" >&2
  echo "    ⛔ THE SENTINEL IS KEPT ON PURPOSE: $SENTINEL" >&2
  echo "       It is the only record that a gate is OPEN on this stack. Do NOT delete it." >&2
  echo "      RECOVER=1 bash $0        # re-apply it, then VERIFY in the catalog" >&2
  echo "      supabase db reset        # the blunt, certain option (recovered AE1.5)" >&2
  echo "    ⚠ Do not hunt the open policy with a COUNT — the discriminator is cmd <> 'SELECT'." >&2
  return 2
}
# ⚠ compound: this REPLACES the baseline-guard trap installed above, so it must carry
# that duty too, or a subset run loses its outcome check from here on.
#
# ⛔ PART 4 (FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED), measured the hard way 2026-08-27: a run
# KILLED between "open the gate" and "restore it" does not run an EXIT-only trap. AE1.5
# killed a contaminated run and left `meeting_cases.meeting_cases_staff_admin_update` at
# `qual=true wc=true` — a FOR UPDATE policy fully open to `authenticated` on the shared
# local stack, with NOTHING ANYWHERE REPORTING IT. It was recovered by `supabase db reset`
# and was nearly missed by a count: the degenerate-policy check returned 11, of which ten
# are `qual = true` BY DESIGN (vocabulary SELECT policies). Only ENUMERATING them showed
# the eleventh was an UPDATE policy with `wc=true`, which no lookup table has.
#
# TWO layers, because neither alone is enough:
#  1. Trap INT/TERM/HUP as well as EXIT. Covers Ctrl-C and an ordinary `kill`, which is
#     what "killed a contaminated run" actually means in practice.
#  2. A CRASH SENTINEL at a FIXED path (below), written BEFORE each gate is opened and
#     removed only after its restore verifies. SIGKILL and a power cut run no trap at all;
#     the sentinel is what survives them, and the next run REFUSES TO START while one
#     exists. That turns "an RLS policy is open and nothing reports it" into a loud stop.
# ⚠ The sentinel path must NOT live under $WORK: the recipe hands out a fresh
#   `WORK=…/authz-audit-$(date +%s)` per run, so a $WORK-relative sentinel would be
#   invisible to the very next run — the check would pass vacuously.
trap 'restore_inflight || exit 2; verify_baseline_untouched || exit 2' EXIT
trap 'echo; echo "*** SIGNAL — restoring the in-flight gate before exiting (§7.5 Part 4)."; restore_inflight; exit 2' INT TERM HUP

# ⚠ MEASURED 2026-09-07 on this stack: a full `supabase test db` is ~93 s wall (Files=262,
# Tests=8876), and a full CASE — suite + ~6 docker-exec round trips + the merge — is ~120 s.
# The "~23s" this comment carried for months was four times off and is the source of the
# "~50 min for 120 cases" budget quoted downstream. ⛔ RE-MEASURE, never quote.
run_suite () { ( cd "$ROOT" && supabase test db ) 2>&1; }

# ⛔ ENUMERATE, NEVER COUNT. A bare count of `qual='true' or with_check='true'` returns ~11 on
# a clean stack — ten vocabulary SELECT policies are `true` BY DESIGN — and reading that count
# as a baseline is how the AE1.5 fully-open UPDATE policy was nearly missed. The discriminator
# is `cmd <> 'SELECT'`, and it must be ZERO.
degenerate_write_policies () {
  psql_c -c "select schemaname||'.'||tablename||'.'||policyname||' ('||cmd||')'
               from pg_policies
              where (coalesce(qual,'') = 'true' or coalesce(with_check,'') = 'true')
                and cmd <> 'SELECT'
              order by 1;" 2>/dev/null | grep -vE '^$'
}

# classify OUTPUT -> sets globals VERDICT, FAILING, RUNFILES, RUNTESTS, SHAPE_MOVED
# ⛔ SHAPE_MOVED IS GLOBAL AND IS SET BY THE CLASSIFIER ITSELF (ADR 0192, mirroring ADR 0191
# D8). The retry net must fire on exactly the condition the classifier used, read from the
# classifier — never on a second hand-kept spelling of it, and never by matching the NOTE
# TEXT. Two copies of one condition is how a retry net comes to fire on a different set from
# the one the verdict was computed against.
# ⚠ THE DRIFT KEY ON THIS ARM IS `ERROR`, NOT the door arm's `NOTICED`: `classify` here has
# THREE outcomes, and a moved Files=/Tests= shape or a `Dubious` line yields ERROR. So a drift
# tail shows up here as a run of ERRORs — and ERROR already forces exit 1, which makes this
# arm LOUDER about drift than the door arm was, not quieter.
SHAPE_MOVED=0
classify () {
  local out="$1" res ft dubious
  SHAPE_MOVED=0
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  RUNFILES=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  RUNTESTS=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  dubious=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  FAILING=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' \
            | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  # §7.15: a run whose SHAPE differs from baseline (fewer files/tests, or Dubious) is an
  # ABORT — a harness bug (bad neutralization), NOT a BLIND/COVERED result.
  if [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    SHAPE_MOVED=1
  fi
  if [ -z "$res" ] || [ "$SHAPE_MOVED" = "1" ]; then
    VERDICT="ERROR"
  elif [ "$res" = "FAIL" ]; then
    VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then
    VERDICT="BLIND"
  else
    VERDICT="ERROR"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────────────
# SELFTEST — three arms on CONSTRUCTED inputs. No DB, no suite run, no gate opened, and the
# committed baseline is never opened for write. `SELFTEST=1 bash <this>` exits here.
#
# ⛔ GREEN ON ITS FIRST RUN IS A FINDING, NOT A PASS. Each table below was first run (i) with
# one expectation deliberately flipped and (ii) with the PRE-change predicate substituted, on
# a cmp-verified scratch copy, and both had to go NOT OK at bare rc 1 before the green was
# believed. A self-test that has never been shown to fail has not been shown to test anything.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "${SELFTEST:-0}" = "1" ]; then
  st_total=0; st_failed=0

  # ── ARM 1: classify() — THREE outcomes, plus the SHAPE_MOVED flag the retry net reads. ──
  # ⛔ THE CONTROL IS THE PAIR (same shape + PASS) -> BLIND vs (shape MOVED + PASS) -> ERROR.
  # Without both halves a green row would prove only "the classifier returns a token", not that
  # a moved shape is what turns a PASS into ERROR — which is the whole §7.15 doctrine. And the
  # SHAPE_MOVED column is asserted separately from the VERDICT: the retry net fires on
  # SHAPE_MOVED, so a classifier that got the verdict right and the flag wrong would retry the
  # wrong cases while every verdict row still read correctly.
  echo "=== SELFTEST: classify() — verdict AND the SHAPE_MOVED flag (no DB) ==="
  BASE_FILES=262; BASE_TESTS=8876
  st_case () {  # $1 label  $2 expected verdict  $3 expected SHAPE_MOVED  $4 constructed output
    st_total=$((st_total+1))
    classify "$4"
    if [ "$VERDICT" = "$2" ] && [ "$SHAPE_MOVED" = "$3" ]; then
      printf '  ok    %-32s -> %-8s shape_moved=%s\n' "$1" "$VERDICT" "$SHAPE_MOVED"
    else
      printf '  NOT OK %-31s -> %-8s shape_moved=%s (expected %s / %s)\n' \
        "$1" "$VERDICT" "$SHAPE_MOVED" "$2" "$3"; st_failed=$((st_failed+1))
    fi
  }
  st_ok="ok 1 - something
Files=262, Tests=8876, Result: "
  st_moved="Bad plan. You planned 35 tests but ran 11.
Files=262, Tests=8712, Result: "
  st_case "same shape + FAIL"    COVERED 0 "${st_ok}FAIL"
  st_case "same shape + PASS"    BLIND   0 "${st_ok}PASS"     # ⭐ THE CONTROL, half 1
  st_case "shape MOVED + PASS"   ERROR   1 "${st_moved}PASS"  # ⭐ THE CONTROL, half 2
  st_case "shape MOVED + FAIL"   ERROR   1 "${st_moved}FAIL"
  st_case "Dubious only + FAIL"  ERROR   1 "ok 1 - x
Dubious, test returned 2
Files=262, Tests=8876, Result: FAIL"
  st_case "no Result: line"      ERROR   0 "Files=262, Tests=8876"

  # ── ARM 2: resets_enabled() POLARITY (ADR 0192; the door arm's ADR 0191 D8 table). ──────
  # ⛔ THE CONTROL IS TRIAL A vs TRIAL B': same VALUE 20, same SUBSET, opposite SET-NESS,
  # opposite outcome. Without it a green table proves only "a subset gate exists", not that the
  # gate turns on set-ness — the one distinction a `RESET_EVERY="${RESET_EVERY:-20}"` written
  # ONE LINE EARLIER silently destroys.
  echo "=== SELFTEST: resets_enabled() — the reset gate's polarity (no DB) ==="
  rt_case () {  # $1 label  $2 SUBSET_RUN  $3 RESET_EVERY  $4 EXPLICIT  $5 expected (yes|no)
    local got; st_total=$((st_total+1))
    SUBSET_RUN="$2"; RESET_EVERY="$3"; RESET_EVERY_EXPLICIT="$4"
    if resets_enabled; then got=yes; else got=no; fi
    if [ "$got" = "$5" ]; then
      printf '  ok    %-46s -> resets=%s\n' "$1" "$got"
    else
      printf '  NOT OK %-45s -> resets=%s (expected %s)\n' "$1" "$got" "$5"; st_failed=$((st_failed+1))
    fi
  }
  rt_case "A  SUBSET, RESET_EVERY unset (defaulted 20)"   1 20 0 no
  rt_case "B  SUBSET, RESET_EVERY=1 EXPLICIT"             1 1  1 yes
  rt_case "B' SUBSET, RESET_EVERY=20 EXPLICIT"            1 20 1 yes  # ⭐ vs A: set-ness, not value
  rt_case "C  full run, RESET_EVERY unset (defaulted 20)" 0 20 0 yes
  rt_case "E  full run, RESET_EVERY=0"                    0 0  0 no
  rt_case "E' SUBSET,   RESET_EVERY=0 EXPLICIT"           1 0  1 no   # 0 disables EVERYWHERE

  # ── ARM 3: the CASES SELECTION — three states, and where each one WRITES (ADR 0192). ────
  # ⛔ THE CONTROL IS TRIAL A vs TRIAL C: the same VALUE (the empty string is what `$CASES`
  # holds in both) reached two ways — unset, and set-and-empty — with OPPOSITE selection and
  # OPPOSITE placement. That single distinction is the entire defect: a caller that captured
  # the case deriver's stdout without consuming its exit code got C and was given A.
  # ⚠ Placement is exercised through set_placement(), not restated here.
  echo "=== SELFTEST: CASES set-ness — selection AND placement (no DB) ==="
  sel_case () {  # $1 label  $2 CASES_EXPLICIT  $3 CASES  $4 expect want(responses_insert_own) yes|no
                 # $5 expect placement subset|committed
    local gotw gotp; st_total=$((st_total+1))
    CASES_EXPLICIT="$2"; CASES="$3"; set_placement
    if want "responses_insert_own"; then gotw=yes; else gotw=no; fi
    if [ "$FINDINGS" = "$FINDINGS_COMMITTED" ]; then gotp=committed; else gotp=subset; fi
    if [ "$gotw" = "$4" ] && [ "$gotp" = "$5" ]; then
      printf '  ok    %-44s -> selects=%-3s writes=%s\n' "$1" "$gotw" "$gotp"
    else
      printf '  NOT OK %-43s -> selects=%-3s writes=%s (expected %s / %s)\n' \
        "$1" "$gotw" "$gotp" "$4" "$5"; st_failed=$((st_failed+1))
    fi
  }
  sel_case "A  CASES UNSET (full run)"                    0 ""                      yes committed
  sel_case "B  CASES=\"responses_insert_own\" (subset)"     1 "responses_insert_own"  yes subset
  sel_case "B2 CASES=\"other_gate\" (subset, not this key)" 1 "other_gate"            no  subset
  sel_case "C  CASES=\"\" EXPLICIT  ⭐ vs A"                 1 ""                      no  subset

  echo "--- SELFTEST: $((st_total - st_failed))/$st_total ok, $st_failed failed ---"
  [ "$st_failed" -eq 0 ] || exit 1
  exit 0
fi

echo "=== P0 AUTHZ WRITE-PATH AUDIT — open each write gate, ask the WHOLE SUITE if anyone noticed ==="
echo "Repo: $ROOT"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ PART 4 — THE CRASH-SENTINEL CHECK. Runs FIRST, before the domain gate and long
# before any suite run: if the previous run died without restoring, an RLS policy or a
# raise-guard is OPEN RIGHT NOW on the shared local stack and nothing else will say so.
# ⛔ Refusing is the point. Sweeping on top of a contaminated catalog produces verdicts
# that look ordinary — the neutralization "worked", the suite ran, a number came out.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ -s "$SENTINEL" ]; then
  if [ "${RECOVER:-0}" = "1" ]; then
    echo "--- RECOVER=1: applying the abandoned restore from $SENTINEL ---"
    sed -n '1,40p' "$SENTINEL"
    # ⛔ 2026-09-04: the recovery is VERIFIED, not believed. arm_inflight leaves the probe
    #    that identifies the ORIGINAL state beside the sentinel, so this later process can
    #    re-read the catalog instead of trusting psql's exit code.
    # ⛔ ONE ROLE, SO NOTHING TO CHOOSE. The gate was opened as $PSQL_ROLE and is restored as
    #    $PSQL_ROLE — by construction, not by a recorded field. (The escalated design that
    #    needed a `.role` sidecar was withdrawn: ADR 0192.)
    echo "    restoring as role $PSQL_ROLE (this harness has exactly one connection role)."
    psql_f "$SENTINEL" >/dev/null 2>&1; rec_rc=$?
    rec_live=""; rec_want=""
    [ -s "$SENTINEL.probe" ] && rec_live="$(psql_c -c "$(cat "$SENTINEL.probe")" 2>/dev/null)"
    [ -s "$SENTINEL.want"  ] && rec_want="$(cat "$SENTINEL.want")"
    if [ "$rec_rc" = "0" ] && [ -n "$rec_want" ] && [ "$rec_live" = "$rec_want" ]; then
      mv -f "$SENTINEL" "$SENTINEL.recovered" 2>/dev/null || rm -f "$SENTINEL"
      rm -f "$SENTINEL.probe" "$SENTINEL.want" 2>/dev/null || true
      echo "*** RESTORE APPLIED and VERIFIED against the catalog (psql rc=0, probe=$rec_live)."
      echo "    ⚠ VERIFY IT ANYWAY, do not take this message as proof — re-read the gate from"
      echo "    the catalog (pg_policies / pg_get_functiondef). If in any doubt run"
      echo "    'supabase db reset', which is what recovered the AE1.5 incident."
      echo "    ⛔ Then re-run the sweep from scratch: every verdict from the killed run is void."
      exit 2
    fi
    echo "*** RESTORE FAILED (psql rc=$rec_rc; catalog probe='${rec_live:-<unreadable>}'" >&2
    echo "    want='${rec_want:-<no probe sidecar: this sentinel predates the verified-restore" >&2
    echo "    protocol, so it CANNOT be verified from here>}')." >&2
    echo "    The gate is STILL OPEN and the sentinel is KEPT. Run 'supabase db reset' now." >&2
    exit 2
  fi
  echo "*** ABORT — A PREVIOUS RUN DIED WITH A GATE STILL OPEN." >&2
  echo "    Sentinel: $SENTINEL" >&2
  echo "    It holds the SQL that restores it. The gate it names has been OPEN to" >&2
  echo "    'authenticated' on this stack since that run died." >&2
  sed -n '1,12p' "$SENTINEL" | sed 's/^/      | /' >&2
  echo "    Do ONE of:" >&2
  echo "      RECOVER=1 bash $0        # apply that restore, then VERIFY it in the catalog" >&2
  echo "      supabase db reset        # the blunt, certain option (recovered the AE1.5 incident)" >&2
  echo "    ⛔ Do not delete the sentinel to get past this. It is the only record that a" >&2
  echo "       gate is open; removing it restores nothing and re-hides the hole." >&2
  echo "    ⚠ Do not look for the open policy with a COUNT: the degenerate-policy check" >&2
  echo "      returns 11 on a clean tree, ten of them 'qual = true' BY DESIGN. Enumerate." >&2
  exit 2
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# §7.17 THE DOMAIN GATE — PORTED VERBATIM IN SEMANTICS FROM p0-authz-door-audit.sh.
# (FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Parts 2 + 3, both measured 2026-08-27 on AE1.5.)
#
# ⛔ WHAT WAS WRONG, stated so nobody "simplifies" this back out:
#  Part 2 — this harness printed `BLIND: 0  ERROR(harness): 13  SKIPPED: 0` and EXITED 0
#    having measured ZERO of the 22 requested write-layer cases. CLAUDE.md §6 step 1 says
#    in terms that "ERROR is not a pass", and the exit code said pass. That is the
#    "a gate that never SETS a non-zero exit" mechanism: the file simply ended on an echo.
#  Part 3 — worse. A CASES token ABSENT from the embedded worklist was silently ignored:
#    no ERROR, no warning, no mention in the summary. The harness could not distinguish
#    "I swept your case" from "your case is not in my worklist", AND REPORTED THE SECOND
#    AS THE FIRST — so handing it 52 cases and getting `13 COVERED, exit 0` read as
#    coverage of 52. Nine policies live in neither arm's domain and were found only
#    because the SIBLING refuses to end CLEAN; grepping this file for `never swept` /
#    `matched no gate` / `requested but` returned ZERO hits.
#
# ⛔ The sibling already did this correctly, so this is a PORT, not a second scheme (the
# FUP says so in terms). Same vocabulary, same exit codes, same closing sentence.
#
# The worklist is materialised HERE, ahead of the preflight, so an UNPROVEN run costs
# seconds rather than a full suite run — the snapshot is a heredoc and the domain lift is
# one read-only SELECT.
# ─────────────────────────────────────────────────────────────────────────────────────
write_pol_snapshot
if ! build_pol_worklist; then
  echo "*** ABORT — could not lift ARM 2's domain from the live catalog." >&2
  echo "    $POLWL_SOURCE" >&2
  echo "    ⛔ There is deliberately NO fallback to the embedded snapshot here. That" >&2
  echo "       snapshot is 33 of the 107 policies that can permit a write, and running" >&2
  echo "       against it would print a confident number about a third of the domain —" >&2
  echo "       which is the defect this arm was repaired for (Gate AE4 blocker 3)." >&2
  echo "    Start the local stack (container '$DB') and re-run." >&2
  exit 2
fi

# ⚠ The drift snapshot names 33 policies; the domain now holds every write-capable policy
# in the catalog. A snapshot row whose policy no longer exists is an ORPHAN — its committed
# verdict outlives its gate — so it is named here rather than left to be noticed by nobody.
SNAP_ORPHANS=""
while IFS='|' read -r s_tbl s_pol _rest; do
  [ -n "${s_pol:-}" ] || continue
  awk -F'|' -v t="$s_tbl" -v p="$s_pol" '$2==t && $3==p {found=1} END {exit !found}' "$POLWL" \
    || SNAP_ORPHANS="$SNAP_ORPHANS $s_tbl.$s_pol"
done < "$POLSNAP"

GUARD_TOTAL=0; GUARD_SEL=0
for g in $GUARD_KEYS; do
  GUARD_TOTAL=$((GUARD_TOTAL + 1))
  want "$g" && GUARD_SEL=$((GUARD_SEL + 1))
done
POL_TOTAL=0; POL_SEL=0; POL_NOSNAP=0
while IFS='|' read -r _nsp _tbl _pol _cmd _hq _hw _qt _wt; do
  [ -n "${_pol:-}" ] || continue
  POL_TOTAL=$((POL_TOTAL + 1))
  if want "$_pol"; then
    POL_SEL=$((POL_SEL + 1))
    [ -z "$(snap_row "$_tbl" "$_pol")" ] && POL_NOSNAP=$((POL_NOSNAP + 1))
  fi
done < "$POLWL"
SEL_TOTAL=$((GUARD_SEL + POL_SEL))

echo "--- domain: what this run will actually look at (§7.17) ---"
echo "ARM-DOMAIN guard=$GUARD_SEL/$GUARD_TOTAL policy=$POL_SEL/$POL_TOTAL"
echo "    guard  arm: $GUARD_SEL selected of $GUARD_TOTAL in domain"
echo "    policy arm: $POL_SEL selected of $POL_TOTAL in domain"
echo "DOMAIN-SOURCE policy arm: $POLWL_SOURCE"
echo "    The bound is the PROPERTY — every RLS policy whose command can permit a WRITE"
echo "    (INSERT, UPDATE, DELETE **and ALL**), in every schema. It excludes FOR SELECT"
echo "    policies, and for an ALL policy it excludes the \`using\` half (that clause also"
echo "    gates SELECT and is opened by p0-authz-door-audit.sh, whose domain is polcmd"
echo "    in ('r','*')). Until 2026-09-02 this domain was a 33-row EMBEDDED SNAPSHOT"
echo "    bounded on cmd in (INSERT,UPDATE,DELETE) — a syntax, not the property — and the"
echo "    other 74 write-capable policies were reported as 'matched no gate'."
# ⛔ THE DETECTOR'S STANDING, DISCLOSED IN THE RUN'S OWN OUTPUT. It is stated as a count, and
# the count is expected to be ZERO — an instrument that fires on nothing must SAY so, because
# "no finding" and "no instrument" print identically otherwise.
ROLE_STATS="$(psql_c -c "select count(*) filter (where not $(ddl_sql_for "$POLICY_DDL_OWNER_SQL" "$PSQL_ROLE"))||'|'||
                                count(*) filter (where not ($(ddl_sql_for "$POLICY_DDL_OWNER_SQL" "$PSQL_ROLE")
                                                         or $(ddl_sql_for "$POLICY_DDL_SUPAUTILS_SQL" "$PSQL_ROLE")))
                           from pg_policy pol
                           join pg_class c     on c.oid = pol.polrelid
                           join pg_namespace n on n.oid = c.relnamespace
                          where pol.polcmd <> 'r';" 2>/dev/null | head -1)"
NOT_OWNED="$(printf '%s' "$ROLE_STATS" | cut -d'|' -f1)"
DDL_BLOCKED="$(printf '%s' "$ROLE_STATS" | cut -d'|' -f2)"
echo "DOMAIN-STATEMENT connection role: $PSQL_ROLE, and ONLY $PSQL_ROLE. No escalation, no superuser"
echo "    connection, no second role — for all $POL_TOTAL policies and all $GUARD_TOTAL guards (ADR 0192)."
echo "    ${NOT_OWNED:-?} of $POL_TOTAL in-domain policies sit on tables $PSQL_ROLE does NOT own —"
echo "    but ownership is a PROXY, not the property: supautils' \`policy_grants\` grants POLICY DDL"
echo "    on Supabase-managed tables to $PSQL_ROLE outside pg_class.relowner. Measured, not assumed:"
echo "    a superuser escalation was built here on the ownership reading and the reading was WRONG."
echo "    ⇒ POLICY-DDL DETECTOR: ${DDL_BLOCKED:-?} of $POL_TOTAL policies are unopenable by BOTH routes."
if [ "${DDL_BLOCKED:-1}" = "0" ]; then
  echo "    ⛔ ZERO — the detector is DORMANT on this stack. Stated as a conformance finding, never as"
  echo "    reassurance: it is proven able to fire only by a PLANT in a scratch copy, never here."
else
  echo "    ⛔ ${DDL_BLOCKED} policy(ies) CANNOT be opened by either route. Each is UNVERDICTED, prints a"
  echo "    POLICY-DDL BLOCKED finding naming its failing half, and makes this run DIRTY. Not a pass."
fi
echo "    The detector is a PREDICATE evaluated per case (ownership OR supautils.policy_grants), both"
echo "    halves read live — never a schema name, never a list of policy names. It NEVER routes."
[ "$POL_NOSNAP" -gt 0 ] && \
  echo "    ⚠ $POL_NOSNAP selected policy(ies) are NOT in the drift snapshot: they are swept, but" && \
  echo "      no §7.2 drift tripwire protects their verdict. Each is marked snapshot:ABSENT."
[ -n "$SNAP_ORPHANS" ] && \
  echo "    ⚠ DRIFT-SNAPSHOT ORPHANS (named there, absent from the catalog):$SNAP_ORPHANS"

# ⚠ -F -x = EXACT string equality, deliberately identical to `want()`'s [ "$k" = "$1" ].
# A regex match here would disagree with the selector and could call a token "matched"
# that `want` never selects — a hole of exactly the kind being closed.
UNMATCHED=""
if [ -n "$CASES" ]; then
  for tok in $CASES; do
    if printf '%s\n' $GUARD_KEYS | grep -qxF "$tok"; then continue; fi
    if cut -d'|' -f3 "$POLWL" | grep -qxF "$tok"; then continue; fi
    UNMATCHED="$UNMATCHED $tok"
  done
fi
if [ -n "$UNMATCHED" ]; then
  echo
  echo "*** REQUESTED CASES THAT MATCHED NO GATE IN EITHER ARM:"
  for tok in $UNMATCHED; do
    safe=$(printf '%s' "$tok" | tr -cd 'A-Za-z0-9_')
    diag=$(psql_c -c "select coalesce((select string_agg(
                'POLICY '||schemaname||'.'||tablename||' FOR '||cmd, '; ')
              from pg_policies where policyname = '$safe'),
             (select string_agg(distinct n.nspname||'.'||p.proname||' -> '||t.typname||
                case when p.prosecdef then ' [SECURITY DEFINER]' else ' [INVOKER]' end, '; ')
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              join pg_type t on t.oid=p.prorettype
              where n.nspname in ('app','public','authz') and p.proname = '$safe'),
             '(no policy and no app/public function of this name)');" 2>/dev/null | head -1)
    echo "      $tok: ${diag:-(catalog unavailable)}"
  done
  echo "    ⛔ A gate named here was NOT swept. Read the diagnostic, do not assume:"
  echo "      · 'POLICY … FOR SELECT'  -> correct exclusion. A SELECT policy has no write"
  echo "        semantics; it belongs to p0-authz-door-audit.sh. Sweep it THERE, and record"
  echo "        the read arm's verdict — not a write-arm silence."
  echo "      · 'POLICY … FOR INSERT|UPDATE|DELETE|ALL'  -> ⛔ A HARNESS BUG, not a gap."
  echo "        Since 2026-09-02 this arm's domain IS the live catalog's write-capable"
  echo "        policies, so such a token cannot be legitimately unmatched. Fix the lift."
  echo "      · '(no policy and no app/public function of this name)' -> the token is stale:"
  echo "        a renamed or dropped gate. A verdict keyed to a name outlives the gate —"
  echo "        prune the row rather than sweeping a name."
  echo "    Do NOT hand-write a COVERED row anywhere."
  echo "    ⇒ This run can no longer end CLEAN: whatever it measures, part of what was"
  echo "      ASKED FOR was not measured. Final result will be UNPROVEN (3) or DIRTY (1)."
fi

# Nothing selected at all -> stop HERE, before the baseline. Nothing is neutralized, the
# suite is not run, and the findings file is not rewritten.
if [ "$SEL_TOTAL" -eq 0 ]; then
  echo
  echo "=== RESULT: UNPROVEN — NOTHING WAS MEASURED. This is NOT a pass. ==="
  echo "    Selected cases: 0 (guard=$GUARD_SEL, policy=$POL_SEL)${CASES:+ from CASES=\"$CASES\"}."
  echo "    A sweep of zero gates cannot distinguish 'no blind gate' from 'no gate looked"
  echo "    at', so this run deliberately does NOT print a BLIND/ERROR count."
  echo "    Nothing was neutralized; the baseline suite was NOT run; the COMMITTED baseline"
  echo "    $FINDINGS_COMMITTED is UNTOUCHED."
  echo "    Fix the SELECTION (or widen/annotate the arm's domain) and re-run."
  exit 3
fi
echo

# ⛔ THE DEGENERATE-POLICY PREFLIGHT runs BEFORE the expensive baseline capture and after the
# domain gate: it is one read-only query, and a stack that is already carrying an open write
# gate would produce a RED baseline whose message ("fix the tree to green") points at the
# wrong thing entirely. ⛔ ENUMERATE — see degenerate_write_policies.
echo "--- preflight: no WRITE gate is already sitting open on this stack ---"
PRE_DEGEN="$(degenerate_write_policies)"
if [ -n "$PRE_DEGEN" ]; then
  echo "*** PREFLIGHT FAILED: a non-SELECT policy is ALREADY degenerate on this stack:" >&2
  echo "$PRE_DEGEN" | sed 's/^/      /' >&2
  echo "    A sweep started here would classify against an already-open write gate." >&2
  echo "    Check \$SENTINEL, then RECOVER=1, then 'supabase db reset --local' from the repo root." >&2
  exit 2
fi
echo "    clean — 0 degenerate NON-SELECT policies (the ten 'true' vocabulary SELECT policies"
echo "    are true BY DESIGN; a bare COUNT would read ~11 here and look like a baseline)"
echo

echo "--- preflight: capturing GREEN baseline (§7.3 assert the state) ---"
BASE_OUT=$(run_suite)
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A dirty"
  echo "    baseline invalidates every case (a COVERED can't be told from a pre-existing red)."
  echo "    Fix the tree to green before auditing. Aborting."; exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"
echo

# ─────────────────────────────────────────────────────────────────────────────────────
# THE PERIODIC RESET (ADR 0192; design ported from p0-authz-door-audit.sh / ADR 0191 D8,
# which took it from c2-command-door-neutralizer.sh). The step ORDER is theirs and each step
# is a thing this arm refuses to ASSUME after a reset.
#
# ⛔ THE DOOR'S DESIGN IS NOT PORTABLE AS-IS, and the three differences are why this was
# written rather than copied:
#   1. The door re-derives TWO catalog worklists (`derive_worklists`). This arm has ONE
#      catalog worklist (`build_pol_worklist`) and a STATIC `GUARD_KEYS` list, so the Arm-1
#      half gets its own post-reset check: every GUARD_KEYS entry must still resolve to an
#      OID through its regprocedure identity. Nothing in the door's design covers that.
#   2. There is no `degenerate_gates()` here. The write arm's discriminator is the POLICY
#      one from `.claude/rules/mutation-harnesses-are-not-killable.md`: a degenerate
#      NON-SELECT policy. ⛔ ENUMERATE — a bare count of `qual='true' or with_check='true'`
#      returns ~11 on a clean stack because ten vocabulary SELECT policies are `true` BY
#      DESIGN, and reading that count as a baseline is how the AE1.5 open UPDATE policy was
#      nearly missed.
#   3. The policy worklist carries NO OID column (identities only, by design), so the door's
#      OID-reassignment adaptation does not apply to Arm 2; and Arm 1 already re-resolves each
#      guard by `'sig'::regprocedure::oid` at case time, so it is reset-safe already. Both
#      facts are ASSERTED below, not assumed.
# ─────────────────────────────────────────────────────────────────────────────────────
periodic_reset () {   # $1 = why (printed)
  local why="$1" pd now_pol g bad_oid
  # 1. ⛔ INTERLOCK FIRST, AHEAD OF THE SUBSET GATE. A reset with a mutation in flight destroys
  #    the evidence AND its restore in one command — the composition the sentinel exists to
  #    prevent. It stays first so the gate below cannot DISPLACE it: reaching here with an
  #    armed sentinel is a broken invariant whatever kind of run this is.
  if [ -s "$SENTINEL" ]; then
    echo "*** refusing to reset with a mutation in flight: $SENTINEL" >&2
    echo "    RECOVER=1 bash $0 first, then VERIFY it in the catalog." >&2
    exit 2
  fi
  # 2. THE GATE. Announced either way — a reset that did NOT happen is a fact about the run's
  #    preconditions, exactly like the domain. Checked here too so a direct call cannot bypass it.
  if ! resets_enabled; then
    if [ "$RESET_EVERY" = "0" ]; then
      echo "    (RESET_EVERY=0 — resets DISABLED everywhere; NOT resetting: $why)"
    else
      echo "    (SUBSET run, RESET_EVERY not set explicitly — the DEFAULT never fires on a"
      echo "     SUBSET run; NOT resetting: $why)"
    fi
    return 0
  fi
  echo "--- PERIODIC RESET ($why) ---"
  # 3. ⛔ `cd "$ROOT"` IS LOAD-BEARING: `supabase db reset` applies the migrations of the
  #    DIRECTORY YOU STAND IN, and this machine measurably has a second, unrelated stack up
  #    (`supabase_db_escalume`). ⛔ `</dev/null` because BOTH call sites are inside a
  #    `while read` loop whose stdin is the worklist file.
  if ! ( cd "$ROOT" && supabase db reset --local ) >/dev/null 2>&1 </dev/null; then
    echo "*** db reset FAILED — aborting rather than measuring on an unknown DB." >&2
    exit 2
  fi
  RESETS=$((RESETS+1))
  # 4. a reset is a new tree and its cleanliness is NOT assumed.
  pd="$(degenerate_write_policies)"
  if [ -n "$pd" ]; then
    echo "*** ABORT: a non-SELECT policy is DEGENERATE after a mid-sweep reset:" >&2
    echo "$pd" | sed 's/^/      /' >&2
    exit 2
  fi
  echo "    post-reset preflight: clean — 0 degenerate NON-SELECT policies"
  # 5a. ARM 2 — re-derive and compare. If the worklist moved, the TREE changed under the run
  #     and every verdict recorded so far is against a DIFFERENT POPULATION. ⛔ To a `.reset`
  #     file, NEVER over the file the sweep's `while read` loop is consuming.
  local keep="$POLWL"
  POLWL="$keep.reset"
  build_pol_worklist || { echo "*** ABORT: could not re-lift ARM 2's domain after a reset." >&2; exit 2; }
  POLWL="$keep"
  now_pol=$(grep -c . "$keep.reset" | tr -d '[:space:]')
  if [ "$now_pol" != "$POL_TOTAL" ] || ! diff -q "$keep.reset" "$keep" >/dev/null; then
    echo "*** ABORT: the derived policy worklist CHANGED across the reset" >&2
    echo "    (policy $POL_TOTAL -> $now_pol). The tree moved under this run; every verdict" >&2
    echo "    so far is against another population, so nothing measured here may be merged." >&2
    exit 2
  fi
  # 5b. ARM 1 — THE HALF THE DOOR'S DESIGN DOES NOT COVER. GUARD_KEYS is a STATIC list, so
  #     there is no worklist to re-derive; what must still hold is that every entry still
  #     RESOLVES. `supabase db reset` recreates the database and reassigns every pg_proc.oid,
  #     which is harmless because the sweep re-resolves at case time — but a guard whose
  #     IDENTITY vanished would turn into a run of `OID lookup failed` ERRORs that read like
  #     a harness bug rather than like the tree having moved.
  bad_oid=""
  for g in $GUARD_KEYS; do
    psql_c -c "select '$(guard_sig "$g")'::regprocedure::oid" 2>/dev/null | grep -qE '^[0-9]+$' \
      || bad_oid="$bad_oid $g"
  done
  if [ -n "$bad_oid" ]; then
    echo "*** ABORT: GUARD_KEYS entries no longer resolve after a mid-sweep reset:$bad_oid" >&2
    exit 2
  fi
  echo "    post-reset ARM 1 check: all $GUARD_TOTAL GUARD_KEYS entries still resolve to an OID"
  # 6. re-capture the baseline — THE WHOLE POINT: later verdicts compare against a FRESH shape,
  #    so the drift any verdict can carry is bounded by RESET_EVERY, not by the run's length.
  BASE_OUT=$(run_suite)
  BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  echo "    post-reset baseline: ${BASE_RES:-<none>} (shape=Files=$BASE_FILES, Tests=$BASE_TESTS)  |  policy worklist re-derived: $now_pol (unchanged)"
  if [ "$BASE_RES" != "PASS" ]; then
    echo "*** ABORT: the suite is RED after a mid-sweep reset. Every later verdict would be" >&2
    echo "    measured against a broken tree." >&2
    exit 2
  fi
}

# Called BEFORE a case's work, so that case's baseline is at most RESET_EVERY cases old.
maybe_periodic_reset () {
  if [ "$RESET_EVERY" != "0" ] && [ "$DONE" -gt 1 ] && [ $(( (DONE - 1) % RESET_EVERY )) -eq 0 ]; then
    periodic_reset "scheduled — $((DONE - 1)) case(s) swept since the last baseline"
  fi
}
# ⛔ The retry net reads the CLASSIFIER's own SHAPE_MOVED, never the note text. A GENUINE
# neutralization failure reproduces after a fresh reset; drift does not. When this run may not
# reset, the case is NOT retried and the ROW SAYS SO — retrying without the reset would
# re-measure the same drift and then suffix a sentence claiming it had been ruled out.
retry_suppressed_note () {
  if [ "$RESET_EVERY" = "0" ]; then
    printf '%s' " (drift-shaped; NOT retried — RESET_EVERY=0, resets are DISABLED everywhere)"
  else
    printf '%s' " (drift-shaped; NOT retried — a SUBSET run resets only when RESET_EVERY is set explicitly)"
  fi
}

# (write_pol_snapshot + build_pol_worklist run ABOVE the preflight with the §7.17 domain
#  gate — an UNPROVEN run must cost seconds, not a full suite run. Do not re-add a call
#  here: the counts the final verdict prints were taken from that materialisation, and a
#  second build would make the domain line and the sweep describe two different files.
#  ⚠ It would also re-read the catalog AFTER cases have started opening gates.)
: > "$PROGRESS"

# Regenerate the two deliverables from writepath_progress.tsv after EVERY case so a
# mid-run kill still leaves a coherent partial report.
# ⛔ SPLIT IN TWO ON PURPOSE. `emit_body` is the PURE generator — the closed grammar the
# merge helper takes the complement of, and the thing a proof harness can LIFT out of this
# file and run rather than re-typing. `emit_report` is generation + placement.
emit_body () {
  {
    echo "# AUTHZ Write-Path Door-Blindness Audit — Findings"
    echo
    echo "AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14) — WRITE-PATH arm. Generated by"
    echo "\`supabase/tests/mutation/p0-authz-writepath-audit.sh\`. Companion to the read/door"
    echo "audit. Method: open each write-path authz gate (raise-guard authz raise removed, or"
    echo "policy check set to \`true\`), run the FULL pgTAP suite, read \`Result:\`."
    echo "**COVERED** = suite went \`FAIL\` (a keystone asserts the gate denies an unauthorized"
    echo "writer). **BLIND** = suite stayed \`PASS\` (no keystone exercises it — a work-list item)."
    echo "**ERROR** = run shape != baseline (harness bug: fix the neutralization, not a result)."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Arm 1 guards: $GUARD_TOTAL (excluded non-authz validators: \`assert_meeting_roster_nonempty\`,"
    echo "\`assert_condition_value_codes\`)."
    echo
    echo "Arm 2 domain: **$POL_TOTAL** — every RLS policy in the live catalog whose command can"
    echo "permit a write (\`INSERT\`, \`UPDATE\`, \`DELETE\` **and \`ALL\`**), in every schema."
    echo "⛔ It EXCLUDES \`FOR SELECT\` policies (the read arm's domain) and, for an \`ALL\` policy,"
    echo "the \`using\` half — that clause also gates SELECT and is opened by"
    echo "\`p0-authz-door-audit.sh\` (\`polcmd in ('r','*')\`), so opening it here would let a READ"
    echo "keystone produce a COVERED that says nothing about the write path."
    echo "⚠ Until 2026-09-02 this domain was a 33-row embedded snapshot bounded on"
    echo "\`cmd in (INSERT,UPDATE,DELETE)\` — a syntax, not the property. That snapshot survives as"
    echo "a **drift tripwire only**; a row marked \`snapshot:ABSENT\` was swept without one."
    echo "⛔ **Rows in this file are only as complete as the run that wrote them.** A row count"
    echo "below $POL_TOTAL means no full sweep has covered the widened domain yet — absence of a"
    echo "row here is absence of a verdict, never a COVERED."
    if [ -n "$CASES" ]; then echo; echo "> ⚠ PARTIAL RUN — CASES=\"$CASES\" (subset, not the full sweep)."; fi
    echo
    echo "## BLIND — the work-list (no keystone exercises these)"
    echo
    echo "| gate / policy | arm | direction | verdict | note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## COVERED (asserted-through) + ERROR (harness bug) + SKIPPED (vacuous)"
    echo
    echo "| gate / policy | arm | direction | verdict | failing files / note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4!="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
  }
}

emit_report () {
  emit_body > "$GENERATED"
  if [ "$SUBSET_RUN" = "1" ]; then
    # $FINDINGS is already scratch (ADR 0153). Merging the committed baseline into a SUBSET
    # report would put verdicts the subset did not measure beside the ones it did.
    cp "$GENERATED" "$FINDINGS"
  elif bash "$MERGE_LIB" "$BASELINE_SNAPSHOT" "$GENERATED" "$FINDINGS"; then
    MERGE_FAILED=0
  else
    # ⛔ The merge REFUSED to write, so the baseline on disk is whatever it was. That is the
    # safe outcome; it must not be silent, and it must not stop the sweep.
    MERGE_FAILED=1
    echo "⛔⛔ MERGE ABORTED — $FINDINGS was NOT written. Generated report: $GENERATED" >&2
    echo "    Re-merge by hand from $BASELINE_SNAPSHOT; do NOT copy the generated file over" >&2
    echo "    the baseline. The sweep continues; the report on disk is STALE from here on." >&2
  fi

  { echo -e "arm\tgate\tdirection\tfailing_or_note";
    awk -F'\t' '$4=="BLIND"{printf "%s\t%s\t%s\t%s\n",$1,$2,$3,$5}' "$PROGRESS"; } > "$BLINDS_TSV"
}

record () {  # arm gate direction verdict failing
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  emit_report
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 1 — authz RAISE-GUARDS (bespoke neutralization)
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ ONE CASE'S WORK IS A FUNCTION, NOT INLINE CODE (ADR 0192, mirroring ADR 0191 D8). The
# retry net has to run a case TWICE, and a second COPY of the case body is how the retry comes
# to measure something subtly different from what the first pass measured. The function reports
# through SW_VERDICT / SW_NOTE / SW_DRIFT and the CALLER records — so a retried case is
# recorded exactly once.
SW_VERDICT=""; SW_NOTE=""; SW_DRIFT=0
sweep_guard_one () {   # $1 = guard key ; sets SW_VERDICT / SW_NOTE / SW_DRIFT
  local k="$1" sig oid orig mout out now
  SW_VERDICT=""; SW_NOTE=""; SW_DRIFT=0
  sig="$(guard_sig "$k")"
  # ⚠ Re-resolved from the regprocedure IDENTITY at CASE time, which is what makes ARM 1
  # safe across a periodic reset (every pg_proc.oid is reassigned by `supabase db reset`).
  oid=$(psql_c -c "select '$sig'::regprocedure::oid" 2>&1)
  if ! echo "$oid" | grep -qE '^[0-9]+$'; then
    SW_VERDICT="ERROR"; SW_NOTE="OID lookup failed: $(echo "$oid" | tr '\n' ' ' | head -c 120)"
    return 0
  fi

  orig="$WORK/orig_wp_guard_$k.sql"
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"   # exact bytes for restore + verify
  # arm the trap BEFORE opening, with the probe that will VERIFY its restore and the ROLE
  # that must apply it (R11.3 — guards live in app/public and are owned by $PSQL_ROLE).
  arm_inflight "$orig" "select md5(pg_get_functiondef($oid))" "$PSQL_ROLE"

  emit_neut_guard "$k" > "$WORK/_wp_mut.sql"
  mout=$(psql_f "$WORK/_wp_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    SW_VERDICT="ERROR"; SW_NOTE="neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    restore_inflight || { echo "*** the restore of $sig REFUSED — stopping (§7.5)."; exit 2; }
    return 0
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/guard_$k.log"
  classify "$out"

  # RESTORE exact original bytes + VERIFY round-trip (§7.5 contamination guard)
  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $sig did NOT round-trip. Every later case is suspect."
    echo "    Aborting the sweep (§7.5)."; exit 2
  fi
  disarm_inflight   # the round-trip above verified it — only now drop the sentinel

  SW_VERDICT="$VERDICT"
  SW_NOTE="$FAILING"
  # ⛔ The drift flag comes from the CLASSIFIER's own SHAPE_MOVED, never from this note text.
  SW_DRIFT="$SHAPE_MOVED"
  [ "$VERDICT" = "ERROR" ] && SW_NOTE="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  return 0
}

echo "=== ARM 1: authz raise-guards ==="
for k in $GUARD_KEYS; do
  want "$k" || continue
  sig="$(guard_sig "$k")"
  DONE=$((DONE + 1))
  maybe_periodic_reset
  sweep_guard_one "$k"
  # THE RETRY NET — a shape-moved ERROR is reset-and-retried ONCE. A genuine neutralization
  # failure reproduces after a fresh reset; drift does not.
  if [ "$SW_VERDICT" = "ERROR" ] && [ "$SW_DRIFT" = "1" ]; then
    if ! resets_enabled; then
      SW_NOTE="$SW_NOTE$(retry_suppressed_note)"
    else
      echo "    drift suspected — resetting and retrying $sig ONCE"
      periodic_reset "retry — $sig recorded a drift-shaped ERROR"
      sweep_guard_one "$k"
      SW_NOTE="$SW_NOTE (retried once after a reset)"
    fi
  fi
  record "guard" "$sig" "authz-open" "$SW_VERDICT" "$SW_NOTE"
  printf '  %-8s %s\n' "$SW_VERDICT" "$sig"
done

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 2 — write POLICIES (open the check to true)
# ─────────────────────────────────────────────────────────────────────────────────────
echo
echo "=== ARM 2: write policies ==="
SW_DIR="open->true"
sweep_pol_one () {   # $1..$8 = nsp tbl polname cmd haveq havew qtrue wtrue
  local nsp="$1" tbl="$2" polname="$3" cmd="$4" haveq="$5" havew="$6" qtrue="$7" wtrue="$8"
  local vac s qfile wfile restore regc snaprow snapnote snapq snapw mout out nowq noww
  SW_VERDICT=""; SW_NOTE=""; SW_DRIFT=0; SW_DIR="open->true"

  # WHICH CLAUSES THIS ARM OPENS — the property, per command (see the ARM 2 header).
  open_rule "$cmd" "$haveq" "$havew"

  # ⛔ An ALL policy with a NULL with_check cannot be opened on its write half by ALTER:
  # its WITH CHECK defaults to its USING, and `ALTER POLICY` cannot set WITH CHECK back to
  # NULL, so the restore would not round-trip. That is "this arm cannot reach it", which is
  # NOT "nothing to do" — it is reported ERROR so it blocks, never SKIPPED so it reads fine.
  # (Measured 2026-09-02: zero such policies exist; this guard is here for the first one.)
  if [ "$OPENQ" = 0 ] && [ "$OPENW" = 0 ]; then
    SW_VERDICT="ERROR"
    SW_NOTE="NOT OPENABLE BY THIS ARM: $cmd with haveq=$haveq havew=$havew — ALTER POLICY cannot reset WITH CHECK to NULL, so no restorable write-half opening exists"
    return 0
  fi

  # vacuous skip: every clause THIS ARM WOULD OPEN is already `true`
  vac=1
  { [ "$OPENQ" = 1 ] && [ "$qtrue" != 1 ]; } && vac=0
  { [ "$OPENW" = 1 ] && [ "$wtrue" != 1 ]; } && vac=0
  if [ "$vac" = 1 ]; then
    SW_VERDICT="SKIPPED"; SW_NOTE="vacuous: the clause this arm opens is already true"
    return 0
  fi

  # ⛔ CAN $PSQL_ROLE OPEN THIS ONE AT ALL — asked PER CASE, both grant routes read live. This
  # is a DETECTOR: on rc 1 it does NOT escalate, substitute a role, or skip. It says so loudly
  # and the policy is left UNVERDICTED (an ERROR row ⇒ the run exits DIRTY). ⛔ Never an
  # allowlist, never a silent workaround — that is what makes an unopenable gate LOOK swept.
  if ! policy_ddl_detector "$nsp" "$tbl"; then
    ddl_block_finding "$nsp" "$tbl" "$polname"
    SW_VERDICT="ERROR"; SW_NOTE="UNVERDICTED — POLICY-DDL BLOCKED: $DDL_BLOCK_WHY"
    return 0
  fi

  s=$(slug "${nsp}_${tbl}_${polname}")
  qfile="$WORK/orig_wp_pol_$s.qual"; wfile="$WORK/orig_wp_pol_$s.wc"
  restore="$WORK/restore_wp_pol_$s.sql"
  regc="\"$nsp\".\"$tbl\""

  : > "$qfile"; : > "$wfile"
  [ "$OPENQ" = 1 ] && psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass" > "$qfile"
  [ "$OPENW" = 1 ] && psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass" > "$wfile"

  # §7.2 DRIFT tripwire — for the 33 policies the embedded snapshot NAMES. A live predicate
  # that no longer matches means the committed verdict for that policy was earned against
  # different text: ERROR (not a result), do not open. ⚠ For a policy the snapshot does not
  # name there is nothing to drift against; it is swept and marked snapshot:ABSENT, so the
  # report shows which verdicts carry this protection and which do not.
  snaprow="$(snap_row "$tbl" "$polname")"
  snapnote=""
  if [ -n "$snaprow" ]; then
    snapq="$(printf '%s' "$snaprow" | cut -d'|' -f4)"
    snapw="$(printf '%s' "$snaprow" | cut -d'|' -f5)"
    if [ "$OPENQ" = 1 ] && [ "$(cat "$qfile")" != "$snapq" ]; then
      SW_VERDICT="ERROR"; SW_NOTE="snapshot drift (qual): live='$(cat "$qfile")'"
      return 0
    fi
    if [ "$OPENW" = 1 ] && [ "$(cat "$wfile")" != "$snapw" ]; then
      SW_VERDICT="ERROR"; SW_NOTE="snapshot drift (with_check): live='$(cat "$wfile")'"
      return 0
    fi
  else
    snapnote=" [snapshot:ABSENT — no §7.2 drift tripwire on this verdict]"
  fi

  # RESTORE built from the LIVE capture (byte-exact), armed BEFORE opening. It restores
  # exactly the clauses this arm opens — nothing else is touched, so the round-trip is exact.
  {
    printf 'alter policy "%s" on "%s"."%s"' "$polname" "$nsp" "$tbl"
    [ "$OPENQ" = 1 ] && printf ' using (%s)' "$(cat "$qfile")"
    [ "$OPENW" = 1 ] && printf ' with check (%s)' "$(cat "$wfile")"
    printf ';\n'
  } > "$restore"
  arm_inflight "$restore" "select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy where polname='$polname' and polrelid='$regc'::regclass"

  # OPEN the policy — only the clause(s) the open rule names for this command.
  {
    printf 'alter policy "%s" on "%s"."%s"' "$polname" "$nsp" "$tbl"
    [ "$OPENQ" = 1 ] && printf ' using (true)'
    [ "$OPENW" = 1 ] && printf ' with check (true)'
    printf ';\n'
  } > "$WORK/_wp_mut.sql"
  mout=$(psql_f "$WORK/_wp_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    SW_VERDICT="ERROR"; SW_NOTE="open failed as $PSQL_ROLE: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    restore_inflight || { echo "*** the restore of $tbl.$polname REFUSED — stopping (§7.5)."; exit 2; }
    return 0
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pol_$s.log"
  classify "$out"

  # RESTORE exact original + VERIFY round-trip — same `psql_f`, therefore same role, as the open.
  psql_f "$restore" >/dev/null 2>&1
  if [ "$OPENQ" = 1 ]; then
    nowq=$(psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass")
    if [ "$nowq" != "$(cat "$qfile")" ]; then
      echo "*** CONTAMINATION: restore of $tbl.$polname qual did NOT round-trip. Aborting (§7.5)."; exit 2
    fi
  fi
  if [ "$OPENW" = 1 ]; then
    noww=$(psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass")
    if [ "$noww" != "$(cat "$wfile")" ]; then
      echo "*** CONTAMINATION: restore of $tbl.$polname with_check did NOT round-trip. Aborting (§7.5)."; exit 2
    fi
  fi
  disarm_inflight   # the round-trip above verified it — only now drop the sentinel

  # ⚠ The direction records WHICH clause was opened, so an ALL policy's COVERED cannot be
  # read as a claim about its `using` half (which this arm deliberately does not open).
  SW_DIR="open->true"
  [ "$OPENQ" = 1 ] && [ "$OPENW" = 1 ] && SW_DIR="open using+check->true"
  [ "$OPENQ" = 1 ] && [ "$OPENW" = 0 ] && SW_DIR="open using->true"
  [ "$OPENQ" = 0 ] && [ "$OPENW" = 1 ] && SW_DIR="open with-check->true"
  SW_VERDICT="$VERDICT"
  SW_DRIFT="$SHAPE_MOVED"
  # ⚠ The ROLE and its GRANT ROUTE are carried on the ROW, not only in the banner: a row is read
  # without its banner, and "how was this gate openable at all" is part of what the verdict means
  # — it is the fact whose misreading produced the withdrawn escalation (ADR 0192).
  SW_NOTE="$FAILING$snapnote [$DDL_WHY]"
  [ "$VERDICT" = "ERROR" ] && SW_NOTE="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)$snapnote [$DDL_WHY]"
  return 0
}

while IFS='|' read -r nsp tbl polname cmd haveq havew qtrue wtrue; do
  [ -n "${polname:-}" ] || continue
  want "$polname" || continue
  DONE=$((DONE + 1))
  maybe_periodic_reset
  sweep_pol_one "$nsp" "$tbl" "$polname" "$cmd" "$haveq" "$havew" "$qtrue" "$wtrue"
  if [ "$SW_VERDICT" = "ERROR" ] && [ "$SW_DRIFT" = "1" ]; then
    if ! resets_enabled; then
      SW_NOTE="$SW_NOTE$(retry_suppressed_note)"
    else
      echo "    drift suspected — resetting and retrying $tbl.$polname ONCE"
      periodic_reset "retry — $tbl.$polname recorded a drift-shaped ERROR"
      sweep_pol_one "$nsp" "$tbl" "$polname" "$cmd" "$haveq" "$havew" "$qtrue" "$wtrue"
      SW_NOTE="$SW_NOTE (retried once after a reset)"
    fi
  fi
  record "policy" "$tbl.$polname ($cmd)" "$SW_DIR" "$SW_VERDICT" "$SW_NOTE"
  printf '  %-8s %s\n' "$SW_VERDICT" "$tbl.$polname"
done < "$POLWL"

echo
if [ "${MERGE_FAILED:-0}" = "1" ]; then
  echo "⛔⛔ THE REPORT ON DISK IS STALE — the last merge into $FINDINGS ABORTED."
  echo "    This run's generated report: $GENERATED"
  echo "    Baseline snapshot          : $BASELINE_SNAPSHOT"
  echo "    ⛔ Do NOT read $FINDINGS as this run's result and do NOT copy the generated"
  echo "       file over it: re-merge the two files above."
fi
echo "=== DONE. Report: $FINDINGS   BLINDs: $BLINDS_TSV ==="
if [ "$SUBSET_RUN" = "1" ]; then
  # ⚠ Print the SIZE, not just the path: an "untouched baseline" is indistinguishable
  # from "this run wrote nothing at all" unless the subset report is shown to exist with
  # real content somewhere.
  echo "    ⚠ SUBSET RUN (CASES=\"$CASES\") — that report is a SCRATCH file, $(wc -l < "$FINDINGS" | tr -d '[:space:]') line(s),"
  echo "      covering ONLY the selected cases. The committed baseline was never opened"
  echo "      for write: $FINDINGS_COMMITTED"
  echo "    ⛔ Do NOT read a FROMFINDINGS arm as covering this run."
fi
blind_ct=$(awk -F'\t' '$4=="BLIND"' "$PROGRESS" | wc -l | tr -d '[:space:]')
err_ct=$(awk -F'\t' '$4=="ERROR"' "$PROGRESS" | wc -l | tr -d '[:space:]')
skip_ct=$(awk -F'\t' '$4=="SKIPPED"' "$PROGRESS" | wc -l | tr -d '[:space:]')
swept_ct=$(grep -c . "$PROGRESS" | tr -d '[:space:]')
cov_ct=$((swept_ct - blind_ct - err_ct - skip_ct))

# §7.17: the count line is USELESS without the domain beside it — "BLIND: 0" over an
# empty domain and "BLIND: 0" over 40 gates were the same string.
echo "ARM-DOMAIN guard=$GUARD_SEL/$GUARD_TOTAL policy=$POL_SEL/$POL_TOTAL"
[ "$GUARD_SEL" -eq 0 ] && echo "    ⚠ GUARD ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ "$POL_SEL"  -eq 0 ] && echo "    ⚠ POLICY ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ -n "$UNMATCHED" ] && echo "    ⚠ REQUESTED BUT NEVER SWEPT (matched no gate):$UNMATCHED"
echo "SWEPT: $swept_ct   COVERED: $cov_ct   BLIND: $blind_ct   ERROR(harness): $err_ct   SKIPPED(vacuous): $skip_ct"
# ⛔ THE PRECONDITIONS LINE IS PART OF THE RESULT, NOT DECORATION. `resets=0` on a full
# 120-case sweep is the exact state that VOIDED the door arm's run 1 (a 78-row drift tail with
# no originating case, found only afterwards). Quote this line in the gate record beside the
# counts — a verdict count without it does not say what the verdicts were measured against.
if resets_enabled; then
  echo "preconditions: resets=$RESETS (RESET_EVERY=$RESET_EVERY, explicit=$RESET_EVERY_EXPLICIT, subset=$SUBSET_RUN — ENABLED)"
elif [ "$RESET_EVERY" = "0" ]; then
  echo "preconditions: resets=$RESETS (RESET_EVERY=0 — resets DISABLED everywhere)"
else
  echo "preconditions: resets=$RESETS (RESET_EVERY=$RESET_EVERY defaulted, SUBSET run — SUPPRESSED: the DEFAULT never fires on a SUBSET run)"
fi
# ⚠ awk, not `grep -c`: grep exits 1 on a ZERO count, and the expected count here IS zero.
ddl_blocked_ct=$(awk -F'\t' '$5 ~ /POLICY-DDL BLOCKED/' "$PROGRESS" | wc -l | tr -d '[:space:]')
echo "connection role: $PSQL_ROLE only (no escalation — ADR 0192). POLICY-DDL detector fired on ${ddl_blocked_ct:-0} of $swept_ct swept case(s); each firing is an UNVERDICTED policy, not a verdict. See the per-row [role=… via …] note for the grant route each COVERED row was earned through."

# ⛔ THE EXIT CODE. Until 2026-08-29 this file ENDED on the echo above, so every run
# exited 0 — including one with 13 ERRORs that measured nothing. `(COVERED = the rest)`
# computed a positive-sounding residual against a set that, on a fully-ERRORed subset
# run, is EMPTY, so the summary line read like coverage. Both are fixed here: the
# residual is now printed as an explicit COVERED count, and the verdict is an exit code.
# ⛔ A MERGE ABORT IS AN ERROR, AND IT MUST REACH THE EXIT CODE (QA F-MAJOR-5, 2026-09-05).
# The banner emit_report prints is loud, but the banner is not what a gate reads. An aborted
# merge leaves $FINDINGS byte-for-byte as it was — which on a FULL run is EXACTLY what "no
# verdict moved" looks like, so `git diff --stat -- <findings>` cannot separate the two. Only
# this exit code can. It is tested FIRST because it invalidates the artefact the FROMFINDINGS
# arms read back, whatever the verdict counts above say (they are printed either way).
if [ "${MERGE_FAILED:-0}" = "1" ]; then
  echo "=== RESULT: ERROR — the findings MERGE ABORTED. $FINDINGS was NOT written and is"
  echo "    STALE: it holds a PREVIOUS run's verdicts. ⛔ An empty \`git diff\` on it is NOT"
  echo "    evidence this run changed nothing — it is what an aborted merge also produces."
  echo "    Re-merge by hand from $BASELINE_SNAPSHOT and $GENERATED. ERROR is not a pass. ==="
  exit 2
elif [ "$swept_ct" -eq 0 ]; then
  # Belt-and-braces: the domain gate above should have exited 3 long before here.
  echo "=== RESULT: UNPROVEN — 0 gates swept despite a non-empty domain. Harness bug. ==="
  exit 3
elif [ "$blind_ct" -gt 0 ] || [ "$err_ct" -gt 0 ]; then
  echo "=== RESULT: DIRTY — $blind_ct BLIND, $err_ct ERROR. BLIND blocks the phase (§6 step 1);"
  echo "    ERROR is not a pass — fix the neutralization and re-run that case. ==="
  exit 1
elif [ -n "$UNMATCHED" ]; then
  echo "=== RESULT: UNPROVEN (PARTIAL) — $swept_ct gate(s) measured and all COVERED, but"
  echo "    these were requested and matched NO gate:$UNMATCHED"
  echo "    A clean verdict over a subset of what was asked for is the finding this gate"
  echo "    exists to prevent. NOT a pass. ==="
  exit 3
else
  echo "=== RESULT: CLEAN — $swept_ct gate(s) measured, all COVERED. ==="
  exit 0
fi
