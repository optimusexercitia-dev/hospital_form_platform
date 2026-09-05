#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AUTHZ SET-VALUED RESOLVERS — TARGETED MUTATION CASES (ADR 0191 axis 2).
#
# ⛔ WHY THIS FILE EXISTS, AND WHY IT IS NOT A WIDENING OF THE DOOR ARM.
# `p0-authz-door-audit.sh`'s predicate arm neutralizes a gate by swapping its body for
# `select true` / `select false`. That mechanism is defined only for a BOOLEAN (ADR 0079
# hazard 4). These three functions return `SETOF uuid`, so they are excluded by
# `t.typname='bool'` BEFORE any name, body or schema test runs — a third exclusion axis that
# no regex can reach (`FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS`). ADR 0191
# splits the fix: the SCHEMA axis widened `PRED_DOMAIN` for the booleans; the RETURN-TYPE
# family is swept HERE, by targeted cases with a committed home and a scheduled slot, so it
# runs on a schedule rather than when someone remembers.
#
# ⛔ THE SCOPE IS AN EXPLICIT RECORDED LIST OF THREE, NOT A DERIVED PROPERTY, AND THE REASON
# IS MEASURED. The follow-up proposed "a scope-id set CONSUMED BY A POLICY" as the selecting
# property. Measured on the live catalog 2026-09-05, that property selects exactly ONE of the
# three: only `app.current_professional_read_organizations` is named by an RLS policy
# (`professional_profiles_select`). The two `authz.*` resolvers are reached only
# TRANSITIVELY, through that function. A property that selects 1 of 3 and is described as
# selecting the family is the shape this whole program exists to catch, so the list is
# written down and its CARDINALITY is asserted (§4b) instead.
#
# IN SCOPE (3):
#   authz.authorized_scope_ids(uuid,text,text)            — the runtime scope resolver
#   authz.candidate_authorized_scope_ids(uuid,text,text)  — the pre-cutover oracle (ADR 0176 D4)
#   app.current_professional_read_organizations()         — the policy-facing wrapper (ADR 0182)
# OUT OF SCOPE, NAMED WITH THEIR DISPOSITION (2) — they are `prosecdef` `SETOF uuid` too, so
# §4b sees them and would otherwise read them as newcomers:
#   app.eligible_voters(uuid)      — RECIPIENT COMPUTATION, not an authority decision: its set
#                                    is iterated to build a voter roster. ADR 0173 D4's
#                                    discharge ("iterate -> recipients; branch -> authority").
#                                    It IS `authenticated`-EXECUTE-able, so it is in the
#                                    CENSUS's domain and owes its verdict THERE, not here.
#   app.person_authority_orgs(uuid) — locates an affiliation FOOTPRINT (Architecture Rule 13:
#                                    an affiliation LOCATES, a membership GRANTS). No
#                                    application role holds EXECUTE (measured `f`).
#
# ── WHAT A VERDICT HERE MEANS — deliberately the door arm's own semantics ────────────
# Neutralize the resolver to the UNIVERSAL SET (every organization/hospital/commission id),
# run the FULL pgTAP suite, read `Result:`.
#   Result: FAIL -> a keystone asserts THROUGH this resolver = COVERED
#   Result: PASS -> nothing exercises it; opening it is silent = BLIND (a finding)
#   shape moved -> ERROR / NOTICED, exactly as `p0-authz-door-audit.sh` §7.15c classifies.
# ⭐ THE UNIVERSAL SET IS A STRONGER NEUTRALIZATION THAN `select true` COULD EVER BE for this
# shape: it does not merely grant, it grants EVERY scope, so a caller that had begun ignoring
# its own scope argument is still measured.
#
# ⛔ ATTRIBUTES ARE PRESERVED, BODY ONLY IS SWAPPED. Signature, `SETOF uuid`, `STABLE`,
# `SECURITY DEFINER` and `search_path` all survive: the entire `pg_get_functiondef` header is
# kept and only the dollar-quoted body is replaced. A neutralization that also moved an
# attribute would red the schema-surface pgTAP assertions and poison the control (the door
# harness learned that on its first smoke run).
#
# ⛔ ITS OWN DEGENERACY ARM, BECAUSE THE EXISTING ONE CANNOT SEE THIS SHAPE (LEARN-082).
# `DEGENERATE_PREDICATE` matches `select true` / `begin return true; end` / `begin return; end`
# — a UNIVERSAL-SET body matches none of them, so the door harness's preflight would start a
# 10-hour sweep on a stack this script had left open. Two locks, and they are DIFFERENT KINDS:
#   §4a  RESIDUE BY PROPERTY, baseline-free: every `prosecdef` `SETOF uuid` function whose
#        comment-stripped body references NO authorization term is residue. Enumerated to ZERO
#        on a clean tree, and PROVEN ABLE TO FIRE on every run — while each mutation is live
#        the check must NAME that function (a detector that finds nothing must be proven able
#        to find something, and here the proof is not a knob but the run itself).
#   the MARKER form added to BOTH hand-kept `DEGENERATE_PREDICATE` copies
#        (`p0-authz-door-audit.sh` and `p0-authz-invariant.sh`), so a crash residue of THIS
#        harness stops the sibling sweeps the way theirs stops each other.
# ⚠ Those two copies are hand-kept and CAN drift — filed, not fixed here:
#   `FUP-DOOR-DEGENERATE-PREDICATE-TWO-HAND-COPIES`.
#
# ── USAGE ───────────────────────────────────────────────────────────────────────────
#   bash supabase/tests/mutation/authz-setvalued-targeted-cases.sh
#   RECOVER=1 bash ...   # re-apply an abandoned restore from the sentinel, then VERIFY it
# ⚠ ~4 full suite runs (~90-100 s each) => ~7 min. Launch DETACHED, never under a tool
#   timeout (`.claude/rules/mutation-harnesses-are-not-killable.md`).
#
# ── EXIT CODES — read them DIRECTLY, never through a pipe ───────────────────────────
#   0  CLEAN     all three cases COVERED and every restore verified
#   1  DIRTY     >=1 BLIND / NOTICED / ERROR
#   2  ABORT     contaminated stack, a restore that did not round-trip, or §4a/§4b red
#   3  UNPROVEN  the worklist did not resolve to the three subjects — nothing was measured
# ---------------------------------------------------------------------------
set -u

