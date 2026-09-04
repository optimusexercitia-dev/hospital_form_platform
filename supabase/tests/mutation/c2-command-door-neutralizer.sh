#!/usr/bin/env bash
# c2-command-door-neutralizer.sh — the missing arm for Critical FUP C2.
#
# ============================================================================
# WHY THIS EXISTS
#
# Every existing authz sweep neutralizes a BOOLEAN gate (`p0-authz-door-audit.sh`
# rewrites a predicate to `select true`) or a policy `USING` clause. C2's command
# doors return jsonb / uuid / void / a composite — there is no boolean to flip, so
# they sat in no arm's domain (ADR 0079; FUP-AUTHZ-COMMAND-DOOR-UNSWEPT).
#
# ⭐ THE UNIT OF WORK IS THE ENFORCER, NOT THE DOOR. Measured 2026-08-31 over the
# 237 Tier-1 doors: 243 distinct enforcers in their delegation closures, of which
# 72 are already inside the bool arm's domain and 171 are not. Those 171 are this
# harness's worklist; the door list is the ATTRIBUTION map, not the work list.
# Sweeping per door would re-run the same mutation dozens of times.
#
# THE MUTATION: an authz `raise` becomes `null;` — the guard stops firing while the
# function's EFFECT is left intact.
# ⛔ This distinction is the whole design. Stubbing a delegating door's body (e.g.
# `public.grant_role`, whose entire body is `perform app.grant_role_impl(...)`)
# would remove the WORK as well as the GUARD, and the suite would then fail because
# nothing happened — a FALSE COVERED. Neutralize the guard; never the effect.
#
# VERDICTS
#   COVERED   — mutated run FAILS and the restored run PASSES (a keystone noticed)
#   BLIND     — mutated run PASSES (nothing in the suite notices the guard vanish)
#   ERROR     — run shape changed, or the target could not be fully neutralized.
#               ⛔ ERROR IS NOT A PASS. It is an obligation.
#
# USAGE
#   bash supabase/tests/mutation/c2-command-door-neutralizer.sh
#   CASES="app.assert_rca_writable app.assert_capa_writable" bash …   # subset
#   SELFTEST=1 bash …        # prove the harness before trusting it (see § SELF-TEST)
#   SUITE=supabase/tests/385_x.sql bash …    # one suite file instead of the full run
#
# ⚠ FULL RUN COST: 171 enforcers x 2 suite runs = 342 runs. ⛔ The per-run figure in this header
#   has been stale twice; RE-MEASURE IT, never quote it. History: "~23 s" (design-doc estimate,
#   never measured) -> 53 s (measured 2026-09-02, Files=259 Tests=8685) -> ~100 s (measured
#   2026-09-04: 11 suite runs in 19m05s wall, Files=262 Tests=8764, fresh reset). The suite grows,
#   so the cost grows with it. At ~100 s a run that is ~9.5 h MINIMUM, not the ~2.2 h this header
#   used to claim -- a 4x under-estimate that survived because nobody re-timed it.
#   This is a periodic audit, never a phase step.
# ============================================================================

set -u   # NOT -e: a failing suite run is DATA here, not an abort.

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DB="${C2_DB:-supabase_db_azkbbhskturikxpgmafq}"
WORK="${WORK:-${TMPDIR:-/tmp}/c2-neutralizer}"
CASES="${CASES:-}"
SELFTEST="${SELFTEST:-0}"
SUITE="${SUITE:-}"

# ⛔ The scratch dir is asserted writable. A committed Windows-only default once made
# an arm compare two empty files and print a clean result having measured nothing.
mkdir -p "$WORK" 2>/dev/null || { echo "FATAL: cannot mkdir $WORK" >&2; exit 2; }
: > "$WORK/.writable" 2>/dev/null || { echo "FATAL: $WORK not writable" >&2; exit 2; }

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
psql_f () { # run a local .sql file inside the container (avoids shell-quoting SQL bodies)
  # ⛔ NO MSYS_NO_PATHCONV on `docker cp`: the HOST path must convert, while `docker exec`
  #    must not. Setting it here made docker look for C:\tmp and the run died at derivation.
  #
  # ⛔ -v ON_ERROR_STOP=1 IS LOAD-BEARING, added 2026-09-04. Without it psql exits 0 on a SQL
  #    ERROR, so EVERY caller that reads this function's exit status reads a constant. That is
  #    the whole reason the restore below can be "verified by its exit code" and mean nothing:
  #    measured on this file before the fix, `select 1/0;` through psql_f exited 0. C2 was the
  #    ONLY authz harness missing it — p0-authz-door-audit.sh:187, p0-authz-writepath-audit.sh:281,
  #    p0-authz-invoker-audit.sh:200 and p0-authz-rowdoor-audit.sh:146 all carry it.
  #    ⚠ It changes the EXIT CODE only, never the output: mutate() below reads this function's
  #    stdout+stderr as DATA into $MUT_ERR, and that text is unaffected.
  docker cp "$1" "$DB:/tmp/_c2mut.sql" >/dev/null || return 1
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off \
    -v ON_ERROR_STOP=1 -f //tmp/_c2mut.sql
}

