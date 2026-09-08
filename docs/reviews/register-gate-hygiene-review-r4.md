# REGISTER-GATE-HYGIENE — QA review, round 4 (pre-AE5 Batch 6)

**Reviewer:** `qa` · **Date:** 2026-09-08 · **Head reviewed:** `a3b7d136` (branch
`authz-register-gate-hygiene`; working tree clean at start, and at end except this report)
**Round 1:** [register-gate-hygiene-review.md](register-gate-hygiene-review.md) — CHANGES REQUESTED (2 MAJOR + 5 MINOR)
**Round 2:** [register-gate-hygiene-rereview.md](register-gate-hygiene-rereview.md) — CHANGES REQUESTED (2 MAJOR + 5 MINOR)
**Round 3:** [register-gate-hygiene-review-r3.md](register-gate-hygiene-review-r3.md) — CHANGES REQUESTED (5 MAJOR + 5 MINOR)
**Round:** 4

## 0 · Verdict line

This round's disposition is **CHANGES REQUESTED**, restated verbatim at the foot of the file.

The brief's first question — *is there a seventh?* — has an answer, and it is **yes**, and this time
it is **not** inside the correction. It is in the part of the file the correction never looked at.

Fix loop 3 did the right thing structurally: it stopped correcting the number and removed the class.
But it scoped the removal to the phrase it had been arguing about — the **readable/total ratio** —
and never derived the population of *counts* in the files it was editing. So the same file that now
carries the banner `⛔⛔ NO COUNTS LIVE IN THIS COMMENT, DELIBERATELY, AND THAT IS THE POINT`
(`scripts/check-docs-registers.mjs:339`) still asserts, 66 lines above it and in the present tense,
**`29 of phase-ledger.md's 83 pipe-lines`** (`:273`). I measured that at HEAD: the ledger has **91**
pipe-lines and **42** bolded ids. The sentence was exactly true at the commit that wrote it
(`375726b22`: 83 / 29 — I checked), and it was falsified **by this unit's own later commits**, which
added seven rows and re-bolded the workaround six. That is the identical mechanism, one class over.

Three more survivors of the same sweep, all measured, all live:

- `docs/followups/follow-ups-open.md:1002` still ends with *"two independent sweeps gave **12 and
  13** here"* — the exact file:line round 3 MAJOR-4 named, retracted in the record at two places, and
  the premise the PO is being asked to rule from (MAJOR-1).
- The new **shape (d)** is described correctly but is **not bound by the entry's `Closes when`**: it
  is a false-*positive* shape filed under a clause that closes when *"the remaining shapes are
  read"* — which shape (d) already is. That is the defect, not the closure (MAJOR-2).
- The hub's `## Current state` — the summary a later session reads — still says the unit is in
  *"QA round-2 fix loop"* and that its next step is *"QA re-review round 3"* (MINOR-1).

⛔ Everything below is a documentation or comment edit. **No gate needs re-running, no DB reset, no
E2E.** §3's gate results, §5's fixture measurements and §6's derivations stand for round 5.

What round 3 asked for and got, verified by measurement rather than by reading the fix text: the
retraction is now in place and in full; `docs/lint-gates.md` was reached; the `"agree exactly"`
sentence is gone; the shape-(a) rationale is replaced by my measurement with an explicit ⛔ against
ruling on the old premise; **both** widened classes now carry accept *and* reject fixtures; the
`LEDGER-COMPLETENESS` row names its cited review and states when its hub flips; the acceptance boxes
are checked with the right caveat. Details in §3.

---

## 1 · Method

Every figure below was derived from the tree at `a3b7d136`, never reconciled against a number in the
fix text or in my own earlier reports. Exit codes were read **bare** — no pipe, no `;`-chained
consumer. Probe scripts are in the scratchpad and each is restated in prose so the lead can re-run it
without them.

⚠ **One of my own instruments was wrong before it was right, and it is reported.** My first
per-commit corpus census used `git ls-files --with-tree=<sha>`, which **unions the commit's tree with
the current index** — it returned `172` for all seven commits on the branch, which would have made
round 3's MAJOR-1 look fabricated. `git ls-tree -r --name-only <sha> docs/reviews` gives the real
series: **169 · 169 · 169 · 169 · 171 · 172 · 172** across `375726b22 → a3b7d136`. Round 3's figures
reproduce exactly. This is not a finding against the batch; it is recorded because a reviewer's
instrument goes stale like anyone else's, and because the wrong one *agreed with itself seven times*.

