import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { partitionGrants, type SessionGrant } from '@/lib/queries/session-grants'
import type { SessionContext } from '@/lib/queries/session'

/**
 * ⭐ FUP-QO-2 — THE GUARD THAT CANNOT BE FORGOTTEN.
 *
 * THE CLASS. Three times a non-commission-scoped role (hospital- or org-scoped,
 * `commission_id NULL`) shipped with no home: BUG-HAT-001 (`hospital_admin`), then
 * the Diretor Técnico (patched after the fact by ADR 0094 W4), then
 * `quality_reviewer` (QO·A). Each time the account looked UNPROVISIONED while being
 * fully provisioned — the user signed in and read "Você ainda não tem acesso".
 * The Diretor Técnico patch left a comment in `src/app/page.tsx` stating the
 * mechanism outright, and the class recurred three months later anyway. **Prose in a
 * comment is not a guard.**
 *
 * THE ENUMERATION BOUNDARY IS THE CATALOG, READ AT TEST TIME. The role vocabulary
 * comes from `memberships_role_check` via `pg_constraint`, never from a list anyone
 * remembered to update — the recorded rule is that an enumeration's boundary must be
 * the PROPERTY, not a syntax and not a remembered list, and every instance of this
 * class so far has been someone updating one list and not the other. This is the same
 * derivation pgTAP `292` §3 uses; the two halves are deliberately independent — 292
 * proves each role has a grant/revoke ARM, this file proves each role has a LANDING.
 *
 * WHAT IT EXERCISES. The REAL `src/app/page.tsx` (its default export, unmodified)
 * over the REAL `partitionGrants`. Both seams a role must cross are therefore in the
 * loop: the partition that turns a grant into a `SessionContext` field, and the branch
 * chain that turns a field into a redirect. Re-implementing either here would produce
 * a test that passes while the product fails.
 *
 * ⚠ THIS TEST REQUIRES THE LOCAL SUPABASE STACK. It reads the live catalog, so it
 * FAILS LOUDLY when the stack is down rather than skipping: a guard that quietly
 * turns itself off is the "defensive branching converts not-implemented into passing"
 * trap, and this is the one guard standing between the pilot's primary daily user and
 * a dead-end login. `npm run test` already runs in the same Phase-Gate step as
 * `npm run test:db`, which needs the stack too.
 */

const state = vi.hoisted(() => ({ context: null as SessionContext | null }))

// Only `getSessionContext` is stubbed. `@/lib/routing` stays REAL — the href builders
// are part of what a landing route means, so a missing one must fail here too.
vi.mock('@/lib/queries/session', () => ({
  getSessionContext: async () => state.context,
}))
// `page.tsx` imports the sign-out server action for the NoAccess escape hatch. Stubbed
// so the test does not drag `next/headers` and the Supabase server client into jsdom.
vi.mock('@/lib/auth/actions', () => ({ signOut: async () => {} }))
// `redirect()` throws in Next; make the throw carry the URL so a landing can be named.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { landingUrl: url })
  },
}))

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

/**
 * The live role vocabulary of `public.memberships_role_check`.
 *
 * Read through the DB container, which is how every mutation harness in
 * `supabase/tests/mutation/` reaches the catalog. The container name is derived from
 * `supabase/config.toml`'s `project_id` rather than hardcoded, so renaming the project
 * cannot silently point this at a container that does not exist.
 */
