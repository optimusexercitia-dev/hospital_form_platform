import { execSync } from 'node:child_process'
import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * Answer-Model v2 (mini-phase) — the default-values E2E acceptance criteria
 * (plan §Verification: docs/plans/answer-model-v2.md; ADR 0045/0046).
 *
 * What this spec covers, now that BE-1..BE-5 persistence is live:
 *   DV-1 (builder→wizard, scalar): staff_admin sets a "Valor padrão" on a
 *        short_text + a number item, saves, publishes; staff opens the form and
 *        BOTH fields are pre-seeded; the value is editable; the edited value is
 *        what gets submitted (DB truth).
 *   DV-2 (builder→wizard, choice): a single-select default (multiple_choice)
 *        and a checkbox-set default; staff sees the option(s) pre-checked;
 *        changing the selection persists the CHANGED selection, not the default.
 *   DV-3 (hidden item never seeded): an item hidden by `visible_when` carries a
 *        default but must NOT be pre-filled NOR written to `answers` even when
 *        the section briefly becomes visible then hidden again before submit.
 *   DV-4 (kept default → ordinary submitted answer): a default left untouched
 *        submits as a normal answer — visible on the submission-detail page and
 *        counted by the dashboard distribution.
 *   DV-5 (keyboard-only, CLAUDE.md §8): tab to the builder's default-value
 *        control and set it via keyboard only; separately, fill + submit a
 *        defaulted wizard field via keyboard only.
 *   DV-6 (HC080 reachability note): the publish-time invalid-default rejection
 *        is validated at the RPC layer directly (the builder UI's derived
 *        option-prune makes an invalid CHOICE default unreachable by mouse/kbd
 *        alone) — and it doubles as a REGRESSION check that the friendly pt-BR
 *        message actually reaches the user (see inline note — a real gap was
 *        found here during this pass).
 *
 * Hermetic: every form is spec-owned (title carries a unique tag), built via
 * the real builder UI (or the service role for narrow DB-truth setup) and
 * cleaned up by title pattern. Run with --workers=1, chromium.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH — builder + dashboard
 *   staff1.ccih@test.local  staff, CCIH       — respondent
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 1400 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'
const SPEC_TAG = 'AMV2-SPEC'

// ---------------------------------------------------------------------------
// Auth / REST helpers (mirror form-model-normalization.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.context().clearCookies()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('E-mail').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

async function getToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok(), `token for ${email}: ${await resp.text()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function serviceQuery<T>(page: Page, path: string): Promise<T[]> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function rpcAs<T>(
  page: Page,
  token: string,
  fn: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: T; text: string }> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
  const text = await resp.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { ok: resp.ok(), status: resp.status(), json: json as T, text }
}

/** Run SQL as postgres via docker exec — fixture setup / cleanup ONLY. */
function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`, {
    encoding: 'utf8',
  })
    .toString()
    .trim()
}

function purge() {
  sql(`set session_replication_role = replica; delete from forms where title like '%${SPEC_TAG}%';`)
}

// ---------------------------------------------------------------------------
// Builder navigation helpers (mirror form-model-normalization.spec.ts)
// ---------------------------------------------------------------------------

async function createForm(page: Page, title: string): Promise<string> {
  await page.goto('/o/rede-a/c/ccih/manage/forms')
  await page.getByRole('button', { name: 'Novo formulário' }).click()
  await page.getByLabel('Título do formulário').fill(title)
  await page.getByRole('button', { name: 'Criar formulário' }).click()
  await page.waitForURL(/\/manage\/forms\/[0-9a-f-]+$/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 20_000,
  })
  const url = page.url()
  return url.slice(url.lastIndexOf('/') + 1)
}

async function openAddBlock(page: Page, scope: Locator, menuName: RegExp) {
  const trigger = scope.getByRole('button', { name: 'Adicionar bloco' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: menuName }).click()
  return page.getByRole('dialog')
}

async function submitAddDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

