# REGISTER-GATE-HYGIENE — QA review, round 3 (pre-AE5 Batch 6)

**Reviewer:** `qa` · **Date:** 2026-09-08 · **Head reviewed:** `eec50295` (branch
`authz-register-gate-hygiene`; working tree clean at start, and at end except this report)
**Round 1:** [register-gate-hygiene-review.md](register-gate-hygiene-review.md) — CHANGES REQUESTED (2 MAJOR + 5 MINOR)
**Round 2:** [register-gate-hygiene-rereview.md](register-gate-hygiene-rereview.md) — CHANGES REQUESTED (2 MAJOR + 5 MINOR)
**Round:** 3

## 0 · Verdict line

This round's disposition is **CHANGES REQUESTED**, restated verbatim at the foot of the file.

The question the brief put first — *is there a sixth?* — has an answer, and it is **yes**, and for
the second round running it is **inside the correction of the previous one**. It is one mechanism
with four faces, all of them in the fix text of loop 2, all of them documentation:

- `114 of 169 TRACKED` is wrong **at its own commit**: that commit makes the tracked count **171**,
  by committing the two files whose untrackedness the sentence is correcting (MAJOR-1).
- The correction was applied in three places and claimed for four. `docs/lint-gates.md` — the file
  round 2 named as *"the file a future session reads to size this decision"* — **was not opened at
  all** in `eec50295` and still reads `112 of 170` and the retracted `9 + 1` bound (MAJOR-2).
- The `"agree exactly"` sentence the commit message says it replaced **is still in the record**, one
  line under its own correction, while line 609 of the same file retracts it (MAJOR-3).
- `two independent sweeps give 12 and 13` is not reproducible. Three constructible detectors at HEAD
  give **7 / 11 / 14**, none of them 12 or 13, and the `13` is my round-2 figure carried forward
  unchanged although this very change removed exactly two of its members (MAJOR-4).

Separately, the newly-filed follow-up pre-loads shape (a) with a rationale I measured to be **false
for 6 of its 8 members** (MAJOR-5).

⛔ Everything below is a documentation edit or a comment edit. **No gate needs re-running, no DB
reset, no E2E.** §1–§3 and §7 stand for round 4.

What round 2 asked for and got, verified by measurement rather than by reading the fix text: the
numerator `114` is exact and its +2 membership is exactly the two files named; MAJOR-2's three
ledger cells are correctly and not over-correctly rewritten; the ledger is 89 rows × 9 cells; the
session-log entry exists; the load-bearing claim still holds. Details in §1.

---

## 1 · Method

Every figure below was derived from the tree at `eec50295`, never reconciled against a number in the
fix text or in my own earlier reports. Where a figure agrees with round 2 I re-derived it first and
say so. Detector sources are in the scratchpad and each is restated in prose here so the lead can
re-run it without them. Exit codes were read **bare** — no pipe, no `;`-chained consumer.

⚠ **Two of my own instruments were wrong before they were right, and both are reported.**
(a) My first ledger census split rows on every `|` and reported `ENFORCEMENT-MANIFEST` as an 11-cell
row; the row is 9 cells with two **escaped** `\|` inside a quoted `SCOPE:` line. Had I not checked
the raw bytes I would have filed a false BLOCKER against the unit's headline census claim.
(b) My first read of `FUP-AE2`'s `Closes when` looked truncated; it was my own `cut -c1-400`.
Neither is a finding against the batch; both are recorded because a reviewer's instrument goes stale
exactly like anyone else's.

---

## 2 · The round-2 items, re-measured

