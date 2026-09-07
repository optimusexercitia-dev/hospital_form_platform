#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14). A gate no keystone exercises
# is a live leak wearing a green check. §7.14: "audit one layer, infer the next" is
# SYMMETRIC and shipped green suites over five live leaks in one day. This harness
# closes it by BRUTE FORCE: NEUTRALIZE each authz gate (open it so it grants/allows
# regardless), run the FULL pgTAP suite, and read whether ANY keystone noticed.
#
#   Result: FAIL  -> a keystone asserts THROUGH this gate           = COVERED (good)
#   Result: PASS  -> NO keystone exercises it; opening it is silent = BLIND  (a finding)
#
# This is the INVERSE of m1/m5/u2: those revert ONE fix and require ONE keystone to go
# red (isolating a single keystone). Here we open ONE gate and ask the WHOLE SUITE
# whether it is asserted-through by ANYONE. So we do NOT inject into a single test file;
# we mutate the LIVE, COMMITTED catalog and run `supabase test db` end-to-end.
#
# ── Lessons baked in (each HID A REAL RESULT elsewhere on this program) ──────────────
#  §7.15  "Green" has a THIRD failure mode: the assertion that NEVER RAN. A neutralization
#         that changes a function's RETURN TYPE makes files ERROR/abort, not assertion-
#         fail. That is a HARNESS BUG, not a BLIND. We guard on Files/Tests == baseline
#         and on the absence of "Dubious"; a run that does not match the baseline shape
#         is verdict=ERROR (fix the neutralization), never recorded as a result.
#  §7.1   Detect on the SUITE RESULT, not `grep '^not ok'` — the lead's probe showed a
#         real Result: FAIL with ZERO `^not ok` lines (prove's summary formatting varies).
#  §7.3   Assert the state, don't claim it: the baseline Files/Tests are CAPTURED at
#         preflight (not hardcoded 112/3186 — those go stale as the suite grows) and the
#         baseline MUST read Result: PASS or we abort (a dirty baseline invalidates all).
#  §7.15b type-safety by RETURN TYPE: positive gates -> true, deny gates -> false,
#         void raise-guards -> no-op. A neutralization must preserve signature + return
#         type + attributes (STABLE/DEFINER/search_path); ONLY the body changes. We keep
#         the entire pg_get_functiondef header and swap only the dollar-quoted body.
#  §7.5   restore is not optional and not assumed: after EVERY case we RE-FETCH the def/
#         qual and byte-compare against the captured original. A botched restore silently
#         contaminates every case after it, so a mismatch is a LOUD abort, not a warning.
#  §7.2   value, not noun: functions keyed by OID (survives rename); policies by name+table.
#
# Run from repo root:  bash supabase/tests/mutation/p0-authz-door-audit.sh
# Subset:              CASES="can_read_case is_case_respondent" bash .../p0-authz-door-audit.sh
#   (CASES matches predicate proname OR policy name; space-separated.)
# Bounded tail drift:  RESET_EVERY=N bash .../p0-authz-door-audit.sh
#   Reset the DB + RE-CAPTURE the baseline every N cases, and reset-and-retry-once on a
#   shape-moved verdict (ADR 0191 D8, porting ADR 0189 D6). Default 20; `0` disables.
#   ⛔ THE GUARD IS SUBSET-NESS, NOT THE COUNTER: a NON-SUBSET run resets every N; a SUBSET
#   run (`CASES=`) resets ONLY when RESET_EVERY is set EXPLICITLY — set-ness, not value, so
#   a quick spike never triggers a destructive reset nobody asked for, while both mechanisms
#   stay provable without a 13-hour sweep. Quote the `resets=` figure on the preconditions
#   line, never the script name.
#   ⭐ A subset run writes its report + BLIND tsv to SCRATCH under $WORK and NEVER opens
#   the committed findings md for write (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE; see
#   the config block below). There is nothing to `git checkout --` afterwards, and older
#   instructions saying otherwise describe the pre-2026-08-26 behaviour.
#
# ── EXIT CODES — three-way, NOT boolean (§7.17) ─────────────────────────────────────
#   0  CLEAN     a NON-EMPTY selection was swept and every case came back COVERED
#   1  DIRTY     ≥1 BLIND and/or ERROR  (also: baseline not green)
#   2  ABORT     contaminated stack / a restore that did not round-trip
#   3  UNPROVEN  NOTHING was measured — zero cases selected, or a CASES token that
#                matched no gate. ⛔ An UNPROVEN run is NOT a pass and never prints a
#                BLIND/ERROR count: "BLIND: 0" over an empty domain used to be the
#                BYTE-IDENTICAL string a clean full sweep prints, and one such run was
#                read into a §6 gate record as coverage for a change adding a PHI writer.
# ⚠ Read the exit code DIRECTLY. `script | tail` reports TAIL's status and a trailing
#   `echo $?` reports ECHO's; `pipefail` is not on by default (this repo has been bitten
#   twice in one day, both times in the reassuring direction).
# ⚠ Quote the ARM-DOMAIN line, not just the verdict: a record saying "the ARMs HOLD"
#   is true and means nothing when the arm's domain was empty.
#
# ⚠ COST: the full sweep is ~75 min (one ~23s suite run per gate + per policy). Author
# + smoke only in an interactive turn; a background process dies at turn-end. The LEAD
# runs the full loop in the background.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
# Repo root = three levels up from supabase/tests/mutation/.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-${TMPDIR:-/tmp}/authz-audit}"
PROGRESS="$WORK/progress.tsv"          # per-case log, written AS WE GO (§ mid-run kill)
# ⛔ FIXED path, deliberately NOT under $WORK -- the recipe hands out a fresh
# WORK=.../authz-audit-$(date +%s) per run, so a $WORK-relative sentinel is invisible to
# the next run and its check would pass vacuously. Distinct filename from the write-path
# sibling so the two harnesses never consume each other's evidence.
SENTINEL="${AUTHZ_DOOR_SENTINEL:-${TMPDIR:-/tmp}/authz-door-INFLIGHT.sql}"
RUNLOGS="$WORK/runlogs"                # full suite output per case, for forensics
CASES="${CASES:-}"                     # optional subset filter
FINDINGS_COMMITTED="$ROOT/docs/reviews/authz-door-audit-findings.md"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ A SUBSET RUN MUST NOT WRITE THE COMMITTED BASELINE
#    (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE — fix (a), 2026-08-26)
#
# `emit_report` ends in a TRUNCATING redirect into the file above, which is COMMITTED.
# With `CASES=` set — the diff-scoped run CLAUDE.md §6 step 1 mandates EVERY PHASE — that
# redirect used to replace the full audit with the subset. Measured 2026-08-25 during
# AFF3: 699 lines -> 90.
#
# ⛔ The failure was silent AND self-concealing. `FROMFINDINGS=1 ARM=policy/wrapper` — a
# phase-gate arm — compares this committed file to an allowlist and RE-MEASURES NOTHING.
# Against a truncated file it sees fewer gates, finds every one of them allowlisted, and
# reports HOLDS: the arm gets GREENER as the baseline gets EMPTIER. The only thing
# standing between a phase and that was the operator remembering to `git checkout --` it.
#
# So a subset run writes to SCRATCH and never opens the committed file for write. The
# committed path stays in $FINDINGS_COMMITTED, because the messages that promise it is
# untouched must be able to NAME it (the same vocabulary the §7.17 UNPROVEN exit uses).
# ⚠ $BLINDS_TSV moves too: p0-authz-invariant.sh's non-FROMFINDINGS arm reads
# `$WORK/blinds.tsv` as a FULL-sweep result, so a subset run must not occupy that name
# either. "Never overwrite the artefact a later arm reads back as a baseline" is the
# property; whether the artefact is committed or scratch is not part of it.
# ─────────────────────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ `BASE_SHAPE_OVERRIDE` — A SELF-PROOF KNOB, AND IT JOINS THE SUBSET SET (ADR 0191 D8).
# It forces the captured baseline SHAPE to a value the suite will never produce, so every
# case reads as shape-moved and the retry net can be shown to RESET, RE-CAPTURE THE TRUE
# SHAPE, and RECOVER a real verdict — without a 13-hour sweep. Batch 0 learned (QA F-MAJOR-3)
# that such a knob does not narrow an axis and so is easy to leave outside the subset test,
# which is exactly how it once pointed a fault-injected run at the COMMITTED baseline. It is
# therefore counted as a subset here, and it is REFUSED unless `SELFPROOF=1` is set with it:
# two knobs, deliberately, so no real sweep can inherit a forged baseline from one stray var.
# ⚠ It is NOT gated on `SELFTEST=1` — that arm exits before any sweep runs, so gating on it
#   would make this knob unusable and the mechanism unprovable, which is the failure mode the
#   2026-09-04 re-ruling exists to prevent.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ -n "${BASE_SHAPE_OVERRIDE:-}" ] && [ "${SELFPROOF:-0}" != "1" ]; then
  echo "FATAL: BASE_SHAPE_OVERRIDE is a SELF-PROOF knob and SELFPROOF is not 1. Refusing to" >&2
  echo "       run: a real sweep must never inherit a forged baseline shape." >&2
  exit 2
fi
if [ -n "$CASES" ] || [ -n "${BASE_SHAPE_OVERRIDE:-}" ]; then
  SUBSET_RUN=1
  FINDINGS="$WORK/authz-door-audit-findings.SUBSET.md"
  BLINDS_TSV="$WORK/blinds.SUBSET.tsv"
else
  SUBSET_RUN=0
  FINDINGS="$FINDINGS_COMMITTED"
  BLINDS_TSV="$WORK/blinds.tsv"
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# BOUNDED TAIL DRIFT — PORTED FROM c2-command-door-neutralizer.sh, 2026-09-06 (ADR 0191 D8)
#
# ⛔ THE FIX WAS CORRECT AT ONE OF ITS TWO SITES. `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-
# LATE-VERDICTS` was closed on 2026-09-04 against the C2 neutralizer ALONE. The bug is a
# property of the SHAPE — one database, one baseline captured at the top, one pgTAP suite run
# per case, hundreds of cases — and THIS harness has exactly that shape and kept the bug.
#
# Measured on this arm's first full run (2026-09-06, 353 cases, 12 h 17 m, bare exit 1): the
# suite held the captured baseline shape `Files=262, Tests=8876` for 274 cases, then read
# `Files=262, Tests=8470` with the IDENTICAL nine aborting referral files on all 79 remaining
# cases (78 NOTICED + 1 ERROR) — a perfect tail. Re-measured on fresh resets, tail cases run
# alone came back COVERED at the true shape, and cases 274/275/276 re-run in worklist order
# came back 3/3 COVERED with the shape never moving. ⭐ So there is NO originating case: the
# damage is CUMULATIVE in the number of preceding suite runs, which is exactly what a periodic
# reset bounds and what no per-case fix could reach. The DOOR was never the variable.
#
# ⛔ §7.15 is a DETECTOR, not a PREVENTER: BASE_FILES/BASE_TESTS are captured once, so drift is
# converted into NOTICED/ERROR and the tail is simply NOT MEASURED. A longer worklist loses a
# longer tail. Two mechanisms, because neither covers the other:
#   · RESET_EVERY  — reset the DB every N cases and RE-CAPTURE the baseline, bounding the drift
#                    any verdict can carry to N cases instead of to the whole run;
#   · the retry net — a shape-moved outcome resets and re-runs that ONE case: a GENUINE NOTICED
#                    reproduces after a fresh reset, drift does not.
#
# ⛔ SET-NESS, NOT VALUE, and it must be captured BEFORE the default is applied — one line later
# `RESET_EVERY=20` typed by an operator and `RESET_EVERY` defaulted to 20 are the SAME STRING,
# which is the exact fact this gate turns on. THE RULE IN FORCE (ADR 0189 D6 as re-ruled
# 2026-09-04, adopted here unchanged): a NON-SUBSET run resets every RESET_EVERY (default 20);
# a SUBSET run resets ONLY if RESET_EVERY is set EXPLICITLY; `0` disables everywhere. A subset
# writes only to scratch (ADR 0153), so a reset during one cannot touch the committed baseline —
# and allowing an explicit one is what keeps both mechanisms provable without a 13-hour sweep.
# ─────────────────────────────────────────────────────────────────────────────────────
RESET_EVERY_EXPLICIT=0; [ -n "${RESET_EVERY+x}" ] && RESET_EVERY_EXPLICIT=1
RESET_EVERY="${RESET_EVERY:-20}"   # 0 disables
RESETS=0
# ⛔ ONE predicate, derived once and read by all three sites (the gate inside periodic_reset, the
# retry net, the summary banner). Three hand-written copies of the same condition is how a banner
# comes to describe a rule the code no longer implements.
resets_enabled () {   # rc 0 = a reset is allowed on this run; rc 1 = suppressed
  [ "$RESET_EVERY" != "0" ] || return 1
  [ "$SUBSET_RUN" != "1" ] || [ "$RESET_EVERY_EXPLICIT" = "1" ]
}


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
# design. The FULL half still emitted this committed file through a truncating redirect,
# and the file is NOT purely generated. `emit_report` now writes the GENERATED report to
# $WORK and the shared merge helper folds it into a snapshot of the committed baseline.
#
# ⛔ THE SNAPSHOT IS TAKEN ONCE, HERE, AND THAT IS LOAD-BEARING. `emit_report` runs after
# EVERY case; merging the fresh generation into an already-merged file would compound the
# CARRIED block and make the result depend on how many cases had run. Merging always
# against the ORIGINAL baseline makes each emit idempotent — and it means a mid-run kill
# leaves a coherent PARTIAL report that still carries the hand-authored material.
# ─────────────────────────────────────────────────────────────────────────────────────
MERGE_LIB="$ROOT/scripts/lib/merge-findings-baseline.sh"
GENERATED="$WORK/authz-door-audit-findings.generated.md"
BASELINE_SNAPSHOT="$WORK/authz-door-audit-findings.baseline.md"
MERGE_FAILED=0
if [ -f "$FINDINGS_COMMITTED" ]; then cp "$FINDINGS_COMMITTED" "$BASELINE_SNAPSHOT"; else : > "$BASELINE_SNAPSHOT"; fi

