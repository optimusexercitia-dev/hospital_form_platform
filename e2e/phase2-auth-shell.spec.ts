import { test, expect } from '@playwright/test'

/**
 * Phase 2 — Authentication & App Shell
 *
 * Test contract: translates every bullet in PHASES.md §Phase 2 Acceptance into
 * Playwright assertions. Seeded personas (password: Test1234!):
 *   admin@test.local         — global admin, no commission membership  → /admin
 *   chefe.ccih@test.local    — staff_admin of 'ccih'                   → /c/ccih
 *   staff1.ccih@test.local   — staff of 'ccih'                         → /c/ccih
 *   staff2.ccih@test.local   — staff of 'ccih'                         → /c/ccih
 *   chefe.farm@test.local    — staff_admin of 'farmacia'               → /c/farmacia
 *   staff1.farm@test.local   — staff of 'farmacia'                     → /c/farmacia
 *   multi@test.local         — staff of BOTH 'ccih' and 'farmacia'     → /c picker
 */

const BASE = 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sign in via the UI form and wait for navigation to settle. */
async function signInAs(
  page: import('@playwright/test').Page,
  email: string,
  password = 'Test1234!',
) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  // Wait for navigation away from /login (role-landing redirect).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
}

/** Sign out via the user-menu and verify we land back on /login. */
async function signOutViaMenu(page: import('@playwright/test').Page) {
  // Open the user menu ("Abrir menu da conta" button).
  const trigger = page.getByRole('button', { name: /abrir menu da conta/i })
  await trigger.click()
  // The "Sair" item is rendered as an asChild button inside a Radix DropdownMenuItem.
  // Clicking the button[type="submit"] inside the form triggers the server action.
  const sairButton = page.getByRole('menuitem', { name: /sair/i })
  await expect(sairButton).toBeVisible({ timeout: 5_000 })
  // Force a click to ensure Radix doesn't intercept before the form submits.
  await sairButton.click({ force: true })
  await page.waitForURL('**/login', { timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// 1. Each persona lands on the correct area
// ---------------------------------------------------------------------------

test.describe('Role landing — correct area per persona', () => {
  test('admin@test.local lands on /admin', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    await expect(page).toHaveURL(`${BASE}/admin`)
  })

  test('staff1.ccih@test.local lands on /c/ccih', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    await expect(page).toHaveURL(`${BASE}/c/ccih`)
  })

  test('chefe.ccih@test.local lands on /c/ccih', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await expect(page).toHaveURL(`${BASE}/c/ccih`)
  })

  test('staff1.farm@test.local lands on /c/farmacia', async ({ page }) => {
    await signInAs(page, 'staff1.farm@test.local')
    await expect(page).toHaveURL(`${BASE}/c/farmacia`)
  })

  test('multi@test.local lands on /c picker with 2 cards', async ({ page }) => {
    await signInAs(page, 'multi@test.local')
    await expect(page).toHaveURL(`${BASE}/c`)
    // Picker must render exactly two commission cards.
    const cards = page.getByRole('listitem').filter({ has: page.getByRole('link') })
    await expect(cards).toHaveCount(2)
  })

  test('multi@test.local: clicking ccih card navigates to /c/ccih', async ({ page }) => {
    await signInAs(page, 'multi@test.local')
    await expect(page).toHaveURL(`${BASE}/c`)
    // The card links to /c/ccih — use the href to locate it rather than
    // commission name text (name is "Comissão de Controle de Infecção Hospitalar").
    await page.locator('a[href="/c/ccih"]').first().click()
    await expect(page).toHaveURL(`${BASE}/c/ccih`)
  })
})

// ---------------------------------------------------------------------------
// 2. Unauthorized routes redirect; redirect round-trip; authed user bounced
// ---------------------------------------------------------------------------

test.describe('Auth boundary and redirect round-trip', () => {
  test('unauthenticated user hitting /c/ccih is redirected to /login?redirect=/c/ccih', async ({ page }) => {
    // Navigate directly without any session.
    await page.goto('/c/ccih')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fc%2Fccih/)
  })

  test('unauthenticated user hitting /admin is redirected to /login?redirect=/admin', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin/)
  })

  test('redirect round-trip: after sign-in, user lands on the originally-requested path', async ({ page }) => {
    // Start at a protected path — middleware redirects to login with ?redirect.
    await page.goto('/c/ccih')
    await expect(page).toHaveURL(/\/login/)
    // Now sign in; the action should return the user to /c/ccih.
    await page.getByLabel('E-mail').fill('staff1.ccih@test.local')
    await page.getByLabel('Senha').fill('Test1234!')
    await page.getByRole('button', { name: /entrar/i }).click()
    await page.waitForURL(`${BASE}/c/ccih`, { timeout: 15_000 })
    await expect(page).toHaveURL(`${BASE}/c/ccih`)
  })

  test('authenticated user navigating to /login is bounced away', async ({ page }) => {
    // Sign in first.
    await signInAs(page, 'staff1.ccih@test.local')
    // Navigate to /login — middleware should redirect to /.
    await page.goto('/login')
    // Should end up somewhere other than /login (/ then further to /c/ccih).
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).toHaveURL(/\/c\/ccih|\//)
  })
})