| Round-2 item | My measurement at `eec50295` | |
|---|---|---|
| **MAJOR-1** — restate the residual as a measured set with its shapes, in all three places | see MAJOR-1 … MAJOR-4 | ⛔ **not met** |
| …the numerator | **114** readable of the tracked corpus — re-derived by importing the shipped module and running it over `git ls-files 'docs/reviews/*.md'`. Arm split: **78** single-line-only · **24** both · **12** bare-only; parts sum to 114. The single-line arm's own total is **102** before and after, unchanged | ✅ exact |
| …the `+2` and **which** two | I diffed the old regex against the new one file-by-file: **exactly 2 gained, 0 lost** — `adr-0136-deferred-signoff-review.md` (`## 7. Verdict`) and `phase-17-review.md` (`## 6. Verdict`). Membership compared, not cardinality | ✅ derived |
| …the denominator | **171**, not 169 — see MAJOR-1 | ⛔ |
| …*"no `complete` hub depends on one"* | re-derived at HEAD against `checkHub`'s real predicate (`inLedger \|\| approved`, `:614`): **9** `complete` hubs, all 9 pass, and **none of the 11 residual files is linked from any of them**. `C2-TIER1` is the only one passing on `approved` without a ledger row, and its readable review is `c2-tier1-closure-review.md`, not a residual file | ✅ **still true**, at 11 as at 13 |
| **MAJOR-2** — the three Human ✓ cells | all three rewritten; each now quotes what its source *does* record and asserts the approval in neither direction (`phase-ledger.md:112`, `:129`, `:130`) | ✅ |
| …and **not** over-corrected | `DOCS-CONSOLIDATION`'s cell volunteers *"⭐ The merge itself DID land (`396352cb`, verified an ancestor of `main`); what is unevidenced is the **approval**"* — the exact distinction I asked for. `DOCS-RESTRUCTURE`'s cell omits the merge, but that row's **Status** and **Commit** cells already carry `898cb0ab`…`ancestor of main` and `fast-forward onto main`, so the row as a whole does not understate | ✅ nothing understated |
| **MINOR-1** — `112 of 170` | corrected to `169` in three files; ⛔ **not** in `docs/lint-gates.md`, and 169 is itself wrong at the commit — MAJOR-1, MAJOR-2 | ⛔ |
| **MINOR-2** — the hub was not among "all three places" | hub now reads `65 → 114 of 169 tracked` (`:96`) and **FIVE** instances (`:102`) — both updated. The denominator is the MAJOR-1 defect, not a MINOR-2 relapse | ✅ (for what MINOR-2 asked) |
| **MINOR-3** — the hub's superseded "two homes" framing | fixed at `docs/features/register-gate-hygiene.md:57-59`: the clause is now past-tense and states *"after this batch **both** named homes DO host it"*, with the reason the tense matters | ✅ |
| **MINOR-4** — no `## Session log` entry for the fix loops | added: `### 2026-09-08 — QA fix loops 1 and 2 (lead)` at `docs/progress/register-gate-hygiene.md:574`, carrying the three meaningless mutations, the ratchet-137 attempt and the `pathToFileURL` crash. Newest-first ordering intact (gate 13 rc 0) | ✅ |
| **MINOR-5** — `ledger-completeness.md`'s 87/88 | now `Ledger now **89 rows, every one 9 cells**` with the 87→88→89 provenance spelled out (`docs/features/ledger-completeness.md:56-58`) | ✅ |
| the **89 rows / 9 cells** claim | **derived**: parsing `phase-ledger.md` with escaped-pipe handling gives 1 header row (9 columns: `Phase Name Status Build Tests QA Human ✓ Completed Commit`), 1 separator, **89 data rows, 0 rows off 9 cells**. Gate 13's own banner independently prints `89 ledger rows` | ✅ exact |
| `LEDGER-COMPLETENESS` given a row rather than flipped `complete` | done, `phase-ledger.md:137`; `reviews:` still `[]`; hub still `in_progress` | ✅ ruling implemented — see §5 |

**Gate runs I made at the tip, read bare:** `npm run lint` **rc 0** (13 gates, eslint 0 errors /
0 warnings; gate 13 `OK (self-test + 13 hubs, 11 records, 89 ledger rows, 161 bugs, 214 follow-ups,
144 archived follow-ups, 88 lessons, 412 md files scanned)`; ratchets
`closesWhenPoToRule=136/147 severityPerEmoji=127/135 severityUnrated=29/29 revisitWhenPoToRule=38/38
longHeadings=97/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52
archiveMissingClosesWhen=121/121` — none above cap, none risen). `npm run typecheck` **rc 0**.
`npm run test` **rc 0** (151 files / 2,056 tests).

⚠ **`test:db` and the four authz arms were NOT re-run this round, and that is a derived decision,
not an omission.** `git diff --name-only 26bc53a6..HEAD` is 8 files; the only non-doc file is
`scripts/check-docs-registers.mjs`; `git diff --name-only main... -- supabase/migrations
supabase/seed.sql src` is **empty**. No authz harness, no migration and no `src/` file moved since
round 2, where I ran all of them at `26bc53a6` and read rc 0 bare. Carried forward, with the bound
stated. Also carried: `git merge-base --is-ancestor main HEAD` **rc 0**, so the planned `--ff-only`
is currently possible.

