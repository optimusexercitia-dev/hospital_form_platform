#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MERGE a sweep's freshly GENERATED findings report into its COMMITTED baseline,
# so a FULL run updates the generated rows and the HAND-AUTHORED material survives.
#
#   bash scripts/lib/merge-findings-baseline.sh <baseline> <generated> <out>
#
# ⛔ WHY THIS EXISTS. FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS. ADR 0153
# sent a SUBSET run's report to scratch, by design covering the subset half only; a FULL
# sweep still emitted the committed baseline through a truncating redirect. That would be
# harmless if the file were generated — and it is not. ⛔ Do NOT close that by extending the
# subset guard to full runs: a full run SHOULD rewrite the generated rows. The property to
# preserve is the hand-authored material, not the file.
#
# ⛔ THE PROPERTY, AND IT IS NOT A PATTERN LIST.
#   HAND-AUTHORED = any line of the committed baseline THIS RUN'S GENERATOR DID NOT PRODUCE.
# The follow-up names three kinds of block. By the property the door baseline carries EIGHT
# (measured 2026-09-05 on 924 lines): 1 `<!-- … -->` block · 7 `## Note` sections · 8
# `> ⚠ **HAND-MERGED` blockquotes · 37 table rows with hand prose in column 5 · an annotated
# skipped-policy bullet continuation · 2 bare `---` rules · 20 rows stranded ABOVE the COVERED
# table's delimiter · a nested blockquote inside a note. ⭐ A pattern list would have found the
# three the follow-up remembered. The door harness's own startup warning matched 8 of them
# and the writepath twin's wider pattern matched 16 ON THE SAME FILE — a warning whose number
# comes from a filter is only as true as the filter.
# ⚠ The "37" is RE-MEASURED (QA F-REC-6: this file said 37 and the unit's record said 39, same
#   file, same category, same day). Counting column 5 for any of `⭐ ⚠ ⛔ ** [merged` over the
#   399 verdict rows of the committed door baseline gives **37** under every split — capped and
#   escape-aware, naive, and symbols-only. The record's 39 was the stale one.
#   ⛔ And the first pass of this fix loop "reconciled" them by taking 39 WITHOUT measuring,
#   which is the same defect one layer out: a register's failure mode is prose rot, and a
#   confident number is not evidence about the file it describes.
#
# ⛔⛔ THE FIRST VERSION OF THIS FILE VIOLATED ITS OWN PROPERTY, AND THE VERIFIER COULD NOT SEE
# IT (QA review of DOOR-SWEEP-DERIVER, F-BLOCK-1, 2026-09-05). It classified EVERY `| `-leading
# line as a five-column verdict row and read the note with a naive `split($0, "|")`. Three
# measured losses, all at bare exit 0 with "PRESERVED everything":
#   · a markdown-escaped `\|` inside a note TRUNCATED the row  (727 B -> 579 B, 1106 B -> 570 B)
#   · a HAND-WRITTEN 3-column table was deleted whole, header and all, with no carry
#   · a correctly-shaped hand row with an EMPTY note vanished (the carry was gated on the note)
# and step 5's protected set was built with `grep -vE '^\| '`, so the whole region the losses
# happened in was excluded from what the verifier checked. ⭐ The verifier was not weak; its
# INPUT SET excluded the failure. Three rules follow, and each is load-bearing:
#   1. A baseline line is a GENERATED VERDICT ROW only if it has the generator's own shape —
#      ≥5 columns, non-empty column 1, and column 4 a verdict token or column 1 a key THIS
#      RUN'S GENERATOR ACTUALLY PRODUCED. Both sets are DERIVED from the generated file (see
#      `grammar_from_generated`), never hand-listed here, so a harness that grows a verdict
#      needs no edit. Everything else that starts with `| ` is HAND-AUTHORED PROSE.
#   2. Columns are split at UNESCAPED `|` only, and CAPPED at five: column 5 is everything
#      from the 5th separator to the last one, so a `\|` — or a stray `|` — inside a note
#      survives byte-for-byte.
#   3. Step 5's protected set is the COMPLEMENT OF THE GENERATED OUTPUT OVER THE WHOLE
#      BASELINE — `| `-leading lines included. Nothing is excluded by syntax.
#
# ── WHAT IT DOES ────────────────────────────────────────────────────────────────────
#  1. ROWS are keyed on COLUMN 1, exactly as `p0-authz-invariant.sh`'s
#     `verdicts_from_findings` keys them (`sed -E 's/^\| *//; s/ *\|.*$//'`), so a row this
#     merge writes is a row that census arm can still read.
#       · key only in GENERATED            -> a newcomer; emit it.
#       · the baseline row and the generated row are the SAME TEXT -> emit it.
#       · same verdict, columns 1-4 IDENTICAL, and the baseline's column 5 STARTS WITH the
#         generated column 5 UP TO WHITESPACE -> the remainder is a hand suffix; SPLICE it
#         back BYTE-FOR-BYTE. ⛔ "up to whitespace", not byte-exact, and that is MEASURED
#         rather than defensive: see `wsprefix`. The generated file list is NOT in general a
#         prefix of the committed note — of the two rows a real door run produced against
#         the committed baseline, ONE differed by a single hand-added space (recovered here)
#         and ONE by real content (correctly carried instead).
#       · anything else (verdict changed, a hand-edited column 1-4, or the generated part of
#         the note moved) -> emit the generated row and CARRY THE WHOLE BASELINE ROW, verbatim,
#         into the CARRIED block. ⛔ A note earned against one verdict must not be read as if
#         it were about another (LEARN-080) — and a hand edit in column 2 is no safer to
#         overwrite than one in column 5.
#       · key only in BASELINE -> the gate is absent from THIS RUN's domain. The row is
#         removed from the tables and CARRIED WHOLE — ⛔ never gated on a non-empty note: a
#         hand row whose note is empty is still a line the generator did not produce.
#     ⚠ A RENAME is indistinguishable from disappear+newcomer and is deliberately NOT
#       detected: the baseline's own `## Note — a RENAME moves a gate's verdict` carries that
#       semantics, and a guess here would move a verdict onto a predicate nobody measured.
#  2. PROSE — every baseline line that is not a generated verdict row, `| `-leading ones
#     INCLUDED — is aligned with `diff`, which is what "the complement of what the generator
#     produced" means operationally. Lines present in the baseline and absent from the
#     generated file are re-emitted IN PLACE, at the position diff aligns them to.
#     ⚠ ONE narrow exception, or a regenerated statistic would be duplicated rather than
#       replaced: inside a CHANGED group, an old line is dropped when some new line in the
#       SAME group is identical once digits and repeated blanks are removed (`Baseline:
#       Files=156, Tests=4796` -> `Files=256, Tests=8579`). This is the only heuristic in the
#       file; it decides PLACEMENT, never PRESERVATION, and step 5 is what makes that true.
#  3. SELF-VERIFICATION, and it is the reason this is a script and not a paragraph. After
#     building the merged file, every hand-authored PROSE line, every CARRIED row and every
#     spliced SUFFIX — recomputed from the two inputs by the same classifier that built the
#     file — must be present in the output. If one is not, the merge ABORTS with exit 2, the
#     output is NOT written, and the committed baseline is left exactly as it was. ⛔ A merge
#     that loses a block must fail loudly; a merge that silently drops one is the defect this
#     file exists to prevent, one layer out.
#     ⚠ PROVEN ABLE TO FAIL, and the proof is not a knob. `scripts/door-sweep-selftest.sh`
#       feeds this verifier the OUTPUT THE PRE-FIX HELPER ACTUALLY PRODUCED on the three
#       measured witnesses (committed under `scripts/fixtures/door-sweep/merge/`) and requires
#       exit 2 naming the lost lines. A real historical loss, not a simulated one. The
#       `MERGE_FAULT` knob is kept as a second, cheaper control — SELFTEST-gated, and it now
#       ABORTS when asked to inject and unable to, because an injector that reports success
#       having injected nothing is "a mutation that did not fully apply reports GREEN".
#
# ── EXIT CODES — read them DIRECTLY ─────────────────────────────────────────────────
#   0  merged (or copied, when there is no baseline to merge)
#   2  ABORT — bad arguments, or the self-verification found lost hand-authored material.
#              Nothing was written to <out>; the baseline is untouched.
#              ⛔ The CALLER must carry this into its own exit code. An aborted merge leaves
#              the findings file UNCHANGED, which on a full run is byte-for-byte what "no
#              verdict moved" looks like: `git diff --stat` cannot tell them apart.
#
# ── SELF-TEST KNOBS — refused unless SELFTEST=1 ──────────────────────────────────────
#   MERGE_FAULT=drop-hand-block|drop-suffix|drop-carried-row   inject one loss before step 5
#   MERGE_VERIFY=<file>   verify THAT file as if this merge had produced it, and write
#                         nothing. This is how a foreign (e.g. pre-fix) output is put in
#                         front of the verifier.
# ---------------------------------------------------------------------------
set -u

