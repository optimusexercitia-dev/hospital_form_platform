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
      date_of_birth: DOB,
      phone: PHONE,
      cpf: CPF_DIGITS,
    },
    // ⭐ AE2.4 inc 3 — THE ANCHOR MOVED. `getPersonAdminView` no longer selects
    // `home_organization_id`; it locates the person's organizations from
    // `organization_affiliations` (ADR 0163 last-org retention, ADR 0164). ⛔ Fixed by
    // MIRRORING the real substrate — an ACTIVE, non-voided org affiliation — rather than by
    // relaxing an assertion, exactly as pgTAP `360 § 5.2` was. The § 5 column-list arms
    // below re-measure what is actually selected, so this is not a claim, it is pinned.
    organization_affiliations: [{ organization_id: ORG_A, ended_on: null }],
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

  it('⭐ QA R1 — an EXPIRED commission seat grants NO footprint', async () => {
    rows.hospital_affiliations = []
    rows.memberships = [
      {
        commission_id: 'c-a',
        hospital_id: null,
        commissions: { hospital_id: HOSP_A },
        expires_at: '2020-01-01T00:00:00.000Z',
      },
    ]
    session = hospitalAdminSession
    const v = await view()
    expect(v.authority).toEqual({
      canEditPerson: false,
      canManageAccountLifecycle: false,
    })
    expect(v.personalData, 'and the locked columns stay withheld').toBeNull()
  })

  it('⭐ but an EXPIRED ORG-TIER seat still zeroes both — expiry does not RELAX D2', async () => {
    // ⛔ THE DELIBERATE ASYMMETRY, pinned so it reads as a decision and not an oversight.
    // Expiry is applied to what a membership GRANTS (a hospital in the footprint), never to
    // what it WITHHOLDS (org_admin-only status). Treating an expired org-tier seat as "no
    // longer tiered" would WIDEN authority on a path with no RLS backstop — the person
    // becomes manageable by a hospital_admin — so the fix for R1 is narrowing-only in both
    // directions. If that should change, it is an ADR decision, not a bug fix.
    rows.hospital_affiliations = [{ hospital_id: HOSP_A }]
    rows.memberships = [
      {
        commission_id: null,
        hospital_id: null,
        commissions: null,
        expires_at: '2020-01-01T00:00:00.000Z',
      },
    ]
    session = hospitalAdminSession
    const v = await view()
    expect(v.authority.canEditPerson, 'D2 must still fire on an expired tier seat').toBe(false)
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
      // ADR 0147: nothing stored ⇒ no mask either. `cpfMasked` is null on BOTH the
      // "not informed" and the "malformed" paths, which is exactly why `cpfPresent`
      // survived the amendment instead of being replaced by it.
      cpfMasked: null,
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
describe('§3 D12 as amended by ADR 0147 — CPF is MASKED, and the raw key never crosses', () => {
  // ⛔ THIS SECTION USED TO ASSERT THE OPPOSITE, and the reversal is deliberate, not drift.
  // ADR 0133 D12 said PRESENCE ONLY — "no digits, masked or otherwise" — and an arm here
  // pinned that by refusing even a three-digit fragment. The PO reversed it (ADR 0147):
  // administrators could not tell two same-named people apart, nor confirm they were
  // editing the right record, from a boolean. What SURVIVES the reversal is the half that
  // was always load-bearing — the four hidden digits, and the raw key, still never leave
  // the server — and that is what the arms below now pin.
  //
  // CPF_DIGITS = 11144477735 ⇒ mask 111.•••.•77-35 (1-3 shown, 4-7 hidden, 8-11 shown).
  const MASKED = '111.•••.•77-35'
  const HIDDEN_DIGITS = '4447' // digits 4-7 — the half the mask exists to withhold

  it('reports cpfPresent true and the MASKED form, never the raw key', async () => {
    // ⛔ MUTATION-CONTROLLED: adding `cpf: profile.cpf` to the returned object makes this
    // arm RED. Observed. The serialized-payload scan is what makes it a real control —
    // asserting only `cpfPresent === true` would pass with the raw digits riding alongside.
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData?.cpfPresent).toBe(true)
    expect(v.personalData?.cpfMasked).toBe(MASKED)
    expect(
      JSON.stringify(v),
      'the RAW 11-digit CPF must appear nowhere in the returned payload',
    ).not.toContain(CPF_DIGITS)
  })

  it('⭐ the HIDDEN digits (4-7) never cross the boundary in any form', async () => {
    // ⛔ MUTATION-CONTROLLED and the reason this arm is separate: a mask that hid the
    // WRONG span — say `111.444.•••-35`, which still "looks masked" and still satisfies
    // the raw-key scan above — makes this arm RED. Observed. Asserting the output shape
    // alone would not catch it, because the shape assertion above would have been edited
    // to match the new mask by whoever changed it.
    session = hospitalAdminSession
    const v = await view()
    const payload = JSON.stringify(v)
    for (const fragment of [HIDDEN_DIGITS, '111.444', '444.777']) {
      expect(payload, `hidden CPF fragment "${fragment}" must not appear`).not.toContain(
        fragment,
      )
    }
  })

  it('reports cpfPresent false and a null mask when the column is null', async () => {
    rows.profiles = {
      date_of_birth: DOB,
      phone: PHONE,
      cpf: null,
    }
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData?.cpfPresent).toBe(false)
    expect(v.personalData?.cpfMasked).toBeNull()
  })

  it('⭐ a stored value that is not 11 digits masks to null while presence stays TRUE', async () => {
    // The pair that justifies keeping BOTH fields, at the UNIT level.
    // ⛔ NOT "real data": `profiles_cpf_valid` is a VALIDATED CHECK admitting only
    // `NULL OR app.is_valid_cpf(cpf)`, and that rejects anything but `^[0-9]{11}$` —
    // pgTAP `359_profiles_dob_phone.sql:249` and `301_hospital_affiliation_substrate.sql:228`
    // prove the refusal (23514). This arm therefore pins `maskCpf`'s CONTRACT against a shape
    // the database cannot currently store, which is worth keeping — a constraint is one
    // migration from being relaxed and the mask must not start half-rendering when it is —
    // but it must not be cited as evidence the state is reachable. It was: QA read it that
    // way and filed a render-branch finding for a branch nothing can enter.
    // ⛔ MUTATION-CONTROLLED: masking by slicing without the length check (which would
    // emit a short, plausible-looking string) makes this arm RED. Observed.
    rows.profiles = {
      date_of_birth: DOB,
      phone: PHONE,
      cpf: '1114447',
    }
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData?.cpfPresent).toBe(true)
    expect(v.personalData?.cpfMasked).toBeNull()
    expect(JSON.stringify(v)).not.toContain('1114447')
  })

  it('tolerates stored punctuation — the mask is computed from the digits', async () => {
    rows.profiles = {
      date_of_birth: DOB,
      phone: PHONE,
      cpf: '111.444.777-35',
    }
    session = hospitalAdminSession
    const v = await view()
    expect(v.personalData?.cpfMasked).toBe(MASKED)
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

  it('⭐ AE2.4 inc 3 — the ORGANIZATION LOCATOR is read once, and the column is not read at all', async () => {
    // Two arms in one place because they pin the two halves of the same move.
    //  · The locator must not become one read per capability — the TOCTOU bound above is
    //    about a single resolution, and a second one could disagree with the first.
    //  · `home_organization_id` must be GONE from the profiles select list. Asserting the
    //    behaviour alone would stay green if the column were re-added and quietly consulted
    //    again, which is precisely how the column outlived its own removal elsewhere.
    footprintCrossHospital()
    session = hospitalAdminSession
    await view()
    expect(
      selects.filter((s) => s.table === 'organization_affiliations').length,
      'the locator must be resolved once, not once per capability',
    ).toBe(1)
    const profileSelects = selects.filter((s) => s.table === 'profiles')
    expect(profileSelects).toHaveLength(1)
    expect(profileSelects[0].columns).not.toContain('home_organization_id')
  })
})
