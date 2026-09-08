# LEDGER-COMPLETENESS — progress record

The unit's **summary** is its hub, [docs/features/ledger-completeness.md](../features/ledger-completeness.md)
§ Current state. This file is its **log** (ADR 0186 D3): one dated subsection per session, appended,
holding the derivation, its witnesses and its dead ends — so **the next session does not re-derive
it**, which is this record's main job.

## Session log

### 2026-09-08

**Subject.** `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER` clause (b): *is AE2 the only one?* Derived
against `main` @ `6810d95b`. The ledger was byte-identical to the 2026-09-08 derivation quoted in
the brief (81 rows, lines 49–129), so that derivation is a usable cross-check — and it is used as
one below, never inherited.

#### The instruments (four, deliberately independent)

| # | instrument | what it is evidence of | its blind spot |
|---|---|---|---|
| **I1** | the 81 ledger id cells, split on a pipe **not preceded by a backslash** | the set `B` | a naive splitter reads 11 cells on the `ENFORCEMENT-MANIFEST` row (escaped pipes in a code span) |
| **I2** | `docs/progress/<slug>.md` (131, after excluding 9 archive/index files) | a record exists | a slug is a filename, not a subject |
| **I3** | QA verdict = **union** of (a) a review the record hyperlinks, (b) a name-keyed `docs/reviews/` file | the §6 step-3 gate ran | (a) misses records that never link their review; (b) misses renames — `f2-attachments` ↔ `phase-F2-review` |
| **I4** | `phase(<token>): complete` commits (**86**, 86 distinct tokens) | the §6 **Record step actually ran** — name-agnostic | under-detects: many older rows predate the convention, and the id namespace ≠ the token namespace |
| **I5** | `docs/features/*.md` hubs with `status: complete` (**9**) | the modern *unit* precedent | only 11 hubs exist; it says nothing about pre-hub work |

#### Matching rules A→B, and the failure mode of each

- **R1 — the row's own `](<file>.md)` link.** ⛔ *Failure mode found:* a record linked from **more
  than one row**; "first row wins" is arbitrary. Fixed by collecting all hits.
- **R3 — shared review artifact** (row and record cite the same `docs/reviews/` file). Name-agnostic,
  so it catches `f2-attachments` → `14e` where every name rule fails. ⛔ *Failure mode found, and it
  is the dangerous one:* a **shared audit-findings** file is cited by many subjects, so it is not an
  identity join — it silently matched `authz-ae2` to a row, **hiding the very defect the follow-up
  was filed about.** Fixed by requiring the join to be **1:1** (cited by exactly one row and one
  record); non-1:1 is reported as `UNDECIDED`, never as a match.
- **R0 / R2** — exact equality, and equality after stripping a leading `phase-` / `authz-`.
- **R4 — slug starts with an id + `-`.** ⛔ **DISCARDED for the `authz-` and `dm-` namespaces**, as
  the brief warned: `AUTHZ` is both a ledger id *and* a filename namespace, so R4 matches
  `authz-ae2.md` to the `AUTHZ` row. ⚠ **The cost of discarding it is real and must be stated:** it
  produces *false* A\B members (`authz-gate1-units`, `authz-capability-inventory`), which is why
  those two were adjudicated by hand and ruled **covered**, not missing.
- **R5 — slug starts with an id, no dash boundary.** Needed for `bulk-case-creation` →
  `bulk-case-create`; weaker, and flagged wherever it fires.

⛔ **Titles were not trusted.** The brief's warning held: `docs-consolidation.md` calls itself a
"unit" while carrying a full APPROVED gate, and `form-builder-enhancements.md` calls itself a
"mini-phase". Every admission below rests on **I4 or I5**, never on an H1.

#### Rule-set history — three passes, because the first two were wrong

1. **Pass 1** (R0/R1/R2/R4): `A\B` = **66**. Wrong direction — it *under-matched*, manufacturing
   false "missing row" claims. A derivation finding strictly more is not automatically better.
2. **Pass 2** (+R3, verdict = linked review only): `A\B` = **30**, but `authz-ae2`,
   `docs-consolidation`, `docs-restructure`, `case-narratives` and `dsr-slice-3` **vanished** — two
   different bugs at once: R3's shared-artifact false join, and a verdict instrument that dropped
   any record which does not hyperlink its review.
