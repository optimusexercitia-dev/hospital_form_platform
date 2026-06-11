import { test, expect } from '@playwright/test'

// Smoke test: home page loads and renders visible content.
// Covers Phase 0 acceptance: `npx playwright test` succeeds from a clean clone.
// The playwright.config.ts webServer block manages starting `npm run dev`
// automatically, so no manual server management is needed here.

test.describe('Home page', () => {
  test('loads at / and renders a heading', async ({ page }) => {
    await page.goto('/')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
  })

  test('renders at least one link', async ({ page }) => {
    await page.goto('/')
    const links = page.getByRole('link')
    await expect(links.first()).toBeVisible()
  })

  // Keyboard-only flow: Tab to the first link and confirm it is focusable.
  // Phase 0 acceptance requires at least one keyboard-only flow per phase.
  test('first link is reachable by keyboard (Tab)', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase())
    // After one Tab from body the focused element should be an interactive element
    expect(['a', 'button', 'input']).toContain(focusedTag)
  })
})
