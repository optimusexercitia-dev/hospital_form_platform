#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# DOOR-SWEEP CASE DERIVATION — derive the `CASES=` list for CLAUDE.md §6 step 1's
# diff-scoped sweep from the phase's migration diff, and RED when the derivation
# comes back empty.
#
# ⛔ WHY THIS EXISTS AS A SCRIPT AND NOT AS PROSE. ADR 0079 Amendment 8 (2026-08-23)
# ruled three changes to the recipe. Two days later a second operator re-derived the
# whole diagnosis from scratch during AFF3 (ADR 0148), because the ruling lived only
# in an ADR paragraph eleven screens from the recipe it governed
# (FUP-DOOR-SWEEP-RECIPE-STILL-BLIND-TO-ALTER-POLICY). Ruling 2 in particular needs
# somewhere that *reds*; a paragraph cannot red.
#
#   1. `alter policy` is greped ALONGSIDE `create policy`. An RLS **widening** is not
#      a create. The old one-line recipe returned zero rows for it, the phase swept
#      nothing, and it read as clean. Measured: AFF3's migration altered three
#      policies and the recipe derived zero.
#   2. A ZERO-ROW CASE LIST IS A FINDING, NOT A PASS. "the recipe printed nothing"
#      and "the phase changed no gate" stop being the same observation here: they are
#      exit 1 and exit 3, with different messages. A detector that finds nothing must
#      be proven able to find something — this ADR's own closing line, which the
#      recipe violated.
#   3. An `ALTER POLICY` INVALIDATES the altered gate's existing verdict. A verdict is
#      keyed to a gate's NAME; `ALTER POLICY` changes the predicate and keeps the name,
#      so a stale COVERED transfers silently to a predicate it was never measured
#      against, and `ARM=census` does not backstop it (the gate is not a newcomer — it
#      already has a verdict). For every altered policy this script looks the gate up
#      in the committed findings file and says LOUDLY that an existing row was earned
#      against the PRE-ALTER predicate and must be re-measured, not inherited.
#
# USAGE (from anywhere; the script locates the repo root itself):
#   bash scripts/door-sweep-cases.sh                  # working tree + untracked only
#   bash scripts/door-sweep-cases.sh <phase-base>     # + the committed range <base>..HEAD
#   BASE=<ref> TIP=<ref> bash scripts/door-sweep-cases.sh   # audit a historical range
#
#   CASES="$(bash scripts/door-sweep-cases.sh "$BASE")" || <handle the exit code>
#   ARM=read  bash scripts/door-sweep-cases.sh <base>   # stdout = the READ arm's list only
#   ARM=write bash scripts/door-sweep-cases.sh <base>   # stdout = the WRITE arm's list only
#
# ⛔ RULING 4 (2026-08-29, FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Part 1) — THE DERIVATION
#   SPANS TWO HARNESSES AND THIS SCRIPT USED TO NAME ONLY ONE. It greps `create policy` /
#   `alter policy` without regard to COMMAND, so the list covers the read harness
#   (SELECT/ALL) AND the write harness (INSERT/UPDATE/DELETE) — but the paste-able command
#   printed at the end named only p0-authz-door-audit.sh. An operator following this
#   script's own output swept the read half; the write half went unmeasured. Measured on
#   AE1.5: 53 cases derived, 22 matched no gate in the read harness — precisely the
#   non-SELECT policies. BOTH commands are printed now, each with its own arm's subset.
#   ⚠ STDOUT is unchanged by default (the union), so existing callers keep working.
#
# ⚠ STDOUT is the case list and NOTHING else — a bare, space-separated token list, so
#   `CASES=$(...)` composes. Every heading, warning and finding goes to STDERR. The
#   paste-able full sweep command is printed to stderr too, WITH its two hazards
#   (`WORK=` override, findings-file restore) attached, because they are the two that
#   have actually bitten.
#
# ── EXIT CODES — four-way, NOT boolean. Read them DIRECTLY. ─────────────────────────
#   0  DERIVED   a NON-EMPTY case list was derived; stdout carries it.
#                ⚠ This is a statement about the SELECTION, never a verdict about the
#                gates. Nothing has been swept yet.
#   1  FINDING   the diff TOUCHED supabase/migrations/ and ZERO cases were derived.
#                ⛔ This is Amendment 8 ruling 2 and it is the whole reason this file
#                exists. It is NOT a build break and must NOT be wired into
#                `npm run lint` — it is an obligation: the operator must either widen
#                the selection, or STATE IN THE GATE RECORD that the migration
#                contains no policy and no `prosecdef` gate. There is deliberately no
#                `ACK=1` escape hatch: an escape hatch for the unmeasurable also
#                silences the measured.
#   2  ABORT     the tool could not run (not a git repo, bad ref, the audit script's
#                domain strings could not be lifted). Same meaning as the sibling
#                harness's ABORT: nothing was derived and nothing may be concluded.
#   3  NOT-APPLICABLE   the diff contains NO migration file at all, so the diff-scoped
#                sweep has no domain. Deliberately NOT the same code as 0: borrowing
#                the sibling's UNPROVEN framing, a run with an empty domain is not a
#                pass. "No migration in the diff" is a CHECKABLE claim (re-run with the
#                right <base>); "zero cases from a migration that exists" is not.
#
# ── WHAT THIS DOES NOT DO ──────────────────────────────────────────────────────────
# ⛔ It does not sweep anything, and it never writes to the findings file. It derives a
#    selection from DIFF TEXT — which is legitimate, because the diff is the record of
#    what the phase INTENDED (scoping). Every CLAIM about what a gate IS still comes
#    from the live catalog (`pg_policies`, `pg_proc.prosecdef`), which is what the
#    sweep reads. Do not read this script's output as a statement about the catalog.
# ⚠ It reads SQL with regexes. A policy or function emitted from inside a
#    `do $$ … execute format(…) $$` block is invisible here unless the literal text is
#    present. `--` comments are stripped before matching (mirroring the audit script's
#    own `regexp_replace(p.prosrc, '--[^\n]*', …)`), which can also strip a `--` that
#    lives inside a string literal.
# ⚠ It reads the FULL text of every touched migration file, not just the diff's added
#    lines. Over-selection costs ~1 min of sweep per extra gate; under-selection is a
#    gate nobody looked at. The asymmetry decides it.
# ---------------------------------------------------------------------------
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT" || { echo "FATAL: cannot cd to repo root: $ROOT" >&2; exit 2; }

# AUDIT_SRC exists so this script's OWN failure paths can be proven able to fire — the
# same reason the sibling harness keeps DRYRUN. Point it at a doctored copy of the audit
# script to watch the domain lift ABORT and ruling 3's check announce that it did not run.
# ⛔ Never set it for a real derivation: it is the source of truth for the arm's domain.
AUDIT="${AUDIT_SRC:-supabase/tests/mutation/p0-authz-door-audit.sh}"
# The WRITE-layer half of the same gate (ruling 4). The derivation spans both harnesses;
# naming only the read one is what made this script half-aimed for as long as it existed.
WRITE_AUDIT="${WRITE_AUDIT_SRC:-supabase/tests/mutation/p0-authz-writepath-audit.sh}"
ARM="${ARM:-}"        # '', read, or write — narrows STDOUT only (see ruling 4)
# ⚠ `say` is defined below this line, so this validation uses echo directly rather than
# looking like it works and silently invoking a not-yet-defined function.
case "$ARM" in ''|read|write) ;; *)
  echo "FATAL: ARM must be unset, 'read' or 'write' (got: $ARM)" >&2; exit 2;; esac
MIGDIR="supabase/migrations"
FINDINGS=""   # resolved out of $AUDIT below, never hardcoded here

BASE="${1:-${BASE:-HEAD}}"
TIP="${TIP:-HEAD}"

say  () { printf '%s\n' "$*" >&2; }
rule () { say "---------------------------------------------------------------------------"; }

TMP="${TMPDIR:-/tmp}/door-sweep-cases.$$"
mkdir -p "$TMP" || { say "FATAL: cannot create scratch dir: $TMP"; exit 2; }
trap 'rm -rf "$TMP"' EXIT

# ─────────────────────────────────────────────────────────────────────────────────────
# 0. PRECONDITIONS.
#
# ⛔ THE PREDICATE ARM'S DOMAIN IS LIFTED OUT OF THE AUDIT SCRIPT, NEVER RE-TYPED HERE.
# ADR 0079 Amendment 9 decision 3 made that domain ONE string precisely because two
# hand-kept copies of the same SQL drift, and a drifted copy prints a number about a
# domain nothing swept. A private copy in THIS file would re-create that hole one layer
# out: this script would select by a filter the arm no longer uses, and the mismatch
# would surface as "token matched no gate" long after the phase shipped. If the lift
# fails, we ABORT — we do not fall back to a remembered value.
# ─────────────────────────────────────────────────────────────────────────────────────
git rev-parse --git-dir >/dev/null 2>&1 || { say "FATAL: not a git repository: $ROOT"; exit 2; }
[ -f "$AUDIT" ] || { say "FATAL: audit script not found: $AUDIT"; exit 2; }

lift () {  # $1 = shell variable name to lift VERBATIM out of the audit script
  local line
  line="$(grep -m1 -E "^$1=" "$AUDIT")" || return 1
  [ -n "$line" ] || return 1
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}

# ─── lift_block: the SAME lift, for a value whose closing quote is on a LATER line ───
# ⛔ WHY A SECOND LIFTER, MEASURED. `PRED_DOMAIN` is a NINE-LINE double-quoted string
# (p0-authz-door-audit.sh). `lift` above is `grep -m1`, so on that variable it returns the
# first line's remainder — the single character `(` — and every downstream test built on it
# silently matches nothing. A lift that returns a plausible-looking value for the wrong
# amount of text is worse than one that fails: it is the drift this whole file exists to
# prevent, one layer out.
lift_block () {  # $1 = shell variable name to lift VERBATIM, across lines, out of $AUDIT
  awk -v v="$1" '
    BEGIN { pre = v "=\"" ; n = length(pre) }
    !inb && substr($0,1,n) == pre {
      line = substr($0, n+1)
      found = 1
      if (line ~ /"[[:space:]]*$/) { sub(/"[[:space:]]*$/, "", line); print line; exit }
      inb = 1; print line; next
    }
    inb {
      if ($0 ~ /"[[:space:]]*$/) { line = $0; sub(/"[[:space:]]*$/, "", line); print line; exit }
      print
    }
    END { if (!found) exit 9 }
  ' "$AUDIT"
}

