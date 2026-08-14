#!/usr/bin/env bash
# =============================================================================
# DM4 neutralization matrix (ADR 0119; approval condition 2; QA r1 MAJOR-1/-2
# remediation) — the two census-blind referral doors + the corridor arms.
# Census/hat/floor/wrapper pass for these doors NO MATTER WHAT (composite/jsonb
# returns), so each excluded state is opened INDEPENDENTLY here and pgTAP 340
# is REQUIRED to go red — one twin standing for several states is exactly how
# DM3's two-codes-one-barrier hid.
#
# ⛔ EVERY mutation carries a NO-MATCH GUARD that RAISES (QA r1 MAJOR-1: N10b's
# needle was orphaned by M5's body rewrite and the case silently degenerated —
# the a-rename-orphans-a-name-keyed-verdict class, prosrc does not follow a
# rewrite. A replace() that matches nothing must ABORT the case loudly, never
# inject a partial mutation.) Needles are maintained against the LIVE catalog
# (pg_get_functiondef), never against migration text.
#
# Method (the u1-mutation-audit dialect): copy 340, inject one mutation right
# after the wave-c fixture marker (inside 340's rolled-back txn), run, and
# demand the named assertions flip red — and, where a case's CLAIM depends on
# it, demand named assertions STAY green (the polarity cases N14a/N14b).
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

# mut <regprocedure> <needle> <replacement> — emits a guarded DO block: the
# replace MUST land or the case aborts (surfaces as ABSENT → VACUOUS → exit 1).
mut () {
  printf '%s' "
do \$mut\$ declare d text; e text; begin
  d := pg_get_functiondef('$1'::regprocedure);
  e := replace(d, \$nd\$$2\$nd\$, \$nd\$$3\$nd\$);
  if e = d then
    raise exception 'DM4 matrix: needle matched NOTHING in $1 (orphaned by a body rewrite — fix the needle against the LIVE catalog)';
  end if;
  execute e;
end \$mut\$;"
}

run_case () {  # $1 label · $2 mutation SQL · $3 expected-RED patterns (| sep) · $4 optional must-stay-GREEN patterns (| sep)
  local label="$1" mut="$2" expect="$3" expect_green="${4:-}" f="$WORK/mut340.sql" line out
  line=$(grep -nF "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then echo "HARNESS ERROR: marker not found"; exit 2; fi
  { head -n "$line" "$SRC"; printf '%s\n' "$mut"; tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mut340.sql" >/dev/null
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut340.sql 2>&1)
  local verdict="RED-PROVEN" bad="" IFS='|' pats gpats
  read -ra pats <<< "$expect"
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=STILL-GREEN"
    else bad="$bad [$pat]=ABSENT(aborted?)"; fi
  done
  if [ -n "$expect_green" ]; then
    read -ra gpats <<< "$expect_green"
    for pat in "${gpats[@]}"; do
      if   echo "$out" | grep -qE "^ok [0-9]+ - .*$pat"; then :
      elif echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then bad="$bad [green:$pat]=WENT-RED"
      else bad="$bad [green:$pat]=ABSENT(aborted?)"; fi
    done
  fi
  if [ -n "$bad" ]; then verdict="*** VACUOUS-OR-WRONG:$bad"; fail=$((fail+1)); else pass=$((pass+1)); fi
  printf '%-58s %s\n' "$label" "$verdict"
}

OPEN_DOOR="public.open_referral_snapshot_document(uuid)"
PHI_GATE="if not app.can_read_referral_phi(v_item.referral_id, auth.uid()) then"
# The LIVE post-M5 audit call (catalog-derived 2026-08-14; the guard makes any
# future drift loud instead of silent).
AUDIT_CALL="  perform public.log_audit_access(
    'referral.viewed', 'referral', v_item.referral_id, v_referral.source_commission_id,
    'Documento do encaminhamento ' || coalesce(v_referral.code, '') || ' acessado',
    jsonb_build_object(
      'kind', 'document_open',
      'shared_item_id', v_item.id,
      'document_version_id', v_ver.id));"

# --- N1 byte-arm collapse (deny half of the asymmetry twin) ------------------
run_case "N1 open_document_version: phi->metadata byte gate" \
  "$(mut 'public.open_document_version(uuid)' \
     "and not app.can_read_referral_phi(v_doc.home_resource_id, v_uid)" \
     "and not app.can_read_referral_metadata(v_doc.home_resource_id, v_uid)")" 'B10c'

# --- N2 kernel-arm collapse to narrow (broad half of the twin) ---------------
run_case "N2 can_read_document: metadata->phi (both-narrow)" \
  "$(mut 'app.can_read_document(uuid,uuid)' \
     "when 'case_referral' then app.can_read_referral_metadata(v_resource, p_uid)" \
     "when 'case_referral' then app.can_read_referral_phi(v_resource, p_uid)")" 'B1'

# --- N3 kernel-arm blanket (noun rule) ---------------------------------------
run_case "N3 can_read_document: case_referral arm -> true" \
  "$(mut 'app.can_read_document(uuid,uuid)' \
     "when 'case_referral' then app.can_read_referral_metadata(v_resource, p_uid)" \
     "when 'case_referral' then true")" 'B4'

# --- N4 write-arm status window opened ---------------------------------------
run_case "N4 can_write_document: status window removed" \
  "$(mut 'app.can_write_document(uuid,uuid)' \
     "and r.status in ('accepted', 'in_review')" "and true")" 'B6c'

# --- N5 write-arm authority opened -------------------------------------------
run_case "N5 can_write_document: target authority removed" \
  "$(mut 'app.can_write_document(uuid,uuid)' \
     "return app.can_manage_referral_target(v_resource, p_uid)" "return true")" 'B6a|B6b|B5c'

