import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * Phase 4 — Form Builder & Versioning · acceptance gap coverage.
 *
 * Complements `phase4-builder-smoke.spec.ts` (the broad happy path: blocks,
 * image upload, condition + sign-off, publish, clone, republish-archive) with
 * the PHASES.md §Phase 4 acceptance clauses it doesn't exercise:
 *   - (a) an unsectioned form using EVERY input type (≥1 with explanation) plus
 *         a text block and an image, then publish.
 *   - (c) an INVALID condition (forward reference, reached via reorder) →
 *         publish blocked with a clear pt-BR error (publish-time validation is
 *         the authority, not the editor's offered targets).
 *   - access control: a staff member cannot reach the builder.
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

  await page.goto('/c/ccih/manage/forms')
  await expect(nav).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novo formulário' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Formulários' })).toHaveCount(0)

  await page.goto('/c/ccih/manage/forms/00000000-0000-0000-0000-000000000000')
  await expect(nav).toBeVisible()
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
  await page.getByRole('button', { name: 'Renomear seção' }).nth(0).click()
  let rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Falhas')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden()
  await page.getByRole('button', { name: 'Renomear seção' }).nth(1).click()
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
