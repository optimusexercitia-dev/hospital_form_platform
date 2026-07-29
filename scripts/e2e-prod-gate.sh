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
#   BATCH_TESTS=30 bash scripts/e2e-prod-gate.sh # smaller batches by TEST count (more restarts)
#   BATCH_TESTS=0 BATCH_SIZE=4 bash …            # legacy: batch by FILE count instead
#   INFRA_RETRY=0 bash scripts/e2e-prod-gate.sh  # never auto-retry an infra batch (raw signal)
#   RESET=0     bash scripts/e2e-prod-gate.sh    # server-restart ONLY, keep DB (faster; contamination may show)
#   REBUILD=1   bash scripts/e2e-prod-gate.sh    # force a fresh `next build`
#   RETRIES=0   bash scripts/e2e-prod-gate.sh    # no retries (stricter signal)
#   SPECS="e2e/phase8-dashboard.spec.ts e2e/phi-remediation.spec.ts" bash scripts/e2e-prod-gate.sh
#   MAX_RECOVER=0 bash scripts/e2e-prod-gate.sh  # abort on a bad stack instead of self-healing
#   PROBE_EMAIL=... PROBE_PASS=...               # seed persona used by the auth preflight
#
# EXIT CODES: 0 green · 1 red (real failures) · 2 build · 3 toolchain drift ·
#             4 stack unrecoverable (preflight) · 5 red INFRA-only · 99 cd failed.
# Exit 4 and exit 5 are NOT test results — nothing was proven; fix the stack and re-run.
# Exit 5 specifically means "zero assertion failures were observed, but some tests never
# got a working server" — do not read it as a regression, and do not read it as green.
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
BATCH_TESTS="${BATCH_TESTS:-70}" # TESTS per fresh server (0 = fall back to BATCH_SIZE files)
BATCH_SIZE="${BATCH_SIZE:-6}"   # spec FILES per fresh server (fallback when BATCH_TESTS=0)
INFRA_RETRY="${INFRA_RETRY:-1}" # re-run a batch once when its failures are infra, not assertions
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

# ---------------------------------------------------------------------------
# Pack batches by TEST COUNT, not file count (FF-5 gate finding).
#
# WHY: `BATCH_SIZE` counts FILES, and spec files differ by an order of magnitude
# (3 tests vs 40). Measured on the real suite at the default, file-based batching
# gave batches of 13 … 63 tests — a 5x spread, so some servers burned a full
# ~90s `db reset` to run 13 tests while others carried 63.
#
# ⚠ BE PRECISE ABOUT WHAT THIS FIXES. It is tempting to say this prevents the
# FF-5 collapse; it does NOT, and the log says so. That server died 8 tests into
# its own fresh lifetime, not at test 63 — so a smaller cap would not have saved
# it. What this buys is (a) no wasted reset on a 13-test batch and (b) a bounded,
# roughly uniform blast radius, which is what makes the infra RE-RUN below cheap.
# The classifier, not this, is what turns a dead server from "53 failed" into a
# labelled, retried, non-regression result.
#
# The default (70) is chosen from measurement, not taste: it holds the batch count
# at 15 vs the previous 13 — two extra resets — while raising the floor from 13 to
# 46. Lower it for a tighter blast radius at the cost of more resets.
#
# Counts come from ONE `--list` over the whole selection (collection only, no
# browser), then a greedy first-fit pack. A single spec heavier than BATCH_TESTS
# still gets its own batch rather than being split — Playwright's unit is a file.
# ---------------------------------------------------------------------------
declare -a BATCHES=()
pack_batches() {
  local counts="$GATE_LOGDIR/spec-counts.txt" spec base n cur=0 acc=""
  # ⚠ `--list` prints the spec BASENAME ("foo.spec.ts:12:5"), NOT the "e2e/foo.spec.ts"
  # form the list REPORTER uses during a run. A pattern anchored on the directory
  # matches nothing here and silently yields zero counts — which packs every file into
  # its own batch (verified: 74 batches of 1). The character class excludes both `/`
  # and `\`, so this matches whether or not a future version adds the directory back.
  npx playwright test "${ALL_SPECS[@]}" --project=chromium --list 2>/dev/null \
    | grep -oE "[A-Za-z0-9._-]+\.spec\.ts:" \
    | sed 's/:$//' | sort | uniq -c > "$counts" || true
  for spec in "${ALL_SPECS[@]}"; do
    base="${spec##*/}"
    n=$(awk -v b="$base" '$2==b {print $1}' "$counts" 2>/dev/null | tail -1)
    # Unknown count (collection failed, or a spec whose tests are all skipped at
    # collection) must not silently pack as 0 — that rebuilds the fat batch.
    [ -z "$n" ] && n=$BATCH_TESTS
    if [ "$cur" -gt 0 ] && [ $(( cur + n )) -gt "$BATCH_TESTS" ]; then
      BATCHES+=("$acc"); acc=""; cur=0
    fi
    acc="${acc:+$acc }$spec"; cur=$(( cur + n ))
  done
  [ -n "$acc" ] && BATCHES+=("$acc")
}

