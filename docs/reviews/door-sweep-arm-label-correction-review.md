# DOOR-SWEEP-ARM-LABEL-CORRECTION — QA review

> Unit hub: [door-sweep-arm-label-correction.md](../features/door-sweep-arm-label-correction.md) ·
> record: [door-sweep-arm-label-correction.md](../progress/door-sweep-arm-label-correction.md) ·
> branch `door-sweep-arm-label-correction`, base `main @ 8949e491`, reviewed range `8949e491..9fad1bac`
> (`9fad1bac`), 9 files / +194 / −10. Docs-only: no migration, no `src/`, no test.
> Reviewer: `qa`, 2026-09-11. Read-only on everything but this report.

**Verdict: APPROVED**

Counts — **BLOCK 0 · MAJOR 0 · MINOR 1 · NOTE 0**. Every AC-1..AC-5 clause is met, and I
re-measured the central claim (AC-4) myself against the live scripts rather than reading it off
the record. The one MINOR is the record's own citation of the LEARN-104 Enforcement cell using a
value the cell does not actually carry — cosmetic, self-contained, no gate or verdict depends on it.

---

## 1. What I measured myself (not read off the record or hub)

| Claim | How I checked it | Result |
|---|---|---|
| `p0-authz-door-audit.sh` never *reads* `FROMFINDINGS` | `grep -cE '\$\{?FROMFINDINGS' supabase/tests/mutation/p0-authz-door-audit.sh` | ✅ **0** |
| …but the bare name appears there (the trap the entry's own instrument fell into) | `grep -c FROMFINDINGS supabase/tests/mutation/p0-authz-door-audit.sh` | ✅ **6** |
| All 6 mentions are prose, not a variable read | `grep -n FROMFINDINGS` on the same file, each of the 6 lines read (`:130,139,321,339,563,1917`) | ✅ all are comments/`echo` warning text ("a FROMFINDINGS arm does NOT cover this run"); none is `$FROMFINDINGS` |
| `p0-authz-invariant.sh` is the actual reader, at the cited sites | `grep -n FROMFINDINGS supabase/tests/mutation/p0-authz-invariant.sh` | ✅ `:107` (`FROMFINDINGS="${FROMFINDINGS:-0}"` default), `:323` and `:800` (`if [ "$FROMFINDINGS" = "1" ]`) — exactly the three the record and the markers cite |
| The quoted non-existent instrument path is really absent | `test -f scripts/p0-authz-door-audit.sh` | ✅ does not exist; real file is `supabase/tests/mutation/p0-authz-door-audit.sh` |
| AC-1 markers sit directly under the fence closing each gate block, not floating elsewhere | `sed -n` around both insertion points in `docs/progress/arm3-hat-term-fix.md` | ✅ marker at (post-edit) `:142` follows the closing ` ``` ` of the block ending `:140`; marker at `:433` follows the closing ` ``` ` of the block ending `:431` |
| The two gate-block rows themselves are byte-unchanged | `git diff 8949e491..9fad1bac -- docs/progress/arm3-hat-term-fix.md` | ✅ diff shows **only** two `+`-hunks (marker + blank line each); no `-` line anywhere in the file |
| Each marker's quoted `ARM-DOMAIN` verdict matches what the record prints near that block | `grep -n "ARM-DOMAIN"` in the file | ✅ block 1: the sentence "Both sweep arms printed `ARM-DOMAIN predicate=1/127 policy=0/226 out-of-domain-bool=35`" sits at `:154`, a few lines after the `:142` marker, exactly as the marker claims; block 2: the `ARM-DOMAIN … (both arms)` line sits *inside* the block itself at `:427`, exactly as that marker (correctly, differently) claims |
| AC-3 — the ledger row's cell/column count is unchanged (append lands inside the existing Build cell) | counted unescaped `\|` in the `ARM3-HAT-TERM-FIX` row before/after | ✅ **10 pipes both times** (9 columns, matching the table header `Phase\|Name\|Status\|Build\|Tests\|QA\|Human ✓\|Completed\|Commit`); the appended text sits after "re-gated after each QA round)" — inside Build, the 4th column |
| AC-5 — archived body is verbatim the removed body | extracted the removed lines (`git show 8949e491:...open.md`, lines 1951-1957) and the corresponding appended lines in the archive, compared | ✅ **byte-identical** from `**Filed:**` through the closing sentence; only the heading (+ " — ✅ RESOLVED 2026-09-11") and the prepended closure blockquote differ, exactly as claimed |
| AC-5 — closure note's correction of its own predecessor's misquoted instrument is accurate | re-ran the two greps above | ✅ `scripts/p0-authz-door-audit.sh` does not exist; the real file's bare `grep -c FROMFINDINGS` is 6, not 0 — the closure note states both facts correctly |
| `docs/decisions/0079-*`, `0105-*`, `0190-*` exist and are cited accurately | `ls docs/decisions/`; `grep "Historical documents"` in 0105 | ✅ all three exist; ADR 0105's line 24 literally reads "Historical documents are NOT rewritten (PO, 2026-08-09)", matching the hub/record's citation |
| No `src/`, `supabase/`, `e2e/` touched | `git diff --stat 8949e491..9fad1bac -- src supabase e2e` | ✅ empty |
| `lint:registers` | `npm run lint:registers` | ✅ rc 0 — 29 hubs, 104 lessons, ratchets unchanged shape |
| `lint:progress` | `npm run lint:progress` | ✅ rc 0 |
| Full lint chain | `npm run lint` | ✅ rc 0 (all 18 gates, including `lint:backend-state`, `lint:data-access`, `lint:definer-freeze` — none of which this docs-only diff could plausibly move, and none moved) |

---

## 2. AC-by-AC

### AC-1 — the marker, beside the rows, never over them · **MET**

Both `⚠ CORRECTION 2026-09-11` blockquotes sit directly under the fence closing their gate block
(verified above), the two rows they annotate are byte-unchanged (confirmed from the diff — only
additions), and each marker's quoted `ARM-DOMAIN predicate=1/127 policy=0/226
out-of-domain-bool=35` verdict is exactly what the surrounding record text already carries. The
first marker correctly says the figure is quoted "a few lines below" (`:154`, outside the fenced
block); the second marker correctly says it is "inside the block itself" (`:427`) — the two markers
are not copy-pasted identically, they each describe their own block's actual layout, which is a
sign the correction was written by reading each site rather than templated.

### AC-2 — the recipe names the arms and the knob's owner · **MET**

`docs/lead-playbook.md`'s new §4 item names the two door-sweep arms **predicate** / **policy**
from ONE invocation quoted by `ARM-DOMAIN`; names `FROMFINDINGS=1` as `p0-authz-invariant.sh`'s
knob and the WRAPPER arm's selector only, with the same three read-site line numbers I
independently re-measured; and explicitly forbids the *"door sweep arm 2 (FROMFINDINGS=1 …)"* row
shape. It does not contradict CLAUDE.md §6 step 1, which already lists "the authz arms (`census`,
`hat`, `floor`, `FROMFINDINGS=1 wrapper`) … plus the diff-scoped door sweep, both arms" — the new
item is a compatible clarification, and CLAUDE.md itself was correctly left untouched (per its own
"never edited without asking" clause; the record states this explicitly rather than silently
skipping it).

### AC-3 — the ledger row re-read · **MET**

The `ARM3-HAT-TERM-FIX` row's Build cell gained a dated re-reading appended after "re-gated after
each QA round)" — inside the existing cell, no new `|` introduced (verified: 10 pipes before and
after). It states "both arms" is TRUE as predicate (1/127, COVERED) + policy (0/226) of one
invocation, matching the figures in `arm3-hat-term-fix.md`, and states no verdict changes.

### AC-4 — the claim re-measured, not inherited · **MET**

This is the load-bearing clause and I re-derived it independently rather than trusting the record:
`grep -cE '\$\{?FROMFINDINGS' supabase/tests/mutation/p0-authz-door-audit.sh` → **0**; the six bare
`FROMFINDINGS` mentions in that file are comment/echo prose (read all six, none is a variable
dereference); `p0-authz-invariant.sh` reads it at `:107,323,800`. All three figures match the
markers, the playbook item, and the closure note exactly. The entry's own previously-filed
instrument (`grep -c FROMFINDINGS scripts/p0-authz-door-audit.sh` → claimed 0) is corrected, not
silently: that path doesn't exist, and the bare `grep -c` on the real file returns 6 — which would
read as the *opposite* conclusion if taken literally. The correction is made in the closure note
beside the entry, the filed body is left untouched (ADR 0105 compliance, verified in §5 above).

### AC-5 — register, lesson, gates · **MET**

Register move verified byte-verbatim (§1 above). LEARN-104 in `docs/learning/LESSONS.md:127` is a
true generalization of what happened (checked against the actual measured facts, not a paraphrase
of them) and its own text is honestly bounded: "Enforcement is a BOUND: the playbook §4 item … is a
hint to the next record-writer, not a gate — nothing reads a gate row's label against the script it
names." The Enforcement *cell* value is `docs/lead-playbook.md`, a repo path in backticks that
exists — a valid value under the register's admission rule, and consistent with the precedent set
by LEARN-095/097/098/099, which use the same convention for playbook-only "hints." `npm run lint`
is rc 0 (18 gates); `lint:registers` and `lint:progress` independently rc 0.

---

## 3. Security / RLS

Not applicable — the diff touches no schema, RLS policy, RPC, DEFINER, or client code. No door,
no `prosecdef`, no grant is in scope. This is the correct posture for a docs-only correction and
the hub/record state it explicitly ("⛔ `test:db`, the authz arms, the door sweep and `e2e:prod`
are NOT owed by a change that touches no code, and are not claimed").

---

## 4. MAJOR

None.

---

## 5. MINOR

### MINOR-1 — the record misquotes its own LEARN-104 Enforcement cell as `prose only`

`docs/progress/door-sweep-arm-label-correction.md:71` reads: *"LEARN-104 filed in
`docs/learning/LESSONS.md` (`prose only` — no gate can read a row's label against the script it
names)."* The literal Enforcement cell for LEARN-104 (`docs/learning/LESSONS.md:127`, 5th column)
is **`docs/lead-playbook.md`**, not `prose only`. The *substance* of the parenthetical is correct —
the LESSONS.md row itself says the playbook item is "a hint … not a gate" — but the record quotes a
specific backticked value that is not the cell's actual content, in a register whose own admission
rule (`docs/learning/LESSONS.md:9-14`) treats the Enforcement column as a controlled vocabulary
that a reader is meant to be able to trust literally ("so a reader can tell a protected claim from
a hope").

**Failure scenario.** A later session `grep`s the record for "LEARN-104" to recall it as `prose
only` and reasonably concludes no repo path is associated with it at all — a smaller version of the
exact "a paraphrase can invert the sentence it summarizes" shape this register's own lessons warn
about, though here the paraphrase weakens rather than inverts the claim.

**To clear:** one-word fix in the record — quote the cell's actual value (`` `docs/lead-playbook.md` ``)
or drop the backticks around "prose only" so it reads as a description rather than a citation.

---

## 6. NOTE

None.

---

## 7. Could not verify / not owed

Nothing. This is a pure docs unit; `test:db`, the authz arms, the door sweep, and `e2e:prod` are
correctly stated as not owed, and I did not need the local Supabase stack for any check above —
every measurement was a `grep`/`sed`/`git diff`/`lint` read against the committed tree.

---

## 8. Obligations remaining at the Record step

- Hub frontmatter `reviews: []` needs this report linked; `status: gated` → `complete` on human
  approval, per the unit's own `## Current state → Next`.
- MINOR-1 is a one-line fix in the record file; it does not block approval and does not need a
  re-review round — the lead may fix it in the same commit that records completion, or carry it as
  a stated known-cosmetic-defect. Either is acceptable; my verdict does not depend on which.
