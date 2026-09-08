---
id: LEDGER-COMPLETENESS
title: Phase-ledger completeness — the general question behind FUP-AE2 derived, not eyeballed; four missing rows found, two umbrella idioms separated, and the 8-cell row repaired
status: complete
kind: feature
program: DOCS
phase: "Pre-AE5 remediation — the disposition half of Batch 6's FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER clause (b)"
branch: ~   # merged to main 2026-09-08 at the Record step; branch deleted
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