BASELINE="${1:-}"; GENERATED="${2:-}"; OUT="${3:-}"
FAULT="${MERGE_FAULT:-}"
VERIFY_ONLY="${MERGE_VERIFY:-}"

die () { printf 'MERGE-ABORT: %s\n' "$*" >&2; exit 2; }
note () { printf 'MERGE: %s\n' "$*" >&2; }

[ -n "$BASELINE" ] && [ -n "$GENERATED" ] && [ -n "$OUT" ] \
  || die "usage: merge-findings-baseline.sh <baseline> <generated> <out>"
[ -f "$GENERATED" ] || die "generated report not found: $GENERATED"

# ⛔ The knobs below rewrite or divert the merge. A harness run that inherited one from the
#    environment would write a deliberately damaged baseline, so they are REFUSED outright
#    unless the self-test set SELFTEST=1. (QA F-MAJOR-4: nothing scrubbed MERGE_FAULT before
#    `bash "$MERGE_LIB"`.)
if [ -n "$FAULT" ] || [ -n "$VERIFY_ONLY" ]; then
  [ "${SELFTEST:-0}" = "1" ] \
    || die "MERGE_FAULT/MERGE_VERIFY are SELF-TEST knobs and SELFTEST is not 1. Refusing to run: a real sweep must never inherit fault injection."
  case "${FAULT:-drop-hand-block}" in
    drop-hand-block|drop-suffix|drop-carried-row) ;;
    *) die "unknown MERGE_FAULT='$FAULT' (drop-hand-block|drop-suffix|drop-carried-row)" ;;
  esac
  [ -z "$VERIFY_ONLY" ] || [ -f "$VERIFY_ONLY" ] || die "MERGE_VERIFY candidate not found: $VERIFY_ONLY"
