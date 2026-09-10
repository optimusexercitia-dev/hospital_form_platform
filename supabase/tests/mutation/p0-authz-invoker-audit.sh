#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-INVOKER-WRAPPER; ADR 0078 §7.14 / ADR 0079). THE FOURTH SWEEP.
#
# THE BLIND SPOT THIS CLOSES. The other three sweeps all begin `and p.prosecdef` —
# verified in the live scripts, not assumed. So the entire `public` INVOKER surface
# (88 `authenticated`-reachable plpgsql functions) has never been swept in any
# direction by any arm. AUDIT-INVOKER-WRAPPER, found in FF-3 (QA M-2), is that hole:
# an INVOKER wrapper whose own hand-written probe is the ONLY gate in front of an
# `app` DEFINER body. The wrapper is `prosecdef = f`, so it is invisible here; the
# helper it calls is `prosecdef = t`, so its gate REPLACES RLS. Neither end is covered.
#
# It is a PATTERN, not an accident: fronting an `app.` DEFINER helper with an INVOKER
# wrapper is the natural shape in this codebase, and a majority of `app` DEFINER
# functions carry EXECUTE to PUBLIC (re-measure, never cite a stale count), so the
# wrapper is the whole boundary each time.
#
# ── WHY THIS SWEEP CANNOT REUSE THE ROW-DOOR REGEX ───────────────────────────────────
# p0-authz-rowdoor-audit.sh opens `if <cond> then` only when the CONDITION names an
# identity primitive (`app.is_*`, `auth.uid()`, …) — deliberately, so a feature-flag
# guard is not mistaken for an authz gate. Applied to THIS population that rule is not
# merely incomplete, it is definitionally wrong, and a dry run proved it before a line
# of this sweep was trusted:
#
#     32 of 88 matched it — and `get_response_validation_errors`, the FF-3 exemplar
#     that MOTIVATED this whole item, was not one of them. Its gate is
#         if not exists (select 1 from public.responses r where r.id = p_response_id)
#     which names no identity primitive at all.
#
# That is the entire insight of the class. For an INVOKER function, a bare existence
# probe against an RLS-protected table IS the authorization decision — "the row does
# not exist" and "the row is not visible to YOU" are the same condition, because RLS
# is what answers it. So the identity reference is the RLS on the probed table, not a
# token in the source. Had this sweep inherited the row-door regex it would have filed
# its own motivating example UNSUPPORTED and reported a clean run.
#
# ── THE THREE OPENABLE GUARD CLASSES ─────────────────────────────────────────────────
# Every regex below is COMPUTED IN-DATABASE from the live catalog, never hand-listed:
# an enumeration whose boundary is a hand-maintained list is wrong the day a migration
# lands.
#
#   G1  RLS EXISTENCE PROBE  — `if [not] exists (… <t> …) then` where <t> is a relation
#       with `relrowsecurity = true`. Rewritten to `if false then`. The table
#       alternation is built from `pg_class.relrowsecurity`, so a table that gains or
#       loses RLS moves in or out of the class automatically. A probe against a
#       non-RLS table (a vocabulary/catalog lookup) is a DOMAIN check, not an authz
#       one, and is deliberately left closed.
#
#   G2  IDENTITY ASSERT STATEMENT — `perform app.assert_X(…)` -> `perform 1`, where X
#       is one of the `app.assert_*` functions whose OWN body touches identity
#       (`is_`/`can_`/`has_`/`member_can`/`memberships`/`auth.uid`). Computed, so the
#       ~13 identity asserts are separated from the ~34 feature-flag/domain asserts by
#       a property rather than by a list. Opening `assert_referrals_enabled` would let
#       a keystone that notices a FLAG guard be recorded as one that notices the AUTHZ
#       gate — a false COVERED, the exact "audit one layer, infer the next" error this
#       programme exists to stop.
#       ⚠ Only the `perform`-statement form. The identity asserts that RETURN a value
#       (`assert_ethics_coordinator` -> uuid, …) are called as assignments and have no
#       safe neutral value, so they do not open here.
#
#       ⚠ G1's KNOWN EDGE, found by hand-checking its own output and stated here because
#       nothing in the harness can see it: `if not exists (… <RLS table> …)` is the authz
#       probe in `get_response_validation_errors` (bare identity: `where r.id = p_param`)
#       but a DOMAIN check in `add_template_phase` (`where id = p_form_id and
#       commission_id = v_commission_id` — is this form part of this template?). Both
#       read an RLS table; only the first is an authorization decision. No textual rule
#       separates them reliably, so a verdict whose ONLY opened class is G1 is marked
#       PROVISIONAL in the note column and must be hand-classified before it is trusted
#       or allowlisted. Silence about this would make BLIND look like a finding when the
#       harness had opened something else entirely.
#
#   G3  IDENTITY-PRIMITIVE CONDITION — the row-door regex, verbatim, including its
#       load-bearing lookaheads. Kept because it is the shape 32 of these functions do
#       use, and its `(?![;]|\ythen\y|\y(?:els)?if\y)` guard against swallowing an
#       OUTER `if` was paid for once already.
#
# A function's guards are ALL opened together; the report records which classes fired
# and how many. A COVERED therefore means "some keystone noticed SOMETHING open", not
# "each guard is individually keystoned" — the same resolution the row-door sweep has.
# BLIND is the finding, and BLIND is exact.
#
# Verdicts, identical in meaning to the other three sweeps:
#   suite FAIL  -> a keystone asserts through the gate            = COVERED (good)
#   suite PASS  -> nobody noticed the wrapper opening             = BLIND   (a finding)
#   shape != baseline -> harness bug, fix the neutralization      = ERROR   (not a result)
#   no guard matched any class                                    = UNSUPPORTED (NOT a
#     verdict; the function is not swept and stays in the census backlog)
#
# Run from repo root:  bash supabase/tests/mutation/p0-authz-invoker-audit.sh
# Subset:              CASES="get_response_validation_errors submit_response" bash …
#   ⛔ CASES HAS THREE STATES, NOT TWO — set-ness, not value (2026-09-08):
#     CASES UNSET          -> FULL run over the whole domain (may merge the committed baseline)
#     CASES set, non-empty -> SUBSET run, scratch report only
#     CASES set, EMPTY     -> SUBSET run selecting NOTHING -> exit 3 UNPROVEN. ⛔ NOT a full run.
#   A full sweep from a parent script is `unset CASES && bash ...`, never `CASES= bash ...`:
#   `VAR= cmd` sets VAR to the EMPTY STRING in the child, which is the third state.
# Self-test:           SELFTEST=1 bash .../p0-authz-invoker-audit.sh   (no DB; rc 0 / 1)
#   ⭐ A subset run writes its report + BLIND tsv to SCRATCH under $WORK and NEVER opens
#   the committed findings md for write (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE) — this
#   is the file `FROMFINDINGS=1 ARM=wrapper` reads back. There is nothing to
#   `git checkout --` afterwards; older instructions describe the pre-2026-08-26 behaviour.
# Dry run (no suite):  DRYRUN=1 bash …   — classifies every function's guards and
#                      exits. Use it to prove the detector still FINDS things after any
#                      edit: a detector that finds nothing must be proven able to find
#                      something, and this one silently found nothing once already.
# ⚠ COST: ~1.5 min of pgTAP per SUPPORTED function — ~100 min for the full 88 (56 of
# which are supported). The LEAD runs the full loop in the background; a subagent's
# process dies at turn-end.
#
# ⛔ NEVER PIPE THIS SCRIPT. `bash p0-authz-invoker-audit.sh | tail -120` reports TAIL's
# exit status, not the sweep's. The first full run aborted with `exit 2` on a
# CONTAMINATION check and was reported as **exit code 0** for exactly this reason — the
# same masking already recorded for `e2e:prod`. Redirect to a file and read it
# (`... > run.log 2>&1`), or check `${PIPESTATUS[0]}`.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-$ROOT/.authz-work}"
PROGRESS="$WORK/progress_invoker.tsv"
RUNLOGS="$WORK/runlogs_invoker"
# ⛔ SET-NESS CAPTURED BEFORE THE DEFAULT DESTROYS IT (2026-09-08). `CASES=""` and an unset
# CASES are the same VALUE and must not be the same STATE: the first is a selection that came
# back EMPTY, the second is "no selection asked for". The caller that produces the first is the
# documented recipe `CASES="$(bash scripts/door-sweep-cases.sh <base>)"`, whose exit-1 FINDING
# prints NO case list — so the substitution yields "" and the exit code that WAS the signal is
# discarded. Ported from p0-authz-door-audit.sh; ⛔ ported, not copied — see set_placement().
CASES_EXPLICIT=0; [ -n "${CASES+x}" ] && CASES_EXPLICIT=1
CASES="${CASES:-}"
# ⭐ NEVER REASSIGNED — the SELFTEST fixture writes $CASES_EXPLICIT, so an arm reading only that
# would pass even with the capture above deleted. Row 0 reads THIS one, which no fixture touches.
CASES_EXPLICIT_AT_STARTUP="$CASES_EXPLICIT"
if [ "$CASES_EXPLICIT" = "1" ] && [ -z "$CASES" ]; then
  SELECTION_SOURCE="CASES set and EMPTY -> selects NOTHING (UNPROVEN, exit 3). ⛔ NOT a full run."
