#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence. Run from repo root:
#   bash supabase/tests/mutation/be4-hearing-roster-mutation-audit.sh
# Every keystone must read RED-PROVEN.
#
# BE-4 MUTATION AUDIT — the participants_only hearing roster (schedule_ethics_hearing).
#
# The hearing's isolation is: roster = app.eligible_voters (members − recused − respondent),
# and Stage C's can_reach_meeting denies a NON-ROSTER member. So widening the roster
# (neutralizing an exclusion in eligible_voters) rosters an excluded member → they reach the
# hearing meeting → the "reads ZERO of the hearing meeting" keystone in 256 goes RED.
#   • recusal    — neutralize app.is_recused_from_case → the recused member is rostered
#   • respondent — neutralize app.is_case_respondent   → the respondent is rostered
#
# Harness lessons (m1/m5/m6): match by LABEL not number; tri-state RED/GREEN/ABSENT;
# ASCII-only patterns; head/tail never `awk -v`; regenerate from LIVE pg_get_functiondef.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/256_ethics_e2_hearings.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_false(uuid, uuid) returns boolean
  language sql immutable as $m$ select false $m$;
create or replace function app._mut_revert(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  if p_what = 'recusal' then
    d := replace(d, 'app.is_recused_from_case(', 'app._mut_false(');
  elsif p_what = 'respondent' then
    d := replace(d, 'app.is_case_respondent(', 'app._mut_false(');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutbe4.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then printf '%-46s *** marker not found ***\n' "$label"; return; fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutbe4.sql" >/dev/null
  local out; out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutbe4.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN";
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-46s %s\n' "$label" "$verdict"
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

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_be4_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_be4_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable. Aborting."; exit 1; fi

echo "=== BE-4 MUTATION AUDIT — widening the roster rosters an excluded member (RED) ==="
echo

run_case "recusal (recused member rostered)" \
  "select app._mut_revert('app.eligible_voters(uuid)', 'recusal');" \
  "the recused member reads ZERO of the hearing meeting"

run_case "respondent (respondent rostered)" \
  "select app._mut_revert('app.eligible_voters(uuid)', 'respondent');" \
  "the respondent reads ZERO of the hearing meeting"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN ==="
{ head -n "$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)" "$SRC";
  tail -n +$(( $(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1) + 1 )) "$SRC"; } > "$WORK/ctlbe4.sql"
docker cp "$WORK/ctlbe4.sql" "$DB:/tmp/ctlbe4.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctlbe4.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