# ─────────────────────────────────────────────────────────────────────────────────────
# THE SECOND LOCK — deliberately a DIFFERENT KIND from the first.
# Repointing $FINDINGS above states the INTENT ("a subset run writes to scratch"). This
# measures the OUTCOME: the committed file's bytes are checksummed NOW and re-checked on
# EVERY exit path, so "the baseline is untouched" is a MEASUREMENT, not a claim. (memory:
# "a door can have two locks" — where the second lock turned out to be the same predicate
# twice. §7.5 already applies this discipline to gate restores: byte-compare, never assume.)
# ─────────────────────────────────────────────────────────────────────────────────────
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
    echo "    Every later FROMFINDINGS arm compares against this file and re-measures" >&2
    echo "    nothing, so restore it and re-run before reading ANY of them:" >&2
    echo "      git checkout -- $FINDINGS_COMMITTED" >&2
    return 1
  fi
  echo "    committed baseline VERIFIED unchanged (cksum): $FINDINGS_COMMITTED"
  return 0
}
trap 'verify_baseline_untouched || exit 2' EXIT

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
  # ⛔ THIS WARNING USED TO COUNT WITH A FILTER, AND THE NUMBER WAS WRONG. `^(<!--|## Note)`
  # matched 8 blocks in this baseline while the write-path twin's wider pattern matched 16
  # ON THE SAME FILE (measured 2026-09-05) — and by the property ("any line this generator
  # did not produce") the file carries eight KINDS, including 8 `> ⚠ **HAND-MERGED`
  # blockquotes, 37 rows with hand prose in column 5, and 20 rows stranded above a table
  # delimiter, none of which either pattern sees. A warning whose number comes from a filter
  # is only as true as the filter, so the COUNT has moved to the merge, where the complement
  # is actually computable, and this line no longer asks the operator to do anything.
  echo "--------------------------------------------------------------------------------"
  echo "FULL SWEEP — this run MERGES into the committed baseline; it does not replace it."
  echo "    baseline  : $FINDINGS_COMMITTED  (snapshotted to \$WORK before the first case)"
  echo "    generated : $GENERATED"
  echo "    Every line of the baseline this generator does not produce is re-inserted, and"
  echo "    the merge ABORTS rather than write an output that lost one. The count of"
  echo "    preserved hand-authored lines is printed by the merge itself, per emit."
  echo "--------------------------------------------------------------------------------"
fi

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
# Run an SQL file inside the container (avoids all shell-quoting of quals/bodies).
psql_f () {
  local host="$1"
  docker cp "$host" "$DB:/tmp/_p0mut.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_p0mut.sql 2>&1
}

# safe filename token from an arbitrary label
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' ; }

# Restore-on-exit: a gate is neutralized only for the ~23s of its suite run, but a kill
# in that window would leave it OPEN (dirty stack for the next owner — memory: shared
# local stack, single owner). INFLIGHT points at the SQL that restores the current gate;
# cleared the instant its inline restore succeeds. Set BEFORE neutralizing/opening.
#
# ⛔ THE TRAP PATH MUST VERIFY, 2026-09-04 (FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE).
# The old body ran psql_f and then `rm -f "$SENTINEL"` UNCONDITIONALLY. The sentinel does
# survive a SIGKILL — no trap runs, so nothing erases it. It does NOT survive the incident's
# actual signal, a job-tree SIGTERM: there the trap DOES run, its `psql` child dies with the
# process group, the restore fails, and the only record that a gate is open is deleted in the
# same breath. Both p0 siblings had the same shape; it was found while fixing the C2 harness.
#
# So the sentinel is dropped only when BOTH hold: psql_f exits 0 (real here — this psql_f
# carries `-v ON_ERROR_STOP=1`), AND a probe re-read FROM THE CATALOG returns exactly the
# value captured before the gate was opened. `arm_inflight` records that probe and its wanted
# value beside the sentinel ($SENTINEL.probe / .want) so RECOVER=1 in a LATER process can
# verify too, instead of believing psql's exit code alone.
INFLIGHT=""
INFLIGHT_PROBE=""
INFLIGHT_WANT=""
arm_inflight () {   # $1 = restore .sql   $2 = probe SQL identifying the ORIGINAL catalog state
  INFLIGHT="$1"; INFLIGHT_PROBE="$2"
  INFLIGHT_WANT="$(psql_c -c "$2" 2>/dev/null)"
  cp -f "$1" "$SENTINEL"                            # Part 4: survives SIGKILL, which no trap does
  printf '%s' "$2"              > "$SENTINEL.probe"
  printf '%s' "$INFLIGHT_WANT"  > "$SENTINEL.want"
}
disarm_inflight () {  # only ever after a restore has been VERIFIED
  INFLIGHT=""; INFLIGHT_PROBE=""; INFLIGHT_WANT=""
  rm -f "$SENTINEL" "$SENTINEL.probe" "$SENTINEL.want" 2>/dev/null || true
}
restore_inflight () {
  [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ] || return 0
  echo "  (trap: restoring the in-flight gate from $INFLIGHT)"
  local rc live
  psql_f "$INFLIGHT" >/dev/null 2>&1; rc=$?
  live=""
  [ -n "${INFLIGHT_PROBE:-}" ] && live="$(psql_c -c "$INFLIGHT_PROBE" 2>/dev/null)"
  if [ "$rc" = "0" ] && [ -n "${INFLIGHT_WANT:-}" ] && [ "$live" = "$INFLIGHT_WANT" ]; then
    echo "  restore VERIFIED against the catalog (psql rc=0, probe=$live)"
    disarm_inflight
    return 0
  fi
  echo "*** RESTORE FAILED (psql rc=$rc; catalog probe='${live:-<unreadable>}' want='${INFLIGHT_WANT:-<none captured>}')" >&2
  echo "    ⛔ THE SENTINEL IS KEPT ON PURPOSE: $SENTINEL" >&2
  echo "       It is the only record that a gate is OPEN on this stack. Do NOT delete it." >&2
  echo "      RECOVER=1 bash $0        # re-apply it, then VERIFY in the catalog" >&2
  echo "      supabase db reset        # the blunt, certain option" >&2
  echo "    ⚠ Do not hunt the open policy with a COUNT — the discriminator is cmd <> 'SELECT'." >&2
  return 2
}
# ⚠ compound: this REPLACES the baseline-guard trap installed above, so it must carry
# that duty too, or a subset run loses its outcome check from here on.
trap 'restore_inflight || exit 2; verify_baseline_untouched || exit 2' EXIT
trap 'echo; echo "*** SIGNAL — restoring the in-flight gate before exiting (Part 4)."; restore_inflight; exit 2' INT TERM HUP

# ─────────────────────────────────────────────────────────────────────────────────────
# The neutralizer — an ANONYMOUS `DO` block, baked per case (oid + newbody spliced in by
# bash). ⚠ It is deliberately NOT a persistent helper function: a persistent app.* helper
# (unpinned search_path, not SECURITY DEFINER, public-executable) trips the schema-surface
# pgTAP assertions and turns the GREEN baseline RED — poisoning the very control this
# audit depends on (caught on the first smoke run: preflight went FAIL with the helper
# present, PASS without it). A DO block leaves ZERO catalog residue.
#
# It keeps the ENTIRE pg_get_functiondef header (LANGUAGE, volatility, SECURITY DEFINER,
# search_path, LEAKPROOF, …) and swaps ONLY the dollar-quoted body. pg_get_functiondef
# guarantees the outer dollar-tag does not occur inside the body, so it appears exactly
# twice; split_part(...,tag,1) is the header up to and including `AS `. Raises if the tag
# can't be found (never a silent no-op — §7.1 red != no-op).
#
# NB: this harness runs `supabase test db`, which creates/drops pgtap + test_helpers
# ITSELF per run — so there is NO pgtap preflight here (pre-creating it is another way to
# poison the baseline). The ONLY preflight is the green-baseline gate.
# ─────────────────────────────────────────────────────────────────────────────────────

run_suite () {  # echoes raw suite output; ~23s
  ( cd "$ROOT" && supabase test db ) 2>&1
}