DB=supabase_db_azkbbhskturikxpgmafq
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-${TMPDIR:-/tmp}/authz-setvalued}"
# ⛔ FIXED path, deliberately NOT under $WORK, and a DISTINCT filename from both p0 siblings:
# a $WORK-relative sentinel is invisible to the next run (whose $WORK is fresh) and its check
# would pass vacuously, and a shared filename would let two harnesses consume each other's
# evidence.
SENTINEL="${AUTHZ_SETVALUED_SENTINEL:-${TMPDIR:-/tmp}/authz-setvalued-INFLIGHT.sql}"

if ! mkdir -p "$WORK" 2>/dev/null || ! : > "$WORK/.writable" 2>/dev/null; then
  echo "FATAL: WORK directory is not usable: $WORK" >&2
  echo "       Without it this harness reports a verdict having stored no evidence." >&2
  exit 2
fi
rm -f "$WORK/.writable"

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
# ⛔ `-f -` WITH A HOST REDIRECT, NEVER `-f <host path>`. psql runs INSIDE the container, so a
# `-f` path is resolved in the CONTAINER filesystem and a host path silently does not exist
# there. Measured on `ae3-targeted-cases.sh`: its first run left the database MUTATED because
# the restore could not find its own file. `ON_ERROR_STOP=1` is real here, so the exit code
# means something — but it is still not what the restore is believed on (see below).
psql_f () { MSYS_NO_PATHCONV=1 docker exec -i "$DB" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -P pager=off -f - < "$1" 2>&1; }

run_suite () { ( cd "$ROOT" && supabase test db ) 2>&1; }

fail_abort () { echo "*** ABORT: $*" >&2; exit 2; }

