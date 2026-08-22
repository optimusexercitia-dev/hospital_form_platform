import { describe, it, expect } from 'vitest'

import { patientFieldsSet, patientRpcPayload } from './patient-payload'
import type { SetCasePatientInput } from './types'

/**
 * ⛔ THIS TEST EXISTS BECAUSE A PO-LEVEL NARROWING HAS NO OTHER ENFORCEMENT.
 * ADR 0134 §A2.4 risk 2 asked the creation response to echo the identifiers just
 * written; that was narrowed deliberately, because option D grants a PHI **write** and no
 * read — so a response carrying identifier VALUES to a principal holding no
 * `read_standard_phi` would be a PHI read path wearing a different name.
 * {@link patientFieldsSet} is the whole of that enforcement. If a later change makes it
 * return values, nothing else in the tree would notice.
 *
 * ⛔ NOT A TYPE TEST. `readonly string[]` accepts `["MRN-4471"]` exactly as happily as
 * `["mrn"]` and erases at compile time, so asserting the type constrains nothing about
 * what the function returns. Every assertion below is on the VALUE.
 *
 * ⭐ CANARY SHAPE. The input's values are distinctive strings that could not occur as
 * field keys, and each absence assertion is paired with a positive showing the same
 * string IS present in the payload the RPC receives. Without that pairing, "the values
 * are absent" would pass just as well against a function that returned nothing at all.
 */

const CANARY = {
  name: 'CANARY-NOME-4471',
  mrn: 'CANARY-MRN-9930',
  dateOfBirth: '1970-01-02',
  ageYears: 55,
  sex: 'female',
  encounterRef: 'CANARY-ENC-7781',
  unit: 'CANARY-UNI-3312',
  attending: 'CANARY-ATD-6650',
} satisfies SetCasePatientInput

const CANARY_VALUES = [
  'CANARY-NOME-4471',
  'CANARY-MRN-9930',
  'CANARY-ENC-7781',
  'CANARY-UNI-3312',
  'CANARY-ATD-6650',
]

describe('patientFieldsSet — field names, never values', () => {
  it('returns the field KEYS the caller supplied', () => {
    expect([...patientFieldsSet(CANARY)].sort()).toEqual(
      ['attending', 'age_years', 'date_of_birth', 'encounter_ref', 'mrn', 'name', 'unit'].sort(),
    )
  })

  // ⭐ THE POSITIVE HALF OF THE CANARY: these exact strings really do travel to the RPC,
  // so their absence from the echo below is a property of the echo, not of the fixture.
  it('CONTROL: the same canary values ARE present in the RPC payload', () => {
    const sent = JSON.stringify(patientRpcPayload(CANARY))
    for (const value of CANARY_VALUES) expect(sent).toContain(value)
  })

  it('⭐ carries NONE of the identifier values', () => {
    const echo = JSON.stringify(patientFieldsSet(CANARY))
    for (const value of CANARY_VALUES) expect(echo).not.toContain(value)
  })

  it('carries no value even when a value happens to look like a key', () => {
    // An adversarial input: if the implementation ever returned values, this is the case
    // where a keys-only assertion could not tell the difference.
    const echo = patientFieldsSet({ ...CANARY, name: 'mrn', mrn: 'CANARY-MRN-9930' })
    expect(echo).not.toContain('CANARY-MRN-9930')
    expect([...echo].sort()).toEqual(
      ['attending', 'age_years', 'date_of_birth', 'encounter_ref', 'mrn', 'name', 'unit'].sort(),
    )
  })

  it('omits fields the caller left blank, so it reports what was actually recorded', () => {
    const sparse = {
      ...CANARY,
      dateOfBirth: null,
      ageYears: null,
      encounterRef: '',
      unit: null,
      attending: null,
    } satisfies SetCasePatientInput
    expect([...patientFieldsSet(sparse)].sort()).toEqual(['mrn', 'name'].sort())
  })

  it('excludes `sex` deliberately — it always has a value, so it reports nothing typed', () => {
    expect(patientFieldsSet(CANARY)).not.toContain('sex')
  })
})
