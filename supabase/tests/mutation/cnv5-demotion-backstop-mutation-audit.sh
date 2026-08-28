#!/usr/bin/env bash
# CNV-5 / R2-m3 — mutation audit for the `is_admin` demotion backstop.
#
# Subject: the arm added to `public.guard_profile_privileged_columns` by
# `20261003006400_adr0166_demotion_tenant_anchor_backstop.sql`, asserted by
# `supabase/tests/400_adr0166_demotion_tenant_anchor_backstop.sql`.
#
# ⛔ EVERY CASE ASSERTS THE MUTATION LANDED before trusting its verdict, and asserts the
#    RESTORE brought the definition back.  A mutation that did not fully apply reports
#    GREEN, and that green is indistinguishable from "the assertion is robust".
#
# ⭐ BOTH POLARITIES.  A one-directional mutation leaves the opposite polarity unproven:
#    a never-fires mutation cannot move a `lives_ok`, and an always-fires mutation cannot
#    move a `throws_ok`.  Cases M2/M3 are that pair; M4 is the true->false polarity gate.
#
# Usage:  bash supabase/tests/mutation/cnv5-demotion-backstop-mutation-audit.sh
set -uo pipefail

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261003006400_adr0166_demotion_tenant_anchor_backstop.sql"
SUITE="supabase/tests/400_adr0166_demotion_tenant_anchor_backstop.sql"
SETUP="supabase/tests/00_setup.sql"
TMP="$(mktemp -d)"

psql_q() { docker exec -i "$DB" psql -U postgres -d postgres -tAc "$1"; }

hash_of() {
  psql_q "select md5(pg_get_functiondef(p.oid)) from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='public' and p.proname='guard_profile_privileged_columns';"
}

# Rewrite the LIVE body via pg_get_functiondef + replace + execute.  The migration file is
# never edited — the catalog is the subject, exactly as it is the truth.
mutate() {
  cat > "$TMP/m.sql" <<SQLEOF
do \$mut\$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='guard_profile_privileged_columns';
  d := replace(d, \$find\$$1\$find\$, \$repl\$$2\$repl\$);
  execute d;
end
\$mut\$;
SQLEOF
  docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q < "$TMP/m.sql" >/dev/null 2>&1
}

restore() {
  docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q < "$MIG" >/dev/null 2>&1
}

# Runs the scoped suite; echoes the failing test numbers (empty = all green).
run_suite() {
  ( cd "$ROOT" && supabase test db "$SETUP" "$SUITE" 2>&1 ) > "$TMP/out.txt"
  local rc=$?
  if [ $rc -eq 0 ]; then echo "GREEN"; else
    grep -oE '^# Failed test [0-9]+' "$TMP/out.txt" | grep -oE '[0-9]+' | paste -sd, -
  fi
}

BASE="$(hash_of)"
echo "baseline definition md5 = $BASE"
echo "baseline suite          = $(run_suite)"
echo

run_case() {  # label, find, replace, expectation
  local label="$1" find="$2" repl="$3" expect="$4"
  echo "── $label"
  echo "   mutate: [$find]  ->  [$repl]"
  mutate "$find" "$repl"
  local h1; h1="$(hash_of)"
  if [ "$h1" = "$BASE" ]; then
    echo "   ⛔ MUTATION DID NOT LAND (md5 unchanged) — verdict below would be MEANINGLESS"
    restore; return
  fi
  echo "   landed: md5 moved $BASE -> $h1"
  echo "   suite : $(run_suite)"
  echo "   expect: $expect"
  restore
  local h2; h2="$(hash_of)"
  if [ "$h2" = "$BASE" ]; then echo "   restored: md5 back to baseline ✓"; else
    echo "   ⛔ RESTORE FAILED (md5 $h2 != $BASE) — every later case is contaminated"; fi
  echo
}

run_case "M1 ARM REMOVED (gate constant-false — the arm can never fire)" \
  "coalesce(old.is_admin, false)" "false" \
  "deny cells 18(2.3) + 21(2.6) RED; invariant 25(2.10) + 28(3.3) RED"

run_case "M2 PREDICATE CONSTANT-TRUE (everyone reads as anchorless — always fires)" \
  "app.person_is_anchorless(new.id)" "true" \
  "ACCEPT cells 19(2.4) + 22(2.7) RED — the opposite polarity from M3"

run_case "M3 PREDICATE CONSTANT-FALSE (nobody reads as anchorless — never fires)" \
  "app.person_is_anchorless(new.id)" "false" \
  "DENY cells 18(2.3) + 21(2.6) RED — the opposite polarity from M2"

# ⛔ M4 IS THE SECOND ATTEMPT, AND THE FIRST ONE IS THE LESSON.  The original mutation
#    replaced only `and not coalesce(new.is_admin, false)` with `and true`.  Its md5
#    MOVED — it landed textually — and the suite came back GREEN, which reads as "cell 2.9
#    is robust".  It is not: the surviving `coalesce(old.is_admin, false)` still gated the
#    arm, so a promotion (old.is_admin = FALSE) never reached it and the defect the case
#    was labelled with was never constructed.  A landed mutation that does not build its
#    own defect is a VACUOUS mutation, and it is indistinguishable from a robust
#    assertion.  The whole gate must be replaced, not one conjunct of it.
run_case "M4 POLARITY GATE DROPPED (fires on ANY is_admin change, not just true->false)" \
  "coalesce(old.is_admin, false)
     and not coalesce(new.is_admin, false)" "new.is_admin is distinct from old.is_admin" \
  "PROMOTION cell 24(2.9) RED — the cell that exists only for this mutation"

run_case "M5 SCHEMA QUALIFICATION DROPPED (search_path excludes 'app' -> 42883 at runtime)" \
  "app.person_is_anchorless" "person_is_anchorless" \
  "source pin 4(0.4) RED; deny cells fail at 42883 not HC0RB"

run_case "M6 SUBJECT old.id INSTEAD OF new.id" \
  "new.id" "old.id" \
  "source pin 5(0.5) RED"

echo "final definition md5 = $(hash_of)  (baseline $BASE)"
rm -rf "$TMP"
