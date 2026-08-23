import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * AFF2 T4 — keyboard-only: the directory's pills → search → row → profile path.
 *
 * Not covered anywhere else in e2e/ (grepped for "status-pills"/"Filtrar por
 * situação"/keyboard-directory hits — none). `frontend`'s F4 sweep measured this Tab
 * order at build time (Todos → Ativos → Atenção → Desativados → search → Buscar →
 * hospital switcher, 7 controls, no trap, 7/7 paint a focus ring) but that was a
 * throwaway verification script, not a persisted spec — this is its first Playwright
 * coverage.
 *
 * The full wizard's keyboard-only walk is ALREADY covered and passing:
 * `user-registration.spec.ts` AC7 (repaired under T0 for the 3-step wizard) and
 * `aff-hospital-affiliation.spec.ts` AFF-K (the identifier-first lookup, unaffected by
 * AFF2). Not duplicated here.
 *
 * ⚠ `hospitaladmin.a1` administers ONE hospital, so the "Trocar de hospital" switcher
 * is deliberately absent for them (ADR 0051 D7/D19 — a sole-hospital admin's scope is
 * implicit) — this keeps the tab sequence short and deterministic: pills → search →
 * Buscar → first row, with nothing to skip. The switcher itself is a Radix
 * `DropdownMenu`, not a native `<select>` — the macOS ArrowDown landmine this file's
 * own name warns about applies to native selects elsewhere (the wizard's
 * Categoria/Papel/Comissão pickers, already driven via `selectOption` in the T0/T3
 * specs), not to this component.
 *
 * Starting focus is placed directly on the first pill (`.focus()`, retried — the
 * established pattern for the first interaction after a fresh navigation) rather than
 * tabbing from `<body>`: the sidebar's ~9 nav links precede the main content in DOM
 * order, and asserting through them would make this spec fragile to an unrelated
 * sidebar change. What is under test is the DIRECTORY's own tab sequence, not the
 * whole page's.
 */

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

test('hospitaladmin.a1 tabs through the pills, searches, and opens a row into the profile — keyboard only', async ({
  page,
}) => {
  await signInAs(page, 'hospitaladmin.a1@test.local')
  await page.goto('/o/rede-a/manage/usuarios')
  await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
    timeout: 10_000,
  })

  const todos = page.getByRole('link', { name: /^Todos\b/ })
  await expect(async () => {
    await todos.focus()
    await expect(todos).toBeFocused({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })

  // Pills: Todos → Ativos → Atenção → Desativados, each a real focus stop, none
  // skipped (a `tabindex="-1"` decoy would fail the NEXT toBeFocused, not this one).
  await page.keyboard.press('Tab')
  const ativos = page.getByRole('link', { name: /^Ativos\b/ })
  await expect(ativos).toBeFocused()

  await page.keyboard.press('Tab')
  const atencao = page.getByRole('link', { name: /^Atenção\b/ })
  await expect(atencao).toBeFocused()

  await page.keyboard.press('Tab')
  const desativados = page.getByRole('link', { name: /^Desativados\b/ })
  await expect(desativados).toBeFocused()

  // Search: the sr-only-labeled input, then its "Buscar" submit button.
  await page.keyboard.press('Tab')
  const searchInput = page.getByLabel('Buscar por nome ou e-mail')
  await expect(searchInput).toBeFocused()
  await page.keyboard.type('chefe.ccih')

  await page.keyboard.press('Tab')
  const buscarButton = page.getByRole('button', { name: /^buscar$/i })
  await expect(buscarButton).toBeFocused()
  await page.keyboard.press('Enter')

  await page.waitForURL(/search=chefe\.ccih/, { timeout: 10_000 })
  await expect(page.getByText(/Chefe CCIH/i).first()).toBeVisible({ timeout: 10_000 })

  // The row is a single link (the whole `<li>` IS the link) — Tab from the search
  // button reaches it directly, with no intervening stop (no switcher for a
  // sole-hospital admin, and the pager is absent on a one-page result).
  await page.keyboard.press('Tab')
  const row = page.getByRole('link', { name: /Chefe CCIH/i })
  await expect(row).toBeFocused()
  await page.keyboard.press('Enter')

  await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 10_000 })
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Chefe CCIH/i)
})
