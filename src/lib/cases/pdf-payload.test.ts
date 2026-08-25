import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CasePatient } from '@/lib/cases/types'
import type { CaseDocumentBody } from '@/lib/pdf/types'

/**
 * `buildCasePayload`'s PATIENT MAPPING — the read→render seam (PDF·P3, ADR 0144 D5).
 *
 * ⭐ **THIS FILE EXISTS BECAUSE NOTHING COVERED THAT SEAM AND A REAL BUG SHIPPED
 * THROUGH IT.** `BUG-P3-PATIENT-FIELD-MAPPING`: the provider read the door's
 * result through `as RawPatientRow[] | null`, a hand-written SNAKE_case type,
 * while `getCasePatients` returns CAMEL_case `CasePatient`. Five field names are
 * identical in both shapes and three are not, so `ageYears` / `dateOfBirth` /
 * `encounterRef` silently read `undefined` — including AGE, one third of D5's
 * de-identification floor, on a dossier justified by *"strip it and the ONA
 * demand gets a dossier about nobody"*.
 *
 * ⚠ **Three separate safety nets failed to see it, which is why the test is
 * here rather than anywhere else:**
 *  - `tsc` was silenced by the `as` cast (now deleted — a snake_case read is a
 *    compile error again, verified);
 *  - the PAGE could not show it: ADR 0144 Amendment 2 pt 3 renders a missing
 *    demographic with NO MARKER, so the omission was indistinguishable from a
 *    legitimate entitlement-driven absence to reader and reviewer alike;
 *  - pgTAP cannot reach it at all — the bug is entirely above the database, and
 *    `368` correctly proves the DOOR while saying nothing about its caller.
 *
 * ⛔ **ASSERT BY NAME, NEVER BY SNAPSHOT.** A snapshot of the patient block would
 * have been written against the buggy output and frozen the bug in place as the
 * expected value. Every field below is named and checked individually, so the
 * next shape change names the field it broke.
 *
 * ⚠ `patient-payload.test.ts` (no `pdf-` prefix) is the WRITE path and is
 * unrelated — the similar name is why this gap read as covered.
 */

const CASE_ID = '11111111-2222-3333-4444-555555555555'

const PATIENT: CasePatient = {
  participantId: 'aaaaaaaa-0000-0000-0000-000000000001',
  name: 'Fulana de Tal',
  mrn: 'PR-998877',
  dateOfBirth: '1958-09-04',
  ageYears: 67,
  sex: 'female',
  encounterRef: 'ATD-2026-0042',
  unit: 'UTI Adulto',
  attending: 'Dr. Beltrano',
  updatedAt: '2026-03-01T12:00:00.000Z',
}

/** What the door returns, per test. Set before each call. */
let patientsAnswer: CasePatient[] | null = [PATIENT]

vi.mock('@/lib/queries/cases', () => ({
  getCaseDetail: vi.fn(async () => ({
    case: {
      id: CASE_ID,
      caseNumber: 42,
      label: 'Evento adverso',
      status: 'completed',
      commissionId: 'cccccccc-0000-0000-0000-000000000001',
      createdAt: '2026-03-01T12:00:00.000Z',
      closedAt: '2026-03-20T12:00:00.000Z',
      departmentName: 'UTI',
      departmentOther: null,
    },
    phases: [],
    participants: [],
    narratives: [],
    outcome: null,
    terminology: null,
    confidentialityLevel: 'phi_standard',
  })),
  getCasePatients: vi.fn(async () => patientsAnswer),
}))

vi.mock('@/lib/queries/printed-documents', () => ({
  getCasePrintContext: vi.fn(async () => ({
    commissionName: 'CCIH',
    hospitalName: 'Hospital de Teste',
    status: 'completed',
    caseDisposed: false,
    revision: 0,
  })),
}))

