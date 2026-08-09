#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/b1-org-admin-wall-mutation-audit.sh
# Every row must read RED-PROVEN, and every CONTROL must read all-green.
#
# QO·B (ADR 0100 D12) MUTATION AUDIT — the org_admin / hospital_admin content wall.
# 39 cases. ⚠ Keep this count and the run_case list in sync.
#
# EXTENDED AGAIN (2026-08-09, QA r1 BLOCKER-1 + MAJOR-1): 6 cases red-prove the M7
# case-plane doors whose arm is LOAD-BEARING (314 §11 — remove_case_participant,
# record_recusal, lift_recusal, case_viewer_capabilities, case_tag_report,
# schedule_ethics_hearing), and 2 cases red-prove the zero-row not-found guard on
# cancel_case/close_case (the two doors that actually exhibited MAJOR-1's
# silent-success). set_case_outcome + update_case_narrative_body have NO arm-restore
# case on purpose — their arm is a masked token behind an RLS lookup that already
# denies the tenancy admin, so restoring it changes nothing (unfalsifiable by
# construction; see the PRELUDE note). Their cut is covered by the catalog
# correspondence 314 11.34, not by a vacuous mutation case.
#
# EXTENDED (2026-08-09, keystone closure of the self-audit's risk #1): cases 18–30
# red-prove the THIRTEEN M5/M6 doors that previously rested only on the migrations'
# structural postconditions (314 §9/§10 are their keystones), and case 31
# (fup_qob1_drop_created_by) red-proves 270 §J's J1c structural pin — dropping the
# `created_by = auth.uid()` term reds J1c while J1b stays green, which demonstrates
# in one run the exact vacuity FUP-QOB-1 records.
#
# THIS AUDIT RUNS IN BOTH DIRECTIONS, and the second direction is the point.
#
#   UNDER-CUT (cases 1–10): revert one cut and its keystone must go red. This is the
#   ordinary shape — it proves each wall assertion can fail.
#
#   OVER-CUT (cases 11–14): remove a ratified KEEP and its guard must go red. QO·B is a
#   SPLIT, not a sweep: the PO kept form definitions, process templates, taxonomy,
#   indicator DEFINITIONS, the three case-access doors and the two classification doors.
#   Nothing in an "did we remove enough?" audit can see an over-cut, and an over-cut is
#   the failure that reaches a customer as "the admin can no longer do their job".
#   A no-regression claim needs an over-grant twin, and these are it.
#
# The sharpest two:
#
#   restore_admin_all — responses_admin_all was a bare FOR ALL tenancy grant, and the
#   defect it carried (BUG-QOB-001) was DESTRUCTIVE: pre-M1 an org_admin deleted 6
#   in-progress drafts owned by other users. 314's 1.3b attempts that delete for real
#   and asserts the victim's row survived, read as the victim. If restoring the policy
#   does not red 1.3b, the keystone is decorative.
#
#   restore_print_wrapper — can_view_printed_document's form_response arm MIRRORS the
#   responses policies, and printed_documents holds ZERO rows in a clean seed, so the
#   A/B equivalence matrix is blind to it. 314's 2.6 is the only thing covering that
#   cut; this case is what proves 2.6 is real.
#
# Mutations run INSIDE the suite's begin..rollback transaction (DDL is transactional),
# so the catalog restores itself; §RESTORE additionally byte-compares every touched
# object against its pre-run image to PROVE it.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'
SRC="supabase/tests/314_qob_org_admin_content_wall.sql"

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_b1_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 70);
  end if;
  return out;
end; $s$;

-- Append a disjunct to a policy's USING expression. Asserts the policy exists AND that
-- the arm is not already there — otherwise a "restore" that changed nothing would score
-- as RED-PROVEN off the suite's ordinary state.
create or replace function app._mut_b1_arm(p_policy text, p_table text, p_arm text) returns void
  language plpgsql as $a$