3. **Pass 3** (R3 constrained to 1:1; verdict = union of both instruments): `A\B` = **30** with all
   five restored, and the ambiguous-join bucket **empty**. This is the reported derivation.

#### Results, and the cross-check against the brief's derivation

- **`A \ B` = 30.** All **11** members of the brief's list (its 10 + AE2) are inside it — the
  "strictly fewer is a bug" check passes. It adds **19**: the ~14 umbrella sub-phases the brief had
  already bucketed as UNDECIDED, plus **five the brief did not surface at all** —
  `ai-satellites`, `case-access`, `case-phase-results`, `previa-split-2026-08-19`,
  `qo-fup-close-out`. Each was re-checked by **name search** against the ledger (0 hits) so the
  absence is not an artifact of my rules.
- **`B \ A` = 9** rows with no record at all, ⚠ **not the brief's 5.** One **correction to the
  brief**: line 68 `20` (Notifications & Escalation) is **not** record-less — its QA cell cites
  `s1-n-notifications-review.md`, and `docs/progress/s1-substrate.md` is its record; only the
  name-agnostic 1:1 join finds it. The other four of the brief's five reproduce.
- **I4 residue, after pairing every alias** (`e1`↔`ETH·E1`, `f2`↔`14e`, `a`↔`hospital-admin`,
  `p3`↔`PDF·P3`, `pci+tv`↔`PCI`+`TV`, `11-v2`↔`interviews-v2`, `rv2`↔`referrals-v2`, …): exactly
  **four** completion commits with no row — `ae2` `28d90212`, `ai` `b0387d31`,
  `case-split-1` `0ab4b2da`, `qo-fup` `38b4f3a7` — plus `dsr` `96a46231` **UNDECIDED**.
  ⭐ This is an *independent* confirmation of the four, arrived at without reading a single title.
- **I5:** of the 9 `status: complete` hubs, **7 carry a ledger row**; the two that do not are
  `docs-consolidation` and `docs-restructure`.
- ⚠ **`DLB` measured and dismissed.** The ledger's own rotation note names a `DLB` row among the 15
  rotated on 2026-08-14, and no `DLB` row exists in the live table. It is **not** a lost row: DLB is
  *"ADR PROPOSED — NOT ratified; nothing built"*, so a completed-phases ledger correctly omits it.
  Checked rather than assumed, because the note reads exactly like a deletion.

#### The PO ruling (2026-09-08) and what was written

1. **Umbrellas — "absorb, but say so explicitly."** The ledger runs **two idioms at once**, which is
   why its own text could not settle it: `ff-program` and `14` **absorb** (members have no rows),
   while `pre-pilot-foundations` (*"see F0–F-cleanup rows"*) and `pre-pilot-release` **delegate**
   (members each have rows). Four umbrella rows now name their sub-phases **and link their records**
   — `14`, `DM`, `ff-program`, `AUTHZ`. ⭐ The links are the durable half: the next derivation
   resolves all of them by **R1**, with no judgment.
2. **Missing rows — the 4 + the 2 complete hubs.** Written: `AI`, `QO·FUP`, `CS·1`,
   `DOCS-RESTRUCTURE`, `DOCS-CONSOLIDATION`. AE2 left to Batch 6. ⚠ **`CS·1` is the one the brief
   flagged and it survived every check:** increment 2 has had a row since 2026-08-22, increment 1
   had none, and the CS·2 row **does not account for increment 1 anywhere in its text** (measured by
   search, not read by eye).
   ⚠ **A SIXTH row, `DSR`, was written AFTER the ruling and is flagged as such in the row itself.**
   It was presented to the PO as `UNDECIDED` — `phase(DSR): complete` `96a46231` against a ledger
   holding only `DSR·R` — and I resolved it afterwards by reading `dsr-program.md`: *"Closed
   2026-08-20. All four slices built and gated; §6 steps 1–5 complete, PO-approved, merged."*
   `DSR·R` is the *operational remediation*, a different subject, which is precisely why the program
   read as covered. It meets the ruling's stated bar (a completion commit, no row, confirmed by a
   second instrument) but was **not inside the option the PO selected**, so the row says so and
   invites its own removal. ⛔ Its QA cell records that **Slice 2 had no QA review at all** — the
   kind of thing a reconstructed row is most tempted to smooth over.
