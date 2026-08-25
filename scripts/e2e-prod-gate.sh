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
# EXIT CODES: 0 green · 1 red (real failures) · 2 build · 3 toolchain drift / missing
#             helper · 4 stack unrecoverable (preflight) · 5 red, NOTHING PROVEN ·
#             99 cd failed.
# Exit 4 and exit 5 are NOT test results — nothing was proven; fix the stack and re-run.
# Exit 5 means "zero assertion failures were observed, but some tests never got to run"
# — either INFRA (a dead server ate them) or UNRUN (their batch aborted before it
# started; see abort_batch). Do not read it as a regression, and do not read it as green.
#
# ARTIFACTS, all under $GATE_LOGDIR ($TMPDIR/e2e-prod-gate) and all written BY THIS SCRIPT
# — nothing downstream has to survive the run for the run's own evidence to exist:
#   gate-exit                  the exit code + verdict (see `finish`)
#   batch-N.log / -rerun /     Playwright output per batch / per INFRA re-run / per batch
#     -unrun.log                 that never ran
#   server-batch-N.log         the standalone server's stdout+stderr for that batch
#     / -rerun.log               (⚠ the ONLY reading that can tell a V8 heap ceiling from
#                                 an unhandled exception in app code — the second is a
#                                 product DEFECT the INFRA classifier would otherwise
#                                 absorb forever)
#   reset-batch-N.log          `supabase db reset` output per batch
#
# PREREQS: local Supabase up + seeded (`supabase status`); `.env.local` -> local
# Supabase. Prod deploys on Linux/Docker where this collapse may not occur; this gate
# is primarily for the LOCAL Windows prod-standalone run.
# ---------------------------------------------------------------------------
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT" || exit 99   # plain `exit`: $GATE_LOGDIR is not located yet, see `finish` below

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
NOW_ISO() { date '+%Y-%m-%dT%H:%M:%S%z'; }

# --- durable outcome record --------------------------------------------------
# FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH, second finding. The gate's exit
# code used to be captured only by a `; echo "GATE_EXIT=$?"` clause in the LAUNCHING
# WRAPPER. The harness reaped that wrapper in BOTH full runs of 2026-08-25, so the token
# never appeared either time and the code had to be inferred from the verdict prose — i.e.
# the reporting contract was unsatisfiable, not strict. The script now writes it itself.
#
# ⚠ Traps alone are NOT sufficient, and the folklore about them is worth measuring rather
# than repeating. Measured directly, bash 5.2.37 on this platform (MINGW64):
#   · a TERM trap DOES fire when THIS script's own pid is signalled, and it fires promptly —
#     it interrupts a foreground child rather than waiting for it. So (b) below is real.
#   · a subshell does NOT inherit the parent's EXIT trap (only a `trap … EXIT` the subshell
#     sets for itself runs), so an exit taken inside `( … )` would record nothing.
#   · an untrapped SIGKILL runs no trap at all.
#   · ⚠ and the case actually observed on 2026-08-25 is neither: the harness reaped the
#     WRAPPER, not this script, leaving this script running as an orphan. Signals sent to a
#     wrapper never reach here, which is precisely why the record cannot live in the wrapper.
# So four layers, in order of reliability:
#   (a) every exit point goes through `finish`, which WRITES the record and then exits;
#   (b) INT/TERM are trapped through `finish` too, so a signalled run still records a code;
#   (c) the file is SEEDED "RUNNING" here, so a SIGKILL — or a run still in flight — leaves
#       "started, never reached a verdict" on disk instead of nothing; absence is unreadable;
#   (d) the EXIT trap is a last-resort backstop for an exit that bypassed `finish`.
GATE_EXIT_FILE="$GATE_LOGDIR/gate-exit"
GATE_EXIT_WRITTEN=0
printf 'GATE_EXIT=RUNNING\npid=%s\nstarted=%s\n' "$$" "$(NOW_ISO)" > "$GATE_EXIT_FILE"

# finish <code> [verdict-for-the-record]
# Callers keep their own `echo` — this writes, it does not print, so no message doubles up.
finish() {
  GATE_EXIT_WRITTEN=1
  printf 'GATE_EXIT=%s\nverdict=%s\nfinished=%s\nlogdir=%s\n' \
    "$1" "${2:-}" "$(NOW_ISO)" "$GATE_LOGDIR" > "$GATE_EXIT_FILE"
  exit "$1"
}

case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) IS_WIN=1 ;; *) IS_WIN=0 ;; esac

