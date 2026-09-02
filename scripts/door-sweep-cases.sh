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

PRED_NAME_RE="$(lift PRED_NAME_RE)"       || { say "FATAL: cannot lift PRED_NAME_RE from $AUDIT"; exit 2; }
PRED_IDENTITY_RE="$(lift PRED_IDENTITY_RE)" || { say "FATAL: cannot lift PRED_IDENTITY_RE from $AUDIT"; exit 2; }
PRED_SIDE_EFFECTING="$(lift PRED_SIDE_EFFECTING)" || { say "FATAL: cannot lift PRED_SIDE_EFFECTING from $AUDIT"; exit 2; }
for v in PRED_NAME_RE PRED_IDENTITY_RE PRED_SIDE_EFFECTING; do
  eval "val=\$$v"
  [ -n "$val" ] || { say "FATAL: $v lifted EMPTY from $AUDIT — the domain moved. Fix the lift, do not guess."; exit 2; }
done
HELD_OUT="$(printf '%s' "$PRED_SIDE_EFFECTING" | tr -d "'" | tr ',' ' ')"

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

rule
say "DOOR-SWEEP CASE DERIVATION — ADR 0079 Amendment 1 (recipe) + Amendment 8 (rulings 1-3)"
say "  range      : ${BASE}..${TIP}$([ "$BASE" = HEAD ] && [ "$TIP" = HEAD ] && printf '%s' '  (no committed range — working tree + untracked only)')"
say "  domain     : lifted from $AUDIT (never re-typed here)"
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
: > "$TMP/content"
UNREADABLE=""
while IFS= read -r f; do
  if [ "$TIP" = "HEAD" ] && [ -f "$f" ]; then
    cat "$f" >> "$TMP/content"
  elif git cat-file -e "$TIP:$f" 2>/dev/null; then
    git show "$TIP:$f" >> "$TMP/content"
  else
    UNREADABLE="$UNREADABLE $f"
    continue
  fi
  printf '\n;\n' >> "$TMP/content"
done < "$TMP/files"
if [ -n "$UNREADABLE" ]; then
  say "  ⚠ UNREADABLE (skipped — their gates are NOT in the list below):$UNREADABLE"
fi

# `--` comments stripped, then newlines folded, so a statement split across lines
# ("alter policy x\n  on public.y") is still one match. Mirrors the audit script's own
# comment strip; carries the same caveat about a `--` inside a string literal.
sed 's/--.*$//' "$TMP/content" | tr '\n' ' ' | sed 's/[[:space:]][[:space:]]*/ /g' > "$TMP/flat"

# ─────────────────────────────────────────────────────────────────────────────────────
# 3. POLICIES — RULING 1: both forms, one case list.
# ─────────────────────────────────────────────────────────────────────────────────────
POLRE='"?[a-z0-9_]+"? on ("?[a-z0-9_]+"?\.)?"?[a-z0-9_]+"?'
grep -ohiE "create policy $POLRE" "$TMP/flat" \
  | awk '{gsub(/"/,""); n=tolower($3); t=tolower($5); sub(/^[a-z0-9_]+\./,"",t); print n "\t" t}' \
  | sort -u > "$TMP/pol_create"
grep -ohiE "alter policy $POLRE"  "$TMP/flat" \
  | awk '{gsub(/"/,""); n=tolower($3); t=tolower($5); sub(/^[a-z0-9_]+\./,"",t); print n "\t" t}' \
  | sort -u > "$TMP/pol_alter"
grep -ohiE "drop policy (if exists )?$POLRE" "$TMP/flat" \
  | awk '{gsub(/"/,""); for(i=1;i<=NF;i++) if(tolower($i)=="on"){print tolower($(i-1)) "\t" tolower($(i+1)); break}}' \
  | sed 's/\t[a-z0-9_]*\./\t/' | sort -u > "$TMP/pol_drop"
# a drop+recreate is a create; only a policy dropped and NOT recreated is an orphan
comm -23 "$TMP/pol_drop" <(cat "$TMP/pol_create" "$TMP/pol_alter" | sort -u) > "$TMP/pol_orphan"

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
sed 's/--.*$//' "$TMP/content" | awk '
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
' > "$TMP/fnchunks"