function readRoleVocabularyFromCatalog(): string[] {
  const configPath = path.join(REPO_ROOT, 'supabase', 'config.toml')
  const projectId = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync(configPath, 'utf8'),
  )?.[1]
  if (!projectId) {
    throw new Error(`FUP-QO-2 guard: no project_id in ${configPath}`)
  }

  // Same extraction as pgTAP 292 §3's `role_vocab`.
  const sql = `select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''::text', 'g'))[1]
                 from pg_constraint
                where conrelid = 'public.memberships'::regclass
                  and conname = 'memberships_role_check'`

  let raw: string
  try {
    raw = execFileSync(
      'docker',
      [
        'exec',
        `supabase_db_${projectId}`,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-tAc',
        sql,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (cause) {
    throw new Error(
      'FUP-QO-2 guard: could not read memberships_role_check from the live catalog. ' +
        'Start the local stack (`supabase start`) — this guard reads the catalog on ' +
        'purpose and must never silently skip.',
      { cause },
    )
  }

  const roles = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (roles.length === 0) {
    throw new Error(
      'FUP-QO-2 guard: memberships_role_check yielded ZERO roles. Either the ' +
        'constraint was renamed or the extraction regex no longer matches its ' +
        'definition — an empty enumeration would make every assertion below vacuous.',
    )
  }
  return roles
}

/**
 * A grant of `role` with EVERY scope reference populated.
 *
 * Deliberately wider than any row `memberships`' scope-exclusivity CHECK admits, and
 * that is the point: it removes the hand-maintained role→scope map entirely, so the
 * enumeration boundary stays the catalog alone. It cannot manufacture a false green —
 * every filter in `partitionGrants` keys on `role` FIRST, so a populated scope ref can
 * never route a role that has no filter; and if a maximally-populated grant fails to
 * land, the narrower real one certainly does too.
 */
function maximalGrantFor(role: string): SessionGrant {
  const organization = {
    id: '00000000-0000-0000-0000-0000000f0001',
    slug: 'org-teste',
    name: 'Organização Teste',
  }
  return {
    role,
    organization,
    hospital: {
      id: '00000000-0000-0000-0000-0000000f0002',
      slug: 'hospital-teste',
      name: 'Hospital Teste',
      organization_id: organization.id,
    },
    commission: {
      id: '00000000-0000-0000-0000-0000000f0003',
      slug: 'comissao-teste',
      name: 'Comissão Teste',
      organization,
    },
  }
}

function contextHolding(role: string): SessionContext {
  return {
    userId: '00000000-0000-0000-0000-0000000f0000',
    email: 'landing@test.local',
    fullName: 'Persona de Aterrissagem',
    isAdmin: false,
    status: 'active',
    isInactive: false,
    mustChangePassword: false,
    // ACT (ADR 0106): this landing-precedence test drives page.tsx's branches
    // directly with a full grant set already assumed — activeRole/needsRoleSelection
    // are irrelevant to what it's testing (the picker gate is a separate, earlier
    // check page.tsx performs before reaching these branches), so a fixed
    // single-role-equivalent shape is fine here.
    activeRole: role,
    needsRoleSelection: false,
    ...partitionGrants([maximalGrantFor(role)]),
  }
}

interface LandingOutcome {
  landed: boolean
  url: string | null
}

async function resolveLanding(role: string): Promise<LandingOutcome> {
  state.context = contextHolding(role)
  const { default: Home } = await import('@/app/page')
  try {
    await Home()
    // Home RETURNED — it rendered the "sem acesso" screen instead of redirecting.
    return { landed: false, url: null }
  } catch (error) {
    const url = (error as { landingUrl?: unknown }).landingUrl
    if (typeof url === 'string') {
      return { landed: true, url }
    }
    throw error
  }
}

const CATALOG_ROLES = readRoleVocabularyFromCatalog()

/**
 * Roles known to have NO landing route, with the date they were found.
 *
 * ⛔ This is a LEDGER, not a mute button. It is asserted to be EXACTLY the unrouted
 * set (both directions), so:
 *   • any further role arriving with no home reds `every role in the catalog lands`;
 *   • fixing one of these reds `the ledger has no stale entries`.
 * Neither can be satisfied by leaving this list alone.
 *
 * ⭐ CURRENTLY EMPTY — every role `memberships_role_check` admits now has a landing.
 * `nsp_coordinator` / `pqs_member` (found 2026-08-07 by this guard on its first run,
 * pre-existing; instances 4 and 5 of the FUP-QO-2 class — both hospital-scoped with
 * `commission_id NULL`) were removed the same day when F7 closed BOTH seams: the
 * backend one (`partitionGrants` emits `nspOperatorOf`) and the frontend one (the
 * `src/app/page.tsx` NSP-operator branch). They now resolve to `/o/<org>/nsp` through
 * the real chain. The `string[]` annotation is deliberate: a bare `[]` would infer
 * `never[]` and turn the filters below into type errors instead of no-ops.
 */
const KNOWN_UNROUTED: string[] = []

describe('FUP-QO-2 — every membership role resolves to a landing route', () => {
  it('reads a non-trivial role vocabulary from the live catalog', () => {
    expect(CATALOG_ROLES.length).toBeGreaterThan(0)
    // The ledger may only name roles the CHECK actually admits.
    for (const role of KNOWN_UNROUTED) {
      expect(CATALOG_ROLES).toContain(role)
    }
  })

  it.each(CATALOG_ROLES.filter((r) => !KNOWN_UNROUTED.includes(r)))(
    'a principal holding only `%s` lands somewhere (not NoAccess)',
    async (role) => {
      const outcome = await resolveLanding(role)
      expect(
        outcome.landed,
        `role "${role}" exists in memberships_role_check but src/app/page.tsx steps ` +
          `over it — its holder sees "Você ainda não tem acesso". This is FUP-QO-2's ` +
          `class: wire a branch (and, if needed, a partitionGrants filter) or add the ` +
          `role to KNOWN_UNROUTED with a dated rationale.`,
      ).toBe(true)
      expect(outcome.url).toMatch(/^\//)
    },
  )

  /**
   * A second vacuity guard, with no remembered list in it. If some single always-true
   * branch near the top of `page.tsx` swallowed every role, every assertion above would
   * be green while proving nothing about the per-role chain. Distinct landings prove the
   * chain genuinely dispatches. (`isAdmin` is false in the fixture, so the `/admin`
   * catch-all cannot be what is answering.)
   */
  it('routed roles do NOT all collapse onto one landing route', async () => {
    const urls = new Set<string>()
    for (const role of CATALOG_ROLES.filter((r) => !KNOWN_UNROUTED.includes(r))) {
      const outcome = await resolveLanding(role)
      if (outcome.url) urls.add(outcome.url)
    }
    expect(urls.size).toBeGreaterThan(1)
  })

  it('the KNOWN_UNROUTED ledger has no stale entries (a fixed role must be removed)', async () => {
    // FUP-VACUOUS-AUDIT-1. Unlike most findings, an EMPTY ledger here is the GOAL
    // state (every role routes), so having nothing to iterate is success rather than
    // a defect — but it should be SAID, not left silent. The unconditional assertion
    // is chosen to still earn its keep when the ledger is empty AND when it is not:
    // an entry naming a role the catalog does not know is a typo that would sit here
    // forever, exempting nothing and looking like diligence.
    expect(
      KNOWN_UNROUTED.filter((r) => !CATALOG_ROLES.includes(r)),
      'KNOWN_UNROUTED names a role the catalog does not have',
    ).toEqual([])
    for (const role of KNOWN_UNROUTED) {
      const outcome = await resolveLanding(role)
      expect(
        outcome.landed,
        `role "${role}" now LANDS on ${outcome.url}. Remove it from KNOWN_UNROUTED — a ` +
          `ledger that keeps naming fixed roles is how the next recurrence hides.`,
      ).toBe(false)
    }
  })

  /**
   * ⭐ THE CONTROL. Every assertion above is a `toBe(true)` over a set the catalog
   * supplied; if `resolveLanding` could never report a failure, the whole file would
   * be green while asserting nothing (a detector that finds nothing must be proven able
   * to find something). Drive it with a role the catalog does NOT admit and require the
   * NoAccess outcome.
   */
  it('CONTROL: the detector reports NoAccess for a role with no branch', async () => {
    const synthetic = '__fup_qo2_control_role__'
    expect(CATALOG_ROLES).not.toContain(synthetic)
    const outcome = await resolveLanding(synthetic)
    expect(outcome.landed).toBe(false)
    expect(outcome.url).toBeNull()
  })
})
