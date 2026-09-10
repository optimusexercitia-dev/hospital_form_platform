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
#   COVERED — the mutated run FAILS and the restored run PASSES (a keystone noticed),
#             AND the failure set under mutation is EXACTLY the pinned assertion
#             (test 32, § 2.10e, by its description text — QA N-REC-1 below)
#   BLIND   — the mutated run PASSES (nothing notices the guard vanish) -> exit 1
#   ERROR   — the mutation did not land, the restore did not return the original, OR
#             the mutated run reds on something other than exactly the pinned
#             assertion (an unrelated flake, a fixture collision, a future assertion
#             in the same 75-assertion file — QA N-REC-1: an absent `Result: PASS`
#             alone is NOT sufficient for COVERED) -> exit 1. ⛔ ERROR IS NOT A PASS.
#
# ⛔ ROLLBACK IS PROVEN BEFORE IT IS TRUSTED (the standing lesson, ADR 0189): each
# case asserts the mutation MOVED the subject's fingerprint and that the restore
# brought it back to the pre-mutation md5 EXACTLY. A mutation that did not fully
# apply reports GREEN, which is indistinguishable from a covered gate.
#
# USAGE:  bash supabase/tests/mutation/authz-command-door-targeted-cases.sh
#         CASES="public.set_item_validations" bash …      # subset (token = case subject)
#         CASES="public.assume_role" · CASES="app.audit_write"
# ⚠ MEASURED, and it differs from `scripts/door-sweep-cases.sh`: HERE an empty/unset `CASES`
#   selects EVERY case (`want` returns 0 on `-z`), whereas the deriver treats an empty `CASES`
#   as a third state that selects NOTHING and exits 3. `unset CASES` is unambiguous in both.
#   The exit-2 abort below fires only when a NON-empty `CASES` matched no case.
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

# ⛔ QA N-REC-1: the log the mutated `run_suite` call writes to. Stable across the two
#   calls in CASE 1 (`$$` is this shell's own PID, not a subshell's), so it must be
#   READ right after the MUTATED call and before the RESTORE call's run_suite
#   overwrites it — which is exactly the order CASE 1 already runs in.
MUTLOG="${TMPDIR:-/tmp}/authz-cmddoor-mut.$$"

# Runs a pgTAP file into a NAMED log; returns 0 if it PASSED, 1 if it FAILED.
# ⛔ CASE 2 and CASE 3 run SEVERAL suites per mutation (a subject suite and a
#   discrimination suite), so each needs its OWN log: with one shared path the
#   discrimination run overwrites the evidence the pin is about to read, and the pin
#   would then be evaluated against the wrong file — a check that cannot fail.
run_suite_log() {
  local f="$1" log="$2"
  npx supabase test db "$f" > "$log" 2>&1
  grep -q "^Result: PASS" "$log"
}

# CASE 1's single-log contract, unchanged, expressed through the same primitive.
run_suite() { run_suite_log "$1" "$MUTLOG"; }

fp() { psqlt -c "select md5(pg_get_functiondef('${1}'::regprocedure));"; }

# ⛔ QA N-REC-1, GENERALIZED. "the suite went red" is NOT "the pinned cells noticed".
#   Asserts the mutated run's failure set is EXACTLY the pinned one: the COUNT first (an
#   extra red is an unrelated flake or a future assertion, and reading it as COVERED is
#   the exact false-positive N-REC-1 was filed for), then every pinned description by its
#   TEXT — so a renumbering fails LOUDLY instead of silently passing on the number alone.
#   `npx supabase test db` runs pg_prove NON-verbose: the per-assertion line is
#   `# Failed test N: "<description>"`, never a raw TAP `not ok`.
pin_failures() {
  local log="$1"; shift
  local want_n="$1"; shift
  local got_n; got_n="$(grep -c '^# Failed test ' "$log" || true)"
  if [ "$got_n" != "$want_n" ]; then
    echo "    !! failure set is $got_n assertion(s), not the $want_n pinned — see $log" >&2
    grep '^# Failed test ' "$log" | cut -c1-140 >&2
    return 1
  fi
  local needle
  for needle in "$@"; do
    if ! grep -qE "^# Failed test [0-9]+: \".*${needle}" "$log"; then
      echo "    !! a PINNED cell is not among the reds: /${needle}/ — see $log" >&2
      grep '^# Failed test ' "$log" | cut -c1-140 >&2
      return 1
    fi
  done
  return 0
}

