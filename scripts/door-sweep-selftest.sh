#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SELF-TEST for scripts/door-sweep-cases.sh, scripts/lib/merge-findings-baseline.sh AND the
# STARTUP CAPTURE inside the four p0-authz-*-audit.sh sweeps.
# Entry point:
#
#     SELFTEST=1 bash scripts/door-sweep-cases.sh
#
# ⛔ NOT a `npm run lint` gate. It needs a throwaway repo under $TMPDIR and, for most
# scenarios, the local stack — lint must stay runnable with the stack down. It belongs in
# Phase Gate step 1 beside the four authz arms.
#
# ── WHAT IT DOES ────────────────────────────────────────────────────────────────────
# Builds a throwaway `git init` repo under $TMPDIR holding `cmp`-verified COPIES of the
# real deriver and the two audit harnesses, drops ONE COMMITTED FIXTURE from
# scripts/fixtures/door-sweep/ into it as an untracked migration, runs the REAL script,
# and asserts the BARE exit code and stdout/stderr. ⛔ Nothing is ever written into
# supabase/migrations/, and the only database access is the read-only catalog query the
# deriver itself makes.
#
# ⛔ WHY THE COPIES ARE `cmp`-CHECKED. A stale copy passes silently and the run reads as
# evidence about code nobody ran (scripts/gate-harness/build-fake-repo.sh's precedent).
#
# The MERGE scenarios need neither the fake repo nor the catalog — the helper is pure text.
# They run the REAL helper over COMMITTED input pairs under fixtures/door-sweep/merge/.
#
# ⛔ THE VACUITY GUARD. Four deriver scenarios pin the PRE-FIX behaviour as ABSENT — a token
# that must NOT be derived, a block that must NOT be printed. A suite that only asserts what
# the fix produces goes green again the moment the fix is reverted AND the assertion is
# relaxed with it; a suite that pins the old behaviour's absence flips on the revert alone.
#
# ⛔ AND FOR THE MERGE, THE SAME PROPERTY WITHOUT A KNOB. Three scenarios put the output the
# PRE-FIX helper ACTUALLY PRODUCED (frozen under merge/*.prefix-output.md, built from
# `git show de955981:scripts/lib/merge-findings-baseline.sh`) in front of the current
# verifier and require exit 2. Those are three real, measured losses of hand-authored
# material from the committed baselines; a verifier that passes them is proven blind, not
# assumed sharp. LESSONS: "a detector that finds nothing must be proven able to find
# something" — and the pre-fix verifier was blind because its INPUT SET, not its logic,
# excluded the region the losses happened in.
#
# ⚠ SKIPS ARE COUNTED AND LOUD. Most scenarios need the live catalog. With the stack down
# they SKIP, and the summary prints how many — a "PASS" over zero catalog scenarios must
# not look like a pass over all of them.
#
# ── EXIT CODES ──────────────────────────────────────────────────────────────────────
#   0  every scenario that RAN passed
#   1  at least one scenario FAILED
#   2  the harness could not run (fixtures missing, fake repo could not be built)
# ---------------------------------------------------------------------------
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
FIX="$ROOT/scripts/fixtures/door-sweep"
DERIVER="$ROOT/scripts/door-sweep-cases.sh"
AUDIT="$ROOT/supabase/tests/mutation/p0-authz-door-audit.sh"
WRITE_AUDIT="$ROOT/supabase/tests/mutation/p0-authz-writepath-audit.sh"
# ⚠ These two are NOT copied into the fake repo — the deriver never reads them. They are here
# only for the startup-capture group, which runs the REAL files in place.
ROW_AUDIT="$ROOT/supabase/tests/mutation/p0-authz-rowdoor-audit.sh"
INV_AUDIT="$ROOT/supabase/tests/mutation/p0-authz-invoker-audit.sh"
DB="${DOOR_SWEEP_DB:-supabase_db_azkbbhskturikxpgmafq}"

T="${TMPDIR:-/tmp}/door-sweep-selftest.$$"
mkdir -p "$T" || { echo "FATAL: cannot create $T" >&2; exit 2; }
trap 'rm -rf "$T"' EXIT

[ -d "$FIX" ] || { echo "FATAL: fixtures not found: $FIX" >&2; exit 2; }
for f in "$DERIVER" "$AUDIT" "$WRITE_AUDIT"; do
  [ -f "$f" ] || { echo "FATAL: not found: $f" >&2; exit 2; }
done

PASS=0; FAIL=0; SKIP=0
FAILED_NAMES=""; SKIPPED_NAMES=""

CATALOG=0
if command -v docker >/dev/null 2>&1 \
   && docker exec "$DB" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  CATALOG=1
fi

build_repo () {   # $1 = target dir
  local t="$1"
  rm -rf "$t"
  mkdir -p "$t/scripts" "$t/supabase/migrations" "$t/supabase/tests/mutation" || return 1
  cp "$DERIVER" "$t/scripts/door-sweep-cases.sh" || return 1
  cp "$AUDIT" "$t/supabase/tests/mutation/" || return 1
  cp "$WRITE_AUDIT" "$t/supabase/tests/mutation/" || return 1
  # ⛔ a stale copy must not be able to pass
  cmp -s "$DERIVER" "$t/scripts/door-sweep-cases.sh" || { echo "  FATAL: deriver copy differs"; return 1; }
  cmp -s "$AUDIT" "$t/supabase/tests/mutation/$(basename "$AUDIT")" || { echo "  FATAL: audit copy differs"; return 1; }
  cmp -s "$WRITE_AUDIT" "$t/supabase/tests/mutation/$(basename "$WRITE_AUDIT")" || { echo "  FATAL: writepath copy differs"; return 1; }
  ( cd "$t" && git init -q . && git config user.email s@s && git config user.name s \
      && git add -A scripts supabase && git commit -q -m base ) >/dev/null 2>&1 || return 1
  return 0
}

