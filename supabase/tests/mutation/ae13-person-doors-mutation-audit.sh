#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AE1.3 — PERSON-DOORS MUTATION AUDIT.
#
# ⭐ WHAT THIS ANSWERS, AND WHY IT IS NOT OPTIONAL. pgTAP 384/385/386 being green says
# only that the doors behave correctly TODAY. It says nothing about whether the assertions
# would NOTICE if they stopped. This harness neutralizes each authority check in the live
# catalog and requires the keystone to RED. A green under mutation is a FINDING: that
# keystone could not fail, and its greenness was never evidence.
#
# ⛔ THE THREE PROPERTIES THAT MAKE A MUTATION AUDIT MEAN ANYTHING, all enforced below:
#   1. ASSERT THE EDIT LANDED. A `replace()` whose search string does not match rewrites
#      the body unchanged and the rerun reports GREEN — indistinguishable from a keystone
#      that held. Every case compares md5(pg_get_functiondef) before/after and ABORTS the
#      case (no verdict) when the hash did not move.
#   2. PROVE THE ROLLBACK. The restored hash must equal the baseline EXACTLY. A restore
#      that half-applied leaves the next case measuring a body nobody described.
#   3. RE-RUN AFTER RESTORE. Red-then-green is the pair; red alone is also what a broken
#      fixture looks like.
#
# ⛔ THIS MUTATES THE SHARED LOCAL STACK. Run it in a serialized window with the DB to
# yourself — a sibling querying `pg_proc` mid-run sees a neutralized authority gate and
# cannot reproduce it afterwards.
#
# ⚠ CASE G2 MUTATES `public.guard_profile_privileged_columns`, WHICH IS NOT AN AE1.3
# OBJECT. It is transient and restored, and it is the case ADR 0161 / design §6.4 requires
# (the anti-fix keystone's independence). Its hashes are reported INDIVIDUALLY, never
# folded into an aggregate. ⛔ If its restore does not compare equal, that is a STACK-LEVEL
# INCIDENT: stop and escalate, do not retry.
#
# Usage:  bash supabase/tests/mutation/ae13-person-doors-mutation-audit.sh
# ---------------------------------------------------------------------------
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/../../.." || exit 2
DB="docker exec -i supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres"
Q="docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc"

FINDINGS=0

hash_of() {
  $Q "select coalesce(md5(pg_get_functiondef(p.oid)),'ABSENT') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='$1' and p.proname='$2';" | tr -d '\r'
}

mutate() { # schema fn old new
  $DB -v ON_ERROR_STOP=1 -q <<SQL
do \$mut\$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = '$1' and p.proname = '$2';
  v_def := replace(v_def, \$old\$$3\$old\$, \$new\$$4\$new\$);
  execute v_def;
end \$mut\$;
SQL
}

# ⛔ CAPTURE THE RUN SHAPE, NOT ONLY THE VERDICT LINE. A pgTAP file that ABORTS (assertions
# stop running) and one that FAILS (assertions run and report failures) both print
# `Result: FAIL`. Neutralizing `app.can_administer_person_for` was MEASURED to ABORT 384
# (7,870 -> 7,863 tests) — which is exactly why the sibling door sweep records `ERROR
# run-shape!=baseline` for that same function rather than a verdict. A harness that greps
# only `^Result:` calls both of those a clean red, and "the suite went red" is not the same
# claim as "the assertion noticed". Idiom lifted from `p0-authz-writepath-audit.sh` classify().
BASE_SHAPE="$(mktemp)"
LAST_SHAPE="$(mktemp)"     # ⛔ a FILE, not a global — see below
run_test() {
  local out ft
  out="$(npx supabase test db "supabase/tests/$1" 2>&1)"
  ft="$(echo "$out" | tr -d '\r' | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)"
  # ⛔ WHY A TEMP FILE AND NOT `R_TESTS=...`. Every caller invokes this as `r="$(run_test x)"`,
  # which runs the function in a SUBSHELL — global assignments made here are discarded when it
  # exits, so the parent would read an EMPTY test count and the shape comparison below would
  # compare against nothing and pass for every case. That is the very defect this block was
  # added to remove, reintroduced inside its own fix. It was caught only because the baseline
  # loop refuses to continue when no count is captured; keep that check.
  { echo "${ft:+$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')}"
    echo "${ft:+$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')}"; } > "$LAST_SHAPE"
  echo "$out" | grep -E '^Result:' | tr -d '\r' | tail -1 | tr -d '\n'
}
last_files() { sed -n 1p "$LAST_SHAPE"; }
last_tests() { sed -n 2p "$LAST_SHAPE"; }
# baseline test-count for one suite file, recorded during the BASELINE pass
base_tests_of() { awk -v f="$1" '$1==f {print $2}' "$BASE_SHAPE" | tail -1; }
restore_migration() { $DB -v ON_ERROR_STOP=1 -q -f - < "supabase/migrations/$1" >/dev/null; }