# Restore from a sentinel and PROVE it against the CATALOG (ADR 0189 / the standing rule:
# a psql rc was never a restore — believe it only when `md5(pg_get_functiondef)` agrees).
restore_proven() {
  local sent="$1" sig="$2" before="$3" tag="$4"
  psql -f - < "$sent" >/dev/null || fail "$tag: RESTORE FAILED — the database is left MUTATED; restore by hand from $sent"
  local after; after="$(fp "$sig")"
  [ "$after" = "$before" ] || fail "$tag: RESTORE DID NOT RETURN THE ORIGINAL (before=$before after=$after) — $sent is kept"
  echo "    $tag: fingerprint restored: $after  (matches before)"
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

# ⛔ QA N-REC-1: "409 went red" is not the same claim as "the door's own assertion
#   noticed". Any red in this 75-assertion file — an unrelated flake, a fixture
#   collision, a future assertion — would read as COVERED under the bare rc check
#   above. Pin the mutated run's failure set to EXACTLY the behavioural assertion
#   this case exists to move: test 32, § 2.10e, keyed on its DESCRIPTION TEXT, not
#   only the number, so a renumbering fails LOUDLY as ERROR rather than silently
#   reading as COVERED. `npx supabase test db` runs `pg_prove` NON-verbose, so the
#   per-assertion line is `# Failed test N: "<description>"` (prove's summary
#   format), never a raw TAP `not ok` line — measured directly, 2026-09-07.
PIN='2\.10e .* THE GATE LINE AT THE DEFINER DOOR'
if [ "$VERDICT" = "COVERED" ]; then
  NOTOK="$(grep -c '^# Failed test ' "$MUTLOG" || true)"
  if [ "$NOTOK" != "1" ]; then
    VERDICT="ERROR"
    echo "    !! CASE 1: mutated run failed $NOTOK assertion(s), not exactly the ONE pinned" >&2
    echo "       (test 32, § 2.10e) — a red suite is not \"the pinned assertion noticed\"." >&2
    echo "       See $MUTLOG" >&2
  elif ! grep -qE "^# Failed test 32: \".*${PIN}" "$MUTLOG"; then
    VERDICT="ERROR"
    echo "    !! CASE 1: the one red assertion is NOT the pinned one (test 32, \"§ 2.10e" >&2
    echo "       … THE GATE LINE AT THE DEFINER DOOR\") — either 409 renumbered or reworded" >&2
    echo "       it (update PIN above) or a different assertion reds. See $MUTLOG" >&2
  else
    echo "    pin verified: $(grep '^# Failed test 32: ' "$MUTLOG" | cut -c1-100)…"
  fi
fi
echo "    409 under mutation: $([ "$VERDICT" = COVERED ] && echo 'RED (good, pinned)' || echo "$VERDICT")"

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

# ===========================================================================
# CASE 2 — public.assume_role(p_role platform_role), THE SEATING DOOR.
#   Two mutations, one per line that pre-AE5 Batch 10 (20261003007390) changed.
#
# ⛔ NOT A NEWCOMER, AND THAT IS PRECISELY WHY IT NEEDS THIS. The door kept its NAME
#   and changed its BODY twice: at 20261003007260 (ADR 0176 D7 — it began reading
#   `authz.roles.session_selectable`) and again at 20261003007390 (PO ruling R1 put
#   `app.is_active(v_uid)` DOOR-WIDE before any seating; R10 rewrote the audit stamp to
#   role-only). `ARM=census` cannot see either change — the name never moved. The backlog
#   entry for this door states the hazard in its own words: *a standing verdict transfers
#   silently to a body it was never measured against*. The keystone it names (`408 §§3-4`)
#   was measured against the …007260 body and says nothing about either line …007390 added.
#
# ⚠ ONE FUNCTION, MUTATED TWICE, RESTORED TWICE — never both lines at once. A combined
#   mutation could not tell WHICH keystone noticed WHICH line, and a single suite reddening
#   would read as covering both.
# ===========================================================================
SUBJ2="public.assume_role"
SIG2="public.assume_role(platform_role)"
S418="supabase/tests/418_admin_arm_is_active.sql"
S315="supabase/tests/315_act_stage3_hat_condition.sql"
S408="supabase/tests/408_ae49_assume_role_session_selectable.sql"
SENT2="${TMPDIR:-/tmp}/authz-command-door-INFLIGHT-assume-role.sql"
LOG2A="${TMPDIR:-/tmp}/authz-cmddoor-2a.$$"
LOG2AD="${TMPDIR:-/tmp}/authz-cmddoor-2a-disc.$$"
LOG2B="${TMPDIR:-/tmp}/authz-cmddoor-2b.$$"
LOG2BD="${TMPDIR:-/tmp}/authz-cmddoor-2b-disc.$$"

if want "$SUBJ2"; then
SELECTED=$((SELECTED + 1))
echo
echo "--- CASE 2: $SIG2 — the two lines 20261003007390 changed ---"
echo "    2a subject suite: $S418   discrimination: $S408"
echo "    2b subject suite: $S315   discrimination: $S418"

BEFORE2="$(fp "$SIG2")"
[ -n "$BEFORE2" ] || fail "CASE 2: could not fingerprint the subject"
psqlt -c "select pg_get_functiondef('${SIG2}'::regprocedure);" > "$SENT2"
[ -s "$SENT2" ] || fail "CASE 2: could not capture the restore body"
echo "    fingerprint before: $BEFORE2   (restore body: $SENT2)"

VERDICT2="COVERED"

# --- 2a: the DOOR-WIDE account-state gate (R1) neutralized -----------------
# `if not app.is_active(v_uid) then` -> `if false then`: the GUARD stops firing while the
# door's EFFECT (selectability check, holds check, seating, audit) is left whole — the C2
# design rule. Stubbing the body would remove the work as well and every suite would red
# because nothing happened: a FALSE COVERED.
A2A='if not app.is_active(v_uid) then'
case "$A2A" in *"'"*) fail "CASE 2: anchor 2a contains a single quote — refusing to interpolate it" ;; esac
N2A="$(psqlt -c "select count(*) from regexp_matches(pg_get_functiondef('${SIG2}'::regprocedure), 'if not app\.is_active\(v_uid\) then', 'g');")"
[ "$N2A" = "1" ] || fail "CASE 2/2a: the anchor occurs $N2A time(s), not once — refusing to mutate"
# ⛔ MEASURED, not assumed: `is_active` occurs EXACTLY ONCE in the whole definition — the
#   gate line, never a comment — so the post-mutation `!~ 'is_active'` below is an exact
#   check on the CALL and not a `prosrc` regex that a comment could satisfy.
NTXT="$(psqlt -c "select count(*) from regexp_matches(pg_get_functiondef('${SIG2}'::regprocedure), 'is_active', 'g');")"
[ "$NTXT" = "1" ] || fail "CASE 2/2a: 'is_active' occurs $NTXT time(s) in the definition, not once — the removal check would be ambiguous"