# classify OUTPUT -> sets globals VERDICT, FAILING, RUNFILES, RUNTESTS
classify () {
  local out="$1"
  local res ft
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  RUNFILES=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  RUNTESTS=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  local dubious
  dubious=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  # Failing test files (basenames), comma-joined.
  FAILING=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' \
            | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  # Files whose SHAPE broke. A NOTICED verdict is only actionable with the ABORTING file
  # named beside it — "the suite noticed" without saying WHERE is a line a reader cannot act
  # on and therefore does not re-read.
  #
  # ⛔ THE FIRST VERSION OF THIS SCRAPE FOUND NOTHING, AND IT WAS THREE HOURS OLD (2026-09-05).
  # It read the basename off the `Dubious` line, because that is where prove puts it *in some
  # layouts*. In THIS one it does not: the live plant's log carries the full path on the line
  # ABOVE (`…/140_patient_safety.sql .....`) and then a bare
  # `Dubious, test returned 3 (wstat 768, 0x300)`. So the note read `aborting file(s): <none
  # parsed>` on the very run built to prove the verdict works. A count is only as true as the
  # instrument named beside it, and the instrument was mine.
  #
  # The reliable source is prove's own `Test Summary Report`: a `<path>.sql   (Wstat: …)` line
  # whose INDENTED block carries `Parse errors:` (a bad plan) or `Non-zero exit status:`. A file
  # that merely failed assertions has neither, so it correctly does NOT appear here — it is in
  # `$FAILING`. ⚠ Only the summary is trusted; if there is no summary the field says so rather
  # than guessing, because the Files=/Tests= numbers in the note already carry the shape.
  SHAPEFILES=$(echo "$out" | awk '
      /Test Summary Report/                                      { insum = 1; next }
      insum && /\.sql[ \t]+\(Wstat:/                             { f = $1; sub(/^.*[\/\\]/, "", f); next }
      insum && /^[ \t]+(Parse errors:|Non-zero exit status:)/ && f != "" { print f; f = "" }
    ' | sort -u | paste -sd, -)
  # §7.15: a run whose SHAPE differs from baseline (fewer files/tests, or Dubious) is an
  # ABORT — a harness bug (bad neutralization), NOT a BLIND/COVERED result.
  #
  # ── §7.15c  THE FOURTH OUTCOME: `NOTICED` (FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE) ──
  # ⛔ A SHAPE MOVE USED TO DISCARD THE PARSED `Result:`, AND THAT THREW AWAY A REAL SIGNAL.
  # `app.event_current_custodian` opens -> `140_patient_safety.sql` reds its test 11 and then
  # ABORTS (`Bad plan. You planned 35 tests but ran 11`), so `Tests=` moves and §7.15 withheld
  # the verdict as ERROR. The suite PLAINLY noticed — a keystone went red — but ERROR says
  # "unclassifiable", which reads next to 28 genuine harness bugs as if nothing had been learned.
  # The follow-up's option (a) (a bespoke neutralization per aborting case) is the wrong
  # instrument for this class: the abort is `140`'s own value assertion whose subject now raises
  # (LEARN-083), not a defect in the neutralization, so there is nothing bespoke to write.
  #
  # So: shape moved AND `Result: FAIL` -> `NOTICED`. Every OTHER shape move stays `ERROR`.
  # ⛔ `NOTICED` NEVER COLLAPSES INTO COVERED and is never a pass:
  #   · it has its OWN count on the report line and its own column in the tables;
  #   · it is in the DIRTY test, so a NOTICED case exits 1 exactly like a BLIND;
  #   · it claims strictly LESS than COVERED — the failing assertions may belong to a
  #     DIFFERENT gate entirely, and with the denominator moved we cannot say they do not.
  # ⚠ `[ -z "$res" ]` (no `Result:` line at all) is a shape move whose `res` is not FAIL, so it
  #   stays ERROR — the ordering below makes that explicit rather than incidental.
  # ⛔ GLOBAL, not `local`, since 2026-09-06 (ADR 0191 D8). The retry net must fire on exactly
  # the cases this classifier calls shape-moved — NOTICED *and* ERROR — and the only way to
  # guarantee that is for both to read ONE predicate. The alternative (the C2 sibling's) is to
  # match the note TEXT, which is a second hand-kept copy of the same condition.
  SHAPE_MOVED=0
  if [ -z "$res" ] || [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    SHAPE_MOVED=1
  fi
  if [ "$SHAPE_MOVED" = "1" ]; then
    if [ "$res" = "FAIL" ]; then VERDICT="NOTICED"; else VERDICT="ERROR"; fi
  elif [ "$res" = "FAIL" ]; then
    VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then
    VERDICT="BLIND"
  else
    VERDICT="ERROR"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────────────
# emit_result — THE RESULT LINE AND THE EXIT CODE, as a function so an arm can construct a
# tally and read the code back. It was inline at the foot of this script until 2026-09-07;
# inline, the only way to test it was to run a 15-hour sweep, which is why the NOTICED class
# arrived with its classifier tested and its EXIT SEMANTICS untested.
#
# ⛔ THE PO RULING OF 2026-09-07, ENCODED WHERE THE RESULT LINE IS COMPUTED — not only in the
# prose that describes it. NOTICED is **disclosed, non-blocking, work-listed**: coverage
# EVIDENCE, its own class, never a verdict and never a pass, quoted in every gate record —
# and it does NOT block the phase. BLIND does, and ERROR is still not a pass.
# Therefore, and this is the whole behavioural change: a run with **0 BLIND, 0 ERROR and
# >0 NOTICED exits 0, WITH THE DISCLOSURE PRINTED**. Before this ruling it exited 1 and read
# as DIRTY, which made a disclosure indistinguishable from a blocking finding.
# ⚠ The classes are printed SEPARATELY on the DIRTY line for the same reason: `36 BLIND,
# 23 NOTICED, 0 ERROR` invited a reader to sum them into "59 problems". They are three
# different claims and only one of them blocks.
#   $1 swept  $2 blind  $3 noticed  $4 error     (globals: MERGE_FAILED, UNMATCHED, FINDINGS,
#                                                 BASELINE_SNAPSHOT, GENERATED)
# ─────────────────────────────────────────────────────────────────────────────────────
emit_result () {
  local swept="$1" blind="$2" noticed="$3" err="$4"
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
    return 2
  elif [ "$swept" -eq 0 ]; then
    # Belt-and-braces: the domain gate above should have exited 3 long before here.
    echo "=== RESULT: UNPROVEN — 0 gates swept despite a non-empty domain. Harness bug. ==="
    return 3
  elif [ "$blind" -gt 0 ] || [ "$err" -gt 0 ]; then
    echo "=== RESULT: DIRTY — $blind BLIND (blocks) · $noticed NOTICED (disclosed, non-blocking —"
    echo "    evidence, not a verdict) · $err ERROR (not a pass). BLIND blocks the phase (§6 step 1)."
    echo "    ERROR is not a pass — fix the neutralization and re-run that case. NOTICED is not a"
    echo "    pass either: a keystone reddened, but a file ABORTED so the failing assertions cannot"
    echo "    be attributed to this gate. It is strictly LESS than COVERED (§7.15c), it is QUOTED in"
    echo "    the gate record beside the BLIND count, and its remedy is capture-then-assert"
    echo "    (FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE). ==="
    return 1
  elif [ -n "$UNMATCHED" ]; then
    echo "=== RESULT: UNPROVEN (PARTIAL) — $swept gate(s) measured, 0 BLIND · 0 ERROR, but"
    echo "    these were requested and matched NO gate:$UNMATCHED"
    echo "    A clean verdict over a subset of what was asked for is the finding this gate"
    echo "    exists to prevent. NOT a pass. ==="
    return 3
  elif [ "$noticed" -gt 0 ]; then
    echo "=== RESULT: CLEAN WITH DISCLOSURE — $swept gate(s) measured; 0 BLIND · 0 ERROR ·"
    echo "    $noticed NOTICED (disclosed, non-blocking — evidence, not a verdict). ⛔ The NOTICED"
    echo "    rows are NOT covered gates: a keystone reddened but a file ABORTED, so the failing"
    echo "    assertions cannot be attributed to those gates. They are named in $FINDINGS, they"
    echo "    MUST be quoted in the gate record, and their remedy is capture-then-assert"
    echo "    (FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE). PO ruling 2026-09-07:"
    echo "    NOTICED discloses, it does not block. ==="
    return 0
  else
    echo "=== RESULT: CLEAN — $swept gate(s) measured, all COVERED. ==="
    return 0
  fi
}

# ─────────────────────────────────────────────────────────────────────────────────────
# SELFTEST — the classifier's FOUR outcomes on CONSTRUCTED strings, no DB, no suite run.
#
# ⛔ THE CONTROL IS THE (shape-moved, PASS) CASE, and it is the reason this arm exists. A
# fourth outcome that fired on EVERY shape move would be indistinguishable from renaming
# ERROR, and the report would read as "the suite noticed" for 28 cases where it did not.
# The discrimination half is therefore asserted explicitly: same input but for `Result:`,
# opposite verdict.
# ⚠ Run it BEFORE anything touches the catalog: `bash <this> ` with SELFTEST=1 exits here.
#   `CASES=` is irrelevant to it and the committed baseline is never opened for write.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "${SELFTEST:-0}" = "1" ]; then
  echo "=== SELFTEST: classify() — four outcomes on constructed strings (no DB) ==="
  BASE_FILES=262; BASE_TESTS=8876
  st_fail=0
  st_case () {  # $1 = label   $2 = expected verdict   $3 = the constructed suite output
    classify "$3"
    if [ "$VERDICT" = "$2" ]; then
      printf '  ok    %-34s -> %-8s (files=%s tests=%s)\n' "$1" "$VERDICT" "$RUNFILES" "$RUNTESTS"
    else
      printf '  NOT OK %-33s -> %-8s (expected %s)\n' "$1" "$VERDICT" "$2"; st_fail=$((st_fail+1))
    fi
  }
  st_shape_ok="ok 1 - something
Files=262, Tests=8876, Result: "
  st_shape_moved="Bad plan. You planned 35 tests but ran 11.
Files=262, Tests=8712, Result: "
  st_case "same shape + FAIL"   COVERED "${st_shape_ok}FAIL"
  st_case "same shape + PASS"   BLIND   "${st_shape_ok}PASS"
  st_case "shape MOVED + FAIL"  NOTICED "${st_shape_moved}FAIL"
  st_case "shape MOVED + PASS"  ERROR   "${st_shape_moved}PASS"   # ⭐ THE CONTROL
  # Two more, because the two ways a shape can move are not the same code path:
  st_case "Dubious only + FAIL" NOTICED "ok 1 - x
Dubious, test returned 2
Files=262, Tests=8876, Result: FAIL"
  st_case "no Result: line"     ERROR   "Files=262, Tests=8876"
  echo "--- SELFTEST classify: $((6 - st_fail))/6 ok, $st_fail failed ---"

  # ── ARM 2: resets_enabled() POLARITY (ADR 0191 D8) — no DB, nothing destructive. ──────
  # ⛔ THE CONTROL IS TRIAL A vs TRIAL B: same value 20/1, same SUBSET, opposite SET-NESS.
  # Without it a green row proves only "the subset gate exists", not that the gate turns on
  # set-ness — which is the one distinction ADR 0189 D6's re-ruling is about, and the one a
  # `RESET_EVERY="${RESET_EVERY:-20}"` written ONE LINE EARLIER would silently destroy.
  echo "=== SELFTEST: resets_enabled() — the reset gate's polarity (no DB) ==="
  rt_fail=0
  rt_case () {  # $1 label  $2 SUBSET_RUN  $3 RESET_EVERY  $4 EXPLICIT  $5 expected (yes|no)
    local got
    SUBSET_RUN="$2"; RESET_EVERY="$3"; RESET_EVERY_EXPLICIT="$4"
    if resets_enabled; then got=yes; else got=no; fi
    if [ "$got" = "$5" ]; then
      printf '  ok    %-46s -> resets=%s\n' "$1" "$got"
    else
      printf '  NOT OK %-45s -> resets=%s (expected %s)\n' "$1" "$got" "$5"; rt_fail=$((rt_fail+1))
    fi
  }
  rt_case "A  SUBSET, RESET_EVERY unset (defaulted 20)"  1 20 0 no
  rt_case "B  SUBSET, RESET_EVERY=1 EXPLICIT"            1 1  1 yes
  rt_case "B' SUBSET, RESET_EVERY=20 EXPLICIT"           1 20 1 yes   # ⭐ vs A: set-ness, not value
  rt_case "C  full run, RESET_EVERY unset (defaulted 20)" 0 20 0 yes
  rt_case "E  full run, RESET_EVERY=0"                   0 0  0 no
  rt_case "E' SUBSET,   RESET_EVERY=0 EXPLICIT"          1 0  1 no    # 0 disables EVERYWHERE
  echo "--- SELFTEST resets_enabled: $((6 - rt_fail))/6 ok, $rt_fail failed ---"

  # ── ARM 3: emit_result() — the RESULT line and the EXIT CODE (PO ruling 2026-09-07). ──
  # ⛔ THE CONTROL IS THE PAIR (0 BLIND, 0 ERROR, 1 NOTICED) -> rc 0  vs  (1 BLIND, 0 ERROR,
  # 1 NOTICED) -> rc 1. Same NOTICED count, opposite code: without both halves a green row
  # would prove only "the function returns a number", not that NOTICED stopped blocking while
  # BLIND kept blocking — which is the entire ruling. The DISCLOSURE half is asserted too: an
  # rc 0 that printed no NOTICED line would be a SILENT pass, and silently passing a disclosed
  # class is worse than the DIRTY it replaces.
  echo "=== SELFTEST: emit_result() — result line + exit code on constructed tallies (no DB) ==="
  MERGE_FAILED=0; UNMATCHED=""
  FINDINGS="<selftest>"; BASELINE_SNAPSHOT="<selftest>"; GENERATED="<selftest>"
  er_fail=0
  er_case () {  # $1 label  $2..$5 swept blind noticed error  $6 expected rc  $7 required substring
    local out rc
    out="$(emit_result "$2" "$3" "$4" "$5")"; rc=$?
    if [ "$rc" = "$6" ] && printf '%s' "$out" | grep -qF -- "$7"; then
      printf '  ok    %-48s -> rc=%s\n' "$1" "$rc"
    else
      printf '  NOT OK %-47s -> rc=%s (expected %s) / missing %s\n' "$1" "$rc" "$6" "$7"
      printf '%s\n' "$out" | sed 's/^/           /'
      er_fail=$((er_fail+1))
    fi
  }
  er_case "0 BLIND, 0 ERROR, 1 NOTICED"          353 0 1 0 0 "CLEAN WITH DISCLOSURE"
  er_case "  ...and it PRINTS the count"         353 0 1 0 0 "1 NOTICED (disclosed, non-blocking"
  er_case "1 BLIND, 0 ERROR, 1 NOTICED"          353 1 1 0 1 "1 BLIND (blocks)"          # ⭐ CONTROL
  er_case "0 BLIND, 1 ERROR, 1 NOTICED"          353 0 1 1 1 "1 ERROR (not a pass)"
  er_case "0 BLIND, 0 ERROR, 0 NOTICED"          353 0 0 0 0 "RESULT: CLEAN "
  er_case "36 BLIND, 23 NOTICED, 0 ERROR (run 2)" 353 36 23 0 1 "36 BLIND (blocks) · 23 NOTICED"
  UNMATCHED=" bogus_gate"
  er_case "UNMATCHED outranks a bare NOTICED"    353 0 1 0 3 "UNPROVEN (PARTIAL)"
  UNMATCHED=""
  MERGE_FAILED=1
  er_case "a MERGE ABORT still outranks all"     353 0 1 0 2 "MERGE ABORTED"
  MERGE_FAILED=0
  echo "--- SELFTEST emit_result: $((8 - er_fail))/8 ok, $er_fail failed ---"

  echo "--- SELFTEST TOTAL: $((20 - st_fail - rt_fail - er_fail))/20 ok, $((st_fail + rt_fail + er_fail)) failed ---"
  [ "$((st_fail + rt_fail + er_fail))" -eq 0 ] || exit 1
  exit 0
fi

echo "=== P0 AUTHZ DOOR AUDIT — neutralize each gate, ask the WHOLE SUITE if anyone noticed ==="
echo "Repo: $ROOT"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ PART 4 (FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED) — THE CRASH-SENTINEL CHECK. Identical
# mechanism to the write-path sibling, ported here because the FUP names BOTH harnesses:
# they mutate live gates and restore from a trap, and a SIGKILL runs no trap at all.
# Fixing one of two would read as fixing the class.
#
# Measured 2026-08-27: a killed run left an UPDATE policy at `qual=true wc=true`, open to
# `authenticated`, with nothing anywhere reporting it. Refusing to start is the point --
# sweeping on top of a contaminated catalog yields verdicts that look perfectly ordinary.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ -s "$SENTINEL" ]; then
  if [ "${RECOVER:-0}" = "1" ]; then
    echo "--- RECOVER=1: applying the abandoned restore from $SENTINEL ---"
    sed -n '1,40p' "$SENTINEL"
    # ⛔ 2026-09-04: the recovery is VERIFIED, not believed. arm_inflight leaves the probe
    #    that identifies the ORIGINAL state beside the sentinel, so a LATER process can
    #    re-read the catalog instead of trusting psql's exit code (which, in a harness
    #    without ON_ERROR_STOP, is 0 even on an ERROR).
    psql_f "$SENTINEL" >/dev/null 2>&1; rec_rc=$?
    rec_live=""; rec_want=""
    [ -s "$SENTINEL.probe" ] && rec_live="$(psql_c -c "$(cat "$SENTINEL.probe")" 2>/dev/null)"
    [ -s "$SENTINEL.want"  ] && rec_want="$(cat "$SENTINEL.want")"
    if [ "$rec_rc" = "0" ] && [ -n "$rec_want" ] && [ "$rec_live" = "$rec_want" ]; then
      mv -f "$SENTINEL" "$SENTINEL.recovered" 2>/dev/null || rm -f "$SENTINEL"
      rm -f "$SENTINEL.probe" "$SENTINEL.want" 2>/dev/null || true
      echo "*** RESTORE APPLIED and VERIFIED against the catalog (psql rc=0, probe=$rec_live)."
      echo "    ⚠ VERIFY IT ANYWAY -- this message is not proof. Re-read the gate from the"
      echo "    catalog; if in any doubt run 'supabase db reset'."
      echo "    ⛔ Every verdict from the killed run is void: re-run the sweep from scratch."
      exit 2
    fi
    echo "*** RESTORE FAILED (psql rc=$rec_rc; catalog probe='${rec_live:-<unreadable>}'" >&2
    echo "    want='${rec_want:-<no probe sidecar: this sentinel predates the verified-restore" >&2
    echo "    protocol, so it CANNOT be verified from here>}')." >&2
    echo "    The gate is STILL OPEN and the sentinel is KEPT. Run 'supabase db reset' now." >&2
    exit 2
  fi
  echo "*** ABORT — A PREVIOUS RUN DIED WITH A GATE STILL OPEN." >&2
  echo "    Sentinel: $SENTINEL   (it holds the SQL that restores it)" >&2
  sed -n '1,12p' "$SENTINEL" | sed 's/^/      | /' >&2
  echo "    Do ONE of:" >&2
  echo "      RECOVER=1 bash $0        # apply that restore, then VERIFY it in the catalog" >&2
  echo "      supabase db reset        # the blunt, certain option" >&2
  echo "    ⛔ Do not delete the sentinel to get past this: it restores nothing and is the" >&2
  echo "       only record that a gate is open." >&2
  echo "    ⚠ Do not hunt the open policy with a COUNT -- ~10 are 'true' BY DESIGN" >&2
  echo "      (vocabulary SELECT policies). The discriminator is cmd <> 'SELECT'." >&2
  exit 2
fi

# ────────────────────────────────────────────────────────────────────────────────
# §7.16  PREFLIGHT: NO GATE IS ALREADY SITTING DEGENERATE  (FUP-AUTHZ-HARNESS-TRANSACTIONAL)
#
# ⛔ WHY THIS IS NOT THE FILED FIX, AND WHY THE FILED FIX CANNOT BE BUILT.
# The follow-up proposes making neutralize -> probe -> restore ONE ROLLED-BACK
# TRANSACTION, on the (correct) ground that Postgres DDL is transactional. That
# works for a probe issued on the SAME session — and this harness's probe is not
# one. `run_suite` shells out to `supabase test db`, a SEPARATE PROCESS with its
# own connections (see the header: "we mutate the LIVE, COMMITTED catalog and run
# `supabase test db` end-to-end"). A neutralization held inside an uncommitted
# transaction is INVISIBLE to it, so every case would run against the ORIGINAL
# gate and be classified COVERED — a sweep that is 100% green and 100% vacuous.
# That is strictly worse than the bug the fix targets. The commit-then-restore
# design is REQUIRED by the probe's process boundary, not an oversight.
#
# What is achievable is making the failure LOUD instead of silent. Process death
# can still leave a gate open; it can no longer do so unnoticed, because:
#   (a) this preflight refuses to start a sweep on a contaminated stack — which
#       is exactly the manual check that caught the original incident, when
#       `tester` verified its environment before executing an agreed plan and
#       found everything it was about to run would have gone green proving
#       nothing; and
#   (b) the same query is a PREFLIGHT TO EVERY ARM of p0-authz-invariant.sh, so
#       the standing §6 gate step sees it too.
#
# ⚠ The detector covers all THREE neutralization forms this harness emits —
# `begin return true; end` (plpgsql), `select true` (language sql, 182 DEFINER
# functions here), and `begin return; end` (assert_noop). The regex recorded in
# the follow-up matches only the first.
# ────────────────────────────────────────────────────────────────────────────────
DEGENERATE_PREDICATE="( p.prosrc ~ '^\s*begin\s+return\s+(true|false)\s*;\s*end'
     or p.prosrc ~ '^\s*select\s+(true|false)\s*;?\s*\$'
     or p.prosrc ~ '^\s*begin\s+return\s*;\s*end'
     or p.prosrc ~ 'P0-SETVALUED-NEUTRALIZED' )"

degenerate_gates () {
  psql_c -c "select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
               from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('app','public','authz') and $DEGENERATE_PREDICATE
              order by 1;" | grep -vE '^$'
}

echo "--- preflight: no gate is already sitting degenerate (§7.16) ---"
PRE_DEGEN=$(degenerate_gates)
if [ -n "$PRE_DEGEN" ]; then
  echo "*** PREFLIGHT FAILED: a gate is ALREADY neutralized on this stack:"
  echo "$PRE_DEGEN" | sed 's/^/      /'
  echo "    A sweep started here would classify against an already-open door."
  echo "    Restore it first (pg_proc carries no mtime — the window cannot be dated,"
  echo "    so any result produced since the last known-good run must be RE-RUN)."
  exit 2
fi
echo "    clean — 0 degenerate bodies (all three neutralization forms)"

# ⚠ The GREEN-BASELINE preflight used to run HERE. It now runs AFTER the domain gate
# below (§7.17): capturing the baseline costs a full ~23 s suite run and *touches the
# stack* (`supabase test db` creates/drops pgtap + test_helpers), and paying that to
# then sweep ZERO cases is exactly the run this script must refuse. Domain first,
# baseline second. Everything between here and the gate is READ-ONLY on the catalog.

# ─────────────────────────────────────────────────────────────────────────────────────
# Build the two worklists from the LIVE catalog (never migration text).
#   PRED: secdef boolean gates — selected by NAME *or* by PROPERTY (see §7.17a below)
#         — plus the void raise-guard assert_not_case_excluded. Direction: the three
#         deny predicates -> false; the void assert -> no-op; everything else -> true.
#         ⚠ value-returning raise-guards (assert_*_writable, assert_referral_*) are
#         EXCLUDED from the auto-sweep — neutralizing a uuid/record raise-guard risks a
#         NULL-propagation ABORT downstream (§7.15). They are listed in the report as a
#         manual-neutralization GAP for the lead to hand-add bespoke.
#   POL:  SELECT/ALL policies on public tables whose qual is a real predicate (not `true`).
# ─────────────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────────────
# §7.17a  THE PREDICATE ARM'S DOMAIN — ONE DEFINITION, INTERPOLATED TWICE.
#
# ⛔ IT USED TO BE TWO HAND-KEPT COPIES of the same SQL (the worklist's filter and the
# out-of-domain census's `not (...)`). Editing one and not the other would have made the
# census silently disagree with the arm it censuses — the report would still print a
# number, and the number would be about a domain nothing swept. The complement is now
# `not ($PRED_DOMAIN)` on the same string, so the two CANNOT drift.
#
# ── WHY THIS IS A PROPERTY NOW AND NOT ONLY A NAME (FUP-DOOR-AUDIT-PREDICATE-ARM-
#    BOUNDED-BY-A-NAME; ADR 0079 Amendment 9) ────────────────────────────────────────
# ⚠ This said "Amendment 8" until 2026-09-05. Amendment 8 is the ALTER-POLICY / stale-verdict
#   ruling; Amendment 9 is the one that owns this follow-up and this widening. A citation is
#   an assertion that goes stale silently — this one pointed a reader at the wrong decision.
# The domain was `^(is_|can_|has_|…)` alone — a NAME regex standing in for the property
# "is an authorization predicate", which no regex decides. ADR 0136 hit it live: its new
# gate, written as `app.signoff_deferred_open`, was shaped exactly like a predicate and
# excluded purely by its name; the diff-scoped sweep matched ZERO gates and reported
# `UNPROVEN — NOTHING WAS MEASURED`. Renaming it to `app.is_signoff_deferral_open` cleared
# the sweep — a workaround that made coverage depend on a naming convention no gate
# enforces. The next gate called `phase_is_open` escapes the same way.
#
# So the arm now ALSO admits by what a function DOES: its body (with `--` comments
# stripped first — a line-filtered prosrc drops disjuncts) references an identity
# primitive. Measured 2026-08-24 on the live catalog: of the 42 `prosecdef` booleans then
# outside the name regex, exactly NINE satisfy this property — eight are genuine gates
# (`_audit_access_authorized`, `confidentiality_clearance_ok`, `event_current_custodian`,
# `member_can`, `member_can_for`, `capa_viewer_can_manage`, `interview_viewer_can_write`,
# `rca_writer_can_write`), and the ninth is a known side-effecting writer, excluded below.
# The other 33 (feature-flag readers, `validate_*` shape checkers, `print_source_*`) touch
# no identity and stay out — which is why widening by PROPERTY does not reproduce the
# problem the script's own header warned about when it declined to widen by TYPE.
#
# ⛔ THE WRITER EXCLUSION IS THE WHOLE REASON THE ORIGINAL WIDENING WAS DECLINED. Two
# `prosecdef` booleans have side effects: swapping their body for `select true` would
# silently disarm a notification enqueue / an approver reminder rather than open a gate,
# and the suite would go green for the wrong reason. `remind_document_approver` DOES match
# the identity property (it reads `memberships`), so it must be excluded by name;
# `enqueue_notification` does not match it, and is named anyway so that a future edit to
# its body cannot pull it in silently. Both stay VISIBLE in the out-of-domain census.
# ⚠ Any addition to this list is a claim that the function has side effects — never a way
# to quiet a BLIND verdict.
#
# ── THE THIRD AXIS: SCHEMA (ADR 0191; FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS) ──
# ⛔ NAME-OR-BODY WAS STILL NOT ENOUGH, and the population it missed is the one AE5 re-keys
# onto. `authz.scope_reaches` and `authz.candidate_has_permission` are `prosecdef` BOOLEANS
# matching NEITHER regex (measured 2026-09-05: `by_name=f by_identity=f` for both) — their
# bodies reach identity only through `authz.*` helpers this identity regex does not name,
# which is exactly the indirection §7.17b already admitted it could not see. Meanwhile
# `authz.has_permission` IS in domain, by `^has_`. So the resolver family was swept ON ONE
# AXIS ONLY, and the green from that axis read as if it covered the family.
#
# The property that closes it is the SCHEMA: no application role holds USAGE on `authz`
# (pgTAP 401 §18), so a `prosecdef` function there exists to answer an authorization
# question — there is nothing else it could be. Hence `n.nspname = 'authz'` as a third
# admitting disjunct, written LITERALLY rather than as a fourth sub-variable, so that
# `scripts/door-sweep-cases.sh`'s lift (three explicit substitutions, then ABORT on any
# surviving `$`) keeps working with no edit.
#
# ⛔ BOUNDING IT AT `bool` IS LOAD-BEARING AND MEASURED, not defensive. Ten `prosecdef`
# functions live in `authz`; only 4 are boolean. An UNBOUNDED `n.nspname='authz'` would
# admit the other 6 — `assignment_facts`, `authorized_scope_ids`,
# `candidate_authorized_scope_ids`, `entailed_grants`, `explain_permission`,
# `rebuild_implication_closure` — which the direction classifier below labels `positive`,
# whose neutralization is `select true`, which does not type-check against `record` /
# `SETOF uuid` / `permission_explanation` / `int4`. That is 6 GUARANTEED ERROR rows: the
# widening-by-TYPE trap this script's own header declined, re-entered through the schema
# door. The `bool` bound keeps the NEUTRALIZATION MODEL unchanged — which is precisely why
# ADR 0173 §4's refusal does not reach this axis: §4 refused a RETURN-TYPE widening BECAUSE
# it would change that model, and its four subjects return `int4`/`responses`.
#
# ⛔ THE SET-VALUED RESOLVERS ARE NOT FIXED HERE and must not be read as fixed. They are out
# by RETURN TYPE, and only a boolean is sweepable by this mechanism (ADR 0079 hazard 4).
# Their home is `supabase/tests/mutation/authz-setvalued-targeted-cases.sh`, named in the
# §7.17c domain statement so it is quoted at every gate rather than remembered.
# ─────────────────────────────────────────────────────────────────────────────────────
PRED_NAME_RE="^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)"
PRED_IDENTITY_RE="auth\.uid\(\)|memberships|member_can|app\.is_|app\.can_|app\.has_|principal_id"
PRED_SIDE_EFFECTING="'enqueue_notification','remind_document_approver'"
PRED_DOMAIN="(
       (t.typname='bool'
          and p.proname not in ($PRED_SIDE_EFFECTING)
          and (
               n.nspname = 'authz'
            or (p.proname ~ '$PRED_NAME_RE' and p.proname !~ '^is_valid_')
            or regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ '$PRED_IDENTITY_RE'
          ))
       or p.proname = 'assert_not_case_excluded'
    )"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ A FUNCTION SINCE 2026-09-06 (ADR 0191 D8) — the periodic reset must RE-DERIVE these
# worklists to prove the tree did not move under the run, and a second hand-kept copy of
# three catalog queries is the drift this file spends §7.17a forbidding.
#
# ⛔ THE SUFFIX TAG IS LOAD-BEARING. Both sweep loops read their worklist through
# `done < "$WORK/worklist_*.tsv"`, so re-deriving into those names MID-LOOP would corrupt
# the iteration the reset exists to protect. The primary call passes "" and therefore
# writes exactly the three paths every later reader already uses, byte-for-byte; the reset
# passes ".reset" and only ever compares.
# ─────────────────────────────────────────────────────────────────────────────────────
derive_worklists () {   # $1 = "" for the primary artefacts, or a suffix tag like ".reset"
  local t="${1:-}"
psql_c -c "\copy (
  select p.oid,
         n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label,
         p.proname,
         case
           when p.proname in ('is_case_excluded','is_case_respondent','is_recused_from_case') then 'deny'
           when t.typname='void' and p.proname ~ '^assert_' then 'assert_noop'
           else 'positive'
         end as direction,
         l.lanname
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language  l on l.oid=p.prolang
  join pg_type      t on t.oid=p.prorettype
  where n.nspname in ('app','public','authz')
    and p.prosecdef = true
    and $PRED_DOMAIN
  order by p.proname
) to '/tmp/wl_pred.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_pred.tsv" "$WORK/worklist_pred.tsv$t" >/dev/null

# ─────────────────────────────────────────────────────────────────────────────────────
# §7.17b  THE DOMAIN IS STILL NOT THE WHOLE PROPERTY — SO MEASURE WHAT IS OUTSIDE IT.
#
# §7.17a widened the PRED filter from a bare NAME regex to `name OR identity-touching
# body`, which is a far better approximation of "is an authorization predicate" — but it
# is still an approximation, and this census is what keeps that admission attached to
# every report. A gate whose body reaches identity only INDIRECTLY (through a helper this
# regex does not name) is outside the arm and looks exactly like a feature-flag reader
# from here.
#
# What remains outside, measured 2026-08-24 after the widening: feature-flag readers
# (`*_enabled`), `validate_*` shape-checkers, `print_source_*`, and the two SIDE-EFFECTING
# writers held out BY NAME (`app.enqueue_notification`, `public.remind_document_approver`)
# whose body must NOT be swapped for `select true`. The writers appear here rather than
# vanishing: an exclusion nobody can see is an exclusion nobody re-reads.
#
# ⛔ "outside the predicate arm" != "unswept" (other arms exist) and this count is NOT a
# defect count — it is the size of the unclassified set. Classification is tracked in
# authz-unswept-backlog.txt, not decided here.
# ─────────────────────────────────────────────────────────────────────────────────────
psql_c -c "\copy (
  select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_type      t on t.oid=p.prorettype
  where n.nspname in ('app','public','authz')
    and p.prosecdef = true
    and t.typname='bool'
    and not $PRED_DOMAIN
  order by 1
) to '/tmp/wl_pred_out.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_pred_out.tsv" "$WORK/outofdomain_pred_bool.tsv$t" >/dev/null

psql_c -c "\copy (
  select c.relname as tbl, pol.polname,
         (case pol.polcmd when 'r' then 'SELECT' when '*' then 'ALL' end) as cmd,
         (pol.polwithcheck is not null) as has_wc
  from pg_policy pol
  join pg_class c on c.oid=pol.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and pol.polcmd in ('r','*')
    and coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') not in ('true','')
  order by c.relname, pol.polname
) to '/tmp/wl_pol.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_pol.tsv" "$WORK/worklist_pol.tsv$t" >/dev/null
}

