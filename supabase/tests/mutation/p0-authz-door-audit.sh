#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14). A gate no keystone exercises
# is a live leak wearing a green check. §7.14: "audit one layer, infer the next" is
# SYMMETRIC and shipped green suites over five live leaks in one day. This harness
# closes it by BRUTE FORCE: NEUTRALIZE each authz gate (open it so it grants/allows
# regardless), run the FULL pgTAP suite, and read whether ANY keystone noticed.
#
#   Result: FAIL  -> a keystone asserts THROUGH this gate           = COVERED (good)
#   Result: PASS  -> NO keystone exercises it; opening it is silent = BLIND  (a finding)
#
# This is the INVERSE of m1/m5/u2: those revert ONE fix and require ONE keystone to go
# red (isolating a single keystone). Here we open ONE gate and ask the WHOLE SUITE
# whether it is asserted-through by ANYONE. So we do NOT inject into a single test file;
# we mutate the LIVE, COMMITTED catalog and run `supabase test db` end-to-end.
#
# ── Lessons baked in (each HID A REAL RESULT elsewhere on this program) ──────────────
#  §7.15  "Green" has a THIRD failure mode: the assertion that NEVER RAN. A neutralization
#         that changes a function's RETURN TYPE makes files ERROR/abort, not assertion-
#         fail. That is a HARNESS BUG, not a BLIND. We guard on Files/Tests == baseline
#         and on the absence of "Dubious"; a run that does not match the baseline shape
#         is verdict=ERROR (fix the neutralization), never recorded as a result.
#  §7.1   Detect on the SUITE RESULT, not `grep '^not ok'` — the lead's probe showed a
#         real Result: FAIL with ZERO `^not ok` lines (prove's summary formatting varies).
#  §7.3   Assert the state, don't claim it: the baseline Files/Tests are CAPTURED at
#         preflight (not hardcoded 112/3186 — those go stale as the suite grows) and the
#         baseline MUST read Result: PASS or we abort (a dirty baseline invalidates all).
#  §7.15b type-safety by RETURN TYPE: positive gates -> true, deny gates -> false,
#         void raise-guards -> no-op. A neutralization must preserve signature + return
#         type + attributes (STABLE/DEFINER/search_path); ONLY the body changes. We keep
#         the entire pg_get_functiondef header and swap only the dollar-quoted body.
#  §7.5   restore is not optional and not assumed: after EVERY case we RE-FETCH the def/
#         qual and byte-compare against the captured original. A botched restore silently
#         contaminates every case after it, so a mismatch is a LOUD abort, not a warning.
#  §7.2   value, not noun: functions keyed by OID (survives rename); policies by name+table.
#
# Run from repo root:  bash supabase/tests/mutation/p0-authz-door-audit.sh
# Subset:              CASES="can_read_case is_case_respondent" bash .../p0-authz-door-audit.sh
#   (CASES matches predicate proname OR policy name; space-separated.)
#
# ⚠ COST: the full sweep is ~75 min (one ~23s suite run per gate + per policy). Author
# + smoke only in an interactive turn; a background process dies at turn-end. The LEAD
# runs the full loop in the background.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
# Repo root = three levels up from supabase/tests/mutation/.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-/c/Users/micha/AppData/Local/Temp/claude/C--Users-micha-Development-claude-hospital-form-platform/6d030efd-e072-4a80-a704-0dc4fb6c9049/scratchpad/authz-audit}"
FINDINGS="$ROOT/docs/reviews/authz-door-audit-findings.md"
BLINDS_TSV="$WORK/blinds.tsv"
PROGRESS="$WORK/progress.tsv"          # per-case log, written AS WE GO (§ mid-run kill)
RUNLOGS="$WORK/runlogs"                # full suite output per case, for forensics
CASES="${CASES:-}"                     # optional subset filter

mkdir -p "$WORK" "$RUNLOGS"

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
# Run an SQL file inside the container (avoids all shell-quoting of quals/bodies).
psql_f () {
  local host="$1"
  docker cp "$host" "$DB:/tmp/_p0mut.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_p0mut.sql 2>&1
}

# safe filename token from an arbitrary label
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' ; }

# Restore-on-exit: a gate is neutralized only for the ~23s of its suite run, but a kill
# in that window would leave it OPEN (dirty stack for the next owner — memory: shared
# local stack, single owner). INFLIGHT points at the SQL that restores the current gate;
# cleared the instant its inline restore succeeds. Set BEFORE neutralizing/opening.
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight gate from $INFLIGHT)"
    psql_f "$INFLIGHT" >/dev/null 2>&1
  fi
}
trap restore_inflight EXIT

