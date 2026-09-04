#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14) — THE STANDING INVARIANT.
# This is the P0's permanent fix: a repeatable regression gate so door-blindness
# (an authz gate no keystone exercises — green over a live leak) cannot silently
# recur. It has two arms; run both.
#
#   ARM 1  POLICY/PREDICATE/ROW-DOOR BLIND ⊆ ALLOWLIST
#     Run the THREE neutralization sweeps (p0-authz-door-audit.sh +
#     p0-authz-writepath-audit.sh + p0-authz-rowdoor-audit.sh); union their BLIND
#     sets; assert every BLIND is in the committed allowlist
#     (authz-blind-allowlist.txt). A BLIND not on the allowlist ⇒ non-zero exit =
#     a NEW un-keystoned authz gate (the regression).
#
#     The third sweep joined on 2026-08-05 (FUP-AUTHZ-3). Row-returning DEFINER
#     doors have no boolean to open, so the other two are structurally blind to
#     them — and BUG-AUTHZ-002 was a live leak in exactly that class. It opens a
#     door's identity guard (`if <cond> then` -> `if false then`) instead.
#
#   ARM 2  NEVER-CALLED-DOOR FLOOR
#     With track_functions=all, run the full pgTAP suite, then assert every
#     `authenticated`-reachable public prosecdef=t door was CALLED at least once.
#     A door with 0 calls is exercised by no test = door-blind by construction.
#     Offenders that are legitimately door-only / E2E-only are allowlisted in
#     authz-neverclled-door-allowlist.txt; anything else fails the gate.
#
#   ARM 3  CENSUS CLOSURE — the sixteenth-stopper (ADR 0079 Amendment 3)
#     Every prosecdef boolean function in app/public and every RLS policy in the
#     LIVE catalog must carry a VERDICT somewhere: a row in a committed findings
#     md (BLIND | COVERED | ERROR | SKIPPED) or a line in authz-unswept-backlog.txt.
#     A gate in NEITHER has never been swept, in any direction.
#
#     ⚠ This is the arm that catches a NEW gate, and neither of the others can.
#     ARM 1 asserts BLIND ⊆ allowlist — but a never-swept gate is in NO BLIND set,
#     so it passes ARM 1 vacuously (and passes it INSTANTLY in FROMFINDINGS mode,
#     which reads a findings md the new policy is simply absent from). ARM 2 asks
#     only whether DOORS are called and never looks at policies at all. That is how
#     15 policies added between 2026-07-18 and 2026-08-03 crossed five phase gates:
#     each one was invisible to every arm on the day it landed.
#
#     Cost: ~2 s (two catalog queries + a sort — no suite run, no mutation). Cheap
#     enough to run EVERY phase, which is the whole point: an expensive gate gets
#     satisfied nominally, and that is the failure this arm exists to prevent.
#
#   ARM 5  INVOKER-WRAPPER BLIND ⊆ ALLOWLIST (AUDIT-INVOKER-WRAPPER)
#     ARMs 1–3 all bound their domain with `p.prosecdef` — so the entire `public`
#     INVOKER surface (88 `authenticated`-reachable plpgsql functions) had never been
#     swept in any direction, by any arm, and could not be: a `prosecdef = f` wrapper
#     is in no BLIND set (ARM 1), is not a door (ARM 2), and is not in the census
#     domain (ARM 3). That is the AUDIT-INVOKER-WRAPPER hole, found in FF-3 (QA M-2).
#     This arm compares p0-authz-invoker-audit.sh's BLIND set to
#     authz-invoker-blind-allowlist.txt, exactly as ARM 1 does for policies.
#
#     ⚠ ARM 3's census domain is WIDENED to include these wrappers in the same change.
#     Without that, a NEW invoker wrapper would pass ARM 5 vacuously by being absent
#     from the findings md — precisely how 15 policies crossed five phase gates before
#     Amendment 3. An arm that only checks BLIND ⊆ allowlist can never notice a gate
#     nobody has swept; only the census can.
#
# ── Modes ──────────────────────────────────────────────────────────────────────
#   bash p0-authz-invariant.sh                 # ARM 1 (full sweep, ~90 min) + 2 + 3
#   ARM=policy  bash p0-authz-invariant.sh     # ARM 1 only
#   ARM=floor   bash p0-authz-invariant.sh     # ARM 2 only  (~1 min)
#   ARM=census  bash p0-authz-invariant.sh     # ARM 3 only  (~2 s)
#   ARM=wrapper bash p0-authz-invariant.sh     # ARM 5 only  (~2 s from the committed
#                                               # findings; the SWEEP behind it is
#                                               # ~25 min and the lead runs it in the
#                                               # background, like ARM 1's)
#   ARM=catalog bash p0-authz-invariant.sh     # ARM 6 only  (~2 s) — every non-legacy
#                                               # authz.roles row has a PO-APPROVED matrix
#                                               # AND a differential suite. It proves the
#                                               # artifacts EXIST; 403 is what compares them.
#   ARM=sites   bash p0-authz-invariant.sh     # ARM 7 only  (~3 s) — every site naming a
#                                               # catalog-owned role is the wrapper family or
#                                               # an allowlisted VALUE use. AE4.6's hand
#                                               # census, re-derived instead of remembered.
#   ARM=hat     bash p0-authz-invariant.sh     # ARM 4 only  (~10 s) — ACT hat-blindness:
#                                               # caller-bound raw memberships reads with no
#                                               # active-role condition (ADR 0106 S4; the
#                                               # sweep self-tests its own detector every
#                                               # run). Delegates to act-hat-blind-sweep.sh.
#   FROMFINDINGS=1 ARM=policy bash ...          # ARM 1 fast: compare the COMMITTED
#                                               # findings md to the allowlist, NO sweep
#                                               # (a light CI check; the full sweep is
#                                               # the authoritative gate the lead runs
#                                               # in the background).
#
# Exit 0 = invariant holds. Non-zero = a NEW blind / never-called door (details printed).
# Run from repo root. The heavy ARM-1 sweep dies at turn-end for a subagent; the LEAD
# runs it in the background (see docs/reviews/authz-door-audit-triage.md).
set -u

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-${TMPDIR:-/tmp}/authz-audit}"
HERE="$ROOT/supabase/tests/mutation"
ALLOWLIST="$HERE/authz-blind-allowlist.txt"
FLOOR_ALLOW="$HERE/authz-neverclled-door-allowlist.txt"
INV_ALLOW="$HERE/authz-invoker-blind-allowlist.txt"
UNSWEPT="$HERE/authz-unswept-backlog.txt"
ROLE_LITERAL_ALLOW="$HERE/authz-role-literal-allowlist.txt"
DOOR_FINDINGS="$ROOT/docs/reviews/authz-door-audit-findings.md"
WP_FINDINGS="$ROOT/docs/reviews/authz-writepath-audit-findings.md"
ROW_FINDINGS="$ROOT/docs/reviews/authz-rowdoor-audit-findings.md"
INV_FINDINGS="$ROOT/docs/reviews/authz-invoker-audit-findings.md"
ARM="${ARM:-all}"
FROMFINDINGS="${FROMFINDINGS:-0}"

# ⛔ WORKSPACE PRECONDITION — a hard failure, never a warning.
# Until 2026-08-24 the default above was one Windows session's scratchpad path, committed:
# on every other machine `mkdir -p` failed, `set -e` is deliberately off here, and each
# arm's `comm`/`wc` against the missing files produced EMPTY sets — which every arm reads
# as "nothing unaccounted for". The gate printed `INVARIANT HOLDS` and exited 0 having
# measured nothing at all. ⚠ This is CLAUDE.md §6 step 1, so the vacuous pass was wearing
# the badge of a mandatory gate. The default is now TMPDIR-based (matching
# `e2e-prod-gate.sh`), but a bad `WORK=` from the environment would re-create the hole —
# so the WRITABILITY of the directory is asserted, not assumed. Probe, never infer.
if ! mkdir -p "$WORK" 2>/dev/null || ! : > "$WORK/.writable" 2>/dev/null; then
  echo "FATAL: WORK directory is not usable: $WORK" >&2
  echo "       Every arm writes its census/findings there; without it this gate reports" >&2
  echo "       INVARIANT HOLDS having measured NOTHING. Set WORK=<writable dir> and re-run." >&2
  exit 2