---

## 3 · What I tried to break

### 3a · The widened bare-heading regex — 31 constructed inputs

`VERDICT_BARE_HEADING_RX` (`scripts/check-docs-registers.mjs:383`) run through the shipped
`reviewHasApprovedVerdict`. Fixtures are written inline here on purpose, never as a heading followed
by a verdict line, so this report cannot be read as issuing one.

| Input (heading ⟶ next non-blank line) | Result |
|---|---|
| `## 7. Verdict` ⟶ `**APPROVED.**` · `## 11. Verdict` ⟶ `APPROVED` | **accept** (the intended widening) |
| `## 2. Prior verdict` ⟶ `APPROVED` · `## 2 Prior Verdict` ⟶ `APPROVED` | **reject** |
| `## Verdict r2` / `## 7 Verdict Overturned` / `## Verdict (superseded)` ⟶ `APPROVED` | **reject** (all three) |
| `## PRELIMINARY VERDICT` ⟶ `APPROVED` | **reject** — the alternation is three fixed literals, not a wildcard |
| `## 7. Verdict` ⟶ `NOT APPROVED` / `CHANGES REQUESTED` / `~~APPROVED~~` / `> **APPROVED**` | **reject** (all four) |
| `## Verdict` ⟶ `1. APPROVED` · `## Verdict` ⟶ `٧ APPROVED` (Arabic-indic) | **reject** — the verdict line still excludes `\p{N}` |
| `## 1234567 Verdict` (7-char lead-in) · `#### 3.2.1 Verdict` (7 with the space) | **reject** — the `{0,6}` budget includes the space after the hashes |
| `## ٧. Verdict` / `## ¹. Verdict` ⟶ `APPROVED` | **accept** — unicode digits and `No` class ride along with the intended digit tolerance; harmless, none can spell a negation |
| `## >Verdict` / `## ~~Verdict~~` ⟶ `APPROVED` | **accept** — ⚠ see INFO-2, **pre-existing**, not introduced |
| `## Verdict 2` / `## VERDICT-2` ⟶ `APPROVED` | **accept** — ⚠ **newly** accepted by this change, and undescribed: MINOR-1 |

**I could not get a rejection through.** `NOT` and `CHANGES REQUESTED` are letters; the verdict-line
class pays for no letter and no digit; `>` and `~` stay excluded there. The safety argument as
stated for the *verdict line* is intact, and the digit tolerance does not weaken it.

Fixtures shipped for the change: `check-docs-registers.mjs:1703` accepts `## 7. Verdict`, `:1704`
rejects `## 7. Prior verdict` — the paired rejection fixture round 2 asked for exists. ⛔ Nothing
covers the trailing class (MINOR-1).

### 3b · The follow-up's "genuinely unfixable" rationale, tested rather than accepted

Method, so it can be re-run: build a probe predicate that widens **only** by enumerating round
markers as literals — `FINAL |TOP-LINE |RE-|ROUND \d{1,2} |R\d{1,2} |\(R\d{1,2}\)` — in exactly the
idiom `VERDICT_BARE_HEADING_RX` already ships, never by admitting arbitrary leading words. Run it
over the 8 shape-(a) files and over 8 negation fixtures.

| | Result |
|---|---|
| shape-(a) files the enumerated widening reads | **6 of 8** — `authz-m1`, `case-surface-split-increment-2`, `eth-e4`, `f-cleanup`, `memberships-collapse`, `phase-FF-1`. (`authz-ae3` and `user-registration` stay out) |
| `Prior verdict: APPROVED` — the exact string the rationale names | **reject** |
| `## Prior verdict` ⟶ `APPROVED` · `Earlier verdict: APPROVED` · `Superseded verdict: APPROVED` | **reject** (all three) |
| `Verdict: NOT APPROVED` · `# r2 VERDICT: CHANGES REQUESTED` · `## Round 4 verdict` ⟶ `CHANGES REQUESTED` · `> **Verdict: APPROVED**` | **reject** (all four) |