elif [ "$CASES_EXPLICIT" = "1" ]; then
  SELECTION_SOURCE="CASES set to \"$CASES\" -> SUBSET run (scratch report only)."
else
  SELECTION_SOURCE="CASES UNSET -> FULL run over the whole domain."
fi
DRYRUN="${DRYRUN:-0}"
FINDINGS_COMMITTED="$ROOT/docs/reviews/authz-invoker-audit-findings.md"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ A SUBSET RUN MUST NOT WRITE THE COMMITTED BASELINE
#    (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE — fix (a), 2026-08-26; identical in all
#     four p0-authz-*-audit.sh sweeps, which share the defect by construction.)
#
# `emit_report` ends in a TRUNCATING redirect into the file above, which is COMMITTED.
# With `CASES=` set — the diff-scoped run CLAUDE.md §6 step 1 mandates EVERY PHASE — that
# redirect replaced the full audit with the subset (measured on the door sweep 2026-08-25:
# 699 lines -> 90). ⛔ Silent AND self-concealing, and THIS file is the one
# `FROMFINDINGS=1 ARM=wrapper` — a §6 step-1 arm — reads: it compares this committed file
# to an allowlist and RE-MEASURES NOTHING, so against a truncated file it sees fewer
# gates, finds every one allowlisted, and reports HOLDS. The arm gets GREENER as the
# baseline gets EMPTIER.
# ⚠ $BLINDS_TSV moves too: the invariant's non-FROMFINDINGS wrapper arm reads
# `$WORK/blinds_invoker.tsv` as a FULL-sweep result. The property is "never overwrite the
# artefact a later arm reads back as a baseline"; committed vs scratch is not part of it.
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ KEYED ON SET-NESS, and a FUNCTION so SELFTEST can EXERCISE the rule instead of restating
# it. ⛔ PORTED, NOT COPIED: the door's twin carries a SECOND disjunct on BASE_SHAPE_OVERRIDE.
# THIS harness has no such knob (measured: zero occurrences of BASE_SHAPE_OVERRIDE and of
# SELFPROOF in this file), so the door's second disjunct is deliberately NOT carried over —
# importing it would introduce a variable nothing here sets and a branch nothing can reach.
# ⚠ AND `DRYRUN` IS NOT A SUBSET AXIS. This harness has a knob its two siblings do not, and it
# is tempting to fold it in here. It must not be: DRYRUN classifies without mutating and writes
# NOTHING (`record()` skips emit_report when DRYRUN=1), so it narrows no domain and forcing it
# to "subset" would only make a full DRYRUN report a partial one it is not.
set_placement () {   # reads CASES_EXPLICIT -> sets SUBSET_RUN, FINDINGS, BLINDS_TSV
  if [ "$CASES_EXPLICIT" = "1" ]; then
    SUBSET_RUN=1
    FINDINGS="$WORK/authz-invoker-audit-findings.SUBSET.md"
    BLINDS_TSV="$WORK/blinds_invoker.SUBSET.tsv"
  else
    SUBSET_RUN=0
    FINDINGS="$FINDINGS_COMMITTED"
    BLINDS_TSV="$WORK/blinds_invoker.tsv"
  fi
}
set_placement