vi.mock('@/lib/queries/case-tags', () => ({ listCaseTagsForCase: vi.fn(async () => []) }))
vi.mock('@/lib/queries/case-documents', () => ({ listCaseEvents: vi.fn(async () => []) }))
vi.mock('@/lib/queries/case-timeline', () => ({ listCaseMeetings: vi.fn(async () => []) }))
vi.mock('@/lib/queries/case-action-items', () => ({ listCaseActionItems: vi.fn(async () => []) }))
vi.mock('@/lib/queries/corrections', () => ({ listCaseCorrectionRequests: vi.fn(async () => []) }))
vi.mock('@/lib/queries/documents', () => ({ listDocumentsForResource: vi.fn(async () => []) }))
vi.mock('@/lib/queries/document-hashes', () => ({
  listCaseDocumentHashes: vi.fn(async () => new Map<string, string>()),
}))
vi.mock('@/lib/queries/interviews', () => ({
  listCaseInterviews: vi.fn(async () => []),
  getInterviewDetail: vi.fn(async () => null),
  listInterviewSubjects: vi.fn(async () => []),
  listInterviewInterviewers: vi.fn(async () => []),
}))
vi.mock('@/lib/queries/referrals', () => ({
  listCaseOutboundReferrals: vi.fn(async () => []),
  getReferralDetail: vi.fn(async () => null),
}))
vi.mock('@/lib/forms/pdf-payload', () => ({ buildResponseSections: vi.fn(async () => null) }))

/**
 * ⚠ A **REGISTERED** context, not a prévia — and the first draft of this fixture
 * got it wrong in an instructive way. The mocked case is `completed` and
 * undisposed, so `printSourceWatermark('case', …)` answers `'final'`; pairing
 * that with a `previa` context is ADR 0125 D5's forbidden FOURTH CELL, and
 * `documentProvenance` refused the payload before the patient block was ever
 * built. The seam guard was right and the fixture was wrong — a terminal case is
 * exactly the state that MINTS.
 */
const CTX = {
  kind: 'registered' as const,
  qr: {
    token: 'abcdefghijklmnopqrstuvwxyz012345',
    shortCode: 'ABCDEFGHJK',
    url: 'https://x.invalid/verificar/abcdefghijklmnopqrstuvwxyz012345',
  },
  emission: { at: '2026-03-20T12:00:00.000Z', byDisplay: 'Maria Silva' },
}

async function build(includePhi: boolean) {
  const { buildCasePayload } = await import('./pdf-payload')
  const payload = await buildCasePayload(CASE_ID, CTX, { includePhi })
  return payload.body as CaseDocumentBody
}

beforeEach(() => {
  patientsAnswer = [PATIENT]
})

describe('buildCasePayload — the D5 patient field mapping', () => {
  it('⭐ IDENTIFIED renders all EIGHT fields — each asserted by name', async () => {
    const body = await build(true)
    expect(body.variant).toBe('identified')
    expect(body.patients).toHaveLength(1)
    const p = body.patients[0]!

    // The three that BUG-P3-PATIENT-FIELD-MAPPING silently dropped. Each one
    // read `undefined` through the deleted cast and rendered as nothing.
    expect(p.ageDisplay, 'age_years -> ageYears').toBe('67 anos')
    expect(p.dateOfBirthDisplay, 'date_of_birth -> dateOfBirth').not.toBeNull()
    expect(p.dateOfBirthDisplay).toContain('1958')
    expect(p.encounterRef, 'encounter_ref -> encounterRef').toBe('ATD-2026-0042')

    // The five that survived only because the two shapes spell them the same.
    // ⚠ Asserted anyway: they are the CONTROL. If the mapping broke wholesale
    // these would fail too, which distinguishes "three fields renamed" from
    // "the patient block is empty".
    expect(p.name).toBe('Fulana de Tal')
    expect(p.mrn).toBe('PR-998877')
    expect(p.sexDisplay).toBe('Feminino')
    expect(p.unitDisplay).toBe('UTI Adulto')
    expect(p.attending).toBe('Dr. Beltrano')
  })

  it('⭐ DE-IDENTIFIED keeps the full D5 floor and NONE of the identifiers', async () => {
    const body = await build(false)
    expect(body.variant).toBe('deidentified')
    const p = body.patients[0]!

    // The floor — all THREE. `ageDisplay` was the field the bug dropped here,
    // leaving a de-identified dossier with only sex and unit: a third of the
    // floor D5 says is what makes the tracer's read clinically meaningful.
    expect(p.ageDisplay, 'the de-identification floor must include AGE').toBe('67 anos')
    expect(p.sexDisplay).toBe('Feminino')
    expect(p.unitDisplay).toBe('UTI Adulto')

    // …and the five identified-only fields, each explicitly null.
    expect(p.name).toBeNull()
    expect(p.mrn).toBeNull()
    expect(p.dateOfBirthDisplay).toBeNull()
    expect(p.attending).toBeNull()
    expect(p.encounterRef).toBeNull()
  })

  it('⭐ the identified variant is derived from the ANSWER, not the request', async () => {
    // An identified REQUEST that produced no identifiers must never be labelled
    // `identified` — `templateFor` would mint it into the identified series and
    // supersede a real identified dossier with one carrying no identifiers.
    patientsAnswer = []
    await expect(build(true)).rejects.toThrow(/não possui dados de paciente/i)
  })
})

