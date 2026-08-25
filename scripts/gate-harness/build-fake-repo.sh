#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build a THROWAWAY repo in which the real scripts/e2e-prod-gate.sh can be run against
# shell doubles. Used by the two keystones beside this file. Not run directly.
#
#   bash scripts/gate-harness/build-fake-repo.sh <target-dir> <real-repo-root>
#
# WHAT IT NEEDS: bash, node, awk. ⛔ It touches NO real port, NO Docker container and NO
# database — `docker`, `supabase`, `npx`, `npm`, `curl` and `node .next/standalone/server.js`
# are all replaced by shims on PATH, and the callers pass RESET=0 plus a PORT nothing binds.
#
# ⚠ TWO TRAPS THAT COST AN HOUR EACH, both silent:
#  1. PATH entries must be POSIX. Exporting `PATH="C:/…/bin:$PATH"` splits on the drive
#     colon, so the shims are skipped and the REAL npx/docker/supabase run — meaning a real
#     `npx playwright test` against the real stack. The callers use `cygpath -u` and then
#     ASSERT every shim resolves inside the fake bin before running anything.
#  2. Capture the real `node` path ONCE, before any PATH mutation. Re-deriving it after a
#     previous scenario put its shim dir on PATH resolves `node` to the PREVIOUS shim, whose
#     own `exec "$REAL_NODE"` then points back at itself — an infinite exec loop.
# ---------------------------------------------------------------------------
set -u
T="$1"; REAL="$2"
rm -rf "$T" 2>/dev/null
mkdir -p "$T/scripts/lib" "$T/bin" "$T/state" \
         "$T/.next/standalone/.next" "$T/.next/standalone/.next/static" "$T/.next/standalone/public" \
         "$T/.next/static" "$T/public" "$T/e2e" "$T/node_modules/next" "$T/logs"

# The code under test is COPIED, not reimplemented; the callers `cmp` it against the real
# file so a stale copy cannot quietly pass.
cp "$REAL/scripts/e2e-prod-gate.sh" "$T/scripts/e2e-prod-gate.sh"
cp "$REAL/scripts/lib/netstat-listener-pids.awk" "$T/scripts/lib/"

cat > "$T/.env.local" <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=fake-anon-key
EOF
printf '{"dependencies":{"next":"16.9.9"}}\n' > "$T/package.json"
printf '{"version":"16.9.9"}\n' > "$T/node_modules/next/package.json"
printf 'console.log("replaced by the node shim");\n' > "$T/.next/standalone/server.js"
printf 'fakeBuildId0001\n' > "$T/.next/standalone/.next/BUILD_ID"
printf 'x\n' > "$T/.next/static/x"; printf 'x\n' > "$T/public/x"
printf '// fake\n' > "$T/e2e/a.spec.ts"; printf '// fake\n' > "$T/e2e/b.spec.ts"

# ---------------- the fake standalone server ----------------
# Starts, marks itself up, dies noisily when the scenario says so — writing the death
# message to ITS OWN STDOUT, i.e. into whatever file the gate redirected it to.
cat > "$T/bin/fake-server.sh" <<'EOF'
#!/usr/bin/env bash
S="$FAKE_STATE"
inst=$(( $(cat "$S/srv_n" 2>/dev/null || echo 0) + 1 )); echo "$inst" > "$S/srv_n"
FAKE_INSTANCE="$inst"
# SRV_MODE: alive (default) | die-now (exits at once, as an EADDRINUSE death does)
if [ "${SRV_MODE:-alive}" = "die-now" ]; then
  echo "Error: listen EADDRINUSE: address already in use 0.0.0.0:$PORT"
  echo "SERVER_INSTANCE=$FAKE_INSTANCE"
  touch "$S/srv_gone"     # lets the curl double wait for the death instead of racing it
  exit 1
fi
echo "   Next.js 16.9.9 (standalone)"
echo "   - Local:   http://localhost:$PORT"
echo "   Ready in 412ms"
echo "SERVER_INSTANCE=$FAKE_INSTANCE"
touch "$S/up"
WATCHDOG=$(( $(date +%s) + 150 ))   # an orphan must never outlive the harness
while : ; do
  [ "$(date +%s)" -gt "$WATCHDOG" ] && { echo "WATCHDOG_EXIT instance=$FAKE_INSTANCE"; rm -f "$S/up"; exit 3; }
  if [ -f "$S/die" ]; then
    # A real V8 heap death DOES print before the process goes. This is what the retention
    # assertions look for.
    echo ""
    echo "<--- Last few GCs --->"
    echo "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory"
    echo "DEATH_MARKER_INSTANCE=$FAKE_INSTANCE"
    rm -f "$S/up"
    exit 134
  fi
  sleep 0.2
done
EOF