# ⛔ THREE STATES, NOT TWO. The old body was `[ -z "$CASES" ] && return 0`, which selected
# EVERYTHING for an explicitly-empty CASES — i.e. the recipe above silently ran a FULL sweep
# that merged into the COMMITTED baseline, the very file `FROMFINDINGS=1 ARM=wrapper` reads
# back. An UNSET CASES still selects everything (that IS a full run); a SET-and-EMPTY CASES
# selects NOTHING.
# ⛔ DEFINED HERE, not at its old site ~150 lines below, because the SELFTEST block exits before
# that line and would otherwise die with `want: command not found`. Defining a second copy up
# here would be a hand-written copy of production text: the self-test would measure the copy
# while every sweep used the original.
# ⚠ TWO CONSUMERS IN THIS FILE, not one: the DRY-RUN classifier loop and the sweep loop. Both
# are downstream of the domain gate added below, so neither can run over an empty selection.
want () {  # $1 = match key (proname); rc 0 = selected
  [ "$CASES_EXPLICIT" = "1" ] || return 0      # CASES UNSET -> full run, everything selected
  [ -n "$CASES" ] || return 1                  # CASES SET and EMPTY -> nothing selected
  local k; for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

count_sel () {  # $1 = worklist file, $2 = 1-based field holding the match key
  local n=0 line key
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    key=$(printf '%s' "$line" | cut -f"$2")
    want "$key" && n=$((n+1))
  done < "$1"
  echo "$n"
}

mkdir -p "$WORK" "$RUNLOGS"

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
GENERATED="$WORK/authz-invoker-audit-findings.generated.md"
BASELINE_SNAPSHOT="$WORK/authz-invoker-audit-findings.baseline.md"
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

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@" </dev/null; }
psql_f () {
  local host="$1"
  # ⚠ no MSYS_NO_PATHCONV here: the HOST side of a `docker cp` must keep MSYS path
  # conversion, or the Git-Bash path is passed through literally and Docker resolves it
  # as `C:\c\Users\…`. Only the `docker exec` calls suppress it (for the container-side
  # `//tmp/…`). Same split as the sibling sweeps.
  docker cp "$host" "$DB:/tmp/_p0inv.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_p0inv.sql 2>&1 </dev/null
}
# ⚠ Keyed on the OID, not the label. The first cut slugged the full label — signature
# and all — and `public.update_meeting(9 args)` produced a 250+ char filename that the
# filesystem rejected with "File name too long". That is recorded here because of what it
# then did, not because of the limit itself (see the rollback-point guard below).
# OIDs are stable for the life of one run, which is all a scratch file needs.
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' | cut -c1-60 ; }

# Restore-on-exit. A wrapper is open only for the ~25 s of its suite run, but a kill in
# that window would leave it open for the next owner of the shared local stack.
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight wrapper from $INFLIGHT)"
    psql_f "$INFLIGHT" >/dev/null 2>&1
  fi
}
# ⚠ compound: this REPLACES the baseline-guard trap installed above, so it must carry
# that duty too, or a subset run loses its outcome check from here on.
trap 'restore_inflight; verify_baseline_untouched || exit 2' EXIT