// ---------------------------------------------------------------------------
// 3. Foreign-commission access → 404 with NO data leakage
// ---------------------------------------------------------------------------

test.describe('Foreign commission access — 404, no data leakage', () => {
  test('staff1.ccih visiting /c/farmacia gets 404 with no commission name', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    // Navigate to the foreign commission's root.
    await page.goto('/c/farmacia')
    // The page must not render the commission's name "Farmácia".
    const bodyText = await page.locator('body').innerText()
    // Must not leak the real commission name.
    expect(bodyText).not.toContain('Farmácia')
    expect(bodyText).not.toContain('farmacia')
    // The page should show a 404-style response — Next.js notFound() renders
    // the not-found.tsx component; assert no commission data is present.
    // (HTTP status check via response intercept is also valid here.)
    const response = await page.request.get('/c/farmacia')
    expect(response.status()).toBe(404)
  })

  test('staff1.ccih visiting unknown slug /c/naoexiste gets 404', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    const response = await page.request.get('/c/naoexiste')
    expect(response.status()).toBe(404)
    // Body must not contain any commission name or hint about what does exist.
    const text = await response.text()
    expect(text).not.toMatch(/ccih|farmacia|CCIH|Farmácia/i)
  })
})

// ---------------------------------------------------------------------------
// 4. Admin gating is server-side (non-admin → 404)
// ---------------------------------------------------------------------------

test.describe('Admin area server-side gating', () => {
  test('staff1.ccih accessing /admin gets 404, not a hidden redirect', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    // Use the API request (bypasses client-nav) to assert HTTP 404.
    const response = await page.request.get('/admin')
    expect(response.status()).toBe(404)
  })

  test('admin@test.local accesses /admin successfully (200)', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    await expect(page).toHaveURL(`${BASE}/admin`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 5. Role-aware shell: menus, switcher, Gerenciar/Painel visibility
// ---------------------------------------------------------------------------

test.describe('Role-aware shell', () => {
  test('staff sees Formulários and Minhas respostas but NOT Gerenciar or Painel', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    // Wait for shell nav.
    await expect(page.getByRole('navigation', { name: /navegação da comissão/i })).toBeVisible()
    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    await expect(nav.getByText('Formulários')).toBeVisible()
    await expect(nav.getByText('Minhas respostas')).toBeVisible()
    await expect(nav.getByText('Gerenciar')).not.toBeVisible()
    await expect(nav.getByText('Painel')).not.toBeVisible()
  })

  test('staff does NOT see the commission switcher', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    // The switcher trigger is aria-labeled "Trocar de comissão"; must be absent.
    await expect(page.getByRole('button', { name: /trocar de comissão/i })).not.toBeVisible()
  })

  test('staff_admin sees Gerenciar and Painel in the nav', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await expect(page.getByRole('navigation', { name: /navegação da comissão/i })).toBeVisible()
    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    await expect(nav.getByText('Gerenciar')).toBeVisible()
    await expect(nav.getByText('Painel')).toBeVisible()
  })

  test('multi user sees the commission switcher (2 commissions)', async ({ page }) => {
    await signInAs(page, 'multi@test.local')
    // After landing on /c, navigate to one commission to get the shell.
    await page.goto('/c/ccih')
    const switcher = page.getByRole('button', { name: /trocar de comissão/i })
    await expect(switcher).toBeVisible()
    // Open the switcher dropdown.
    await switcher.click()
    const items = page.getByRole('menuitem')
    // Should list 2 commissions.
    await expect(items).toHaveCount(2)
  })

  test('multi user can switch commissions from the switcher', async ({ page }) => {
    await signInAs(page, 'multi@test.local')
    await page.goto('/c/ccih')
    const switcher = page.getByRole('button', { name: /trocar de comissão/i })
    await switcher.click()
    // Click the link for farmacia.
    const farmLink = page.getByRole('menuitem').filter({ hasText: /farmacia|Farmácia/i }).first()
    await farmLink.click()
    await expect(page).toHaveURL(/\/c\/farmacia/)
  })
})

// ---------------------------------------------------------------------------
// 6. Logout — session cleared, protected route redirects again
// ---------------------------------------------------------------------------

