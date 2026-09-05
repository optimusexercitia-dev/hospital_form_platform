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
#
# ── WHAT IT DOES ────────────────────────────────────────────────────────────────────
#  1. ROWS are keyed on COLUMN 1, exactly as `p0-authz-invariant.sh`'s
#     `verdicts_from_findings` keys them (`sed -E 's/^\| *//; s/ *\|.*$//'`), so a row this
#     merge writes is a row that census arm can still read.
#       · key only in GENERATED            -> a newcomer; emit it.
#       · key in both, column 5 identical  -> nothing hand-authored; emit the generated row.
#       · key in both, verdict UNCHANGED and the baseline's column 5 STARTS WITH the
#         generated column 5 -> the remainder is a hand suffix; SPLICE it back BYTE-FOR-BYTE.
#       · anything else (verdict changed, or the generated part of the note moved) -> emit
#         the generated row WITHOUT the old suffix and CARRY the old column 5, with
#         `old -> new`, into the CARRIED block. ⛔ A note earned against one verdict must not
#         be read as if it were about another (LEARN-080).
#       · key only in BASELINE -> the gate is absent from THIS RUN's domain. The row is
#         removed from the tables and carried, because absence of a row is absence of a
#         verdict and the note has nowhere else to live.
#     ⚠ A RENAME is indistinguishable from disappear+newcomer and is deliberately NOT
#       detected: the baseline's own `## Note — a RENAME moves a gate's verdict` carries that
#       semantics, and a guess here would move a verdict onto a predicate nobody measured.
#  2. PROSE is aligned with `diff`, which is what "the complement of what the generator
#     produced" means operationally. Lines present in the baseline and absent from the
#     generated file are re-emitted IN PLACE, at the position diff aligns them to.
#     ⚠ ONE narrow exception, or a regenerated statistic would be duplicated rather than
#       replaced: inside a CHANGED group, an old line is dropped when some new line in the
#       SAME group is identical once digits and repeated blanks are removed (`Baseline:
#       Files=156, Tests=4796` -> `Files=256, Tests=8579`). This is the only heuristic in the
#       file; it decides PLACEMENT, never PRESERVATION, and step 3 is what makes that true.
#  3. SELF-VERIFICATION, and it is the reason this is a script and not a paragraph. After
#     building the merged file, every hand-authored line (by the property, recomputed from
#     the two inputs) and every hand suffix must be present in the output. If one is not,
#     the merge ABORTS with exit 2, the output is NOT written, and the committed baseline is
#     left exactly as it was. ⛔ A merge that loses a block must fail loudly; a merge that
#     silently drops one is the defect this file exists to prevent, one layer out.
#     ⚠ Proven able to FAIL: `MERGE_FAULT=drop-hand-block` (self-test only) deletes one
#       hand-authored line from the output just before verification, and the verification
#       must then abort. A verifier that has only ever returned "clean" is not evidence.
#
# ── EXIT CODES — read them DIRECTLY ─────────────────────────────────────────────────
#   0  merged (or copied, when there is no baseline to merge)
#   2  ABORT — bad arguments, or the self-verification found lost hand-authored material.
#              Nothing was written to <out>; the baseline is untouched.
# ---------------------------------------------------------------------------
set -u

BASELINE="${1:-}"; GENERATED="${2:-}"; OUT="${3:-}"
FAULT="${MERGE_FAULT:-}"

die () { printf 'MERGE-ABORT: %s\n' "$*" >&2; exit 2; }
note () { printf 'MERGE: %s\n' "$*" >&2; }

[ -n "$BASELINE" ] && [ -n "$GENERATED" ] && [ -n "$OUT" ] \
  || die "usage: merge-findings-baseline.sh <baseline> <generated> <out>"
[ -f "$GENERATED" ] || die "generated report not found: $GENERATED"

T="${TMPDIR:-/tmp}/merge-findings.$$"
mkdir -p "$T" || die "cannot create scratch dir: $T"
trap 'rm -rf "$T"' EXIT

if [ ! -s "$BASELINE" ]; then
  cp "$GENERATED" "$OUT" || die "cannot write $OUT"
  note "NO BASELINE at $BASELINE — wrote the generated report as-is. Nothing to preserve."
  exit 0
fi

