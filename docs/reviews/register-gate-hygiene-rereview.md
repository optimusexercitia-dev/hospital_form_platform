# REGISTER-GATE-HYGIENE — QA re-review (pre-AE5 Batch 6), round 2

**Reviewer:** `qa` · **Date:** 2026-09-08 · **Head reviewed:** `26bc53a6` (branch
`authz-register-gate-hygiene`; working tree clean at start and end except my own untracked
round-1 report — which turns out to matter, see MINOR-1)
**Round 1:** [register-gate-hygiene-review.md](register-gate-hygiene-review.md) — CHANGES
REQUESTED on 2 MAJOR + 5 MINOR.
**Round:** 2

## Verdict: **CHANGES REQUESTED**

Both round-1 MAJORs and all five MINORs are addressed, and I reproduced every fix by
measurement rather than by reading the fix text. The round-1 §7 "could not verify" list is
now **closed**: I ran `test:db`, the four authz arms, `SELFTEST=1`, `lint`, `typecheck` and
`test` myself, all rc 0 read bare.

What blocks is, again, **inside the previous round's fix text** — and it is the same shape a
third time. The corrected residual bound (`9` words-on-the-label-line + `10` fixed + `1`
blockquote = 20) was **reconciled against my round-1 figure instead of re-derived**. I derived
it: the residual is **≥ 13 in ≥ 3 shapes**, not 10 in 2, and the fix text's own corroboration
sentence — *"QA's independent measurement of 10 and the lead's tightened re-measurement agree
exactly"* — is a cardinal coincidence between two hand-shaped detectors whose **sets differ by
two members in each direction** (MAJOR-1). Separately, in the new scope: three of the seven
reconstructed ledger rows assert a **Human ✓ / PO approval that the source they cite does not
record**, and one of those sources actively lists that approval as still pending (MAJOR-2).

Both are documentation edits. ⛔ **Nothing here needs a DB reset, an E2E run, or a re-run of
any gate.** Everything in §1–§2 stands for round 3.

---

## 0 · Method, so it cannot be inferred wrong

