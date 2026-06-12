import { test, expect } from '@playwright/test'

// Updated Phase 0 smoke tests — the root `/` is now a server-side role-landing
// that requires auth (Phase 2). An unauthenticated visitor hitting `/` is
// redirected to `/login` by middleware. The smoke assertions have been moved to
// the public entry (`/login`) which is always reachable without a session.
//
// The Phase 2 persona-landing and keyboard-only flows live in
// `e2e/phase2-auth-shell.spec.ts`.

test.describe('Public entry smoke tests', () => {
  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/login renders the page heading', async ({ page }) => {
    await page.goto('/login')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
  })

  test('/login renders at least one interactive link', async ({ page }) => {
    await page.goto('/login')
    const links = page.getByRole('link')
    await expect(links.first()).toBeVisible()
  })

  // Keyboard-only smoke: Tab to first focusable element on /login.
  // The full keyboard sign-in flow lives in phase2-auth-shell.spec.ts.
  test('/login first focusable element is reachable by keyboard (Tab)', async ({ page }) => {
    await page.goto('/login')
    await page.keyboard.press('Tab')
    const focusedTag = await page.evaluate(() =>
      document.activeElement?.tagName.toLowerCase(),
    )
    expect(['a', 'button', 'input']).toContain(focusedTag)
  })
})
