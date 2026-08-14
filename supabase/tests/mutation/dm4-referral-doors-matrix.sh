#!/usr/bin/env bash
# =============================================================================
# DM4 neutralization matrix (ADR 0119; approval condition 2) — the two census-
# blind referral doors + the corridor arms. Census/hat/floor/wrapper pass for
# these doors NO MATTER WHAT (composite/jsonb returns), so each excluded state
# is opened INDEPENDENTLY here and pgTAP 340 is REQUIRED to go red — one twin
# standing for several states is exactly how DM3's two-codes-one-barrier hid.
#
# Method (the u1-mutation-audit dialect): copy 340, inject one mutation right
# after the wave-c fixture marker (inside 340's rolled-back txn), run, and
# demand the named assertions flip red while the file still completes.
# Run:  bash supabase/tests/mutation/dm4-referral-doors-matrix.sh
# =============================================================================
set -u
DB="${DB:-supabase_db_azkbbhskturikxpgmafq}"
SRC="${SRC:-supabase/tests/340_dm4_referral_documents.sql}"
MARKER="update app.feature_flags set enabled = true where key = 'documents_wave_c';"
WORK="$(mktemp -d)"
pass=0; fail=0

# PREFLIGHT (the u1 harness lesson): raw psql runs need pgtap + test_helpers,
# or every case ABORTs and reads as a false NOT PROVEN — and the control goes
# green having run NOTHING (a detector that finds nothing...). Install pgtap
# (remember prior state; drop on exit if we installed it — gen:types must
# never see it), and bootstrap 00_setup's helpers.
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — aborting."; exit 1
fi
docker cp supabase/tests/00_setup.sql "$DB:/tmp/00_setup.sql" >/dev/null
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/00_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select to_regprocedure('test_helpers.claims_for(uuid,boolean,text)') is not null" 2>/dev/null | grep -q t; then
  echo "PREFLIGHT FAILED: test_helpers unavailable — aborting."; exit 1
fi

run_case () {  # $1 label · $2 mutation SQL · $3 expected-red patterns (| sep)
  local label="$1" mut="$2" expect="$3" f="$WORK/mut340.sql" line out
  line=$(grep -nF "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then echo "HARNESS ERROR: marker not found"; exit 2; fi
  { head -n "$line" "$SRC"; printf '%s\n' "$mut"; tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mut340.sql" >/dev/null
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut340.sql 2>&1)
  local verdict="RED-PROVEN" bad="" IFS='|' pats
  read -ra pats <<< "$expect"
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=STILL-GREEN"
    else bad="$bad [$pat]=ABSENT(aborted?)"; fi
  done
  if [ -n "$bad" ]; then verdict="*** VACUOUS:$bad"; fail=$((fail+1)); else pass=$((pass+1)); fi
  printf '%-58s %s\n' "$label" "$verdict"
}

# --- N1 byte-arm collapse (deny half of the asymmetry twin) ------------------
run_case "N1 open_document_version: phi->metadata byte gate" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.open_document_version(uuid)'::regprocedure);
  d := replace(d, 'and not app.can_read_referral_phi(v_doc.home_resource_id, v_uid)',
                  'and not app.can_read_referral_metadata(v_doc.home_resource_id, v_uid)');
  execute d; end \$\$;" 'B10c'

# --- N2 kernel-arm collapse to narrow (broad half of the twin) ---------------
run_case "N2 can_read_document: metadata->phi (both-narrow)" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('app.can_read_document(uuid,uuid)'::regprocedure);
  d := replace(d, 'when ''case_referral'' then app.can_read_referral_metadata(v_resource, p_uid)',
                  'when ''case_referral'' then app.can_read_referral_phi(v_resource, p_uid)');
  execute d; end \$\$;" 'B1'

# --- N3 kernel-arm blanket (noun rule) ---------------------------------------
run_case "N3 can_read_document: case_referral arm -> true" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('app.can_read_document(uuid,uuid)'::regprocedure);
  d := replace(d, 'when ''case_referral'' then app.can_read_referral_metadata(v_resource, p_uid)',
                  'when ''case_referral'' then true');
  execute d; end \$\$;" 'B4'

# --- N4 write-arm status window opened ---------------------------------------
run_case "N4 can_write_document: status window removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('app.can_write_document(uuid,uuid)'::regprocedure);
  d := replace(d, 'and r.status in (''accepted'', ''in_review'')', 'and true');
  execute d; end \$\$;" 'B6c'

# --- N5 write-arm authority opened -------------------------------------------
run_case "N5 can_write_document: target authority removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('app.can_write_document(uuid,uuid)'::regprocedure);
  d := replace(d, 'return app.can_manage_referral_target(v_resource, p_uid)', 'return true');
  execute d; end \$\$;" 'B6a|B6b|B5c'

# --- N6 begin's wave-c gate removed ------------------------------------------
run_case "N6 begin_document_upload: wave-c assert removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.begin_document_upload(text,uuid,text,text,text,uuid,text,text,bigint,text,date)'::regprocedure);
  d := replace(d, 'perform app.assert_documents_wave_c_enabled();', 'null;');
  execute d; end \$\$;" 'B9a|B9b'

# --- N7 the HC0DC enforcing-label freeze refusal removed (D15 laundering) ----
run_case "N7 freeze arm: enforcing-label refusal removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.add_referral_shared_item(uuid,text,uuid,uuid)'::regprocedure);
  d := replace(d, 'if v_doc.confidentiality_level in (''legal_privileged'', ''credentialing_sensitive'') then',
                  'if false then');
  execute d; end \$\$;" 'C3'

# --- N8 the cross-case validation removed ------------------------------------
run_case "N8 freeze arm: source-case scoping removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.add_referral_shared_item(uuid,text,uuid,uuid)'::regprocedure);
  d := replace(d, 'and d.home_resource_id = v_referral.source_case_id', '');
  execute d; end \$\$;" 'C4'

# --- N9a/N9b the two barriers inside assert_referral_draft_writable,
# --- opened SEPARATELY (the DM3 one-barrier-two-codes discipline) ------------
run_case "N9a draft-writable: HC071 authority check removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('app.assert_referral_draft_writable(uuid)'::regprocedure);
  d := replace(d, 'if not app.can_manage_referral_source(p_referral_id, auth.uid()) then',
                  'if false then');
  execute d; end \$\$;" 'C6'
run_case "N9b draft-writable: HC070 draft check removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('app.assert_referral_draft_writable(uuid)'::regprocedure);
  d := replace(d, 'if v_referral.status <> ''draft'' then', 'if false then');
  execute d; end \$\$;" 'C5'

# --- N10 the bespoke door's PHI gate — TWO independent locks discovered -----
# Opening the gate alone does NOT serve the metadata reader: log_audit_access
# has its OWN authorization and RAISES ('sem permissão para registrar este
# acesso'). That raise is N10a's red evidence (the audit layer is a live
# backstop, not a formality). N10b opens BOTH locks and requires the C11
# assertions themselves to flip — proving they can fail at all.
mut_n10_gate="
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.open_referral_snapshot_document(uuid)'::regprocedure);
  d := replace(d, 'if not app.can_read_referral_phi(v_item.referral_id, auth.uid()) then',
                  'if false then');
  execute d; end \$\$;"
line=$(grep -nF "$MARKER" "$SRC" | head -1 | cut -d: -f1)
f="$WORK/mut340.sql"
{ head -n "$line" "$SRC"; printf '%s\n' "$mut_n10_gate"; tail -n +$((line+1)) "$SRC"; } > "$f"
docker cp "$f" "$DB:/tmp/mut340.sql" >/dev/null
out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut340.sql 2>&1)
if echo "$out" | grep -q "log_audit_access: sem permiss"; then
  printf '%-58s %s\n' "N10a snapshot door: gate removed -> audit lock refuses" "RED-PROVEN (audit-layer raise)"; pass=$((pass+1))
