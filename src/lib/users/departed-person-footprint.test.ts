import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AFF3 / ADR 0148 — the WRITE half of the offboarded-person change.
 *
 * ⭐ WHAT THIS FILE IS FOR. Migration 20261003002900 widened READ visibility so a
 * hospital_admin keeps seeing people who EVER held an affiliation to a hospital they
 * administer. The whole risk of that change is that WRITE authority follows it. It must
 * not: a hospital admin may open an ex-employee's record and must still be unable to edit
 * their name, CPF, credentials, category, account status, or affiliations.
 *
 * ⛔ WHY THIS CANNOT BE A pgTAP TEST, stated because the obvious place to look is the RLS
 * suite. At the RLS layer a hospital_admin has no write path to `profiles` at all
 * (`profiles_admin_update` is `app.is_admin()`, `profiles_update_self` is
 * `id = auth.uid()`), so `371_offboarded_person_visibility.sql` §4 can only prove that the
 * migration added no write leg — it is green before AND after, and it says so. The real
 * write boundary is the ADR-0133 (AFF2) capability derivation, which is TypeScript running
 * on the SERVICE-ROLE client where RLS does not apply. That is what this file tests.
 *
 * ⛔⛔ THE PROPERTY THIS FILE MUST HAVE, and the reason its mock is written the hard way:
 * **it must FAIL if someone deletes `.is('ended_on', null)` from `resolvePersonFootprint`**
 * (`person-footprint.ts`). A test that hand-builds an empty `PersonFootprint` and asserts
 * `personScopeAllows` returns false does NOT have that property — remove the filter, the
 * departed person's footprint becomes non-empty, and such a test still passes. It would
 * look like coverage of the boundary while being blind to the one edit that breaks it.
 *
 * So the mock below APPLIES the filters it is given instead of swallowing them: `.is(col,
 * null)` actually drops non-null rows. The fixture feeds an affiliation row whose
 * `ended_on` is set, and §1 asserts the footprint comes back EMPTY. Delete the filter and
 * the row survives, the footprint becomes `[HOSP_A]`, `fields`/`credentials` flip to true,
 * and §1 goes red. Verified by mutation, not assumed — see §1's arm comment.
 *
 * ⚠ The existing `person-scope.test.ts` §4 already covers "an empty footprint denies
 * everything". That is the PREDICATE half and it is not this. The gap this file closes is
 * whether a DEPARTED person actually produces that empty footprint.
 */

const HOSP_A = '05000000-0000-0000-0000-00000000000a'
const HOSP_B = '05000000-0000-0000-0000-0000000000a2'
const TARGET = '00000000-0000-0000-0000-000000000002'

interface Row {
  [column: string]: unknown
}

/** Every filter the code under test actually applied, for §3's diagnostic. */
let appliedFilters: { table: string; method: string; column: string; value: unknown }[] = []
let tables: Record<string, Row[]> = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeFilteringAdmin(),
}))

/**
 * A query-builder double that HONOURS `.eq` and `.is` rather than returning `self` for
 * every method. This is the entire point of the file — see the header. A passthrough mock
 * cannot distinguish a filtered query from an unfiltered one, so it cannot hold the
 * property this file exists to hold.
 *
 * ⚠ CORRECTED 2026-08-28 (QA finding M6). This comment used to add "(the shape used
 * elsewhere in this directory, which is correct for what those files test)". Both halves
 * went false at once: `person-admin-view`, `person-footprint-reads` and `d14-person-level`
 * now filter, and the passthrough was NOT correct for what they tested — under it
 * `.is('voided_at', null)` was a no-op, so ADR 0163's bounds 1–3 had zero TypeScript
 * coverage, and not one fixture row carried `principal_id`, so every row belonged to
 * every user at once (re-keying revealed 13 and 28 arms respectively that had been
 * passing for the wrong reason). ⛔ A comment that BLESSES a weaker sibling is worse than
 * one that merely describes it: it tells the next reader not to look.
 */
function makeFilteringAdmin() {
  const builder = (table: string) => {
    let rows: Row[] = [...(tables[table] ?? [])]
    const self: Record<string, unknown> = {}

    self.select = () => self
    self.returns = () => self
    self.order = () => self
    self.limit = () => self
    self.in = () => self
    self.not = () => self

    self.eq = (column: string, value: unknown) => {
      appliedFilters.push({ table, method: 'eq', column, value })
      rows = rows.filter((r) => r[column] === value)
      return self
    }
    // SQL `IS NULL` semantics: keeps only rows whose column is null/absent.
    self.is = (column: string, value: unknown) => {
      appliedFilters.push({ table, method: 'is', column, value })
      if (value === null) rows = rows.filter((r) => r[column] == null)
      return self
    }

    self.then = (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: rows, error: null })
    return self
  }
  return { from: (table: string) => builder(table) }
}