# ⚠ `free_port` MUST kill only what is LISTENING on $PORT. It used to select with
#   netstat -ano | grep ":$PORT " | awk '{print $NF}'
# and `grep` cannot say WHICH COLUMN matched: a client socket connected TO the port carries
# it in the FOREIGN address column, so on a machine with live clients this returned CLIENT
# pids and `taskkill //F` killed them. During a gate run those clients are Playwright
# workers — the 2026-08-25 batch-13 signature (`worker process exited unexpectedly` ×53).
# ⚠ Mechanism demonstrated, firing UNOBSERVED: a teardown-phase hazard, not a diagnosed
# root cause of that batch.
# The parse lives in its own file so it can be tested against captured real netstat output
# without a gate run — `bash scripts/test-netstat-listener-pids.sh` (~1 s). Read that file's
# header for why the State column is never matched literally (it is localized).
NETSTAT_PIDS_AWK="$HERE/lib/netstat-listener-pids.awk"
free_port() {
  if [ "$IS_WIN" = "1" ]; then
    for p in $(netstat -ano 2>/dev/null | awk -v port="$PORT" -f "$NETSTAT_PIDS_AWK"); do
      taskkill //PID "$p" //F >/dev/null 2>&1 || true
    done
  elif command -v lsof >/dev/null 2>&1; then
    # Same narrowing on the POSIX side: a bare `-i tcp:PORT` also matches a socket that
    # merely CONNECTS to the port. ⚠ UNVERIFIED on this platform — the gate runs on
    # Windows and there is no lsof here to exercise it.
    lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  fi
}
# A missing parser would make free_port silently free NOTHING — and that fails OPEN in the
# worst direction: the stale server keeps serving, `start_server`'s `curl /login` probe
# succeeds against it, and the batch runs (possibly green) against a STALE BUILD. Refuse.
if [ "$IS_WIN" = "1" ] && [ ! -f "$NETSTAT_PIDS_AWK" ]; then
  echo "FATAL: missing $NETSTAT_PIDS_AWK — free_port cannot identify the listener on :$PORT,"
  echo "       and a silently-unfreed port lets a batch run against a stale server."
  finish 3 "FATAL: missing helper $NETSTAT_PIDS_AWK"
fi

SERVER_PID=""
stop_server() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true; free_port; SERVER_PID=""; }

# See the `finish` block above for why the EXIT trap is a backstop and not the mechanism.
on_exit() {
  local rc=$?
  stop_server
  # `${NONCE_PATH:-}` because on_exit can fire before start_server's block is even reached.
  [ -n "${NONCE_PATH:-}" ] && rm -f "$NONCE_PATH" 2>/dev/null
  [ "$GATE_EXIT_WRITTEN" = "1" ] && return 0
  printf 'GATE_EXIT=%s\nverdict=%s\nfinished=%s\nlogdir=%s\n' "$rc" \
    "NO VERDICT — the gate exited without reaching one of its own exit points (killed, or an unhandled shell error). Nothing is proven for this run." \
    "$(NOW_ISO)" "$GATE_LOGDIR" > "$GATE_EXIT_FILE"
}
trap 'on_exit' EXIT
trap 'finish 130 "SIGINT — interrupted before a verdict; nothing is proven."' INT
trap 'finish 143 "SIGTERM — terminated before a verdict; nothing is proven."' TERM

[ -f .env.local ] || { echo "FATAL: .env.local not found"; finish 1 "FATAL: .env.local not found"; }

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
[ -n "$REF" ] || { echo "FATAL: no supabase_db_* container — is the local stack up?"; finish 4 "FATAL: no supabase_db_* container — the local stack is not up. NOT a test result."; }

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
# `reload_pgrst` only NOTIFIES — the rebuild is ASYNCHRONOUS and it does not wait.
# Starting a batch inside that window is the PGRST002 race (FUP-QO-9): PostgREST is up
# and ANSWERING, so nothing in the run looks like a connection error; the tests just see
# a 503 body and fail as assertions. Probe the REST root and treat the code/message in
# the BODY as the readiness signal. Fails CLOSED: an empty body (curl failed) = not ready.
pgrst_ok() {
  local body
  body="$(curl -s -m 5 "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" \
       -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" 2>/dev/null)"
  [ -n "$body" ] && ! printf '%s' "$body" | grep -qE "PGRST002|Could not query the database for the schema cache"
}
# The `gotenberg-pdf` sidecar is OUTSIDE the Supabase stack and carries NO restart
# policy, so any Docker restart kills it silently and every PDF spec reds as an
# assertion failure (FUP-GATE-RESET-FLAKE: 8 such reds in one gate, diagnosed only
# after the run). Detection only — the restart policy itself is an infra change and
# stays the PO's call. Vacuously true when PDF_RENDERER_URL is unset, because minting
# is then expected to fail cleanly in pt-BR and the specs account for it.
renderer_ok() {
  [ -z "${PDF_RENDERER_URL:-}" ] && return 0
  [ "$(curl -s -o /dev/null -w '%{http_code}' -m 3 "${PDF_RENDERER_URL%/}/health" 2>/dev/null)" = "200" ]
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
  # Keep this reset's output too (FUP-GATE-RESET-FLAKE): when recovery itself is what
  # fails, the discarded stderr was the only record of why.
  supabase db reset --local >"$GATE_LOGDIR/reset-recover.log" 2>&1 \
    || echo "[$(LOG_TS)]   recovery reset FAILED (log: $GATE_LOGDIR/reset-recover.log)"
  BASE_ANALYTICS="$(restarts analytics)"
  reload_pgrst
  token_ok
}