3. **Record-less rows — link the reviews, write no records.** Four of the five already carried a
   review link; only `AUTHZ · Gate 2` had **no link of any kind** and now has one. The two program
   umbrellas are labelled as delegating, so their all-`–` cells read as design, not as gaps.
4. **Sequencing — write on this branch.** See § Coordination below.

**Ledger after: 86 rows, every one 9 cells** (from 81 rows with one 8-cell row). Re-derived after
the edits: `A\B` 30 → **12** (AE2 for Batch 6; `dsr-slice-3` correctly absent, still in progress;
`dm5-handoff` a handoff; and the 9 the PO ruled out), `B\A` 9 → **7**, all dispositioned.

#### The 8-cell row (`0136`)

Confirmed by splitting: 8 cells, `Completed` absent, so a column-indexed reader took
`` `1069711c` · `d899ceb3` · `9d8ac6d3` `` **as the completion date** — visible in the derivation's
own ordering dump before the fix. The inserted date is **measured, not inferred**: all three commits
are 2026-08-24, the review `adr-0136-deferred-signoff-review.md` is dated 2026-08-24, the row's own
Human ✓ cell says 2026-08-24, and the neighbouring `0137` row completed 2026-08-24.

#### Dead ends and traps hit (recorded so they are not re-paid)

- ⛔ **A quoted heredoc ate backslashes twice** (`re.split(r"(?<!\\)\|", …)` arrived as
  `(?<!\)\|`), and again in `python -c`. Scripts are written with the Write tool for this reason —
  the same shell round-trip hazard as `sed -i` on this platform.
- ⛔ **`grep -c` printing `0` exits 1 and killed an `&&` chain**, so a CR count read as `0` when the
  real answer was 297. The known lesson, in a new costume; re-run inside `$( … || true )`.
- ⛔ **The background-task chip said "exit code 0" while the chain exited 1.** The command ended in
  a pipe; only `${PIPESTATUS[0]}` carried the truth. **A gate that decides anything runs bare.**
- ⚠ **A gate red that was my own working tree, not the repo.** `lint:progress` red on *"CLAUDE.md
  contains CR characters"*. `git show HEAD:CLAUDE.md | grep -c` reported 297 CRs **in the blob** and
  I said so — **wrong**: `git show` applied the eol filter through the pipe. `git cat-file blob`
  (raw) shows the committed file is **LF-only, 0 CRs, 20,871 bytes**; the 297 CRs existed only on
  disk in this worktree, invisible to `git status` because `.gitattributes` normalises on
  comparison. Restored with `git checkout -- CLAUDE.md` (disk now byte-identical to the blob) and
  the gate went green. **`main` was never red.**

#### Coordination — ⚠ the branch APPEARED mid-session

At session open, measured: `authz-register-gate-hygiene` existed **neither locally nor on
`origin`**, no `register-gate-hygiene` artifact existed anywhere under `docs/` or `.claude/`, and
AE2 had no row. The PO ruled, on that measurement, to write here.

⚠ **It came into existence while this unit was being built.** `git branch --list` later returned it,
and the primary checkout had moved onto it at `202106ab` — Batch 6 opened in the primary worktree
mid-session. ⭐ This is [[a-local-branch-ref-is-a-live-fact]] in the *appearing* direction; the
recorded lesson is about one vanishing. **A branch check is an instant, not a lease.**

Re-measured before acting: at `202106ab` Batch 6 touched **neither `docs/progress/phase-ledger.md`
nor `docs/followups/`**, and still had no AE2 row. Overlap was exactly one file,
`docs/features/INDEX.md`, which is **generated**. So the brief's rule ("rebase onto it before
touching the ledger") was followed: `git rebase authz-register-gate-hygiene`, the one conflict
resolved by **regenerating** the index rather than hand-merging it, and the ledger re-derived
**after** the rebase — 87 rows, all 9 cells.