async function publishForm(page: Page) {
  const publishBtn = page.getByRole('button', { name: 'Publicar' })
  await expect(publishBtn).toBeVisible({ timeout: 15_000 })
  await publishBtn.click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByRole('button', { name: /Editar publicado/ })).toBeVisible({
    timeout: 40_000,
  })
}

/**
 * Enter a form's wizard from the commission's "Formulários" list, by title.
 * Scoped to `article` only (FillableFormCard's root element) — the previous
 * `article,li,div` selector also matched the page's own outer wrapper `div`
 * (which contains every card's text), so `.first()` landed on the wrapper
 * and the click target resolved against the FIRST card on the whole page
 * instead of the one for `title`.
 *
 * "Preencher" (first-time fill — the common case, no existing in_progress
 * response) renders as a `<button>` (role `button`, `StartFillButton`);
 * "Continuar preenchimento" (resume) renders as an `<a>` (role `link`). Match
 * both roles rather than assuming `link`.
 */
async function enterWizardByTitle(page: Page, commission: string, title: string) {
  await page.goto(`/o/rede-a/c/${commission}/forms`)
  const card = page.locator('article').filter({ hasText: title }).first()
  await card.scrollIntoViewIfNeeded()
  const nameRe = /preencher|continuar preenchimento/i
  const preencherBtn = card
    .getByRole('button', { name: nameRe })
    .or(card.getByRole('link', { name: nameRe }))
  await preencherBtn.first().click()
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.beforeAll(() => {
  purge()
})
test.afterAll(() => {
  purge()
})

// ===========================================================================
// DV-1 — scalar defaults: builder sets short_text + number defaults, staff
// sees them pre-filled, edits them, submitted values reflect the EDIT.
// ===========================================================================

test('DV-1 (scalar defaults): builder sets short_text + number defaults; wizard pre-fills, edit persists', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Scalar ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // short_text with default "Ala Norte"
  let d = await openAddBlock(page, page.locator('body'), /Resposta curta/)
  await d.getByLabel('Enunciado da pergunta').fill('Local da inspeção')
  await d.getByLabel(/Valor padrão/i).fill('Ala Norte')
  await submitAddDialog(d)

  // number with default 5
  d = await openAddBlock(page, page.locator('body'), /Número/)
  await d.getByLabel('Enunciado da pergunta').fill('Quantidade de leitos')
  await d.getByLabel(/Valor padrão/i).fill('5')
  await submitAddDialog(d)

  await publishForm(page)

  // --- DB truth: default_value persisted on both items -----------------------
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const items = await serviceQuery<{
    id: string
    item_type: string
    default_value: unknown
    question_key: string
  }>(page, `form_items?form_version_id=eq.${versionId}&select=id,item_type,default_value,question_key`)
  const shortTextItem = items.find((i) => i.item_type === 'short_text')!
  const numberItem = items.find((i) => i.item_type === 'number')!
  expect(shortTextItem.default_value).toBe('Ala Norte')
  expect(Number(numberItem.default_value)).toBe(5)

  // --- Staff fills: both fields pre-seeded with the defaults ------------------
  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizardByTitle(page, 'ccih', title)

  const shortTextInput = page.getByLabel('Local da inspeção')
  const numberInput = page.getByLabel('Quantidade de leitos')
  await expect(shortTextInput).toHaveValue('Ala Norte')
  await expect(numberInput).toHaveValue('5')

  // Edit both — the default is genuinely editable.
  await shortTextInput.fill('Ala Sul')
  await numberInput.fill('7')

  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
    timeout: 20_000,
  })

  // --- DB truth: the SUBMITTED value is the edited one, not the default -------
  const answers = await serviceQuery<{ item_id: string; value: unknown }>(
    page,
    `answers?item_id=in.(${shortTextItem.id},${numberItem.id})&select=item_id,value`,
  )
  const shortTextAnswer = answers.find((a) => a.item_id === shortTextItem.id)!
  const numberAnswer = answers.find((a) => a.item_id === numberItem.id)!
  expect(shortTextAnswer.value).toBe('Ala Sul')
  expect(Number(numberAnswer.value)).toBe(7)
})