: > "$TMP/fn_sel_name"; : > "$TMP/fn_sel_prop"; : > "$TMP/fn_excl"; : > "$TMP/fn_held"
while IFS="$(printf '\t')" read -r fname fbody; do
  [ -n "$fname" ] || continue
  held=0
  for h in $HELD_OUT; do [ "$h" = "$fname" ] && held=1; done
  if [ "$held" = 1 ]; then
    printf '%s\n' "$fname" >> "$TMP/fn_held"
  elif printf '%s' "$fname" | grep -qE "$PRED_NAME_RE" && ! printf '%s' "$fname" | grep -qE '^is_valid_'; then
    printf '%s\n' "$fname" >> "$TMP/fn_sel_name"
  elif printf '%s' "$fbody" | grep -qE 'security[ ]+definer' \
    && printf '%s' "$fbody" | grep -qE 'returns[ ]+boolean' \
    && printf '%s' "$fbody" | grep -qE "$PRED_IDENTITY_RE"; then
    printf '%s\n' "$fname" >> "$TMP/fn_sel_prop"
  else
    printf '%s\n' "$fname" >> "$TMP/fn_excl"
  fi
done < "$TMP/fnchunks"
for x in fn_sel_name fn_sel_prop fn_excl fn_held; do sort -u "$TMP/$x" -o "$TMP/$x"; done
# a name-selected function must not also appear as excluded (same name, two declarations)
comm -23 "$TMP/fn_excl" <(cat "$TMP/fn_sel_name" "$TMP/fn_sel_prop" | sort -u) > "$TMP/fn_excl.f"
mv "$TMP/fn_excl.f" "$TMP/fn_excl"

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
: > "$TMP/fn_rewrite"
REWRITE_PRESENT=0
if sed 's/--.*$//' "$TMP/content" | grep -qiE 'pg_get_functiondef'; then
  REWRITE_PRESENT=1

  # (a) THE CONVENTION — an explicit, unambiguous target list the deriver can read.
  #     A rewrite migration declares:  -- door-sweep-targets: app.foo(), public.bar(uuid)
  #     Read from the RAW content (it is a comment, so it must survive comment-stripping).
  grep -ohiE '^[[:space:]]*--[[:space:]]*door-sweep-targets:.*' "$TMP/content" 2>/dev/null \
    | sed -E 's/.*[Dd]oor-[Ss]weep-[Tt]argets:[[:space:]]*//' \
    | grep -ohE '(app|public|authz)\.[a-z0-9_]+' \
    | sed -E 's/^(app|public|authz)\.//' >> "$TMP/fn_rewrite" || true

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
  #     ⛔ SECOND BOUND, MEASURED 2026-09-01 ON ITS FIRST REAL USE: the array gate is evaluated
  #     over the CONCATENATED diff content, not per file. So ONE migration in the range that
  #     builds an array enables this fallback for EVERY other migration in the same range.
  #     Measured: 20261003007190 (the BUG-PROF-INACTIVE-001 fix) carries no array literal and
  #     declares its target with the (a) marker, yet `is_active` was also selected — because
  #     20261003007180, elsewhere in the same main..HEAD range, does build one. The consequence
  #     is OVER-SELECTION (extra sweeping), never a wrong verdict, and the (a) marker still
  #     names the real target. ⚠ Fixing it means evaluating the gate per file, which is a
  #     structural change to how $TMP/content is assembled — not taken here; recorded so the
  #     next reader meets the measurement instead of assuming per-file semantics.
  #     ⚠ BOUND, STATED: a migration that BOTH builds an array AND uses quoted callables as
  #     replace() operands would still over-select. The (a) marker exists precisely so that
  #     case has an exact answer available, and it takes precedence.
  if sed 's/--.*$//' "$TMP/content" | grep -qiE 'array[[:space:]]*\['; then
    sed 's/--.*$//' "$TMP/content" \
      | grep -vE '~' \
      | grep -ohE "'(app|public|authz)\.[a-z0-9_]+\(" \
      | sed -E "s/^'//; s/\($//; s/^(app|public|authz)\.//" >> "$TMP/fn_rewrite" || true
  fi

  sort -u "$TMP/fn_rewrite" -o "$TMP/fn_rewrite"
  # A rewrite target already selected by name/property is not listed twice.
  comm -23 "$TMP/fn_rewrite" <(cat "$TMP/fn_sel_name" "$TMP/fn_sel_prop" | sort -u) > "$TMP/fn_rewrite.f"
  mv "$TMP/fn_rewrite.f" "$TMP/fn_rewrite"
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
cat <(cut -f1 "$TMP/pol_create") <(cut -f1 "$TMP/pol_alter") "$TMP/fn_sel_name" "$TMP/fn_sel_prop" \
  "$TMP/fn_rewrite" \
  | awk 'NF' | sort -u > "$TMP/cases"
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
DB="${DOOR_SWEEP_DB:-supabase_db_azkbbhskturikxpgmafq}"
CATALOG_CMD=0
if [ -s "$TMP/pol_alter" ] && command -v docker >/dev/null 2>&1 \
   && docker exec "$DB" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  if docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off \
       -c "select policyname||E'\t'||cmd from pg_policies;" 2>/dev/null \
       | awk 'NF' | sort -u > "$TMP/pol_cmd_live" && [ -s "$TMP/pol_cmd_live" ]; then
    CATALOG_CMD=1
  fi