run_suite () { ( cd "$ROOT" && supabase test db ) 2>&1; }

classify () {
  local out="$1" res ft dubious
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  RUNFILES=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  RUNTESTS=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  dubious=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  FAILING=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' \
            | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  if [ -z "$res" ] || [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    VERDICT="ERROR"
  elif [ "$res" = "FAIL" ]; then VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then VERDICT="BLIND"
  else VERDICT="ERROR"; fi
}

# ─────────────────────────────────────────────────────────────────────────────────────
# SELFTEST — the CASES SELECTION and where each state WRITES. No DB, no suite, no catalog.
#
# ⛔ THIS HARNESS HAD NO SELF-TEST AT ALL before 2026-09-08, which is why the port of the
# three-state CASES fix could not be "inherited" from the door arm and had to be proven HERE,
# by selection: revert this file's set_placement() or want() and rows C / E3 below red while
# every other harness stays green. Asserting that a pattern was inherited is not a measurement.
# ⛔ THE CONTROL IS TRIAL A vs TRIAL C: the SAME VALUE (the empty string is what $CASES holds in
# both) reached two ways — UNSET, and SET-AND-EMPTY — with OPPOSITE selection and OPPOSITE
# placement. Row A carries two POSITIVE expectations because both tempting over-fixes are
# "disable it": a want() that denies everything, and a set_placement() that always says subset.
# ⚠ The stakes are highest here of the four sweeps: $FINDINGS_COMMITTED is the file
#   `FROMFINDINGS=1 ARM=wrapper` — a Phase Gate arm — reads back while re-measuring nothing.
# ⚠ Placement is exercised THROUGH set_placement(), selection THROUGH want()/count_sel().
# Bare exit code: 0 = every row ok, 1 = any row failed. ⛔ Read it directly; never through a pipe
#   (this file's own header records a full run reported as exit 0 because of one).
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "${SELFTEST:-0}" = "1" ]; then
  echo "=== SELFTEST: CASES set-ness — selection, placement and the SELECTED COUNT (no DB) ==="
  sel_fail=0; sel_n=0
  # ⛔ SYNTHETIC PROBE. want() is pure string matching against $CASES and consults no catalog,
  # so naming a real wrapper here would only add a name-keyed verdict that rots on a rename.
  SEL_PROBE="probe_invoker_alpha"
  sel_eq () {  # $1 label  $2 expected  $3 actual
    sel_n=$((sel_n+1))
    if [ "$2" = "$3" ]; then printf '  ok    %-52s -> %s\n' "$1" "$3"
    else printf '  NOT OK %-51s -> %s (expected %s)\n' "$1" "$3" "$2"; sel_fail=$((sel_fail+1)); fi
  }
  # ⛔ ROW 0 — the startup capture, the one thing every fixture below could fake. sel_case
  # assigns CASES_EXPLICIT itself, so this arm would pass in full even if the capture at the top
  # of the file had never been written. CASES_EXPLICIT_AT_STARTUP is written once and by nothing
  # else; deleting that line makes this row an unbound variable under `set -u`.
  # ⛔ ONE PROCESS SEES ONE POLARITY. The line below is the handle scripts/door-sweep-selftest.sh
  # asserts in BOTH, by launching this file twice (CASES unset -> 0, CASES="" -> 1).
  echo "SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=$CASES_EXPLICIT_AT_STARTUP"
  # ⛔ A plain `case` STATEMENT — never a `case` wrapped in a command substitution. bash 3.2,
  # the macOS default and the shell this file runs under, closes the substitution at the `)` of
  # a case PATTERN, making the wrapped form a SYNTAX ERROR. The POSIX leading-paren pattern
  # `in (0|1)` does NOT fix it. Ported, not copied, from p0-authz-writepath-audit.sh.
  case "$CASES_EXPLICIT_AT_STARTUP" in 0|1) sel_bit=1 ;; *) sel_bit=0 ;; esac
  sel_eq "0  startup capture is a set-ness bit (0|1)" 1 "$sel_bit"
  sel_eq "0' startup capture equals the live flag" "$CASES_EXPLICIT_AT_STARTUP" "$CASES_EXPLICIT"

  sel_case () {  # $1 label $2 CASES_EXPLICIT $3 CASES $4 expect want yes|no $5 expect subset|committed
    local gotw gotp; sel_n=$((sel_n+1))
    CASES_EXPLICIT="$2"; CASES="$3"; set_placement
    if want "$SEL_PROBE"; then gotw=yes; else gotw=no; fi
    if [ "$FINDINGS" = "$FINDINGS_COMMITTED" ]; then gotp=committed; else gotp=subset; fi
    if [ "$gotw" = "$4" ] && [ "$gotp" = "$5" ]; then
      printf '  ok    %-52s -> selects=%-3s writes=%s\n' "$1" "$gotw" "$gotp"
    else
      printf '  NOT OK %-51s -> selects=%-3s writes=%s (expected %s / %s)\n' \
        "$1" "$gotw" "$gotp" "$4" "$5"; sel_fail=$((sel_fail+1))
    fi
  }
  sel_case "A  CASES UNSET (full run)  ⭐ NEGATIVE CONTROL" 0 ""           yes committed
  sel_case "B  CASES=\"<probe>\" (ordinary subset)"          1 "$SEL_PROBE" yes subset
  sel_case "B2 CASES=\"other_wrapper\" (subset, not this key)" 1 "other_wrapper" no subset
  sel_case "C  CASES=\"\" EXPLICIT  ⭐ THE FIX, vs A"          1 ""           no  subset
  # ⭐ DRYRUN IS NOT A SUBSET AXIS — the discrimination row for this harness's one extra knob.
  # Folding DRYRUN into set_placement() would red here and nowhere else in the four sweeps.
  DRYRUN=1
  sel_case "D  DRYRUN=1 with CASES UNSET is still a FULL run" 0 ""          yes committed
  DRYRUN=0

  # ── count_sel(): the link want() -> SEL_TOTAL -> the exit-3 UNPROVEN gate added below.
  sel_wl () { printf '111\ta.one(x)\tprobe_one\n222\ta.two(x)\tprobe_two\n333\ta.three(x)\tprobe_three\n'; }
  CASES_EXPLICIT=0; CASES=""
  sel_eq "E1 CASES unset       -> count_sel = 3 (all)" 3 "$(count_sel <(sel_wl) 3)"
  CASES_EXPLICIT=1; CASES="probe_two"
  sel_eq "E2 CASES=\"probe_two\"  -> count_sel = 1"     1 "$(count_sel <(sel_wl) 3)"
  CASES_EXPLICIT=1; CASES=""
  sel_eq "E3 CASES=\"\" EXPLICIT   -> count_sel = 0 ⭐"  0 "$(count_sel <(sel_wl) 3)"

  # ⭐ V3 — a counter that never incremented prints `0/0 ok`, which reads exactly like a pass.
  if [ "$sel_n" -le 0 ]; then
    echo "--- NOT OK — SELFTEST counted ZERO rows. Nothing was asserted; this is not a pass. ---"
    exit 1
  fi
  echo "--- SELFTEST TOTAL: $((sel_n - sel_fail))/$sel_n ok, $sel_fail failed ---"
  [ "$sel_fail" -eq 0 ] || exit 1
  exit 0
