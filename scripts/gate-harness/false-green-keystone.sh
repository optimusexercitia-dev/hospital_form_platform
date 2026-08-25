#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Keystone for the two FALSE-GREEN mechanisms found in the gate on 2026-08-25 and fixed the
# same day. Each is reproduced, and each fix is shown to be the thing that closes it.
#
#   bash scripts/gate-harness/false-green-keystone.sh          # ~3 min
#
# WHAT IT NEEDS: bash, node, awk. ⛔ It touches NO real port (PORT=39017, which nothing
# binds), NO Docker container and NO database — RESET=0 and every external command is a shim
# (see build-fake-repo.sh). Nothing is written inside the repo; throwaway trees live in
# $TMPDIR.
#
# ⭐ A reproduction of a KNOWN false green is worth more than the fix, because it is what
# catches the fix being undone. Both vectors went GATE GREEN before the fix.
#
#   VECTOR A — `start_server` probed `curl /login` BEFORE `kill -0 "$SERVER_PID"`. A spawned
#   server that died of EADDRINUSE was masked by whatever else answered the port, and since
#   the INFRA classifier only evaluates `srv_dead` when `f > 0`, a fully-passing batch read
#   GREEN with `server_dead=1` printed zero times — against a foreign server or a stale build.
#
#   VECTOR B — `expected_tests` had no fallback, so a failed `--list` left `exp=0`, which
#   skips the `count()` reconciliation AND adds 0 to TOTAL_EXPECTED. A batch holding 60 tests
#   ran 3, exited 0, and the run printed `accounted for 3 of 0` and GATE GREEN.
#
# EACH VECTOR IS PINNED INDEPENDENTLY. For each: the real script must be RED for that
# vector's own reason; reverting THAT fix must make it GREEN again (the differential); and
# reverting the OTHER fix must leave it RED for the same reason (independence).
# ---------------------------------------------------------------------------
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL="$(cd "$HERE/../.." && pwd)"
WORK="${TMPDIR:-/tmp}/gate-harness-falsegreen-$$"
mkdir -p "$WORK"
trap 'rm -rf "$WORK" 2>/dev/null' EXIT

ORIG_PATH="$PATH"
REAL_NODE_ONCE="$(command -v node)"   # ⚠ once, before any PATH mutation
RUN_N=0; PASSES=0; FAILED=0
T="$WORK/unset"

ok()  { printf '    ok    %s\n' "$1"; PASSES=$(( PASSES + 1 )); }
bad() { printf '    FAIL  %s\n' "$1"; FAILED=1; }

