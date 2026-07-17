#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# E2E prod-standalone gate WITH per-batch server restart.
#
# WHY: running the whole suite against ONE long-lived Next standalone server on
# Windows collapses partway through (a cascade of net::ERR_CONNECTION_REFUSED) as
# that server accumulates resources over a 20+ min run — the "monolith collapse"
# (PROGRESS.md BUG-F3E2E-002; memory e2e-prod-build-flaky-baseline). This runner
# splits the suite into BATCHES and starts a FRESH server (and, by default, a fresh
# seeded DB) for each batch, so no single server runs long enough to collapse and no
# cross-spec seed contamination accumulates.
#
# It drives the documented recipe (docs/testing/e2e-prod-build-gate.md): build the
# standalone once, then per batch pre-start `node .next/standalone/server.js` on :3000
# and let Playwright's `reuseExistingServer` (CI unset) reuse it instead of `next dev`.
#
# USAGE (from repo root; needs bash — Git Bash on Windows):
#   bash scripts/e2e-prod-gate.sh                # or: npm run e2e:prod
#   BATCH_SIZE=4 bash scripts/e2e-prod-gate.sh   # smaller batches (more restarts)
#   RESET=0     bash scripts/e2e-prod-gate.sh    # server-restart ONLY, keep DB (faster; contamination may show)
#   REBUILD=1   bash scripts/e2e-prod-gate.sh    # force a fresh `next build`
#   RETRIES=0   bash scripts/e2e-prod-gate.sh    # no retries (stricter signal)
#   SPECS="e2e/phase8-dashboard.spec.ts e2e/phi-remediation.spec.ts" bash scripts/e2e-prod-gate.sh
#
# PREREQS: local Supabase up + seeded (`supabase status`); `.env.local` -> local
# Supabase. Prod deploys on Linux/Docker where this collapse may not occur; this gate
# is primarily for the LOCAL Windows prod-standalone run.
# ---------------------------------------------------------------------------
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT" || exit 99

# --- config (env-overridable) ---
BATCH_SIZE="${BATCH_SIZE:-6}"   # spec files per fresh server
RESET="${RESET:-1}"             # 1 = `supabase db reset --local` before each batch (fresh seed)
REBUILD="${REBUILD:-auto}"      # auto | 1 | 0  (auto = build only if app source drifted)
RETRIES="${RETRIES:-1}"         # playwright --retries per batch (absorbs known infra flakes)
PORT="${PORT:-3000}"
AUTH_HEALTH="${AUTH_HEALTH:-http://127.0.0.1:54321/auth/v1/health}"
GATE_LOGDIR="${TMPDIR:-/tmp}/e2e-prod-gate"
mkdir -p "$GATE_LOGDIR"
LOG_TS() { date '+%H:%M:%S'; }

case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) IS_WIN=1 ;; *) IS_WIN=0 ;; esac
free_port() {
  if [ "$IS_WIN" = "1" ]; then
    for p in $(netstat -ano 2>/dev/null | grep ":$PORT " | awk '{print $NF}' | sort -u); do
      taskkill //PID "$p" //F >/dev/null 2>&1 || true
    done
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  fi
}
SERVER_PID=""
stop_server() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true; free_port; SERVER_PID=""; }
trap 'stop_server' EXIT

[ -f .env.local ] || { echo "FATAL: .env.local not found"; exit 1; }

# --- verify the installed toolchain matches the lockfile (BUG-PROD-ACTIONS, authz-handoff.md §7.16:
#     node_modules/next silently drifted to a stale version while package.json/lockfile were correct,
#     and the standalone build faithfully baked in the stale one) ---
declared_next="$(node -p "require('./package.json').dependencies.next" 2>/dev/null)"
installed_next="$(node -p "require('./node_modules/next/package.json').version" 2>/dev/null)"
if [ -z "$installed_next" ] || [ "$installed_next" != "$declared_next" ]; then
  echo "FATAL: node_modules/next ($installed_next) != package.json's declared next ($declared_next)."
  echo "       Toolchain drift — run \`npm ci\` before gating."
  exit 3
fi

# --- build/stage standalone ONCE (server restarts reuse it; only the running server accumulates) ---
need_build=0
case "$REBUILD" in
  1) need_build=1 ;;
  0) need_build=0 ;;
  *) if [ ! -f .next/standalone/server.js ]; then need_build=1
     else
       drift="$(find src supabase next.config.ts next.config.mjs next.config.js package.json package-lock.json 2>/dev/null -newer .next/standalone/server.js -type f | head -1)"
       [ -n "$drift" ] && need_build=1
     fi ;;
esac
if [ "$need_build" = "1" ]; then
  echo "[$(LOG_TS)] building standalone (next build)…"
  npm run build || { echo "FATAL: next build failed"; exit 2; }
else
  echo "[$(LOG_TS)] reusing existing standalone build"
