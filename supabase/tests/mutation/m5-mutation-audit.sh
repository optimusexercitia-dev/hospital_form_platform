#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0078 A33): a test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/m5-mutation-audit.sh
# Every row must read RED-PROVEN. Add a run_case for every new ⭐ keystone.
#
# M5 MUTATION AUDIT — defect ③, the is_active outer gate.
#
# Design note — WHY THIS ISOLATES, and why the obvious mutation would prove nothing.
# The tempting mutation is `create or replace app.is_active(...) returns true`. That
# is EXACTLY the global neuter the M1 harness warns against, and here it is worse
# than useless: is_active is ALSO the gate inside is_staff_admin_of_for /
# is_commission_admin_of_for / is_member_of_for / is_nsp_coordinator_of_for /
# is_pqs_member_of_for. Neutering it globally would WIDEN every role arm at once, so
# a keystone could go red because some unrelated role arm opened — telling us nothing
# about M5's gate. Instead each case surgically rewrites ONE function's body to call a
# neutered stub, leaving the REAL app.is_active intact everywhere else (including in
# the suite's own PRE-flight assertions, which call it directly).
#
# Three harness lessons inherited from m1-mutation-audit.sh, each of which HID A REAL
# RESULT there:
#  1. Match keystones BY LABEL, never by test number — numbers go stale as suites grow.
#  2. Distinguish RED / GREEN / ABSENT. A mutation that ABORTS the suite prints no
#     "not ok" at all; reading that as green is a false NOT-FALSIFIABLE. `red` != `abort`.
#  3. ASCII-only patterns: `·`/`⭐`/`③` are multi-byte and grep's `.` matches one BYTE,
#     so every pattern below is drawn from the ASCII part of the test label.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/231_authz_m5_is_active_gate.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
-- The neutered stub: is_active's signature, permanently "yes".
create or replace function app._mut_active_true(uuid) returns boolean
  language sql immutable as $m$ select true $m$;

-- Surgically revert M5's gate in ONE function. `app.is_active(` appears in these
-- bodies only as CODE — the gate comments deliberately do not spell the call — so a
-- plain replace cannot hit a comment and fake a revert.
create or replace function app._mut_ungate(p_fn text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  if position('app.is_active(' in d) = 0 then
    raise exception 'MUTATION NO-OP: % has no is_active gate to revert', p_fn;
  end if;
  d := replace(d, 'app.is_active(', 'app._mut_active_true(');
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mut5.sql"
  # ⛔ Injection is done with head/tail, NOT `awk -v pre="$PRELUDE"`. The M1 harness's
  # awk form dies on BSD awk (macOS) with "newline in string" for any multi-line -v,
  # which silently produces a garbage script and makes EVERY case abort. The tri-state
  # reported that honestly as ABSENT(aborted) rather than green — which is the only
  # reason it was caught. head/tail is portable across BSD and GNU.
  local line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-44s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mut5.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut5.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-44s expect-red[%s]  %s\n' "$label" "$expect" "$verdict"
}

# ---------------------------------------------------------------------------
# PREFLIGHT — `supabase db reset` drops pgtap and test_helpers (both are created
# transiently by `supabase test db`), so running this straight after a reset would
# otherwise abort EVERY case and print a uniform "NOT PROVEN" that reads like broken
# keystones rather than a missing extension.
# ---------------------------------------------------------------------------
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1