---

## 2 · The seventh, measured

The question is whether the structural fix is complete. It is not, and the gap is derivable in one
command the fix loop did not run: `grep -nE '[0-9]+ (of|rows|pipe-lines)' ` over the files it was
already editing.

| Site | What it asserts | Measured at HEAD | |
|---|---|---|---|
| `scripts/check-docs-registers.mjs:273` | *"**29** of phase-ledger.md's **83** pipe-lines already write `\| **AE0** \| …`"* — present tense, undated | **91** pipe-lines, **42** bolded, **47** unbolded, **89** data rows | ⛔ **false**, falsified by this unit |
| `scripts/check-docs-registers.mjs:278` | *"⛔ Not fixed by unbolding **76 rows**."* — unquoted, undated | 89 data rows; the unit's own hub `:37` calls the same figure *"refuted … it is **81 rows**, 52 unbolded, 29 bolded"* | ⛔ **contradicted by the same unit** |
| `docs/followups/follow-ups-open.md:1002` | *"two independent sweeps gave **12 and 13** here"* | Record `:312-314` and `:629-631`: *"reproduces under nothing — three detectors at HEAD give 7 / 11 / 14"* | ⛔ **retracted in one home, asserted in the other** |
| `docs/followups/follow-ups-open.md:1303` | *"`\| AE4 \|` **currently** sits unbolded alone among **76 rows**"* | `phase-ledger.md:131` is now `\| **AE4** \|` — bolded by this unit; 47 rows are unbolded | ⛔ **falsified by this unit's deliverable** |
| `scripts/check-docs-registers.mjs:339` | *"⛔⛔ **NO COUNTS LIVE IN THIS COMMENT**, DELIBERATELY"* | `:340-348` contain `six`, `14`, `20`, `23`, `9 + 10 + 1`, `114-of-169`, `171`, `three` | ⚠ true of *live* counts, false as written |

**What is genuinely clean, and I checked rather than assumed.** No `N of M` readable/total ratio is
stated as a live fact anywhere: `git grep` over `docs/` and `scripts/` returns the phrase only inside
explicit retraction quotes (`register-gate-hygiene.md:309`, `:629`; `check-docs-registers.mjs:341`,
`:345`) and one dated log line, `register-gate-hygiene.md:291` (*"65 of 169 … → 102 of 169"*), whose
denominator I verified was **exactly correct at `375726b22`** — 169 tracked. That one is dated
history that was true when written, which is the standard the brief set, and it should stay.

⭐ **So the class the fix loop named is closed and the class beside it is not.** The bound that
matters is not *"no ratio"* — it is *"no self-invalidating number in prose"*, and a ledger row total
in a comment is the same animal as a readable/total ratio in a comment. Two of the four survivors
were falsified by this unit's own commits, which is the strongest possible demonstration that the
population must be derived by grep and not by recalling which sentence the last round argued about.

---

## 3 · The round-3 items, re-measured

