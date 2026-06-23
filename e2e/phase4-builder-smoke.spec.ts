import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 4 — Form Builder & Versioning · LEAD SMOKE (not the full AC suite)
 *
 * A single end-to-end happy path that exercises the newly-finished builder UI
 * (F1–F6) against a live Supabase backend: create → add input/display blocks →
 * add a second section → condition + sign-off settings → image upload to
 * `form-assets` → publish → "editar publicado" clone → version history. The
 * `tester` teammate still owns the full PHASES.md §Phase 4 acceptance matrix
 * (a–d); this is a build-confidence smoke the lead runs while finishing the phase.
 *
 * Seeded coordinator (password Test1234!): chefe.ccih@test.local → commission `ccih`.
 */

// 1×1 transparent PNG.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

// A tall viewport so the "Adicionar bloco" dropdown always has room below the
// trigger as the form grows (avoids Radix portal collision-flip flakiness).
test.use({ viewport: { width: 1280, height: 1400 } })

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

test('coordinator builds, configures, publishes, edits and versions a form', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const title = `Smoke CCIH ${Date.now()}`

  await signInAs(page, 'chefe.ccih@test.local')

  // --- F1: create a form from the list → lands in the builder -----------------
  await page.goto('/c/ccih/manage/forms')
  await page.getByRole('button', { name: 'Novo formulário' }).click()
  await page.getByLabel('Título do formulário').fill(title)
  await page.getByRole('button', { name: 'Criar formulário' }).click()
  await page.waitForURL(/\/c\/ccih\/manage\/forms\/[0-9a-f-]+$/, {
    timeout: 20_000,
  })
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 20_000,
  })

  // --- F3: add a multiple-choice question to the default (flat) section -------
  await page.getByRole('button', { name: 'Adicionar bloco' }).click()
  await page.getByRole('menuitem', { name: /Múltipla escolha/ }).click()
  const itemDialog = page.getByRole('dialog')
  await itemDialog
    .getByLabel('Enunciado da pergunta')
    .fill('A higienização foi realizada?')
  await itemDialog.getByLabel('Opção 1', { exact: true }).fill('Sim')
  await itemDialog.getByRole('button', { name: 'Adicionar opção' }).click()
  await itemDialog.getByLabel('Opção 2', { exact: true }).fill('Não')
  await itemDialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('A higienização foi realizada?')).toBeVisible()

  // --- F5: add an image display block (uploads to remote form-assets) ---------
  await page.getByRole('button', { name: 'Adicionar bloco' }).click()
  await page.getByRole('menuitem', { name: /Imagem/ }).click()
  const imgDialog = page.getByRole('dialog')
  await imgDialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'pia.png', mimeType: 'image/png', buffer: PNG_1PX })
  // Wait for the upload to resolve into a preview before saving.
  await expect(imgDialog.locator('img')).toBeVisible({ timeout: 20_000 })
  await imgDialog
    .getByLabel('Texto alternativo')
    .fill('Foto da pia de higienização')
  await imgDialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(imgDialog).toBeHidden({ timeout: 15_000 })

  // --- F2: add a second section → builder switches to sectioned view ----------
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  // The default section now shows "Seção inicial" (with a rename button of its own).
  await expect(page.getByRole('heading', { name: 'Seção inicial' })).toBeVisible()
  // Rename the new (untitled, non-default) section — scope to its region so
  // we don't accidentally click the default section's rename button.
  const newSection = page.getByRole('region', { name: 'Seção sem título' })
  await newSection.getByRole('button', { name: 'Renomear seção' }).click()
  const renameDialog = page.getByRole('dialog')
  await renameDialog.getByLabel('Título da seção').fill('Não conformidades')
  await renameDialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Não conformidades' }),
  ).toBeVisible()

  // --- F4: condition (visible_when) + sign-off on the second section ----------
  await page
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  const settings = page.getByRole('dialog')
  // Enable the condition toggle first (ConditionBuilder refactor in FBE phase).
  await settings
    .getByRole('checkbox', { name: /Exibir somente sob condições/i })
    .check()
  // ConditionBuilder uses stable id-suffix selects (no accessible label).
  await settings
    .locator('select[id$="-target"]')
    .selectOption({ label: 'A higienização foi realizada?' })
  await settings.locator('select[id$="-value"]').selectOption({ label: 'Não' })
  await settings
    .getByRole('checkbox', { name: /Exigir assinatura/ })
    .click()
  await settings.getByRole('button', { name: 'Salvar' }).click()
  await expect(settings).toBeHidden({ timeout: 15_000 })
  // The section card now advertises its condition + sign-off.
  await expect(page.getByText('assinatura', { exact: false }).first()).toBeVisible()

  // --- F6: publish (confirm dialog) → published read-only view ----------------
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Publicado', { exact: false }).first()).toBeVisible()

  // --- F6: "editar publicado" clones into a fresh draft (v2) ------------------
  await page.getByRole('button', { name: /Editar publicado/ }).click()
  await expect(
    page.getByRole('button', { name: 'Adicionar seção' }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('v2')).toBeVisible()

  // --- F6: version history lists v2 (draft) alongside v1 (still published) ----
  // Cloning does NOT archive v1 — that happens only when v2 is published.
  await page.getByRole('link', { name: 'Versões' }).click()
  await page.waitForURL(/\/versions$/, { timeout: 15_000 })
  await expect(page.getByText('Versão 2')).toBeVisible()
  await expect(page.getByText('Versão 1')).toBeVisible()
  await expect(page.getByText('Rascunho').first()).toBeVisible()
  await expect(page.getByText('Publicado').first()).toBeVisible()

  // --- F6 / AC-d: publishing v2 archives v1 -----------------------------------
  await page.goBack() // back to the v2 draft builder
  await expect(page.getByRole('button', { name: 'Adicionar seção' })).toBeVisible({
    timeout: 20_000,
  })
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm2 = page.getByRole('alertdialog')
  await expect(confirm2).toBeVisible()
  await confirm2.getByRole('button', { name: 'Publicar' }).click()
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })

  await page.getByRole('link', { name: 'Versões' }).click()
  await page.waitForURL(/\/versions$/, { timeout: 15_000 })
  // v1 is now archived; v2 is the published version.
  await expect(page.getByText('Arquivado').first()).toBeVisible({ timeout: 15_000 })
})
