#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078 — the no-regression-twin rule). A test that cannot fail is
# not evidence. Run from the repo root against a local stack, on a FRESH `supabase db
# reset` (E2E leftovers red this suite for reasons that are not defects):
#   bash supabase/tests/mutation/p3-case-print-mutation-audit.sh
# Every mutation must read RED-PROVEN, and the FINGERPRINT must match the one named.
#
# ---------------------------------------------------------------------------
# WHY THIS FILE EXISTS — PDF·P3 findings C-3 and M-3
# ---------------------------------------------------------------------------
# PDF·P3's mutation audit ran FOUR mutations (`can_read_full_case_content`,
# `open_printed_document`'s gate, `log_document_previa`'s asymmetry,
# `can_read_case_patient`) and was then reported as though it covered suite `368`'s
# absence-and-pairing claims generally. It did not. `368` t40 was NEVER neutralised —
# and t40 turned out to be non-causal: it asserted `exists (case_patient.read for
# case_t)` under the caption "a PHI mint emits both rows", while the row was written by
# t18 twenty-odd assertions earlier in the same transaction. Deleting the mints left it
# green.
#
#   ⭐ A mutation audit's coverage is the set of mutations you RAN, never the suite you
#   ran them IN. The assertions nobody suspected inherited the audit's credibility by
#   association.
#
# So the repaired and newly-added assertions get their neutralizations written DOWN,
# here, where the next reader can re-run them instead of trusting a sentence.
#
# ---------------------------------------------------------------------------
# HOW IT WORKS — the p0137 / be3b / m1 / m5 / m6 harness shape, inherited whole
# ---------------------------------------------------------------------------
# The mutation is injected INSIDE `368`'s own transaction, after the marker line, so it
# rolls back with the suite. Nothing persists even if a run aborts, and there is no
# restore step to half-apply — the class of failure where "a mutation that did not fully
# apply reports GREEN" is removed by construction rather than by discipline. The
# closing BASELINE re-run is the explicit "…and it is green again" reading.
#
# ⛔ 1. THE PROBE MUST MOVE THE TEXT. `_mut_368` compares `pg_get_functiondef` before
# and after its own `replace()` and RAISES when nothing changed. A `replace()` whose
# needle drifted (a reformatted body, a renamed variable, a migration that re-emitted
# the function) is otherwise a silent NO-OP: the suite runs clean and the harness
# reports GREEN, certifying coverage that was never exercised. This repo has shipped
# that exact reading — four mutations that silently never applied.
#
# ⛔ 2. MIGRATION TEXT IS NOT THE BODY. Every needle below was copied from a migration
# file, and some migrations in this repo rewrite function bodies at runtime via
# `pg_get_functiondef()` + `replace()` + `execute`. Guard 1 is what makes that safe:
# the needles are checked against the LIVE catalog on every run, and a drifted one is
# an exception, not a pass.
#
# ⛔ 3. RED IS MEASURED, NOT PREDICTED. Each mutation's reds are DIFFED against a clean
# baseline run of the same file, matched by LABEL (an inserted assertion renumbers
# everything after it, and a number-keyed verdict then points at the wrong test while
# still looking authoritative). The printed counts are an OUTPUT of the run.
#
# ⛔ 4. THE FINGERPRINT IS THE POINT, not the count. Mutations 1 and 2 open the two
# INDEPENDENT gates of `open_printed_document`; each must red its own assertion and
# leave the other's green. "Some assertion went red" would also be satisfied by one
# gate being counted twice.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/368_printed_documents_cases.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