fi

echo "=== P0 AUTHZ INVOKER-WRAPPER AUDIT — open each wrapper's own gate, ask the SUITE ==="
echo "Repo: $ROOT"

# ─────────────────────────────────────────────────────────────────────────────────────
# Worklist from the LIVE catalog (never migration text — bodies are rewritten at
# runtime by later migrations; see CLAUDE.md's binding SQL exception).
# ─────────────────────────────────────────────────────────────────────────────────────
psql_c -c "\copy (
  select p.oid,
         n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label,
         p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and not p.prosecdef
    and p.prokind = 'f'
    and l.lanname = 'plpgsql'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  order by p.proname
) to '/tmp/wl_inv.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_inv.tsv" "$WORK/worklist_invoker.tsv" >/dev/null

# ─────────────────────────────────────────────────────────────────────────────────────
# THE DOMAIN GATE — an EMPTY-DOMAIN RUN MUST NOT END LIKE A RUN THAT MEASURED SOMETHING.
# Added 2026-09-08 with the three-state CASES fix, and it is the half of that fix without
# which the fix would REPLACE one silent failure with another: before, `CASES=""` selected
# everything and merged the COMMITTED baseline; after, it selects nothing — and without this
# gate that run would print an empty report to scratch and exit 0, indistinguishable from a
# clean sweep. An escape hatch for the unmeasured must not be spendable as a pass.
#
# ⛔ SCOPE, STATED SO IT IS NOT MISREAD AS MORE THAN IT IS. This adds exit 3 for the
# EMPTY-SELECTION case ONLY. This harness still has NO graded verdict — a run with BLINDs still
# exits 0 — which stays open as FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT. A
# partial fix reads as a complete one unless its bound is written down; this is the bound.
# ⚠ Placed ABOVE the DRY-RUN block deliberately, so `DRYRUN=1 CASES="" …` is UNPROVEN too
# rather than printing "supported: 0" — a line this file's own text calls proof of a broken
# detector, which over an empty selection it would not be.
# ─────────────────────────────────────────────────────────────────────────────────────
INV_TOTAL=$(grep -c . "$WORK/worklist_invoker.tsv" | tr -d '[:space:]')
SEL_TOTAL=$(count_sel "$WORK/worklist_invoker.tsv" 3)
echo "ARM-DOMAIN invoker=$SEL_TOTAL/$INV_TOTAL   ($SELECTION_SOURCE)"
if [ "$SEL_TOTAL" -eq 0 ]; then
  echo
  echo "=== RESULT: UNPROVEN — NOTHING WAS MEASURED. This is NOT a pass. ==="
  echo "    Selected wrappers: 0 of $INV_TOTAL in domain."
  echo "    SELECTION-SOURCE: $SELECTION_SOURCE"
  echo "    A sweep of zero wrappers cannot distinguish 'no blind wrapper' from 'no wrapper"
  echo "    looked at', so this run deliberately does NOT print a BLIND/COVERED tally."
  echo "    Nothing was neutralized; the COMMITTED baseline $FINDINGS_COMMITTED is UNTOUCHED."
  echo "    ⛔ A FROMFINDINGS ARM=wrapper run does NOT cover this: it re-measures nothing."
  echo "    Fix the SELECTION and re-run."
  exit 3