PRED_NAME_RE="$(lift PRED_NAME_RE)"       || { say "FATAL: cannot lift PRED_NAME_RE from $AUDIT"; exit 2; }
PRED_IDENTITY_RE="$(lift PRED_IDENTITY_RE)" || { say "FATAL: cannot lift PRED_IDENTITY_RE from $AUDIT"; exit 2; }
PRED_SIDE_EFFECTING="$(lift PRED_SIDE_EFFECTING)" || { say "FATAL: cannot lift PRED_SIDE_EFFECTING from $AUDIT"; exit 2; }
for v in PRED_NAME_RE PRED_IDENTITY_RE PRED_SIDE_EFFECTING; do
  eval "val=\$$v"
  [ -n "$val" ] || { say "FATAL: $v lifted EMPTY from $AUDIT — the domain moved. Fix the lift, do not guess."; exit 2; }
done
HELD_OUT="$(printf '%s' "$PRED_SIDE_EFFECTING" | tr -d "'" | tr ',' ' ')"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ THE ARM'S DOMAIN ITSELF — ASKED, NEVER RE-TYPED. (ADR 0079 Amdt 9 decision 3.)
#
# Until 2026-09-05 this script carried a HAND COPY of the arm's domain, spelled as three
# greps over the migration text: `security definer` AND `returns boolean` AND the identity
# regex. The copy had already DRIFTED, and the drift is measurable in the catalog:
# `PRED_DOMAIN` carries `or p.proname = 'assert_not_case_excluded'` OUTSIDE its
# `t.typname='bool'` clause, so that function (catalog: `void`, `prosecdef=t`) IS in the
# arm's domain — while the hand copy demanded `returns boolean` and excluded it. A
# migration touching it derived ZERO cases from a gate the arm would have swept.
# ⭐ That is the exact failure the header above forbids, standing inside the file that
# forbids it. The fix is not a better copy: it is to stop copying.
#
# The value is lifted as ONE string and its three sub-variables are expanded by EXPLICIT
# substitution — never `eval`, which would execute whatever the audit script's domain
# happens to contain. If ANYTHING is still unexpanded afterwards (a `$` survives), the
# domain has grown a variable this script does not know about, and every classification
# built on it would be a claim about a predicate Postgres cannot parse. That ABORTS (2).
# ⛔ It does not fall back to a remembered value and it does not "best-effort" the SQL.
# ─────────────────────────────────────────────────────────────────────────────────────
PRED_DOMAIN_SQL="$(lift_block PRED_DOMAIN)" \
  || { say "FATAL: cannot lift PRED_DOMAIN from $AUDIT — the arm's domain moved or was renamed."; exit 2; }
[ -n "$PRED_DOMAIN_SQL" ] \
  || { say "FATAL: PRED_DOMAIN lifted EMPTY from $AUDIT. Fix the lift, do not guess."; exit 2; }
PRED_DOMAIN_SQL="${PRED_DOMAIN_SQL//\$PRED_SIDE_EFFECTING/$PRED_SIDE_EFFECTING}"
PRED_DOMAIN_SQL="${PRED_DOMAIN_SQL//\$PRED_NAME_RE/$PRED_NAME_RE}"
PRED_DOMAIN_SQL="${PRED_DOMAIN_SQL//\$PRED_IDENTITY_RE/$PRED_IDENTITY_RE}"
case "$PRED_DOMAIN_SQL" in
  *'$'*)
    rule
    say "=== RESULT: ABORT (2) — PRED_DOMAIN LIFTED WITH AN UNEXPANDED VARIABLE. ==="
    say "    Lifted from : $AUDIT"
    say "    This script expands exactly three sub-variables by explicit substitution:"
    say "      \$PRED_SIDE_EFFECTING  \$PRED_NAME_RE  \$PRED_IDENTITY_RE"
    say "    The lifted domain still contains a '\$' after all three, so the arm's domain"
    say "    now references something this script does not know how to resolve:"
    say
    printf '%s\n' "$PRED_DOMAIN_SQL" | sed 's/^/        /' >&2
    say
    say "    ⛔ NOTHING was derived and nothing may be concluded. Do NOT fall back to the"
    say "       old hand-copied filter — that is the drift this lift exists to end. Teach"
    say "       this script the new sub-variable (one more explicit substitution above),"
    say "       then re-run. ⚠ Never \`eval\` it: the domain is SQL, not shell."
    rule
    exit 2 ;;
esac

# The committed findings file — ruling 3's lookup table — is resolved out of $AUDIT too,
# for the same anti-drift reason, and by TWO names because the variable was being renamed
# while this script was written: `FINDINGS` (pre-2026-08-26) became `FINDINGS_COMMITTED`
# when a subset run was moved off the committed baseline. ⚠ Resolution is by NAME, which
# is the one thing a rename orphans — so a failure to resolve is LOUD and disables ruling
# 3's check explicitly. It does NOT abort: the derivation does not depend on this file,
# and a check that quietly stops checking is the defect this whole ADR is about.
FINDINGS_RAW="$(lift FINDINGS_COMMITTED || lift FINDINGS || printf '')"
FINDINGS="${FINDINGS_RAW#\$ROOT/}"
if [ -z "$FINDINGS" ] || [ ! -f "$FINDINGS" ]; then
  FINDINGS=""
fi

if [ "$BASE" != "HEAD" ]; then
  git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null \
    || { say "FATAL: <phase-base> is not a commit: $BASE"; exit 2; }
fi
git rev-parse --verify --quiet "$TIP^{commit}" >/dev/null \
  || { say "FATAL: TIP is not a commit: $TIP"; exit 2; }

# ─────────────────────────────────────────────────────────────────────────────────────
# 1. THE CHANGED-MIGRATION SET — three sources, because a phase MID-FLIGHT has neither
#    of the ones a naive recipe reads.
#
# ⛔ `git diff <base>..HEAD` sees NOTHING during the phase it is meant to gate: the
#    migration under review is uncommitted, or untracked, or both. A recipe that only
#    reads the committed range is a gate that runs exactly when it has nothing to say.
#    Working-tree and untracked changes belong to HEAD, so they are collected only when
#    TIP is HEAD; auditing a historical range reads that range's tree and nothing else.
# ─────────────────────────────────────────────────────────────────────────────────────
: > "$TMP/paths"
if [ "$BASE" != "HEAD" ] || [ "$TIP" != "HEAD" ]; then
  git diff --name-only --diff-filter=d "$BASE".."$TIP" -- "$MIGDIR" \
    | awk 'NF {print $0 "\tcommitted"}' >> "$TMP/paths"
fi
if [ "$TIP" = "HEAD" ]; then
  git diff --name-only --diff-filter=d HEAD -- "$MIGDIR" \
    | awk 'NF {print $0 "\tworktree"}' >> "$TMP/paths"
  git ls-files --others --exclude-standard -- "$MIGDIR" \
    | awk 'NF {print $0 "\tuntracked"}' >> "$TMP/paths"
fi
sort -u "$TMP/paths" -o "$TMP/paths"
cut -f1 "$TMP/paths" | sort -u > "$TMP/files"

