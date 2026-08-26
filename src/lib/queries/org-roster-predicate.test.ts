import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AFF4 B6b — the TS half of the roster predicate (ADR 0151 D10, as amended by ADR 0154).
 *
 * ⭐⭐ WHY A RECORDING MOCK AND NOT AN ASSERTION OVER THE RETURNED ROWS. A query-level
 * filter is INVISIBLE to any assertion about what comes back: the mock decides the rows, so
 * a test that checks the returned shape passes just as happily with the filter DELETED. The
 * only thing that can witness a filter is a record of what was ASKED OF THE DATABASE. Every
 * assertion below is therefore over the recorded call log, never over the payload.
 *
 * ⚠ THIS FILE IS NOT THE PARITY MECHANISM, and saying so is the point of this paragraph.
 * The property "the SQL door and the TS queries agree about what the roster is" spans two
 * runtimes: the door is pgTAP-only, these queries are Vitest-only, and NEITHER runtime can
 * assert the two AGREE. Each side is asserted in its own; the cross-reference to
 * `list_org_people`'s `p_include_ended` (pgTAP `302`/`361`) is a COURTESY TO READERS and
 * explicitly NOT a gate. The real parity gate is E2E (tester's T2), the only thing that
 * exercises the door and these queries in one process.
 *
 * ⛔ AND T2 IS SCOPED TO THE **ORG** DIRECTORY, deliberately. `listHospitalUsers` does not
 * carry this predicate — a `hospital_admin` cannot read `organization_affiliations` at all
 * (ADR 0151 D1: no hospital tier; measured 1 own row, 0 others'). A parity gate spanning
 * both surfaces would red on correct code, and a gate that reds on correct code gets
 * weakened by whoever meets it next.
 */

type Call = { table: string; method: string; args: unknown[] }

let calls: Call[] = []
/** Rows the mock hands back per table. */
let rows: Record<string, unknown[]> = {}

/** A chainable, thenable PostgREST stand-in that RECORDS every filter it is asked for. */
function makeBuilder(table: string) {
  const result = () => ({
    data: rows[table] ?? [],
    error: null,
    count: (rows[table] ?? []).length,
  })
  const chain: Record<string, unknown> = {
    // A thenable, so `await builder` and `await builder.returns<T>()` both resolve.
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  }
  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'is',
    'or',
    'not',
    'gt',
    'lt',
    'gte',
    'lte',
    'order',
    'range',
    'limit',
    'returns',
  ]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ table, method, args })
      return chain
    }
  }
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => makeBuilder(table),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  })),
}))

/** Did the code ask the database for this exact filter, on this exact table? */
const asked = (table: string, method: string, ...args: unknown[]) =>
  calls.some(
    (c) =>
      c.table === table &&
      c.method === method &&
      args.every((a, i) => JSON.stringify(c.args[i]) === JSON.stringify(a)),
  )

const ORG = '0c000000-0000-0000-0000-00000000000a'
const HOSP = '05000000-0000-0000-0000-00000000000a'

beforeEach(() => {
  calls = []
  rows = {}
  vi.resetModules()
})

