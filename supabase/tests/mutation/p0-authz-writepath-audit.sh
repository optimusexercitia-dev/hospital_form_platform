#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14). WRITE-PATH companion to
# p0-authz-door-audit.sh. That harness audits the READ layer (boolean predicates +
# SELECT/ALL read policies). This one audits the WRITE layer: the value-returning authz
# RAISE-GUARDS (assert_*_writable / assert_referral_*) and the INSERT/UPDATE/DELETE
# policies. Same method, same verdict semantics:
#
#   NEUTRALIZE each write-path authz gate (open it so it grants/allows regardless), run
#   the FULL pgTAP suite end-to-end, and read whether ANY keystone noticed.
#
#   Result: FAIL  -> a keystone asserts THROUGH this gate           = COVERED (good)
#   Result: PASS  -> NO keystone exercises it; opening it is silent = BLIND  (a finding)
#   run-shape != baseline (Files/Tests drop, or Dubious)            = ERROR  (harness bug)
#
# This is the INVERSE of m1/m5/u2 (revert ONE fix, require ONE keystone red). Here we open
# ONE gate and ask the WHOLE SUITE whether ANYONE asserts through it. We mutate the LIVE,
# COMMITTED catalog (never migration text — memory: migration file text is STALE) and run
# `supabase test db`.
#
# ── ARM 1: the 7 authz RAISE-GUARDS ─────────────────────────────────────────────────
# These are plpgsql, RETURN a value (uuid / case_referral) AND `raise … '42501'`(or an HC*
# code) on unauthorized. The main door-audit EXCLUDES them from its auto-sweep because a
# blanket body-swap on a value-returning raise-guard risks a NULL-propagation ABORT
# downstream (§7.15). So we neutralize them BESPOKE, hand-written from the captured
# pg_get_functiondef snapshot: remove ONLY the authorization `raise` block(s) while
# PRESERVING the real `return <expr>` AND any non-authz guard (no_data_found lookups,
# workflow-STATE checks like status='draft'). This opens the authz gate while returning
# the correct type — no abort, so a PASS is a true BLIND, not a masked ERROR.
#
#   assert_capa_writable(uuid)            -> void ; drop can_write_capa raise
#   assert_meeting_staff_admin(uuid)      -> uuid ; drop is_staff_admin_of raise; keep return
#   assert_interview_writable(uuid)       -> uuid ; drop can_write_interview raise; keep return
#   assert_rca_writable(uuid)             -> uuid ; drop can_write_rca raise; keep return
#   assert_session_writable(uuid)         -> uuid ; SPECIAL (see below)
#   assert_referral_draft_writable(uuid)  -> case_referral ; drop can_manage_referral_source
#                                           raise; KEEP status='draft' state guard
#   assert_referral_target_acts(uuid,text[]) -> case_referral ; drop can_manage_referral_target
#                                           raise; KEEP status=any(expected) state guard
#
#   ⚠ assert_session_writable is SPECIAL: it has NO direct authz raise — its authz is the
#   DELEGATED final call `return app.assert_interview_writable(v_interview_id)`. If we left
#   that call intact, the (un-neutralized) interview guard would still enforce authz and
#   MASK any session-specific blindness (a false COVERED). So we replace the delegated call
#   with a direct, un-gated commission lookup that returns the SAME value the interview
#   guard would — isolating and opening the SESSION gate. (Flagged for lead review.)
#
#   EXCLUDED as non-authz validators (like the door-audit's is_valid_* config validators):
#     assert_meeting_roster_nonempty, assert_condition_value_codes  — DATA validation, not
#     authorization; opening them proves nothing about an authz keystone.
#
# ── ARM 2: the 33 INSERT/UPDATE/DELETE policies ─────────────────────────────────────
# Neutralize by OPENING the check to `true`:  INSERT -> `with check (true)`;
# DELETE -> `using (true)`; UPDATE -> both. Only the clauses that actually exist are
# touched. A row whose relevant clause is ALREADY `true` is vacuous and SKIPPED (listed).
#
# ── Lessons baked in (mirror p0-authz-door-audit.sh; each HID A REAL RESULT) ─────────
#  §7.15  the assertion that NEVER RAN is a THIRD "green". We guard Files/Tests==baseline
#         and absence of "Dubious"; a shape drift is verdict=ERROR, never a BLIND.
#  §7.1   detect on the SUITE Result:, not `grep '^not ok'`.
#  §7.3   baseline Files/Tests are CAPTURED at preflight (not hardcoded) and MUST be
#         Result: PASS or we abort (a dirty baseline invalidates every case).
#  §7.5   restore is verified: after EVERY case re-fetch pg_get_functiondef / pg_get_expr
#         and BYTE-COMPARE against the captured original; a mismatch is a LOUD abort
#         (a botched restore silently contaminates every later case).
#  §7.2   value, not noun: guards keyed by regprocedure->OID (survives rename); policies by
#         name+table. The embedded snapshot is a DRIFT tripwire, not the restore source.
#
# ── Modes ────────────────────────────────────────────────────────────────────────────
#   DRYRUN=1  PRINT every neutralization (guards: full CREATE OR REPLACE; policies: the
#             ALTER POLICY) and EXIT — ZERO DB access. Eyeball the 7 bespoke guards here.
#   CASES="…" subset filter; matches a guard proname OR a policy name (space-separated).
#
# Run from repo root:   bash supabase/tests/mutation/p0-authz-writepath-audit.sh
# Dry run:              DRYRUN=1 bash supabase/tests/mutation/p0-authz-writepath-audit.sh
# Subset:               CASES="assert_capa_writable rca_delete" bash .../p0-authz-writepath-audit.sh
#
# ⚠ COST: full sweep = one ~23s suite run per guard (7) + per policy (33) = ~15-16 min.
# The LEAD runs the full loop in the background (a background process dies at turn-end).
set -u

