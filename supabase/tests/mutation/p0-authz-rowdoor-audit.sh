#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14 / ADR 0079). THE THIRD SWEEP.
#
# p0-authz-door-audit.sh neutralizes a BOOLEAN gate by rewriting its body to `select
# true`. That is meaningless for a function that RETURNS A TABLE — there is no boolean
# to open — so 45 `prosecdef` row-returning doors sat in the census backlog with a
# verdict in NO direction (FUP-AUTHZ-3). This script is the missing mechanism.
#
# Why the class matters, in one sentence: CLAUDE.md's standing rule is that a DEFINER's
# gate REPLACES RLS, so for these doors the gate INSIDE the body is the entire boundary.
# It is not hypothetical debt — BUG-AUTHZ-002 lived exactly here: `hospital_document_
# register` and `hospital_indicator_rollup` returned commission content to platform_admin
# against ADR 0078 A35's noun rule, and a boolean-only census could not see them.
#
# ── THE NEUTRALIZATION ───────────────────────────────────────────────────────────────
# Opening a row-door's gate means: make it RETURN THE ROWS IT WOULD HAVE WITHHELD.
# Every one of these doors states its gate as a statement-level guard:
#
#     if <cond referencing the caller's identity> then return; end if;      -- 31 doors
#     if <same> then raise exception 'sem permissão' using errcode='42501'; --  5 doors
#
# so the neutralization rewrites that guard's CONDITION — `if <cond> then` -> `if false
# then` — and nothing else. The deny arm becomes dead code and execution falls through
# to the query. Signature, return type, volatility, DEFINER and search_path are all
# untouched; only the body changes (§7.15b).
#
# ⚠ THE CONDITION, NOT THE DENY ARM. Blanking the `raise` instead would also open
# guards that are NOT authorization — `list_case_access` raises `no_data_found` for a
# missing case — and a keystone noticing THAT would be recorded as a keystone noticing
# the authz gate. A false COVERED is worse than no verdict: it is the exact "audit one
# layer, infer the next" error this program exists to stop. So a guard is rewritten only
# when its condition references an identity primitive (`app.is_*`, `app.can_*`,
# `app.has_*`, `app.member_can`, `public.is_*`, `auth.uid()`). A feature-flag guard
# (`app.feature_enabled`) matches none of those and is deliberately left closed.
#
# ── WHAT THIS SWEEP CANNOT DO, STATED LOUDLY ─────────────────────────────────────────
# A door whose gate is not a statement guard — an identity conjunct INSIDE the query
# (`where m.principal_id = auth.uid()`), or a `declare`-block array of the caller's
# hospitals — has nothing to rewrite. Those are recorded UNSUPPORTED, with the reason,
# and they STAY in authz-unswept-backlog.txt. UNSUPPORTED is not a pass and not a
# verdict; it is this harness admitting its edge, which is the one thing a census must
# never hide. They owe a §4-style walk-through keystone (see
# supabase/tests/299_hospital_content_door_noun_rule.sql): a computed enumeration plus a
# row-count assertion per principal, never a predicate call.
#
# Verdicts, identical in meaning to the door audit:
#   suite FAIL  -> a keystone asserts through the gate            = COVERED (good)
#   suite PASS  -> nobody noticed the door opening                = BLIND   (a finding)
#   shape != baseline -> harness bug, fix the neutralization      = ERROR   (not a result)
#
# Run from repo root:  bash supabase/tests/mutation/p0-authz-rowdoor-audit.sh
# Subset:              CASES="pqs_inbox list_case_access" bash .../p0-authz-rowdoor-audit.sh
#   ⛔ CASES HAS THREE STATES, NOT TWO — set-ness, not value (2026-09-08):
#     CASES UNSET          -> FULL run over the whole domain (may merge the committed baseline)
#     CASES set, non-empty -> SUBSET run, scratch report only
#     CASES set, EMPTY     -> SUBSET run selecting NOTHING -> exit 3 UNPROVEN. ⛔ NOT a full run.
#   A full sweep from a parent script is `unset CASES && bash ...`, never `CASES= bash ...`:
#   `VAR= cmd` sets VAR to the EMPTY STRING in the child, which is the third state.
# Self-test:           SELFTEST=1 bash .../p0-authz-rowdoor-audit.sh   (no DB; rc 0 / 1)
#
# ── EXIT CODES ──────────────────────────────────────────────────────────────────────
#   0  the sweep ran   ⚠ NOT a verdict — this harness has no graded RESULT and a run with
#                      BLINDs also exits 0 (FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-
#                      GRADED-EXIT). Read the tally, never the code, for coverage.
#   2  the findings MERGE aborted
#   3  UNPROVEN — zero doors selected. NOTHING was measured; this is NOT a pass.
#   ⭐ A subset run writes its report + BLIND tsv to SCRATCH under $WORK and NEVER opens
#   the committed findings md for write (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE). There
#   is nothing to `git checkout --` afterwards; older instructions saying otherwise
#   describe the pre-2026-08-26 behaviour.
# ⚠ COST: ~25 s of pgTAP per SUPPORTED door. The LEAD runs the full loop in the
# background; a subagent's process dies at turn-end.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-$ROOT/.authz-work}"
PROGRESS="$WORK/progress_rowdoor.tsv"
RUNLOGS="$WORK/runlogs_rowdoor"
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
FINDINGS_COMMITTED="$ROOT/docs/reviews/authz-rowdoor-audit-findings.md"

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
# `$WORK/blinds_rowdoor.tsv` as a FULL-sweep result. The property is "never overwrite the
# artefact a later arm reads back as a baseline"; committed vs scratch is not part of it.
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ KEYED ON SET-NESS, and a FUNCTION so SELFTEST can EXERCISE the rule instead of restating
# it. ⛔ PORTED, NOT COPIED: the door's twin carries a SECOND disjunct on BASE_SHAPE_OVERRIDE.
# THIS harness has no such knob (measured: zero occurrences of BASE_SHAPE_OVERRIDE and of
# SELFPROOF in this file), so the door's second disjunct is deliberately NOT carried over —
# importing it would introduce a variable nothing here sets and a branch nothing can reach.
set_placement () {   # reads CASES_EXPLICIT -> sets SUBSET_RUN, FINDINGS, BLINDS_TSV
  if [ "$CASES_EXPLICIT" = "1" ]; then
    SUBSET_RUN=1
    FINDINGS="$WORK/authz-rowdoor-audit-findings.SUBSET.md"
    BLINDS_TSV="$WORK/blinds_rowdoor.SUBSET.tsv"
  else
    SUBSET_RUN=0
    FINDINGS="$FINDINGS_COMMITTED"
    BLINDS_TSV="$WORK/blinds_rowdoor.tsv"
  fi
}
set_placement