# ADR 0153 — a subset run NEVER writes the committed baseline.
FINDINGS_COMMITTED="$ROOT/docs/reviews/c2-command-door-findings.md"
if [ -n "$CASES" ] || [ "$SELFTEST" = "1" ]; then
  SUBSET=1; FINDINGS="$WORK/c2-command-door-findings.SUBSET.md"
else
  SUBSET=0; FINDINGS="$FINDINGS_COMMITTED"
fi
BASELINE_SUM="$( [ -f "$FINDINGS_COMMITTED" ] && cksum < "$FINDINGS_COMMITTED" || echo ABSENT )"
verify_baseline_untouched () {
  [ "$SUBSET" = "1" ] || return 0
  local now; now="$( [ -f "$FINDINGS_COMMITTED" ] && cksum < "$FINDINGS_COMMITTED" || echo ABSENT )"
  [ "$now" = "$BASELINE_SUM" ] && { echo "    committed baseline VERIFIED unchanged (cksum)"; return 0; }
  echo "*** FATAL: the COMMITTED baseline CHANGED during a subset run: $FINDINGS_COMMITTED" >&2
  return 1
}

# Crash safety: the restore SQL is written BEFORE the mutation and replayed on any exit.
# ⛔ Fixed path, deliberately NOT under $WORK — a $WORK-relative sentinel is invisible
#    to the next run when WORK is unique per run.
INFLIGHT="${C2_INFLIGHT:-${TMPDIR:-/tmp}/c2-neutralizer-INFLIGHT.sql}"
restore_inflight () {
  [ -s "$INFLIGHT" ] || return 0
  echo "    !! INFLIGHT mutation found — restoring $INFLIGHT" >&2
  psql_f "$INFLIGHT" >/dev/null 2>&1
  : > "$INFLIGHT"
}
trap 'restore_inflight; verify_baseline_untouched || exit 2' EXIT
trap 'restore_inflight; exit 2' INT TERM HUP
restore_inflight   # replay anything a previous killed run left behind

# ---------------------------------------------------------------- preflight
# A degenerate body means a previous harness died mid-mutation. Every verdict below
# would be measured against a tree that is already open.
DEGEN="$(psql_c -c "
  select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('app','public')
    and ( p.prosrc ~ '^\s*begin\s+return\s+(true|false)\s*;\s*end'
       or p.prosrc ~ '^\s*select\s+(true|false)\s*;?\s*\$'
       or p.prosrc ~ '^\s*begin\s+return\s*;\s*end' );")"
if [ "${DEGEN:-0}" != "0" ]; then
  echo "*** PREFLIGHT FAILED: $DEGEN function(s) have a degenerate body — a previous" >&2
  echo "    mutation did not roll back. Fix that before trusting any verdict." >&2
  exit 2
fi

# ---------------------------------------------------------------- worklist (DERIVED)
# ⛔ Derived as a property every run, never hand-listed (the C2 method rule).
cat > "$WORK/worklist.sql" <<'SQL'
drop schema if exists c2n cascade; create schema c2n;
create table c2n.fns as
select p.oid, n.nspname sch, p.proname nm,
       n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' label,
       regexp_replace(p.prosrc,'--[^\n]*','','g') body,
       (p.prorettype='pg_catalog.bool'::regtype) is_gate
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','public');
create table c2n.roots as
select f.oid from c2n.fns f join pg_proc p on p.oid=f.oid
where p.prosecdef and p.prorettype<>'pg_catalog.trigger'::regtype and not p.proretset
  and p.prorettype<>'pg_catalog.bool'::regtype
  and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE'));