fi

: > "$TMP/cases_read"; : > "$TMP/cases_write"; : > "$TMP/cases_bothnote"
while IFS= read -r nm; do
  [ -n "$nm" ] || continue
  # a function selected by this script is a boolean predicate -> read arm only
  if grep -qxF "$nm" "$TMP/fn_sel_name" || grep -qxF "$nm" "$TMP/fn_sel_prop"; then
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
show "$TMP/pol_create" "  POLICIES CREATED  -> in CASES:"
show "$TMP/pol_alter"  "  POLICIES ALTERED  -> in CASES  (⚠ ruling 3 applies, see below):"
show "$TMP/fn_sel_name" "  FUNCTIONS SELECTED by NAME -> in CASES:"
show "$TMP/fn_sel_prop" "  FUNCTIONS SELECTED by PROPERTY (definer + boolean + identity; ADR 0079 Amdt 9) -> in CASES:"

if [ -s "$TMP/fn_held" ]; then
  say "  ⚠ HELD OUT BY NAME as side-effecting (from $AUDIT's own exclusion list):"
  while IFS= read -r n; do say "    - $n"; done < "$TMP/fn_held"
  say "    Swapping these bodies for 'select true' disarms a side effect instead of"
  say "    opening a gate; the suite would go green for the wrong reason."
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
  say "=== RESULT: FINDING (1) — the diff TOUCHED $MIGDIR and ZERO cases were derived. ==="
  say "    ⛔ ADR 0079 Amendment 8 ruling 2: this is NOT a pass. 'The recipe printed"
  say "       nothing' and 'the phase changed no gate' are different claims, and only"
  say "       the second one may be recorded — after someone checks it."
  say "    You owe ONE of these, before the gate record is written:"
  say "      (a) widen the selection — name the gate(s) in CASES= by hand and sweep them"
  say "          (start from the EXCLUDED-BY-NAME review list above, if any); or"
  say "      (b) STATE IN THE GATE RECORD that these migrations contain no RLS policy"
  say "          and no prosecdef gate — as a claim someone can check, not as a silence."
  say "    ⚠ There is no ACK env var to make this exit 0. An escape hatch for the"
  say "      unmeasurable also silences the measured."
  rule
  exit 1
fi

NCASES="$(wc -l < "$TMP/cases" | tr -d ' ')"
say "=== RESULT: DERIVED (0) — $NCASES case(s). This is a SELECTION, not a verdict. ==="
[ "$STALE" -gt 0 ] && say "    ⚠ $STALE of them carry a STALE verdict in ${FINDINGS:-the findings file} (see ruling 3 above)."
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