⚠ **Then it moved AGAIN, and the second time it DID touch the ledger.** At handoff, Batch 6's tip
was `8b194439` — *"AE2 re-enters the ledger as a reconstructed row, and the six workaround ids get
their bold back"*. So clause **(a) is theirs and is now DONE**, and the base I had rebased onto was
already stale. Second rebase, this time a **real content conflict** in `phase-ledger.md`: their
re-bolded tail rows against my two `DOCS-*` rows inserted before `AE4`.
⭐ **Resolved by taking BOTH sides, not by choosing one** — their bolding kept verbatim, my two rows
re-added and **bolded to match the convention they had just established**. The union was verified
**mid-merge**, not after ([[a-clean-automerge-can-undo-a-bulk-repair]]): **88 rows** (81 + my 6 +
their AE2), **all 9 cells**, and each of the seven new ids present **exactly once** — the check that
would have caught a resolution that silently dropped a side.
⚠ Their "six workaround ids" are the **tail units** (`AE4`…`ENFORCEMENT-MANIFEST`) — a *different*
six from the six odd-`**` rows this unit filed, which are untouched and still stand.

#### Gate

`npm run lint` — run **bare** both before and after the rebase, exit code read directly (⛔ the
first attempt was piped to `tail`, and the task chip reported **exit 0 while the chain exited 1**).

- **Gate 13 `lint:registers` — exit 0.** ⭐ It was red before the rebase on
  *"branch `claude/zen-vaughan-7dcae2` does not exist"* — **a gate defect, not a bad hub**:
  `check-docs-registers.mjs` built its branch list with `execSync("git branch --list
  --format='%(refname:short)'")`, and on Windows `cmd.exe` does **not** strip the single quotes, so
  every name arrived as `'main'` and `branches.includes(...)` was **always false**. It had never
  fired because there were **no `in_progress` hubs** — a check with zero live subjects, the exact
  class ADR 0186's unit measured (11 of 74). ⭐ Batch 6 had **independently found and fixed the same
  bug** on its branch (`gitArgs([...])`, shell-free, with a comment naming the hazard), so the
  rebase cleared this finding on its own. Both findings stand; neither was copied from the other.
- ⛔ **Gate 11 `check-rules-staleness` — 24 findings, and they are NOT this unit's.** Ten rule files
  lack `paths:` and `anchors:`, three exceed the 2048-byte cap, one lacks `source:`. Proven
  pre-existing: `.claude/` is **byte-identical to `main` and to Batch 6's tip**, and
  `check-rules-staleness.mjs` is byte-identical to `main`, so **`npm run lint` reds on `main`
  itself**. ⚠ This unit's own first baseline run did not see it — the `&&` chain short-circuited at
  an earlier gate, so "the baseline was green" was never established. Left for Batch 6, whose stated
  subject is register/gate hygiene; fixing it here would collide with the file they are rewriting.

  > ⚠ **CORRECTED 2026-09-08 by the Batch 6 lead, beside the original — the conclusion is wrong,
  > and the reasoning that produced it is the instructive part.** Gate 11 is **NOT red on `main`**.
  > Measured on the primary tree at the Batch 6 tip: `npm run lint:rules` → **rc 0**,
  > `check-rules-staleness: OK (10 rule file(s), anchors + globs resolve)`. The 24 findings **were**
  > reproduced exactly — by running the same script *from this unit's worktree*
  > (`.claude/worktrees/zen-vaughan-7dcae2`), **rc 1**.
  >
  > **Cause: the worktree's `.claude/rules/*.md` are CRLF; the primary tree's are LF.** Measured on
  > `prettier-does-not-govern-this-tree.md`: **47** CR bytes there, **0** here, both 47 lines —
  > 2058 bytes vs 2011. That +47 is exactly what carries three files past the **2048-byte cap**, and
  > `paths:` / `anchors:` / `source:` "go missing" because the parser is handed `paths:\r`.
  >
  > ⛔ **Why "byte-identical to `main`" was measured and still wrong.** `git hash-object` returns the
  > **same blob** for both copies, and `git status` is clean in both — because `.gitattributes`'
  > `* text=auto eol=lf` clean filter normalises the CR away *on the way in*. So every git-mediated
  > comparison agrees they are identical while the bytes on disk differ. A claim about a file's
  > **content** is not a claim about the **bytes a gate reads**, and on Windows that gap is invisible
  > to the tool everyone reaches for.
  >
  > ⭐ **The finding that survives, and it is a real one:** the gate **misattributed its own failure
  > cause**. It said *"no `paths:` globs"* and *"no `anchors:`"* when the truth was *"this file has
  > CRLF"* — and that misattribution is what turned a line-ending artifact into a committed claim
  > that `main` was broken. Batch 6 owns the fix: the gate must name CRLF as CRLF. Gate 9, which
  > forbids CR outright, is **rc 0** in that same worktree, so the drift is confined to
  > `.claude/rules/`.

