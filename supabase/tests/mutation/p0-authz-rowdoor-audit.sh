#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14 / ADR 0079). THE THIRD SWEEP.
#
# p0-authz-door-audit.sh neutralizes a BOOLEAN gate by rewriting its body to `select
# true`. That is meaningless for a function that RETURNS A TABLE — there is no boolean
# to open — so 45 `prosecdef` row-returning doors sat in the census backlog with a
# verdict in NO direction (FUP-AUTHZ-3). This script is the missing mechanism.
#
# Why the class matters, in one sentence: CLAUDE.md's standing rule is that a DEFINER's
# gate REPLACES RLS, so for these doors the gate INSIDE the body is the entire boundary.
# It is not hypothetical debt — BUG-AUTHZ-002 lived exactly here: `hospital_document_
# register` and `hospital_indicator_rollup` returned commission content to platform_admin
# against ADR 0078 A35's noun rule, and a boolean-only census could not see them.
#
# ── THE NEUTRALIZATION ───────────────────────────────────────────────────────────────
# Opening a row-door's gate means: make it RETURN THE ROWS IT WOULD HAVE WITHHELD.
# Every one of these doors states its gate as a statement-level guard:
#
#     if <cond referencing the caller's identity> then return; end if;      -- 31 doors
#     if <same> then raise exception 'sem permissão' using errcode='42501'; --  5 doors
#
# so the neutralization rewrites that guard's CONDITION — `if <cond> then` -> `if false
# then` — and nothing else. The deny arm becomes dead code and execution falls through
# to the query. Signature, return type, volatility, DEFINER and search_path are all
# untouched; only the body changes (§7.15b).
#
# ⚠ THE CONDITION, NOT THE DENY ARM. Blanking the `raise` instead would also open
# guards that are NOT authorization — `list_case_access` raises `no_data_found` for a
# missing case — and a keystone noticing THAT would be recorded as a keystone noticing
# the authz gate. A false COVERED is worse than no verdict: it is the exact "audit one
# layer, infer the next" error this program exists to stop. So a guard is rewritten only
# when its condition references an identity primitive (`app.is_*`, `app.can_*`,
# `app.has_*`, `app.member_can`, `public.is_*`, `auth.uid()`). A feature-flag guard
# (`app.feature_enabled`) matches none of those and is deliberately left closed.
#
# ── WHAT THIS SWEEP CANNOT DO, STATED LOUDLY ─────────────────────────────────────────
# A door whose gate is not a statement guard — an identity conjunct INSIDE the query
# (`where m.principal_id = auth.uid()`), or a `declare`-block array of the caller's
# hospitals — has nothing to rewrite. Those are recorded UNSUPPORTED, with the reason,
# and they STAY in authz-unswept-backlog.txt. UNSUPPORTED is not a pass and not a
# verdict; it is this harness admitting its edge, which is the one thing a census must
# never hide. They owe a §4-style walk-through keystone (see
# supabase/tests/299_hospital_content_door_noun_rule.sql): a computed enumeration plus a
# row-count assertion per principal, never a predicate call.
#
# Verdicts, identical in meaning to the door audit:
#   suite FAIL  -> a keystone asserts through the gate            = COVERED (good)
#   suite PASS  -> nobody noticed the door opening                = BLIND   (a finding)
#   shape != baseline -> harness bug, fix the neutralization      = ERROR   (not a result)
#
# Run from repo root:  bash supabase/tests/mutation/p0-authz-rowdoor-audit.sh
# Subset:              CASES="pqs_inbox list_case_access" bash .../p0-authz-rowdoor-audit.sh
#   ⭐ A subset run writes its report + BLIND tsv to SCRATCH under $WORK and NEVER opens
#   the committed findings md for write (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE). There
#   is nothing to `git checkout --` afterwards; older instructions saying otherwise
#   describe the pre-2026-08-26 behaviour.
# ⚠ COST: ~25 s of pgTAP per SUPPORTED door. The LEAD runs the full loop in the
# background; a subagent's process dies at turn-end.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-$ROOT/.authz-work}"
PROGRESS="$WORK/progress_rowdoor.tsv"
RUNLOGS="$WORK/runlogs_rowdoor"
CASES="${CASES:-}"
FINDINGS_COMMITTED="$ROOT/docs/reviews/authz-rowdoor-audit-findings.md"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ A SUBSET RUN MUST NOT WRITE THE COMMITTED BASELINE
#    (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE — fix (a), 2026-08-26; identical in all
#     four p0-authz-*-audit.sh sweeps, which share the defect by construction.)
#
# `emit_report` ends in a TRUNCATING redirect into the file above, which is COMMITTED.
# With `CASES=` set — the diff-scoped run CLAUDE.md §6 step 1 mandates EVERY PHASE — that
# redirect replaced the full audit with the subset (measured on the door sweep 2026-08-25:
# 699 lines -> 90). ⛔ Silent AND self-concealing: `FROMFINDINGS=1` arms of
# p0-authz-invariant.sh compare this committed file to an allowlist and RE-MEASURE
# NOTHING, so against a truncated file they see fewer gates, find them all allowlisted,
# and report HOLDS — the arm gets GREENER as the baseline gets EMPTIER.
# ⚠ $BLINDS_TSV moves too: the invariant's non-FROMFINDINGS arm reads
# `$WORK/blinds_rowdoor.tsv` as a FULL-sweep result. The property is "never overwrite the
# artefact a later arm reads back as a baseline"; committed vs scratch is not part of it.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ -n "$CASES" ]; then
  SUBSET_RUN=1
  FINDINGS="$WORK/authz-rowdoor-audit-findings.SUBSET.md"
  BLINDS_TSV="$WORK/blinds_rowdoor.SUBSET.tsv"
