# FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES — the PHI-disposal runbook is the procedure for ONE of the two PHI-disposal substrates; the four column-erasing doors have no operational procedure at all (owner: backend + PO; found by correcting a wrong-grain claim, 2026-08-19)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

**Measured 2026-08-19** while checking whether `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`
really blocked C1a (it did not). PHI leaves this system by **two structurally different
substrates**, and only one has a runbook:

| Substrate | Mechanism | Operational procedure |
|---|---|---|
| **Storage bytes** — `file_objects` parked at `disposal_state = 'disposal_pending'` | inflow: `request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`, `complete_document_reclassification`; outflow: `complete_document_disposal`, which **nothing schedules** | ✅ [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) — this is precisely why it exists (its § 0) |
| **DB columns** — `minutes_md`, `meeting_agenda_items.*`, `patient_identifiers`, `event_patient`, `referral_patient`, narratives… redacted in place to `[PHI removido]` | `dispose_meeting_minutes`, `dispose_case_phi`, `dispose_event_phi`, `dispose_referral_phi` — each **completes synchronously inside its own transaction** | ⛔ **NONE** |

**Measured, not inferred:** the runbook contains **zero** occurrences of `meeting`,
`minutes_md`, `dispose_meeting_minutes`, `dispose_event_phi`, `patient_xref` or
`PHI removido`; it names `dispose_case_phi` and `dispose_referral_phi` **once each**, and only
as *inflow doors that park a `file_objects` row* — never as PHI-erasure operations in their
own right. In the catalog the two paths are disjoint: `dispose_meeting_minutes` writes no
`file_objects` row and never sets `disposal_pending`; `complete_document_disposal` never
touches meetings.

⚠ **This is not a claim that column PHI is un-erasable.** The column doors work, complete
synchronously, and need no operator — which is exactly why they never acquired a procedure, and
exactly why nobody noticed. The gap is that **"the PHI disposal runbook" is read as covering PHI
disposal**, and a C1a rehearsal executed against it will exercise the byte path and record a
green that says nothing about the column path. Under LGPD Art. 18 an erasure request spans both.

**What is actually needed** (PO call — this may be a runbook § or an explicit scope statement):
1. The runbook states its substrate **in its title or § 0 banner**, so its green cannot be read
   wider than it is; **and**
2. either a companion procedure for the four column doors, **or** a recorded decision that they
   need none because they are synchronous — with the *evidence path* named either way (which
   door, which audit event, what a verifier reads afterwards).

⭐ **How it stayed invisible:** every document that touched it was individually correct about its
own subject. The runbook never claimed to cover columns; the doors never claimed to need a
runbook; C1a said "run the runbook". The gap lived **between** them, and it took a wrong-grain
claim — *"the child lock blocks C1a"* — to point at the seam. Same shape as
[[an-approvals-scope-is-a-fact-that-must-be-written-down]]: invisible from either document alone,
because each is complete about its own subject.
