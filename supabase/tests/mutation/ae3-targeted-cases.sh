#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AE3 TARGETED MUTATION CASES — the discharge for `scripts/door-sweep-cases.sh`'s
# exit 1 on the AE3 migration set (ADR 0155 D4; CLAUDE.md §6 step 1).
#
# WHY THIS FILE EXISTS. The deriver returned ZERO cases and EXCLUDED-BY-NAME five
# functions, which is a FINDING to rule on and never a pass (ADR 0079 Amendment 8
# ruling 2). The five are excluded because the recipe's name filter selects boolean
# gates (^is_|can_|has_|...) and the door sweep "can only neutralize a boolean
# predicate". Ruling, per function:
#
#   app.finalize_invited_person_impl  — NOT a gate. It CALLS one
#                                       (app.can_administer_person_for('cpf_change')),
#                                       which is in the sweep's domain and is UNCHANGED
#                                       by AE3. Storage moved; the decision did not.
#   app.update_person_fields_impl     — same, for the 'fields' and 'cpf_change' arms.
#   public.list_org_people            — its gate is the inline D10 predicate. UNCHANGED
#                                       by AE3 (byte-identical); only the CPF probe's
#                                       relation moved.
#   public.get_own_person_record      — self-scoped: the gate is `auth.uid() is null`.
#                                       UNCHANGED.
#   public.guard_profile_privileged_columns
#                                     — ⛔ THE ONE WHOSE PREDICATE AE3 ACTUALLY CHANGED.
#                                       Three disjuncts left `v_identity_changed`. It
#                                       returns `trigger`, so the door sweep cannot
#                                       neutralize it: it owes a TARGETED case. CASE A.
#
# And the change introduced a NEW control that no existing arm covers, because it is an
# ABSENCE of a grant rather than a predicate: CASE B.
#
# ⛔ ROLLBACK IS PROVEN BEFORE IT IS TRUSTED (the standing lesson): each case asserts the
# mutation MOVED the subject's fingerprint, and that the restore brought it BACK to the
# pre-mutation value. A mutation that did not fully apply reports GREEN, which is
# indistinguishable from a covered gate.
#
# USAGE:  bash supabase/tests/mutation/ae3-targeted-cases.sh
# Exit 0 = both cases COVERED (something red under mutation, green again after restore).
# ---------------------------------------------------------------------------
set -uo pipefail

DB="supabase_db_azkbbhskturikxpgmafq"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 1

psql() { docker exec -i "$DB" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -P pager=off "$@"; }
psqlt() { docker exec -i "$DB" psql -U postgres -d postgres -X -tA -P pager=off "$@"; }

fail() { echo "!! $*" >&2; exit 1; }

# Runs a pgTAP file, returns 0 if it PASSED, 1 if it FAILED.
run_suite() {
  local f="$1"
  npx supabase test db "$f" >/tmp/ae3-mut.$$ 2>&1
  if grep -q "^Result: PASS" /tmp/ae3-mut.$$; then return 0; else return 1; fi
}

echo "==========================================================================="
echo "AE3 TARGETED MUTATION CASES"
echo "==========================================================================="

# ===========================================================================
# CASE A — guard_profile_privileged_columns: neutralize the identity arm.
#   Subject: the arm AE3 edited. If nothing reds when it is forced false, then the
#   remaining arms are unmeasured and AE3's "edited, not gutted" claim is unproven.
# ===========================================================================
echo
echo "--- CASE A: guard_profile_privileged_columns, identity arm neutralized ---"

A_BEFORE="$(psqlt -c "select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_profile_privileged_columns';")"
[ -n "$A_BEFORE" ] || fail "CASE A: could not fingerprint the subject"
psqlt -c "select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_profile_privileged_columns';" > /tmp/ae3-guard-orig.$$.sql
echo "  fingerprint before: $A_BEFORE"

# Neutralize: force the identity arm false, leaving everything else intact.
psql -c "$(cat <<'SQL'
do $mut$
declare src text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'guard_profile_privileged_columns';
  src := replace(src,
    'v_identity_changed :=',
    'v_identity_changed := false; if false then raise notice ''%'', ');
  src := replace(src,
    'or new.must_change_password is distinct from old.must_change_password;',
    'or new.must_change_password is distinct from old.must_change_password; end if;');
  execute src;
end;
$mut$;
SQL
)" || fail "CASE A: mutation failed to apply"

A_MUT="$(psqlt -c "select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_profile_privileged_columns';")"
echo "  fingerprint mutated: $A_MUT"
[ "$A_MUT" != "$A_BEFORE" ] || fail "CASE A: THE MUTATION DID NOT LAND (fingerprint unchanged) — a green here would prove nothing"