fi

: > "$PROGRESS"

# ⚠ `want()` and `count_sel()` are defined near the top of this file, beside `set_placement()`,
# so the SELFTEST block (which exits long before this line) exercises the REAL functions rather
# than a second copy of them.

# ─────────────────────────────────────────────────────────────────────────────────────
# The neutralizer. Keeps the ENTIRE pg_get_functiondef header (LANGUAGE, volatility,
# search_path, …) and swaps only the dollar-quoted body, exactly like the other sweeps
# — the new body computed in-database so no body text ever crosses the shell.
#
# It RAISES `NO-OP` if nothing changed: a silent no-op is indistinguishable from a
# surviving gate, and the caller reads that raise as UNSUPPORTED.
# ─────────────────────────────────────────────────────────────────────────────────────
cat > "$WORK/_neut_inv.sql" <<'TMPL'
do $p0$
declare
  d text; tag text; hdr text; body text; newbody text;
  n1 int := 0; n2 int := 0; n3 int := 0; n4 int := 0;
  rls_tables text; id_asserts text;
  re_g1 text; re_g2 text; re_g4 text; re_g3 constant text :=
    '(?is)\y(els)?if\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?(app\.is_|app\.can_|app\.has_|app\.member_can|public\.is_|auth\.uid)(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\ythen\y';
begin
  -- G1's alternation: every RLS-protected relation, from the catalog.
  select string_agg(c.relname, '|') into rls_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relrowsecurity and c.relkind in ('r','p');
  if rls_tables is null then
    raise exception 'P0-HARNESS: no RLS relations found — G1 would be vacuous';
  end if;
  re_g1 := '(?is)\y(els)?if\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\yexists\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\y(' || rls_tables || ')\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\ythen\y';

  -- G2's alternation: the app.assert_* functions whose OWN body touches identity.
  select string_agg(p.proname, '|') into id_asserts
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname like 'assert%'
    and p.prosrc ~ '(?i)(is_|can_|has_|member_can|memberships|auth\.uid)';
  if id_asserts is null then
    raise exception 'P0-HARNESS: no identity asserts found — G2 would be vacuous';
  end if;
  re_g2 := '(?is)\yperform\s+app\.(' || id_asserts || ')\s*\([^;]*\)';
  -- ⛔ THE ASSIGNMENT FORM, WHICH G2 CANNOT OPEN. An identity assert that RETURNS a
  -- value is called as `v := app.assert_X(...)`, and there is no type-safe neutral
  -- expression to swap in generically (`assert_meeting_staff_admin` yields the
  -- commission uuid the rest of the body then uses). Left alone, such a wrapper gets a
  -- verdict from whatever OTHER guard happened to match — which for `update_meeting`
  -- was a G1 probe on `commission_meeting_types`, a DOMAIN validity check, not the
  -- authorization decision. The suite then stayed PASS and it was recorded BLIND: a
  -- verdict about the authz gate, manufactured by opening something that is not the
  -- authz gate. A false BLIND is the mirror of the false COVERED the row-door harness
  -- warns about, and it is worse than no verdict because it looks like a finding.
  -- So: detect the form and refuse to return a verdict at all.
  re_g4 := '(?is):=\s*app\.(' || id_asserts || ')\s*\(';

  d := pg_get_functiondef(__OID__);
  -- ⚠ PLAIN string, not an E-string. The E-form turns `\n` into a literal newline BYTE
  -- and silently matches nothing — indistinguishable from "no function has a body".
  tag := (regexp_match(d, '\nAS (\$[^$]*\$)'))[1];
  if tag is null then raise exception 'P0-HARNESS: no dollar-body tag for oid __OID__'; end if;
  hdr  := split_part(d, tag, 1);
  body := split_part(d, tag, 2);

  select count(*) into n1 from regexp_matches(body, re_g1, 'g');
  select count(*) into n2 from regexp_matches(body, re_g2, 'g');
  select count(*) into n3 from regexp_matches(body, re_g3, 'g');
  select count(*) into n4 from regexp_matches(body, re_g4, 'g');

  -- An un-openable identity gate poisons any verdict this wrapper could produce: the
  -- suite would be answering about whichever OTHER guard we opened. Bail with a distinct
  -- marker so the caller records UNSUPPORTED rather than BLIND/COVERED. This costs
  -- coverage and says so; the alternative costs correctness and does not.
  if n4 > 0 then
    raise exception 'P0-UNOPENABLE: % identity assert(s) called in assignment form for oid __OID__', n4;
  end if;

  newbody := regexp_replace(body,    re_g1, '\1if false then', 'g');
  newbody := regexp_replace(newbody, re_g2, 'perform 1',        'g');
  newbody := regexp_replace(newbody, re_g3, '\1if false then',  'g');

  if newbody = body then
    raise exception 'P0-HARNESS: guard rewrite was a NO-OP for oid __OID__';
  end if;
  -- Structure check: opening a guard must not change block structure. A rewrite that
  -- swallowed an enclosing `if` would lose an `end if` and either fail to compile
  -- (loud) or compile as a DIFFERENT program (silent). Count them.
  if (select count(*) from regexp_matches(body, '(?i)\yend\s+if\y', 'g'))
     <> (select count(*) from regexp_matches(newbody, '(?i)\yend\s+if\y', 'g')) then
    raise exception 'P0-HARNESS: guard rewrite changed block structure for oid __OID__';
  end if;

  raise notice 'P0-GUARDS-OPENED g1=% g2=% g3=%', n1, n2, n3;
  if __DRY__ = 0 then
    execute hdr || tag || newbody || tag;
  end if;
