#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/f1-expiry-seam-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# F1 MUTATION AUDIT — the extend-on-regrant expiry seam (QO·FUP F1, ADR 0102,
# migration 20260912000000). Target suite: supabase/tests/306_quality_reviewer_role.sql §4.
#
# ⛔ WHY THIS ONE NEEDS AN AUDIT MORE THAN A DENIAL DOES. F1 is a WIDENING of what a
# door may write — the one shape where a keystone is easiest to satisfy by accident.
# Four of the six cases below are `coalesce`/`greatest` swaps that leave the headline
# assertions (4.6, 4.13) GREEN: if the only keystones were "did it extend / did the
# replace write", the NULL semantics that the whole caller-sweep argument rests on, and
# the not-a-ratchet property, would both be unpinned. Each case names the NARROWEST set
# of assertions it must red, so a case that reds "everything" is itself a finding.
#
# Harness lessons inherited from a2/m1/m5/m6 (each one HID A REAL RESULT):
#  1. Match keystones BY LABEL, never by test number — numbers go stale as suites grow.
#  2. Tri-state RED / GREEN / ABSENT. A mutation that ABORTS prints no "not ok" at all;
#     reading that as green is a false NOT-FALSIFIABLE. `red != abort`.
#  3. ASCII-ONLY patterns: the interpunct and the ellipsis are multi-byte UTF-8 and
#     grep's `.` matches one BYTE. Use `.*` across them, never a bare `.`.
#     ⚠ THIS FIRED ON THIS FILE'S FIRST RUN, in the file that quotes the lesson:
#     `FUP-QO-1.A` read ABSENT for E1/E2/E3 because `.` could not span the two bytes
#     of the interpunct. The tri-state is what made it a visible harness error instead
#     of a silent NOT-PROVEN — `red != abort` cuts both ways.
#  4. ⚠ BSD awk (macOS) rejects ANY multi-line `-v` value; head/tail is portable.
#  5. ⛔ Re-emit from LIVE pg_get_functiondef, never from migration text: functions on
#     this program are rewritten at runtime, so re-emitting from a file silently reverts
#     intervening patches. Every `replace()` string below was taken from the LIVE body.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/306_quality_reviewer_role.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_f1(p_what text) returns void
  language plpgsql as $m$
declare
  d text := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
  t text := pg_get_functiondef('app.trg_audit_memberships()'::regprocedure);
begin
  if p_what = 'revert_do_nothing' then
    -- Back to the pre-F1 seam limit: an identical re-grant no-ops.
    d := replace(d,
      'do update set expires_at = coalesce(excluded.expires_at, memberships.expires_at);',
      'do nothing;');
  elsif p_what = 'ratchet' then
    -- The plausible WRONG implementation: extend-only. Passes 4.6, fails the shrink.
    d := replace(d,
      'coalesce(excluded.expires_at, memberships.expires_at)',
      'greatest(excluded.expires_at, memberships.expires_at)');
  elsif p_what = 'drop_insert_coalesce' then
    -- "NULL clears" on the INSERT / ON CONFLICT arm — the silent privilege widening
    -- the caller sweep ruled out (every production caller omits the argument).
    d := replace(d,
      'coalesce(excluded.expires_at, memberships.expires_at)',
      'excluded.expires_at');
  elsif p_what = 'revert_replace_expiry' then
    -- Back to the pre-F1 seam limit: the atomic replace ignores the argument.
    d := replace(d,
      'granted_at = now(),
             expires_at = coalesce(p_expires_at, expires_at)',
      'granted_at = now()');
  elsif p_what = 'drop_replace_coalesce' then
    -- "NULL clears" on the REPLACE arm — the arm src/lib/admin/actions.ts:285 takes.
    d := replace(d,
      'expires_at = coalesce(p_expires_at, expires_at)',
      'expires_at = p_expires_at');
  elsif p_what = 'audit_role_changed_no_expiry' then
    -- Rule 11 half: the replace writes the window but role_changed wins the if/elsif,
    -- so without this arm the write has NO trace.
    t := replace(t,
      'v_action in (''membership.expiry_changed'', ''membership.role_changed'')',
      'v_action in (''membership.expiry_changed'')');
    execute t;
    return;
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutf1.sql"
  local line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-46s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutf1.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutf1.sql 2>&1)
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
# PREFLIGHT — self-sufficient. `supabase db reset` drops pgtap and test_helpers, so a
# run straight after a reset would abort EVERY case and print a uniform NOT PROVEN.
# ---------------------------------------------------------------------------
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1

# CLEANUP — leave the stack as we found it. The preflight installs pgtap OUTSIDE any
# transaction, so it PERSISTS. (Since FUP-QO-5 that no longer reds 100_dashboard t19,
# which now counts first-party functions only — but a harness that silently changes the
# stack it audits still manufactures findings, so restore anyway.)
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop function if exists app._mut_f1(text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutf1_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutf1_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== F1 MUTATION AUDIT — the expiry seam. Each keystone must go RED when ITS OWN"
echo "=== half of the fix is reverted, ONE AT A TIME."
echo

# --- The two headline behaviours D-FUP-1 ruled in -----------------------------
run_case "E1  INSERT arm: revert to DO NOTHING" \
  "select app._mut_f1('revert_do_nothing');" \
  "4.6 FUP-QO-1.*EXTEND-ON-REGRANT|4.6c FUP-QO-1 .* AUDITED BY THE DOOR"

run_case "E2  REPLACE arm: revert to ignoring expiry" \
  "select app._mut_f1('revert_replace_expiry');" \
  "4.13 FUP-QO-1.*REPLACE WRITES EXPIRY|4.13c FUP-QO-1 .* THE REPLACE IS AUDITED OVER EXPIRY"

# --- The three properties the headline assertions CANNOT see ------------------
# Each of these leaves 4.6 and 4.13 green. Without them the seam would be pinned only
# in the direction someone happened to write an assertion for.
run_case "E3  extend becomes a RATCHET (greatest)" \
  "select app._mut_f1('ratchet');" \
  "4.6b FUP-QO-1.*ABSOLUTE, NOT A RATCHET"

run_case "E4  NULL CLEARS on the INSERT arm" \
  "select app._mut_f1('drop_insert_coalesce');" \
  "4.13b FUP-QO-1 .* NULL = LEAVE UNCHANGED"

run_case "E5  NULL CLEARS on the REPLACE arm" \
  "select app._mut_f1('drop_replace_coalesce');" \
  "4.13d FUP-QO-1 .* NULL = LEAVE UNCHANGED .REPLACE ARM"

# --- Rule 11 -----------------------------------------------------------------
run_case "E6  replace expiry write loses its audit" \
  "select app._mut_f1('audit_role_changed_no_expiry');" \
  "4.13c FUP-QO-1 .* THE REPLACE IS AUDITED OVER EXPIRY"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN. If this prints anything other"
echo "=== than 'control: all green', every RED above is suspect (the harness, not the fix)."
LINE=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
{ head -n "$LINE" "$SRC"; tail -n +$((LINE+1)) "$SRC"; } > "$WORK/ctlf1.sql"
docker cp "$WORK/ctlf1.sql" "$DB:/tmp/ctlf1.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctlf1.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — no test ran; every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
