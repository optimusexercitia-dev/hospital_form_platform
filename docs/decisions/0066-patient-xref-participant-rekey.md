# 0066 — patient_xref case-module grain re-keyed to the patient participant

**Date:** 2026-07-10 · **Status:** accepted (implemented in F1) · **Owner:** `backend`
**Implements:** the R3 / Q1 ruling of the [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md) F1 build.
**Relates:** ADR [0064](./0064-case-subject-generalization-participants.md) (Decision 3, R3 —
the `case_patient → patient_identifiers` N-per-case re-key), ADR
[0039](./0039-patient-identity-cross-committee-linkage.md) (the HMAC `patient_xref`
cross-committee linkage), ADR [0056] (disposal completeness), ADR
[0065](./0065-pre-pilot-foundations-conventions.md) §9 (live-catalog facts).
**Binding rules:** Rule 11 (audit/linkage integrity), Rule 12 (PHI Class 1).

## Context

`patient_xref` (ADR 0039) is the key-only cross-committee linkage surface. Its PK is
`(module, entity_id)`; for the `case` module `entity_id` was the **`case_id`** (one xref
contribution per case, maintained by a trigger on `case_patient`, which was 1-per-case).

F1 (ADR 0064 Decision 3) re-keys the case patient satellite from **1-per-case** to
**N-per-case**: `case_patient(PK case_id)` becomes `patient_identifiers(PK participant_id)`,
one row per patient participant. A case can now carry several patients (e.g. an ethics
case with an affected patient *and* a patient-complainant). The old
"one xref row per case" grain can no longer represent this, and ADR 0064 R3 requires
`dispose_case_phi` to purge **each** patient participant's `patient_xref` row.

The lead ruled (F1 build, Q1 → **Option A**): re-point the case-module `entity_id` to the
**patient participant** rather than keeping `case_id` and widening the PK.

## Decision

For the `case` module, `patient_xref.entity_id` is now the **`participant_id`** of the
patient participant (not the `case_id`). Concretely:

- The xref-maintenance trigger moves from `case_patient` to `patient_identifiers`
  (`app.trg_xref_maintain_patient_identifiers`), inserting/updating/disposing one xref row
  **per patient participant**, keyed `(module='case', entity_id=participant_id)`. Commission
  is resolved via the participant's case (`app.case_of_patient_participant` →
  `commission_of_case`).
- `dispose_case_phi` deletes every `patient_identifiers` row of the case's patient
  participants; each DELETE fires the trigger, stamping that participant's xref row
  `disposed_at`/`disposed_reason` (R3 per-participant purge).
- The `event` and `referral` modules are **unchanged** — they remain 1-per-entity keyed by
  `event_id` / `referral_id`.
- Callers that resolve a `case`-module trajectory (`get_patient_trajectory_for_entity`,
  `search_patient_xref`, `patient_xref_count`, and their `src/lib/queries/patient-index.ts`
  wrappers) now pass a **`participant_id`** as the case entity, not a `case_id`.

## Rationale

- **Correct grain.** N-per-case linkage genuinely needs a per-patient key; overloading
  `case_id` cannot distinguish two patients on one case.
- **Cleaner than widening the PK.** The rejected Option B (`(module, entity_id,
  participant_id)` PK) complicates the module CHECK/uniqueness and every cross-module read
  for no benefit — the participant *is* the natural per-patient key.
- **Safe precisely because it is pre-pilot.** `case_patient` ships **flag-OFF**, so there is
  zero production PHI and zero live xref data to migrate — the whole point of doing the
  re-key pre-pilot (ADR 0064 Decision 3; ADR 0065 §6 freeze principle). Local/seed rework
  only.

## Consequences

- **Phase-23 (cross-committee patient identity) linkage from the case module changes
  grain.** A case now contributes one linkage node per patient participant instead of one
  per case. Phase-23 trajectory over case entities must be built/expected on the participant
  key. Recorded here so a future Phase-23 implementer does not assume the case is the case
  entity.
- **Disposal completeness preserved (ADR 0056).** Per-participant purge stamps every xref
  row; the `152_patient_index` pgTAP keystone is reworked to the participant grain and a new
  F1 keystone asserts disposal purges each patient participant's xref row.
- **`patient-index.ts` + trajectory RPC signature churn** is accepted (lead Q1) and lands in
  F1; no back-compat shim (reset-OK).
- The `patient_xref.module_check` (`event|referral|case`) and the PK `(module, entity_id)` are
  **unchanged** — only the *meaning* of `entity_id` for the `case` module changes.
