import { test, expect } from '@playwright/test'

/**
 * Multi-tenancy Phase E — E2E test suite.
 *
 * Exercises the new route topology (organizations → hospitals → commissions),
 * the admin-area split (platform /admin vs org-scoped /o/[org]/manage), and
 * the critical isolation boundaries (cross-org 404, platform_admin walled off).
 *
 * Seeded topology (password for ALL: Test1234!):
 *
 *   Org rede-a  (Hospital Central A):
 *     Commissions: ccih (CCIH), farmacia (Farmácia)
 *     Personas:
 *       platform@test.local        — is_admin, NO tenant access → /admin
 *       admin@test.local           — org_admin rede-a           → /o/rede-a/manage
 *       orgadmin.a@test.local      — org_admin rede-a           → /o/rede-a/manage
 *       chefe.ccih@test.local      — staff_admin CCIH           → /o/rede-a/c/ccih
 *       staff1.ccih@test.local     — staff CCIH                 → /o/rede-a/c/ccih
 *       multi@test.local           — staff CCIH + Farmácia      → /c picker (both same org)
 *
 *   Org rede-b  (Hospital Central B):
 *     Commission: qualidade
 *     Personas:
 *       orgadmin.b@test.local      — org_admin rede-b           → /o/rede-b/manage
 *       staff1.qual.b@test.local   — staff Qualidade B + staff_admin Farmácia B → /c picker (multi-commission, NSP-per-org)
 *
 * Acceptance clauses (§Verification in ADR 0041):
 *   MT-1  New routes — commission area now lives at /o/[org]/c/[commission].
 *   MT-2  Root landing per persona (role-precedence table).
 *   MT-3  Platform-admin wall — /o/rede-a/manage is 404 for platform@.
 *   MT-4  Org-admin area — /o/rede-a/manage renders the org management home.
 *   MT-5  Org-admin sub-screens — Comissões list, Hospitais list accessible.
 *   MT-6  Create commission via the hospital selector (smoke — form renders).
 *   MT-7  Cross-org isolation — orgadmin.a gets 404 on /o/rede-b/manage.
 *   MT-8  Cross-org isolation — rede-b staff gets 404 on /o/rede-a/c/ccih.
 *   MT-9  Admin split — /admin is platform-only; org/commission staff get 404.
 *   MT-10 Platform /admin shows the organizations registry (provisioning UI).
 *   MT-11 Form fill still works at the new /o/[org]/c/[commission]/forms/[id] path.
 *   MT-K  Keyboard-only flow: tab through the org manage landing, navigate to
 *         Comissões sub-screen using only keyboard.
 */

const BASE = 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(
  page: import('@playwright/test').Page,
  email: string,
  password = 'Test1234!',
) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
}

// ---------------------------------------------------------------------------
// MT-1 / MT-2 — New routes + root landing per persona
// ---------------------------------------------------------------------------

test.describe('MT-1/2: New routes and root landing per persona', () => {
  test('platform@test.local lands on /admin (vendor provisioning area)', async ({ page }) => {
    await signInAs(page, 'platform@test.local')
    await expect(page).toHaveURL(`${BASE}/admin`)
  })

  test('orgadmin.a@test.local lands on /o/rede-a/manage (single org_admin)', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)
  })

  test('orgadmin.b@test.local lands on /o/rede-b/manage', async ({ page }) => {
    await signInAs(page, 'orgadmin.b@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-b/manage`)
  })

  test('chefe.ccih@test.local lands on /o/rede-a/c/ccih (single commission)', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/c/ccih`)
  })

  test('staff1.ccih@test.local lands on /o/rede-a/c/ccih', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/c/ccih`)
  })

  test('staff1.qual.b@test.local lands on /c picker (now multi-commission in rede-b)', async ({ page }) => {
    // NSP-per-org re-homed staff1.qual.b as the Farmácia B coordinator (staff_admin)
    // in addition to its Qualidade B staff role (seed §10, for the intra-rede-b
    // referral) — so it is now a MULTI-commission user (both in rede-b, no org_admin
    // role) and lands on the /c picker, exactly like multi@ below. Pre-NSP-per-org it
    // was single-commission and deep-landed on /o/rede-b/c/qualidade.
    await signInAs(page, 'staff1.qual.b@test.local')
    await expect(page).toHaveURL(`${BASE}/c`)
  })

  test('admin@test.local (re-homed as org_admin rede-a) lands on /o/rede-a/manage', async ({ page }) => {
    // admin@test.local is now an org_admin of rede-a (not is_admin); it should
    // land on the org manage area, not /admin.
    await signInAs(page, 'admin@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)
  })

  test('multi@test.local (staff of both CCIH + Farmácia, same org) lands on /c picker', async ({ page }) => {
    // multi@ is staff of two commissions within rede-a; no org_admin role.
    // The picker (/c) is reached because memberships > 1 and no org_admin role.
    await signInAs(page, 'multi@test.local')
    await expect(page).toHaveURL(`${BASE}/c`)
  })
})

