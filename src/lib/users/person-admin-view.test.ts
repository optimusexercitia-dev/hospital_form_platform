import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AFF2 B6 — `getPersonAdminView`, the authorized detail-page read (ADR 0133 D9/D10/D12 +
 * D1–D4 as amended by Amendment 1 ruling 1).
 *
 * ⛔ WHY THE EVIDENCE HERE IS MUTATION-BASED, NOT TEMPORAL RED-FIRST. B6 is a NEW module,
 * so running these before it existed would have produced "cannot resolve import" — a red
 * that proves the file is absent and NOTHING about whether the assertions discriminate.
 * That is the vacuous-red trap in its purest form. Instead each load-bearing assertion was
 * run against a deliberately mutated implementation and REQUIRED to fail; the mutations and
 * their observed reds are named on the arms below. This is strictly stronger evidence than
 * a temporal red, because it tests the assertion rather than the calendar.
 *
 * ⭐ THE ASSERTION THIS FILE EXISTS FOR IS §2: withheld and not-informed must be SEPARATELY
 * OBSERVABLE. If `personalData` came back as `{ dateOfBirth: null }` for a caller who may
 * not see it, F2 renders "Não informado" for a person who HAS a birth date — an empty cell
 * silently meaning "no permission", which is the state this codebase bans and the reason
 * ADR 0133 D13 widened the credential read in the first place. The distinction is carried
 * by the TYPE (outer null vs inner null); these arms are what keep it non-decorative.
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const ORG_B = '0c000000-0000-0000-0000-00000000000b'
const HOSP_A = '05000000-0000-0000-0000-00000000000a'
const HOSP_B = '05000000-0000-0000-0000-0000000000a2'
const TARGET = '00000000-0000-0000-0000-000000000002'

const CPF_DIGITS = '11144477735'
const DOB = '1979-04-11'
const PHONE = '11987654321'

interface SessionShape {
  userId: string
  isInactive: boolean
  isAdmin: boolean
  orgAdminOf: { organization: { id: string } }[]
  hospitalAdminOf: { hospital: { id: string }; organization: { id: string } }[]
}

const orgAdminSession: SessionShape = {
  userId: 'b1',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [{ organization: { id: ORG_A } }],
  hospitalAdminOf: [],
}
/** Administers HOSP_A only, in the target's org. */
const hospitalAdminSession: SessionShape = {
  userId: 'e1',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [],
  hospitalAdminOf: [{ hospital: { id: HOSP_A }, organization: { id: ORG_A } }],
}
/** Administers both HOSP_A and HOSP_B — the whole cross-hospital footprint. */
const dualHospitalAdminSession: SessionShape = {
  userId: 'e3',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [],
  hospitalAdminOf: [
    { hospital: { id: HOSP_A }, organization: { id: ORG_A } },
    { hospital: { id: HOSP_B }, organization: { id: ORG_A } },
  ],
}
/** Administers a hospital in ANOTHER org — D1(a) must not count it. */
const foreignOrgAdminSession: SessionShape = {
  userId: 'e9',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [],
  hospitalAdminOf: [{ hospital: { id: HOSP_A }, organization: { id: ORG_B } }],
}

let session: SessionShape = orgAdminSession
let rows: Record<string, unknown> = {}
/** Every column list the read selects, so §5 can prove what it asked the DB for. */
let selects: { table: string; columns: string }[] = []

vi.mock('@/lib/queries/session', () => ({
  getSessionContext: async () => session,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(),
}))

function makeAdmin() {
  const builder = (table: string) => {
    const self: Record<string, unknown> = {}
    self.select = (columns: string) => {
      selects.push({ table, columns })
      return self
    }
    for (const m of ['eq', 'is', 'in', 'not', 'order', 'limit', 'returns']) {
      self[m] = () => self
    }
    self.maybeSingle = async () => ({ data: rows[table] ?? null, error: null })
    self.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
      resolve({ data: rows[table] ?? [], error: null })
    return self
  }
  return { from: (table: string) => builder(table) }
}

/** Sole footprint at HOSP_A, commission-tier only. */
function footprintSoleHospital(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_A }]
  rows.memberships = [
    { commission_id: 'c-a', hospital_id: null, commissions: { hospital_id: HOSP_A } },
  ]
}
/** Serves HOSP_A and HOSP_B — intersection yes, subset no (for a HOSP_A-only admin). */
function footprintCrossHospital(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_A }, { hospital_id: HOSP_B }]
  rows.memberships = []
}
/** A hospital-tier seat ⇒ org_admin-only for every capability (D2). */
function footprintHospitalTier(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_A }]
  rows.memberships = [{ commission_id: null, hospital_id: HOSP_A, commissions: null }]
}