| Round-3 item | My measurement at `a3b7d136` | |
|---|---|---|
| **MAJOR-1** — re-derive the denominator at its own commit, or state no ratio | No ratio anywhere. The predicate's comment carries the **derivation** instead. I ran it as written — import `reviewHasApprovedVerdict`, take `git ls-files docs/reviews`, keep `.md`, count acceptances — and got **114 readable of 172 tracked** in one 6-line script. The recipe is runnable and correct, and `git ls-files` (index, not working tree) is the right corpus | ✅ **met, and better than a number** |
| **MAJOR-2** — reach `docs/lint-gates.md`, derive the copies by grep | `docs/lint-gates.md:29` now reads *"⛔ **No readable/total ratio is quoted here, deliberately** … **Derive it** from `git ls-files docs/reviews`"*. The retracted `112 of 170` and the `9 + 1` bound are gone from the file | ✅ met |
| **MAJOR-3** — delete the standing `"agree exactly"` sentence; re-word the `9 + 10 + 1` bound | `grep -rn 'agree exactly'` now returns only retractions (`register-gate-hygiene.md:315`, `:625`, `check-docs-registers.mjs` history). The blockquote at `:296-321` is retracted **in full and in place**, explicitly including *"the ones added to correct it"* | ✅ met |
| **MAJOR-4** — replace `12 and 13` in **all four** places | Fixed in **three** — `check-docs-registers.mjs`, `register-gate-hygiene.md:305`-block, `:613`-block. ⛔ **Not** in `docs/followups/follow-ups-open.md:1002`, the fourth place I named by file:line, and the only one a PO ruling will read | ⛔ **not met** — MAJOR-1 below |
| **MAJOR-5** — give the PO a true premise for shape (a) | Rewritten. The entry now carries the ⛔ CORRECTED block, my 6-of-8 measurement with its method (*"enumerates round markers as LITERALS"*), the four negations it still rejects, and the explicit ⚠ that QA did **not** request the widening because its probe newly accepts a quoted fixture | ✅ met, and states the caveat I asked for |
| **MINOR-1** — the regex widened two classes, described one, fixtured one | Comment `:377-382` now says *"BOTH classes admit DIGITS and neither admits LETTERS … Lead-in: `## 7. Verdict` … Trailing: `## Verdict 2`"*. Fixtures: accept `## 7. Verdict` (`:1703`) / reject `## 7. Prior verdict` (`:1705`) · accept `## Verdict 2` (`:1704`) / reject `## Verdict two` (`:1706`). **Both classes, both polarities** | ✅ met |
| **MINOR-2** — the row says 88 inside an 89-row ledger | The row no longer quotes a total: *"⛔ The row TOTAL is deliberately not quoted here — it moved 87 → 88 → 89 during this work … `npm run lint:registers` prints it"* | ✅ met (⚠ MINOR-3 below on the form) |
| **MINOR-3** — the row says `complete` over an `in_progress` hub | Row `:137` now reads *"✅ **complete 2026-09-08** (⚠ its hub flips to `complete` at Batch 6's Record step — until then the hub reads `in_progress`, and THIS row is what will let it)"*. Verified: `checkHub`'s predicate is `inLedger \|\| approved` and `LEDGER-COMPLETENESS` has `inLedger=true`, so the row is indeed what will let it | ✅ met, and mechanically accurate |
| **MINOR-4** — the QA cell cites "Batch 6's re-review" without naming it | Now cites `register-gate-hygiene-rereview.md` §6 by link | ✅ met |
| **MINOR-5** — five `- [ ]` boxes beside *"All five follow-ups built"* | All five `- [x]`, above a line reading *"⚠ **A checked box means the CONDITION IS MET AND PROVEN, not that the register entry is closed.** All five entries are still `Status: open` on purpose"*. I verified all six ids are `Status: open` | ✅ met, with the right distinction |
| **INFO-1** — fence/indent blindness unfiled | Filed as **shape (d)** with the reason it was nearly lost. The description is **correct** — I re-measured both halves (§5) | ✅ filed (⚠ MAJOR-2 below on its closing condition) |

**Gate runs I made at the tip, read bare:** `npm run lint` **rc 0** — gate 13
`OK (self-test + 13 hubs, 11 records, 89 ledger rows, 161 bugs, 2 bug docs, 214 follow-ups, 144
archived follow-ups (170 entry headings; ids first seen at h2=27 h3=117), 154 follow-up bodies, 88
lessons, 1 postmortems, 0 handoffs, 412 md files scanned for retired citations)`; ratchets
`closesWhenPoToRule=136/147 severityPerEmoji=127/135 severityUnrated=29/29 revisitWhenPoToRule=38/38
longHeadings=97/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52
archiveMissingClosesWhen=121/121` — none above cap, none risen since round 3. `npm run typecheck`
**rc 0**. `npm run test` **rc 0** (151 files / 2,056 tests). Independent parse of the ledger with
escaped-pipe handling: **89 data rows, header 9 columns, zero rows off 9 cells** — agreeing with gate
13's own banner, derived separately.

⚠ **`test:db` and the four authz arms were NOT re-run this round, and that is a derived decision.**
`git diff --name-only 26bc53a6..HEAD` is 9 files; the only non-doc file is
`scripts/check-docs-registers.mjs`, whose own arms run inside `npm run lint` (rc 0, self-test
included). `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` is **empty**.
No authz harness, no migration and no `src/` file has moved since round 2, where I ran all of them at
`26bc53a6` and read rc 0 bare. Carried forward with the bound stated. Also carried:
`git merge-base --is-ancestor main HEAD` **rc 0**, so the planned `--ff-only` is still possible.

