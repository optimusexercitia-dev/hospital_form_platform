# ADR 0131 — PHI erasure reach is bounded to DESIGNATED PHI fields; free text is out of scope for the pilot

**Status:** **Accepted** (PO decision, relayed 2026-08-20 after discussion with the
development team) · **Date:** 2026-08-20 · **Feature:** scope ruling on the PHI-disposal
doors · **Resolves:** `FUP-DOOR-ERASURE-FREETEXT-CENSUS` (🟠) and
`FUP-ETHICS-LANE-NO-ERASURE-DOOR` (🔴) — **by ruling, not by remediation** ·
**Relates:** ADR [0056](./0056-phi-disposal-closure-narrowed-claim.md) (the doors and the
narrowed storage claim), ADR [0130](./0130-dsr-subject-request-workflow.md) (the DSR
workflow that calls them), ADR [0035](./0035-lgpd-anvisa-regulatory-posture.md) (the
governing regime), CLAUDE.md **Rule 12**.

## Context

The DSR Slice 4 meeting-door widening (ADR 0056 Amendment 1) established a working rule:
*a PHI-capable column may not be left both unredacted and unnamed.* Applied consistently,
that rule makes **every free-text column on a lane** a candidate for erasure, because any
of them **may** receive PHI regardless of design intent.

A census of the three remaining doors measured what that would cost
([door-erasure-freetext-census.md](../progress/door-erasure-freetext-census.md)):
**133 candidate columns** across `dispose_case_phi`, `dispose_event_phi` and
`dispose_referral_phi` — titles, notes, rationales, `jsonb` payloads, revision histories,
and a whole seven-table `ethics_*` lane no door touches. None of these are designated PHI
fields; all of them *could* hold PHI if an operator typed it there.

## Decision

**PHI erasure reaches DESIGNATED PHI fields. It does not extend to columns that merely
MAY contain PHI.**

1. **In scope — confirmed PHI columns and tables**, executed perfectly: `event_patient`,
   `referral_patient`, `patient_identifiers` / `patient_participants`, `patient_xref`, and
   the fields explicitly designated to carry patient data. These must be erased completely,
   provably, and with their doors properly gated and keystoned.
2. **Out of scope for the pilot — free text and titles that may incidentally contain PHI.**
   No door is widened to cover a column on the grounds that PHI *could* be typed into it.
3. **The compensating control is TRAINING**, not software: users are trained to enter PHI
   exclusively in PHI-specific fields.
4. **Already-implemented erasure reach is MAINTAINED, not rolled back.** The ADR 0056
   Amendment 1 meeting widening (10 columns) stays as built. This decision bounds future
   extension; it does not reverse shipped behaviour.
5. **The working rule from Amendment 1 is NARROWED**: *a **designated PHI** column may not
   be left both unredacted and unnamed.* For non-designated free text, neither redaction
   nor disclosure is required.

## Consequences

- **`FUP-DOOR-ERASURE-FREETEXT-CENSUS` and `FUP-ETHICS-LANE-NO-ERASURE-DOOR` close as
  RULED OUT OF SCOPE.** ⛔ **They do not close as "no residue found".** The residue is
  real, measured, and **accepted** — the census stands as the record of what is knowingly
  retained. A future reader must not mistake this for an absence of findings; that
  distinction is the entire reason the census document is kept rather than deleted.
- ⚠ **The platform's erasure claim now rests on a control the platform does not enforce.**
  Training is a process control; the software cannot detect PHI typed into a title. This is
  a legitimate risk-acceptance, and it must be recorded **where the pilot decision is made**
  and not only here — the same requirement Critical FUP C3 carries for its own acceptance.
- ⚠ **`DSR_RESIDUE_NOTICE` line 1 becomes conditionally true rather than structurally true.**
  It tells the data subject *"O descarte apaga os dados do paciente armazenados no banco
  para este registro"*. Under this decision that is true **provided PHI was entered only in
  PHI fields**. The wording is not being changed here — whether it should be scoped to the
  designated fields is a **copy decision for the PO**, filed as
  `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING`. ⛔ Do not treat the notice as falsified; treat its
  premise as newly explicit.
- ⛔ **NOT descoped by this decision, and easy to over-read:**
  - **`FUP-DISPOSE-EVENT-DOOR-GATE-BLIND`** — this is about the door's **authorization
    gate**, not its reach. "Perfect execution of confirmed PHI columns" makes keystoning the
    door that erases `event_patient` *more* load-bearing, not less. Suite
    `352_dispose_event_door_gate.sql` stands.
  - **`FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`** — an operational procedure for the column
    doors is squarely "perfect execution", and remains owed.
  - **Critical FUP C1 (C1a/C1b)** — the disposal rehearsal is unaffected.
  - **`FUP-XREF-PEPPER-ROTATION-ORPHANS`** — `patient_xref` is designated PHI; unaffected.
- ⚠ **One edge this decision does not obviously settle, flagged rather than assumed.** The
  `ethics_*` lane exposed **two** data subjects. Descoping the *patient*-PHI half follows
  directly from this ruling. The other half is the **accused professional**, whose
  allegation text is personal data about them — **Class-2 professional identity** under Rule
  12, a different data class from patient PHI, and a data subject ADR 0130's DSR workflow
  can return `granted` for with no door to call. This ADR is written about **PHI**; whether
  it also rules on Class-2 erasure is the PO's to confirm. Recorded in
  `FUP-ETHICS-LANE-NO-ERASURE-DOOR`'s closure note so the question is not lost inside a
  close.

## Rejected

**Widening the doors to their composition closure** (the Amendment 1 method applied to the
remaining three). Measured at 133 candidate columns; each widening carries a migration, a
pgTAP pin per column with its vacuity control, and an ADR amendment — and it erases
institutional governance content (findings, rationales, decisions) whose retention is
itself a regulatory duty. The pilot's value is in doing the confirmed set perfectly.
