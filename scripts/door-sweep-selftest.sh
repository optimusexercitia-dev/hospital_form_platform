#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SELF-TEST for scripts/door-sweep-cases.sh.  Entry point:
#
#     SELFTEST=1 bash scripts/door-sweep-cases.sh
#
# ⛔ NOT a `npm run lint` gate. It needs a throwaway repo under $TMPDIR and, for most
# scenarios, the local stack — lint must stay runnable with the stack down. It belongs in
# Phase Gate step 1 beside the four authz arms.
#
# ── WHAT IT DOES ────────────────────────────────────────────────────────────────────
# Builds a throwaway `git init` repo under $TMPDIR holding `cmp`-verified COPIES of the
# real deriver and the two audit harnesses, drops ONE COMMITTED FIXTURE from
# scripts/fixtures/door-sweep/ into it as an untracked migration, runs the REAL script,
# and asserts the BARE exit code and stdout/stderr. ⛔ Nothing is ever written into
# supabase/migrations/, and the only database access is the read-only catalog query the
# deriver itself makes.
#
# ⛔ WHY THE COPIES ARE `cmp`-CHECKED. A stale copy passes silently and the run reads as
# evidence about code nobody ran (scripts/gate-harness/build-fake-repo.sh's precedent).
#
# ⛔ THE VACUITY GUARD. Four scenarios pin the PRE-FIX behaviour as ABSENT — a token that
# must NOT be derived, a block that must NOT be printed. A suite that only asserts what the
# fix produces goes green again the moment the fix is reverted AND the assertion is relaxed
# with it; a suite that pins the old behaviour's absence flips on the revert alone.
#
# ⚠ SKIPS ARE COUNTED AND LOUD. Most scenarios need the live catalog. With the stack down
# they SKIP, and the summary prints how many — a "PASS" over zero catalog scenarios must
# not look like a pass over all of them.
#
# ── EXIT CODES ──────────────────────────────────────────────────────────────────────
#   0  every scenario that RAN passed
#   1  at least one scenario FAILED
#   2  the harness could not run (fixtures missing, fake repo could not be built)
# ---------------------------------------------------------------------------
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
FIX="$ROOT/scripts/fixtures/door-sweep"
DERIVER="$ROOT/scripts/door-sweep-cases.sh"
AUDIT="$ROOT/supabase/tests/mutation/p0-authz-door-audit.sh"
WRITE_AUDIT="$ROOT/supabase/tests/mutation/p0-authz-writepath-audit.sh"
DB="${DOOR_SWEEP_DB:-supabase_db_azkbbhskturikxpgmafq}"

T="${TMPDIR:-/tmp}/door-sweep-selftest.$$"
mkdir -p "$T" || { echo "FATAL: cannot create $T" >&2; exit 2; }
trap 'rm -rf "$T"' EXIT

[ -d "$FIX" ] || { echo "FATAL: fixtures not found: $FIX" >&2; exit 2; }
for f in "$DERIVER" "$AUDIT" "$WRITE_AUDIT"; do
  [ -f "$f" ] || { echo "FATAL: not found: $f" >&2; exit 2; }
done

PASS=0; FAIL=0; SKIP=0
FAILED_NAMES=""; SKIPPED_NAMES=""

CATALOG=0
if command -v docker >/dev/null 2>&1 \
   && docker exec "$DB" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  CATALOG=1
fi

build_repo () {   # $1 = target dir
  local t="$1"
  rm -rf "$t"
  mkdir -p "$t/scripts" "$t/supabase/migrations" "$t/supabase/tests/mutation" || return 1
  cp "$DERIVER" "$t/scripts/door-sweep-cases.sh" || return 1
  cp "$AUDIT" "$t/supabase/tests/mutation/" || return 1
  cp "$WRITE_AUDIT" "$t/supabase/tests/mutation/" || return 1
  # ⛔ a stale copy must not be able to pass
  cmp -s "$DERIVER" "$t/scripts/door-sweep-cases.sh" || { echo "  FATAL: deriver copy differs"; return 1; }
  cmp -s "$AUDIT" "$t/supabase/tests/mutation/$(basename "$AUDIT")" || { echo "  FATAL: audit copy differs"; return 1; }
  cmp -s "$WRITE_AUDIT" "$t/supabase/tests/mutation/$(basename "$WRITE_AUDIT")" || { echo "  FATAL: writepath copy differs"; return 1; }
  ( cd "$t" && git init -q . && git config user.email s@s && git config user.name s \
      && git add -A scripts supabase && git commit -q -m base ) >/dev/null 2>&1 || return 1
  return 0
}