/**
 * ⛔ **THIS BLOCK DOES NOT COVER `BUG-P3-PHI-REFUSAL-MESSAGE`'S ROOT CAUSE, AND
 * MUST NOT BE READ AS DOING SO.** It asserts the bug's exact SYMPTOM — two
 * different pt-BR messages — but this file mocks `@/lib/queries/cases`
 * wholesale, so the real `getCasePatients` never runs. Re-introducing the
 * original collapse (`if (!data) return []`) into that function leaves every
 * assertion below **GREEN**; measured, not assumed.
 *
 * ⇒ What it genuinely covers is that the PROVIDER routes three distinct answers
 * to three distinct outcomes, which is worth keeping. The DOOR's half — that
 * three distinct answers are still PRODUCED — lives in
 * `src/lib/queries/case-patients-door.test.ts`, which mocks the Supabase client
 * instead and does red on that mutation.
 *
 * ⚠ A test that mocks the module containing the bug can assert the bug's symptom
 * and still be blind to it.
 */
describe('buildCasePayload — the three-answer contract (provider half only)', () => {
  it('⭐⭐ null (UNENTITLED) and [] (NO PHI ON FILE) give DIFFERENT messages', async () => {
    patientsAnswer = null
    const unentitled = await build(true).catch((e: Error) => e.message)

    patientsAnswer = []
    const empty = await build(true).catch((e: Error) => e.message)

    expect(unentitled).toMatch(/sem autorização/i)
    expect(empty).toMatch(/não possui dados de paciente/i)
    // ⛔ THE LOAD-BEARING ASSERTION. `getCasePatients` used to collapse `null`
    // into `[]`, so both produced the second message — telling a caller NOT
    // ENTITLED to know the case's contents that the case HAS NO PATIENT DATA: a
    // false statement about a record, made to the one person who must not be
    // told, and a false diagnostic for whoever was asked to fix the access
    // problem. Equality here is the bug.
    expect(unentitled).not.toBe(empty)
  })

  it('⭐ DE-IDENTIFIED tolerates null — an unentitled minter still gets a dossier', async () => {
    // ADR 0144 D14's floor: "case-view WITHOUT the PHI door → de-identified
    // ALLOWED". A throw here would stop a granted content-reader minting at all.
    patientsAnswer = null
    const body = await build(false)
    expect(body.variant).toBe('deidentified')
    // ⚠ NO demographics, and NO marker either (Amendment 2 pt 3) — absence and
    // withholding must look identical, or the page prints the minter's
    // entitlement.
    expect(body.patients).toEqual([])
  })
})