// ===========================================================================
// DV-2 — choice defaults: single-select (multiple_choice) + checkbox-set.
// Staff sees the default option(s) pre-checked; changing the selection
// persists the CHANGE.
// ===========================================================================

test('DV-2 (choice defaults): single-select + checkbox defaults pre-check in the wizard; the changed selection is what submits', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Choice ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // multiple_choice "Turno?" with 3 options, default = "Tarde"
  let d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Turno da inspeção?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Manhã')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Tarde')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 3', { exact: true }).fill('Noite')
  await d.getByLabel(/Valor padrão/i).selectOption({ label: 'Tarde' })
  await submitAddDialog(d)

  // checkbox "EPIs?" with 3 options, defaults = ["Luvas", "Máscara"]
  d = await openAddBlock(page, page.locator('body'), /Caixas de seleção/)
  await d.getByLabel('Enunciado da pergunta').fill('EPIs utilizados?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Luvas')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Avental')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 3', { exact: true }).fill('Máscara')
  // The default checkbox-set is its OWN fieldset ("Valor padrão" legend) — scope
  // by the fieldset to avoid colliding with the row checkboxes above it.
  const defaultFieldset = d.locator('fieldset', { hasText: 'Valor padrão' })
  await defaultFieldset.getByRole('checkbox', { name: 'Luvas' }).check()
  await defaultFieldset.getByRole('checkbox', { name: 'Máscara' }).check()
  await submitAddDialog(d)

  await publishForm(page)

  // --- DB truth: default_value persisted as option CODES -----------------
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const items = await serviceQuery<{ id: string; item_type: string; default_value: unknown }>(
    page,
    `form_items?form_version_id=eq.${versionId}&select=id,item_type,default_value`,
  )
  const mcItem = items.find((i) => i.item_type === 'multiple_choice')!
  const cbItem = items.find((i) => i.item_type === 'checkbox')!
  expect(typeof mcItem.default_value).toBe('string')
  expect(Array.isArray(cbItem.default_value)).toBe(true)
  expect((cbItem.default_value as string[]).length).toBe(2)

  // --- Staff fills: default option pre-selected; default checkboxes pre-checked
  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizardByTitle(page, 'ccih', title)

  await expect(page.getByRole('radio', { name: 'Tarde' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Manhã' })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Luvas' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Máscara' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Avental' })).not.toBeChecked()

  // Change the selection: pick "Manhã" instead; uncheck "Luvas", check "Avental".
  await page.getByRole('radio', { name: 'Manhã' }).click()
  await page.getByRole('checkbox', { name: 'Luvas' }).uncheck()
  await page.getByRole('checkbox', { name: 'Avental' }).check()

  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
    timeout: 20_000,
  })

  // --- DB truth: submitted selections reflect the CHANGE, not the defaults ----
  const mcOptions = await serviceQuery<{ id: string; code: string; label: string }>(
    page,
    `form_item_options?item_id=eq.${mcItem.id}&select=id,code,label`,
  )
  const cbOptions = await serviceQuery<{ id: string; code: string; label: string }>(
    page,
    `form_item_options?item_id=eq.${cbItem.id}&select=id,code,label`,
  )
  const mcAnswer = (
    await serviceQuery<{ id: string }>(page, `answers?item_id=eq.${mcItem.id}&select=id`)
  )[0]
  const cbAnswer = (
    await serviceQuery<{ id: string }>(page, `answers?item_id=eq.${cbItem.id}&select=id`)
  )[0]
  const mcSel = await serviceQuery<{ option_id: string }>(
    page,
    `answer_selected_options?answer_id=eq.${mcAnswer.id}&select=option_id`,
  )
  const cbSel = await serviceQuery<{ option_id: string }>(
    page,
    `answer_selected_options?answer_id=eq.${cbAnswer.id}&select=option_id`,
  )
  const manhaId = mcOptions.find((o) => o.label === 'Manhã')!.id
  expect(mcSel.map((s) => s.option_id)).toEqual([manhaId])
  const cbSelLabels = cbSel
    .map((s) => cbOptions.find((o) => o.id === s.option_id)!.label)
    .sort()
  expect(cbSelLabels).toEqual(['Avental', 'Máscara'])
})

