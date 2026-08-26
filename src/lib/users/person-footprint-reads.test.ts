import { beforeEach, describe, expect, it, vi } from 'vitest'

import { personScopeAllows } from './person-scope'

/**
 * BUG-AUTHZ-FOOTPRINT-ASYMMETRIC-READ-LIFTS-THE-D2-LOCK — `resolvePersonFootprint` must
 * never derive person-scope authority from a partial footprint.
 *
 * Pre-existing since ADR 0133 (AFF2); NOT introduced by AFF4.
 *
 * ⭐ §2 IS THE FINDING. The TOTAL read failure was already safe, and that is exactly what
 * made this hard to see: `personScopeAllows` denies an empty footprint explicitly, with a
 * comment naming the vacuous-subset inversion, so "both reads fail" was covered. The
 * ASYMMETRIC failure is a different bug that the empty-footprint guard cannot reach —
 * memberships errors, affiliations succeeds, `hospitalIds` is non-empty and sails past the
 * guard, while `hasNonCommissionTierMembership` is FALSE when it should be TRUE. The D2
 * lock lifts and a hospital_admin gains `lifecycle` over an org admin.
 *
 * ⚠ §1 EXISTS SO §2 IS NOT MISREAD AS THEORETICAL. It drives `personScopeAllows` directly
 * with the two footprints — the true one and the perturbed one — and shows the perturbed
 * one GRANTS what the true one DENIES. Asserting only "the resolver throws" would leave
 * the consequence undocumented, and a later reader could delete the throw believing it was
 * defensive tidiness.
 *
 * ⚠ SERVICE-ROLE PATH, NO RLS BACKSTOP (ADR 0098 §W3.2). Nothing in the database would
 * catch a wrong answer here.
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const HOSP_A = '05000000-0000-0000-0000-00000000000a'
const TARGET = '00000000-0000-0000-0000-000000000002'

type Row = Record<string, unknown>

let rows: Record<string, Row[] | Row>
let errorTable: string | null
let session: unknown

vi.mock('@/lib/queries/session', () => ({
  getSessionContext: async () => session,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(),
}))

function makeAdmin() {
  const builder = (table: string) => {
    const self: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'in', 'not', 'order', 'limit', 'returns']) {
      self[m] = () => self
    }
    const result = () =>
      table === errorTable
        ? { data: null, error: { message: 'simulated read failure' } }
        : { data: rows[table] ?? [], error: null }
    self.maybeSingle = async () => ({
      data: (rows[table] as Row) ?? null,
      error: table === errorTable ? { message: 'simulated read failure' } : null,
    })
    self.then = (resolve: (v: unknown) => unknown) => resolve(result())
    return self
  }
  return { from: (table: string) => builder(table) }
}

beforeEach(() => {
  errorTable = null
  session = {
    userId: 'e1',
    isInactive: false,
    isAdmin: false,
    orgAdminOf: [],
    hospitalAdminOf: [{ hospital: { id: HOSP_A }, organization: { id: ORG_A } }],
  }
  rows = {
    profiles: { home_organization_id: ORG_A, date_of_birth: null, phone: null, cpf: null },
    hospital_affiliations: [{ hospital_id: HOSP_A }],
    // An ORG-TIER seat: `commission_id === null` raises the D2 flag, which makes this
    // person org_admin-only for every capability.
    memberships: [{ commission_id: null, hospital_id: null, commissions: null }],
  }
})

async function resolveFootprint(userId = TARGET) {
  const { resolvePersonFootprint } = await import('./person-footprint')
  return resolvePersonFootprint(userId)
}

// ===========================================================================
describe('§1 ⭐ the consequence — what a perturbed footprint actually grants', () => {
  const administered = [HOSP_A]

  it('the TRUE footprint (org-tier seat present) denies lifecycle — the D2 lock', () => {
    expect(
      personScopeAllows(
        'lifecycle',
        { hospitalIds: [HOSP_A], hasNonCommissionTierMembership: true },
        administered,
      ),
    ).toBe(false)
  })

  it('⛔ the PERTURBED footprint (memberships read lost) GRANTS lifecycle over the same person', () => {
    // This is the over-grant, stated as an assertion rather than as prose. It is not a
    // defect in `personScopeAllows` — given this input the answer is correct. The defect
    // is that a dropped read error could produce this input.
    expect(
      personScopeAllows(
        'lifecycle',
        { hospitalIds: [HOSP_A], hasNonCommissionTierMembership: false },
        administered,
      ),
    ).toBe(true)
  })

  it('the EMPTY footprint denies — the route that was already closed, pinned so it is not re-derived', () => {
    expect(
      personScopeAllows(
        'lifecycle',
        { hospitalIds: [], hasNonCommissionTierMembership: false },
        administered,
      ),
    ).toBe(false)
  })
})

// ===========================================================================
describe('§2 ⭐ the fix — a partial read never becomes a footprint', () => {
  it('throws when MEMBERSHIPS fails while affiliations succeeds (the asymmetric case)', async () => {
    errorTable = 'memberships'
    await expect(resolveFootprint()).rejects.toThrow(
      /refusing to derive person-scope authority from a partial footprint/,
    )
  })

  it('throws when AFFILIATIONS fails while memberships succeeds', async () => {
    errorTable = 'hospital_affiliations'
    await expect(resolveFootprint()).rejects.toThrow(/partial footprint/)
  })

  it('positive control: with both reads healthy it resolves, D2 flag intact', async () => {
    // Without this, §2 would pass against a function that threw unconditionally.
    const f = await resolveFootprint()
    expect(f).toEqual({
      hospitalIds: [HOSP_A],
      hasNonCommissionTierMembership: true,
    })
  })
})

// ===========================================================================
describe('§3 getPersonAdminView inherits the fix — same root, quieter coat', () => {
  it('propagates rather than rendering two perturbed authority booleans', async () => {
    errorTable = 'memberships'
    const { getPersonAdminView } = await import('./person-footprint')
    await expect(getPersonAdminView(TARGET)).rejects.toThrow(/partial footprint/)
  })
})