create table c2n.edges as
select distinct a.oid caller,b.oid callee,b.is_gate from c2n.fns a join c2n.fns b
  on a.oid<>b.oid and a.body ~ ('\m'||b.nm||'\M\s*\(');
create table c2n.rels as select c.oid reloid,c.relname nm from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','app') and c.relkind in ('r','p','v','m');
create table c2n.fn_rel as select distinct f.oid fnoid,r.reloid from c2n.fns f
  join c2n.rels r on f.body ~ ('\m'||r.nm||'\M');
-- Tier 1 = gate-aware closure reaches a PHI-marked relation (the re-grained predicate)
create table c2n.clo_gate as
with recursive w(root,fn,d) as (select r.oid,r.oid,0 from c2n.roots r
  union select w.root,e.callee,w.d+1 from w join c2n.edges e on e.caller=w.fn where w.d<8 and not e.is_gate)
select distinct root,fn from w;
create table c2n.m_phi as
select distinct c.oid reloid from pg_class c join pg_namespace n on n.oid=c.relnamespace
  left join pg_description d on d.objoid=c.oid
where n.nspname in ('public','app') and c.relkind in ('r','p','v','m')
  and ( not has_table_privilege('authenticated',c.oid,'SELECT')
     or (d.objsubid>0 and d.description ~* 'phi[- ]bearing|isolated phi')
     or (d.objsubid=0 and d.description ~* 'isolated phi|phi[- ]bearing|class[- ]1 phi'));
create table c2n.tier1 as
select distinct r.oid from c2n.roots r join c2n.clo_gate cl on cl.root=r.oid
  join c2n.fn_rel fr on fr.fnoid=cl.fn where fr.reloid in (select reloid from c2n.m_phi);
-- full closure (gate edges INCLUDED): where a door's authority actually lives
create table c2n.clo_full as
with recursive w(root,fn,d) as (select r.oid,r.oid,0 from c2n.roots r
  union select w.root,e.callee,w.d+1 from w join c2n.edges e on e.caller=w.fn where w.d<8)
select distinct root,fn from w;
-- ⛔ THIS FILTER IS THE POPULATION, AND IT IS DELIBERATELY NOT THE ANCHOR. It admits any body
--    that MENTIONS an errcode of the class; the anchor decides what can be neutralized. Widening
--    or narrowing it changes WHO IS IN THE 171 and therefore invalidates every verdict already
--    recorded against that denominator — so the 2026-09-04 anchor fix leaves it untouched, and
--    it is measurably not the constraint on either side:
--      · it is a strict superset of the mutable set — 0 functions in the whole public+app
--        catalog are admitted here yet unmutable by the new anchor (nraise = nanchored for all);
--      · it excludes none of the `HCDS*`/`28000` lane — all 8 of those functions also raise an
--        anchored 42501, so all 8 match (ADR 0187 C3; the 4 that are absent from the 171 are
--        absent for a Tier-1 MEMBERSHIP reason, which no anchor change can reach).
create table c2n.gatefn as
select f.oid from c2n.fns f
where f.body ~* 'errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})'''
   or (f.is_gate and f.nm ~ '^(is_|can_|has_|member_can)');
