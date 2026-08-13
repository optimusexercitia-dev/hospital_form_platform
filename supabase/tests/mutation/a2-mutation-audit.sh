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
#  6. ⭐ FUP-QO-3 (2026-08-07): A CASE'S TARGET SUITE IS PART OF THE CASE. Two cases
#     below went vacuous because ADR 0078 Gate 2 C1 made the `meeting_cases` READ
#     member-wide: their expected-red assertions in 234 stopped routing
#     `read_case_deliberation`, so the arm could be dropped (or widened) with nothing
#     going red — and one expected-red STRING stopped existing anywhere at all. Both
#     are retargeted onto 241 (the summary-masking lane, which is still the surface
#     `read_case_deliberation` actually gates) plus a direct `has_case_capability`
#     probe. `run_case` therefore takes a PER-CASE source file, and the CONTROL runs
#     for every source file used — a red in a file whose control was never run is not
#     evidence.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/234_authz_a2_resolver.sql}"
SRC_C1="${SRC_C1:-supabase/tests/241_authz_c1_meeting_cases_tiers.sql}"
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
  elsif p_what = 'member_ignores_visibility' then
    -- ⭐ MINOR-2 (post-Gate-1) — the visibility_policy arm. A2 relocated this arm OUT of
    -- can_reach_case_on_member_surface (m6's old target, now vacuous) INTO _case_caps, so
    -- the falsifiability proof for `cases.visibility_policy` lands HERE. WIDEN the member
    -- arm to fire regardless of visibility_policy (drop the `and not v_eg` guard) — i.e.
    -- behave as if every case were commission_default. A plain member must then GAIN
    -- read_case_deliberation on the explicit_grants_only ETHICS case (c2) he must not
    -- reach: 234's K8-twin ("reads NO ata section for the explicit_grants_only case")
    -- goes RED. This is the exact over-grant m6's policy_arm case used to prove before
    -- the arm moved.
    d := replace(d, 'if v_member and not v_eg then', 'if v_member then');
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
    -- ADR 0078 Stage B: the S4 assignment arm is anchored on the narrative-exists clause
    -- (unique to S4; the manual_grant LOOP has the same cap bits but a different context).
    d := replace(d,
      'where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
    v_caps := v_caps | app._cap_bit(''read_case_content'')
                     | app._cap_bit(''read_case_deliberation'');',
      'where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
    v_caps := v_caps | app._cap_bit(''read_case_content'')
                     | app._cap_bit(''read_standard_phi'')
                     | app._cap_bit(''read_case_deliberation'');');
  elsif p_what = 'assignment_confers_write' then
    -- Add the assignment arm D10 deliberately withholds from the write bit.
    d := replace(d,
      'where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
    v_caps := v_caps | app._cap_bit(''read_case_content'')
                     | app._cap_bit(''read_case_deliberation'');',
      'where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
    v_caps := v_caps | app._cap_bit(''read_case_content'')
                     | app._cap_bit(''write_case_content'')
                     | app._cap_bit(''read_case_deliberation'');');
  elsif p_what = 'drop_grant_phi' then
    -- ADR 0078 Stage B: PHI is a per-column grant. Remove the read_standard_phi arm of
    -- the manual_grant loop → a read_standard_phi grantee no longer reaches PHI (new K7).
    d := replace(d, 'if v_g.read_standard_phi then', 'if false then');
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

# Every suite a case actually ran against — the CONTROL loop at the bottom reads this,
# so a newly-targeted file cannot slip past the "is the harness lying?" check.
CONTROL_SRCS=""

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
               # $4 = OPTIONAL target suite (defaults to $SRC) — see harness lesson 6.
  local label="$1" mut="$2" expect="$3" src="${4:-$SRC}"
  local f="$WORK/muta2.sql"
  local line
  line=$(grep -n "$MARKER" "$src" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-44s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$src"; return
  fi
  { head -n "$line" "$src"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$src"; } > "$f"
  CONTROL_SRCS="$CONTROL_SRCS $src"
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

# ⛔ POST-A4 (20260730): the org branch no longer confers CONTENT — only manage_case_access.
# `drop_orgadmin` (if v_orgadmin -> if false) now inverts THAT bit, so K2's RED target is
# the manage_case_access twin, not the removed content assertion. (a4-mutation-audit.sh
# covers the content removal by RESTORING the arm and requiring 235's K1 to go red.)
run_case "K2  org-admin source (a) [A4: manage bit only]" \
  "select app._mut_a2('drop_orgadmin');" \
  "K2 .* THE ARM A4 KEEPS: the org_admin STILL holds manage_case_access"

run_case "K4  nsp_referral_touched (c)" \
  "select app._mut_a2('drop_nsp');" \
  "K4 .* source .c.: the NSP operator reads content"

run_case "K5  assignment confers NO PHI (M3)" \
  "select app._mut_a2('assignment_confers_phi');" \
  "K5 .* assignment CONFERS NO PHI|K5 .* ROWS / Rule 12"

run_case "K6  no assignment arm on write (D10)" \
  "select app._mut_a2('assignment_confers_write');" \
  "K6 .* .D10.: the assignee canNOT write case content"

run_case "K7  grant PHI is per-column [B1 closed]" \
  "select app._mut_a2('drop_grant_phi');" \
  "K7 .* a read_standard_phi grantee reaches the PHI door"

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

# ⛔ K3+K12 REMOVED (ADR 0078 Stage B): they tested the case_access flag-OFF legacy arm
# (source b), which B4/D9 DELETED — the flag is retired. There is no second body to pin.

# The member-default source is A15's whole correction. Dropping it must break the
# deliberation surface WITHOUT touching content (which the coordinator/grant arms hold).
#
# ⭐ RETARGETED 2026-08-07 (FUP-QO-3), TARGET SUITE 241. This case read 234's
# "the ordinary member DOES read the ata section" — a count over `meeting_cases`,
# which ADR 0078 Gate 2 C1 (456d008) made MEMBER-WIDE. Post-C1 that read no longer
# routes read_case_deliberation at all, so dropping the member arm left it GREEN and
# the case reported coverage it did not have. The discriminating power is relocated,
# not deleted (the m5/m6 precedent): 241's summary-masking lane is where
# read_case_deliberation is still the gate (app._project_meeting_case masks
# `summary`), and 241's PRE-FLIGHT is a DIRECT has_case_capability probe that no
# permissive sibling can satisfy. Both must go red.
run_case "K8  member_default source (A15) [241]" \
  "select app._mut_a2('drop_member_default');" \
  "PRE .*the member HAS read_case_deliberation on the commission_default case|K5 NO-REGRESSION: .*reads the summary on the commission_default case" \
  "$SRC_C1"

# ⭐ MINOR-2 — the visibility_policy arm, relocated here from m6 (see the PRELUDE note).
# Widening the member arm to ignore explicit_grants_only must hand a plain member the
# ethics case's deliberation, which he must NOT reach.
#
# ⭐ RETARGETED 2026-08-07 (FUP-QO-3), TARGET SUITE 241. Its expected-red string
# ("reads NO ata section for the explicit_grants_only case") stopped existing anywhere
# in supabase/tests/ when C1 rewrote 234's K8-twin — the harness reported ABSENT, which
# is the tri-state doing its job, but the arm was unpinned meanwhile. The over-grant now
# lands where explicit_grants_only still decides the outcome: the plain member must NOT
# hold read_case_deliberation on the sub-group case (PRE probe), and must read a NULL
# summary for it (the K5 masking surface). Widening the member arm flips both.
run_case "Kv  member ignores visibility (EG) [241]" \
  "select app._mut_a2('member_ignores_visibility');" \
  "PRE .*but NOT on the sub-group case|K5 .*member without substance reach reads NULL summary on the sub-group case" \
  "$SRC_C1"

echo
echo "=== CONTROL — an UNMUTATED run of EVERY targeted suite must be fully GREEN. If this"
echo "=== prints anything other than 'all green', every RED above is suspect (the harness,"
echo "=== not the fix). One control per source file: a red in a file whose control never"
echo "=== ran is not evidence (FUP-QO-3)."
for csrc in $(printf '%s\n' $CONTROL_SRCS | sort -u); do
  LINE=$(grep -n "$MARKER" "$csrc" | head -1 | cut -d: -f1)
  { head -n "$LINE" "$csrc"; tail -n +$((LINE+1)) "$csrc"; } > "$WORK/ctla2.sql"
  docker cp "$WORK/ctla2.sql" "$DB:/tmp/ctla2.sql" >/dev/null
  CTRL=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/ctla2.sql 2>&1)
  if echo "$CTRL" | grep -qE "^not ok"; then
    echo "control $(basename "$csrc"): *** NOT GREEN — harness is lying ***"
    echo "$CTRL" | grep -E "^not ok" | head -5
  elif ! echo "$CTRL" | grep -qE "^ok [0-9]+"; then
    echo "control $(basename "$csrc"): *** ABSENT (aborted) — no test ran; every verdict above is void ***"
  else
    echo "control $(basename "$csrc"): all green ($(echo "$CTRL" | grep -cE '^ok [0-9]+') tests ran)"
  fi
done
