#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/m6-mutation-audit.sh
# Every row must read RED-PROVEN.
#
# M6 MUTATION AUDIT — `cases.visibility_policy`, the guarded door.
#
# For each ⭐ keystone in 233: revert ITS fix, ONE FUNCTION AT A TIME, inside a
# rolled-back transaction, and require that keystone to go RED. A global neuter reverts
# everything at once and proves nothing about any single keystone.
#
# ⛔ WHY THIS FILE MATTERS MORE THAN THE GREEN RUN. Review found NONE of the seven
# keystones on this program that could not fail; reverting the fix found every one. M6 is
# a NARROWING, and a narrowing that denies everyone passes its negative keystones by
# construction — so the POSITIVE twins (M6·2, M6·7-2/3, and the mention-vs-change twin)
# are audited here exactly like the denials. A green suite is not the evidence; this is.
#
# Harness lessons inherited from m1/m5 (each one HID A REAL RESULT):
#  1. Match keystones BY LABEL, never by test number — numbers go stale as suites grow.
#  2. Tri-state RED / GREEN / ABSENT. A mutation that ABORTS prints no "not ok" at all;
#     reading that as green is a false NOT-FALSIFIABLE. `red != abort`.
#  3. ASCII-ONLY patterns: `·` is multi-byte UTF-8 and grep's `.` matches one BYTE, so
#     every pattern below avoids the interpunct and curly quotes in the labels.
#  4. ⚠ BSD awk (macOS) rejects ANY multi-line `-v` value ("newline in string"), emits a
#     garbage script, and EVERY case reads ABSENT — m1 reported 22/22 ABSENT on a Mac
#     while its recorded result was 22/22 RED-PROVEN on a GNU-awk box. head/tail is
#     portable to both; this file uses head/tail and never awk -v.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/233_authz_m6_visibility_door.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

# The neutered stubs + a per-function reverter. Each stub replaces ONE gate; the REAL
# helpers stay intact because the assertions in 233 call them directly (app.is_case_excluded
# is asserted in the PRE-FLIGHT — neutering it globally would make the fixture lie).
read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_true(uuid) returns boolean
  language sql immutable as $m$ select true $m$;
create or replace function app._mut_noop(uuid) returns void
  language plpgsql immutable as $m$ begin end; $m$;
create or replace function app._mut_audit_noop(text, text, uuid, uuid, text, jsonb, uuid default null, uuid default null)
  returns void language plpgsql immutable as $m$ begin end; $m$;
create or replace function app._mut_revert(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  -- ⛔ Regenerated from LIVE pg_get_functiondef, never from migration text: several
  -- functions on this program are rewritten at runtime, so re-emitting from a file
  -- silently reverts intervening patches (it has already broken one guard).
  if p_what = 'authority' then
    -- `if not (is_staff_admin_of(x) or is_commission_admin_of(x))` -> never raises.
    d := replace(d, 'app.is_staff_admin_of(', 'app._mut_true(');
  elsif p_what = 'exclusion' then
    d := replace(d, 'app.assert_not_case_excluded(', 'app._mut_noop(');
  elsif p_what = 'validation' then
    d := replace(d, $q$p_policy is null or p_policy not in ('commission_default', 'explicit_grants_only')$q$, 'false');
  elsif p_what = 'audit' then
    d := replace(d, 'app.audit_write(', 'app._mut_audit_noop(');
  elsif p_what = 'policy_arm' then
    -- the visibility branch of the member-surface resolver -> always take the
    -- member-wide arm, i.e. behave as if every case were commission_default.
    d := replace(d, $q$if v_policy = 'explicit_grants_only' then$q$, 'if false then');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mut6.sql"
  local mark="${MARKER}"
  local line
  line=$(grep -n "$mark" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-46s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mut6.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut6.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-46s %s\n' "$label" "$verdict"
}

# ---------------------------------------------------------------------------
# PREFLIGHT — self-sufficient. `supabase db reset` drops pgtap and test_helpers (both
# are transient to `supabase test db`), so running straight after a reset would abort
# EVERY case and print a uniform NOT PROVEN that looks like broken keystones rather
# than a missing extension.
# ---------------------------------------------------------------------------
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1

# CLEANUP — leave the stack as we found it. The preflight installs pgtap into `public`
# OUTSIDE any transaction, so it PERSISTS; the next `supabase test db` would then read
# t19 RED on ~1079 pgtap-owned functions — a FALSE red the next person chases. A harness
# that silently changes the stack it audits manufactures findings.
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop function if exists app._mut_true(uuid);" \
    -c "drop function if exists app._mut_noop(uuid);" \
    -c "drop function if exists app._mut_audit_noop(text,text,uuid,uuid,text,jsonb,uuid,uuid);" \
    -c "drop function if exists app._mut_revert(text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mut6_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mut6_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== M6 MUTATION AUDIT — every keystone must go RED when ITS fix is reverted ==="
echo

# --- D1: the guard trigger. Drop it and the raw PATCH works again (it did: UPDATE 1).
run_case "D1 guard trigger (drop)" \
  "drop trigger guard_case_visibility_trg on public.cases;" \
  "raw PATCH of visibility_policy is BLOCKED|the policy SURVIVES the attempt"

# --- The door's three gates, one at a time.
run_case "door: AUTHORITY gate (HC0F5)" \
  "select app._mut_revert('public.set_case_visibility(uuid,text)', 'authority');" \
  "DENIED on AUTHORITY"

run_case "door: EXCLUSION gate (HC0F1)" \
  "select app._mut_revert('public.set_case_visibility(uuid,text)', 'exclusion');" \
  "cannot widen the case in which he is accused|the case stays CLOSED to the member surface"

run_case "door: VALIDATION gate (HC0F6)" \
  "select app._mut_revert('public.set_case_visibility(uuid,text)', 'validation');" \
  "an invalid policy is rejected"

# --- D2: the explicit audit verb. The cases trigger does NOT fire on this column, so
#     removing this call takes the delta straight back to the measured 0.
run_case "D2 explicit audit_write" \
  "select app._mut_revert('public.set_case_visibility(uuid,text)', 'audit');" \
  "emits EXACTLY ONE audit row"

# --- The behavioural arm. If the resolver stops honouring the column, M6-7 must break.
#     This audits the POSITIVE twin too: the (2/3) leg is the one that must MOVE.
run_case "resolver: visibility arm (M6-7)" \
  "select app._mut_revert('app.can_reach_case_on_member_surface(uuid,uuid)', 'policy_arm');" \
  "a plain member does NOT reach the case"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN. If this prints anything other"
echo "=== than 'control: all green', every RED above is suspect (the harness, not the fix)."
CTRL=$(docker exec "$DB" psql -U postgres -d postgres -q -c "select 1" >/dev/null 2>&1; \
  { head -n "$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)" "$SRC"; \
    tail -n +$(( $(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1) + 1 )) "$SRC"; } > "$WORK/ctl6.sql"; \
  docker cp "$WORK/ctl6.sql" "$DB:/tmp/ctl6.sql" >/dev/null; \
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctl6.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — no test ran; every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