`node_modules` is **borrowed from the primary checkout** (this worktree has none);
`git diff --stat main -- package-lock.json` is **empty**, the documented condition under which
borrowed results are comparable ([docs/worktrees.md](../worktrees.md)). ⛔ Stated because an
unattributable gate run is worth less than a stated one.

### 2026-09-08 — Record step (Batch 6 lead): closed on its LEDGER ROW, not on a review

⛔ The block below is this hub’s `## Current state`, **cut VERBATIM** at the Record step
(ADR 0186 D3): the summary has one home while a unit is live and one home after it closes,
and copying rather than moving is how two homes start disagreeing.

## Current state

**Updated:** 2026-09-08

### Objective

Answer clause (b) by derivation, bring the PO a ruling with the measurement attached, and write
only the rows the ruling admits — each marked **reconstructed** with its sources.

### Done since start

Four independent instruments built and cross-checked (ledger ids · progress records · QA verdicts ·
`phase(x): complete` commits · `status: complete` hubs). Three successive rule sets, each corrected
after it was caught mis-matching. PO ruled all four questions. **Six** reconstructed rows written —
`AI`, `QO·FUP`, `CS·1`, `DOCS-RESTRUCTURE`, `DOCS-CONSOLIDATION`, `DSR`; four umbrella rows made
explicit; `AUTHZ · Gate 2` given the review link it never had; the malformed 8-cell row repaired.
⭐ **`DSR` was admitted AFTER the ruling**, under the ruling's own principle rather than inside the
option the PO picked — **PO-RATIFIED 2026-09-08**: the objection was *procedural* (who authorised it),
not *factual* (is it true), and only the factual kind impeaches a record.
Ledger now **every row 9 cells** (it was 81 rows with one 8-cell row). ⛔ The row TOTAL is not
quoted: it moved 87 → 88 → 89 during this work and goes to 90 when Batch 6 writes its own row.
⚠ This block read "87" — a
mid-session figure standing beside the final one four lines below it (QA r2 MINOR-5); 88 once Batch 6's
AE2 row merged with these six, 89 once this unit got its own row.

### In progress

Nothing of this unit's own. It rode into Batch 6 and is verified inside that gate. ⚠ It was **rebased
onto Batch 6 twice**, and the second rebase hit a real ledger conflict (their re-bolded tail vs these
`DOCS-*` rows) resolved by taking **both** sides, re-derived **mid-merge**.
⚠ Batch 6's QA round 2 audited this unit's **output** — all seven rows re-derived against their cited
sources — and found **three Human-✓ cells asserting approvals their sources do not record**
(`QO·FUP`, `DOCS-RESTRUCTURE`, `DOCS-CONSOLIDATION`), since corrected in place. ⛔ It did **not**
audit the completeness derivation, so `reviews:` stays `[]`.

### Next

Status flips to `complete` at Batch 6's Record step, on the **ledger row** it now has rather than a
review — QA ruled it must not be flipped on a CHANGES REQUESTED verdict, and the row is what lets
this branch be deleted.
`FUP-LEDGER-COMPLETENESS-ROWS-NOT-MACHINE-READABLE` carries what the ruling deferred: the
escaped-pipe column trap, the six odd-`**` rows (⚠ **a different six** from the workaround ids
Batch 6 re-bolded), and the real remedy — a gate that checks a row **ARRIVED**.

### Blockers

None. ✅ **The gate-11 blocker is DISSOLVED — a worktree artifact, not a repo defect.** This block
claimed `npm run lint` reds on `main`; it does not (`lint:rules` **rc 0** on the primary tree). The
24 findings reproduce only from this unit's worktree, whose `.claude/rules/*.md` are **CRLF**, and
`.gitattributes`' clean filter hides that from `git status` and `git hash-object` alike — so the
"byte-identical" measurement was right and the conclusion from it was wrong. ⭐ What survived is a
real Batch 6 fix: the gate now names CRLF as CRLF instead of blaming the rule's content. Full
account and the four proof arms: record § 2026-09-08 and `docs/lint-gates.md`.

