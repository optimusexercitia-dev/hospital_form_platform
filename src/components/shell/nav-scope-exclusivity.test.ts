import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isCommissionAdmin } from '@/lib/auth/access'
import { partitionGrants, type SessionGrant } from '@/lib/queries/session-grants'
import {
  expectedMembershipRoleVocabulary,
  readRoleVocabularyFromCatalog,
} from '@/lib/role/membership-role-vocabulary.test-support'

/**
 * ⭐ ACT S4 / QA MINOR-1 — THE TRIPWIRE UNDER THE DELETED `navScope` ARM.
 *
 * THE INVARIANT. In the commission layout's MEMBER branch
 * (`src/app/o/[org]/c/[commission]/layout.tsx`), a non-null `access.role` and
 * `access.isTenancyAdmin` are MUTUALLY EXCLUSIVE. The layout used to select
 * `access.isTenancyAdmin ? "member-and-configuration" : "member"` there; ACT
 * (ADR 0106) made the truthy arm unreachable, and S4 deleted it — along with
 * `AppSidebar`'s matching `SidebarNavScope` arm.
 *
 * WHY A GUARD AT ALL. Deleting the arm makes the code fail CLOSED (a widened
 * principal gets the NARROWER `"member"` scope), but it does not make the
 * exclusion itself true — only ACT does. Nothing else in the tree asserts it, so
 * a widening would silently produce a shape the layout no longer expects. QA's
 * MINOR-1: "dead authorization branches are how a future widening quietly
 * re-lights a shape nobody tested."
 *
 * THE TWO SEAMS IT BUYS THE EXCLUSION FROM, both exercised REAL, never
 * re-implemented (a re-implementation passes while the product fails):
 *
 *   A. `getSessionContext` (`src/lib/queries/session.ts`) filters every grant to
 *      the session's ACTIVE hat before partitioning — one hat, one role value.
 *   B. `partitionGrants` (`src/lib/queries/session-grants.ts`) routes
 *      `staff`/`staff_admin` to `memberships` (what makes `access.role` non-null)
 *      and `org_admin`/`hospital_admin` to `orgAdminOf`/`hospitalAdminOf` (all
 *      `isTenancyAdmin` reads, via the REAL `isCommissionAdmin`) — DISJOINT
 *      buckets keyed on `role`.
 *
 * Either seam alone is sufficient today, so both are tested separately: seam B
 * would still hold if the hat filter were removed, and seam A would still hold
 * if a role were added to both buckets. The exclusion dies only when BOTH do,
 * and this file reds on either.
 *
 * THE ENUMERATION BOUNDARY IS THE CATALOG, READ AT TEST TIME — the live
 * `memberships_role_check` vocabulary, never a list someone must remember to
 * update (the ONE reader in `src/lib/role/membership-role-vocabulary.test-support.ts`,
 * shared with the FUP-QO-2 guard in `src/lib/queries/session-grants.test.ts` — shared
 * LOGIC, but this file's OWN read, pinned below to the manifest-derived set; that
 * module's header carries the rationale). A role added to the CHECK is swept here for
 * free.
 *
 * ⚠ REQUIRES THE LOCAL SUPABASE STACK, and fails loudly rather than skipping
 * when it is down — a guard that quietly turns itself off is not a guard.
 */

const ORG = {
  id: '00000000-0000-0000-0000-0000000e0001',
  slug: 'org-teste',
  name: 'Organização Teste',
}
const HOSPITAL_ID = '00000000-0000-0000-0000-0000000e0002'
const COMMISSION_ID = '00000000-0000-0000-0000-0000000e0003'
const USER_ID = '00000000-0000-0000-0000-0000000e0000'

/** The commission the layout resolves — the scope `isCommissionAdmin` is asked about. */
const COMMISSION_SCOPE = { organizationId: ORG.id, hospitalId: HOSPITAL_ID }

/**
 * A grant of `role` with EVERY scope reference populated — deliberately wider
 * than any row `memberships`' scope-exclusivity CHECK admits. That is the point:
 * it removes the hand-maintained role→scope map, keeping the catalog as the sole
 * enumeration boundary. It cannot manufacture a false green, because every filter
 * in `partitionGrants` keys on `role` FIRST — a populated scope reference can
 * never route a role that has no filter. (Same construction, and same reasoning,
 * as `session-grants.test.ts`'s `maximalGrantFor`.)
 */
function maximalGrantFor(role: string): SessionGrant {
  return {
    role,
    organization: ORG,
    hospital: {
      id: HOSPITAL_ID,
      slug: 'hospital-teste',
      name: 'Hospital Teste',
      organization_id: ORG.id,
    },
    commission: {
      id: COMMISSION_ID,
      slug: 'comissao-teste',
      name: 'Comissão Teste',
      organization: ORG,
    },
  }
}

/** `true` when this grant set confers BOTH standings — the state the deleted arm encoded. */
function holdsBothStandings(grants: SessionGrant[]): boolean {
  const lists = partitionGrants(grants)
  const hasMemberRole =
    lists.memberships.some((m) => m.commission.id === COMMISSION_ID)
  // The REAL `isTenancyAdmin` derivation: `getCommissionAccessByOrg` computes it
  // as exactly this call over exactly these two lists.
  const isTenancyAdmin = isCommissionAdmin(
    {
      orgAdminOf: lists.orgAdminOf,
      hospitalAdminOf: lists.hospitalAdminOf,
    } as Parameters<typeof isCommissionAdmin>[0],
    COMMISSION_SCOPE,
  )
  return hasMemberRole && isTenancyAdmin
}

