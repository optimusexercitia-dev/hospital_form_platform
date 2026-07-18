#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14) — THE STANDING INVARIANT.
# This is the P0's permanent fix: a repeatable regression gate so door-blindness
# (an authz gate no keystone exercises — green over a live leak) cannot silently
# recur. It has two arms; run both.
#
#   ARM 1  POLICY/PREDICATE BLIND ⊆ ALLOWLIST
#     Run the two neutralization sweeps (p0-authz-door-audit.sh +
#     p0-authz-writepath-audit.sh); union their BLIND sets; assert every BLIND is
#     in the committed allowlist (authz-blind-allowlist.txt). A BLIND not on the
#     allowlist ⇒ non-zero exit = a NEW un-keystoned authz gate (the regression).
#
#   ARM 2  NEVER-CALLED-DOOR FLOOR
#     With track_functions=all, run the full pgTAP suite, then assert every
#     `authenticated`-reachable public prosecdef=t door was CALLED at least once.
#     A door with 0 calls is exercised by no test = door-blind by construction.
#     Offenders that are legitimately door-only / E2E-only are allowlisted in
#     authz-neverclled-door-allowlist.txt; anything else fails the gate.
#
# ── Modes ──────────────────────────────────────────────────────────────────────
#   bash p0-authz-invariant.sh                 # ARM 1 (full sweep, ~90 min) + ARM 2
#   ARM=policy  bash p0-authz-invariant.sh     # ARM 1 only
#   ARM=floor   bash p0-authz-invariant.sh     # ARM 2 only  (~1 min)
#   FROMFINDINGS=1 ARM=policy bash ...          # ARM 1 fast: compare the COMMITTED
#                                               # findings md to the allowlist, NO sweep
#                                               # (a light CI check; the full sweep is
#                                               # the authoritative gate the lead runs
#                                               # in the background).
#
# Exit 0 = invariant holds. Non-zero = a NEW blind / never-called door (details printed).
# Run from repo root. The heavy ARM-1 sweep dies at turn-end for a subagent; the LEAD
# runs it in the background (see docs/reviews/authz-door-audit-triage.md).
set -u

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-/c/Users/micha/AppData/Local/Temp/claude/C--Users-micha-Development-claude-hospital-form-platform/6d030efd-e072-4a80-a704-0dc4fb6c9049/scratchpad/authz-audit}"
HERE="$ROOT/supabase/tests/mutation"
ALLOWLIST="$HERE/authz-blind-allowlist.txt"
FLOOR_ALLOW="$HERE/authz-neverclled-door-allowlist.txt"
DOOR_FINDINGS="$ROOT/docs/reviews/authz-door-audit-findings.md"
WP_FINDINGS="$ROOT/docs/reviews/authz-writepath-audit-findings.md"
ARM="${ARM:-all}"
FROMFINDINGS="${FROMFINDINGS:-0}"
mkdir -p "$WORK"

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
psql_admin () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U supabase_admin -d postgres -tA -P pager=off "$@"; }

# strip comments+blanks from an allowlist file
allow_body () { grep -vE '^[[:space:]]*#' "$1" 2>/dev/null | grep -vE '^[[:space:]]*$'; }

# Extract the col-1 "gate / policy" labels from a findings md's "## BLIND" table.
blind_from_findings () {
  awk '/^## BLIND/{f=1;next} /^## /{f=0} f && /^\| / && $0 !~ /gate . policy/ && $0 !~ /^\|---/ {print}' "$1" \
    | sed -E 's/^\| *//; s/ *\|.*$//' | grep -vE '^$'
}

RC=0

