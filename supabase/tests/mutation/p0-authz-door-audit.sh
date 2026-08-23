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
WORK="${WORK:-/c/Users/micha/AppData/Local/Temp/claude/C--Users-micha-Development-claude-hospital-form-platform/6d030efd-e072-4a80-a704-0dc4fb6c9049/scratchpad/authz-audit}"
FINDINGS="$ROOT/docs/reviews/authz-door-audit-findings.md"
BLINDS_TSV="$WORK/blinds.tsv"
PROGRESS="$WORK/progress.tsv"          # per-case log, written AS WE GO (§ mid-run kill)
RUNLOGS="$WORK/runlogs"                # full suite output per case, for forensics
CASES="${CASES:-}"                     # optional subset filter

mkdir -p "$WORK" "$RUNLOGS"

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
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight gate from $INFLIGHT)"
    psql_f "$INFLIGHT" >/dev/null 2>&1
  fi
}
trap restore_inflight EXIT

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
  # §7.15: a run whose SHAPE differs from baseline (fewer files/tests, or Dubious) is an
  # ABORT — a harness bug (bad neutralization), NOT a BLIND/COVERED result.
  if [ -z "$res" ] || [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    VERDICT="ERROR"
  elif [ "$res" = "FAIL" ]; then
    VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then
    VERDICT="BLIND"
  else
    VERDICT="ERROR"
  fi
}

echo "=== P0 AUTHZ DOOR AUDIT — neutralize each gate, ask the WHOLE SUITE if anyone noticed ==="
echo "Repo: $ROOT"

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
     or p.prosrc ~ '^\s*begin\s+return\s*;\s*end' )"

degenerate_gates () {
  psql_c -c "select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
               from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('app','public') and $DEGENERATE_PREDICATE
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
#   PRED: secdef boolean gates (is_/can_/has_/referral_target_analyst/attachment_confidentiality_ok,
#         excluding the is_valid_* config validators) + the void raise-guard
#         assert_not_case_excluded. Direction: the three deny predicates -> false;
#         the void assert -> no-op; everything else -> true.
#         ⚠ value-returning raise-guards (assert_*_writable, assert_referral_*) are
#         EXCLUDED from the auto-sweep — neutralizing a uuid/record raise-guard risks a
#         NULL-propagation ABORT downstream (§7.15). They are listed in the report as a
#         manual-neutralization GAP for the lead to hand-add bespoke.
#   POL:  SELECT/ALL policies on public tables whose qual is a real predicate (not `true`).
# ─────────────────────────────────────────────────────────────────────────────────────
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
  where n.nspname in ('app','public')
    and p.prosecdef = true
    and (
       (t.typname='bool' and p.proname ~ '^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)'
          and p.proname !~ '^is_valid_')
       or p.proname = 'assert_not_case_excluded'
    )
  order by p.proname
) to '/tmp/wl_pred.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_pred.tsv" "$WORK/worklist_pred.tsv" >/dev/null

