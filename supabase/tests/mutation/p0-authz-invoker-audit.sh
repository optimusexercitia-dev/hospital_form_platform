#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-INVOKER-WRAPPER; ADR 0078 §7.14 / ADR 0079). THE FOURTH SWEEP.
#
# THE BLIND SPOT THIS CLOSES. The other three sweeps all begin `and p.prosecdef` —
# verified in the live scripts, not assumed. So the entire `public` INVOKER surface
# (88 `authenticated`-reachable plpgsql functions) has never been swept in any
# direction by any arm. AUDIT-INVOKER-WRAPPER, found in FF-3 (QA M-2), is that hole:
# an INVOKER wrapper whose own hand-written probe is the ONLY gate in front of an
# `app` DEFINER body. The wrapper is `prosecdef = f`, so it is invisible here; the
# helper it calls is `prosecdef = t`, so its gate REPLACES RLS. Neither end is covered.
#
# It is a PATTERN, not an accident: fronting an `app.` DEFINER helper with an INVOKER
# wrapper is the natural shape in this codebase, and a majority of `app` DEFINER
# functions carry EXECUTE to PUBLIC (re-measure, never cite a stale count), so the
# wrapper is the whole boundary each time.
#
# ── WHY THIS SWEEP CANNOT REUSE THE ROW-DOOR REGEX ───────────────────────────────────
# p0-authz-rowdoor-audit.sh opens `if <cond> then` only when the CONDITION names an
# identity primitive (`app.is_*`, `auth.uid()`, …) — deliberately, so a feature-flag
# guard is not mistaken for an authz gate. Applied to THIS population that rule is not
# merely incomplete, it is definitionally wrong, and a dry run proved it before a line
# of this sweep was trusted:
#
#     32 of 88 matched it — and `get_response_validation_errors`, the FF-3 exemplar
#     that MOTIVATED this whole item, was not one of them. Its gate is
#         if not exists (select 1 from public.responses r where r.id = p_response_id)
#     which names no identity primitive at all.
#
# That is the entire insight of the class. For an INVOKER function, a bare existence
# probe against an RLS-protected table IS the authorization decision — "the row does
# not exist" and "the row is not visible to YOU" are the same condition, because RLS
# is what answers it. So the identity reference is the RLS on the probed table, not a
# token in the source. Had this sweep inherited the row-door regex it would have filed
# its own motivating example UNSUPPORTED and reported a clean run.
#
# ── THE THREE OPENABLE GUARD CLASSES ─────────────────────────────────────────────────
# Every regex below is COMPUTED IN-DATABASE from the live catalog, never hand-listed:
# an enumeration whose boundary is a hand-maintained list is wrong the day a migration
# lands.
#
#   G1  RLS EXISTENCE PROBE  — `if [not] exists (… <t> …) then` where <t> is a relation
#       with `relrowsecurity = true`. Rewritten to `if false then`. The table
#       alternation is built from `pg_class.relrowsecurity`, so a table that gains or
#       loses RLS moves in or out of the class automatically. A probe against a
#       non-RLS table (a vocabulary/catalog lookup) is a DOMAIN check, not an authz
#       one, and is deliberately left closed.
#
#   G2  IDENTITY ASSERT STATEMENT — `perform app.assert_X(…)` -> `perform 1`, where X
#       is one of the `app.assert_*` functions whose OWN body touches identity
#       (`is_`/`can_`/`has_`/`member_can`/`memberships`/`auth.uid`). Computed, so the
#       ~13 identity asserts are separated from the ~34 feature-flag/domain asserts by
#       a property rather than by a list. Opening `assert_referrals_enabled` would let
#       a keystone that notices a FLAG guard be recorded as one that notices the AUTHZ
#       gate — a false COVERED, the exact "audit one layer, infer the next" error this
#       programme exists to stop.
#       ⚠ Only the `perform`-statement form. The identity asserts that RETURN a value
#       (`assert_ethics_coordinator` -> uuid, …) are called as assignments and have no
#       safe neutral value, so they do not open here.
#
#       ⚠ G1's KNOWN EDGE, found by hand-checking its own output and stated here because
#       nothing in the harness can see it: `if not exists (… <RLS table> …)` is the authz
#       probe in `get_response_validation_errors` (bare identity: `where r.id = p_param`)
#       but a DOMAIN check in `add_template_phase` (`where id = p_form_id and
#       commission_id = v_commission_id` — is this form part of this template?). Both
#       read an RLS table; only the first is an authorization decision. No textual rule
#       separates them reliably, so a verdict whose ONLY opened class is G1 is marked
#       PROVISIONAL in the note column and must be hand-classified before it is trusted
#       or allowlisted. Silence about this would make BLIND look like a finding when the
#       harness had opened something else entirely.
#
#   G3  IDENTITY-PRIMITIVE CONDITION — the row-door regex, verbatim, including its
#       load-bearing lookaheads. Kept because it is the shape 32 of these functions do
#       use, and its `(?![;]|\ythen\y|\y(?:els)?if\y)` guard against swallowing an
#       OUTER `if` was paid for once already.
#
# A function's guards are ALL opened together; the report records which classes fired
# and how many. A COVERED therefore means "some keystone noticed SOMETHING open", not
# "each guard is individually keystoned" — the same resolution the row-door sweep has.
# BLIND is the finding, and BLIND is exact.
#
# Verdicts, identical in meaning to the other three sweeps:
#   suite FAIL  -> a keystone asserts through the gate            = COVERED (good)
#   suite PASS  -> nobody noticed the wrapper opening             = BLIND   (a finding)
#   shape != baseline -> harness bug, fix the neutralization      = ERROR   (not a result)
#   no guard matched any class                                    = UNSUPPORTED (NOT a
#     verdict; the function is not swept and stays in the census backlog)
#
# Run from repo root:  bash supabase/tests/mutation/p0-authz-invoker-audit.sh
# Subset:              CASES="get_response_validation_errors submit_response" bash …
# Dry run (no suite):  DRYRUN=1 bash …   — classifies every function's guards and
#                      exits. Use it to prove the detector still FINDS things after any
#                      edit: a detector that finds nothing must be proven able to find
#                      something, and this one silently found nothing once already.
# ⚠ COST: ~1.5 min of pgTAP per SUPPORTED function — ~100 min for the full 88 (56 of
# which are supported). The LEAD runs the full loop in the background; a subagent's
# process dies at turn-end.
#
# ⛔ NEVER PIPE THIS SCRIPT. `bash p0-authz-invoker-audit.sh | tail -120` reports TAIL's
# exit status, not the sweep's. The first full run aborted with `exit 2` on a
# CONTAMINATION check and was reported as **exit code 0** for exactly this reason — the
# same masking already recorded for `e2e:prod`. Redirect to a file and read it
# (`... > run.log 2>&1`), or check `${PIPESTATUS[0]}`.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-$ROOT/.authz-work}"
FINDINGS="$ROOT/docs/reviews/authz-invoker-audit-findings.md"
BLINDS_TSV="$WORK/blinds_invoker.tsv"
PROGRESS="$WORK/progress_invoker.tsv"
RUNLOGS="$WORK/runlogs_invoker"
CASES="${CASES:-}"
DRYRUN="${DRYRUN:-0}"