# run <name> <need_catalog 0|1> <expected_rc> <env assignments> -- <fixture...>
#   then assert with ok_out / no_out / ok_err / no_err against $OUT and $ERR.
# ⚠ Point OUT/ERR at real (empty) files from the start: an `assert` is evaluated even for a
#   SKIPPED scenario (command substitution runs before the function does), and grepping ""
#   printed "No such file" noise on every skip.
OUT="$T/out"; ERR="$T/err"; RC=""
: > "$OUT"; : > "$ERR"
SCEN=""
scenario () {  # $1 name, $2 need_catalog, $3 expected rc, rest: env=val ... -- fixtures...
  SCEN="$1"; local need="$2" want="$3"; shift 3
  local envs="" fixtures="" seen=0
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--" ]; then seen=1; shift; continue; fi
    if [ "$seen" = 0 ]; then envs="$envs $1"; else fixtures="$fixtures $1"; fi
    shift
  done
  if [ "$need" = 1 ] && [ "$CATALOG" = 0 ]; then
    SKIP=$((SKIP + 1)); SKIPPED_NAMES="$SKIPPED_NAMES $SCEN"
    printf 'SKIP  %-44s (no live catalog)\n' "$SCEN"
    SCEN=""; return 0
  fi
  local d="$T/repo"
  build_repo "$d" || { FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"; printf 'FAIL  %-44s (fake repo could not be built)\n' "$SCEN"; SCEN=""; return 0; }
  local fx
  for fx in $fixtures; do
    [ -f "$FIX/$fx" ] || { FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"; printf 'FAIL  %-44s (missing fixture %s)\n' "$SCEN" "$fx"; SCEN=""; return 0; }
    cp "$FIX/$fx" "$d/supabase/migrations/2099$(printf '%s' "$fx" | tr -c 'a-z0-9' '_').sql"
  done
  : > "$OUT"; : > "$ERR"
  # ⛔ SELFTEST=0 for the child, ALWAYS. The copied deriver would otherwise re-dispatch to a
  #    self-test script the fake repo does not contain and every scenario would report
  #    rc 127 — measured, the first time this file ran.
  ( cd "$d" && env SELFTEST=0 $envs bash scripts/door-sweep-cases.sh ) > "$OUT" 2> "$ERR"
  RC=$?
  if [ "$RC" != "$want" ]; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
    printf 'FAIL  %-44s expected rc %s, got rc %s\n' "$SCEN" "$want" "$RC"
    sed 's/^/        | /' "$ERR" | tail -12
    SCEN=""; return 0
  fi
  return 0
}
assert () {  # $1 = human description, $2 = 0|1 condition already evaluated by the caller
  [ -n "$SCEN" ] || return 0
  if [ "$2" = 0 ]; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
    printf 'FAIL  %-44s %s\n' "$SCEN" "$1"
    SCEN=""
  fi
}
done_ok () {
  [ -n "$SCEN" ] || return 0
  PASS=$((PASS + 1)); printf 'PASS  %-44s (rc %s)\n' "$SCEN" "$RC"; SCEN=""
}
has_out () { grep -qw -- "$1" "$OUT"; }
has_err () { grep -qF -- "$1" "$ERR"; }

# ⛔ GROUP TOTALS ARE DERIVED, NEVER TYPED (FUP-WRITEPATH-BASELINE-HARDCODED-COUNTS-IN-
# HARNESS-BANNERS). docs/lead-playbook.md used to restate "the deriver's 16 scenarios and the
# merge helper's 18"; adding a group made that line stale the same day, which is the whole
# class. A group's size is now the number of scenarios that actually ran between two marks.
# ⛔ Re-typing a corrected literal does not close this — a new literal is the same defect with
# a newer number. Nothing here is a literal.
GRP=""; GP=0; GF=0; GS=0
group_start () { GRP="$1"; GP=$PASS; GF=$FAIL; GS=$SKIP; }
group_end () {
  local p=$((PASS - GP)) f=$((FAIL - GF)) k=$((SKIP - GS))
  printf -- '--- GROUP %-22s scenarios %s (pass %s · fail %s · skipped %s)\n' \
    "$GRP:" "$((p + f + k))" "$p" "$f" "$k"
  GRP=""
}

echo "=== DOOR-SWEEP DERIVER SELF-TEST ==="
echo "    fixtures : $FIX"
echo "    catalog  : $([ "$CATALOG" = 1 ] && echo "REACHABLE ($DB)" || echo "NOT reachable — catalog scenarios will SKIP")"
echo
group_start "deriver"

# ── 1. THE PROPERTY: a DEFINER door in the arm's domain, admitted by PRED_DOMAIN's own
#      named exception rather than by the `returns boolean` the old text filter demanded.
scenario "definer door IN domain -> CASES" 1 0 -- 01-definer-door-in-domain.sql
assert "assert_not_case_excluded not on stdout" "$(has_out assert_not_case_excluded && echo 1 || echo 0)"
done_ok

# ── 2. VACUITY PIN: the migration TEXT says `security definer`; the CATALOG says invoker.
#      The text must lose. If the catalog classification is reverted, this flips.
scenario "invoker (text lies) -> NOT a door" 1 1 -- 02-invoker-not-a-door.sql
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "expected NO DOORS AT ALL" "$(has_err 'NO DOORS AT ALL' && echo 1 || echo 0)"
assert "DOORS-NOT-SWEEPABLE block must be ABSENT" "$(has_err 'DOORS IDENTIFIED, NOT SWEEPABLE' && echo 0 || echo 1)"
done_ok

# ── 3. DISCRIMINATION for 2: a prosecdef door outside the domain IS identified.
scenario "definer trigger door -> identified, not swept" 1 1 -- 03-definer-trigger-door.sql
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "expected DOORS IDENTIFIED: 1" "$(has_err 'DOORS IDENTIFIED: 1' && echo 1 || echo 0)"
assert "expected the printed reason" "$(has_err 'returns trigger — outside PRED_DOMAIN' && echo 1 || echo 0)"
done_ok

# ── 4. ALTER FUNCTION … SECURITY DEFINER (ADR 0079 Amdt 8 ruling 1, one branch over).
scenario "alter function security definer -> CASES" 1 0 -- 04-alter-function-security-definer.sql
assert "can_read_professional_profile not on stdout" "$(has_out can_read_professional_profile && echo 1 || echo 0)"
assert "expected the ALTERED-BY block" "$(has_err "ALTERED BY 'alter function" && echo 1 || echo 0)"
done_ok

# ── 5. VACUITY PIN: `owner to postgres` must match NOTHING (449 of them in the baseline).
#      ⚠ Its assertions were all NEGATIVE until 2026-09-05 (QA F-REC-5): empty stdout, rc 1,
#      an absent block — every one of which a scenario whose fixture never reached the repo
#      would also satisfy. The two POSITIVE assertions make it stand on its own: the file
#      was SCANNED (it is named in the deriver's own file list) and the run reached the
#      no-doors FINDING rather than dying somewhere earlier.
scenario "alter function OWNER TO -> nothing" 1 1 -- 05-alter-function-owner-to.sql
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "ALTERED-BY block must be ABSENT" "$(has_err "ALTERED BY 'alter function" && echo 0 || echo 1)"
assert "the fixture must actually have been SCANNED" "$(has_err '05_alter_function_owner_to' && echo 1 || echo 0)"
assert "expected NO DOORS AT ALL" "$(has_err 'NO DOORS AT ALL' && echo 1 || echo 0)"
done_ok

# ── 6. The declaration path ALONE — no `create function`, no `pg_get_functiondef`.
scenario "marker continuations, declaration only" 1 0 -- 06-marker-continuations.sql
assert "has_permission not on stdout" "$(has_out has_permission && echo 1 || echo 0)"
assert "candidate_has_permission not classified" "$(has_err candidate_has_permission && echo 1 || echo 0)"
assert "explain_permission not classified" "$(has_err explain_permission && echo 1 || echo 0)"
assert "entailed_grants not classified" "$(has_err entailed_grants && echo 1 || echo 0)"
done_ok

# ── 7. VACUITY PIN: consume-or-stop. A token in prose AFTER a bare `--` is NOT a target.
scenario "marker then prose -> prose NOT consumed" 1 0 -- 07-marker-then-prose.sql
assert "has_permission not on stdout" "$(has_out has_permission && echo 1 || echo 0)"
assert "is_active must NOT be derived" "$(has_err is_active && echo 0 || echo 1)"
done_ok

# ── 8. A malformed continuation is NAMED, and the run continues.
scenario "marker parse error -> named, rc unchanged" 1 0 -- 08-marker-parse-error.sql
assert "expected the parse-error block" "$(has_err 'PARSE ERROR' && echo 1 || echo 0)"
assert "expected the named cause" "$(has_err 'schema prefix with no function name' && echo 1 || echo 0)"
assert "has_permission still derived" "$(has_out has_permission && echo 1 || echo 0)"
done_ok

# ── 8b. ⭐ QA F-MAJOR-3. A declaration WRAPPED MID-TOKEN: `app.` alone on one line, the
#      name it belongs to on the next. The bare prefix used to be read as a token-free `--`
#      line and TERMINATE the declaration, silently taking both well-formed continuations
#      after it, while the parse error advertised for exactly that input sat inside the
#      successful-harvest branch and could never fire on it. Three assertions and every one
#      of them flips on a revert: two tokens that could not be derived at all, and the named
#      error that could not be printed.
scenario "dangling schema prefix -> named, not silent" 1 0 -- 09-marker-dangling-prefix.sql
assert "is_admin derived (⚠ the pre-fix run got this one too)" "$(has_out is_admin && echo 1 || echo 0)"
assert "the token PAST the break was READ (UNRESOLVED, not silence)" "$(has_err 'is_commission_admin_of' && echo 1 || echo 0)"
assert "can_sign_section derived — two lines past the break" "$(has_out can_sign_section && echo 1 || echo 0)"
assert "the parse error must be NAMED, not silent" "$(has_err 'schema prefix with no function name' && echo 1 || echo 0)"
assert "expected the PARSE ERROR block" "$(has_err 'PARSE ERROR' && echo 1 || echo 0)"
done_ok

# ── 9. ⭐ THE ADR 0173 ARRAY-GATE PIN. One file builds an array; the other does not and
#      names `app.is_active(` only as a replacement literal. `is_active` must NOT be
#      derived. Revert the per-file gate and this fails without touching the assertion.
scenario "array gate is PER FILE (0173 pin)" 1 0 -- 10-array-rewrite.sql 11-marker-and-replacement-literal.sql
assert "can_manage_professional not on stdout" "$(has_out can_manage_professional && echo 1 || echo 0)"
assert "is_active must NOT be in CASES" "$(has_out is_active && echo 0 || echo 1)"
done_ok

# ── 10. Provenance and SCOPE — two increments in one tree.
scenario "two increments -> provenance per file" 1 0 -- 12-policy-increment-a.sql 13-policy-increment-b.sql
assert "expected a SCOPE: line" "$(has_err 'SCOPE:' && echo 1 || echo 0)"
assert "expected the PROVENANCE block" "$(has_err 'PROVENANCE — every DERIVED case' && echo 1 || echo 0)"
assert "forms_staff_admin_write not derived" "$(has_out forms_staff_admin_write && echo 1 || echo 0)"
assert "professional_profiles_select not derived" "$(has_out professional_profiles_select && echo 1 || echo 0)"
done_ok

# ── 11. NOT-APPLICABLE: a tree with no migration at all.
scenario "no migration in the diff -> rc 3" 0 3 --
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "expected NOT-APPLICABLE (3)" "$(has_err 'NOT-APPLICABLE (3)' && echo 1 || echo 0)"
done_ok

# ── 12. ABORT: an unusable ARM.
scenario "bad ARM -> rc 2" 0 2 ARM=sideways -- 01-definer-door-in-domain.sql
assert "expected the FATAL line" "$(has_err "ARM must be unset" && echo 1 || echo 0)"
done_ok

# ── 13. ABORT: the lifted PRED_DOMAIN keeps a variable this script cannot expand. The
#      doctored audit script is produced HERE from the real one, never committed — a
#      committed copy would drift from the domain it is supposed to mirror.
if [ -n "${SELFTEST_SKIP_DRIFT:-}" ]; then
  :
else
  sed "s/(p\.proname ~ .\$PRED_NAME_RE./(p.proname ~ '\$PRED_FUTURE_AXIS'/" "$AUDIT" > "$T/audit_drift.sh"
  if cmp -s "$AUDIT" "$T/audit_drift.sh"; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES PRED_DOMAIN-drift-fixture"
    echo "FAIL  PRED_DOMAIN drift fixture                    (the sed changed NOTHING — the domain moved; fix the selftest, do not skip it)"
  else
    scenario "PRED_DOMAIN lift drift -> rc 2" 0 2 "AUDIT_SRC=$T/audit_drift.sh" -- 01-definer-door-in-domain.sql
    assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
    assert "expected the ABORT (2) banner" "$(has_err 'ABORT (2) — PRED_DOMAIN LIFTED WITH AN UNEXPANDED VARIABLE' && echo 1 || echo 0)"
    done_ok
  fi
fi

# ── 14. VACUITY PIN for the catalog itself: with NO catalog the deriver must NOT go blind —
#      the pre-2026-09-05 TEXT heuristics stay the floor and a policy is still derived.
scenario "no catalog -> text floor still derives" 0 0 DOOR_SWEEP_DB=no_such_container_selftest -- 12-policy-increment-a.sql
assert "expected the provisional banner" "$(has_err 'NO LIVE CATALOG — PROVISIONAL DERIVATION' && echo 1 || echo 0)"
assert "the text heuristics must still be the floor" "$([ -s "$OUT" ] && echo 1 || echo 0)"
assert "forms_staff_admin_write not derived" "$(has_out forms_staff_admin_write && echo 1 || echo 0)"
done_ok

# ── 15. ⭐ THE HONEST BOUND, PINNED. The property fix is CATALOG-BASED, so with the stack
#      down `assert_not_case_excluded` is NOT derived — the text heuristics demand
#      `returns boolean` and it returns void. That is a rc 1 FINDING, and the run must SAY
#      the catalog was unreachable so nobody reads it as "this migration has no door".
#      ⛔ If this ever passes as rc 0, someone has re-typed the domain into this script.
scenario "no catalog -> the property is UNAVAILABLE, loudly" 0 1 DOOR_SWEEP_DB=no_such_container_selftest -- 01-definer-door-in-domain.sql
assert "expected the provisional banner" "$(has_err 'NO LIVE CATALOG — PROVISIONAL DERIVATION' && echo 1 || echo 0)"
assert "the FINDING must name the missing catalog" "$(has_err "'no door' has NOT been checked" && echo 1 || echo 0)"
done_ok

# ── 16. ⭐ THE DECLARE-AND-REPLACE CELL (2026-09-09, CAN-MANAGE-PROFESSIONAL-SELF-CHECK).
#      A migration that DECLARES its targets and also replaces them by name, with
#      `pg_get_functiondef` in its landing assertions. Both names land in `fn_sel_name`, so
#      the cross-file dedup subtracted the declaration away and FINDING (1) fired on the
#      RESIDUE — the deriver said "targets cannot be read" about the one file in the range
#      that spells them out twice, and exited before the catalog was probed.
#      ⛔ The banner assertion is the VACUITY PIN: it flips the moment the predicate goes
#      back to reading `$TMP/fn_rewrite`, with nothing else touched.
scenario "declared AND replaced by name -> CASES" 1 0 -- 14-declared-and-replaced-by-name.sql
assert "can_manage_professional not on stdout" "$(has_out can_manage_professional && echo 1 || echo 0)"
assert "can_read_professional_profile not on stdout" "$(has_out can_read_professional_profile && echo 1 || echo 0)"
assert "the fixture must actually have been SCANNED" "$(has_err '14_declared_and_replaced_by_name' && echo 1 || echo 0)"
assert "the rewrite FINDING must be ABSENT" "$(has_err 'TARGETS CANNOT BE READ' && echo 0 || echo 1)"
done_ok

# ── 17. NEGATIVE CONTROL for 16, and the reason the fix is not just a loosening: a rewrite
#      that declares NOTHING and builds no array (the 25-migration catalog-query class) is
#      still a FINDING, and now says WHICH file. Needs no catalog — the check fires first.
scenario "undeclared rewrite -> FINDING, file named" 0 1 -- 15-undeclared-catalog-query-rewrite.sql
assert "stdout should be empty" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
assert "expected the rewrite FINDING" "$(has_err 'TARGETS CANNOT BE READ' && echo 1 || echo 0)"
assert "expected the per-file count" "$(has_err '1 of 1 file(s) using the rewrite pattern' && echo 1 || echo 0)"
assert "the unread file must be NAMED" "$(has_err '15_undeclared_catalog_query_rewrite' && echo 1 || echo 0)"
done_ok

# ── 18. ATTRIBUTION: one declaring migration + one undeclared rewrite in the SAME range.
#      Exactly one of the two is unread, and the run must still stop. Pre-fix this exited 1
#      as well — but for the wrong reason (the residue was empty because of file 14), so the
#      `1 of 2` count, not the exit code, is what carries the property here.
scenario "declaring sibling does not answer for it" 0 1 -- 14-declared-and-replaced-by-name.sql 15-undeclared-catalog-query-rewrite.sql
assert "expected the per-file count 1 of 2" "$(has_err '1 of 2 file(s) using the rewrite pattern' && echo 1 || echo 0)"
assert "the unread file must be NAMED" "$(has_err '15_undeclared_catalog_query_rewrite' && echo 1 || echo 0)"
assert "nothing may be derived when the run stops" "$([ ! -s "$OUT" ] && echo 1 || echo 0)"
done_ok

# ── 19. ⭐ THE MASKED POLARITY, and it was a LIVE hole, not a hypothetical: the old predicate
#      read the UNION, so a marker-only declaring migration (11) made the aggregate non-empty
#      and the undeclared rewrite beside it passed SILENTLY. MEASURED pre-fix on a doctored
#      copy: rc 0 with `can_manage_professional` on stdout and no finding at all.
#      ⭐ "A mutation's effect can be MASKED by a legitimately-open arm."
scenario "declared sibling must not MASK an unread one" 0 1 -- 11-marker-and-replacement-literal.sql 15-undeclared-catalog-query-rewrite.sql
assert "expected the rewrite FINDING" "$(has_err 'TARGETS CANNOT BE READ' && echo 1 || echo 0)"
assert "expected the per-file count 1 of 2" "$(has_err '1 of 2 file(s) using the rewrite pattern' && echo 1 || echo 0)"
assert "the masked file must be NAMED" "$(has_err '15_undeclared_catalog_query_rewrite' && echo 1 || echo 0)"
assert "the sibling's case must NOT be derived" "$(has_out can_manage_professional && echo 0 || echo 1)"
done_ok

# ═══════════════════════════════════════════════════════════════════════════════════
# THE MERGE HELPER (QA F-MAJOR-4: "nothing tests the merge helper" — the component that
# WRITES the committed findings baselines had no committed test at all, and F-BLOCK-1 had
# already shown it broken in three ways).
#
# ⛔ THE DISCRIMINATION HALF IS NOT A KNOB. Three scenarios feed the verifier the output
# THE PRE-FIX HELPER ACTUALLY PRODUCED — frozen under merge/*.prefix-output.md, built by
# running `git show de955981:scripts/lib/merge-findings-baseline.sh` on the very same
# committed inputs — and require exit 2. Those are real historical losses, so a verifier
# that cannot see them is proven blind rather than assumed sharp. The `MERGE_FAULT`
# scenarios below are the cheaper second control.
#
# ⚠ These scenarios need NO catalog and NO fake repo: the helper is pure text.
# ═══════════════════════════════════════════════════════════════════════════════════
MERGE_LIB="$ROOT/scripts/lib/merge-findings-baseline.sh"
MFIX="$FIX/merge"
MOUT="$T/merged.md"; MERR="$T/merge.err"
[ -f "$MERGE_LIB" ] || { echo "FATAL: not found: $MERGE_LIB" >&2; exit 2; }
[ -d "$MFIX" ]      || { echo "FATAL: merge fixtures not found: $MFIX" >&2; exit 2; }

merge_scenario () {  # $1 name, $2 expected rc, $3 baseline, $4 generated, rest: env=val...
  SCEN="$1"; local want="$2" b="$MFIX/$3" g="$MFIX/$4"; shift 4
  local f
  for f in "$b" "$g"; do
    [ -f "$f" ] || { FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
                     printf 'FAIL  %-44s (missing fixture %s)\n' "$SCEN" "$f"; SCEN=""; return 0; }
  done
  rm -f "$MOUT"; : > "$MERR"
  env "$@" bash "$MERGE_LIB" "$b" "$g" "$MOUT" >/dev/null 2> "$MERR"
  RC=$?
  if [ "$RC" != "$want" ]; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
    printf 'FAIL  %-44s expected rc %s, got rc %s\n' "$SCEN" "$want" "$RC"
    sed 's/^/        | /' "$MERR" | cut -c1-140 | head -8
    SCEN=""; return 0
  fi
  return 0
}
m_out  () { grep -qF -- "$1" "$MOUT" 2>/dev/null; }             # substring, anywhere
m_line () { grep -qxF -- "$1" "$MOUT" 2>/dev/null; }            # a WHOLE line, byte-exact
m_err  () { grep -qF -- "$1" "$MERR" 2>/dev/null; }
fixline () { grep -F -m1 -- "$2" "$MFIX/$1"; }                  # pull a byte-exact fixture line

echo
group_end
echo "--- merge helper ---"
group_start "merge helper"

# ── 16. F-BLOCK-1 WITNESS A. A markdown-escaped `\|` inside a note truncated the row.
#      MEASURED on the pre-fix helper against the real committed rows: 727 B -> 579 B and
#      1106 B -> 570 B, at bare rc 0, reporting "PRESERVED … 2 hand suffix(es)".
merge_scenario "A: escaped pipe in a note survives" 0 A-escaped-pipe.baseline.md A-escaped-pipe.generated.md
assert "the is_signoff row must be byte-identical to the baseline" \
  "$(m_line "$(fixline A-escaped-pipe.baseline.md '| app.is_signoff_deferral_open')" && echo 1 || echo 0)"
assert "the can_manage row must be byte-identical to the baseline" \
  "$(m_line "$(fixline A-escaped-pipe.baseline.md '| app.can_manage_professional')" && echo 1 || echo 0)"
assert "the sentence AFTER the escaped pipe must survive" \
  "$(m_out 'RENAMED into the domain rather than backlogged' && echo 1 || echo 0)"
done_ok

# ── 17. ⭐ DISCRIMINATION for 16 — the pre-fix helper's OWN OUTPUT must FAIL this verifier.
merge_scenario "A: pre-fix output FAILS the verifier" 2 A-escaped-pipe.baseline.md A-escaped-pipe.generated.md \
  SELFTEST=1 "MERGE_VERIFY=$MFIX/A-escaped-pipe.prefix-output.md"
assert "the abort must name the lost suffix" "$(m_err 'SUFFIX:' && echo 1 || echo 0)"
assert "nothing may be written on an abort" "$([ ! -f "$MOUT" ] && echo 1 || echo 0)"
done_ok

# ── 18. F-BLOCK-1 WITNESS B. A hand-written 3-column table — header, delimiter and both
#      rows — was deleted whole, with NO carry and no warning (165 lines -> 161, rc 0).
merge_scenario "B: hand-written table survives whole" 0 B-hand-table.baseline.md B-hand-table.generated.md
assert "the hand table HEADER must survive" "$(m_line '| gate | evidence | reading |' && echo 1 || echo 0)"
assert "the hand table DELIMITER must survive" "$(m_line '| --- | --- | --- |' && echo 1 || echo 0)"
assert "the WALL (M7) reading must survive" "$(m_out 'WALL (M7): close_case refuses the tenancy admin on AUTHORITY' && echo 1 || echo 0)"
assert "the surrounding prose control must survive" "$(m_out 'The classifier cannot tell' && echo 1 || echo 0)"
done_ok

# ── 19. ⭐ DISCRIMINATION for 18.
merge_scenario "B: pre-fix output FAILS the verifier" 2 B-hand-table.baseline.md B-hand-table.generated.md \
  SELFTEST=1 "MERGE_VERIFY=$MFIX/B-hand-table.prefix-output.md"
assert "the abort must name the lost table header" "$(m_err 'PROSE: | gate | evidence | reading |' && echo 1 || echo 0)"
done_ok

# ── 20. F-BLOCK-1 WITNESS C. The baseline-only carry was gated on a NON-EMPTY note, so a
#      correctly-shaped hand row with an empty column 5 vanished — not in the table, not in
#      CARRIED, rc 0. It is now carried WHOLE, note or no note.
merge_scenario "C: hand row with an EMPTY note is carried" 0 C-empty-note-row.baseline.md C-empty-note-row.generated.md
assert "the EMPTY-note hand row must be carried verbatim" \
  "$(m_out '| app.handrow_empty_note(p_x uuid) | predicate | positive | COVERED |  |' && echo 1 || echo 0)"
assert "the noted hand row must be carried verbatim" \
  "$(m_out '| app.handrow_with_note(p_x uuid) | predicate | positive | COVERED | a hand note |' && echo 1 || echo 0)"
assert "a CARRIED block must exist" "$(m_out '<!-- CARRIED:' && echo 1 || echo 0)"
assert "⛔ a carried row must NOT re-enter a verdict table" \
  "$(m_line '| app.handrow_empty_note(p_x uuid) | predicate | positive | COVERED |  |' && echo 0 || echo 1)"
done_ok

# ── 21. ⭐ DISCRIMINATION for 20.
merge_scenario "C: pre-fix output FAILS the verifier" 2 C-empty-note-row.baseline.md C-empty-note-row.generated.md \
  SELFTEST=1 "MERGE_VERIFY=$MFIX/C-empty-note-row.prefix-output.md"
assert "the abort must name the lost row" "$(m_err 'CARRIED ROW: | app.handrow_empty_note' && echo 1 || echo 0)"
done_ok

# ── 22. ⭐ THE REAL GENERATOR'S OUTPUT (QA could-not-verify #2, settled by a 2-case door run
#      2026-09-05). Its file list is NOT a byte prefix of the committed note: one row differs
#      by a hand-added space after a comma (SPLICED, via `wsprefix`) and one by real content
#      — an annotation inside the list and two files added since (CARRIED WHOLE).
merge_scenario "D: real generator rows, splice vs carry" 0 D-real-generator.baseline.md D-real-generator.generated.md
assert "SPLICED: the refreshed file list, generator spacing" \
  "$(m_out '| 10_immutability.sql,367_deferred_staff_signoff.sql. ⭐ MEASURED by a diff-scoped run' && echo 1 || echo 0)"
assert "SPLICED: the hand tail survives byte-for-byte" \
  "$(m_out 'transcribed here because a subset run overwrites this file and is then reverted.' && echo 1 || echo 0)"
assert "CARRIED: the whole committed can_manage row, verbatim" \
  "$(m_out "$(fixline D-real-generator.baseline.md '| app.can_manage_professional')" && echo 1 || echo 0)"
assert "the generator's new file must reach the table" "$(m_out '413_ae4_authorized_scope_ids.sql' && echo 1 || echo 0)"
done_ok

# ── 23. The four row cases in one pair: unchanged · verdict changed · disappeared · new.
merge_scenario "E: unchanged/changed/disappeared/new" 0 E-four-row-cases.baseline.md E-four-row-cases.generated.md
assert "unchanged row passes through" "$(m_line '| app.unchanged_gate(p_x uuid) | predicate | positive | COVERED | 10_a.sql |' && echo 1 || echo 0)"
assert "newcomer is emitted" "$(m_line '| app.newcomer_gate(p_x uuid) | predicate | positive | BLIND |  |' && echo 1 || echo 0)"
assert "changed row takes the NEW verdict" "$(m_line '| app.verdict_changed(p_x uuid) | predicate | positive | COVERED | 12_c.sql |' && echo 1 || echo 0)"
assert "⛔ the note earned against BLIND must NOT ride the COVERED row" \
  "$(m_line '| app.verdict_changed(p_x uuid) | predicate | positive | COVERED | 12_c.sql. ⭐ a hand note earned against BLIND |' && echo 0 || echo 1)"
assert "the BLIND-era note is carried with its old verdict" "$(m_out '— BLIND -> COVERED — baseline row carried verbatim' && echo 1 || echo 0)"
assert "the disappeared gate leaves the table" "$(m_line '| app.disappeared_gate(p_x uuid) | predicate | positive | COVERED | 11_b.sql. ⚠ hand analysis |' && echo 0 || echo 1)"
assert "the disappeared gate's row is carried" "$(m_out '| app.disappeared_gate(p_x uuid) | predicate | positive | COVERED | 11_b.sql. ⚠ hand analysis |' && echo 1 || echo 0)"
done_ok

# ── 24. IDEMPOTENCE. merge(b, b) must be b, byte-for-byte, on EVERY fixture baseline — a
#      merge whose output depends on how many times it ran cannot be called after each case.
for mb in A-escaped-pipe B-hand-table C-empty-note-row D-real-generator E-four-row-cases; do
  merge_scenario "idempotent: $mb" 0 "$mb.baseline.md" "$mb.baseline.md"
  assert "merge(b,b) must be byte-identical to b" "$(cmp -s "$MFIX/$mb.baseline.md" "$MOUT" && echo 1 || echo 0)"
  done_ok
done

# ── 25. The knobs are REFUSED outside the self-test (QA F-MAJOR-4: no harness scrubbed
#      MERGE_FAULT, so an exported one would have injected into a run that WRITES the
#      committed baseline).
#      ⚠ SELFTEST=0 must be set EXPLICITLY. This suite runs with SELFTEST=1 in its own
#      environment, so the child inherits it and the knob is NOT refused — the run still
#      exits 2, for the unrelated "nothing to inject" reason, and an rc-only assertion
#      passes on the wrong cause. Measured: this scenario went green that way until the
#      message assertion below caught it.
merge_scenario "MERGE_FAULT refused when SELFTEST!=1" 2 E-four-row-cases.baseline.md E-four-row-cases.generated.md \
  SELFTEST=0 MERGE_FAULT=drop-hand-block
assert "the refusal must name SELFTEST" "$(m_err 'SELF-TEST knobs and SELFTEST is not 1' && echo 1 || echo 0)"
assert "nothing may be written" "$([ ! -f "$MOUT" ] && echo 1 || echo 0)"
done_ok

# ── 26. ⛔ AND IT MUST ABORT WHEN IT CANNOT INJECT. `drop-hand-block` against the real door
#      baseline used to exit 0 having injected nothing — "a mutation that did not fully
#      apply reports GREEN". E carries no hand PROSE, so this is that exact situation.
merge_scenario "MERGE_FAULT aborts when nothing to inject" 2 E-four-row-cases.baseline.md E-four-row-cases.generated.md \
  SELFTEST=1 MERGE_FAULT=drop-hand-block
assert "the abort must say it could not inject" "$(m_err 'asked to inject and could not' && echo 1 || echo 0)"
assert "⛔ it must NOT claim to have injected" "$(m_err 'FAULT INJECTED' && echo 0 || echo 1)"
done_ok

# ── 27. …and when it CAN inject, the verifier must catch it — all three kinds.
merge_scenario "MERGE_FAULT drop-hand-block is caught" 2 B-hand-table.baseline.md B-hand-table.generated.md \
  SELFTEST=1 MERGE_FAULT=drop-hand-block
assert "the injection must be cmp-verified as landed" "$(m_err 'output changed, cmp-verified' && echo 1 || echo 0)"
assert "the verifier must name it lost" "$(m_err 'the merge LOST hand-authored material' && echo 1 || echo 0)"
done_ok

# ⭐ drop-suffix is the one that caught ITSELF: the victim used to travel through `awk -v`,
#   which DECODES escapes, so against a note holding `^(is_\|can_\|has_\|…)` it searched for
#   an already-unescaped string, matched nothing, printed "FAULT INJECTED" and the verifier
#   passed at rc 0. This fixture is that exact note.
merge_scenario "MERGE_FAULT drop-suffix is caught" 2 A-escaped-pipe.baseline.md A-escaped-pipe.generated.md \
  SELFTEST=1 MERGE_FAULT=drop-suffix
assert "the injection must be cmp-verified as landed" "$(m_err 'output changed, cmp-verified' && echo 1 || echo 0)"
assert "the verifier must name the lost suffix" "$(m_err 'SUFFIX:' && echo 1 || echo 0)"
done_ok

merge_scenario "MERGE_FAULT drop-carried-row is caught" 2 C-empty-note-row.baseline.md C-empty-note-row.generated.md \
  SELFTEST=1 MERGE_FAULT=drop-carried-row
assert "the injection must be cmp-verified as landed" "$(m_err 'output changed, cmp-verified' && echo 1 || echo 0)"
assert "the verifier must name the lost row" "$(m_err 'CARRIED ROW:' && echo 1 || echo 0)"
done_ok


echo
group_end

# ═══════════════════════════════════════════════════════════════════════════════════
# THE AUDIT HARNESSES' STARTUP CAPTURE — BOTH POLARITIES (2026-09-08).
#
# ⛔ WHY THIS GROUP HAS TO EXIST AT ALL, AND WHY IT COULD NOT LIVE INSIDE THE HARNESSES.
# Each sweep captures `CASES_EXPLICIT` at startup, BEFORE `CASES="${CASES:-}"` destroys the
# distinction between "set to the empty string" and "never set". Every fixture inside a
# harness's own SELFTEST assigns CASES_EXPLICIT itself, so those rows pass whether or not the
# startup capture exists — "an instrument primed by its own fixture". The harness's row 0 reads
# `CASES_EXPLICIT_AT_STARTUP`, which no fixture writes, and prints it. But ONE PROCESS CAN
# OBSERVE ONLY ONE POLARITY of a startup-time capture: a run launched with CASES unset can
# never see what a run launched with CASES="" would have captured. The second polarity needs a
# SECOND PROCESS, and that is this group.
#
# ⛔ THE PAIR IS THE CONTROL. `unset -> 0` alone is satisfied by hard-wiring the bit to 0;
# `empty -> 1` alone by hard-wiring it to 1. Only the two together pin the DISTINCTION, which
# is the entire defect: `CASES= bash <sweep>` used to mean "full sweep" and now means
# "selection that came back empty -> UNPROVEN".
#
# ⚠ These run the REAL harnesses, not copies in the fake repo — SELFTEST=1 exits before any
# catalog access, so no stack is needed, and running the shipping file is the point. WORK is
# pointed at this suite's throwaway dir so nothing lands in the operator's .authz-work.
# ⚠ `unset CASES` in a subshell, never `CASES= bash …`: the second form IS the defect, and this
# suite must not be the last place in the repo still typing it.
# ═══════════════════════════════════════════════════════════════════════════════════
group_start "audit startup capture"
AWORK="$T/audit-work"; mkdir -p "$AWORK"
AOUT="$T/audit.out"

audit_polarity () {  # $1 harness path  $2 polarity: unset|empty  $3 expected startup bit
  SCEN="$(basename "$1" .sh) CASES $2 -> startup=$3"
  [ -f "$1" ] || { FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
                   printf 'FAIL  %-44s (harness not found)\n' "$SCEN"; SCEN=""; return 0; }
  : > "$AOUT"
  if [ "$2" = "empty" ]; then
    ( cd "$ROOT" && WORK="$AWORK" SELFTEST=1 CASES="" bash "$1" ) > "$AOUT" 2>&1
  else
    ( cd "$ROOT" && unset CASES && WORK="$AWORK" SELFTEST=1 bash "$1" ) > "$AOUT" 2>&1
  fi
  RC=$?
  if [ "$RC" != 0 ]; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES $SCEN"
    printf 'FAIL  %-44s expected rc 0, got rc %s\n' "$SCEN" "$RC"
    grep -E 'NOT OK|unbound|not found' "$AOUT" | head -6 | sed 's/^/        | /'
    SCEN=""; return 0
  fi
  return 0
}
a_out () { grep -qF -- "$1" "$AOUT"; }

for h in "$AUDIT" "$WRITE_AUDIT" "$ROW_AUDIT" "$INV_AUDIT"; do
  # ⛔ A MISSING HARNESS IS A FAILURE, NEVER A SKIP. This was `[ -f "$h" ] || continue`, which made
  # the FAIL branch below unreachable: rename or move a sweep and this suite silently drops its two
  # scenarios, prints a SMALLER total, and still exits 0. ⭐ The whole point of this group is the
  # two-process control that one process cannot observe — a control that quietly stops running is
  # worse than one that never existed, because the green now asserts something nobody measured.
  # (QA MINOR, 2026-09-08. Silence is not success.)
  if [ ! -f "$h" ]; then
    FAIL=$((FAIL + 1)); FAILED_NAMES="$FAILED_NAMES missing:$(basename "$h")"
    printf 'FAIL  %-44s harness not found at %s\n' "$(basename "$h")" "$h"
    continue
  fi
  audit_polarity "$h" unset 0
  assert "the harness must PRINT its startup capture" "$(a_out 'SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=' && echo 1 || echo 0)"
  assert "CASES unset must capture 0" "$(a_out 'SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=0' && echo 1 || echo 0)"
  assert "⛔ and NOT 1 (the hard-wired-bit control)" "$(a_out 'SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=1' && echo 0 || echo 1)"
  assert "the run must name its selection source" "$(a_out 'SELECTION-SOURCE: CASES UNSET -> FULL run' && echo 1 || echo 0)"
  done_ok

  audit_polarity "$h" empty 1
  assert "CASES=\"\" must capture 1  ⭐ the polarity one process cannot see" "$(a_out 'SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=1' && echo 1 || echo 0)"
  assert "⛔ and NOT 0 (the hard-wired-bit control)" "$(a_out 'SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=0' && echo 0 || echo 1)"
  assert "the run must say it is NOT a full run" "$(a_out 'CASES set and EMPTY -> selects NOTHING (UNPROVEN, exit 3). ⛔ NOT a full run.' && echo 1 || echo 0)"
  done_ok
done

echo
group_end
echo "--------------------------------------------------------------------------------"
echo "SELF-TEST: PASS $PASS · FAIL $FAIL · SKIPPED $SKIP"
# ⭐ A suite that asserted NOTHING prints `PASS 0 · FAIL 0` and reads as a pass — the
# empty-domain failure wearing the self-test's badge.
if [ "$((PASS + FAIL + SKIP))" -eq 0 ]; then
  echo "⛔ NOT OK — ZERO scenarios ran. Nothing was asserted; this is not a pass."
  echo "--------------------------------------------------------------------------------"
  exit 2
fi
if [ "$SKIP" -gt 0 ]; then
  echo "⚠ $SKIP scenario(s) SKIPPED because the live catalog was not reachable:$SKIPPED_NAMES"
  echo "  ⛔ A PASS over $PASS scenario(s) with $SKIP skipped is NOT a pass over all of them."
  echo "     Start the local stack (\`supabase start\`) and re-run before recording this."
fi
[ "$FAIL" -gt 0 ] && echo "⛔ FAILED:$FAILED_NAMES"
echo "--------------------------------------------------------------------------------"
[ "$FAIL" -gt 0 ] && exit 1
exit 0
