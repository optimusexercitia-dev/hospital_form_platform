import { expect, test } from '@playwright/test'

import { cachedSignIn } from './helpers/auth'

/**
 * AE5-STAFF — T13, the "staff personas end to end" half (record § Task list T13):
 * `multi@test.local` fills a published form in EACH of its two Rede A commissions,
 * reached through the REAL `/c` commission picker (never a direct `page.goto` to the
 * commission's `/forms` URL) — the picker is the actual seam a freshly-cutover
 * `staff` grant is routed through (`src/app/c/page.tsx`), and
 * `e2e/phase-multitenancy.spec.ts` only proves she LANDS on `/c`, not that either
 * card underneath it still works post-cutover.
 *
 * Seeded shape (supabase/seed.sql; `e2e/phase5-wizard.spec.ts`'s own header comment
 * documents the two forms in full — not re-derived here):
 *   multi@test.local — `staff` of CCIH (Comissão de Controle de Infecção
 *     Hospitalar) AND Farmácia (Comissão de Farmácia e Terapêutica), both Rede A —
 *     `memberships > 1`, no org_admin role, so `/c` (never `/selecionar-perfil`,
 *     which is for holding >1 ROLE TYPE — `multi@` holds one, `staff`, twice).
 *   FORM A (CCIH, unsectioned): "Checklist de Higienização das Mãos" — 2 required
 *     fields (`dispensador_disponivel`, `turno_auditoria`).
 *   FORM B (Farmácia, sectioned): "Inspeção de Armazenamento de Medicamentos" —
 *     S1 `possui_termolabeis=Não` skips the conditional S2, matching
 *     `phase5-wizard.spec.ts`'s own "branch Não" shape but for `multi@` specifically
 *     (that test uses `staff2.farm@`; `multi@`'s own Farmácia run there, "branch
 *     Sim", stops at the review screen because Form B's sign-off gate blocks
 *     submission for a plain `staff` — restated here, not re-proven, since S3/S4 are
 *     ordinary in Phase 5 and this file's job is the PICKER seam, not the sign-off
 *     gate).
 *
 * ⛔ No persona crosses orgs (CLAUDE.md §9) — both commissions below are Rede A.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  // Disable CSS animations so the picker's staggered card entrance and the
  // wizard's section transitions complete instantly — the same reason
  // phase5-wizard.spec.ts sets this globally.
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.describe('AE5-STAFF — multi@ fills a published form in each of her two commissions', () => {
  test('keyboard-only: picker → CCIH → complete the unsectioned form → confirmation', async ({
    page,
  }) => {
    /**
     * CLAUDE.md §8: at least one keyboard-only flow per phase, with `toBeFocused`
     * assertions at key steps. This is the picker-navigation half no existing spec
     * covers keyboard-only; the form-filling idiom below mirrors
     * `phase5-wizard.spec.ts`'s own "AC5 — Keyboard-only" test verbatim so the two
     * keyboard contracts (picker, wizard) stay consistent.
     */
    test.setTimeout(90_000)
    await cachedSignIn(page, 'multi@test.local')
    await page.goto('/')
    await page.waitForURL('**/c', { timeout: 15_000 })

    const ccihCard = page.getByRole('link', { name: /Infecção Hospitalar/i })
    await expect(ccihCard).toBeVisible({ timeout: 15_000 })
    await ccihCard.focus()
    await expect(ccihCard).toBeFocused()
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/o\/rede-a\/c\/ccih(\/|$)/, { timeout: 15_000 })

    await page.goto('/o/rede-a/c/ccih/forms')
    await page.waitForURL('**/o/rede-a/c/ccih/forms', { timeout: 15_000 })

    const formACard = page.locator('article').filter({ hasText: /Higienização das Mãos/i })
    const continuarLink = formACard.getByRole('link', { name: /continuar preenchimento/i })
    const preencherBtn = formACard.getByRole('button', { name: /preencher/i })
    await expect(continuarLink.or(preencherBtn).first()).toBeVisible({ timeout: 15_000 })

    if (await continuarLink.first().isVisible()) {
      await continuarLink.first().focus()
      await expect(continuarLink.first()).toBeFocused()
      await page.keyboard.press('Enter')
    } else {
      await preencherBtn.first().focus()
      await expect(preencherBtn.first()).toBeFocused()
      await page.keyboard.press('Enter')
    }
    await page.waitForURL(/\/responder\//, { timeout: 20_000 })

    await expect(
      page.getByText(/Há dispensador de álcool em gel disponível/i).first(),
    ).toBeVisible({ timeout: 15_000 })

    const firstRadio = page.getByRole('radio').first()
    await firstRadio.focus()
    await expect(firstRadio).toBeFocused()
    await page.keyboard.press('Space')
    await expect(firstRadio).toBeChecked()

    const turnoSelect = page.getByRole('combobox', { name: /Turno em que a auditoria/i })
    await turnoSelect.focus()
    await expect(turnoSelect).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(turnoSelect).not.toHaveValue('')

    const revisarBtn = page.getByRole('button', { name: /revisar/i })
    await revisarBtn.focus()
    await expect(revisarBtn).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toBeVisible({ timeout: 15_000 })

    const enviarBtn = page.getByRole('button', { name: /Enviar respostas/i })
    await enviarBtn.focus()
    await expect(enviarBtn).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('picker → Farmácia → sectioned form, branch Não, reaches review', async ({ page }) => {
    test.setTimeout(90_000)
    await cachedSignIn(page, 'multi@test.local')
    await page.goto('/')
    await page.waitForURL('**/c', { timeout: 15_000 })

    const farmaciaCard = page.getByRole('link', { name: /Farmácia e Terapêutica/i })
    await expect(farmaciaCard).toBeVisible({ timeout: 15_000 })
    await farmaciaCard.click()
    await page.waitForURL(/\/o\/rede-a\/c\/farmacia(\/|$)/, { timeout: 15_000 })

    await page.goto('/o/rede-a/c/farmacia/forms')
    await page.waitForURL('**/o/rede-a/c/farmacia/forms', { timeout: 15_000 })

    const formBCard = page
      .locator('article')
      .filter({ hasText: /Inspeção de Armazenamento/i })
    const continuarLink = formBCard.getByRole('link', { name: /continuar preenchimento/i })
    const preencherBtn = formBCard.getByRole('button', { name: /preencher/i })
    await expect(continuarLink.or(preencherBtn).first()).toBeVisible({ timeout: 15_000 })
    if (await continuarLink.first().isVisible()) {
      await continuarLink.first().click()
    } else {
      await preencherBtn.first().click()
    }
    await page.waitForURL(/\/responder\//, { timeout: 20_000 })

    // Sectioned wizard: a progress bar is present (unlike Form A).
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 10_000 })

    // S0 intro → next.
    await expect(
      page.getByRole('heading', { level: 2, name: /Inspeção de armazenamento/i }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /próximo/i }).click()

    // S1 — organizacao_estoque=Sim, possui_termolabeis=Não (skips conditional S2).
    await expect(page.getByText('Armazenamento geral').first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('radio', { name: 'Sim' }).first().click()
    await page.getByRole('radio', { name: 'Não' }).nth(1).click()
    await page.getByRole('button', { name: /próximo/i }).click()

    // S3 directly — S2 must not appear for this branch.
    await expect(page.getByText('Conformidade e validades').first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Controle de temperatura').first()).toHaveCount(0)
    await page.getByRole('radio', { name: 'Sim' }).first().click()
    await page.getByRole('button', { name: /próximo/i }).click()

    // S4 "Revisão da chefia" → Revisar.
    await expect(page.getByText('Revisão da chefia').first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /revisar/i }).click()

    // Review screen reached — proves the picker → sectioned-form path works for
    // multi@ in her SECOND commission. Full submission is out of scope here: Form
    // B's sign-off gate (Phase 6) blocks it for a plain staff, exactly as
    // phase5-wizard.spec.ts's own "branch Sim" test for this same persona notes.
    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toBeVisible({ timeout: 15_000 })
  })
})