describe('listActivePrincipalIdsForHospital: a VOIDED affiliation is not an active one', () => {
  it('⭐ asks the database for `voided_at is null`, not only `ended_on is null`', async () => {
    // ⛔ THE REGRESSION THIS PINS. Before AFF4 this helper filtered `ended_on is null`
    // ALONE. A voided affiliation leaves `ended_on` NULL — a void says the employment never
    // should have existed (D7/D8), it does not "end" it — so a voided person kept counting
    // onto the hospital roster. The SQL side had already closed this class in B4; this
    // helper is the TS mirror that had no keystone, which is exactly why it was missed.
    //
    // ⚠ OBSERVED RED BEFORE THE FIX. With the `.is('voided_at', null)` line removed from
    // `listActivePrincipalIdsForHospital`, this assertion fails with
    // `expected false to be true` while every other test in the repo stays green — a
    // returned-shape assertion could not have failed, because the mock supplies the rows.
    const { listActivePrincipalIdsForHospital } = await import('./affiliations')
    await listActivePrincipalIdsForHospital(HOSP)

    expect(asked('hospital_affiliations', 'is', 'voided_at', null)).toBe(true)
    // The control: the pre-existing conjunct is still asked for too, so the test above
    // cannot be satisfied by a fix that swapped one filter for the other.
    expect(asked('hospital_affiliations', 'is', 'ended_on', null)).toBe(true)
  })

  it('⭐ listActiveAffiliationsFor — the SECOND site of the same class — excludes voided too', async () => {
    // ⛔ FOUND BY SWEEPING THE PREDICATE, NOT BY THE REPORT. The reported site was
    // `listActivePrincipalIdsForHospital`; a grep for every `is('ended_on', null)` in
    // `src/lib` turned up this one as well, which feeds `OrgUserListItem.hospitalNames` in
    // both directory reads — so a voided employment would have named a workplace the
    // platform records as never having been true. Fixing only the reported site is how a
    // half-swept class gets buried under the evidence of the half that was swept.
    //
    // ⚠ OBSERVED RED BEFORE THE FIX: `expected false to be true`, this test alone.
    //
    // ⛔ `listAffiliationsFor` (the HISTORY reader) is deliberately NOT in this class and
    // must not gain the conjunct: it answers "what happened", and D7 keeps voided rows
    // visible to their audience as records. Two questions, two functions.
    const { listActiveAffiliationsFor } = await import('./affiliations')
    await listActiveAffiliationsFor(['p-1'])

    expect(asked('hospital_affiliations', 'is', 'voided_at', null)).toBe(true)
    expect(asked('hospital_affiliations', 'is', 'ended_on', null)).toBe(true)
  })
})

describe('listOrgAffiliationTenses: the roster predicate, and its one default', () => {
  it('defaults to ACTIVE-ONLY — it asks for both `voided_at is null` and `ended_on is null`', async () => {
    const { listOrgAffiliationTenses } = await import('./affiliations')
    await listOrgAffiliationTenses(ORG)

    expect(asked('organization_affiliations', 'eq', 'organization_id', ORG)).toBe(true)
    expect(asked('organization_affiliations', 'is', 'voided_at', null)).toBe(true)
    expect(asked('organization_affiliations', 'is', 'ended_on', null)).toBe(true)
  })

  it('⭐ `includeEnded` DROPS the ended filter — and drops ONLY that one', async () => {
    const { listOrgAffiliationTenses } = await import('./affiliations')
    await listOrgAffiliationTenses(ORG, true)

    // The differential: this is the assertion that fails if `includeEnded` is ignored, and
    // the pair below is what stops "widening" from becoming "removing every filter".
    expect(asked('organization_affiliations', 'is', 'ended_on', null)).toBe(false)
    expect(asked('organization_affiliations', 'is', 'voided_at', null)).toBe(true)
    expect(asked('organization_affiliations', 'eq', 'organization_id', ORG)).toBe(true)
  })

  it('⛔ VOIDED is excluded in BOTH modes — there is no flag that reaches a voided row', async () => {
    const { listOrgAffiliationTenses } = await import('./affiliations')
    for (const includeEnded of [false, true]) {
      calls = []
      await listOrgAffiliationTenses(ORG, includeEnded)
      expect(asked('organization_affiliations', 'is', 'voided_at', null)).toBe(true)
    }
  })
})

