import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `getCasePatients` — THE THREE-ANSWER CONTRACT AT THE DOOR ITSELF
 * (ADR 0144 Amendment 2 pt 5; the substrate brief's `null` / `[]` / rows table).
 *
 * ⭐⭐ **THIS FILE EXISTS BECAUSE THE OBVIOUS TEST WAS VACUOUS, AND THE MUTATION
 * AUDIT IS THE ONLY REASON THAT WAS DISCOVERED.**
 *
 * `src/lib/cases/pdf-payload.test.ts` asserts that an unentitled caller and an
 * empty case produce DIFFERENT pt-BR messages — the exact symptom of
 * `BUG-P3-PHI-REFUSAL-MESSAGE`. It passes. But it mocks `@/lib/queries/cases`
 * wholesale, so it never executes the real `getCasePatients` at all: it proves
 * the PROVIDER distinguishes three answers, and says nothing about whether the
 * DOOR still produces three. Re-introducing the original bug
 * (`if (!data) return []`) into `getCasePatients` left that suite **fully
 * green** — the fixture could not reach the failing state.
 *
 * ⇒ This suite mocks one layer LOWER, at the Supabase client, so the real
 * `getCasePatients` body runs. It is the half that actually covers the bug.
 *
 * ⚠ The generalisable lesson, because it cost a real defect once already: a test
 * that mocks the module CONTAINING the bug can assert the bug's exact symptom
 * and still be blind to it. Mock the boundary BELOW the code under test, never
 * the code under test.
 */

/** What the RPC hands back, per test. */
let rpcResult: unknown = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc: vi.fn(async () => ({ data: rpcResult, error: null })),
  })),
}))

const CASE_ID = '11111111-2222-3333-4444-555555555555'

const ROW = {
  participant_id: 'aaaaaaaa-0000-0000-0000-000000000001',
  name: 'Fulana de Tal',
  mrn: 'PR-998877',
  date_of_birth: '1958-09-04',
  age_years: 67,
  sex: 'female',
  encounter_ref: 'ATD-2026-0042',
  unit: 'UTI Adulto',
  attending: 'Dr. Beltrano',
  updated_at: '2026-03-01T12:00:00.000Z',
}

beforeEach(() => {
  rpcResult = null
})

describe('getCasePatients: null / [] / rows are three DISTINGUISHABLE answers', () => {
  it('⭐⭐ NULL from the RPC (out of scope) comes back as NULL, not []', async () => {
    // ⛔ THE REGRESSION TEST FOR BUG-P3-PHI-REFUSAL-MESSAGE. The door used to do
    // `if (!data) return []`, collapsing "you may not know" into "there is
    // nothing to know" — so the dossier told a caller NOT ENTITLED to know the
    // case's contents that the case had no patient data. A false statement about
    // a record, made to the one person who must not be told, and a false
    // diagnostic for whoever was then asked to fix the access problem.
    rpcResult = null
    const { getCasePatients } = await import('./cases')
    expect(await getCasePatients(CASE_ID)).toBeNull()
  })

  it('⭐⭐ EMPTY from the RPC (entitled, no PHI on file) comes back as [] — NOT null', async () => {
    // The other arm, and the one that makes the first meaningful. Asserting only
    // "null stays null" would be satisfied by a door that returned null for
    // everything, which would flip the bug rather than fix it: every
    // entitled-but-empty case would then refuse the mint with an authorization
    // error. The PAIR is the contract.
    rpcResult = []
    const { getCasePatients } = await import('./cases')
    expect(await getCasePatients(CASE_ID)).toEqual([])
  })

  it('rows come back MAPPED to the camelCase domain shape', async () => {
    // ⚠ Also the anchor for BUG-P3-PATIENT-FIELD-MAPPING's other half: this is
    // where snake_case becomes camelCase, and it is the shape `pdf-payload.ts`
    // must read. Asserting the three RENAMED fields by name is what makes the
    // rename visible from both sides of the seam.
    rpcResult = [ROW]
    const { getCasePatients } = await import('./cases')
    const rows = await getCasePatients(CASE_ID)
    expect(rows).toHaveLength(1)
    expect(rows![0]!.ageYears, 'age_years -> ageYears').toBe(67)
    expect(rows![0]!.dateOfBirth, 'date_of_birth -> dateOfBirth').toBe('1958-09-04')
    expect(rows![0]!.encounterRef, 'encounter_ref -> encounterRef').toBe('ATD-2026-0042')
    expect(rows![0]!.name).toBe('Fulana de Tal')
    expect(rows![0]!.mrn).toBe('PR-998877')
    expect(rows![0]!.unit).toBe('UTI Adulto')
    expect(rows![0]!.attending).toBe('Dr. Beltrano')
    expect(rows![0]!.sex).toBe('female')
  })

  it('⚠ the three answers are MUTUALLY distinguishable, not merely non-null', async () => {
    // The property the platform actually depends on, asserted as one statement:
    // three inputs, three outcomes, no two equal. `[]` and `null` are the pair
    // that collapsed; the row case is here so "all three differ" is not
    // satisfied by two of them being the same empty thing.
    const { getCasePatients } = await import('./cases')
    rpcResult = null
    const a = await getCasePatients(CASE_ID)
    rpcResult = []
    const b = await getCasePatients(CASE_ID)
    rpcResult = [ROW]
    const c = await getCasePatients(CASE_ID)

    expect(a).toBeNull()
    expect(b).not.toBeNull()
    expect(b).toHaveLength(0)
    expect(c).toHaveLength(1)
  })
})