# ─────────────────────────────────────────────────────────────────────────────────────
# 1b. AN EXPLICIT SCOPE — the OTHER half of FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-
#     WORKING-TREE. Provenance says which file a case came from; this says which files
#     the run was ABOUT. Two increments in one tree is the case that raised the finding.
#
#   SCOPE=<migration-id floor>   keep files whose leading digits are >= this (an id, or
#                                any prefix of one: SCOPE=20261003007300)
#   PATHS=<prefix>               keep files whose path starts with this
#
# ⛔ A filter that silently narrows a GATE's domain is worse than no filter, so both are
#    echoed in the header AND in the SCOPE: line the gate record quotes, and the count
#    before and after is printed. Filtering to zero files is NOT-APPLICABLE (3), the same
#    checkable claim an empty diff makes — never a quiet pass.
# ─────────────────────────────────────────────────────────────────────────────────────
SCOPE_FLOOR="${SCOPE:-}"
PATH_PREFIX="${PATHS:-}"
FILTER_DESC="none"
if [ -n "$SCOPE_FLOOR" ] || [ -n "$PATH_PREFIX" ]; then
  NPRE="$(wc -l < "$TMP/files" | tr -d ' ')"
  awk -v floor="$SCOPE_FLOOR" -v pfx="$PATH_PREFIX" '
    {
      keep = 1
      if (pfx   != "" && index($0, pfx) != 1) keep = 0
      if (floor != "") {
        b = $0; sub(/^.*\//, "", b)
        if (match(b, /^[0-9]+/) == 0) keep = 0
        else if (substr(b, RSTART, RLENGTH) < floor) keep = 0
      }
      if (keep) print
    }' "$TMP/files" > "$TMP/files.f"
  mv "$TMP/files.f" "$TMP/files"
  FILTER_DESC="SCOPE=${SCOPE_FLOOR:-·} PATHS=${PATH_PREFIX:-·} ($NPRE file(s) -> $(wc -l < "$TMP/files" | tr -d ' '))"
fi

rule
say "DOOR-SWEEP CASE DERIVATION — ADR 0079 Amendment 1 (recipe) + Amendment 8 (rulings 1-3)"
say "  range      : ${BASE}..${TIP}$([ "$BASE" = HEAD ] && [ "$TIP" = HEAD ] && printf '%s' '  (no committed range — working tree + untracked only)')"
say "  domain     : lifted from $AUDIT (never re-typed here)"
say "               PRED_DOMAIN lifted whole ($(printf '%s' "$PRED_DOMAIN_SQL" | wc -l | tr -d ' ') line(s)), 3 sub-vars expanded, no residual \$"
say "  filter     : $FILTER_DESC"
say "  migrations : $(wc -l < "$TMP/files" | tr -d ' ') file(s) touched"
while IFS= read -r f; do
  src="$(awk -F'\t' -v p="$f" '$1==p {printf "%s%s", (n++ ? "+" : ""), $2} END {print ""}' "$TMP/paths")"
  say "               - $f  [$src]"
done < "$TMP/files"

if [ ! -s "$TMP/files" ]; then
  rule
  say "=== RESULT: NOT-APPLICABLE (3) — no migration file in the diff. ==="
  say "    The diff-scoped sweep has no domain, so it does not apply. ⚠ This is NOT the"
  say "    same observation as 'the recipe printed nothing' (that is exit 1) and it is"
  say "    NOT a pass: it is a CHECKABLE claim. If the phase DID add a migration, the"
  say "    <phase-base> is wrong — re-run with the right one before recording anything."
  rule
  exit 3
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# 2. CONTENT. Disk wins when TIP is HEAD (an uncommitted edit is the truth mid-phase);
#    otherwise read the blob at TIP. A file the range renamed later is unreadable at
#    HEAD by its old name, which is why the blob is read at TIP and not at HEAD.
# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠ The content is read ONE FILE AT A TIME by the loop under §2b — the read itself lives
# there because that is where the per-file scratch dir is created. What stays here is the
# rule the read follows, and the two aggregates the loop fills:
#   `$TMP/flat`  — every file's comment-stripped, newline-folded text, ' ; '-joined so the
#                  statement splitter in §5 still sees one statement per record;
#   `$TMP/flat_order` — the files, in the order their text was appended.
# `--` comments are stripped and newlines folded, so a statement split across lines
# ("alter policy x\n  on public.y") is still one match. Mirrors the audit script's own
# comment strip; carries the same caveat about a `--` inside a string literal.
UNREADABLE=""
: > "$TMP/flat"; : > "$TMP/flat_order"

# ─────────────────────────────────────────────────────────────────────────────────────
# 2b. EXTRACTION IS PER FILE — and that is what makes a case ATTRIBUTABLE.
#
# ⛔ FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE. The three sources above are all
# correct and all necessary; the defect is that their union was reported as ONE diff. In a
# tree holding two in-flight increments the deriver could not distinguish "this increment"
# from "this working tree" — measured at AE1.3: 53 cases derived where AE1.3 owned 1, a
# figure that reads as broad coverage of AE1.3 and is nothing of the sort. ⛔ Dropping the
# working-tree and untracked sources is NOT the fix; it re-creates the blindness the header
# note exists to prevent. Attribution is.
#
# So every extraction below runs on ONE file at a time, into its own directory, and the
# aggregate lists are the UNION of those. Downstream selection is unchanged. Three things
# fall out of it that no amount of reporting could have given:
#   · a case can be attributed to the file(s) it came from (the PROVENANCE block);
#   · ADR 0173's measured array-gate over-selection is fixed — the `array[` gate is now
#     evaluated PER FILE, so one migration that builds an array no longer enables the
#     fallback for every other migration in the same range (0173:387-393 declined this for
#     a benign reason; the attribution requirement makes it necessary anyway);
#   · a `door-sweep-targets:` parse error can name a REAL file and line instead of an
#     offset into concatenated content.
# ⚠ Cross-file reconciliation (a policy dropped in one file and recreated in another; a
#   name selected in one file and excluded in another) stays GLOBAL, below the loop —
#   per-file it would manufacture an orphan or a false exclusion.
# ─────────────────────────────────────────────────────────────────────────────────────
extract_one () {   # $1 = the per-file scratch dir, already holding content + flat
  D="$1"
  # ─────────────────────────────────────────────────────────────────────────────────────
  # 3. POLICIES — RULING 1: both forms, one case list.
  # ─────────────────────────────────────────────────────────────────────────────────────
  POLRE='"?[a-z0-9_]+"? on ("?[a-z0-9_]+"?\.)?"?[a-z0-9_]+"?'
  grep -ohiE "create policy $POLRE" "$D/flat" \
    | awk '{gsub(/"/,""); n=tolower($3); t=tolower($5); sub(/^[a-z0-9_]+\./,"",t); print n "\t" t}' \
    | sort -u > "$D/pol_create"
  grep -ohiE "alter policy $POLRE"  "$D/flat" \
    | awk '{gsub(/"/,""); n=tolower($3); t=tolower($5); sub(/^[a-z0-9_]+\./,"",t); print n "\t" t}' \
    | sort -u > "$D/pol_alter"
  grep -ohiE "drop policy (if exists )?$POLRE" "$D/flat" \
    | awk '{gsub(/"/,""); for(i=1;i<=NF;i++) if(tolower($i)=="on"){print tolower($(i-1)) "\t" tolower($(i+1)); break}}' \
    | sed 's/\t[a-z0-9_]*\./\t/' | sort -u > "$D/pol_drop"
  # a drop+recreate is a create; only a policy dropped and NOT recreated is an orphan
  comm -23 "$D/pol_drop" <(cat "$D/pol_create" "$D/pol_alter" | sort -u) > "$D/pol_orphan"

  # ─────────────────────────────────────────────────────────────────────────────────────
  # 4. FUNCTIONS — SELECTED vs EXCLUDED, and the excluded set is PRINTED, never dropped.
  #
  # ⛔ THE NAME FILTER IS ACKNOWLEDGED BLIND AND HAS NO BACKSTOP FOR THIS CLASS.
  # Amendment 8's closing note: the filter excluded BOTH functions AFF2 touched
  # (`list_org_people`, `guard_profile_privileged_columns`), and `ARM=census` cannot
  # backstop an ALTERED gate because an altered gate is not a newcomer. AFF4's five new
  # gates (`affiliate_person_to_org`, `end_org_affiliation`, `void_affiliation`,
  # `void_org_affiliation`, `update_org_affiliation`) match none of it either. So a
  # non-matching function is a REVIEW ITEM, printed for a ruling — never a silent drop.
  # Printing what was dropped is what makes ruling 2's "state in the gate record that the
  # migration contains no gate" a checkable claim instead of an assertion.
  #
  # A function is auto-SELECTED only when the diff text asserts all three catalog facts
  # the arm's domain requires — `security definer`, `returns boolean`, and an identity
  # primitive in the body — or when its NAME matches the arm's regex. Anything else is
  # named, not guessed at: a token the arm cannot select turns the whole sweep UNPROVEN.
  # ⚠ A chunk runs to the next declaration, so a body reaching identity only through a
  # helper is invisible here — the same admission Amendment 9 attaches to the arm itself.
  # ─────────────────────────────────────────────────────────────────────────────────────
  sed 's/--.*$//' "$D/content" | awk '
    function emit() { if (name != "") print name "\t" buf }
    {
      l = tolower($0)
      if (l ~ /create[ \t]+(or[ \t]+replace[ \t]+)?function[ \t]+(app|public|authz)\./) {
        emit()
        match(l, /function[ \t]+(app|public|authz)\.[a-z0-9_]+/)
        tok = substr(l, RSTART, RLENGTH)
        sub(/^function[ \t]+/, "", tok)
        sub(/^(app|public|authz)\./, "", tok)
        name = tok; buf = ""
      }
      if (name != "") buf = buf " " l
    }
    END { emit() }
  ' > "$D/fnchunks"

  : > "$D/fn_sel_name"; : > "$D/fn_sel_prop"; : > "$D/fn_excl"; : > "$D/fn_held"
  while IFS="$(printf '\t')" read -r fname fbody; do
    [ -n "$fname" ] || continue
    held=0
    for h in $HELD_OUT; do [ "$h" = "$fname" ] && held=1; done
    if [ "$held" = 1 ]; then
      printf '%s\n' "$fname" >> "$D/fn_held"
    elif printf '%s' "$fname" | grep -qE "$PRED_NAME_RE" && ! printf '%s' "$fname" | grep -qE '^is_valid_'; then
      printf '%s\n' "$fname" >> "$D/fn_sel_name"
    elif printf '%s' "$fbody" | grep -qE 'security[ ]+definer' \
      && printf '%s' "$fbody" | grep -qE 'returns[ ]+boolean' \
      && printf '%s' "$fbody" | grep -qE "$PRED_IDENTITY_RE"; then
      printf '%s\n' "$fname" >> "$D/fn_sel_prop"
    else
      printf '%s\n' "$fname" >> "$D/fn_excl"
    fi
  done < "$D/fnchunks"
  for x in fn_sel_name fn_sel_prop fn_excl fn_held; do sort -u "$D/$x" -o "$D/$x"; done
  # a name-selected function must not also appear as excluded (same name, two declarations)
  comm -23 "$D/fn_excl" <(cat "$D/fn_sel_name" "$D/fn_sel_prop" | sort -u) > "$D/fn_excl.f"
  mv "$D/fn_excl.f" "$D/fn_excl"

  # ─────────────────────────────────────────────────────────────────────────────────────
  # 4b. RUNTIME-REWRITE MIGRATIONS — ADR 0173.
  #
  # ⛔ THE BLINDNESS THIS CLOSES. Everything above selects on the diff TEXT: section 4 chunks
  # on `create [or replace] function (app|public|authz).`. A migration that edits a body it did not
  # author uses this repo's HOUSE PATTERN instead —
  # `pg_get_functiondef()` + `replace()` + `execute` — and therefore contains no
  # create-function line at all. Measured 2026-09-01: `20261003007180` rewrote FOUR bodies,
  # two of them `prosecdef` with `authenticated` EXECUTE, and this script derived ZERO cases.
  # ⭐ The deriver was blind to exactly the pattern CLAUDE.md documents as making migration
  # text stale-by-design — and any future gate keyed on migration text inherits that.
  #
  # ⚠ HISTORICAL CEILING, MEASURED, SO THE AMENDMENT IS NOT OVERSOLD: of the 33 migrations
  # that use the pattern, only 8 name their targets in the text at all. The other 25 select
  # targets by CATALOG QUERY at apply time (`where ... pg_get_functiondef(p.oid) ~ '...'`),
  # whose predicate typically matches what the migration then REMOVED — so re-running it today
  # returns zero and the door list is unrecoverable without a historical snapshot. ⛔ No
  # text-based deriver can ever reach those 25. The ceiling is HISTORICAL, not structural: the
  # convention below makes forward coverage complete.
  #
  # ⛔ AND `PRED_DOMAIN` IS A SEPARATE, UNCLOSED BOUND — do not read this block as fixing it.
  # The read arm requires `t.typname='bool'`; D2's four return int4/int4/int4/responses, so
  # even once SELECTED here they yield zero cases and the sweep is correctly UNPROVEN.
  # SELECTION is this block's success criterion, never a passing sweep. That bound is owned by
  # FUP-AUTHZ-COMMAND-DOOR-UNSWEPT (C2), which has its own instrument
  # (supabase/tests/mutation/c2-command-door-neutralizer.sh) and its own cutline.
  # ─────────────────────────────────────────────────────────────────────────────────────
  : > "$D/fn_rewrite"
  : > "$D/marker_err"

  # ── (a) THE CONVENTION — an explicit, unambiguous target list the deriver can read. ──
  #     A rewrite migration declares:  -- door-sweep-targets: app.foo(), public.bar(uuid)
  #     Read from the RAW content (it is a comment, so it must survive comment-stripping).
  #
  # ⛔ THE READ IS UNCONDITIONAL, AND THAT IS THE FIX, NOT A TIDY-UP. Until 2026-09-05 this
  # whole block sat inside `if … grep -qiE 'pg_get_functiondef'`. Measured:
  # `20261003007250` contains `pg_get_functiondef` ZERO times, so the declaration path never
  # executed for the migration whose declaration the follow-up is about — its three targets
  # survived on the unrelated `create or replace` name path, and the two paths agreeing is
  # what hid it. The declaration is a notation about DOORS, not about rewrites; gating it on
  # a rewrite marker is the same class of defect as parsing only its first line.
  #
  # ⛔ THE PARSER MUST READ THE NOTATION THE FILES USE. The old read was `grep` anchored per
  # line, so a CONTINUATION line was silently unread (FUP-DOOR-SWEEP-MARKER-BLIND-TO-
  # CONTINUATION-LINES). Measured in-tree: three migrations use the continuation form
  # (`…007250` 3 lines, `…007300` 2, `…007340` 1). The grammar, ADR 0173 §2 as amended:
  #
  #     declaration       := marker-line continuation-line*
  #     marker-line       := ^\s*--\s*door-sweep-targets:\s* target-list
  #     continuation-line := ^\s*--\s+ target-list      (only directly after a declaration line)
  #     target-list       := target ( \s*,\s* target )* \s*,?
  #     target            := (app|public|authz).name [ '(' … ')' ]
  #
  # ⚠ CONSUME-OR-STOP, TOKEN-BEARING — and it is measured, not a preference. A following
  # `--` line carrying at least one `(app|public|authz).name` token is a continuation and
  # every token on it is consumed; a `--` line with NO such token ENDS the declaration,
  # silently. Strict rejection would red two committed migrations at every gate:
  # `20261003007180:9` is a bare `--` and `20261003007190:6` likewise. The cost of the
  # tolerant rule is that prose naming a schema-qualified callable immediately under a
  # declaration is consumed — which is over-selection, and 4c's catalog classification is
  # what makes over-selection cheap again.
  # ⚠ Loud NARROW case: a continuation bearing a schema prefix with no name, or an unclosed
  # argument list, is a NAMED parse error. The run continues — a parse error in a comment
  # must not decide a sweep — but it is printed, never silent.
  awk '
    function harvest(s,   n) {
      while (match(s, /(app|public|authz)\.[a-z0-9_]+/)) {
        tok = substr(s, RSTART, RLENGTH)
        sub(/^(app|public|authz)\./, "", tok)
        print tok > TARGETS
        s = substr(s, RSTART + RLENGTH)
        n++
      }
      return n
    }
    function complain(where, why) { print where "\t" why > ERRS }
    {
      low = tolower($0)
      if (low ~ /^[ \t]*--[ \t]*door-sweep-targets:/) {
        sub(/^[ \t]*--[ \t]*door-sweep-targets:[ \t]*/, "", low)
        inmark = 1; line = NR
        if (harvest(low) == 0) complain(NR, "door-sweep-targets: with no (app|public|authz).name target")
        next
      }
      if (inmark) {
        if (low ~ /^[ \t]*--/) {
          rest = low; sub(/^[ \t]*--[ \t]*/, "", rest)
          probe = rest
          if (harvest(rest) > 0) {
            if (probe ~ /(app|public|authz)\.([^a-z0-9_]|$)/) complain(NR, "schema prefix with no function name")
            if (probe ~ /\([^)]*$/)                           complain(NR, "unclosed argument list")
            next
          }
          inmark = 0; next          # token-free `--` line: the declaration ends here
        }
        inmark = 0
      }
    }
  ' TARGETS="$D/fn_rewrite" ERRS="$D/marker_err" "$D/content" 2>/dev/null || true

  REWRITE_PRESENT=0
  if sed 's/--.*$//' "$D/content" | grep -qiE 'pg_get_functiondef'; then
    REWRITE_PRESENT=1

    # (b) FALLBACK, and it is deliberately NARROW — only when the file builds an ARRAY LITERAL.
    #     ⛔ WHY THE ARRAY GATE, MEASURED RATHER THAN ASSUMED. A first draft extracted every
    #     quoted schema-qualified callable and OVER-SELECTED: on
    #     20260903000700_authz_dashboard_gate_uniformity.sql it returned `is_admin` and
    #     `is_commission_admin_of`, which are the `replace()` OPERANDS — the callee being
    #     swapped — not the rewrite targets. Naming the WRONG door is worse than naming none,
    #     and a widened regex that over-selects turns every phase gate into noise.
    #     ⚠ Excluding `~` lines was NOT enough: a replacement literal sits on a line with no
    #     `~`. The sound discriminator is that a TARGET LIST is built as an array, while a
    #     replace() operand is not. Measured on the three shapes:
    #       20261003007180 (targets in array)     array[=1 callables=4 -> selects 4   ✅
    #       20260903000700 (replace() operands)   array[=0 callables=2 -> selects 0   ✅
    #       20260816000500 (catalog-query)        array[=1 callables=0 -> FINDING (1) ✅
    #     ✅ SECOND BOUND — MEASURED 2026-09-01, CLOSED 2026-09-05. The array gate used to be
    #     evaluated over the CONCATENATED diff content, so ONE migration in the range that built
    #     an array enabled this fallback for EVERY other migration in it. Measured then:
    #     20261003007190 (the BUG-PROF-INACTIVE-001 fix) carries no array literal and declares
    #     its target with the (a) marker, yet `is_active` was also selected — because
    #     20261003007180, elsewhere in the same range, does build one. ADR 0173 recorded that
    #     fixing it meant assembling the content per file and declined it as benign
    #     over-selection. §2b now does assemble per file for a different reason (attribution),
    #     and this gate is per-file with it. Re-measured on `731abda0^..HEAD`: 20 cases -> 18,
    #     the two dropped being `is_active` and `has_role` — both REPLACEMENT LITERALS and
    #     quoted operands, never rewrite targets, exactly as the 2026-09-01 note predicted.
    #     ⚠ BOUND, STATED: a migration that BOTH builds an array AND uses quoted callables as
    #     replace() operands would still over-select. The (a) marker exists precisely so that
    #     case has an exact answer available, and it takes precedence.
    if sed 's/--.*$//' "$D/content" | grep -qiE 'array[[:space:]]*\['; then
      sed 's/--.*$//' "$D/content" \
        | grep -vE '~' \
        | grep -ohE "'(app|public|authz)\.[a-z0-9_]+\(" \
        | sed -E "s/^'//; s/\($//; s/^(app|public|authz)\.//" >> "$D/fn_rewrite" || true
    fi

  fi

  # ─────────────────────────────────────────────────────────────────────────────────────
  # 4d. `ALTER FUNCTION … SECURITY DEFINER` — the function branch's ALTER POLICY.
  #
  # ⛔ THE BLINDNESS THIS CLOSES, and it is a repeat. ADR 0079 Amendment 8 ruling 1 fixed
  # `alter policy` because "an RLS widening is not a create". The FUNCTION branch was left
  # selecting on a `create [or replace] function` CHUNK BODY — and an `ALTER` has no body, so
  # flipping `prosecdef` on an existing boolean gate derived ZERO cases and read as clean
  # (FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION). ⭐ A correction applied to one branch of
  # a deriver is not evidence the sibling branch was swept.
  #
  # ⛔ THE `security definer` CLAUSE IS MANDATORY IN THE MATCH, MEASURED:
  # `20260620000000_baseline.sql` carries 449 `ALTER FUNCTION … OWNER TO "postgres";` lines.
  # A naive `alter function` grep would put all 449 into the candidate set. With the clause
  # required, that file yields 0 and the tree's ONLY real instance
  # (`20261003004300`, `alter function app.assert_hospital_affiliation_has_org() security
  # definer`) yields 1.
  #
  # ⚠ THE TEXT CANNOT SAY WHAT THE ALTERED FUNCTION RETURNS — there is no body to read. That
  # is exactly why the name goes through 4c's catalog resolution like every other candidate,
  # and why, with NO catalog, an ALTER-derived name is an OBLIGATION rather than a case: a
  # token whose domain membership nobody checked must not enter CASES.
  # ─────────────────────────────────────────────────────────────────────────────────────
  grep -ohiE "alter function ((app|public|authz)\.)?\"?[a-z0-9_]+\"?[[:space:]]*\([^)]*\)[^;]{0,200}security[[:space:]]+definer" "$D/flat" \
    | awk '{gsub(/"/,""); t=tolower($3); sub(/\(.*$/,"",t); sub(/^(app|public|authz)\./,"",t); if (t != "") print t}' \
    | sort -u > "$D/fn_alter"
}

# ── the loop, the aggregate union, and the case -> file(s) map ───────────────────────
AGG_LISTS="pol_create pol_alter pol_drop fnchunks fn_sel_name fn_sel_prop fn_excl fn_held fn_rewrite fn_alter"
for x in $AGG_LISTS marker_err prov; do : > "$TMP/$x"; done
REWRITE_PRESENT=0
ANY_REWRITE=0
i=0
while IFS= read -r f; do
  i=$((i + 1))
  D="$TMP/per/$i"; mkdir -p "$D"
  if [ "$TIP" = "HEAD" ] && [ -f "$f" ]; then
    cat "$f" > "$D/content"
  elif git cat-file -e "$TIP:$f" 2>/dev/null; then
    git show "$TIP:$f" > "$D/content"
  else
    UNREADABLE="$UNREADABLE $f"
    continue
  fi
  sed 's/--.*$//' "$D/content" | tr '\n' ' ' | sed 's/[[:space:]][[:space:]]*/ /g' > "$D/flat"
  REWRITE_PRESENT=0
  extract_one "$D"
  [ "$REWRITE_PRESENT" = 1 ] && ANY_REWRITE=1
  # the aggregate union — downstream code sees exactly the lists it always saw
  for x in $AGG_LISTS; do
    [ -s "$D/$x" ] && cat "$D/$x" >> "$TMP/$x"
  done
  # ⭐ a parse error can now name the FILE and its OWN line number
  [ -s "$D/marker_err" ] \
    && awk -F'\t' -v f="$f" '{print f ":" $1 "\t" $2}' "$D/marker_err" >> "$TMP/marker_err"
  # PROVENANCE: every name this file produced, whatever bucket it landed in
  cat <(cut -f1 "$D/pol_create") <(cut -f1 "$D/pol_alter") \
      "$D/fn_sel_name" "$D/fn_sel_prop" "$D/fn_excl" "$D/fn_rewrite" "$D/fn_alter" \
    | awk 'NF' | sort -u | awk -v f="$f" '{print $0 "\t" f}' >> "$TMP/prov"
  printf '%s\n' "$f" >> "$TMP/flat_order"
  { cat "$D/flat"; printf ' ; '; } >> "$TMP/flat"
done < "$TMP/files"
REWRITE_PRESENT="$ANY_REWRITE"
if [ -n "$UNREADABLE" ]; then
  say "  ⚠ UNREADABLE (skipped — their gates are NOT in the list below):$UNREADABLE"
fi
for x in pol_create pol_alter pol_drop fn_sel_name fn_sel_prop fn_excl fn_held fn_alter; do
  sort -u "$TMP/$x" -o "$TMP/$x"
done
# ── cross-file reconciliation. ⚠ These CANNOT be per file. ──────────────────────────
# A policy dropped in one migration and recreated in another is not an orphan; a function
# selected by one file and excluded by another is selected.
comm -23 "$TMP/pol_drop" <(cat "$TMP/pol_create" "$TMP/pol_alter" | sort -u) > "$TMP/pol_orphan"
comm -23 "$TMP/fn_excl" <(cat "$TMP/fn_sel_name" "$TMP/fn_sel_prop" | sort -u) > "$TMP/fn_excl.f"
mv "$TMP/fn_excl.f" "$TMP/fn_excl"
# ⚠ OUTSIDE the rewrite guard, because the declaration read now runs outside it too.
# Leaving the de-duplication inside would leave a marker-only migration's targets
# unsorted and duplicated against the name/property selections.
sort -u "$TMP/fn_rewrite" -o "$TMP/fn_rewrite"
# A declared target already selected by name/property is not listed twice.
comm -23 "$TMP/fn_rewrite" <(cat "$TMP/fn_sel_name" "$TMP/fn_sel_prop" | sort -u) > "$TMP/fn_rewrite.f"
mv "$TMP/fn_rewrite.f" "$TMP/fn_rewrite"

if [ -s "$TMP/marker_err" ]; then
  say "  ⚠ door-sweep-targets: PARSE ERROR(S) — named, and the run continues:"
  while IFS="$(printf '\t')" read -r wh why; do [ -n "$wh" ] && say "    - $wh: $why"; done < "$TMP/marker_err"
  say "    ⛔ A malformed declaration is NOT the same state as an absent one. Every other"
  say "       target on the line was still consumed; fix the declaration at its source."
  say "    ⚠ The location is <file>:<line> in that file's OWN numbering — extraction is"
  say "      per file (§2b), so a parse error no longer points at an offset into"
  say "      concatenated content."
fi

# ⭐ THE CONVENTION HAS TEETH. A rewrite migration whose targets cannot be resolved is a
# COMPLETELY DIFFERENT STATE from one the deriver reads as empty, and until now those were
# indistinguishable. This is the detection that separates them, and it is why the convention
# is enforceable rather than a hint that needs a human.
if [ "$REWRITE_PRESENT" = 1 ] && [ ! -s "$TMP/fn_rewrite" ]; then
  rule
  say "=== RESULT: FINDING (1) — a RUNTIME-REWRITE migration whose TARGETS CANNOT BE READ. ==="
  say "    The diff uses pg_get_functiondef() + replace() + execute — the house pattern for"
  say "    editing a body this repo did not author — but names no target this script can"
  say "    resolve. ⛔ That is NOT the same observation as 'the migration changed no gate':"
  say "    the migration demonstrably rewrote at least one function body and the deriver"
  say "    cannot say which. Reading this as empty is how 33 migrations went unswept."
  say
  say "    FIX IT AT THE SOURCE — declare the targets in the migration:"
  say "        -- door-sweep-targets: app.some_fn(), public.other_fn(uuid, jsonb)"
  say "    That line is read from the comments deliberately, so it survives nothing and"
  say "    costs nothing at apply time."
  say
  say "    ⚠ IF THE TARGETS ARE GENUINELY NOT KNOWABLE — a catalog-query rewrite whose"
  say "      predicate matches what it then removed — say SO in the gate record as a claim"
  say "      someone can check, and name the doors from the migration's own review. Do not"
  say "      record silence. ⛔ There is no ACK env var; an escape hatch for the unmeasurable"
  say "      also silences the measured."
  rule
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# 4c. TIER 1 / TIER 2 — WHAT A DOOR *IS* COMES FROM THE CATALOG, NOT FROM A NAME.
#
# ⛔ THE PROPERTY, IN ONE SENTENCE.
#   A DOOR is an object this diff creates, replaces, alters or declares that the LIVE
#   CATALOG resolves to either (a) an RLS policy, or (b) a function in app/public/authz
#   with `prosecdef = true`.
#   SWEEPABLE is a strictly NARROWER second question: the door additionally satisfies
#   `PRED_DOMAIN`, lifted verbatim from the arm and EVALUATED BY THE CATALOG.
#   `CASES` is tier 2 ONLY. Tier 1 minus tier 2 is printed as "doors identified, not
#   sweepable by this arm", with the catalog's reason, and owes a TARGETED case.
#
# ⛔ WHY `CASES` MUST NOT BE TIER 1. ADR 0079:161-169 hazard 4: the door sweep can only
#   neutralize what its arm's domain selects. A token the arm cannot match is reported by
#   the harness as "REQUESTED … MATCHED NO GATE" and makes the WHOLE run UNPROVEN — so
#   over-selection here does not cost "~1 min of sweep", it costs every verdict in the run.
#   Measured 2026-09-05 on `731abda0^..HEAD`: 42 tokens derived, of which 3 resolve to no
#   catalog object at all, 1 is an INVOKER (another harness's class) and 18 are `prosecdef`
#   functions outside `PRED_DOMAIN`. That derivation cannot produce a provable sweep.
#
# ⛔ THE TEXT HEURISTICS ARE THE FLOOR AND THE CATALOG ONLY CLASSIFIES. Nothing is dropped
#   silently: every candidate the diff text produced ends up in exactly one printed bucket.
#   With NO catalog reachable the classification is skipped entirely and the pre-2026-09-05
#   union is derived under a loud provisional banner — a deriver that goes blind when the
#   stack is down is not an improvement.
#
# ⚠ ABSENT FROM THE CATALOG IS NOT AN ABORT. Measured over the last 15 migrations: 2 of 22
#   function names (`explain_direct_permission`, `has_direct_permission`) resolve to nothing
#   because a LATER migration dropped them, so "absent -> exit 2" would abort ordinary
#   historical ranges. Absent is an UNRESOLVED obligation, named with BOTH of its causes.
# ─────────────────────────────────────────────────────────────────────────────────────
DB="${DOOR_SWEEP_DB:-supabase_db_azkbbhskturikxpgmafq}"
CATALOG_OK=0
CATALOG_WHY=""

cat "$TMP/fn_sel_name" "$TMP/fn_sel_prop" "$TMP/fn_excl" "$TMP/fn_rewrite" "$TMP/fn_alter" \
  | awk 'NF' | sort -u > "$TMP/cand_fn"
cat <(cut -f1 "$TMP/pol_create") <(cut -f1 "$TMP/pol_alter") | awk 'NF' | sort -u > "$TMP/cand_pol"

if ! command -v docker >/dev/null 2>&1; then
  CATALOG_WHY="no docker on PATH"
elif ! docker exec "$DB" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  CATALOG_WHY="container '$DB' not answering (start the local stack)"
else
  # ⚠ The domain is interpolated as SQL, never as shell. It was proven free of unexpanded
  #   variables at lift time; if it had not been, this script aborted before reaching here.
  cat > "$TMP/q_fn.sql" <<SQL
select p.proname
       || chr(9) || (case when p.prosecdef then 't' else 'f' end)
       || chr(9) || t.typname
       || chr(9) || (case when p.proretset then 't' else 'f' end)
       || chr(9) || (case when $PRED_DOMAIN_SQL then 'IN' else 'OUT' end)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_type      t on t.oid = p.prorettype
where n.nspname in ('app','public','authz');
SQL
  if docker exec -i "$DB" psql -U postgres -d postgres -tA -P pager=off -q \
       < "$TMP/q_fn.sql" > "$TMP/cat_fn" 2>"$TMP/cat_fn.err" && [ -s "$TMP/cat_fn" ]; then
    docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off \
      -c 'select policyname from pg_policies' 2>/dev/null | awk 'NF' | sort -u > "$TMP/cat_pol"
    if [ -s "$TMP/cat_pol" ]; then CATALOG_OK=1; else CATALOG_WHY="pg_policies came back empty"; fi
  else
    CATALOG_WHY="the PRED_DOMAIN query failed: $(head -3 "$TMP/cat_fn.err" 2>/dev/null | tr '\n' ' ')"
  fi
fi

: > "$TMP/fn_sweepable"; : > "$TMP/fn_unsweepable"; : > "$TMP/fn_invoker"; : > "$TMP/fn_unresolved"
: > "$TMP/pol_resolved";  : > "$TMP/pol_unresolved"
if [ "$CATALOG_OK" = 1 ]; then
  while IFS= read -r fname; do
    [ -n "$fname" ] || continue
    # Overloads: prefer a `prosecdef` row, then an IN-domain one. Ties err toward selecting.
    row="$(awk -F'\t' -v n="$fname" '$1==n' "$TMP/cat_fn" \
           | sort -t"$(printf '\t')" -k2,2r -k5,5 | head -1)"
    if [ -z "$row" ]; then
      printf '%s\n' "$fname" >> "$TMP/fn_unresolved"; continue
    fi
    secdef="$(printf '%s' "$row" | cut -f2)"
    rettype="$(printf '%s' "$row" | cut -f3)"
    isset="$(printf '%s' "$row" | cut -f4)"
    dom="$(printf '%s' "$row" | cut -f5)"
    [ "$isset" = "t" ] && rettype="setof $rettype"
    if [ "$secdef" != "t" ]; then
      printf '%s\tINVOKER (prosecdef=f), returns %s\n' "$fname" "$rettype" >> "$TMP/fn_invoker"
    elif [ "$dom" = "IN" ]; then
      printf '%s\n' "$fname" >> "$TMP/fn_sweepable"
    else
      printf '%s\tprosecdef, returns %s — outside PRED_DOMAIN\n' "$fname" "$rettype" >> "$TMP/fn_unsweepable"
    fi
  done < "$TMP/cand_fn"
  while IFS= read -r pname; do
    [ -n "$pname" ] || continue
    if grep -qxF "$pname" "$TMP/cat_pol"; then printf '%s\n' "$pname" >> "$TMP/pol_resolved"
    else printf '%s\n' "$pname" >> "$TMP/pol_unresolved"; fi
  done < "$TMP/cand_pol"
  for x in fn_sweepable fn_unsweepable fn_invoker fn_unresolved pol_resolved pol_unresolved; do
    sort -u "$TMP/$x" -o "$TMP/$x"
  done
fi
# TIER 1 = every DOOR the catalog confirmed, sweepable or not. Its emptiness is what makes
# "this migration contains no policy and no prosecdef gate" a CHECKABLE claim.
cat "$TMP/pol_resolved" <(cut -f1 "$TMP/fn_sweepable") <(cut -f1 "$TMP/fn_unsweepable") \
  | awk 'NF' | sort -u > "$TMP/tier1"

# ─────────────────────────────────────────────────────────────────────────────────────
# 5. THE CASE LIST — AND RULING 4 (2026-08-29): THE ARM SPLIT.
#
# ⛔ WHY. FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Part 1, measured 2026-08-27: this script
# greps `create policy` / `alter policy` WITHOUT REGARD TO COMMAND, so its case list spans
# BOTH harnesses — but the paste-able command it printed named only the READ one
# (p0-authz-door-audit.sh). An operator following this script's own output swept the read
# half and left the write half unmeasured. On AE1.5's 53 derived cases, 22 matched no gate
# in the read harness: exactly the non-SELECT policies. The clause census of its 52 —
# 31 `USING`-only, 8 `WITH CHECK`-only, 13 both — is where the 30/22 split comes from.
#
# ⚠ It survived because the READ harness reports unmatched cases and refuses to end CLEAN
# (exit 3). A phase whose migration happened to alter only SELECT policies would derive a
# fully-matching list and never learn the recipe is half-aimed.
#
# ── THE SPLIT RULE, and it is the POLICY COMMAND, not a name ─────────────────────────
#   FOR SELECT                      -> read arm
#   FOR INSERT | UPDATE | DELETE    -> write arm
#   FOR ALL, or no FOR clause       -> BOTH (Postgres defaults a policy to ALL, and an
#                                     ALL policy genuinely IS in both domains — this is
#                                     correct, not merely conservative)
#   ALTER POLICY                    -> BOTH. `ALTER POLICY` cannot change a policy's
#                                     command, so the command is simply not in the diff
#                                     text. Assigning it to both errs toward
#                                     over-selection, which is this script's stated
#                                     asymmetry: over-selection costs ~1 min of sweep,
#                                     under-selection is a gate nobody looked at.
#   FUNCTIONS                       -> read arm. The function filter demands
#                                     `returns boolean`, and the write harness's arm 1 is
#                                     value-returning RAISE-GUARDS, which that filter
#                                     cannot select. ⛔ So a raise-guard this phase
#                                     touched is in NEITHER derived list — say it out
#                                     loud rather than let the split imply completeness.
#
# ⚠ STDOUT IS UNCHANGED: still the bare, space-separated UNION, so every existing
# `CASES=$(...)` caller keeps working. The per-arm lists go to stderr WITH their own
# paste-able command. `ARM=read` / `ARM=write` narrows stdout for scripted use — the
# FUP's "separate invocations or a documented key, not two lists concatenated into one".
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "$CATALOG_OK" = 1 ]; then
  # TIER 2 ONLY. Everything the catalog put in another bucket is printed below, never here.
  cp "$TMP/fn_sweepable" "$TMP/cases_fn"
  cat "$TMP/pol_resolved" "$TMP/cases_fn" | awk 'NF' | sort -u > "$TMP/cases"