# ─────────────────────────────────────────────────────────────────────────────────────
# The neutralizer — an ANONYMOUS `DO` block, baked per case (oid + newbody spliced in by
# bash). ⚠ It is deliberately NOT a persistent helper function: a persistent app.* helper
# (unpinned search_path, not SECURITY DEFINER, public-executable) trips the schema-surface
# pgTAP assertions and turns the GREEN baseline RED — poisoning the very control this
# audit depends on (caught on the first smoke run: preflight went FAIL with the helper
# present, PASS without it). A DO block leaves ZERO catalog residue.
#
# It keeps the ENTIRE pg_get_functiondef header (LANGUAGE, volatility, SECURITY DEFINER,
# search_path, LEAKPROOF, …) and swaps ONLY the dollar-quoted body. pg_get_functiondef
# guarantees the outer dollar-tag does not occur inside the body, so it appears exactly
# twice; split_part(...,tag,1) is the header up to and including `AS `. Raises if the tag
# can't be found (never a silent no-op — §7.1 red != no-op).
#
# NB: this harness runs `supabase test db`, which creates/drops pgtap + test_helpers
# ITSELF per run — so there is NO pgtap preflight here (pre-creating it is another way to
# poison the baseline). The ONLY preflight is the green-baseline gate.
# ─────────────────────────────────────────────────────────────────────────────────────

run_suite () {  # echoes raw suite output; ~23s
  ( cd "$ROOT" && supabase test db ) 2>&1
}

# classify OUTPUT -> sets globals VERDICT, FAILING, RUNFILES, RUNTESTS
classify () {
  local out="$1"
  local res ft
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  RUNFILES=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  RUNTESTS=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  local dubious
  dubious=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  # Failing test files (basenames), comma-joined.
  FAILING=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' \
            | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  # §7.15: a run whose SHAPE differs from baseline (fewer files/tests, or Dubious) is an
  # ABORT — a harness bug (bad neutralization), NOT a BLIND/COVERED result.
  if [ -z "$res" ] || [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    VERDICT="ERROR"
  elif [ "$res" = "FAIL" ]; then
    VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then
    VERDICT="BLIND"
  else
    VERDICT="ERROR"
  fi
}

echo "=== P0 AUTHZ DOOR AUDIT — neutralize each gate, ask the WHOLE SUITE if anyone noticed ==="
echo "Repo: $ROOT"
echo "--- preflight: capturing GREEN baseline (§7.3 assert the state) ---"
BASE_OUT=$(run_suite)
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A dirty"
  echo "    baseline invalidates every case below (a COVERED can't be told from a pre-existing"
  echo "    red). Fix the tree to green before auditing. Aborting."; exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"
echo

# ─────────────────────────────────────────────────────────────────────────────────────
# Build the two worklists from the LIVE catalog (never migration text).
#   PRED: secdef boolean gates (is_/can_/has_/referral_target_analyst/attachment_confidentiality_ok,
#         excluding the is_valid_* config validators) + the void raise-guard
#         assert_not_case_excluded. Direction: the three deny predicates -> false;
#         the void assert -> no-op; everything else -> true.
#         ⚠ value-returning raise-guards (assert_*_writable, assert_referral_*) are
#         EXCLUDED from the auto-sweep — neutralizing a uuid/record raise-guard risks a
#         NULL-propagation ABORT downstream (§7.15). They are listed in the report as a
#         manual-neutralization GAP for the lead to hand-add bespoke.
#   POL:  SELECT/ALL policies on public tables whose qual is a real predicate (not `true`).
# ─────────────────────────────────────────────────────────────────────────────────────
psql_c -c "\copy (
  select p.oid,
         n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label,
         p.proname,
         case
           when p.proname in ('is_case_excluded','is_case_respondent','is_recused_from_case') then 'deny'
           when t.typname='void' and p.proname ~ '^assert_' then 'assert_noop'
           else 'positive'
         end as direction,
         l.lanname
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language  l on l.oid=p.prolang
  join pg_type      t on t.oid=p.prorettype
  where n.nspname in ('app','public')
    and p.prosecdef = true
    and (
       (t.typname='bool' and p.proname ~ '^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)'
          and p.proname !~ '^is_valid_')
       or p.proname = 'assert_not_case_excluded'
    )
  order by p.proname
) to '/tmp/wl_pred.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_pred.tsv" "$WORK/worklist_pred.tsv" >/dev/null