# --- N6 begin's wave-c gate removed ------------------------------------------
run_case "N6 begin_document_upload: wave-c assert removed" \
  "$(mut 'public.begin_document_upload(text,uuid,text,text,text,uuid,text,text,bigint,text,date)' \
     "perform app.assert_documents_wave_c_enabled();" "null;")" 'B9a|B9b'

# --- N7 the HC0DC enforcing-label freeze refusal removed (D15 laundering) ----
run_case "N7 freeze arm: enforcing-label refusal removed" \
  "$(mut 'public.add_referral_shared_item(uuid,text,uuid,uuid)' \
     "if v_doc.confidentiality_level in ('legal_privileged', 'credentialing_sensitive') then" \
     "if false then")" 'C3'

# --- N8 the cross-case validation removed ------------------------------------
run_case "N8 freeze arm: source-case scoping removed" \
  "$(mut 'public.add_referral_shared_item(uuid,text,uuid,uuid)' \
     "and d.home_resource_id = v_referral.source_case_id" " ")" 'C4'

# --- N9a/N9b the two barriers inside assert_referral_draft_writable,
# --- opened SEPARATELY (the DM3 one-barrier-two-codes discipline) ------------
run_case "N9a draft-writable: HC071 authority check removed" \
  "$(mut 'app.assert_referral_draft_writable(uuid)' \
     "if not app.can_manage_referral_source(p_referral_id, auth.uid()) then" \
     "if false then")" 'C6'
run_case "N9b draft-writable: HC070 draft check removed" \
  "$(mut 'app.assert_referral_draft_writable(uuid)' \
     "if v_referral.status <> 'draft' then" "if false then")" 'C5'

# --- N10 the snapshot door's PHI predicate: ONE predicate, applied at TWO
# --- points (QA r1 MINOR-2 correction — NOT "two independent locks": the door
# --- checks can_read_referral_phi, and log_audit_access's referral.viewed
# --- registry arm re-checks the SAME predicate). Opening one application
# --- proves nothing about the predicate; N10a shows the second application
# --- refusing (the raise IS the red); N10b opens BOTH applications by
# --- bypassing the audit call and requires the C11 assertions to flip. -------
mut_n10_gate="$(mut "$OPEN_DOOR" "$PHI_GATE" "if false then")"
line=$(grep -nF "$MARKER" "$SRC" | head -1 | cut -d: -f1)
f="$WORK/mut340.sql"
{ head -n "$line" "$SRC"; printf '%s\n' "$mut_n10_gate"; tail -n +$((line+1)) "$SRC"; } > "$f"
docker cp "$f" "$DB:/tmp/mut340.sql" >/dev/null
out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut340.sql 2>&1)
if echo "$out" | grep -q "log_audit_access: sem permiss"; then
  printf '%-58s %s\n' "N10a door gate opened -> 2nd APPLICATION refuses" "RED-PROVEN (audit-layer raise; same predicate, not a second lock)"; pass=$((pass+1))
else
  printf '%-58s %s\n' "N10a door gate opened -> 2nd APPLICATION refuses" "*** VACUOUS: audit raise absent"; fail=$((fail+1))
fi
run_case "N10b BOTH applications bypassed" \
  "$mut_n10_gate
$(mut "$OPEN_DOOR" "$AUDIT_CALL" "  perform 1;")" 'C11b'

# --- N11 the tombstone refusal removed ---------------------------------------
run_case "N11 snapshot door: tombstone/unbound refusal removed" \
  "$(mut "$OPEN_DOOR" \
     "if v_item.frozen_tombstoned_at is not null or v_item.frozen_document_version_id is null then" \
     "if false then")" 'C13c|E2'

# --- N12 the freeze arm's wave-c gate removed (scoped independently of N6) ---
run_case "N12 freeze arm: wave-c assert removed" \
  "$(mut 'public.add_referral_shared_item(uuid,text,uuid,uuid)' \
     "perform app.assert_documents_wave_c_enabled();" "null;")" 'C7a'

# --- N13 disposal stops tombstoning ------------------------------------------
run_case "N13 dispose_referral_phi: tombstone step removed" \
  "$(mut 'public.dispose_referral_phi(uuid,text)' \
     "where referral_id = p_referral_id and kind = 'document';" "where false;")" 'C13b|C13c'

# --- N14 the NARROWING twins (QA r1 MAJOR-2: the retired drop_snapshot_arm's
# --- polarity — an over-narrowed door must be DETECTED by the positive half).
# --- N14a narrows the gate to a source-only predicate: the B-side recipient
# --- (C11d, the ③TWIN heir) MUST go red while the source-side serve (C10a)
# --- MUST stay green — measured, so the polarity claim is not prose. E2 also
# --- reds: a gate-failing PHI reader gets null before the HC0DS refusal.
run_case "N14a door NARROWED to source-only (the ③TWIN heir)" \
  "$(mut "$OPEN_DOOR" "$PHI_GATE" \
     "if not app.can_manage_referral_source(v_item.referral_id, auth.uid()) then")" \
  'C11d|E2' 'C10a'
# --- N14b door welded shut: EVERY serve-half red.
run_case "N14b door welded SHUT (every serve-half detects)" \
  "$(mut "$OPEN_DOOR" "$PHI_GATE" "if true then")" 'C10a|C11d|C14'

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
echo "matrix: $pass proven / $fail vacuous-or-broken   (HEAD: $(git -C "$(dirname "$0")/../../.." rev-parse --short HEAD 2>/dev/null || echo unknown))"
[ "$fail" -eq 0 ]