// ===========================================================================
// DV-3 — a default on an item hidden by `visible_when` is NEVER written, even
// if the controlling section/section briefly makes it visible then hidden
// again before submit.
// ===========================================================================

test('DV-3 (hidden default never written): a defaulted item hidden by a condition collects no answer', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Hidden ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // Default section: controlling MC "Houve intercorrência?" (Sim/Não).
  let d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Houve intercorrência?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Sim')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Não')
  await submitAddDialog(d)

  // Conditional section "Detalhes" shown when "Houve intercorrência?" = Sim,
  // holding a short_text item WITH a default value.
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  const unnamed = page.getByRole('region', { name: 'Seção sem título' })
  await unnamed.getByRole('button', { name: 'Renomear seção' }).click()
  const rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Detalhes')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden()

  const detalhes = page.getByRole('region', { name: 'Detalhes' })
  d = await openAddBlock(page, detalhes, /Resposta curta/)
  await d.getByLabel('Enunciado da pergunta').fill('Descreva brevemente')
  await d.getByLabel(/Valor padrão/i).fill('Sem detalhes adicionais')
  await submitAddDialog(d)

  await detalhes
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  const s = page.getByRole('dialog')
  await s.getByRole('checkbox', { name: /Exibir somente sob condições/i }).check()
  await s.locator('select[id$="-target"]').selectOption({ label: 'Houve intercorrência?' })
  await s.locator('select[id$="-value"]').selectOption({ label: 'Sim' })
  await s.getByRole('button', { name: 'Salvar' }).click()
  await expect(s).toBeHidden()

  await publishForm(page)

  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const detailItem = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${versionId}&item_type=eq.short_text&select=id`,
    )
  )[0]

  // --- Staff answers "Não" → the conditional section stays hidden throughout;
  // the wizard must NEVER pre-fill the hidden item's default.
  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizardByTitle(page, 'ccih', title)
  await page.getByRole('radio', { name: 'Não' }).click()

  // The hidden section's question must not be visible/pre-filled anywhere.
  await expect(page.getByText('Descreva brevemente')).toHaveCount(0)

  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
    timeout: 20_000,
  })

  // --- DB truth: NO answers row for the hidden defaulted item -----------------
  const detailAnswers = await serviceQuery<{ id: string }>(
    page,
    `answers?item_id=eq.${detailItem.id}&select=id`,
  )
  expect(detailAnswers.length).toBe(0)

  // --- Second respondent: answers "Sim" then flips BACK to "Não" before
  // submit — the section becomes visible (seeding the default into local wizard
  // state) then hidden again; the hidden-cleanup on submit must still drop it.
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizardByTitle(page, 'ccih', title)
  await page.getByRole('radio', { name: 'Sim' }).click()
  // Now the conditional section/step should be reachable; its defaulted field
  // pre-fills. Flip back to "Não" before ever visiting/submitting it.
  await page.getByRole('radio', { name: 'Não' }).click()
  await expect(page.getByText('Descreva brevemente')).toHaveCount(0)

  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
    timeout: 20_000,
  })

  const detailAnswers2 = await serviceQuery<{ id: string }>(
    page,
    `answers?item_id=eq.${detailItem.id}&select=id`,
  )
  expect(detailAnswers2.length).toBe(0)
})

// ===========================================================================
// DV-4 — a KEPT default persists as an ordinary submitted answer: visible on
// the submission-detail page and counted by the dashboard distribution.
// ===========================================================================

test('DV-4 (kept default → ordinary answer): shows on submission detail and counts on the dashboard', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Kept ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // multiple_choice "Resultado?" with default = "Conforme".
  const d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Resultado da checagem?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Conforme')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Não conforme')
  await d.getByLabel(/Valor padrão/i).selectOption({ label: 'Conforme' })
  await submitAddDialog(d)

  await publishForm(page)

  // --- Staff fills WITHOUT touching the defaulted field (keeps "Conforme") ----
  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizardByTitle(page, 'ccih', title)
  // `exact: true` — "Conforme" is a substring of "Não conforme", so a loose
  // name match resolves to BOTH radios (strict-mode violation).
  await expect(page.getByRole('radio', { name: 'Conforme', exact: true })).toBeChecked()

  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  // The review screen shows the kept default as a normal answer.
  await expect(page.getByText('Conforme').first()).toBeVisible()
  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
    timeout: 20_000,
  })

  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const resolvedResponseId = (
    await serviceQuery<{ id: string }>(
      page,
      `responses?form_version_id=eq.${versionId}&status=eq.submitted&select=id&order=submitted_at.desc&limit=1`,
    )
  )[0].id

  // --- DB truth: the kept default persisted as a normal answers row with a
  // selection, indistinguishable from a manually-selected answer -------------
  const item = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${versionId}&item_type=eq.multiple_choice&select=id`,
    )
  )[0]
  const answerRow = (
    await serviceQuery<{ id: string; response_id: string }>(
      page,
      `answers?item_id=eq.${item.id}&response_id=eq.${resolvedResponseId}&select=id,response_id`,
    )
  )[0]
  expect(answerRow, 'a kept default must persist an ordinary answers row').toBeTruthy()

  // --- Submission-detail page shows the kept value -----------------------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${resolvedResponseId}`)
  await expect(page.getByText('Resultado da checagem?')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Conforme').first()).toBeVisible()

  // --- Dashboard distribution counts the kept-default response ------------
  await page.goto('/o/rede-a/c/ccih/dashboard')
  await expect(page.getByRole('tablist', { name: /formulários/i })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('tab', { name: title }).click()
  const article = page.locator('article').filter({ hasText: /Resultado da checagem/i })
  await expect(article).toBeVisible({ timeout: 15_000 })
  const conformeRow = article
    .locator('table tr')
    .filter({ has: page.locator('th', { hasText: /^Conforme$/ }) })
  await expect(conformeRow.locator('td').first()).toHaveText('1')
})