-- THE WORKLIST: enforcers reachable from a Tier-1 door and OUTSIDE the bool arm's domain
-- Column 5 `nraise`   = how many errcodes of the class the body carries (the denominator).
-- Column 6 `nanchored`= how many of them THE MUTATION ANCHOR can consume. The UNMUTABLE guard
--   (~line 265) refuses a verdict when the two disagree, so column 6 MUST be the anchor itself,
--   byte-for-byte the regex in mutate(). Until 2026-09-04 it was a PROXY — "an errcode followed
--   by a `;`" — which is neither the anchor nor a bound on it: it let 5 of the 171 past the guard
--   whose mutation then could not land (`set_referral_patient`, `set_professional_link_state`,
--   `mint_printed_document`, `log_document_previa`, `delete_ad_hoc_case_narrative`) while
--   refusing 1 it could have mutated (`save_block_to_library`). With the anchor here the guard
--   and mutate()'s own v_after check agree BY CONSTRUCTION rather than by luck: measured
--   2026-09-04, nraise = nanchored for all 171 and for all 1081 public+app functions.
-- ⛔ Do NOT dollar-quote these: psql's \copy parser rejects `$re$…$re$` with "parse error at end
--    of line". The quotes are doubled by hand here and in mutate(); keep the two in lockstep.
\copy (select p.oid, n.nspname||'.'||p.proname, n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', (select count(distinct c.root) from c2n.clo_full c join c2n.tier1 t on t.oid=c.root where c.fn=p.oid), (select count(*) from regexp_matches(regexp_replace(p.prosrc,'--[^\n]*','','g'),'errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})''','g')), (select count(*) from regexp_matches(regexp_replace(p.prosrc,'--[^\n]*','','g'),'raise\s+exception\s+''(?:[^'']|'''')*''[^;]*?errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})''[^;]*;','g')) from (select distinct c.fn from c2n.clo_full c join c2n.tier1 t on t.oid=c.root where c.fn in (select oid from c2n.gatefn)) z join pg_proc p on p.oid=z.fn join pg_namespace n on n.oid=p.pronamespace join pg_type ty on ty.oid=p.prorettype where not (p.prosecdef and ty.typname='bool') order by 3 desc, 1) to '/tmp/c2n_worklist.tsv'
SQL
psql_f "$WORK/worklist.sql" >/dev/null || { echo "FATAL: worklist derivation failed" >&2; exit 2; }
docker cp "$DB:/tmp/c2n_worklist.tsv" "$WORK/worklist.tsv" >/dev/null \
  || { echo "FATAL: could not fetch worklist" >&2; exit 2; }
TOTAL=$(wc -l < "$WORK/worklist.tsv" | tr -d ' ')
[ "${TOTAL:-0}" -gt 0 ] || { echo "FATAL: worklist is EMPTY — refusing to report a clean run" >&2; exit 2; }