case_no=0
one_case() { # label schema fn old new testfile migration
  case_no=$((case_no+1))
  local label="$1" sch="$2" fn="$3" old="$4" new="$5" tf="$6" mig="$7"
  echo "──────────────────────────────────────────────────────────────"
  echo "CASE $case_no — $label"
  local h0 h1 h2 r_mut r_res
  h0="$(hash_of "$sch" "$fn")"
  mutate "$sch" "$fn" "$old" "$new" >/dev/null 2>&1
  h1="$(hash_of "$sch" "$fn")"
  if [ "$h0" = "$h1" ]; then
    echo "  ⛔ ABORT — THE MUTATION DID NOT LAND (hash unchanged: $h0)."
    echo "     No verdict may be read from this case: an unapplied mutation reports GREEN."
    FINDINGS=$((FINDINGS+1)); return
  fi
  echo "  edit landed   : $h0 -> $h1"
  local mut_tests base_tests shape_note=""
  r_mut="$(run_test "$tf")"; mut_tests="$(last_tests)"
  restore_migration "$mig"
  h2="$(hash_of "$sch" "$fn")"
  r_res="$(run_test "$tf")"
  base_tests="$(base_tests_of "$tf")"
  echo "  under mutation: $tf -> $r_mut  (Tests=${mut_tests:-?} vs baseline ${base_tests:-?})"
  echo "  restored hash : $h2 $( [ "$h2" = "$h0" ] && echo '(== baseline)' || echo '(!= baseline ⛔)' )"
  echo "  after restore : $tf -> $r_res  (Tests=$(last_tests))"
  # A SHAPE DROP means assertions stopped running. That is NOT a keystone holding: the
  # suite may have aborted before ever evaluating the assertion the mutation targets.
  if [ -n "$base_tests" ] && [ -n "$mut_tests" ] && [ "$mut_tests" -lt "$base_tests" ]; then
    shape_note="run-shape!=baseline (Tests=$mut_tests vs $base_tests)"
  fi
  if [ -n "$shape_note" ]; then
    echo "  VERDICT: ⛔ ERROR — $shape_note. The suite ABORTED rather than failed, so this"
    echo "           case proves nothing about whether the assertion noticed. NOT a pass,"
    echo "           and NOT a keystone-holds. Cover it with a case whose suite completes."
    FINDINGS=$((FINDINGS+1))
  elif [ "$r_mut" = "Result: FAIL" ] && [ "$r_res" = "Result: PASS" ] && [ "$h2" = "$h0" ]; then
    echo "  VERDICT: KEYSTONE HOLDS — red under mutation (full shape), green restored, rollback exact"
  else
    echo "  VERDICT: ⛔ FINDING — see the three lines above"
    FINDINGS=$((FINDINGS+1))
  fi
}

M600=20261003004600_person_authority_predicate.sql
M610=20261003004610_person_profile_doors.sql
M620=20261003004620_person_credential_doors.sql
T384=384_person_scope_sql_predicate.sql
T385=385_person_doors_authority_and_audit.sql
T386=386_person_doors_acl_and_guard.sql

echo "=== BASELINE — all three files must be GREEN before any mutation ==="
echo "    (a dirty baseline makes every verdict below unreadable: a keystone that was"
echo "     ALREADY red cannot be shown to have gone red because of the mutation)"
BASE_OK=1
for f in "$T384" "$T385" "$T386"; do
  r="$(run_test "$f")"; bt="$(last_tests)"
  echo "  $f -> $r  (Files=$(last_files) Tests=${bt:-?})"
  # Record the shape, not just the verdict: every later case is compared against it, and a
  # baseline with no recorded test count silently disables that comparison.
  [ -n "$bt" ] && echo "$f $bt" >> "$BASE_SHAPE"
  [ "$r" = "Result: PASS" ] || BASE_OK=0
  [ -n "$bt" ] || { echo "  ⛔ no Tests= captured for $f — the shape check would be vacuous"; BASE_OK=0; }
done
if [ "$BASE_OK" -ne 1 ]; then
  echo "⛔ ABORTING: baseline is not green. Fix that first."; exit 2
fi

# ── The doors ──────────────────────────────────────────────────────────────
one_case "update_person_fields: NEUTRALIZE the cpf_change (SUBSET) arm -> 385 §1.3" \
  app update_person_fields_impl \
  "v_cpf_changed and not app.can_administer_person_for('cpf_change', p_user, p_actor)" "false" \
  "$T385" "$M610"

one_case "update_person_fields: SWAP the always-arm 'fields' -> 'cpf_change' -> 385 §1.1" \
  app update_person_fields_impl \
  "can_administer_person_for('fields', p_user, p_actor)" \
  "can_administer_person_for('cpf_change', p_user, p_actor)" \
  "$T385" "$M610"