DB=supabase_db_azkbbhskturikxpgmafq
# Repo root = three levels up from supabase/tests/mutation/.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-/c/Users/micha/AppData/Local/Temp/claude/C--Users-micha-Development-claude-hospital-form-platform/6d030efd-e072-4a80-a704-0dc4fb6c9049/scratchpad/authz-audit}"
# ⚠ distinct writepath_* names so this NEVER clobbers the running door-audit's outputs.
FINDINGS="$ROOT/docs/reviews/authz-writepath-audit-findings.md"
BLINDS_TSV="$WORK/blinds_writepath.tsv"
PROGRESS="$WORK/writepath_progress.tsv"     # per-case log, written AS WE GO (mid-run kill)
RUNLOGS="$WORK/writepath_runlogs"           # full suite output per case, for forensics
POLWL="$WORK/writepath_worklist_pol.tsv"    # the 33-policy worklist (embedded below)
CASES="${CASES:-}"                          # optional subset filter
DRYRUN="${DRYRUN:-0}"

mkdir -p "$WORK" "$RUNLOGS"

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
# Run an SQL file inside the container (avoids all shell-quoting of quals/bodies).
psql_f () {
  local host="$1"
  docker cp "$host" "$DB:/tmp/_wp_p0mut.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_wp_p0mut.sql 2>&1
}
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' ; }