# ── the in-flight sentinel, ported from the p0 siblings with their 2026-09-04 fix ────
# The sentinel is dropped ONLY when psql exits 0 AND a probe RE-READ FROM THE CATALOG returns
# the value captured before the mutation. A job-tree SIGTERM runs the trap, kills its psql
# child, and the old unconditional `rm -f` then deleted the only record that a gate was open.
INFLIGHT=""; INFLIGHT_PROBE=""; INFLIGHT_WANT=""
arm_inflight () {   # $1 = restore .sql   $2 = probe SQL identifying the ORIGINAL catalog state
  INFLIGHT="$1"; INFLIGHT_PROBE="$2"
  INFLIGHT_WANT="$(psql_c -c "$2" 2>/dev/null)"
  cp -f "$1" "$SENTINEL"
  printf '%s' "$2"             > "$SENTINEL.probe"
  printf '%s' "$INFLIGHT_WANT" > "$SENTINEL.want"
}
disarm_inflight () {
  INFLIGHT=""; INFLIGHT_PROBE=""; INFLIGHT_WANT=""
  rm -f "$SENTINEL" "$SENTINEL.probe" "$SENTINEL.want" 2>/dev/null || true
}
restore_inflight () {
  [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ] || return 0
  echo "  (trap: restoring the in-flight resolver from $INFLIGHT)"
  local rc live
  psql_f "$INFLIGHT" >/dev/null 2>&1; rc=$?
  live=""
  [ -n "${INFLIGHT_PROBE:-}" ] && live="$(psql_c -c "$INFLIGHT_PROBE" 2>/dev/null)"
  if [ "$rc" = "0" ] && [ -n "${INFLIGHT_WANT:-}" ] && [ "$live" = "$INFLIGHT_WANT" ]; then
    echo "  restore VERIFIED against the catalog (psql rc=0, probe=$live)"
    disarm_inflight; return 0
  fi
  echo "*** RESTORE FAILED (psql rc=$rc; catalog probe='${live:-<unreadable>}' want='${INFLIGHT_WANT:-<none captured>}')" >&2
  echo "    ⛔ THE SENTINEL IS KEPT ON PURPOSE: $SENTINEL" >&2
  echo "       It is the only record that a resolver is OPEN on this stack. Do NOT delete it." >&2
  echo "      RECOVER=1 bash $0        # re-apply it, then VERIFY in the catalog" >&2
  echo "      supabase db reset        # the blunt, certain option" >&2
  echo "    ⚠ Do not hunt it with a COUNT — the discriminator is §4a's residue shape." >&2
  return 2
}
trap 'restore_inflight || exit 2' EXIT
trap 'echo; echo "*** SIGNAL — restoring the in-flight resolver before exiting."; restore_inflight; exit 2' INT TERM HUP

echo "=== AUTHZ SET-VALUED RESOLVERS — TARGETED MUTATION CASES ==="
echo "Repo: $ROOT"
echo "WORK: $WORK"

