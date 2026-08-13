#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence. Run from repo root:
#   bash supabase/tests/mutation/be5-retention-mutation-audit.sh
# Every keystone must read RED-PROVEN.
#
# BE-5 MUTATION AUDIT — the M2 retention-pin trigger + the redaction HC0J7 bar.
#   • idempotency — neutralize the pin's `retention_pinned_at is null` guard → a second
#     issued decision RE-PINS (overwrites the stamped 2020-01-01) → "does NOT overwrite
#     retention_pinned_at" goes RED.
#   • HC0J7 bar   — neutralize the bar in redact_professional_profile → a PINNED respondent
#     gets erased → "a retention-pinned respondent cannot be redacted" goes RED.
#
# Harness lessons (m1/m5/m6): match by LABEL not number; tri-state RED/GREEN/ABSENT;
# ASCII-only patterns; head/tail never `awk -v`; regenerate from LIVE pg_get_functiondef.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/257_ethics_e2_retention.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_revert(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  if p_what = 'idempotency' then
    -- The pin's SINGLE idempotency guard (UPDATE ... where id = r.profile_id AND <this>).
    d := replace(d, 'and retention_pinned_at is null', '');
  elsif p_what = 'bar' then
    -- The HC0J7 bar condition in redact_professional_profile.
    d := replace(d, 'v_pinned is not null or exists', 'false and exists');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutbe5.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then printf '%-44s *** marker not found ***\n' "$label"; return; fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutbe5.sql" >/dev/null
  local out; out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutbe5.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN";
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-44s %s\n' "$label" "$verdict"
}

PGTAP_WAS=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap with schema extensions;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_revert(text,text);" >/dev/null 2>&1
  [ "${PGTAP_WAS:-0}" = "0" ] && docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
}
trap cleanup EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_be5_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_be5_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable. Aborting."; exit 1; fi

echo "=== BE-5 MUTATION AUDIT — each guard neutralized must flip ITS keystone RED ==="
echo

run_case "idempotency (re-pin overwrites)" \
  "select app._mut_revert('app.trg_pin_respondent_retention()', 'idempotency');" \
  "does NOT overwrite retention_pinned_at"

run_case "HC0J7 bar (pinned identity erased)" \
  "select app._mut_revert('public.redact_professional_profile(uuid,text)', 'bar');" \
  "a retention-pinned respondent cannot be redacted"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN ==="
{ head -n "$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)" "$SRC";
  tail -n +$(( $(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1) + 1 )) "$SRC"; } > "$WORK/ctlbe5.sql"
docker cp "$WORK/ctlbe5.sql" "$DB:/tmp/ctlbe5.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctlbe5.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
