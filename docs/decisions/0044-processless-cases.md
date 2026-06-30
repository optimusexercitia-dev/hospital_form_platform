# 0044 — Process-less cases ("Sem processo")

- **Status:** Accepted (2026-06-29) · feature flag `processless_cases` (ON in seed)
- **Extends:** ADR [0017](0017-multi-phase-cases.md) (multi-phase cases / `add_ad_hoc_phase`),
  ADR [0024](0024-case-model-adjustments.md) (case outcomes — `case_outcomes` /
  `case_offered_outcomes`), ADR [0038](0038-case-patient-identifiers.md) (`case_patient` PHI).

## Context

A `Case` could only be minted from a published process template
(`create_case_from_template`, which hard-requires an `active` template). Coordinators
need to open a case for an ad-hoc issue that fits no pre-built process, while still
tracking it like any other case. The schema already supported this with almost no
change: `cases.template_id` is nullable; the offered-outcome set lives in the per-case
`case_offered_outcomes` (decoupled from the template — the template merely *populates*
it); ad-hoc phases (`case_phases.is_ad_hoc`) already exist; and PHI is already written
atomically at creation. `add_ad_hoc_phase`, `close_case` (HC031/HC028), `get_case_detail`,
the detail view, and the cases board all already tolerate a NULL `template_id`.

## Decisions

1. **A process-less case = `template_id` NULL, zero phases at creation**, growing ad-hoc
   phases later via the existing `add_ad_hoc_phase`. No new phase machinery.
2. **Entry point:** keep the single "Novo caso" button; a top sentinel dropdown option
   **"Sem processo"** switches the dialog into a **two-step wizard** (step 1 = label +
   outcome config + PHI toggle; step 2 = PHI fields, reachable only when the PHI toggle is on).
3. **Outcomes:** an "Emite desfecho?" toggle lets the coordinator pick an offered-outcome
   subset directly from the commission `case_outcomes` vocabulary (inline "Criar novo
   desfecho" allowed). A non-empty offered set ⇒ an outcome is required at conclusion
   (existing **HC028**). The offered set is **editable while the case is non-terminal**
   via `set_case_offered_outcomes` (coordinator-only). This **deliberately breaks** the
   templated-case "frozen offered set" rule (ADR 0024 D15) — a process-less case has no
   template, so the case itself is its authoring surface. **v1 exposes the editor for
   process-less cases only**; templated cases stay frozen by design (widening later is a
   one-line FE gate change). Removing the **currently-assigned** outcome is blocked (**HC029**).
4. **PHI:** an explicit "Registra identificadores de paciente?" toggle sets
   `patient_enabled = true` (PHI enterable now or later from the detail panel) — a
   minimum-necessary opt-in (the analog of a template's `collects_patient`). Identifiers
   are written atomically with creation (reusing `writeCasePatient`); entering them stays
   optional even when the toggle is on.
5. **New RPCs** (migration `20260630000006_processless_cases.sql`), both `SECURITY DEFINER`,
   coordinator-gated (`is_staff_admin_of(commission) OR is_admin()`), no new RLS shape:
   - `create_case(p_commission_id, p_label, p_patient_enabled, p_outcome_ids[])` — template-less
     minter mirroring `create_case_from_template` minus all template machinery (HC030
     same-commission/non-archived outcome validation; bounded mint retry; **no** phases /
     narratives / recompute; **no** creation audit, matching the template minter).
   - `set_case_offered_outcomes(p_case_id, p_outcome_ids[])` — non-terminal editor (HC025
     terminal, HC029 can't-drop-assigned, HC030 mismatch); emits one PHI-free
     `case.offered_outcomes_set` audit row.
6. **Feature flags:** new `processless_cases` gates the sentinel option + `create_case`
   (own dark-launch / kill-switch); the outcome sub-step is additionally gated by
   `cases_extras`, the PHI toggle by `case_patient` — the dialog adapts when either is off.
7. **A muted "Sem processo" badge** marks `template_id IS NULL` on the case-detail header.

## Consequences

- One intentional divergence from ADR 0024 D15: process-less cases' offered sets are
  mutable (coordinator, non-terminal); templated cases remain immutable. Documented in the
  `set_case_offered_outcomes` RPC comment.
- Verification: pgTAP `177_processless_cases.sql` + E2E `e2e/processless-cases.spec.ts`.