# preflight <label> — 0 = stack usable, 1 = give up (caller aborts the gate)
preflight() {
  local label="$1" i looping
  reload_pgrst
  for i in $(seq 1 15); do token_ok && break; sleep 2; done
  # Wait for the schema cache too, re-NOTIFYing each round (the first NOTIFY can land
  # before the DB finishes accepting connections, in which case it is simply lost).
  # NOT fatal: a blip here is recoverable — the batch classifier now recognises PGRST002
  # and re-runs the batch — and aborting a 40-minute gate on a cache rebuild would be a
  # worse failure than proceeding with a warning.
  for i in $(seq 1 15); do pgrst_ok && break; reload_pgrst; sleep 2; done
  pgrst_ok || echo "[$(LOG_TS)] PREFLIGHT($label): WARNING — PostgREST schema cache still not ready; expect PGRST002 (batch will be retried as INFRA)"
  renderer_ok || echo "[$(LOG_TS)] PREFLIGHT($label): WARNING — PDF renderer unreachable at ${PDF_RENDERER_URL:-unset} — the pdf specs WILL fail, as ENVIRONMENT not defects (8 such reds in one gate, cause unidentified for a full run). The sidecar carries no restart policy, so any Docker restart kills it silently: \`docker start gotenberg-pdf\`"
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

preflight "gate start" || { echo "GATE ABORTED — stack unrecoverable before batch 1"; finish 4 "GATE ABORTED — stack unrecoverable before batch 1. NOT a test result: nothing was proven."; }
# SELFTEST=1 answers "is the stack fit for a gate run?" in seconds instead of 40 minutes,
# and is how the preflight arms are fault-injection tested (docs/testing/e2e-prod-build-gate.md).
[ -n "${SELFTEST:-}" ] && { echo "SELFTEST: stack is fit for a gate run"; finish 0 "SELFTEST: stack is fit for a gate run (no tests were run)"; }

# --- verify the installed toolchain matches the lockfile (BUG-PROD-ACTIONS, authz-handoff.md §7.16:
#     node_modules/next silently drifted to a stale version while package.json/lockfile were correct,
#     and the standalone build faithfully baked in the stale one) ---
declared_next="$(node -p "require('./package.json').dependencies.next" 2>/dev/null)"
installed_next="$(node -p "require('./node_modules/next/package.json').version" 2>/dev/null)"
if [ -z "$installed_next" ] || [ "$installed_next" != "$declared_next" ]; then
  echo "FATAL: node_modules/next ($installed_next) != package.json's declared next ($declared_next)."
  echo "       Toolchain drift — run \`npm ci\` before gating."
  finish 3 "FATAL: toolchain drift — node_modules/next ($installed_next) != declared ($declared_next)"
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
  npm run build || { echo "FATAL: next build failed"; finish 2 "FATAL: next build failed"; }
else
  echo "[$(LOG_TS)] reusing existing standalone build"
fi
[ -f .next/standalone/server.js ] || { echo "FATAL: no standalone/server.js"; finish 2 "FATAL: no .next/standalone/server.js after build"; }
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public       .next/standalone/public

# --- discover specs + split into batches ---
if [ -n "${SPECS:-}" ]; then read -r -a ALL_SPECS <<< "$SPECS"; else ALL_SPECS=(e2e/*.spec.ts); fi
N=${#ALL_SPECS[@]}
[ "$N" -gt 0 ] || { echo "FATAL: no specs found"; finish 1 "FATAL: no specs found"; }

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


# FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH. The server log used to be a FIXED
# `server.log` opened with a TRUNCATING `>`, so every batch overwrote the last — and it was
# surfaced at exactly one place, on `start_server` FAILURE. A server that started cleanly
# and then died mid-batch (the `server_dead` condition the INFRA classifier exists to
# detect) therefore left NO retained server-side artifact at all. Measured 2026-08-25:
# batch 7's server truncated batch 6's log seconds after batch 6's server died, in both
# full runs. Per-batch naming was never unavailable — this script already writes
# batch-N.log, batch-N-unrun.log and reset-batch-N.log; the server log was the lone
# exception to a convention the script itself established, for the one artifact a collapse
# investigation needs.
SERVER_LOG="$GATE_LOGDIR/server-batch-0.log"
server_log_path() {   # per batch AND per attempt, so an INFRA re-run cannot clobber
                      # attempt 1's log — the same rule $BLOG already follows below.
  local n="${BATCH_NO:-0}" a="${attempt:-1}"
  if [ "$a" -gt 1 ]; then echo "$GATE_LOGDIR/server-batch-$n-rerun.log"
  else echo "$GATE_LOGDIR/server-batch-$n.log"; fi
}

# --- server identity (FALSE-GREEN VECTOR A, measured 2026-08-25) ---------------
# `start_server` used to probe `curl /login` BEFORE `kill -0 "$SERVER_PID"`. If the spawned
# node died at once — EADDRINUSE, because something ELSE already held the port — curl
# succeeded against that FOREIGN listener on the first iteration and `start_server` returned
# 0. The batch then ran against an engineer's `next dev`, or a previous gate's orphan serving
# a STALE build; and because the INFRA classifier only evaluates `srv_dead` when `f > 0`, a
# fully-passing batch reported **GATE GREEN with `server_dead=1` printed ZERO times**.
# Reproduced on the harness: GATE GREEN, gate-exit=0, server log `listen EADDRINUSE`.
#
# Three DIFFERENT questions, deliberately kept apart:
#   (1) is MY process alive?            -> `kill -0`, now checked FIRST in the wait loop
#   (2) is MY process the one ANSWERING? -> the listener on $PORT must be owned by my pid
#   (3) are these the bytes I STAGED?   -> a nonce served out of the staged public/ tree
# (1) is the fix and it closes the measured reproduction on its own. (2) and (3) are defence
# in depth and fail CLOSED only on a DEFINITIVE mismatch; where they cannot reach a
# conclusion they warn and proceed, because "this server does not serve the nonce" and "a
# foreign server answered" are indistinguishable from here, and aborting a 40-minute gate on
# an unverifiable arm is the worse failure. ⚠ (3) narrows the documented REBUILD=1 stale-build
# trap but does NOT close it: it proves the answering process serves the tree this run
# STAGED, not that the tree is fresh relative to source.
# `SERVER_IDENTITY=warn` downgrades even a definitive mismatch, should (2)/(3) ever misfire.
SERVER_IDENTITY="${SERVER_IDENTITY:-strict}"       # strict | warn
# ⛔ THE NONCE MUST LIVE ON A PATH THE MIDDLEWARE DOES NOT GATE. The first version served it
# from `public/` as `__gate-nonce.txt` and it hit the ADR-0007 auth gate: measured against a
# real build, `GET /__gate-nonce.txt` returns **HTTP 307** with body
# `/login?redirect=%2F__gate-nonce.txt`. That body is not a nonce, but it is not EMPTY either,
# so the arm read it as "a different nonce" and hard-failed a perfectly good server.
# `src/proxy.ts`'s matcher excludes `_next/static` BY NAME, so the nonce now rides with the
# build output the gate already stages (`cp -r .next/static .next/standalone/.next/static`) —
# which also makes it a better answer to "are these the bytes I staged". Measured on the same
# real build: `GET /_next/static/__gate-nonce.txt` -> HTTP 200 with the exact nonce.
# ⛔ Do NOT instead add this path to the middleware's public matcher: the middleware is the
# security boundary and the harness adapts to the app, never the reverse. An excluded
# *extension* (e.g. `.map`) also works, but that list exists for static-asset content types
# and is a more fragile coupling than the `_next/static` name.
NONCE_PATH=".next/standalone/.next/static/__gate-nonce.txt"
NONCE_URL="/_next/static/__gate-nonce.txt"
# A body only counts as a nonce if it is NONCE-SHAPED. Anything else — a redirect, an HTML
# page, a 401/404, an empty body — means "I did not receive a nonce", which is INCONCLUSIVE
# and must never be reported as a mismatch. Keep in step with `write_nonce`.
NONCE_RE='^gate[0-9]+-b[0-9]+-a[0-9]+-[0-9]+ build='
GATE_NONCE=""
winpid_of() {   # MSYS pid -> Windows pid; empty when not resolvable. `ps -W` col 4 = WINPID
  [ "$IS_WIN" = "1" ] || return 0
  ps -W 2>/dev/null | awk -v p="$1" '$1==p {print $4; exit}'
}
# Is Windows pid $2 equal to, or a descendant of, Windows pid $1?
#   0 = yes · 1 = no · 2 = COULD NOT DETERMINE
# The third answer is the point. Without it, a listener owned by a CHILD of our server reads
# as "owned by a stranger" — the same conflation as the nonce bug above, one arm along. Next
# standalone is single-process today, so this should never decide anything; it exists so that
# if it ever does, the arm says "cannot attribute" rather than hard-failing a live gate.
pid_is_self_or_descendant() {
  local root="$1" cand="$2" out
  [ -n "$root" ] && [ -n "$cand" ] || return 2
  [ "$cand" = "$root" ] && return 0
  command -v powershell.exe >/dev/null 2>&1 || return 2
  out="$(powershell.exe -NoProfile -NonInteractive -Command "
    try {
      \$m=@{}; Get-CimInstance Win32_Process | ForEach-Object { \$m[[int]\$_.ProcessId]=[int]\$_.ParentProcessId }
      \$p=[int]$cand; \$r=[int]$root; \$n=0
      \$ans='NO'
      while (\$p -ne 0 -and \$n -lt 64) {
        if (\$p -eq \$r) { \$ans='YES'; break }
        if (-not \$m.ContainsKey(\$p)) { break }
        \$p=\$m[\$p]; \$n++
      }
      Write-Output \$ans
    } catch { Write-Output 'UNKNOWN' }" 2>/dev/null | tr -d '\r\n ')"
  case "$out" in YES) return 0 ;; NO) return 1 ;; *) return 2 ;; esac
}
write_nonce() {
  GATE_NONCE="gate$$-b${BATCH_NO:-0}-a${attempt:-1}-$(date +%s)"
  local bid=""
  [ -f .next/standalone/.next/BUILD_ID ] && bid="$(tr -d '\r\n' < .next/standalone/.next/BUILD_ID)"
  printf '%s build=%s\n' "$GATE_NONCE" "${bid:-unknown}" > "$NONCE_PATH" 2>/dev/null || GATE_NONCE=""
}
# 0 = identity verified OR inconclusive · 1 = DEFINITIVELY not the server this gate started
verify_server_identity() {
  local verdict=0 wp lset nbody ntok
  # The port answers. If MY process is not alive, then by definition something else is
  # serving it — this is the vector-A signature and it is definitive.
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[$(LOG_TS)]   !! :$PORT ANSWERS but the server this gate started is DEAD — something else is serving that port (log: $SERVER_LOG)"
    verdict=1
  elif [ "$IS_WIN" = "1" ]; then
    wp="$(winpid_of "$SERVER_PID")"
    lset="$(netstat -ano 2>/dev/null | awk -v port="$PORT" -f "$NETSTAT_PIDS_AWK" | tr '\n' ' ')"
    if [ -n "$wp" ] && [ -n "$lset" ]; then
      case " $lset " in
        *" $wp "*) : ;;   # we own the listener outright
        *)
          # Not our pid — but "not mine" and "cannot attribute" are DIFFERENT answers, and
          # only the first may hard-fail. A listener owned by a descendant of ours is ours.
          local lp attributed=0 unknown=0
          for lp in $lset; do
            pid_is_self_or_descendant "$wp" "$lp"
            case $? in
              0) attributed=1; break ;;
              2) unknown=1 ;;
            esac
          done
          if [ "$attributed" = "1" ]; then
            echo "[$(LOG_TS)]   (identity) :$PORT is owned by a CHILD of the server this gate started — ours"
          elif [ "$unknown" = "1" ]; then
            echo "[$(LOG_TS)]   (identity) listener-ownership INCONCLUSIVE — :$PORT is owned by pid(s) [${lset% }] and this host could not resolve their ancestry against winpid $wp"
          else
            echo "[$(LOG_TS)]   !! :$PORT is owned by pid(s) [${lset% }], NOT by the server this gate started (winpid $wp) nor by any descendant of it"
            verdict=1
          fi ;;
      esac
    else
      echo "[$(LOG_TS)]   (identity) listener-ownership INCONCLUSIVE (winpid='${wp:-?}', listeners='${lset:-none}')"
    fi
  fi
  if [ -n "$GATE_NONCE" ]; then
    # ⚠ The status is captured alongside the body so an inconclusive result says WHY. The
    # first version printed only the body, which is the sole reason the 307 was diagnosable.
    local nraw ncode
    nraw="$(curl -s -m 5 -w '\n%{http_code}' "http://localhost:$PORT$NONCE_URL" 2>/dev/null | tr -d '\r')"
    ncode="$(printf '%s' "$nraw" | tail -1)"
    nbody="$(printf '%s' "$nraw" | sed '$d')"
    ntok="${nbody%% *}"
    if ! printf '%s' "$nbody" | grep -qE "$NONCE_RE"; then
      # NOT NONCE-SHAPED => "I did not receive a nonce", which is a different fact from
      # "I received one and it differs". Only the latter may conclude anything. A redirect to
      # the auth gate landed here as HTTP 307 body `/login?redirect=…` and was briefly
      # mis-read as a mismatch — the bug this branch exists to prevent.
      echo "[$(LOG_TS)]   (identity) build-nonce INCONCLUSIVE — $NONCE_URL returned HTTP ${ncode:-?} and a body that is not nonce-shaped: '$(printf '%.60s' "${nbody:-<empty>}")'. A foreign server and a server that simply does not serve this path are indistinguishable here."
    elif [ "$ntok" = "$GATE_NONCE" ]; then
      echo "[$(LOG_TS)]   (identity) serving the tree this run staged · ${nbody}"
    else
      echo "[$(LOG_TS)]   !! :$PORT served a nonce from a DIFFERENT staged tree (got '${ntok}', expected '${GATE_NONCE}')"
      verdict=1
    fi
  fi
  [ "$verdict" = "0" ] && return 0
  if [ "$SERVER_IDENTITY" = "warn" ]; then
    echo "[$(LOG_TS)]   !! SERVER_IDENTITY=warn — proceeding against a server that is NOT the one this gate started. Results are NOT attributable to this build."
    return 0
  fi
  return 1
}

start_server() {
  free_port
  SERVER_LOG="$(server_log_path)"
  write_nonce
  PORT="$PORT" HOSTNAME=0.0.0.0 node .next/standalone/server.js > "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 45); do
    # ⚠ THE ORDER IS THE FIX. Reversed (curl first), a spawned server that died of
    # EADDRINUSE was masked by whatever else answered the port — see vector A above.
    kill -0 "$SERVER_PID" 2>/dev/null || {
      echo "[$(LOG_TS)]   the server process this gate started is GONE before it ever served (log: $SERVER_LOG)"
      return 1
    }
    if curl -sf -o /dev/null "http://localhost:$PORT/login"; then
      verify_server_identity || return 1
      return 0
    fi
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
#
# ⛔ FALSE-GREEN VECTOR B (measured 2026-08-25). This used to be consumed as
# `exp=${exp:-0}` with NO fallback, and a zero `exp` disables the coverage machinery on BOTH
# sides: the `count($accounted/$exp)` reconciliation is skipped (it is guarded by
# `[ "$exp" != "0" ]`) AND `TOTAL_EXPECTED += 0`, so the denominator shrinks to whatever
# actually ran. Reproduced: a batch holding 60 tests ran 3, Playwright exited 0, and the run
# printed `COVERAGE: accounted for 3 of 0` and **GATE GREEN**.
# `pack_batches` already guards the identical hazard — `[ -z "$n" ] && n=$BATCH_TESTS`,
# with the comment "must not silently pack as 0" — this path simply never got the guard.
# The caller now supplies the fallback, ANNOUNCES it, and reds the batch: a guessed
# denominator nobody is told about is the same defect with a nicer number.
expected_tests() {
  npx playwright test "$@" --project=chromium --list 2>/dev/null \
    | grep -oE '^Total: [0-9]+ test' | grep -oE '[0-9]+' | tail -1
}


TOTAL_PASS=0 TOTAL_FAIL=0 TOTAL_FLAKY=0 BATCH_NO=0 RED_BATCHES=""
TOTAL_DNR=0 TOTAL_EXPECTED=0 TOTAL_INFRA=0 INFRA_RERUNS=0
EXP_UNKNOWN_BATCHES=0   # batches whose collected size `--list` could not establish (vector B)

# Count the signatures that mean "the server went away", not "an assertion failed".
# A dead standalone server turns every REMAINING test in its batch into one of these,
# which is exactly what made 53 phantom failures indistinguishable from 53 defects.
conn_errors() {
  grep -cE "ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|ERR_CONNECTION_RESET|ECONNREFUSED" "$1" 2>/dev/null || true
}

# PGRST002 = PostgREST could not build its schema cache — the DB was not ready when
# the batch started (a race right after `db reset`). It is INFRA, not a defect, but it
# is NOT a connection error: the server answers, it just answers wrong, so `conn_errors`
# above returns 0 and the batch was never auto-retried (FUP-QO-9). Both shapes are
# matched because only one of them appears depending on which layer surfaces it: the
# bare SQLSTATE-like code, and PostgREST's own English message.
pgrst_unready() {
  grep -cE "PGRST002|Could not query the database for the schema cache" "$1" 2>/dev/null || true
}

# A batch that never ran must still be COUNTED — as unrun, on BOTH sides of the
# coverage line (BUG-GATE-001). The reset/server failure paths below `continue 2`
# straight past the tally block at the end of the loop, so `exp` was never added to
# TOTAL_EXPECTED: the dead batch's tests vanished from the denominator instead of
# being reported missing. Measured on the FF-4 gate — a 931-test suite whose batch 4
# died on `reset FAILED` printed "accounted for 860 of 865", which READS LIKE 99%
# COVERAGE while 66 tests had never executed. It also wrote no batch-N.log, so the
# only trace was a gap in the batch numbering that nothing highlighted.
#
# ⚠ The run was still RED (both paths do append to RED_BATCHES, and the `-z` test at
# the verdict blocks GATE GREEN) — the failure mode is a LYING SUMMARY, not a false
# green. Fixing the denominator is what makes the lie visible.
abort_batch() {  # $1 = short reason (reset|server); requires `exp` + `BATCH` set
  local stub="$GATE_LOGDIR/batch-$BATCH_NO.log"
  # Never clobber a real log: on an INFRA re-run attempt 1's log already exists.
  [ -f "$stub" ] && stub="$GATE_LOGDIR/batch-$BATCH_NO-unrun.log"
  TOTAL_EXPECTED=$(( TOTAL_EXPECTED + exp ))
  TOTAL_DNR=$(( TOTAL_DNR + exp ))
  RED_BATCHES="$RED_BATCHES b$BATCH_NO($1)"
  printf 'BATCH %s DID NOT RUN — "%s" failed.\n%s collected test(s) never executed.\nSpecs:\n%s\n' \
    "$BATCH_NO" "$1" "$exp" "$(printf '  %s\n' "${BATCH[@]}")" > "$stub"
  echo "[$(LOG_TS)] batch $BATCH_NO -> DID NOT RUN ($1) · ${exp} test(s) counted as did-not-run  (log: $stub)"
}

for BATCH_SPECS in "${BATCHES[@]}"; do
  read -r -a BATCH <<< "$BATCH_SPECS"
  BATCH_NO=$(( BATCH_NO + 1 )); attempt=1
  # Collected BEFORE the reset/server steps: `--list` needs neither a DB nor a server,
  # and the failure paths above must be able to report how many tests they skipped.
  exp=$(expected_tests "${BATCH[@]}"); exp=${exp:-0}
  # Vector B: an unknown collected size is NOT zero. Announce the guess and red the batch —
  # coverage for it cannot be reconciled, so nothing about it is proven. (Rationale and the
  # measured false green: the `expected_tests` header above.)
  exp_guessed=0
  if [ "$exp" = "0" ]; then
    exp_guessed=1
    EXP_UNKNOWN_BATCHES=$(( EXP_UNKNOWN_BATCHES + 1 ))
    [ "$BATCH_TESTS" -gt 0 ] && exp=$BATCH_TESTS
    echo "[$(LOG_TS)] batch $BATCH_NO -> !! \`--list\` produced NO test count. This batch's collected size is UNKNOWN;"
    echo "[$(LOG_TS)]    using fallback exp=${exp} (a GUESS, from BATCH_TESTS). Coverage for this batch cannot be"
    echo "[$(LOG_TS)]    reconciled, so it is reported RED as list-failed. Re-run it before declaring the phase green."
  fi
  while : ; do
    echo "=================================================================="
    echo "[$(LOG_TS)] BATCH $BATCH_NO$( [ "$attempt" -gt 1 ] && echo ' · INFRA RE-RUN' ) (fresh server$( [ "$RESET" = 1 ] && echo ' + fresh DB' )): ${BATCH[*]##*/}"
    echo "=================================================================="
    if [ "$RESET" = "1" ]; then
      # FUP-GATE-RESET-FLAKE: this used to be `>/dev/null 2>&1`, so when the reset
      # failed transiently the CAUSE was unrecoverable from the logs — two consecutive
      # full gates each lost a whole batch (61 and 56 tests) with nothing to diagnose.
      # Keep the output. The retry is ONE attempt and is logged loudly on BOTH sides:
      # a silent retry would mask the very transient we are trying to characterise, so
      # attempt 1's stderr is always printed even when attempt 2 succeeds.
      RESETLOG="$GATE_LOGDIR/reset-batch-$BATCH_NO.log"
      if ! supabase db reset --local >"$RESETLOG" 2>&1; then
        echo "[$(LOG_TS)] batch $BATCH_NO -> reset FAILED (attempt 1) — output follows (log: $RESETLOG)"
        tail -25 "$RESETLOG"
        echo "[$(LOG_TS)] batch $BATCH_NO -> retrying reset once"
        if ! supabase db reset --local >"${RESETLOG%.log}-retry.log" 2>&1; then
          echo "[$(LOG_TS)] batch $BATCH_NO -> reset FAILED (attempt 2) — output follows"
          tail -25 "${RESETLOG%.log}-retry.log"
          abort_batch reset; continue 2
        fi
        echo "[$(LOG_TS)] batch $BATCH_NO -> reset RECOVERED on retry (attempt 1's output above is the transient — diagnose it)"
      fi
    fi
    # NEVER "WARN … proceeding" (the old behaviour): a degraded stack yields batches of
    # net::ERR_CONNECTION_REFUSED that then need hand-triage against a folklore baseline
    # — 8 of 12 batches in one ETH-E3a run. Abort loudly instead of emitting garbage.
    preflight "batch $BATCH_NO" || { echo "GATE ABORTED — stack unrecoverable"; finish 4 "GATE ABORTED at batch $BATCH_NO — stack unrecoverable. NOT a test result: nothing was proven."; }
    if ! start_server; then
      echo "[$(LOG_TS)] server FAILED to start (server log: $SERVER_LOG)"; tail -20 "$SERVER_LOG"
      abort_batch server; stop_server; continue 2
    fi
    sleep 4
    BLOG="$GATE_LOGDIR/batch-$BATCH_NO.log"
    [ "$attempt" -gt 1 ] && BLOG="$GATE_LOGDIR/batch-$BATCH_NO-rerun.log"

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
    pgrst=$(pgrst_unready "$BLOG"); pgrst=${pgrst:-0}
    parsed=$(( p + f + fl + sk ))
    infra=0
    if [ "$f" -gt 0 ] && { [ "$srv_dead" = "1" ] || [ "$conn" -ge "$f" ]; }; then infra=1; fi
    # FUP-QO-9(a): a schema-cache race fails ASSERTIONS (the page renders an error), so
    # `conn >= f` never fires for it. Same floor logic, different signature.
    if [ "$f" -gt 0 ] && [ "$pgrst" -ge "$f" ]; then infra=1; fi
    # FUP-QO-9(b): a batch that crashed WITHOUT producing a summary (exit 127, a dead
    # toolchain, a segfault) parsed nothing at all, so `f` is 0 and every classifier
    # above is vacuous. It was still RED — `exit$pw_rc`, `no-summary` and `count` all
    # catch it below, so this was never a false green — but it was never auto-RETRIED
    # either, which is what actually costs a batch. Retry it; the redness is unaffected.
    if [ "$parsed" = "0" ] && [ "$pw_rc" != "0" ]; then infra=1; fi

    if [ "$infra" = "1" ]; then
      echo "[$(LOG_TS)] batch $BATCH_NO -> $( [ "$parsed" = "0" ] && echo "CRASHED with no summary (exit ${pw_rc}), ${exp} test(s) unrun" || echo "${f} failures" ) classified INFRA, not defects (server_dead=${srv_dead}, conn_errors=${conn}, pgrst_unready=${pgrst})"
      # FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH: surface the SERVER side here,
      # not only on start failure. Every reading available in the two 2026-08-25 collapses
      # was client-side (`page.goto: net::ERR` ×33, server_dead=1, conn_errors=33, zero
      # assertion failures) — all of which say "the server was gone" and none of which says
      # WHY. Three causes are indistinguishable from outside and prescribe opposite
      # remedies: a V8 heap ceiling (--max-old-space-size), plain capacity (BATCH_SIZE=4),
      # or ⛔ an unhandled exception in APP CODE — which is a product DEFECT that this
      # classifier books as INFRA indefinitely. Only the server log separates them.
      # ⚠ `Error: The destination stream closed early` is NOT a death signature: it appears
      # in healthy passing batches (a client aborting a response mid-flight).
      echo "[$(LOG_TS)]   server log RETAINED at: $SERVER_LOG"
      tail -40 "$SERVER_LOG" 2>/dev/null | sed 's/^/[srv] /'
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
    # A zero-summary crash reports the UNRUN count, not `0 failed` — "infra-unproven(0)"
    # would read as "nothing wrong here" for a batch where nothing ran at all.
    if [ "$parsed" = "0" ]; then
      reasons="$reasons,infra-crash(exit$pw_rc; $exp unrun)"
    else
      reasons="$reasons,infra-unproven($f)"
    fi
  else
    [ "$f"  != "0" ] && reasons="$reasons,failed"
  fi
  [ "$pw_rc" != "0" ] && [ "$f" = "0" ] && reasons="$reasons,exit$pw_rc"   # crashed with no failure line
  [ "$(( p + f + fl + sk ))" = "0" ] && reasons="$reasons,no-summary"      # nothing parsed at all
  [ "$dnr"  != "0" ] && reasons="$reasons,did-not-run($dnr)"               # serial-mode masking
  [ "$intr" != "0" ] && reasons="$reasons,interrupted($intr)"
  [ "$exp" != "0" ] && [ "$accounted" != "$exp" ] && reasons="$reasons,count($accounted/$exp)"
  # Vector B: an unreconcilable batch is red on its own, whatever the counts happen to say.
  [ "$exp_guessed" = "1" ] && reasons="$reasons,list-failed(exp guessed $exp)"
  [ -n "$reasons" ] && RED_BATCHES="$RED_BATCHES b$BATCH_NO(${reasons#,})"

  echo "[$(LOG_TS)] batch $BATCH_NO -> ${p} passed, ${f} failed$( [ "$infra" = "1" ] && echo ' (INFRA)' ), ${fl} flaky, ${sk} skipped, ${dnr} did-not-run · accounted ${accounted}/${exp} · pw_exit ${pw_rc}  (log: $BLOG · server: $SERVER_LOG)"
  stop_server; sleep 1
done

echo "=================================================================="
TOTAL_SEEN=$(( TOTAL_PASS + TOTAL_FAIL + TOTAL_INFRA + TOTAL_FLAKY + TOTAL_DNR ))
echo "[$(LOG_TS)] GATE SUMMARY: ${TOTAL_PASS} passed · ${TOTAL_FAIL} failed · ${TOTAL_INFRA} infra · ${TOTAL_FLAKY} flaky · ${TOTAL_DNR} did-not-run · ${BATCH_NO} batches"
echo "[$(LOG_TS)] COVERAGE: accounted for ${TOTAL_SEEN} of ${TOTAL_EXPECTED} collected tests"
[ "$INFRA_RERUNS" -gt 0 ] && echo "[$(LOG_TS)] INFRA re-runs performed: ${INFRA_RERUNS}"
# Say it in words. The coverage line above is now arithmetically honest, but "931 of
# 931" with a did-not-run count buried mid-line is exactly the shape a tired reader
# skims past — and unrun tests are the one failure mode that looks BETTER than normal.
[ "$TOTAL_DNR" -gt 0 ] && echo "[$(LOG_TS)] !! ${TOTAL_DNR} test(s) NEVER RAN — nothing is proven for them. Re-run the batch(es) named below before declaring green."
# Say it about the DENOMINATOR too. The coverage line reads as authoritative; if any batch's
# collected size had to be guessed it is not (vector B).
[ "$EXP_UNKNOWN_BATCHES" -gt 0 ] && echo "[$(LOG_TS)] !! ${EXP_UNKNOWN_BATCHES} batch(es) had an UNKNOWN collected-test count (\`--list\` failed). The COVERAGE denominator above CONTAINS A GUESS and is not authoritative."
[ -n "$RED_BATCHES" ] && echo "  batches with failures:$RED_BATCHES  (logs in $GATE_LOGDIR)"
# The exit code is written by THIS script, so a reader never has to depend on the launching
# wrapper having survived the run (FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH,
# second finding: that wrapper was reaped in both full runs of 2026-08-25).
echo "[$(LOG_TS)] exit code + verdict recorded at: $GATE_EXIT_FILE  ·  per-batch server logs: $GATE_LOGDIR/server-batch-N.log"
echo "=================================================================="
if [ "$TOTAL_FAIL" = "0" ] && [ -z "$RED_BATCHES" ]; then echo "GATE GREEN"; finish 0 "GATE GREEN — ${TOTAL_PASS} passed, ${TOTAL_FLAKY} flaky, accounted ${TOTAL_SEEN}/${TOTAL_EXPECTED}"; fi

# Three distinct RED verdicts. Collapsing them is what made a dead server read as a
# 53-defect regression, and (worse, over time) trains readers to shrug at real reds.
#
# UNRUN is checked FIRST and stated in its own words: with zero assertion failures the
# old code fell through to "GATE RED — 0 real failure(s)", which reads as a formatting
# glitch rather than "a whole batch never executed" (BUG-GATE-001).
if [ "$TOTAL_FAIL" = "0" ] && [ "$TOTAL_DNR" -gt 0 ]; then
  echo "GATE RED (UNRUN) — ${TOTAL_DNR} test(s) never executed; zero assertion failures were observed."
  echo "  NOT a green run and NOT a regression signal: those tests were never given a chance"
  echo "  to fail. Re-run the batch(es) listed above before declaring the phase green."
  finish 5 "GATE RED (UNRUN) — ${TOTAL_DNR} test(s) never executed; 0 assertion failures observed. NOT green, NOT a regression signal."
fi
if [ "$TOTAL_FAIL" = "0" ] && [ "$TOTAL_INFRA" -gt 0 ]; then
  echo "GATE RED (INFRA) — ${TOTAL_INFRA} test(s) never got a working server, even after a re-run."
  echo "  NOT a regression signal: zero assertion failures were observed. Nothing is proven for"
  echo "  those tests either — re-run the named batch(es) before declaring the phase green."
  finish 5 "GATE RED (INFRA) — ${TOTAL_INFRA} test(s) never got a working server. NOT green, NOT a regression signal."
fi
echo "GATE RED — ${TOTAL_FAIL} real failure(s)$( [ "$TOTAL_INFRA" -gt 0 ] && echo " (plus ${TOTAL_INFRA} infra, already classified)" )."
echo "  Infra noise is now classified automatically; anything counted above is an assertion"
echo "  failure. Still worth checking the flaky baseline (memory e2e-prod-build-flaky-baseline)."
finish 1 "GATE RED — ${TOTAL_FAIL} real failure(s), ${TOTAL_INFRA} infra, ${TOTAL_DNR} did-not-run, accounted ${TOTAL_SEEN}/${TOTAL_EXPECTED}"