# ════════════════════════════════════════════════════════════════════════════════
# ARM 1 — BLIND ⊆ ALLOWLIST
# ════════════════════════════════════════════════════════════════════════════════
run_arm_policy () {
  echo "=== ARM 1: policy/predicate BLIND ⊆ allowlist ==="
  local blinds="$WORK/invariant_blinds_union.txt"

  if [ "$FROMFINDINGS" = "1" ]; then
    echo "  mode: FROMFINDINGS (comparing COMMITTED findings md, no sweep)"
    { blind_from_findings "$DOOR_FINDINGS"; blind_from_findings "$WP_FINDINGS"; } | sort -u > "$blinds"
  else
    echo "  mode: FULL SWEEP (p0-authz-door-audit.sh + p0-authz-writepath-audit.sh) — ~90 min"
    ( cd "$ROOT" && bash "$HERE/p0-authz-door-audit.sh" )      || { echo "  *** door sweep failed"; RC=1; }
    ( cd "$ROOT" && bash "$HERE/p0-authz-writepath-audit.sh" ) || { echo "  *** writepath sweep failed"; RC=1; }
    # Both sweeps write a machine-readable BLIND tsv (col2 = gate) into $WORK.
    { awk -F'\t' 'NR>1{print $2}' "$WORK/blinds.tsv" 2>/dev/null;
      awk -F'\t' 'NR>1{print $2}' "$WORK/blinds_writepath.tsv" 2>/dev/null; } | sort -u > "$blinds"
  fi

  local n; n=$(wc -l < "$blinds" | tr -d '[:space:]')
  echo "  BLIND set size: $n"
  # Any BLIND not in the committed allowlist is a NEW un-keystoned gate.
  local offenders
  offenders=$(comm -23 "$blinds" <(allow_body "$ALLOWLIST" | sort -u))
  if [ -n "$offenders" ]; then
    echo "  *** INVARIANT VIOLATED — BLIND gates NOT in the allowlist (new door-blindness):"
    echo "$offenders" | sed 's/^/      /'
    echo "  Fix: add a mutation-proven keystone (preferred) or, if a genuine backstop,"
    echo "       add the line to $ALLOWLIST with justification."
    RC=1
  else
    echo "  OK: every BLIND is on the allowlist (no NEW un-keystoned authz gate)."
  fi
  # Stale-allowlist hygiene (non-fatal): entries no longer BLIND should be pruned.
  local stale
  stale=$(comm -13 "$blinds" <(allow_body "$ALLOWLIST" | sort -u))
  if [ -n "$stale" ]; then
    echo "  note: allowlist entries no longer BLIND (now COVERED — prune when convenient):"
    echo "$stale" | sed 's/^/      /'
  fi
}

# ════════════════════════════════════════════════════════════════════════════════
# ARM 2 — NEVER-CALLED-DOOR FLOOR
# ════════════════════════════════════════════════════════════════════════════════
run_arm_floor () {
  echo "=== ARM 2: never-called-door floor (track_functions=all + full suite) ==="
  # Track function calls on every new connection to this DB, and zero the counters.
  # (alter database applies to the `supabase test db` sessions that follow; pg_stat_reset
  #  needs superuser — supabase_admin.)
  psql_admin -c "alter database postgres set track_functions = 'all';" >/dev/null 2>&1
  psql_admin -c "select pg_stat_reset();" >/dev/null 2>&1

  echo "  running full pgTAP suite (exercises the doors keystones touch)…"
  ( cd "$ROOT" && supabase test db ) >/dev/null 2>&1

  # authenticated-reachable public SECURITY DEFINER doors with 0 recorded calls.
  local offenders
  offenders=$(psql_c -c "
    with doors as (
      select p.oid,
             p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef = true
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    select d.label
    from doors d
    left join pg_stat_user_functions s on s.funcid = d.oid
    where coalesce(s.calls, 0) = 0
    order by d.label;")

  # Reset the server setting we changed (shared-stack hygiene).
  psql_admin -c "alter database postgres reset track_functions;" >/dev/null 2>&1

  # Subtract the door-only / E2E-only floor allowlist.
  local unlisted
  unlisted=$(comm -23 <(echo "$offenders" | grep -vE '^$' | sort -u) <(allow_body "$FLOOR_ALLOW" | sort -u))
  local total; total=$(echo "$offenders" | grep -cvE '^$')
  echo "  authenticated-reachable prosecdef doors with 0 calls: $total"
  if [ -n "$unlisted" ]; then
    echo "  *** FLOOR VIOLATED — never-called doors NOT on the floor allowlist:"
    echo "$unlisted" | sed 's/^/      /'
    echo "  Fix: add a keystone that drives the door, or (if door-only/E2E-only) list it"
    echo "       in $FLOOR_ALLOW with justification."
    RC=1
  else
    echo "  OK: every never-called door is on the floor allowlist."
  fi
}

case "$ARM" in
  policy) run_arm_policy ;;
  floor)  run_arm_floor ;;
  all)    run_arm_policy; echo; run_arm_floor ;;
  *) echo "unknown ARM=$ARM (use policy|floor|all)"; exit 2 ;;
esac

echo
[ "$RC" = 0 ] && echo "=== INVARIANT HOLDS ===" || echo "=== INVARIANT VIOLATED (see above) ==="
exit $RC