psql <<SQL || fail "CASE 2/2a: mutation failed to apply"
do \$mut\$
declare src text;
begin
  select pg_get_functiondef('${SIG2}'::regprocedure) into src;
  src := replace(src, '${A2A}', 'if false then');
  execute src;
end;
\$mut\$;
SQL

MUT2A="$(fp "$SIG2")"
[ "$MUT2A" != "$BEFORE2" ] || fail "CASE 2/2a: THE MUTATION DID NOT LAND (fingerprint unchanged) — a green here would prove nothing"
GONE2A="$(psqlt -c "select (pg_get_functiondef('${SIG2}'::regprocedure) !~ 'is_active')::text;")"
[ "$GONE2A" = "true" ] || fail "CASE 2/2a: the state gate is STILL in the mutated body — the guard did not go"
echo "    2a fingerprint mutated: $MUT2A  (is_active gate gone)"

if run_suite_log "$S418" "$LOG2A"; then
  VERDICT2="BLIND"
  echo "    !! CASE 2/2a: 418 PASSED with the DOOR-WIDE state gate neutralized — nothing notices it." >&2
else
  # The five cells the gate exists for: both denial polarities at the platform tier, the
  # two "a refusal leaves nothing behind" cells, and the TENANT-tier cell the widening owes.
  if pin_failures "$LOG2A" 5 \
       '3\.1 .* THE SEATING DOOR, DEACTIVATED' \
       '3\.2 .* THE SEATING DOOR, SUSPENDED' \
       '3\.4 .* NO SEATING FOR THE DENIED SESSION' \
       '3\.5 .* AND NO AUDIT ROW FOR IT' \
       '3\.8 .* THE DECLARED WIDENING'; then
    echo "    2a: 418 RED on exactly the five pinned §3 cells (3.1 3.2 3.4 3.5 3.8)"
  else
    VERDICT2="ERROR"
  fi
