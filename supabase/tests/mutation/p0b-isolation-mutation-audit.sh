#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14 / §7.1). A test that cannot
# fail is not evidence. This proves the FIX-C Batch-1 isolation keystones in
# supabase/tests/250_authz_p0_isolation.sql: for each gate a keystone targets,
# revert THAT gate to its OPEN form inside the test's own rolled-back transaction
# and require the matching keystone to go RED. A keystone that stays GREEN under
# its own neutralization was measuring nothing (vacuous) — it is NOT evidence.
#
# Run from repo root:  bash supabase/tests/mutation/p0b-isolation-mutation-audit.sh
#
# Harness lessons inherited from m1/u2 (each HID A REAL RESULT):
#  1. Match keystones BY LABEL substring, never by test number (numbers go stale).
#  2. Tri-state RED / GREEN / ABSENT — a mutation that ABORTS the file prints no
#     `not ok`; reading that as green is the inverse of a vacuous keystone.
#  3. ASCII-ONLY grep patterns (the file's labels carry ·/→/[[..]] multi-byte marks;
#     match the ASCII `KSna <code>` head only).
#  5. Re-emit functions from LIVE pg_get_functiondef (never migration text).
#  6. A replace()/alter that matches NOTHING silently no-ops -> stays GREEN ->
#     NOT PROVEN. The tri-state surfaces it; the substrings below are verified live.
#
# The mutation is injected AFTER the marker `grant select on k to authenticated;`
# i.e. INSIDE 250's begin/rollback, so DDL reverts automatically at rollback — no
# restore step, and the shared stack is left byte-identical.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/250_authz_p0_isolation.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mut250.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-40s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$mut"; tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mut250.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut250.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-40s expect-red[%s]  %s\n' "$label" "$expect" "$verdict"
}

# PREFLIGHT — self-sufficient (a reset drops pgtap; without it every case ABORTs).
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mut250_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mut250_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== P0b ISOLATION MUTATION AUDIT — each keystone must go RED when ITS gate is opened ==="
echo

# --- Guard arm: revert the authz raise (replace the deny condition / delegated call). ---
MUT_KS1="do \$z\$ declare d text := pg_get_functiondef('app.assert_referral_draft_writable(uuid)'::regprocedure);
begin execute replace(d, 'not app.can_manage_referral_source(p_referral_id, auth.uid())', 'false'); end \$z\$;"
run_case "KS1 assert_referral_draft_writable" "$MUT_KS1" "KS1a HC071|KS1b HC071"

MUT_KS2="do \$z\$ declare d text := pg_get_functiondef('app.assert_referral_target_acts(uuid,text[])'::regprocedure);
begin execute replace(d, 'not app.can_manage_referral_target(p_referral_id, auth.uid())', 'false'); end \$z\$;"
run_case "KS2 assert_referral_target_acts" "$MUT_KS2" "KS2a HC072|KS2b HC072"

MUT_KS3="do \$z\$ declare d text := pg_get_functiondef('app.assert_session_writable(uuid)'::regprocedure);
begin execute replace(d, 'return app.assert_interview_writable(v_interview_id);', 'return v_interview_id;'); end \$z\$;"
run_case "KS3 assert_session_writable" "$MUT_KS3" "KS3a HC039"

# --- Policy arm: open the RLS write policy (using/with check -> true). ---
run_case "KS4 case_referral_insert_source_coord" \
  "alter policy case_referral_insert_source_coord on public.case_referral with check (true);" \
  "KS4a 42501"
run_case "KS5 case_referral_update_coord" \
  "alter policy case_referral_update_coord on public.case_referral using (true) with check (true);" \
  "KS5a"
run_case "KS6 case_referral_delete_draft_source" \
  "alter policy case_referral_delete_draft_source on public.case_referral using (true);" \
  "KS6a"

# =============================================================================
# BATCH 2 — the remaining direct-DML write policies (SRC=251). Each case opens ONE
# write policy (INSERT->with check(true); DELETE->using(true); UPDATE->both) and
# requires the matching `<polname> DENY` keystone to redden. Reader-non-writer
# principals (ADR 0079) make each UPDATE/DELETE redness attributable to the write
# policy, not the SELECT gate.
# =============================================================================
echo
echo "--- BATCH 2 (251) ---"
B2=supabase/tests/251_authz_p0_isolation.sql
run251 () { SRC="$B2" run_case "$@"; }

