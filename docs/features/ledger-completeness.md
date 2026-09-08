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
after it was caught mis-matching. PO ruled all four questions. Ledger now: **87 rows, every one
9 cells** (was 81 with one 8-cell row). **Six** reconstructed rows written — `AI`, `QO·FUP`, `CS·1`,
`DOCS-RESTRUCTURE`, `DOCS-CONSOLIDATION`, and ⚠ **`DSR`, admitted AFTER the ruling** under the
ruling's own principle (it was presented as UNDECIDED and resolved afterwards by reading
`dsr-program.md`; the row says so and invites the PO to strike it). Four umbrella rows made
explicit; `AUTHZ · Gate 2` given the review link it never had; two program-umbrella rows labelled
as delegating.

### In progress

Nothing — the ruled work is written and **rebased onto Batch 6 twice**: first at `202106ab`, then
again at `8b194439` after Batch 6 wrote AE2's row and re-bolded the six workaround ids. ⚠ **The
second rebase hit a real content conflict in the ledger** (their re-bolded tail vs my two
`DOCS-*` rows); resolved by taking **both** — their bolding kept, my rows re-added and bolded to
match the convention they had just set. Ledger re-derived **mid-merge**: 88 rows, all 9 cells,
their AE2 row and my six each present exactly once.

### Next

Batch 6 rules on the `DSR` row (written after the ruling — strike it if the reading is wrong) and
flips `FUP-AE2`'s `Status:`, both clauses now being discharged.
`FUP-LEDGER-COMPLETENESS-ROWS-NOT-MACHINE-READABLE` carries what the ruling deferred: the
escaped-pipe column trap, the six odd-`**` rows (⚠ **a different six** from the workaround ids
Batch 6 re-bolded — theirs were the tail units; these are `hospital-admin`, `nsp-per-hospital`,
`f-cleanup`, `referrals-v2`, `interviews-v2`, `ETH·E1`), and the real remedy — a gate that checks
a row **ARRIVED**.

### Blockers

✅ **The gate-11 blocker is DISSOLVED — it was a worktree artifact, not a repo defect.**
This block previously read: *"`npm run lint` exits 1 — on `main` too, and not from this unit …
`.claude/` is byte-identical to `main`"*. Measured by the Batch 6 lead 2026-09-08 on the primary
tree: `lint:rules` → **rc 0**, `OK (10 rule file(s))`. The 24 findings reproduce only when the
script is run **from this unit's worktree**, whose `.claude/rules/*.md` are **CRLF** (47 CR bytes
vs 0, 2058 vs 2011 bytes — which is what crosses the 2048 cap, and what makes the parser see
`paths:\r`). `git hash-object` and `git status` both call the two copies identical, because
`.gitattributes`' `* text=auto eol=lf` clean filter normalises CR on the way in — so the
"byte-identical" measurement was correct and the conclusion drawn from it was not.
⭐ What survives is a real Batch 6 item: the gate **misattributed its own failure cause**, reporting
*"no `anchors:`"* where the truth was *"CRLF"*. Full correction: record § 2026-09-08.
**Gate 13 `lint:registers` is exit 0**, and so is the full chain on the primary tree.

⚠ **The coordination premise changed mid-session.** `authz-register-gate-hygiene` did not exist at
session open (measured) and appeared partway through; this branch was rebased onto it per the
brief's rule. It touches neither the ledger nor the follow-ups, so the only conflict was the
generated `docs/features/INDEX.md`, resolved by regenerating rather than hand-merging.