else
  # No catalog: the pre-2026-09-05 text-heuristic union, unchanged, under a loud banner.
  cat "$TMP/fn_sel_name" "$TMP/fn_sel_prop" "$TMP/fn_rewrite" | awk 'NF' | sort -u > "$TMP/cases_fn"
  cat <(cut -f1 "$TMP/pol_create") <(cut -f1 "$TMP/pol_alter") "$TMP/cases_fn" \
    | awk 'NF' | sort -u > "$TMP/cases"
fi
CASES_LIST="$(tr '\n' ' ' < "$TMP/cases" | sed 's/ *$//')"

# Per-statement command extraction. $TMP/flat is already comment-stripped and newline-
# folded, so splitting on ';' yields one statement per record.
awk 'BEGIN{RS=";"}
  {
    s = tolower($0); gsub(/[ \t]+/, " ", s)
    if (s !~ /create policy/) next
    if (!match(s, /create policy "?[a-z0-9_]+"?/)) next
    nm = substr(s, RSTART, RLENGTH); sub(/create policy /, "", nm); gsub(/"/, "", nm)
    cmd = "ALL"                       # Postgres default when no FOR clause is present
    if (match(s, / for (all|select|insert|update|delete)([ ,(]|$)/)) {
      c = substr(s, RSTART, RLENGTH); gsub(/[ ,(]/, "", c); sub(/^for/, "", c)
      cmd = toupper(c)
    }
    print nm "\t" cmd
  }' "$TMP/flat" | sort -u > "$TMP/pol_cmd"

# ── RESOLVING AN `ALTER POLICY`'S COMMAND FROM THE LIVE CATALOG ──────────────────────
# ⛔ Without this the split degenerates: a re-predication phase alters policies and never
# creates them, so EVERY case lands in "both" and the sweep doubles (measured on AE1.5:
# 52/52 instead of the true 30/22). The command is knowable — `ALTER POLICY` cannot change
# a policy's command, so the live catalog holds it.
#
# This is the ONE catalog read in a script that otherwise derives selection from diff text,
# and it is legitimate under the same rule the header states: selection may come from the
# diff, but a CLAIM about what a gate IS comes from the catalog. It is strictly OPTIONAL —
# no DB, no failure, just the safe over-selection this replaces.
# ⚠ For a HISTORICAL range the catalog describes HEAD, not that range. A policy dropped and
# recreated under a different command since then would resolve wrongly; this is announced
# rather than assumed, and the fallback is over-selection, never under-selection.
CATALOG_CMD=0
if [ -s "$TMP/pol_alter" ] && [ "$CATALOG_OK" = 1 ]; then
  if docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off \
       -c "select policyname||E'\t'||cmd from pg_policies;" 2>/dev/null \
       | awk 'NF' | sort -u > "$TMP/pol_cmd_live" && [ -s "$TMP/pol_cmd_live" ]; then
    CATALOG_CMD=1
  fi
fi

: > "$TMP/cases_read"; : > "$TMP/cases_write"; : > "$TMP/cases_bothnote"
while IFS= read -r nm; do
  [ -n "$nm" ] || continue
  # a function in CASES is in the predicate arm's own domain -> read arm only
  if grep -qxF "$nm" "$TMP/cases_fn"; then
    printf '%s\n' "$nm" >> "$TMP/cases_read"; continue
  fi
  c="$(awk -F'\t' -v n="$nm" '$1==n {print $2; exit}' "$TMP/pol_cmd")"
  src="diff text"
  if [ -z "$c" ] && [ "$CATALOG_CMD" = 1 ]; then
    c="$(awk -F'\t' -v n="$nm" '$1==n {print toupper($2); exit}' "$TMP/pol_cmd_live")"
    [ -n "$c" ] && src="live catalog"
  fi
  case "${c:-UNKNOWN}" in
    SELECT)                 printf '%s\n' "$nm" >> "$TMP/cases_read" ;;
    INSERT|UPDATE|DELETE)   printf '%s\n' "$nm" >> "$TMP/cases_write" ;;
    ALL)  # genuinely in both domains — this is correct, not merely conservative
        printf '%s\n' "$nm" >> "$TMP/cases_read"
        printf '%s\n' "$nm" >> "$TMP/cases_write"
        printf '%s\tALL (%s) — an ALL policy IS a read policy and a write policy\n' "$nm" "$src" >> "$TMP/cases_bothnote" ;;
    *)  # command unresolved: over-select. ⛔ Never the reverse.
        printf '%s\n' "$nm" >> "$TMP/cases_read"
        printf '%s\n' "$nm" >> "$TMP/cases_write"
        printf '%s\tUNRESOLVED — altered, and no live catalog to ask; sweeping BOTH arms\n' "$nm" >> "$TMP/cases_bothnote" ;;
  esac
