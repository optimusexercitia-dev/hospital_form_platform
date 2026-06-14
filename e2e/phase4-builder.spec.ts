import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * Phase 4 — Form Builder & Versioning · acceptance gap coverage.
 *
 * Complements `phase4-builder-smoke.spec.ts` (the broad happy path: blocks,
 * image upload, condition + sign-off, publish, clone, republish-archive) with
 * the PHASES.md §Phase 4 acceptance clauses it doesn't exercise:
 *   - (a) an unsectioned form using EVERY input type (≥1 with explanation) plus
 *         a text block and an image, then publish.
 *   - (b) a 3-SECTION form with one CONDITIONAL section and one SIGN-OFF section
 *         — publish succeeds and the page flips to the published read-only view.
 *   - (c) an INVALID condition (forward reference, reached via reorder) →
 *         publish blocked with a clear pt-BR error (publish-time validation is
 *         the authority, not the editor's offered targets).
 *   - access control: a staff member cannot reach the builder.
 *   - keyboard-only flow (CLAUDE.md §8 mandate, ≥1 per phase): create a form
 *     and publish it entirely by keyboard — Tab/Enter through the "Novo
 *     formulário" dialog, then Tab/Enter through the Publish AlertDialog.
 *
 * Also covers Phase 3 QA INFO-1 test-hardening (carried into Phase 4):
 *   - assert the "Coordenação" RoleBadge actually renders for a seeded
 *     staff_admin in the member roster at /c/ccih/manage/members.
 *
 * Runs against whatever Supabase the dev server points at (here: the remote test
 * project). Form titles embed Date.now() so reruns never collide.
 */

test.use({ viewport: { width: 1280, height: 1400 } })

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

async function createForm(page: Page, title: string) {
  await page.goto('/c/ccih/manage/forms')
  await page.getByRole('button', { name: 'Novo formulário' }).click()
  await page.getByLabel('Título do formulário').fill(title)
  await page.getByRole('button', { name: 'Criar formulário' }).click()
  await page.waitForURL(/\/manage\/forms\/[0-9a-f-]+$/, { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible({ timeout: 20_000 })
}

/** Open the "Adicionar bloco" picker (trigger inside `scope`) for a block type. */
async function openAddBlock(page: Page, scope: Locator, menuName: RegExp) {
  const trigger = scope.getByRole('button', { name: 'Adicionar bloco' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: menuName }).click()
  return page.getByRole('dialog')
}

async function submitDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

async function publishForm(page: Page) {
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })
}

/** The immutable storage path embedded in a form-assets signed URL. */
function assetPath(src: string | null): string | null {
  const m = (src ?? '').match(/form-assets\/([^?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

test('staff cannot reach the builder (no builder UI on the list or a form URL)', async ({
  page,
}) => {
  // A staff member of the commission is gated out of the builder by
  // `notFound()` (the page renders no builder UI). Asserted on content rather
  // than HTTP status: a nested `notFound()` returns 404 in production but can
  // surface as a 200 with empty content under Turbopack dev. The commission
  // shell still loads (staff IS a member), so absence of the builder affordances
  // within a loaded shell is the meaningful access-control signal.
  await signInAs(page, 'staff1.ccih@test.local')
  const nav = page.getByRole('navigation', { name: 'Navegação da comissão' })

  const notFound = page.getByRole('heading', {
    name: /Não encontramos esta página/,
  })

  await page.goto('/c/ccih/manage/forms')
  await expect(nav).toBeVisible()
  // The shell stays, and the commission not-found boundary renders (no blank
  // area) instead of the builder.
  await expect(notFound).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novo formulário' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Formulários' })).toHaveCount(0)

  await page.goto('/c/ccih/manage/forms/00000000-0000-0000-0000-000000000000')
  await expect(nav).toBeVisible()
  await expect(notFound).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar seção' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Editar publicado/ })).toHaveCount(0)
})

test('build an unsectioned form with every input type + text + image, then publish (AC a)', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const title = `AC-a ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)

  // multiple_choice — carries the explanation ("Texto de apoio").
  let d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Higienizou as mãos?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Sim')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Não')
  await d.getByLabel(/Texto de apoio/).fill('Considere os 5 momentos da higienização.')
  await submitDialog(d)

  // dropdown
  d = await openAddBlock(page, page.locator('body'), /Lista suspensa/)
  await d.getByLabel('Enunciado da pergunta').fill('Turno da observação?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Manhã')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Tarde')
  await submitDialog(d)

  // checkbox
  d = await openAddBlock(page, page.locator('body'), /Caixas de seleção/)
  await d.getByLabel('Enunciado da pergunta').fill('EPIs disponíveis?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Luvas')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Avental')
  await submitDialog(d)

  // free_text
  d = await openAddBlock(page, page.locator('body'), /Texto livre/)
  await d.getByLabel('Enunciado da pergunta').fill('Observações gerais')
  await submitDialog(d)

  // section_text (Markdown display block)
  d = await openAddBlock(page, page.locator('body'), /Texto explicativo/)
  await d.getByLabel('Texto (Markdown)').fill('## Instruções\nPreencha com atenção.')
  await submitDialog(d)

  // image display block (upload)
  d = await openAddBlock(page, page.locator('body'), /Imagem/)
  await d
    .locator('input[type="file"]')
    .setInputFiles({ name: 'ref.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(d.locator('img')).toBeVisible({ timeout: 20_000 })
  await d.getByLabel('Texto alternativo').fill('Imagem de referência')
  await submitDialog(d)

  // every block is present, then publish
  await expect(page.getByText('Higienizou as mãos?')).toBeVisible()
  await expect(page.getByText('Turno da observação?')).toBeVisible()
  await expect(page.getByText('EPIs disponíveis?')).toBeVisible()
  await expect(page.getByText('Observações gerais')).toBeVisible()

  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })
})

test('publish is blocked when a reorder creates a forward-reference condition (AC c)', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const title = `AC-c ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)

  // Two sections after the (empty) default section.
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  await expect(page.getByRole('heading', { name: 'Seção inicial' })).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar seção' }).click()

  // Name them so we can target each card unambiguously.
  // The default section ("Seção inicial") now also has a "Renomear seção" button,
  // so we scope each click to the "Seção sem título" region (the first untitled
  // non-default section). After naming the first one "Falhas", the remaining
  // untitled section is still "Seção sem título" — rename it to "Detalhes".
  const unnamedSection = page.getByRole('region', { name: 'Seção sem título' })
  await unnamedSection.first().getByRole('button', { name: 'Renomear seção' }).click()
  let rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Falhas')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden()
  // The other untitled section is still "Seção sem título" — rename it to "Detalhes".
  await unnamedSection.first().getByRole('button', { name: 'Renomear seção' }).click()
  rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Detalhes')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden()

  // A choice question lives in "Falhas".
  const falhas = page.getByRole('region', { name: 'Falhas' })
  const d = await openAddBlock(page, falhas, /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Houve falha?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Sim')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Não')
  await submitDialog(d)

  // "Detalhes" is shown only when "Houve falha?" = Sim (valid: Falhas is earlier).
  const detalhes = page.getByRole('region', { name: 'Detalhes' })
  await detalhes
    .getByRole('button', {
      name: 'Configurações da seção (condição e assinatura)',
    })
    .click()
  const s = page.getByRole('dialog')
  await s
    .getByLabel('Mostrar a seção quando')
    .selectOption({ label: 'Houve falha?' })
  await s.getByLabel('Valor').selectOption({ label: 'Sim' })
  await s.getByRole('button', { name: 'Salvar' }).click()
  await expect(s).toBeHidden()

  // Move "Detalhes" above "Falhas" → it now references a LATER section.
  await detalhes
    .getByRole('button', { name: /Mover a seção \d+ para cima/ })
    .click()
  // Wait for the reorder to persist (Detalhes becomes "Seção 2") before
  // publishing, otherwise the publish races the reorder's refresh and validates
  // the still-valid old order.
  await expect(detalhes.getByText('Seção 2')).toBeVisible({ timeout: 15_000 })

  // Publish must be rejected by validate_visible_when with a pt-BR message.
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  await expect(confirm.getByText(/seção anterior/i)).toBeVisible({
    timeout: 20_000,
  })
  // Still a draft — it did not flip to the published read-only view.
  await expect(page.getByRole('button', { name: /Editar publicado/ })).toHaveCount(
    0,
  )
})

