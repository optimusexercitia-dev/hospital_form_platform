import { expect, test } from '@playwright/test'

import { cachedSignIn, DEFAULT_PASSWORD } from './helpers/auth'

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
 * correct and is not reopened here. This file adds coordinates that spec does not
 * cover at all: a `staff` whose account is `pending` (unconfirmed email), one that
 * is `deactivated` at the moment it tries to log in, and one that is deactivated
 * MID-SESSION (already landed, then loses access) — three different points on the
 * SAME `app.is_member_of_for`-gated branch AE5 just re-keyed.
 *
 * Personas (supabase/seed.sql "round 4 (backend)" block, `a5f…` prefix — built for
 * the AE5-STAFF authz differential, T13 reuses them here rather than inventing new
 * ones): `gap.pending@test.local` — `staff` @ CCIH (Rede A), account UNCONFIRMED
 * (`profiles.email_confirmed_at IS NULL` / `auth.users.email_confirmed_at IS NULL`);
 * `gap.deactivated@test.local` — `staff` @ CCIH, `profiles.is_active = false`;
 * `gap.comember.ccih@test.local` — `staff` @ CCIH, ACTIVE, single membership, used
 * ONLY by this file (confirmed: no other `e2e/**` spec references it), so the
 * deactivate/restore transition below cannot collide with a parallel spec that
 * expects it to stay active. All three are single-commission, single-role — the
 * exact shape `ae48`'s own header requires ("ONE PERSONA PER SCOPE KIND, EACH
 * HOLDING EXACTLY ONE ROLE") so none can be routed to `/selecionar-perfil` or `/c`
 * for a reason unrelated to what this file tests.
 *
 * ⚠⚠ RULING L26 (record `6d5eeda5`) — CORRECTING THIS FILE'S OWN EARLIER CLAIM,
 * NOT SOFTENING IT: an earlier revision of this comment asserted
 * "`enable_confirmations = false` in `supabase/config.toml`... GoTrue does not
 * block a password login on `email_confirmed_at IS NULL`... Confirmed live by
 * prior authz measurement." That was WRONG, and was never actually measured
 * against a real GoTrue password grant. Measured THIS round, directly:
 *   `curl -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password
 *     -d '{"email":"gap.pending@test.local","password":"Test1234!"}'`
 *   → `{"code":400,"error_code":"email_not_confirmed","msg":"Email not confirmed"}`
 * `enable_confirmations = false` governs whether a NEW SIGNUP is required to
 * confirm before ITS FIRST login (i.e. signup auto-confirms) — it does not retroactively
 * permit sign-in for a row with `email_confirmed_at IS NULL`, a state only reachable
 * here via `gap.pending`'s direct seed insert (never producible through the real
 * signup flow with confirmations disabled). GoTrue rejects the grant outright;
 * `src/lib/auth/actions.ts`'s `signIn` (:156-160) then maps ANY 400-status error —
 * `email_not_confirmed` included, not only `invalid_credentials` — to the SAME
 * generic `"E-mail ou senha incorretos."` message, by design (account-enumeration /
 * state-disclosure guard), so the UI gives no sign this was a confirmation problem
 * rather than a wrong password. `gap.pending` therefore never reaches a session at
 * all — the test below asserts exactly that refusal, not a landing.
 *
 * No persona crosses orgs (CLAUDE.md §9) — all personas below are Rede A only.
 */

const DEAD_END = /Você ainda não tem acesso/i
const CCIH_URL = /\/o\/rede-a\/c\/ccih(\/|$)/
const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.'
// `src/lib/auth/actions.ts` MESSAGES.accountInactive (BE-6) — deliberately identical
// wording for `suspended` and `deactivated` so the UI does not leak which lifecycle
// state applies.
const ACCOUNT_INACTIVE_NOTICE = 'Sua conta está suspensa/desativada. Contate o administrador da sua organização.'
const AUTH_COOKIE = /^sb-.*-auth-token/

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local (Playwright loads it via @next/env).',
  )
}

/** A raw, UN-cached login attempt — deliberately NOT `loginFresh`/`cachedSignIn`,
 * both of which `waitForURL` away from `/login` and throw/timeout on the exact
 * outcome these refusal tests assert (staying on `/login`). */
async function attemptLogin(page: import('@playwright/test').Page, email: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/e-mail/i).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByLabel(/e-mail/i).fill(email)
  await page.locator('input[name="password"]').fill(DEFAULT_PASSWORD)
  await page.getByRole('button', { name: /entrar/i }).click()
}

/** Service-role REST PATCH — the same fixture-state mechanism `case-access.spec.ts`
 * (`ensureCasePatientPhi`) and others already use, never a UI shortcut and never
 * `seed.sql`. */
async function setActive(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  isActive: boolean,
): Promise<void> {
  const resp = await request.patch(
    `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      data: { is_active: isActive },
    },
  )
  expect(resp.ok(), `setActive(${email}, ${isActive}): ${resp.status()} ${await resp.text()}`).toBeTruthy()
}

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

  test('an unconfirmed staff account is refused at login (GoTrue email_not_confirmed → generic message), never granted a session', async ({
    page,
  }) => {
    await attemptLogin(page, 'gap.pending@test.local')

    await expect(page.getByText(INVALID_CREDENTIALS)).toBeVisible({ timeout: 10_000 })
    expect(new URL(page.url()).pathname).toBe('/login')

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => AUTH_COOKIE.test(c.name))).toBe(false)
  })

  test('a deactivated staff account is refused at login (BE-6), never granted a session', async ({
    page,
  }) => {
    await attemptLogin(page, 'gap.deactivated@test.local')

    await expect(page.getByText(ACCOUNT_INACTIVE_NOTICE)).toBeVisible({ timeout: 10_000 })
    expect(new URL(page.url()).pathname).toBe('/login')

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => AUTH_COOKIE.test(c.name))).toBe(false)
  })

  test('a staff deactivated MID-SESSION (already landed, then loses access) is routed to /conta-inativa on the next navigation', async ({
    page,
    request,
  }) => {
    const email = 'gap.comember.ccih@test.local'

    // Establish a REAL session while the account is still active — BE-6 (above)
    // means a fresh login as an already-deactivated principal can never reach
    // this coordinate at all; the transition has to happen AFTER sign-in.
    await cachedSignIn(page, email)

    await setActive(request, email, false)
    try {
      await page.goto('/')
      await expect(page).toHaveURL(/\/conta-inativa(\/|$)/)
      await expect(page.getByRole('heading', { name: 'Conta inativa' })).toBeVisible({
        timeout: 10_000,
      })
    } finally {
      // Restore unconditionally — this must land even if the assertions above
      // throw, so `e2e:prod`'s later batches see the seeded (active) row.
      await setActive(request, email, true)
    }
  })
})
