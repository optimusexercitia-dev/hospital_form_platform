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

# =============================================================================
# BATCH 3 (SRC=252) — clinical/case-content write families + read reps. FOR-ALL
# write policies open using+with check(true); INSERT policies with check(true);
# SELECT policies using(true). Reader-non-writer principals make each redness
# attributable to the WRITE/READ gate under test.
# =============================================================================
echo
echo "--- BATCH 3 (252) ---"
B3=supabase/tests/252_authz_p0_isolation.sql
run252 () { SRC="$B3" run_case "$@"; }

# rca family (_write FOR ALL)
run252 "rca_evidence_write"     "alter policy rca_evidence_write on public.rca_evidence using(true) with check(true);"           "rca_evidence_write DENY"
run252 "rca_factors_write"      "alter policy rca_factors_write on public.rca_factors using(true) with check(true);"             "rca_factors_write DENY"
run252 "rca_members_write"      "alter policy rca_members_write on public.rca_members using(true) with check(true);"             "rca_members_write DENY"
run252 "rca_root_causes_write"  "alter policy rca_root_causes_write on public.rca_root_causes using(true) with check(true);"     "rca_root_causes_write DENY"
run252 "rca_timeline_write"     "alter policy rca_timeline_write on public.rca_timeline_entries using(true) with check(true);"   "rca_timeline_write DENY"
run252 "rca_why_chains_write"   "alter policy rca_why_chains_write on public.rca_why_chains using(true) with check(true);"       "rca_why_chains_write DENY"
# capa family (_write FOR ALL)
run252 "capa_action_write"          "alter policy capa_action_write on public.capa_action using(true) with check(true);"                   "capa_action_write DENY"
run252 "capa_action_evidence_write" "alter policy capa_action_evidence_write on public.capa_action_evidence using(true) with check(true);" "capa_action_evidence_write DENY"
run252 "capa_action_task_write"     "alter policy capa_action_task_write on public.capa_action_task using(true) with check(true);"         "capa_action_task_write DENY"
run252 "capa_measure_write"         "alter policy capa_measure_write on public.capa_measure using(true) with check(true);"                 "capa_measure_write DENY"
run252 "capa_measure_result_write"  "alter policy capa_measure_result_write on public.capa_measure_result using(true) with check(true);"   "capa_measure_result_write DENY"
run252 "capa_effectiveness_write"   "alter policy capa_effectiveness_write on public.capa_effectiveness using(true) with check(true);"     "capa_effectiveness_write DENY"
# case content
run252 "case_participant_roles_admin_write" "alter policy case_participant_roles_admin_write on public.case_participant_roles using(true) with check(true);" "case_participant_roles_admin_write DENY"
run252 "case_phase_allowed_results_write"   "alter policy case_phase_allowed_results_staff_admin_write on public.case_phase_allowed_results using(true) with check(true);" "case_phase_allowed_results_staff_admin_write DENY"
run252 "case_phase_offered_results_write"   "alter policy case_phase_offered_results_staff_admin_write on public.case_phase_offered_results using(true) with check(true);" "case_phase_offered_results_staff_admin_write DENY"
run252 "case_tag_assignments_write"         "alter policy case_tag_assignments_staff_admin_write on public.case_tag_assignments using(true) with check(true);" "case_tag_assignments_staff_admin_write DENY"
run252 "interview_sessions_write"           "alter policy interview_sessions_write on public.interview_sessions using(true) with check(true);" "interview_sessions_write DENY"
run252 "meeting_agenda_items_insert"        "alter policy meeting_agenda_items_staff_admin_insert on public.meeting_agenda_items with check(true);" "meeting_agenda_items_staff_admin_insert DENY"
# read reps (_select)
run252 "event_custody_select"           "alter policy event_custody_select on public.event_custody using(true);"                       "event_custody_select DENY"
run252 "capa_action_select"             "alter policy capa_action_select on public.capa_action using(true);"                           "capa_action_select DENY"
run252 "professional_profiles_select"   "alter policy professional_profiles_select on public.professional_profiles using(true);"       "professional_profiles_select DENY"
run252 "interview_sessions_select"      "alter policy interview_sessions_select on public.interview_sessions using(true);"             "interview_sessions_select DENY"
run252 "case_participant_roles_select"  "alter policy case_participant_roles_select on public.case_participant_roles using(true);"      "case_participant_roles_select DENY"
run252 "document_approvals_select"      "alter policy document_approvals_select on public.document_approvals using(true);"             "document_approvals_select DENY"

