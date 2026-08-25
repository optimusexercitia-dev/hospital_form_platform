#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Keystone for the gate's EVIDENCE RETENTION — per-batch server logs and the durable
# `gate-exit` record (FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH).
#
#   bash scripts/gate-harness/retention-keystone.sh          # ~2 min
#
# WHAT IT NEEDS: bash, node, awk, and `ps`/`taskkill` on Windows. ⛔ It touches NO real port
# (PORT=39017, which nothing binds), NO Docker container and NO database — RESET=0 and every
# external command is a shim (see build-fake-repo.sh). Nothing is written inside the repo:
# the throwaway trees live under $TMPDIR.
#
# WHY IT EXISTS: a retention fix that is never observed retaining anything is the same
# vacuity as a classifier arm that only ever passes. Proving this in a real 21-batch gate run
# costs ~80 minutes and needs a quiet tree and the DB; this runs the REAL script (byte-
# compared to the repo copy) against shell doubles, which is the technique rows 3a/3b of the
# fault-injection checklist in docs/testing/e2e-prod-build-gate.md already use.
#
# ⭐ Scenario 1b re-runs the SAME assertions against a copy with the fix reverted. If it ever
# stops reporting "RED as required", the assertions have gone vacuous.
# ---------------------------------------------------------------------------
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL="$(cd "$HERE/../.." && pwd)"
WORK="${TMPDIR:-/tmp}/gate-harness-retention-$$"
mkdir -p "$WORK"
trap 'rm -rf "$WORK" 2>/dev/null' EXIT

ORIG_PATH="$PATH"
REAL_NODE_ONCE="$(command -v node)"   # ⚠ once, before any PATH mutation (see build-fake-repo)
RUN_N=0; PASSES=0; FAILED=0
T="$WORK/unset"

ok()  { printf '  ok    %s\n' "$1"; PASSES=$(( PASSES + 1 )); }
bad() { printf '  FAIL  %s\n' "$1"; FAILED=1; }
chk() { if [ "$2" = "$3" ]; then ok "$1  [$2]"; else bad "$1  got[$2] want[$3]"; fi; }
has() { if grep -q "$2" "$3" 2>/dev/null; then ok "$1"; else bad "$1 (pattern '$2' absent from $3)"; fi; }
hasnt(){ if grep -q "$2" "$3" 2>/dev/null; then bad "$1 (pattern '$2' UNEXPECTEDLY present)"; else ok "$1"; fi; }

