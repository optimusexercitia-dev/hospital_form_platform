import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 5 — Wizard Filling, Conditional Sections & Resume
 *
 * Test contract: translates every bullet in PHASES.md §Phase 5 Acceptance into
 * Playwright assertions. Runs against the LOCAL Supabase stack (seeded personas).
 *
 * Seeded forms (from supabase/seed.sql):
 *   FORM A (ccih, unsectioned): "Checklist de Higienização das Mãos"
 *     Default section only. Items:
 *       dispensador_disponivel (multiple_choice, required, has explanation)
 *       turno_auditoria (dropdown, required)
 *       epis_observados (checkbox, optional, has explanation)
 *       observacoes_gerais (free_text, optional)
 *     Display: section_text (markdown h2 "Higienização das mãos") + image
 *     Seed: 6 submitted responses + 1 in_progress (staff1.ccih, dispensador=Sim)
 *
 *   FORM B (farmacia, sectioned): "Inspeção de Armazenamento de Medicamentos"
 *     Sections:
 *       S0 (default intro): section_text only
 *       S1 "Armazenamento geral": organizacao_estoque (MC req),
 *            possui_termolabeis = "A unidade armazena medicamentos termolábeis (refrigerados)?" (MC req)
 *       S2 "Controle de temperatura" [CONDITIONAL when possui_termolabeis='Sim']:
 *            temperatura_na_faixa (MC req), temperatura_registrada (free_text opt)
 *       S3 "Conformidade e validades" [requires_signoff=respondent]: sem_vencidos (MC req)
 *       S4 "Revisão da chefia" [requires_signoff=staff_admin]: parecer_chefia (free_text opt)
 *
 * Run with --workers=1 (tests mutate DB state in sequence).
 * Run `npx supabase db reset` before each full run.
 */

test.use({ viewport: { width: 1280, height: 900 } })

// Disable CSS animations globally so section transitions (animate-fade-in,
// 560 ms) complete instantly. Without this, clicking a radio immediately after
// section navigation can race the animation and the input may not be
// interactive in time for the stability check.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
// Local Supabase service-role key, read from .env.local (loaded by the Playwright
// config via @next/env) — never hardcoded. Bypasses RLS (AC6 DB-state assertions).
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

async function signOut(page: Page) {
  // Scroll to top so the header account button is in the viewport before opening
  // the dropdown (the dropdown positions relative to the button; if the page is
  // scrolled past the header the menuitem can end up outside the viewport).
  await page.evaluate(() => window.scrollTo(0, 0))
  const userMenu = page.getByRole('button', { name: /abrir menu da conta/i })
  await userMenu.click()
  const sairItem = page.getByRole('menuitem', { name: /sair/i })
  await expect(sairItem).toBeVisible({ timeout: 5_000 })
  await sairItem.click()
  await page.waitForURL('**/login', { timeout: 15_000 })
}

/**
 * Form B (farmacia) v1 version id, used to clear a user's leftover in_progress
 * draft so a Form B test always starts fresh at S0. This keeps the sectioned-
 * wizard tests order-independent now that the Phase-6 seed adds a Form B draft
 * for staff1.farm (e1) and these tests no longer submit (so drafts persist).
 */
const FORM_B_VERSION = '50000000-0000-0000-0000-00000000b001'

/**
 * Delete any in_progress Form B draft owned by `userId` (service-role, bypasses
 * RLS) so the next fill starts fresh. Pure test setup — removes a prior test's
 * leftover draft for the SAME user; never touches submitted data or the seeded
 * Phase-6 fixture (e1 is owned by staff1.farm, which these tests don't clear).
 */