# THE PRIMARY DERIVATION — "" so the three paths are exactly what every later reader uses.
derive_worklists ""

# The intentionally-public catalogs we SKIP (qual = true): neutralizing true->true is a
# vacuous no-op. Listed in the report per the brief.
psql_c -c "\copy (
  select c.relname||' / '||pol.polname||' / '||(case pol.polcmd when 'r' then 'SELECT' when '*' then 'ALL' else pol.polcmd::text end)
  from pg_policy pol
  join pg_class c on c.oid=pol.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and pol.polcmd in ('r','*')
    and coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') = 'true'
  order by 1
) to '/tmp/wl_skip.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_skip.tsv" "$WORK/skipped_pol_true.tsv" >/dev/null

# ─────────────────────────────────────────────────────────────────────────────────────
# §7.17c  THE DOMAIN STATEMENT — the POPULATIONS THIS SWEEP DOES NOT COVER, on every run.
#         (FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN; ADR 0184 point 4 + 0187 D1.)
#
# ⛔ WHY A BLOCK AND NOT AN ALLOWLIST ENTRY. The follow-up is explicit that an allowlist does
# not close it: `public.reopen_interview`'s BLIND verdict is CORRECT — the door is called and
# its guard really is unasserted — but the REASON is not the usual one. Its `HC038` is
# delivered by `app.guard_interview_status`, a TRIGGER on `case_interviews`. The two BLINDs
# need different remedies (a keystone on the door vs a keystone on a fixture the trigger does
# not already refuse) and the findings file cannot tell them apart. What is missing is not a
# verdict; it is the DOMAIN beside it — the ADR 0079 failure this whole program exists to
# prevent ("a gate record names the arm and its domain, never the script").
#
# ⛔ A TRIGGER ENFORCER CANNOT ENTER THIS ARM, STRUCTURALLY. Postgres invokes a trigger
# function FROM THE TABLE, not from the body of the door that wrote to it, so there is no call
# edge to follow and no boolean to flip. That is not a gap this arm can close by widening; it
# is a bound this arm must STATE.
#
# ⚠ DERIVED EVERY RUN, NEVER LITERAL. The counts below are read from the live catalog at run
#   time. A literal would be a claim about a catalog that has moved — the failure mode this
#   file's own §7.3 ("assert the state, don't claim it") exists to stop.
# ─────────────────────────────────────────────────────────────────────────────────────
TRIG_SECDEF=$(psql_c -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname in ('app','public') and p.prosecdef
                            and p.prorettype='pg_catalog.trigger'::regtype;" | tr -d '[:space:]')
TRIG_WIRED=$(psql_c -c "select count(*) from pg_trigger tg where not tg.tgisinternal;" | tr -d '[:space:]')
SETVALUED_N=$(psql_c -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname in ('app','public','authz') and p.prosecdef
                            and p.proretset and p.prorettype='pg_catalog.uuid'::regtype;" | tr -d '[:space:]')

domain_statement () {   # markdown that also reads correctly on a terminal
  echo "DOMAIN-STATEMENT: what a COVERED/BLIND verdict from THIS arm does NOT cover."
  echo "(§7.17c — derived from the live catalog on every run; quote this block, not the script.)"
  echo
  echo "1. **Tier 2 — 190 doors, deferred by ADR 0171, not cleared.** (ADR 0187 D1: every gate"
  echo "   record citing this sweep must say so in those words.)"
  echo "2. **The \`HCDS*\` family (60 raises) and \`28000\` (6).** The C2 neutralizer anchors on"
  echo "   \`errcode = '(42501|HC0[A-Z0-9]{2})'\`, which requires a literal \`0\` in position 3, and"
  echo "   the gate-fn filter uses the same anchor — so these doors are STRUCTURALLY ABSENT from"
  echo "   that worklist and appear in its findings neither as a verdict nor as an ERROR."
  echo "3. **The C2 ERROR class — ~10 enforcers expected, no verdict.** 39 anchored raises carry a"
  echo "   \`;\` inside the message literal, which the negated-semicolon anchor cannot span, so the"
  echo "   mutation never lands. It fails CLOSED (never a false COVERED), and a door with no"
  echo "   verdict is still not a covered door."
  echo "4. **Trigger enforcers — $TRIG_SECDEF \`prosecdef\` trigger function(s) behind $TRIG_WIRED wired"
  echo "   trigger(s), DERIVED this run.** Postgres invokes a trigger FROM THE TABLE, so a trigger"
  echo "   function has no call edge from the door that fires it and no boolean this arm can flip."
  echo "   ⛔ Therefore a trigger-caused BLIND is INDISTINGUISHABLE here from an absent-assertion"
  echo "   BLIND: the first is discharged only by a keystone on a fixture the TRIGGER does not"
  echo "   already refuse; the second by a keystone on the door. Measured witness:"
  echo "   \`public.reopen_interview\` BLIND while \`121_interviews.sql\` pins its \`HC038\` — the"
  echo "   \`HC038\` observed comes from \`app.guard_interview_status\`, a trigger on \`case_interviews\`."
  echo "   ⚠ A defence-in-depth pair (door guard + trigger guard) can therefore LOOK like a gap."
  echo "5. **The NOTICED class — DISCLOSED, NON-BLOCKING, and NOT a verdict** (PO ruling"
  echo "   2026-09-07). A gate whose neutralization reddened the suite while a file ABORTED"
  echo "   carries NOTICED, never COVERED: the denominator moved, so the failing assertions"
  echo "   cannot be attributed to THIS gate. NOTICED is coverage EVIDENCE — it is its own class,"
  echo "   it must be quoted beside the BLIND count in every gate record citing this sweep, and it"
  echo "   does NOT block the phase. ⛔ BLIND does, and ERROR is not a pass. A NOTICED row is an"
  echo "   UNRESOLVED gate, never a covered one; its remedy is capture-then-assert, work-listed"
  echo "   under \`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE\`."
  echo
  echo "**This arm's own bounds** (PO-accepted 2026-09-05, stated verbatim):"
  echo "> \`prosecdef\` boolean in app/public/authz by authz-shaped **name**, identity-touching"
  echo "> **body**, or \`authz\` **schema** membership, minus the 2 side-effecting writers; the"
  echo "> $PRED_OUT outside are enumerated per run in §7.17b and in this statement."
  echo
  echo "- **$PRED_OUT \`prosecdef\` boolean(s) outside the domain**, listed at the end of this report."
  echo "  \"Outside this arm\" is NOT \"unswept\" — other arms exist — and $PRED_OUT is the size of the"
  echo "  UNCLASSIFIED set, never a defect count."
  echo "- **The 2 side-effecting writers** (\`app.enqueue_notification\`,"
  echo "  \`public.remind_document_approver\`) are held out BY NAME: swapping their body for"
  echo "  \`select true\` would disarm a notification enqueue / an approver reminder rather than"
  echo "  open a gate, and the suite would go green for the wrong reason."
  echo "- **Value-returning raise-guards** (\`assert_*_writable\`, \`assert_referral_*\`) are excluded"
  echo "  from the auto-sweep: neutralizing a uuid/record raise-guard risks a NULL-propagation"
  echo "  abort downstream (§7.15). They owe bespoke, hand-added neutralizations."
  echo "- **Set-valued resolvers — $SETVALUED_N \`prosecdef\` \`SETOF uuid\` function(s), DERIVED this"
  echo "  run.** Only a BOOLEAN predicate is sweepable by this mechanism (ADR 0079 hazard 4), so"
  echo "  they are out of domain by RETURN TYPE, before any name or body test runs. Three of them"
  echo "  are authorization scope resolvers and have a committed, scheduled home:"
  echo "  \`supabase/tests/mutation/authz-setvalued-targeted-cases.sh\`."
  echo "- **RLS policies**: this arm sees \`polcmd in ('r','*')\` only, and since 2026-09-05 it opens"
  echo "  the \`using\` half ALONE. A verdict here is a claim about the READ half and nothing else;"
  echo "  the \`with check\` half belongs to \`p0-authz-writepath-audit.sh\`."
}

want () {  # $1 = match key (proname or polname); returns 0 if in CASES (or CASES empty)
  [ -z "$CASES" ] && return 0
  local k
  for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────────────
# §7.17  THE DOMAIN GATE — an EMPTY-DOMAIN RUN MUST NOT PRINT THE LINE A CLEAN RUN PRINTS
#        (FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME)
#
# ⛔ THE FINDING THIS CLOSES IS NOT A COVERAGE GAP. It is that a sweep of ZERO cases
# ended with `BLIND: 0   ERROR(harness): 0` — BYTE-IDENTICAL to the line a clean sweep
# of the full domain prints — and that line was then read into a §6 step-1 gate record
# as a clean pass for a change that added a PHI writer. A detector that found nothing
# because it LOOKED at nothing must be distinguishable from one that found nothing
# because there was nothing to find. Measured (2026-08-22): the diff-scoped remediation
# `ARM=census` itself prints ran 0 cases and reported 0 BLIND.
#
# So the outcome is THREE-WAY, not boolean — an escape hatch for the unmeasured must not
# be spendable as a pass:
#     exit 0  CLEAN     — a NON-EMPTY selection was swept and every case came back COVERED
#     exit 1  DIRTY     — BLIND and/or ERROR cases exist (the pre-existing finding state)
#     exit 3  UNPROVEN  — nothing was measured: no case selected, or a requested case
#                         matched no gate. NEVER reported as 0/0.
#     exit 2  ABORT     — contaminated stack / botched restore (pre-existing).
#
# The gate sits BEFORE the green-baseline capture on purpose: an UNPROVEN run then costs
# ~0 s, mutates NOTHING (no suite run, no neutralization), and — because `emit_report` is
# only ever called from `record` — cannot rewrite the findings file either.
# ─────────────────────────────────────────────────────────────────────────────────────
count_sel () {  # $1 = worklist file, $2 = 1-based field holding the match key
  local n=0 line key
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    key=$(printf '%s' "$line" | cut -f"$2")
    want "$key" && n=$((n+1))
  done < "$1"
  echo "$n"
}

PRED_TOTAL=$(grep -c . "$WORK/worklist_pred.tsv" | tr -d '[:space:]')
POL_TOTAL=$(grep -c . "$WORK/worklist_pol.tsv"  | tr -d '[:space:]')
PRED_OUT=$(grep -c . "$WORK/outofdomain_pred_bool.tsv" | tr -d '[:space:]')
PRED_SEL=$(count_sel "$WORK/worklist_pred.tsv" 3)   # field 3 = proname
POL_SEL=$(count_sel  "$WORK/worklist_pol.tsv"  2)   # field 2 = polname
SEL_TOTAL=$((PRED_SEL + POL_SEL))

echo "--- domain: what this run will actually look at (§7.17) ---"
echo "ARM-DOMAIN predicate=$PRED_SEL/$PRED_TOTAL policy=$POL_SEL/$POL_TOTAL"
echo "    predicate arm: $PRED_SEL selected of $PRED_TOTAL in domain"
echo "    policy    arm: $POL_SEL selected of $POL_TOTAL in domain"
echo "    ⚠ NOT in the predicate arm's domain at all: $PRED_OUT prosecdef BOOLEAN function(s)"
echo "      (list: $WORK/outofdomain_pred_bool.tsv). The domain is 'authz-shaped NAME **or**"
echo "      identity-touching BODY', minus the 2 side-effecting writers held out by name"
echo "      (§7.17a) — a good approximation of the property, still not the property itself."
echo "      'Outside it' != 'unswept' (other arms exist); $PRED_OUT is the size of the"
echo "      UNCLASSIFIED set, never a defect count."

# ⛔ PRINTED ON EVERY RUN, beside ARM-DOMAIN and quotable exactly like the deriver's `SCOPE:`
# line. A verdict without its domain is the ADR 0079 failure; a domain statement that lives
# only in an ADR is one nobody re-reads at gate time.
echo
echo "--- domain statement: what this arm does NOT cover (§7.17c) ---"
domain_statement | sed 's/^/    /'

# Any CASES token that matched NOTHING is itself an unproven case — name it, and say what
# the catalog knows about it. This is the `member_can_for` incident verbatim: a token that
# names a REAL prosecdef boolean gate which the name regex does not admit.
# ⚠ -F -x = EXACT string equality, deliberately identical to `want()`'s `[ "$k" = "$1" ]`.
# A regex match here would disagree with the selector on metacharacters and could call a
# token "matched" that `want` never selects — a hole of exactly the kind being closed.
UNMATCHED=""
if [ -n "$CASES" ]; then
  for tok in $CASES; do
    if cut -f3 "$WORK/worklist_pred.tsv" | grep -qxF "$tok" \
    || cut -f2 "$WORK/worklist_pol.tsv"  | grep -qxF "$tok"; then continue; fi
    UNMATCHED="$UNMATCHED $tok"
  done
fi
if [ -n "$UNMATCHED" ]; then
  echo
  echo "*** REQUESTED CASES THAT MATCHED NO GATE IN EITHER ARM:"
  for tok in $UNMATCHED; do
    safe=$(printf '%s' "$tok" | tr -cd 'A-Za-z0-9_')
    diag=$(psql_c -c "select coalesce(string_agg(distinct
              n.nspname||'.'||p.proname||' -> '||t.typname||
              case when p.prosecdef then ' [SECURITY DEFINER]' else ' [INVOKER]' end, '; '),
            '(no function of this name in app/public)')
       from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
       join pg_type t on t.oid=p.prorettype
      where n.nspname in ('app','public','authz') and p.proname = '$safe';" | head -1)
    echo "      $tok: $diag"
  done
  echo "    A gate named here was NOT swept. If the catalog line above says"
  echo "    'bool [SECURITY DEFINER]', it is the FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME"
  echo "    class: shaped exactly like a predicate, excluded purely by NAME. Record it in"
  echo "    authz-unswept-backlog.txt — do NOT hand-write a COVERED row anywhere."
  echo "    ⇒ This run can no longer end CLEAN: whatever it measures, part of what was"
  echo "      ASKED FOR was not measured. Final result will be UNPROVEN (3) or DIRTY (1)."
fi

# Nothing selected at all -> stop HERE, before the baseline. Nothing is neutralized, the
# suite is not run, and the findings file is not rewritten.
if [ "$SEL_TOTAL" -eq 0 ]; then
  echo
  echo "=== RESULT: UNPROVEN — NOTHING WAS MEASURED. This is NOT a pass. ==="
  echo "    Selected cases: 0 (predicate=$PRED_SEL, policy=$POL_SEL)${CASES:+ from CASES=\"$CASES\"}."
  echo "    A sweep of zero gates cannot distinguish 'no blind door' from 'no door looked at',"
  echo "    so this run deliberately does NOT print a BLIND/ERROR count."
  echo "    Nothing was neutralized; the baseline suite was NOT run; the COMMITTED baseline"
  echo "    $FINDINGS_COMMITTED is UNTOUCHED."
  echo "    Fix the SELECTION (or widen/annotate the arm's domain) and re-run."
  exit 3
fi
# Some tokens unmatched but others selected: sweep what IS selectable (throwing away real
# measurement helps nobody) and carry the incompleteness to the final verdict.
echo

echo "--- preflight: capturing GREEN baseline (§7.3 assert the state) ---"
BASE_OUT=$(run_suite)
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A dirty"
  echo "    baseline invalidates every case below (a COVERED can't be told from a pre-existing"
  echo "    red). Fix the tree to green before auditing. Aborting."; exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"
# ⛔ SELF-PROOF ONLY (refused above unless SELFPROOF=1, and it forces SUBSET_RUN=1). The TRUE
# captured shape is printed FIRST, above, and the forgery is announced — a forced baseline that
# did not say so is a run whose every verdict is a claim about a shape that never existed.
if [ -n "${BASE_SHAPE_OVERRIDE:-}" ]; then
  echo "    ⛔ BASE_SHAPE_OVERRIDE set — baseline shape FORCED to '$BASE_SHAPE_OVERRIDE'."
  echo "       SELF-PROOF ONLY. The true captured shape is the line above."
  BASE_FILES=$(echo "$BASE_SHAPE_OVERRIDE" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  BASE_TESTS=$(echo "$BASE_SHAPE_OVERRIDE" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
fi
echo

# ─────────────────────────────────────────────────────────────────────────────────────
# THE PERIODIC RESET (ADR 0191 D8) — the mechanism that BOUNDS tail drift instead of
# detecting it. Ported from `c2-command-door-neutralizer.sh`'s `periodic_reset`; the step
# ORDER is its, and each step is a thing this arm refuses to assume after a reset.
# ─────────────────────────────────────────────────────────────────────────────────────
periodic_reset () {   # $1 = why (printed)
  local why="$1" pd now_pred now_pol
  # 1. ⛔ INTERLOCK FIRST, AHEAD OF THE SUBSET GATE BELOW. A reset with a mutation in flight
  #    destroys the evidence AND its restore in one command — the composition the sentinel
  #    exists to prevent. It stays first so the subset gate cannot DISPLACE it: reaching here
  #    with an armed sentinel is a broken invariant whatever kind of run this is, and it must
  #    stop LOUDLY rather than be skipped quietly along with the reset.
  if [ -s "$SENTINEL" ]; then
    echo "*** refusing to reset with a mutation in flight: $SENTINEL" >&2
    echo "    RECOVER=1 bash $0 first, then VERIFY it in the catalog." >&2
    exit 2
  fi
  # 2. THE GATE. Announced either way — a reset that did NOT happen is a fact about the run's
  #    preconditions, exactly like the domain. Checked here too so a direct call cannot bypass it.
  if ! resets_enabled; then
    if [ "$RESET_EVERY" = "0" ]; then
      echo "    (RESET_EVERY=0 — NOT resetting: $why)"
    else
      echo "    (SUBSET run, RESET_EVERY not set explicitly — NOT resetting: $why)"
    fi
    return 0
  fi
  echo "--- PERIODIC RESET ($why) ---"
  # 3. ⛔ `cd "$ROOT"` IS LOAD-BEARING: `supabase db reset` applies the migrations of the
  #    DIRECTORY YOU STAND IN, and this machine measurably has a second, unrelated stack up
  #    (`escalume`, 2026-09-05). ⛔ `</dev/null` because BOTH call sites are inside a
  #    `while read` loop whose stdin is the worklist file.
  if ! ( cd "$ROOT" && supabase db reset --local ) >/dev/null 2>&1 </dev/null; then
    echo "*** db reset FAILED — aborting rather than measuring on an unknown DB." >&2
    exit 2
  fi
  RESETS=$((RESETS+1))
  # 4. §7.16 again — a reset is a new tree and its cleanliness is NOT assumed.
  pd=$(degenerate_gates)
  if [ -n "$pd" ]; then
    echo "*** ABORT: a gate is DEGENERATE after a mid-sweep reset:" >&2
    echo "$pd" | sed 's/^/      /' >&2
    exit 2
  fi
  echo "    post-reset §7.16 preflight: clean — 0 degenerate bodies"
  # 5. re-derive and compare. If the worklist moved, the TREE changed under the run and every
  #    verdict recorded so far is against a DIFFERENT POPULATION. ⛔ To ".reset", never over
  #    the file the sweep loop is reading.
  derive_worklists ".reset"
  now_pred=$(grep -c . "$WORK/worklist_pred.tsv.reset" | tr -d '[:space:]')
  now_pol=$(grep -c . "$WORK/worklist_pol.tsv.reset"  | tr -d '[:space:]')
  # ⛔ COMPARED WITHOUT THE OID COLUMN, deliberately. `supabase db reset --local` drops and
  #    recreates the database, so every pg_proc.oid is REASSIGNED — an OID that moved is not a
  #    population that moved, and comparing it would abort on every reset. The OIDs the sweep
  #    holds are made safe the other way: `sweep_pred_one` re-resolves each one from the
  #    function's IDENTITY at case time (see there).
  if [ "$now_pred" != "$PRED_TOTAL" ] || [ "$now_pol" != "$POL_TOTAL" ] \
     || ! cut -f2- "$WORK/worklist_pred.tsv.reset" | diff -q - <(cut -f2- "$WORK/worklist_pred.tsv") >/dev/null \
     || ! diff -q "$WORK/worklist_pol.tsv.reset" "$WORK/worklist_pol.tsv" >/dev/null; then
    echo "*** ABORT: the derived worklist CHANGED across the reset" >&2
    echo "    (predicate $PRED_TOTAL -> $now_pred, policy $POL_TOTAL -> $now_pol)." >&2
    echo "    The tree moved under this run; every verdict so far is against another" >&2
    echo "    population, so nothing measured here may be merged." >&2
    exit 2
  fi
  # 6. re-capture the baseline — THE WHOLE POINT: later verdicts compare against a FRESH shape,
  #    so the drift any verdict can carry is bounded by RESET_EVERY, not by the run's length.
  BASE_OUT=$(run_suite)
  BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  echo "    post-reset baseline: ${BASE_RES:-<none>} (shape=Files=$BASE_FILES, Tests=$BASE_TESTS)  |  worklist re-derived: predicate=$now_pred policy=$now_pol (unchanged)"
  if [ "$BASE_RES" != "PASS" ]; then
    echo "*** ABORT: the suite is RED after a mid-sweep reset. Every later verdict would be" >&2
    echo "    measured against a broken tree." >&2
    exit 2
  fi
}

# progress.tsv columns: arm  gate  direction  verdict  failing_files
: > "$PROGRESS"

# Regenerate the two deliverables from progress.tsv. Called after EVERY case so a
# mid-run kill still leaves a coherent partial report (brief requirement).
# ⛔ SPLIT IN TWO ON PURPOSE. `emit_body` is the PURE generator — the closed grammar the
# merge helper takes the complement of, and the thing a proof harness can LIFT out of this
# file and run rather than re-typing (the same anti-drift idiom the case deriver uses on
# PRED_DOMAIN). `emit_report` is generation + placement. Do not fold them back together.
emit_body () {
  local total_pol skipped_pol
  total_pol=$(wc -l < "$WORK/worklist_pol.tsv" | tr -d '[:space:]')
  skipped_pol=$(wc -l < "$WORK/skipped_pol_true.tsv" | tr -d '[:space:]')
  {
    echo "# AUTHZ Door-Blindness Audit — Findings"
    echo
    echo "AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14). Generated by"
    echo "\`supabase/tests/mutation/p0-authz-door-audit.sh\`. Method: neutralize each authz"
    echo "gate (open it so it grants/allows regardless), run the FULL pgTAP suite, read"
    echo "\`Result:\`. **COVERED** = suite went \`FAIL\` (a keystone asserts through the gate)."
    echo "**BLIND** = suite stayed \`PASS\` (no keystone exercises it — a work-list item)."
    echo "**ERROR** = run shape != baseline (harness bug: fix the neutralization, not a result)."
    echo "**NOTICED** = run shape != baseline **AND** the suite went \`FAIL\` (§7.15c): a keystone"
    echo "reddened, but a file ABORTED so the denominator moved and the failing assertions cannot"
    echo "be attributed to THIS gate. ⛔ It is coverage EVIDENCE, **NOT A VERDICT** — strictly less"
    echo "than COVERED and never a pass. **DISCLOSED, NON-BLOCKING** (PO ruling 2026-09-07): its own"
    echo "class, quoted in every gate record that cites this sweep, and a run whose only impurity is"
    echo "NOTICED exits **0 with the disclosure printed**. ⛔ BLIND still blocks the phase; ERROR is"
    echo "still not a pass. The remedy is capture-then-assert, work-listed under"
    echo "\`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE\`."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Policies swept: $total_pol (real qual). Policies skipped (qual=true, vacuous): $skipped_pol."
    echo
    echo "**Domain of this run** (§7.17 — a verdict is meaningless without the domain beside it):"
    echo "\`ARM-DOMAIN predicate=$PRED_SEL/$PRED_TOTAL policy=$POL_SEL/$POL_TOTAL\`."
    if [ "$PRED_SEL" -eq 0 ]; then echo "⚠ **PREDICATE ARM: EMPTY DOMAIN — measured nothing.** It did not hold; it did not run."; fi
    if [ "$POL_SEL"  -eq 0 ]; then echo "⚠ **POLICY ARM: EMPTY DOMAIN — measured nothing.** It did not hold; it did not run."; fi
    echo
    echo "⛔ The predicate arm's domain APPROXIMATES the property \"is an authorization predicate\""
    echo "(§7.17a: authz-shaped **name** OR identity-touching **body** OR \`authz\` **schema** membership, minus 2 side-effecting"
    echo "writers held out by name) — it does not decide it. **$PRED_OUT** \`prosecdef\` **boolean**"
    echo "function(s) are outside it (listed at the end). \"Outside this arm\" is NOT \"unswept\" —"
    echo "other arms exist — and $PRED_OUT is the size of the UNCLASSIFIED set, never a defect count."
    echo
    echo "⛔ **The policy arm opens the \`using\` half ONLY** (since 2026-09-05,"
    echo "\`FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS\`). On a \`FOR ALL\` policy a COVERED"
    echo "verdict here is therefore a claim about the **READ** half and nothing else; the"
    echo "\`with check\` half is \`p0-authz-writepath-audit.sh\`'s. ⚠ Rows carried over from before that"
    echo "date may have been earned by a WRITE keystone — the direction column still reads"
    echo "\`open->true\` for both eras (deferred deliberately: re-keying it would carry every ALL row)."
    echo
    domain_statement
    if [ -n "$CASES" ]; then echo; echo "> ⚠ PARTIAL RUN — CASES=\"$CASES\" (subset, not the full sweep)."; fi
    if [ -n "$UNMATCHED" ]; then
      echo
      echo "> ⛔ **UNPROVEN.** These were REQUESTED and matched no gate in either arm, so they"
      echo "> were never swept: \`${UNMATCHED# }\`. No verdict below applies to them."
    fi
    echo
    echo "## BLIND — the work-list (no keystone exercises these)"
    echo
    echo "| gate / policy | arm | direction | verdict | note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## COVERED (asserted-through) + NOTICED (suite reddened, shape moved) + ERROR (harness bug)"
    echo
    echo "| gate / policy | arm | direction | verdict | failing files / note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4!="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## Skipped SELECT/ALL policies (qual = true — intentionally public catalogs)"
    echo
    if [ -s "$WORK/skipped_pol_true.tsv" ]; then
      while IFS= read -r ln; do echo "- \`$ln\`"; done < "$WORK/skipped_pol_true.tsv"
    else echo "_(none)_"; fi
    echo
    echo "## OUTSIDE the predicate arm's domain — \`prosecdef\` booleans excluded by NAME, not property"
    echo
    echo "No verdict is claimed for these here. Some ARE authorization gates; others are"
    echo "feature-flag readers, \`validate_*\` shape-checkers, or side-effecting writers that must"
    echo "not be neutralized to \`select true\`. Classification lives in \`authz-unswept-backlog.txt\`."
    echo
    if [ -s "$WORK/outofdomain_pred_bool.tsv" ]; then
      while IFS= read -r ln; do echo "- \`$ln\`"; done < "$WORK/outofdomain_pred_bool.tsv"
    else echo "_(none — the name filter and the property now coincide)_"; fi
  }
}

emit_report () {
  emit_body > "$GENERATED"
  if [ "$SUBSET_RUN" = "1" ]; then
    # $FINDINGS is already scratch (ADR 0153). Nothing to merge, and merging the committed
    # baseline into a SUBSET report would put verdicts the subset did not measure beside
    # the ones it did.
    cp "$GENERATED" "$FINDINGS"
  elif bash "$MERGE_LIB" "$BASELINE_SNAPSHOT" "$GENERATED" "$FINDINGS"; then
    MERGE_FAILED=0
  else
    # ⛔ The merge REFUSED to write, so the baseline on disk is whatever it was. That is the
    # safe outcome and it must not be silent, and it must not stop the sweep: the verdicts
    # this run has already earned live in $GENERATED and in $PROGRESS.
    MERGE_FAILED=1
    echo "⛔⛔ MERGE ABORTED — $FINDINGS was NOT written. Generated report: $GENERATED" >&2
    echo "    Re-merge by hand from $BASELINE_SNAPSHOT; do NOT copy the generated file over" >&2
    echo "    the baseline. The sweep continues; the report on disk is STALE from here on." >&2
  fi

  # machine-readable BLIND list
  { echo -e "arm\tgate\tdirection\tfailing_or_note";
    awk -F'\t' '$4=="BLIND"{printf "%s\t%s\t%s\t%s\n",$1,$2,$3,$5}' "$PROGRESS"; } > "$BLINDS_TSV"
}

record () {  # arm gate direction verdict failing
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  emit_report
}

# The note column, by verdict — ONE definition so the two arms cannot drift (the §7.17a
# lesson, one layer out). ⚠ Never emit a raw `|` here: it is column 5 of a markdown table
# and the merge splits on UNESCAPED separators.
verdict_note () {
  case "$VERDICT" in
    ERROR)   printf 'run-shape!=baseline (Files=%s Tests=%s)' "$RUNFILES" "$RUNTESTS" ;;
    NOTICED) printf 'suite FAIL but run-shape!=baseline (Files=%s Tests=%s); aborting file(s): %s; reddened: %s' \
                    "$RUNFILES" "$RUNTESTS" "${SHAPEFILES:-<none parsed>}" "${FAILING:-<none parsed>}" ;;
    *)       printf '%s' "$FAILING" ;;
  esac
}

# Neutralizer template — LITERAL (quoted heredoc, no shell expansion) so the E-string
# regex survives byte-for-byte (an unquoted heredoc mangles the backslashes). Per case we
# sed __OID__ (digits) and __NEWBODY__ (a fixed safe string) into it. Regex is identical
# to the validated dry-run: E'\nAS (\\$[^$]*\\$)' captures the outer dollar tag.
cat > "$WORK/_neut_template.sql" <<'TMPL'
do $p0$
declare d text; tag text; hdr text;
begin
  d := pg_get_functiondef(__OID__);
  tag := (regexp_match(d, E'\nAS (\\$[^$]*\\$)'))[1];
  if tag is null then raise exception 'P0-HARNESS: no dollar-body tag for oid __OID__'; end if;
  hdr := split_part(d, tag, 1);
  execute hdr || tag || E'\n' || $p0body$__NEWBODY__$p0body$ || E'\n' || tag;
end $p0$;
TMPL

# ─────────────────────────────────────────────────────────────────────────────────────
# PREDICATE ARM
# ─────────────────────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ ONE CASE'S WORK IS A FUNCTION, NOT INLINE CODE (ADR 0191 D8) — the retry net must run a
# case TWICE without a second COPY of the case body. It reports through SW_VERDICT / SW_NOTE /
# SW_DRIFT (a verdict is DATA here) and the CALLER records, so a retried case is recorded ONCE.
# ─────────────────────────────────────────────────────────────────────────────────────
SW_VERDICT=""; SW_NOTE=""; SW_DRIFT=0
sweep_pred_one () {   # $1 label  $2 direction  $3 lang   (⛔ the OID is resolved HERE, not passed)
  local label="$1" direction="$2" lang="$3"
  local local_nb s orig mout out now oid
  SW_VERDICT=""; SW_NOTE=""; SW_DRIFT=0

  # ⛔ THE OID IS RE-RESOLVED FROM THE FUNCTION'S IDENTITY, EVERY CASE (ADR 0191 D8).
  # The worklist's OID column is captured ONCE, before the first case — and `supabase db
  # reset --local` drops and recreates the database, REASSIGNING every pg_proc.oid. With a
  # periodic reset in the loop, a captured OID is a stale pointer that may now name a
  # DIFFERENT function, and the mutation would land on it silently. Identity survives the
  # reset; the OID does not. ⚠ `$$…$$` (escaped so the SHELL does not read `$$` as its PID)
  # so no label needs quoting. A case whose identity resolves to nothing scores ERROR — it
  # never guesses and never mutates.
  oid=$(psql_c -c "select p.oid from pg_proc p
                     join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
                          = \$\$$label\$\$" | head -1)
  if [ -z "$oid" ]; then
    SW_VERDICT="ERROR"
    SW_NOTE="gate ABSENT from the catalog at case time — its identity resolves to no pg_proc row; nothing was mutated"
    return 0
  fi

  # newbody by direction + language (type-preserving)
  local_nb=""
  case "$direction" in
    positive)    [ "$lang" = "sql" ] && local_nb='select true'  || local_nb='begin return true; end' ;;
    deny)        [ "$lang" = "sql" ] && local_nb='select false' || local_nb='begin return false; end' ;;
    assert_noop) local_nb='begin return; end' ;;   # void plpgsql raise-guard -> no-op
    *)           SW_VERDICT="SKIP"; SW_NOTE="unknown direction $direction"; return 0 ;;
  esac

  s=$(slug "$label")
  orig="$WORK/orig_pred_$s.sql"
  # capture ORIGINAL def (exact bytes) for restore + restore-verification
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"
  # arm the trap BEFORE we open the gate, with the probe that will VERIFY its restore
  arm_inflight "$orig" "select md5(pg_get_functiondef($oid))"

  # neutralize via an anonymous DO block (no persistent catalog residue; see header note)
  sed -e "s/__OID__/$oid/g" -e "s|__NEWBODY__|$local_nb|g" "$WORK/_neut_template.sql" > "$WORK/_mut.sql"
  mout=$(psql_f "$WORK/_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
    SW_VERDICT="ERROR"
    SW_NOTE="neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    # attempt restore anyway
    restore_inflight || { echo "*** the restore of $label REFUSED — stopping (§7.5)."; exit 2; }
    return 0
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pred_$s.log"
  classify "$out"

  # RESTORE (exact original bytes) + VERIFY (§7.5 contamination guard)
  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $label did NOT round-trip. Every later case is"
    echo "    suspect. Aborting the sweep (§7.5)."; exit 2
  fi
  disarm_inflight   # the round-trip above verified it — only now drop the sentinel

  SW_VERDICT="$VERDICT"
  SW_NOTE="$(verdict_note)"
  # ⛔ The retry net reads the CLASSIFIER's own predicate, never the note text (ADR 0191 D8).
  SW_DRIFT="$SHAPE_MOVED"
  return 0
}