# ⛔ THREE STATES, NOT TWO. The old body was `[ -z "$CASES" ] && return 0`, which selected
# EVERYTHING for an explicitly-empty CASES — i.e. the recipe above silently ran a FULL sweep
# that merged into the COMMITTED baseline. An UNSET CASES still selects everything (that IS a
# full run); a SET-and-EMPTY CASES selects NOTHING.
# ⛔ DEFINED HERE, not at its old site ~150 lines below, because the SELFTEST block exits before
# that line and would otherwise die with `want: command not found`. Defining a second copy up
# here would be a hand-written copy of production text: the self-test would measure the copy
# while every sweep used the original. Nothing calls it before the domain gate.
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
GENERATED="$WORK/authz-rowdoor-audit-findings.generated.md"
BASELINE_SNAPSHOT="$WORK/authz-rowdoor-audit-findings.baseline.md"
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

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
psql_f () {
  local host="$1"
  docker cp "$host" "$DB:/tmp/_p0row.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_p0row.sql 2>&1
}
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' ; }

# Restore-on-exit. A door is open only for the ~25 s of its suite run, but a kill in
# that window would leave it open for the next owner of the shared local stack.
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight door from $INFLIGHT)"
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
# ⚠ Placement is exercised THROUGH set_placement(), selection THROUGH want()/count_sel(). This
#   block restates neither rule.
# ⚠ Run it BEFORE anything touches the catalog: SELFTEST=1 exits here. The committed baseline is
#   never opened for write, and the EXIT trap re-asserts that by cksum on the way out.
# Bare exit code: 0 = every row ok, 1 = any row failed. ⛔ Read it directly; never through a pipe.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "${SELFTEST:-0}" = "1" ]; then
  echo "=== SELFTEST: CASES set-ness — selection, placement and the SELECTED COUNT (no DB) ==="
  sel_fail=0; sel_n=0
  # ⛔ SYNTHETIC PROBE. want() is pure string matching against $CASES and consults no catalog,
  # so naming a real door here would only add a name-keyed verdict that rots on a rename.
  SEL_PROBE="probe_rowdoor_alpha"
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
  sel_case "B2 CASES=\"other_door\" (subset, not this key)"   1 "other_door" no  subset
  sel_case "C  CASES=\"\" EXPLICIT  ⭐ THE FIX, vs A"          1 ""           no  subset

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