async function clearFormBDraft(page: Page, userId: string) {
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/responses` +
      `?form_version_id=eq.${FORM_B_VERSION}` +
      `&created_by=eq.${userId}` +
      `&status=eq.in_progress`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
}

// Seeded user ids (supabase/seed.sql).
const USER_STAFF2_FARM = '00000000-0000-0000-0000-000000000007'
const USER_MULTI = '00000000-0000-0000-0000-000000000008'

/**
 * Navigate to a commission's forms list and click to enter the wizard.
 * Waits for the page to fully render, then clicks "Continuar preenchimento"
 * (if an in_progress exists) or "Preencher" (to start fresh).
 *
 * @param formTitle - Optional partial form title to scope the search to a
 *   specific form card. Use when the commission has multiple published forms
 *   (e.g., after Phase 4 builder tests added forms to ccih). When omitted,
 *   picks the first Continuar/Preencher found.
 */
async function enterWizard(page: Page, slug: string, formTitle?: RegExp | string) {
  await page.goto(`/c/${slug}/forms`)
  await page.waitForURL(`**/c/${slug}/forms`, { timeout: 15_000 })

  // Wait until at least one form card is visible (page fully rendered).
  const firstCard = page.locator('article').first()
  await expect(firstCard).toBeVisible({ timeout: 15_000 })

  // Scope to a specific form card when a title is provided to avoid
  // strict-mode violations when multiple published forms exist (e.g. after
  // Phase 4 builder tests created extra forms in the same commission).
  const cardScope = formTitle
    ? page.locator('article').filter({ hasText: formTitle })
    : page

  const continuarLink = cardScope.getByRole('link', { name: /continuar preenchimento/i })
  const preencherBtn = cardScope.getByRole('button', { name: /preencher/i })

  await expect(continuarLink.or(preencherBtn).first()).toBeVisible({ timeout: 15_000 })

  if (await continuarLink.first().isVisible()) {
    await continuarLink.first().click()
  } else {
    await preencherBtn.first().click()
  }
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// AC1 — Unsectioned form (flat render): render check + validation + happy path
// ---------------------------------------------------------------------------

test.describe('AC1 — Unsectioned form (flat render)', () => {
  // staff2.ccih@test.local has no in_progress at seed time.
  // Tests run in order and share state (test 2 leaves a draft; test 3 finishes it).

  test('flat form renders all 4 input types, section_text, question_explanation', async ({
    page,
  }) => {
    await signInAs(page, 'staff2.ccih@test.local')
    await enterWizard(page, 'ccih', /Higienização das Mãos/i)

    // Form title.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Checklist de Higienização das Mãos' }),
    ).toBeVisible({ timeout: 10_000 })

    // multiple_choice legend.
    await expect(
      page.getByText(/Há dispensador de álcool em gel disponível/i).first(),
    ).toBeVisible({ timeout: 10_000 })
    // dropdown.
    await expect(page.getByLabel(/Turno em que a auditoria/i)).toBeVisible()
    // checkbox legend.
    await expect(page.getByText(/Quais EPIs estavam disponíveis/i).first()).toBeVisible()
    // free_text.
    await expect(page.getByLabel(/Observações gerais/i)).toBeVisible()

    // section_text display block — rendered as h2 via Markdown.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Higienização das mãos' }),
    ).toBeVisible()

    // question_explanation for dispensador_disponivel.
    await expect(
      page.getByText(/Considere abastecido quando há volume/i),
    ).toBeVisible()
    // question_explanation for epis_observados.
    await expect(page.getByText(/Marque todos os itens observados/i)).toBeVisible()

    // Flat wizard nav footer: "Revisar" (isLastSection=true) + "Salvar e sair".
    await expect(page.getByRole('button', { name: /revisar/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /salvar e sair/i })).toBeVisible()

    // Flat form has NO section progress bar (no "Seção N de N" text).
    await expect(page.getByText(/Seção 1 de/i)).toHaveCount(0)
  })

  test('validation: required field blank blocks going to review; pt-BR error shown', async ({
    page,
  }) => {
    await signInAs(page, 'staff2.ccih@test.local')
    await enterWizard(page, 'ccih', /Higienização das Mãos/i)

    // Leave all required fields empty. Click "Revisar".
    await page.getByRole('button', { name: /revisar/i }).click()

    // pt-BR validation banner must appear.
    await expect(
      page.getByRole('alert').filter({ hasText: /Revise os campos destacados/i }),
    ).toBeVisible({ timeout: 10_000 })

    // Still on the fill step — NOT on the review screen.
    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toHaveCount(0)
  })

  test('happy path: complete flat form end-to-end → confirmation screen', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await signInAs(page, 'staff2.ccih@test.local')
    await enterWizard(page, 'ccih', /Higienização das Mãos/i)

    // Fill all required fields.
    await page.getByRole('radio', { name: 'Sim' }).first().click()
    await page.getByLabel(/Turno em que a auditoria/i).selectOption('Manhã')
    await page.getByRole('checkbox', { name: 'Luvas' }).check()
    await page.getByLabel(/Observações gerais/i).fill('Auditoria de rotina — teste E2E')

    // Go to review.
    await page.getByRole('button', { name: /revisar/i }).click()
    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toBeVisible({ timeout: 15_000 })

    // Review screen: semantic h2 "Respostas" for the flat form's default section.
    await expect(page.getByRole('heading', { name: /^Respostas$/i })).toBeVisible()
    // Answers visible.
    await expect(page.getByText('Sim').first()).toBeVisible()
    await expect(page.getByText('Manhã').first()).toBeVisible()

    // Submit → confirmation.
    await page.getByRole('button', { name: /Enviar respostas/i }).click()
    await expect(
      page.getByRole('heading', { name: /Resposta enviada/i }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('link', { name: /Voltar aos formulários/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Ver minhas respostas/i }),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2 — Both branches of the conditional section (two separate responses)
// ---------------------------------------------------------------------------

test.describe('AC2 — Sectioned form: both branches of the conditional section', () => {
  test('branch Sim: conditional section S2 is shown, answered, and appears in review', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    // multi@test.local is staff of farmacia (unlike staff1.farm, who owns the
    // seeded Phase-6 e1 draft). Clear any leftover draft so this starts FRESH at
    // S0 rather than resuming mid-wizard.
    await clearFormBDraft(page, USER_MULTI)
    await signInAs(page, 'multi@test.local')
    await enterWizard(page, 'farmacia')

    // Sectioned wizard shows a progress bar.
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 10_000 })

    // S0 (default intro) — section_text h2 visible. Advance.
    await expect(
      page.getByRole('heading', { level: 2, name: /Inspeção de armazenamento/i }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /próximo/i }).click()

    // S1 "Armazenamento geral".
    await expect(page.getByText('Armazenamento geral').first()).toBeVisible({ timeout: 10_000 })
    // organizacao_estoque = Sim.
    await page.getByRole('radio', { name: 'Sim' }).first().click()
    // possui_termolabeis = Sim (shows S2).
    await page.getByRole('radio', { name: 'Sim' }).nth(1).click()
    await page.getByRole('button', { name: /próximo/i }).click()

    // S2 "Controle de temperatura" is now visible (conditional shown).
    // Scope to the S2 region to avoid stale S1 radio matches during React reconciliation.
    const s2Region = page.getByRole('region', { name: /Controle de temperatura/i })
    await expect(s2Region).toBeVisible({ timeout: 10_000 })
    const s2SimRadio = s2Region.getByRole('radio', { name: 'Sim' }).first()
    await s2SimRadio.click()
    // Wait for React state to confirm the click was processed before navigating.
    await expect(s2SimRadio).toBeChecked({ timeout: 5_000 })
    await page.locator('textarea').fill('5 °C')
    await page.getByRole('button', { name: /próximo/i }).click()

    // S3 "Conformidade e validades" (requires_signoff=respondent → ordinary in Phase 5).
    const s3Region = page.getByRole('region', { name: /Conformidade e validades/i })
    await expect(s3Region).toBeVisible({ timeout: 15_000 })
    const s3SimRadio = s3Region.getByRole('radio', { name: 'Sim' }).first()
    await s3SimRadio.click()
    await expect(s3SimRadio).toBeChecked({ timeout: 5_000 })
    await page.getByRole('button', { name: /próximo/i }).click()

    // S4 "Revisão da chefia" (requires_signoff=staff_admin → ordinary in Phase 5).
    await expect(
      page.getByText('Revisão da chefia').first(),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /revisar/i }).click()

    // Review: S2 must appear (conditional branch was taken) — this is the
    // Phase-5 conditional-visibility contract this test owns.
    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: /Controle de temperatura/i }),
    ).toBeVisible()

    // Phase 6 note: Form B has sign-off sections, so submission is now gated
    // until they are signed — the submit button is disabled with a pt-BR reason.
    // The respondent-/staff_admin-signed submission lifecycle is covered by
    // e2e/phase6-signoffs.spec.ts; here we only assert the gate is in effect so
    // this Phase-5 test stays valid under Phase-6 enforcement.
    await expect(
      page.getByText(/Há seções pendentes de assinatura/i).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Enviar respostas/i }),
    ).toBeDisabled()
  })

  test('branch Não: conditional section S2 is hidden and absent from review (no answers for it)', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    // Clear any leftover draft so this starts FRESH at S0 (order-independent).
    await clearFormBDraft(page, USER_STAFF2_FARM)
    await signInAs(page, 'staff2.farm@test.local')
    await enterWizard(page, 'farmacia')

    // S0 intro → next.
    await page.getByRole('button', { name: /próximo/i }).click()

    // S1: organizacao_estoque=Sim, possui_termolabeis=Não → S2 stays hidden.
    await expect(page.getByText('Armazenamento geral').first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('radio', { name: 'Sim' }).first().click()
    await page.getByRole('radio', { name: 'Não' }).nth(1).click()
    await page.getByRole('button', { name: /próximo/i }).click()

    // Next step must be S3 — NOT S2.
    await expect(
      page.getByText('Conformidade e validades').first(),
    ).toBeVisible({ timeout: 15_000 })
    // S2 must not appear.
    await expect(page.getByText('Controle de temperatura').first()).toHaveCount(0)

    // S3.
    await page.getByRole('radio', { name: 'Sim' }).first().click()
    await page.getByRole('button', { name: /próximo/i }).click()

    // S4 "Revisão da chefia".
    await expect(
      page.getByText('Revisão da chefia').first(),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /revisar/i }).click()

    // Review: S2 must NOT be present (hidden branch → no answers for it) — the
    // Phase-5 conditional-visibility contract this test owns.
    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: /Controle de temperatura/i }),
    ).toHaveCount(0)

    // Phase 6 note: Form B submission is now gated behind its sign-off sections
    // (the submit button is disabled with a pt-BR reason). The signed submission
    // lifecycle is covered by e2e/phase6-signoffs.spec.ts.
    await expect(
      page.getByText(/Há seções pendentes de assinatura/i).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Enviar respostas/i }),
    ).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AC3 — Resume: save-and-exit → re-sign-in → land at last section + answers
// ---------------------------------------------------------------------------

test('AC3 — Resume: save-and-exit, re-sign-in, land at last section with answers intact', async ({
  page,
}) => {
  test.setTimeout(120_000)
  /**
   * staff1.ccih has a seeded in_progress on Form A (dispensador_disponivel=Sim).
   * 1. Open the wizard → seeded answer pre-selected.
   * 2. Fill turno_auditoria="Tarde" → "Salvar e sair".
   * 3. Land back on forms list. Sign out.
   * 4. Sign back in → "Continuar preenchimento" shown → click.
   * 5. Both answers (Sim + Tarde) pre-populated.
   */
  await signInAs(page, 'staff1.ccih@test.local')

  // Step 1.
  await enterWizard(page, 'ccih', /Higienização das Mãos/i)
  // Seeded answer must be pre-selected (dispensador_disponivel=Sim).
  await expect(page.getByRole('radio', { name: 'Sim' }).first()).toBeChecked({ timeout: 10_000 })

  // Step 2.
  await page.getByLabel(/Turno em que a auditoria/i).selectOption('Tarde')
  await page.getByRole('button', { name: /salvar e sair/i }).click()
  await page.waitForURL('**/c/ccih/forms', { timeout: 20_000 })

  // Step 3.
  await signOut(page)

  // Step 4.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/c/ccih/forms')
  await page.waitForURL('**/c/ccih/forms', { timeout: 15_000 })
  // Scope to the seeded form card (other phase-13 AC-1d disposable form may also
  // have a "Continuar preenchimento" link for staff1.ccih — scope to our form card
  // to avoid a strict-mode violation from multiple matching links).
  const formCard = page.locator('article').filter({
    has: page.getByRole('heading', { name: /Higienização das Mãos/i }),
  })
  const continuar = formCard.getByRole('link', { name: /continuar preenchimento/i })
  await expect(continuar).toBeVisible({ timeout: 15_000 })
  await continuar.click()
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })

  // Step 5: both saved answers restored.
  await expect(page.getByRole('radio', { name: 'Sim' }).first()).toBeChecked({ timeout: 10_000 })
  await expect(page.getByLabel(/Turno em que a auditoria/i)).toHaveValue('Tarde')
})

// ---------------------------------------------------------------------------
// AC4 — Controlling-answer change mid-wizard: step list + warn dialog + clear
// ---------------------------------------------------------------------------

test('AC4 — Controlling-answer change: warns dialog appears and orphaned answers cleared', async ({
  page,
}) => {
  test.setTimeout(150_000)
  /**
   * multi@test.local is staff of farmacia. Flow:
   *  1. S0 → S1: fill possui_termolabeis=Sim → S2 appears (valuemax=6).
   *  2. S2: fill temperatura_na_faixa=Sim → advance to S3.
   *  3. Go back to S1 (S3→back→S2→back→S1).
   *  4. Change possui_termolabeis to Não → orphan warning dialog appears.
   *  5. Confirm "Alterar e remover" → dialog closes.
   *  6. Progress bar aria-valuemax drops to 5 (4 visible + review).
   *  7. Review: S2 "Controle de temperatura" absent.
   */
  // Clear any leftover draft (e.g. from AC2 Sim, which also uses multi) so this
  // starts FRESH at S0 — order-independent.
  await clearFormBDraft(page, USER_MULTI)
  await signInAs(page, 'multi@test.local')
  await enterWizard(page, 'farmacia')

  // S0 intro → next.
  await page.getByRole('button', { name: /próximo/i }).click()

  // S1.
  await expect(page.getByText('Armazenamento geral').first()).toBeVisible({ timeout: 10_000 })
  await page.getByRole('radio', { name: 'Sim' }).first().click()  // organizacao_estoque=Sim
  await page.getByRole('radio', { name: 'Sim' }).nth(1).click()   // possui_termolabeis=Sim

  // With Sim: 5 visible sections + 1 review step = 6 total.
  const progressBar = page.getByRole('progressbar')
  await expect(progressBar).toHaveAttribute('aria-valuemax', '6')

  await page.getByRole('button', { name: /próximo/i }).click()

  // S2 "Controle de temperatura" — fill temperatura_na_faixa.
  // Scope to S2 region to survive React reconciliation (same component position as S1).
  const s2Region = page.getByRole('region', { name: /Controle de temperatura/i })
  await expect(s2Region).toBeVisible({ timeout: 10_000 })
  const s2SimRadio = s2Region.getByRole('radio', { name: 'Sim' }).first()
  await s2SimRadio.click()
  // Wait for React state to confirm the radio click was processed.
  await expect(s2SimRadio).toBeChecked({ timeout: 5_000 })
  // Persist S2 by navigating to S3.
  await page.getByRole('button', { name: /próximo/i }).click()

  // S3 "Conformidade e validades" — go back to S1.
  const s3Region = page.getByRole('region', { name: /Conformidade e validades/i })
  await expect(s3Region).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /voltar/i }).click()   // S3→S2

  await expect(
    page.getByText('Controle de temperatura').first(),
  ).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /voltar/i }).click()   // S2→S1

  // Back on S1 — the possui_termolabeis question.
  await expect(
    page.getByText(/A unidade armazena medicamentos termolábeis/i).first(),
  ).toBeVisible({ timeout: 10_000 })

  // Change possui_termolabeis to Não → S2 has an answer → orphan warning.
  await page.getByRole('radio', { name: 'Não' }).nth(1).click()

  // Orphan warning AlertDialog must appear.
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await expect(
    dialog.getByText(/Esta mudança ocultará uma seção/i),
  ).toBeVisible()
  // The section name "Controle de temperatura" is named in the dialog.
  await expect(dialog.getByText(/Controle de temperatura/i)).toBeVisible()

  // Confirm "Alterar e remover".
  await dialog.getByRole('button', { name: /Alterar e remover/i }).click()
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // Step count drops: 4 visible (S0, S1, S3, S4) + 1 review = 5.
  await expect(progressBar).toHaveAttribute('aria-valuemax', '5', { timeout: 10_000 })

  // Proceed to review — S2 skipped.
  await page.getByRole('button', { name: /próximo/i }).click()
  const s3AfterOrphan = page.getByRole('region', { name: /Conformidade e validades/i })
  await expect(s3AfterOrphan).toBeVisible({ timeout: 10_000 })
  const s3AfterSimRadio = s3AfterOrphan.getByRole('radio', { name: 'Sim' }).first()
  await s3AfterSimRadio.click()
  await expect(s3AfterSimRadio).toBeChecked({ timeout: 5_000 })
  await page.getByRole('button', { name: /próximo/i }).click()
  await expect(
    page.getByText('Revisão da chefia').first(),
  ).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /revisar/i }).click()

  // Review: "Controle de temperatura" NOT present.
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByRole('heading', { name: /Controle de temperatura/i }),
  ).toHaveCount(0)

  // The orphaned answer (temperatura_na_faixa) is not shown in review content.
  await expect(
    page.getByText(/temperatura da câmara/i),
  ).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// AC5 — Keyboard-only wizard pass (CLAUDE.md §8 mandatory per phase)
// ---------------------------------------------------------------------------

test('AC5 — Keyboard-only: navigate and complete unsectioned form without mouse', async ({
  page,
}) => {
  /**
   * CLAUDE.md §8: every phase must include at least one keyboard-only flow
   * with `toBeFocused` assertions at key steps.
   *
   * After AC3, staff1.ccih submitted their draft. They now have no in_progress
   * on the v1 Form A (unless the AC3 flow left a new one). We use staff1 since
   * the keyboard flow must demonstrate the full wizard.
   *
   * If staff1 has an in_progress, we use "Continuar preenchimento". If not,
   * they start fresh. Either way the keyboard flow demonstrates:
   *  1. Focus the "Continuar" link / "Preencher" button → Enter to navigate.
   *  2. Focus the first radio → Space to select → assert checked.
   *  3. Focus the dropdown → ArrowDown → assert value.
   *  4. Focus "Revisar" button → Enter → review screen.
   *  5. Focus "Enviar respostas" → Enter → confirmation.
   */
  test.setTimeout(120_000)

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/c/ccih/forms')
  await page.waitForURL('**/c/ccih/forms', { timeout: 15_000 })

  // Wait for form card to render.
  await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 })

  // Scope to the seeded Form A card to avoid strict-mode violations when
  // Phase 4 tests have left additional published forms in the ccih commission.
  const formACard = page.locator('article').filter({ hasText: /Higienização das Mãos/i })
  const continuarLink = formACard.getByRole('link', { name: /continuar preenchimento/i })
  const preencherBtn = formACard.getByRole('button', { name: /preencher/i })

  // Focus whichever is shown and activate by Enter.
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

  // Wait for inputs to render.
  await expect(
    page.getByText(/Há dispensador de álcool em gel disponível/i).first(),
  ).toBeVisible({ timeout: 15_000 })

  // Focus the first radio (dispensador_disponivel group), select with Space.
  const firstRadio = page.getByRole('radio').first()
  await firstRadio.focus()
  await expect(firstRadio).toBeFocused()
  await page.keyboard.press('Space')
  await expect(firstRadio).toBeChecked()

  // Focus the dropdown, change with ArrowDown.
  const turnoSelect = page.getByLabel(/Turno em que a auditoria/i)
  await turnoSelect.focus()
  await expect(turnoSelect).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(turnoSelect).not.toHaveValue('')

  // Focus "Revisar" button and activate by Enter.
  const revisarBtn = page.getByRole('button', { name: /revisar/i })
  await revisarBtn.focus()
  await expect(revisarBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // Review screen must appear.
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })

  // Focus "Enviar respostas" and submit via Enter.
  const enviarBtn = page.getByRole('button', { name: /Enviar respostas/i })
  await enviarBtn.focus()
  await expect(enviarBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // Confirmation screen.
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toBeVisible({ timeout: 20_000 })
})

// ---------------------------------------------------------------------------
// AC6 — Server-rejection path: submit_response returns P0011 → pt-BR message
// ---------------------------------------------------------------------------

test('AC6 — Server-rejection: submit_response rejects missing required answer with pt-BR P0011 message', async ({
  page,
}) => {
  /**
   * Proves the server `submit_response` RPC is the authority (not just
   * client-side validation). Path:
   *  1. staff2.ccih fills all required answers, reaches the review screen
   *     (this persists the answers via saveSection in handleNext/handleReview).
   *  2. After reaching review, DELETE the required answer row via the service-role
   *     REST API (simulates a "second tab" blanking the answer after save).
   *  3. Click "Enviar respostas" → server rejects P0011 → pt-BR message visible.
   *
   * Expected message (B3 P0011 mapping):
   *   "Há perguntas obrigatórias sem resposta. Revise o formulário."
   */
  test.setTimeout(120_000)

  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page, 'ccih', /Higienização das Mãos/i)

  // Capture the responseId from the URL.
  const wizardUrl = page.url()
  const match = wizardUrl.match(/\/responder\/([0-9a-f-]{36})/)
  expect(match).toBeTruthy()
  const responseId = match![1]

  // Fill all required fields.
  await page.getByRole('radio', { name: 'Sim' }).first().click()
  await page.getByLabel(/Turno em que a auditoria/i).selectOption('Tarde')

  // "Revisar" persists the section (handleNext validates + saveSection + goToReview).
  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })

  // DELETE the required answer via service-role API (bypasses RLS).
  const deleteResp = await page.request.delete(
    `${SUPABASE_URL}/rest/v1/answers?response_id=eq.${responseId}&question_key=eq.dispensador_disponivel`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
  // 204 = row deleted.
  expect(deleteResp.status()).toBe(204)

  // Submit — server must reject with P0011.
  await page.getByRole('button', { name: /Enviar respostas/i }).click()

  // HC011 (renamed from P0011 — P7-002 resolved) maps to:
  // "Há perguntas obrigatórias sem resposta. Revise o formulário."
  // PostgREST now returns structured JSON for HC-class codes, so the Supabase
  // client extracts the message and shows it in the error banner.
  await expect(
    page.getByRole('alert').filter({ hasText: /Há perguntas obrigatórias sem resposta/i }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(
    page.getByRole('alert').filter({ hasText: /Revise o formulário/i }),
  ).toBeVisible()

  // Still on the review screen — no confirmation heading.
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// AC7 — Version-faithfulness: v1 response survives v2 being published
// ---------------------------------------------------------------------------

test('AC7 — Version-faithfulness: v1 in_progress resumes v1 after v2 published; submitted v1 in history', async ({
  page,
}) => {
  /**
   * Phase 5 scope for AC7 (submitted detail viewer = Phase 7):
   *  A. Before v2: staff1.ccih has an in_progress on Form A v1 (or creates one).
   *     We capture the wizard URL.
   *  B. chefe.ccih clones v1 and publishes v2 (no content change needed).
   *  C. staff1 navigates directly to the captured v1 wizard URL → must still render
   *     v1's questions and pre-populated answers (not 404, not v2).
   *  D. "minhas respostas" still shows the seeded v1 submitted responses.
   *
   * NOTE: After AC3+AC5, staff1 submitted their Form A in_progress.
   * If staff1 has no remaining in_progress, we start a new one on the current
   * published version (still v1 at this point), then publish v2 as chefe.
   */
  test.setTimeout(180_000)

  // ── A: ensure staff1 has an in_progress (start one if needed) ─────────────
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/c/ccih/forms')
  await page.waitForURL('**/c/ccih/forms', { timeout: 15_000 })
  await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 })

  // Scope to Form A card to avoid strict-mode violations with multiple forms.
  const formACardAC7 = page.locator('article').filter({ hasText: /Higienização das Mãos/i })
  const continuarLink = formACardAC7.getByRole('link', { name: /continuar preenchimento/i })
  const preencherBtn = formACardAC7.getByRole('button', { name: /preencher/i })

  let v1WizardHref: string | null = null

  if (await continuarLink.isVisible()) {
    v1WizardHref = await continuarLink.getAttribute('href')
  } else {
    // Start a new in_progress on the current published version (v1).
    await preencherBtn.click()
    await page.waitForURL(/\/responder\//, { timeout: 20_000 })
    v1WizardHref = new URL(page.url()).pathname
    // Fill a required field so there's something to verify after v2 is published.
    await page.getByRole('radio', { name: 'Sim' }).first().click()
    // Save progress explicitly via "Salvar e sair".
    await page.getByRole('button', { name: /salvar e sair/i }).click()
    await page.waitForURL('**/c/ccih/forms', { timeout: 20_000 })
  }
  expect(v1WizardHref).toBeTruthy()

  await signOut(page)

  // ── B: chefe.ccih publishes v2 ──────────────────────────────────────────
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/manage/forms')
  await page.waitForURL('**/c/ccih/manage/forms', { timeout: 15_000 })

  // Open Form A's builder.
  await page.getByText('Checklist de Higienização das Mãos').first().click()
  await page.waitForURL(/\/manage\/forms\/[0-9a-f-]+$/, { timeout: 20_000 })

  // Clone published v1 → new draft.
  await page.getByRole('button', { name: /Editar publicado/i }).click()
  await expect(
    page.getByRole('button', { name: 'Adicionar seção' }),
  ).toBeVisible({ timeout: 20_000 })

  // Publish the clone immediately (no content change — tests version assignment).
  await page.getByRole('button', { name: 'Publicar' }).click()
  const publishDialog = page.getByRole('alertdialog')
  await publishDialog.getByRole('button', { name: 'Publicar' }).click()
  await expect(
    page.getByRole('button', { name: /Editar publicado/i }),
  ).toBeVisible({ timeout: 20_000 })

  await signOut(page)

  // ── C: staff1 resumes the v1 in_progress ──────────────────────────────────
  await signInAs(page, 'staff1.ccih@test.local')

  // Navigate directly to the captured v1 wizard URL (different from the v2 route).
  await page.goto(v1WizardHref!)
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })

  // The wizard must render (not 404) — v1 response is still accessible.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Checklist de Higienização das Mãos' }),
  ).toBeVisible({ timeout: 10_000 })

  // v1 question labels must be visible (seed labels, not v2 which is identical here).
  await expect(
    page.getByText(/Há dispensador de álcool em gel disponível/i).first(),
  ).toBeVisible()

  // The saved answer (dispensador_disponivel = Sim) must be pre-selected.
  await expect(
    page.getByRole('radio', { name: 'Sim' }).first(),
  ).toBeChecked({ timeout: 10_000 })

  // ── D: submitted v1 responses still in "minhas respostas" ─────────────────
  await page.goto('/c/ccih/respostas')
  await page.waitForURL('**/c/ccih/respostas', { timeout: 15_000 })

  // staff1 has ≥3 submitted responses on Form A from the seed.
  await expect(
    page.getByText('Checklist de Higienização das Mãos').first(),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/enviada/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// Security — foreign response is 404 with no data leakage
// ---------------------------------------------------------------------------

test('Security: foreign in_progress response URL is 404 with no form data leakage', async ({
  page,
}) => {
  /**
   * staff2.ccih cannot access staff1.ccih's in_progress wizard URL.
   * RLS restricts in_progress to creator → 404, no form data visible.
   */
  // Sign in as staff1 to get their in_progress wizard URL.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/c/ccih/forms')
  await page.waitForURL('**/c/ccih/forms', { timeout: 15_000 })
  await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 })

  const continuarLink = page.getByRole('link', { name: /continuar preenchimento/i })
  let staff1WizardUrl: string

  if (await continuarLink.isVisible()) {
    staff1WizardUrl = (await continuarLink.getAttribute('href'))!
  } else {
    // staff1 has no in_progress; use a fake UUID to test the 404 boundary.
    staff1WizardUrl =
      '/c/ccih/forms/f0000000-0000-0000-0000-00000000a001/responder/00000000-0000-0000-0000-000000000099'
  }
  expect(staff1WizardUrl).toBeTruthy()

  await signOut(page)

  // Sign in as staff2 and navigate to the captured URL.
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(staff1WizardUrl)

  // The commission's not-found boundary must render — no form data visible.
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByText(/dispensador de álcool/i),
  ).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// "Minhas respostas" history: submitted + in_progress with correct actions
// ---------------------------------------------------------------------------

test('"Minhas respostas" shows submitted rows with "Ver" and in_progress rows with "Continuar"', async ({
  page,
}) => {
  /**
   * staff1.ccih has ≥3 seeded submitted responses on Form A.
   * The history page must list them with "enviada" status and "Ver" links.
   */
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/c/ccih/respostas')
  await page.waitForURL('**/c/ccih/respostas', { timeout: 15_000 })

  await expect(
    page.getByRole('heading', { name: /Minhas respostas/i }),
  ).toBeVisible()

  // At least one submitted response from the seed.
  await expect(
    page.getByText('Checklist de Higienização das Mãos').first(),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/enviada/i).first()).toBeVisible()

  // Submitted rows have "Ver" link.
  await expect(page.getByRole('link', { name: /ver/i }).first()).toBeVisible()
})