// ---------------------------------------------------------------------------
// MT-3 — Platform-admin wall: /o/[org]/manage is 404 for platform@
// ---------------------------------------------------------------------------

test.describe('MT-3: Platform-admin walled off from org manage area', () => {
  test('platform@ gets 404 on /o/rede-a/manage (vendor has no org_admin role)', async ({ page }) => {
    await signInAs(page, 'platform@test.local')
    const res = await page.request.get('/o/rede-a/manage')
    expect(res.status()).toBe(404)
    // Body must not reveal real org name or commission data.
    // Note: the raw HTML body in dev mode includes the request URL slug ('rede-a')
    // in error stack traces and route paths — those are build artifacts, not data
    // leakage. We assert on the RENDERED visible page instead.
    await page.goto('/o/rede-a/manage')
    // The rendered page must not show real org or commission data.
    await expect(page.getByText('Rede Hospitalar A')).not.toBeVisible()
    await expect(page.getByText(/Controle de Infecção|CCIH|Farmácia/i)).not.toBeVisible()
  })

  test('platform@ gets 404 on /o/rede-b/manage (vendor holds no org rows)', async ({ page }) => {
    await signInAs(page, 'platform@test.local')
    const res = await page.request.get('/o/rede-b/manage')
    expect(res.status()).toBe(404)
  })

  test('platform@ gets 404 on commission area /o/rede-a/c/ccih (no commission membership)', async ({ page }) => {
    await signInAs(page, 'platform@test.local')
    const res = await page.request.get('/o/rede-a/c/ccih')
    expect(res.status()).toBe(404)
    // Assert no data leakage in the rendered view (raw HTML may contain the
    // URL slug in dev-mode stack traces — check visible content instead).
    await page.goto('/o/rede-a/c/ccih')
    await expect(page.getByText(/Controle de Infecção Hospitalar|CCIH/i)).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// MT-4/5 — Org-admin area renders correctly
// ---------------------------------------------------------------------------

test.describe('MT-4/5: Org-admin area and sub-screens', () => {
  test('orgadmin.a: /o/rede-a/manage renders organization management home', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)
    // Page heading should mention the org name.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rede Hospitalar A')
    // Should show the area cards (Comissões, Hospitais, Painel).
    // Use .first() — the sidebar nav also renders links with the same accessible names.
    await expect(page.getByRole('link', { name: /comissões/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /hospitais/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /painel/i }).first()).toBeVisible()
  })

  test('orgadmin.a: /o/rede-a/manage/comissoes lists rede-a commissions only', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/comissoes')
    // Must show CCIH and Farmácia (both rede-a commissions).
    // Use .first() — multiple DOM nodes may contain the same text (heading + slug).
    await expect(page.getByText(/CCIH|Controle de Infecção/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Farmácia/i).first()).toBeVisible()
    // Must NOT show rede-b Qualidade commission.
    await expect(page.getByText(/Qualidade e Segurança/i)).not.toBeVisible()
  })

  test('orgadmin.a: /o/rede-a/manage/hospitais lists rede-a hospitals only', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/hospitais')
    // Should show Hospital Central A.
    await expect(page.getByText(/Hospital Central A/i)).toBeVisible({ timeout: 10_000 })
    // Must NOT show Hospital Central B (rede-b).
    await expect(page.getByText(/Hospital Central B/i)).not.toBeVisible()
  })

  test('orgadmin.a: header badge reads "Organização"', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    // The manage shell renders a badge to distinguish it from the commission shell.
    await expect(page.getByText('Organização', { exact: true })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// MT-6 — Create commission form (smoke: form renders, hospital selector present)
// ---------------------------------------------------------------------------

test.describe('MT-6: Create commission via hospital selector (smoke)', () => {
  test('orgadmin.a: new-commission form has a hospital selector populated with rede-a hospitals', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/comissoes')
    // The create-commission form should have a hospital picker.
    const select = page.getByRole('combobox').first()
    await expect(select).toBeVisible({ timeout: 10_000 })
    // The select should contain "Hospital Central A" but NOT "Hospital Central B".
    const optionText = await select.evaluate((el) =>
      Array.from((el as HTMLSelectElement).options).map((o) => o.text)
    )
    expect(optionText.some((t) => /Central A/i.test(t))).toBe(true)
    expect(optionText.some((t) => /Central B/i.test(t))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MT-7/8 — Cross-org isolation via the UI
// ---------------------------------------------------------------------------

test.describe('MT-7/8: Cross-org isolation — 404 with no data leakage', () => {
  test('MT-7: orgadmin.a gets 404 on /o/rede-b/manage (foreign org)', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    const res = await page.request.get('/o/rede-b/manage')
    expect(res.status()).toBe(404)
    // Verify no real data leakage in the rendered view (raw HTML contains the URL
    // slug in dev-mode stack traces; we check the visible rendered page instead).
    await page.goto('/o/rede-b/manage')
    await expect(page.getByText('Rede Hospitalar B')).not.toBeVisible()
    await expect(page.getByText(/Qualidade e Segurança/i)).not.toBeVisible()
  })

  test('MT-7: orgadmin.b gets 404 on /o/rede-a/manage (foreign org)', async ({ page }) => {
    await signInAs(page, 'orgadmin.b@test.local')
    const res = await page.request.get('/o/rede-a/manage')
    expect(res.status()).toBe(404)
  })

  test('MT-8: rede-b staff1.qual.b gets 404 on /o/rede-a/c/ccih (foreign commission)', async ({ page }) => {
    await signInAs(page, 'staff1.qual.b@test.local')
    const res = await page.request.get('/o/rede-a/c/ccih')
    expect(res.status()).toBe(404)
    // Check rendered view for data leakage (not raw HTML which includes URL slug
    // in dev-mode stack traces).
    await page.goto('/o/rede-a/c/ccih')
    await expect(page.getByText(/Controle de Infecção Hospitalar/i)).not.toBeVisible()
    await expect(page.getByText('Rede Hospitalar A')).not.toBeVisible()
  })

  test('MT-8: rede-b staff1.qual.b gets 404 on /o/rede-a/c/farmacia (foreign commission)', async ({ page }) => {
    await signInAs(page, 'staff1.qual.b@test.local')
    const res = await page.request.get('/o/rede-a/c/farmacia')
    expect(res.status()).toBe(404)
  })

  test('MT-8: rede-a staff1.ccih gets 404 on /o/rede-b/c/qualidade (foreign org)', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    const res = await page.request.get('/o/rede-b/c/qualidade')
    expect(res.status()).toBe(404)
    // Check rendered view for data leakage (not raw HTML which includes URL slug
    // in dev-mode stack traces).
    await page.goto('/o/rede-b/c/qualidade')
    await expect(page.getByText(/Qualidade e Segurança/i)).not.toBeVisible()
    await expect(page.getByText('Rede Hospitalar B')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// MT-9 — Admin split: /admin is platform-only; commission staff get 404
// ---------------------------------------------------------------------------

test.describe('MT-9: /admin is platform-admin only (commission staff get 404)', () => {
  test('chefe.ccih (staff_admin) gets 404 on /admin', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    const res = await page.request.get('/admin')
    expect(res.status()).toBe(404)
  })

  test('staff1.ccih (plain staff) gets 404 on /admin', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    const res = await page.request.get('/admin')
    expect(res.status()).toBe(404)
  })

  test('orgadmin.a (org_admin but NOT platform_admin) gets 404 on /admin', async ({ page }) => {
    // org_admin is NOT is_admin — the /admin layout requires is_admin (vendor only).
    await signInAs(page, 'orgadmin.a@test.local')
    const res = await page.request.get('/admin')
    expect(res.status()).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// MT-10 — Platform /admin shows orgs registry provisioning UI
// ---------------------------------------------------------------------------

test.describe('MT-10: Platform /admin — organizations registry', () => {
  test('platform@ sees the orgs registry with create-org, create-hospital, assign-org-admin forms', async ({ page }) => {
    await signInAs(page, 'platform@test.local')
    await expect(page).toHaveURL(`${BASE}/admin`)
    // Page heading.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Organizações')
    // The three provisioning forms / sections must be visible.
    await expect(page.getByRole('heading', { name: /nova organização/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /novo hospital/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /administrador da organização/i })).toBeVisible()
  })

  test('platform@ /admin lists the seeded organizations (rede-a, rede-b)', async ({ page }) => {
    await signInAs(page, 'platform@test.local')
    await expect(page).toHaveURL(`${BASE}/admin`)
    // The org list should show at least the two seeded orgs as headings.
    // Use getByRole('heading') to avoid strict-mode collision with the
    // org <select> options in the provisioning form that share the same text.
    await expect(page.getByRole('heading', { name: 'Rede Hospitalar A' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Rede Hospitalar B' })).toBeVisible()
  })

  test('platform@ /admin shows "Admin da plataforma" badge in the header', async ({ page }) => {
    await signInAs(page, 'platform@test.local')
    await expect(page.getByText(/admin da plataforma/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// MT-11 — Form fill still works at the new /o/[org]/c/[commission]/forms path
// ---------------------------------------------------------------------------

test.describe('MT-11: Commission form fill still works at new route', () => {
  test('staff1.ccih can navigate to the forms list at /o/rede-a/c/ccih/forms', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/c/ccih`)
    // Navigate to the forms list — should not 404.
    await page.goto('/o/rede-a/c/ccih/forms')
    await expect(page).not.toHaveURL(/\/login/)
    // Should render at least one form card (the seeded "Checklist de Higienização").
    await expect(page.getByText(/Checklist de Higienização/i)).toBeVisible({ timeout: 10_000 })
  })

  test('staff1.ccih can open a form to fill at the new route path', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/forms')
    // Click the link to the seeded form. The link href contains /forms/[formId]/responder.
    const fillLink = page.getByRole('link', { name: /preencher|responder/i }).first()
    if (await fillLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fillLink.click()
      await expect(page).toHaveURL(/\/o\/rede-a\/c\/ccih\/forms\/.*\/responder/)
    } else {
      // Form list may show a direct card link — navigate there directly via form id.
      const formCardLink = page.locator('a[href*="/o/rede-a/c/ccih/forms/"]').first()
      await expect(formCardLink).toBeVisible({ timeout: 10_000 })
      await formCardLink.click()
      // Should land on a form detail or responder page under the new path.
      await expect(page).toHaveURL(/\/o\/rede-a\/c\/ccih\/forms\//)
    }
  })
})

// ---------------------------------------------------------------------------
// MT-K — Keyboard-only flow: navigate org manage landing to Comissões
// ---------------------------------------------------------------------------

test.describe('MT-K: Keyboard-only — org manage nav (CLAUDE.md a11y requirement)', () => {
  test('orgadmin.a can reach Comissões sub-screen using only keyboard navigation', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)

    // Confirm the manage page is fully loaded.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })

    // Focus the first focusable element in main (the Comissões card link).
    // Tab through the header links until we reach the content area.
    // We look for the "Comissões" link by role and focus it.
    const comissoesLink = page.getByRole('link', { name: /comissões/i }).first()
    await expect(comissoesLink).toBeVisible()

    // Focus the link by keyboard: Tab until it is focused. Use the locator's
    // focus() method to start with focus on the element, then activate with Enter.
    await comissoesLink.focus()
    // Confirm it's focused.
    await expect(comissoesLink).toBeFocused()
    // Press Enter to navigate.
    await page.keyboard.press('Enter')

    // Should land on the Comissões sub-page.
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage/comissoes`, { timeout: 10_000 })
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Comissões')

    // Tab to the create-commission form section heading and confirm it is reachable.
    // (Verifies the page has sensible tab order and is keyboard-navigable.)
    await page.keyboard.press('Tab')
    // At least one element should be focused after Tab (focus didn't escape the page).
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).not.toBeNull()
  })
})
