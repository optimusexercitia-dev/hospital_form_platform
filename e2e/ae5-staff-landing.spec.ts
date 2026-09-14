import { expect, test } from '@playwright/test'

import { cachedSignIn } from './helpers/auth'

/**
 * AE5-STAFF — T13, the landing-seam half.
 *
 * THE CLASS THIS GUARDS (plan `docs/plans/authz-evolution.md`, near the tester bullet
 * under AE4.9 — re-verified this round, the line moved to :999-1001): "the three
 * historical landing-seam bugs (BUG-HAT-001 class) get one E2E spec per scope-kind
 * asserting a freshly-granted role lands somewhere — the regression class that
 * motivated F1." `staff` is commission-scoped ONLY (`ROLE_MANIFEST`,
 * `src/lib/role/role-catalog.ts`), so there is exactly one scope-kind to cover here;
 * `e2e/ae48-landing-by-scope-kind.spec.ts` already proves the SAME scope-kind lands
 * for `staff_admin` — this file is the `staff`-specific proof that AE5's cutover
 * (the atomic flip to `authoritative` + the re-key) did not silently reopen the same
 * dead end for the OTHER commission-tier role.
 *
 * ⛔ NOT a duplicate of `ae48-landing-by-scope-kind.spec.ts`. That file's own
 * enumeration boundary (`ROLE_SCOPE_KIND` vs its `CASES` list) is about SCOPE KINDS,
 * not roles — `staff` sharing `commission` with `staff_admin` there is already
 * correct and is not reopened here. This file adds two coordinates that spec does
 * not cover at all: a `staff` whose account is `pending` (unconfirmed email) and one
 * that is `deactivated`, both landing (or being routed away) through the SAME
 * `app.is_member_of_for`-gated branch AE5 just re-keyed.
 *
 * Personas (supabase/seed.sql "round 4 (backend)" block, `a5f…` prefix — built for
 * the AE5-STAFF authz differential, T13 reuses them here rather than inventing new
 * ones): `gap.pending@test.local` — `staff` @ CCIH (Rede A), account UNCONFIRMED
 * (`profiles.email_confirmed_at IS NULL`); `gap.deactivated@test.local` — `staff` @
 * CCIH, `profiles.is_active = false`. Both are single-commission, single-role — the
 * exact shape `ae48`'s own header requires ("ONE PERSONA PER SCOPE KIND, EACH
 * HOLDING EXACTLY ONE ROLE") so neither can be routed to `/selecionar-perfil` or
 * `/c` for a reason unrelated to what this file tests.
 *
 * ⛔ `enable_confirmations = false` in `supabase/config.toml` (local dev) — GoTrue
 * does not block a password login on `email_confirmed_at IS NULL`, so `gap.pending`
 * reaches the app exactly like any other signed-in principal; "pending" here is a
 * PROFILE fact the app's own predicates read (`app.is_active` does not consult it —
 * measured, `docs/design/authz-ae5-staff-deny-class-effects.md` row 5), never a
 * GoTrue-level bar. Confirmed live by prior authz measurement, not assumed here.
 *
 * No persona crosses orgs (CLAUDE.md §9) — both personas below are Rede A only.
 */

const DEAD_END = /Você ainda não tem acesso/i
const CCIH_URL = /\/o\/rede-a\/c\/ccih(\/|$)/

test.describe('AE5-STAFF — staff landing seam (BUG-HAT-001 class)', () => {
  test('commission scope-kind: a staff persona lands in their commission, never the dead end', async ({
    page,
  }) => {
    // staff4.ccih@test.local — single commission (CCIH), single role (staff),
    // ACTIVE — the plain-vanilla shape the cutover must not have broken.
    await cachedSignIn(page, 'staff4.ccih@test.local')
    await page.goto('/')

    // ⛔ Assert the dead end first, as its own assertion — see ae48's own comment
    // on why the URL match alone is not enough (a future "sem acesso" page served
    // at a plausible URL would pass a URL-only check).
    await expect(page.locator('body')).not.toContainText(DEAD_END)
    expect(page.url()).toMatch(CCIH_URL)
  })

  test('a staff whose only membership is pending (unconfirmed account) lands in their commission', async ({
    page,
  }) => {
    await cachedSignIn(page, 'gap.pending@test.local')
    await page.goto('/')

    await expect(page.locator('body')).not.toContainText(DEAD_END)
    expect(page.url()).toMatch(CCIH_URL)
  })

  test('a deactivated staff is routed to /conta-inativa, never a silent dead end', async ({
    page,
  }) => {
    await cachedSignIn(page, 'gap.deactivated@test.local')
    await page.goto('/')

    // `requireUser` redirects a non-active principal here (src/app/conta-inativa) —
    // a DIFFERENT, informative outcome from the generic dead end, and this test
    // pins that distinction: a deactivated staff must not land on either the
    // commission workspace (their membership no longer functionally grants
    // anything — `app.is_active` gates `is_member_of_for` internally) or the
    // unqualified "sem acesso" page (which would read as "never provisioned"
    // rather than "provisioned, then deactivated").
    await expect(page).toHaveURL(/\/conta-inativa(\/|$)/)
    await expect(page.getByRole('heading', { name: 'Conta inativa' })).toBeVisible({
      timeout: 10_000,
    })
  })
})