want () {  # $1 = match key (guard proname or policy name); 0 if in CASES (or CASES empty)
  [ -z "$CASES" ] && return 0
  local k
  for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 1 data: the 7 guards. Keyed by proname. guard_sig -> the regprocedure identity used
# to resolve the OID (value, not noun — survives rename). emit_neut_guard -> the FULL
# hand-written neutralized CREATE OR REPLACE, header copied BYTE-FOR-BYTE from the
# pg_get_functiondef snapshot (⚠ assert_meeting_staff_admin is STABLE and NOT SECURITY
# DEFINER — do not "fix" it), body with the authz raise removed.
# ─────────────────────────────────────────────────────────────────────────────────────
GUARD_KEYS="assert_capa_writable assert_meeting_staff_admin assert_interview_writable assert_rca_writable assert_session_writable assert_referral_draft_writable assert_referral_target_acts"

guard_sig () {
  case "$1" in
    assert_capa_writable)           echo "app.assert_capa_writable(uuid)";;
    assert_meeting_staff_admin)     echo "app.assert_meeting_staff_admin(uuid)";;
    assert_interview_writable)      echo "app.assert_interview_writable(uuid)";;
    assert_rca_writable)            echo "app.assert_rca_writable(uuid)";;
    assert_session_writable)        echo "app.assert_session_writable(uuid)";;
    assert_referral_draft_writable) echo "app.assert_referral_draft_writable(uuid)";;
    assert_referral_target_acts)    echo "app.assert_referral_target_acts(uuid,text[])";;
    *) echo "";;
  esac
}

emit_neut_guard () {
  case "$1" in
    assert_capa_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_capa_writable(p_capa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
begin
  if (select id from public.capa_plan where id = p_capa_id) is null then
    raise exception 'plano de ação não encontrado' using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_capa gate opened).
end;
$function$;
SQL
    ;;
    assert_meeting_staff_admin) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_meeting_staff_admin(p_meeting_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
begin
  v_commission_id := app.commission_of_meeting(p_meeting_id);
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.is_staff_admin_of gate opened); return kept.
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_interview_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_interview_writable(p_interview_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id
  from public.case_interviews where id = p_interview_id;
  if v_commission_id is null then
    raise exception 'entrevista % não encontrada', p_interview_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_interview gate opened); return kept.
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_rca_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_rca_writable(p_rca_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.rca where id = p_rca_id;
  if v_event_id is null then
    raise exception 'análise de causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_rca gate opened); return kept.
  return v_event_id;
end;
$function$;
SQL
    ;;
    assert_session_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_session_writable(p_session_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_interview_id uuid;
  v_commission_id uuid;
begin
  select interview_id into v_interview_id
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT (SPECIAL): the original body's ONLY authz is the delegated call
  -- `return app.assert_interview_writable(v_interview_id)`. Leaving it intact would let the
  -- un-neutralized interview guard enforce authz and MASK session blindness. We replace it
  -- with a direct, un-gated commission lookup returning the SAME value -> the session gate
  -- is isolated and opened.
  select commission_id into v_commission_id
  from public.case_interviews where id = v_interview_id;
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_referral_draft_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_referral_draft_writable(p_referral_id uuid)
 RETURNS case_referral
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_manage_referral_source gate opened);
  -- the non-authz workflow-STATE guard (status = 'draft') is PRESERVED.
  if v_referral.status <> 'draft' then
    raise exception 'o encaminhamento não está em rascunho' using errcode = 'HC070';
  end if;
  return v_referral;
end;
$function$;
SQL
    ;;
    assert_referral_target_acts) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_referral_target_acts(p_referral_id uuid, p_expected text[])
 RETURNS case_referral
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_manage_referral_target gate opened);
  -- the non-authz workflow-STATE guard (status = any(p_expected)) is PRESERVED.
  if not (v_referral.status = any (p_expected)) then
    raise exception 'o encaminhamento não está no estado necessário para esta ação'
      using errcode = 'HC070';
  end if;
  return v_referral;
end;
$function$;
SQL
    ;;
    *) echo "-- unknown guard: $1" ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 2 data: the 33 write policies (captured snapshot, embedded self-contained).