setup() {  # $1 = mutate mode or ""
  RUN_N=$(( RUN_N + 1 )); T="$WORK/t$RUN_N"
  bash "$HERE/build-fake-repo.sh" "$T" "$REAL"
  cmp -s "$REAL/scripts/e2e-prod-gate.sh" "$T/scripts/e2e-prod-gate.sh" \
    || { echo "FATAL: the copied gate script is not byte-identical to the repo's"; exit 2; }
  if [ -n "${1:-}" ]; then
    node "$HERE/lib/mutate.mjs" "$T/scripts/e2e-prod-gate.sh" "$1" >/dev/null \
      || { echo "FATAL: mutate.mjs '$1' failed"; exit 2; }
  fi
  export FAKE_STATE="$T/state" FAKE_BIN="$T/bin" FAKE_ROOT="$T" REAL_NODE="$REAL_NODE_ONCE"
  export PATH="$(cygpath -u "$T/bin" 2>/dev/null || echo "$T/bin"):$ORIG_PATH"
  hash -r
  local bin; bin="$(cygpath -u "$T/bin" 2>/dev/null || echo "$T/bin")"
  for c in curl docker npx node npm supabase; do
    case "$(command -v "$c")" in
      "$bin"/*) : ;;
      *) echo "FATAL: shim '$c' is NOT on PATH — refusing to run against real tooling"; exit 2 ;;
    esac
  done
  echo 8 > "$T/state/exp"
  printf '#!/usr/bin/env bash\necho "  8 passed (3.0s)"\nexit 0\n' > "$T/state/scenario.sh"
  unset SRV_MODE CURL_LOGIN CURL_NONCE LIST_MODE
  return 0
}

gate() {
  ( cd "$T" && TMPDIR="$T/logs" PORT=39017 RESET=0 REBUILD=0 BATCH_TESTS=70 \
      SPECS="e2e/a.spec.ts" INFRA_RETRY=1 RETRIES=0 MAX_RECOVER=0 \
      timeout 150 bash scripts/e2e-prod-gate.sh > "$T/gate.out" 2>&1; echo $? > "$T/gate.rc" )
}

# expect_red <label> <pattern-that-must-appear>
expect_red() {
  local rc; rc="$(cat "$T/gate.rc")"
  if [ "$rc" = "0" ] || grep -q '^GATE GREEN' "$T/gate.out"; then
    bad "$1 — the gate went GREEN (rc=$rc); the vector is OPEN"
    return
  fi
  if grep -qE "$2" "$T/gate.out"; then ok "$1 — RED (rc=$rc), signal present"
  else bad "$1 — RED (rc=$rc) but for the WRONG reason: '$2' absent"; fi
}
# expect_green_because <label> <pattern that must appear>
# A bare "it went green" is not enough for an INCONCLUSIVE arm: green is also what you get if
# the arm never ran at all. The pattern pins WHY.
expect_green_because() {
  local rc; rc="$(cat "$T/gate.rc")"
  if [ "$rc" != "0" ] || ! grep -q '^GATE GREEN' "$T/gate.out"; then
    bad "$1 - expected GREEN (the arm must be INCONCLUSIVE, not a mismatch), got rc=$rc"
    grep -E '!!|identity' "$T/gate.out" | head -3 | sed 's/^/          /'
    return
  fi
  if grep -qE "$2" "$T/gate.out"; then ok "$1 - GREEN and the arm said INCONCLUSIVE"
  else bad "$1 - GREEN but '$2' never appeared; it may be green because the arm never ran"; fi
}
expect_green() {  # used only on a mutant, to prove the fix is load-bearing
  local rc; rc="$(cat "$T/gate.rc")"
  if [ "$rc" = "0" ] && grep -q '^GATE GREEN' "$T/gate.out"; then
    ok "$1 — GREEN, so the reverted fix is what closes this vector"
  else
    bad "$1 — expected GREEN with the fix reverted, got rc=$rc. The reproduction may be closed by something OTHER than the fix, which makes the differential meaningless."
  fi
}

# ---- vector A, case 1: our server dies; a foreign listener answers -------------
# `after-server-gone` makes this deterministic in BOTH directions — see the note on
# CURL_LOGIN in build-fake-repo.sh. CURL_NONCE=none so the ONLY thing that can catch this is
# fix A's liveness half; A2 below isolates the nonce half.
scen_a1() { export SRV_MODE=die-now CURL_LOGIN=after-server-gone CURL_NONCE=none; }
# ---- vector A, case 2: our server lives, but the port serves a DIFFERENT build --
scen_a2() { export SRV_MODE=alive CURL_LOGIN=always CURL_NONCE=wrong; }
# ---- vector A, cases 3-5: the port answers with something that is NOT a nonce ----
# ⛔ THE REGRESSION TEST. A real build returned HTTP 307 + `/login?redirect=...` for the nonce
# path (the ADR-0007 auth gate), and the arm called that "a DIFFERENT nonce" and hard-failed a
# healthy server. "I did not receive a nonce" and "I received one and it differs" are different
# facts; only the second may conclude. These three must all be INCONCLUSIVE -> GREEN.
scen_a3() { export SRV_MODE=alive CURL_LOGIN=always CURL_NONCE=redirect; }
scen_a4() { export SRV_MODE=alive CURL_LOGIN=always CURL_NONCE=html; }
scen_a5() { export SRV_MODE=alive CURL_LOGIN=always CURL_NONCE=none; }
# ---- vector B: `--list` fails; only 3 of the batch's tests run, exit 0 ----------
scen_b() {
  export LIST_MODE=fail
  printf '#!/usr/bin/env bash\necho "  ok 1 t1 (1.0s)"\necho ""\necho "  3 passed (3.0s)"\nexit 0\n' > "$T/state/scenario.sh"
}

echo "############ VECTOR A — foreign / stale listener ############"
echo "  A1: spawned server dies (EADDRINUSE), something else answers the port"
setup "";     scen_a1; gate; expect_red   "A1 real script"        "GONE before it ever served|is DEAD — something else is serving"
setup "no-a"; scen_a1; gate; expect_green  "A1 with fix A reverted"
setup "no-b"; scen_a1; gate; expect_red   "A1 with fix B reverted (independence)" "GONE before it ever served|is DEAD — something else is serving"
echo "  A2: our server lives, but :PORT serves a NONCE-SHAPED body from a different tree"
setup "";     scen_a2; gate; expect_red   "A2 real script"        "served a nonce from a DIFFERENT staged tree"
setup "no-a"; scen_a2; gate; expect_green  "A2 with fix A reverted"

echo "  A3-A5: the port answers with something that is NOT a nonce -> INCONCLUSIVE, never a mismatch"
setup ""; scen_a3; gate; expect_green_because "A3 login redirect (HTTP 307) - the REAL misfire" "build-nonce INCONCLUSIVE .* HTTP 307"
setup ""; scen_a4; gate; expect_green_because "A4 HTML 404 page"                                "build-nonce INCONCLUSIVE .* HTTP 404"
setup ""; scen_a5; gate; expect_green_because "A5 empty body"                                   "build-nonce INCONCLUSIVE"
echo "  and the discrimination is real in BOTH directions, not a blanket downgrade:"
setup ""; scen_a3; gate
if grep -q "served a nonce from a DIFFERENT staged tree" "$T/gate.out"; then
  bad "A3 still reported a MISMATCH for a non-nonce body"
else ok "A3 never reported a mismatch for a non-nonce body"; fi
setup ""; scen_a2; gate
if grep -q "build-nonce INCONCLUSIVE" "$T/gate.out"; then
  bad "A2 downgraded a genuine nonce mismatch to INCONCLUSIVE - the fix silenced the measured case too"
else ok "A2 still hard-fails a genuine nonce mismatch (not blanket-downgraded)"; fi

echo
echo "############ VECTOR B — failed --list disables coverage reconciliation ############"
setup "";     scen_b;  gate; expect_red   "B real script"         "list-failed|collected size is UNKNOWN"
setup "no-b"; scen_b;  gate; expect_green  "B with fix B reverted"
setup "no-a"; scen_b;  gate; expect_red   "B with fix A reverted (independence)" "list-failed|collected size is UNKNOWN"

echo
echo "  --- B, real script: the announcement must be LOUD, not just a red flag ---"
setup ""; scen_b; gate
for pat in "collected size is UNKNOWN" "a GUESS" "CONTAINS A GUESS" "list-failed"; do
  if grep -q "$pat" "$T/gate.out"; then ok "run output says: '$pat'"; else bad "run output never says '$pat'"; fi
done
if grep -q 'accounted for 3 of 0' "$T/gate.out"; then
  bad "the old lying coverage line 'accounted for 3 of 0' is still printed"
else ok "no 'accounted for N of 0' line any more"; fi

echo
echo "=================================================="
echo "false-green keystone: passes=$PASSES failed=$FAILED"
[ "$FAILED" = "0" ] && { echo "FALSE-GREEN KEYSTONE: OK"; exit 0; }
echo "FALSE-GREEN KEYSTONE: FAILED"; exit 1