---

## 4 · Does removing the numbers cost anything a reader needed?

The brief asks this directly, and the answer is **no** — with one caveat that is about form, not
substance.

**The derivation is genuinely sufficient.** I re-derived the ratio from the comment's own recipe
without consulting any prior report: **172 tracked, 114 readable**. That took six lines. The recipe
names the module, the function, the corpus command, and the reason `git ls-files` beats `readdirSync`
— every input a later session needs. A quoted `114 of 172` would be *less* useful, because it is
false the moment this report is committed (**173**), and this unit has now produced six demonstrations
of exactly that.

**The load-bearing claim survives and is still checkable.** Re-derived at HEAD against `checkHub`'s
real predicate (`inLedger || approved`, `:614`), not against any earlier report:

- **9** hubs at `status: complete`. **All 9 pass.** None fails.
- Exactly one — `C2-TIER1` — passes on a review with **no** ledger row, and its review
  (`c2-tier1-closure-review.md`) **is** readable by the shipped predicate.
- Therefore **no `complete` hub depends on an unread verdict.** It held at 13 residual files, at 11,
  and it holds now, because it never was a claim about the residual's size.

That is the right thing to have kept, and it is checkable in a way the count never was.

**The caveat.** Two disclaimers state their own contents: *"NO COUNTS LIVE IN THIS COMMENT"*
(`check-docs-registers.mjs:339`) sits above eight numerals, and *"The row TOTAL is deliberately not
quoted here — it moved 87 → 88 → 89"* (`phase-ledger.md:137`) quotes three totals, the last of which
is the current one and reads as such. Neither asserts a false fact about the world — the numerals in
both are labelled as withdrawn or as movement — but a self-refuting disclaimer is a weak instrument,
and the honest forms are one word longer: *"no LIVE count is stated here; the withdrawn ones are
listed below"* and *"it moved three times during this work"*. MINOR-2, MINOR-3.

---

## 5 · What I tried to break

### 5a · Both widened classes, and the fixtures that now pin them

Run through the shipped `reviewHasApprovedVerdict`. Fixtures written inline on purpose, never as a
heading followed by a verdict line, so this report cannot be read as issuing one.

| Input (heading ⟶ next non-blank line) | Result | |
|---|---|---|
| `## 7. Verdict` ⟶ `**APPROVED**` | accept | intended lead-in widening |
| `## Verdict 2` ⟶ `APPROVED` · `## VERDICT-2` ⟶ `APPROVED` | accept | the trailing widening, **now described and fixtured** |
| `## 7. Prior verdict` ⟶ `APPROVED` · `## r2 verdict` ⟶ `APPROVED` | reject | letters in the lead-in |
| `## Verdict two` ⟶ `APPROVED` | reject | letters in the trailing run — **the paired reject round 3 asked for** |
| `## Verdict` ⟶ `NOT APPROVED` / `CHANGES REQUESTED` | reject | |
| `## Verdict 2` ⟶ `NOT APPROVED` / `CHANGES REQUESTED` | reject | the widening does **not** weaken the verdict line |
| `## 7. Verdict` ⟶ `> **APPROVED**` | reject | blockquote still excluded |

**I could not get a rejection through, and the trailing widening does not change that.** Round 3's
MINOR-1 is fully discharged: `:1703`/`:1705` pin the lead-in class both ways, `:1704`/`:1706` pin the
trailing class both ways, and the comment at `:377-382` now describes both.

### 5b · Shape (d), re-measured on the shipped module

| Input | Accepted? |
|---|---|
| a ```` ```md ```` fenced block containing `## 7. Verdict` and `**APPROVED**` | **true** |
| the same content indented four spaces | **true** |

The register entry's description of shape (d) is **correct in every particular**: `lines[i].trim()`
erases the indent, no arm is fence-aware, and the sibling RETIRED arm in the same script *does*
exclude fenced quotations, so the mechanism exists. Its severity framing is also right — the corpus
is QA reports, and this unit adds four of them.

⚠ Which makes MAJOR-2 below matter more, not less: the shape is filed accurately under a closing
condition that cannot close it.

---

## 6 · Findings

### BLOCKER — the structural repair was scoped to one phrase, and left three live counts standing in the files it was editing, two of them falsified by this unit's own commits