echo "=== P0 AUTHZ ROW-DOOR AUDIT — open each row-returning DEFINER's guard, ask the SUITE ==="
echo "Repo: $ROOT"
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

# ─────────────────────────────────────────────────────────────────────────────────────
# Worklist from the LIVE catalog (never migration text — those bodies are rewritten at
# runtime by later migrations; see CLAUDE.md's binding SQL exception).
# ─────────────────────────────────────────────────────────────────────────────────────
psql_c -c "\copy (
  select p.oid,
         n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label,
         p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app','public','authz')
    and p.prosecdef
    and p.proretset
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  order by p.proname
) to '/tmp/wl_row.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_row.tsv" "$WORK/worklist_rowdoor.tsv" >/dev/null

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
# ⚠ The gate sits BEFORE the neutralization loop, so an UNPROVEN run mutates nothing.
# ─────────────────────────────────────────────────────────────────────────────────────
ROW_TOTAL=$(grep -c . "$WORK/worklist_rowdoor.tsv" | tr -d '[:space:]')
SEL_TOTAL=$(count_sel "$WORK/worklist_rowdoor.tsv" 3)
echo "ARM-DOMAIN rowdoor=$SEL_TOTAL/$ROW_TOTAL   ($SELECTION_SOURCE)"
if [ "$SEL_TOTAL" -eq 0 ]; then
  echo
  echo "=== RESULT: UNPROVEN — NOTHING WAS MEASURED. This is NOT a pass. ==="
  echo "    Selected doors: 0 of $ROW_TOTAL in domain."
  echo "    SELECTION-SOURCE: $SELECTION_SOURCE"
  echo "    A sweep of zero doors cannot distinguish 'no blind door' from 'no door looked at',"
  echo "    so this run deliberately does NOT print a BLIND/COVERED tally."
  echo "    Nothing was neutralized; the COMMITTED baseline $FINDINGS_COMMITTED is UNTOUCHED."
  echo "    Fix the SELECTION and re-run."
  exit 3
fi

: > "$PROGRESS"

# ⚠ `want()` and `count_sel()` are defined near the top of this file, beside `set_placement()`,
# so the SELFTEST block (which exits long before this line) exercises the REAL functions rather
# than a second copy of them.