else
  printf '%-58s %s\n' "N10a snapshot door: gate removed -> audit lock refuses" "*** VACUOUS: audit raise absent"; fail=$((fail+1))
fi
run_case "N10b snapshot door: BOTH locks removed" "$mut_n10_gate
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.open_referral_snapshot_document(uuid)'::regprocedure);
  d := replace(d,
'  perform public.log_audit_access(
    ''referral.viewed'', ''referral'', v_item.referral_id, v_referral.source_commission_id,
    ''Documento do encaminhamento '' || coalesce(v_referral.code, '''') || '' acessado'', ''{}''::jsonb);',
'  perform 1;');
  execute d; end \$\$;" 'C11b'

# --- N11 the tombstone refusal removed ---------------------------------------
run_case "N11 snapshot door: tombstone/unbound refusal removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.open_referral_snapshot_document(uuid)'::regprocedure);
  d := replace(d, 'if v_item.frozen_tombstoned_at is not null or v_item.frozen_document_version_id is null then',
                  'if false then');
  execute d; end \$\$;" 'C13c|E2'

# --- N12 the freeze arm's wave-c gate removed (scoped independently of N6) ---
run_case "N12 freeze arm: wave-c assert removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.add_referral_shared_item(uuid,text,uuid,uuid)'::regprocedure);
  d := replace(d, 'perform app.assert_documents_wave_c_enabled();', 'null;');
  execute d; end \$\$;" 'C7a'

# --- N13 disposal stops tombstoning ------------------------------------------
run_case "N13 dispose_referral_phi: tombstone step removed" "
do \$\$ declare d text; begin
  d := pg_get_functiondef('public.dispose_referral_phi(uuid,text)'::regprocedure);
  d := replace(d, 'where referral_id = p_referral_id and kind = ''document'';', 'where false;');
  execute d; end \$\$;" 'C13b|C13c'

# --- CONTROL: unmutated 340 must be fully green ------------------------------
line=$(grep -nF "$MARKER" "$SRC" | head -1 | cut -d: -f1)
docker cp "$SRC" "$DB:/tmp/mut340.sql" >/dev/null
ctl=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut340.sql 2>&1)
if echo "$ctl" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 340 red WITHOUT any mutation ***"; fail=$((fail+1))
else
  echo "CONTROL: unmutated 340 green"; pass=$((pass+1))
fi

echo "-------------------------------------------------------------"
echo "matrix: $pass proven / $fail vacuous-or-broken"
[ "$fail" -eq 0 ]
