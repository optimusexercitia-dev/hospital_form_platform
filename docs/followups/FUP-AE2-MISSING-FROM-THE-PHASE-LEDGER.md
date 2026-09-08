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

- ✅ **(b) DISCHARGED 2026-09-08** by `LEDGER-COMPLETENESS` — derivation, rules, failure modes and
  witnesses in [ledger-completeness.md](../progress/ledger-completeness.md) § 2026-09-08.
  **The answer is NO.** Four subjects had a `phase(x): complete` commit and no row —
  `ae2` `28d90212`, `ai` `b0387d31`, `case-split-1` `0ab4b2da`, `qo-fup` `38b4f3a7` — and two
  `status: complete` hubs had none (`docs-consolidation`, `docs-restructure`). All five
  non-AE2 rows are written, marked **reconstructed** with sources; four umbrella rows now state
  the sub-phases they cover; the 8-cell `0136` row is repaired.
  ⭐ **The method that found them was not the one this clause specified.** Record-and-verdict
  diffing alone yields 30 candidates, most of them archived features, and it cannot tell a phase
  from a feature without trusting a title. The discriminator that worked is the
  **`phase(x): complete` commit** — name-agnostic evidence that the §6 Record step actually ran.
  ⛔ Its blind spot, stated: it under-detects work predating the convention, so **absence of a
  completion commit is evidence, not proof**, and the nine "borderline completes" it excluded
  were excluded by PO ruling, not by the instrument alone.
  ⚠ **One correction to the derivation quoted in the Batch 6 brief:** line 68 `20` is **not**
  record-less — `docs/progress/s1-substrate.md` is its record, reachable only by a name-agnostic
  join. The record-less set is 7, not 5, and none of the 7 is a defect.

- ✅ **(a) DONE 2026-09-08 by Batch 6 / `REGISTER-GATE-HYGIENE`, not by this unit.** AE2's row is
  in the ledger, 9 cells, marked reconstructed — written on `authz-register-gate-hygiene` at
  `8b194439` *"AE2 re-enters the ledger as a reconstructed row"*. ⚠ **This bullet was written
  earlier the same day saying (a) was still open and the branch did not exist** — both were true
  when measured and false within the hour. Corrected by re-measuring at the rebase, not by
  re-reading the earlier line.
  ⛔ **Flipping this entry's `Status:` is Batch 6's call at its Record step**, not this unit's:
  both clauses are now discharged, but the entry belongs to their gate.
