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
#   MAX_RECOVER=0 bash scripts/e2e-prod-gate.sh  # abort on a bad stack instead of self-healing
#   PROBE_EMAIL=... PROBE_PASS=...               # seed persona used by the auth preflight
#
# EXIT CODES: 0 green · 1 red (real failures) · 2 build · 3 toolchain drift ·
#             4 stack unrecoverable (preflight) · 99 cd failed.
# Exit 4 is NOT a test result — nothing was proven; fix the stack and re-run.
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
PROBE_EMAIL="${PROBE_EMAIL:-chefe.ccih@test.local}"  # seed persona for the auth probe
PROBE_PASS="${PROBE_PASS:-Test1234!}"
MAX_RECOVER="${MAX_RECOVER:-1}" # stack-recovery attempts per checkpoint before aborting
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

set -a; . ./.env.local; set +a
unset CI

# --- stack preflight ---------------------------------------------------------
# The local stack LIES about its own health. Measured live: EVERY container reported
# "healthy" while `supabase_analytics` sat at RestartCount=47, and /auth/v1/health
# returns 200 while password grants 502 (memory: supabase-vector-crashloop-502).
# ~320 of ~370 E2E failures across six gates trace to this, vs 3 real regressions.
#
# ATTRIBUTION FIX: our own notes blamed `supabase_vector`. Live, vector's RestartCount
# was 0 while analytics (Logflare — vector's log sink) was at 47. Vector is the victim,
# not the cause. A detector written against vector would never fire.
#
# So detect on the two signals that actually move:
#   (a) a REAL password grant. Port 54321 IS Kong, so this one probe covers Kong DNS
#       staleness, GoTrue death and gateway 502s together — /health covers none of them.
#   (b) analytics RestartCount delta — a leading indicator of a MID-RUN collapse.
REF="$(docker ps -a --filter 'name=supabase_db_' --format '{{.Names}}' 2>/dev/null | head -1 | sed 's/^supabase_db_//')"
[ -n "$REF" ] || { echo "FATAL: no supabase_db_* container — is the local stack up?"; exit 4; }

dins()     { docker inspect -f "$2" "supabase_$1_$REF" 2>/dev/null; }
restarts() { local n; n="$(dins "$1" '{{.RestartCount}}')"; echo "${n:-0}"; }
started()  { dins "$1" '{{.State.StartedAt}}'; }
BASE_ANALYTICS="$(restarts analytics)"

# NOTE: build the payload in a variable and compare in a variable. Do NOT inline
# `-d "{\"email\":…}"` inside `[ "$(curl …)" = 200 ]`: nesting escaped double quotes
# inside "$( … )" lets the outer quote context close early, exposing the JSON braces
# to BRACE EXPANSION — curl then fires twice (once per comma-separated half) and `[`
# sees `400 400 = 200` → "too many arguments" → token_ok always false → every run
# aborts as "unrecoverable". Caught by the healthy-stack fault-injection test.
token_ok() {
  local payload code
  payload="$(printf '{"email":"%s","password":"%s"}' "$PROBE_EMAIL" "$PROBE_PASS")"
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST \
       "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password" \
       -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
       -H 'Content-Type: application/json' \
       -d "$payload" 2>/dev/null)"
  [ "$code" = "200" ]
}
reload_pgrst() {  # PostgREST schema cache goes stale after a reset -> PGRST205/PGRST202
  docker exec -i "supabase_db_$REF" psql -U postgres -d postgres \
    -c "NOTIFY pgrst, 'reload schema';" >/dev/null 2>&1 || true
}
# Cheap fix first. If kong started BEFORE auth it may hold auth's dead container IP.
# This is only a CLASSIFIER for an already-failing probe, NEVER a detector on its own:
# kong legitimately outlives auth after every `db reset` (measured — kong 4 days vs auth
# 21 min on a stack whose token grant was a clean 200), so firing on it alone cries wolf.
recover_stack() {
  if [[ "$(started kong)" < "$(started auth)" ]]; then
    echo "[$(LOG_TS)]   kong older than auth — restarting kong first (cheap)"
    docker restart "supabase_kong_$REF" >/dev/null 2>&1 || true
    sleep 5
    token_ok && return 0
  fi
  echo "[$(LOG_TS)]   cycling the whole stack (supabase stop/start + reset)"
  npx supabase stop >/dev/null 2>&1 || true
  npx supabase start >/dev/null 2>&1 || true
  supabase db reset --local >/dev/null 2>&1 || true
  BASE_ANALYTICS="$(restarts analytics)"
  reload_pgrst
  token_ok
}

