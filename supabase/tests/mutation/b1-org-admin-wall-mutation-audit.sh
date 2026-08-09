#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/b1-org-admin-wall-mutation-audit.sh
# Every row must read RED-PROVEN, and every CONTROL must read all-green.
#
# QO·B (ADR 0100 D12) MUTATION AUDIT — the org_admin / hospital_admin content wall.
# 17 cases. ⚠ Keep this count and the run_case list in sync.
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

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutb1.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-56s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
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
      or (n.nspname='public' and p.proname in ('update_case_meta','grant_case_access','set_case_confidentiality','dashboard_free_text','dashboard_export_rows','dashboard_form_totals','list_commission_documents','revoke_printed_document')))
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='responses_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='answers_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='controlled_documents_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='indicator_measurements_select'),'')
  || coalesce((select pg_get_expr(polqual, polrelid) from pg_policy where polname='indicators_select'),'')
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
echo "=== CONTROL — no mutation: the suite is GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_b1.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_b1.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — $(basename "$SRC") has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok" | head -5
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL $(basename "$SRC"): all green ($ok ok, 0 not ok)"
fi