// ===========================================================================
// DV-5 — keyboard-only (CLAUDE.md §8): set a builder default via keyboard
// only; fill + submit a defaulted wizard field via keyboard only.
// ===========================================================================

test('DV-5 (keyboard-only): set a default via keyboard in the builder; fill and submit a defaulted field via keyboard', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Keyboard ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // --- Builder: add a short_text item and set its default via keyboard only --
  const d = await openAddBlock(page, page.locator('body'), /Resposta curta/)
  const labelInput = d.getByLabel('Enunciado da pergunta')
  await labelInput.fill('Responsável pela vistoria')

  const defaultInput = d.getByLabel(/Valor padrão/i)
  await defaultInput.focus()
  await expect(defaultInput).toBeFocused()
  await page.keyboard.type('Equipe CCIH')
  await expect(defaultInput).toHaveValue('Equipe CCIH')

  // Submit the dialog via keyboard (Tab to the "Adicionar" button, Enter).
  await page.keyboard.press('Tab')
  const addBtn = d.getByRole('button', { name: 'Adicionar', exact: true })
  // Tab until the Adicionar button is focused (bounded loop, dialog is small).
  for (let i = 0; i < 15 && !(await addBtn.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(addBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(d).toBeHidden({ timeout: 15_000 })

  await publishForm(page)

  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const item = (
    await serviceQuery<{ id: string; default_value: unknown }>(
      page,
      `form_items?form_version_id=eq.${versionId}&item_type=eq.short_text&select=id,default_value`,
    )
  )[0]
  expect(item.default_value).toBe('Equipe CCIH')

  // --- Wizard: fill (edit the defaulted field) and submit via keyboard only ---
  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizardByTitle(page, 'ccih', title)

  const wizardInput = page.getByLabel('Responsável pela vistoria')
  await expect(wizardInput).toHaveValue('Equipe CCIH')
  await wizardInput.focus()
  // Keyboard-only edit: select-all + retype. `Control+A` is NOT a portable
  // select-all here — on macOS Chromium it's the Emacs-style "move to line
  // start" binding (Cmd+A is select-all), so it silently moved the caret
  // instead of selecting, and the typed text got prepended to the existing
  // default rather than replacing it. `Home` + `Shift+End` selects the whole
  // single-line value on every platform/OS keybinding convention.
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  await page.keyboard.type('Ana Paula (CCIH)')
  await expect(wizardInput).toHaveValue('Ana Paula (CCIH)')

  // Tab to "Revisar" and activate via keyboard.
  const revisarBtn = page.getByRole('button', { name: /revisar/i })
  await revisarBtn.focus()
  await expect(revisarBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })

  const enviarBtn = page.getByRole('button', { name: /Enviar respostas/i })
  await enviarBtn.focus()
  await expect(enviarBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
    timeout: 20_000,
  })

  // DB truth: the keyboard-edited value is what submitted.
  const answer = (
    await serviceQuery<{ value: unknown }>(page, `answers?item_id=eq.${item.id}&select=value`)
  )[0]
  expect(answer.value).toBe('Ana Paula (CCIH)')
})

