import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isCommissionAdmin } from '@/lib/auth/access'
import { partitionGrants, type SessionGrant } from '@/lib/queries/session-grants'

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
 * update (same derivation, and the same deliberate stack dependency, as the
 * FUP-QO-2 guard in `src/lib/queries/session-grants.test.ts`; that file's header
 * carries the full rationale). A role added to the CHECK is swept here for free.
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

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

/**
 * The live role vocabulary of `public.memberships_role_check`, read through the
 * DB container (the same path every harness in `supabase/tests/mutation/` uses).
 * The container name is derived from `supabase/config.toml`'s `project_id` rather
 * than hardcoded, so renaming the project cannot silently point this at a
 * container that does not exist.
 */
function readRoleVocabularyFromCatalog(): string[] {
  const configPath = path.join(REPO_ROOT, 'supabase', 'config.toml')
  const projectId = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync(configPath, 'utf8'),
  )?.[1]
  if (!projectId) {
    throw new Error(`ACT S4 nav-scope guard: no project_id in ${configPath}`)
  }

  const sql = `select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''::text', 'g'))[1]
                 from pg_constraint
                where conrelid = 'public.memberships'::regclass
                  and conname = 'memberships_role_check'`

  let raw: string
  try {
    raw = execFileSync(
      'docker',
      ['exec', `supabase_db_${projectId}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (cause) {
    throw new Error(
      'ACT S4 nav-scope guard: could not read memberships_role_check from the live ' +
        'catalog. Start the local stack (`supabase start`) — this guard reads the ' +
        'catalog on purpose and must never silently skip.',
      { cause },
    )
  }

  const roles = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (roles.length === 0) {
    throw new Error(
      'ACT S4 nav-scope guard: memberships_role_check yielded ZERO roles. Either ' +
        'the constraint was renamed or the extraction regex no longer matches its ' +
        'definition — an empty enumeration would make every assertion below vacuous.',
    )
  }
  return roles
}

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
  const ROLES = readRoleVocabularyFromCatalog()
  const ALL_HATS_AT_ONCE = ROLES.map(maximalGrantFor)

  beforeEach(() => {
    rpcState.activeRole = null
    rpcState.grants = []
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
