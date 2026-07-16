#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/a4-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# A4 MUTATION AUDIT — org administration ceases to be a Case Content source.
#
# A4 is a NARROWING, so §7.7 bites: a narrowing that denies everyone passes its negative
# keystone BY CONSTRUCTION. The A/B matrix (LOST = 40 cells / GAINED = 0 over 1960
# predicate-cells, both flag states) proves the POPULATION moved by exactly the intended
# amount; it cannot prove any individual ARM is load-bearing. That is this file's job:
# for each keystone in 235, RESTORE the arm A4 removed — ONE AT A TIME — and require that
# keystone to go RED. A4 removed arms from BOTH functions and policies, so the restores
# are of both kinds (pg_get_functiondef+replace for functions; ALTER POLICY for policies),
# each inside 235's rolled-back transaction.
#
# Harness lessons inherited from a2/m1/m5/m6 (each one HID A REAL RESULT):
#  1. Match keystones BY LABEL, never by test number.
#  2. Tri-state RED / GREEN / ABSENT. A mutation that ABORTS prints no "not ok"; reading
#     that as green is a false NOT-FALSIFIABLE. `red != abort`.
#  3. ASCII-ONLY patterns: the interpunct/star are multi-byte; grep `.` matches one BYTE.
#  4. head/tail is portable; BSD awk rejects multi-line -v values (false ABSENT on macOS).
#  5. Re-emit functions from LIVE pg_get_functiondef, never migration text.
#  6. A replace()/ALTER that matches nothing SILENTLY NO-OPS -> the keystone stays GREEN
#     -> reported NOT PROVEN. The RED requirement is itself the guard that the mutation
#     landed (a2's finding: 12/12 RED is proof every mutation operated).
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/235_authz_a4_org_admin_not_case_source.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_a4(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'restore_orgadmin_content' then
    -- Re-add the content + deliberation bits A4 stripped from _case_caps' org branch.
    d := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
    d := replace(d,
      'v_caps := v_caps | app._cap_bit(''manage_case_access'');',
      'v_caps := v_caps | app._cap_bit(''read_case_deliberation'') | app._cap_bit(''read_case_content'') | app._cap_bit(''manage_case_access'');');
    execute d;

  elsif p_what = 'restore_wrapper_org' then
    -- Re-add the trailing org OR A4 dropped from can_read_case_or_admin (F1).
    d := pg_get_functiondef('app.can_read_case_or_admin(uuid,uuid)'::regprocedure);
    d := replace(d,
      'return app.can_read_case(p_case_id, p_uid);',
      'return app.can_read_case(p_case_id, p_uid) or app.is_commission_admin_of_for(app.commission_of_case(p_case_id), p_uid);');
    execute d;

  elsif p_what = 'restore_can_write_interview_org' then
    -- The residual predicate the interview-family policies route. Restoring its org arm
    -- re-grants the org_admin interview READ (the policies are FOR ALL) -> K2 red. Proves
    -- target 4 is load-bearing and the policy edits alone were a no-op without it.
    d := pg_get_functiondef('app.can_write_interview(uuid,uuid)'::regprocedure);
    d := replace(d,
      'app.is_staff_admin_of_for(i.commission_id, p_uid)',
      'app.is_staff_admin_of_for(i.commission_id, p_uid) or app.is_commission_admin_of_for(i.commission_id, p_uid)');
    execute d;

  elsif p_what = 'drop_nsp' then
    -- Prove S6 is the arm carrying K6's survivor (A4 must not have silently cut it too).
    d := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
    d := replace(d, 'if app.feature_enabled(''case_referrals'')', 'if false and app.feature_enabled(''case_referrals'')');
    execute d;

  elsif p_what = 'restore_cases_policy' then
    execute $p$ alter policy cases_staff_admin_write on public.cases
      using ((app.is_staff_admin_of(commission_id) or app.is_commission_admin_of(commission_id)) and (not app.is_case_excluded(id, auth.uid())))
      with check ((app.is_staff_admin_of(commission_id) or app.is_commission_admin_of(commission_id)) and (not app.is_case_excluded(id, auth.uid()))) $p$;

  elsif p_what = 'restore_interview_subjects_policy' then
    execute $p$ alter policy case_interview_subjects_write on public.case_interview_subjects
      using ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id))) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid())))
      with check ((app.can_write_interview(interview_id, auth.uid()) or app.is_commission_admin_of(app.commission_of_interview(interview_id))) and (not app.is_case_excluded(app.case_of_interview(interview_id), auth.uid()))) $p$;

  elsif p_what = 'restore_action_items_policy' then
    -- Un-scope: restore the org arm across ALL scopes (the pre-A4 shape).
    execute $p$ alter policy action_items_staff_admin_write on public.action_items
      using (app.is_staff_admin_of(commission_id) or app.is_commission_admin_of(commission_id))
      with check (app.is_staff_admin_of(commission_id) or app.is_commission_admin_of(commission_id)) $p$;

  elsif p_what = 'restore_storage_policy' then
    execute $p$ alter policy case_documents_select_member on storage.objects
      using ((bucket_id = 'case-documents') and (app.is_commission_admin_of(((storage.foldername(name))[1])::uuid) or app.is_member_of(((storage.foldername(name))[1])::uuid) or app.can_read_snapshot_document(name, auth.uid()))) $p$;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/muta4.sql"
  local line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-46s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/muta4.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/muta4.sql 2>&1)
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

# PREFLIGHT — self-sufficient (a reset drops pgtap; without it every case ABORTs).
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_a4(text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_muta4_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_muta4_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== A4 MUTATION AUDIT — every keystone must go RED when ITS OWN removed arm is restored ==="
echo

run_case "restore_orgadmin_content -> K1 (function)" \
  "select app._mut_a4('restore_orgadmin_content');" \
  "K1 .* the org_admin no longer reads the explicit_grants_only case"

run_case "restore_cases_policy -> K1 ROWS (policy)" \
  "select app._mut_a4('restore_cases_policy');" \
  "K1 .* ROWS: reads ZERO .cases. rows"

run_case "restore_interview_subjects_policy -> K2 (policy)" \
  "select app._mut_a4('restore_interview_subjects_policy');" \
  "K2 .* ROWS: the org_admin reads ZERO interview subjects"

run_case "restore_can_write_interview_org -> K2 (function 4)" \
  "select app._mut_a4('restore_can_write_interview_org');" \
  "K2 .* ROWS: the org_admin reads ZERO interview subjects"

run_case "restore_action_items_policy -> K3 (policy)" \
  "select app._mut_a4('restore_action_items_policy');" \
  "K3 .* ROWS: the org_admin reads ZERO case_restricted action items"

run_case "restore_storage_policy -> K4 (policy)" \
  "select app._mut_a4('restore_storage_policy');" \
  "K4 .* ROWS: the org_admin reads ZERO case-document BYTES"

run_case "drop_nsp -> K6 (function; S6 survivor)" \
  "select app._mut_a4('drop_nsp');" \
  "K6 .* content SURVIVES on the referral-touched case"

run_case "restore_wrapper_org -> K9 (function; F1)" \
  "select app._mut_a4('restore_wrapper_org');" \
  "K9 .* the wrapper no longer hands the org_admin the case"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN. If this prints anything other"
echo "=== than 'control: all green', every RED above is suspect (the harness, not the fix)."
LINE=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
{ head -n "$LINE" "$SRC"; tail -n +$((LINE+1)) "$SRC"; } > "$WORK/ctla4.sql"
docker cp "$WORK/ctla4.sql" "$DB:/tmp/ctla4.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctla4.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — no test ran; every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