# ⛔ ONE counter across BOTH arms. The policy arm is the SECOND 226 cases of a 353-case run and
# is exactly where the 2026-09-06 drift landed; a per-arm counter would leave that tail
# unprotected for the length of the predicate arm.
DONE=0
# The scheduled reset + the retry net, shared by both arms so the two cannot drift apart.
maybe_periodic_reset () {   # called BEFORE a case's work, so its baseline is at most N cases old
  if [ "$RESET_EVERY" != "0" ] && [ "$DONE" -gt 1 ] && [ $(( (DONE - 1) % RESET_EVERY )) -eq 0 ]; then
    periodic_reset "scheduled — $((DONE - 1)) case(s) swept since the last baseline"
  fi
}
drift_not_retried_note () {   # the SAME predicate the gate and the banner read
  if [ "$RESET_EVERY" = "0" ]; then
    echo " (drift-shaped; NOT retried — RESET_EVERY=0, resets are DISABLED everywhere)"
  else
    echo " (drift-shaped; NOT retried — a SUBSET run resets only when RESET_EVERY is set explicitly)"
  fi
}

echo "=== PREDICATE ARM (domain: $PRED_SEL selected of $PRED_TOTAL) ==="
[ "$PRED_SEL" -eq 0 ] && echo "  ⚠ EMPTY DOMAIN — this arm measures NOTHING on this run."
while IFS=$'\t' read -r oid label proname direction lang; do
  [ -z "$oid" ] && continue
  want "$proname" || continue
  DONE=$((DONE+1))
  maybe_periodic_reset

  sweep_pred_one "$label" "$direction" "$lang"
  if [ "$SW_VERDICT" = "SKIP" ]; then echo "  SKIP $label ($SW_NOTE)"; continue; fi

  # THE RETRY NET. A GENUINE NOTICED reproduces after a fresh reset; DRIFT does not. Run 1
  # lost 79 verdicts to exactly this and the ones re-measured came back COVERED.
  if [ "$SW_DRIFT" = "1" ]; then
    if ! resets_enabled; then
      # ⛔ NOT retried, and the ROW says so. The retry's whole mechanism IS the reset; where
      #    this run may not reset, retrying would re-measure the same drift and then suffix
      #    "(retried after reset)" — a note asserting a reset that did not happen. A row is
      #    read without its banner, so the disclosure belongs on the row.
      SW_NOTE="$SW_NOTE$(drift_not_retried_note)"
    else
      echo "    drift suspected — resetting and retrying $label ONCE"
      periodic_reset "retry — $label recorded a drift-shaped $SW_VERDICT"
      sweep_pred_one "$label" "$direction" "$lang"
      SW_NOTE="$SW_NOTE (retried after reset)"
    fi
  fi
  record "predicate" "$label" "$direction" "$SW_VERDICT" "$SW_NOTE"
  printf '  %-8s %s\n' "$SW_VERDICT" "$label"