fi
rm -f "$WORK/.writable"

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
psql_admin () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U supabase_admin -d postgres -tA -P pager=off "$@"; }

# strip comments+blanks from an allowlist file
allow_body () { grep -vE '^[[:space:]]*#' "$1" 2>/dev/null | grep -vE '^[[:space:]]*$'; }

# Extract the col-1 "gate / policy" labels from a findings md's "## BLIND" table.
blind_from_findings () {
  awk '/^## BLIND/{f=1;next} /^## /{f=0} f && /^\| / && $0 !~ /gate . policy/ && $0 !~ /^\|---/ {print}' "$1" \
    | sed -E 's/^\| *//; s/ *\|.*$//' | grep -vE '^$'
}

# ARM 3 — col-1 labels from EVERY verdict table in a findings md (BLIND + COVERED +
# ERROR + SKIPPED). A verdict in any direction proves the gate was swept.
verdicts_from_findings () {
  grep -E '^\| ' "$1" 2>/dev/null | grep -vE '^\|---|gate . policy' \
    | sed -E 's/^\| *//; s/ *\|.*$//' | grep -vE '^$'
}

# ARM 3, ROW-DOOR variant — same idea, but the row-door report has a FOURTH table whose
# rows are NOT verdicts: UNSUPPORTED means "this harness has no mechanism for that door",
# which is the opposite of a sweep result. Counting those as verdicts would let a door be
# deleted from the backlog on the strength of the harness ADMITTING it could not test it —
# the census hole ARM 3 exists to close, reopened by a bookkeeping accident. So filter on
# the verdict column (col 4) and take only the three real outcomes.
# ⚠ FS is a CHARACTER CLASS, not an escaped pipe. `-F' *\| *'` makes awk warn and fall
# back to plain `|`, which as a regex is ALTERNATION — it matches the empty string, so
# every field shifts and the filter silently prints NOTHING. Empty output here reads
# exactly like "no row-door has a verdict yet", which would make ARM 3 pass by finding
# the doors in the backlog instead: green, and blind to whether the report is even parsed.
verdicts_from_rowfindings () {
  awk -F' *[|] *' '/^[|] / && ($5=="BLIND"||$5=="COVERED"||$5=="ERROR") {print $2}' "$1" 2>/dev/null \
    | grep -vE '^$'
}

# ARM 3 — the "Skipped SELECT/ALL policies (qual = true)" bullet list, reshaped from
# `- `tbl / polname / CMD`` into the sweep's canonical `tbl.polname (CMD)` label. These
# were deliberately not neutralized (true -> true is a vacuous no-op), which is itself a
# recorded verdict.
skipped_from_findings () {
  grep -E '^- `[A-Za-z0-9_]+ / [A-Za-z0-9_]+ / [A-Z]+`$' "$1" 2>/dev/null \
    | sed -E 's/^- `//; s/`$//' | awk -F' / ' '{printf "%s.%s (%s)\n", $1, $2, $3}'
}

# ⭐ EXTENSION-OWNED FUNCTIONS ARE NOT AUTHZ GATES (N2, QA re-review 2026-09-04).
# ARM 3's `public INVOKER plpgsql` clause is satisfied by pgTAP's own functions, so with the
# extension installed the census reported 181 UNKNOWN gates and exited 1, in the same §6 step 1
# that runs the suites. Measured both ways on this stack: pgtap present -> B clause 269, absent -> 88.
#
# ⚠ THE EXPOSURE IS NARROWER THAN IT FIRST LOOKS, AND SAYING SO IS THE POINT. Measured 2026-09-04:
# `npm run test:db` DROPS pgtap when it finishes (census read 0 excluded immediately after a full
# 262-file run), and all 26 mutation harnesses that install it as a preflight also drop it. So the
# arm is not reliably red after a normal gate run. What leaves it installed is (a) the standalone
# single-file run workflow, which creates it by hand — the same workflow `100`'s FUP-QO-5 header
# names — and (b) a harness that did not reach its own drop, which this tree already knows happens
# (`.claude/rules/mutation-harnesses-are-not-killable.md`). ⛔ An intermittent red is WORSE than a
# constant one, not better: it arrives attached to whatever else that operator was doing.
#
# ⭐ THE SIBLING FIX ALREADY EXISTED AND WAS NEVER APPLIED HERE. pgTAP `100` test 19 met this
# exact class on 2026-08-07 (FUP-QO-5) and was given the predicate below. `p0-authz-invariant.sh`
# was not — the tree's own "a fix correct at MOST sites hides that it is wrong" shape. This is
# that predicate, verbatim in property: a `pg_depend` row with `deptype = 'e'` pointing at a
# `pg_extension`. ⛔ Excluded by PROPERTY, never by name — a `proname not like 'pg_tap%'` filter
# would be a syntax boundary and would go stale on the next extension.
#
# ⚠ The damage direction here is a spurious RED, not a false green (unlike `100`, where pgtap's
# grants made a real anon leak indistinguishable). But a phase-gate arm that reds with a wall of
# extension noise is precisely what tempts an operator to widen a filter, and this arm's whole
# subject is a filter that has quietly stopped seeing things.
NOT_EXTENSION_OWNED="not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')"
IS_EXTENSION_OWNED="exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')"

RC=0

# ════════════════════════════════════════════════════════════════════════════════
# PREFLIGHT (runs before EVERY arm) — NO GATE IS SITTING DEGENERATE
#
# FUP-AUTHZ-HARNESS-TRANSACTIONAL. During DM5 S2 `app.can_write_document` — the
# gate for every document write across all eight home types — sat live on the
# shared stack with the body `begin return true; end`. An unconditional allow,
# left by a mutation harness whose EXIT trap does not fire when a subagent's
# process is killed.
#
# ⭐ WHY THIS LIVES HERE AND NOT IN A NEW ARM. Every existing arm tests a gate
# that EXISTS: `policy` asks whether anything notices when a gate is opened,
# `census` whether anything ever asked, `floor` whether the door is called,
# `hat` whether it reads memberships hatless, `wrapper` covers prosecdef=f. A
# gate that has been REPLACED BY A CONSTANT is invisible to all five, because
# neutralizing an already-neutralized gate changes nothing. Running the check as
# a preflight to every arm makes it unskippable without inventing a sixth arm
# name that CLAUDE.md §6 would then have to be taught.
#
# ⚠⚠ THE FILED DETECTOR WAS BLIND TO TWO OF THE THREE NEUTRALIZATION FORMS.
# The regex recorded in the follow-up is plpgsql-only:
#     ^\s*begin\s+return\s+(true|false)\s*;\s*end
# but p0-authz-door-audit.sh neutralizes in THREE forms — `begin return true;
# end` (plpgsql), `select true` (language sql), and `begin return; end` (void
# raise-guards, the assert_noop direction). Measured on this catalog: `app` +
# `public` hold 182 SECURITY DEFINER functions in `language sql`, and
# `'select true' ~ <filed regex>` is FALSE. So the query that bounded the
# original incident's blast radius to "exactly one hit" — a correct result for
# that incident, which was plpgsql — could not have seen a SQL-language gate at
# all. An enumeration bounded by a SYNTAX rather than the PROPERTY, sitting in
# the safety net itself. All three forms are covered below.
#
# Proven able to fire before being trusted: with two degenerate functions
# constructed in a rolled-back txn (one `language sql`, one void), this returns
# 2; against the clean catalog it returns none.
# ════════════════════════════════════════════════════════════════════════════════
DEGENERATE_PREDICATE="( p.prosrc ~ '^\s*begin\s+return\s+(true|false)\s*;\s*end'
     or p.prosrc ~ '^\s*select\s+(true|false)\s*;?\s*\$'
     or p.prosrc ~ '^\s*begin\s+return\s*;\s*end' )"