// ---------------------------------------------------------------------------
// Seam A needs the REAL `getSessionContext`, so its Supabase client is stubbed
// (established pattern — see `src/lib/responses/actions.test.ts` et al.). Nothing
// else about the derivation is replaced: the hat filter and `partitionGrants`
// both run for real.
// ---------------------------------------------------------------------------

const rpcState = vi.hoisted(() => ({
  activeRole: null as string | null,
  grants: [] as unknown[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getClaims: async () => ({
        data: {
          claims: {
            sub: USER_ID,
            email: 'hat@test.local',
            is_admin: false,
            ...(rpcState.activeRole === null
              ? {}
              : { active_role: rpcState.activeRole }),
          },
        },
        error: null,
      }),
    },
    rpc: async (fn: string) => {
      if (fn !== 'session_context') {
        throw new Error(`ACT S4 nav-scope guard: unexpected RPC ${fn}`)
      }
      return {
        data: {
          profile: {
            full_name: 'Persona de Chapéu',
            is_active: true,
            suspended_until: null,
            email_confirmed_at: '2026-01-01T00:00:00Z',
            must_change_password: false,
          },
          grants: rpcState.grants,
        },
        error: null,
      }
    },
  }),
}))

/**
 * Resolve a real `SessionContext` for a session wearing `activeRole`, holding
 * `grants`. Module registry is reset per call so React's `cache()` wrapper on
 * `getSessionContext` (which takes no arguments, and would therefore memoize
 * every hat to the first one) cannot bleed between roles.
 */
async function resolveContextWearing(activeRole: string, grants: SessionGrant[]) {
  rpcState.activeRole = activeRole
  rpcState.grants = grants
  vi.resetModules()
  const { getSessionContext } = await import('@/lib/queries/session')
  const context = await getSessionContext()
  if (!context) {
    throw new Error(
      `ACT S4 nav-scope guard: getSessionContext returned null for hat "${activeRole}" — ` +
        'the stub no longer satisfies its claims contract, so every assertion below is vacuous.',
    )
  }
  return context
}

describe('ACT S4 — the commission nav scopes are mutually exclusive', () => {
  const ROLES = readRoleVocabularyFromCatalog('ACT S4 nav-scope guard')
  const ALL_HATS_AT_ONCE = ROLES.map(maximalGrantFor)

  beforeEach(() => {
    rpcState.activeRole = null
    rpcState.grants = []
  })

  /**
   * ⭐ FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT — THE SET PIN. Both `it.each(ROLES)` blocks
   * below generate one case per role the live read returned; a read taken inside a
   * `supabase db reset`'s transient window (the CHECK present, valid, PARTIAL) generates
   * fewer and stays green, and pgTAP 292 cannot see that window. This pins THIS file's
   * own read to the SET derived from `ROLE_MANIFEST` — never `.length` (a substitution
   * keeps the count). `session-grants.test.ts` keeps its own read pinned to the same set.
   */
  it('the live memberships_role_check vocabulary IS the manifest-derived role set', () => {
    expect([...ROLES].sort()).toEqual(expectedMembershipRoleVocabulary())
  })

  /**
   * FALSIFIABILITY CONTROL — runs FIRST and is the reason the two guards below
   * mean anything. It asserts the fixture can actually produce the forbidden
   * state, so a broken mock or an over-narrow grant list cannot make the
   * exclusion look true by producing nothing at all. It also localises the
   * mechanism: hat-blind, both standings ARE reachable, so what forbids them is
   * the ACT hat filter and the bucket disjointness — not the fixture.
   */
  it('CONTROL: hat-blind, the same grants DO confer both standings', () => {
    expect(holdsBothStandings(ALL_HATS_AT_ONCE)).toBe(true)
  })

  /**
   * SEAM A + B, end to end through the REAL `getSessionContext`. The principal
   * holds EVERY role in the vocabulary at once — the strongest possible input —
   * and wears them one at a time.
   */
  it.each(ROLES)(
    'wearing "%s", a maximally multi-hatted principal never holds member AND tenancy-admin standing',
    async (role) => {
      const context = await resolveContextWearing(role, ALL_HATS_AT_ONCE)

      const hasMemberRole = context.memberships.some(
        (m) => m.commission.id === COMMISSION_ID,
      )
      const isTenancyAdmin = isCommissionAdmin(context, COMMISSION_SCOPE)

      expect(
        hasMemberRole && isTenancyAdmin,
        `Hat "${role}" resolved BOTH a membership role and tenancy-admin standing on the ` +
          'same commission. That is the state the deleted `navScope="member-and-configuration"` ' +
          'arm encoded (ACT S4 / QA MINOR-1). The commission layout no longer has a branch for ' +
          'it: it now renders the NARROWER `navScope="member"`, so such a principal silently ' +
          'loses the KEEP configuration nav items. Restore the exclusion, or deliberately ' +
          're-introduce the composite scope in `SidebarNavScope` + the layout — and test it.',
      ).toBe(false)
    },
  )

  /**
   * SEAM B in isolation: `partitionGrants`' buckets are disjoint on `role`, so a
   * SINGLE role can never fill both families. This holds independently of the hat
   * filter, and is what reds if someone adds a new role to both filters.
   */
  it.each(ROLES)(
    'the role "%s" alone is routed to at most one of the two nav families',
    (role) => {
      expect(
        holdsBothStandings([maximalGrantFor(role)]),
        `partitionGrants routes "${role}" into BOTH the membership family and the ` +
          'tenancy-admin family. Those buckets must stay disjoint on `role` — the ' +
          'commission nav treats the two scopes as exclusive (see SidebarNavScope).',
      ).toBe(false)
    },
  )
})
