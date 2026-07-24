#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/u2-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# EXCLUSION PERIMETER · Unit 2 MUTATION AUDIT — the CONTENT-WRITE half.
#
# Unit 2 is a NARROWING, so §7.7 bites: a narrowing that denies everyone passes its
# negative keystone BY CONSTRUCTION. For each guard 237 added, REVERT the exact
# exclusion — ONE AT A TIME — and require the matching keystone to go RED:
#   • §2a — the 10 uniform `assert_not_case_excluded` guards (each -> a `... → HC0F1`
#           negative that must fail when the guard becomes a no-op).
#   • §2b — the RPC guard (delete_committee_action_item) AND, INDEPENDENTLY, the RLS
#           term on action_items_staff_admin_write (the raw-DELETE exploit must succeed
#           when the USING term is reverted -> the "SURVIVES" keystone goes RED). Half-
#           closing the C7 gap reads as closed; both layers are proven separately.
#   • §3  — re-GRANT recompute_recommendations to authenticated (the door re-opens).
#
# Functions re-emitted from LIVE pg_get_functiondef (never migration text; lesson #5).
# Harness lessons inherited from u1/a2/a4/m1/m5/m6 (each HID A REAL RESULT):
#  1. Match keystones BY LABEL substring, never by test number.
#  2. Tri-state RED / GREEN / ABSENT — `red != abort`.
#  3. ASCII-ONLY grep patterns (the ·/→/§ marks are multi-byte — match the ASCII tail).
#  4. head/tail split (BSD awk rejects multi-line -v on macOS).
#  5. Re-emit functions from LIVE pg_get_functiondef.
#  6. A replace()/ALTER that matches nothing SILENTLY NO-OPS -> stays GREEN -> NOT PROVEN.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/237_authz_exclusion_perimeter_u2.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_u2(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'revert_activate' then
    d := pg_get_functiondef('public.activate_phase(uuid,uuid,date)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(v_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_reassign' then
    d := pg_get_functiondef('public.reassign_phase(uuid,uuid,date)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(v_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_override' then
    d := pg_get_functiondef('public.set_case_phase_result_override(uuid,uuid,text)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(v_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_add_ad_hoc' then
    d := pg_get_functiondef('public.add_ad_hoc_narrative(uuid,uuid,text,text,text,uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_assign' then
    d := pg_get_functiondef('public.assign_narrative(uuid,uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(v_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_conclude' then
    d := pg_get_functiondef('public.conclude_narrative(uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(v_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_unassign' then
    d := pg_get_functiondef('public.unassign_narrative(uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(v_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_update_meta' then
    d := pg_get_functiondef('public.update_case_meta(uuid,text,uuid,text)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_offered' then
    d := pg_get_functiondef('public.set_case_offered_outcomes(uuid,uuid[])'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case_id);', 'null;');
    execute d;
  elsif p_what = 'revert_delete_rpc' then
    d := pg_get_functiondef('public.delete_committee_action_item(uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(v_anchor_case);', 'null;');
    execute d;

  elsif p_what = 'revert_action_rls' then
    -- Drop the case-exclusion term from BOTH USING and WITH CHECK (back to pre-U2).
    execute $p$ alter policy action_items_staff_admin_write on public.action_items
      using ((app.is_staff_admin_of(commission_id)
              or (app.is_commission_admin_of(commission_id)
                  and (visibility_scope is distinct from 'case_restricted'))))
      with check ((app.is_staff_admin_of(commission_id)
              or (app.is_commission_admin_of(commission_id)
                  and (visibility_scope is distinct from 'case_restricted')))) $p$;

  elsif p_what = 'revert_recompute_guard' then
    d := pg_get_functiondef('public.recompute_recommendations(uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case_id);', 'null;');
    execute d;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutu2.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutu2.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutu2.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-52s %s\n' "$label" "$verdict"
}

# PREFLIGHT — self-sufficient (a reset drops pgtap; without it every case ABORTs).
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_u2(text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutu2_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutu2_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== U2 MUTATION AUDIT — every guard must go RED when ITS OWN exclusion is reverted ==="
echo
run_case "§2a revert_activate"        "select app._mut_u2('revert_activate');"       "recused activate_phase"
run_case "§2a revert_reassign"        "select app._mut_u2('revert_reassign');"       "recused reassign_phase"
run_case "§2a revert_override"        "select app._mut_u2('revert_override');"       "recused set_case_phase_result_override"
run_case "§2a revert_add_ad_hoc"      "select app._mut_u2('revert_add_ad_hoc');"     "recused add_ad_hoc_narrative"
run_case "§2a revert_assign"          "select app._mut_u2('revert_assign');"         "recused assign_narrative"
run_case "§2a revert_conclude"        "select app._mut_u2('revert_conclude');"       "recused conclude_narrative"
run_case "§2a revert_unassign"        "select app._mut_u2('revert_unassign');"       "recused unassign_narrative"
run_case "§2a revert_update_meta"     "select app._mut_u2('revert_update_meta');"    "recused update_case_meta"
run_case "§2a revert_offered"         "select app._mut_u2('revert_offered');"        "recused set_case_offered_outcomes"
run_case "§2b revert_delete_rpc"      "select app._mut_u2('revert_delete_rpc');"     "recused delete case-anchored"
run_case "§2b revert_action_rls"      "select app._mut_u2('revert_action_rls');"     "action item SURVIVES the raw DELETE"
run_case "§3  revert_recompute_guard" "select app._mut_u2('revert_recompute_guard');" "recompute_recommendations DIRECTLY"

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_237.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_237.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 237 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: all green ($ok ok, 0 not ok)"
fi