end $p0$;
TMPL

# ⛔ SPLIT IN TWO ON PURPOSE. `emit_body` is the PURE generator — the closed grammar the
# merge helper takes the complement of, and the thing a proof harness can LIFT out of this
# file and run rather than re-typing. `emit_report` is generation + placement.
emit_body () {
  local total; total=$(wc -l < "$WORK/worklist_invoker.tsv" | tr -d '[:space:]')
  {
    echo "# AUTHZ Invoker-Wrapper Audit — Findings"
    echo
    echo "AUDIT-INVOKER-WRAPPER (ADR 0078 §7.14 / ADR 0079). Generated by"
    echo "\`supabase/tests/mutation/p0-authz-invoker-audit.sh\`. Domain: every \`public\`,"
    echo "\`authenticated\`-reachable, **INVOKER** (\`prosecdef = f\`) plpgsql function — the"
    echo "class all three prior sweeps are structurally blind to, because each begins"
    echo "\`and p.prosecdef\`."
    echo
    echo "Method: open the wrapper's OWN gate — an RLS existence probe (G1), a"
    echo "\`perform app.assert_*\` naming an identity assert (G2), or an identity-primitive"
    echo "\`if\` condition (G3) — run the FULL pgTAP suite, read \`Result:\`."
    echo "**COVERED** = suite went \`FAIL\` (a keystone asserts through the gate). **BLIND**"
    echo "= suite stayed \`PASS\` (no keystone exercises it). **ERROR** = run shape !="
    echo "baseline (harness bug, not a result). **UNSUPPORTED** = no guard of any class"
    echo "matched, so this harness returns NO verdict — it is not swept, and it stays in"
    echo "the census backlog."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Public INVOKER functions in the live catalog: $total."
    if [ -n "$CASES" ]; then echo; echo "> ⚠ PARTIAL RUN — CASES=\"$CASES\" (subset, not the full sweep)."; fi
    echo
    echo "## BLIND — the work-list (no keystone exercises these)"
    echo
    echo "| gate / policy | arm | direction | verdict | note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## COVERED (asserted-through) + ERROR (harness bug)"
    echo
    echo "| gate / policy | arm | direction | verdict | failing files / note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="COVERED"||$4=="ERROR"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## UNSUPPORTED — no openable guard (NOT a verdict; still owed a keystone)"
    echo
    echo "These stay in \`supabase/tests/mutation/authz-unswept-backlog.txt\`."
    echo
    echo "| gate / policy | arm | direction | verdict | why unsupported |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="UNSUPPORTED"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
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

record () {
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  [ "$DRYRUN" = "1" ] || emit_report
}

# ── DRY RUN: classify only, no mutation, no suite ────────────────────────────────────
if [ "$DRYRUN" = "1" ]; then
  echo "--- DRY RUN: classifying guards only (no mutation, no suite run) ---"
  BASE_FILES="(dry)"; BASE_TESTS="(dry)"
  SUP=0; UNSUP=0
  while IFS=$'\t' read -r oid label proname; do
    [ -z "$oid" ] && continue
    want "$proname" || continue
    sed -e "s/__OID__/$oid/g" -e "s/__DRY__/1/g" "$WORK/_neut_inv.sql" > "$WORK/_mutinv.sql"
    mout=$(psql_f "$WORK/_mutinv.sql")
    if echo "$mout" | grep -q 'P0-UNOPENABLE'; then
    record "invoker" "$label" "open-guard" "UNSUPPORTED" "identity assert called in ASSIGNMENT form (\`v := app.assert_*\`) — no type-safe neutral value; any verdict here would be about a different guard"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label (un-openable identity assert)"; continue
  fi
  if echo "$mout" | grep -q 'NO-OP'; then
      UNSUP=$((UNSUP+1)); echo "  unsupported  $proname"
    elif echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
      echo "  HARNESS-ERROR  $proname :: $(echo "$mout" | tr '\n' ' ' | head -c 120)"
    else
      SUP=$((SUP+1))
      echo "  SUPPORTED    $proname  $(echo "$mout" | grep -oE 'g1=[0-9]+ g2=[0-9]+ g3=[0-9]+')"
    fi
  done < "$WORK/worklist_invoker.tsv"
  echo
  echo "=== DRY RUN DONE. supported: $SUP   unsupported: $UNSUP ==="
  echo "A supported count of 0 means the detector is broken, NOT that the codebase is clean."
  exit 0
fi

echo "--- preflight: capturing GREEN baseline (§7.3 assert the state) ---"
BASE_OUT=$(run_suite)
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A dirty"
  echo "    baseline invalidates every case below. Aborting."; exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"
echo

echo "=== INVOKER-WRAPPER ARM ==="
SUPPORTED=0; UNSUP=0
while IFS=$'\t' read -r oid label proname; do
  [ -z "$oid" ] && continue
  want "$proname" || continue

  s=$(slug "$label")
  orig="$WORK/orig_inv_${oid}_$s.sql"
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"

  # ⛔ ROLLBACK POINT FIRST — verify the restore file exists and is non-empty BEFORE
  # touching the function. This guard is the actual fix for the abort that cut the first
  # full run short at case 81 of 88; the over-long filename was only its trigger.
  # What happened without it: the `> "$orig"` redirect failed, `set -u` (no `-e`) let the
  # loop continue, the wrapper was neutralized anyway, and both the inline restore and
  # the EXIT trap then no-oped because they guard on `[ -f "$INFLIGHT" ]` — a file that
  # was never created. The sweep exited 2 having left `public.update_meeting` sitting in
  # the SHARED local stack with its authz gate open. A harness that mutates before it can
  # prove it can undo is a worse hazard than the blindness it audits.
  if [ ! -s "$orig" ]; then
    record "invoker" "$label" "open-guard" "ERROR" "could not capture a rollback point ($orig) — NOT mutated"
    INFLIGHT=""; echo "  ERROR  $label (no rollback point; skipped WITHOUT mutating)"; continue
  fi
  INFLIGHT="$orig"

  sed -e "s/__OID__/$oid/g" -e "s/__DRY__/0/g" "$WORK/_neut_inv.sql" > "$WORK/_mutinv.sql"
  mout=$(psql_f "$WORK/_mutinv.sql")
  if echo "$mout" | grep -q 'P0-UNOPENABLE'; then
    record "invoker" "$label" "open-guard" "UNSUPPORTED" "identity assert called in ASSIGNMENT form (\`v := app.assert_*\`) — no type-safe neutral value; any verdict here would be about a different guard"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label (un-openable identity assert)"; continue
  fi
  if echo "$mout" | grep -q 'NO-OP'; then
    record "invoker" "$label" "open-guard" "UNSUPPORTED" "no RLS probe / identity assert / identity condition to open"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label"; continue
  fi
  if echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
    record "invoker" "$label" "open-guard" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 150)"
    psql_f "$orig" >/dev/null 2>&1; INFLIGHT=""
    echo "  ERROR  $label (neutralize failed)"; continue
  fi

  ng=$(echo "$mout" | grep -oE 'g1=[0-9]+ g2=[0-9]+ g3=[0-9]+' | tail -1 | tr ' ' ',')
  # ⚠ G1-ONLY VERDICTS ARE PROVISIONAL — see the G1 caveat in the header. When G1 is the
  # only class that fired, the opened guard may be a DOMAIN check rather than the authz
  # decision, and the suite then answered a question we did not ask. Flagged in the note
  # column so a g1-only BLIND is hand-classified before it is trusted or allowlisted.
  G1ONLY=""
  case "$ng" in g1=[1-9]*,g2=0,g3=0) G1ONLY="⚠ g1-only: PROVISIONAL, hand-classify (the opened probe may be a domain check, not the gate) — " ;; esac
  out=$(run_suite); echo "$out" > "$RUNLOGS/inv_$s.log"
  classify "$out"

  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $label did NOT round-trip. Every later case is"
    echo "    suspect. Aborting the sweep (§7.5)."; exit 2
  fi
  INFLIGHT=""

  record "invoker" "$label" "open-guard(${ng:-?})" "$VERDICT" "${G1ONLY}${FAILING:-}"
  SUPPORTED=$((SUPPORTED+1))
  echo "  $VERDICT  $label"
