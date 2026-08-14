#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/u1-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# EXCLUSION PERIMETER · Unit 1 MUTATION AUDIT — the READ/ADMINISTER half.
#
# Unit 1 is a NARROWING, so §7.7 bites: a narrowing that denies everyone passes its
# negative keystone BY CONSTRUCTION. For each keystone in 236, REVERT the exact
# exclusion Unit 1 added — ONE AT A TIME — and require that keystone to go RED. Functions
# are re-emitted from LIVE pg_get_functiondef (never migration text; harness lesson #5),
# policies via absolute ALTER/CREATE. Each mutation runs inside 236's rolled-back txn,
# injected right after the fixture marker.
#
# Harness lessons inherited from a2/a4/m1/m5/m6 (each HID A REAL RESULT):
#  1. Match keystones BY LABEL, never by test number.
#  2. Tri-state RED / GREEN / ABSENT — `red != abort`.
#  3. ASCII-ONLY grep patterns (the ①②③ marks are multi-byte).
#  4. head/tail split (BSD awk rejects multi-line -v on macOS).
#  5. Re-emit functions from LIVE pg_get_functiondef.
#  6. A replace()/ALTER that matches nothing SILENTLY NO-OPS -> stays GREEN -> NOT PROVEN.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/236_authz_exclusion_perimeter_u1.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_u1(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'revert_grant' then
    d := pg_get_functiondef('public.grant_case_access(uuid,uuid,text,timestamptz,text,boolean,boolean)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case);', 'null;');
    execute d;

  elsif p_what = 'revert_revoke' then
    d := pg_get_functiondef('public.revoke_case_access(uuid,uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case);', 'null;');
    execute d;

  elsif p_what = 'revert_list' then
    d := pg_get_functiondef('public.list_case_access(uuid)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case);', 'null;');
    execute d;

  elsif p_what = 'revert_create_interview' then
    d := pg_get_functiondef('public.create_interview(uuid,text,uuid,text,text)'::regprocedure);
    d := replace(d, 'perform app.assert_not_case_excluded(p_case_id);', 'null;');
    execute d;

  elsif p_what = 'revert_interview_insert_policy' then
    execute $p$ alter policy case_interviews_insert on public.case_interviews
      with check (app.is_staff_admin_of(commission_id)) $p$;

  elsif p_what = 'restore_interview_attach_policy' then
    -- Re-create the dropped interview-attachments member SELECT policy (the leak).
    execute $p$ create policy interview_attachments_obj_select_member on storage.objects
      for select to authenticated
      using ((bucket_id = 'interview-attachments')
             and app.is_member_of(((storage.foldername(name))[1])::uuid)) $p$;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutu1.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutu1.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutu1.sql 2>&1)
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
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_u1(text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutu1_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutu1_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== U1 MUTATION AUDIT — every keystone must go RED when ITS OWN exclusion is reverted ==="
echo

run_case "revert_grant -> grant DENY" \
  "select app._mut_u1('revert_grant');" \
  "grant_case_access: RESPONDENT coordinator DENIED"

run_case "revert_revoke -> revoke DENY" \
  "select app._mut_u1('revert_revoke');" \
  "revoke_case_access: RECUSED coordinator DENIED"

run_case "revert_list -> list DENY" \
  "select app._mut_u1('revert_list');" \
  "list_case_access: RECUSED coordinator DENIED"

run_case "revert_create_interview -> RPC DENY (both legs)" \
  "select app._mut_u1('revert_create_interview');" \
  "create_interview RPC: RESPONDENT coordinator DENIED|create_interview RPC: RECUSED coordinator DENIED"

run_case "revert_interview_insert_policy -> direct-table DENY" \
  "select app._mut_u1('revert_interview_insert_policy');" \
  "direct-table INSERT: RECUSED coordinator DENIED"

# DM4 (lead-ruled 2026-08-14): the two case-documents cases
# (restore_casedoc_member, drop_snapshot_arm) were REMOVED — they ALTERed the
# policy `case_documents_select_member`, which migration 20260926000400 dropped
# with the F-14 boundary. A mutation that cannot mutate is worse than absent:
# it reports success.
# Successor coverage, stated EXACTLY (corrected at QA r1 MAJOR-2 — the first
# version of this note claimed matrix coverage that did not exist):
#   - drop_snapshot_arm's POLARITY (over-narrowing detected by the positive
#     twin) → 340 C11d (the B-side recipient reads via the new door), proven
#     able to fail by dm4-referral-doors-matrix.sh N14a (gate narrowed to
#     source-only ⇒ C11d red, C10a measured-green) and N14b (welded shut).
#   - the serve-half generally → 340 C10a/C14, proven by N14b.
#   - the deny-half → 340 C11b, proven by N10b (both applications of the PHI
#     predicate bypassed).
#   - restore_casedoc_member's LEAK direction → the boundary itself is gone
#     (340 D4a + 325 t4 pin the retirement — catalog pins, not
#     mutation-coverable and not claimed as such); the live leak-shaped
#     mutations for the successor corridor are N1/N3/N10b.
# The harness was RE-PROVEN after this edit: the surviving
# interview-attachments leak injection RED; control 22 ok / 0 not ok.
run_case "restore_interview_attach_policy -> storage leak (interview)" \
  "select app._mut_u1('restore_interview_attach_policy');" \
  "interview-attachments: EXCLUDED member reads 0"

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A \
  -f //tmp/_noop_236.sql 2>&1 || true)
# The control simply runs 236 unmutated.
docker cp "$SRC" "$DB:/tmp/_noop_236.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_236.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 236 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: all green ($ok ok, 0 not ok)"
fi