one_case "update_person_fields: CPF grain 'real change' -> 'key present' -> 385 §1.4" \
  app update_person_fields_impl \
  "v_cpf_changed := coalesce(p_set_cpf, false)" "v_cpf_changed := coalesce(p_set_cpf, false) and true or coalesce(p_set_cpf, false)" \
  "$T385" "$M610"

one_case "set_person_active: SWAP 'lifecycle' -> 'fields' (the SUBSET->INTERSECTION swap in its most dangerous place) -> 385 §2.1" \
  app set_person_active_impl \
  "can_administer_person_for('lifecycle', p_user, p_actor)" \
  "can_administer_person_for('fields', p_user, p_actor)" \
  "$T385" "$M610"

one_case "suspend_person: NEUTRALIZE the authority check -> 385 §3.3" \
  app suspend_person_impl \
  "not app.can_administer_person_for('lifecycle', p_user, p_actor)" "false" \
  "$T385" "$M610"

one_case "finalize_invited_person: NEUTRALIZE the authority check -> 385 §4.4/§4.5" \
  app finalize_invited_person_impl \
  "not app.can_administer_person_for('cpf_change', p_user, p_actor)" "false" \
  "$T385" "$M610"

one_case "upsert_credential: SWAP 'credentials' -> 'lifecycle' (INTERSECTION->SUBSET) -> 385 §5.1" \
  app upsert_credential_impl \
  "can_administer_person_for('credentials', p_user, p_actor)" \
  "can_administer_person_for('lifecycle', p_user, p_actor)" \
  "$T385" "$M620"

one_case "upsert_credential: DROP the cross-person user_id conjunct -> 385 §5.5" \
  app upsert_credential_impl "and user_id = p_user" "and true" \
  "$T385" "$M620"

