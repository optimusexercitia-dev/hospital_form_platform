import type { SetCasePatientInput } from '@/lib/cases/types'

/**
 * The creation-scoped patient payload and its NON-PHI structural echo
 * (ADR 0134 Amendment 2 option D).
 *
 * Extracted from `actions.ts` so it can be unit-tested. That module is `'use server'`,
 * and such a module may export ONLY async functions — so a synchronous helper inside it
 * is unreachable from any test, whatever its visibility. That is not a style point here:
 * {@link patientFieldsSet} is the function enforcing a **PHI boundary**, and it had no
 * test of its own for exactly this reason.
 */

/**
 * snake_case keys, read with `->>` by all three creation RPCs — the same object shape
 * `bulk_create_cases` already takes per row, so one payload contract covers every door.
 */
export function patientRpcPayload(input: SetCasePatientInput) {
  return {
    name: input.name,
    mrn: input.mrn,
    date_of_birth: input.dateOfBirth,
    age_years: input.ageYears,
    sex: input.sex,
    encounter_ref: input.encounterRef,
    unit: input.unit,
    attending: input.attending,
  }
}

/**
 * ⛔ FIELD NAMES ONLY — NEVER VALUES. This is the function that makes the creation
 * response carry *which* identifiers were recorded without carrying *what* they are.
 *
 * ⚠ IT ENFORCES A PO-LEVEL NARROWING, WHICH IS WHY IT IS PINNED BESIDE ITSELF. ADR 0134
 * §A2.4 risk 2 asks the creation response to "echo the identifiers just written" so a
 * typo is caught at the keyboard rather than months later by a coordinator who cannot
 * know who typed it. That was deliberately narrowed: option D grants a PHI **write** and
 * **no read, ever**, so a response body carrying identifier VALUES back to a principal
 * holding no `read_standard_phi` would be a PHI read path wearing a different name. The
 * user's confirmation is built client-side from the payload they just submitted — which
 * they already hold — and the server contributes only the structural half.
 *
 * ⛔ If a later change makes this return values, NOTHING ELSE IN THE TREE WOULD NOTICE.
 * A `readonly string[]` return type accepts `["MRN-4471"]` exactly as happily as
 * `["mrn"]`, and erases at compile time — so the type is not the control and pinning it
 * would be pinning nothing. `patient-payload.test.ts` is the control.
 *
 * `sex` is excluded deliberately: it always carries a value (it defaults to `'unknown'`),
 * so reporting it would tell the user nothing about what they typed.
 */
export function patientFieldsSet(input: SetCasePatientInput): readonly string[] {
  const payload = patientRpcPayload(input)
  return Object.entries(payload)
    .filter(([key, value]) => key !== 'sex' && value !== null && value !== undefined && value !== '')
    .map(([key]) => key)
}