# ── 1. keys, columns, and the row/prose split ───────────────────────────────────────
# ⚠ Keep this identical to p0-authz-invariant.sh's verdicts_from_findings, or a row this
#   merge writes stops being a row that census arm can read.
# ⚠ A KEY IS NOT UNIQUE, MEASURED. The committed door baseline carries `app.can_sign_section(…)`
#   TWICE (a gate swept in two passes leaves two rows in progress.tsv, and the invoker
#   baseline's own header says it ran in four). Keying on the name alone made the second
#   occurrence collide with the first and vanish from the merged file — 5 rows lost, silently,
#   in the first run of this helper. Rows are therefore keyed on NAME + ORDINAL, and step 5
#   asserts the merged row multiset equals the generated one so a recurrence cannot be quiet.
split_file () {  # $1 = file, $2 = rows out (key TAB ord TAB col4 TAB col5 TAB whole), $3 = normalised
  awk -v ROWS="$2" -v NORM="$3" '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    {
      if ($0 ~ /^\| / && $0 !~ /^\|---/ && $0 !~ /gate . policy/) {
        n = split($0, c, "|")
        key = trim(c[2]); v = (n >= 5 ? trim(c[5]) : ""); note5 = (n >= 6 ? trim(c[6]) : "")
        if (key != "") {
          ord[key]++
          print key "\t" ord[key] "\t" v "\t" note5 "\t" $0 > ROWS
          print "\001ROW\001" key "\001" ord[key] > NORM
          next
        }
      }
      print $0 > NORM
    }
  ' "$1"
}
split_file "$BASELINE"  "$T/b_rows.tsv" "$T/b_norm"
split_file "$GENERATED" "$T/g_rows.tsv" "$T/g_norm"

# ── 2. row decisions ────────────────────────────────────────────────────────────────
: > "$T/merged_rows.tsv"   # key TAB merged-row-line
: > "$T/carried.tsv"       # key TAB old-verdict TAB new-verdict TAB carried-note
: > "$T/suffixes"          # every hand suffix that must survive somewhere in the output
awk -F'\t' -v CARRY="$T/carried.tsv" -v SUFF="$T/suffixes" -v OUTF="$T/merged_rows.tsv" '
  FNR == NR { k = $1 "\001" $2; bv[k] = $3; b5[k] = $4; bname[k] = $1; seen[k] = 1; next }
  {
    key = $1 "\001" $2; gv = $3; g5 = $4; grow = $5
    done_g[key] = 1
    if (!(key in seen))       { print key "\t" grow > OUTF; next }
    if (b5[key] == g5)        { print key "\t" grow > OUTF; next }
    # ⚠ awk`s index(s, "") is 0, so an EMPTY generated note is tested explicitly: the whole
    #   baseline note is then the hand suffix, which is exactly the common shape for a row
    #   whose only content was hand-added.
    if (bv[key] == gv && (g5 == "" || index(b5[key], g5) == 1)) {
      suffix = substr(b5[key], length(g5) + 1)
      # rebuild the row with the generated columns 1-4 and column 5 = generated + suffix
      n = split(grow, c, "|")
      out = "|"
      for (i = 2; i <= n - 1; i++) out = out c[i] ((i < n - 1) ? "|" : "")
      sub(/[ \t]+$/, "", out)
      out = out suffix " |"
      print key "\t" out > OUTF
      print suffix > SUFF
      next
    }
    print key "\t" grow > OUTF
    if (b5[key] != "") {
      print bname[key] "\t" bv[key] "\t" gv "\t" b5[key] > CARRY
      print b5[key] > SUFF
    }
  }
  END {
    for (k in seen) if (!(k in done_g) && b5[k] != "") {
      print bname[k] "\t" bv[k] "\t" "(absent from this run)" "\t" b5[k] > CARRY
      print b5[k] > SUFF
    }
  }
' "$T/b_rows.tsv" "$T/g_rows.tsv"

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
cp "$T/merged_body" "$T/merged"
if [ -s "$T/carried.tsv" ]; then
  {
    printf '\n'
    printf '%s\n' "<!-- CARRIED: hand-authored notes whose row's verdict CHANGED in this run, or"
    printf '%s\n' "     whose gate is ABSENT from this run's domain. Nothing here was produced by the"
    printf '%s\n' "     generator and nothing here is a verdict — a note earned against one verdict is"
    printf '%s\n' "     not a claim about another. Re-file each one, or delete it deliberately. -->"
    printf '\n'
    while IFS="$(printf '\t')" read -r k ov nv txt; do
      [ -n "$k" ] || continue
      printf -- '- `%s` — %s -> %s — %s\n' "$k" "$ov" "$nv" "$txt"
    done < "$T/carried.tsv"
  } >> "$T/merged"
fi

