---
id: LEDGER-COMPLETENESS
title: Phase-ledger completeness — the general question behind FUP-AE2 derived, not eyeballed; four missing rows found, two umbrella idioms separated, and the 8-cell row repaired
status: in_progress
kind: feature
program: DOCS
phase: "Pre-AE5 remediation — the disposition half of Batch 6's FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER clause (b)"
branch: claude/zen-vaughan-7dcae2
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/ledger-completeness.md
reviews: []
adrs: ["0186", "0185", "0124", "0179"]
handoff: ~
fup: ~
---

# LEDGER-COMPLETENESS — is AE2 the only missing row?

## Acceptance criteria

`FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER`'s clause **(b)** — quoted from the register, not
paraphrased: *"the general question — is AE2 the only one? ⛔ Do not answer that by eye: derive it,
by diffing the phases named in `phase-ledger.md` against those with a `docs/progress/<phase>.md`
record and a QA verdict."* Clause **(a)** (AE2's own row) is **not** this unit's — it belongs to
Batch 6 / `REGISTER-GATE-HYGIENE`.

- [x] The diff **derived by script**, with the matching rules stated *and their failure modes
      stated* — a rule that cannot decide yields `UNDECIDED`, never a silent match.
- [x] Both polarities: `A \ B` (record + verdict, no row) **and** `B \ A` (row, no record) — the
      second is not covered by the follow-up's clause and was reported anyway.
- [x] The answer to "is AE2 the only one?" is **no**, and each survivor carries the measurement
      that admitted it, not a title that claimed it.
- [x] PO ruling taken on the three open questions before any row was written.
- [x] The malformed 8-cell row repaired (`0136`), with its `Completed` date **measured**.
- [x] Batch 6 writes AE2's row (not this unit) — ✅ done by them at `8b194439`, mid-session.

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
