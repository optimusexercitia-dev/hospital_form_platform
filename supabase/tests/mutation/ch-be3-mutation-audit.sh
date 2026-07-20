#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078/0079). A test that cannot fail is not evidence. Run from repo root:
#   bash supabase/tests/mutation/ch-be3-mutation-audit.sh
# Every keystone below must read RED-PROVEN.
#
# CH-BE-3 MUTATION AUDIT — the three charter-RPC security gates (SQLSTATE HC0K·):
#   KS_AUTHORITY  upsert_commission_charter — neutralize the HC0K0 staff_admin gate →
#                 a plain member's upsert SUCCEEDS → the "HC0K0" keystone in 261 goes RED.
#   KS_MEMBER     meeting_cadence_status — neutralize the HC0K2 member gate → a non-member's
#                 call SUCCEEDS → the "HC0K2" keystone goes RED.
#   KS_FILTER     suggest_carry_forward — neutralize the app.can_read_action_item filter →
#                 the assignees_only (case-confidential) item LEAKS → the confidentiality
#                 keystone goes RED. (A case_restricted item routes through the same call.)
#
# Harness lessons (be6/m1/m5/m6): match by LABEL not number; tri-state RED/GREEN/ABSENT;
# ASCII-only patterns; regenerate the def from LIVE pg_get_functiondef. The mutation is
# injected after the fixture MARKER, INSIDE the test transaction (transactional
# create-or-replace → reverted on the test's own rollback).
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/261_charters_rpcs.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='-- MUTATION_MARKER'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_revert(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  if p_what = 'authority' then
    d := replace(d, 'not app.is_staff_admin_of(p_commission)', 'false');
  elsif p_what = 'member' then
    d := replace(d, 'not app.is_member_of(p_commission)', 'false');
  elsif p_what = 'filter' then
    d := replace(d, 'app.can_read_action_item(ai.id, v_uid)', 'true');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 label, $2 mutation SQL, $3 expected-red label patterns
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutchbe3.sql" line
  line=$(grep -n -e "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then printf '%-52s *** marker not found ***\n' "$label"; return; fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutchbe3.sql" >/dev/null
  local out; out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutchbe3.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN";
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-52s %s\n' "$label" "$verdict"
}

PGTAP_WAS=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap with schema extensions;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_revert(text,text);" >/dev/null 2>&1
  [ "${PGTAP_WAS:-0}" = "0" ] && docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
}
trap cleanup EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_chbe3_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_chbe3_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable. Aborting."; exit 1; fi

echo "=== CH-BE-3 MUTATION AUDIT — the three charter-RPC gates ==="
echo

run_case "KS_AUTHORITY (HC0K0 plain member upsert)" \
  "select app._mut_revert('public.upsert_commission_charter(uuid,text,uuid)', 'authority');" \
  "KS_AUTHORITY"

run_case "KS_MEMBER (HC0K2 non-member cadence)" \
  "select app._mut_revert('public.meeting_cadence_status(uuid)', 'member');" \
  "KS_MEMBER"

run_case "KS_FILTER (can_read_action_item confidentiality)" \
  "select app._mut_revert('public.suggest_carry_forward(uuid)', 'filter');" \
  "KS_FILTER"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN ==="
LINE=$(grep -n -e "$MARKER" "$SRC" | head -1 | cut -d: -f1)
{ head -n "$LINE" "$SRC"; tail -n +$((LINE+1)) "$SRC"; } > "$WORK/ctlchbe3.sql"
docker cp "$WORK/ctlchbe3.sql" "$DB:/tmp/ctlchbe3.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctlchbe3.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
