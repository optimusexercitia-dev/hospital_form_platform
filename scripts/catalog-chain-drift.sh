#!/usr/bin/env bash
# CHAIN-VS-STACK DRIFT CHECK -- FUP-AE2-CATALOG-SUPERSET-OF-CHAIN's positive control.
#
# Answers the ONE question no other gate in this repo can ask: does the migration chain
# actually PRODUCE the catalog every other gate is reading? Every arm, pgTAP and the door
# sweep read the live catalog, so a hand-applied migration makes all of them green against
# a schema a fresh reset would not reproduce.
#
#   ./scripts/catalog-chain-drift.sh            capture -> db reset -> capture -> diff
#   ./scripts/catalog-chain-drift.sh --prove    the above, PLUS the vacuity proof
#
# ⛔ THIS RESETS THE LOCAL DATABASE. The local stack has ONE OWNER at a time -- a reset
#    lands silently in another session's evidence. Check pg_stat_activity first (the
#    script does) and announce it in PROGRESS.md § Now while a phase is in test.
#
# EXIT: 0 = chain reproduces the stack . 1 = DRIFT (a finding, never a pass)
#       2 = harness could not measure (never read as clean)
set -uo pipefail

DB="${DB_CONTAINER:-supabase_db_azkbbhskturikxpgmafq}"
FP_SQL="$(dirname "$0")/catalog-fingerprint.sql"
OUT="${OUT_DIR:-${TMPDIR:-/tmp}/catalog-drift}"
mkdir -p "$OUT"

die() { echo "‼ $*" >&2; exit 2; }
[ -f "$FP_SQL" ] || die "fingerprint SQL not found: $FP_SQL"
docker inspect "$DB" >/dev/null 2>&1 || die "container '$DB' is not running (set DB_CONTAINER)"

fingerprint() { # $1 = out file. ON_ERROR_STOP is load-bearing: without it a failing
                # section is SKIPPED, psql still exits 0, and the diff reads clean.
  docker exec -i "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 \
    < "$FP_SQL" > "$1" 2>"$1.err"
  local rc=$?
  [ $rc -eq 0 ] || { echo "--- psql stderr ---" >&2; cat "$1.err" >&2; die "fingerprint failed (rc=$rc)"; }
  [ -s "$1" ] || die "fingerprint is EMPTY -- an empty file diffs clean against nothing"
  # A section that vanished would narrow the domain silently. Assert all nine.
  local kinds; kinds=$(awk -F'|' '{print $1}' "$1" | sort -u | wc -l | tr -d ' ')
  [ "$kinds" -eq 9 ] || die "expected 9 fingerprint sections, got $kinds -- domain narrowed"
}

echo "== holders of the local DB (a dev server or Playwright webServer half-applies a reset) =="
docker exec "$DB" psql -U postgres -d postgres -c \
  "select coalesce(nullif(application_name,''),'(none)') as app, usename, count(*)
     from pg_stat_activity where datname='postgres' and pid <> pg_backend_pid()
    group by 1,2 order by 3 desc;" || die "could not read pg_stat_activity"

echo "== 1/3 capturing the WORKING STACK =="
fingerprint "$OUT/fp-STACK.txt"
echo "   $(wc -l < "$OUT/fp-STACK.txt") rows"

echo "== 2/3 rebuilding from the chain (supabase db reset --local) =="
supabase db reset --local > "$OUT/reset.log" 2>&1
RESET_RC=$?
[ $RESET_RC -eq 0 ] || { tail -20 "$OUT/reset.log" >&2; die "db reset failed (rc=$RESET_RC)"; }

echo "== 3/3 capturing the CHAIN-BUILT catalog =="
fingerprint "$OUT/fp-CHAIN.txt"
echo "   $(wc -l < "$OUT/fp-CHAIN.txt") rows"

if [ "${1:-}" = "--prove" ]; then
  echo "== VACUITY PROOF -- the probe must MOVE the fingerprint and the restore must bring it BACK =="
  TARGET="app._cap_bit(text)"   # explicit non-null ACL, no anon grant: a revoke restores it exactly.
                                # ⛔ never probe a NULL-proacl function -- NULL includes PUBLIC, and
                                # the grant materialises an ACL the revoke cannot un-materialise.
  docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 \
    -c "grant execute on function $TARGET to anon;" || die "probe grant failed"
  fingerprint "$OUT/fp-PROBE.txt"
  if diff -q "$OUT/fp-CHAIN.txt" "$OUT/fp-PROBE.txt" >/dev/null; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "revoke execute on function $TARGET from anon;" >/dev/null 2>&1
    die "CONTROL IS VACUOUS -- injected drift was NOT detected. Every verdict below is worthless."
  fi
  echo "   probe detected:"; diff "$OUT/fp-CHAIN.txt" "$OUT/fp-PROBE.txt" | sed 's/^/     /'
  docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 \
    -c "revoke execute on function $TARGET from anon;" || die "probe REVOKE failed -- residue left in the catalog"
  fingerprint "$OUT/fp-RESTORED.txt"
  diff -q "$OUT/fp-CHAIN.txt" "$OUT/fp-RESTORED.txt" >/dev/null \
    || { diff "$OUT/fp-CHAIN.txt" "$OUT/fp-RESTORED.txt" >&2; die "probe left RESIDUE -- run supabase db reset"; }
  echo "   restored clean. The control is proven able to fail."
fi

echo "== VERDICT =="
if diff -q "$OUT/fp-STACK.txt" "$OUT/fp-CHAIN.txt" >/dev/null; then
  echo "CLEAN -- the chain reproduces the working stack ($(wc -l < "$OUT/fp-CHAIN.txt") rows, 9 sections)."
  exit 0
fi
echo "DRIFT -- the working stack is NOT what the chain builds. Lines '<' are STACK-only"
echo "(the superset: objects nothing in supabase/migrations/ produces); '>' are CHAIN-only."
echo "⛔ Every gate figure captured on the pre-reset stack is INADMISSIBLE."
diff "$OUT/fp-STACK.txt" "$OUT/fp-CHAIN.txt"
exit 1
