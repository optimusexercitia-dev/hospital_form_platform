import { expect, test, type Page } from '@playwright/test'

import { cachedSignIn } from './helpers/auth'
import { ROLE_SCOPE_KIND, type RoleScopeKind } from '@/lib/role/role-catalog'

/**
 * ⭐ AE4.8 — ONE LANDING SPEC PER SCOPE KIND (the plan's tester bullet).
 *
 * THE CLASS IT GUARDS. Three times a role shipped with no home and its holder signed in
 * to "Você ainda não tem acesso" while being fully provisioned: BUG-HAT-001
 * (`hospital_admin`), the Diretor Técnico, then `quality_reviewer`. Every one was
 * hospital- or org-scoped — `commission_id NULL` — and every one crossed neither the
 * grant partition nor `page.tsx`'s branch chain. AE4.8 collapsed those two seams into one
 * manifest; this spec is the end-to-end half of the proof.
 *
 * ⛔ WHY IT IS NOT REDUNDANT WITH `session-grants.test.ts`. That guard is a unit test with
 * `getSessionContext` STUBBED — it proves the partition and the branch chain agree about a
 * synthetic context. It cannot see the RPC that builds the real context, the JWT claims, the
 * middleware, or the destination page's own gate. A role can land correctly in jsdom and
 * still bounce off a server-side guard. The recorded lesson is that a DB-side proof is
 * evidence about the DB and nothing downstream; the same holds one layer up.
 *
 * ⛔ ONE PERSONA PER SCOPE KIND, EACH HOLDING EXACTLY ONE ROLE. A multi-role persona is
 * routed to `/selecionar-perfil` by the ACT hat gate before any precedence branch runs, so
 * it would pass this spec while proving nothing about landing. `dualhat.a@` is exactly that
 * trap and is deliberately not used here.
 */

const DEAD_END = /Você ainda não tem acesso/i

interface ScopeCase {
  scopeKind: RoleScopeKind
  persona: string
  role: string
  /** The area this persona must reach. Deliberately an AREA, not an exact slug — the
   *  point is "landed somewhere real", and pinning a commission slug would make this
   *  spec fail for seed reasons that have nothing to do with the landing seam. */
  landing: RegExp
}

const CASES: ScopeCase[] = [
  {
    scopeKind: 'none',
    persona: 'platform@test.local',
    role: 'platform_admin',
    landing: /\/admin(\/|$)/,
  },
  {
    scopeKind: 'organization',
    persona: 'orgadmin.a@test.local',
    role: 'org_admin',
    landing: /\/o\/[^/]+\/manage(\/|$)/,
  },
  {
    // ⭐ THE ORIGINAL BUG-HAT-001 PERSONA. `hospitaladmin.a1` is hospital_admin of
    // central-a and nothing else — the exact shape that used to dead-end.
    scopeKind: 'hospital',
    persona: 'hospitaladmin.a1@test.local',
    role: 'hospital_admin',
    landing: /\/o\/[^/]+\/manage(\/|$)/,
  },
  {
    scopeKind: 'commission',
    persona: 'chefe.ccih@test.local',
    role: 'staff_admin',
    landing: /\/o\/[^/]+\/c\/[^/]+/,
  },
]

async function landFromRoot(page: Page, persona: string) {
  await cachedSignIn(page, persona)
  // ⛔ NO `waitForURL` FOR THE REDIRECT. An earlier draft waited for the path to stop
  // being "/", which looked right and failed WRONG: when a role has no branch, page.tsx
  // renders the dead end AT "/", so the wait simply timed out. The regression was caught,
  // but as a 120s timeout with no mention of the actual symptom — a failure mode that
  // reads like a flake and gets retried rather than read. `goto` already follows the
  // server redirect, so after it the URL is final and the assertions can speak plainly.
  await page.goto('/')
}

test.describe('AE4.8 — a role at every scope kind lands somewhere', () => {
  for (const c of CASES) {
    test(`${c.scopeKind} scope (${c.role}) lands, and never on the dead end`, async ({
      page,
    }) => {
      await landFromRoot(page, c.persona)

      // ⛔ ASSERT THE DEAD END FIRST, and as its own assertion. If the landing regex
      // alone were checked, a future "sem acesso" page served AT a plausible URL would
      // pass. The dead end is the actual regression; the URL is the corroboration.
      await expect(page.locator('body')).not.toContainText(DEAD_END)
      expect(page.url()).toMatch(c.landing)
    })
  }

  test('every scope kind in the manifest is exercised above', () => {
    // ⛔ THE ENUMERATION BOUNDARY IS THE MANIFEST, NOT THIS FILE'S CASE LIST. Adding a
    // fifth scope kind to `authz.roles` must not leave this spec silently covering four
    // — that is the same "one list updated, the other not" mechanism behind all three
    // historical instances. `ROLE_SCOPE_KIND` is itself bound to `authz.roles` by
    // `src/lib/role/role-catalog.test.ts`, so this transitively rides on the catalog.
    const declared = new Set(Object.values(ROLE_SCOPE_KIND))
    const covered = new Set(CASES.map((c) => c.scopeKind))
    expect([...declared].sort()).toEqual([...covered].sort())
  })
})