# ---------------------------------------------------------------- helpers
# ⛔ Addressed by OID, never by signature: `pg_get_function_identity_arguments` includes
#    PARAMETER NAMES ("p_rca_id uuid"), which `regprocedure` rejects outright.
hash_of () { psql_c -c "select md5(pg_get_functiondef($1::oid));"; }
snapshot () { # $1 = oid -> writes a restoring CREATE OR REPLACE to $INFLIGHT
  psql_c -c "select pg_get_functiondef($1::oid);" > "$INFLIGHT.body" 2>/dev/null || return 1
  { cat "$INFLIGHT.body"; echo ";"; } > "$INFLIGHT"
  [ -s "$INFLIGHT" ]
}
# ⛔ THE HEREDOC BELOW IS UNQUOTED (<<MUTSQL), because it must expand $1 into the oid. That means
#    bash ALSO expands backticks and $ inside it — a backtick pair in a COMMENT is run as a
#    command and its text is silently deleted from the generated SQL. Proven 2026-09-04: a
#    commented anchor explanation written with `backticks` made bash emit "raise: command not
#    found", glob into /LICENSE.txt and try to execute it, and write a mut.sql with the comment
#    gutted — while `bash -n` stayed green, because an EVEN number of backticks parses fine.
#    ⭐ So: NO backticks and NO bare $ inside this heredoc. The long-form explanation of the
#    anchor lives here, OUTSIDE it, where it is safe.
#
# THE ANCHOR (2026-09-04). Two failure modes it must survive, both live in this tree:
#   (a) a ';' INSIDE the message literal — 'encaminhamento concluído; os dados …' — which a bare
#       [^;]*? between "raise exception" and "errcode" cannot cross. Fixed by consuming the
#       message as a PROPER quoted literal first:  '(?:[^']|'')*'
#   (b) a trailing USING option list AFTER the errcode —  using errcode = 'X', detail = <expr>;
#       — which a terminating  …'\s*;  cannot cross. Fixed by  [^;]*;  in place of  \s*;
#   (a) alone (the shape recorded as "FIX VALIDATED OFFLINE 2026-09-02") leaves 5 functions
#   unmatched; the pair leaves 0. Re-measured 2026-09-04 in Postgres ARE against the LIVE catalog
#   — not against migration text, which is stale by design and whose denominator happened to
#   exclude shape (b) entirely (that is how the recorded fix read as complete):
#     errcode occurrences of the class ......... 813
#     matched by the pre-2026-09-04 anchor ..... 793   (15 functions short)
#     matched by the message-literal fix alone . 807   ( 5 functions short)
#     matched by THIS anchor ................... 813   (0 short, 0 overmatch, 0 regression)
#   Blast radius, measured as REPLACE-OUTPUT INEQUALITY over all 1081 public+app functions (not
#   as a count comparison): 21 functions differ, of which exactly 6 are in the derived 171.
#
# THE COUNTERS (v_before / v_after) DELIBERATELY DO NOT TRACK THE ANCHOR. A global
#   regexp_replace can never leave one of its OWN matches behind — the replacement 'null;'
#   carries neither a raise nor an errcode, so it cannot manufacture a new match. Counting the
#   anchor there would be a check that can only ever read 0: a DEAD INSTRUMENT wearing the name
#   of a guard. They count the CLASS instead, and UN-TERMINATED, so v_after = 0 asserts the
#   strictest available thing: NOTHING of the anchor class survives anywhere in the definition
#   text — not in a trailing USING option, not in a comment, not in a "raise notice … using
#   errcode", not in a shape this anchor has never seen. Measured 2026-09-04 over all 1081
#   public+app functions: residue after the rewrite = 0, and anchor-class errcodes inside a
#   line or block comment = 0, so the strict form does not fire spuriously on today's catalog.
#   A future body that breaks that fails CLOSED, as a visible ERROR — never as a verdict.
#
# ⛔ Quoting style is forced. The worklist \copy above must stay in lockstep with this anchor,
#    and psql's \copy parser rejects dollar-quoted strings outright ("parse error at end of
#    line", verified 2026-09-04) — so BOTH sites double their quotes by hand. Change one, then
#    re-derive the worklist and diff column 6 against column 5; they must be equal for all 171.
mutate () { # $1 = oid — rewrite EVERY anchored authz raise to a no-op
  cat > "$WORK/mut.sql" <<MUTSQL
do \$outer\$
declare
  v_def text; v_new text; v_before int; v_after int;
begin
  v_def := pg_get_functiondef($1::oid);
  -- Counters count the CLASS, un-terminated; the anchor is the line below. See the block
  -- comment above this function -- and do not put backticks in this heredoc.
  v_before := (select count(*) from regexp_matches(v_def,'errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})''','g'));
  v_new := regexp_replace(v_def,
    'raise\s+exception\s+''(?:[^'']|'''')*''[^;]*?errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})''[^;]*;',
    'null;', 'gi');
  v_after := (select count(*) from regexp_matches(v_new,'errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})''','g'));
  if v_before = 0 then raise exception 'C2MUT: nothing to neutralize'; end if;
  if v_after <> 0 then raise exception 'C2MUT: % raise(s) survived the rewrite', v_after; end if;
  execute v_new;
end
\$outer\$;
MUTSQL
  psql_f "$WORK/mut.sql" 2>&1
}
run_suite () {
  if [ -n "$SUITE" ]; then ( cd "$ROOT" && npx supabase test db "$SUITE" 2>&1 )
  else                     ( cd "$ROOT" && npx supabase test db 2>&1 ); fi
}
# A run's SHAPE, not just its pass/fail: a suite that ABORTED reports FEWER tests, and
# that is an ERROR, not a failure. ⛔ The runner is `prove`-style, NOT raw TAP — an
# earlier version grepped for '^ok/^not ok' and matched ZERO lines, which would have made
# the shape check pass vacuously for every case. "Files=N, Tests=M" is the real shape.
shape_of () { printf '%s' "$1" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1; }
verdict_of () { printf '%s' "$1" | grep -qE '^Result: PASS' && echo PASS || echo FAIL; }