describe('listOrgUsers: the directory roster is the ORG AFFILIATION, not home_organization_id', () => {
  const options = {
    search: '',
    status: null,
    paging: { page: 0, pageSize: 20 },
  } as const

  it('⭐⭐ asks `organization_affiliations` for the roster and NEVER filters `home_organization_id`', async () => {
    rows = {
      organization_affiliations: [{ principal_id: 'p-1' }, { principal_id: 'p-2' }],
    }
    const { listOrgUsers } = await import('./org-users')
    await listOrgUsers(ORG, { ...options })

    expect(asked('organization_affiliations', 'eq', 'organization_id', ORG)).toBe(true)
    // ⛔ THE ASSERTION THAT FAILS IF THE PREDICATE IS REVERTED. Restoring
    // `.eq('home_organization_id', orgId)` on `profiles` reds here even though the rows the
    // mock returns are identical either way — which is the entire reason this suite records
    // calls instead of inspecting results.
    expect(calls.some((c) => c.args[0] === 'home_organization_id')).toBe(false)
  })

  it('⭐ threads `includeEnded` to the roster query rather than filtering after the fact', async () => {
    rows = { organization_affiliations: [{ principal_id: 'p-1' }] }
    const { listOrgUsers } = await import('./org-users')
    await listOrgUsers(ORG, { ...options, includeEnded: true })

    // Same name, same default, one layer down — the whole point of the shared naming.
    expect(asked('organization_affiliations', 'is', 'ended_on', null)).toBe(false)
    expect(asked('organization_affiliations', 'is', 'voided_at', null)).toBe(true)
  })

  it('an empty roster short-circuits: `profiles` is never queried, and it is NOT a permission error', async () => {
    // An empty `in.()` is invalid PostgREST, so the empty set must not reach the query at
    // all.
    //
    // ⚠ SCOPE, STATED HONESTLY BECAUSE THE MUTATION RUN CORRECTED ME. An earlier version of
    // this comment claimed the test also pins that the org-affiliation read GATES the
    // roster — "revert the predicate and `profiles` is queried anyway". IT DOES NOT.
    // Measured: reverting `.in('id', orgScope)` to `.eq('home_organization_id', orgId)`
    // leaves this test GREEN, because `listOrgAffiliationTenses` is still called and
    // still short-circuits on the empty set. This test covers the empty-`in.()` hazard and
    // the "empty never means forbidden" contract, and nothing else. The predicate
    // differential is the first test in this block, which the same mutation reds.
    rows = { organization_affiliations: [] }
    const { listOrgUsers } = await import('./org-users')
    const page = await listOrgUsers(ORG, { ...options })

    expect(calls.some((c) => c.table === 'profiles')).toBe(false)
    expect(page.rows).toEqual([])
    expect(page.statusCounts).toEqual({ all: 0, active: 0, attention: 0, deactivated: 0 })
  })
})

// ===========================================================================
// AFF4 B6b — the per-row ORG-AFFILIATION TENSE, and the nullability invariant.
// ===========================================================================

/**
 * ⛔ WHY THESE ARMS EXIST AT ALL, and why the field being nullable is what makes them
 * mandatory. `OrgUserListItem.orgAffiliationStatus` is `'ativo' | 'encerrado' | null`,
 * where `null` means "not resolvable at this scope". That nullability is deliberate — it
 * makes *"the hospital directory cannot know this"* a type-level fact — but a nullable
 * field is also a BUG ABSORBER: a null arriving from the ORG directory is a real gap, and
 * the render path's null-check would swallow it, so the chip would just stop appearing
 * with nothing anywhere able to say why.
 *
 * So the invariant has to be pinned from BOTH sides, and neither side is evidence alone:
 *   · `listOrgUsers` must NEVER return null (its roster predicate IS an org affiliation —
 *     a row cannot appear on that page without one).
 *   · `listHospitalUsers` must ALWAYS return null (a `hospital_admin` reads ZERO
 *     org-affiliation rows belonging to anyone else — ADR 0151 D1, pgTAP `375` §4.1).
 *
 * ⚠ THESE ASSERT OVER THE RETURNED SHAPE, unlike every arm above, and that is correct
 * here rather than a lapse: the property under test IS the mapping from row to item. The
 * recording-mock discipline still applies where it can — the tense VALUES below are driven
 * by `ended_on` in the supplied rows, so a mapping that hardcodes `'ativo'` reds.
 */
