import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CasePatient } from '@/lib/cases/types'
import type { DocumentPayload } from '@/lib/pdf/types'
import type { CaseDocumentBody } from '@/lib/pdf/types'
import type { CaseEvent } from '@/lib/queries/case-documents'

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

/**
 * `cases.label`. A KNOB rather than a constant because C-1's shape is a case
 * whose ONLY masked-class content is a patient name a clinician typed into the
 * label — and `case.ts` prints it in the `<h1>` of every dossier.
 */
let caseLabel = 'Evento adverso'

/**
 * `cases.phi_disposed_at is not null`, sourced from the DEFINER door. A KNOB
 * because it is now the SOLE input to `containsPhi`.
 */
let caseDisposed = false

/**
 * What `listCaseEvents` answers. A KNOB because the post-disposal timeline is
 * the shape that separates the constitutive rule from the deleted derivation in
 * the OTHER direction (see the disposal test below).
 */
let timelineAnswer: CaseEvent[] = []

vi.mock('@/lib/queries/cases', () => ({
  getCaseDetail: vi.fn(async () => ({
    case: {
      id: CASE_ID,
      caseNumber: 42,
      label: caseLabel,
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
    caseDisposed,
    revision: 0,
  })),
}))

vi.mock('@/lib/queries/case-tags', () => ({ listCaseTagsForCase: vi.fn(async () => []) }))
vi.mock('@/lib/queries/case-documents', () => ({
  listCaseEvents: vi.fn(async () => timelineAnswer),
}))
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

/**
 * The EPHEMERAL context. ⚠ Required for the disposed test and not
 * interchangeable with {@link CTX}: ADR 0144 D3 says a disposed case does not
 * register, so a `registered` context on a disposed case would build a state the
 * mint door refuses — the fixture would then be proving something about an
 * unreachable document. (`documentProvenance` would NOT catch it: `registered`
 * accepts either watermark, and only the `previa` arm has the fourth-cell guard.)
 */
const PREVIA_CTX = {
  kind: 'previa' as const,
  generation: { at: '2026-03-25T12:00:00.000Z', byDisplay: 'Maria Silva' },
}

async function buildPayload(
  includePhi: boolean,
  ctx: typeof CTX | typeof PREVIA_CTX = CTX,
): Promise<DocumentPayload> {
  const { buildCasePayload } = await import('./pdf-payload')
  return buildCasePayload(CASE_ID, ctx, { includePhi })
}

async function build(includePhi: boolean) {
  return (await buildPayload(includePhi)).body as CaseDocumentBody
}

beforeEach(() => {
  patientsAnswer = [PATIENT]
  caseLabel = 'Evento adverso'
  caseDisposed = false
  timelineAnswer = []
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

/**
 * ⭐⭐ **`containsPhi` — C-1's KEYSTONE.** ADR 0144 D6 as amended: the rule is
 * CONSTITUTIVE (`!caseDisposed`), not derived from the presence of masked-class
 * content.
 *
 * ⛔ **MUTATION-PROVEN, AND THE TABLE IS THE COVERAGE — NOT THIS FILE'S GREEN BAR.**
 * A mutation audit covers the set of mutations that were RUN, never the suite they
 * were run in. Three were run against the rule below, each restored after:
 *
 *   mutation applied to `containsPhi`        | observed RED
 *   -----------------------------------------|--------------------------------
 *   `hasMaskedFreeText || renderedPatient…`  | C-1 (t1) AND disposed (t2)
 *   `true`   (drop the `!caseDisposed` term) | disposed (t2) ONLY — t1 GREEN
 *   `false`                                  | C-1 (t1) AND fat-case (t3)
 *   `!caseDisposed` (the fix)                | none — 8/8 green
 *
 * ⭐ **THE `true` ROW IS WHY t2 HAD TO EXIST**, and it was `tester` that found the
 * gap rather than this file's author: t1 alone pins *constitutive vs
 * derive-from-presence*, but a regression collapsing the rule to a bare `true`
 * leaves t1 GREEN. The pair pins the RULE; either assertion alone pins one of its
 * outcomes. No constant satisfies both rows, which is the property that matters.
 *
 * ⚠ **t2 CANNOT BE WRITTEN IN E2E, AND THE REASON IS NOT SQUEAMISHNESS.**
 * `dispose_case_phi` redacts `cases.label`, and `pdf-printing-cases.spec.ts`
 * finds every fixture it owns by `label LIKE 'Caso PDFCASE-SPEC%'` — so disposing
 * a spec-owned case makes its own purge unable to find it and strands the
 * children in the SHARED local DB, which is where the spurious pgTAP
 * commission-count reds come from. ⛔ That is a sharper mechanism than the
 * accepted "disposal is irreversible against the seed" bound and must not be
 * collapsed into it. The disposal term is therefore reachable ONLY here.
 *
 * ⚠ Nor does the `CASE_DISPOSED` fingerprint fixture cover it: measured, that is a
 * hand-built `DocumentPayload` handed straight to the renderer, so it never calls
 * `buildCasePayload`. It proves the RENDERER degrades gracefully; it says nothing
 * about the PROVIDER deriving the flag.
 *
 * ⚠ **THE SHAPE IS CONSTRUCTED TO MATCH THE E2E CORRIDOR, DELIBERATELY.**
 * `e2e/pdf-printing-cases.spec.ts`'s bare-case corridor mints exactly this state
 * (`completed`, `has_patient = false`, no masked free text) and used to assert
 * `contains_phi === false` — calling it "the one shape where `contains_phi`
 * derives FALSE" and "recorded as a measurement". It was recording the DEFECT as
 * expected behaviour, so P3's green suite contained a test that would have gone
 * RED on correct behaviour. Building the unit fixture from the same four facts
 * couples the two layers by CONSTRUCTION rather than by discipline: if the
 * corridor's shape changes, this fixture reads wrong beside it.
 */
describe('buildCasePayload — `containsPhi` is constitutive (ADR 0144 D6 as amended)', () => {
  it("⭐⭐ C-1: a patient's name in `cases.label` and NOTHING else still bands PHI", async () => {
    // C-1's exact four facts, and every one of them is load-bearing:
    //  1. a patient name in the label — printed unconditionally in the `<h1>`,
    //     and REDACTED by `dispose_case_phi`, which is the platform's own
    //     statement that the field is masked-class;
    //  2. NO `patient_identifiers` row — so the deleted `renderedPatientField`
    //     term was false (this is the arm outside "sex is never null, so a
    //     with-patient case still derives true", the bound that read wider than
    //     it was);
    //  3. no narratives, no bodied events, no meeting notes, no referrals;
    //  4. no phase answers.
    caseLabel = 'Queda da paciente Maria Silva, leito 302'
    patientsAnswer = []
    timelineAnswer = []

    const payload = await buildPayload(false)

    // ⛔ THE ASSERTION. Pre-fix this was `false`, which chose
    // `documents-standard` ⇒ `sensitivity_tier = 'standard'` ⇒ `dispose_case_phi`
    // block (f) filters `'phi'` and SKIPS THE OBJECT, block (f2) revokes only
    // `where … and contains_phi` and SKIPS THE ROW. A PDF headed with the
    // patient's name survived an LGPD Art. 18 erasure, still `active`, never
    // band-marked.
    expect(
      payload.containsPhi,
      'a live case dossier ALWAYS carries masked-class content — the label alone suffices',
    ).toBe(true)

    // Non-vacuity control: the fixture really is the thin, no-patient shape, so
    // a `true` above cannot be coming from a patient block or a timeline the
    // fixture accidentally populated.
    const body = payload.body as CaseDocumentBody
    expect(body.patients, 'fixture: no patient row').toEqual([])
    expect(body.timeline, 'fixture: no events').toEqual([])
    expect(body.narratives, 'fixture: no narratives').toEqual([])
    expect(body.phases, 'fixture: no phases, so no answers').toEqual([])
    expect(body.title, 'fixture: the label IS the masked-class content').toContain(
      'Maria Silva',
    )
  })

  it('⭐ the disposed case keeps FALSE — post-redaction a band would be a false statement', async () => {
    // ⚠ THIS IS THE DIFFERENTIAL IN THE OPPOSITE DIRECTION, and the deleted rule
    // got it wrong too. `dispose_case_phi` REDACTS `case_events.body`/`.title` to
    // a marker rather than nulling them, and `CaseEvent.body` is typed
    // NON-NULLABLE anyway — so `timeline.some((e) => e.body !== null)` was TRUE
    // for any disposed case that retained a single event. The old rule therefore
    // banded a gutted dossier whose every rendered field reads "[PHI removido]".
    caseDisposed = true
    caseLabel = '[PHI removido]'
    patientsAnswer = []
    timelineAnswer = [
      {
        id: 'eeeeeeee-0000-0000-0000-000000000001',
        caseId: CASE_ID,
        kind: 'note',
        title: '[PHI removido]',
        body: '[PHI removido]',
        visibility: 'case_readers',
        occurredAt: '2026-03-10',
        occurredTime: null,
        createdBy: null,
        createdByName: 'Maria Silva',
        createdAt: '2026-03-10T12:00:00.000Z',
        updatedAt: '2026-03-10T12:00:00.000Z',
      },
    ]

    // ⚠ PRÉVIA context: a disposed case does not register (D3).
    const payload = await buildPayload(false, PREVIA_CTX)

    expect(
      payload.containsPhi,
      'the bytes carry redaction markers, not PHI — banding them would be false',
    ).toBe(false)

    // Non-vacuity control: the residual content the OLD rule keyed on is
    // genuinely present, so this `false` is the disposal term winning and not an
    // empty fixture agreeing by accident.
    const body = payload.body as CaseDocumentBody
    expect(body.timeline, 'fixture: a redacted event survives disposal').toHaveLength(1)
    expect(body.timeline[0]!.body, 'and its body is a MARKER, not null').toBe(
      '[PHI removido]',
    )
    expect(body.phiDisposed).toBe(true)
  })

  it('⭐ a FAT live case is true as well — the rule has no content arm left to disagree with', async () => {
    // The no-regression leg: the shape the old rule got RIGHT still holds.
    //
    // ⚠ CORRECTED AFTER MEASURING, because the first draft of this comment called
    // it "green under both rules by construction, which is why it is a control
    // and not a keystone." Half true. It is green under the restored disjunction
    // AND under a bare `true` — but it REDS under a bare `false`, so it is a real
    // differential against that one mutation, not an inert control. Calling a
    // measured assertion inert is how a suite's coverage gets under-read.
    patientsAnswer = [PATIENT]
    timelineAnswer = []
    const payload = await buildPayload(true)
    expect(payload.containsPhi).toBe(true)
    expect((payload.body as CaseDocumentBody).variant).toBe('identified')
  })
})