fi

T="${TMPDIR:-/tmp}/merge-findings.$$"
mkdir -p "$T" || die "cannot create scratch dir: $T"
trap 'rm -rf "$T"' EXIT

if [ ! -s "$BASELINE" ]; then
  cp "$GENERATED" "$OUT" || die "cannot write $OUT"
  note "NO BASELINE at $BASELINE — wrote the generated report as-is. Nothing to preserve."
  exit 0
fi

# ── 0. the shared table grammar ─────────────────────────────────────────────────────
# ⛔ Columns are separated by UNESCAPED `|`. A markdown `\|` is CONTENT (the door baseline
#    carries `^(is_\|can_\|has_\|…)` inside a note), and the naive `split($0, c, "|")` this
#    replaces truncated the row there. `rowsplit` also CAPS at five columns: column 5 is
#    everything between the 5th separator and the LAST one, so an unescaped stray `|` in a
#    note is preserved too instead of shifting every column after it.
AWKLIB='
function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
function seps(s, sep,   i, n, L, c) {
  L = length(s); n = 0
  for (i = 1; i <= L; i++) {
    c = substr(s, i, 1)
    if (c == "\\" && substr(s, i + 1, 1) == "|") { i++; continue }
    if (c == "|") { n++; sep[n] = i }
  }
  return n
}
function rowsplit(s, cols, sep,   ns, i) {
  delete cols
  ns = seps(s, sep)
  if (ns < 2 || sep[1] != 1) return 0
  for (i = 1; i <= 4 && i < ns; i++) cols[i] = substr(s, sep[i] + 1, sep[i + 1] - sep[i] - 1)
  if (ns >= 6) cols[5] = substr(s, sep[5] + 1, sep[ns] - sep[5] - 1)
  return ns - 1
}
function is_delim(s) { return (s ~ /^\|[[:space:]]*:?-/) }
# Does g start b, ignoring WHITESPACE RUNS? Returns the 1-based offset in b just past the
# match (so `substr(b, r)` is the hand suffix), or 0 if g is not a prefix of b at all.
# ⛔ MEASURED, and this is the reason it is not a byte prefix test (QA could-not-verify #2,
#    settled 2026-09-05 by a real 2-case door-arm run): of the two rows a real generator
#    produced against the committed baseline, ZERO were byte-exact prefixes.
#    `app.is_signoff_deferral_open` diverged at byte 20 on nothing but a space a hand editor
#    added after a comma (`…utability.sql,367_defe` vs `…utability.sql, 367_def`) — the note
#    it carries is 580 bytes of measurement that a byte test would have evicted from the
#    table over one space. `app.can_manage_professional` diverged at byte 422 on real
#    content (an annotation spliced INTO the file list, and two files the generator has
#    added since) and correctly does NOT match here: it takes the CARRY branch.
function wsprefix(b, g,   i, j, lb, lg, cb, cg) {
  lb = length(b); lg = length(g)
  if (lg == 0) return 1
  i = 1; j = 1
  while (j <= lg) {
    cg = substr(g, j, 1)
    if (cg == " " || cg == "\t") { j++; continue }
    while (i <= lb && (substr(b, i, 1) == " " || substr(b, i, 1) == "\t")) i++
    if (i > lb) return 0
    cb = substr(b, i, 1)
    if (cb != cg) return 0
    i++; j++
  }
  return i
}
'