# ── the crash-sentinel check (a SIGKILL runs no trap at all) ─────────────────────────
if [ -s "$SENTINEL" ]; then
  if [ "${RECOVER:-0}" = "1" ]; then
    echo "--- RECOVER=1: applying the abandoned restore from $SENTINEL ---"
    sed -n '1,40p' "$SENTINEL"
    psql_f "$SENTINEL" >/dev/null 2>&1; rec_rc=$?
    rec_live=""; rec_want=""
    [ -s "$SENTINEL.probe" ] && rec_live="$(psql_c -c "$(cat "$SENTINEL.probe")" 2>/dev/null)"
    [ -s "$SENTINEL.want"  ] && rec_want="$(cat "$SENTINEL.want")"
    if [ "$rec_rc" = "0" ] && [ -n "$rec_want" ] && [ "$rec_live" = "$rec_want" ]; then
      mv -f "$SENTINEL" "$SENTINEL.recovered" 2>/dev/null || rm -f "$SENTINEL"
      rm -f "$SENTINEL.probe" "$SENTINEL.want" 2>/dev/null || true
      echo "*** RESTORE APPLIED and VERIFIED against the catalog (psql rc=0, probe=$rec_live)."
      echo "    ⚠ VERIFY IT ANYWAY — this message is not proof. ⛔ Every verdict from the killed"
      echo "    run is void: re-run from scratch."
      exit 2
    fi
    echo "*** RESTORE FAILED (psql rc=$rec_rc; probe='${rec_live:-<unreadable>}' want='${rec_want:-<none>}')." >&2
    echo "    The resolver is STILL OPEN and the sentinel is KEPT. Run 'supabase db reset' now." >&2
    exit 2
  fi
  echo "*** ABORT — A PREVIOUS RUN DIED WITH A RESOLVER STILL OPEN." >&2
  echo "    Sentinel: $SENTINEL   (it holds the SQL that restores it)" >&2
  sed -n '1,12p' "$SENTINEL" | sed 's/^/      | /' >&2
  echo "      RECOVER=1 bash $0        # apply that restore, then VERIFY it in the catalog" >&2
  echo "      supabase db reset        # the blunt, certain option" >&2
  exit 2
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# §4a  RESIDUE BY PROPERTY — baseline-free, and PROVEN ABLE TO FIRE on every run.
#
# A `prosecdef` `SETOF uuid` function that answers an authorization question must READ
# something identity-shaped. A UNIVERSAL-SET body reads none of it. So: comment-stripped
# body references NO term from the vocabulary below => RESIDUE.
# ⚠ The vocabulary is deliberately NARROW enough to be a real test and WIDE enough to be
#   clean today, and both halves are MEASURED (2026-09-05): all 5 live subjects match; the
#   two neutralization bodies this script writes match none. The bare words `role` and
#   `grant` were dropped — a vocabulary that matches everything is a detector that finds
#   nothing, spelled the other way round.
# ─────────────────────────────────────────────────────────────────────────────────────
SETVALUED_AUTHZ_TERMS='memberships|principal_id|auth\.uid|authz\.|affiliation|permission|professional'
residue_setvalued () {
  psql_c -c "select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
               from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname in ('app','public','authz')
                and p.prosecdef and p.proretset and p.prorettype='pg_catalog.uuid'::regtype
                and not (lower(regexp_replace(p.prosrc,'--[^\n]*','','g')) ~ '$SETVALUED_AUTHZ_TERMS')
              order by 1;" | grep -vE '^$'
}

echo
echo "--- §4a preflight: no set-valued resolver is already sitting on a universal set ---"
PRE_RESIDUE="$(residue_setvalued)"
if [ -n "$PRE_RESIDUE" ]; then
  echo "*** PREFLIGHT FAILED — residue on this stack:"; echo "$PRE_RESIDUE" | sed 's/^/      /'
  fail_abort "a resolver is already neutralized; every verdict below would be against an open door"
fi
echo "    clean — 0 residue rows"

# ─────────────────────────────────────────────────────────────────────────────────────
# §4b  THE WORKLIST EXPECTATION — a CARDINALITY control (LEARN-085).
# ⛔ Not "the three are present" (that is satisfied by a catalog with thirty). The LIVE
# population of `prosecdef` `SETOF uuid` functions must equal the FIVE this file has ruled
# on, exactly. A sixth appearing is a function nobody has classified, and it reds HERE
# rather than being silently swept past.
# ─────────────────────────────────────────────────────────────────────────────────────
IN_SCOPE="app.current_professional_read_organizations()
authz.authorized_scope_ids(p_principal uuid, p_resolution_kind text, p_permission_code text)
authz.candidate_authorized_scope_ids(p_principal uuid, p_resolution_kind text, p_permission_code text)"
OUT_OF_SCOPE="app.eligible_voters(p_case_id uuid)
app.person_authority_orgs(p_person uuid)"

echo
echo "--- §4b: the live set-valued population is exactly the 5 this file rules on ---"
psql_c -c "select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
             from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname in ('app','public','authz')
              and p.prosecdef and p.proretset and p.prorettype='pg_catalog.uuid'::regtype
            order by 1;" | grep -vE '^$' | sort > "$WORK/live_setvalued.txt"
printf '%s\n%s\n' "$IN_SCOPE" "$OUT_OF_SCOPE" | sort > "$WORK/expected_setvalued.txt"
if ! diff -u "$WORK/expected_setvalued.txt" "$WORK/live_setvalued.txt" > "$WORK/setvalued.diff"; then
  echo "*** §4b FAILED — the live population is NOT the 5 this file rules on:"
  sed 's/^/      /' "$WORK/setvalued.diff"
  echo "    A '+' line is a resolver nobody has classified: rule on it (in scope, or out of"
  echo "    scope WITH its disposition) before this harness can claim to sweep the family."
  fail_abort "§4b cardinality control red"