# preflight <label> — 0 = stack usable, 1 = give up (caller aborts the gate)
preflight() {
  local label="$1" i looping
  reload_pgrst
  for i in $(seq 1 15); do token_ok && break; sleep 2; done
  looping=$(( $(restarts analytics) - BASE_ANALYTICS ))

  if token_ok && [ "$looping" -le 2 ]; then return 0; fi
  if token_ok; then
    echo "[$(LOG_TS)] PREFLIGHT($label): analytics restarted ${looping}x — recovering BEFORE it collapses mid-run"
  else
    # Report BOTH signals: in the documented crash-loop, /health says 200 while grants
    # 502 — printing the pair makes the gap self-evident in the log during triage.
    echo "[$(LOG_TS)] PREFLIGHT($label): auth token grant FAILING; /health reports $(curl -s -o /dev/null -w '%{http_code}' -m 5 "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health" 2>/dev/null) — this is why the gate does not trust /health"
  fi

  # Arithmetic loop, NOT `seq 1 $MAX_RECOVER`: BSD/macOS seq counts DOWN when first >
  # last, so `seq 1 0` emits "1 0" and MAX_RECOVER=0 would run recovery TWICE — the
  # opposite of "don't touch my stack". (GNU seq emits nothing; this is macOS-only.)
  local n=0
  while [ "$n" -lt "$MAX_RECOVER" ]; do
    n=$(( n + 1 ))
    recover_stack && { echo "[$(LOG_TS)] PREFLIGHT($label): recovered"; return 0; }
  done
  echo "[$(LOG_TS)] PREFLIGHT($label): UNRECOVERABLE"
  return 1
}

preflight "gate start" || { echo "GATE ABORTED — stack unrecoverable before batch 1"; exit 4; }
# SELFTEST=1 answers "is the stack fit for a gate run?" in seconds instead of 40 minutes,
# and is how the preflight arms are fault-injection tested (docs/testing/e2e-prod-build-gate.md).
[ -n "${SELFTEST:-}" ] && { echo "SELFTEST: stack is fit for a gate run"; exit 0; }

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

# Expected test count for a batch, from `--list` (collection only, no browser).
# Without this the gate cannot tell "everything passed" from "nothing ran".
expected_tests() {
  npx playwright test "$@" --project=chromium --list 2>/dev/null \
    | grep -oE '^Total: [0-9]+ test' | grep -oE '[0-9]+' | tail -1
}