# ---------------- doubles ----------------
cat > "$T/bin/node" <<'EOF'
#!/usr/bin/env bash
case " $* " in
  *".next/standalone/server.js"*) exec bash "$FAKE_BIN/fake-server.sh" ;;
esac
exec "$REAL_NODE" "$@"
EOF

# CURL_LOGIN : up-file (default) | always (a FOREIGN server answers no matter what)
#            | after-server-gone
# ⚠ `after-server-gone` is what makes vector A1 DETERMINISTIC IN BOTH DIRECTIONS. The probe
# blocks until the spawned server has actually died, then answers 200 as a foreign listener
# would. The FIXED gate checks liveness (either in the wait loop or in the identity check)
# and must go RED; the PRE-FIX gate returns 0 on this very probe without ever checking
# liveness and must go GREEN. An earlier attempt used "fail the first probe" for determinism
# — that handed the PRE-FIX loop a free `kill -0`, so BOTH went red and the differential was
# meaningless. The keystone caught it; do not reintroduce that shape.
# CURL_NONCE : staged (default, the real staged nonce, HTTP 200)
#            | wrong    -> a NONCE-SHAPED body with a different token => HARD FAIL
#            | redirect -> HTTP 307 + `/login?redirect=...` (the ADR-0007 auth gate)
#            | html     -> an HTML 404 page      | none -> empty body
# The last three are NOT nonce-shaped and must ALL come out INCONCLUSIVE. `redirect` is the
# exact response a REAL build gave the first version of this arm (measured: HTTP 307, body
# `/login?redirect=%2F__gate-nonce.txt`), which it mis-read as "a different nonce" and
# hard-failed a healthy server on. Each reply is body, newline, status - the arm captures
# `-w '\n%{http_code}'`.
cat > "$T/bin/curl" <<'EOF'
#!/usr/bin/env bash
S="$FAKE_STATE"
case " $* " in
  *"/auth/v1/token"*|*"/auth/v1/health"*) printf '200'; exit 0 ;;
  *"/rest/v1/"*) printf '{"swagger":"2.0"}'; exit 0 ;;
  *"__gate-nonce.txt"*)
    case "${CURL_NONCE:-staged}" in
      wrong)    printf 'gate11111-b9-a9-1700000000 build=someOtherBuildId\n200\n' ;;
      redirect) printf '/login?redirect=%%2F_next%%2Fstatic%%2F__gate-nonce.txt\n307\n' ;;
      html)     printf '<!DOCTYPE html><html><body>404: This page could not be found</body></html>\n404\n' ;;
      none)     printf '\n000\n' ;;
      *)        printf '%s\n200\n' "$(cat "$FAKE_ROOT/.next/standalone/.next/static/__gate-nonce.txt" 2>/dev/null)" ;;
    esac
    exit 0 ;;
  *"/login"*)
    case "${CURL_LOGIN:-up-file}" in
      always) exit 0 ;;
      after-server-gone)
        i=0; while [ ! -f "$S/srv_gone" ] && [ "$i" -lt 100 ]; do sleep 0.1; i=$(( i + 1 )); done
        sleep 0.5      # let the OS reap it, so a later `kill -0` is definitive, not racy
        exit 0 ;;
      *) [ -f "$S/up" ] && exit 0; exit 7 ;;
    esac ;;
esac
exit 0
EOF

cat > "$T/bin/docker" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  ps)      echo "supabase_db_testref"; exit 0 ;;
  inspect) case " $* " in *RestartCount*) echo 0;; *StartedAt*) echo "2026-01-01T00:00:00Z";; esac; exit 0 ;;
esac
exit 0
EOF

cat > "$T/bin/taskkill" <<'EOF'
#!/usr/bin/env bash
echo "taskkill $*" >> "$FAKE_STATE/taskkill.log"   # record, never actually kill
exit 0
EOF

printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/supabase"
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/npm"

# npx playwright: --list emits a collectable count (or fails, for vector B); a run delegates
# to the scenario step so each keystone controls what the batch does.
cat > "$T/bin/npx" <<'EOF'
#!/usr/bin/env bash
S="$FAKE_STATE"
case " $* " in
  *" --list "*|*" --list")
    if [ "${LIST_MODE:-ok}" = "fail" ]; then echo "Error: could not collect tests" >&2; exit 1; fi
    n="$(cat "$S/exp")"
    i=1; while [ "$i" -le "$n" ]; do echo "  a.spec.ts:$i:5 [chromium] t$i"; i=$(( i + 1 )); done
    echo "Total: $n tests in 1 file"
    exit 0 ;;
  *"supabase"*) exit 0 ;;
esac
k=$(( $(cat "$S/run_n" 2>/dev/null || echo 0) + 1 )); echo "$k" > "$S/run_n"
bash "$S/scenario.sh" "$k"
EOF

chmod +x "$T/bin/"* 2>/dev/null || true