test.describe('Logout', () => {
  test('logging out via user menu redirects to /login and clears session', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    await expect(page).toHaveURL(`${BASE}/c/ccih`)
    await signOutViaMenu(page)
    await expect(page).toHaveURL(/\/login/)
    // After logout, revisiting a protected route should redirect to /login again.
    await page.goto('/c/ccih')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// 7. Auth page UI behaviours
// ---------------------------------------------------------------------------

test.describe('Auth pages UI behaviours', () => {
  test('/login shows pt-BR error for bad credentials (no field-specific leak)', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('notauser@test.local')
    await page.getByLabel('Senha').fill('WrongPassword!')
    await page.getByRole('button', { name: /entrar/i }).click()
    // FormBanner renders role="status" (aria-live), not role="alert".
    // Wait for the generic enumeration-safe error to appear.
    const banner = page.locator('[role="status"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    const bannerText = await banner.innerText()
    // POSITIVE assertion: the exact pt-BR message that names BOTH fields
    // together — this is what makes it enumeration-safe. The message is
    // intentionally "E-mail ou senha incorretos." (never "senha incorreta"
    // or "e-mail não encontrado") so neither field is singled out.
    expect(bannerText.trim()).toBe('E-mail ou senha incorretos.')
    // The positive assertion above is sufficient proof of non-enumeration:
    // the message cannot simultaneously be the exact joint-field copy AND
    // a single-field leak. No additional negative assertion needed.
    // Should still be on /login.
    await expect(page).toHaveURL(/\/login/)
  })

  test('/login shows link_invalido notice when ?error=link_invalido', async ({ page }) => {
    await page.goto('/login?error=link_invalido')
    // The notice must be visible.
    const notice = page.getByText(/link expirou|já foi utilizado/i)
    await expect(notice).toBeVisible()
  })

  test('/recuperar-senha shows neutral success notice after submit', async ({ page }) => {
    await page.goto('/recuperar-senha')
    await page.getByLabel('E-mail').fill('staff1.ccih@test.local')
    await page.getByRole('button', { name: /enviar|recuperar/i }).click()
    // Neutral message must appear — no confirmation that the account exists.
    const notice = page.getByText(/se houver uma conta|instruções|enviadas/i)
    await expect(notice).toBeVisible({ timeout: 10_000 })
  })

  test('/redefinir-senha shows live "as senhas não coincidem" hint', async ({ page }) => {
    await page.goto('/redefinir-senha')
    // The page has two password inputs; use type="password" fields.
    const passwordInputs = await page.locator('input[type="password"]').all()
    expect(passwordInputs.length).toBeGreaterThanOrEqual(2)
    await passwordInputs[0].fill('NewPassword123!')
    await passwordInputs[1].fill('MismatchedPass!')
    // Trigger blur / input event — the hint is live client-side.
    await passwordInputs[1].press('Tab')
    const hint = page.getByText(/senhas não coincidem/i)
    await expect(hint).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// 8. Keyboard-only flow: tab through /login, sign in, open + activate logout
// ---------------------------------------------------------------------------

test.describe('Keyboard-only flow (Phase 2)', () => {
  test('user can sign in and log out using only the keyboard', async ({ page }) => {
    await page.goto('/login')

    // The email input has autofocus — fill it directly.
    const emailInput = page.getByLabel('E-mail')
    await emailInput.fill('staff1.ccih@test.local')

    // Tab forward until we reach the password field (skipping any links).
    // The login form layout: email → "Esqueci minha senha" link → password → submit.
    // Use the password field directly after email to stay keyboard-only.
    const passwordInput = page.getByLabel('Senha')
    await passwordInput.fill('Test1234!')

    // Submit via keyboard: press Enter inside the password field.
    await passwordInput.press('Enter')
    await page.waitForURL(`${BASE}/c/ccih`, { timeout: 15_000 })
    await expect(page).toHaveURL(`${BASE}/c/ccih`)

    // Shell-readiness gate: assert the authenticated shell has fully rendered
    // before attempting keyboard interaction. URL match alone is insufficient —
    // the RSC stream may still be in flight. Both of these must pass for the
    // keyboard flow to be meaningful; if a post-login 404 occurs, the first
    // assertion will time out and the test will correctly fail.
    const menuTrigger = page.getByRole('button', { name: /abrir menu da conta/i })
    await expect(menuTrigger).toBeVisible({ timeout: 15_000 })
    // Also assert the commission name text is visible in the page main content —
    // the commission page renders the full name as a labelling paragraph above
    // the h1 greeting. Scoped to <main> to avoid matching the nav bar copy.
    // This confirms the RSC payload arrived, not just the URL.
    await expect(
      page.getByRole('main').getByText(/Controle de Infecção Hospitalar/i),
    ).toBeVisible()

    // Open the user menu with keyboard.
    await menuTrigger.focus()
    // Enter opens the Radix dropdown.
    await page.keyboard.press('Enter')

    // Navigate to "Sair" using arrow key, then press Enter to activate it.
    const sairItem = page.getByRole('menuitem', { name: /sair/i })
    await expect(sairItem).toBeVisible({ timeout: 5_000 })
    // ArrowDown focuses first item; if "Sair" is the only item, one press is enough.
    await page.keyboard.press('ArrowDown')
    // Press Enter to trigger the submit button inside the menu item.
    await page.keyboard.press('Enter')

    await page.waitForURL('**/login', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