fi
echo "    ok — 5 live, 3 in scope, 2 out of scope with a recorded disposition"

# ── the green baseline: a dirty baseline makes every COVERED unreadable ──────────────
echo
echo "--- preflight: capturing GREEN baseline ---"
BASE_OUT="$(run_suite)"
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A COVERED" >&2
  echo "    cannot be told from a pre-existing red. Fix the tree to green first." >&2
  exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"

# ── the neutralizer: keep the whole functiondef header, swap the dollar-quoted body ──
# ⚠ An anonymous DO block, never a persistent helper: a persistent `app.*` helper trips the
#   schema-surface pgTAP assertions and turns the GREEN baseline RED — poisoning the very
#   control this harness depends on.
NEUT_MARKER='P0-SETVALUED-NEUTRALIZED'
# ⛔ QUOTED HEREDOCS, AND THE OID IS THE ONLY SUBSTITUTION. Measured 2026-09-05, first run:
# the first version built this SQL with `printf`, the backslashes in the dollar-tag regex were
# mangled on the way through the shell, and all three cases came back
# `ERROR: SETVALUED-HARNESS: no dollar-body tag`. That is the very trap the door harness's own
# template comments about ("an unquoted heredoc mangles the backslashes") and I re-created it
# one file over. ⭐ The harness's contract held: it recorded ERROR rather than a verdict,
# restored all three subjects and VERIFIED each in the catalog. A mutation that did not land
# must never look like a result.
#
# There is no regex here at all now. `pg_get_functiondef` always ends its header with a line
# `AS <dollar-tag>`, so the split point is `position(E'\nAS ' in d)` — no backslash-escaped
# `$` to survive two layers of quoting. The body travels in its own file, appended between two
# quoted heredocs, so it is never parsed by the shell either.
neutralize () {  # $1 = file holding the ORIGINAL pg_get_functiondef   $2 = replacement body file
  local f="$WORK/_mut.sql" tag
  # ⛔ NO `DO` BLOCK, NO NESTED DOLLAR QUOTES, NO REGEX — third version, and the two failures
  # are why. v1 built the tag regex with `printf` and the backslashes were mangled
  # (`no dollar-body tag`). v2 moved to a `DO` block with an inner `$svbody$` tag and Postgres
  # answered `unterminated dollar-quoted string at or near "$$svbody$`. Each fix was a smaller
  # version of the same mistake: quoting SQL that quotes SQL, through a shell.
  #
  # The definition is ALREADY on disk — `$orig` is the exact `pg_get_functiondef` text the
  # restore is byte-compared against. So: take its header up to and INCLUDING the `AS $tag$`
  # line, append the new body, close with the SAME tag. One dollar-quote, at one level, whose
  # tag Postgres itself chose and guaranteed absent from the body.
  tag=$(awk '/^AS \$/{print $2; exit}' "$1")
  if [ -z "$tag" ]; then
    echo "SETVALUED-HARNESS: no 'AS \$tag\$' line in the captured definition ($1)"; return 1
  fi
  awk '{print} /^AS \$/{exit}' "$1" > "$f"     # header, through the `AS $tag$` line
  cat "$2"                                >> "$f"   # the neutralized body
  printf '%s\n;\n' "$tag"                 >> "$f"   # the closing tag, then the statement end
  psql_f "$f"
}