fi

# ⛔ THE DISCRIMINATION HALF, and it is not decoration. A mutation that broke the door
#   OUTRIGHT would also red 418's denial cells — "everyone is refused" satisfies a denial
#   assertion exactly as well as "the deactivated are refused". 408 §§2-4 exercise the
#   SIBLING gate (`session_selectable`) in the SAME body and its baseline "each subject can
#   select its own role TODAY" cells: they must stay GREEN, which is the claim that 2a
#   removed ONE line and left the door working.
if run_suite_log "$S408" "$LOG2AD"; then
  echo "    2a discrimination: 408 GREEN under the mutation (the sibling gate still decides)"
else
  VERDICT2="ERROR"
  echo "    !! CASE 2/2a: 408 also RED — the mutation did not remove ONE line, it broke the door." >&2
  echo "       A denial cell satisfied by a door that refuses everyone proves nothing. See $LOG2AD" >&2
fi

restore_proven "$SENT2" "$SIG2" "$BEFORE2" "CASE 2/2a"
# ⛔ `.after`, NEVER the mutated log: the post-restore run is what OVERWRITES the evidence
#   the pin was computed from, and a witness quoted from a clobbered file is a witness about
#   the wrong run. The mutated logs are what the session record quotes file:line from.
run_suite_log "$S418" "${LOG2A}.after" || fail "CASE 2/2a: 418 still RED after restore — the restore is incomplete"
echo "    2a: 418 after restore: GREEN   (mutated-run evidence kept at $LOG2A)"

# --- 2b: the pre-R10 membership scope triple put BACK into the audit call ---
# R10 (ADR 0201 D2) rewrote `app.audit_write(…, v_commission, …, v_org, v_hospital)` to
# `null::uuid` in all three places. The mutation is the REVERT: if nothing reds, R10 changed
# a stamp that no keystone measures and the rewritten `315` cells are decoration.
A2B1='v_session_id, null::uuid,'
A2B2='null::uuid, null::uuid'
case "$A2B1$A2B2" in *"'"*) fail "CASE 2: an anchor 2b contains a single quote — refusing to interpolate it" ;; esac
N2B1="$(psqlt -c "select count(*) from regexp_matches(pg_get_functiondef('${SIG2}'::regprocedure), 'v_session_id, null::uuid,', 'g');")"
N2B2="$(psqlt -c "select count(*) from regexp_matches(pg_get_functiondef('${SIG2}'::regprocedure), 'null::uuid, null::uuid', 'g');")"
[ "$N2B1" = "1" ] || fail "CASE 2/2b: the p_commission anchor occurs $N2B1 time(s), not once — refusing to mutate"
[ "$N2B2" = "1" ] || fail "CASE 2/2b: the p_organization/p_hospital anchor occurs $N2B2 time(s), not once — refusing to mutate"

psql <<SQL || fail "CASE 2/2b: mutation failed to apply"
do \$mut\$
declare src text;
begin
  select pg_get_functiondef('${SIG2}'::regprocedure) into src;
  src := replace(src, '${A2B1}', 'v_session_id, v_commission,');
  src := replace(src, '${A2B2}', 'v_org, v_hospital');
  execute src;
end;
\$mut\$;
SQL

MUT2B="$(fp "$SIG2")"
[ "$MUT2B" != "$BEFORE2" ] || fail "CASE 2/2b: THE MUTATION DID NOT LAND (fingerprint unchanged)"
LANDED2B="$(psqlt -c "select (pg_get_functiondef('${SIG2}'::regprocedure) ~ 'v_session_id, v_commission,'
                         and pg_get_functiondef('${SIG2}'::regprocedure) ~ 'v_org, v_hospital'
                         and pg_get_functiondef('${SIG2}'::regprocedure) !~ 'null::uuid')::text;")"
[ "$LANDED2B" = "true" ] || fail "CASE 2/2b: the pre-R10 scope triple is not fully back in the mutated body"
echo "    2b fingerprint mutated: $MUT2B  (pre-R10 scope triple restored into the audit call)"

if run_suite_log "$S315" "$LOG2B"; then
  VERDICT2="BLIND"
  echo "    !! CASE 2/2b: 315 PASSED with the pre-R10 scope stamp back — R10 is measured by nothing." >&2
