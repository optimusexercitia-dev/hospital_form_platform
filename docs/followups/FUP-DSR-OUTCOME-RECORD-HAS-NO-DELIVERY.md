# FUP-DSR-OUTCOME-RECORD-HAS-NO-DELIVERY — the DSR workflow's one promise to the data subject has no mechanism (owner: PO/frontend; **filed 2026-08-20, PO-deferred the same day**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-20 · status open

ADR [0130](../decisions/0130-dsr-subject-request-workflow.md) **D1** requires answering a subject
request with its outcome and, for a refusal, its legal basis (LGPD Art. 18 §4). `BUG-DSR-S3-007`
calls the outcome record *"the artifact delivered to the data subject"*.

⛔ **`src/components/dsr/dsr-outcome-record.tsx` renders on screen only.** Measured 2026-08-20:
the DSR module contains **no export, print, PDF or download path** — not in `src/components/dsr/`,
not in `src/app/o/[org]/titulares/`, not in `src/lib/dsr/`. No document names how the record
reaches the subject, and no runbook covers it. This is the workflow's **only** promise to the
subject with neither a mechanism nor a procedure.

**PO ruling 2026-08-20: OUT OF SCOPE for the operational-remediation round** (the round that fixed
`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW`). ⛔ **Deferred with the gap named — not closed, not
descoped.** Today an operator delivers the answer out-of-band, keyed by the request's `file_ref`.

**Two shapes when it is taken up, and they are not equivalent:**
1. **Minimal print view** — a print stylesheet plus an `Imprimir` affordance on
   `/o/[org]/titulares/[requestId]`. Cheap, no new door. ⚠ But ADR
   [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) /
   [0126](../decisions/0126-print-series-and-derived-currency.md) make printing a **registered
   emission** concept in this platform, so an unregistered print sits *beside* that model rather
   than inside it — and the delivered legal answer would carry no verification trail.
2. **Registered emission** — route the record through the existing print/emission subsystem so the
   delivered answer is a registered document. Correct for a legal deliverable; costs its own ADR
   plus a print-source vector.

⚠ **Do not let the screen render stand in for delivery in any status claim.** The record being
*complete and correct on screen* is what the DSR gate verified; that it *reached the subject* has
never been in scope and is not evidenced anywhere.