# ---------------------------------------------------------------- report
PROGRESS="$WORK/progress.tsv"; : > "$PROGRESS"
emit () {
  {
    echo "# C2 command-door neutralizer — findings"
    echo
    echo "Generated by \`supabase/tests/mutation/c2-command-door-neutralizer.sh\`."
    echo "⛔ Derived per run; do not hand-edit. A subset run writes to \$WORK, never here (ADR 0153)."
    echo
    echo "| enforcer | tier1 doors depending | authz raises | verdict | note |"
    echo "| --- | ---: | ---: | --- | --- |"
    cat "$PROGRESS"
  } > "$FINDINGS"
}
record () { printf '| `%s` | %s | %s | **%s** | %s |\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"; emit; }

# ---------------------------------------------------------------- baseline
echo "=== C2 command-door neutralizer ==="
echo "    worklist: $TOTAL enforcer(s) derived  |  report: $FINDINGS"
[ "$SUBSET" = "1" ] && {
  echo "    ⛔ SUBSET RUN — writing to SCRATCH; the committed baseline is untouched (ADR 0153)."
  echo "       To fold these in, MERGE the rows; never copy this file over the baseline."
}
echo "--- capturing the unmutated baseline ---"
BASE_OUT="$(run_suite)"; BASE_V="$(verdict_of "$BASE_OUT")"; BASE_S="$(shape_of "$BASE_OUT")"
echo "    baseline: $BASE_V (shape=$BASE_S lines)"
if [ "$BASE_V" != "PASS" ]; then
  echo "*** ABORT: the suite is RED before any mutation. Every verdict below would be" >&2
  echo "    measured against a broken tree. Fix the tree, or pass SUITE= to narrow." >&2
  exit 2
fi

# ---------------------------------------------------------------- SELF-TEST
# ⛔ A mutation harness must prove its own rollback BEFORE it is trusted: the probe must
#    MOVE the hash and the restore must bring it BACK. Without this a harness that
#    silently fails to mutate reports BLIND for everything and reads like a clean sweep.
if [ "$SELFTEST" = "1" ]; then
  echo "--- SELF-TEST ---"
  T="$(head -1 "$WORK/worklist.tsv" | cut -f1)"   # oid
  TL="$(head -1 "$WORK/worklist.tsv" | cut -f2)"
  h0="$(hash_of "$T")"; snapshot "$T" || { echo "  NOT OK: snapshot failed"; exit 2; }
  mutate "$T" >/dev/null; h1="$(hash_of "$T")"
  [ "$h0" != "$h1" ] && echo "  ok   probe MOVES the hash ($TL)" || { echo "  NOT OK: mutation did not land"; exit 2; }
  psql_f "$INFLIGHT" >/dev/null; h2="$(hash_of "$T")"; : > "$INFLIGHT"
  [ "$h0" = "$h2" ] && echo "  ok   restore returns the hash EXACTLY" || { echo "  NOT OK: rollback did not restore"; exit 2; }
  DEG="$(psql_c -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','public') and p.prosrc ~ '^\s*begin\s+return\s*;\s*end';")"
  echo "  ok   post-restore degenerate-body count = ${DEG}"
  echo "--- SELF-TEST PASSED — the harness can mutate and can undo ---"
fi