else
  # The two REWRITTEN cells, one per tier that actually reaches a membership branch. The
  # platform tier stamps NULL either way (no tenant to put back), so it is NOT pinned here.
  if pin_failures "$LOG2B" 2 \
       'assume_role audit \(org-tier\) .* ALL THREE scope columns are NULL' \
       'assume_role audit \(commission-tier\) .* ALL THREE scope columns are NULL at the DEEPEST tier'; then
    echo "    2b: 315 RED on exactly the two rewritten R10 NULL-triple cells (org + commission tier)"
  else
    VERDICT2="ERROR"
  fi
fi

# ⛔ DISCRIMINATION FOR 2b, and it is the CROSS-CHECK that makes the two mutations
#   independent: 2a reds 418 and leaves 408 green; 2b must red 315 and leave 418 green.
#   If 418 also reddened here, 2b would have moved the SEATING decision rather than the
#   audit stamp, and "315 noticed" would be a claim about the wrong line.
if run_suite_log "$S418" "$LOG2BD"; then
  echo "    2b discrimination: 418 GREEN under the mutation (the seating decision is unmoved)"
else
  VERDICT2="ERROR"
  echo "    !! CASE 2/2b: 418 also RED — the scope revert moved the seating decision too. See $LOG2BD" >&2
fi

restore_proven "$SENT2" "$SIG2" "$BEFORE2" "CASE 2/2b"
# ⛔ NO MUTATION RESIDUE, ENUMERATED rather than inferred: the md5 above already proves it,
#   and this states WHICH three marks are back so a reader need not take the hash on faith.
RESID2="$(psqlt -c "select (pg_get_functiondef('${SIG2}'::regprocedure) ~ 'if not app\.is_active\(v_uid\) then'
                        and pg_get_functiondef('${SIG2}'::regprocedure) ~ 'null::uuid, null::uuid'
                        and pg_get_functiondef('${SIG2}'::regprocedure) ~ 'perform app\.audit_write\(')::text;")"
[ "$RESID2" = "true" ] || fail "CASE 2: RESIDUE — the restored body is missing one of the three original marks"
echo "    2b: no mutation residue (state gate, null::uuid pair and the audit call all back)"
run_suite_log "$S315" "${LOG2B}.after" || fail "CASE 2/2b: 315 still RED after restore — the restore is incomplete"
echo "    2b: 315 after restore: GREEN   (mutated-run evidence kept at $LOG2B)"
rm -f "$SENT2"
echo "    CASE 2 VERDICT: $VERDICT2"
[ "$VERDICT2" = "COVERED" ] && COVERED=$((COVERED + 1))
fi

# ===========================================================================
# CASE 3 — app.audit_write(...): THE CALL CHANGED, THE DOOR DID NOT.
#
# ⭐ THE RULING THIS CASE CARRIES, and it is carried AS A MEASURED CASE, never as an
#   allowlist line: `app.audit_write` is an append-only audit SINK (Architecture Rule 11),
#   not an authorization decision. `scripts/door-sweep-cases.sh` lifted it out of the
#   20261003007390 diff BY NAME because `public.assume_role`'s CALL to it changed (R10:
#   three `null::uuid` scope arguments). The CALL is what this case mutates.
#
# ⛔ "the migration did not touch it" IS ITSELF AN ASSERTION, so it is measured two ways
#   below and neither is taken on trust:
#     (1) the migration file defines it ZERO times — with the discrimination half that the
#         file DOES mention the name, so the zero cannot be "this grep can find nothing";
#     (2) the LIVE definition's md5 is PINNED. When a future migration moves the body this
#         case ERRORs, and the ruling above must be re-taken against the new body rather
#         than transferring to it silently — which is the failure mode the backlog entry
#         for `assume_role` names in its own words.
# ===========================================================================
SUBJ3="app.audit_write"
SIG3="app.audit_write(text,text,uuid,uuid,text,jsonb,uuid,uuid)"
MIG3="supabase/migrations/20261003007390_admin_arm_follows_account_state.sql"
AW_MD5="3b069ecb1a1c51b340a127f7a7dcd105"
SENT3="${TMPDIR:-/tmp}/authz-command-door-INFLIGHT-audit-call.sql"
LOG3="${TMPDIR:-/tmp}/authz-cmddoor-3.$$"
LOG3D="${TMPDIR:-/tmp}/authz-cmddoor-3-disc.$$"