# ── 1a. DERIVE the generator grammar from the generated file itself ─────────────────
# The generated file is 100% generator output, so its rows can be found STRUCTURALLY: a
# `| ` line that is neither a delimiter nor a table HEADER (a header is the line immediately
# above a delimiter). From those rows come the THREE signals the baseline classifier uses —
# ⛔ none of them hand-listed here, so a harness that adds a verdict, or a fourth table,
# needs no edit to this file:
#   H  the exact text of every table HEADER the generator emits. A baseline line that sits
#      under one of these, in an unbroken run of table lines, is in GENERATOR TABLE SPACE.
#      This is the signal that survives a run in which some verdict simply did not occur.
#   V  every VERDICT TOKEN this run put in column 4.
#   K  every gate KEY this run put in column 1.
# Any ONE of the three makes a well-shaped baseline line a verdict row; a hand-written table
# — its own header, its own delimiter, its own rows — matches NONE of them.
awk "$AWKLIB"'
  FNR == NR { if (is_delim($0)) delim[FNR] = 1; next }
  {
    if ($0 ~ /^\|/ && delim[FNR + 1] && !delim[FNR]) { print "H\t" $0 > GOUT; next }
    if ($0 ~ /^\| / && !delim[FNR]) {
      nc = rowsplit($0, C, S)
      if (nc >= 5 && trim(C[1]) != "") {
        v = trim(C[4]); k = trim(C[1])
        if (!(vs[v]++)) print "V\t" v > GOUT
        if (!(ks[k]++)) print "K\t" k > GOUT
      }
    }
  }
' GOUT="$T/g_grammar" "$GENERATED" "$GENERATED"
[ -f "$T/g_grammar" ] || : > "$T/g_grammar"

# ── 1b. split each file into ROWS + NORMALISED prose ────────────────────────────────
# ⚠ Keep the key identical to p0-authz-invariant.sh's verdicts_from_findings, or a row this
#   merge writes stops being a row that census arm can read.
# ⚠ A KEY IS NOT UNIQUE, MEASURED. The committed door baseline carries `app.can_sign_section(…)`
#   TWICE (a gate swept in two passes leaves two rows in progress.tsv, and the invoker
#   baseline's own header says it ran in four). Keying on the name alone made the second
#   occurrence collide with the first and vanish from the merged file — 5 rows lost, silently,
#   in the first run of this helper. Rows are therefore keyed on NAME + ORDINAL, and step 5
#   asserts the merged row multiset equals the generated one so a recurrence cannot be quiet.
split_file () {  # $1 = file, $2 = rows out (key TAB ord TAB col4 TAB col5 TAB whole), $3 = normalised
  awk -F'\t' "$AWKLIB"'
    FILENAME == GF {
      t = substr($0, 1, 1); rest = substr($0, 3)
      if (t == "H") hdr[rest] = 1; else if (t == "V") verdicts[rest] = 1; else if (t == "K") keys[rest] = 1
      next
    }
    {
      line = $0
      isheader = (line in hdr)
      if (!isheader && line !~ /^\|/) inregion = 0     # any non-table line closes the region
      isrow = 0
      if (!isheader && line ~ /^\| / && !is_delim(line)) {
        nc = rowsplit(line, C, S)
        if (nc >= 5) {
          key = trim(C[1]); v = trim(C[4])
          if (key != "" && (inregion || (v in verdicts) || (key in keys))) isrow = 1
        }
      }
      if (isrow) {
        ord[key]++
        print key "\t" ord[key] "\t" v "\t" trim(C[5]) "\t" line > ROWS
        print "\001ROW\001" key "\001" ord[key] > NORM
      } else print line > NORM
      if (isheader) inregion = 1
    }
  ' GF="$T/g_grammar" ROWS="$2" NORM="$3" "$T/g_grammar" "$1"
  [ -f "$2" ] || : > "$2"
  [ -f "$3" ] || : > "$3"
}
split_file "$BASELINE"  "$T/b_rows.tsv" "$T/b_norm"
split_file "$GENERATED" "$T/g_rows.tsv" "$T/g_norm"