# run <name> <need_catalog 0|1> <expected_rc> <env assignments> -- <fixture...>
#   then assert with ok_out / no_out / ok_err / no_err against $OUT and $ERR.
# ⚠ Point OUT/ERR at real (empty) files from the start: an `assert` is evaluated even for a
#   SKIPPED scenario (command substitution runs before the function does), and grepping ""
#   printed "No such file" noise on every skip.
OUT="$T/out"; ERR="$T/err"; RC=""
: > "$OUT"; : > "$ERR"
SCEN=""
scenario () {  # $1 name, $2 need_catalog, $3 expected rc, rest: env=val ... -- fixtures...
  SCEN="$1"; local need="$2" want="$3"; shift 3
  local envs="" fixtures="" seen=0
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--" ]; then seen=1; shift; continue; fi
    if [ "$seen" = 0 ]; then envs="$envs $1"; else fixtures="$fixtures $1"; fi
    shift
  done
  if [ "$need" = 1 ] && [ "$CATALOG" = 0 ]; then
    SKIP=$((SKIP + 1)); SKIPPED_NAMES="$SKIPPED_NAMES $SCEN"
    printf 'SKIP  %-44s (no live catalog)\n' "$SCEN"
    SCEN=""; return 0
  fi
  local d="$T/repo"
  build_repo "$d" || { FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"; printf 'FAIL  %-44s (fake repo could not be built)\n' "$SCEN"; SCEN=""; return 0; }
  local fx
  for fx in $fixtures; do
    [ -f "$FIX/$fx" ] || { FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"; printf 'FAIL  %-44s (missing fixture %s)\n' "$SCEN" "$fx"; SCEN=""; return 0; }
    cp "$FIX/$fx" "$d/supabase/migrations/2099$(printf '%s' "$fx" | tr -c 'a-z0-9' '_').sql"
  done
  : > "$OUT"; : > "$ERR"
  # ⛔ SELFTEST=0 for the child, ALWAYS. The copied deriver would otherwise re-dispatch to a
  #    self-test script the fake repo does not contain and every scenario would report
  #    rc 127 — measured, the first time this file ran.
  ( cd "$d" && env SELFTEST=0 $envs bash scripts/door-sweep-cases.sh ) > "$OUT" 2> "$ERR"
  RC=$?
  if [ "$RC" != "$want" ]; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
    printf 'FAIL  %-44s expected rc %s, got rc %s\n' "$SCEN" "$want" "$RC"
    sed 's/^/        | /' "$ERR" | tail -12
    SCEN=""; return 0
  fi
  return 0
}
assert () {  # $1 = human description, $2 = 0|1 condition already evaluated by the caller
  [ -n "$SCEN" ] || return 0
  if [ "$2" = 0 ]; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
    printf 'FAIL  %-44s %s\n' "$SCEN" "$1"
    SCEN=""
  fi
}
done_ok () {
  [ -n "$SCEN" ] || return 0
  PASS=$((PASS + 1)); printf 'PASS  %-44s (rc %s)\n' "$SCEN" "$RC"; SCEN=""
}
has_out () { grep -qw -- "$1" "$OUT"; }
has_err () { grep -qF -- "$1" "$ERR"; }

echo "=== DOOR-SWEEP DERIVER SELF-TEST ==="
echo "    fixtures : $FIX"
echo "    catalog  : $([ "$CATALOG" = 1 ] && echo "REACHABLE ($DB)" || echo "NOT reachable — catalog scenarios will SKIP")"
echo

# ── 1. THE PROPERTY: a DEFINER door in the arm's domain, admitted by PRED_DOMAIN's own
#      named exception rather than by the `returns boolean` the old text filter demanded.
scenario "definer door IN domain -> CASES" 1 0 -- 01-definer-door-in-domain.sql
assert "assert_not_case_excluded not on stdout" "$(has_out assert_not_case_excluded && echo 1 || echo 0)"
done_ok

# ── 2. VACUITY PIN: the migration TEXT says `security definer`; the CATALOG says invoker.
#      The text must lose. If the catalog classification is reverted, this flips.
scenario "invoker (text lies) -> NOT a door" 1 1 -- 02-invoker-not-a-door.sql
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "expected NO DOORS AT ALL" "$(has_err 'NO DOORS AT ALL' && echo 1 || echo 0)"
assert "DOORS-NOT-SWEEPABLE block must be ABSENT" "$(has_err 'DOORS IDENTIFIED, NOT SWEEPABLE' && echo 0 || echo 1)"
done_ok

# ── 3. DISCRIMINATION for 2: a prosecdef door outside the domain IS identified.
scenario "definer trigger door -> identified, not swept" 1 1 -- 03-definer-trigger-door.sql
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "expected DOORS IDENTIFIED: 1" "$(has_err 'DOORS IDENTIFIED: 1' && echo 1 || echo 0)"
assert "expected the printed reason" "$(has_err 'returns trigger — outside PRED_DOMAIN' && echo 1 || echo 0)"
done_ok

# ── 4. ALTER FUNCTION … SECURITY DEFINER (ADR 0079 Amdt 8 ruling 1, one branch over).
scenario "alter function security definer -> CASES" 1 0 -- 04-alter-function-security-definer.sql
assert "can_read_professional_profile not on stdout" "$(has_out can_read_professional_profile && echo 1 || echo 0)"
assert "expected the ALTERED-BY block" "$(has_err "ALTERED BY 'alter function" && echo 1 || echo 0)"
done_ok

# ── 5. VACUITY PIN: `owner to postgres` must match NOTHING (449 of them in the baseline).
scenario "alter function OWNER TO -> nothing" 1 1 -- 05-alter-function-owner-to.sql
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "ALTERED-BY block must be ABSENT" "$(has_err "ALTERED BY 'alter function" && echo 0 || echo 1)"
done_ok

# ── 6. The declaration path ALONE — no `create function`, no `pg_get_functiondef`.
scenario "marker continuations, declaration only" 1 0 -- 06-marker-continuations.sql
assert "has_permission not on stdout" "$(has_out has_permission && echo 1 || echo 0)"
assert "candidate_has_permission not classified" "$(has_err candidate_has_permission && echo 1 || echo 0)"
assert "explain_permission not classified" "$(has_err explain_permission && echo 1 || echo 0)"
assert "entailed_grants not classified" "$(has_err entailed_grants && echo 1 || echo 0)"
done_ok

# ── 7. VACUITY PIN: consume-or-stop. A token in prose AFTER a bare `--` is NOT a target.
scenario "marker then prose -> prose NOT consumed" 1 0 -- 07-marker-then-prose.sql
assert "has_permission not on stdout" "$(has_out has_permission && echo 1 || echo 0)"
assert "is_active must NOT be derived" "$(has_err is_active && echo 0 || echo 1)"
done_ok

# ── 8. A malformed continuation is NAMED, and the run continues.
scenario "marker parse error -> named, rc unchanged" 1 0 -- 08-marker-parse-error.sql
assert "expected the parse-error block" "$(has_err 'PARSE ERROR' && echo 1 || echo 0)"
assert "expected the named cause" "$(has_err 'schema prefix with no function name' && echo 1 || echo 0)"
assert "has_permission still derived" "$(has_out has_permission && echo 1 || echo 0)"
done_ok

# ── 9. ⭐ THE ADR 0173 ARRAY-GATE PIN. One file builds an array; the other does not and
#      names `app.is_active(` only as a replacement literal. `is_active` must NOT be
#      derived. Revert the per-file gate and this fails without touching the assertion.
scenario "array gate is PER FILE (0173 pin)" 1 0 -- 10-array-rewrite.sql 11-marker-and-replacement-literal.sql
assert "can_manage_professional not on stdout" "$(has_out can_manage_professional && echo 1 || echo 0)"
assert "is_active must NOT be in CASES" "$(has_out is_active && echo 0 || echo 1)"
done_ok

# ── 10. Provenance and SCOPE — two increments in one tree.
scenario "two increments -> provenance per file" 1 0 -- 12-policy-increment-a.sql 13-policy-increment-b.sql
assert "expected a SCOPE: line" "$(has_err 'SCOPE:' && echo 1 || echo 0)"
assert "expected the PROVENANCE block" "$(has_err 'PROVENANCE — every DERIVED case' && echo 1 || echo 0)"
assert "forms_staff_admin_write not derived" "$(has_out forms_staff_admin_write && echo 1 || echo 0)"
assert "professional_profiles_select not derived" "$(has_out professional_profiles_select && echo 1 || echo 0)"
done_ok

# ── 11. NOT-APPLICABLE: a tree with no migration at all.
scenario "no migration in the diff -> rc 3" 0 3 --
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "expected NOT-APPLICABLE (3)" "$(has_err 'NOT-APPLICABLE (3)' && echo 1 || echo 0)"
done_ok

# ── 12. ABORT: an unusable ARM.
scenario "bad ARM -> rc 2" 0 2 ARM=sideways -- 01-definer-door-in-domain.sql
assert "expected the FATAL line" "$(has_err "ARM must be unset" && echo 1 || echo 0)"
done_ok

# ── 13. ABORT: the lifted PRED_DOMAIN keeps a variable this script cannot expand. The
#      doctored audit script is produced HERE from the real one, never committed — a
#      committed copy would drift from the domain it is supposed to mirror.
if [ -n "${SELFTEST_SKIP_DRIFT:-}" ]; then
  :
else
  sed "s/(p\.proname ~ .\$PRED_NAME_RE./(p.proname ~ '\$PRED_FUTURE_AXIS'/" "$AUDIT" > "$T/audit_drift.sh"
  if cmp -s "$AUDIT" "$T/audit_drift.sh"; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES PRED_DOMAIN-drift-fixture"
    echo "FAIL  PRED_DOMAIN drift fixture                    (the sed changed NOTHING — the domain moved; fix the selftest, do not skip it)"
  else
    scenario "PRED_DOMAIN lift drift -> rc 2" 0 2 "AUDIT_SRC=$T/audit_drift.sh" -- 01-definer-door-in-domain.sql
    assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
    assert "expected the ABORT (2) banner" "$(has_err 'ABORT (2) — PRED_DOMAIN LIFTED WITH AN UNEXPANDED VARIABLE' && echo 1 || echo 0)"
    done_ok
  fi
fi

# ── 14. VACUITY PIN for the catalog itself: with NO catalog the deriver must NOT go blind —
#      the pre-2026-09-05 TEXT heuristics stay the floor and a policy is still derived.
scenario "no catalog -> text floor still derives" 0 0 DOOR_SWEEP_DB=no_such_container_selftest -- 12-policy-increment-a.sql
assert "expected the provisional banner" "$(has_err 'NO LIVE CATALOG — PROVISIONAL DERIVATION' && echo 1 || echo 0)"
assert "the text heuristics must still be the floor" "$([ -s "$OUT" ] && echo 1 || echo 0)"
assert "forms_staff_admin_write not derived" "$(has_out forms_staff_admin_write && echo 1 || echo 0)"
done_ok

# ── 15. ⭐ THE HONEST BOUND, PINNED. The property fix is CATALOG-BASED, so with the stack
#      down `assert_not_case_excluded` is NOT derived — the text heuristics demand
#      `returns boolean` and it returns void. That is a rc 1 FINDING, and the run must SAY
#      the catalog was unreachable so nobody reads it as "this migration has no door".
#      ⛔ If this ever passes as rc 0, someone has re-typed the domain into this script.
scenario "no catalog -> the property is UNAVAILABLE, loudly" 0 1 DOOR_SWEEP_DB=no_such_container_selftest -- 01-definer-door-in-domain.sql
assert "expected the provisional banner" "$(has_err 'NO LIVE CATALOG — PROVISIONAL DERIVATION' && echo 1 || echo 0)"
assert "the FINDING must name the missing catalog" "$(has_err "'no door' has NOT been checked" && echo 1 || echo 0)"
done_ok

echo
echo "--------------------------------------------------------------------------------"
echo "SELF-TEST: PASS $PASS · FAIL $FAIL · SKIPPED $SKIP"
if [ "$SKIP" -gt 0 ]; then
  echo "⚠ $SKIP scenario(s) SKIPPED because the live catalog was not reachable:$SKIPPED_NAMES"
  echo "  ⛔ A PASS over $PASS scenario(s) with $SKIP skipped is NOT a pass over all of them."
  echo "     Start the local stack (\`supabase start\`) and re-run before recording this."
fi
[ "$FAIL" -gt 0 ] && echo "⛔ FAILED:$FAILED_NAMES"
echo "--------------------------------------------------------------------------------"
[ "$FAIL" -gt 0 ] && exit 1
exit 0