test('build a 3-section form with conditional + sign-off sections, then publish (AC b)', async ({
  page,
}) => {
  /**
   * PHASES.md §Phase 4 Acceptance (b): build a 3-section form with one
   * conditional section and one sign-off section — publish.
   *
   * Structure:
   *   Section 1 (default / "Seção inicial") — one multiple_choice question "Houve
   *             incidente?" with options "Sim" / "Não".  This is the default
   *             section; it carries no condition/sign-off (DB CHECK).
   *   Section 2 "Detalhes do Incidente" — conditional: visible only when
   *             "Houve incidente?" = "Sim".  Has a free_text question.
   *   Section 3 "Revisão" — sign-off required (role = respondent).
   *
   * The test asserts:
   *  - All three sections exist in the builder (by heading text).
   *  - The conditional section's section card shows the "assinatura" badge
   *    on the sign-off section.
   *  - Publish succeeds — the page transitions to the published read-only view
   *    (the "Editar publicado" button appears and the draft builder is gone).
   */
  test.setTimeout(180_000)
  const title = `AC-b ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)

  // The freshly-created form is flat (default section only).
  // Add a multiple_choice question to the default (flat) section.
  let d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Houve incidente?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Sim')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Não')
  await submitDialog(d)
  await expect(page.getByText('Houve incidente?')).toBeVisible()

  // Add second section → builder enters sectioned view.
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  await expect(page.getByRole('heading', { name: 'Seção inicial' })).toBeVisible()

  // Rename the new section — scope to the "Seção sem título" region so we
  // don't click the default section's rename button (which now also exists).
  const unnamedSection = page.getByRole('region', { name: 'Seção sem título' })
  await unnamedSection.getByRole('button', { name: 'Renomear seção' }).click()
  let rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Detalhes do Incidente')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Detalhes do Incidente' })).toBeVisible()

  // Add a free_text question to "Detalhes do Incidente".
  const detalhes = page.getByRole('region', { name: 'Detalhes do Incidente' })
  d = await openAddBlock(page, detalhes, /Texto livre/)
  await d.getByLabel('Enunciado da pergunta').fill('Descreva o incidente')
  await submitDialog(d)

  // Configure the condition on "Detalhes do Incidente": visible when
  // "Houve incidente?" = "Sim".
  await detalhes
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  const settings = page.getByRole('dialog')
  await settings.getByLabel('Mostrar a seção quando').selectOption({ label: 'Houve incidente?' })
  await settings.getByLabel('Valor').selectOption({ label: 'Sim' })
  await settings.getByRole('button', { name: 'Salvar' }).click()
  await expect(settings).toBeHidden({ timeout: 10_000 })

  // Add a third section.
  await page.getByRole('button', { name: 'Adicionar seção' }).click()

  // The new section appears as "Seção sem título" again — rename it to "Revisão".
  // ("Detalhes do Incidente" already has a title so "Seção sem título" is unambiguous.)
  await unnamedSection.getByRole('button', { name: 'Renomear seção' }).click()
  rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Revisão')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Revisão' })).toBeVisible()

  // Configure sign-off on "Revisão" (requires_signoff = true, role = respondent).
  const revisao = page.getByRole('region', { name: 'Revisão' })
  await revisao
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  const signoffSettings = page.getByRole('dialog')
  await signoffSettings.getByRole('checkbox', { name: /Exigir assinatura/ }).click()
  // Role defaults to "respondent" — no change needed.
  await signoffSettings.getByRole('button', { name: 'Salvar' }).click()
  await expect(signoffSettings).toBeHidden({ timeout: 10_000 })

  // Assert all three sections are visible in the builder.
  await expect(page.getByRole('heading', { name: 'Seção inicial' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Detalhes do Incidente' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Revisão' })).toBeVisible()

  // The sign-off section card must show the "assinatura" badge — this is the
  // visible indicator that requires_signoff was persisted (not just toggled in
  // client state).
  await expect(
    revisao.getByText('assinatura', { exact: false }),
  ).toBeVisible({ timeout: 10_000 })

  // Publish — this is a VALID form (condition references an EARLIER section).
  // The confirmation dialog must appear, and after confirming the page must
  // transition to the published read-only view (the draft builder is gone).
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Publicar' }).click()

  // Published read-only view: the "Editar publicado" CTA is the definitive
  // signal that the version flipped from draft → published.
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })

  // The draft builder affordances must be gone (no "Adicionar seção" button).
  await expect(page.getByRole('button', { name: 'Adicionar seção' })).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// New feature: default section rename
// ---------------------------------------------------------------------------

test('default section can be renamed once form has ≥2 sections; settings/delete controls remain hidden', async ({
  page,
}) => {
  /**
   * Acceptance criterion for the maintenance change:
   *
   * 1. Flat form (only the default section): NO "Renomear seção" button is
   *    present at the section level (no section chrome in flat mode).
   * 2. Sectioned form (≥2 sections): the default section DOES expose a
   *    "Renomear seção" button, but NOT the settings gear or the delete button.
   * 3. After renaming the default section its new title renders as a heading
   *    and the "Seção inicial" placeholder text disappears.
   * 4. The "inicial" badge (if any) still renders alongside the new title.
   *    (The builder shows a "Seção padrão" / "inicial" indicator on the card.)
   *
   * The test uses the seeded chefe.ccih@test.local persona on the local stack.
   */
  test.setTimeout(120_000)
  const title = `DefaultRename ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)

  // --- Flat form: no section-level "Renomear seção" button ----------------
  // In flat mode the builder renders with no section chrome at all.
  await expect(page.getByRole('button', { name: 'Renomear seção' })).toHaveCount(0)

  // --- Add a second section → sectioned mode ------------------------------
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  // Default section now shows "Seção inicial" placeholder heading.
  const defaultSection = page.getByRole('region', { name: 'Seção inicial' })
  await expect(defaultSection).toBeVisible({ timeout: 15_000 })

  // The default section DOES have a "Renomear seção" button now.
  const renameBtn = defaultSection.getByRole('button', { name: 'Renomear seção' })
  await expect(renameBtn).toBeVisible()

  // But the settings gear (condition/sign-off) and delete button are HIDDEN.
  await expect(
    defaultSection.getByRole('button', {
      name: 'Configurações da seção (condição e assinatura)',
    }),
  ).toHaveCount(0)
  await expect(
    defaultSection.getByRole('button', { name: /Excluir|Remover|Delete/i }),
  ).toHaveCount(0)

  // --- Rename the default section -----------------------------------------
  await renameBtn.click()
  const rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Triagem')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden({ timeout: 10_000 })

  // The default section now renders under the new title.
  await expect(page.getByRole('heading', { name: 'Triagem' })).toBeVisible()
  // The "Seção inicial" placeholder is gone.
  await expect(page.getByRole('heading', { name: 'Seção inicial' })).toHaveCount(0)

  // The region is now addressable by the new title.
  const renamedDefault = page.getByRole('region', { name: 'Triagem' })
  await expect(renamedDefault).toBeVisible()

  // The settings gear and delete button are still absent after renaming.
  await expect(
    renamedDefault.getByRole('button', {
      name: 'Configurações da seção (condição e assinatura)',
    }),
  ).toHaveCount(0)
  await expect(
    renamedDefault.getByRole('button', { name: /Excluir|Remover|Delete/i }),
  ).toHaveCount(0)

  // The rename button is still present (can rename again).
  await expect(renamedDefault.getByRole('button', { name: 'Renomear seção' })).toBeVisible()
})