# ── 5. SELF-VERIFICATION ────────────────────────────────────────────────────────────
# Hand-authored PROSE, by the property: a non-row baseline line that this run's generator
# did not produce. `comm` needs sorted input; duplicates are irrelevant to presence.
grep -vE '^\| ' "$BASELINE"  | grep -vE '^[[:space:]]*$' | sort -u > "$T/b_prose"
grep -vE '^\| ' "$GENERATED" | grep -vE '^[[:space:]]*$' | sort -u > "$T/g_prose"
comm -23 "$T/b_prose" "$T/g_prose" > "$T/hand_prose_all"
# ⚠ Lines the narrow REGENERATED-STATISTIC rule replaced are NOT hand-authored — they are
#   the previous run's own output ("Baseline: Files=156" -> "Files=256"). They are excluded
#   from what must survive, and PRINTED, so a wrong replacement is visible rather than
#   silent: replacement is the only way this merge can legitimately drop a baseline line.
[ -f "$T/replaced" ] || : > "$T/replaced"
grep -vE '^[[:space:]]*$' "$T/replaced" | sort -u > "$T/replaced.f" || true
mv "$T/replaced.f" "$T/replaced"
comm -23 "$T/hand_prose_all" "$T/replaced" > "$T/hand_prose"
NHAND=$(wc -l < "$T/hand_prose" | tr -d ' ')
NREPL=$(grep -c . "$T/replaced" || true)
NSUFF=$(sort -u "$T/suffixes" | grep -c . || true)

# ⛔ FAULT INJECTION — self-test only. It exists so the verification below can be PROVEN
#    able to fail. A detector that has only ever returned "clean" is not evidence.
if [ "$FAULT" = "drop-hand-block" ] && [ -s "$T/hand_prose" ]; then
  victim="$(head -1 "$T/hand_prose")"
  grep -vxF "$victim" "$T/merged" > "$T/merged.f" && mv "$T/merged.f" "$T/merged"
  note "FAULT INJECTED (MERGE_FAULT=drop-hand-block): removed a hand-authored line from the output."
fi
if [ "$FAULT" = "drop-suffix" ] && [ -s "$T/suffixes" ]; then
  victim="$(head -1 "$T/suffixes")"
  awk -v v="$victim" '{ i = index($0, v); if (i > 0) $0 = substr($0, 1, i - 1) substr($0, i + length(v)); print }' \
    "$T/merged" > "$T/merged.f" && mv "$T/merged.f" "$T/merged"
  note "FAULT INJECTED (MERGE_FAULT=drop-suffix): removed a spliced hand suffix from the output."
fi

: > "$T/lost"
sort -u "$T/merged" > "$T/merged_sorted"
comm -23 "$T/hand_prose" "$T/merged_sorted" | sed 's/^/PROSE: /' >> "$T/lost"

# ⛔ EVERY GENERATED ROW MUST REACH THE OUTPUT, counted, not assumed. This is the check that
#   caught the duplicate-key collision above; without it a row can disappear from a verdict
#   table while the prose check reports clean, and absence of a row is absence of a verdict.
rowkeys () { grep -E '^\| ' "$1" | grep -vE '^\|---|gate . policy' | sed -E 's/^\| *//; s/ *\|.*$//' | grep -vE '^$' | sort; }
rowkeys "$GENERATED" > "$T/gk"
rowkeys "$T/merged"  > "$T/mk"
diff "$T/gk" "$T/mk" > "$T/rowdiff" 2>/dev/null || \
  grep '^[<>]' "$T/rowdiff" | sed -e 's/^< /ROW LOST FROM THE OUTPUT: /' -e 's/^> /ROW IN THE OUTPUT THAT THIS RUN DID NOT GENERATE: /' >> "$T/lost"
if [ -s "$T/suffixes" ]; then
  sort -u "$T/suffixes" | while IFS= read -r s; do
    [ -n "$s" ] || continue
    grep -qF -- "$s" "$T/merged" || printf 'SUFFIX: %s\n' "$s" >> "$T/lost"
  done
fi

if [ -s "$T/lost" ]; then
  {
    printf 'MERGE-ABORT: the merge LOST hand-authored material. %s item(s):\n' "$(wc -l < "$T/lost" | tr -d ' ')"
    head -20 "$T/lost" | sed 's/^/  /'
    [ "$(wc -l < "$T/lost")" -gt 20 ] && printf '  … (%s more)\n' "$(( $(wc -l < "$T/lost") - 20 ))"
    printf '  baseline  : %s  (UNTOUCHED — nothing was written)\n' "$BASELINE"
    printf '  generated : %s\n' "$GENERATED"
    printf '  ⛔ Do NOT copy the generated file over the baseline. Re-merge by hand from\n'
    printf '     the two files above, or fix this merge.\n'
  } >&2
  exit 2
fi

cp "$T/merged" "$OUT" || die "cannot write $OUT"
note "merged into $OUT — $(grep -c '^| ' "$T/merged" | tr -d ' ') row line(s); PRESERVED $NHAND hand-authored prose line(s) and $NSUFF hand suffix(es); CARRIED $(wc -l < "$T/carried.tsv" | tr -d ' ') note(s)."
if [ "${NREPL:-0}" != "0" ]; then
  note "REPLACED $NREPL baseline line(s) as regenerated statistics (the only legitimate drop):"
  sed 's/^/MERGE:     - /' "$T/replaced" >&2
fi
exit 0