# meeting family
run251 "meetings_insert"          "alter policy meetings_staff_admin_insert on public.meetings with check (true);"                          "meetings_staff_admin_insert DENY"
run251 "meetings_update"          "alter policy meetings_staff_admin_update on public.meetings using (true) with check (true);"             "meetings_staff_admin_update DENY"
run251 "meetings_delete"          "alter policy meetings_staff_admin_delete on public.meetings using (true);"                                "meetings_staff_admin_delete DENY"
run251 "meeting_cases_insert"     "alter policy meeting_cases_staff_admin_insert on public.meeting_cases with check (true);"                 "meeting_cases_staff_admin_insert DENY"
run251 "meeting_cases_update"     "alter policy meeting_cases_staff_admin_update on public.meeting_cases using (true) with check (true);"    "meeting_cases_staff_admin_update DENY"
run251 "meeting_cases_delete"     "alter policy meeting_cases_staff_admin_delete on public.meeting_cases using (true);"                       "meeting_cases_staff_admin_delete DENY"
run251 "meeting_attendees_insert" "alter policy meeting_attendees_staff_admin_insert on public.meeting_attendees with check (true);"         "meeting_attendees_staff_admin_insert DENY"
run251 "meeting_attendees_update" "alter policy meeting_attendees_staff_admin_update on public.meeting_attendees using (true) with check (true);" "meeting_attendees_staff_admin_update DENY"
run251 "meeting_attendees_delete" "alter policy meeting_attendees_staff_admin_delete on public.meeting_attendees using (true);"              "meeting_attendees_staff_admin_delete DENY"
run251 "meeting_agenda_update"    "alter policy meeting_agenda_items_staff_admin_update on public.meeting_agenda_items using (true) with check (true);" "meeting_agenda_items_staff_admin_update DENY"
run251 "meeting_agenda_delete"    "alter policy meeting_agenda_items_staff_admin_delete on public.meeting_agenda_items using (true);"         "meeting_agenda_items_staff_admin_delete DENY"
run251 "meeting_signatures_insert" "alter policy meeting_signatures_insert on public.meeting_signatures with check (true);"                  "meeting_signatures_insert DENY"
# rca / capa / interviews
run251 "rca_update"               "alter policy rca_update on public.rca using (true) with check (true);"                                     "rca_update DENY"
run251 "rca_delete"               "alter policy rca_delete on public.rca using (true);"                                                      "rca_delete DENY"
run251 "capa_plan_update"         "alter policy capa_plan_update on public.capa_plan using (true) with check (true);"                        "capa_plan_update DENY"
run251 "capa_plan_delete"         "alter policy capa_plan_delete on public.capa_plan using (true);"                                          "capa_plan_delete DENY"
run251 "case_interviews_update"   "alter policy case_interviews_update on public.case_interviews using (true) with check (true);"           "case_interviews_update DENY"
run251 "case_interviews_delete"   "alter policy case_interviews_delete on public.case_interviews using (true);"                             "case_interviews_delete DENY"
# signoffs / profiles
run251 "signoffs_insert"          "alter policy signoffs_insert on public.response_section_signoffs with check (true);"                      "signoffs_insert DENY"
run251 "profiles_admin_insert"    "alter policy profiles_admin_insert on public.profiles with check (true);"                                 "profiles_admin_insert DENY"
# NOTE: responses_delete_own_draft and notification_preferences_update_own are NOT
# keystoned — they are backstopped (guard_submitted_response trigger; select_own) so
# reverting their RLS policy reddens nothing. They stay in authz-blind-allowlist.txt.

echo
echo "=== CONTROL — no mutation: every keystone GREEN in BOTH files (harness is not a red-generator) ==="
for f in "$SRC" "$B2"; do
  docker cp "$f" "$DB:/tmp/_noop_p0b.sql" >/dev/null
  control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_p0b.sql 2>&1)
  if echo "$control" | grep -qE "^not ok"; then
    echo "*** CONTROL FAILED — $f has a failing assertion WITHOUT any mutation ***"
    echo "$control" | grep -E "^not ok"
  else
    ok=$(echo "$control" | grep -cE "^ok")
    echo "CONTROL $(basename "$f"): all green ($ok ok, 0 not ok)"
  fi
done