done < "$TMP/cases"
for x in cases_read cases_write; do sort -u "$TMP/$x" -o "$TMP/$x"; done
CASES_READ="$(tr '\n' ' ' < "$TMP/cases_read" | sed 's/ *$//')"
CASES_WRITE="$(tr '\n' ' ' < "$TMP/cases_write" | sed 's/ *$//')"

show () {  # $1 = file (name<TAB>table or bare name), $2 = heading
  [ -s "$1" ] || return 0
  say "$2"
  while IFS="$(printf '\t')" read -r a b; do
    [ -n "$a" ] || continue
    if [ -n "${b:-}" ]; then say "    - $a   (on $b)"; else say "    - $a"; fi
  done < "$1"
}

rule
if [ "$CATALOG_OK" = 1 ]; then
  say "  DOORS — SELECTED BY PROPERTY, RESOLVED AGAINST THE LIVE CATALOG."
  say "    tier 1  DOORS IDENTIFIED : $(wc -l < "$TMP/tier1" | tr -d ' ')   (RLS policy, or app/public/authz function with prosecdef=t)"
  say "    tier 2  SWEEPABLE HERE   : $(wc -l < "$TMP/cases" | tr -d ' ')   (tier 1 ∧ PRED_DOMAIN, lifted from $AUDIT) -> this is CASES"
  say