psql_c -c "\copy (
  select c.relname as tbl, pol.polname,
         (case pol.polcmd when 'r' then 'SELECT' when '*' then 'ALL' end) as cmd,
         (pol.polwithcheck is not null) as has_wc
  from pg_policy pol
  join pg_class c on c.oid=pol.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and pol.polcmd in ('r','*')
    and coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') not in ('true','')
  order by c.relname, pol.polname
) to '/tmp/wl_pol.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_pol.tsv" "$WORK/worklist_pol.tsv" >/dev/null

# The intentionally-public catalogs we SKIP (qual = true): neutralizing true->true is a
# vacuous no-op. Listed in the report per the brief.
psql_c -c "\copy (
  select c.relname||' / '||pol.polname||' / '||(case pol.polcmd when 'r' then 'SELECT' when '*' then 'ALL' else pol.polcmd::text end)
  from pg_policy pol
  join pg_class c on c.oid=pol.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and pol.polcmd in ('r','*')
    and coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') = 'true'
  order by 1
) to '/tmp/wl_skip.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_skip.tsv" "$WORK/skipped_pol_true.tsv" >/dev/null

# progress.tsv columns: arm  gate  direction  verdict  failing_files
: > "$PROGRESS"

want () {  # $1 = match key (proname or polname); returns 0 if in CASES (or CASES empty)
  [ -z "$CASES" ] && return 0
  local k
  for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

# Regenerate the two deliverables from progress.tsv. Called after EVERY case so a
# mid-run kill still leaves a coherent partial report (brief requirement).
emit_report () {
  local total_pol skipped_pol
  total_pol=$(wc -l < "$WORK/worklist_pol.tsv" | tr -d '[:space:]')
  skipped_pol=$(wc -l < "$WORK/skipped_pol_true.tsv" | tr -d '[:space:]')
  {
    echo "# AUTHZ Door-Blindness Audit — Findings"
    echo
    echo "AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14). Generated by"
    echo "\`supabase/tests/mutation/p0-authz-door-audit.sh\`. Method: neutralize each authz"
    echo "gate (open it so it grants/allows regardless), run the FULL pgTAP suite, read"
    echo "\`Result:\`. **COVERED** = suite went \`FAIL\` (a keystone asserts through the gate)."
    echo "**BLIND** = suite stayed \`PASS\` (no keystone exercises it — a work-list item)."
    echo "**ERROR** = run shape != baseline (harness bug: fix the neutralization, not a result)."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Policies swept: $total_pol (real qual). Policies skipped (qual=true, vacuous): $skipped_pol."
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
    awk -F'\t' '$4!="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## Skipped SELECT/ALL policies (qual = true — intentionally public catalogs)"
    echo
    if [ -s "$WORK/skipped_pol_true.tsv" ]; then
      while IFS= read -r ln; do echo "- \`$ln\`"; done < "$WORK/skipped_pol_true.tsv"
    else echo "_(none)_"; fi
  } > "$FINDINGS"

  # machine-readable BLIND list
  { echo -e "arm\tgate\tdirection\tfailing_or_note";
    awk -F'\t' '$4=="BLIND"{printf "%s\t%s\t%s\t%s\n",$1,$2,$3,$5}' "$PROGRESS"; } > "$BLINDS_TSV"
}

record () {  # arm gate direction verdict failing
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  emit_report
}

# Neutralizer template — LITERAL (quoted heredoc, no shell expansion) so the E-string
# regex survives byte-for-byte (an unquoted heredoc mangles the backslashes). Per case we
# sed __OID__ (digits) and __NEWBODY__ (a fixed safe string) into it. Regex is identical
# to the validated dry-run: E'\nAS (\\$[^$]*\\$)' captures the outer dollar tag.
cat > "$WORK/_neut_template.sql" <<'TMPL'
do $p0$
declare d text; tag text; hdr text;
begin
  d := pg_get_functiondef(__OID__);
  tag := (regexp_match(d, E'\nAS (\\$[^$]*\\$)'))[1];
  if tag is null then raise exception 'P0-HARNESS: no dollar-body tag for oid __OID__'; end if;
  hdr := split_part(d, tag, 1);
  execute hdr || tag || E'\n' || $p0body$__NEWBODY__$p0body$ || E'\n' || tag;
end $p0$;
TMPL

# ─────────────────────────────────────────────────────────────────────────────────────
# PREDICATE ARM
# ─────────────────────────────────────────────────────────────────────────────────────
echo "=== PREDICATE ARM ==="
while IFS=$'\t' read -r oid label proname direction lang; do
  [ -z "$oid" ] && continue
  want "$proname" || continue

  # newbody by direction + language (type-preserving)
  local_nb=""
  case "$direction" in
    positive)    [ "$lang" = "sql" ] && local_nb='select true'  || local_nb='begin return true; end' ;;
    deny)        [ "$lang" = "sql" ] && local_nb='select false' || local_nb='begin return false; end' ;;
    assert_noop) local_nb='begin return; end' ;;   # void plpgsql raise-guard -> no-op
    *)           echo "  SKIP $label (unknown direction $direction)"; continue ;;
  esac

  s=$(slug "$label")
  orig="$WORK/orig_pred_$s.sql"
  # capture ORIGINAL def (exact bytes) for restore + restore-verification
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"
  INFLIGHT="$orig"   # arm the EXIT trap before we open the gate

  # neutralize via an anonymous DO block (no persistent catalog residue; see header note)
  sed -e "s/__OID__/$oid/g" -e "s|__NEWBODY__|$local_nb|g" "$WORK/_neut_template.sql" > "$WORK/_mut.sql"
  mout=$(psql_f "$WORK/_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
    record "predicate" "$label" "$direction" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    # attempt restore anyway
    psql_f "$orig" >/dev/null 2>&1
    INFLIGHT=""; echo "  ERROR  $label (neutralize failed)"; continue
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pred_$s.log"
  classify "$out"

  # RESTORE (exact original bytes) + VERIFY (§7.5 contamination guard)
  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $label did NOT round-trip. Every later case is"
    echo "    suspect. Aborting the sweep (§7.5)."; exit 2
  fi
  INFLIGHT=""   # restore verified — disarm the trap

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "predicate" "$label" "$direction" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$label"
done < "$WORK/worklist_pred.tsv"

# ─────────────────────────────────────────────────────────────────────────────────────
# POLICY ARM
# ─────────────────────────────────────────────────────────────────────────────────────
echo
echo "=== POLICY ARM ==="
while IFS=$'\t' read -r tbl polname cmd has_wc; do
  [ -z "$tbl" ] && continue
  want "$polname" || continue

  s=$(slug "${tbl}_${polname}")
  qfile="$WORK/orig_pol_$s.qual"; wfile="$WORK/orig_pol_$s.wc"
  restore="$WORK/restore_pol_$s.sql"
  psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass" > "$qfile"
  : > "$wfile"
  [ "$has_wc" = "t" ] && psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass" > "$wfile"

  # Build the RESTORE up front + arm the EXIT trap BEFORE opening the policy.
  {
    printf 'alter policy "%s" on public."%s" using (%s)' "$polname" "$tbl" "$(cat "$qfile")"
    if [ "$has_wc" = "t" ]; then printf ' with check (%s)' "$(cat "$wfile")"; fi
    printf ';\n'
  } > "$restore"
  INFLIGHT="$restore"

  # OPEN the policy: using(true) [+ with check(true)]
  { echo "alter policy \"$polname\" on public.\"$tbl\" using (true)$([ "$has_wc" = "t" ] && echo ' with check (true)');" ; } > "$WORK/_mut.sql"
  mout=$(psql_f "$WORK/_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "open failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    INFLIGHT=""; echo "  ERROR  $tbl.$polname"; continue
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pol_$s.log"
  classify "$out"

  # RESTORE exact original qual [+ with check] + VERIFY
  psql_f "$restore" >/dev/null 2>&1
  nowq=$(psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='public.\"$tbl\"'::regclass")
  if [ "$nowq" != "$(cat "$qfile")" ]; then
    echo "*** CONTAMINATION: restore of policy $tbl.$polname did NOT round-trip. Aborting (§7.5)."; exit 2
  fi
  INFLIGHT=""   # restore verified — disarm the trap

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "policy" "$tbl.$polname ($cmd)" "open->true" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$tbl.$polname"
done < "$WORK/worklist_pol.tsv"

echo
echo "=== DONE. Report: $FINDINGS   BLINDs: $BLINDS_TSV ==="
blind_ct=$(awk -F'\t' '$4=="BLIND"' "$PROGRESS" | wc -l | tr -d '[:space:]')
err_ct=$(awk -F'\t' '$4=="ERROR"' "$PROGRESS" | wc -l | tr -d '[:space:]')
echo "BLIND: $blind_ct   ERROR(harness): $err_ct   (COVERED = the rest)"
