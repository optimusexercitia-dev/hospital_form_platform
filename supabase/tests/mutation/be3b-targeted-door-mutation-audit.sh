#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078; the no-regression-twin / over-grant rule). A test that cannot
# fail is not evidence. Run from the repo root against a local stack:
#   bash supabase/tests/mutation/be3b-targeted-door-mutation-audit.sh
# Each keystone must read RED-PROVEN.
#
# BE-3b MUTATION AUDIT — app.can_access_targeted_response, the D13 respondent door.
#
# The door has TWO access-gating conjuncts (link_state is subsumed by the DB biconditional
# user_id-not-null ⇔ linked, so an explicit link check is vacuous and deliberately omitted):
#   • user_id  — `prof.user_id = p_uid`  (resolves to THIS user)
#   • live     — `cp.removed_at is null`  (the participant link is LIVE)
# Widen EITHER and a DIFFERENT user's response becomes reachable → the matching keystone
# in 255 must go RED. (`resp.target_case_participant_id is not null` is a short-circuit
# guard subsumed by the join `cp.id = resp.target_case_participant_id`, not an access
# widener — mutating it changes nothing, so it is not audited here.)
#
# Harness lessons (m1/m5/m6): match by LABEL not number; tri-state RED/GREEN/ABSENT
# (red != abort); ASCII-only patterns; head/tail never `awk -v`; regenerate from LIVE
# pg_get_functiondef, never migration text.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/255_ethics_e2_targeted.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_revert(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  if p_what = 'user_id' then
    -- Widen the identity conjunct → the door resolves for ANY caller.
    d := replace(d, 'prof.user_id = p_uid', 'true');
  elsif p_what = 'live' then
    -- Widen the liveness conjunct → a REMOVED participant still authorizes.
    d := replace(d, 'cp.removed_at is null', 'true');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutbe3b.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then printf '%-50s *** marker not found ***\n' "$label"; return; fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutbe3b.sql" >/dev/null
  local out; out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutbe3b.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN";
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-50s %s\n' "$label" "$verdict"
}

PGTAP_WAS=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap with schema extensions;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_revert(text,text);" >/dev/null 2>&1
  [ "${PGTAP_WAS:-0}" = "0" ] && docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
}
trap cleanup EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_be3b_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_be3b_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable. Aborting."; exit 1; fi

echo "=== BE-3b MUTATION AUDIT — each conjunct widened must make a DIFFERENT user reachable (RED) ==="
echo

run_case "user_id (a non-target reads the response)" \
  "select app._mut_revert('app.can_access_targeted_response(uuid,uuid)', 'user_id');" \
  "over-grant .user_id.: a non-target user reads ZERO of the targeted response"

run_case "live (a removed target keeps the door)" \
  "select app._mut_revert('app.can_access_targeted_response(uuid,uuid)', 'live');" \
  "over-grant .removed_at.: a removed target reads ZERO of the response"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN ==="
{ head -n "$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)" "$SRC";
  tail -n +$(( $(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1) + 1 )) "$SRC"; } > "$WORK/ctlbe3b.sql"
docker cp "$WORK/ctlbe3b.sql" "$DB:/tmp/ctlbe3b.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctlbe3b.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