fi
show "$TMP/pol_create" "  POLICIES CREATED  -> in CASES:"
show "$TMP/pol_alter"  "  POLICIES ALTERED  -> in CASES  (⚠ ruling 3 applies, see below):"
if [ "$CATALOG_OK" = 1 ]; then
  show "$TMP/fn_sweepable" "  DEFINER DOORS IN THE ARM'S DOMAIN (prosecdef ∧ PRED_DOMAIN) -> in CASES:"
else
  show "$TMP/fn_sel_name" "  FUNCTIONS SELECTED by NAME -> in CASES:"
  show "$TMP/fn_sel_prop" "  FUNCTIONS SELECTED by PROPERTY (definer + boolean + identity; ADR 0079 Amdt 9) -> in CASES:"
fi

if [ -s "$TMP/fn_held" ]; then
  say "  ⚠ HELD OUT BY NAME as side-effecting (from $AUDIT's own exclusion list):"
  while IFS= read -r n; do say "    - $n"; done < "$TMP/fn_held"
  say "    Swapping these bodies for 'select true' disarms a side effect instead of"
  say "    opening a gate; the suite would go green for the wrong reason."
fi

if [ -s "$TMP/fn_alter" ]; then
  say "  ⚠ ALTERED BY 'alter function … security definer' — ruling 3's logic, one branch over:"
  while IFS= read -r n; do
    [ -n "$n" ] || continue
    if [ "$CATALOG_OK" = 1 ]; then
      if   grep -qxF "$n" "$TMP/fn_sweepable"; then say "    - $n   -> a door IN the arm's domain; it is in CASES above"
      elif grep -qxF "$n" "$TMP/fn_unresolved"; then say "    - $n   -> UNRESOLVED (see below)"
      else say "    - $n   -> classified below (door not sweepable here, or an invoker)"; fi
    else
      say "    - $n"
    fi
  done < "$TMP/fn_alter"
  say "    An ALTER keeps the NAME and changes what the gate IS, so a verdict already"
  say "    standing for it was earned against the PRE-ALTER function and MUST NOT be"
  say "    inherited. ARM=census does not backstop it: the gate is not a newcomer."