else
  SUBSET_RUN=0
  FINDINGS="$FINDINGS_COMMITTED"
  BLINDS_TSV="$WORK/blinds_rowdoor.tsv"
fi

mkdir -p "$WORK" "$RUNLOGS"

# THE SECOND LOCK — a different KIND from the first: repointing $FINDINGS states the
# INTENT, this measures the OUTCOME (bytes checksummed now, re-checked on every exit).
baseline_sum () {
  if [ -f "$FINDINGS_COMMITTED" ]; then cksum < "$FINDINGS_COMMITTED"; else echo "ABSENT"; fi
}
BASELINE_SUM="$(baseline_sum)"
verify_baseline_untouched () {   # subset runs only; a mismatch ESCALATES to ABORT (2)
  [ "$SUBSET_RUN" = "1" ] || return 0
  local now; now="$(baseline_sum)"
  if [ "$now" != "$BASELINE_SUM" ]; then
    echo "*** FATAL: the COMMITTED baseline CHANGED during a subset run:" >&2
    echo "      $FINDINGS_COMMITTED" >&2
    echo "    A CASES= run must never write it (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE)." >&2
    echo "    Restore it and re-run before reading ANY later FROMFINDINGS arm:" >&2
    echo "      git checkout -- $FINDINGS_COMMITTED" >&2
    return 1
  fi
  echo "    committed baseline VERIFIED unchanged (cksum): $FINDINGS_COMMITTED"
  return 0
}
trap 'verify_baseline_untouched || exit 2' EXIT

if [ "$SUBSET_RUN" = "1" ]; then
  echo "--------------------------------------------------------------------------------"
  echo "⚠ SUBSET RUN — CASES=\"$CASES\". This run writes to SCRATCH, never to the baseline."
  echo "    subset report : $FINDINGS"
  echo "    subset BLINDs : $BLINDS_TSV"
  echo "    COMMITTED baseline is NOT opened for write and stays UNTOUCHED:"
  echo "      $FINDINGS_COMMITTED"
  echo "    ⛔ A FROMFINDINGS arm does NOT cover this run: it re-measures nothing and reads"
  echo "       the COMMITTED file, which this run deliberately did not update."
  echo "    To fold these verdicts in, MERGE them into the baseline (ADR 0079 Amendment 1)"
  echo "    — never copy the subset file over it."
  echo "--------------------------------------------------------------------------------"
else
  BASELINE_ANNOTATIONS=$(grep -cE '^(<!--|## Note)' "$FINDINGS_COMMITTED" 2>/dev/null | tr -d '[:space:]')
  if [ "${BASELINE_ANNOTATIONS:-0}" != "0" ]; then
    echo "⚠ FULL SWEEP — the committed baseline carries ${BASELINE_ANNOTATIONS} HAND-ADDED block(s)"
    echo "  (\`<!-- … -->\` merge notes / \`## Note …\` sections) this generator does NOT emit."
    echo "  The truncating redirect REPLACES the whole file, so this run drops them. Re-merge"
    echo "  from \`git show HEAD:docs/reviews/authz-rowdoor-audit-findings.md\` before committing."
  fi