# =============================================================================
# BATCH 4 (SRC=296) — the FUP-AUTHZ-2 backlog: the 15 policies the 2026-08-04 full
# ARM-1 sweep reported BLIND, i.e. every RLS policy added between 2026-07-18 (the
# day the allowlist was written) and 2026-08-03. Thirteen are SELECT gates (open
# using(true)); two are FOR ALL (open using+with check(true)) and are driven by
# INSERT, which has no SELECT dependency — ADR 0079 D2.
# =============================================================================
echo
echo "--- BATCH 4 (298) — FUP-AUTHZ-2 ---"
B4=supabase/tests/298_authz_p0_isolation.sql
run298 () { SRC="$B4" run_case "$@"; }

# referral metadata family (Referrals-v2 R3/R4/R5)
run298 "referral_assignments_select"   "alter policy referral_assignments_select_metadata on public.referral_assignments using(true);"     "referral_assignments_select_metadata DENY"
run298 "referral_case_links_select"    "alter policy referral_case_links_select_metadata on public.referral_case_links using(true);"       "referral_case_links_select_metadata DENY"
run298 "referral_internal_notes_select" "alter policy referral_internal_notes_select on public.referral_internal_notes using(true);"       "referral_internal_notes_select DENY"
run298 "referral_read_receipts_select" "alter policy referral_read_receipts_select_metadata on public.referral_read_receipts using(true);" "referral_read_receipts_select_metadata DENY"
run298 "referral_resolutions_select"   "alter policy referral_resolutions_select_metadata on public.referral_resolutions using(true);"     "referral_resolutions_select_metadata DENY"
# platform vocabulary write (FOR ALL, app.is_admin())
run298 "referral_requested_actions_write" "alter policy referral_requested_actions_write_admin on public.referral_requested_actions using(true) with check(true);" "referral_requested_actions_write_admin DENY"
# org-scoped vocabulary (ETH E2 BE-3/BE-6)
run298 "case_assignment_roles_select"  "alter policy case_assignment_roles_select on public.case_assignment_roles using(true);"            "case_assignment_roles_select DENY"
run298 "ethics_sanction_types_select"  "alter policy ethics_sanction_types_select on public.ethics_sanction_types using(true);"            "ethics_sanction_types_select DENY"
# case-scoped correction family (Case Corrections)
run298 "case_correction_requests_select" "alter policy case_correction_requests_select on public.case_correction_requests using(true);"    "case_correction_requests_select DENY"
run298 "case_narrative_revisions_select" "alter policy case_narrative_revisions_select on public.case_narrative_revisions using(true);"    "case_narrative_revisions_select DENY"
run298 "case_reopenings_select"        "alter policy case_reopenings_select on public.case_reopenings using(true);"                        "case_reopenings_select DENY"
# accreditation (Phase 16)
run298 "accreditation_standards_select" "alter policy accreditation_standards_select on public.accreditation_standards using(true);"       "accreditation_standards_select DENY"
# targeted (ethics) lane — the out-of-phase hotfix
run298 "form_item_options_select_targeted" "alter policy form_item_options_select_targeted on public.form_item_options using(true);"       "form_item_options_select_targeted DENY"
run298 "answer_selected_options_select_targeted" "alter policy answer_selected_options_select_targeted on public.answer_selected_options using(true);" "answer_selected_options_select_targeted DENY"
run298 "answer_selected_options_write_targeted"  "alter policy answer_selected_options_write_targeted on public.answer_selected_options using(true) with check(true);" "answer_selected_options_write_targeted DENY"
# referral "Registros internos" vocabulary (2026-08-11) — both policies are NEW, so
# they are in no BLIND set and pass ARM=policy vacuously. These two cases are what
# make 298's GROUP G non-vacuous.
# NOTE on the write case: opening a FOR ALL policy to using(true) also opens SELECT,
# so that mutation reddens the select DENY as well. Only the write DENY is asserted
# here — that is the gate the mutation is aimed at.
run298 "referral_note_types_select"       "alter policy referral_note_types_select on public.referral_note_types using(true);"                                  "referral_note_types_select DENY"
run298 "referral_note_types_write"        "alter policy referral_note_types_staff_admin_write on public.referral_note_types using(true) with check(true);"       "referral_note_types_staff_admin_write DENY"