# Pipe-delimited (no '|' occurs in any qual/with_check of these 33); '-' = clause absent.
# Columns:  tbl | polname | cmd | qual | with_check
# At runtime we DRIFT-CHECK each live pg_get_expr against these snapshot values (ERROR on
# mismatch); the restore source is the live capture, not the snapshot.
# ─────────────────────────────────────────────────────────────────────────────────────
write_worklist_pol () {
  cat > "$POLWL" <<'TSV'
capa_plan|capa_plan_delete|DELETE|app.can_write_capa(id, auth.uid())|-
capa_plan|capa_plan_update|UPDATE|app.can_write_capa(id, auth.uid())|app.can_write_capa(id, auth.uid())
case_interviews|case_interviews_delete|DELETE|app.can_write_interview(id, auth.uid())|-
case_interviews|case_interviews_insert|INSERT|-|(app.is_staff_admin_of(commission_id) AND (NOT app.is_case_excluded(case_id, auth.uid())))
case_interviews|case_interviews_update|UPDATE|app.can_write_interview(id, auth.uid())|app.can_write_interview(id, auth.uid())
case_referral|case_referral_delete_draft_source|DELETE|((status = 'draft'::text) AND app.can_manage_referral_source(id, auth.uid()))|-
case_referral|case_referral_insert_source_coord|INSERT|-|app.is_staff_admin_of_for(source_commission_id, auth.uid())
case_referral|case_referral_update_coord|UPDATE|(app.can_manage_referral_source(id, auth.uid()) OR app.can_manage_referral_target(id, auth.uid()))|(app.can_manage_referral_source(id, auth.uid()) OR app.can_manage_referral_target(id, auth.uid()))
meeting_agenda_items|meeting_agenda_items_staff_admin_delete|DELETE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|-
meeting_agenda_items|meeting_agenda_items_staff_admin_insert|INSERT|-|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_agenda_items|meeting_agenda_items_staff_admin_update|UPDATE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_attendees|meeting_attendees_staff_admin_delete|DELETE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|-
meeting_attendees|meeting_attendees_staff_admin_insert|INSERT|-|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_attendees|meeting_attendees_staff_admin_update|UPDATE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_cases|meeting_cases_staff_admin_delete|DELETE|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, auth.uid()))|-
meeting_cases|meeting_cases_staff_admin_insert|INSERT|-|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, auth.uid()))
meeting_cases|meeting_cases_staff_admin_update|UPDATE|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, auth.uid()))|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, auth.uid()))
meeting_signatures|meeting_signatures_insert|INSERT|-|((signer_id = auth.uid()) AND app.can_sign_meeting(attendee_id, auth.uid()))
meetings|meetings_staff_admin_delete|DELETE|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))|-
meetings|meetings_staff_admin_insert|INSERT|-|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))
meetings|meetings_staff_admin_update|UPDATE|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))
notification_preferences|notification_preferences_insert_own|INSERT|-|(user_id = ( SELECT auth.uid() AS uid))
notification_preferences|notification_preferences_update_own|UPDATE|(user_id = ( SELECT auth.uid() AS uid))|(user_id = ( SELECT auth.uid() AS uid))
notifications|notifications_update_own|UPDATE|(user_id = ( SELECT auth.uid() AS uid))|(user_id = ( SELECT auth.uid() AS uid))
profiles|profiles_admin_insert|INSERT|-|app.is_admin()
profiles|profiles_admin_update|UPDATE|app.is_admin()|app.is_admin()
profiles|profiles_update_self|UPDATE|(id = auth.uid())|(id = auth.uid())
rca|rca_delete|DELETE|app.can_write_rca(id, auth.uid())|-
rca|rca_update|UPDATE|app.can_write_rca(id, auth.uid())|app.can_write_rca(id, auth.uid())
response_section_signoffs|signoffs_insert|INSERT|-|((signed_by = auth.uid()) AND app.can_sign_section(response_id, section_id, auth.uid()))
responses|responses_delete_own_draft|DELETE|((created_by = auth.uid()) AND (status = 'in_progress'::text))|-
responses|responses_insert_own|INSERT|-|((created_by = ( SELECT auth.uid() AS uid)) AND app.is_member_of(commission_id))
responses|responses_update_own_draft|UPDATE|((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'in_progress'::text))|(created_by = ( SELECT auth.uid() AS uid))
TSV
}