Every mutation below was applied to a **copy** outside the repo, verified **present in the
file** by a literal `grep -F` on the replacement text *before* the run, and its exit code read
**bare** — no pipe, no `;`-chained consumer. Where a mutation needed my instrument changed as
well (the selftest copy's `ROOT`), I ran an **unmutated control through the same instrument**
first and report both. The repo tree was never written to: `git status --porcelain` at the end
shows only my two review reports.

⚠ One of my own commands this session reproduced the batch's warning live: `node … | head -90`
reported `BARE RC=0` from `head`, not from `node`, on a run that had actually thrown. Every rc
quoted below was re-taken without a pipe.

---

## 1 · The round-1 items, re-measured

| Round-1 item | My measurement at `26bc53a6` | Verdict |
|---|---|---|
| **MAJOR-1** — false residual figure/mechanism corrected in three places | corrected in `check-docs-registers.mjs:342-357`, `docs/lint-gates.md:29`, `docs/progress/register-gate-hygiene.md:295-305`; the 10 bare-heading files **fixed, not re-filed** | ⚠ **partially** — see MAJOR-1 and MINOR-2 |
| the bare-heading arm's safety argument (*the heading must be BARE*) | **verified by construction, not accepted**: 14 adversarial inputs, §2a | ✅ the argument holds |
| readable reviews **112** | **112** — 82 by the single-line arm only, 20 by both, 10 by the bare arm only, 58 unreadable; parts sum to 170 files on disk | ✅ numerator exact |
| …**of 170** | **169 tracked** `.md` in `docs/reviews/`; the 170th on disk is my own **untracked** round-1 report | ⚠ MINOR-1 |
| **MAJOR-2** — `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE`'s `Closes when` carries the PO ruling | replaced (not annotated) at `docs/followups/follow-ups-open.md:995`; ratchet `closesWhenPoToRule` **136/147** (was 137) | ✅ |
| …and no other entry moved | independent id-level join across `main` / `46e58bba` / HEAD: **exactly one** id left the count (`FUP-ADR-CROSS-LINKS-HAVE-NO-GATE`), **zero** entered, zero moved between `main` and `46e58bba` | ✅ derived, not eyeballed |
| **MINOR-1** — gate 9 header says **9** files | `git diff --name-only main...HEAD -- docs/decisions/` gives exactly `0053 0056 0063 0064 0072 0073 0078 0105 0191` as link repairs; 0078's changed link **targets** are `0037 0041 0051 0061 0065` = **five of the fourteen** (`0071` rode along on a rewrapped line, unchanged) | ✅ both the 9 and the 5 are right |
| **MINOR-2** — gate 11's CRLF detection wired to an assertion | `readRuleText()` extracted; the **identical severing** I ran in round 1 now exits **2** | ✅ see §2b |
| **MINOR-3** — `door-sweep-selftest.sh`'s dead FAIL branch | mutant exits **1**, `harness not found`, group `scenarios 7 (pass 6 · fail 1 · skipped 0)`; unmutated control through the same instrument exits **0**, group `8 (pass 8 · fail 0)` | ✅ see §2c |
| **MINOR-4** — ADR 0194 attribution | corrected at `docs/progress/register-gate-hygiene.md:205-213`, including the ⭐ half I asked for (*both named homes now DO host the fix*) | ⚠ record fixed, **hub not** — MINOR-4 below |
| **MINOR-5** — `LEDGER-COMPLETENESS` disposition | ruled in §7 | — |
| the `pathToFileURL(process.argv[1])` import crash | `check-docs-registers.mjs:2382` now guards; I import the module directly in three instruments this session, which is the proof | ✅ |

### 1a · Round-1 §7 — the "could not verify" list, now closed

| §7 item | Run bare by me | Result |
|---|---|---|
| 1. `npm run test:db` | ✅ | **rc 0** — `Files=262, Tests=8882`, `Result: PASS`. Exactly the record's figure. ⚠ Run on the lead's existing stack, not a reset of my own (forbidden to me); the batch changes no migration and no `src/` file. |
| 2. `ARM=census` | ✅ | **rc 0**, `INVARIANT HOLDS` — live authz gates **581**, gates carrying a verdict **608**, extension-owned excluded **0** |
| 2. `ARM=hat` | ✅ | **rc 0**, `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` |
| 2. `ARM=floor` | ✅ | **rc 0** — 63 authenticated-reachable never-called doors, every one on the floor allowlist, every allowlist entry resolving to a live door |
| 2. `FROMFINDINGS=1 ARM=wrapper` | ✅ | **rc 0**, mode FROMFINDINGS, **BLIND set 41**, all allowlisted |
| 5–6. platform asymmetry (gate 13 branch check, gate 9 case-exactness) | ❌ still Windows-only | carried to §8 |
| 3. `ARM=policy` FULL SWEEP | ❌ not run (~105 min) | carried to §8 |
| 4. the six non-AE2 ledger rows' **contents** | ✅ | §6 — and it produced MAJOR-2 |

⭐ Item 2 mattered more than usual because this batch edited the arms' entry point
(`p0-authz-invariant.sh`). All four arms hold at the tip, run by someone who is not the builder.

`npm run lint` **rc 0** (0 errors / 0 warnings, all thirteen gates, eslint present),
`npm run typecheck` **rc 0**, `npm run test` **rc 0** (151 files / 2,056 tests). Ratchets at the
tip: `closesWhenPoToRule=136/147 severityPerEmoji=127/135 severityUnrated=29/29
revisitWhenPoToRule=38/38 longHeadings=97/97 bugsUntriaged=10/10 bugsUnrated=40/40
lessonsProseOnly=52/52 archiveMissingClosesWhen=121/121` — none above cap, one lowered.

---

## 2 · What I broke, and what refused to break

### 2a · The bare-heading arm — I tried to get a non-approval through it

`reviewHasApprovedVerdict` (`scripts/check-docs-registers.mjs:359-370`) with
`VERDICT_BARE_HEADING_RX` / `VERDICT_LINE_APPROVED_RX`. 18 constructed inputs, run against the
shipped module:

| Input | Result |
|---|---|
| `Prior verdict: APPROVED` | **reject** — the stated safety argument, confirmed |
| `## r2 verdict: APPROVED` | **reject** — words on the heading line |
| `## Prior verdict` ⟶ `APPROVED` | **reject** |
| `## Verdict` ⟶ `> **APPROVED**` / `~~APPROVED~~` | **reject** (both) |
| `## Verdict` ⟶ `# ⛔ NOT APPROVED` / `CHANGES REQUESTED` | **reject** (both) |
| `## Verdict` ⟶ a table row starting `\| Round \| Verdict \|` | **reject** |
| `## Verdict` ⟶ `APPROVEDish` | **reject** (the `\b` holds) |
| `> ## Verdict` ⟶ `> **APPROVED**` (blockquoted heading) | **reject** |
| `## Verdict` ⟶ prose ⟶ `APPROVED` (not the next non-blank line) | **reject** |
| `## 7. Verdict` ⟶ `**APPROVED.**` | **reject** — a digit in the lead-in blocks it (this is a live file, see MAJOR-1) |
| `## Verdict` / `## Verdict:` / `### ⭐ Verdict` ⟶ `APPROVED`, any number of blank lines | **accept** (correct) |

**The safety argument is real and I could not defeat it on the decoration axis.** The heading
must genuinely be bare; `NOT`/`CHANGES REQUESTED` stay letters and no decoration spans them;
`>`/`~` stay excluded on the verdict line as well as the heading line.

Two inputs **do** get through, both on an axis the argument does not address — see INFO-1.

### 2b · Gate 11 (`check-rules-staleness.mjs`), both polarities

| Mutation (verified present in the copy) | Bare rc | Named |
|---|---|---|
| `readRuleText`'s `const crlf = /\r\n/.test(raw)` → `false` — **byte-identical to my round-1 severing, which exited 0** | **2** | `readRuleText-detects-crlf`, `readRuleText-normalises-crlf`, `readRuleText-byte-cap-still-sees-line-endings` |
| the opposite polarity: `return { crlf: true, … }` (stuck-on detector) | **2** | `readRuleText-does-not-cry-crlf-on-lf` |
| shipped file, unmutated | **0** | `self-test OK (all checkers proven able to fail)` |

The "five arms" claim is accurate and, more to the point, **two-sided**: the sever fires three,
the stuck-true fires the discrimination arm. This is the right shape for a detector fix.

### 2c · `door-sweep-selftest.sh` — the FAIL branch is reachable

I could not rename a repo file (read-only), so I ran a copy with `ROOT` pinned to the repo and
one harness path renamed. **Both mutations verified present**; the ROOT pin was validated first
by a control:

| Run | Bare rc | Group line |
|---|---|---|
| shipped `scripts/door-sweep-selftest.sh` | **0** | `deriver 16 · merge helper 18 · audit startup capture 8` · `SELF-TEST: PASS 42 · FAIL 0 · SKIPPED 0` |
| control copy (ROOT pinned only) | **0** | `audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)` — my instrument is inert |
| mutant (ROOT pinned + `ROW_AUDIT` renamed) | **1** | `FAIL zz-qa-renamed-rowdoor-audit.sh  harness not found at …` · `scenarios 7 (pass 6 · fail 1 · skipped 0)` · `⛔ FAILED: missing:zz-qa-renamed-rowdoor-audit.sh` |

⭐ The group total still **shrinks** (8 → 7) when a harness disappears, but it now shrinks
**loudly**, which is the whole point. Exactly the claimed result, reproduced rather than quoted.

---

## 3 · MAJOR findings

### MAJOR-1 — the corrected residual bound is still wrong, and its corroboration sentence is a cardinal coincidence

**Where:** `scripts/check-docs-registers.mjs:342-352` · `docs/lint-gates.md:29` ·
`docs/progress/register-gate-hygiene.md:295-305` (the identical text in all three).

**The claim.** *"The residual is TWO shapes … **9** put words on the label line … **10** were a
BARE `## Verdict` heading … **1** is a blockquoted verdict, excluded on purpose."* And in the
record: *"⭐ QA's independent measurement of 10 and the lead's tightened re-measurement agree
exactly."*

**My derivation.** Method, so you can re-run it rather than copy my list: take every
`docs/reviews/*.md` for which `reviewHasApprovedVerdict` is **false** (58 on disk, 57 tracked) —
that superset is mechanical; then take every line in those files matching `/\bAPPROVED\b/i` —
also mechanical; then classify each file by hand. Three nets, widening each time, converge on:

**Genuinely-approved reviews still unreadable at HEAD: 13, in three shapes.**

*Class A — words or tokens on the label line (the shape the note names): 9*
`authz-ae3-review.md:746` `## Round 4 verdict` → `:757` · `authz-m1-review.md:507`
`# RE-VERDICT: ✅ **APPROVED**` · `case-surface-split-increment-2-review.md:373`
`**r2 verdict: APPROVED**` · `eth-e4-review.md:920` `# VERDICT (r3): **APPROVED**` ·
`f-cleanup-review.md:15` `## TOP-LINE VERDICT: ✅ APPROVED` · `memberships-collapse-review.md:3` ·
`phase-17-review.md:3` · `phase-FF-1-review.md:15` `# ✅ r2 VERDICT: APPROVED` ·
`user-registration-review.md:45`.

*Class B — a heading + a LINE BOUNDARY, which is what the fix was for: **3**, and the note counts
none of them*
- `adr-0136-deferred-signoff-review.md:131` — `## 7. Verdict` → `:133` `**APPROVED.**`. The
  verdict **is** on the next non-blank line. The only thing blocking it is the `7.`: `\p{N}` is
  excluded from `VERDICT_BARE_HEADING_RX`'s lead-in. ⛔ *"They put words on the label line"* is
  false of this file, and so is the rationale that follows from it — admitting a numbered heading
  readmits a digit, not `Prior verdict: APPROVED`.
- `dm5-s6-review.md:7` — bare `## Verdict`, then `:9` `**r1: ⛔ CHANGES REQUESTED**`, then `:11`
  `**r2: ✅ APPROVED**`. The arm reaches the heading and stops one line short of the operative
  verdict.
- `min-audio-minutes-review.md:526` — bare `## Verdict`, a prose paragraph, `---`, then `:535`
  `**APPROVED**`.

*Class C — deliberate: 1* — `dm5-s5-review-r2.md:3`, blockquoted.

9 + 3 + 1 = **13** remaining; + the 10 fixed = **23** genuinely-approved-but-unreadable before
this fix. ⭐ **23 is one of the three numbers the commit message itself names** (*"14 / 20 / 23 by
three definitions"*) — and the fix adopted **20**, which is my round-1 figure, not a derivation.

**And the membership does not agree.** The 10 files the bare arm actually fixed are `aff-review`,
`authz-gate-2-review`, `dm5-phase-review`, `ff-2-review-r2`, `phase-14-review`, `phase-16-review`,
`phase-AI-review`, `phase-p3-review`, `pre-pilot-hardening-wave1-review`,
`referral-detail-redesign-review`. My round-1 class B named `adr-0136` and `phase-17` (neither is
fixed) and did **not** name `authz-gate-2` or `phase-AI` (both are). Two in, two out; the
cardinality survived and the set did not. *"Agree exactly"* is therefore a claim nobody checked —
two undercounts landing on the same integer, read as corroboration.

**Why this blocks.** Not because 13 ≠ 10 — because it is the **third consecutive round** in which
this unit's own headline claim is correct in direction and unmeasured in magnitude, and because
the corrected text now asserts *"a bound is a claim about a population, so it has to be measured
per shape"* immediately above a bound that was reconciled rather than measured. It sits in
`docs/lint-gates.md`, the file a future session reads to size this decision.

**What is NOT wrong, and should be kept.** I re-verified the load-bearing sentence against
`checkHub`'s real predicate (`:614`, `inLedger || approved`): there are **9** `complete` hubs,
every one passes, and **none of the 13** is linked from any of them. *"No `complete` hub depends
on any remaining one"* stays **true at 13**. The gate is not unsafe; the bound is not true.

**Ask** (one documentation pass, no re-runs):
- (a) Restate the residual as a **measured set with its shapes**, parts summing, in all three
  places. Give the method, not the list, so the next session re-derives instead of copying.
- (b) Delete or qualify *"QA's independent measurement of 10 and the lead's tightened
  re-measurement agree exactly."* The honest sentence is that both landed on 10 and the sets
  differ by two each way — which is itself the more useful lesson.
- (c) State whether class B's 3 are being fixed or filed. ⛔ I am **not** asking for a widening.
  If you take one, `adr-0136`'s numbered heading is the cheap, safe half (a digit in the heading
  lead-in cannot readmit an inline `Prior verdict:`), and it needs its own rejection fixtures.

### MAJOR-2 — three reconstructed ledger rows assert a human/PO approval their cited source does not record

**Where:** `docs/progress/phase-ledger.md` — `QO·FUP` (line 112), `DOCS-RESTRUCTURE` (129),
`DOCS-CONSOLIDATION` (130), **Human ✓** column.

Each of the seven reconstructed rows carries an explicit discipline: *"⛔ Every figure below is
COPIED from those artifacts — none was re-run"* / *"read it as a citation, never as a fresh gate
result"*. I checked every cell against the source each row names (§6). Every gate figure, every
migration id, every QA verdict and every commit is a genuine transcription. **Three Human ✓ cells
are not:**

| Row | Cell | What the cited source actually says |
|---|---|---|
| `QO·FUP` | `✅ 2026-08-07` | `docs/progress/qo-fup-close-out.md` has **no** human/PO approval statement. `2026-08-07` appears as the QA `APPROVED (r2)` date and as *"PO rulings 2026-08-07 (asked before work started)"* — rulings **before** the work, not an approval after it. |
| `DOCS-RESTRUCTURE` | `✅ PO-approved 2026-09-03` | `docs/progress/docs-restructure.md:107` says only *"Commit C (`159b9f26`, **PO-approved CLAUDE.md diff**, full chain exit 0)"* — approval of one diff, not of the unit. |
| `DOCS-CONSOLIDATION` | `✅ PO-approved 2026-09-03` | `docs/progress/docs-consolidation.md` contains **zero** occurrences of PO-approval for the unit, and its own final Current state (same date) lists under **`Next:`** *"the PO's merge of this branch into `main`"* — i.e. the source names that approval as **pending**. |

Contrast the four rows that are clean: `AI` cites `ai-satellites.md:63` `| Human | ✅ Approved
2026-07-14 …|`; `CS·1` cites *"PO approved 2026-08-21 and merged to main"*; `DSR` cites
*"§6 steps 1–5 complete, PO-approved, merged"*; `AE2` cites `2026-Q3.md` § 2026-08-29
*"(PO-approved that day)"*. Those are transcriptions. The three above are **inferences wearing a
transcription's label** — in the column that records Phase Gate step 4.

I have no reason to doubt the underlying fact: all three units are on `main` (`38b4f3a7`,
`898cb0ab`, `396352cb`, all ancestors of `main`), and in this project a merge follows PO
approval. That is exactly why it is cheap to fix and why leaving it is corrosive: the row would
be right for a reason it does not give.

**Ask:** for those three cells, either cite the evidence that exists (the merge commit; for
`DOCS-CONSOLIDATION`, whatever artifact records the PO's merge) or mark the cell **inferred from
the merge, not transcribed** in the row's own idiom. ⛔ Do not simply delete the ⛔ discipline
line — the discipline is the row's best feature.

---

## 4 · MINOR findings

**MINOR-1 — `112 of 170` was measured on a dirty tree; at the commit the denominator is 169.**
`docs/lint-gates.md:29`, `docs/progress/register-gate-hygiene.md:302`,
`scripts/check-docs-registers.mjs:353`. Measured: `git ls-files 'docs/reviews/*.md'` → **169**;
`ls docs/reviews/*.md` → **170**. The extra file is `docs/reviews/register-gate-hygiene-review.md`
— my own round-1 report, **untracked** at the time of measurement and still untracked. The same
paragraph in the record reads *"65 of 169 … 102 of 169 … 102 → 112 of **170**"*: the denominator
moved by one inside one passage and nobody saw it. The numerator **112** is exact and reproduces.
⭐ This is `a-gate-red-can-be-your-working-tree-not-the-repo` in the positive direction: a claim
about "the docs" is a claim about a **commit**.

**MINOR-2 — the hub was not included in "all three places", and now disagrees with the other
three.** `docs/features/register-gate-hygiene.md:93` still reads *"readable reviews **65 → 102**
of 169"*, and `:99-101` still reads *"**Three** of this unit's own repairs first shipped correct
in DIRECTION and unmeasured in MAGNITUDE"* — the round-1 finding made it four, which the record
and `lint-gates.md` both now say. The hub is the unit's **summary** (CLAUDE.md §7) and carries
`Updated: 2026-09-08`, so it asserts a currency it does not have. The population of copies was
inherited from my round-1 list of three rather than derived; I derived it — `65 → 102` survives in
exactly one more place, and it is the most-read one.

**MINOR-3 — the hub still states the superseded "two homes that cannot host the fix" framing.**
`docs/features/register-gate-hygiene.md:57-59`. The record now carries the correction I asked for
(*"after this batch **both** named homes DO host the fix"*, `:211-213`), but the hub's deliverable
bullet does not, and the record's own §*"⛔ The close condition names two homes that cannot host
the fix"* at `:172-182` still stands unqualified 33 lines above its own correction. A later
session reading the hub sees a shipped deviation that did not ship.

**MINOR-4 — the fix loop left no `## Session log` entry.** `docs/progress/register-gate-hygiene.md`
has four dated entries (`:24`, `:272`, `:470`, `:540`); `26bc53a6` added none — it annotated the
earlier entries in place, which is right for corrections, but the fix session's **own** witnesses
live only in the commit message: the three mutations that returned meaningless results (one ran an
unmutated file, one died at *"fixtures not found"* before reaching the branch, one was a shell-
escaping no-op), the first MAJOR-2 attempt that **quoted** the placeholder and so kept its subject
inside the ratchet at 137, and the `pathToFileURL` import crash that cost two attempts. Per
CLAUDE.md §7 a witness goes to the record; a commit body is not the record. These are the most
instructive dead ends this batch produced and they are one `git log` rewrite away from being lost.

**MINOR-5 — `docs/features/ledger-completeness.md` contradicts itself on the row count.** `:50`
says *"Ledger now: **87 rows**"*, `:64` says *"88 rows, all 9 cells"*. Gate 13 prints **88**. The
first is a mid-session figure left standing beside the final one.

---

## 5 · INFO

**INFO-1 — the verdict predicate has no fence/indent awareness, on either arm.** Measured on the
shipped module: a ```` ```md ```` fenced block containing a bare `## Verdict` and `**APPROVED**` is
**accepted**, as is a 4-space-indented copy of the same (`lines[i].trim()` erases the indent). The
single-line arm has the identical blindness (`**Verdict: APPROVED**` inside a fence also matches),
so this is **pre-existing, not introduced** — but the new arm shortens the quotable shape to two
lines, and the corpus this predicate is applied to is *QA review reports*, which are the documents
most likely to quote verdict fixtures. This report and my round-1 one both quote such text; I
checked, and neither is readable as APPROVED, because I kept the quotes inline. That is a
discipline, not a gate. Sibling arms in this same script already exclude fenced quotations (the
RETIRED arm does), so the mechanism exists. Filing-grade, not blocking.

**INFO-2 — the bare-heading arm changes no gate outcome today.** None of the 10 newly-readable
files is linked from any of the 9 `complete` hubs, and every `complete` hub already passed before
the widening. Its 12 fixtures are currently its only proof of life. That is correct by design — it
is a widening for future hubs — but it should be said, because *"a check with zero live subjects"*
is a phrase this very batch had to write about gate 13's branch check.

**INFO-3 — `dm5-phase-review.md` is the case that could have gone wrong and didn't.** It carries
`## VERDICT — ⛔ CHANGES REQUESTED` at `:6` and a bare `## Verdict` → `**✅ APPROVED.**` at `:484`,
and the arm returns the r2 answer, which is right. `user-registration-review.md` is the mirror
image (approved overall, with an original-round `## Verdict` → `**CHANGES REQUESTED**` appended
below) and the arm returns **false** — a false negative, the safe direction. Note the general
property, unchanged by this batch: the predicate is **any-match over the whole document**, so a
review whose *last* round rejects after an earlier round approved would read as APPROVED. No such
file exists in the corpus today; I checked all 30 bare-heading sites.

**INFO-4 — my own round-1 partition was imprecise, and I say so here rather than quietly.** Round
1 reported "20, in three shapes" over *occurrences*, counted `adr-0136` and `phase-17` as class B
when their headings are numbered, and missed `authz-ae3`, `dm5-s6`, `min-audio-minutes` and
`user-registration` entirely. The correct total before the fix is **23 files**. MAJOR-1 is not
"the lead disagreed with me"; it is "we both under-counted, agreed on the integer, and the fix
text recorded the agreement as corroboration."

---

## 6 · NEW SCOPE — the seven reconstructed ledger rows, cell by cell

Sources joined: each row's own named record + review + commit. Independent of the rows' text.

**Commits — all seven verified** (hash resolves, subject matches the cell, date matches the
`Completed` cell, ancestor of `main`):
`b0387d31` `phase(ai): complete` 2026-07-14 · `38b4f3a7` `phase(QO·FUP): complete … (Record-step
rotation)` 2026-08-07 · `0ab4b2da` `phase(case-split-1): complete` 2026-08-21 · `96a46231`
`phase(DSR): complete` 2026-08-20 · `898cb0ab` `docs(record): DOCS-RESTRUCTURE complete`
2026-09-03 · `396352cb` `docs(consolidation): Record — review APPROVED` 2026-09-03 · `28d90212`
`phase(AE2): complete` + `50df9ec2` (the column drop) 2026-08-28. The two `DOCS-*` rows correctly
state they have **no** `phase(x): complete` commit and name their Record commit instead.

**QA cells — all seven verified against the reviews' actual verdict lines:**
`AI` APPROVED · `QO·FUP` r1 CHANGES REQUESTED → **r2 APPROVED** (`qo-fup-review.md:6`, `:279`) ·
`CS·1` r1 + r2 CHANGES REQUESTED → **r3 APPROVED** (`:17`, `:427`, `:797`) · `DSR` slice 3
CR → APPROVED, slice 4 CR → CR → APPROVED · `DOCS-RESTRUCTURE` APPROVED ·
`DOCS-CONSOLIDATION` APPROVED · `AE2` r1 + r2 CHANGES REQUESTED → **r3 APPROVED**. Every "r1 was
CHANGES REQUESTED" qualifier the rows volunteer is true.

⭐ `DSR`'s hardest cell is right: *"Slice 2 had **NO** QA review at all"* — `docs/reviews/` contains
`dsr-slice-3-review.md`, `dsr-slice-4-review.md`, `dsr-remediation-review.md` and **no slice-2
review**, and `dsr-program.md:46-47` says so in its own words. A reconstruction that surfaces a
missing review instead of smoothing it is the behaviour to keep.

**Gate/figure cells** — spot-checked against the named records and found verbatim: `AI`'s
369/369, `227` 70/70, `226` 69/69 (+17 BE-6·N), 2412, 9/9 ×2, 655p/29f/9flaky · `QO·FUP`'s two
migrations and "all 1019 collected tests accounted green" and the `FUP-QO-6` NOT-REPRODUCED-under-
load result · `CS·1`'s `e7ec7529`-not-`ea89aeb0` reading **and** the record's own withdrawal of
the false 18:14 "lint 8/8" · `DSR`'s five migration ranges, 1448, `348`/`349`/`350` (15/53/75),
6678/6678, 4 specs (37), four ARMs · `DOCS-CONSOLIDATION`'s "11 of 74 gate-13 checks had zero
subjects" and thirteen-gate exit 0.

**⛔ The AE2 warning is ACCURATE.** The row's *"Do NOT read the task table in that record"* checks
out: `docs/progress/authz-ae2.md:25` still shows `**AE2.4** — drop the column | 🔜` and `:19` shows
`**AE2.3b** … | 🟡 **PARTIAL**`, both overtaken by `50df9ec2`; and the outcome does live where the
row sends you, `docs/progress/2026-Q3.md:499` § *"Rotated from PROGRESS.md § Now 2026-08-29"*,
which also carries AE2's Human-approval evidence (*"PO-approved that day"*).

**The one defect is MAJOR-2** — three Human ✓ cells. Everything else in the seven rows
transcribes.

⚠ Per the brief I do **not** rule on whether the `DSR` row stays; I confirm only that its content
is accurate and that it discloses its own irregular admission in its own text.

---

## 7 · RULING on `LEDGER-COMPLETENESS`

`docs/features/ledger-completeness.md` — `status: in_progress`, `reviews: []`, `branch:
claude/zen-vaughan-7dcae2` (branch still present locally; deleting it while the hub is
`in_progress` reds gate 13 at `check-docs-registers.mjs:583`, which I re-read to confirm).

**My ruling: it must NOT be flipped `complete` linking this re-review — and it does not need its
own review round either. Give it a ledger row.**

*Why not `complete` on this report.* Two independent reasons.
1. **Mechanically impossible right now.** `checkHub`'s `complete` predicate is `inLedger ||
   approved` (`:614`), and `approved` means a linked review whose verdict line reads APPROVED.
   This report reads CHANGES REQUESTED. Linking it would red gate 13.
2. **Substantively insufficient, and this is the load-bearing half.** I reviewed the unit's
   **output** (seven rows, cell by cell, §6) and found a defect. I did **not** review its
   **central claim** — the completeness derivation that decides *which* rows were missing and
   that the survivors are exactly `AI`, `QO·FUP`, `CS·1`, `DOCS-RESTRUCTURE`,
   `DOCS-CONSOLIDATION` (+ `DSR`). I attempted a cheap re-derivation by joining the 86
   `phase(x): complete` commits on `main` to the ledger by short sha; it reported **75 unmatched**,
   which is my instrument failing, not 75 gaps — most rows cite a Record/rotation commit, not the
   `phase(x)` one. A correct join needs the id-normalisation table the unit built. ⛔ A hub flipped
   `complete` citing this report would assert a review of a claim this report explicitly did not
   check — which is the precise thing the lead was right to refuse when declining to flip it
   without a review.

*Why not its own round.* The unit is small, its work is merged and gate-green, its residual is
already filed as `FUP-LEDGER-COMPLETENESS-ROWS-NOT-MACHINE-READABLE` (entry at
`follow-ups-open.md:474` with a body file — I verified both exist), and a second QA round would
re-derive work whose *value* is already banked in the rows.

*The clean exit.* `hubHasLedgerRow` (`:280-284`) matches the hub's `id` as the first ledger cell,
bold-tolerant. A row `| **LEDGER-COMPLETENESS** | … |` satisfies `complete` **without asserting a
review that never happened**, and `reviews:` stays `[]`, which is truthful. The precedent is this
unit's own: `DOCS-RESTRUCTURE` and `DOCS-CONSOLIDATION` were just admitted on exactly that basis —
*"a tracking-apparatus change with no product phase"*. Its Record commit is `7e8618e5`. Its QA
cell should say, in the rows' own honest idiom, **"not independently reviewed as a unit; its
output (7 rows) audited in `register-gate-hygiene-rereview.md` §6, its derivation not re-derived"**
— a citation with its bound stated, which is the same standard the rows themselves meet.

That also dissolves the branch problem: once `complete`, the `in_progress` branch check no longer
applies and `claude/zen-vaughan-7dcae2` can be deleted at the Record step.

⛔ Whichever route the lead takes, MAJOR-2 (three Human ✓ cells) is this unit's deliverable and
must be fixed before it goes `complete` by any route.

---

## 8 · What I could NOT verify — work items, not footnotes

⛔ Open items for the lead to discharge or accept explicitly. None is a finding; all are gaps in
**my** coverage.

1. **`ARM=policy` FULL SWEEP** (~105 min) — not run. Unchanged from round 1; no Phase Gate arm
   reaches the four edited call sites, which I confirmed by reading, not by running.
2. **Platform asymmetry.** Gate 13's `execFileSync`-argv branch check and gate 9's case-exact
   `exists` were exercised on **Windows only**. Both are correct by construction and gate 9's
   `links-wrong-case-detect` arm reds against the real filesystem, but the CI-side asymmetry was
   not exercised on a case-sensitive volume.
3. **`test:db` on a reset of my own.** I ran the suite (262/8,882, rc 0) on the lead's existing
   stack; `supabase db reset` is forbidden to me for this review. The "fresh reset" half rests on
   the lead's run.
4. **`LEDGER-COMPLETENESS`'s completeness derivation** — see §7.2. Its *output* is audited; the
   *join that produced it* is not. If the PO wants that certified rather than bounded, it needs
   the unit's id-normalisation artifact handed to QA, and that is a round-3 item I can take.
5. **The class-B widening I did not ask for** (MAJOR-1(c)). If taken, it needs its own rejection
   fixtures and is outside what I reviewed.
6. **Fence/indent awareness** (INFO-1). I measured the blindness; I did not measure what fixing it
   would cost or whether any historical review would flip.

---

## 9 · Summary

The fixes are real and I proved each one by breaking it: the severed CRLF detector now exits 2 in
both polarities where in round 1 it exited 0; the renamed harness now exits 1 with a loud
`scenarios 7 (pass 6 · fail 1)` where it used to vanish at exit 0; the ratchet moved 137 → 136 with
exactly one id leaving and none entering; gate 9's nine files and 0078's five links are right; and
the bare-heading arm survived fourteen attempts to smuggle a rejection through it. Round-1 §7 is
closed — pgTAP 262/8,882 and all four authz arms hold at the tip, run by someone who is not the
builder. The seven reconstructed ledger rows transcribe their sources faithfully, including the
uncomfortable parts they volunteer.

What blocks is small, cheap, and — for the third round running — the unit's own signature defect,
found inside the previous round's fix text. The corrected bound was **reconciled against my
round-1 number rather than re-derived**, so it is wrong again (13 residual in 3 shapes, not 10 in
2), and the sentence claiming the two measurements *"agree exactly"* records a coincidence of
integers between two sets that differ by two members each way. Alongside it, three ledger rows
assert a PO approval in a column that records Phase Gate step 4, sourced to records that do not
carry it — one of which names that approval as still pending.

Both are documentation edits in files already open in this batch. ⛔ No gate needs re-running:
§1, §1a and §2 stand for round 3, and I will re-check MAJOR-1's derivation, MAJOR-2's three cells,
the five MINORs, and `LEDGER-COMPLETENESS`'s disposition.

**Verdict: CHANGES REQUESTED**