setup() {  # $1 = mutate mode, or "" for the real script
  RUN_N=$(( RUN_N + 1 )); T="$WORK/t$RUN_N"
  bash "$HERE/build-fake-repo.sh" "$T" "$REAL"
  cmp -s "$REAL/scripts/e2e-prod-gate.sh" "$T/scripts/e2e-prod-gate.sh" \
    || { echo "FATAL: the copied gate script is not byte-identical to the repo's"; exit 2; }
  if [ -n "${1:-}" ]; then
    node "$HERE/lib/mutate.mjs" "$T/scripts/e2e-prod-gate.sh" "$1" >/dev/null \
      || { echo "FATAL: mutate.mjs '$1' failed — see its message"; exit 2; }
  fi
  export FAKE_STATE="$T/state" FAKE_BIN="$T/bin" FAKE_ROOT="$T" REAL_NODE="$REAL_NODE_ONCE"
  export PATH="$(cygpath -u "$T/bin" 2>/dev/null || echo "$T/bin"):$ORIG_PATH"
  hash -r
  local bin; bin="$(cygpath -u "$T/bin" 2>/dev/null || echo "$T/bin")"
  for c in curl docker npx node npm supabase; do
    case "$(command -v "$c")" in
      "$bin"/*) : ;;
      *) echo "FATAL: shim '$c' is NOT on PATH (resolves to $(command -v "$c")) — refusing to run against real tooling"; exit 2 ;;
    esac
  done
  echo 8 > "$T/state/exp"
  return 0
}

# ⚠ DO NOT signal on a fixed timer. The signal scenarios below used `wait for "BATCH 1" in
# the log, then sleep 3`, and on a slow spawn that lands inside `preflight` — before
# start_server has run at all — so "the server log survives the signal" failed intermittently
# for a reason that had nothing to do with the fix. Wait for the SERVER to announce itself.
wait_for_server_up() {
  local i=0
  while [ "$i" -lt 160 ]; do
    grep -q 'SERVER_INSTANCE=' "$T/logs/e2e-prod-gate/server-batch-1.log" 2>/dev/null && { sleep 1; return 0; }
    sleep 0.5; i=$(( i + 1 ))
  done
  return 1
}
gate() {  # $1 = SPECS
  ( cd "$T" && TMPDIR="$T/logs" PORT=39017 RESET=0 REBUILD=0 BATCH_TESTS=0 BATCH_SIZE=1 \
      SPECS="$1" INFRA_RETRY=1 RETRIES=0 MAX_RECOVER=0 \
      timeout 150 bash scripts/e2e-prod-gate.sh > "$T/gate.out" 2>&1; echo $? > "$T/gate.rc" )
}

# a batch whose server dies mid-run, twice, then a clean second batch
scenario_death() {
  cat > "$T/state/scenario.sh" <<'SCN'
#!/usr/bin/env bash
S="$FAKE_STATE"; k="$1"
if [ "$k" = "1" ] || [ "$k" = "2" ]; then
  touch "$S/die"
  i=0; while [ -f "$S/up" ] && [ "$i" -lt 60 ]; do sleep 0.2; i=$(( i + 1 )); done
  rm -f "$S/die"
  echo "  ok 1 t1 (1.2s)"; echo "  ok 2 t2 (0.9s)"; echo "  ok 3 t3 (1.1s)"
  n=1; while [ "$n" -le 5 ]; do
    echo "  $n) a.spec.ts:$n:5 t$n"
    echo "     Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:39017/"
    n=$(( n + 1 ))
  done
  echo ""; echo "  5 failed"; echo "  3 passed (12.0s)"
  exit 1
fi
echo "  ok 1 t1 (1.0s)"; echo ""; echo "  8 passed (9.0s)"
exit 0
SCN
}

echo "############ 1 — mid-batch death, the REAL script ############"
setup ""
scenario_death
gate "e2e/a.spec.ts e2e/b.spec.ts"
RC="$(cat "$T/gate.rc")"; L="$T/logs/e2e-prod-gate"
chk "gate exit code" "$RC" "5"
[ -f "$L/server-batch-1.log" ]       && ok "server-batch-1.log exists (attempt 1)"        || bad "server-batch-1.log MISSING"
[ -f "$L/server-batch-1-rerun.log" ] && ok "server-batch-1-rerun.log exists (INFRA retry)" || bad "server-batch-1-rerun.log MISSING"
[ -f "$L/server-batch-2.log" ]       && ok "server-batch-2.log exists (separate file)"     || bad "server-batch-2.log MISSING"
[ -f "$L/server.log" ] && bad "the old fixed server.log was written" || ok "no fixed server.log any more"
has  "attempt 1 retained the DEATH marker"              "FATAL ERROR: Reached heap limit" "$L/server-batch-1.log"
has  "attempt 1 kept its OWN instance (not clobbered)"  "DEATH_MARKER_INSTANCE=1"         "$L/server-batch-1.log"
has  "the rerun retained its own death, instance 2"     "DEATH_MARKER_INSTANCE=2"         "$L/server-batch-1-rerun.log"
hasnt "batch 2 did not overwrite batch 1's log"         "SERVER_INSTANCE=3"               "$L/server-batch-1.log"
has  "batch 2 has its own live server log"              "SERVER_INSTANCE=3"               "$L/server-batch-2.log"
has  "the gate SURFACED the log on mid-batch death"     "server log RETAINED at"          "$T/gate.out"
has  "the death line reached the run output"            "\[srv\] FATAL ERROR: Reached heap limit" "$T/gate.out"
has  "the classifier still saw the death"               "server_dead=1"                   "$T/gate.out"
[ -f "$L/gate-exit" ] && ok "gate-exit written by the SCRIPT" || bad "gate-exit MISSING"
chk "gate-exit matches the process exit status" "$(sed -n 's/^GATE_EXIT=//p' "$L/gate-exit")" "$RC"
has  "gate-exit carries a verdict, not just a number" "^verdict=GATE RED (INFRA)" "$L/gate-exit"

echo
echo "############ 1b — the SAME assertions with the fix REVERTED ############"
echo "(each must RED, or the assertions above prove nothing)"
setup "pre-retention"
scenario_death
gate "e2e/a.spec.ts e2e/b.spec.ts"
L="$T/logs/e2e-prod-gate"; REDS=0
[ -f "$L/server-batch-1.log" ] || { echo "  RED as required: no per-batch server log"; REDS=$(( REDS + 1 )); }
grep -q "server log RETAINED at" "$T/gate.out" || { echo "  RED as required: mid-batch death NOT surfaced"; REDS=$(( REDS + 1 )); }
if [ -f "$L/server.log" ] && ! grep -q "DEATH_MARKER_INSTANCE=1" "$L/server.log"; then
  echo "  RED as required: the fixed server.log was TRUNCATED — batch 1's death evidence is gone"; REDS=$(( REDS + 1 ))
fi
[ -s "$L/gate-exit" ] || { echo "  RED as required: no usable gate-exit"; REDS=$(( REDS + 1 )); }
chk "the pre-fix script reds >=3 retention assertions" "$( [ "$REDS" -ge 3 ] && echo yes || echo "no($REDS)" )" "yes"

echo
echo "############ 2 — clean run: gate-exit on the happy path ############"
setup ""
printf '#!/usr/bin/env bash\necho "  8 passed (3.0s)"\nexit 0\n' > "$T/state/scenario.sh"
gate "e2e/a.spec.ts"
L="$T/logs/e2e-prod-gate"
chk "clean run exits 0"      "$(cat "$T/gate.rc")" "0"
chk "gate-exit records 0"    "$(sed -n 's/^GATE_EXIT=//p' "$L/gate-exit")" "0"
has "verdict names GATE GREEN" "^verdict=GATE GREEN" "$L/gate-exit"
has "the nonce arm verified the staged tree" "serving the tree this run staged" "$T/gate.out"

echo
echo "############ 3a — SIGTERM to the GATE ITSELF: does the trap FIRE? ############"
setup ""
printf '#!/usr/bin/env bash\nsleep 14\necho "  8 passed (14.0s)"\nexit 0\n' > "$T/state/scenario.sh"
# ⚠ background the gate DIRECTLY. Signalling a wrapper `( … ) &` sends the signal to the
# wrapper; the gate is orphaned and never sees it. Getting that wrong once produced a false
# "the trap did not fire".
KEEP="$PWD"; cd "$T"
TMPDIR="$T/logs" PORT=39017 RESET=0 REBUILD=0 BATCH_TESTS=0 BATCH_SIZE=1 \
  SPECS="e2e/a.spec.ts" INFRA_RETRY=1 RETRIES=0 MAX_RECOVER=0 \
  bash scripts/e2e-prod-gate.sh > "$T/gate.out" 2>&1 &
GPID=$!
cd "$KEEP"
wait_for_server_up || bad "3a: the batch server never came up, so the signal test is vacuous"
kill -TERM "$GPID" 2>/dev/null; wait "$GPID" 2>/dev/null
L="$T/logs/e2e-prod-gate"
chk "SIGTERM to the gate records GATE_EXIT=143" "$(sed -n 's/^GATE_EXIT=//p' "$L/gate-exit")" "143"
has "and says WHY, so 143 is not a bare number" "^verdict=SIGTERM" "$L/gate-exit"
[ -f "$L/server-batch-1.log" ] && ok "the in-flight batch's server log survives the signal" || bad "server log lost on SIGTERM"

echo
echo "############ 3b — SIGTERM to a WRAPPER only (the case actually observed) ############"
setup ""
printf '#!/usr/bin/env bash\nsleep 14\necho "  8 passed (14.0s)"\nexit 0\n' > "$T/state/scenario.sh"
( cd "$T" && TMPDIR="$T/logs" PORT=39017 RESET=0 REBUILD=0 BATCH_TESTS=0 BATCH_SIZE=1 \
    SPECS="e2e/a.spec.ts" INFRA_RETRY=1 RETRIES=0 MAX_RECOVER=0 \
    bash scripts/e2e-prod-gate.sh > "$T/gate.out" 2>&1 ) &
WPID=$!
wait_for_server_up || bad "3b: the batch server never came up, so the signal test is vacuous"
kill -TERM "$WPID" 2>/dev/null; wait "$WPID" 2>/dev/null
L="$T/logs/e2e-prod-gate"
chk "while orphaned + in flight the record reads RUNNING, never absent" \
    "$(sed -n 's/^GATE_EXIT=//p' "$L/gate-exit")" "RUNNING"
i=0; while [ "$i" -lt 90 ] && [ "$(sed -n 's/^GATE_EXIT=//p' "$L/gate-exit" 2>/dev/null)" = "RUNNING" ]; do sleep 1; i=$(( i + 1 )); done
chk "the ORPHANED gate still wrote its own verdict" "$(sed -n 's/^GATE_EXIT=//p' "$L/gate-exit")" "0"

echo
echo "############ 4 — SIGKILL: absence must never happen ############"
setup ""
printf '#!/usr/bin/env bash\nsleep 14\necho "  8 passed (14.0s)"\nexit 0\n' > "$T/state/scenario.sh"
( cd "$T" && TMPDIR="$T/logs" PORT=39017 RESET=0 REBUILD=0 BATCH_TESTS=0 BATCH_SIZE=1 \
    SPECS="e2e/a.spec.ts" INFRA_RETRY=1 RETRIES=0 MAX_RECOVER=0 \
    bash scripts/e2e-prod-gate.sh > "$T/gate.out" 2>&1 ) &
KPID=$!
wait_for_server_up || bad "4: the batch server never came up, so the signal test is vacuous"
kill -9 "$KPID" 2>/dev/null; wait "$KPID" 2>/dev/null; sleep 1
L="$T/logs/e2e-prod-gate"
GE="$(sed -n 's/^GATE_EXIT=//p' "$L/gate-exit" 2>/dev/null)"
[ -n "$GE" ] && ok "after SIGKILL a gate-exit still exists: GATE_EXIT=$GE" || bad "after SIGKILL there is NO gate-exit"
[ -f "$L/server-batch-1.log" ] && ok "after SIGKILL the batch-1 server log survives" || bad "no server log after SIGKILL"

echo
echo "=================================================="
echo "retention keystone: passes=$PASSES failed=$FAILED"
[ "$FAILED" = "0" ] && { echo "RETENTION KEYSTONE: OK"; exit 0; }
echo "RETENTION KEYSTONE: FAILED"; exit 1