describe('the org-affiliation TENSE reaches the directory row (AFF4 B6b)', () => {
  const options = {
    search: '',
    status: null,
    paging: { page: 0, pageSize: 20 },
  } as const

  /** Two people: one active, one ended. Both rows visible only under `includeEnded`. */
  function seedMixedRoster(): void {
    rows = {
      organization_affiliations: [
        { principal_id: 'p-active', ended_on: null },
        { principal_id: 'p-ended', ended_on: '2025-06-30' },
      ],
      profiles: [
        {
          id: 'p-active',
          full_name: 'Ativa',
          email: 'a@test.local',
          home_organization_id: ORG,
          professional_category_id: null,
          is_active: true,
          suspended_until: null,
          email_confirmed_at: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          category: null,
        },
        {
          id: 'p-ended',
          full_name: 'Encerrado',
          email: 'e@test.local',
          home_organization_id: ORG,
          professional_category_id: null,
          is_active: true,
          suspended_until: null,
          email_confirmed_at: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          category: null,
        },
      ],
    }
  }

  it('⭐ the tense TRACKS `ended_on` per row — not one value for the whole page', async () => {
    // The differential. A mapping that hardcodes `'ativo'`, or that reads the first row's
    // tense for every row, passes a "not null" check and fails this one.
    seedMixedRoster()
    const { listOrgUsers } = await import('./org-users')
    const page = await listOrgUsers(ORG, { ...options, includeEnded: true })

    const byId = new Map(page.rows.map((r) => [r.id, r]))
    expect(byId.get('p-active')?.orgAffiliationStatus).toBe('ativo')
    expect(byId.get('p-active')?.orgAffiliationEndedOn).toBeNull()
    expect(byId.get('p-ended')?.orgAffiliationStatus).toBe('encerrado')
    expect(byId.get('p-ended')?.orgAffiliationEndedOn).toBe('2025-06-30')
  })

  it('⛔ `listOrgUsers` NEVER returns a null tense — a null there is a real gap', async () => {
    seedMixedRoster()
    const { listOrgUsers } = await import('./org-users')
    const page = await listOrgUsers(ORG, { ...options, includeEnded: true })

    expect(page.rows.length, 'the fixture must produce rows, or this asserts nothing').toBe(2)
    expect(
      page.rows.filter((r) => r.orgAffiliationStatus === null).map((r) => r.id),
      'every org-directory row is on that page BECAUSE it holds an org affiliation',
    ).toEqual([])
  })

  it('⛔ `listHospitalUsers` ALWAYS returns a null tense — it cannot read that table', async () => {
    // ⭐ THE OTHER DIRECTION, and it is not the same test. Wiring the org tense into this
    // surface would look correct in review and return an EMPTY map at runtime for every
    // real hospital_admin (D1 grants them no org-tier read), so every row would silently
    // carry `null` anyway — but a future author "fixing" that by falling back to the
    // caller's own row, or by routing through the service client, would breach D1. This
    // arm makes the absence deliberate rather than incidental.
    rows = {
      hospital_affiliations: [{ principal_id: 'p-active' }],
      memberships: [],
      commissions: [],
      profiles: [
        {
          id: 'p-active',
          full_name: 'Ativa',
          email: 'a@test.local',
          home_organization_id: ORG,
          professional_category_id: null,
          is_active: true,
          suspended_until: null,
          email_confirmed_at: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          category: null,
        },
      ],
    }
    const { listHospitalUsers } = await import('./org-users')
    const page = await listHospitalUsers(HOSP, { ...options })

    expect(page.rows.length, 'the fixture must produce rows, or this asserts nothing').toBeGreaterThan(0)
    for (const row of page.rows) {
      expect(row.orgAffiliationStatus, `${row.id} must carry no tense at hospital scope`).toBeNull()
      expect(row.orgAffiliationEndedOn).toBeNull()
    }
    expect(
      calls.some((c) => c.table === 'organization_affiliations'),
      'the hospital directory must not even ASK for org affiliations (ADR 0151 D1)',
    ).toBe(false)
  })
})