# ──────────────────────────────────────────────────────────────────────────
# ⭐ THE `authz` SCHEMA IS IN DOMAIN SINCE AE4.7b — AND ONLY PART OF IT IS.
# READ THIS BEFORE QUOTING "ALL ARMS HOLD" ABOUT THE CATALOG.
#
# HISTORY, KEPT BECAUSE THE FAILURE MODE IS THE INSTRUCTIVE PART. This script is
# called `p0-authz-invariant.sh`, the word "authz" appears in it ~35 times, and
# until AE4.7b NOT ONE of those was the `authz` SCHEMA: every domain predicate
# here and in the sweeps it unions bounded on `n.nspname in ('app','public')`.
# ⚠ That is WORSE than an ordinary gap, because the name actively steers a reader
# away from checking — "the authz-invariant script" reads as covering the authz
# schema. QA measured it 2026-09-01 (finding F7) and found the exemption block
# had ALREADY named its own expiry (AE4.6) and outlived it inside the same branch,
# while four green arms printed beside it.
#
# ⭐ NOW: every bound above is `('app','public','authz')`, so the catalog's
# CLIENT-REACHABLE-BY-DELEGATION surface carries verdicts like any other door.
#
# ⛔⛔ BUT THE WIDENING IS NOT THE SAME AS COVERAGE, AND THE REMAINDER IS NAMED
# RATHER THAN LEFT TO BE INFERRED. ⚠ RE-DERIVED 2026-09-02 (AE4.9 / ADR 0176 D4):
# the resolver PAIR became a QUARTET, so the schema now holds EIGHT functions, not six.
# The arms' own shape predicates admit only the boolean ones:
#     IN DOMAIN   authz.holds_role                 (prosecdef, bool) — AE4.7b chokepoint
#                 authz.has_permission             (prosecdef, bool) — the RUNTIME
#                                             evaluator (renamed from has_direct_permission:
#                                             it joins the implication closure, so it answers
#                                             ENTAILED, not direct). COVERED, 2026-09-02.
#                 authz.candidate_has_permission   (prosecdef, bool) — the PRE-CUTOVER
#                                             ORACLE. In the CENSUS's domain but outside
#                                             ARM 1's, excluded purely by NAME
#                                             (PRED_NAME_RE does not match `candidate_…`):
#                                             FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME.
#                                             Classified in authz-unswept-backlog.txt.
#                 authz.scope_reaches              (prosecdef, bool) — census only; it is
#                                             outside PRED_DOMAIN (no identity primitive
#                                             in its body), so ARM 1 has no verdict on it
#     OUT         authz.assignment_facts,
#                 authz.entailed_grants            (set-returning; the row-door arm requires
#                                             `authenticated` EXECUTE, which neither holds
#                                             — by design)
#                 authz.explain_permission, authz.rebuild_implication_closure
#                                             (prosecdef SCALAR NON-BOOL = the C2 command-door
#                                             class, FUP-AUTHZ-COMMAND-DOOR-UNSWEPT)
# ⛔ ABSENCE OF A VERDICT IS ABSENCE OF COVERAGE (authz-evolution plan rule 4), never a
# pass. State the FOUR OUT rows beside any "the authz schema is swept" claim.
#
# WHY THE OUT ROWS ARE STILL DEFENSIBLE, per door, as the rule requires:
#   * No application role holds USAGE on `authz` (20261003007100), and none holds EXECUTE
#     on any of its functions — pgTAP 401 §§18.1-18.3 assert this by EFFECTIVE PRIVILEGE
#     with its own vacuity control, and 405 §5.4 pins it for the chokepoint specifically.
#   * They are reachable ONLY as internal callees of the `app` wrappers, which are
#     client-reachable, in every arm's domain, and swept.
# ⚠ That is a compensating-control argument, not a sweep. It stops being sufficient the
# moment anything grants USAGE on `authz`.
# ──────────────────────────────────────────────────────────────────────────
check_no_degenerate_gates () {
  local hits
  hits=$(psql_c -c "
    select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') ['||l.lanname||
           case when p.prosecdef then ', DEFINER' else '' end||']'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
     where n.nspname in ('app','public','authz') and $DEGENERATE_PREDICATE
     order by 1;")
  if [ -n "$(echo "$hits" | grep -vE '^$')" ]; then
    echo "*** DEGENERATE GATE(S) LIVE ON THIS STACK — a harness left a door open:"
    echo "$hits" | grep -vE '^$' | sed 's/^/      /'
    echo "    Every arm below is UNTRUSTWORTHY until these are restored. pg_proc carries"
    echo "    no mtime, so the window CANNOT be dated from the catalog: any result produced"
    echo "    since the last known-good run must be RE-RUN, not re-read."
    RC=1
    return 1
  fi
  return 0
}

# ════════════════════════════════════════════════════════════════════════════════
# ARM 1 — BLIND ⊆ ALLOWLIST
# ════════════════════════════════════════════════════════════════════════════════
run_arm_policy () {
  echo "=== ARM 1: policy/predicate BLIND ⊆ allowlist ==="
  local blinds="$WORK/invariant_blinds_union.txt"

  if [ "$FROMFINDINGS" = "1" ]; then
    echo "  mode: FROMFINDINGS (comparing COMMITTED findings md, no sweep)"
    { blind_from_findings "$DOOR_FINDINGS"; blind_from_findings "$WP_FINDINGS"
      blind_from_findings "$ROW_FINDINGS"; } | sort -u > "$blinds"
  else
    echo "  mode: FULL SWEEP (door + writepath + rowdoor) — ~105 min"
    # ⛔ CASES= is cleared EXPLICITLY for the children. This script never sets it, so an
    # EXPORTED CASES in the operator's environment used to be inherited straight into the
    # sweeps: each would silently run a subset, and this arm would then compare a SUBSET
    # BLIND set against the full allowlist and find nothing unaccounted for — a narrower
    # domain reading as a clean pass, which is FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE's
    # sibling on the scratch side. "FULL SWEEP" is now a fact about the child, not a hope.
    [ -n "${CASES:-}" ] && echo "  ⚠ CASES=\"$CASES\" is set in the environment — IGNORED here; this mode is a FULL sweep."
    ( cd "$ROOT" && CASES= bash "$HERE/p0-authz-door-audit.sh" )      || { echo "  *** door sweep failed"; RC=1; }
    ( cd "$ROOT" && CASES= bash "$HERE/p0-authz-writepath-audit.sh" ) || { echo "  *** writepath sweep failed"; RC=1; }
    ( cd "$ROOT" && CASES= bash "$HERE/p0-authz-rowdoor-audit.sh" )   || { echo "  *** rowdoor sweep failed"; RC=1; }
    # All three sweeps write a machine-readable BLIND tsv (col2 = gate) into $WORK.
    { awk -F'\t' 'NR>1{print $2}' "$WORK/blinds.tsv" 2>/dev/null;
      awk -F'\t' 'NR>1{print $2}' "$WORK/blinds_writepath.tsv" 2>/dev/null;
      awk -F'\t' 'NR>1{print $2}' "$WORK/blinds_rowdoor.tsv" 2>/dev/null; } | sort -u > "$blinds"
  fi

  local n; n=$(wc -l < "$blinds" | tr -d '[:space:]')
  echo "  BLIND set size: $n"
  # Any BLIND not in the committed allowlist is a NEW un-keystoned gate.
  local offenders
  offenders=$(comm -23 "$blinds" <(allow_body "$ALLOWLIST" | sort -u))
  if [ -n "$offenders" ]; then
    echo "  *** INVARIANT VIOLATED — BLIND gates NOT in the allowlist (new door-blindness):"
    echo "$offenders" | sed 's/^/      /'
    echo "  Fix: add a mutation-proven keystone (preferred) or, if a genuine backstop,"
    echo "       add the line to $ALLOWLIST with justification."
    RC=1
  else
    echo "  OK: every BLIND is on the allowlist (no NEW un-keystoned authz gate)."
  fi
  # Stale-allowlist hygiene (non-fatal): entries no longer BLIND should be pruned.
  local stale
  stale=$(comm -13 "$blinds" <(allow_body "$ALLOWLIST" | sort -u))
  if [ -n "$stale" ]; then
    echo "  note: allowlist entries no longer BLIND (now COVERED — prune when convenient):"
    echo "$stale" | sed 's/^/      /'
  fi
}

# ════════════════════════════════════════════════════════════════════════════════
# ARM 2 — NEVER-CALLED-DOOR FLOOR
# ════════════════════════════════════════════════════════════════════════════════
run_arm_floor () {
  echo "=== ARM 2: never-called-door floor (track_functions=all + full suite) ==="
  # Track function calls on every new connection to this DB, and zero the counters.
  # (alter database applies to the `supabase test db` sessions that follow; pg_stat_reset
  #  needs superuser — supabase_admin.)
  psql_admin -c "alter database postgres set track_functions = 'all';" >/dev/null 2>&1
  psql_admin -c "select pg_stat_reset();" >/dev/null 2>&1

  echo "  running full pgTAP suite (exercises the doors keystones touch)…"
  ( cd "$ROOT" && supabase test db ) >/dev/null 2>&1

  # authenticated-reachable public SECURITY DEFINER doors with 0 recorded calls.
  local offenders
  offenders=$(psql_c -c "
    with doors as (
      select p.oid,
             p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef = true
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    )
    select d.label
    from doors d
    left join pg_stat_user_functions s on s.funcid = d.oid
    where coalesce(s.calls, 0) = 0
    order by d.label;")

  # Reset the server setting we changed (shared-stack hygiene).
  psql_admin -c "alter database postgres reset track_functions;" >/dev/null 2>&1

  # Subtract the door-only / E2E-only floor allowlist.
  local unlisted
  unlisted=$(comm -23 <(echo "$offenders" | grep -vE '^$' | sort -u) <(allow_body "$FLOOR_ALLOW" | sort -u))
  local total; total=$(echo "$offenders" | grep -cvE '^$')
  echo "  authenticated-reachable prosecdef doors with 0 calls: $total"
  if [ -n "$unlisted" ]; then
    echo "  *** FLOOR VIOLATED — never-called doors NOT on the floor allowlist:"
    echo "$unlisted" | sed 's/^/      /'
    echo "  Fix: add a keystone that drives the door, or (if door-only/E2E-only) list it"
    echo "       in $FLOOR_ALLOW with justification."
    RC=1
  else
    echo "  OK: every never-called door is on the floor allowlist."
  fi

  # ──────────────────────────────────────────────────────────────────────────
  # FUP-AUTHZ-ALLOWLIST-ROT — the allowlist is only ever SUBTRACTED from, so
  # nothing notices when an entry names a door that no longer exists. Live
  # specimen at filing: line 41 named `add_referral_reply_attachment(...)`,
  # dropped by DM4's 20260926000400.
  #
  # ⚠ Calibrated: a stale entry is INERT, not dangerous — it can never match a
  # live offender, so it masks nothing. The failure is LEGIBILITY: a human
  # reading the file sees a door "accounted for" that does not exist, and the
  # justification comment outlives the thing it justified.
  #
  # ⭐ The signature-keying it rides on is a FEATURE, and DM5 S2 showed why:
  # when a migration drops a parameter, the listed signature stops matching the
  # live door, which then surfaces in `unlisted` ⇒ FLOOR VIOLATED, loudly. This
  # check only covers the rot that same mechanism CANNOT see.
  # ──────────────────────────────────────────────────────────────────────────
  local live_sigs stale
  # ⚠ `('app','public','authz')` since AE4.7b — and only the BOOLEAN authz functions
  # actually land in any arm. See the block above `check_no_degenerate_gates` for the
  # per-door IN/OUT partition; do not read the widened bound as full coverage.
  live_sigs=$(psql_c -c "
    select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app','public','authz');" | sort -u)
  stale=$(comm -23 <(allow_body "$FLOOR_ALLOW" | sort -u) <(echo "$live_sigs"))
  if [ -n "$(echo "$stale" | grep -vE '^$')" ]; then
    echo "  *** ALLOWLIST ROT — entries naming a door that does not exist in pg_proc:"
    echo "$stale" | grep -vE '^$' | sed 's/^/      /'
    echo "  Fix: delete the entry, or correct it if the door was renamed. An allowlist"
    echo "       entry is a claim about a live door; a claim about nothing reads as coverage."
    RC=1
  else
    echo "  OK: every floor-allowlist entry resolves to a live door."
  fi
}

# The two `pg_proc` halves of ARM 3's domain, as ONE definition. $1 is the extension-ownership
# predicate: `$NOT_EXTENSION_OWNED` builds the DOMAIN, `$IS_EXTENSION_OWNED` builds the EXCLUDED
# set that the control below checks. ⚠ Defined ONCE and used by BOTH, for `100` test 19c's reason:
# a control built from a duplicated query proves the duplicate, not the exclusion. It also makes
# the two polarities structurally the same measurement — a one-directional check would leave the
# "did I exclude a real door?" direction unproven.
census_proc_domain () {
  local extpred="$1"
  # ALL prosecdef boolean functions in app/public/authz (no name-prefix filter —
  # `capa_viewer_can_manage` and `member_can` are real gates the door audit's `^(is_|can_|has_)`
  # regex has never had in scope).
  #
  # ⚠ AND every authenticated-reachable DEFINER that RETURNS ROWS. Added 2026-08-05 after
  # BUG-AUTHZ-002: `hospital_document_register` and `hospital_indicator_rollup` are
  # `prosecdef` doors returning TABLE(...), so a boolean-only census could not see them —
  # and they were leaking commission content to platform_admin the whole time this arm
  # claimed to close the enumeration hole. The justification is CLAUDE.md's own standing
  # rule: a DEFINER's gate REPLACES RLS, so for these the internal gate IS the entire
  # boundary. A boolean predicate is a gate you can neutralize; a row-returning door is a
  # gate you can walk through.
  psql_c -c "
      select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type      t on t.oid = p.prorettype
      where n.nspname in ('app','public','authz') and p.prosecdef
        and (t.typname = 'bool'
             or (p.proretset and has_function_privilege('authenticated', p.oid, 'EXECUTE')))
        and $extpred;"
  # ⚠ AND every authenticated-reachable PUBLIC INVOKER plpgsql function
  # (AUDIT-INVOKER-WRAPPER). Added with ARM 5. Note what changes here: every OTHER
  # clause in this census is bounded by `p.prosecdef`, and so were all three sweeps —
  # which is exactly why this class had no verdict in any direction. A `prosecdef = f`
  # wrapper whose own hand-written probe is the only gate in front of an `app` DEFINER
  # body is an authorization decision by any honest reading, and until this line it was
  # not in the enumeration at all. Widening ARM 5 without widening the census would let
  # a NEW wrapper pass ARM 5 by simply being absent from the findings md.
  # ⛔ This is also the clause pgTAP's ~181 plpgsql functions satisfy — see $NOT_EXTENSION_OWNED.
  psql_c -c "
      select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'
        and l.lanname = 'plpgsql'
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
        and $extpred;"
}

# ════════════════════════════════════════════════════════════════════════════════
# ARM 3 — CENSUS CLOSURE (the sixteenth-stopper)
# ════════════════════════════════════════════════════════════════════════════════
run_arm_census () {
  echo "=== ARM 3: census closure — every gate IN THIS ARM'S DOMAIN carries a verdict ==="
  echo "    domain: prosecdef bool | prosecdef set-returning+reachable | public INVOKER plpgsql | all RLS policies"
  echo "            LESS extension-owned functions (pg_depend deptype='e') — see the control below"
  # ⚠ DERIVED, NEVER FROZEN. This line read "(407 reachable)" as a LITERAL from
  # 2026-08-17 until 2026-08-31, when a live re-derivation returned 427 (345 public + 82
  # app) — the banner had drifted by 20 while printing beside four green arms, and the
  # register's own re-derivation (426, AE1 Record step) had drifted by one. A number a
  # banner states about a population NOTHING re-derives is a claim with no owner, and
  # this arm exists to stop exactly that shape. The predicate below IS the definition of
  # the out-of-domain class, so the figure and the class can never disagree again.
  local uncovered
  # ⚠ Carries $NOT_EXTENSION_OWNED too, so the IN-domain and OUT-of-domain figures are bounded
  # the same way. Measured: no extension ships a prosecdef function here, so this reads 427 with
  # pgtap present and 427 without — the exclusion is definitional consistency, not a narrowing.
  uncovered="$(psql_c -c "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','app','authz') and p.prosecdef and p.prorettype <> 'pg_catalog.trigger'::regtype and not p.proretset and p.prorettype <> 'pg_catalog.bool'::regtype and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE')) and $NOT_EXTENSION_OWNED;")"
  echo "    NOT in domain: prosecdef scalar non-bool command doors (${uncovered:-?} reachable, DERIVED this run) — FUP-AUTHZ-COMMAND-DOOR-UNSWEPT"
  local live="$WORK/census_live.txt" accounted="$WORK/census_accounted.txt"

  # LIVE domain, from the catalog and nothing else (never migration text). Deliberately
  # WIDER than either sweep's own worklist: the two `pg_proc` halves above in
  # census_proc_domain, plus ALL RLS policies (every polcmd — the door arm sees only
  # SELECT/ALL, the write arm only its snapshot).
  { census_proc_domain "$NOT_EXTENSION_OWNED"
    psql_c -c "
      select c.relname||'.'||pol.polname||' ('||
             (case pol.polcmd when 'r' then 'SELECT' when '*' then 'ALL' when 'a' then 'INSERT'
                              when 'w' then 'UPDATE' when 'd' then 'DELETE' end)||')'
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public';"
  } | grep -vE '^[[:space:]]*$' | sort -u > "$live"

  # ACCOUNTED = a verdict exists anywhere. The BLIND allowlist counts too: those gates
  # were swept and found BLIND, which is a verdict.
  { verdicts_from_findings "$DOOR_FINDINGS"; verdicts_from_findings "$WP_FINDINGS"
    verdicts_from_rowfindings "$ROW_FINDINGS"
    # The invoker report shares the row-door report's four-table layout, so it needs the
    # same verdict-column filter: its UNSUPPORTED table means "this harness has no
    # mechanism for that wrapper", which is the OPPOSITE of a sweep result. Counting
    # those as verdicts would let a wrapper leave the backlog on the strength of the
    # harness admitting it could not test it.
    verdicts_from_rowfindings "$INV_FINDINGS"
    skipped_from_findings "$DOOR_FINDINGS"; skipped_from_findings "$WP_FINDINGS"
    allow_body "$ALLOWLIST"; allow_body "$INV_ALLOW"; allow_body "$UNSWEPT"
  } | sort -u > "$accounted"

  echo "  live authz gates (catalog): $(wc -l < "$live" | tr -d '[:space:]')"
  echo "  gates carrying a verdict:   $(wc -l < "$accounted" | tr -d '[:space:]')"

  # ⭐ CONTROL FOR THE EXTENSION EXCLUSION — an exclusion is a narrowing, and a narrowing that
  # nothing measures is how a domain quietly stops seeing a real door. The SAME definition, run
  # at the opposite polarity, so the excluded set is visible on every run instead of inferred:
  #
  #   • its SIZE is printed (0 on a plain `db reset`; 181 with pgtap installed, measured
  #     2026-09-04 — and the domain is 581 either way, which is the not-over-broad proof), and
  #   • it must be DISJOINT from `accounted`. That is the non-vacuous half: pgTAP's functions
  #     carry no sweep verdict, but a first-party gate wrongly caught by the predicate almost
  #     certainly WOULD — it would have been swept. So the check can fire, and what makes it
  #     fire is exactly the failure this exclusion could introduce.
  #
  # ⛔ `comm -23 live accounted` cannot see this: it reports live-not-accounted only, so an
  # object that LEAVES `live` while keeping its verdict is invisible to the census's own test.
  #
  # ⭐ DEMONSTRATED ABLE TO FIRE, 2026-09-04 — not asserted. An empty intersection is also what a
  # control that CANNOT fire reports, so the state was constructed rather than reasoned about:
  # with pgtap installed, `alter extension pgtap add function app.can_edit_commission_forms(uuid,
  # uuid)` (as `supabase_admin`; `postgres` is not the extension owner here and the first attempt
  # ERRORed — the plant was verified in `pg_depend` before the arm was read, because a mutation
  # that did not apply reports GREEN). Readings, bare exit codes:
  #     pgtap only ................. live 581, excluded 181, exit 0
  #     + the planted door ......... live 580, excluded 182, exit 1  <- THIS control, by name
  #     plant reverted ............. live 581, excluded 181, exit 0
  #     pgtap dropped .............. live 581, excluded   0, exit 0
  # ⚠ In the exit-1 run the newcomer diff printed "OK: no unswept newcomer" — so the failure came
  # from THIS assertion and not from `comm -23`, which is the discrimination that makes the
  # demonstration worth anything. ⛔ `alter extension … DROP` must precede any `drop extension`:
  # a member function goes with the extension, and the member here is a live authorizer six
  # policies call.
  local extexcluded="$WORK/census_ext_excluded.txt" nexcl hijacked extowners
  census_proc_domain "$IS_EXTENSION_OWNED" | grep -vE '^[[:space:]]*$' | sort -u > "$extexcluded"
  nexcl=$(wc -l < "$extexcluded" | tr -d '[:space:]')
  extowners=""
  if [ "$nexcl" -gt 0 ]; then
    # ⚠ The owning extensions are resolved from the EXCLUDED SIGNATURES THEMSELVES, never from
    # `select extname from pg_extension` — that lists every installed extension and reads as if
    # all of them had contributed (it printed all eight beside pgtap's 181 on the first cut of
    # this line). Naming the wrong owner beside a correct figure is "text is not truth" wearing
    # a measurement's badge.
    extowners=" ($(psql_c -c "select coalesce(string_agg(distinct e.extname, ', ' order by e.extname), '?') from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_depend d on d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e' join pg_extension e on e.oid = d.refobjid where n.nspname||'.'||p.proname = any(string_to_array('$(sed -E 's/\(.*$//' "$extexcluded" | sort -u | paste -sd'|' -)', '|'));"))"
  fi
  echo "  extension-owned, excluded:  ${nexcl}${extowners}"
  hijacked=$(comm -12 "$extexcluded" "$accounted")
  if [ -n "$hijacked" ]; then
    echo "  *** EXCLUSION CONTROL VIOLATED — an extension-owned object CARRIES A SWEEP VERDICT:"
    echo "$hijacked" | sed 's/^/      /'
    echo "  Either a first-party gate is being reported as extension-owned (the exclusion is"
    echo "  over-broad and has just removed a real door from the census domain), or a findings"
    echo "  md has a row for an extension function. Resolve before trusting this arm's OK."
    RC=1
  fi

  local newcomers
  newcomers=$(comm -23 "$live" "$accounted")
  if [ -n "$newcomers" ]; then
    echo "  *** CENSUS VIOLATED — authz gates that NO sweep has ever seen:"
    echo "$newcomers" | sed 's/^/      /'
    echo "  These are not BLIND — they are UNKNOWN. Nothing has asked whether a keystone"
    echo "  notices when they open. Fix: run the diff-scoped ARM 1 over exactly these"
    echo "  (ADR 0079 Amendment 1 recipe), then keystone what comes back BLIND:"
    echo "      WORK=<scratch> CASES=\"<polnames/pronames>\" bash $HERE/p0-authz-door-audit.sh"
    echo "      # ⭐ Since 2026-08-26 a CASES= run writes its report + BLIND tsv to SCRATCH"
    echo "      # and never opens $DOOR_FINDINGS for write, so there is NOTHING to restore."
    echo "      # (The old 'git checkout --' step was operator memory standing in for a check:"
    echo "      #  FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE. To fold subset verdicts into the"
    echo "      #  baseline, MERGE them — never copy the subset file over it.)"
    echo "  If a gate is genuinely not an authorization decision, classify it in"
    echo "  $UNSWEPT under 'helper:' WITH the reason."
    RC=1
  else
    # ⚠ Scoped deliberately (2026-08-17, FUP-AUTHZ-COMMAND-DOOR-UNSWEPT). This USED to read
    # "every live authz gate carries a verdict", which is wider than what was checked: the
    # DEFINER clause above admits `bool` and set-returning returns only, so the reachable
    # non-trigger COMMAND doors (create_case, assume_role, add_referral_shared_item …) are in
    # no arm's domain at all. ⛔ The count is DERIVED in this arm's banner, never written here:
    # this comment carried "407 … (326 of them public)" from 2026-08-17 to 2026-08-31, by which
    # point the live figure was 427 (345 public + 82 app). A 3-door neutralization
    # sample found all three COVERED by real keystones, so the class is covered-but-UNPINNED,
    # not blind — but nothing here records that, and a NEW door in the class passes by absence.
    echo "  OK: no unswept newcomer WITHIN THIS ARM'S DOMAIN (see the domain lines above)."
  fi

  # Hygiene (non-fatal): a backlog line with no live gate behind it.
  #
  # ⛔ PARTITIONED, never collapsed (FUP-AUTHZ-CENSUS-PRUNE-NOTE-IS-WRONG, fixed 2026-08-24).
  # This note used to print ONE list headed "renamed/dropped — prune", built as
  # `backlog − live`. But `live` is THIS ARM'S DOMAIN, not the catalog: an `app`-schema
  # INVOKER plpgsql body is outside every clause above, so the arm cannot match it — and the
  # note reported that miss as non-existence, then recommended deletion on the strength of it.
  # Two live gates sat in that list, one of them `app._set_participant_patient_unchecked`, the
  # case module's single PHI write choke point. Pruning as instructed would have deleted the
  # only committed record that they are unswept. ⚠ It failed in the REASSURING direction,
  # inside a run printing INVARIANT HOLDS at exit 0, in a `note:` line nothing gates on.
  #
  # So: "outside my domain" and "does not exist" are different facts and get different lines.
  # Same shape as ADR 0128's clean/unproven/dirty partition — absence of evidence is its own
  # verdict, not the negative one.
  # ⚠ `existing` deliberately does NOT carry $NOT_EXTENSION_OWNED, and the asymmetry is the point.
  # It answers "does an object of this name exist in the catalog" — a catalog fact — where `live`
  # answers "is it in THIS ARM'S DOMAIN". Excluding extension objects here would turn a backlog
  # line naming one from `outofdomain` (keep it) into `prunable` (delete it), which is precisely
  # the prune-on-absence failure the partition below was built to stop.
  local existing="$WORK/census_existing.txt"
  { psql_c -c "
      select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('app','public','authz');"
    psql_c -c "
      select c.relname||'.'||pol.polname||' ('||
             (case pol.polcmd when 'r' then 'SELECT' when '*' then 'ALL' when 'a' then 'INSERT'
                              when 'w' then 'UPDATE' when 'd' then 'DELETE' end)||')'
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public';"
  } | grep -vE '^[[:space:]]*$' | sort -u > "$existing"

  # THREE states, not two.
  #
  # ⛔ PROVENANCE, corrected 2026-08-25 — the third state was added on the strength of a FALSE
  # measurement, and the correction is worth more than the state. A census run listed
  # `app._set_participant_patient_unchecked` as "safe to prune"; that was read as a rename to
  # `public.set_participant_patient`, and the backlog line was re-pointed. The function had NOT
  # been renamed. The run was made against a LOCAL DB THAT HAD NOT BEEN RESET and was missing six
  # functions the backlog names; on a fresh reset all six are present, byte-identical.
  # ⭐ The partition is kept anyway, because it is right for a reason that does not depend on that
  # episode: "outside this arm's domain" and "does not exist" are different facts, and only the
  # first is what `live` can decide — `live` is THIS ARM'S DOMAIN, not the catalog. And the RE-POINT
  # bucket plus the rename caveat are exactly what would have stopped the false conclusion from
  # being actioned: prune-on-absence is how a live door's unswept record gets deleted.
  # ⚠ Absence measured against a stale DB is not absence. `ARM=floor` reads 110 never-called doors
  # on a stale DB and 72 on a fresh one — same day, same machine.
  local ghostfile names prunable outofdomain repoint g
  ghostfile="$WORK/census_ghosts.txt"; names="$WORK/census_names.txt"
  comm -13 "$live" <(allow_body "$UNSWEPT" | sort -u) > "$ghostfile"
  if [ -s "$ghostfile" ]; then
    sed -E 's/\(.*$//' "$existing" | sort -u > "$names"
    outofdomain=$(comm -12 "$existing" "$ghostfile")
    repoint=""; prunable=""
    while IFS= read -r g; do
      grep -Fxq "$g" "$existing" && continue
      if grep -Fxq "${g%%(*}" "$names"; then repoint="${repoint}${g}"$'\n'
      else prunable="${prunable}${g}"$'\n'; fi
    done < "$ghostfile"
    if [ -n "$outofdomain" ]; then
      echo "  note: backlog entries that ARE live but fall OUTSIDE this arm's domain"
      echo "        (see the domain lines above) — ⛔ KEEP THEM: still unswept, and this"
      echo "        arm cannot match them, which is not the same as their being absent:"
      echo "$outofdomain" | sed 's/^/      /'
    fi
    if [ -n "$repoint" ]; then
      echo "  note: backlog entries whose FUNCTION NAME is live but whose ARGUMENTS changed"
      echo "        — ⛔ RE-POINT the line to the new signature; do NOT prune it:"
      printf '%s' "$repoint" | grep -v '^$' | sed 's/^/      /'
    fi
    if [ -n "$prunable" ]; then
      echo "  note: backlog entries with no function of that NAME anywhere in app/public."
      echo "        ⚠ Confirm the gate was DROPPED and not RENAMED before deleting a line —"
      echo "        this check cannot tell those apart, and under a rename the unswept"
      echo "        subject is still live under another name:"
      printf '%s' "$prunable" | grep -v '^$' | sed 's/^/      /'
    fi
  fi
}

# ════════════════════════════════════════════════════════════════════════════════
# ARM 4 — ACT HAT-BLINDNESS (ADR 0106 Stage 4). A caller-bound raw memberships
# read with no adjacent active-role condition is D5's fail-open wearing a green
# check; the census cannot see it (active_role() returns text, and hat-blindness
# is not keystone coverage). The sweep proves its own detector on every run
# (planted blind/covered/class-4 function specimens, a blind/covered
# cross-table POLICY pair + a neutralized-anchor flip) and
# compares findings against act-hat-blind-allowlist.txt in BOTH directions
# (new finding AND ghost entry each fail).
# ════════════════════════════════════════════════════════════════════════════════
run_arm_hat () {
  bash "$HERE/act-hat-blind-sweep.sh" || RC=1
}

# ════════════════════════════════════════════════════════════════════════════════
# ARM 5 — INVOKER-WRAPPER BLIND ⊆ ALLOWLIST (AUDIT-INVOKER-WRAPPER)
# The `prosecdef = f` half of the surface. Structurally identical to ARM 1, over a
# domain ARMs 1–3 each excluded by construction.
# ════════════════════════════════════════════════════════════════════════════════
run_arm_wrapper () {
  echo "=== ARM 5: invoker-wrapper BLIND ⊆ allowlist ==="
  local blinds="$WORK/invariant_blinds_invoker.txt"

  if [ "$FROMFINDINGS" = "1" ]; then
    echo "  mode: FROMFINDINGS (comparing COMMITTED findings md, no sweep)"
    blind_from_findings "$INV_FINDINGS" | sort -u > "$blinds"
  else
    echo "  mode: FULL SWEEP (invoker) — ~25 min"
    # ⛔ CASES= cleared explicitly — see the same guard in ARM 1: an exported CASES would
    # make the child sweep a SUBSET whose narrower BLIND set reads here as a clean pass.
    [ -n "${CASES:-}" ] && echo "  ⚠ CASES=\"$CASES\" is set in the environment — IGNORED here; this mode is a FULL sweep."
    ( cd "$ROOT" && CASES= bash "$HERE/p0-authz-invoker-audit.sh" ) || { echo "  *** invoker sweep failed"; RC=1; }
    awk -F'\t' 'NR>1{print $2}' "$WORK/blinds_invoker.tsv" 2>/dev/null | sort -u > "$blinds"
  fi

  local n; n=$(wc -l < "$blinds" | tr -d '[:space:]')
  echo "  BLIND set size: $n"
  local offenders
  offenders=$(comm -23 "$blinds" <(allow_body "$INV_ALLOW" | sort -u))
  if [ -n "$offenders" ]; then
    echo "  *** INVARIANT VIOLATED — BLIND wrappers NOT in the allowlist:"
    echo "$offenders" | sed 's/^/      /'
    echo "  Fix: add a mutation-proven keystone (preferred) or, if a genuine backstop,"
    echo "       add the line to $INV_ALLOW with justification."
    RC=1
  else
    echo "  OK: every BLIND wrapper is on the allowlist."
  fi
  local stale
  stale=$(comm -13 "$blinds" <(allow_body "$INV_ALLOW" | sort -u))
  if [ -n "$stale" ]; then
    echo "  note: allowlist entries no longer BLIND (now COVERED — prune when convenient):"
    echo "$stale" | sed 's/^/      /'
  fi
}


# ════════════════════════════════════════════════════════════════════════════════
# ARM 6 — CATALOG COMPLETENESS (AE4.7, plan § AE4.7)
#
# Every role the catalog claims AUTHORITY over must have the two artifacts that make
# that claim checkable: a PO-APPROVED permission matrix, and a differential suite that
# asserts catalog == matrix.
#
# ⛔ WHY THIS IS AN ARM AND NOT A CHECKLIST. `authz.roles.state` is a single UPDATE.
# AE5 substitutes eleven more roles, and the cheapest possible AE5 increment is the flip
# alone — at which point `authz.holds_role` starts answering TRUE for that role platform
# wide with NO approved matrix behind it and NO oracle comparing the two. That is not a
# hypothetical shape: the flip already IS the cutover (405 §6.3 rehearses it in three
# lines), which is exactly what makes it cheap enough to do by accident.
#
# ⚠ THIS ARM PROVES THE ARTIFACTS EXIST, NOT THAT THEY ARE RIGHT. The oracle inside 403
# is what compares catalog to matrix; this only refuses the state where there is nothing
# to compare against. Both statements belong in any gate record that cites it.
# ════════════════════════════════════════════════════════════════════════════════
role_matrix_file () {   # $1 = role code -> path or empty
  local slug; slug="$(printf '%s' "$1" | tr '_' '-')"
  ls "$ROOT"/docs/design/authz-*"$slug"-permission-matrix.md 2>/dev/null | head -1
}

# ⛔ BOUNDED BY THE ORACLE'S OWN ARTIFACT, NOT BY A FILENAME. The first draft of this
# globbed `*differential*.sql` and took the first hit — which matched
# `392_ae23a_widening_differential.sql`, the AFF widening differential, purely because it
# happens to mention 'staff_admin' once and sorts first. It reported OK for the right role
# against the wrong file: a check passing for a reason unrelated to what it claims.
# The property is "a suite that compares the CATALOG to the APPROVED MATRIX", and the
# checkable trace of that is the expected-value table the oracle reads. Every match is
# printed, so a second suite claiming the role is visible rather than swallowed by head -1.
role_differential_suite () {   # $1 = role code -> path(s) or empty
  grep -lF "'$1'" $(grep -lF 'authz_differential_cells' "$ROOT"/supabase/tests/*.sql 2>/dev/null) 2>/dev/null
}

run_arm_catalog () {
  echo "=== ARM 6: catalog completeness — every non-legacy role has a matrix + a differential ==="
  local roles n=0 r mx diff_suite
  roles="$(psql_c -c "select code from authz.roles where state <> 'legacy' order by 1;" | grep -vE '^$')"
  if [ -z "$roles" ]; then
    echo "  *** NO NON-LEGACY ROLE IN authz.roles — the catalog owns nothing."
    echo "  ⛔ Not a pass. AE4.6 flipped staff_admin to authoritative; a zero here means the"
    echo "     cutover was reverted, or this arm is pointed at the wrong database."
    RC=1
    return 1
  fi
  for r in $roles; do
    n=$((n+1))
    mx="$(role_matrix_file "$r")"
    if [ -z "$mx" ]; then
      echo "  *** $r is non-legacy but has NO permission matrix"
      echo "      expected: docs/design/authz-*$(printf '%s' "$r" | tr '_' '-')-permission-matrix.md"
      RC=1
    elif ! grep -qE 'status:..*PO-APPROVED' "$mx"; then
      echo "  *** $r's matrix exists but carries NO PO-APPROVED status line: ${mx#$ROOT/}"
      echo "      An unapproved matrix is a draft; the oracle would be asserting catalog == draft."
      RC=1
    else
      echo "  OK: $r -> ${mx#$ROOT/} (PO-APPROVED)"
    fi
    diff_suite="$(role_differential_suite "$r")"
    if [ -z "$diff_suite" ]; then
      echo "  *** $r has NO differential-oracle suite naming it"
      echo "      (a supabase/tests/*.sql reading authz_differential_cells AND quoting the role)"
      echo "      A matrix is only an oracle if something compares the catalog to it."
      RC=1
    else
      printf '%s
' "$diff_suite" | sed "s|^$ROOT/|  OK: $r -> |"
    fi
  done
  echo "  roles in non-legacy state: $n (DERIVED this run — never a frozen figure)"

  # ⭐ VACUITY CONTROL. Both lookups above are "does a file exist" tests, and a lookup
  # that can only ever succeed is not a check. Probe a role code that cannot have
  # artifacts and assert BOTH lookups come back empty — otherwise a glob that had started
  # matching everything (or a $ROOT that resolved wrong) would report OK for every role.
  local probe='zzz_no_such_role'
  if [ -n "$(role_matrix_file "$probe")" ] || [ -n "$(role_differential_suite "$probe")" ]; then
    echo "  *** VACUITY CONTROL FAILED — the synthetic role $probe resolved an artifact."
    echo "      Every OK above is therefore unreliable: the lookups match regardless of input."
    RC=1
  else
    echo "  vacuity control: OK (a synthetic role resolves NEITHER artifact)"
  fi
}

# ════════════════════════════════════════════════════════════════════════════════
# ARM 7 — WRAPPER COVERAGE (AE4.7, plan § AE4.7 — "the AE4.6 census re-run")
#
# For every role the catalog owns, EVERY site naming that role must be either the wrapper
# family or an allowlisted value-use. Anything else names the role directly and therefore
# does not go through the catalog — a bypass, which is the one thing a cutover exists to
# eliminate.
#
# ⛔ THIS IS A HAND CENSUS TURNED INTO AN ASSERTION. AE4.6 did it once, in a migration
# header: 13 sites, 1 replaced, 12 allowlisted. A hand census is true at a moment. It goes
# false silently the first time anyone adds a role-literal comparison to a new door — and
# `role = 'staff_admin'` is a proper SUBSTRING of `signoff_role = 'staff_admin'`, so the
# two vocabularies are one careless grep apart (a collision that was LIVE in
# save_section_answers until M15 removed it).
#
# ⚠ BOUND, STATED: this matches the QUOTED CODE in comment-stripped source. A site that
# reached the same decision through a variable, a join to authz.roles, or a computed
# string is invisible here — the same text-vs-property admission every regex-bounded arm
# in this file carries. It is a strong signal, never a proof of absence.
# ════════════════════════════════════════════════════════════════════════════════
# ⛔ THE ROLE CODE IS SANITIZED AND INLINED, NOT PASSED AS A psql VARIABLE. The first
# draft used `psql -v r=... :'r'`, which psql does NOT interpolate inside `-c`: BOTH
# queries died with `syntax error at or near ":"`, every lookup returned empty — and the
# arm reported `OK: staff_admin — 0 site(s)` AND `vacuity control: OK`. A broken query
# satisfies a set-difference check and a negative control at the same time. That is why
# the control below is now a PAIR.
role_literal_sites () {   # $1 = role code -> one site per line, sorted
  local safe; safe="$(printf '%s' "$1" | tr -cd 'a-z0-9_')"
  [ -z "$safe" ] && return 0
  { psql_c -c "
      select n.nspname||'.'||p.proname
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('app','public','authz')
         and position('''$safe''' in regexp_replace(p.prosrc, '--[^'||chr(10)||']*', '', 'g')) > 0
       order by 1;"
    psql_c -c "
      select c.relname||'.'||pol.polname
        from pg_policy pol
        join pg_class c on c.oid = pol.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and position('''$safe''' in (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')
              || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''))) > 0
       order by 1;"
  } | grep -vE '^$' | sort -u
}

run_arm_sites () {
  echo "=== ARM 7: wrapper coverage — every site naming a catalog-owned role is a wrapper or allowlisted ==="
  local roles r sites offenders n_sites stale
  roles="$(psql_c -c "select code from authz.roles where state <> 'legacy' order by 1;" | grep -vE '^$')"
  if [ -z "$roles" ]; then
    echo "  *** no non-legacy role — see ARM 6"
    RC=1
    return 1
  fi

  # The wrapper family, DERIVED: the app/public functions that delegate to the chokepoint.
  # ⛔ Never a hand-typed pair of names — AE5 adds a family per role, and a frozen list
  # would make each new family read as a BYPASS while each retired one read as coverage.
  local family="$WORK/arm7_family.txt"
  psql_c -c "
    select n.nspname||'.'||p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app','public')
       and regexp_replace(p.prosrc, '--[^'||chr(10)||']*', '', 'g') ~ '\mholds_role\M'
     order by 1;" | grep -vE '^$' | sort -u > "$family"
  echo "  wrapper family (delegates to authz.holds_role): $(wc -l < "$family" | tr -d '[:space:]')"
  if [ ! -s "$family" ]; then
    echo "  *** THE WRAPPER FAMILY IS EMPTY — nothing delegates to authz.holds_role."
    echo "  ⛔ Not a pass: with an empty family every real wrapper below reads as a BYPASS,"
    echo "     and an arm reporting offenders because its own baseline vanished is noise."
    RC=1
    return 1
  fi

  local allowed="$WORK/arm7_allowed.txt"
  cat "$family" <(allow_body "$ROLE_LITERAL_ALLOW") | sort -u > "$allowed"

  for r in $roles; do
    sites="$WORK/arm7_sites.txt"
    role_literal_sites "$r" > "$sites"
    n_sites=$(wc -l < "$sites" | tr -d '[:space:]')
    offenders="$(comm -23 "$sites" "$allowed")"
    if [ -n "$offenders" ]; then
      echo "  *** $r: site(s) naming the role that are NEITHER wrapper family NOR allowlisted:"
      printf '%s\n' "$offenders" | sed 's/^/      /'
      echo "  Fix: route the site through the wrapper family, or — if the literal is a VALUE"
      echo "       (config, administered argument, display label, a set that is ITERATED and"
      echo "       never BRANCHED ON) — add it to $ROLE_LITERAL_ALLOW with the reason AND the"
      echo "       condition that would make the entry wrong. ⛔ Never add a line to go green."
      RC=1
    else
      echo "  OK: $r — $n_sites site(s), all wrapper-family or allowlisted."
    fi
  done

  # ⭐⭐ VACUITY CONTROL — A PAIR, AND THE PAIRING IS THE WHOLE POINT.
  #
  # This arm's verdict is a set DIFFERENCE, which is empty when everything is accounted
  # for AND when the left-hand side collapsed. A NEGATIVE control alone does not separate
  # them: measured on this arm's own first run, a malformed query returned nothing for
  # every input, and the arm printed `OK: staff_admin — 0 site(s)` beside
  # `vacuity control: OK`. Both halves passed BECAUSE the instrument was dead.
  #
  #   DISCRIMINATION (positive) — a real catalog-owned role must resolve at least one site.
  #                               The wrapper family alone guarantees this: those two
  #                               bodies quote the code. A zero here means the lookup is
  #                               broken, never that the tree is clean.
  #   NEGATIVE                  — a role code no body can contain must resolve none.
  local disc; disc="$(role_literal_sites "$(printf '%s' "$roles" | head -1)")"
  if [ -z "$disc" ]; then
    echo "  *** DISCRIMINATION CONTROL FAILED — a LIVE catalog-owned role matched NO site."
    echo "      The wrapper family quotes its own role code, so this cannot be true of a"
    echo "      working lookup. Every OK above is the instrument failing, not the tree passing."
    RC=1
  elif [ -n "$(role_literal_sites 'zzz_no_such_role')" ]; then
    echo "  *** NEGATIVE CONTROL FAILED — a synthetic role code matched live sites."
    echo "      The literal match is not discriminating; every OK above is unreliable."
    RC=1
  else
    echo "  vacuity control: OK (a live role matches sites; a synthetic role matches none)"
  fi

  # Allowlist rot, BOTH directions (the FUP-AUTHZ-ALLOWLIST-ROT lesson, applied on arrival
  # instead of three weeks later): an entry naming a site that no longer carries ANY
  # catalog-owned role's literal is a claim about nothing, and a claim about nothing reads
  # as coverage.
  local all_sites="$WORK/arm7_all_sites.txt"
  : > "$all_sites"
  for r in $roles; do role_literal_sites "$r" >> "$all_sites"; done
  sort -u "$all_sites" -o "$all_sites"
  stale="$(comm -13 "$all_sites" <(allow_body "$ROLE_LITERAL_ALLOW" | sort -u))"
  if [ -n "$stale" ]; then
    echo "  *** ALLOWLIST ROT — entries naming a site that carries no catalog-owned role literal:"
    printf '%s\n' "$stale" | sed 's/^/      /'
    echo "  Fix: delete the entry, or re-key it if the site was renamed. An allowlist entry is"
    echo "       a claim about a live site; a claim about nothing reads as coverage."
    RC=1
  else
    echo "  OK: every role-literal allowlist entry resolves to a live site."
  fi
}

echo "=== PREFLIGHT: no gate is sitting degenerate (FUP-AUTHZ-HARNESS-TRANSACTIONAL) ==="
check_no_degenerate_gates && echo "  clean — 0 degenerate bodies in app+public (all three forms)"
echo

case "$ARM" in
  policy)  run_arm_policy ;;
  floor)   run_arm_floor ;;
  census)  run_arm_census ;;
  hat)     run_arm_hat ;;
  wrapper) run_arm_wrapper ;;
  catalog) run_arm_catalog ;;
  sites)   run_arm_sites ;;
  all)     run_arm_policy; echo; run_arm_floor; echo; run_arm_census; echo; run_arm_hat
           echo; run_arm_wrapper; echo; run_arm_catalog; echo; run_arm_sites ;;
  *) echo "unknown ARM=$ARM (use policy|floor|census|hat|wrapper|catalog|sites|all)"; exit 2 ;;
esac

echo
[ "$RC" = 0 ] && echo "=== INVARIANT HOLDS ===" || echo "=== INVARIANT VIOLATED (see above) ==="
exit $RC
