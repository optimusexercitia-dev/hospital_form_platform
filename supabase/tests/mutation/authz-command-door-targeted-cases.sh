#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AUTHZ COMMAND-DOOR TARGETED MUTATION CASES — the discharge for
# `scripts/door-sweep-cases.sh`'s **FINDING** exit on a command door that falls
# outside EVERY sweeping arm's domain (ADR 0079 hazard 4; ADR 0190/0191; the
# targeted-home precedent of `ae3-targeted-cases.sh` and
# `authz-setvalued-targeted-cases.sh`).
#
# ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
# The diff-scoped deriver exits **1 — FINDING** when it resolves a door in the
# diff that no arm's `PRED_DOMAIN` can select, and it says in its own words that
# this is NOT "the migration changed no gate". It names exactly two discharges:
# a TARGETED mutation case per door, or a ruling that the object is not an
# authorization decision. This file is the first of those, for the doors that
# fall through BOTH sweeping arms.
#
# ⛔ TWO ARMS, BOTH MEASURED TO EXCLUDE IT — the reason is a property, not an
#    oversight, and it is re-derivable:
#   1. `p0-authz-door-audit.sh` neutralizes a BOOLEAN predicate. This door
#      returns `void`, so it is outside `PRED_DOMAIN` by return type.
#   2. `c2-command-door-neutralizer.sh` sweeps command doors — but its worklist
#      is the enforcers reachable from a **Tier-1** door, and Tier 1 means "the
#      gate-aware closure reaches a PHI-marked relation". MEASURED 2026-09-07 on
#      the live catalog, for `public.set_item_validations`:
#         c2n.roots = 1 · c2n.gatefn = 1 · c2n.tier1 = 0 · reached from any
#         Tier-1 root = 0
#      and the harness itself, run as
#      `CASES="public.set_item_validations" bash …/c2-command-door-neutralizer.sh`,
#      exits **2**: *"=== DONE — swept 0 of 171 derived enforcer(s) === … *** ABORT:
#      swept ZERO enforcers. This is NOT a pass. CASES matched no derived enforcer."*
#      `form_item_validations` holds no PHI, which is exactly right and exactly why
#      C2's domain cannot take this door.
#
# ⚠ A DIFFERENT INSTRUMENT ALREADY COVERS THE SAME DOOR, and this file does not
#   replace it: `409` § 2.6f / § 2.10e are a two-polarity BEHAVIOURAL differential
#   (delete the `staff_admin -> commission.forms.edit` row from
#   `authz.role_permissions` and the door raises `42501`; grant present, the same
#   call succeeds), observed RED-FIRST on the un-migrated catalog. That is a GRANT
#   mutation. This file is a BODY mutation: it neutralizes the gate line itself and
#   asks whether anything in the suite notices. The two fail for different reasons
#   and neither implies the other.
#
# ── THE MUTATION ────────────────────────────────────────────────────────────
# An authority gate becomes unconditional-allow (`if not <authorizer>(…) then` ->
# `if false then`), so the GUARD stops firing while the function's EFFECT is left
# intact — the C2 design rule. ⛔ Stubbing the body would remove the work as well
# as the guard and the suite would then red because nothing happened: a FALSE
# COVERED.
#
# ── VERDICTS ────────────────────────────────────────────────────────────────
#   COVERED — the mutated run FAILS and the restored run PASSES (a keystone noticed)
#   BLIND   — the mutated run PASSES (nothing notices the guard vanish) -> exit 1
#   ERROR   — the mutation did not land, or the restore did not return the original
#             -> exit 1. ⛔ ERROR IS NOT A PASS.
#
# ⛔ ROLLBACK IS PROVEN BEFORE IT IS TRUSTED (the standing lesson, ADR 0189): each
# case asserts the mutation MOVED the subject's fingerprint and that the restore
# brought it back to the pre-mutation md5 EXACTLY. A mutation that did not fully
# apply reports GREEN, which is indistinguishable from a covered gate.
#
# USAGE:  bash supabase/tests/mutation/authz-command-door-targeted-cases.sh
#         CASES="public.set_item_validations" bash …      # subset (token = case subject)
# Exit 0 = every selected case COVERED. Exit 1 = BLIND or ERROR. Exit 2 = refused.
# ---------------------------------------------------------------------------
set -uo pipefail

DB="supabase_db_azkbbhskturikxpgmafq"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 2
CASES="${CASES:-}"

psql()  { docker exec -i "$DB" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -P pager=off "$@"; }
psqlt() { docker exec -i "$DB" psql -U postgres -d postgres -X -tA -P pager=off "$@"; }

fail() { echo "!! $*" >&2; exit 1; }

# A restore sentinel on the HOST, so a killed run is recoverable rather than silent.
SENTINEL="${TMPDIR:-/tmp}/authz-command-door-INFLIGHT.sql"

# Runs a pgTAP file, returns 0 if it PASSED, 1 if it FAILED.
run_suite() {
  local f="$1"
  npx supabase test db "$f" > "${TMPDIR:-/tmp}/authz-cmddoor-mut.$$" 2>&1
  grep -q "^Result: PASS" "${TMPDIR:-/tmp}/authz-cmddoor-mut.$$"
}

want () { [ -z "$CASES" ] && return 0; local k; for k in $CASES; do [ "$k" = "$1" ] && return 0; done; return 1; }

echo "==========================================================================="
echo "AUTHZ COMMAND-DOOR TARGETED MUTATION CASES"
echo "==========================================================================="
SELECTED=0; COVERED=0