fi
[ -f .next/standalone/server.js ] || { echo "FATAL: no standalone/server.js"; exit 2; }
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public

# --- discover specs + split into batches ---
if [ -n "${SPECS:-}" ]; then read -r -a ALL_SPECS <<< "$SPECS"; else ALL_SPECS=(e2e/*.spec.ts); fi
N=${#ALL_SPECS[@]}
[ "$N" -gt 0 ] || { echo "FATAL: no specs found"; exit 1; }
echo "[$(LOG_TS)] $N spec files · batch size $BATCH_SIZE · reset=$RESET · retries=$RETRIES"

set -a; . ./.env.local; set +a
unset CI

wait_gotrue() {
  for _ in $(seq 1 30); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$AUTH_HEALTH" 2>/dev/null || echo 000)" = "200" ] && return 0
    sleep 2
  done
  return 1
}
start_server() {
  free_port
  PORT="$PORT" HOSTNAME=0.0.0.0 node .next/standalone/server.js > "$GATE_LOGDIR/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 45); do
    curl -sf -o /dev/null "http://localhost:$PORT/login" && return 0
    kill -0 "$SERVER_PID" 2>/dev/null || return 1
    sleep 2
  done
  return 1
}
# Parse a Playwright list-reporter summary count ("  N passed", "  N failed",
# "  N flaky") from the WHOLE batch log ($1 = log path, $2 = status word).
# Anchored to a line that is <indent><digits> <word>: the summary footer matches,
# but per-test lines ("  ✓  11 [chromium] …"), failure headers ("  1) …") and error
# text never do. A prior version parsed `tail -5`, which dropped the "N failed"
# header whenever flaky entries printed after it → failed=0 → FALSE GATE GREEN.
num() { grep -oE "^[[:space:]]*[0-9]+ $2([[:space:]]|\$)" "$1" | grep -oE '[0-9]+' | tail -1; }

TOTAL_PASS=0 TOTAL_FAIL=0 TOTAL_FLAKY=0 BATCH_NO=0 RED_BATCHES=""
i=0
while [ "$i" -lt "$N" ]; do
  BATCH=( "${ALL_SPECS[@]:$i:$BATCH_SIZE}" ); i=$(( i + BATCH_SIZE )); BATCH_NO=$(( BATCH_NO + 1 ))
  echo "=================================================================="
  echo "[$(LOG_TS)] BATCH $BATCH_NO (fresh server$( [ "$RESET" = 1 ] && echo ' + fresh DB' )): ${BATCH[*]##*/}"
  echo "=================================================================="
  if [ "$RESET" = "1" ]; then
    supabase db reset --local >/dev/null 2>&1 || { echo "reset FAILED"; RED_BATCHES="$RED_BATCHES b$BATCH_NO(reset)"; continue; }
    wait_gotrue || echo "[$(LOG_TS)] WARN: GoTrue /health not confirmed; proceeding"
  fi
  if ! start_server; then
    echo "[$(LOG_TS)] server FAILED to start"; tail -20 "$GATE_LOGDIR/server.log"
    RED_BATCHES="$RED_BATCHES b$BATCH_NO(server)"; stop_server; continue
  fi
  sleep 4
  BLOG="$GATE_LOGDIR/batch-$BATCH_NO.log"
  npx playwright test "${BATCH[@]}" --project=chromium --workers=1 --retries="$RETRIES" --reporter=list 2>&1 | tee "$BLOG" | tail -30
  p=$(num "$BLOG" passed); f=$(num "$BLOG" failed); fl=$(num "$BLOG" flaky)
  p=${p:-0}; f=${f:-0}; fl=${fl:-0}
  TOTAL_PASS=$(( TOTAL_PASS + p )); TOTAL_FAIL=$(( TOTAL_FAIL + f )); TOTAL_FLAKY=$(( TOTAL_FLAKY + fl ))
  [ "$f" != "0" ] && RED_BATCHES="$RED_BATCHES b$BATCH_NO"
  echo "[$(LOG_TS)] batch $BATCH_NO -> ${p} passed, ${f} failed, ${fl} flaky  (log: $BLOG)"
  stop_server; sleep 1
done

echo "=================================================================="
echo "[$(LOG_TS)] GATE SUMMARY: ${TOTAL_PASS} passed · ${TOTAL_FAIL} failed · ${TOTAL_FLAKY} flaky · ${BATCH_NO} batches"
[ -n "$RED_BATCHES" ] && echo "  batches with failures:$RED_BATCHES  (logs in $GATE_LOGDIR)"
echo "=================================================================="
if [ "$TOTAL_FAIL" = "0" ] && [ -z "$RED_BATCHES" ]; then echo "GATE GREEN"; exit 0; fi
echo "GATE RED — triage the failing batch logs against the flaky baseline (memory e2e-prod-build-flaky-baseline) before calling regression."
exit 1
