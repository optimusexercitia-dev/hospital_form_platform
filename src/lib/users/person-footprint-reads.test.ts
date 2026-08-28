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
const ORG_B = '0c000000-0000-0000-0000-00000000000b'
const HOSP_A = '05000000-0000-0000-0000-00000000000a'
const TARGET = '00000000-0000-0000-0000-000000000002'

type Row = Record<string, unknown>

let rows: Record<string, Row[] | Row | null>
let errorTable: string | null
let session: unknown

vi.mock('@/lib/queries/session', () => ({
  getSessionContext: async () => session,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(),
}))

/**
 * ⛔ THE FILTERS ARE HONOURED, AND THEY HAVE TO BE — QA AE2 M6.
 *
 * This mock used to return `self` from `.eq` and `.is`, which made
 * `.is('voided_at', null)` in `listNonVoidedOrgAffiliationsFor` a NO-OP inside every arm of
 * this file. §5's bounds cannot be stated at all against a passthrough: a fixture whose
 * only row is VOIDED would come back exactly like a fixture whose row is live, so "a voided
 * row confers no authority" would be green with the filter deleted. The shape is
 * `departed-person-footprint.test.ts`'s `makeFilteringAdmin`, reused here for the same
 * reason it exists there.
 *
 * ⚠ `.is(col, null)` treats an ABSENT column as null, matching SQL against a fixture that
 * simply does not model the column. The fixtures below still seed `voided_at` / `ended_on`
 * explicitly wherever an assertion depends on them, so no arm rests on that leniency.
 *
 * ⚠ `.in` / `.not` stay identity: nothing on these paths uses them, and a fake that models
 * a surface the code does not touch hides which surface it actually depends on.
 */
function makeAdmin() {
  const builder = (table: string) => {
    const configured = rows[table]
    let matched: Row[] =
      configured == null ? [] : Array.isArray(configured) ? [...configured] : [configured]
    const self: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'not', 'order', 'limit', 'returns']) {
      self[m] = () => self
    }
    self.eq = (column: string, value: unknown) => {
      matched = matched.filter((r) => r[column] === value)
      return self
    }
    // SQL `IS NULL` semantics: keeps only rows whose column is null/absent.
    self.is = (column: string, value: unknown) => {
      if (value === null) matched = matched.filter((r) => r[column] == null)
      return self
    }
    const failure = { data: null, error: { message: 'simulated read failure' } }
    self.maybeSingle = async () =>
      table === errorTable ? failure : { data: matched[0] ?? null, error: null }
    self.then = (resolve: (v: unknown) => unknown) =>
      resolve(table === errorTable ? failure : { data: matched, error: null })
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
    profiles: { id: TARGET, date_of_birth: null, phone: null, cpf: null },
    // ⭐ AE2.4 inc 3 — THE ANCHOR MOVED, so the fixture had to move with it. This used to
    // be `profiles.home_organization_id: ORG_A`; `getPersonAdminView` now locates the
    // person's organizations from `organization_affiliations` (ADR 0163 / 0164). ⛔ Fixed
    // by MIRRORING how the real substrate anchors a person — an ACTIVE, non-voided org
    // affiliation — not by relaxing an assertion. Same lesson as pgTAP `360 § 5.2`: a
    // fixture that built its world out of the column under test.
    //
    // ⛔ QA AE2 M6 — EVERY ROW NOW CARRIES `principal_id`, AND THAT WAS A REAL GAP, not
    // bookkeeping. All three reads filter `.eq('principal_id', userId)`; while the mock
    // swallowed filters these rows answered for ANY user id, so the whole file's world was
    // built out of a no-op filter. With filtering on, an unkeyed row belongs to nobody.
    organization_affiliations: [
      { principal_id: TARGET, organization_id: ORG_A, ended_on: null, voided_at: null },
    ],
    hospital_affiliations: [
      { principal_id: TARGET, hospital_id: HOSP_A, ended_on: null, voided_at: null },
    ],
    // An ORG-TIER seat: `commission_id === null` raises the D2 flag, which makes this
    // person org_admin-only for every capability.
    memberships: [
      { principal_id: TARGET, commission_id: null, hospital_id: null, commissions: null },
    ],
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

// ===========================================================================
/**
 * ⭐ AE2.4 INCREMENT 3 — THE SAME CLASS, ON THE READ THAT NOW RUNS FIRST.
 *
 * `personAuthorityOrgs` was introduced in front of the footprint resolution, and its first
 * draft returned `[]` on a read error. That LOOKS safe — it denies — and it is precisely
 * the defect §2 names, one leg over: a silent DENY indistinguishable from a real one,
 * which locks administrators out of legitimate work with no signal anywhere. Worse, sitting
 * in FRONT of `resolvePersonFootprint` it would have short-circuited §3's throw entirely,
 * re-hiding a closed bug class behind a newer function.
 *
 * ⚠ § 4.2 is the arm that makes § 4.1 non-vacuous: without a positive control, "it throws"
 * passes against a function that throws unconditionally.
 */