test('re-uploading an image in v2 yields a NEW storage path; v1 stays immutable (AC d)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `AC-d ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)

  // v1: a single image block, then publish.
  let d = await openAddBlock(page, page.locator('body'), /Imagem/)
  await d
    .locator('input[type="file"]')
    .setInputFiles({ name: 'v1.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(d.locator('img')).toBeVisible({ timeout: 20_000 })
  await d.getByLabel('Texto alternativo').fill('Imagem da versão 1')
  await submitDialog(d)
  await publishForm(page)

  // Capture v1's published image path (a real signed form-assets URL).
  const v1Img = page.locator('main img').first()
  await expect(v1Img).toBeVisible({ timeout: 20_000 })
  const v1Path = assetPath(await v1Img.getAttribute('src'))
  expect(v1Path).toBeTruthy()

  // Clone to a v2 draft and RE-UPLOAD the image (edit the block).
  await page.getByRole('button', { name: /Editar publicado/ }).click()
  await expect(
    page.getByRole('button', { name: 'Adicionar seção' }),
  ).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Editar bloco' }).click()
  d = page.getByRole('dialog')
  await d
    .locator('input[type="file"]')
    .setInputFiles({ name: 'v2.png', mimeType: 'image/png', buffer: PNG_1PX })
  // In EDIT mode the OLD preview is already shown, so wait for the new upload to
  // actually resolve — the preview switches to a local blob: URL only after
  // uploadFormAsset succeeds — before saving. The immutable path is
  // timestamp-based so it differs from v1's even for identical bytes.
  await expect(d.locator('img')).toHaveAttribute('src', /^blob:/, {
    timeout: 20_000,
  })
  await d.getByRole('button', { name: 'Salvar' }).click()
  await expect(d).toBeHidden({ timeout: 15_000 })
  await publishForm(page)

  const v2Img = page.locator('main img').first()
  await expect(v2Img).toBeVisible({ timeout: 20_000 })
  const v2Path = assetPath(await v2Img.getAttribute('src'))
  expect(v2Path).toBeTruthy()

  // The re-upload landed at a NEW immutable path (Architecture Rule 6).
  expect(v2Path).not.toBe(v1Path)

  // v1 is archived AND immutable: its history view still renders the ORIGINAL
  // image path, untouched by the v2 re-upload.
  await page.getByRole('link', { name: 'Versões' }).click()
  await page.waitForURL(/\/versions$/, { timeout: 15_000 })
  await page.getByRole('link', { name: /Versão 1/ }).click()
  const v1HistImg = page.locator('main img').first()
  await expect(v1HistImg).toBeVisible({ timeout: 20_000 })
  expect(assetPath(await v1HistImg.getAttribute('src'))).toBe(v1Path)
})

// ---------------------------------------------------------------------------
// Keyboard-only flow (CLAUDE.md §8 mandate — ≥1 per phase)
// ---------------------------------------------------------------------------

test('keyboard-only: create a form via dialog and publish via AlertDialog (keyboard flow)', async ({
  page,
}) => {
  /**
   * CLAUDE.md §8: every phase must include at least one keyboard-only flow.
   *
   * Flow (all interaction via keyboard.press — no mouse after sign-in):
   *
   *  PART 1 — "Novo formulário" dialog:
   *   1. Focus the "Novo formulário" button with .focus() to anchor the keyboard
   *      sequence at the right starting point (Tab from the page top would cross
   *      the nav — anchoring is standard Playwright keyboard-only practice).
   *   2. Press Enter → dialog opens; the title input has `autoFocus` so focus
   *      lands there immediately (no Tab needed).
   *   3. Type the form title.
   *   4. Tab  → moves to the "Descrição" textarea.
   *   5. Tab  → moves to the "Criar formulário" submit button.
   *   6. Enter → submits; server action creates the form + default section and
   *      navigates to the builder URL. Assert the builder is visible.
   *
   *  PART 2 — Publish AlertDialog:
   *   1. Focus the "Publicar" trigger button; press Enter → AlertDialog opens.
   *      Radix AlertDialog traps focus on open and focuses the first interactive
   *      element in the content — the "Cancelar" button (first in DOM order).
   *   2. Tab  → moves focus to the "Publicar" confirm button (second in footer).
   *   3. Enter → calls handleConfirm(), publishes, dialog closes, router refreshes.
   *   4. Assert the published read-only view ("Editar publicado" button visible)
   *      and the draft builder affordances are gone.
   *
   * Escape behaviour is also exercised (cancel path is tested to confirm Radix
   * Escape-to-close works, then the flow is retried for the positive path).
   */
  test.setTimeout(90_000)
  const title = `KB ${Date.now()}`

  // Sign in by mouse (keyboard sign-in was the Phase 2 keyboard flow).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/manage/forms')
  await page.waitForURL('**/c/ccih/manage/forms', { timeout: 15_000 })

  // ── PART 1: create form by keyboard ────────────────────────────────────────

  // Anchor focus on "Novo formulário" and open the dialog with Enter.
  const newFormBtn = page.getByRole('button', { name: 'Novo formulário' })
  await newFormBtn.focus()
  await expect(newFormBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // The dialog should open; autoFocus lands on the title input.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  const titleInput = dialog.getByLabel('Título do formulário')
  await expect(titleInput).toBeFocused({ timeout: 5_000 })

  // Type the form title (keyboard only — no .fill()).
  await page.keyboard.type(title)
  await expect(titleInput).toHaveValue(title)

  // Escape — verify the dialog closes (keyboard cancel path).
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden({ timeout: 5_000 })

  // Re-open the dialog — anchor focus on the button again.
  await newFormBtn.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  // autoFocus restores to the title input; type the title again.
  await expect(titleInput).toBeFocused({ timeout: 5_000 })
  await page.keyboard.type(title)

  // Tab past "Descrição" textarea → Tab to the submit button → Enter to submit.
  await page.keyboard.press('Tab') // title → description textarea
  await page.keyboard.press('Tab') // description → "Criar formulário" button
  const submitBtn = dialog.getByRole('button', { name: 'Criar formulário' })
  await expect(submitBtn).toBeFocused({ timeout: 3_000 })
  await page.keyboard.press('Enter')

  // Server action creates the form; page navigates to the builder.
  await page.waitForURL(/\/manage\/forms\/[0-9a-f-]+$/, { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible({ timeout: 10_000 })

  // ── PART 2: publish via AlertDialog by keyboard ────────────────────────────

  // Anchor focus on the "Publicar" trigger and open the AlertDialog with Enter.
  const publishTrigger = page.getByRole('button', { name: 'Publicar' })
  await publishTrigger.focus()
  await expect(publishTrigger).toBeFocused()
  await page.keyboard.press('Enter')

  // AlertDialog opens; Radix traps focus on the first interactive element —
  // "Cancelar" (first in DOM order in the footer).
  const alertDialog = page.getByRole('alertdialog')
  await expect(alertDialog).toBeVisible({ timeout: 10_000 })
  const cancelBtn = alertDialog.getByRole('button', { name: 'Cancelar' })
  await expect(cancelBtn).toBeFocused({ timeout: 5_000 })

  // Escape to cancel — dialog must close (keyboard cancel, Radix built-in).
  await page.keyboard.press('Escape')
  await expect(alertDialog).toBeHidden({ timeout: 5_000 })
  // Still in the draft builder (no read-only transition).
  await expect(publishTrigger).toBeVisible()

  // Re-open and confirm by keyboard: Enter → Tab → Enter.
  await publishTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(alertDialog).toBeVisible({ timeout: 10_000 })
  // Radix focuses "Cancelar" first; Tab moves to the "Publicar" confirm button.
  await page.keyboard.press('Tab')
  const confirmBtn = alertDialog.getByRole('button', { name: 'Publicar' })
  await expect(confirmBtn).toBeFocused({ timeout: 3_000 })
  await page.keyboard.press('Enter')

  // Server publishes the form; page transitions to the published read-only view.
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })
  // The draft builder affordances must be gone.
  await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// Phase 3 QA INFO-1 test-hardening (carried into Phase 4)
// ---------------------------------------------------------------------------

test('RoleBadge renders "Coordenação" for a seeded staff_admin in the member roster (INFO-1)', async ({
  page,
}) => {
  /**
   * Phase 3 QA INFO-1: the AC1 test asserted the coordinator's email appears in
   * the roster but did not assert the "Coordenação" RoleBadge rendered.
   *
   * The RoleBadge is rendered by MemberList at /c/[slug]/manage/members.
   * chefe.ccih@test.local is seeded as staff_admin of commission "ccih" — their
   * row must carry the "Coordenação" badge (text inside a <span> with
   * bg-accent styling) and staff1.ccih@test.local must carry "Membro".
   *
   * This test runs against remote because the seeded personas are present there.
   * It does NOT depend on Mailpit / email capture.
   */
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/manage/members')
  await page.waitForURL('**/c/ccih/manage/members', { timeout: 15_000 })

  // The roster must be visible (non-empty — seeded members exist).
  const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
  await expect(memberList).toBeVisible({ timeout: 10_000 })

  // chefe.ccih@test.local is the logged-in staff_admin; their row shows "(você)"
  // and must carry the "Coordenação" badge.
  const coordRow = memberList.locator('li').filter({ hasText: /você/ })
  await expect(coordRow).toBeVisible()
  // The RoleBadge renders inside a <span> whose text content is exactly
  // "COORDENAÇÃO" (uppercased by CSS `uppercase` class). We match
  // case-insensitively to be robust to CSS rendering differences.
  const coordBadge = coordRow.locator('span').filter({ hasText: /coordena[çc]ão/i })
  await expect(coordBadge).toBeVisible()
  // Verify it is NOT the "Membro" badge text.
  await expect(coordBadge).not.toHaveText(/membro/i)

  // staff1.ccih@test.local must be in the list with the "Membro" badge.
  const staffRow = memberList.locator('li').filter({ hasText: /staff1\.ccih/i })
  await expect(staffRow).toBeVisible()
  const memberBadge = staffRow.locator('span').filter({ hasText: /membro/i })
  await expect(memberBadge).toBeVisible()
  await expect(memberBadge).not.toHaveText(/coordena[çc]ão/i)
})