# ===========================================================================
# CASE 1 — public.set_item_validations(uuid, jsonb), re-keyed at 20261003007350.
#   Subject: the ONE line that migration changed — the authority gate. If nothing
#   reds when it is forced to allow, the re-key moved a decision nothing measures.
#   Suite: 409, whose § 2.10e is the polarity that must raise 42501.
# ===========================================================================
SUBJ="public.set_item_validations"
SIG="public.set_item_validations(uuid,jsonb)"
SUITE="supabase/tests/409_ae49_d6_rekey_differential.sql"
ANCHOR='if not app.can_edit_commission_forms(v_commission, (select auth.uid())) then'

if want "$SUBJ"; then
SELECTED=$((SELECTED + 1))
echo
echo "--- CASE 1: $SIG — the authority gate neutralized ---"
echo "    suite: $SUITE"

BEFORE="$(psqlt -c "select md5(pg_get_functiondef('${SIG}'::regprocedure));")"
[ -n "$BEFORE" ] || fail "CASE 1: could not fingerprint the subject"
psqlt -c "select pg_get_functiondef('${SIG}'::regprocedure);" > "$SENTINEL"
[ -s "$SENTINEL" ] || fail "CASE 1: could not capture the restore body"
echo "    fingerprint before: $BEFORE   (restore body: $SENTINEL)"

# ⛔ THE ANCHOR MUST BE UNIQUE, or `replace` silently mutates more than the gate.
NANCHOR="$(psqlt -c "select count(*) from regexp_matches(pg_get_functiondef('${SIG}'::regprocedure), 'if not app\.can_edit_commission_forms\(v_commission, \(select auth\.uid\(\)\)\) then', 'g');")"
[ "$NANCHOR" = "1" ] || fail "CASE 1: the mutation anchor occurs $NANCHOR time(s), not once — refusing to mutate"

# ⛔ NOT the un-migrated catalog: the pre-cutover door gated on app.is_staff_admin_of,
#    and this case would then measure a gate the migration replaced.
# ⚠ The anchor is interpolated by the SHELL, not by a psql variable: psql performs NO
#   variable substitution inside a dollar-quoted body, so `:'ANCHOR'` would have travelled
#   into the DO block as four literal characters and `replace` would have matched nothing —
#   "a mutation that did not fully apply reports GREEN". Guarded on the quote it cannot carry.
case "$ANCHOR" in *"'"*) fail "CASE 1: the anchor contains a single quote — refusing to interpolate it" ;; esac
psql <<SQL || fail "CASE 1: mutation failed to apply"
do \$mut\$
declare src text;
begin
  select pg_get_functiondef('${SIG}'::regprocedure) into src;
  src := replace(src, '${ANCHOR}', 'if false then');
  execute src;
end;
\$mut\$;
SQL

MUT="$(psqlt -c "select md5(pg_get_functiondef('${SIG}'::regprocedure));")"
echo "    fingerprint mutated: $MUT"
[ "$MUT" != "$BEFORE" ] || fail "CASE 1: THE MUTATION DID NOT LAND (fingerprint unchanged) — a green here would prove nothing"
GONE="$(psqlt -c "select (pg_get_functiondef('${SIG}'::regprocedure) !~ 'can_edit_commission_forms')::text;")"
[ "$GONE" = "true" ] || fail "CASE 1: the authorizer is STILL called in the mutated body — the guard did not go"

if run_suite "$SUITE"; then VERDICT="BLIND"; else VERDICT="COVERED"; fi
echo "    409 under mutation: $([ "$VERDICT" = COVERED ] && echo 'RED (good)' || echo 'GREEN (BLIND)')"

# Restore, and prove the restore.
# ⛔ `-f -` WITH A HOST REDIRECT, NEVER `-f <path>`: psql runs INSIDE the container,
#    where a host path silently does not exist (the ae3 precedent's measured trap).
psql -f - < "$SENTINEL" >/dev/null || fail "CASE 1: RESTORE FAILED — the database is left MUTATED; restore by hand from $SENTINEL"
AFTER="$(psqlt -c "select md5(pg_get_functiondef('${SIG}'::regprocedure));")"
[ "$AFTER" = "$BEFORE" ] || fail "CASE 1: RESTORE DID NOT RETURN THE ORIGINAL (before=$BEFORE after=$AFTER) — $SENTINEL is kept"
echo "    fingerprint restored: $AFTER  (matches before)"
run_suite "$SUITE" || fail "CASE 1: 409 still RED after restore — the restore is incomplete"
echo "    409 after restore: GREEN"
rm -f "$SENTINEL"
echo "    CASE 1 VERDICT: $VERDICT"
[ "$VERDICT" = "COVERED" ] && COVERED=$((COVERED + 1))
fi

echo
echo "--------------------------------------------------------------------------------"
if [ "$SELECTED" = 0 ]; then
  echo "*** ABORT: no case selected (CASES=\"$CASES\"). This is NOT a pass."
  exit 2
fi
echo "=== RESULT: $COVERED of $SELECTED case(s) COVERED. ==="
echo "    DOMAIN: command doors outside BOTH p0-authz-door-audit.sh's PRED_DOMAIN (return"
echo "            type is not boolean) and c2-command-door-neutralizer.sh's worklist (the"
echo "            door is not Tier-1: its closure reaches no PHI-marked relation)."
[ "$COVERED" = "$SELECTED" ] || { echo "⛔ BLIND/ERROR is a finding, not a pass."; exit 1; }
exit 0