mkdir -p "$WORK" "$RUNLOGS"

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@" </dev/null; }
psql_f () {
  local host="$1"
  # ⚠ no MSYS_NO_PATHCONV here: the HOST side of a `docker cp` must keep MSYS path
  # conversion, or the Git-Bash path is passed through literally and Docker resolves it
  # as `C:\c\Users\…`. Only the `docker exec` calls suppress it (for the container-side
  # `//tmp/…`). Same split as the sibling sweeps.
  docker cp "$host" "$DB:/tmp/_p0inv.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_p0inv.sql 2>&1 </dev/null
}
# ⚠ Keyed on the OID, not the label. The first cut slugged the full label — signature
# and all — and `public.update_meeting(9 args)` produced a 250+ char filename that the
# filesystem rejected with "File name too long". That is recorded here because of what it
# then did, not because of the limit itself (see the rollback-point guard below).
# OIDs are stable for the life of one run, which is all a scratch file needs.
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' | cut -c1-60 ; }

# Restore-on-exit. A wrapper is open only for the ~25 s of its suite run, but a kill in
# that window would leave it open for the next owner of the shared local stack.
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight wrapper from $INFLIGHT)"
    psql_f "$INFLIGHT" >/dev/null 2>&1
  fi
}
trap restore_inflight EXIT

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

echo "=== P0 AUTHZ INVOKER-WRAPPER AUDIT — open each wrapper's own gate, ask the SUITE ==="
echo "Repo: $ROOT"