describe('§4 the organization locator refuses to answer from a failed read', () => {
  it('§4.1 throws rather than returning an empty organization list', async () => {
    errorTable = 'organization_affiliations'
    const { personAuthorityOrgs } = await import('./person-footprint')
    await expect(personAuthorityOrgs(TARGET)).rejects.toThrow(
      /partial affiliation set/,
    )
  })

  it('§4.2 positive control: with the read healthy it resolves the anchor', async () => {
    const { personAuthorityOrgs } = await import('./person-footprint')
    await expect(personAuthorityOrgs(TARGET)).resolves.toEqual([ORG_A])
  })

  it('§4.3 and getPersonAdminView propagates it rather than rendering "no authority"', async () => {
    errorTable = 'organization_affiliations'
    const { getPersonAdminView } = await import('./person-footprint')
    await expect(getPersonAdminView(TARGET)).rejects.toThrow(
      /partial affiliation set/,
    )
  })
})

// ===========================================================================
/**
 * ⭐ AE2 QA M6 — ADR 0163'S RETENTION BOUNDS, IN TYPESCRIPT.
 *
 * `personAuthorityOrgs` is the TS twin of `app.person_authority_orgs` (ADR 0161's mirroring
 * obligation). The SQL half is pinned by pgTAP `390`/`394`; the TS half was ASSERTED and
 * not measured. § 4.2 above is a positive control and nothing more: it resolves through the
 * trivial `active.length > 0` branch and stays green if the entire retention block is
 * deleted. Bounds 1–3 had no TypeScript arm at all, and could not have had one — the mock
 * swallowed `.is('voided_at', null)`, so a VOIDED fixture and a LIVE one were the same
 * fixture. That is the one-half-measured shape the mirroring obligation exists to prevent.
 *
 * ⛔ EVERY ARM BELOW IS MUTATION-VERIFIED against `src/lib/users/person-footprint.ts`, and
 * each names its own mutation and the red it produced. A bound asserted without one is a
 * bound that could be satisfied by the fixture rather than by the code.
 *
 * ⚠ `ended_on` is a `date` (`YYYY-MM-DD`), so lexicographic max IS chronological max — the
 * fixtures use that shape deliberately, since a differently-formatted value would test a
 * comparison the production column can never produce.
 */