OPEN_DOC="public.open_printed_document(uuid)"
GET_PATIENTS="public.get_case_patients(uuid)"
MINT="public.mint_printed_document(uuid,text,uuid,text,integer,text,text,text,boolean,integer)"
CASE_CAPS="app._case_caps(uuid,uuid)"
RESOLVER="app.resolve_document_version_bytes(uuid,text,uuid)"

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_368(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare
  d0 text := pg_get_functiondef(p_fn::regprocedure);
  d  text := d0;
begin
  if p_what = 'open_gate1_scope' then
    -- GATE 1 of open_printed_document: the A7 scope check. Opening it must red the
    -- RECUSED member's download cell (t38a) and must NOT touch t36, which is refused
    -- by gate 2. Reference: ADR 0144 D8, "mint and download alike".
    d := replace(d,
      'if not app.can_view_printed_document(v_row.source_kind, v_row.source_id, auth.uid()) then',
      'if false then');
  elsif p_what = 'resolver_all_case_locks' then
    -- ⭐ MEASURED, not assumed: the case-homed download has THREE locks, not two.
    -- Opening gate 1 + the deliberation conjunct STILL aborted the suite, because the
    -- resolver's KERNEL (`app.can_read_document`, whose print arm re-derives case reach)
    -- raises P0002 first. This arm opens both resolver locks so 1c can produce the true
    -- FAIL-OPEN reading — a row where there should be none — instead of an exception.
    -- ⛔ An abort is not a leak, and a leak is what an absence assertion must be able to
    -- see. Until all three are open, "t38a can go red" was only shown as "t38a can ERROR".
    d := replace(d,
      'if not app.can_read_document(v_doc.id, p_uid) then',
      'if false then');
    d := replace(d,
      'and not app.has_case_capability(v_case, p_uid, ''read_case_deliberation'') then',
      'and false then');
  elsif p_what = 'resolver_case_deliberation' then
    -- ⭐ THE SECOND LOCK on the case-homed DOWNLOAD, and it is a different function.
    -- `app.resolve_document_version_bytes` re-gates case-homed bytes on
    -- read_case_deliberation and RAISES 42501 rather than returning empty. Opening it
    -- ALONE must change nothing (gate 1 still refuses) — that is the reading that says
    -- gate 1 is independently load-bearing rather than a second copy of this one.
    d := replace(d,
      'and not app.has_case_capability(v_case, p_uid, ''read_case_deliberation'') then',
      'and false then');
  elsif p_what = 'open_gate2_identified' then
    -- GATE 2: the template_key-keyed PHI term. Opening it must red t36 (the
    -- content-only caller receiving the IDENTIFIED document) and must NOT touch t38a.
    d := replace(d,
      'and not app.can_read_case_patient(v_row.source_id, auth.uid()) then',
      'and false then');
  elsif p_what = 'phi_read_audit_off' then
    -- The AUDITED READER's EMISSION is guarded off while the READ itself is untouched:
    -- `get_case_patients` still returns the patient rows (t18 stays GREEN) but writes no
    -- `case_patient.read` row, so t40's DELTA cannot move. That pair is the
    -- discriminator — it proves t40 measures the AUDIT and not the READ.
    -- ⚠ TWO EDITS (the `if false then` and its `end if;`), which is why both needles are
    -- checked: a two-part mutation with one part applied does not compile, and a
    -- half-applied mutation is the shape that has read as GREEN in this repo before.
    -- ⛔ Two simpler mutations were tried and REJECTED, recorded so they are not retried:
    -- redirecting `entity_id` to `gen_random_uuid()` makes `log_audit_access` raise
    -- "sem permissão para registrar este acesso" (it authorizes the entity), which
    -- ABORTS the suite at t18 — 41 assertions GONE, and an ERROR is not a pass. Mangling
    -- the ACTION string fails the same authorizer.
    d := replace(d, 'perform public.log_audit_access(',
                    'if false then perform public.log_audit_access(');
    d := replace(d, ');' || chr(10) || '    v_result := v_result || to_jsonb(v_row);',
                    '); end if;' || chr(10) || '    v_result := v_result || to_jsonb(v_row);');
  elsif p_what = 'mint_reads_phi' then
    -- ⭐ THE PROOF THAT t40a CAN FAIL. t40a asserts the mint window adds ZERO
    -- case_patient.read rows — an ABSENCE. Make the mint actually call the audited
    -- reader and the absence must break. Without this the assertion would rest on the
    -- claim it is trying to establish.
    -- The extra conjunct is only reachable on the identified arm, which t30 mints; the
    -- refused mints (t28/t35) short-circuit or roll back, so t35 stays GREEN.
    d := replace(d,
      'and not app.can_read_case_patient(p_source_id, v_uid) then',
      'and not (app.can_read_case_patient(p_source_id, v_uid) and public.get_case_patients(p_source_id) is not null) then');
  elsif p_what = 'caps_drop_respondent_deny' then
    -- STEP 4's RESPONDENT hard-deny, removed while the RECUSAL deny stays. The two are
    -- SIBLING ARMS of one step: removing one must red the phase-only-respondent cells
    -- and leave t25/t26/t28/t38a (the recused member) untouched. Otherwise one arm is
    -- being credited for both — the sibling-arm blindness this repo has already paid for.
    d := replace(d,
      'if app.is_case_respondent(p_case_id, p_uid) then',
      'if false then');
  elsif p_what = 'caps_drop_recusal_deny' then
    -- The MIRROR of the above: the RECUSAL deny removed while the respondent deny
    -- stays. Must red the recused cells and leave the respondent cells alone. Run as a
    -- pair or neither reading means anything.
    d := replace(d,
      'if app.is_recused_from_case(p_case_id, p_uid) then',
      'if false then');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  if d = d0 then
    raise exception 'MUTATION DID NOT APPLY: % on % (needle drifted — re-read the LIVE body, not the migration)', p_what, p_fn;
  end if;
  execute d;
  -- Second half of the guard: prove the edit is in the LIVE catalog, not merely in the
  -- string we built.
  if pg_get_functiondef(p_fn::regprocedure) = d0 then
    raise exception 'MUTATION DID NOT LAND: % on %', p_what, p_fn;
  end if;
  -- The two-part edit gets its own landing check: `d <> d0` is satisfied by the FIRST
  -- replace alone, and a body with `if false then` and no `end if;` would not compile —
  -- but saying so relies on the compiler, not on a measurement.
  if p_what = 'phi_read_audit_off'
     and pg_get_functiondef(p_fn::regprocedure) not like '%); end if;%' then
    raise exception 'MUTATION HALF-APPLIED: phi_read_audit_off (the end if; needle drifted)';
  end if;
end; $m$;
EOF

run_file () {  # $1 = sql file on host; echoes raw TAP
  docker cp "$1" "$DB:/tmp/mut368.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut368.sql 2>&1
}

parse_tap () { sed -nE 's/^(not ok|ok) [0-9]+ - (.*)$/\1|\2/p'; }

build () {  # $1 = mutation SQL (empty for the baseline); echoes the file path
  local mut="$1" f="$WORK/mut368.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then echo "MARKER-NOT-FOUND" >&2; return 1; fi
  if [ -z "$mut" ]; then
    cp "$SRC" "$f"
  else
    { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
      tail -n +$((line+1)) "$SRC"; } > "$f"
  fi
  echo "$f"
}

PGTAP_WAS=$(docker exec "$DB" psql -U postgres -d postgres -tAc \
  "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q \
  -c "create extension if not exists pgtap with schema extensions;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop function if exists app._mut_368(text,text);" >/dev/null 2>&1
  [ "${PGTAP_WAS:-0}" = "0" ] && docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  return 0
}
trap cleanup EXIT

baseline () {  # $1 = banner
  echo
  echo "=== BASELINE $1 (unmutated $SRC) ==="
  BASE_TAP=$(run_file "$(build '')")
  echo "$BASE_TAP" | parse_tap > "$WORK/mut368.base"
  BASE_OK=$(grep -c '^ok|' "$WORK/mut368.base" || true)
  BASE_RED=$(grep -c '^not ok|' "$WORK/mut368.base" || true)
  echo "baseline: $BASE_OK ok, $BASE_RED not ok"
  # ⛔ planned == ran, per file. Never trust a summary line.
  echo "$BASE_TAP" | grep -E '^1\.\.|Looks like you planned' || true
  if [ "${BASE_RED:-0}" != "0" ]; then
    echo "*** BASELINE IS NOT GREEN — every diff below would be measured against a"
    echo "*** broken reference. Fix the suite (or take a fresh db reset) first."
    echo "$BASE_TAP" | grep '^not ok' | head -20
  fi
}

run_mutation () {  # $1 = label, $2 = mutation SQL, $3 = expected fingerprint (prose)
  local label="$1" mut="$2" want="$3" tap newred
  echo
  echo "=== MUTATION: $label ==="
  echo "    EXPECTED FINGERPRINT: $want"
  tap=$(run_file "$(build "$mut")")
  echo "$tap" | parse_tap > "$WORK/mut368.cur"
  newred=0
  while IFS='|' read -r st lbl; do
    [ "$st" = "ok" ] || continue
    if grep -Fxq "not ok|$lbl" "$WORK/mut368.cur"; then
      echo "  RED   $lbl"; newred=$((newred+1))
    elif ! grep -Fxq "ok|$lbl" "$WORK/mut368.cur"; then
      echo "  GONE  $lbl   (suite aborted before this assertion)"; newred=$((newred+1))
    fi
  done < "$WORK/mut368.base"
  if [ "$newred" = "0" ]; then
    echo "  *** NOT PROVEN — the mutation changed no verdict. Either the needle drifted"
    echo "  *** (then _mut_368 raised — look above) or no assertion stands behind this body."
    echo "$tap" | grep -iE 'MUTATION DID NOT|ERROR|FATAL' | head -5
  else
    echo "  RED-PROVEN ($newred assertion(s)) — now CHECK THE SET against the fingerprint."
  fi
}

baseline "1/2 (before)"

# ── The DOWNLOAD path has TWO locks in TWO functions. Mutations 1a/1b/1c separate
# them: neither alone opens it, and the pair does. ⛔ "A door can have two locks" is
# only worth writing down when the locks are genuinely different predicates — these are
# (`can_view_printed_document` vs `has_case_capability(...,'read_case_deliberation')`),
# though both ultimately read `app._case_caps`: two call sites, one source of truth.
run_mutation "1a/8 open_printed_document GATE 1 — the A7 scope check is opened" \
  "select app._mut_368('$OPEN_DOC', 'open_gate1_scope');" \
  "t38a/t38b reached and the SECOND lock raises 42501 -> the suite ABORTS at t38a. That abort IS the finding, not a pass: see 1c for the clean red"

run_mutation "1b/8 the byte resolver's read_case_deliberation conjunct is opened, ALONE" \
  "select app._mut_368('$RESOLVER', 'resolver_case_deliberation');" \
  "NOTHING reds — gate 1 still refuses both personas. This is the reading that gate 1 is independently load-bearing"

run_mutation "1c/8 ALL THREE download locks opened — the true fail-open" \
  "select app._mut_368('$OPEN_DOC', 'open_gate1_scope'); select app._mut_368('$RESOLVER', 'resolver_all_case_locks');" \
  "t38a AND t38b RED with count 1 (a LEAK, not an abort) · t36 STAYS GREEN (gate 2 untouched)"

run_mutation "2/8 open_printed_document GATE 2 — the identified/template_key PHI term is opened" \
  "select app._mut_368('$OPEN_DOC', 'open_gate2_identified');" \
  "t36 RED (content-only caller receives the identified doc) · t38a/t38b STAY GREEN"

run_mutation "3/8 the audited reader's case_patient.read emission is guarded off" \
  "select app._mut_368('$GET_PATIENTS', 'phi_read_audit_off');" \
  "t40 RED (the delta cannot move) · t18 STAYS GREEN (the READ still returns rows) · t40a STAYS GREEN"

run_mutation "4/8 the MINT is made to call the audited reader (t40a's absence must break)" \
  "select app._mut_368('$MINT', 'mint_reads_phi');" \
  "t40a RED (the mint window now adds a row) · t40 STAYS GREEN · t35 STAYS GREEN"

run_mutation "5/8 _case_caps STEP 4 — the RESPONDENT hard-deny is removed (recusal kept)" \
  "select app._mut_368('$CASE_CAPS', 'caps_drop_respondent_deny');" \
  "t28d/e/f/g and t38b RED · t25/t26/t28/t38a (the RECUSED member) STAY GREEN"

run_mutation "6/8 _case_caps STEP 4 — the RECUSAL hard-deny is removed (respondent kept)" \
  "select app._mut_368('$CASE_CAPS', 'caps_drop_recusal_deny');" \
  "t25/t26/t28/t38a RED · t28a-g and t38b (the RESPONDENT) STAY GREEN. ⛔ Before the §0 S3 grant was added this mutation moved NOTHING — st_x had no positive arm for the recusal to override"

baseline "2/2 (after — the explicit 'green again' reading)"

echo
echo "=== done. Nothing persists: every mutation ran inside the suite's own transaction."
echo "=== ⛔ A count is not a verdict. Compare each SET above with its fingerprint."