**Where:** `scripts/check-docs-registers.mjs:273` and `:278` · `docs/followups/follow-ups-open.md:1303`.

**Measured** (`git show <sha>:docs/progress/phase-ledger.md`, parsed with escaped-pipe handling):

| Commit | pipe-lines | bolded ids | unbolded ids | data rows |
|---|---|---|---|---|
| `main` (branch base `6810d95b`) | 83 | 29 | 52 | 81 |
| `375726b22` (the comment's own commit) | 83 | 29 | 52 | 81 |
| **`a3b7d136` (HEAD)** | **91** | **42** | **47** | **89** |

So `:273`'s *"29 of phase-ledger.md's 83 pipe-lines already write `| **AE0** | …`"* was **exactly true
when written and is false now**, and the thing that falsified it is this unit's own deliverable —
seven reconstructed rows plus the six re-bolded workaround rows. It is written in the present tense
(*"already write"*), carries no date, and sits **66 lines above** the banner
`⛔⛔ NO COUNTS LIVE IN THIS COMMENT, DELIBERATELY, AND THAT IS THE POINT` at `:339`.

`:278`'s *"⛔ Not fixed by unbolding **76 rows**"* is worse in a different way: it is not stale, it was
**never right**, and this unit is the thing that proved it. The hub says so at
`docs/features/register-gate-hygiene.md:37` — *"⚠ The plan's 'six of 76' is refuted as a statement
about the ledger: it is **81 rows, 52 unbolded, 29 bolded**"*. The refutation was written into the
hub and the same figure was written into the script, unquoted and undated, in the same unit.

`follow-ups-open.md:1303` completes the set: *"`| AE4 |` **currently** sits unbolded alone among 76
rows"*. At HEAD `phase-ledger.md:131` reads `| **AE4** |` — bolded by this unit, which was the whole
point of the follow-up — and 47 rows are unbolded, so the line is false on both halves.

**Why this is the seventh and not pedantry.** The six prior instances were all *"correct in
DIRECTION, unmeasured in MAGNITUDE"*. This one is the same defect at the level above: the **direction**
of fix loop 3 was right (remove the class, state the derivation) and the **population** it applied to
was never derived — it was inherited from the phrase the last round argued about, *"readable/total
ratio"*. That is precisely round 3's MAJOR-2 mechanism (*"the population of copies was not derived —
it was inherited from the phrase 'all three places'"*), re-run one class over. ⛔ And the banner at
`:339` makes it worse than a stray number: a later session reading *"NO COUNTS LIVE IN THIS COMMENT"*
has been told not to look.

**Ask.** Derive the population, do not recall it: `grep -nE '[0-9]+ (of|rows|pipe-lines|files)'` over
every file this branch touched, then for each hit decide **live fact / dated history / withdrawn** and
mark it. Concretely — `:273` becomes *"a majority of `phase-ledger.md`'s rows already write
`| **AE0** | …` (29 of 83 when measured at `375726b22`; re-derive, do not quote)"*; `:278` becomes
*"⛔ Not fixed by unbolding the ledger's rows"*; `follow-ups-open.md:1303` gets the same dated note
the unit gave the plan's figure, in past tense. ⛔ Do **not** simply retype 42-of-91: the Record step
adds a row and it is wrong again.

### MAJOR-1 — `two independent sweeps gave 12 and 13` survives at the exact file:line round 3 named, retracted in one home and asserted in the other

**Where:** `docs/followups/follow-ups-open.md:1002`, the closing clause of
`FUP-REGISTER-GATE-HYGIENE-VERDICT-SHAPES`.

**Measured.** Round 3 MAJOR-4 named four sites and asked for the figure to be replaced *"in all four
places"*. Three were fixed. This one still reads, verbatim at the end of the entry:

> *"⭐ Whatever is done, the **size** of the residual must be reported with the detector that produced
> it: two independent sweeps gave 12 and 13 here and differed in MEMBERSHIP both ways, so a bare
> count is not a fact."*

Meanwhile `docs/progress/register-gate-hygiene.md:312-314` says the same string *"reproduces under
nothing — three detectors at HEAD give 7 / 11 / 14, and the `13` was QA's own **pre-widening** figure,
carried forward without re-deriving"*, and `:629-631` repeats the retraction. **One subject, two
homes, opposite states — in the unit whose deliverable is register consistency.**

⛔ **The line was edited twice since the retraction and survived both.** `694531f4` rewrote the
shape-(a) clause inside this very line; `a3b7d136` appended shape (d) to it. The editor was in the
sentence and did not remove the figure the same commit was retracting elsewhere.

**Why it blocks rather than files.** This clause is the standing rule the entry exists to teach, and
the entry's `Closes when` invites a **PO ruling**. Round 3 blocked on exactly this ground for shape
(a) — *"a ruling made on a false premise is worse than no ruling, because it closes the question"* —
and the fix loop accepted that argument and applied it to (a) while leaving the same defect in the
closing sentence of the same entry. A PO reading this entry today is told the residual is *"12 and
13"*. It is 7, or 11, or 14, depending on the detector, which is the entry's own point.

**Ask.** Either drop the two integers (*"two independent sweeps here disagreed on both the count and
the membership"* is true, is the whole lesson, and needs no number), or keep them with the retraction
the record already carries. ⛔ The irony is load-bearing and should be said in the entry, not only in
the record: this clause is the rule, and it broke the rule.

### MAJOR-2 — shape (d) is filed correctly under a `Closes when` that cannot close it, and it is already satisfied

**Where:** `docs/followups/follow-ups-open.md:1002`.

**Measured.** The clause governing every listed shape is, in full:

> *"**Closes when:** either the remaining shapes are read, or a ruling says they stay unread with the
> reason stated per shape."*

Shapes (a), (b) and (c) are **false negatives** — verdicts that exist and are not read. Both disjuncts
fit them. Shape (d) is the **opposite polarity**: content that **is** read and must not be. I measured
it at HEAD (§5b): a fenced and an indented `## 7. Verdict` ⟶ `**APPROVED**` are **both accepted**.

So for shape (d):

- the first disjunct — *"the remaining shapes are read"* — **is already true**, by the defect itself.
  The closing condition names the case that cannot fail;
- the second — *"a ruling says they stay unread"* — is not a sentence that can be written about it.

⛔ This is not a wording quibble. `Closes when` is the only field gate 13 can see, and the entry
itself calls (d) *"the shape most likely to bite"*. As written, the register's most severe shape is
the one its closing condition discharges for free.

**Ask.** Give (d) its own condition, in the entry, in the polarity it actually has — e.g. *"closes for
(d) when a fenced or indented verdict is REFUSED, proven able to fire on both a fenced and a
4-space-indented fixture, with a discrimination half showing a real verdict still passes"*. The
mechanism already exists in the sibling RETIRED arm, which the entry says.

### MINOR-1 — the hub's `## Current state` is two rounds stale in three of its six sections

**Where:** `docs/features/register-gate-hygiene.md` — `### In progress`, `### Next`, `### Blockers`.

**Measured.** `### In progress` reads *"QA round-2 fix loop (round 1 CHANGES REQUESTED → fixed → round
2 CHANGES REQUESTED, 2 MAJOR + 5 MINOR, all addressed)"*. `### Next` reads *"1. QA re-review round
3."*. `### Blockers` reads *"`LEDGER-COMPLETENESS` stays `in_progress` … until round 3 lands"*. Round 3
landed at `eec50295`+`694531f4` with **5 MAJOR + 5 MINOR**, and two fix loops have shipped since.
`### Done since start` **was** updated (it carries the "SIX claims" line), so the staleness is
sectional, not wholesale.

Per CLAUDE.md §7 the hub's `## Current state` is the unit's **summary** — the thing a later session
reads instead of the 676-line record. It currently reports a state two rounds behind and names a
completed event as the next step.

### MINOR-2 — `⛔⛔ NO COUNTS LIVE IN THIS COMMENT` is false as written, and its enumeration does not sum

**Where:** `scripts/check-docs-registers.mjs:339-348`.

The banner is immediately followed by `six`, `14`, `20`, `23`, `9 + 10 + 1`, `114-of-169`, `171` and
`three`. All are withdrawn history or method, so **no false fact about the world is asserted** — but
the sentence is absolute and self-refuting, and it is the sentence a later session will cite when
deciding whether it may add a number here. Separately, *"through **six** revisions … — 14, then 20,
then 23, then `9 + 10 + 1`, then 114-of-169 —"* enumerates **five** for a claimed six; a census whose
parts do not sum is the batch's own lesson.

**Ask.** *"NO LIVE COUNT IS STATED HERE — the numerals below are the withdrawn ones"*, and either name
the sixth revision or drop the cardinal.

### MINOR-3 — the `LEDGER-COMPLETENESS` row's disclaimer quotes the total it says it does not quote

**Where:** `docs/progress/phase-ledger.md:137` — *"⛔ The row TOTAL is deliberately not quoted here —
it moved 87 → 88 → 89 during this work"*. The last member of the sequence **is** the current total
(I measured 89), so the sentence hands the reader the number it declines to state, in the position
where it reads as current. The pointer that follows (*"`npm run lint:registers` prints it"*) is right
and sufficient on its own.

### MINOR-4 — `docs/features/ledger-completeness.md:56` states a row total that the Record step may falsify the same day

*"Ledger now **89 rows**, every one 9 cells"* is **true at HEAD** (measured: 89 data rows, zero off 9
cells). It becomes false the moment `REGISTER-GATE-HYGIENE` receives a ledger row — which is one of
the two ways its own hub can reach `complete` (§7). Not a defect today; flagged because the Record
step is the event that decides it, and because *"every one 9 cells"* is the durable half of that
sentence while *"89 rows"* is the perishable half. ⚠ This is the **hub**, not
`docs/progress/ledger-completeness.md`, which the PO ruled is left verbatim.

---

## 7 · INFO

**INFO-1 — the bare-heading arm still changes no gate outcome today.** Re-derived at HEAD: 9
`complete` hubs, all pass; `C2-TIER1` is the only one passing without a ledger row, on a readable
review. Correct by design — a widening for future hubs — and restated because *"a check with zero
live subjects"* is a phrase this batch had to write about gate 13's branch check.

**INFO-2 — `>` and `~` are excluded on the verdict line but never in the heading lead-in.**
`## >Verdict` and `## ~~Verdict~~` followed by an approval are accepted. **Pre-existing**, contrived,
no live file hits it. Unchanged from round 3; not asked for.

**INFO-3 — the any-match property is unchanged and still safe on today's corpus.** Re-checked the two
files that could invert (`dm5-phase-review.md`, `user-registration-review.md`); neither does.

**INFO-4 — this report is the fourth QA report this unit adds to the corpus the predicate scans**
(172 tracked at HEAD, 173 once this lands). Every verdict fixture quoted above is either inline in a
table cell or blockquoted, so the shipped predicate reads this file as **not approved**, which is
correct. ⛔ That is a property I had to arrange deliberately — which is shape (d)'s point.

---

## 8 · The Record-step list, checked against the tree as it stands

| Step | Status now |
|---|---|
| rewrite the `DSR` row's cell 3 | **owed and still pending** — `phase-ledger.md:119` still carries `⛔ **PO: strike this row if that reading is wrong.**`. Per the standing bound I do not rule on retention; the cell's *content* is accurate and the PO ratified the row on 2026-09-08 on procedural grounds, but the self-strike clause the ruling directed be replaced is still in the file. Real work, not a formality |
| close the five follow-ups on their own quoted clauses | **blocked in part** — all six ids are present and `Status: open` (measured). ⛔ `FUP-REGISTER-GATE-HYGIENE-VERDICT-SHAPES` is not among the five being closed, but its `Closes when` cannot bind shape (d) (MAJOR-2), so the entry that carries this unit's residual is not yet a usable instruction |
| flip `FUP-AE2`'s status | **fine** — both clauses are discharged in the entry's own text |
| hub → `complete` | **conditional, unchanged from round 3** — measured: `REGISTER-GATE-HYGIENE` has `inLedger=false` (zero occurrences in `phase-ledger.md`) and `reviews: []`. `checkHub` needs `inLedger \|\| approved`. ⛔ Linking **this** report satisfies neither, so the hub needs a ledger row of its own — which makes the ledger 90 rows and falsifies `docs/features/ledger-completeness.md:56` (MINOR-4). Fixing that line in the same commit is the cheap resolution |
| `LEDGER-COMPLETENESS` hub → `complete` | **fine** — `inLedger=true`, so it passes without a review, and its `in_progress` branch check stops applying, which is what lets `claude/zen-vaughan-7dcae2` be deleted |
| `git merge --ff-only` | **possible** — `git merge-base --is-ancestor main HEAD` rc 0 |

⛔ Sentences on that list that **would be false the moment they are written**, at the tree as it
stands: any claim that the unit's numeric residue is consistent across its homes (BLOCKER); any claim
that the `12 and 13` retraction was applied everywhere (MAJOR-1); and `ledger-completeness.md:56`'s
row total, if the hub takes the ledger-row path (MINOR-4).

---

## 9 · What I could NOT verify — work items, not footnotes

None is a finding; all are gaps in **my** coverage, for the lead to discharge or accept explicitly.

1. **`test:db` and the four authz arms at `a3b7d136`** — carried forward from my round-2 runs at
   `26bc53a6`, on the derived ground that the only non-doc file changed since is
   `scripts/check-docs-registers.mjs` (whose arms run inside `npm run lint`, rc 0) and that the
   `migrations`/`seed`/`src` diff against `main` is empty. Derived, not assumed; stated so it can be
   rejected.
2. **`ARM=policy` FULL SWEEP** (~105 min) — not run, unchanged across all four rounds.
3. **Platform asymmetry** — gate 13's argv branch check and gate 9's case-exact `exists` exercised on
   Windows only.
4. **`LEDGER-COMPLETENESS`'s completeness derivation** — still audited as *output* only, four rounds
   running. Its QA cell says so itself, which is the right resolution, but nobody has certified that
   the six reconstructed rows are the **right** six. If the PO wants that certified rather than
   bounded, the unit's id-normalisation artifact has to be handed to QA.
5. **My count of "counts" in §2 is a grep over one pattern family.** I swept
   `[0-9]+ (of|rows|pipe-lines|files)` and read the hits in the branch's own files; a count phrased
   another way (a bare cardinal in prose, a percentage) would not be in my net. The **ask** in the
   BLOCKER is therefore stated as a method, not as my list.
6. **I did not measure what a fence-aware fix for shape (d) would cost** — MAJOR-2 asks for a closing
   condition, not for the fix.

---

## 10 · Summary — and the honest answer

**The code is done and I could not break it.** The predicate survived 17 constructed inputs across
both widened classes, both polarities; the shipped fixtures now pin both classes on both sides; the
load-bearing claim — *no `complete` hub depends on an unread verdict* — I re-derived from
`checkHub`'s real predicate at HEAD and it holds, on 9 complete hubs, with the one review-only hub
resting on a readable review. `lint` rc 0 / `typecheck` rc 0 / `test` rc 0 (151 files, 2,056), gate 13
at 89 rows with no ratchet risen, ledger independently parsed at 89 × 9. Round 3's ten items are ten
for ten in the sense each was *attempted seriously*, and eight are met outright — including the two
hardest, where the response was to remove the class rather than to correct the number again. That was
the right instinct and it should be said plainly.

**And the artifacts still carry a defect a later session would act on**, which is the question the
brief asked and the only reason this is not an approval:

- A comment in the gate's own source tells a future reader the ledger has **83 pipe-lines, 29 bolded**
  — it has 91 and 42, falsified by this unit's own commits — under a banner announcing that no counts
  live there. The next session sizing a decision about ledger formatting reads that line.
- The register entry the PO will rule from hands the ruling the number *"12 and 13"* that this unit's
  own record retracts two files away, in the sentence whose subject is that you must not do that.
- The shape that entry calls *"most likely to bite"* is filed under a closing condition that is
  already satisfied by the bug.
- The hub's summary says the unit is awaiting round 3.

⛔ None of that is polish, and none of it is code. All four are one-line edits in files already open,
and I would expect the whole loop to take under thirty minutes. **The unit is one edit-pass from
shippable** — I am not asking for a redesign, a widening, a new gate, or a re-run of anything. I am
asking for the sweep the fix loop declared and scoped to one phrase, run over the population instead:
`grep -nE '[0-9]+ (of|rows|pipe-lines|files)'` across the branch's own files, each hit marked live /
dated / withdrawn.

⭐ The seventh instance is worth one sentence in the record, because it is the first one that is *not*
inside the previous correction — it is beside it. Six times the number was corrected and the
correction was wrong. The seventh time the number was **removed**, correctly, and the removal was
applied to the phrase the argument had been about rather than to the class. That is the same defect
promoted one level: **direction right, population unmeasured.** A rule that says *derive, never quote*
is only as good as the grep that finds every quote.

**Verdict: CHANGES REQUESTED**