beforeEach(() => {
  selects = []
  rows = {
    profiles: {
      home_organization_id: ORG_A,
      date_of_birth: DOB,
      phone: PHONE,
      cpf: CPF_DIGITS,
    },
  }
  footprintSoleHospital()
})

async function view(userId = TARGET) {
  const { getPersonAdminView } = await import('./person-footprint')
  return getPersonAdminView(userId)
}

// ===========================================================================
describe('§1 the two authority booleans — per CAPABILITY, not per person', () => {
  it('an org_admin holds BOTH, and is not footprint-bounded', async () => {
    footprintCrossHospital()
    session = orgAdminSession
    const v = await view()
    expect(v.authority).toEqual({
      canEditPerson: true,
      canManageAccountLifecycle: true,
    })
  })

  it('a hospital_admin of a SOLE-footprint person holds BOTH', async () => {
    session = hospitalAdminSession
    const v = await view()
    expect(v.authority).toEqual({
      canEditPerson: true,
      canManageAccountLifecycle: true,
    })
  })

  it('⭐ THE SPLIT: on a CROSS-HOSPITAL person the two booleans DISAGREE', async () => {
    // The same differential `person-scope.test.ts` §2 pins on the pure predicate, now
    // through B6 — because a perfect predicate reached with the WRONG capability produces
    // a uniform answer and every other arm here would still pass.
    // ⛔ MUTATION-CONTROLLED: evaluating both with `'fields'` (the copy-paste this arm
    // exists to catch) makes both true and this arm RED. Observed.
    footprintCrossHospital()
    session = hospitalAdminSession
    const v = await view()
    expect(v.authority.canEditPerson, 'fields = INTERSECTION').toBe(true)
    expect(v.authority.canManageAccountLifecycle, 'lifecycle = SUBSET').toBe(false)
  })

  it('administering the WHOLE footprint restores the lifecycle boolean', async () => {
    // Without this, "deny every multi-hospital person" would satisfy the arm above.
    footprintCrossHospital()
    session = dualHospitalAdminSession
    const v = await view()
    expect(v.authority.canManageAccountLifecycle).toBe(true)
  })

  it('D2: a hospital-tier seat zeroes BOTH, even at the caller\'s own hospital', async () => {
    footprintHospitalTier()
    session = hospitalAdminSession
    const v = await view()
    expect(v.authority).toEqual({
      canEditPerson: false,
      canManageAccountLifecycle: false,
    })
  })

  it('D1(a): a hospital administered in ANOTHER org is not a claim on this person', async () => {
    // The session administers a hospital with the same id in a different organisation.
    // Without the org filter the ids would match and this would wrongly allow.
    session = foreignOrgAdminSession
    const v = await view()
    expect(v.authority.canEditPerson).toBe(false)
  })
})

// ===========================================================================
describe('§2 ⭐ WITHHELD and NOT-INFORMED are separately observable', () => {
  it('WITHHELD: no `fields` capability ⇒ personalData is the OUTER null', async () => {
    // ⛔ MUTATION-CONTROLLED: returning `{ dateOfBirth: null, phone: null, cpfPresent:
    // false }` instead of `null` — the collapse this whole design exists to prevent —
    // makes this arm RED. Observed.
    footprintHospitalTier() // D2 ⇒ canEditPerson false
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData, 'withheld must be the outer null, not a zeroed object').toBeNull()
  })

  it('NOT INFORMED: authorized, but the columns are empty ⇒ an OBJECT of nulls', async () => {
    // The other side of the pair. Same shape of "nothing to show", opposite meaning, and
    // F2 renders them differently: "Não informado" here, the scope note above.
    rows.profiles = {
      home_organization_id: ORG_A,
      date_of_birth: null,
      phone: null,
      cpf: null,
    }
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData, 'authorized ⇒ an object, never null').not.toBeNull()
    expect(v.personalData).toEqual({
      dateOfBirth: null,
      phone: null,
      cpfPresent: false,
    })
  })

  it('⭐ the two states are DISTINGUISHABLE from the return value alone', async () => {
    // Stated as its own assertion because that is the actual requirement: a consumer with
    // no access to the fixtures must be able to tell them apart. If both produced the same
    // shape, the two arms above could each pass while the distinction was unusable.
    footprintHospitalTier()
    session = hospitalAdminSession
    const withheld = await view()

    rows.profiles = {
      home_organization_id: ORG_A,
      date_of_birth: null,
      phone: null,
      cpf: null,
    }
    footprintSoleHospital()
    session = hospitalAdminSession
    const notInformed = await view()

    expect(withheld.personalData).toBeNull()
    expect(notInformed.personalData).not.toBeNull()
    expect(
      JSON.stringify(withheld.personalData) === JSON.stringify(notInformed.personalData),
      'withheld and not-informed must NOT serialize identically',
    ).toBe(false)
  })

  it('personalData is present EXACTLY when canEditPerson is true', async () => {
    // The invariant that keeps the two halves from drifting apart. Checked across the
    // fixtures that produce both verdicts rather than asserted abstractly.
    for (const [setFixture, expected] of [
      [footprintSoleHospital, true],
      [footprintCrossHospital, true], // intersection ⇒ fields yes
      [footprintHospitalTier, false],
    ] as const) {
      setFixture()
      session = hospitalAdminSession
      const v = await view()
      expect(v.personalData !== null, `fixture expecting canEditPerson=${expected}`).toBe(
        v.authority.canEditPerson,
      )
      expect(v.authority.canEditPerson).toBe(expected)
    }
  })
})

