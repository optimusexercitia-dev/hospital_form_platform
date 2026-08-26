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

check_no_degenerate_gates () {
  local hits
  hits=$(psql_c -c "
    select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') ['||l.lanname||
           case when p.prosecdef then ', DEFINER' else '' end||']'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
     where n.nspname in ('app','public') and $DEGENERATE_PREDICATE
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
  live_sigs=$(psql_c -c "
    select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app','public');" | sort -u)
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

# ════════════════════════════════════════════════════════════════════════════════
# ARM 3 — CENSUS CLOSURE (the sixteenth-stopper)
# ════════════════════════════════════════════════════════════════════════════════
run_arm_census () {
  echo "=== ARM 3: census closure — every gate IN THIS ARM'S DOMAIN carries a verdict ==="
  echo "    domain: prosecdef bool | prosecdef set-returning+reachable | public INVOKER plpgsql | all RLS policies"
  echo "    NOT in domain: prosecdef scalar non-bool command doors (407 reachable) — FUP-AUTHZ-COMMAND-DOOR-UNSWEPT"
  local live="$WORK/census_live.txt" accounted="$WORK/census_accounted.txt"

  # LIVE domain, from the catalog and nothing else (never migration text). Deliberately
  # WIDER than either sweep's own worklist: ALL prosecdef boolean functions in app/public
  # (no name-prefix filter — `capa_viewer_can_manage` and `member_can` are real gates the
  # door audit's `^(is_|can_|has_)` regex has never had in scope) and ALL RLS policies
  # (every polcmd — the door arm sees only SELECT/ALL, the write arm only its snapshot).
  #
  # ⚠ AND every authenticated-reachable DEFINER that RETURNS ROWS. Added 2026-08-05 after
  # BUG-AUTHZ-002: `hospital_document_register` and `hospital_indicator_rollup` are
  # `prosecdef` doors returning TABLE(...), so a boolean-only census could not see them —
  # and they were leaking commission content to platform_admin the whole time this arm
  # claimed to close the enumeration hole. The justification is CLAUDE.md's own standing
  # rule: a DEFINER's gate REPLACES RLS, so for these the internal gate IS the entire
  # boundary. A boolean predicate is a gate you can neutralize; a row-returning door is a
  # gate you can walk through.
  { psql_c -c "
      select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type      t on t.oid = p.prorettype
      where n.nspname in ('app','public') and p.prosecdef
        and (t.typname = 'bool'
             or (p.proretset and has_function_privilege('authenticated', p.oid, 'EXECUTE')));"
    # ⚠ AND every authenticated-reachable PUBLIC INVOKER plpgsql function
    # (AUDIT-INVOKER-WRAPPER). Added with ARM 5. Note what changes here: every OTHER
    # clause in this census is bounded by `p.prosecdef`, and so were all three sweeps —
    # which is exactly why this class had no verdict in any direction. A `prosecdef = f`
    # wrapper whose own hand-written probe is the only gate in front of an `app` DEFINER
    # body is an authorization decision by any honest reading, and until this line it was
    # not in the enumeration at all. Widening ARM 5 without widening the census would let
    # a NEW wrapper pass ARM 5 by simply being absent from the findings md.
    psql_c -c "
      select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'
        and l.lanname = 'plpgsql'
        and has_function_privilege('authenticated', p.oid, 'EXECUTE');"
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
    # DEFINER clause above admits `bool` and set-returning returns only, so 407 reachable
    # non-trigger COMMAND doors (326 of them public/RPC-callable — create_case, assume_role,
    # add_referral_shared_item …) are in no arm's domain at all. A 3-door neutralization
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
  local existing="$WORK/census_existing.txt"
  { psql_c -c "
      select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('app','public');"
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

echo "=== PREFLIGHT: no gate is sitting degenerate (FUP-AUTHZ-HARNESS-TRANSACTIONAL) ==="
check_no_degenerate_gates && echo "  clean — 0 degenerate bodies in app+public (all three forms)"
echo

case "$ARM" in
  policy)  run_arm_policy ;;
  floor)   run_arm_floor ;;
  census)  run_arm_census ;;
  hat)     run_arm_hat ;;
  wrapper) run_arm_wrapper ;;
  all)     run_arm_policy; echo; run_arm_floor; echo; run_arm_census; echo; run_arm_hat
           echo; run_arm_wrapper ;;
  *) echo "unknown ARM=$ARM (use policy|floor|census|hat|wrapper|all)"; exit 2 ;;
esac

echo
[ "$RC" = 0 ] && echo "=== INVARIANT HOLDS ===" || echo "=== INVARIANT VIOLATED (see above) ==="
exit $RC