# ─────────────────────────────────────────────────────────────────────────────────────
# §7.17b  THE DOMAIN IS A NAME PREFIX STANDING IN FOR A PROPERTY — SO MEASURE THE GAP.
#
# The PRED filter above is a NAME regex. The property it stands in for is "is an
# authorization predicate", which no regex decides: of the `prosecdef` booleans OUTSIDE
# the regex, some ARE gates (`app._audit_access_authorized`, `confidentiality_clearance_ok`,
# `member_can*`, `capa_viewer_can_manage`, …) while others are feature-flag readers,
# `validate_*` shape-checkers, and two SIDE-EFFECTING writers (`app.enqueue_notification`,
# `public.remind_document_approver`) whose body must NOT be swapped for `select true`.
# So the arm is NOT auto-widened here — that would trade a silent gap for silent ERRORs.
# Instead the gap is CENSUSED on every run and printed, so no report can imply the arm's
# domain is the whole property. ⛔ "outside the predicate arm" != "unswept" (other arms
# exist) and this count is NOT a defect count — it is the size of the unclassified set.
# Classification is tracked in authz-unswept-backlog.txt, not decided here.
# ─────────────────────────────────────────────────────────────────────────────────────
psql_c -c "\copy (
  select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_type      t on t.oid=p.prorettype
  where n.nspname in ('app','public')
    and p.prosecdef = true
    and t.typname='bool'
    and not (
       (p.proname ~ '^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)'
          and p.proname !~ '^is_valid_')
       or p.proname = 'assert_not_case_excluded'
    )
  order by 1
) to '/tmp/wl_pred_out.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_pred_out.tsv" "$WORK/outofdomain_pred_bool.tsv" >/dev/null

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
docker cp "$DB:/tmp/wl_pol.tsv" "$WORK/worklist_pol.tsv" >/dev/null

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
echo "      excluded by the NAME regex, not by a property (list: $WORK/outofdomain_pred_bool.tsv)."
echo "      This arm's domain is a name prefix. 'Outside it' != 'unswept' (other arms exist);"
echo "      $PRED_OUT is the size of the UNCLASSIFIED set, never a defect count."

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
      where n.nspname in ('app','public') and p.proname = '$safe';" | head -1)
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
  echo "    Nothing was neutralized; the baseline suite was NOT run; $FINDINGS is UNTOUCHED."
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
echo

# progress.tsv columns: arm  gate  direction  verdict  failing_files
: > "$PROGRESS"

# Regenerate the two deliverables from progress.tsv. Called after EVERY case so a
# mid-run kill still leaves a coherent partial report (brief requirement).
emit_report () {
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
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Policies swept: $total_pol (real qual). Policies skipped (qual=true, vacuous): $skipped_pol."
    echo
    echo "**Domain of this run** (§7.17 — a verdict is meaningless without the domain beside it):"
    echo "\`ARM-DOMAIN predicate=$PRED_SEL/$PRED_TOTAL policy=$POL_SEL/$POL_TOTAL\`."
    if [ "$PRED_SEL" -eq 0 ]; then echo "⚠ **PREDICATE ARM: EMPTY DOMAIN — measured nothing.** It did not hold; it did not run."; fi
    if [ "$POL_SEL"  -eq 0 ]; then echo "⚠ **POLICY ARM: EMPTY DOMAIN — measured nothing.** It did not hold; it did not run."; fi
    echo
    echo "⛔ The predicate arm's domain is a **NAME REGEX**, not the property \"is an authorization"
    echo "predicate\". **$PRED_OUT** \`prosecdef\` **boolean** function(s) are outside it purely by name"
    echo "(listed at the end). \"Outside this arm\" is NOT \"unswept\" — other arms exist — and"
    echo "$PRED_OUT is the size of the UNCLASSIFIED set, never a defect count."
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
    echo "## COVERED (asserted-through) + ERROR (harness bug)"
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
  } > "$FINDINGS"

  # machine-readable BLIND list
  { echo -e "arm\tgate\tdirection\tfailing_or_note";
    awk -F'\t' '$4=="BLIND"{printf "%s\t%s\t%s\t%s\n",$1,$2,$3,$5}' "$PROGRESS"; } > "$BLINDS_TSV"
}

record () {  # arm gate direction verdict failing
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  emit_report
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
echo "=== PREDICATE ARM (domain: $PRED_SEL selected of $PRED_TOTAL) ==="
[ "$PRED_SEL" -eq 0 ] && echo "  ⚠ EMPTY DOMAIN — this arm measures NOTHING on this run."
while IFS=$'\t' read -r oid label proname direction lang; do
  [ -z "$oid" ] && continue
  want "$proname" || continue