fi

if [ "$CATALOG_OK" = 1 ]; then
  if [ -s "$TMP/fn_unsweepable" ]; then
    say "  ⛔ DOORS IDENTIFIED, NOT SWEEPABLE BY THIS ARM — each owes a TARGETED case:"
    while IFS="$(printf '\t')" read -r n why; do [ -n "$n" ] && say "    - $n   ($why)"; done < "$TMP/fn_unsweepable"
    say "    These ARE doors: the catalog says prosecdef=t. They are outside the arm's"
    say "    domain, lifted from $AUDIT."
    say "    ⛔ DO NOT ADD THEM TO CASES= BY HAND. ADR 0079:161-169 hazard 4 — the sweep can"
    say "       only neutralize what its domain selects, so a requested token it cannot match"
    say "       makes the WHOLE run UNPROVEN and every verdict in it unusable. The correct"
    say "       discharge is a TARGETED mutation case, named in the gate record."
    say "    ⭐ When the arm's PRED_DOMAIN is widened, this script needs NO change: the domain"
    say "       is lifted, so the widening admits these automatically on the next run."
  fi
  if [ -s "$TMP/fn_invoker" ]; then
    say "  · INVOKER functions (prosecdef=f) — a DIFFERENT harness's class, not a no-op:"
    while IFS="$(printf '\t')" read -r n why; do [ -n "$n" ] && say "    - $n   ($why)"; done < "$TMP/fn_invoker"
    say "    Neither door arm begins without \`and p.prosecdef\`. These are swept by"
    say "    supabase/tests/mutation/p0-authz-invoker-audit.sh — say so in the gate record."
  fi
  if [ -s "$TMP/fn_unresolved" ] || [ -s "$TMP/pol_unresolved" ]; then
    say "  ⚠ UNRESOLVED — named by the diff, ABSENT from the live catalog. NOT in CASES:"
    while IFS= read -r n; do [ -n "$n" ] && say "    - $n   (no pg_proc row in app/public/authz)"; done < "$TMP/fn_unresolved"
    while IFS= read -r n; do [ -n "$n" ] && say "    - $n   (no pg_policies row)"; done < "$TMP/pol_unresolved"
    say "    TWO causes, and they need different actions:"
    say "      (a) THE MIGRATION IS NOT APPLIED YET — the usual one mid-phase. Run"
    say "          \`supabase db reset --local\` and re-derive; the sweep reads the same"
    say "          catalog, so an unapplied gate cannot be swept either way."
    say "      (b) THE OBJECT NEVER EXISTED, or a LATER migration dropped it (normal on a"
    say "          historical range; also what a marker naming a TABLE rather than a"
    say "          function looks like). Then it is an OBLIGATION for the gate record, not"
    say "          a case: name it and say why no sweep applies."
    say "    ⛔ Deliberately NOT exit 2: measured, 2 of the last 22 function names resolve to"
    say "       nothing because a later migration dropped them, so aborting here would abort"
    say "       ordinary historical ranges."
  fi
else
  say "  ⚠ NO LIVE CATALOG — PROVISIONAL DERIVATION ($CATALOG_WHY)."
  say "    Doors could not be resolved, so this run falls back to the pre-2026-09-05 TEXT"
  say "    heuristics: the name filter below is the boundary again, and the tier split that"
  say "    keeps unsweepable tokens out of CASES did not run. ⛔ Start the local stack and"
  say "    re-derive before recording this list as derived-by-property."
  if [ -s "$TMP/fn_alter" ]; then
    say "  ⛔ ALTERED BY 'alter function … security definer' — AN OBLIGATION, NOT A CASE:"
    while IFS= read -r n; do [ -n "$n" ] && say "    - $n"; done < "$TMP/fn_alter"
    say "    An ALTER carries no body, so the diff text cannot say what these return and"
    say "    nothing here can decide whether the arm's domain contains them. ⛔ They are"
    say "    deliberately NOT in CASES: a token whose domain membership nobody checked"
    say "    makes the whole sweep UNPROVEN. Start the local stack and re-derive."
  fi
  if [ -s "$TMP/fn_excl" ]; then
    say "  ⛔ EXCLUDED BY NAME — A REVIEW LIST, NOT A DROP. Rule on each one:"
    while IFS= read -r n; do say "    - $n"; done < "$TMP/fn_excl"
    say "    The recipe's name filter ($PRED_NAME_RE, minus ^is_valid_) is ACKNOWLEDGED"
    say "    BLIND, and for an ALTERED gate ARM=census does not backstop it. A function"
    say "    here is not 'not a gate' — it is 'the filter cannot tell'. If any of these is"
    say "    an authorization gate, it owes a TARGETED mutation case (the door sweep can"
    say "    only neutralize a boolean predicate), and the ruling belongs in the gate record."
  fi
fi

