import { describe, it, expect } from 'vitest'

import { deriveIsAdmin } from './session'
import type { AdminAccountState } from './session'

/**
 * `deriveIsAdmin` is the TS mirror of `app.is_admin()`, and it is the ONLY authority on the
 * service-role paths — `src/lib/admin/actions.ts` and `src/lib/users/actions.ts` run their
 * mutations on a client that bypasses RLS entirely, so there is no DB predicate underneath to
 * catch a wrong answer here.
 *
 * ⭐ WHY THIS FILE EXISTS (pre-AE5 remediation Batch 10, ADR 0201 D4, PO ruling R3). The
 * migration `20261003007390` added `app.is_active(auth.uid())` to `app.is_admin()`. Before it,
 * this mirror had TWO conjuncts and the SQL had two; after it the SQL has three. A mirror whose
 * value is "the day it disagrees" is worth nothing while nothing measures it, and the drift
 * would not have been cosmetic: a deactivated `platform_admin` would have kept passing
 * `context.isAdmin` on both service-role doors. The SQL fix alone would have READ complete.
 *
 * ⛔ THE PREDICATE IS IMPORTED, NEVER RE-IMPLEMENTED. It was inlined in `getSessionContext`
 * until this batch, which is `cache()`-wrapped, awaits a Supabase client and issues an RPC —
 * untestable without mocking three seams. The only way to assert anything about it was to
 * hand-copy the expression into a spec, and a harness that holds a hand-written copy of
 * production text agrees with itself forever. Extracting the function is what makes the rows
 * below measurements rather than a restatement.
 *
 * RED-FIRST, MEASURED (2026-09-10, before the third conjunct was added): rows 2, 3 and 5
 * failed against the two-conjunct production derivation; every other row passed. A row that was
 * never red proves nothing, and the seven that stayed green are the controls that stop the
 * three from being satisfied by a predicate that simply denies everyone.
 *
 * ⚠ WHAT THIS IS NOT. `deriveUserStatus` (`src/lib/users/types.ts`) folds `email_confirmed_at`
 * into its answer ON PURPOSE — a `pending` user is app-ACTIVE for RLS and display-`pending` —
 * so substituting it here would deny a confirmed-later admin the DB still admits. That is why
 * {@link AdminAccountState} carries exactly the two columns `app.is_active` reads and no third:
 * the shape is the assertion, checked by the compiler.
 */

/** The instant every row below is evaluated at — injected, so no row depends on wall clock. */
const NOW = new Date('2026-09-10T12:00:00.000Z')

const ACTIVE: AdminAccountState = { is_active: true, suspended_until: null }

interface Vector {
  name: string
  claimIsAdmin: unknown
  activeRole: string | null
  profile: AdminAccountState | null
  expected: boolean
  /** What this row is FOR: 'mirror' rows were RED before the third conjunct; the rest are controls. */
  kind: 'mirror' | 'control'
}

const VECTORS: Vector[] = [
  {
    name: '1 · DISCRIMINATION: active, admin-flagged, platform_admin hat -> admin',
    claimIsAdmin: true,
    activeRole: 'platform_admin',
    profile: ACTIVE,
    expected: true,
    kind: 'control',
  },
  {
    name: '2 · DEACTIVATED (is_active = false) -> NOT admin  [RED before the fix]',
    claimIsAdmin: true,
    activeRole: 'platform_admin',
    profile: { is_active: false, suspended_until: null },
    expected: false,
    kind: 'mirror',
  },
  {
    name: '3 · SUSPENDED (suspended_until in the future) -> NOT admin  [RED before the fix]',
    claimIsAdmin: true,
    activeRole: 'platform_admin',
    profile: { is_active: true, suspended_until: '2026-09-17T12:00:00.000Z' },
    expected: false,
    kind: 'mirror',
  },
  {
    name: '4 · CONTROL, the other side of the suspension window: a suspension that has ELAPSED does not deny',
    claimIsAdmin: true,
    activeRole: 'platform_admin',
    profile: { is_active: true, suspended_until: '2026-09-03T12:00:00.000Z' },
    expected: true,
    kind: 'control',
  },
  {
    name: '5 · MISSING PROFILE -> NOT admin (fails CLOSED, matching app.is_active\'s coalesce)  [RED before the fix]',
    claimIsAdmin: true,
    activeRole: 'platform_admin',
    profile: null,
    expected: false,
    kind: 'mirror',
  },
  {
    name: '6 · CONTROL, the boundary: suspended_until EXACTLY now is active (SQL reads `now() >= suspended_until`)',
    claimIsAdmin: true,
    activeRole: 'platform_admin',
    profile: { is_active: true, suspended_until: NOW.toISOString() },
    expected: true,
    kind: 'control',
  },
  {
    name: '7 · CONTROL (ADR 0106 D11): no active hat -> NOT admin, however active the account',
    claimIsAdmin: true,
    activeRole: null,
    profile: ACTIVE,
    expected: false,
    kind: 'control',
  },
  {
    name: '8 · CONTROL (ADR 0106 D11): a DIFFERENT hat -> NOT admin — the conjunct compares the value, not mere presence',
    claimIsAdmin: true,
    activeRole: 'org_admin',
    profile: ACTIVE,
    expected: false,
    kind: 'control',
  },
  {
    name: '9 · CONTROL: no is_admin claim (the hook absent) -> NOT admin',
    claimIsAdmin: undefined,
    activeRole: 'platform_admin',
    profile: ACTIVE,
    expected: false,
    kind: 'control',
  },
  {
    name: '10 · CONTROL: the STRING "true" is not the boolean true — `=== true` is the fail-closed read',
    claimIsAdmin: 'true',
    activeRole: 'platform_admin',
    profile: ACTIVE,
    expected: false,
    kind: 'control',
  },
]

describe('deriveIsAdmin — the TS mirror of app.is_admin()', () => {
  it.each(VECTORS)('$name', ({ claimIsAdmin, activeRole, profile, expected }) => {
    expect(deriveIsAdmin(claimIsAdmin, activeRole, profile, NOW)).toBe(expected)
  })

  /**
   * ⛔ THE VACUITY GUARD. Every row above could be satisfied by a predicate that returns a
   * constant, and `it.each` would still report ten passes. This asserts the table itself
   * exercises BOTH answers and that the three account-state rows — the ones this batch added,
   * and the only ones that were RED — are actually present.
   */
  it('the table returns BOTH answers and carries the three account-state rows', () => {
    expect(VECTORS.some((v) => v.expected)).toBe(true)
    expect(VECTORS.some((v) => !v.expected)).toBe(true)
    expect(VECTORS.filter((v) => v.kind === 'mirror')).toHaveLength(3)
  })
})