// ===========================================================================
describe('§3 D12 — CPF is PRESENCE ONLY and the digits never cross the boundary', () => {
  it('reports cpfPresent true WITHOUT the digits appearing anywhere in the payload', async () => {
    // ⛔ MUTATION-CONTROLLED: adding `cpf: profile.cpf` to the returned object makes this
    // arm RED. Observed. The serialized-payload scan is what makes it a real control —
    // asserting only `cpfPresent === true` would pass with the digits riding alongside.
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData?.cpfPresent).toBe(true)
    expect(
      JSON.stringify(v),
      'the CPF digits must appear NOWHERE in the returned payload (D12)',
    ).not.toContain(CPF_DIGITS)
  })

  it('reports cpfPresent false when the column is null', async () => {
    rows.profiles = {
      home_organization_id: ORG_A,
      date_of_birth: DOB,
      phone: PHONE,
      cpf: null,
    }
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData?.cpfPresent).toBe(false)
  })

  it('no masked or partial form leaks either — not even a suffix', async () => {
    session = hospitalAdminSession
    const v = await view()
    const payload = JSON.stringify(v)
    for (const fragment of ['111', '77735', '111.444', '***']) {
      expect(payload, `no CPF fragment "${fragment}" may appear`).not.toContain(fragment)
    }
  })
})

// ===========================================================================
describe('§4 the values themselves', () => {
  it('returns date_of_birth and phone verbatim to an authorized caller', async () => {
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData?.dateOfBirth).toBe(DOB)
    expect(v.personalData?.phone).toBe(PHONE)
  })

  it('an unknown person yields the fully denied view without raising', async () => {
    // A door that raises tells a probe the person exists. This one must not.
    rows.profiles = null
    session = orgAdminSession
    const v = await view('00000000-0000-0000-0000-0000000000ff')
    expect(v.personalData).toBeNull()
    expect(v.authority).toEqual({
      canEditPerson: false,
      canManageAccountLifecycle: false,
    })
  })

  it('an INACTIVE session holds nothing', async () => {
    session = { ...hospitalAdminSession, isInactive: true }
    const v = await view()
    expect(v.authority.canEditPerson).toBe(false)
    expect(v.personalData).toBeNull()
  })
})

// ===========================================================================
describe('§5 one footprint resolution per call (the TOCTOU bound ADR 0133 D4 accepted)', () => {
  it('⭐ resolves the footprint EXACTLY ONCE even though two capabilities are evaluated', async () => {
    // Two independent resolutions would widen the accepted residual from one write to two,
    // and could disagree with each other across a concurrent footprint change. Counted from
    // the actual table reads rather than asserted in a comment.
    // ⛔ MUTATION-CONTROLLED: passing `await resolvePersonFootprint(userId)` a second time
    // for the lifecycle evaluation — which is functionally CORRECT and would pass every
    // other arm in this file — makes this arm RED. Observed.
    footprintCrossHospital()
    session = hospitalAdminSession
    await view()
    expect(
      selects.filter((s) => s.table === 'hospital_affiliations').length,
      'hospital_affiliations must be read once, not once per capability',
    ).toBe(1)
    expect(selects.filter((s) => s.table === 'memberships').length).toBe(1)
  })

  it('the org_admin arm short-circuits and resolves NO footprint at all', async () => {
    // An org_admin is not footprint-bounded, so resolving one would be pure cost on the
    // commonest path.
    session = orgAdminSession
    await view()
    expect(selects.filter((s) => s.table === 'hospital_affiliations')).toHaveLength(0)
  })
})