# ─────────────────────────────────────────────────────────────────────────────────────
# DRYRUN — print every neutralization, ZERO DB access. Print BEFORE any preflight so the
# lead can eyeball the 7 bespoke guard bodies without a running stack.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "$DRYRUN" = "1" ]; then
  write_worklist_pol
  echo "=== DRYRUN — neutralizations only, NO DB ACCESS ==="
  echo
  echo "############## ARM 1: 7 authz raise-guards (full neutralized CREATE OR REPLACE) ##############"
  for k in $GUARD_KEYS; do
    want "$k" || continue
    echo
    echo "===== $k  ->  $(guard_sig "$k") ====="
    emit_neut_guard "$k"
  done
  echo
  echo "############## ARM 2: write policies (ALTER POLICY opening the check) ##############"
  while IFS='|' read -r tbl polname cmd qual wc; do
    [ -z "$tbl" ] && continue
    case "$tbl" in \#*) continue;; esac
    want "$polname" || continue
    haveq=0; havew=0
    [ "$qual" != "-" ] && haveq=1
    [ "$wc"   != "-" ] && havew=1
    # vacuous?
    vac=1
    { [ "$haveq" = 1 ] && [ "$qual" != "true" ]; } && vac=0
    { [ "$havew" = 1 ] && [ "$wc"   != "true" ]; } && vac=0
    if [ "$vac" = 1 ]; then
      printf -- '-- SKIP (vacuous, clause already true): %s.%s (%s)\n' "$tbl" "$polname" "$cmd"
      continue
    fi
    stmt="alter policy \"$polname\" on public.\"$tbl\""
    [ "$haveq" = 1 ] && stmt="$stmt using (true)"
    [ "$havew" = 1 ] && stmt="$stmt with check (true)"
    printf '%s;   -- %s\n' "$stmt" "$cmd"
  done < "$POLWL"
  echo
  echo "=== DRYRUN done. Guards printed: 7 (2 excluded: assert_meeting_roster_nonempty,"
  echo "    assert_condition_value_codes = data validators). Policies: see above. ==="
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# LIVE run.  Restore-on-exit trap (§7.5 shared-stack single-owner): a kill mid-run must
# not leave a gate OPEN. INFLIGHT points at the SQL that restores the current gate; cleared
# the instant its inline restore verifies. Set BEFORE neutralizing/opening.
# ─────────────────────────────────────────────────────────────────────────────────────
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight gate from $INFLIGHT)"
    psql_f "$INFLIGHT" >/dev/null 2>&1
  fi
}
trap restore_inflight EXIT

run_suite () { ( cd "$ROOT" && supabase test db ) 2>&1; }   # echoes raw suite output; ~23s