if [ -s "$TMP/pol_orphan" ]; then
  say "  ⚠ POLICIES DROPPED AND NOT RECREATED — their findings rows are now ORPHANED:"
  while IFS="$(printf '\t')" read -r n t; do [ -n "$n" ] && say "    - $n   (was on $t)"; done < "$TMP/pol_orphan"
  say "    A verdict keyed to a name outlives the gate. Prune the row; do not sweep these"
  say "    (a CASES token matching no gate makes the whole run UNPROVEN)."
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# 6. RULING 3 — AN ALTER INVALIDATES THE ALTERED GATE'S EXISTING VERDICT.
#
# Amendment 8 said "until the tooling detects that, the operator names the altered
# policy in CASES= explicitly". The tooling detects it here: the altered policy is in
# CASES automatically (ruling 1), AND any verdict already standing for it is named as
# STALE, with the value it currently claims, so it cannot be read forward.
# ─────────────────────────────────────────────────────────────────────────────────────
STALE=0
if [ -s "$TMP/pol_alter" ]; then
  rule
  say "  RULING 3 — VERDICTS INVALIDATED BY AN ALTER (ADR 0079 Amendment 8):"
  if [ -z "$FINDINGS" ]; then
    say "    ⛔ RULING 3'S CHECK DID NOT RUN. The committed findings file could not be"
    say "       resolved out of $AUDIT (neither FINDINGS_COMMITTED nor FINDINGS is set at"
    say "       column 0 there any more). The altered policies ARE in CASES and so WILL be"
    say "       re-measured — but nobody has told you what stale verdict they currently"
    say "       carry, so do not read an existing row forward. Fix the lift."
  else
    while IFS="$(printf '\t')" read -r pol tbl; do
      [ -n "$pol" ] || continue
      row="$(grep -F "$tbl.$pol (" "$FINDINGS" | head -1)"
      [ -n "$row" ] || row="$(grep -E "^\|[^|]*\.$pol \(" "$FINDINGS" | head -1)"
      if [ -n "$row" ]; then
        verdict="$(printf '%s' "$row" | awk -F'|' '{gsub(/^ +| +$/,"",$5); print $5}')"
        held="$(printf '%s' "$row" | awk -F'|' '{gsub(/^ +| +$/,"",$6); print $6}')"
        STALE=$((STALE + 1))
        say "    ⚠ $tbl.$pol already carries a verdict: ${verdict:-?}  (held by: ${held:-?})"
        say "      ⛔ That row was earned against the PRE-ALTER predicate. It is now a"
        say "         verdict about a DIFFERENT QUESTION and MUST NOT be inherited:"
        say "         re-measure it in this sweep and replace the row with the new result."
        say "         ARM=census will NOT catch this — the gate is not a newcomer, it"
        say "         already has a verdict; that is exactly what makes it silent."
      else
        say "    · $tbl.$pol carries no verdict in the findings file — nothing to invalidate."
      fi
    done < "$TMP/pol_alter"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# 7. VERDICT.
# ─────────────────────────────────────────────────────────────────────────────────────
rule
if [ -z "$CASES_LIST" ]; then
  NDOORS="$(wc -l < "$TMP/tier1" | tr -d ' ')"
  if [ "$CATALOG_OK" = 1 ] && [ "$NDOORS" != "0" ]; then
    # ── SUB-CASE (ii): the loud one. Doors exist; this arm cannot sweep any of them. ──
    say "=== RESULT: FINDING (1) — DOORS IDENTIFIED: $NDOORS.  SWEEPABLE BY THIS ARM: 0. ==="
    say "    ⛔ This is NOT 'the migration changed no gate'. The live catalog resolved"
    say "       $NDOORS door(s) in this diff — they are listed above with the reason each one"
    say "       is outside the arm's domain, and obligation (b) below is therefore"
    say "       PROVABLY FALSE for this diff. Do not write it."
    say "    You owe, before the gate record is written:"
    say "      · a TARGETED mutation case for each door above (the door sweep can only"
    say "        neutralize what PRED_DOMAIN selects), named in the record; or"
    say "      · the ruling that a listed object is not an authorization decision — as a"
    say "        claim someone can check against the same catalog."
    say "    ⛔ Do NOT put them in CASES= to make this exit 0. ADR 0079:161-169 hazard 4:"
    say "       a requested token the arm cannot match turns the WHOLE sweep UNPROVEN."
  elif [ "$CATALOG_OK" = 1 ]; then
    # ── SUB-CASE (i): checkable, and now catalog-resolved rather than filter-silent. ──
    say "=== RESULT: FINDING (1) — NO DOORS AT ALL: the catalog resolved 0 in this diff. ==="
    say "    ⛔ ADR 0079 Amendment 8 ruling 2: still NOT a pass, because it is still a claim."
    say "       What CHANGED is that the claim is now checkable rather than a filter's"
    say "       silence: every name the diff produced was resolved against pg_policies and"
    say "       pg_proc.prosecdef, and none is a door. Any UNRESOLVED block above is the"
    say "       part of that claim you must still discharge."
    say "    You owe ONE of these, before the gate record is written:"
    say "      (a) widen the selection — name the gate(s) in CASES= by hand and sweep them; or"
    say "      (b) STATE IN THE GATE RECORD that these migrations contain no RLS policy"
    say "          and no prosecdef gate — which this run supports, catalog-resolved."
  else
    # ── SUB-CASE (iii): no catalog, so the pre-2026-09-05 wording is the honest one. ──
    say "=== RESULT: FINDING (1) — the diff TOUCHED $MIGDIR and ZERO cases were derived. ==="
    say "    ⛔ ADR 0079 Amendment 8 ruling 2: this is NOT a pass. 'The recipe printed"
    say "       nothing' and 'the phase changed no gate' are different claims, and only"
    say "       the second one may be recorded — after someone checks it."
    say "    ⚠ NO LIVE CATALOG this run ($CATALOG_WHY), so 'no door' has NOT been checked —"
    say "      only the name filter has spoken. Start the local stack and re-derive."
    say "    You owe ONE of these, before the gate record is written:"
    say "      (a) widen the selection — name the gate(s) in CASES= by hand and sweep them"
    say "          (start from the EXCLUDED-BY-NAME review list above, if any); or"
    say "      (b) STATE IN THE GATE RECORD that these migrations contain no RLS policy"
    say "          and no prosecdef gate — as a claim someone can check, not as a silence."
  fi
  say "    ⚠ There is no ACK env var to make this exit 0. An escape hatch for the"
  say "      unmeasurable also silences the measured."
  rule
  exit 1
fi

NCASES="$(wc -l < "$TMP/cases" | tr -d ' ')"
say "=== RESULT: DERIVED (0) — $NCASES case(s). This is a SELECTION, not a verdict. ==="
[ "$STALE" -gt 0 ] && say "    ⚠ $STALE of them carry a STALE verdict in ${FINDINGS:-the findings file} (see ruling 3 above)."
say

# ─────────────────────────────────────────────────────────────────────────────────────
# THE `SCOPE:` LINE — ONE LINE, AND THE GATE RECORD QUOTES IT VERBATIM.
#
# ⛔ FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE: "53 cases derived where AE1.3
# owned 1". The number is not the defect — recording it AGAINST A PHASE is, and nothing in
# the old output let a reader tell a union from an increment. This line makes that
# impossible to omit: it names how many files came from the committed range, from the
# working tree and from untracked, what filter was in force, and which file each case
# came from. ⚠ Quote it; do not paraphrase it. A paraphrase can invert the sentence it
# summarises, and "53 cases" is exactly the kind of number a paraphrase keeps while
# dropping the bound that made it meaningful.
# ─────────────────────────────────────────────────────────────────────────────────────
n_comm=$(awk -F'\t' '$2=="committed"' "$TMP/paths" | cut -f1 | sort -u | comm -12 - "$TMP/files" | wc -l | tr -d ' ')
n_work=$(awk -F'\t' '$2=="worktree"'  "$TMP/paths" | cut -f1 | sort -u | comm -12 - "$TMP/files" | wc -l | tr -d ' ')
n_untk=$(awk -F'\t' '$2=="untracked"' "$TMP/paths" | cut -f1 | sort -u | comm -12 - "$TMP/files" | wc -l | tr -d ' ')
say "SCOPE: $(wc -l < "$TMP/files" | tr -d ' ') file(s) — $n_comm committed (${BASE}..${TIP}), $n_work worktree, $n_untk untracked | filter: $FILTER_DESC"
if [ -s "$TMP/prov" ]; then
  say "       $NCASES case(s), attributed (a case named by two files is counted in both):"
  say "       $(awk -F'\t' 'NR==FNR{c[$1]=1;next} ($1 in c){n[$2]++} END{s="";for(f in n){b=f;sub(/^.*\//,"",b);s=s (s?", ":"") n[f] " from " b} print s}' "$TMP/cases" "$TMP/prov")"
  say
  say "  PROVENANCE — every DERIVED case and the file(s) it came from. ⛔ A case list is not"
  say "  an increment's coverage unless this map says it is:"
  while IFS= read -r nm; do
    [ -n "$nm" ] || continue
    say "    - $nm   <- $(awk -F'\t' -v n="$nm" '$1==n {b=$2; sub(/^.*\//,"",b); printf "%s%s", (k++ ? " + " : ""), b} END{print ""}' "$TMP/prov")"
  done < "$TMP/cases"
fi
say
say "    ⛔ RULING 4 — THIS LIST SPANS TWO HARNESSES. Run BOTH; neither is the sweep."
say "       read arm : $(wc -l < "$TMP/cases_read" | tr -d ' ') case(s)   write arm: $(wc -l < "$TMP/cases_write" | tr -d ' ') case(s)"
if [ "$CATALOG_CMD" = 1 ]; then
  say "       (an ALTERed policy's command was resolved from the LIVE CATALOG — ALTER cannot"
  say "        change it. ⚠ For a historical range the catalog describes HEAD, not that range.)"
elif [ -s "$TMP/pol_alter" ]; then
  say "       ⚠ NO LIVE CATALOG REACHABLE (container '$DB'), so every ALTERed policy is sent"
  say "         to BOTH arms. That is over-selection by design — ~1 min per extra gate, versus"
  say "         a gate nobody looked at. Start the local stack to halve the sweep."
fi
if [ -s "$TMP/cases_bothnote" ]; then
  say "       ⚠ IN BOTH (an ALL policy is genuinely in both domains; an ALTER does not"
  say "         carry its command in the diff text, so it is sent to both deliberately):"
  while IFS="$(printf '\t')" read -r n c; do [ -n "$n" ] && say "           - $n   [$c]"; done < "$TMP/cases_bothnote"
fi
say
if [ -n "$CASES_READ" ]; then
  say "    1of2 — READ layer (boolean predicates + SELECT/ALL policies), ~1 min per gate:"
  say
  say "      WORK=\"\${TMPDIR:-/tmp}/authz-audit-\$(date +%s)\" \\"
  say "      CASES=\"$CASES_READ\" \\"
  say "      bash $AUDIT"
else
  say "    1of2 — READ layer: NO CASES. ⛔ That is a claim to check, not a silence: it means"
  say "         this migration created no SELECT/ALL policy and selected no boolean gate."
fi
say
if [ -n "$CASES_WRITE" ]; then
  say "    2of2 — WRITE layer (INSERT/UPDATE/DELETE **and ALL** policies + raise-guards), ~1 min per gate:"
  say
  say "      WORK=\"\${TMPDIR:-/tmp}/authz-audit-\$(date +%s)\" \\"
  say "      CASES=\"$CASES_WRITE\" \\"
  say "      bash $WRITE_AUDIT"
  say
  say "      ⚠ Read its exit code DIRECTLY (0 CLEAN / 1 DIRTY / 2 ABORT / 3 UNPROVEN), same"
  say "        as the read arm. Since 2026-09-02 its policy domain is the LIVE CATALOG —"
  say "        every policy whose command can permit a write, \`ALL\` included — so an"
  say "        \`ALL\` policy sent here now MATCHES instead of being reported as no gate."
  say "        ⛔ It opens an \`ALL\` policy's WITH CHECK half only: the \`using\` half also"
  say "        gates SELECT and is the read arm's, so a COVERED here is a claim about the"
  say "        write path and a COVERED there is not. Both arms are still needed."
else
  say "    2of2 — WRITE layer: NO CASES. ⛔ Same standing: a claim to check, not a silence."
fi
say
say "    ⛔ A RAISE-GUARD THIS PHASE TOUCHED IS IN NEITHER LIST. The function filter above"
say "       demands 'returns boolean'; the write harness's arm 1 is VALUE-returning"
say "       (assert_*_writable / assert_referral_*). If this migration touched one, name it"
say "       in the write arm's CASES= by hand — the split does not make the derivation"
say "       complete, it only stops it from being aimed at one half."
say
say "    ⚠ Two hazards that have both bitten, attached here so they travel with the command:"
say "      1. A subset run has OVERWRITTEN the committed findings baseline with only its"
say "         own cases (measured 2026-08-25: 699 lines -> 90), and FROMFINDINGS arms get"
say "         GREENER as that baseline gets EMPTIER. A 2026-08-26 fix sends a subset run's"
say "         report to \$WORK instead — but ⛔ do not carry a REMEMBERED verdict about"
say "         which behaviour you are running. MEASURE it after the sweep:"
say "           git diff --stat -- ${FINDINGS:-docs/reviews/authz-door-audit-findings.md}"
say "         Empty diff = the baseline was left alone; your verdicts are in the subset"
say "         report under \$WORK (the sweep prints its path at DONE). Non-empty = restore"
say "         it (git checkout -- <path>) and re-read them from \$WORK."
say "         ⛔ Folding subset verdicts into the baseline is a MERGE of the changed rows,"
say "         never a copy of the subset file over it (ADR 0079 Amendment 1, hazard 1)."
say "      2. WORK must be overridden (above) or the BLIND .tsv files ARM=policy reads"
say "         back are written somewhere else and the comparison is against the wrong run."
say "    ⚠ Read the sweep's exit code DIRECTLY: 0 CLEAN / 1 DIRTY / 2 ABORT / 3 UNPROVEN."
say "      A pipe erases it. Quote the ARM-DOMAIN line, not just the verdict."
rule

case "$ARM" in
  read)  printf '%s\n' "$CASES_READ" ;;
  write) printf '%s\n' "$CASES_WRITE" ;;
  *)     printf '%s\n' "$CASES_LIST" ;;   # default: the UNION, unchanged for old callers
esac
exit 0