# ─────────────────────────────────────────────────────────────────────────────────────
# Worklist from the LIVE catalog (never migration text — bodies are rewritten at
# runtime by later migrations; see CLAUDE.md's binding SQL exception).
# ─────────────────────────────────────────────────────────────────────────────────────
psql_c -c "\copy (
  select p.oid,
         n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as label,
         p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and not p.prosecdef
    and p.prokind = 'f'
    and l.lanname = 'plpgsql'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  order by p.proname
) to '/tmp/wl_inv.tsv' with (format text)" >/dev/null
docker cp "$DB:/tmp/wl_inv.tsv" "$WORK/worklist_invoker.tsv" >/dev/null

: > "$PROGRESS"

want () {
  [ -z "$CASES" ] && return 0
  local k; for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────────────
# The neutralizer. Keeps the ENTIRE pg_get_functiondef header (LANGUAGE, volatility,
# search_path, …) and swaps only the dollar-quoted body, exactly like the other sweeps
# — the new body computed in-database so no body text ever crosses the shell.
#
# It RAISES `NO-OP` if nothing changed: a silent no-op is indistinguishable from a
# surviving gate, and the caller reads that raise as UNSUPPORTED.
# ─────────────────────────────────────────────────────────────────────────────────────
cat > "$WORK/_neut_inv.sql" <<'TMPL'
do $p0$
declare
  d text; tag text; hdr text; body text; newbody text;
  n1 int := 0; n2 int := 0; n3 int := 0; n4 int := 0;
  rls_tables text; id_asserts text;
  re_g1 text; re_g2 text; re_g4 text; re_g3 constant text :=
    '(?is)\y(els)?if\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?(app\.is_|app\.can_|app\.has_|app\.member_can|public\.is_|auth\.uid)(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\ythen\y';
begin
  -- G1's alternation: every RLS-protected relation, from the catalog.
  select string_agg(c.relname, '|') into rls_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relrowsecurity and c.relkind in ('r','p');
  if rls_tables is null then
    raise exception 'P0-HARNESS: no RLS relations found — G1 would be vacuous';
  end if;
  re_g1 := '(?is)\y(els)?if\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\yexists\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\y(' || rls_tables || ')\y(?:(?![;]|\ythen\y|\y(?:els)?if\y).)*?\ythen\y';

  -- G2's alternation: the app.assert_* functions whose OWN body touches identity.
  select string_agg(p.proname, '|') into id_asserts
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname like 'assert%'
    and p.prosrc ~ '(?i)(is_|can_|has_|member_can|memberships|auth\.uid)';
  if id_asserts is null then
    raise exception 'P0-HARNESS: no identity asserts found — G2 would be vacuous';
  end if;
  re_g2 := '(?is)\yperform\s+app\.(' || id_asserts || ')\s*\([^;]*\)';
  -- ⛔ THE ASSIGNMENT FORM, WHICH G2 CANNOT OPEN. An identity assert that RETURNS a
  -- value is called as `v := app.assert_X(...)`, and there is no type-safe neutral
  -- expression to swap in generically (`assert_meeting_staff_admin` yields the
  -- commission uuid the rest of the body then uses). Left alone, such a wrapper gets a
  -- verdict from whatever OTHER guard happened to match — which for `update_meeting`
  -- was a G1 probe on `commission_meeting_types`, a DOMAIN validity check, not the
  -- authorization decision. The suite then stayed PASS and it was recorded BLIND: a
  -- verdict about the authz gate, manufactured by opening something that is not the
  -- authz gate. A false BLIND is the mirror of the false COVERED the row-door harness
  -- warns about, and it is worse than no verdict because it looks like a finding.
  -- So: detect the form and refuse to return a verdict at all.
  re_g4 := '(?is):=\s*app\.(' || id_asserts || ')\s*\(';

  d := pg_get_functiondef(__OID__);
  -- ⚠ PLAIN string, not an E-string. The E-form turns `\n` into a literal newline BYTE
  -- and silently matches nothing — indistinguishable from "no function has a body".
  tag := (regexp_match(d, '\nAS (\$[^$]*\$)'))[1];
  if tag is null then raise exception 'P0-HARNESS: no dollar-body tag for oid __OID__'; end if;
  hdr  := split_part(d, tag, 1);
  body := split_part(d, tag, 2);

  select count(*) into n1 from regexp_matches(body, re_g1, 'g');
  select count(*) into n2 from regexp_matches(body, re_g2, 'g');
  select count(*) into n3 from regexp_matches(body, re_g3, 'g');
  select count(*) into n4 from regexp_matches(body, re_g4, 'g');

  -- An un-openable identity gate poisons any verdict this wrapper could produce: the
  -- suite would be answering about whichever OTHER guard we opened. Bail with a distinct
  -- marker so the caller records UNSUPPORTED rather than BLIND/COVERED. This costs
  -- coverage and says so; the alternative costs correctness and does not.
  if n4 > 0 then
    raise exception 'P0-UNOPENABLE: % identity assert(s) called in assignment form for oid __OID__', n4;
  end if;

  newbody := regexp_replace(body,    re_g1, '\1if false then', 'g');
  newbody := regexp_replace(newbody, re_g2, 'perform 1',        'g');
  newbody := regexp_replace(newbody, re_g3, '\1if false then',  'g');

  if newbody = body then
    raise exception 'P0-HARNESS: guard rewrite was a NO-OP for oid __OID__';
  end if;
  -- Structure check: opening a guard must not change block structure. A rewrite that
  -- swallowed an enclosing `if` would lose an `end if` and either fail to compile
  -- (loud) or compile as a DIFFERENT program (silent). Count them.
  if (select count(*) from regexp_matches(body, '(?i)\yend\s+if\y', 'g'))
     <> (select count(*) from regexp_matches(newbody, '(?i)\yend\s+if\y', 'g')) then
    raise exception 'P0-HARNESS: guard rewrite changed block structure for oid __OID__';
  end if;

  raise notice 'P0-GUARDS-OPENED g1=% g2=% g3=%', n1, n2, n3;
  if __DRY__ = 0 then
    execute hdr || tag || newbody || tag;
  end if;
end $p0$;
TMPL

emit_report () {
  local total; total=$(wc -l < "$WORK/worklist_invoker.tsv" | tr -d '[:space:]')
  {
    echo "# AUTHZ Invoker-Wrapper Audit — Findings"
    echo
    echo "AUDIT-INVOKER-WRAPPER (ADR 0078 §7.14 / ADR 0079). Generated by"
    echo "\`supabase/tests/mutation/p0-authz-invoker-audit.sh\`. Domain: every \`public\`,"
    echo "\`authenticated\`-reachable, **INVOKER** (\`prosecdef = f\`) plpgsql function — the"
    echo "class all three prior sweeps are structurally blind to, because each begins"
    echo "\`and p.prosecdef\`."
    echo
    echo "Method: open the wrapper's OWN gate — an RLS existence probe (G1), a"
    echo "\`perform app.assert_*\` naming an identity assert (G2), or an identity-primitive"
    echo "\`if\` condition (G3) — run the FULL pgTAP suite, read \`Result:\`."
    echo "**COVERED** = suite went \`FAIL\` (a keystone asserts through the gate). **BLIND**"
    echo "= suite stayed \`PASS\` (no keystone exercises it). **ERROR** = run shape !="
    echo "baseline (harness bug, not a result). **UNSUPPORTED** = no guard of any class"
    echo "matched, so this harness returns NO verdict — it is not swept, and it stays in"
    echo "the census backlog."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Public INVOKER functions in the live catalog: $total."
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
    echo "## UNSUPPORTED — no openable guard (NOT a verdict; still owed a keystone)"
    echo
    echo "These stay in \`supabase/tests/mutation/authz-unswept-backlog.txt\`."
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
  [ "$DRYRUN" = "1" ] || emit_report
}

# ── DRY RUN: classify only, no mutation, no suite ────────────────────────────────────
if [ "$DRYRUN" = "1" ]; then
  echo "--- DRY RUN: classifying guards only (no mutation, no suite run) ---"
  BASE_FILES="(dry)"; BASE_TESTS="(dry)"
  SUP=0; UNSUP=0
  while IFS=$'\t' read -r oid label proname; do
    [ -z "$oid" ] && continue
    want "$proname" || continue
    sed -e "s/__OID__/$oid/g" -e "s/__DRY__/1/g" "$WORK/_neut_inv.sql" > "$WORK/_mutinv.sql"
    mout=$(psql_f "$WORK/_mutinv.sql")
    if echo "$mout" | grep -q 'P0-UNOPENABLE'; then
    record "invoker" "$label" "open-guard" "UNSUPPORTED" "identity assert called in ASSIGNMENT form (\`v := app.assert_*\`) — no type-safe neutral value; any verdict here would be about a different guard"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label (un-openable identity assert)"; continue
  fi
  if echo "$mout" | grep -q 'NO-OP'; then
      UNSUP=$((UNSUP+1)); echo "  unsupported  $proname"
    elif echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
      echo "  HARNESS-ERROR  $proname :: $(echo "$mout" | tr '\n' ' ' | head -c 120)"
    else
      SUP=$((SUP+1))
      echo "  SUPPORTED    $proname  $(echo "$mout" | grep -oE 'g1=[0-9]+ g2=[0-9]+ g3=[0-9]+')"
    fi
  done < "$WORK/worklist_invoker.tsv"
  echo
  echo "=== DRY RUN DONE. supported: $SUP   unsupported: $UNSUP ==="
  echo "A supported count of 0 means the detector is broken, NOT that the codebase is clean."
  exit 0
fi

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

echo "=== INVOKER-WRAPPER ARM ==="
SUPPORTED=0; UNSUP=0
while IFS=$'\t' read -r oid label proname; do
  [ -z "$oid" ] && continue
  want "$proname" || continue

  s=$(slug "$label")
  orig="$WORK/orig_inv_${oid}_$s.sql"
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"

  # ⛔ ROLLBACK POINT FIRST — verify the restore file exists and is non-empty BEFORE
  # touching the function. This guard is the actual fix for the abort that cut the first
  # full run short at case 81 of 88; the over-long filename was only its trigger.
  # What happened without it: the `> "$orig"` redirect failed, `set -u` (no `-e`) let the
  # loop continue, the wrapper was neutralized anyway, and both the inline restore and
  # the EXIT trap then no-oped because they guard on `[ -f "$INFLIGHT" ]` — a file that
  # was never created. The sweep exited 2 having left `public.update_meeting` sitting in
  # the SHARED local stack with its authz gate open. A harness that mutates before it can
  # prove it can undo is a worse hazard than the blindness it audits.
  if [ ! -s "$orig" ]; then
    record "invoker" "$label" "open-guard" "ERROR" "could not capture a rollback point ($orig) — NOT mutated"
    INFLIGHT=""; echo "  ERROR  $label (no rollback point; skipped WITHOUT mutating)"; continue
  fi
  INFLIGHT="$orig"

  sed -e "s/__OID__/$oid/g" -e "s/__DRY__/0/g" "$WORK/_neut_inv.sql" > "$WORK/_mutinv.sql"
  mout=$(psql_f "$WORK/_mutinv.sql")
  if echo "$mout" | grep -q 'P0-UNOPENABLE'; then
    record "invoker" "$label" "open-guard" "UNSUPPORTED" "identity assert called in ASSIGNMENT form (\`v := app.assert_*\`) — no type-safe neutral value; any verdict here would be about a different guard"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label (un-openable identity assert)"; continue
  fi
  if echo "$mout" | grep -q 'NO-OP'; then
    record "invoker" "$label" "open-guard" "UNSUPPORTED" "no RLS probe / identity assert / identity condition to open"
    UNSUP=$((UNSUP+1)); INFLIGHT=""; echo "  UNSUPPORTED  $label"; continue
  fi
  if echo "$mout" | grep -qiE 'ERROR|P0-HARNESS'; then
    record "invoker" "$label" "open-guard" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 150)"
    psql_f "$orig" >/dev/null 2>&1; INFLIGHT=""
    echo "  ERROR  $label (neutralize failed)"; continue
  fi

  ng=$(echo "$mout" | grep -oE 'g1=[0-9]+ g2=[0-9]+ g3=[0-9]+' | tail -1 | tr ' ' ',')
  # ⚠ G1-ONLY VERDICTS ARE PROVISIONAL — see the G1 caveat in the header. When G1 is the
  # only class that fired, the opened guard may be a DOMAIN check rather than the authz
  # decision, and the suite then answered a question we did not ask. Flagged in the note
  # column so a g1-only BLIND is hand-classified before it is trusted or allowlisted.
  G1ONLY=""
  case "$ng" in g1=[1-9]*,g2=0,g3=0) G1ONLY="⚠ g1-only: PROVISIONAL, hand-classify (the opened probe may be a domain check, not the gate) — " ;; esac
  out=$(run_suite); echo "$out" > "$RUNLOGS/inv_$s.log"
  classify "$out"

  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $label did NOT round-trip. Every later case is"
    echo "    suspect. Aborting the sweep (§7.5)."; exit 2
  fi
  INFLIGHT=""

  record "invoker" "$label" "open-guard(${ng:-?})" "$VERDICT" "${G1ONLY}${FAILING:-}"
  SUPPORTED=$((SUPPORTED+1))
  echo "  $VERDICT  $label"
done < "$WORK/worklist_invoker.tsv"

emit_report
echo
echo "=== DONE. Report: $FINDINGS   BLINDs: $BLINDS_TSV ==="
awk -F'\t' '{c[$4]++} END{for(k in c) printf "%s: %d   ", k, c[k]; print ""}' "$PROGRESS"
echo "swept (suite-run): $SUPPORTED   unsupported (static): $UNSUP"