declare v_qual text;
begin
  select pg_get_expr(polqual, polrelid) into v_qual
    from pg_policy where polname = p_policy;
  if v_qual is null then
    raise exception 'MUTATION NO-OP: policy % not found', p_policy;
  end if;
  if v_qual ~ 'is_commission_admin_of' then
    raise exception 'MUTATION NO-OP: % already carries the tenancy arm', p_policy;
  end if;
  execute format('alter policy %I on %s using (%s or %s)', p_policy, p_table, v_qual, p_arm);
end; $a$;

create or replace function app._mut_b1(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  -- ── UNDER-CUT: revert a QO·B cut; its keystone must notice ────────────────
  if p_what = 'restore_admin_all' then
    -- M1 dropped this outright. Bring back the bare FOR ALL tenancy grant.
    execute $q$create policy responses_admin_all on public.responses
      as permissive for all to authenticated
      using (app.is_commission_admin_of(commission_id))
      with check (app.is_commission_admin_of(commission_id))$q$;

  elsif p_what = 'restore_responses_select_arm' then
    perform app._mut_b1_arm('responses_select', 'public.responses',
      'app.is_commission_admin_of(commission_id)');

  elsif p_what = 'restore_answers_arm' then
    -- ⚠ MEASURED DEPENDENCY, found by this audit scoring GREEN on the first attempt.
    -- answers_select's tenancy arm lives INSIDE an exists-subquery over public.responses,
    -- and that subquery runs UNDER RLS. Once M1 closed the responses policy the arm can
    -- never fire — restoring it ALONE changes nothing, so a case that restored only the
    -- answers arm was unfalsifiable BY CONSTRUCTION and scored green while looking like
    -- a real probe. (Same shape as 270 §J: a predicate denied by the parent's
    -- invisibility, not by its own term.)
    -- So the answers cut is defence-in-depth; the LOAD-BEARING cut is on responses. This
    -- case restores BOTH and requires the answer keystone to red, which is the honest
    -- statement of what the pair guarantees.
    perform app._mut_b1_arm('responses_select', 'public.responses',
      'app.is_commission_admin_of(commission_id)');
    perform app._mut_b1_arm('answers_select', 'public.answers',
      'exists (select 1 from public.responses r where r.id = answers.response_id and app.is_commission_admin_of(r.commission_id))');

  elsif p_what = 'restore_controlled_documents_arm' then
    perform app._mut_b1_arm('controlled_documents_select', 'public.controlled_documents',
      'app.is_commission_admin_of(commission_id)');

  elsif p_what = 'restore_doc_wrapper' then
    -- The A4 K2 half: the POLICY is clean, the WRAPPER is what actually gates.
    execute $q$create or replace function app.can_read_document_of_version(p_version_id uuid, p_uid uuid)
      returns boolean language sql stable security definer
      set search_path to 'app', 'public', 'pg_catalog'
      as $f$ select app.is_member_of_for(app.commission_of_document_version(p_version_id), p_uid)
                 or app.is_commission_admin_of_for(app.commission_of_document_version(p_version_id), p_uid); $f$$q$;

  elsif p_what = 'restore_print_wrapper' then
    d := pg_get_functiondef('app.can_view_printed_document(text,uuid,uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'return v_resp.created_by = p_uid',
      'return v_resp.created_by = p_uid
          or app.is_commission_admin_of_for(v_resp.commission_id, p_uid)');
    execute d;

  elsif p_what = 'restore_measurement_arm' then
    perform app._mut_b1_arm('indicator_measurements_select', 'public.indicator_measurements',
      'exists (select 1 from public.indicators i where i.id = indicator_measurements.indicator_id and app.is_commission_admin_of(i.commission_id))');

  elsif p_what = 'restore_case_door_arm' then
    -- BUG-QOB-002: write-without-read returns.
    d := pg_get_functiondef('public.update_case_meta(uuid,text,uuid,text)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if app.is_staff_admin_of(v_commission) then',
      'if app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission) then');
    execute d;

  elsif p_what = 'restore_free_text_door' then
    -- M5's hole: a DEFINER door bypasses RLS entirely, so the tenancy admin read every
    -- free-text answer while the responses table returned zero.
    d := pg_get_functiondef('public.dashboard_free_text(uuid,date,date,integer)'::regprocedure);
    d := app._mut_b1_sub(d,
      'app.is_staff_admin_of(v_commission_id)',
      'app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)');
    execute d;

  elsif p_what = 'restore_export_rows_door' then
    d := pg_get_functiondef('public.dashboard_export_rows(uuid,date,date)'::regprocedure);
    d := app._mut_b1_sub(d,
      'app.is_staff_admin_of(v_commission_id)',
      'app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)');
    execute d;

  elsif p_what = 'restore_doc_list_door' then
    -- M6's hole, one plane over from M5's: the document POLICIES were cut while ten
    -- DEFINER doors kept the tenancy arm and bypassed RLS entirely.
    d := pg_get_functiondef('public.list_commission_documents(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'app.is_member_of(p_commission)',
      'app.is_member_of(p_commission) or app.is_commission_admin_of(p_commission)');
    execute d;

  elsif p_what = 'restore_attachment_write_arm' then
    d := pg_get_functiondef('app.can_write_attachment(text,uuid,uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'return app.is_staff_admin_of_for(v_commission, p_uid);',
      'return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);');
    execute d;

  -- ── UNDER-CUT, the M5/M6 DOOR keystones (314 §9/§10) ──────────────────────
  elsif p_what = 'restore_completion_door' then
    d := pg_get_functiondef('public.dashboard_completion_by_member(uuid,date,date)'::regprocedure);
    d := app._mut_b1_sub(d,
      'app.is_staff_admin_of(v_commission_id)',
      'app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)');
    execute d;

  elsif p_what = 'restore_signoff_door' then
    d := pg_get_functiondef('public.get_response_for_signoff(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'app.is_staff_admin_of(v_response.commission_id)',
      'app.is_staff_admin_of(v_response.commission_id) or app.is_commission_admin_of(v_response.commission_id)');
    execute d;

  elsif p_what = 'restore_supersede_response_door' then
    d := pg_get_functiondef('public.supersede_response(uuid,text)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_target_door' then
    d := pg_get_functiondef('public.target_case_response(uuid,uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_create_door' then
    d := pg_get_functiondef('public.create_controlled_document(uuid,text,text,integer,text,text[],text)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(p_commission)) then',
      'if not (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_update_door' then
    d := pg_get_functiondef('public.update_controlled_document(uuid,text,text,integer,text,text[],text)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_setfile_door' then
    d := pg_get_functiondef('public.set_document_version_file(uuid,text,text,date)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_submit_door' then
    d := pg_get_functiondef('public.submit_document_for_approval(uuid,jsonb,date,date)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_remind_door' then
    d := pg_get_functiondef('public.remind_document_approver(uuid,uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_publish_door' then
    d := pg_get_functiondef('public.publish_document(uuid,date,date,date)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_supersede_door' then
    d := pg_get_functiondef('public.supersede_document(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_obsolete_door' then
    d := pg_get_functiondef('public.mark_document_obsolete(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_doc_review_list_door' then
    d := pg_get_functiondef('public.documents_due_for_review(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_member_of(p_commission)) then',
      'if not (app.is_member_of(p_commission) or app.is_commission_admin_of(p_commission)) then');
    execute d;

  -- ── UNDER-CUT, the M7 CASE-PLANE doors (314 §11; QA r1 BLOCKER-1) ─────────
  -- Each restores the tenancy disjunct (BOTH variants where the door carried
  -- _for) that M7 cut, so its §11 denial keystone must red.
  elsif p_what = 'restore_remove_participant_door' then
    d := pg_get_functiondef('public.remove_case_participant(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_record_recusal_door' then
    d := pg_get_functiondef('public.record_recusal(uuid,uuid,text,uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'v_is_coord_raw := app.is_staff_admin_of(v_commission);',
      'v_is_coord_raw := app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission);');
    execute d;

  elsif p_what = 'restore_lift_recusal_door' then
    d := pg_get_functiondef('public.lift_recusal(uuid,text)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  elsif p_what = 'restore_viewer_caps_door' then
    -- case_viewer_capabilities: the can_manage_lifecycle bit used the _for variant.
    d := pg_get_functiondef('public.case_viewer_capabilities(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      'app.is_staff_admin_of_for(v_commission, v_uid)',
      'app.is_staff_admin_of_for(v_commission, v_uid) or app.is_commission_admin_of_for(v_commission, v_uid)');
    execute d;

  elsif p_what = 'restore_tag_report_door' then
    d := pg_get_functiondef('public.case_tag_report(uuid,date,date)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(p_commission_id)) then',
      'if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then');
    execute d;

  elsif p_what = 'restore_schedule_hearing_door' then
    d := pg_get_functiondef('public.schedule_ethics_hearing(uuid,text,uuid,timestamptz)'::regprocedure);
    d := app._mut_b1_sub(d,
      'if not (app.is_staff_admin_of(v_commission)) then',
      'if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then');
    execute d;

  -- ⚠ NO restore_case_outcome_arm / restore_narrative_body_arm case, DELIBERATELY,
  -- and this is a finding worth keeping (mirrors restore_answers_arm above). Both
  -- doors are INVOKER and read public.cases / case_narratives DIRECTLY under RLS at
  -- their OWN lookup, which A4 already walls for the tenancy admin — so the lookup
  -- raises P0002 BEFORE the authority arm is ever evaluated. Restoring the arm alone
  -- therefore changes NOTHING for the tenancy admin (314's 11.12/11.13 stay P0002 =
  -- GREEN), i.e. the arm is a MASKED token, not the load-bearing gate. M7 cuts it as
  -- catalog hygiene (postcondition (a) / 314 11.34 — the §4.4 correspondence), and
  -- the behavioural denial (11.12/11.13) is red-proven by A4's RLS wall, not by
  -- this arm. A b1 case here would be unfalsifiable BY CONSTRUCTION — the exact
  -- §7.1 vacuity shape this harness exists to refuse.

  -- ── MAJOR-1: the zero-row not-found guard on the two silent-success doors. ──
  -- Reverting the guard restores the SILENT SUCCESS an excluded coordinator got,
  -- so 314 §11d's 11.27/11.28 (which require the raise) must red.
  elsif p_what = 'revert_cancel_zero_row_guard' then
    d := pg_get_functiondef('public.cancel_case(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      E'  returning * into v_result;\n  if v_result.id is null then\n    raise exception ''caso % não encontrado'', p_case_id using errcode = ''no_data_found'';\n  end if;\n\n  update public.case_phases',
      E'  returning * into v_result;\n\n  update public.case_phases');
    execute d;

  elsif p_what = 'revert_close_zero_row_guard' then
    d := pg_get_functiondef('public.close_case(uuid)'::regprocedure);
    d := app._mut_b1_sub(d,
      E'  returning * into v_result;\n  if v_result.id is null then\n    raise exception ''caso % não encontrado'', p_case_id using errcode = ''no_data_found'';\n  end if;\n\n  update public.case_phases',
      E'  returning * into v_result;\n\n  update public.case_phases');
    execute d;

  -- ── FUP-QOB-1: the J1c structural pin must notice the term''s deletion ─────
  elsif p_what = 'fup_qob1_drop_created_by' then
    -- Widen write_own_draft by DROPPING its created_by term. The creator still
    -- passes the exists() (so 270''s creator-write fixtures keep running and the
    -- run shape stays baseline); J1b still passes 42501 via parent invisibility
    -- (the vacuity FUP-QOB-1 records, demonstrated live); ONLY J1c may red.
    execute $q$alter policy response_group_instances_write_own_draft
      on public.response_group_instances
      using (exists (select 1 from public.responses r
                     where r.id = response_group_instances.response_id
                       and r.status = 'in_progress'))
      with check (exists (select 1 from public.responses r
                          where r.id = response_group_instances.response_id
                            and r.status = 'in_progress'))$q$;

  -- ── OVER-CUT: remove a ratified KEEP; its guard must notice ───────────────
  elsif p_what = 'overcut_revoke_ruling' then
    -- ADR 0104 D11 KEEPS revoke_printed_document's tenancy arm: revocation is a
    -- governance act that reveals no content. Sweeping it is the plausible tidy-up.
    d := pg_get_functiondef('public.revoke_printed_document(uuid,text,text)'::regprocedure);
    d := app._mut_b1_sub(d, ' or app.is_commission_admin_of_for(v_row.commission_id, auth.uid())', '');
    execute d;

  elsif p_what = 'overcut_aggregate_door' then
    -- D12 (6) KEEPS the six PHI-free aggregates. The nine dashboard_* doors split
    -- six-to-three, so "finish the job across all nine" is the plausible tidy-up.
    d := pg_get_functiondef('public.dashboard_form_totals(uuid,date,date)'::regprocedure);
    d := app._mut_b1_sub(d, ' or app.is_commission_admin_of(p_commission_id)', '');
    execute d;

  elsif p_what = 'overcut_indicators_select' then
    -- PO ruling Q3 is a SPLIT: the DEFINITION stays readable. Sweeping it away with
    -- the measurement is the mistake a "cut the indicator family" tidy-up makes.
    declare v_qual text;
    begin
      select pg_get_expr(polqual, polrelid) into v_qual from pg_policy where polname='indicators_select';
      v_qual := app._mut_b1_sub(v_qual, ' OR app.is_commission_admin_of(commission_id)', '');
      execute format('alter policy indicators_select on public.indicators using (%s)', v_qual);
    end;

  elsif p_what = 'overcut_keep_door' then
    -- PO ruling Q8: grant_case_access stays. It is safe because self-escalation is
    -- independently blocked (org_admin is not a commission member), NOT because the
    -- arm is absent. Cutting it is the plausible over-zealous sweep.
    d := pg_get_functiondef('public.grant_case_access(uuid,uuid,text,timestamptz,text,boolean,boolean)'::regprocedure);
    d := app._mut_b1_sub(d, ' or app.is_commission_admin_of(v_commission)', '');
    execute d;

  elsif p_what = 'overcut_classification_door' then
    -- PO ruling Q9: set_case_confidentiality stays (classification shapes the container).
    d := pg_get_functiondef('public.set_case_confidentiality(uuid,text)'::regprocedure);
    d := app._mut_b1_sub(d, ' or app.is_commission_admin_of(v_case.commission_id)', '');
    execute d;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep),
               # $4 = optional suite file (defaults to $SRC — used by the 270-based
               #      FUP-QOB-1 case; the marker line is shared between the suites)
  local label="$1" mut="$2" expect="$3" src="${4:-$SRC}"
  local f="$WORK/mutb1.sql" line
  line=$(grep -n "$MARKER" "$src" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-56s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$src"; return
  fi
  { head -n "$line" "$src"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$src"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutb1.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutb1.sql 2>&1)
  if echo "$out" | grep -q 'MUTATION NO-OP'; then
    printf '%-56s *** NOT PROVEN -> MUTATION NO-OP (needle missing) ***\n' "$label"; return
  fi
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-56s %s\n' "$label" "$verdict"
}

PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_b1(text); drop function if exists app._mut_b1_sub(text,text,text); drop function if exists app._mut_b1_arm(text,text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutb1_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutb1_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

SNAP_SQL="select md5(
  (select string_agg(pg_get_functiondef(p.oid), '' order by p.oid)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where (n.nspname='app' and p.proname in ('can_read_document_of_version','can_read_document_object','can_view_printed_document'))
      or (n.nspname='app' and p.proname = 'can_write_attachment')
      or (n.nspname='public' and p.proname in ('update_case_meta','grant_case_access','set_case_confidentiality','dashboard_free_text','dashboard_export_rows','dashboard_form_totals','list_commission_documents','revoke_printed_document',
                                               'dashboard_completion_by_member','get_response_for_signoff','supersede_response','target_case_response',
                                               'create_controlled_document','update_controlled_document','publish_document','mark_document_obsolete','supersede_document',
                                               'submit_document_for_approval','set_document_version_file','documents_due_for_review','remind_document_approver',
                                               'remove_case_participant','record_recusal','lift_recusal','case_viewer_capabilities','case_tag_report',
                                               'schedule_ethics_hearing','set_case_outcome','update_case_narrative_body','cancel_case','close_case')))
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='responses_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='answers_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='controlled_documents_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='indicator_measurements_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='indicators_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='response_group_instances_write_own_draft'),'')
  || coalesce((select pg_get_expr(polwithcheck, polrelid) from pg_policy where polname='response_group_instances_write_own_draft'),'')
  || coalesce((select count(*)::text from pg_policy where polname='responses_admin_all'),''))"
SNAP_BEFORE=$(docker exec "$DB" psql -U postgres -d postgres -tAc "$SNAP_SQL")

echo "=== B1 MUTATION AUDIT — every wall keystone must go RED when ITS OWN guarantee is reverted ==="
echo
echo "--- UNDER-CUT: revert a cut, the wall must notice ---"

run_case "restore_admin_all -> the destructive FOR ALL returns" \
  "select app._mut_b1('restore_admin_all');" \
  "org_admin reads ZERO of the fixture responses|the victim's in-progress draft SURVIVED"

run_case "restore_responses_select_arm -> response rows leak" \
  "select app._mut_b1('restore_responses_select_arm');" \
  "org_admin reads ZERO of the fixture responses"

run_case "restore_answers_pair -> answer content leaks (see note)" \
  "select app._mut_b1('restore_answers_arm');" \
  "and zero of their answers"

run_case "restore_controlled_documents_arm -> document rows leak" \
  "select app._mut_b1('restore_controlled_documents_arm');" \
  "org_admin reads ZERO controlled_documents"

run_case "restore_doc_wrapper -> the A4 K2 half reopens" \
  "select app._mut_b1('restore_doc_wrapper');" \
  "can_read_document_of_version denies the tenancy admin"

run_case "restore_print_wrapper -> printed sight reopens" \
  "select app._mut_b1('restore_print_wrapper');" \
  "can_view_printed_document's form_response arm denies the tenancy admin"

run_case "restore_measurement_arm -> quality data leaks" \
  "select app._mut_b1('restore_measurement_arm');" \
  "org_admin reads ZERO indicator MEASUREMENTS"

run_case "restore_case_door_arm -> BUG-QOB-002 returns" \
  "select app._mut_b1('restore_case_door_arm');" \
  "org_admin can no longer WRITE case content"

run_case "restore_free_text_door -> M5's hole reopens"   "select app._mut_b1('restore_free_text_door');"   "org_admin reads ZERO free-text answers through the door"

run_case "restore_export_rows_door -> row-level export reopens"   "select app._mut_b1('restore_export_rows_door');"   "and zero export rows"

echo
echo "--- UNDER-CUT: the 13 M5/M6 doors previously covered ONLY structurally (314 §9/§10) ---"

run_case "restore_completion_door -> completion rows leak" \
  "select app._mut_b1('restore_completion_door');" \
  "and zero completion-by-member rows"

run_case "restore_signoff_door -> sign-off payload leaks" \
  "select app._mut_b1('restore_signoff_door');" \
  "get_response_for_signoff refuses the tenancy admin"

run_case "restore_supersede_response_door -> correction door reopens" \
  "select app._mut_b1('restore_supersede_response_door');" \
  "supersede_response refuses the tenancy admin"

run_case "restore_target_door -> ethics targeting reopens" \
  "select app._mut_b1('restore_target_door');" \
  "target_case_response refuses the tenancy admin"

run_case "restore_doc_create_door -> document creation reopens" \
  "select app._mut_b1('restore_doc_create_door');" \
  "create_controlled_document refuses the tenancy admin"

run_case "restore_doc_update_door -> header edit reopens" \
  "select app._mut_b1('restore_doc_update_door');" \
  "update_controlled_document refuses the tenancy admin"

run_case "restore_doc_setfile_door -> version file write reopens" \
  "select app._mut_b1('restore_doc_setfile_door');" \
  "set_document_version_file refuses the tenancy admin"

run_case "restore_doc_submit_door -> approval submission reopens" \
  "select app._mut_b1('restore_doc_submit_door');" \
  "submit_document_for_approval refuses the tenancy admin"

run_case "restore_doc_remind_door -> approver reminder reopens" \
  "select app._mut_b1('restore_doc_remind_door');" \
  "remind_document_approver refuses the tenancy admin"

run_case "restore_doc_publish_door -> publication reopens" \
  "select app._mut_b1('restore_doc_publish_door');" \
  "publish_document refuses the tenancy admin"

run_case "restore_doc_supersede_door -> supersession reopens" \
  "select app._mut_b1('restore_doc_supersede_door');" \
  "supersede_document refuses the tenancy admin"

run_case "restore_doc_obsolete_door -> retirement reopens" \
  "select app._mut_b1('restore_doc_obsolete_door');" \
  "mark_document_obsolete refuses the tenancy admin"

run_case "restore_doc_review_list_door -> review queue leaks" \
  "select app._mut_b1('restore_doc_review_list_door');" \
  "documents_due_for_review returns ZERO rows"

echo
echo "--- UNDER-CUT: the M7 case-plane doors (314 §11; QA r1 BLOCKER-1) ---"

run_case "restore_remove_participant_door -> participant removal reopens" \
  "select app._mut_b1('restore_remove_participant_door');" \
  "remove_case_participant refuses the tenancy admin on AUTHORITY"

run_case "restore_record_recusal_door -> recusal write reopens" \
  "select app._mut_b1('restore_record_recusal_door');" \
  "record_recusal refuses the tenancy admin"

run_case "restore_lift_recusal_door -> recusal lift reopens" \
  "select app._mut_b1('restore_lift_recusal_door');" \
  "lift_recusal refuses the tenancy admin"

run_case "restore_viewer_caps_door -> lifecycle over-report reopens" \
  "select app._mut_b1('restore_viewer_caps_door');" \
  "case_viewer_capabilities reports can_manage_lifecycle=FALSE for the tenancy admin"

run_case "restore_tag_report_door -> tag report leaks" \
  "select app._mut_b1('restore_tag_report_door');" \
  "case_tag_report returns ZERO rows to the tenancy admin"

run_case "restore_schedule_hearing_door -> hearing scheduling reopens" \
  "select app._mut_b1('restore_schedule_hearing_door');" \
  "schedule_ethics_hearing refuses on AUTHORITY"

# set_case_outcome / update_case_narrative_body: NO arm-restore case — their arm is
# a masked token behind an RLS lookup that already denies the tenancy admin (see the
# PRELUDE note). Their cut is covered by 314 11.34 (catalog correspondence), not here.

echo
echo "--- MAJOR-1: the zero-row not-found guard (314 §11d) ---"

run_case "revert_cancel_zero_row_guard -> silent success returns" \
  "select app._mut_b1('revert_cancel_zero_row_guard');" \
  "cancel_case RAISES not-found for the excluded coordinator"

run_case "revert_close_zero_row_guard -> silent success returns" \
  "select app._mut_b1('revert_close_zero_row_guard');" \
  "close_case RAISES not-found via the zero-row guard"

echo
echo "--- FUP-QOB-1: the J1c structural pin (runs 270, not 314) ---"

# Dropping created_by from write_own_draft's qual+with_check must red J1c — and
# ONLY J1c: J1b stays green under the same deletion (parent invisibility still
# denies), which is FUP-QOB-1's vacuity claim demonstrated live in this run.
run_case "fup_qob1_drop_created_by -> J1c pin notices, J1b cannot" \
  "select app._mut_b1('fup_qob1_drop_created_by');" \
  "FUP-QOB-1 STRUCTURAL PIN" \
  "supabase/tests/270_ff1_repeating_groups.sql"

echo
echo "--- OVER-CUT: remove a ratified KEEP, the over-cut guard must notice ---"

run_case "restore_doc_list_door -> M6's hole reopens"   "select app._mut_b1('restore_doc_list_door');"   "org_admin lists ZERO controlled documents through the door"

run_case "restore_attachment_write_arm -> case attachment writes reopen"   "select app._mut_b1('restore_attachment_write_arm');"   "can no longer WRITE case attachments"

echo
echo "--- OVER-CUT (continued) ---"

run_case "overcut_revoke_ruling -> ADR 0104 D11 silently reversed"   "select app._mut_b1('overcut_revoke_ruling');"   "revoke_printed_document KEEPS its tenancy arm"

run_case "overcut_indicators_select -> Q3's split collapses" \
  "select app._mut_b1('overcut_indicators_select');" \
  "STILL reads the indicator DEFINITION"

run_case "overcut_keep_door -> Q8's grant door is swept away" \
  "select app._mut_b1('overcut_keep_door');" \
  "all FIVE ratified KEEP doors must STILL admit"

run_case "overcut_aggregate_door -> D12(6)'s aggregates swept away"   "select app._mut_b1('overcut_aggregate_door');"   "the AGGREGATE doors are KEPT"

run_case "overcut_classification_door -> Q9's keep half collapses" \
  "select app._mut_b1('overcut_classification_door');" \
  "classification still works for the tenancy admin|all FIVE ratified KEEP doors must STILL admit"

echo
echo "=== RESTORE — the mutated catalog must be byte-identical to the pre-run image ==="
SNAP_AFTER=$(docker exec "$DB" psql -U postgres -d postgres -tAc "$SNAP_SQL")
if [ "$SNAP_BEFORE" = "$SNAP_AFTER" ] && [ -n "$SNAP_BEFORE" ]; then
  echo "RESTORE: OK (md5 $SNAP_AFTER)"
else
  echo "*** RESTORE FAILED — a mutation leaked out of its transaction (before=$SNAP_BEFORE after=$SNAP_AFTER) ***"
fi

echo
echo "=== CONTROL — no mutation: the suites are GREEN (proves the harness is not a red-generator) ==="
for ctrl_src in "$SRC" "supabase/tests/270_ff1_repeating_groups.sql"; do
  docker cp "$ctrl_src" "$DB:/tmp/_noop_b1.sql" >/dev/null
  control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_b1.sql 2>&1)
  if echo "$control" | grep -qE "^not ok"; then
    echo "*** CONTROL FAILED — $(basename "$ctrl_src") has a failing assertion WITHOUT any mutation ***"
    echo "$control" | grep -E "^not ok" | head -5
  else
    ok=$(echo "$control" | grep -cE "^ok")
    echo "CONTROL $(basename "$ctrl_src"): all green ($ok ok, 0 not ok)"
  fi
done
