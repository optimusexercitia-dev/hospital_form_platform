import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AFF4 — `resolvePlatformFootprint`, the ADR 0151 D12 deactivation-offer signal.
 *
 * ⭐ THE ARM THIS FILE EXISTS FOR IS §1: A FAILED READ MUST NEVER RENDER AS AN EMPTY
 * FOOTPRINT. This function feeds one boolean whose TRUE branch offers to DEACTIVATE an
 * account — the platform-wide kill switch (ADR 0048 D4). The first implementation consumed
 * `.data ?? []` on all three reads and checked no error, so any transient failure produced
 * `ties: []` → `isEmpty: true` → an offer to disable an account with a full live
 * footprint, silently. The defect was found in review, not by a test, which is precisely
 * why the arm is written to RED if `?? []` is ever reintroduced.
 *
 * ⚠ THE ASYMMETRIC FAILURE IS THE DANGEROUS ONE. A total failure is at least suspicious;
 * ONE read failing while the others succeed leaves a plausible-looking partial answer. §1
 * therefore fails each read INDIVIDUALLY rather than all together — testing only the
 * all-fail case would leave the realistic failure untested.
 *
 * ⚠ SERVICE-ROLE PATH, NO RLS BACKSTOP (ADR 0098 §W3.2) — which is why this is a Vitest
 * keystone rather than a pgTAP one. There is no database-side check that would catch a
 * wrong answer here; this file is the whole safety net.
 *
 * §2 is the positive control: without it, §1 would pass just as happily against a function
 * that threw unconditionally, and "always throws" is not the property under test.
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const HOSP_A = '05000000-0000-0000-0000-00000000000a'
const TARGET = '00000000-0000-0000-0000-0000000000d1'

type Row = Record<string, unknown>

let rows: Record<string, Row[]>
let errorTable: string | null
/** Every `.is(column, value)` call, per table — lets §5 pin a query-level filter. */
let isCalls: { table: string; column: string }[]

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(),
}))

function makeAdmin() {
  const builder = (table: string) => {
    const self: Record<string, unknown> = {}
    self.select = () => self
    self.eq = () => self
    self.is = (column: string) => {
      isCalls.push({ table, column })
      return self
    }
    for (const m of ['in', 'not', 'order', 'limit', 'returns']) {
      self[m] = () => self
    }
    self.then = (
      resolve: (v: { data: unknown; error: { message: string } | null }) => unknown,
    ) =>
      resolve(
        table === errorTable
          ? { data: null, error: { message: 'simulated read failure' } }
          : { data: rows[table] ?? [], error: null },
      )
    return self
  }
  return { from: (table: string) => builder(table) }
}

async function resolve(userId = TARGET) {
  const { resolvePlatformFootprint } = await import('./person-footprint')
  return resolvePlatformFootprint(userId)
}

beforeEach(() => {
  rows = {}
  errorTable = null
  isCalls = []
})

// ===========================================================================
describe('§1 ⭐ fail closed — an undetermined footprint is never an empty one', () => {
  // Each arm was run against the ORIGINAL `?? []` implementation and observed to return
  // `{ isEmpty: true }` instead of throwing. That mutation-based evidence is what makes
  // these assertions discriminating rather than decorative.
  for (const table of [
    'organization_affiliations',
    'hospital_affiliations',
    'memberships',
  ]) {
    it(`throws when the ${table} read fails, rather than reporting an empty footprint`, async () => {
      errorTable = table
      await expect(resolve()).rejects.toThrow(/refusing to report an undetermined footprint/)
    })
  }

  it('a failing read still throws when the OTHER reads return ties — the partial answer must not look whole', async () => {
    rows.hospital_affiliations = [{ organization_id: ORG_A, hospital_id: HOSP_A }]
    errorTable = 'memberships'
    await expect(resolve()).rejects.toThrow()
  })
})

// ===========================================================================
describe('§2 positive control — the happy path still resolves', () => {
  it('reports an empty footprint when every read succeeds and returns nothing', async () => {
    // Without this arm, §1 would pass against a function that threw unconditionally.
    const f = await resolve()
    expect(f).toEqual({ isEmpty: true, ties: [] })
  })

  it('reports a non-empty footprint, naming the tie', async () => {
    rows.hospital_affiliations = [{ organization_id: ORG_A, hospital_id: HOSP_A }]
    const f = await resolve()
    expect(f.isEmpty).toBe(false)
    expect(f.ties).toEqual([
      {
        kind: 'hospital_affiliation',
        organizationId: ORG_A,
        hospitalId: HOSP_A,
        commissionId: null,
        role: null,
      },
    ])
  })
})

// ===========================================================================
describe('§3 ⭐ every tier counts — the reason this is not resolvePersonFootprint', () => {
  it('an ORG-TIER seat alone makes the footprint non-empty', async () => {
    // `resolvePersonFootprint` would yield `hospitalIds: []` here, because org-tier rows
    // contribute no hospital. Reading that as "nothing holds them" would offer to
    // deactivate a sitting org admin — the substitution this arm exists to forbid.
    rows.memberships = [
      {
        organization_id: ORG_A,
        hospital_id: null,
        commission_id: null,
        role: 'org_admin',
        expires_at: null,
      },
    ]
    const f = await resolve()
    expect(f.isEmpty).toBe(false)
    expect(f.ties[0]).toMatchObject({ kind: 'membership', role: 'org_admin' })
  })
})

// ===========================================================================
describe('§4 D6 "active", applied to memberships', () => {
  it('an EXPIRED seat does not hold the person', async () => {
    rows.memberships = [
      {
        organization_id: ORG_A,
        hospital_id: null,
        commission_id: 'c-a',
        role: 'staff',
        expires_at: '2020-01-01T00:00:00Z',
      },
    ]
    const f = await resolve()
    expect(f.isEmpty).toBe(true)
  })

  it('a seat expiring in the future DOES hold the person', async () => {
    rows.memberships = [
      {
        organization_id: ORG_A,
        hospital_id: null,
        commission_id: 'c-a',
        role: 'staff',
        expires_at: '2999-01-01T00:00:00Z',
      },
    ]
    const f = await resolve()
    expect(f.isEmpty).toBe(false)
  })
})

// ===========================================================================
describe('§5 the voided exclusion is asked of the DATABASE', () => {
  it('both affiliation reads filter voided_at IS NULL', async () => {
    // ADR 0151 D7. This filter lives in the query, not in TS, so no assertion over the
    // returned shape can observe it — the mock records the call instead. A voided row that
    // kept the footprint non-empty would mean offboarding never reaches the offer.
    await resolve()
    const voided = isCalls.filter((c) => c.column === 'voided_at').map((c) => c.table)
    expect(voided).toContain('organization_affiliations')
    expect(voided).toContain('hospital_affiliations')
  })
})
