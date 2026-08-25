#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Keystone for scripts/lib/netstat-listener-pids.awk — the selector behind
# `free_port()` in scripts/e2e-prod-gate.sh.
#
#   bash scripts/test-netstat-listener-pids.sh      # ~1s, no DB, no server, no gate run
#
# It runs against CAPTURED REAL `netstat -ano` output, not hand-written rows. Provenance:
#
#   fixtures/netstat-listener-present.txt
#       Captured 2026-08-25 on the dev Windows host while a node TCP server LISTENED on
#       127.0.0.1:39001 (pid 6540) with one client connected (pid 22616, ephemeral 60826).
#       So port 39001 appears in the LOCAL column of a listening row (6540), in the LOCAL
#       column of a non-listening row (6540, ESTABLISHED), and in the FOREIGN column of the
#       client's row (22616) — all three columns the old selector conflated.
#
#   fixtures/netstat-foreign-match-only.txt
#       The SAME two processes ~5s later, after the server called `server.close()` and
#       half-closed the connection while staying alive. No listener on 39001 remains; the
#       port survives only as a FOREIGN address on the client's CLOSE_WAIT row (22616) and
#       as the LOCAL address of a FIN_WAIT_2 row (6540) that is not listening. This is the
#       shape that made `taskkill //F` kill Playwright workers.
#
#   fixtures/netstat-locale-pt-br.txt
#       Derived from the first fixture by substituting ONLY the State token
#       (LISTENING -> ESCUTANDO, etc). Column layout is real captured bytes; the point is
#       that a localized State word must change nothing. (The substitution also shifts the
#       pid column by one character, which is deliberate: nothing may depend on offsets.)
#
# Both real captures were reduced to loopback/wildcard rows before committing (the host's
# LAN and internet peers are not fixture material). Every row below is otherwise verbatim.
#
# ⭐ POSITIVE CONTROL IS MANDATORY HERE. A parser that returns nothing for every input
# satisfies every "must be empty" case, so each negative case below is paired with a
# positive one, and the OLD selector is re-run on the same fixtures to prove the fixtures
# can actually reach the failing state.
# ---------------------------------------------------------------------------
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# NETSTAT_AWK exists so a MUTANT copy can be pointed at without editing the production
# file in place. Every assertion group below was proven able to red that way; see the
# mutation table in docs/testing/e2e-prod-build-gate.md.
AWKP="${NETSTAT_AWK:-$HERE/lib/netstat-listener-pids.awk}"
FIX="$HERE/lib/fixtures"
TMP="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/netstat-keystone-$$")"
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

[ -f "$AWKP" ] || { echo "FATAL: $AWKP not found"; exit 2; }

FAILED=0
PASSES=0

# the selector under test
new() { awk -v port="$2" -f "$AWKP" < "$1" | sort -n | tr '\n' ' ' | sed 's/ *$//'; }
# the selector as it stood before this fix — kept ONLY to prove the fixtures reach the bug
old() { grep ":$2 " "$1" | awk '{print $NF}' | sort -n -u | tr '\n' ' ' | sed 's/ *$//'; }

check() { # $1 = label, $2 = got, $3 = want
  if [ "$2" = "$3" ]; then printf '  ok    %-56s -> [%s]\n' "$1" "$2"; PASSES=$(( PASSES + 1 ))
  else printf '  FAIL  %-56s -> got [%s]  want [%s]\n' "$1" "$2" "$3"; FAILED=1; fi
}
check_has() { # $1 = label, $2 = got, $3 = substring that MUST be present
  case " $2 " in *" $3 "*) printf '  ok    %-56s -> [%s] contains %s\n' "$1" "$2" "$3"; PASSES=$(( PASSES + 1 ));;
    *) printf '  FAIL  %-56s -> [%s] is MISSING %s\n' "$1" "$2" "$3"; FAILED=1;; esac
}

A="$FIX/netstat-listener-present.txt"
B="$FIX/netstat-foreign-match-only.txt"
L="$FIX/netstat-locale-pt-br.txt"
for f in "$A" "$B" "$L"; do [ -f "$f" ] || { echo "FATAL: fixture $f not found"; exit 2; }; done

echo "== 0. fixture validity — the OLD selector must FAIL on these, or they prove nothing =="
# If these two ever go quiet, the fixtures stopped reaching the defect and every assertion
# below becomes vacuous. 22616 is the CLIENT pid: the old selector hands it to taskkill.
check_has "OLD selector, listener present, port 39001" "$(old "$A" 39001)" "22616"
check     "OLD selector, NO listener at all, port 39001" "$(old "$B" 39001)" "6540 22616"

echo
echo "== 1. positive control — a real listener must be FOUND (else 'empty' proves nothing) =="
check "listener present, port 39001"                 "$(new "$A" 39001)" "6540"
check "multi-pid IPv4+IPv6 listener, port 3010"      "$(new "$A" 3010)"  "19336 20400"
check "single listener on a nearby port, 53000"      "$(new "$A" 53000)" "5328"

echo
echo "== 2. the defect — a FOREIGN-column match must yield ZERO pids =="
check "no listener, only foreign + FIN_WAIT_2, 39001" "$(new "$B" 39001)" ""
# Port 3000 in the capture is the real gate port with 9 foreign-column TIME_WAIT rows and
# one local-column TIME_WAIT row, and NO listener. The old selector returns pid 0 here.
check "real port 3000, 10 TIME_WAIT rows, no listener" "$(new "$A" 3000)" ""

echo
echo "== 3. exact port matching (no substring/prefix bleed) =="
check "3000 must not return the :53000 listener (5328)" "$(new "$A" 3000)"   ""
check "port 900 must not match :39001 or :53000"        "$(new "$A" 900)"    ""
check "port 390010 (superstring) matches nothing"       "$(new "$A" 390010)" ""
check "port 001 (suffix of 39001) matches nothing"      "$(new "$A" 001)"    ""

echo
echo "== 4. locale independence — the State word is never read =="
check "pt-BR ESCUTANDO, port 39001"  "$(new "$L" 39001)" "6540"
check "pt-BR, port 3010"             "$(new "$L" 3010)"  "19336 20400"
check "pt-BR, foreign-only port 3000" "$(new "$L" 3000)" ""

echo
echo "== 5. CRLF input (netstat's real line ending) =="
sed 's/$/\r/' "$A" > "$TMP/crlf.txt"
check "CRLF fixture, port 39001"     "$(new "$TMP/crlf.txt" 39001)" "6540"
check "CRLF fixture, port 3010"      "$(new "$TMP/crlf.txt" 3010)"  "19336 20400"

echo
echo "== 6. a missing port must ERROR, never return silently empty =="
awk -f "$AWKP" < "$A" >/dev/null 2>&1; rc=$?
check "no -v port -> exit 2" "$rc" "2"

echo
if [ "$FAILED" = "0" ]; then
  echo "netstat-listener-pids: OK — $PASSES assertions passed"
  exit 0
fi
echo "netstat-listener-pids: FAILED"
exit 1
