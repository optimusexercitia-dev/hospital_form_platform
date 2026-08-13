#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078; the no-regression-twin trap). A test that cannot fail is not
# evidence. Run from the repo root against a local stack:
#   bash supabase/tests/mutation/be3-cast-vote-mutation-audit.sh
# Every keystone must read RED-PROVEN, and the AUTHORITY keystone must stay GREEN under
# the exclusion mutation (proving authority and exclusion are separable — the whole point
# of the distinct 42501/HC0J5 codes).
#
# BE-3 MUTATION AUDIT — public.cast_case_vote, the E1-consumption vote-exclusion door.
#
# Keystones (254_ethics_e2_votes.sql):
#   • the respondent member is refused with HC0J5   — neutralize is_case_respondent
#   • the recused member is refused with HC0J5      — neutralize is_recused_from_case
#     (one 'exclusion' mutation neutralizes BOTH → both go RED together)
#   • a duplicate vote is refused with HC0J4        — drop the unique constraint
#   • a non-member is refused with 42501 not HC0J5  — AUTHORITY; must STAY GREEN under
#     the exclusion mutation (it is a separate branch above the exclusion).
#
# Harness lessons inherited from m1/m5/m6 (each HID A REAL RESULT): match by LABEL not
# number; tri-state RED/GREEN/ABSENT (red != abort); ASCII-only patterns (no interpunct/
# curly quotes); head/tail never `awk -v` (BSD awk breaks on multi-line -v). The reverter
# regenerates from LIVE pg_get_functiondef, never migration text.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/254_ethics_e2_votes.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_false(uuid, uuid) returns boolean
  language sql immutable as $m$ select false $m$;
create or replace function app._mut_revert(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  if p_what = 'exclusion' then
    -- Neutralize BOTH exclusion arms → a recused/respondent member passes the gate.
    d := replace(d, 'app.is_recused_from_case(', 'app._mut_false(');
    d := replace(d, 'app.is_case_respondent(',   'app._mut_false(');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutbe3.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found ***\n' "$label"; return; fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutbe3.sql" >/dev/null
  local out; out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutbe3.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN";
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-52s %s\n' "$label" "$verdict"
  # Side-check: the AUTHORITY keystone must stay GREEN under the exclusion mutation.
  if [ "$label" = "exclusion (HC0J5 x2)" ]; then
    if echo "$out" | grep -qE "^ok [0-9]+ - .*a non-member is refused with 42501 not HC0J5"; then
      printf '%-52s %s\n' "  +authority stays GREEN (separable)" "OK"
    else
      printf '%-52s %s\n' "  +authority stays GREEN (separable)" "*** FAILED — authority not green ***"
    fi
  fi
}

PGTAP_WAS=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap with schema extensions;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop function if exists app._mut_false(uuid,uuid);" \
    -c "drop function if exists app._mut_revert(text,text);" >/dev/null 2>&1
  [ "${PGTAP_WAS:-0}" = "0" ] && docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
}
trap cleanup EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_be3_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_be3_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable. Aborting."; exit 1; fi

echo "=== BE-3 MUTATION AUDIT — each keystone must go RED when ITS gate is neutralized ==="
echo

run_case "exclusion (HC0J5 x2)" \
  "select app._mut_revert('public.cast_case_vote(uuid,text,text)', 'exclusion');" \
  "the respondent member is refused with HC0J5|the recused member is refused with HC0J5"

run_case "unique (HC0J4)" \
  "alter table public.case_votes drop constraint case_votes_decision_voter_uniq;" \
  "a duplicate vote is refused with HC0J4"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN ==="
{ head -n "$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)" "$SRC";
  tail -n +$(( $(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1) + 1 )) "$SRC"; } > "$WORK/ctlbe3.sql"
docker cp "$WORK/ctlbe3.sql" "$DB:/tmp/ctlbe3.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctlbe3.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