/** The subject: one affiliation to HOSP_A, ENDED. No memberships, no other tie. */
function departedFromHospA(): void {
  tables = {
    hospital_affiliations: [
      { principal_id: TARGET, hospital_id: HOSP_A, ended_on: '2025-06-30' },
    ],
    memberships: [],
  }
}

/** The control: the SAME row, still active. Isolates `ended_on` as the only difference. */
function activeAtHospA(): void {
  tables = {
    hospital_affiliations: [
      { principal_id: TARGET, hospital_id: HOSP_A, ended_on: null },
    ],
    memberships: [],
  }
}

beforeEach(() => {
  appliedFilters = []
  departedFromHospA()
})

async function footprint() {
  const { resolvePersonFootprint } = await import('./person-footprint')
  return resolvePersonFootprint(TARGET)
}

async function allows(capability: 'fields' | 'credentials' | 'cpf_change' | 'lifecycle') {
  const { personScopeAllows } = await import('./person-scope')
  return personScopeAllows(capability, await footprint(), [HOSP_A])
}

// ===========================================================================
describe('§1 a DEPARTED person yields an EMPTY active footprint', () => {
  /**
   * ⭐ THE KEYSTONE. Mutation-verified: with `.is('ended_on', null)` deleted from
   * `resolvePersonFootprint`, the ended row survives the mock, `hospitalIds` comes back as
   * `[HOSP_A]`, and this arm fails on `[]` vs `[HOSP_A]`. That is the property the whole
   * file is built around.
   */
  it('resolves to no hospitals at all — the ended affiliation does not count', async () => {
    const fp = await footprint()
    expect(fp.hospitalIds).toEqual([])
    expect(fp.hasNonCommissionTierMembership).toBe(false)
  })

  it.each(['fields', 'credentials', 'cpf_change', 'lifecycle'] as const)(
    'denies `%s` to a hospital_admin of the hospital the person LEFT',
    async (capability) => {
      expect(await allows(capability)).toBe(false)
    },
  )
})

// ===========================================================================
describe('§2 the CONTROL that makes §1 mean something', () => {
  /**
   * Without this, every §1 arm would pass just as well against a mock that returned no
   * rows at all, a broken import, or a footprint resolver that always answers empty —
   * none of which is the property under test. The ONLY difference between the two
   * fixtures is `ended_on`.
   */
  it('the SAME affiliation, still active, DOES produce a footprint', async () => {
    activeAtHospA()
    const fp = await footprint()
    expect(fp.hospitalIds).toEqual([HOSP_A])
  })

  it('and the intersection capabilities are then ALLOWED', async () => {
    activeAtHospA()
    expect(await allows('fields')).toBe(true)
    expect(await allows('credentials')).toBe(true)
  })

  it('and the subset capabilities are allowed for a sole-hospital footprint', async () => {
    activeAtHospA()
    expect(await allows('cpf_change')).toBe(true)
    expect(await allows('lifecycle')).toBe(true)
  })
})

// ===========================================================================
describe('§3 the read/write boundary ADR 0148 turns on', () => {
  /**
   * The one-sentence statement of the change, as an executable pair. READ widened (proven
   * in pgTAP 371 §1); WRITE did not (here). Both halves in one place so a future reader
   * cannot pick up half the rule.
   */
  it('a departed person is unmanageable while an active colleague at the same hospital is manageable', async () => {
    departedFromHospA()
    expect(await allows('fields')).toBe(false)

    activeAtHospA()
    expect(await allows('fields')).toBe(true)
  })

  it('a caller administering a DIFFERENT hospital is denied even for an active person', async () => {
    activeAtHospA()
    const { personScopeAllows } = await import('./person-scope')
    expect(personScopeAllows('fields', await footprint(), [HOSP_B])).toBe(false)
  })

  /**
   * A DIAGNOSTIC, not the proof — §1 is the proof. This exists so that if someone swaps
   * `.is('ended_on', null)` for a mechanism the mock cannot model (a raw `.or(...)`
   * PostgREST string, say), the failure names the cause instead of surfacing as a
   * mysterious footprint mismatch two sections up.
   */
  it('the resolver actually asked the database to filter on ended_on', async () => {
    await footprint()
    expect(appliedFilters).toContainEqual({
      table: 'hospital_affiliations',
      method: 'is',
      column: 'ended_on',
      value: null,
    })
  })
})
