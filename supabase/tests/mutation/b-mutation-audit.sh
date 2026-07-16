#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/b-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# STAGE-B MUTATION AUDIT — the case_access -> case_access_grants hard cut (238).
#
# For each keystone in 238: revert ITS OWN wiring, ONE mutation at a time, inside a
# rolled-back transaction, and require that keystone to go RED. The mutations cover the
# INTENDED semantic change (defect (1).2) in BOTH directions, the exclusion gate, the
# B3 fence, the active partial-unique, the clearance projection, and the no-direct-DML
# posture. A green 238 proves nothing unless each of these can manufacture a RED.
#
# Harness lessons inherited from a2/m1/m5/m6 (each HID A REAL RESULT):
#  1. Match keystones BY LABEL, never by test number.
#  2. Tri-state RED / GREEN / ABSENT — `red != abort`.
#  3. ASCII-ONLY patterns (grep '.' matches one BYTE; interpuncts are multi-byte UTF-8).
#  4. Re-emit from LIVE pg_get_functiondef, never migration text.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/238_authz_b_case_access_grants.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_b(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'read_confers_phi' then
    -- Re-introduce defect (1).2: make a plain read grant confer read_standard_phi.
    d := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
    d := replace(d,
      'if v_g.read_case_content then
      v_caps := v_caps | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_case_deliberation'');',
      'if v_g.read_case_content then
      v_caps := v_caps | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_standard_phi'')
                       | app._cap_bit(''read_case_deliberation'');');
    execute d;
  elsif p_what = 'drop_phi_column_arm' then
    -- Remove the per-column PHI arm: a read_standard_phi grant confers no PHI.
    d := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
    d := replace(d, 'if v_g.read_standard_phi then', 'if false then');
    execute d;
  elsif p_what = 'write_confers_phi' then
    -- Break A16 (disjoint chains): make the write arm confer PHI.
    d := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
    d := replace(d,
      'if v_g.write_case_content then
      v_caps := v_caps | app._cap_bit(''write_case_content'')
                       | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_case_deliberation'');',
      'if v_g.write_case_content then
      v_caps := v_caps | app._cap_bit(''write_case_content'')
                       | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_standard_phi'')
                       | app._cap_bit(''read_case_deliberation'');');
    execute d;
  elsif p_what = 'drop_grant_exclusion' then
    -- Remove the U1 exclusion gate from grant_case_access.
    d := pg_get_functiondef('public.grant_case_access(uuid,uuid,text,timestamptz,text,boolean,boolean)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case);', 'perform 1;');
    execute d;
  elsif p_what = 'drop_fence' then
    -- Remove the B3 fence from reclassify_attachment.
    d := pg_get_functiondef('public.reclassify_attachment(uuid,text,text)'::regprocedure);
    d := replace(d, 'if p_new_label in (''legal_privileged'', ''credentialing_sensitive'') then', 'if false then');
    execute d;
  elsif p_what = 'drop_clearance_projection' then
    -- Make list_case_access omit max_confidentiality (the old shape).
    d := pg_get_functiondef('public.list_case_access(uuid)'::regprocedure);
    d := replace(d, 'g.max_confidentiality, g.read_standard_phi', 'null::text, g.read_standard_phi');
    execute d;
  elsif p_what = 'drop_unique_index' then
    -- Drop the active partial-unique. grant_ca's on-conflict upsert depends on it, so
    -- also redefine grant_ca to delete-then-insert (idempotent WITHOUT the index) — this
    -- keeps the fixture single-rowed while removing the guard K9's DIRECT inserts probe.
    execute 'drop index if exists public.case_access_grants_active_source_uniq';
    execute $g$
      create or replace function test_helpers.grant_ca(
        p_case uuid, p_user uuid, p_level text default 'read', p_granted_by uuid default null,
        p_expires_at timestamptz default null, p_max_conf text default null,
        p_read_standard_phi boolean default false, p_read_restricted_phi boolean default false)
      returns void language sql as $b$
        delete from public.case_access_grants
          where case_id = p_case and principal_id = p_user and source = 'manual_grant' and revoked_at is null;
        insert into public.case_access_grants
          (case_id, principal_id, source, read_case_content, read_case_deliberation,
           write_case_content, read_standard_phi, read_restricted_phi, max_confidentiality,
           granted_by, expires_at, reason_code)
        values (p_case, p_user, 'manual_grant', true, true, (p_level = 'write'),
                (p_read_standard_phi or p_read_restricted_phi), p_read_restricted_phi, p_max_conf,
                p_granted_by, p_expires_at, 'coordinator_grant');
      $b$;
    $g$;
  elsif p_what = 'grant_direct_dml' then
    -- Remove BOTH layers of the BUG-SUP-002 posture: the missing INSERT grant AND the
    -- RLS no-write-policy. Either alone still denies; both must go for a direct write.
    execute 'grant insert on public.case_access_grants to authenticated';
    execute 'create policy _mut_ins on public.case_access_grants for insert to authenticated with check (true)';
  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutb.sql"
  local line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-46s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutb.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutb.sql 2>&1)
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

# PREFLIGHT — self-sufficient (a reset drops pgtap + test_helpers).
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_b(text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutb_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutb_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable. Aborting."; exit 1
fi

echo "=== STAGE-B MUTATION AUDIT — every keystone must go RED when ITS OWN wiring is reverted ==="
echo

run_case "defect (1).2 flip: read confers no PHI" \
  "select app._mut_b('read_confers_phi');" \
  "K1b .* DEFECT .* FLIP: a plain READ grant NO LONGER confers PHI"

run_case "new capability: PHI column conferred" \
  "select app._mut_b('drop_phi_column_arm');" \
  "K1c .* NEW CAPABILITY: a manual_grant with read_standard_phi=true DOES confer PHI"

run_case "A16: write does not confer PHI" \
  "select app._mut_b('write_confers_phi');" \
  "K1f .* A16: a WRITE grant does NOT confer PHI"

run_case "U1 exclusion on the grant door" \
  "select app._mut_b('drop_grant_exclusion');" \
  "K5a .* U1: a RECUSED coordinator cannot grant"

run_case "B3 fence on reclassify_attachment" \
  "select app._mut_b('drop_fence');" \
  "K8a .* B3: reclassify_attachment REJECTS legal_privileged"

run_case "clearance projection in list_case_access" \
  "select app._mut_b('drop_clearance_projection');" \
  "K4 .* list_case_access PROJECTS max_confidentiality"

run_case "active partial-unique (NULLS NOT DISTINCT)" \
  "select app._mut_b('drop_unique_index');" \
  "K9 .* a SECOND active manual grant .* raises unique_violation"

run_case "no direct DML (BUG-SUP-002)" \
  "select app._mut_b('grant_direct_dml');" \
  "K3b .* a direct INSERT by authenticated is DENIED"

echo
echo "=== CONTROL — no mutation; 238 must be ALL GREEN (proves the harness is not always-red) ==="
run_case "CONTROL (no mutation)" "select 1;" \
  "K1b .* DEFECT .* FLIP|K1c .* NEW CAPABILITY|K5a .* U1|K8a .* B3|K9 .* unique_violation"
echo "(CONTROL expects the above to be GREEN, i.e. printed as NOT PROVEN ->...=GREEN — that is the harness confirming it can read a pass.)"