fi

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
psql_f () {
  local host="$1"
  docker cp "$host" "$DB:/tmp/_p0row.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_p0row.sql 2>&1
}
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' ; }

# Restore-on-exit. A door is open only for the ~25 s of its suite run, but a kill in
# that window would leave it open for the next owner of the shared local stack.
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight door from $INFLIGHT)"
    psql_f "$INFLIGHT" >/dev/null 2>&1
  fi
}
# ⚠ compound: this REPLACES the baseline-guard trap installed above, so it must carry
# that duty too, or a subset run loses its outcome check from here on.
trap 'restore_inflight; verify_baseline_untouched || exit 2' EXIT

run_suite () { ( cd "$ROOT" && supabase test db ) 2>&1; }

classify () {
  local out="$1" res ft dubious
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  RUNFILES=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  RUNTESTS=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  dubious=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  FAILING=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' \
            | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  if [ -z "$res" ] || [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    VERDICT="ERROR"
  elif [ "$res" = "FAIL" ]; then VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then VERDICT="BLIND"
  else VERDICT="ERROR"; fi
}

echo "=== P0 AUTHZ ROW-DOOR AUDIT — open each row-returning DEFINER's guard, ask the SUITE ==="
echo "Repo: $ROOT"
echo "--- preflight: capturing GREEN baseline (§7.3 assert the state) ---"
BASE_OUT=$(run_suite)
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A dirty"
  echo "    baseline invalidates every case below. Aborting."; exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"
echo

# ─────────────────────────────────────────────────────────────────────────────────────
# Worklist from the LIVE catalog (never migration text — those bodies are rewritten at
# runtime by later migrations; see CLAUDE.md's binding SQL exception).
# ─────────────────────────────────────────────────────────────────────────────────────
psql_c -c "\copy (
  select p.oid,
         n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label,
         p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app','public','authz')
    and p.prosecdef
    and p.proretset
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  order by p.proname
) to '/tmp/wl_row.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_row.tsv" "$WORK/worklist_rowdoor.tsv" >/dev/null

: > "$PROGRESS"