describe('§5 ⭐ ADR 0163 bounds 1-3 — last-org retention, measured not asserted', () => {
  /** Replaces the whole affiliation set. Never appends: a leftover row widens authority. */
  function orgAffiliations(...rowsIn: Row[]): void {
    rows.organization_affiliations = rowsIn.map((r) => ({ principal_id: TARGET, ...r }))
  }

  async function authorityOrgs() {
    const { personAuthorityOrgs } = await import('./person-footprint')
    return personAuthorityOrgs(TARGET)
  }

  it('§5.1 BOUND 1 — a VOIDED row confers nothing, even with `ended_on` still NULL', async () => {
    // ⛔ THE ROW IS VOIDED AND NOT ENDED, and that is the entire point of the arm. A void
    // says the employment was never true (ADR 0151 D7); an END says it was true and is
    // over. If this fixture also carried an `ended_on` it would be testing the ENDED
    // branch — which §5.4 and §5.5 exercise — and would stay green with the void filter
    // deleted, since an ended-and-voided row is dropped by either half.
    //
    // ⛔ MUTATION-VERIFIED. `personAuthorityOrgs` (`person-footprint.ts:411` as written)
    // delegates to `listNonVoidedOrgAffiliationsFor`, which carries the
    // `.is('voided_at', null)` half of bound 1. Replacing that ONE call with an inline
    // `organization_affiliations` read WITHOUT the void filter makes this arm RED:
    //   AssertionError: expected [ Array(1) ] to deeply equal []
    //     + [ "0c000000-0000-0000-0000-00000000000a" ]
    // The voided row survives, is seen as ACTIVE (`ended_on` is null), and hands authority
    // over this person to an organization that never employed them.
    orgAffiliations({
      organization_id: ORG_A,
      ended_on: null,
      voided_at: '2026-01-05T00:00:00.000Z',
    })
    await expect(authorityOrgs()).resolves.toEqual([])
  })

  it('§5.2 BOUND 2 — a TIE on `ended_on` yields ALL tied orgs, never one of them', async () => {
    // ⛔ AN ARBITRARY TIE-BREAK IS A NARROWING, and a differential that only pre-declares
    // WIDENINGS would never notice one: the person simply becomes unadministrable from the
    // org that lost the coin-toss, with every gate still reporting green.
    //
    // ⛔ MUTATION-VERIFIED. Collapsing the final tie-preserving filter (`person-footprint.ts`
    // :435-439 as written) to a sort-and-take-first — `return [ended.sort((a, b) =>
    // (a.ended_on < b.ended_on ? 1 : -1))[0].organization_id]`, which is the "do not
    // simplify this to a sort-and-take-first" edit the doc comment warns against — makes
    // this arm, and ONLY this arm, RED:
    //   AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]
    //     - "0c000000-0000-0000-0000-00000000000a"
    //       "0c000000-0000-0000-0000-00000000000b"
    orgAffiliations(
      { organization_id: ORG_A, ended_on: '2025-06-30', voided_at: null },
      { organization_id: ORG_B, ended_on: '2025-06-30', voided_at: null },
    )
    expect([...(await authorityOrgs())].sort()).toEqual([ORG_A, ORG_B].sort())
  })

  it('§5.3 BOUND 2 ORDERING — a VOIDED row that ended LATER must not win the max()', async () => {
    // ⛔ THE ORDER OF TWO CORRECT OPERATIONS IS ITSELF A BOUND. Filtering voided rows AFTER
    // taking the max is the natural way to write this and is WRONG: the voided row wins the
    // max, and the person's real last organization is lost. pgTAP `390 § C7` constructs the
    // same pair in SQL; this is its TypeScript twin, and until now the TS half had none.
    //
    // ⛔ MUTATION-VERIFIED, same mutation as §5.1 (drop the void filter from the read) —
    // kept as a SEPARATE arm because the red is a different failure, and it is the worse
    // one: §5.1 gains authority for a phantom org, this one hands it to the WRONG org
    // while looking like a perfectly ordinary answer.
    //   AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]
    //     - "0c000000-0000-0000-0000-00000000000a"
    //     + "0c000000-0000-0000-0000-00000000000b"
    orgAffiliations(
      { organization_id: ORG_A, ended_on: '2025-01-31', voided_at: null },
      { organization_id: ORG_B, ended_on: '2025-12-31', voided_at: '2026-02-01T00:00:00.000Z' },
    )
    await expect(authorityOrgs()).resolves.toEqual([ORG_A])
  })

  it('§5.4 BOUND 3 — retention applies ONLY when nothing is active', async () => {
    // An ended row must not ADD reach on top of a live one. ADR 0163's retention exists so
    // a departed person stays administrable by SOMEBODY; it is not a second organization
    // stapled onto a current employment.
    //
    // ⛔ MUTATION-VERIFIED. Deleting the early return (`if (active.length > 0) return …`,
    // `person-footprint.ts:422-425` as written) so execution always falls through to the
    // retention block makes this arm RED:
    //   AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]
    //     - "0c000000-0000-0000-0000-00000000000a"
    //     + "0c000000-0000-0000-0000-00000000000b"
    // — the ENDED org REPLACES the ACTIVE one outright, which is worse than merely adding
    // to it, and no other arm in this file or § 4 would have noticed.
    orgAffiliations(
      { organization_id: ORG_A, ended_on: null, voided_at: null },
      { organization_id: ORG_B, ended_on: '2025-12-31', voided_at: null },
    )
    await expect(authorityOrgs()).resolves.toEqual([ORG_A])
  })

  it('§5.5 CONTROL — the retention block IS reached: a wholly-ended person keeps their last org', async () => {
    // ⛔ §5.1 EXPECTS `[]`, SO IT IS SATISFIED BY DELETING RETENTION ALTOGETHER — the very
    // thing ADR 0163 added. This is the arm that says the block runs and answers.
    //
    // ⛔ MUTATION-VERIFIED, and the measurement corrected a first draft of this comment
    // which claimed §5.1/§5.3/§5.4 were all satisfiable by a retention-free implementation.
    // Prefixing `return []` to the retention block reds §5.2, §5.3 and §5.5 — and leaves
    // §5.1 and §5.4 GREEN, because §5.1 expects the empty answer and §5.4 resolves through
    // the ACTIVE branch, which the mutation does not touch. §5.1 alone therefore proves
    // nothing about retention existing; this arm is what does.
    //   AssertionError: expected [] to deeply equal [ Array(1) ]
    //     - "0c000000-0000-0000-0000-00000000000b"
    orgAffiliations(
      { organization_id: ORG_A, ended_on: '2024-02-29', voided_at: null },
      { organization_id: ORG_B, ended_on: '2025-12-31', voided_at: null },
    )
    await expect(authorityOrgs()).resolves.toEqual([ORG_B])
  })
})