⛔ **I am not asking for this widening, and it is not safe as written** — a corpus sweep shows it
would newly accept `register-gate-hygiene-rereview.md`, my own **CHANGES REQUESTED** report, because
that report quotes a verdict fixture at the start of a line (INFO-1's fence/quote blindness). That
is precisely why it belongs in the follow-up as a *measured* option rather than as a foreclosed one.
See MAJOR-5.

---

## 4 · MAJOR findings

### MAJOR-1 — `114 of 169 TRACKED` is wrong at the commit that asserts it; the tracked count there is 171

**Where:** `scripts/check-docs-registers.mjs:357` · `docs/progress/register-gate-hygiene.md:305`
and `:612` · `docs/features/register-gate-hygiene.md:96`.

**Measured.** `git ls-files 'docs/reviews/*.md'` at HEAD → **171**. At `26bc53a6` → **169**. At
`440f0e88` → **169**. `git diff --name-only --diff-filter=A 26bc53a6..eec50295 -- docs/reviews/`
→ `register-gate-hygiene-rereview.md`, `register-gate-hygiene-review.md`. Both are **CHANGES
REQUESTED** and therefore unreadable, so the numerator is untouched: the true figure at HEAD is
**114 of 171**.

**Why this is the sixth instance and not a typo.** The sentence being corrected is
`docs/progress/register-gate-hygiene.md:305`, and it explains its own new error in its own words:

> *"An earlier version of this line said 'of 170': that denominator counted two UNTRACKED files
> (QA's own two reports) … a claim about 'the docs' is a claim about a **commit**."*

The two files it names as untracked are added to the index **by the same commit**. The direction of
the round-2 finding was taken (measure the tracked corpus, not the working tree); the magnitude was
reconciled against my round-2 integer instead of re-derived at the commit being written — which is
the unit's signature defect, now stated *inside a sentence whose subject is that defect*.

**Ask.** Re-derive the denominator at the commit that will carry it. ⛔ Do not simply type `171`:
the same commit that writes the number will also add this report, and the correct denominator is
whatever `git ls-files 'docs/reviews/*.md'` returns **at that commit**. If the figure cannot be made
self-consistent that way, state it as *"114 readable; the denominator moves with each review this
unit files, so it is quoted as of `<sha>`"* — which is true and stays true.

### MAJOR-2 — the correction was claimed for four places and made in three; the one that was missed is the one round 2 named as load-bearing

**Where:** `docs/lint-gates.md:29`.

**Measured.** `git diff --name-only 26bc53a6..eec50295 | grep -c lint-gates` → **0**. The file was
not opened in fix loop 2. It still reads, verbatim:

> *"Readable review files went 65 → 102 → **112 of 170**."* … *"⚠ **BOUNDED:** 9 remain unreadable
> because they put *words* on the label line … plus 1 deliberately-excluded blockquote."*

So `docs/lint-gates.md` today asserts (a) the numerator round 2 superseded, (b) the denominator round
2 flagged as counting untracked files, and (c) the `9 + 1` two-shape residual that MAJOR-1 of round 2
retracted and that the commit message says was replaced. Round 2's MAJOR-1 closed on exactly this
file: *"It sits in `docs/lint-gates.md`, the file a future session reads to size this decision."*

The population of copies was, once again, **not derived** — it was inherited from the round-1 phrase
*"all three places"*, and round 2 had already shown that phrase to be short by one (the hub). The hub
was added; the fourth was assumed to be covered. ⛔ `grep -rn '112 of 170' docs/ scripts/` finds it in
one command.

**Ask.** Bring `docs/lint-gates.md:29` to the same text as the other three, and derive the set of
copies by grep rather than by memory of the phrase. State the residual there per shape or not at all.

### MAJOR-3 — the retracted `"agree exactly"` sentence is still in the record, one line below its own correction

**Where:** `docs/progress/register-gate-hygiene.md:306`.

**Measured.** `grep -rn 'agree exactly' docs/ scripts/` returns four hits. Three are correct
retractions (`:609` in the same file, `check-docs-registers.mjs:361`, `docs/features/register-gate-hygiene.md:104`).
The fourth, `docs/progress/register-gate-hygiene.md:306`, is the original assertion, still standing:

> `> ⭐ QA's independent measurement of 10 and the lead's tightened re-measurement agree exactly.`

It sits immediately after `:305`, which now ends with *"⛔ The residual size is NOT stated as a fact:
two independent sweeps give 12 and 13 and differ in MEMBERSHIP both ways."* The same blockquote
therefore says the two measurements agree exactly **and** that they differ in membership both ways;
and `:609` of the same file says *"⛔ They agreed in CARDINALITY and differed by two members in each
direction."* One record, two opposite sentences about one event, 303 lines apart.

⚠ The same blockquote also still states the retracted bound as fact — `:300`: *"The residual is
**two** shapes: **9** with words on the label line … and **10** with a bare `## Verdict` heading"* —
directly above the sentence saying the size is not stated as a fact.

**Ask.** Delete `:306`. Re-word `:300` so the blockquote does not assert `9 + 10 + 1` and disclaim it
in the same breath: the honest form is *the residual was described as two shapes; there are at least
three, and the size depends on the detector.*

### MAJOR-4 — `two independent sweeps give 12 and 13` is not reproducible, and the `13` is a pre-widening figure carried forward

**Where:** `scripts/check-docs-registers.mjs:357-360` · `docs/progress/register-gate-hygiene.md:305`
and `:613` · `docs/followups/follow-ups-open.md:1002`.

**Measured.** I built three detectors over the 57 unreadable tracked files and compared **membership**,
not just cardinality:

| Detector (stated so it can be re-run) | Count | vs my hand classification |
|---|---|---|
| **D1** — a line whose first token is `APPROVED` with no letter or digit before it | **7** | misses every file whose approval sits on the label line; one false positive (`authz-evolution-plan-audit-2026-08-27.md:595`, a wrapped prose line beginning `approved,`) |
| **D2** — D1, or any line containing both `verdict` and `APPROVED` without `NOT`/`CHANGES REQUESTED` | **14** | +4 (`authz-ae4-gate-review` — a genuine CHANGES REQUESTED whose banner cites a *later* file's approval; `authz-evolution-plan-audit`; and **both of my own reports**, which quote fixtures), −1 (`dm5-s6`) |
| **D3** — hand classification of the operative verdict, file by file | **11** | — |

**No detector I can construct at HEAD produces 12 or 13.** And `13` is traceable: it is my own
round-2 figure, measured **before** this widening, which removed exactly two of its members
(`adr-0136-deferred-signoff-review.md`, `phase-17-review.md` — verified by regex diff, §2). Carrying
it forward unchanged into a sentence about the *current* residual is the same reconciliation the
sentence exists to forbid.

**My D3 residual, so the next round has a set to argue with rather than an integer** — 11 files,
parts summing:

- *(a) words on the label line — **8***: `authz-ae3-review.md` (`## Round 4 verdict` :746 ⟶ :756) ·
  `authz-m1-review.md` :507 · `case-surface-split-increment-2-review.md` :16/:373 ·
  `eth-e4-review.md` :920 · `f-cleanup-review.md` :15 · `memberships-collapse-review.md` :3/:173 ·
  `phase-FF-1-review.md` :15 · `user-registration-review.md` :4/:6/:45
- *(b) verdict not on the next non-blank line — **2***: `dm5-s6-review.md` :7 (heading, then the r1
  CHANGES REQUESTED line, then the r2 approval two lines down) · `min-audio-minutes-review.md` :526
  (heading, prose paragraph, `---`, then :535)
- *(c) blockquoted, deliberate — **1***: `dm5-s5-review-r2.md` :3

⛔ I state this as **D3's** answer, not as *the* residual. The note's own instruction is the right
one; it is simply not obeyed by the note.

**Ask.** Replace the bare `12 and 13` in all four places with either (i) one number **plus the
detector that produced it, in one runnable sentence**, or (ii) no number at all and a pointer to the
follow-up. The claim *"the size is detector-dependent"* is correct and worth keeping; quoting two
undocumented integers beside it is the thing it warns about.

### MAJOR-5 — the new follow-up pre-loads shape (a) with a rationale that is false for 6 of its 8 members

**Where:** `docs/followups/follow-ups-open.md:999-1003`,
`FUP-REGISTER-GATE-HYGIENE-VERDICT-SHAPES`.

**What is right, and should be kept.** The `Closes when` binds something checkable and refuses the
wrong closure explicitly: *"either the remaining shapes are read, or a ruling says they stay unread
with the reason stated per shape. ⛔ Not closed by another single-shape widening described as if it
covered the residual."* Its closing star — *"the size of the residual must be reported with the
detector that produced it"* — is the correct standing rule. And **the three shapes are named
correctly**: I checked each against my D3 set and (a), (b) and (c) partition it exactly, with (b) now
correctly covering *both* sub-shapes (a prose paragraph, and two lines down) rather than the one that
happened to be looked at. That is the first per-shape statement this unit has produced.

**What blocks.** Inside shape (a) the entry writes: *"⛔ admitting these means admitting arbitrary
leading words, which readmits `Prior verdict: APPROVED`, so this one may be genuinely unfixable and
should be *ruled* so."*

That mechanism is the **same sentence** round 1 and round 2 both found written over a population it
was untrue of. It is untrue again, and this time it is measurable (§3b): a widening that enumerates
round markers as literals — the idiom `VERDICT_BARE_HEADING_RX` already ships as
`(?:FINAL |TOP-LINE |RE-)` — reads **6 of the 8** shape-(a) files while rejecting `Prior verdict:
APPROVED`, `Earlier verdict: APPROVED`, `Superseded verdict: APPROVED` and `## Prior verdict`.
"Arbitrary leading words" is one way to admit these files; it is not the only way, and the entry
presents it as the only way in order to conclude the shape may be unfixable.

⛔ The consequence is procedural, which is why it blocks rather than files: the `Closes when` invites
a **PO ruling** on shape (a), and the ruling would be taken on a stated premise that is false. A
ruling made on a false premise is worse than no ruling, because it closes the question.

**Ask.** Rewrite shape (a)'s clause to say what is measured and nothing more: *the residual's
shape (a) is not reachable by widening the decoration class, which would readmit `Prior verdict:`;
whether it is reachable by an **enumerated** marker list is untested by the unit and measured by QA
at 6 of 8, with the caveat that the probe also newly accepts a report that quotes a fixture at line
start (INFO-1).* ⛔ Do **not** take the widening in this batch — round 2 declined to ask for it and I
decline again. Give the PO a true premise to rule on.

---

## 5 · `LEDGER-COMPLETENESS`'s row — the artifact my round-2 ruling asked for

The ruling is implemented as ruled: not flipped `complete` on a CHANGES REQUESTED verdict, given a
ledger row instead (`docs/progress/phase-ledger.md:137`), `reviews:` left `[]`, hub still
`in_progress`. `hubHasLedgerRow` will match `| **LEDGER-COMPLETENESS** |` when the hub flips.

**Does its QA cell state its bound honestly?** Yes, and better than I asked for:

> *"⚠ **BOUNDED — no independent QA round of its own.** Batch 6's re-review audited this unit's
> **output** (all seven rows re-derived against their cited sources) but **not its completeness
> derivation**, and found three Human-✓ cells asserting approvals their sources do not record
> (corrected in place). ⛔ `reviews:` is deliberately `[]`: no reviewer has verified that the six are
> the **right** six."*

That is exactly the bound, including the part that is unflattering to the row. Its Human ✓ cell is
equally honest (*"Not separately PO-approved — ratified inside Batch 6"*).

**Does the row's content match the unit's record?** On every cell I checked, yes — the four
instruments, the `phase(<token>): complete` discriminator, the *"citation is relevance, not
identity"* trap, the 8-cell row whose `Completed` column held a sha. Two defects, both MINOR:

**MINOR-2 — the row states `88 rows` twice, inside an 89-row ledger.** Cell 3: *"plus AE2 by Batch 6
= **88 rows, every one 9 cells**"*; cell 5: *"Verified inside Batch 6's gate: … ledger re-derived
**88 rows × 9 cells**"*. Measured: the ledger is **89** rows (my parse and gate 13's banner agree),
and Batch 6's gate at the tip re-derives 89, not 88. The hub carries the disambiguation
(`docs/features/ledger-completeness.md:56-58`, *"88 once Batch 6's AE2 row merged with these six, 89
once this unit got its own row"*); the **row does not**, and the row lives in the file whose count it
misstates. This is round-2 MINOR-5 relocated, not repeated — but it is the same shape.

**MINOR-3 — the row asserts `✅ complete 2026-09-08` while the hub asserts `status: in_progress`.**
Two registers, one subject, opposite states, live in the tree right now, in the unit whose deliverable
is register consistency. Gate 13 checks that a `complete` hub has a row; it has no arm for a row
claiming complete over an `in_progress` hub. It resolves itself at the Record step — say so in the
row, or accept that the window is visible.

---

## 6 · MINOR findings

**MINOR-1 — the regex change widened *two* classes and the note describes one.** `26bc53a6..eec50295`
changed `VERDICT_BARE_HEADING_RX` from `[^\p{L}\p{N}\r\n]{0,4} … [^\p{L}\p{N}\r\n]{0,4}$` to
`[^\p{L}\r\n]{0,6} … [^\p{L}\r\n]{0,4}$` — the **trailing** class dropped `\p{N}` too. The comment at
`:379-381` says only *"The lead-in admits DIGITS … but never LETTERS"*. Measured consequence:
`## Verdict 2` and `## VERDICT-2` followed by an approval are **newly accepted** and were rejected
before. No fixture covers it in either polarity. ⛔ Nothing gets a negation through it (§3a), so this
is a documentation and coverage gap, not a hole — but a comment is an assertion, and this one
describes half its own diff.

**MINOR-2, MINOR-3** — see §5.

**MINOR-4 — the `LEDGER-COMPLETENESS` QA cell cites "Batch 6's re-review" without naming the file.**
Every other citation in the reconstructed rows names its artifact. `register-gate-hygiene-rereview.md`
§6 is the audit it means.

**MINOR-5 — the hub's five acceptance-criteria checkboxes are all `- [ ]` while `## Current state`
says *"All five follow-ups built."*** `docs/features/register-gate-hygiene.md:32-64`. Harmless today
because the state section is authoritative per CLAUDE.md §7, but the hub is the summary a later
session reads, and it currently disagrees with itself on the unit's central fact.

---

## 7 · INFO

**INFO-1 — fence and indent blindness is still unfiled, and it now has a second demonstration.**
Re-measured on the shipped module: a ```` ```md ```` fenced block containing `## 7. Verdict` and
`**APPROVED**`, and a 4-space-indented copy of the same, are **both accepted** (`lines[i].trim()`
erases the indent, and no arm is fence-aware). Round 2 filed this as INFO and it did not reach
`FUP-REGISTER-GATE-HYGIENE-VERDICT-SHAPES`, whose shape list is (a)/(b)/(c) only. The second
demonstration is §3b: my probe widening newly accepts my own round-2 **CHANGES REQUESTED** report,
purely because that report quotes `# RE-VERDICT: ✅ **APPROVED**` at the start of a line. The corpus
this predicate runs over is QA reports, which are the documents most likely to quote verdict
fixtures — and this unit is now adding three of them. Sibling arms in the same script already exclude
fenced quotations (the RETIRED arm does), so the mechanism exists. Filing-grade; add it to the
follow-up as shape (d) rather than leaving it in two review reports.

**INFO-2 — `>` and `~` are excluded on the verdict line but never in the heading lead-in.**
`## >Verdict` and `## ~~Verdict~~` followed by `APPROVED` are accepted. **Pre-existing** — the old
class `[^\p{L}\p{N}\r\n]` did not exclude them either — and contrived enough that no live file hits
it. Noted only because the shipped comment's phrase *"`>` and `~` stay excluded on BOTH sides"* is
about the single-line arm and reads, in context, as though it covered the heading arm too.

**INFO-3 — the bare-heading arm still changes no gate outcome today.** Re-derived at HEAD: 9
`complete` hubs, all pass, and none of the 11 residual files is linked from one. The two files the
widening newly reads (`adr-0136-deferred-signoff-review.md`, `phase-17-review.md`) are linked from no
`complete` hub either. Correct by design — it is a widening for future hubs — and worth restating
because *"a check with zero live subjects"* is a phrase this batch had to write about gate 13's
branch check.

**INFO-4 — the any-match property is unchanged and still safe on today's corpus.** The predicate
matches anywhere in the document, so a review whose *last* round rejects after an earlier round
approved would read as approved. I re-checked the two files that could go wrong: `dm5-phase-review.md`
(CHANGES REQUESTED at :6, bare heading ⟶ approval at :484) returns the r2 answer, which is right;
`user-registration-review.md` is the mirror image and returns false, the safe direction. No file in
the corpus inverts.

---

## 8 · The Record-step list, checked against the tree as it stands

The brief asks whether anything on the Record list would be false at the moment it is written.

| Step | Status now |
|---|---|
| close the five follow-ups on their own quoted clauses | **fine** — the six ids are present and each carries a quotable `Closes when`; `FUP-AE2`'s is not truncated (my first read was my own `cut`) |
| flip `FUP-AE2`'s status | **fine** — both clauses are discharged in the entry's own text, which says *"flipping `Status:` is Batch 6's call at its Record step"* |
| rewrite the `DSR` row's cell 3 | **owed and still pending** — `phase-ledger.md:119` still carries `⛔ **PO: strike this row if that reading is wrong.**`. Per the standing bound I do not rule on retention; the cell's *content* is accurate, and the clause the PO directed be replaced is still there, so this step is real work, not a formality |
| hub → `complete` | **conditional** — `checkHub`'s predicate is `inLedger \|\| approved`. `REGISTER-GATE-HYGIENE` has `inLedger=false` and `reviews: []` (measured). It needs either a ledger row of its own **or** a linked review whose verdict line reads as an approval. ⛔ Linking **this** report satisfies neither |
| `LEDGER-COMPLETENESS` hub → `complete` | **fine** — `inLedger=true` already, so it passes without a review, and its `in_progress` branch check stops applying, which is what lets `claude/zen-vaughan-7dcae2` be deleted |
| `git merge --ff-only` | **possible** — `git merge-base --is-ancestor main HEAD` rc 0 |

⛔ One thing on that list **would** be false the moment it is written: any Record-step sentence
claiming the residual note is consistent across its homes, while `docs/lint-gates.md:29` still says
`112 of 170` and `9 + 1` (MAJOR-2).

---

## 9 · What I could NOT verify — work items, not footnotes

None is a finding; all are gaps in **my** coverage, for the lead to discharge or accept explicitly.

1. **`test:db` and the four authz arms at `eec50295`** — carried forward from my round-2 runs at
   `26bc53a6` on the derived ground that the only non-doc file changed since is
   `scripts/check-docs-registers.mjs` and the `migrations`/`seed`/`src` diff against `main` is empty.
   Derived, not assumed, and stated so it can be rejected.
2. **`ARM=policy` FULL SWEEP** (~105 min) — not run, unchanged across all three rounds.
3. **Platform asymmetry** — gate 13's argv branch check and gate 9's case-exact `exists` exercised on
   Windows only.
4. **`LEDGER-COMPLETENESS`'s completeness derivation** — still audited as *output* only. Its QA cell
   now says so itself, which is the right resolution, but the join that produced the six is not
   certified by anyone. If the PO wants it certified rather than bounded, that needs the unit's
   id-normalisation artifact handed to QA.
5. **My D3 residual is a hand classification.** Its superset (57 unreadable tracked files) and its
   candidate filter are mechanical; the operative-verdict call on each of the 40 files with an
   `APPROVED` mention is mine. I report it as one detector's answer, not as the truth.
6. **The enumerated-widening probe** (§3b) proves reachability and rejects 8 negations; it is **not**
   a safe patch — the corpus sweep shows it newly accepts a quoted fixture. I did not measure what a
   fence-aware version would cost.

---

## 10 · Summary

The fixes I asked for in round 2 are real and I proved each one rather than reading it: the three
Human ✓ cells are rewritten and, checked for over-correction, do not understate the merges that did
land; the ledger is 89 rows × 9 cells by an independent parse and by gate 13's own banner; the fix
loops finally have a session-log entry; the hub carries the corrected framing; `ledger-completeness.md`
no longer contradicts itself; `LEDGER-COMPLETENESS` got the ledger row my ruling asked for and a QA
cell that states its own bound better than I specified. The widened regex survived 31 attempts to
smuggle a rejection through it, and the load-bearing claim — *no `complete` hub depends on a
remaining one* — I re-derived at HEAD and it holds at 11 exactly as it held at 13.

What blocks is, for the third round running, inside the previous round's fix text — and this time the
mechanism is visible in four places at once. The denominator was corrected to `169` by the same commit
that made it `171`, in a sentence whose subject is *"a claim about the docs is a claim about a
commit"*. The correction was applied to three files and claimed for four, and the missing one is the
file round 2 named as the one a future session reads. The `"agree exactly"` sentence the commit says
it replaced is still in the record, one line under its own correction and 303 lines from its own
retraction. And the two integers offered in place of the retracted bound reproduce under no detector
I can build; one of them is my own pre-widening figure, stale by exactly the two files this change
fixed. Alongside them, the follow-up that exists to stop the pattern hands the PO a premise I measured
false for 6 of 8 members of the shape it describes.

Every item is a documentation or comment edit in files already open in this batch. ⛔ No gate needs
re-running: §2's gate results, §3's fixtures and §7's derivations stand for round 4, where I will
re-check the denominator at its own commit, `docs/lint-gates.md`, the two record lines, the four
statements of the residual size, the follow-up's shape-(a) clause, and the five MINORs.

**Verdict: CHANGES REQUESTED**