if [ "$BATCH_TESTS" -gt 0 ]; then
  pack_batches
  echo "[$(LOG_TS)] $N spec files → ${#BATCHES[@]} batches · ≤$BATCH_TESTS tests/server · reset=$RESET · retries=$RETRIES · infra_retry=$INFRA_RETRY"
else
  i=0
  while [ "$i" -lt "$N" ]; do
    BATCHES+=( "${ALL_SPECS[*]:$i:$BATCH_SIZE}" ); i=$(( i + BATCH_SIZE ))
  done
  echo "[$(LOG_TS)] $N spec files → ${#BATCHES[@]} batches · $BATCH_SIZE files/server (legacy) · reset=$RESET · retries=$RETRIES"
fi


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
TOTAL_DNR=0 TOTAL_EXPECTED=0 TOTAL_INFRA=0 INFRA_RERUNS=0

# Count the signatures that mean "the server went away", not "an assertion failed".
# A dead standalone server turns every REMAINING test in its batch into one of these,
# which is exactly what made 53 phantom failures indistinguishable from 53 defects.
conn_errors() {
  grep -cE "ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET|ECONNREFUSED" "$1" 2>/dev/null || true
}

for BATCH_SPECS in "${BATCHES[@]}"; do
  read -r -a BATCH <<< "$BATCH_SPECS"
  BATCH_NO=$(( BATCH_NO + 1 )); attempt=1
  while : ; do
    echo "=================================================================="
    echo "[$(LOG_TS)] BATCH $BATCH_NO$( [ "$attempt" -gt 1 ] && echo ' · INFRA RE-RUN' ) (fresh server$( [ "$RESET" = 1 ] && echo ' + fresh DB' )): ${BATCH[*]##*/}"
    echo "=================================================================="
    if [ "$RESET" = "1" ]; then
      supabase db reset --local >/dev/null 2>&1 || { echo "reset FAILED"; RED_BATCHES="$RED_BATCHES b$BATCH_NO(reset)"; continue 2; }
    fi
    # NEVER "WARN … proceeding" (the old behaviour): a degraded stack yields batches of
    # net::ERR_CONNECTION_REFUSED that then need hand-triage against a folklore baseline
    # — 8 of 12 batches in one ETH-E3a run. Abort loudly instead of emitting garbage.
    preflight "batch $BATCH_NO" || { echo "GATE ABORTED — stack unrecoverable"; exit 4; }
    if ! start_server; then
      echo "[$(LOG_TS)] server FAILED to start"; tail -20 "$GATE_LOGDIR/server.log"
      RED_BATCHES="$RED_BATCHES b$BATCH_NO(server)"; stop_server; continue 2
    fi
    sleep 4
    BLOG="$GATE_LOGDIR/batch-$BATCH_NO.log"
    [ "$attempt" -gt 1 ] && BLOG="$GATE_LOGDIR/batch-$BATCH_NO-rerun.log"
    exp=$(expected_tests "${BATCH[@]}"); exp=${exp:-0}

    npx playwright test "${BATCH[@]}" --project=chromium --workers=1 --retries="$RETRIES" --reporter=list 2>&1 | tee "$BLOG" | tail -30
    # PIPESTATUS[0], not $? — $? here is `tail`'s, which is ~always 0. Reading the pipe's
    # tail meant Playwright's own verdict was discarded entirely and the gate trusted only
    # its log-scraping; a crash before the summary printed then scraped as 0/0 = clean.
    pw_rc=${PIPESTATUS[0]}

    p=$(num "$BLOG" passed); f=$(num "$BLOG" failed); fl=$(num "$BLOG" flaky)
    sk=$(num "$BLOG" skipped); dnr=$(num "$BLOG" "did not run"); intr=$(num "$BLOG" interrupted)
    p=${p:-0}; f=${f:-0}; fl=${fl:-0}; sk=${sk:-0}; dnr=${dnr:-0}; intr=${intr:-0}

    # ---- INFRA classification (FF-5 gate finding) --------------------------------
    # Liveness is checked AFTER the run, not before: `start_server` only proves the
    # server was up at t=0, and the collapse happens mid-batch. Two independent tells,
    # either sufficient:
    #   * the server process is gone;
    #   * the failures are dominated by connection errors.
    # `conn >= f` is deliberately a floor, not a ratio: one dead server produces at
    # least one connection error per failed test, and a genuine assertion failure
    # produces none — so in practice the two populations do not overlap. Getting this
    # wrong in the SAFE direction (calling a real failure infra) is guarded by the
    # re-run: a real failure reproduces on the fresh server and is then reported as
    # a failure.
    srv_dead=0; kill -0 "$SERVER_PID" 2>/dev/null || srv_dead=1
    conn=$(conn_errors "$BLOG"); conn=${conn:-0}
    infra=0
    if [ "$f" -gt 0 ] && { [ "$srv_dead" = "1" ] || [ "$conn" -ge "$f" ]; }; then infra=1; fi

    if [ "$infra" = "1" ]; then
      echo "[$(LOG_TS)] batch $BATCH_NO -> ${f} failures classified INFRA, not defects (server_dead=${srv_dead}, conn_errors=${conn})"
      if [ "$INFRA_RETRY" = "1" ] && [ "$attempt" -lt 2 ]; then
        INFRA_RERUNS=$(( INFRA_RERUNS + 1 ))
        echo "[$(LOG_TS)] re-running batch $BATCH_NO on a fresh server (INFRA_RETRY=1)"
        stop_server; sleep 2; attempt=2; continue
      fi
    fi
    break
  done

  TOTAL_PASS=$(( TOTAL_PASS + p )); TOTAL_FLAKY=$(( TOTAL_FLAKY + fl ))
  TOTAL_DNR=$(( TOTAL_DNR + dnr + intr )); TOTAL_EXPECTED=$(( TOTAL_EXPECTED + exp ))
  accounted=$(( p + f + fl + sk + dnr + intr ))

  # Real failures and infra failures are counted SEPARATELY so the headline number
  # means "defects". Conflating them is what produced "GATE RED — 53 failed" for a
  # phase with zero regressions, and trained readers to discount the number.
  if [ "$infra" = "1" ]; then TOTAL_INFRA=$(( TOTAL_INFRA + f )); else TOTAL_FAIL=$(( TOTAL_FAIL + f )); fi

  # A batch is RED if ANY of these hold. Each is a way the old gate went falsely green:
  reasons=""
  if [ "$infra" = "1" ]; then
    # Still RED after the re-run — but labelled, because nothing was PROVEN for these
    # tests. "Not a regression" is not the same claim as "passed".
    reasons="$reasons,infra-unproven($f)"
  else
    [ "$f"  != "0" ] && reasons="$reasons,failed"
  fi
  [ "$pw_rc" != "0" ] && [ "$f" = "0" ] && reasons="$reasons,exit$pw_rc"   # crashed with no failure line
  [ "$(( p + f + fl + sk ))" = "0" ] && reasons="$reasons,no-summary"      # nothing parsed at all
  [ "$dnr"  != "0" ] && reasons="$reasons,did-not-run($dnr)"               # serial-mode masking
  [ "$intr" != "0" ] && reasons="$reasons,interrupted($intr)"
  [ "$exp" != "0" ] && [ "$accounted" != "$exp" ] && reasons="$reasons,count($accounted/$exp)"
  [ -n "$reasons" ] && RED_BATCHES="$RED_BATCHES b$BATCH_NO(${reasons#,})"

  echo "[$(LOG_TS)] batch $BATCH_NO -> ${p} passed, ${f} failed$( [ "$infra" = "1" ] && echo ' (INFRA)' ), ${fl} flaky, ${sk} skipped, ${dnr} did-not-run · accounted ${accounted}/${exp} · pw_exit ${pw_rc}  (log: $BLOG)"
  stop_server; sleep 1