if run_suite supabase/tests/359_profiles_dob_phone.sql; then
  A_VERDICT="BLIND"
else
  A_VERDICT="COVERED"
fi
echo "  359 under mutation: $([ "$A_VERDICT" = COVERED ] && echo 'RED (good)' || echo 'GREEN (BLIND)')"

# Restore, and prove the restore.
# ⛔ `-f -` WITH A HOST REDIRECT, NEVER `-f <path>`. psql runs INSIDE the container, so a
# `-f` path is resolved in the CONTAINER filesystem — a host path silently does not exist
# there. Measured: the first run of this script left the database MUTATED because the
# restore could not find its own file. The redirect makes the shell open it on the host.
psql -f - < /tmp/ae3-guard-orig.$$.sql >/dev/null || fail "CASE A: RESTORE FAILED — the database is left mutated"
A_AFTER="$(psqlt -c "select md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_profile_privileged_columns';")"
[ "$A_AFTER" = "$A_BEFORE" ] || fail "CASE A: RESTORE DID NOT RETURN THE ORIGINAL (before=$A_BEFORE after=$A_AFTER)"
echo "  fingerprint restored: $A_AFTER  (matches before)"
run_suite supabase/tests/359_profiles_dob_phone.sql || fail "CASE A: 359 still RED after restore — the restore is incomplete"
echo "  359 after restore: GREEN"
echo "  CASE A VERDICT: $A_VERDICT"

# ===========================================================================
# CASE B — the NEW control: profile_private_details' absent grant.
#   This is an ABSENCE, so no predicate-neutralizing arm can reach it. Mutation =
#   GRANT the table to `authenticated`, i.e. re-open exactly what AE3 closed.
# ===========================================================================
echo
echo "--- CASE B: profile_private_details granted to authenticated ---"

B_BEFORE="$(psqlt -c "select has_table_privilege('authenticated','public.profile_private_details','SELECT')::text;")"
echo "  authenticated SELECT before: $B_BEFORE"
# ⚠ `::text` on a boolean yields `false`/`true`, NOT psql's aligned-mode `f`/`t`. Compared
# against `f` this precondition never held and CASE B could not run at all.
[ "$B_BEFORE" = "false" ] || fail "CASE B: preconditions wrong — authenticated already holds SELECT"

psql -c "grant select, update on public.profile_private_details to authenticated;" || fail "CASE B: mutation failed to apply"
B_MUT="$(psqlt -c "select has_table_privilege('authenticated','public.profile_private_details','SELECT')::text;")"
echo "  authenticated SELECT mutated: $B_MUT"
[ "$B_MUT" = "true" ] || fail "CASE B: THE MUTATION DID NOT LAND — a green here would prove nothing"

B_RED=0
for f in supabase/tests/382_zero_policy_tables_are_door_only.sql supabase/tests/359_profiles_dob_phone.sql; do
  if ! run_suite "$f"; then B_RED=$((B_RED+1)); echo "  $(basename "$f") under mutation: RED (good)"; else echo "  $(basename "$f") under mutation: GREEN (BLIND)"; fi
done
[ "$B_RED" -gt 0 ] && B_VERDICT="COVERED" || B_VERDICT="BLIND"

psql -c "revoke select, update on public.profile_private_details from authenticated;" || fail "CASE B: RESTORE FAILED — the database is left with a widened grant"
B_AFTER="$(psqlt -c "select has_table_privilege('authenticated','public.profile_private_details','SELECT')::text;")"
[ "$B_AFTER" = "$B_BEFORE" ] || fail "CASE B: RESTORE DID NOT RETURN THE ORIGINAL (before=$B_BEFORE after=$B_AFTER)"
echo "  authenticated SELECT restored: $B_AFTER  (matches before)"
run_suite supabase/tests/382_zero_policy_tables_are_door_only.sql || fail "CASE B: 382 still RED after restore — the restore is incomplete"
echo "  382 after restore: GREEN"
echo "  CASE B VERDICT: $B_VERDICT"

rm -f /tmp/ae3-mut.$$ /tmp/ae3-guard-orig.$$.sql

echo
echo "==========================================================================="
if [ "$A_VERDICT" = "COVERED" ] && [ "$B_VERDICT" = "COVERED" ]; then
  echo "=== BOTH CASES COVERED ==="
  exit 0
fi
echo "=== BLIND: A=$A_VERDICT B=$B_VERDICT — this BLOCKS the phase (CLAUDE.md §6 step 1) ==="
exit 1