VERDICTS=""
DIRTY=0
run_case () {  # $1 = label   $2 = catalog lookup predicate   $3 = FILE holding the replacement body
  local label="$1" pred="$2" bodyfile="$3"
  local oid orig probe before after out res ft rf rt dub verdict note shapefiles failing
  echo
  echo "=========================================================================="
  echo "--- CASE: $label"
  echo "=========================================================================="
  oid="$(psql_c -c "select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where $pred;")"
  case "$oid" in ''|*[!0-9]*) echo "*** UNPROVEN: no unique oid for $label (got '$oid')"; return 3 ;; esac

  orig="$WORK/orig_$(echo "$label" | tr -c 'A-Za-z0-9_' '_').sql"
  psql_c -c "select pg_get_functiondef($oid);" > "$orig"
  probe="select md5(pg_get_functiondef($oid))"
  before="$(psql_c -c "$probe")"
  [ -n "$before" ] || { echo "*** could not fingerprint $label"; return 3; }
  echo "  fingerprint before : $before"

  arm_inflight "$orig" "$probe"

  local mout; mout="$(neutralize "$orig" "$bodyfile")"
  if echo "$mout" | grep -qiE 'ERROR|SETVALUED-HARNESS'; then
    echo "*** the neutralization FAILED to apply: $(echo "$mout" | tr '\n' ' ' | head -c 200)"
    restore_inflight || fail_abort "the restore of $label REFUSED"
    VERDICTS="$VERDICTS
$label	ERROR	neutralize failed"
    DIRTY=1; return 1
  fi

  local mutated; mutated="$(psql_c -c "$probe")"
  echo "  fingerprint mutated: $mutated"
  # ⛔ A MUTATION THAT DID NOT FULLY APPLY REPORTS GREEN, which is indistinguishable from a
  #    covered resolver. Assert the subject MOVED before believing anything downstream.
  [ "$mutated" != "$before" ] || fail_abort "$label: THE MUTATION DID NOT LAND (fingerprint unchanged) — a verdict here would prove nothing"

  # ⭐ §4a PROVEN ABLE TO FIRE, on this run, on a REAL strand — not a knob and not a fixture.
  local live_residue; live_residue="$(residue_setvalued)"
  echo "  §4a while the mutation is LIVE:"
  echo "$live_residue" | sed 's/^/      /'
  echo "$live_residue" | grep -qF "${label%%(*}" \
    || fail_abort "$label: §4a did NOT name the mutated resolver — the residue detector cannot see the very body this harness writes, so its 0 on a clean tree proves nothing"

  out="$(run_suite)"; echo "$out" > "$WORK/runlog_$(echo "$label" | tr -c 'A-Za-z0-9_' '_').log"
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  rf=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  rt=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  dub=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  failing=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  shapefiles=$(echo "$out" | grep -iE 'Dubious|Bail out|Bad plan' | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  # ⚠ The SAME four-outcome classifier as p0-authz-door-audit.sh §7.15c, so a verdict from
  #   here is comparable with one from there. NOTICED never collapses into COVERED.
  if [ -z "$res" ] || [ "$rf" != "$BASE_FILES" ] || [ "$rt" != "$BASE_TESTS" ] || [ "$dub" -gt 0 ]; then
    if [ "$res" = "FAIL" ]; then
      verdict="NOTICED"; note="suite FAIL but run-shape!=baseline (Files=$rf Tests=$rt); aborting file(s): ${shapefiles:-<none>}; reddened: ${failing:-<none>}"
    else
      verdict="ERROR";   note="run-shape!=baseline (Files=$rf Tests=$rt)"
    fi
  elif [ "$res" = "FAIL" ]; then verdict="COVERED"; note="$failing"
  elif [ "$res" = "PASS" ]; then verdict="BLIND";   note="universal set granted; nothing reddened"
  else verdict="ERROR"; note="unparseable result"; fi

  # RESTORE + VERIFY IN THE CATALOG. psql's exit code is not what this is believed on.
  psql_f "$orig" >/dev/null 2>&1
  after="$(psql_c -c "$probe")"
  echo "  fingerprint restored: $after"
  [ "$after" = "$before" ] || fail_abort "$label: RESTORE DID NOT RETURN THE ORIGINAL (before=$before after=$after) — every later case is contaminated"
  disarm_inflight

  echo "  VERDICT: $verdict  ($note)"
  VERDICTS="$VERDICTS
$label	$verdict	$note"
  case "$verdict" in COVERED) ;; *) DIRTY=1 ;; esac
  return 0
}

