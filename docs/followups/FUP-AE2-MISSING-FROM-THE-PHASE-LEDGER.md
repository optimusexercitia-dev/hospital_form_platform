# FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER — a shipped phase absent from the append-only record (owner: lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟠 **FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER** — found 2026-08-31 while writing AE3's ledger row.
  `docs/progress/phase-ledger.md` opens *"the append-only ledger of every phase this project has
  run"* and *"rows never leave — a missing row breaks the many places that point here"*. Measured:
  it holds rows for **AE0** and **AE1**, and **none for AE2** — a phase that completed, was
  QA-APPROVED at r3, was PO-approved, and **shipped to the remote** on 2026-08-29.

- ⛔ **NO GATE CAN SEE THIS, WHICH IS WHY IT NEEDS A LINE.** `npm run lint:progress` enforces the
  *departure* half of the contract — a `✅ complete` row may not remain in `PROGRESS.md` — and it
  is satisfied the moment the row is **deleted**. Nothing checks that the row **ARRIVED**. A
  rotation that drops its payload therefore passes the gate exactly as a correct one does, and the
  evidence that a phase ever ran disappears silently. ⚠ This is the same asymmetry as
  [[rotation-whose-source-cut-is-clobbered-becomes-duplication]], one tense over: there the source
  cut was lost, here the destination write was.

- ⚠ **I did not reconstruct the row.** AE2's figures are recoverable from
  [authz-ae2.md](../progress/authz-ae2.md) and [2026-Q3.md](../progress/2026-Q3.md), but a ledger row assembled after the
  fact by someone who did not run the phase is a *plausible* record, not a true one — and it would
  be indistinguishable from a contemporaneous one forever after. Whoever reconstructs it should
  mark it reconstructed, with its sources.

- **Owed:** (a) write AE2's row, marked reconstructed; and (b) the general question — **is AE2 the
  only one?** ⛔ Do not answer that by eye: derive it, by diffing the phases named in
  `phase-ledger.md` against those with a `docs/progress/<phase>.md` record and a QA verdict. This
  one was found by accident, which is not a method — lead