done < "$WORK/worklist_pred.tsv"

# ─────────────────────────────────────────────────────────────────────────────────────
# POLICY ARM
# ─────────────────────────────────────────────────────────────────────────────────────
echo
echo "=== POLICY ARM — READ HALF ONLY: opens \`using (true)\`, never \`with check\` (domain: $POL_SEL selected of $POL_TOTAL) ==="
[ "$POL_SEL" -eq 0 ] && echo "  ⚠ EMPTY DOMAIN — this arm measures NOTHING on this run."
# ⚠ Collected, not assumed: an ALL policy with a NULL `polwithcheck` re-uses `qual` as its
# check, so `using (true)` opens the WRITE half too and the read/write split is VACUOUS for
# it. Zero such policies today; if one ever appears it is DISCLOSED at the end, never silent.
ALL_NULL_WC=""
# ⛔ The policy arm's case body is a FUNCTION for the same reason the predicate arm's is: the
# retry net runs it twice and the CALLER records. ⚠ No OID re-resolution is owed here — a
# policy is keyed by table + name, and both survive a `supabase db reset --local`.
sweep_pol_one () {   # $1 tbl  $2 polname  $3 cmd  $4 has_wc
  local tbl="$1" polname="$2" cmd="$3" has_wc="$4"
  local s qfile wfile restore mout out nowq
  SW_VERDICT=""; SW_NOTE=""; SW_DRIFT=0

  s=$(slug "${tbl}_${polname}")
  qfile="$WORK/orig_pol_$s.qual"; wfile="$WORK/orig_pol_$s.wc"
  restore="$WORK/restore_pol_$s.sql"
  psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass" > "$qfile"
  : > "$wfile"
  [ "$has_wc" = "t" ] && psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass" > "$wfile"

  # Build the RESTORE up front + arm the EXIT trap BEFORE opening the policy.
  {
    printf 'alter policy "%s" on public."%s" using (%s)' "$polname" "$tbl" "$(cat "$qfile")"
    if [ "$has_wc" = "t" ]; then printf ' with check (%s)' "$(cat "$wfile")"; fi
    printf ';\n'
  } > "$restore"
  arm_inflight "$restore" "select md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass"

  # ─────────────────────────────────────────────────────────────────────────────────
  # OPEN the policy: `using (true)` — THE READ HALF ONLY.
  #
  # ⛔ IT USED TO OPEN `with check (true)` TOO, and that made every `FOR ALL` verdict
  # MIRROR-AMBIGUOUS (FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS). This arm
  # bounds itself `polcmd in ('r','*')` and calls itself the READ arm; opening both halves
  # meant a COVERED on an ALL policy could be earned entirely by a WRITE keystone — the
  # exact defect the write-path sibling fixed for itself on 2026-09-05 by opening its
  # `with check` half alone (`p0-authz-writepath-audit.sh:80`, `:720-721`, `:1155-1156`).
  # The two arms were mirror images of one bug and only one of them had been corrected.
  #
  # ⚠ MEASURED PRECONDITION, not assumed: all 62 `FOR ALL` policies in domain carry a
  # NON-NULL `polwithcheck`. That matters, because Postgres falls back to `qual` for the
  # check when `polwithcheck IS NULL` — on such a policy `using (true)` alone WOULD open
  # the write half too and this fix would be vacuous for it. Re-derived every run below.
  #
  # The capture/restore/probe above are UNCHANGED and still cover BOTH halves: the restore
  # must return the policy exactly as it was, whichever half the mutation touched.
  # ⛔ The direction column stays `open->true` (see emit_body): re-keying it to
  # `open using->true` would change columns 1-4 of all 62 ALL rows, and the merge splices
  # only when columns 1-4 are identical — so every one of them would land in CARRIED as
  # pure formatting noise. The half is stated in PROSE instead (PO ruling Q5, 2026-09-05).
  # ─────────────────────────────────────────────────────────────────────────────────
  # ⚠ The disclosure list is appended by the CALLER, once per case — appending it here would
  # double the entry on a retried case. Zero such policies exist today, and "dormant" is how
  # a bug ships.
  { echo "alter policy \"$polname\" on public.\"$tbl\" using (true);" ; } > "$WORK/_mut.sql"
  mout=$(psql_f "$WORK/_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    SW_VERDICT="ERROR"
    SW_NOTE="open failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    restore_inflight || { echo "*** the restore of $tbl.$polname REFUSED — stopping (§7.5)."; exit 2; }
    return 0
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pol_$s.log"
  classify "$out"

  # RESTORE exact original qual [+ with check] + VERIFY
  psql_f "$restore" >/dev/null 2>&1
  nowq=$(psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass")
  if [ "$nowq" != "$(cat "$qfile")" ]; then
    echo "*** CONTAMINATION: restore of policy $tbl.$polname did NOT round-trip. Aborting (§7.5)."; exit 2
  fi
  disarm_inflight   # the round-trip above verified it — only now drop the sentinel

  SW_VERDICT="$VERDICT"
  SW_NOTE="$(verdict_note)"
  SW_DRIFT="$SHAPE_MOVED"
  return 0
}

while IFS=$'\t' read -r tbl polname cmd has_wc; do
  [ -z "$tbl" ] && continue
  want "$polname" || continue
  DONE=$((DONE+1))
  maybe_periodic_reset
  if [ "$cmd" = "ALL" ] && [ "$has_wc" != "t" ]; then
    ALL_NULL_WC="$ALL_NULL_WC $tbl.$polname"
  fi

  sweep_pol_one "$tbl" "$polname" "$cmd" "$has_wc"

  if [ "$SW_DRIFT" = "1" ]; then
    if ! resets_enabled; then
      SW_NOTE="$SW_NOTE$(drift_not_retried_note)"
    else
      echo "    drift suspected — resetting and retrying $tbl.$polname ONCE"
      periodic_reset "retry — $tbl.$polname recorded a drift-shaped $SW_VERDICT"
      sweep_pol_one "$tbl" "$polname" "$cmd" "$has_wc"
      SW_NOTE="$SW_NOTE (retried after reset)"
    fi
  fi
  record "policy" "$tbl.$polname ($cmd)" "open->true" "$SW_VERDICT" "$SW_NOTE"
  printf '  %-8s %s\n' "$SW_VERDICT" "$tbl.$polname"
done < "$WORK/worklist_pol.tsv"

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
noticed_ct=$(awk -F'\t' '$4=="NOTICED"' "$PROGRESS" | wc -l | tr -d '[:space:]')
swept_ct=$(grep -c . "$PROGRESS" | tr -d '[:space:]')
# ⛔ COVERED is the RESIDUAL, so a new verdict that is not subtracted here would silently
# INFLATE it — a fourth outcome collapsing into COVERED by arithmetic instead of by logic.
cov_ct=$((swept_ct - blind_ct - err_ct - noticed_ct))

# §7.17: the count line is USELESS without the domain beside it — "BLIND: 0" over an
# empty domain and "BLIND: 0" over 101 gates were the same string. Print the domain
# FIRST, per arm, so a §6 gate record can name WHICH ARM HAD A DOMAIN instead of
# claiming "the ARMs HOLD".
echo "ARM-DOMAIN predicate=$PRED_SEL/$PRED_TOTAL policy=$POL_SEL/$POL_TOTAL out-of-domain-bool=$PRED_OUT"
[ "$PRED_SEL" -eq 0 ] && echo "    ⚠ PREDICATE ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ "$POL_SEL"  -eq 0 ] && echo "    ⚠ POLICY ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ -n "$UNMATCHED" ] && echo "    ⚠ REQUESTED BUT NEVER SWEPT (matched no gate):$UNMATCHED"
echo "    POLICY ARM HALF: \`using\` ONLY — a COVERED on a FOR ALL policy is a READ-half claim."
if [ -n "$ALL_NULL_WC" ]; then
  echo "    ⛔ VACUOUS READ/WRITE SPLIT for these FOR ALL policies (polwithcheck IS NULL, so"
  echo "       Postgres re-uses qual as the check and \`using (true)\` opened the write half too):"
  echo "      $ALL_NULL_WC"
fi
echo "SWEPT: $swept_ct gate(s)   COVERED: $cov_ct   BLIND: $blind_ct   NOTICED: $noticed_ct   ERROR(harness): $err_ct"
# ⛔ A PRECONDITION OF EVERY VERDICT ABOVE, ON THE SAME BLOCK AS THE COUNTS (ADR 0191 D8) — so a
# reader cannot take the tally without taking the conditions it was measured under. `resets=0` on
# a 353-case run is the exact state that made 79 of run 1's verdicts void.
if [ "$RESET_EVERY" = "0" ]; then
  RESETNOTE="(RESET_EVERY=0 — resets DISABLED everywhere)"
elif [ "$SUBSET_RUN" = "1" ] && [ "$RESET_EVERY_EXPLICIT" != "1" ]; then
  RESETNOTE="(RESET_EVERY=$RESET_EVERY — SUPPRESSED: the DEFAULT never fires on a SUBSET run; set RESET_EVERY explicitly to enable)"
elif [ "$SUBSET_RUN" = "1" ]; then
  RESETNOTE="(RESET_EVERY=$RESET_EVERY — set EXPLICITLY, so this SUBSET run resets)"
else
  RESETNOTE="(RESET_EVERY=$RESET_EVERY)"
fi
echo "    preconditions: baseline GREEN at the LAST capture (shape=Files=$BASE_FILES, Tests=$BASE_TESTS) · resets=$RESETS $RESETNOTE"

emit_result "$swept_ct" "$blind_ct" "$noticed_ct" "$err_ct"
exit $?