# ── 2. row decisions ────────────────────────────────────────────────────────────────
: > "$T/merged_rows.tsv"   # key TAB merged-row-line
: > "$T/carried.tsv"       # kind TAB name TAB old-verdict TAB new-verdict TAB text
: > "$T/suffixes"          # every hand suffix that must survive somewhere in the output
: > "$T/carried_rows"      # every WHOLE baseline row that must survive somewhere
awk -F'\t' "$AWKLIB"'
  # everything after the 4th TAB — the row text verbatim, even if it contains a TAB.
  function after4(s,   i, k, p) {
    p = 0
    for (k = 0; k < 4; k++) { i = index(substr(s, p + 1), "\t"); if (i == 0) return ""; p = p + i }
    return substr(s, p + 1)
  }
  function carry_row(name, ov, nv, txt) {
    print "ROW\t" name "\t" ov "\t" nv "\t" txt > CARRY
    print txt > CROWS
  }
  FNR == NR {
    k = $1 "\001" $2; bv[k] = $3; b5[k] = $4; bname[k] = $1; brow[k] = after4($0); seen[k] = 1; next
  }
  {
    key = $1 "\001" $2; gv = $3; g5 = $4; grow = after4($0)
    done_g[key] = 1
    if (!(key in seen))       { print key "\t" grow > OUTF; next }
    if (brow[key] == grow)    { print key "\t" grow > OUTF; next }

    # A SPLICE is only safe when the generated row and the baseline row agree on
    # EVERYTHING BUT A SUFFIX OF COLUMN 5. A hand edit in columns 1-4 (the door baseline
    # carries `| … | command door (jsonb) — **re-verdicted** | …`) is no safer to overwrite
    # than one in column 5, so it takes the CARRY branch instead.
    # ⚠ An EMPTY generated note yields offset 1, so the whole baseline note is the hand
    #   suffix — exactly the common shape for a row whose only content was hand-added.
    nb = rowsplit(brow[key], B, S1); ng = rowsplit(grow, G, S2)
    same14 = (nb >= 5 && ng >= 5)
    if (same14) for (i = 1; i <= 4; i++) if (B[i] != G[i]) same14 = 0
    cut = same14 ? wsprefix(b5[key], g5) : 0
    if (cut > 0 && bv[key] == gv) {
      suffix = substr(b5[key], cut)
      # rebuild: the generated row through its 5th separator, then generated note + suffix.
      ns = seps(grow, S2)
      out = substr(grow, 1, S2[5]) " " g5 suffix " |"
      print key "\t" out > OUTF
      print suffix > SUFF
      next
    }
    print key "\t" grow > OUTF
    carry_row(bname[key], bv[key], gv, brow[key])
  }
  END {
    # ⛔ NOT gated on a non-empty note. A hand row with an empty column 5 is still a line
    #    this run`s generator did not produce (QA F-BLOCK-1 witness C: it vanished silently).
    for (k in seen) if (!(k in done_g)) carry_row(bname[k], bv[k], "(absent from this run)", brow[k])
  }
' CARRY="$T/carried.tsv" SUFF="$T/suffixes" OUTF="$T/merged_rows.tsv" CROWS="$T/carried_rows" \
  "$T/b_rows.tsv" "$T/g_rows.tsv"