one_case "delete_credential: give the UNKNOWN-ID branch its own code (a credential-id oracle) -> 385 §6.2/§6.3" \
  app delete_credential_impl \
  "if v_user is null
     or not app.can_administer_person_for('credentials', v_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;" \
  "if v_user is null then
    raise exception 'registro nao encontrado' using errcode = 'HC0T6';
  end if;
  if not app.can_administer_person_for('credentials', v_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;" \
  "$T385" "$M620"

# ── The predicate ──────────────────────────────────────────────────────────
one_case "predicate: REMOVE the empty-footprint pin (the vacuous-subset inversion) -> 384 §3.3/§3.4" \
  app can_administer_person_for "cardinality(v_footprint) = 0" "false" \
  "$T384" "$M600"

one_case "predicate: DROP 'ended_on is null' (align the WRITE rule with the READ rule) -> 384 §5.2" \
  app can_administer_person_for "and ha.ended_on is null" "and true" \
  "$T384" "$M600"

one_case "predicate: DROP 'voided_at is null' (AFF4 D7) -> 384 §5.4" \
  app can_administer_person_for "and ha.voided_at is null" "and true" \
  "$T384" "$M600"

one_case "predicate: DROP the D2 tier check -> 384 §4.1/§4.2/§4.5" \
  app can_administer_person_for "m.commission_id is null" "false" \
  "$T384" "$M600"

# ⭐ THE VECTOR-DRIFT PROOF. This is the mutation the shared TS↔SQL vectors exist for: it
# gives `fields`/`credentials` the SUBSET bound, so the SQL half silently stops agreeing
# with `personScopeAllows`. 384 §9.4 must red NAMING S4 fields and S4 credentials — and
# ONLY the S4 rows, because no sole-footprint vector can tell the two bounds apart.
one_case "predicate: SWAP the INTERSECTION bound for the SUBSET one -> 384 §9.4 (shared vectors) + §1.1/§1.2" \
  app can_administer_person_for \
  "return v_footprint && v_administered;" \
  "return not exists (select 1 from unnest(v_footprint) f where not (f = any (v_administered)));" \
  "$T384" "$M600"

# ── ACL + guard independence (design §6.4) ─────────────────────────────────
echo "──────────────────────────────────────────────────────────────"
echo "CASE G1 — ACL: grant \`authenticated\` EXECUTE on one door. 386 §1.3 must red."
G1_BEFORE="$($Q "select proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_person_active_for';" | tr -d '\r')"
$Q "grant execute on function public.set_person_active_for(uuid,uuid,boolean) to authenticated;" >/dev/null
echo "  acl baseline  : $G1_BEFORE"
G1_MUTACL="$($Q "select proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_person_active_for';" | tr -d '\r')"
echo "  acl mutated   : $G1_MUTACL"
# G1 was the ONLY case of 16 with no landed-check (QA round 1). Without it a
# silently failed GRANT still reports a FINDING - but MISATTRIBUTED as a keystone
# failure rather than an unapplied mutation, the one distinction every other
# case makes.
if [ "$G1_MUTACL" = "$G1_BEFORE" ]; then
  echo "  ⛔ ABORT - THE GRANT DID NOT LAND (acl unchanged). No verdict from this case."
  FINDINGS=$((FINDINGS+1))
fi
G1_MUT="$(run_test "$T386")"
$Q "revoke execute on function public.set_person_active_for(uuid,uuid,boolean) from authenticated;" >/dev/null
G1_AFTER="$($Q "select proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_person_active_for';" | tr -d '\r')"
G1_RES="$(run_test "$T386")"
echo "  acl restored  : $G1_AFTER $( [ "$G1_AFTER" = "$G1_BEFORE" ] && echo '(== baseline)' || echo '(!= baseline ⛔)' )"
echo "  under mutation: $T386 -> $G1_MUT"
echo "  after restore : $T386 -> $G1_RES"
if [ "$G1_MUT" = "Result: FAIL" ] && [ "$G1_RES" = "Result: PASS" ] && [ "$G1_AFTER" = "$G1_BEFORE" ]; then
  echo "  VERDICT: KEYSTONE HOLDS"
else
  echo "  VERDICT: ⛔ FINDING"; FINDINGS=$((FINDINGS+1))
fi

echo "──────────────────────────────────────────────────────────────"
echo "CASE G2 — GUARD (⚠ NOT AN AE1.3 OBJECT): widen guard_profile_privileged_columns'"
echo "          trusted-caller arm. 386 §3.2/§3.3 must red while §1.x and §3.5 stay green —"
echo "          that split is what proves the three anti-fix assertions are INDEPENDENT and"
echo "          not one predicate written three times."
GH0="$(hash_of public guard_profile_privileged_columns)"
echo "  guard baseline hash  : $GH0"
mutate public guard_profile_privileged_columns "if auth.uid() is null then" "if true then" >/dev/null 2>&1
GH1="$(hash_of public guard_profile_privileged_columns)"
echo "  guard mutated hash   : $GH1"
if [ "$GH0" = "$GH1" ]; then
  echo "  ⛔ ABORT — guard mutation did not land; no verdict."
  FINDINGS=$((FINDINGS+1))
else
  G2_MUT="$(run_test "$T386")"
  mutate public guard_profile_privileged_columns "if true then" "if auth.uid() is null then" >/dev/null 2>&1
  GH2="$(hash_of public guard_profile_privileged_columns)"
  G2_RES="$(run_test "$T386")"
  echo "  guard restored hash  : $GH2"
  echo "  under mutation       : $T386 -> $G2_MUT"
  echo "  after restore        : $T386 -> $G2_RES"
  if [ "$GH2" != "$GH0" ]; then
    echo "  ⛔⛔ STACK-LEVEL INCIDENT: the guard did NOT restore to its baseline body."
    echo "      public.guard_profile_privileged_columns is the only thing preventing"
    echo "      self-elevation to is_admin. STOP and escalate. Do not retry."
    FINDINGS=$((FINDINGS+1))
  elif [ "$G2_MUT" = "Result: FAIL" ] && [ "$G2_RES" = "Result: PASS" ]; then
    echo "  VERDICT: KEYSTONE HOLDS — and the guard is byte-identical to its baseline"
  else
    echo "  VERDICT: ⛔ FINDING"; FINDINGS=$((FINDINGS+1))
  fi
fi

echo "──────────────────────────────────────────────────────────────"
echo "FINAL STATE — all three files green again, and nothing left mutated"
for f in "$T384" "$T385" "$T386"; do echo "  $f -> $(run_test "$f")"; done
echo "  guard hash now: $(hash_of public guard_profile_privileged_columns) (baseline was $GH0)"
echo
# Declared-vs-run reconciliation (QA round 1): `16` appeared nowhere in this script,
# `case_no` is display-only, and G1/G2 do not increment it - so commenting out a
# `one_case` line would have exited 0 having measured 13, silently.
DECLARED_ONE_CASE=14   # one_case invocations; G1 + G2 are separate blocks
DECLARED_TOTAL=16
echo "cases declared: $DECLARED_TOTAL ($DECLARED_ONE_CASE via one_case + G1 + G2)  |  one_case ran: $case_no"
if [ "$case_no" -ne "$DECLARED_ONE_CASE" ]; then
  echo "  ⛔ DECLARED/RAN MISMATCH - $case_no of $DECLARED_ONE_CASE one_case blocks ran."
  echo "     A partial run is not a pass. Verdicts below cover only what ran."
  FINDINGS=$((FINDINGS+1))
fi
echo "FINDINGS: $FINDINGS"
[ "$FINDINGS" -eq 0 ] || exit 1