TOTAL_PASS=0 TOTAL_FAIL=0 TOTAL_FLAKY=0 BATCH_NO=0 RED_BATCHES=""
TOTAL_DNR=0 TOTAL_EXPECTED=0
i=0
while [ "$i" -lt "$N" ]; do
  BATCH=( "${ALL_SPECS[@]:$i:$BATCH_SIZE}" ); i=$(( i + BATCH_SIZE )); BATCH_NO=$(( BATCH_NO + 1 ))
  echo "=================================================================="
  echo "[$(LOG_TS)] BATCH $BATCH_NO (fresh server$( [ "$RESET" = 1 ] && echo ' + fresh DB' )): ${BATCH[*]##*/}"
  echo "=================================================================="
  if [ "$RESET" = "1" ]; then
    supabase db reset --local >/dev/null 2>&1 || { echo "reset FAILED"; RED_BATCHES="$RED_BATCHES b$BATCH_NO(reset)"; continue; }
  fi
  # NEVER "WARN … proceeding" (the old behaviour): a degraded stack yields batches of
  # net::ERR_CONNECTION_REFUSED that then need hand-triage against a folklore baseline
  # — 8 of 12 batches in one ETH-E3a run. Abort loudly instead of emitting garbage.
  preflight "batch $BATCH_NO" || { echo "GATE ABORTED — stack unrecoverable"; exit 4; }
  if ! start_server; then
    echo "[$(LOG_TS)] server FAILED to start"; tail -20 "$GATE_LOGDIR/server.log"
    RED_BATCHES="$RED_BATCHES b$BATCH_NO(server)"; stop_server; continue
  fi
  sleep 4
  BLOG="$GATE_LOGDIR/batch-$BATCH_NO.log"
  exp=$(expected_tests "${BATCH[@]}"); exp=${exp:-0}

  npx playwright test "${BATCH[@]}" --project=chromium --workers=1 --retries="$RETRIES" --reporter=list 2>&1 | tee "$BLOG" | tail -30
  # PIPESTATUS[0], not $? — $? here is `tail`'s, which is ~always 0. Reading the pipe's
  # tail meant Playwright's own verdict was discarded entirely and the gate trusted only
  # its log-scraping; a crash before the summary printed then scraped as 0/0 = clean.
  pw_rc=${PIPESTATUS[0]}

  p=$(num "$BLOG" passed); f=$(num "$BLOG" failed); fl=$(num "$BLOG" flaky)
  sk=$(num "$BLOG" skipped); dnr=$(num "$BLOG" "did not run"); intr=$(num "$BLOG" interrupted)
  p=${p:-0}; f=${f:-0}; fl=${fl:-0}; sk=${sk:-0}; dnr=${dnr:-0}; intr=${intr:-0}
  TOTAL_PASS=$(( TOTAL_PASS + p )); TOTAL_FAIL=$(( TOTAL_FAIL + f )); TOTAL_FLAKY=$(( TOTAL_FLAKY + fl ))
  TOTAL_DNR=$(( TOTAL_DNR + dnr + intr )); TOTAL_EXPECTED=$(( TOTAL_EXPECTED + exp ))
  accounted=$(( p + f + fl + sk + dnr + intr ))

  # A batch is RED if ANY of these hold. Each is a way the old gate went falsely green:
  reasons=""
  [ "$f"    != "0" ] && reasons="$reasons,failed"
  [ "$pw_rc" != "0" ] && [ "$f" = "0" ] && reasons="$reasons,exit$pw_rc"   # crashed with no failure line
  [ "$(( p + f + fl + sk ))" = "0" ] && reasons="$reasons,no-summary"      # nothing parsed at all
  [ "$dnr"  != "0" ] && reasons="$reasons,did-not-run($dnr)"               # serial-mode masking
  [ "$intr" != "0" ] && reasons="$reasons,interrupted($intr)"
  [ "$exp" != "0" ] && [ "$accounted" != "$exp" ] && reasons="$reasons,count($accounted/$exp)"
  [ -n "$reasons" ] && RED_BATCHES="$RED_BATCHES b$BATCH_NO(${reasons#,})"

  echo "[$(LOG_TS)] batch $BATCH_NO -> ${p} passed, ${f} failed, ${fl} flaky, ${sk} skipped, ${dnr} did-not-run · accounted ${accounted}/${exp} · pw_exit ${pw_rc}  (log: $BLOG)"
  stop_server; sleep 1
done

echo "=================================================================="
TOTAL_SEEN=$(( TOTAL_PASS + TOTAL_FAIL + TOTAL_FLAKY + TOTAL_DNR ))
echo "[$(LOG_TS)] GATE SUMMARY: ${TOTAL_PASS} passed · ${TOTAL_FAIL} failed · ${TOTAL_FLAKY} flaky · ${TOTAL_DNR} did-not-run · ${BATCH_NO} batches"
echo "[$(LOG_TS)] COVERAGE: accounted for ${TOTAL_SEEN} of ${TOTAL_EXPECTED} collected tests"
[ -n "$RED_BATCHES" ] && echo "  batches with failures:$RED_BATCHES  (logs in $GATE_LOGDIR)"
echo "=================================================================="
if [ "$TOTAL_FAIL" = "0" ] && [ -z "$RED_BATCHES" ]; then echo "GATE GREEN"; exit 0; fi
echo "GATE RED — triage the failing batch logs against the flaky baseline (memory e2e-prod-build-flaky-baseline) before calling regression."
exit 1