# =============================================================================
# BATCH 5 (SRC=322) — the referral "Registros internos" doors. Three raise-guards,
# each neutralized to `if false then` (Amendment 4's row-door shape: these doors
# return a row or void, so there is no boolean to open).
#
# The fourth case is the odd one and the most valuable: it does not open a gate, it
# RESTORES A DEFECT. `create_referral_internal_note` used to gate with
# `p_committee_id not in (source, target)`, which is NULL — not TRUE — on a
# technical_director referral, where target_commission_id is NULL. Re-injecting that
# form must redden 6.2, which is what proves 6.2 is a regression test rather than a
# tautology.
# =============================================================================
echo
echo "--- BATCH 5 (322) — referral Registros doors ---"
B5=supabase/tests/322_referral_registros.sql
run322 () { SRC="$B5" run_case "$@"; }

MUT_R1="do \$z\$ declare d text := pg_get_functiondef('public.get_referral_case_access_summary(uuid,uuid)'::regprocedure);
begin execute replace(d, '  if (p_commission_id is distinct from v_ref.source_commission_id
      and p_commission_id is distinct from v_ref.target_commission_id)
     or not app.is_member_of_for(p_commission_id, auth.uid())
     or not app.can_read_referral(p_referral_id, auth.uid()) then', '  if false then'); end \$z\$;"
run322 "get_referral_case_access_summary" "$MUT_R1" "5.1 a principal|5.2 a member of Y"

MUT_R2="do \$z\$ declare d text := pg_get_functiondef('public.reorder_referral_note_types(uuid,uuid[])'::regprocedure);
begin execute replace(d, 'if not (app.is_staff_admin_of(p_commission_id) or app.is_tenancy_admin_of(p_commission_id)) then', 'if false then'); end \$z\$;"
run322 "reorder_referral_note_types" "$MUT_R2" "1.5 reorder|1.6 a plain member cannot reorder"

MUT_R3="do \$z\$ declare d text := pg_get_functiondef('public.update_referral_internal_note(uuid,text,text,uuid)'::regprocedure);
begin execute replace(d, 'if not app.can_edit_referral_internal_note(p_note_id, auth.uid()) then', 'if false then'); end \$z\$;"
run322 "update_referral_internal_note" "$MUT_R3" "4.1 a member who is neither"

MUT_R4="do \$z\$ declare d text := pg_get_functiondef('public.create_referral_internal_note(uuid,uuid,text,text,uuid,uuid)'::regprocedure);
begin execute replace(d, '  if (p_committee_id is distinct from v_ref.source_commission_id
      and p_committee_id is distinct from v_ref.target_commission_id)
     or not app.is_member_of_for(p_committee_id, auth.uid()) then', '  if p_committee_id not in (v_ref.source_commission_id, v_ref.target_commission_id)
     or not app.is_member_of_for(p_committee_id, auth.uid()) then'); end \$z\$;"
run322 "create_referral_internal_note NULL-hole" "$MUT_R4" "6.2 NULL-HOLE CLOSED"

echo
echo "=== CONTROL — no mutation: every keystone GREEN in ALL files (harness is not a red-generator) ==="
for f in "$SRC" "$B2" "$B3" "$B4" "$B5"; do
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