if want "$SUBJ3"; then
SELECTED=$((SELECTED + 1))
echo
echo "--- CASE 3: $SUBJ3 — the CALL changed, the door did not ---"
echo "    subject suite: $S315   discrimination: $S408"

[ -f "$MIG3" ] || fail "CASE 3: $MIG3 not found — the two proofs below would be vacuous"
NDEF="$(grep -c "function app\.audit_write" "$MIG3" || true)"
NMENTION="$(grep -c "app\.audit_write" "$MIG3" || true)"
[ "$NDEF" = "0" ] || fail "CASE 3: the migration DOES define app.audit_write ($NDEF site(s)) — the ruling in this header is wrong and must be re-taken"
[ "$NMENTION" != "0" ] || fail "CASE 3: the migration never mentions app.audit_write at all — a grep that can find NOTHING cannot witness a zero"
echo "    proof 1: $MIG3 defines app.audit_write 0 time(s) and mentions it $NMENTION time(s) (the zero is a finding, not a blind grep)"

AW_NOW="$(fp "$SIG3")"
[ "$AW_NOW" = "$AW_MD5" ] || fail "CASE 3: the SINK's live definition moved (pinned=$AW_MD5 live=$AW_NOW) — re-take the ruling in this header against the new body, then re-pin"
echo "    proof 2: md5(pg_get_functiondef('$SIG3')) = $AW_NOW (pinned)"

BEFORE3="$(fp "$SIG2")"
[ -n "$BEFORE3" ] || fail "CASE 3: could not fingerprint the CALLER"
psqlt -c "select pg_get_functiondef('${SIG2}'::regprocedure);" > "$SENT3"
[ -s "$SENT3" ] || fail "CASE 3: could not capture the restore body"
echo "    caller fingerprint before: $BEFORE3   (restore body: $SENT3)"

VERDICT3="COVERED"

# THE MUTATION: the whole `perform app.audit_write(...);` statement becomes the plpgsql
# no-op `null;`. ⛔ The rest of the body — every gate, the seating upsert — is untouched,
# so what disappears is the AUDIT ROW alone and nothing else.
N3="$(psqlt -c "select count(*) from regexp_matches(pg_get_functiondef('${SIG2}'::regprocedure), 'perform app\.audit_write\(', 'g');")"
[ "$N3" = "1" ] || fail "CASE 3: the call occurs $N3 time(s) in assume_role, not once — refusing to mutate"

psql <<SQL || fail "CASE 3: mutation failed to apply"
do \$mut\$
declare src text;
begin
  select pg_get_functiondef('${SIG2}'::regprocedure) into src;
  src := regexp_replace(src, 'perform app\.audit_write\(.*?\);', 'null;');
  execute src;
end;
\$mut\$;
SQL

MUT3="$(fp "$SIG2")"
[ "$MUT3" != "$BEFORE3" ] || fail "CASE 3: THE MUTATION DID NOT LAND (fingerprint unchanged)"
GONE3="$(psqlt -c "select (position('app.audit_write(' in pg_get_functiondef('${SIG2}'::regprocedure)) = 0)::text;")"
[ "$GONE3" = "true" ] || fail "CASE 3: assume_role STILL calls app.audit_write — the call did not go"
SEAT3="$(psqlt -c "select (pg_get_functiondef('${SIG2}'::regprocedure) ~ 'insert into app.active_role_selections')::text;")"
[ "$SEAT3" = "true" ] || fail "CASE 3: the seating upsert went with the call — that is a stub, not a targeted mutation"
# ⛔ THE RESIDUE DETECTOR IS PROVEN ABLE TO FIRE, HERE, BEFORE IT IS TRUSTED BELOW. The plant
#   is the whole statement replaced by the plpgsql no-op, so its signature is the LINE
#   `\n  null;\n`. ⚠ The looser needle `null;` was MEASURED to be useless: the body already
#   contains `v_holds := v_org is not null or … is not null;`, so a `!~ 'null;'` residue check
#   can never pass — a check that cannot succeed is as blind as one that cannot fail.
PLANT3="$(psqlt -c "select (position(chr(10) || '  null;' || chr(10) in pg_get_functiondef('${SIG2}'::regprocedure)) > 0)::text;")"
[ "$PLANT3" = "true" ] || fail "CASE 3: the plant signature is not visible in the MUTATED body — the residue check below would be vacuous"
echo "    caller fingerprint mutated: $MUT3  (audit call gone, seating upsert intact, plant signature visible)"