// ===========================================================================
// DV-6 — publish-time invalid-default rejection (HC080). The builder UI's
// derived option-prune (item-editor-dialog.tsx `effectiveDefaultValue`) makes
// an invalid CHOICE default (a code that no longer exists) unreachable via the
// UI alone within one edit session, so this is validated at the RPC layer
// directly, as the plan anticipates ("if not reachable via the UI, note it's
// covered by pgTAP" — it is, by supabase/tests/61_answer_model_v2.sql).
//
// REGRESSION FOUND: this also proves BUG-AMV2-001 — the friendly pt-BR
// message the RPC raises is NOT surfacing to the user. See PROGRESS.md bug log.
// ===========================================================================

test('DV-6 (HC080 RPC-level): publish rejects an invalid default_value with a descriptive pt-BR message at the RPC boundary', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const title = `HC080 ${SPEC_TAG} ${Date.now()}`
  const chefeToken = await getToken(page, 'chefe.ccih@test.local')

  const formId = '99990000-0000-0000-0000-0000000d0e01'
  const versionId = '99990000-0000-0000-0000-0000000d0e0a'
  const sectionId = '99990000-0000-0000-0000-0000000d0e0b'
  const itemId = '99990000-0000-0000-0000-0000000d0e0c'
  const CHEFE_UID = '00000000-0000-0000-0000-000000000002'
  const CCIH = 'a0000000-0000-0000-0000-0000000000a1'

  sql(
    `set session_replication_role = replica;` +
      `delete from forms where id = '${formId}';` +
      `insert into forms (id, commission_id, title, created_by) values ('${formId}','${CCIH}','${title}','${CHEFE_UID}');` +
      `insert into form_versions (id, form_id, version_number, status, created_by) values ('${versionId}','${formId}',1,'draft','${CHEFE_UID}');` +
      `insert into form_sections (id, form_version_id, position, is_default, title) values ('${sectionId}','${versionId}',0,true,null);` +
      // number item with a STRING default (type mismatch) -> HC080.
      `insert into form_items (id, form_version_id, section_id, position, item_type, question_key, label, required, default_value) ` +
      `values ('${itemId}','${versionId}','${sectionId}',0,'number','hc080_check','Contagem',false,'"não é número"'::jsonb);`,
  )

  const pub = await rpcAs(page, chefeToken, 'publish_form_version', { p_form_version_id: versionId })
  expect(pub.ok, 'publish must be REJECTED for an invalid default_value').toBeFalsy()
  expect(pub.status).toBe(400)
  const body = pub.json as { code?: string; message?: string }
  expect(body.code).toBe('HC080')
  // The pt-BR message names the offending question.
  expect(body.message).toMatch(/valor padrão.*Contagem.*inválido/i)

  sql(`set session_replication_role = replica; delete from forms where id = '${formId}';`)
})