done < "$WORK/worklist_invoker.tsv"

emit_report
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
awk -F'\t' '{c[$4]++} END{for(k in c) printf "%s: %d   ", k, c[k]; print ""}' "$PROGRESS"
echo "swept (suite-run): $SUPPORTED   unsupported (static): $UNSUP"

# ⛔ THE EXIT CODE, MINIMAL AND ONE-PURPOSE (QA F-MAJOR-5, 2026-09-05). Until here this file
# ended on the echo above, so its exit status was whatever the last `echo` returned — always
# 0. That is a wider gap than this block closes: this harness has NO graded RESULT: verdict
# at all, so a run with BLINDs still exits 0. That gap is FILED, not fixed here
# (FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT, owner backend) — widening the
# contract of two harnesses is a change with its own blast radius and it is not this unit's.
# What IS this unit's is the merge it introduced: an aborted merge leaves the findings file
# byte-for-byte as it was, which on a FULL run is EXACTLY what "no verdict moved" looks like,
# so `git diff --stat` cannot separate them and only an exit code can.
if [ "${MERGE_FAILED:-0}" = "1" ]; then
  echo "=== RESULT: ERROR — the findings MERGE ABORTED. $FINDINGS was NOT written and is"
  echo "    STALE: it holds a PREVIOUS run's verdicts. ⛔ An empty \`git diff\` on it is NOT"
  echo "    evidence this run changed nothing — it is what an aborted merge also produces."
  echo "    Re-merge by hand from $BASELINE_SNAPSHOT and $GENERATED. ERROR is not a pass. ==="
  exit 2
fi
exit 0