# ---------------------------------------------------------------------------
# CLEANUP — leave the stack as we found it. The preflight above installs pgtap into
# `public` OUTSIDE any transaction, so it PERSISTS after this harness exits, and the
# NEXT `supabase test db` then reads t19 RED ("no public function is anon-executable")
# on 1079 pgtap-owned functions. That is a FALSE red: read-only, zero app leaks, not
# a regression — but the next person chases it, and "2740/2740" becomes reproducible
# only on a fresh reset. A harness that silently changes the stack it audits is a
# harness that manufactures findings. Drop it ONLY if we installed it.
# ---------------------------------------------------------------------------
cleanup_pgtap () {
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup_pgtap EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mut_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mut_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== M5 MUTATION AUDIT — every ⭐ keystone must go RED when ITS gate is reverted ==="

# ---------------------------------------------------------------------------
# ⛔ RETIRED (MINOR-2, post-Gate-1) — three cases that mutated the is_active gate of
# `can_read_case`, `can_read_case_patient`, and `can_write_case_content`. A2 turned
# those three into THIN PROJECTIONS of app._case_caps and RELOCATED the is_active gate
# into the resolver (verified in the live catalog: none of the three now contains an
# `app.is_active(` call). So `_mut_ungate` raised MUTATION NO-OP on each and the cases
# read ABSENT(aborted) — the exact vacuity A33 exists to catch, in the audit itself.
#
# NOT retargeted onto _case_caps: the relocated gate is a SINGLE line
# (`if not app.is_active(p_uid) then return 0`) at STEP 2 of _case_caps, and it is
# ALREADY mutation-proven falsifiable by a2-mutation-audit.sh's K10 (`drop_outer_gate`),
# which reverts that exact line and requires 234's K10 keystone (a DEACTIVATED grantee
# resolves to ZERO caps AND reaches no PHI) to go RED. Retargeting all three here would
# mutate the identical line K10 already mutates — the duplication §7.1 warns against.
# The behavioural pins these cases used to prove (231's "DEACTIVATED assignee/grantee no
# longer reads" family) still RUN in the pgTAP suite as regression assertions; only
# their MUTATION proof-of-record consolidates onto a2 K10. The is_active gate on the
# functions that KEPT it (below) is still proven here.
# ---------------------------------------------------------------------------

# 4 · can_read_action_item — ⭐ A24·5, the arm no resolver can ever reach.
run_case "M5 can_read_action_item (A24.5 gate)" \
  "select app._mut_ungate('app.can_read_action_item(uuid,uuid)');" \
  "DEACTIVATED assignee no longer reads the action item|a SUSPENDED assignee cannot read it either|DEACTIVATED satellite assignee no longer reads it"

# 5 · can_write_case_narrative — the arm M1 flagged and deferred to this unit BY NAME.
run_case "M5 can_write_case_narrative (gate)" \
  "select app._mut_ungate('app.can_write_case_narrative(uuid,uuid)');" \
  "DEACTIVATED narrative assignee no longer WRITES the narrative|a SUSPENDED narrative assignee cannot write it either"

# 6 · can_write_attachment — the action_item arm that no read-check ever covered.
run_case "M5 can_write_attachment (gate)" \
  "select app._mut_ungate('app.can_write_attachment(text,uuid,uuid)');" \
  "DEACTIVATED action-item assignee no longer attaches"

# 7 · referral_target_analyst — ⭐ RULE 12, the only ungated route to referral PHI.
run_case "M5 referral_target_analyst (gate)" \
  "select app._mut_ungate('app.referral_target_analyst(uuid,uuid)');" \
  "DEACTIVATED assignee is no longer the referral analyst|no longer reaches REFERRAL PHI|a SUSPENDED assignee reaches no referral PHI either"

# ---------------------------------------------------------------------------
# THE STRUCTURAL KEYSTONES must be falsifiable too. They are the ones most likely to
# be vacuous: they are PRESENCE assertions over `prosrc`, and this migration's own
# comments discuss the gate at length. If they matched comments they would stay GREEN
# under a real revert — the exact "keystone that cannot fail" A33 exists to catch.
# Reverting the gate removes the CALL but leaves every comment untouched, so a
# comment-matching assertion would go GREEN here and be caught as NOT PROVEN.
# ---------------------------------------------------------------------------
# ⛔ RETIRED (MINOR-2): "M5 STRUCTURAL can_read_case (comments)" mutated can_read_case,
# which no longer holds the gate (thin projection) — the mutation NO-OPs and its 231
# keystone label was itself updated at A2 to "is_active-gated in CODE — directly or
# through the resolver". The structural presence of the relocated gate is asserted by
# 234 and its call-through is proven by a2 K10. This structural-over-referral case stays,
# because referral_target_analyst KEPT its own is_active gate.
run_case "M5 STRUCTURAL 3-beyond-brief" \
  "select app._mut_ungate('app.referral_target_analyst(uuid,uuid)');" \
  "the three functions BEYOND the brief"

# ===========================================================================
# M5b — THE DOORS (232). A33: I found these arms myself, so nobody was owed a test
# for them — §7.1·4 calls that the most fragile class on this program. Each door's
# gate is reverted ALONE and its keystones must go RED.
#
# ⚠ The same isolation argument as above, and it is sharper here: these are
# `public.*` DEFINER RPCs, so their gate REPLACES RLS. Neutering app.is_active
# globally would open the role arms too and prove nothing about any single door.
# ===========================================================================
SRC="supabase/tests/232_authz_m5b_door_gate.sql"
echo
echo "=== M5b DOOR AUDIT (232) — every door's gate reverted ALONE ==="

run_case "M5b list_my_cases (gate)" \
  "select app._mut_ungate('public.list_my_cases(uuid)');" \
  "DEACTIVATED phase assignee gets ZERO rows from list_my_cases|a SUSPENDED phase assignee gets ZERO rows"

run_case "M5b list_my_action_items (gate)" \
  "select app._mut_ungate('public.list_my_action_items(uuid)');" \
  "and ZERO from list_my_action_items"

run_case "M5b get_member_overview (gate)" \
  "select app._mut_ungate('public.get_member_overview(uuid)');" \
  "get_member_overview counts ZERO cases|and ZERO pending action items|the overview counts ZERO for him too"

run_case "M5b conclude_narrative (HC0F4 gate)" \
  "select app._mut_ungate('public.conclude_narrative(uuid)');" \
  "DEACTIVATED narrative assignee CANNOT conclude|a SUSPENDED narrative assignee cannot conclude"

run_case "M5b advance_committee_action_item (gate)" \
  "select app._mut_ungate('public.advance_committee_action_item(uuid,uuid,text)');" \
  "DEACTIVATED action-item assignee CANNOT advance|a SUSPENDED action-item assignee cannot advance"

# ⛔ RETIRED (MINOR-2): "M5b closure: board via can_read_case" mutated can_read_case's
# own gate to prove list_cases_board is "fixed for free". A2 relocated that gate into
# _case_caps, so the mutation NO-OPs here. The board inherits the gate through
# can_read_case -> _case_caps, and reverting the _case_caps gate (a2 K10) reopens every
# _case_caps consumer at once — the board among them. Proof-of-record: a2 K10.