# The two neutralization bodies, written ONCE to files so the shell never re-parses them.
# ⚠ `search_path` is `''` on the two `authz.*` resolvers, so every relation is schema-qualified
# or the replacement would not resolve. The marker line is what BOTH `DEGENERATE_PREDICATE`
# copies match, so a crash residue of this harness stops the p0 sweeps.
cat > "$WORK/body_universal_scope.sql" <<SVB
  -- $NEUT_MARKER : every organization, hospital and commission id, regardless of principal
  select id from public.organizations
  union all select id from public.hospitals
  union all select id from public.commissions;
SVB
cat > "$WORK/body_universal_org.sql" <<SVB
  -- $NEUT_MARKER : every organization id, regardless of the calling professional
  select id from public.organizations;
SVB

RC3=0
run_case "authz.authorized_scope_ids(uuid,text,text)" \
  "n.nspname='authz' and p.proname='authorized_scope_ids'" "$WORK/body_universal_scope.sql" || RC3=$?
run_case "authz.candidate_authorized_scope_ids(uuid,text,text)" \
  "n.nspname='authz' and p.proname='candidate_authorized_scope_ids'" "$WORK/body_universal_scope.sql" || RC3=$?
run_case "app.current_professional_read_organizations()" \
  "n.nspname='app' and p.proname='current_professional_read_organizations'" "$WORK/body_universal_org.sql" || RC3=$?

# ─────────────────────────────────────────────────────────────────────────────────────
# THE RESTORES ARE VERIFIED THREE WAYS, because an exit status was never proof.
#   1. per case, md5(pg_get_functiondef) == the value captured before the mutation (above);
#   2. §4a residue enumerated to ZERO rows again — the property, not the fingerprint;
#   3. the FULL suite green again — the behaviour, not the catalog.
# (Plus: the sentinel and its two sidecars must be gone.)
# ─────────────────────────────────────────────────────────────────────────────────────
echo
echo "=========================================================================="
echo "--- restore verification (three ways) ---"
POST_RESIDUE="$(residue_setvalued)"
if [ -n "$POST_RESIDUE" ]; then
  echo "*** (2) §4a RESIDUE REMAINS after the restores:"; echo "$POST_RESIDUE" | sed 's/^/      /'
  fail_abort "the stack is left contaminated"
fi
echo "  (2) §4a residue: 0 rows"
POST_OUT="$(run_suite)"
POST_RES=$(echo "$POST_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
POST_FT=$(echo "$POST_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
echo "  (3) suite after restore: Result: ${POST_RES:-<none>}  ($POST_FT)"
[ "$POST_RES" = "PASS" ] || fail_abort "the suite is NOT green after the restores — a restore is incomplete"
for f in "$SENTINEL" "$SENTINEL.probe" "$SENTINEL.want"; do
  [ -e "$f" ] && fail_abort "sentinel artefact still present: $f"
done
echo "  (4) sentinel + sidecars: absent"

# ── the verdicts, as ROWS for docs/reviews/authz-door-audit-findings.md ──────────────
# ⛔ PRINTED, NEVER WRITTEN. That file is re-earned only through the door arm's merge
# (`scripts/lib/merge-findings-baseline.sh`); a second writer would be the
# FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE shape one layer out. Filing is a human step.
echo
echo "=========================================================================="
echo "--- VERDICTS (file these BY HAND into docs/reviews/authz-door-audit-findings.md) ---"
echo "| gate / policy | arm | direction | verdict | failing files / note |"
echo "|---|---|---|---|---|"
printf '%s\n' "$VERDICTS" | grep -vE '^$' | while IFS=$'\t' read -r l v n; do
  printf '| %s | setvalued-targeted | open->universal-set | %s | %s |\n' "$l" "$v" "$n"
done
echo
echo "ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)"
printf '%s\n' "$VERDICTS" | grep -vE '^$' | awk -F'\t' '{print "  " $2 "\t" $1}'

if [ "$RC3" = "3" ]; then
  echo "=== RESULT: UNPROVEN — a subject did not resolve. NOT a pass. ==="
  exit 3
elif [ "$DIRTY" = "1" ]; then
  echo "=== RESULT: DIRTY — at least one case is not COVERED. This BLOCKS the phase. ==="
  exit 1
fi
echo "=== RESULT: CLEAN — 3 resolver(s) measured, all COVERED. ==="
exit 0