# ---------------------------------------------------------------- sweep
DONE=0; SKIPPED=0; N_COVERED=0; N_BLIND=0; N_ERROR=0
while IFS=$'\t' read -r foid name sig ndoors nraise nanchored; do
  [ -n "${sig:-}" ] || continue
  if [ -n "$CASES" ]; then case " $CASES " in *" $name "*) : ;; *) SKIPPED=$((SKIPPED+1)); continue ;; esac; fi
  DONE=$((DONE+1))
  printf '[%3d/%s] %s (%s door(s), %s raise(s))\n' "$DONE" "$TOTAL" "$name" "$ndoors" "$nraise"

  # ⛔ Refuse a verdict we cannot fully neutralize. A PARTIAL mutation that still
  #    guards is indistinguishable from a covered door — it would report COVERED
  #    for the wrong reason. One visible ERROR beats a plausible wrong verdict.
  if [ "$nraise" != "$nanchored" ]; then
    record "$sig" "$ndoors" "$nraise" "ERROR" "UNMUTABLE — $nraise authz raise(s) but only $nanchored match the anchor; refusing a partial mutation"
    N_ERROR=$((N_ERROR+1)); continue
  fi

  h0="$(hash_of "$foid")"
  snapshot "$foid" || { record "$sig" "$ndoors" "$nraise" "ERROR" "snapshot failed"; N_ERROR=$((N_ERROR+1)); continue; }
  MUT_ERR="$(mutate "$foid")"
  h1="$(hash_of "$foid")"
  if [ "$h0" = "$h1" ]; then
    psql_f "$INFLIGHT" >/dev/null; : > "$INFLIGHT"
    record "$sig" "$ndoors" "$nraise" "ERROR" "MUTATION DID NOT LAND (hash unchanged): ${MUT_ERR//|/ }"
    N_ERROR=$((N_ERROR+1)); continue
  fi

  OUT="$(run_suite)"; V="$(verdict_of "$OUT")"; S="$(shape_of "$OUT")"
  psql_f "$INFLIGHT" >/dev/null; h2="$(hash_of "$foid")"; : > "$INFLIGHT"
  if [ "$h2" != "$h0" ]; then
    record "$sig" "$ndoors" "$nraise" "ERROR" "⛔ ROLLBACK FAILED — the tree is left mutated; stop and restore by hand"
    N_ERROR=$((N_ERROR+1)); echo "*** FATAL: rollback failed for $sig" >&2; exit 2
  fi
  if [ "$S" != "$BASE_S" ]; then
    record "$sig" "$ndoors" "$nraise" "ERROR" "run SHAPE changed ($BASE_S → $S) — the suite aborted rather than failed; not a verdict"
    N_ERROR=$((N_ERROR+1)); continue
  fi
  if [ "$V" = "FAIL" ]; then
    # ⛔ RED alone is not COVERED. The baseline was taken once, at the top of the run; if
    #    the tree drifted since (another session, a stray reset), a later FAIL is drift,
    #    not the mutation. The restored run is the control that tells them apart — it is
    #    the red-then-GREEN pair that carries the verdict, never the red on its own.
    ROUT="$(run_suite)"; RV="$(verdict_of "$ROUT")"; RS="$(shape_of "$ROUT")"
    if [ "$RV" != "PASS" ] || [ "$RS" != "$BASE_S" ]; then
      record "$sig" "$ndoors" "$nraise" "ERROR" "mutated run failed BUT the restored run did not come back green ($RV, shape=$RS) — the failure is not attributable to this mutation"
      N_ERROR=$((N_ERROR+1)); continue
    fi
    record "$sig" "$ndoors" "$nraise" "COVERED" "a keystone asserts through this guard (red under mutation, green restored)"
    N_COVERED=$((N_COVERED+1))
  else
    record "$sig" "$ndoors" "$nraise" "BLIND" "nothing in the suite noticed the guard vanish — $ndoors Tier-1 door(s) depend on it"
    N_BLIND=$((N_BLIND+1))
  fi
done < "$WORK/worklist.tsv"

emit
echo
echo "=== DONE — swept $DONE of $TOTAL derived enforcer(s) ==="
echo "    COVERED=$N_COVERED  BLIND=$N_BLIND  ERROR=$N_ERROR   (skipped by CASES: $SKIPPED)"
echo "    report: $FINDINGS"
[ "$DONE" -lt "$TOTAL" ] && echo "    ⚠ PARTIAL RUN — $((TOTAL-DONE)) enforcer(s) were NOT measured. This is not a clean sweep."
echo
echo "⛔ BLIND is a finding to keystone, not to allowlist away."
echo "⛔ ERROR IS NOT A PASS — each is an obligation."

# ⛔ A RUN THAT MEASURED NOTHING IS NOT A PASS. Without this, `CASES=` naming a token that
#    matches no enforcer sweeps 0, finds 0 BLIND and 0 ERROR, and exits 0 — a green that
#    read like a clean sweep. This is the failure mode the arm-baseline rule exists for:
#    "an arm cannot report that it measured nothing — that IS the failure mode."
if [ "$DONE" -eq 0 ]; then
  echo "*** ABORT: swept ZERO enforcers. This is NOT a pass." >&2
  [ -n "$CASES" ] && echo "    CASES matched no derived enforcer. Tokens must be the SCHEMA-QUALIFIED NAME" >&2
  [ -n "$CASES" ] && echo "    (e.g. app.assert_rca_writable), exactly as column 2 of \$WORK/worklist.tsv." >&2
  exit 2
fi
# An unmatched CASES token is a typo silently narrowing the run — name it, never ignore it.
if [ -n "$CASES" ]; then
  for tok in $CASES; do
    cut -f2 "$WORK/worklist.tsv" | grep -qxF "$tok" || { echo "*** ABORT: CASES token '$tok' matches no derived enforcer." >&2; exit 2; }
  done
fi

# BLIND or ERROR both make the invariant not hold.
[ "$N_BLIND" -eq 0 ] && [ "$N_ERROR" -eq 0 ] && exit 0 || exit 1