want () {
  [ -z "$CASES" ] && return 0
  local k; for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

emit_report () {
  local total; total=$(wc -l < "$WORK/worklist_rowdoor.tsv" | tr -d '[:space:]')
  {
    echo "# AUTHZ Row-Door Audit — Findings"
    echo
    echo "AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079), FUP-AUTHZ-3. Generated by"
    echo "\`supabase/tests/mutation/p0-authz-rowdoor-audit.sh\`. Domain: every \`prosecdef\`,"
    echo "\`authenticated\`-reachable, ROW-RETURNING function in \`app\`/\`public\` — the class the"
    echo "boolean sweep is structurally blind to, and the class BUG-AUTHZ-002 lived in."
    echo
    echo "Method: rewrite the door's identity guard \`if <cond> then\` -> \`if false then\` so it"
    echo "returns the rows it would have withheld, run the FULL pgTAP suite, read \`Result:\`."
    echo "**COVERED** = suite went \`FAIL\` (a keystone asserts through the gate). **BLIND** ="
    echo "suite stayed \`PASS\` (no keystone exercises it). **ERROR** = run shape != baseline"
    echo "(harness bug, not a result). **UNSUPPORTED** = the door has no statement-level"
    echo "identity guard to open (the gate is a conjunct inside the query), so this harness"
    echo "returns NO verdict about it — it is not swept, and it stays in the census backlog."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Row-returning doors in the live catalog: $total."
    if [ -n "$CASES" ]; then echo; echo "> ⚠ PARTIAL RUN — CASES=\"$CASES\" (subset, not the full sweep)."; fi
    echo
    echo "## BLIND — the work-list (no keystone exercises these)"
    echo
    echo "| gate / policy | arm | direction | verdict | note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## COVERED (asserted-through) + ERROR (harness bug)"
    echo
    echo "| gate / policy | arm | direction | verdict | failing files / note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="COVERED"||$4=="ERROR"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## UNSUPPORTED — no statement guard to open (NOT a verdict; still owed a keystone)"
    echo
    echo "These stay in \`supabase/tests/mutation/authz-unswept-backlog.txt\`. Each owes a"
    echo "walk-through keystone in the shape of \`supabase/tests/299_hospital_content_door_noun_rule.sql\`"
    echo "§4 — a computed enumeration plus a row-count assertion per principal."
    echo
    echo "| gate / policy | arm | direction | verdict | why unsupported |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="UNSUPPORTED"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
  } > "$FINDINGS"

  { echo -e "arm\tgate\tdirection\tfailing_or_note";
    awk -F'\t' '$4=="BLIND"{printf "%s\t%s\t%s\t%s\n",$1,$2,$3,$5}' "$PROGRESS"; } > "$BLINDS_TSV"
}

record () {
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  emit_report
}

# ─────────────────────────────────────────────────────────────────────────────────────
# The neutralizer. Keeps the ENTIRE pg_get_functiondef header (LANGUAGE, volatility,
# SECURITY DEFINER, search_path, …) and swaps only the dollar-quoted body, exactly like
# the boolean sweep — but the new body is the OLD body with its identity guards opened,
# computed in-database by regexp_replace so no body text ever crosses the shell.
#
#   `[^;]*?`  keeps the match inside ONE statement — a plpgsql condition never contains
#             a semicolon, so this cannot swallow the guard's body or the next statement.
#   the alternation forces an identity reference INSIDE the condition, which is what
#   makes this an authz neutralization rather than a blunt "open every if".
#
# It RAISES if the rewrite changed nothing (a silent no-op is indistinguishable from a
# surviving gate — the FF-3 lesson: confirm a mutation APPLIED before trusting it).
#
# ⚠ THE LOOKAHEADS ARE LOAD-BEARING, and the first version did not have them. Written as
# `\yif\y[^;]*?<authz>[^;]*?\ythen\y`, the match can span from an OUTER `if … then` across
# an inner guard, because plpgsql puts no `;` between them:
#
#     if p_commission is not null then          -- outer: NOT an authz decision
#       if not (app.is_staff_admin_of(…)) then  -- inner: the actual gate
#
# collapsed to ONE `if false then`, losing an `end if` and leaving a dangling `elsif`.
# `verify_audit_chain` failed to compile and was recorded ERROR — which is the LUCKY
# outcome. The same swallow in a door without an `elsif` chain would still compile, would
# open a condition that is not an authorization decision, and would report whatever the
# suite then did as a verdict about the GATE. That is a false COVERED, manufactured by
# the audit itself. `(?![;]|\ythen\y|\y(?:els)?if\y)` stops the match at the first
# intervening `if`/`then`, and the `end if` count check above is the belt to that brace.
# Blast radius when found: 1 of 45 doors (the other 44 match identically either way, so
# their verdicts stood) — established by diffing both regexes over every body, not assumed.
# ─────────────────────────────────────────────────────────────────────────────────────
cat > "$WORK/_neut_row.sql" <<'TMPL'
do $p0$
declare
  d text; tag text; hdr text; body text; newbody text; n int;
  -- The ONE definition of "an openable identity guard", used for both the rewrite and
  -- the count. There is deliberately no second copy anywhere: a door with no match here
  -- raises NO-OP below, and the caller reads that as UNSUPPORTED.
  re constant text :=
    '(?is)\y(els)?if\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?(app\.is_|app\.can_|app\.has_|app\.member_can|public\.is_|auth\.uid)(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\ythen\y';
begin
  d := pg_get_functiondef(__OID__);
  -- ⚠ PLAIN string, not an E-string. `E'\nAS (\\$[^$]*\\$)'` returns NULL here: the
  -- E-escape turns `\n` into a literal newline BYTE, and this pattern then fails to
  -- match while the byte-identical-looking regex escape does. Verified against the live
  -- catalog on 2026-08-05 — the E-form silently found 0 guards in all 45 doors, which
  -- is indistinguishable from "no door has a guard". A dry run caught it; nothing else
  -- would have, because every door would simply have been filed UNSUPPORTED.
  tag := (regexp_match(d, '\nAS (\$[^$]*\$)'))[1];
  if tag is null then raise exception 'P0-HARNESS: no dollar-body tag for oid __OID__'; end if;
  hdr  := split_part(d, tag, 1);
  body := split_part(d, tag, 2);
  newbody := regexp_replace(body, re, '\1if false then', 'g');
  if newbody = body then
    raise exception 'P0-HARNESS: guard rewrite was a NO-OP for oid __OID__';
  end if;
  -- Structure check: opening a guard must not change the block structure. A rewrite
  -- that swallowed an enclosing `if` would lose an `end if` and either fail to compile
  -- (loud) or, worse, compile as a DIFFERENT program (silent). Count them.
  if (select count(*) from regexp_matches(body, '(?i)\yend\s+if\y', 'g'))
     <> (select count(*) from regexp_matches(newbody, '(?i)\yend\s+if\y', 'g')) then
    raise exception 'P0-HARNESS: guard rewrite changed block structure for oid __OID__';
  end if;
  select count(*) into n from regexp_matches(body, re, 'g');
  raise notice 'P0-GUARDS-OPENED %', n;
  execute hdr || tag || newbody || tag;
end $p0$;
TMPL

echo "=== ROW-DOOR ARM ==="
SUPPORTED=0; UNSUP=0
while IFS=$'\t' read -r oid label proname; do
  [ -z "$oid" ] && continue
  want "$proname" || continue

  s=$(slug "$label")
  orig="$WORK/orig_row_$s.sql"
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"
  INFLIGHT="$orig"

  sed -e "s/__OID__/$oid/g" "$WORK/_neut_row.sql" > "$WORK/_mutrow.sql"
  mout=$(psql_f "$WORK/_mutrow.sql")
  # No separate static pre-check: the neutralizer itself raises `NO-OP` when a door has
  # no openable guard, so UNSUPPORTED falls out of the SAME regex that would do the
  # rewrite. A second copy of that regex for a cheap pre-pass is exactly how a detector
  # and a mutator drift into disagreeing about what a guard is — and the first draft of
  # this script had that copy, mangled, in a heredoc.
  if echo "$mout" | grep -q 'NO-OP'; then
    record "rowdoor" "$label" "open-guard" "UNSUPPORTED" "no statement-level identity guard — the gate is a conjunct inside the query"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label"; continue
  fi
  if echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
    record "rowdoor" "$label" "open-guard" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 150)"
    psql_f "$orig" >/dev/null 2>&1; INFLIGHT=""
    echo "  ERROR  $label (neutralize failed)"; continue
  fi

  ng=$(echo "$mout" | grep -oE 'P0-GUARDS-OPENED [0-9]+' | grep -oE '[0-9]+' | tail -1)
  out=$(run_suite); echo "$out" > "$RUNLOGS/row_$s.log"
  classify "$out"

  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $label did NOT round-trip. Every later case is"
    echo "    suspect. Aborting the sweep (§7.5)."; exit 2
  fi
  INFLIGHT=""

  record "rowdoor" "$label" "open-guard(${ng:-?})" "$VERDICT" "${FAILING:-}"
  SUPPORTED=$((SUPPORTED+1))
  echo "  $VERDICT  $label"
done < "$WORK/worklist_rowdoor.tsv"

emit_report
echo
echo "=== DONE. Report: $FINDINGS   BLINDs: $BLINDS_TSV ==="
if [ "$SUBSET_RUN" = "1" ]; then
  # ⚠ Print the SIZE, not just the path: an "untouched baseline" is indistinguishable
  # from "this run wrote nothing at all" unless the subset report is shown to exist with
  # real content somewhere.
  echo "    ⚠ SUBSET RUN (CASES=\"$CASES\") — that report is a SCRATCH file, $(wc -l < "$FINDINGS" | tr -d '[:space:]') line(s),"
  echo "      covering ONLY the selected cases. The committed baseline was never opened"
  echo "      for write: $FINDINGS_COMMITTED"
  echo "    ⛔ Do NOT read a FROMFINDINGS arm as covering this run."
fi
awk -F'\t' '{c[$4]++} END{for(k in c) printf "%s: %d   ", k, c[k]; print ""}' "$PROGRESS"
echo "swept (suite-run): $SUPPORTED   unsupported (static): $UNSUP"