done

echo "=================================================================="
TOTAL_SEEN=$(( TOTAL_PASS + TOTAL_FAIL + TOTAL_INFRA + TOTAL_FLAKY + TOTAL_DNR ))
echo "[$(LOG_TS)] GATE SUMMARY: ${TOTAL_PASS} passed · ${TOTAL_FAIL} failed · ${TOTAL_INFRA} infra · ${TOTAL_FLAKY} flaky · ${TOTAL_DNR} did-not-run · ${BATCH_NO} batches"
echo "[$(LOG_TS)] COVERAGE: accounted for ${TOTAL_SEEN} of ${TOTAL_EXPECTED} collected tests"
[ "$INFRA_RERUNS" -gt 0 ] && echo "[$(LOG_TS)] INFRA re-runs performed: ${INFRA_RERUNS}"
[ -n "$RED_BATCHES" ] && echo "  batches with failures:$RED_BATCHES  (logs in $GATE_LOGDIR)"
echo "=================================================================="
if [ "$TOTAL_FAIL" = "0" ] && [ -z "$RED_BATCHES" ]; then echo "GATE GREEN"; exit 0; fi

# Two distinct RED verdicts. Collapsing them is what made a dead server read as a
# 53-defect regression, and (worse, over time) trains readers to shrug at real reds.
if [ "$TOTAL_FAIL" = "0" ] && [ "$TOTAL_INFRA" -gt 0 ]; then
  echo "GATE RED (INFRA) — ${TOTAL_INFRA} test(s) never got a working server, even after a re-run."
  echo "  NOT a regression signal: zero assertion failures were observed. Nothing is proven for"
  echo "  those tests either — re-run the named batch(es) before declaring the phase green."
  exit 5
fi
echo "GATE RED — ${TOTAL_FAIL} real failure(s)$( [ "$TOTAL_INFRA" -gt 0 ] && echo " (plus ${TOTAL_INFRA} infra, already classified)" )."
echo "  Infra noise is now classified automatically; anything counted above is an assertion"
echo "  failure. Still worth checking the flaky baseline (memory e2e-prod-build-flaky-baseline)."
exit 1