# ⛔ SPLIT IN TWO ON PURPOSE. `emit_body` is the PURE generator — the closed grammar the
# merge helper takes the complement of, and the thing a proof harness can LIFT out of this
# file and run rather than re-typing. `emit_report` is generation + placement.
emit_body () {
  local total; total=$(wc -l < "$WORK/worklist_rowdoor.tsv" | tr -d '[:space:]')
  {
    echo "# AUTHZ Row-Door Audit — Findings"
    echo
    echo "AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079), FUP-AUTHZ-3. Generated by"
    echo "\`supabase/tests/mutation/p0-authz-rowdoor-audit.sh\`. Domain: every \`prosecdef\`,"
    echo "\`authenticated\`-reachable, ROW-RETURNING function in \`app\`/\`public\` — the class the"
    echo "boolean sweep is structurally blind to, and the class BUG-AUTHZ-002 lived in."
    echo
    echo "Method: rewrite the door's identity guard \`if <cond> then\` -> \`if false then\` so it"
    echo "returns the rows it would have withheld, run the FULL pgTAP suite, read \`Result:\`."
    echo "**COVERED** = suite went \`FAIL\` (a keystone asserts through the gate). **BLIND** ="
    echo "suite stayed \`PASS\` (no keystone exercises it). **ERROR** = run shape != baseline"
    echo "(harness bug, not a result). **UNSUPPORTED** = the door has no statement-level"
    echo "identity guard to open (the gate is a conjunct inside the query), so this harness"
    echo "returns NO verdict about it — it is not swept, and it stays in the census backlog."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Row-returning doors in the live catalog: $total."
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
    echo "## UNSUPPORTED — no statement guard to open (NOT a verdict; still owed a keystone)"
    echo
    echo "These stay in \`supabase/tests/mutation/authz-unswept-backlog.txt\`. Each owes a"
    echo "walk-through keystone in the shape of \`supabase/tests/299_hospital_content_door_noun_rule.sql\`"
    echo "§4 — a computed enumeration plus a row-count assertion per principal."
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
  emit_report
}

# ─────────────────────────────────────────────────────────────────────────────────────
# The neutralizer. Keeps the ENTIRE pg_get_functiondef header (LANGUAGE, volatility,
# SECURITY DEFINER, search_path, …) and swaps only the dollar-quoted body, exactly like
# the boolean sweep — but the new body is the OLD body with its identity guards opened,
# computed in-database by regexp_replace so no body text ever crosses the shell.
#
#   `[^;]*?`  keeps the match inside ONE statement — a plpgsql condition never contains
#             a semicolon, so this cannot swallow the guard's body or the next statement.
#   the alternation forces an identity reference INSIDE the condition, which is what
#   makes this an authz neutralization rather than a blunt "open every if".
#
# It RAISES if the rewrite changed nothing (a silent no-op is indistinguishable from a
# surviving gate — the FF-3 lesson: confirm a mutation APPLIED before trusting it).
#
# ⚠ THE LOOKAHEADS ARE LOAD-BEARING, and the first version did not have them. Written as
# `\yif\y[^;]*?<authz>[^;]*?\ythen\y`, the match can span from an OUTER `if … then` across
# an inner guard, because plpgsql puts no `;` between them:
#
#     if p_commission is not null then          -- outer: NOT an authz decision
#       if not (app.is_staff_admin_of(…)) then  -- inner: the actual gate
#
# collapsed to ONE `if false then`, losing an `end if` and leaving a dangling `elsif`.
# `verify_audit_chain` failed to compile and was recorded ERROR — which is the LUCKY
# outcome. The same swallow in a door without an `elsif` chain would still compile, would
# open a condition that is not an authorization decision, and would report whatever the
# suite then did as a verdict about the GATE. That is a false COVERED, manufactured by
# the audit itself. `(?![;]|\ythen\y|\y(?:els)?if\y)` stops the match at the first
# intervening `if`/`then`, and the `end if` count check above is the belt to that brace.
# Blast radius when found: 1 of 45 doors (the other 44 match identically either way, so
# their verdicts stood) — established by diffing both regexes over every body, not assumed.
# ─────────────────────────────────────────────────────────────────────────────────────
cat > "$WORK/_neut_row.sql" <<'TMPL'
do $p0$
declare
  d text; tag text; hdr text; body text; newbody text; n int;
  -- The ONE definition of "an openable identity guard", used for both the rewrite and
  -- the count. There is deliberately no second copy anywhere: a door with no match here
  -- raises NO-OP below, and the caller reads that as UNSUPPORTED.
  re constant text :=
    '(?is)\y(els)?if\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?(app\.is_|app\.can_|app\.has_|app\.member_can|public\.is_|auth\.uid)(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\ythen\y';
begin
  d := pg_get_functiondef(__OID__);
  -- ⚠ PLAIN string, not an E-string. `E'\nAS (\\$[^$]*\\$)'` returns NULL here: the
  -- E-escape turns `\n` into a literal newline BYTE, and this pattern then fails to
  -- match while the byte-identical-looking regex escape does. Verified against the live
  -- catalog on 2026-08-05 — the E-form silently found 0 guards in all 45 doors, which
  -- is indistinguishable from "no door has a guard". A dry run caught it; nothing else
  -- would have, because every door would simply have been filed UNSUPPORTED.
  tag := (regexp_match(d, '\nAS (\$[^$]*\$)'))[1];
  if tag is null then raise exception 'P0-HARNESS: no dollar-body tag for oid __OID__'; end if;
  hdr  := split_part(d, tag, 1);
  body := split_part(d, tag, 2);
  newbody := regexp_replace(body, re, '\1if false then', 'g');
  if newbody = body then
    raise exception 'P0-HARNESS: guard rewrite was a NO-OP for oid __OID__';
  end if;
  -- Structure check: opening a guard must not change the block structure. A rewrite
  -- that swallowed an enclosing `if` would lose an `end if` and either fail to compile
  -- (loud) or, worse, compile as a DIFFERENT program (silent). Count them.
  if (select count(*) from regexp_matches(body, '(?i)\yend\s+if\y', 'g'))
     <> (select count(*) from regexp_matches(newbody, '(?i)\yend\s+if\y', 'g')) then
    raise exception 'P0-HARNESS: guard rewrite changed block structure for oid __OID__';
  end if;
  select count(*) into n from regexp_matches(body, re, 'g');
  raise notice 'P0-GUARDS-OPENED %', n;
  execute hdr || tag || newbody || tag;
end $p0$;
TMPL

echo "=== ROW-DOOR ARM ==="
SUPPORTED=0; UNSUP=0
while IFS=$'\t' read -r oid label proname; do
  [ -z "$oid" ] && continue
  want "$proname" || continue

  s=$(slug "$label")
  orig="$WORK/orig_row_$s.sql"
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"
  INFLIGHT="$orig"

  sed -e "s/__OID__/$oid/g" "$WORK/_neut_row.sql" > "$WORK/_mutrow.sql"
  mout=$(psql_f "$WORK/_mutrow.sql")
  # No separate static pre-check: the neutralizer itself raises `NO-OP` when a door has
  # no openable guard, so UNSUPPORTED falls out of the SAME regex that would do the
  # rewrite. A second copy of that regex for a cheap pre-pass is exactly how a detector
  # and a mutator drift into disagreeing about what a guard is — and the first draft of
  # this script had that copy, mangled, in a heredoc.
  if echo "$mout" | grep -q 'NO-OP'; then
    record "rowdoor" "$label" "open-guard" "UNSUPPORTED" "no statement-level identity guard — the gate is a conjunct inside the query"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label"; continue
  fi
  if echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
    record "rowdoor" "$label" "open-guard" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 150)"
    psql_f "$orig" >/dev/null 2>&1; INFLIGHT=""
    echo "  ERROR  $label (neutralize failed)"; continue
  fi

  ng=$(echo "$mout" | grep -oE 'P0-GUARDS-OPENED [0-9]+' | grep -oE '[0-9]+' | tail -1)
  out=$(run_suite); echo "$out" > "$RUNLOGS/row_$s.log"
  classify "$out"

  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $label did NOT round-trip. Every later case is"
    echo "    suspect. Aborting the sweep (§7.5)."; exit 2
  fi
  INFLIGHT=""

  record "rowdoor" "$label" "open-guard(${ng:-?})" "$VERDICT" "${FAILING:-}"
  SUPPORTED=$((SUPPORTED+1))
  echo "  $VERDICT  $label"
done < "$WORK/worklist_rowdoor.tsv"

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