for f in carried.tsv suffixes merged_rows.tsv carried_rows; do [ -f "$T/$f" ] || : > "$T/$f"; done

# ── 3. prose alignment ──────────────────────────────────────────────────────────────
diff --unchanged-line-format='U%L' --old-line-format='O%L' --new-line-format='N%L' \
     --unchanged-group-format='%=' \
     --old-group-format=$'\002DEL\n%<' \
     --new-group-format=$'\002INS\n%>' \
     --changed-group-format=$'\002CHG\n%<%>' \
     "$T/g_norm" "$T/b_norm" > "$T/tagged" 2>/dev/null
# diff exits 1 when the files differ, which is the normal case here; only >1 is an error.
drc=$?
[ "$drc" -le 1 ] || die "diff failed with rc=$drc while aligning $GENERATED against $BASELINE"

# ⚠ A CHANGED group emits its OLD (generated-side) lines BEFORE its NEW (baseline-side)
#   ones, so both sides are buffered and flushed together — that is what lets the narrow
#   "same line once digits are removed" test see the pair it must compare.
awk -v REPL="$T/replaced" '
  function shape(s) { gsub(/[0-9]+/, "#", s); gsub(/[ \t]+/, " ", s); gsub(/^ | $/, "", s); return s }
  function emit_row(l,   key) {
    if (substr(l, 1, 5) == "\001ROW\001") {
      key = substr(l, 6)
      if (key in merged) { print merged[key]; delete merged[key] }
      return 1
    }
    return 0
  }
  function flush(   i, j, drop) {
    for (i = 1; i <= no; i++) if (!emit_row(oldl[i])) print oldl[i]
    for (i = 1; i <= nn; i++) {
      if (emit_row(newl[i])) continue
      drop = 0
      if (grp == "CHG") for (j = 1; j <= no; j++) if (shape(newl[i]) == shape(oldl[j])) drop = 1
      if (drop) print newl[i] > REPL; else print newl[i]
    }
    no = 0; nn = 0
  }
  FNR == NR { i = index($0, "\t"); merged[substr($0, 1, i - 1)] = substr($0, i + 1); next }
  /^\002/ { flush(); grp = substr($0, 2); next }
  {
    tag = substr($0, 1, 1); body = substr($0, 2)
    if (tag == "U") { flush(); if (!emit_row(body)) print body; next }
    if (tag == "O") { no++; oldl[no] = body; next }
    if (tag == "N") { nn++; newl[nn] = body; next }
  }
  END { flush() }
' "$T/merged_rows.tsv" "$T/tagged" > "$T/merged_body"

# ── 4. the CARRIED block ────────────────────────────────────────────────────────────
# ⚠ Carried rows are INDENTED. That is load-bearing twice over: it renders as a code block
#   rather than a stray one-row table, and — because the classifier requires a line to start
#   with `| ` — the NEXT merge reads a carried row as prose and preserves it, instead of
#   resurrecting it as a verdict nobody measured.
cp "$T/merged_body" "$T/merged"
if [ -s "$T/carried.tsv" ]; then
  {
    printf '\n'
    printf '%s\n' "<!-- CARRIED: whole baseline rows whose verdict CHANGED in this run, whose"
    printf '%s\n' "     hand-edited columns this run would have overwritten, or whose gate is ABSENT"
    printf '%s\n' "     from this run's domain. Nothing here was produced by the generator and nothing"
    printf '%s\n' "     here is a verdict — a note earned against one verdict is not a claim about"
    printf '%s\n' "     another. Re-file each one, or delete it deliberately. -->"
    printf '\n'
    while IFS="$(printf '\t')" read -r kind k ov nv txt; do
      [ -n "$k" ] || continue
      printf -- '- `%s` — %s -> %s — baseline row carried verbatim:\n\n' "$k" "$ov" "$nv"
      printf '      %s\n\n' "$txt"
    done < "$T/carried.tsv"
  } >> "$T/merged"
fi