# classify OUTPUT -> sets globals VERDICT, FAILING, RUNFILES, RUNTESTS
classify () {
  local out="$1" res ft dubious
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  RUNFILES=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  RUNTESTS=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  dubious=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  FAILING=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' \
            | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  # §7.15: a run whose SHAPE differs from baseline (fewer files/tests, or Dubious) is an
  # ABORT — a harness bug (bad neutralization), NOT a BLIND/COVERED result.
  if [ -z "$res" ] || [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    VERDICT="ERROR"
  elif [ "$res" = "FAIL" ]; then
    VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then
    VERDICT="BLIND"
  else
    VERDICT="ERROR"
  fi
}

echo "=== P0 AUTHZ WRITE-PATH AUDIT — open each write gate, ask the WHOLE SUITE if anyone noticed ==="
echo "Repo: $ROOT"
echo "--- preflight: capturing GREEN baseline (§7.3 assert the state) ---"
BASE_OUT=$(run_suite)
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A dirty"
  echo "    baseline invalidates every case (a COVERED can't be told from a pre-existing red)."
  echo "    Fix the tree to green before auditing. Aborting."; exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"
echo

write_worklist_pol
: > "$PROGRESS"

# Regenerate the two deliverables from writepath_progress.tsv after EVERY case so a
# mid-run kill still leaves a coherent partial report.
emit_report () {
  {
    echo "# AUTHZ Write-Path Door-Blindness Audit — Findings"
    echo
    echo "AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14) — WRITE-PATH arm. Generated by"
    echo "\`supabase/tests/mutation/p0-authz-writepath-audit.sh\`. Companion to the read/door"
    echo "audit. Method: open each write-path authz gate (raise-guard authz raise removed, or"
    echo "policy check set to \`true\`), run the FULL pgTAP suite, read \`Result:\`."
    echo "**COVERED** = suite went \`FAIL\` (a keystone asserts the gate denies an unauthorized"
    echo "writer). **BLIND** = suite stayed \`PASS\` (no keystone exercises it — a work-list item)."
    echo "**ERROR** = run shape != baseline (harness bug: fix the neutralization, not a result)."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Arm 1 guards: 7 (excluded non-authz validators: \`assert_meeting_roster_nonempty\`,"
    echo "\`assert_condition_value_codes\`). Arm 2 write policies: from the embedded snapshot."
    if [ -n "$CASES" ]; then echo; echo "> ⚠ PARTIAL RUN — CASES=\"$CASES\" (subset, not the full sweep)."; fi
    echo
    echo "## BLIND — the work-list (no keystone exercises these)"
    echo
    echo "| gate / policy | arm | direction | verdict | note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## COVERED (asserted-through) + ERROR (harness bug) + SKIPPED (vacuous)"
    echo
    echo "| gate / policy | arm | direction | verdict | failing files / note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4!="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
  } > "$FINDINGS"

  { echo -e "arm\tgate\tdirection\tfailing_or_note";
    awk -F'\t' '$4=="BLIND"{printf "%s\t%s\t%s\t%s\n",$1,$2,$3,$5}' "$PROGRESS"; } > "$BLINDS_TSV"
}

record () {  # arm gate direction verdict failing
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  emit_report
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 1 — authz RAISE-GUARDS (bespoke neutralization)
# ─────────────────────────────────────────────────────────────────────────────────────
echo "=== ARM 1: authz raise-guards ==="
for k in $GUARD_KEYS; do
  want "$k" || continue
  sig="$(guard_sig "$k")"
  oid=$(psql_c -c "select '$sig'::regprocedure::oid" 2>&1)
  if ! echo "$oid" | grep -qE '^[0-9]+$'; then
    record "guard" "$sig" "authz-open" "ERROR" "OID lookup failed: $(echo "$oid" | tr '\n' ' ' | head -c 120)"
    echo "  ERROR  $sig (oid lookup)"; continue
  fi

  orig="$WORK/orig_wp_guard_$k.sql"
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"   # exact bytes for restore + verify
  INFLIGHT="$orig"                                          # arm the trap before opening

  emit_neut_guard "$k" > "$WORK/_wp_mut.sql"
  mout=$(psql_f "$WORK/_wp_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    record "guard" "$sig" "authz-open" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    psql_f "$orig" >/dev/null 2>&1; INFLIGHT=""
    echo "  ERROR  $sig (neutralize failed)"; continue
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/guard_$k.log"
  classify "$out"

  # RESTORE exact original bytes + VERIFY round-trip (§7.5 contamination guard)
  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $sig did NOT round-trip. Every later case is suspect."
    echo "    Aborting the sweep (§7.5)."; exit 2
  fi
  INFLIGHT=""

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "guard" "$sig" "authz-open" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$sig"
done

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 2 — write POLICIES (open the check to true)
# ─────────────────────────────────────────────────────────────────────────────────────
echo
echo "=== ARM 2: write policies ==="
while IFS='|' read -r tbl polname cmd qual wc; do
  [ -z "$tbl" ] && continue
  case "$tbl" in \#*) continue;; esac
  want "$polname" || continue

  haveq=0; havew=0
  [ "$qual" != "-" ] && haveq=1
  [ "$wc"   != "-" ] && havew=1

  # vacuous skip: every clause that exists is already `true`
  vac=1
  { [ "$haveq" = 1 ] && [ "$qual" != "true" ]; } && vac=0
  { [ "$havew" = 1 ] && [ "$wc"   != "true" ]; } && vac=0
  if [ "$vac" = 1 ]; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "SKIPPED" "vacuous: relevant clause already true"
    echo "  SKIPPED $tbl.$polname (vacuous)"; continue
  fi

  s=$(slug "${tbl}_${polname}")
  qfile="$WORK/orig_wp_pol_$s.qual"; wfile="$WORK/orig_wp_pol_$s.wc"
  restore="$WORK/restore_wp_pol_$s.sql"
  regc="public.\"$tbl\""

  : > "$qfile"; : > "$wfile"
  [ "$haveq" = 1 ] && psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass" > "$qfile"
  [ "$havew" = 1 ] && psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass" > "$wfile"

  # §7.2 DRIFT tripwire: the live catalog must match the embedded snapshot, else the
  # worklist is stale and neutralizing is unsafe. ERROR (not a result), do not open.
  if [ "$haveq" = 1 ] && [ "$(cat "$qfile")" != "$qual" ]; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "snapshot drift (qual): live='$(cat "$qfile")'"
    echo "  ERROR  $tbl.$polname (qual drift)"; continue
  fi
  if [ "$havew" = 1 ] && [ "$(cat "$wfile")" != "$wc" ]; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "snapshot drift (with_check): live='$(cat "$wfile")'"
    echo "  ERROR  $tbl.$polname (wc drift)"; continue
  fi

  # RESTORE built from the LIVE capture (byte-exact), armed BEFORE opening.
  {
    printf 'alter policy "%s" on public."%s"' "$polname" "$tbl"
    [ "$haveq" = 1 ] && printf ' using (%s)' "$(cat "$qfile")"
    [ "$havew" = 1 ] && printf ' with check (%s)' "$(cat "$wfile")"
    printf ';\n'
  } > "$restore"
  INFLIGHT="$restore"

  # OPEN the policy: using(true) [+ with check(true)] — only clauses that exist.
  {
    printf 'alter policy "%s" on public."%s"' "$polname" "$tbl"
    [ "$haveq" = 1 ] && printf ' using (true)'
    [ "$havew" = 1 ] && printf ' with check (true)'
    printf ';\n'
  } > "$WORK/_wp_mut.sql"
  mout=$(psql_f "$WORK/_wp_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "open failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    psql_f "$restore" >/dev/null 2>&1; INFLIGHT=""
    echo "  ERROR  $tbl.$polname (open failed)"; continue
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pol_$s.log"
  classify "$out"

  # RESTORE exact original + VERIFY round-trip
  psql_f "$restore" >/dev/null 2>&1
  if [ "$haveq" = 1 ]; then
    nowq=$(psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass")
    if [ "$nowq" != "$(cat "$qfile")" ]; then
      echo "*** CONTAMINATION: restore of $tbl.$polname qual did NOT round-trip. Aborting (§7.5)."; exit 2
    fi
  fi
  if [ "$havew" = 1 ]; then
    noww=$(psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass")
    if [ "$noww" != "$(cat "$wfile")" ]; then
      echo "*** CONTAMINATION: restore of $tbl.$polname with_check did NOT round-trip. Aborting (§7.5)."; exit 2
    fi
  fi
  INFLIGHT=""

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "policy" "$tbl.$polname ($cmd)" "open->true" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$tbl.$polname"
done < "$POLWL"

echo
echo "=== DONE. Report: $FINDINGS   BLINDs: $BLINDS_TSV ==="
blind_ct=$(awk -F'\t' '$4=="BLIND"' "$PROGRESS" | wc -l | tr -d '[:space:]')
err_ct=$(awk -F'\t' '$4=="ERROR"' "$PROGRESS" | wc -l | tr -d '[:space:]')
skip_ct=$(awk -F'\t' '$4=="SKIPPED"' "$PROGRESS" | wc -l | tr -d '[:space:]')
echo "BLIND: $blind_ct   ERROR(harness): $err_ct   SKIPPED(vacuous): $skip_ct   (COVERED = the rest)"