  # newbody by direction + language (type-preserving)
  local_nb=""
  case "$direction" in
    positive)    [ "$lang" = "sql" ] && local_nb='select true'  || local_nb='begin return true; end' ;;
    deny)        [ "$lang" = "sql" ] && local_nb='select false' || local_nb='begin return false; end' ;;
    assert_noop) local_nb='begin return; end' ;;   # void plpgsql raise-guard -> no-op
    *)           echo "  SKIP $label (unknown direction $direction)"; continue ;;
  esac

  s=$(slug "$label")
  orig="$WORK/orig_pred_$s.sql"
  # capture ORIGINAL def (exact bytes) for restore + restore-verification
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"
  INFLIGHT="$orig"   # arm the EXIT trap before we open the gate

  # neutralize via an anonymous DO block (no persistent catalog residue; see header note)
  sed -e "s/__OID__/$oid/g" -e "s|__NEWBODY__|$local_nb|g" "$WORK/_neut_template.sql" > "$WORK/_mut.sql"
  mout=$(psql_f "$WORK/_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
    record "predicate" "$label" "$direction" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    # attempt restore anyway
    psql_f "$orig" >/dev/null 2>&1
    INFLIGHT=""; echo "  ERROR  $label (neutralize failed)"; continue
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
  INFLIGHT=""   # restore verified — disarm the trap

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "predicate" "$label" "$direction" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$label"
done < "$WORK/worklist_pred.tsv"

# ─────────────────────────────────────────────────────────────────────────────────────
# POLICY ARM
# ─────────────────────────────────────────────────────────────────────────────────────
echo
echo "=== POLICY ARM (domain: $POL_SEL selected of $POL_TOTAL) ==="
[ "$POL_SEL" -eq 0 ] && echo "  ⚠ EMPTY DOMAIN — this arm measures NOTHING on this run."
while IFS=$'\t' read -r tbl polname cmd has_wc; do
  [ -z "$tbl" ] && continue
  want "$polname" || continue

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
  INFLIGHT="$restore"

  # OPEN the policy: using(true) [+ with check(true)]
  { echo "alter policy \"$polname\" on public.\"$tbl\" using (true)$([ "$has_wc" = "t" ] && echo ' with check (true)');" ; } > "$WORK/_mut.sql"
  mout=$(psql_f "$WORK/_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "open failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    INFLIGHT=""; echo "  ERROR  $tbl.$polname"; continue
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pol_$s.log"
  classify "$out"

  # RESTORE exact original qual [+ with check] + VERIFY
  psql_f "$restore" >/dev/null 2>&1
  nowq=$(psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass")
  if [ "$nowq" != "$(cat "$qfile")" ]; then
    echo "*** CONTAMINATION: restore of policy $tbl.$polname did NOT round-trip. Aborting (§7.5)."; exit 2
  fi
  INFLIGHT=""   # restore verified — disarm the trap

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "policy" "$tbl.$polname ($cmd)" "open->true" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$tbl.$polname"
done < "$WORK/worklist_pol.tsv"

echo
echo "=== DONE. Report: $FINDINGS   BLINDs: $BLINDS_TSV ==="
blind_ct=$(awk -F'\t' '$4=="BLIND"' "$PROGRESS" | wc -l | tr -d '[:space:]')
err_ct=$(awk -F'\t' '$4=="ERROR"' "$PROGRESS" | wc -l | tr -d '[:space:]')
swept_ct=$(grep -c . "$PROGRESS" | tr -d '[:space:]')
cov_ct=$((swept_ct - blind_ct - err_ct))

# §7.17: the count line is USELESS without the domain beside it — "BLIND: 0" over an
# empty domain and "BLIND: 0" over 101 gates were the same string. Print the domain
# FIRST, per arm, so a §6 gate record can name WHICH ARM HAD A DOMAIN instead of
# claiming "the ARMs HOLD".
echo "ARM-DOMAIN predicate=$PRED_SEL/$PRED_TOTAL policy=$POL_SEL/$POL_TOTAL out-of-domain-bool=$PRED_OUT"
[ "$PRED_SEL" -eq 0 ] && echo "    ⚠ PREDICATE ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ "$POL_SEL"  -eq 0 ] && echo "    ⚠ POLICY ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ -n "$UNMATCHED" ] && echo "    ⚠ REQUESTED BUT NEVER SWEPT (matched no gate):$UNMATCHED"
echo "SWEPT: $swept_ct gate(s)   COVERED: $cov_ct   BLIND: $blind_ct   ERROR(harness): $err_ct"

if [ "$swept_ct" -eq 0 ]; then
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