# ── 5. SELF-VERIFICATION ────────────────────────────────────────────────────────────
# ⛔ THE PROTECTED SET IS THE COMPLEMENT OF THE GENERATED OUTPUT OVER THE WHOLE BASELINE.
# It is computed from the SAME classifier that built the file (`$T/*_norm` are its prose
# halves), so `| `-leading hand material — a hand-written table, its header, its delimiter —
# is inside it. The previous version built this set with `grep -vE '^\| '`, which excluded
# exactly the region where its losses happened: a detector cannot find what its input set
# leaves out. `comm` needs sorted input; duplicates are irrelevant to presence.
# ⚠ `\001` must be the BYTE, not the four characters `\`,`0`,`0`,`1`: `grep -E` does not
#   decode that escape and the row markers would leak into the protected set as prose that
#   can never be found in the output. (Caught by the witness-C fixture, which aborted with
#   `PROSE: ROWapp.handrow(uuid)1` — the marker, not a line.)
SOH=$(printf '\001')
grep -v "^${SOH}ROW${SOH}" "$T/b_norm" | grep -vE '^[[:space:]]*$' | sort -u > "$T/b_prose"
grep -v "^${SOH}ROW${SOH}" "$T/g_norm" | grep -vE '^[[:space:]]*$' | sort -u > "$T/g_prose"
comm -23 "$T/b_prose" "$T/g_prose" > "$T/hand_prose_all"
# ⚠ Lines the narrow REGENERATED-STATISTIC rule replaced are NOT hand-authored — they are
#   the previous run's own output ("Baseline: Files=156" -> "Files=256"). They are excluded
#   from what must survive, and PRINTED, so a wrong replacement is visible rather than
#   silent: replacement is the only way this merge can legitimately drop a baseline line.
[ -f "$T/replaced" ] || : > "$T/replaced"
grep -vE '^[[:space:]]*$' "$T/replaced" | sort -u > "$T/replaced.f" || true
mv "$T/replaced.f" "$T/replaced"
comm -23 "$T/hand_prose_all" "$T/replaced" > "$T/hand_prose"
NHAND=$(grep -c . "$T/hand_prose" || true)
NREPL=$(grep -c . "$T/replaced" || true)
NSUFF=$(sort -u "$T/suffixes" | grep -c . || true)
NCROW=$(grep -c . "$T/carried_rows" || true)

# ⛔ FAULT INJECTION — self-test only (refused above unless SELFTEST=1). It exists so the
#    verification below has a second, cheap control beside the committed pre-fix outputs.
#    ⚠ It ABORTS when it is asked to inject and there is nothing to inject: `MERGE_FAULT=
#    drop-hand-block` against the real door baseline used to exit 0 having injected nothing
#    (QA F-MAJOR-4), which is "a mutation that did not fully apply reports GREEN".
inject_fail () { die "MERGE_FAULT=$FAULT was asked to inject and could not ($1). A fault injector that reports success having injected nothing is not a control."; }
# ⛔ AND IT MUST PROVE THE INJECTION LANDED. Measured 2026-09-05 while building this:
#    `drop-suffix` passed the victim through `awk -v`, which DECODES escape sequences — the
#    door baseline's suffix contains `^(is_\|can_\|has_\|…)`, so awk searched for a string
#    with the backslashes already stripped, matched nothing, changed nothing, printed
#    "FAULT INJECTED" and the verifier then passed at rc 0. The victim now travels through
#    ENVIRON (no decoding) and every injector `cmp`s the file it claims to have damaged.
if [ -n "$FAULT" ]; then
  case "$FAULT" in
    drop-hand-block)  src="$T/hand_prose";   what="hand-authored prose line" ;;
    drop-suffix)      src="$T/suffixes";     what="spliced hand suffix" ;;
    drop-carried-row) src="$T/carried_rows"; what="carried baseline row" ;;
  esac
  [ -s "$src" ] || inject_fail "this input pair holds 0 of: $what"
  MERGE_VICTIM="$(head -1 "$src")"; export MERGE_VICTIM
  cp "$T/merged" "$T/merged.pre"
  if [ "$FAULT" = "drop-suffix" ]; then
    awk '{ v = ENVIRON["MERGE_VICTIM"]; i = index($0, v); if (i > 0) $0 = substr($0, 1, i - 1) substr($0, i + length(v)); print }' \
      "$T/merged.pre" > "$T/merged"
  else
    grep -vF -- "$MERGE_VICTIM" "$T/merged.pre" > "$T/merged" || true
  fi
  cmp -s "$T/merged.pre" "$T/merged" && inject_fail "the output is byte-identical after injecting a $what — the victim was never found in it"
  note "FAULT INJECTED (MERGE_FAULT=$FAULT): removed a $what from the output (output changed, cmp-verified)."
