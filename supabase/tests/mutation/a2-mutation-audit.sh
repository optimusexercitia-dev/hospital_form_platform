#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/a2-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# A2 MUTATION AUDIT — the capability resolver (app._case_caps).
#
# For each keystone in 234: revert ITS OWN wiring, ONE SOURCE AT A TIME, inside a
# rolled-back transaction, and require that keystone to go RED. A global neuter reverts
# everything at once and proves nothing about any single keystone.
#
# ⛔ WHY A2 NEEDS THIS MORE THAN A DENIAL DOES. A2 is an EQUIVALENCE, not a denial and
# not a narrowing — so it fails in BOTH directions: a resolver that grants nothing
# passes every negative keystone by construction, and a resolver that grants everything
# passes every positive one. The A/B matrix (LOST = 0 / GAINED = 0 over 1568 cells)
# proves the POPULATION did not move; it cannot prove any individual ARM is load-bearing.
# That is this file's job. Review found NONE of the seven vacuous keystones on this
# program; reverting the fix found every one.
#
# Harness lessons inherited from m1/m5/m6 (each one HID A REAL RESULT):
#  1. Match keystones BY LABEL, never by test number — numbers go stale as suites grow.
#  2. Tri-state RED / GREEN / ABSENT. A mutation that ABORTS prints no "not ok" at all;
#     reading that as green is a false NOT-FALSIFIABLE. `red != abort`.
#  3. ASCII-ONLY patterns: the interpunct is multi-byte UTF-8 and grep's `.` matches one
#     BYTE. Every pattern below avoids interpuncts and curly quotes.
#  4. ⚠ BSD awk (macOS) rejects ANY multi-line `-v` value, emits a garbage script, and
#     every case reads ABSENT — m1 once reported 22/22 ABSENT on a Mac while its recorded
#     figure was 22/22 RED-PROVEN on a GNU-awk box. head/tail is portable to both.
#  5. ⛔ Re-emit from LIVE pg_get_functiondef, never from migration text: functions on
#     this program are rewritten at runtime, so re-emitting from a file silently reverts
#     intervening patches.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/234_authz_a2_resolver.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_a2(p_what text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
begin
  if p_what = 'drop_coordinator' then
    d := replace(d, 'if v_coord then', 'if false then');
  elsif p_what = 'drop_orgadmin' then
    d := replace(d, 'if v_orgadmin then', 'if false then');
  elsif p_what = 'drop_member_default' then
    d := replace(d, 'if v_member and not v_eg then', 'if false then');
  elsif p_what = 'drop_legacy_flag_off' then
    d := replace(d, 'if not v_eg and v_member then', 'if false then');
  elsif p_what = 'drop_nsp' then
    d := replace(d, 'if app.feature_enabled(''case_referrals'')', 'if false and app.feature_enabled(''case_referrals'')');
  elsif p_what = 'drop_outer_gate' then
    d := replace(d, 'if not app.is_active(p_uid) then', 'if false then');
  elsif p_what = 'drop_hard_deny' then
    -- Move the deny "below the union" in effect: neutralise BOTH deny terms.
    d := replace(d, 'if app.is_case_respondent(p_case_id, p_uid) then', 'if false then');
    d := replace(d, 'if app.is_recused_from_case(p_case_id, p_uid) then', 'if false then');
  elsif p_what = 'assignment_confers_phi' then
    -- Re-add the bare-assignment PHI arm that M3 deleted (this ADR's defect (1)).
    d := replace(d,
      'v_caps := v_caps | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_case_deliberation'');
    end if;

  else',
      'v_caps := v_caps | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_standard_phi'')
                       | app._cap_bit(''read_case_deliberation'');
    end if;

  else');
  elsif p_what = 'assignment_confers_write' then
    -- Add the assignment arm D10 deliberately withholds from the write bit.
    d := replace(d,
      'v_caps := v_caps | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_case_deliberation'');
    end if;

  else',
      'v_caps := v_caps | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''write_case_content'')
                       | app._cap_bit(''read_case_deliberation'');
    end if;

  else');
  elsif p_what = 'grant_level_filtered' then
    -- Filter the read grant on level (the "fix" A16 forbids: it would encode
    -- write => read_standard_phi on disjoint chains). K7 pins today's behaviour.
    d := replace(d,
      'where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    );
    if v_grant then',
      'where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = ''write''
        and (ca.expires_at is null or ca.expires_at > now())
    );
    if v_grant then');
  elsif p_what = 'coordinator_holds_rrp' then
    d := replace(d,
      '| app._cap_bit(''write_case_content'')
                     | app._cap_bit(''manage_case_access'');',
      '| app._cap_bit(''write_case_content'')
                     | app._cap_bit(''read_restricted_phi'')
                     | app._cap_bit(''manage_case_access'');');
  elsif p_what = 'deliberation_implies_overview' then
    -- Close the lattice rung A16 deliberately BREAKS.
    d := replace(d,
      'if v_member and not v_eg then
    v_caps := v_caps | app._cap_bit(''read_case_deliberation'');',
      'if v_member and not v_eg then
    v_caps := v_caps | app._cap_bit(''read_case_deliberation'')
                     | app._cap_bit(''view_case_overview'');');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/muta2.sql"
  local line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-44s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/muta2.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/muta2.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-44s %s\n' "$label" "$verdict"
}

# ---------------------------------------------------------------------------
# PREFLIGHT — self-sufficient. `supabase db reset` drops pgtap and test_helpers, so a
# run straight after a reset would abort EVERY case and print a uniform NOT PROVEN that
# looks like broken keystones rather than a missing extension.
# ---------------------------------------------------------------------------
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1

# CLEANUP — leave the stack as we found it. The preflight installs pgtap OUTSIDE any
# transaction, so it PERSISTS; the next `supabase test db` would then read t19 RED on
# ~1079 pgtap-owned functions — a FALSE red the next person chases. A harness that
# silently changes the stack it audits manufactures findings.
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop function if exists app._mut_a2(text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_muta2_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_muta2_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== A2 MUTATION AUDIT — every keystone must go RED when ITS OWN source is reverted ==="
echo

run_case "K1  coordinator source" \
  "select app._mut_a2('drop_coordinator');" \
  "K1 coordinator: reads case content|K1 coordinator: reaches the PHI door|K1 coordinator .* ROWS: reads the case row"

run_case "K2  org-admin source (a) [A4 removes]" \
  "select app._mut_a2('drop_orgadmin');" \
  "K2 .* source .a.: the ORG-ADMIN still reads case content"

run_case "K4  nsp_referral_touched (c)" \
  "select app._mut_a2('drop_nsp');" \
  "K4 .* source .c.: the NSP operator reads content"

run_case "K5  assignment confers NO PHI (M3)" \
  "select app._mut_a2('assignment_confers_phi');" \
  "K5 .* assignment CONFERS NO PHI|K5 .* ROWS / Rule 12"

run_case "K6  no assignment arm on write (D10)" \
  "select app._mut_a2('assignment_confers_write');" \
  "K6 .* .D10.: the assignee canNOT write case content"

run_case "K7  grant confers PHI [B1 pin]" \
  "select app._mut_a2('grant_level_filtered');" \
  "K7 .* pinned to B1.: an unexpired READ grantee still reaches the PHI door"

run_case "K8  RCD does NOT imply VCO (A16)" \
  "select app._mut_a2('deliberation_implies_overview');" \
  "K8 .* the member holds read_case_deliberation WITHOUT view_case_overview"

run_case "K9  HARD DENY before every arm" \
  "select app._mut_a2('drop_hard_deny');" \
  "K9 .* THE HARD DENY: the respondent resolves to ZERO|K9 .* Rule 12|K9 .* ROWS"

run_case "K10 is_active outer gate (D3)" \
  "select app._mut_a2('drop_outer_gate');" \
  "K10 .* .D3 / M5 defect|K10 .* Rule 12"

run_case "K11 coordinator does NOT hold RRP" \
  "select app._mut_a2('coordinator_holds_rrp');" \
  "K11 .* .ADR keystone 31.: the coordinator does NOT hold read_restricted_phi"

# ⭐ K3 and K12 share ONE source (case_access_flag_off_legacy) — the lead's C4 ruling:
# both flag-OFF branches are the same predicate, so the fallback confers RCC + RSP
# together. Reverting that single source must take BOTH red, which is exactly what
# proves they are one source and not two.
run_case "K3+K12 flag-OFF legacy source (b)" \
  "select app._mut_a2('drop_legacy_flag_off');" \
  "K3 .* source .b. .re-pins 228 t24.|K12 .* the arm nothing pinned|K12 .* ROWS"

# The member-default source is A15's whole correction. Dropping it must break the
# deliberation surface WITHOUT touching content (which the coordinator/grant arms hold).
run_case "K8  member_default source (A15)" \
  "select app._mut_a2('drop_member_default');" \
  "K8 .* POSITIVE: the ordinary member DOES read the ata section|K8 positive twin"

echo
echo "=== CONTROL — an UNMUTATED run must be fully GREEN. If this prints anything other"
echo "=== than 'control: all green', every RED above is suspect (the harness, not the fix)."
LINE=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
{ head -n "$LINE" "$SRC"; tail -n +$((LINE+1)) "$SRC"; } > "$WORK/ctla2.sql"
docker cp "$WORK/ctla2.sql" "$DB:/tmp/ctla2.sql" >/dev/null
CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctla2.sql 2>&1)
if echo "$CTRL" | grep -qE "^not ok"; then
  echo "control: *** NOT GREEN — harness is lying ***"; echo "$CTRL" | grep -E "^not ok" | head -5
elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
  echo "control: *** ABSENT (aborted) — no test ran; every verdict above is void ***"
else
  echo "control: all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
fi