if run_suite_log "$S315" "$LOG3"; then
  VERDICT3="BLIND"
  echo "    !! CASE 3: 315 PASSED with the audit call DELETED — the R10 stamp is measured by nothing." >&2
else
  # Every cell that reads the `active_role.assumed` row, across all three tiers: the D8
  # existence cell, the cardinality cell, and each tier's NULL-triple + its discrimination
  # twin. The twins are the cells the brief names — "the row still carries role + actor" —
  # and they are exactly the ones that CANNOT be satisfied by a row that was never written.
  # ⚠ EIGHT IS MEASURED, NOT DERIVED. The builder's derivation said seven and omitted the D8
  #   existence cell (`315` test 9); the exact-count pin is what caught it, which is the
  #   whole reason the count is pinned instead of "at least the ones I listed".
  if pin_failures "$LOG3" 8 \
       'assume_role: the switch itself is audited' \
       'exactly one active_role.assumed row per session' \
       'assume_role audit \(org-tier\) .* ALL THREE scope columns are NULL' \
       'assume_role audit \(org-tier\) .* THE DISCRIMINATION HALF' \
       'assume_role audit \(commission-tier\) .* ALL THREE scope columns are NULL' \
       'assume_role audit \(commission-tier\) .* ITS OWN DISCRIMINATION HALF' \
       'assume_role audit \(platform tier\) .* the GENERAL RULE' \
       'assume_role audit \(platform tier\) .* THE TWIN THE MESSAGE ABOVE PROMISES'; then
    echo "    3: 315 RED on exactly the eight pinned audit-row cells (3 tiers x NULL-triple+twin, plus the D8 existence and cardinality cells)"
  else
    VERDICT3="ERROR"
  fi
fi

# ⛔ DISCRIMINATION: 408 must stay GREEN. It exercises the door's AUTHORIZATION behaviour
#   (session_selectable, the fail-closed branch, the three baselines) and asserts nothing
#   about the audit row. Green here is the claim that deleting the SINK CALL removed the
#   audit and left every decision the door makes exactly where it was — which is what makes
#   "the call changed, the door did not" a measurement rather than a reading of the diff.
if run_suite_log "$S408" "$LOG3D"; then
  echo "    3 discrimination: 408 GREEN with the audit call deleted (no decision moved)"
else
  VERDICT3="ERROR"
  echo "    !! CASE 3: 408 also RED — deleting the call moved an authorization decision. See $LOG3D" >&2
fi

restore_proven "$SENT3" "$SIG2" "$BEFORE3" "CASE 3"
RESID3="$(psqlt -c "select (pg_get_functiondef('${SIG2}'::regprocedure) ~ 'perform app\.audit_write\('
                        and position(chr(10) || '  null;' || chr(10) in pg_get_functiondef('${SIG2}'::regprocedure)) = 0)::text;")"
[ "$RESID3" = "true" ] || fail "CASE 3: RESIDUE — the audit call is not back, or the no-op plant survived"
echo "    3: no mutation residue (the audit call is back; the plant signature the mutated body carried is gone)"
AW_AFTER="$(fp "$SIG3")"
[ "$AW_AFTER" = "$AW_MD5" ] || fail "CASE 3: the SINK moved during the case (now $AW_AFTER) — it was never the mutation's subject"
echo "    3: the SINK's own md5 unmoved across the case: $AW_AFTER"
run_suite_log "$S315" "${LOG3}.after" || fail "CASE 3: 315 still RED after restore — the restore is incomplete"
echo "    3: 315 after restore: GREEN   (mutated-run evidence kept at $LOG3)"
rm -f "$SENT3"
echo "    CASE 3 VERDICT: $VERDICT3"
[ "$VERDICT3" = "COVERED" ] && COVERED=$((COVERED + 1))
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
echo "            CASE 2 and CASE 3 are the 20261003007390 discharge: the deriver named"
echo "            assume_role and audit_write as \"prosecdef, returns void — outside"
echo "            PRED_DOMAIN\", each owing a TARGETED case. CASE 3's subject is the CALL,"
echo "            because the SINK it names was measured to be unchanged, not assumed to be."
[ "$COVERED" = "$SELECTED" ] || { echo "⛔ BLIND/ERROR is a finding, not a pass."; exit 1; }
exit 0