fi

# ⛔ VERIFY-ONLY — put a FOREIGN candidate in front of this verifier (the pre-fix helper's
#    own output is what the self-test uses). Nothing is written; the expectation set is still
#    computed from <baseline> and <generated>, which is the whole point.
if [ -n "$VERIFY_ONLY" ]; then
  cp "$VERIFY_ONLY" "$T/merged" || die "cannot read MERGE_VERIFY candidate: $VERIFY_ONLY"
  note "VERIFY-ONLY: checking $VERIFY_ONLY against the material $BASELINE holds and $GENERATED does not produce. Nothing will be written."
fi

: > "$T/lost"
sort -u "$T/merged" > "$T/merged_sorted"
comm -23 "$T/hand_prose" "$T/merged_sorted" | sed 's/^/PROSE: /' >> "$T/lost"

# ⛔ EVERY GENERATED ROW MUST REACH THE OUTPUT, counted, not assumed. This is the check that
#   caught the duplicate-key collision above; without it a row can disappear from a verdict
#   table while the prose check reports clean, and absence of a row is absence of a verdict.
rowkeys () { grep -E '^\| ' "$1" | grep -vE '^\|[[:space:]]*:?-' | sed -E 's/^\| *//; s/ *\|.*$//' | grep -vE '^$' | sort; }
rowkeys "$GENERATED" > "$T/gk"
rowkeys "$T/merged"  > "$T/mk"
comm -23 "$T/gk" "$T/mk" | sed 's/^/ROW LOST FROM THE OUTPUT: /' >> "$T/lost"

# Spliced suffixes and CARRIED rows survive INSIDE a line, so they are substring checks.
if [ -s "$T/suffixes" ]; then
  sort -u "$T/suffixes" | while IFS= read -r s; do
    [ -n "$s" ] || continue
    grep -qF -- "$s" "$T/merged" || printf 'SUFFIX: %s\n' "$s" >> "$T/lost"
  done
fi
if [ -s "$T/carried_rows" ]; then
  sort -u "$T/carried_rows" | while IFS= read -r s; do
    [ -n "$s" ] || continue
    grep -qF -- "$s" "$T/merged" || printf 'CARRIED ROW: %s\n' "$s" >> "$T/lost"
  done
fi

if [ -s "$T/lost" ]; then
  {
    printf 'MERGE-ABORT: the merge LOST hand-authored material. %s item(s):\n' "$(grep -c . "$T/lost" | tr -d ' ')"
    head -20 "$T/lost" | cut -c1-200 | sed 's/^/  /'
    [ "$(grep -c . "$T/lost")" -gt 20 ] && printf '  … (%s more)\n' "$(( $(grep -c . "$T/lost") - 20 ))"
    printf '  baseline  : %s  (UNTOUCHED — nothing was written)\n' "$BASELINE"
    printf '  generated : %s\n' "$GENERATED"
    [ -n "$VERIFY_ONLY" ] && printf '  candidate : %s  (VERIFY-ONLY)\n' "$VERIFY_ONLY"
    printf '  ⛔ Do NOT copy the generated file over the baseline. Re-merge by hand from\n'
    printf '     the two files above, or fix this merge.\n'
  } >&2
  exit 2
fi

if [ -n "$VERIFY_ONLY" ]; then
  note "VERIFY-ONLY: $VERIFY_ONLY holds all $NHAND hand-authored prose line(s), $NSUFF suffix(es) and $NCROW carried row(s). Nothing written."
  exit 0
fi

cp "$T/merged" "$OUT" || die "cannot write $OUT"
note "merged into $OUT — $(grep -c '^| ' "$T/merged" | tr -d ' ') row line(s); PRESERVED $NHAND hand-authored prose line(s), $NSUFF hand suffix(es); CARRIED $NCROW whole row(s)."
if [ "${NREPL:-0}" != "0" ]; then
  note "REPLACED $NREPL baseline line(s) as regenerated statistics (the only legitimate drop):"
  sed 's/^/MERGE:     - /' "$T/replaced" >&2
fi
exit 0
