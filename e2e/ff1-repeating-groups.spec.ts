import { execSync } from 'node:child_process'
import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * FF-1 — Repeating Groups (ADR 0087, six PO rulings). Acceptance criteria
 * translated from the ADR's §Gate keystones + the lead's phase-gate brief:
 *
 *   FF1-1 (ruling 1): builder authors both container types; depth-1 cap — a
 *         child-mode "Adicionar pergunta ao grupo" menu never offers "Estrutura".
 *   FF1-2 (ruling 2): condition scoping — a repeating-group child is never
 *         offered as a top-level condition target and publish rejects an
 *         outside-in reference in pt-BR; a plain-group child IS a legal
 *         target; a same-instance sibling reference is legal.
 *   FF1-3 (wizard): add/remove/reorder instances; per-instance answer
 *         isolation; resume mid-fill.
 *   FF1-4 (ruling 3): a fully-empty instance is pruned at submit (not
 *         "incomplete"); unmet minInstances blocks with an "adicione ao
 *         menos N" message, never "campo obrigatório" into a blank row.
 *   FF1-5 (ruling 4): a required item hidden by its own condition never
 *         blocks submit, at top level AND per-instance (same child key,
 *         independent instances).
 *   FF1-6 (ruling 6): a plain `group` renders as a nested sub-section with
 *         NO instance chrome (contrast with `repeating_group`).
 *   FF1-7 (sign-off): a staff_admin counter-signing sees every instance's
 *         answers BY VALUE.
 *   FF1-8 (dashboard): repeating-group answers explode by child
 *         `question_key`; percentages stay sane (the BE-8 denominator fix).
 *   FF1-9 (keyboard-only, CLAUDE.md §8): one full pass over add/remove/
 *         reorder, reachable + labelled + visible focus.
 *
 * Hermetic: every form here is spec-owned (title carries SPEC_TAG), built via
 * the service role / real UI, and driven under real personas' JWTs for RPC
 * calls. Cleanup deletes by title pattern via docker exec
 * (session_replication_role=replica bypasses immutability guards). Run with
 * --workers=1 (mirrors form-model-normalization.spec.ts convention).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH (…002) — builder, signer, dashboard
 *   staff1.ccih@test.local  staff, CCIH       (…003) — respondent
 */

// NOT serial: each test below builds its own hermetic, uniquely-titled form
// and is independent — no shared mutable state across tests. Per the e2e
// prod-build-gate doc's own lesson (docs/testing/e2e-prod-build-gate.md
// recommendation #4), `mode: 'serial'` on an independent test group buys
// nothing but masking: one failure silently skips every test after it as
// "did not run" instead of reporting each on its own merits.
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
const SPEC_TAG = 'FF1-SPEC'
const ORG = 'rede-a'
const SLUG = 'ccih'

// ---------------------------------------------------------------------------
// Auth / RPC / DB-truth helpers (mirror form-model-normalization.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.context().clearCookies()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('E-mail').waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

/** A real JWT for a persona so RLS is evaluated under their identity. */
async function getToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password },
    },
  )
  expect(resp.ok(), `token for ${email}: ${await resp.text()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Service-role REST GET returning JSON rows (DB-truth assertions only). */
async function serviceQuery<T>(page: Page, path: string): Promise<T[]> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Call an RPC under a specific persona's JWT (RLS + gate as that user). */
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

/** Run SQL as postgres via docker exec — hermetic FIXTURE setup/cleanup only
 *  (never to test application behavior; RPCs under a real token do that). */
function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`,
    { encoding: 'utf8' },
  )
    .toString()
    .trim()
}

/** Delete every spec-owned form (by title tag) bypassing immutability guards. */
function purge() {
  sql(
    `set session_replication_role = replica; ` +
      `delete from forms where title like '%${SPEC_TAG}%';`,
  )
}

test.beforeAll(() => {
  purge()
})
test.afterAll(() => {
  purge()
})

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

async function createForm(page: Page, title: string): Promise<string> {
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/forms`)
  await page.getByRole('button', { name: 'Novo formulário' }).click()
  await page.getByLabel('Título do formulário').fill(title)
  await page.getByRole('button', { name: 'Criar formulário' }).click()
  await page.waitForURL(/\/manage\/forms\/[0-9a-f-]+$/, { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible({ timeout: 20_000 })
  const url = page.url()
  return url.slice(url.lastIndexOf('/') + 1)
}

/** Top-level "Adicionar bloco" menu (section scope). */
async function openAddBlock(page: Page, menuName: RegExp): Promise<Locator> {
  const trigger = page.getByRole('button', { name: 'Adicionar bloco' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: menuName }).click()
  return page.getByRole('dialog')
}

/** Nested "Adicionar pergunta ao grupo" menu, scoped to ONE container's own
 *  card (found by its unique label text) so multiple containers on the same
 *  form don't collide. */
function containerCard(page: Page, label: string): Locator {
  return page.locator('article').filter({ hasText: label }).first()
}

async function openChildAddBlock(
  page: Page,
  label: string,
  menuName: RegExp,
): Promise<Locator> {
  const card = containerCard(page, label)
  const trigger = card.getByRole('button', { name: 'Adicionar pergunta ao grupo' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: menuName }).click()
  return page.getByRole('dialog')
}

/** Top-level "Adicionar bloco", scoped to a specific SECTION card — needed
 *  once a form has more than one section (each has its own trigger). */
async function openChildAddBlockInSection(
  section: Locator,
  page: Page,
  menuName: RegExp,
): Promise<Locator> {
  const trigger = section.getByRole('button', { name: 'Adicionar bloco' })
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
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 40_000 })
}

/** Fill a CONTAINER add/edit dialog's shared fields (title, optional support
 *  text, and for a repeating group the min/max repetições). */
async function fillContainerDialog(
  dialog: Locator,
  opts: { title: string; support?: string; min?: string; max?: string },
) {
  await dialog.getByLabel('Título do grupo').fill(opts.title)
  if (opts.support) {
    await dialog.getByLabel(/Texto de apoio/).fill(opts.support)
  }
  if (opts.min !== undefined) {
    await dialog.getByLabel('Mínimo').fill(opts.min)
  }
  if (opts.max !== undefined) {
    await dialog.getByLabel('Máximo').fill(opts.max)
  }
}

/** Add a `multiple_choice` child/top-level question with N options. */
async function addMultipleChoice(
  dialog: Locator,
  question: string,
  options: string[],
) {
  await dialog.getByLabel('Enunciado da pergunta').fill(question)
  await dialog.getByLabel('Opção 1', { exact: true }).fill(options[0])
  for (let i = 1; i < options.length; i++) {
    await dialog.getByRole('button', { name: 'Adicionar opção' }).click()
    await dialog.getByLabel(`Opção ${i + 1}`, { exact: true }).fill(options[i])
  }
}

/** Add a `free_text` (long-answer) child/top-level question. */
async function addFreeText(dialog: Locator, question: string) {
  await dialog.getByLabel('Enunciado da pergunta').fill(question)
}

// ---------------------------------------------------------------------------
// ConditionBuilder helpers — targets are <option>s inside a sr-only-labelled
// <select> ("Pergunta controladora"), not plain visible text, so reading them
// requires enabling the toggle and reading the <select>'s options directly.
// ---------------------------------------------------------------------------

async function enableCondition(dialog: Locator) {
  // The visible text sits in the wrapping <label>, but the custom Checkbox is
  // a <button role="checkbox"> — native label-click delegation does not
  // forward to <button>, so target the checkbox role directly (its accessible
  // name comes from the enclosing label).
  const checkbox = dialog.getByRole('checkbox', { name: 'Aparência Condicional' })
  if ((await checkbox.getAttribute('aria-checked')) !== 'true') {
    await checkbox.click()
  }
}

// ConditionBuilder rows are located by their stable id SUFFIX
// (`${rowId}-target` / `-op` / `-value`, condition-builder.tsx), not by
// accessible label text: "Valor" collides (substring) with the unrelated
// "Valor padrão" default-value field earlier in the same column, AND Chrome's
// accname computation for a <select> nested in a <label> folds in the
// selected option's own text, so `getByLabel('Valor', { exact: true })` never
// matches plain "Valor" at all (verified live — non-exact matches, exact
// doesn't). The id-suffix selector sidesteps both problems.
function conditionTargetSelect(dialog: Locator): Locator {
  return dialog.locator('select[id$="-target"]').first()
}
function conditionValueSelect(dialog: Locator): Locator {
  return dialog.locator('select[id$="-value"]').first()
}

/** The eligible condition-target labels currently offered, in order. Enables
 *  the toggle first — the <select> doesn't exist in the DOM until it is on. */
async function conditionTargetLabels(dialog: Locator): Promise<string[]> {
  await enableCondition(dialog)
  const options = await conditionTargetSelect(dialog).locator('option').allTextContents()
  return options.filter((t) => t !== 'Selecione a pergunta…')
}

/** Enable + set a single-row `equals` condition: targetLabel = valueLabel. */
async function setQuestionCondition(
  dialog: Locator,
  targetLabel: string,
  valueLabel: string,
) {
  await enableCondition(dialog)
  await conditionTargetSelect(dialog).selectOption({ label: targetLabel })
  await conditionValueSelect(dialog).selectOption({ label: valueLabel })
}

// ---------------------------------------------------------------------------
// Wizard helpers
// ---------------------------------------------------------------------------

async function enterWizard(page: Page, formTitle: RegExp | string) {
  await page.goto(`/o/${ORG}/c/${SLUG}/forms`)
  const cardScope = page.locator('article').filter({ hasText: formTitle })
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

function responseIdFromUrl(page: Page): string {
  const m = page.url().match(/\/responder\/([0-9a-f-]{36})/)
  if (!m) throw new Error(`URL não é um wizard de resposta: ${page.url()}`)
  return m[1]
}

/** The repeating-group INSTANCE region (role=region, named "{label} {ordinal}"). */
function instanceRegion(page: Page, groupLabel: string, ordinal: string): Locator {
  return page.getByRole('region', { name: `${groupLabel} ${ordinal}` })
}

// A short explicit timeout on every instance-control click: as of BUG-FF1-001
// (`addGroupInstance`/`removeGroupInstance`/`reorderGroupInstances` in
// src/lib/responses/actions.ts are stubs that throw 'not implemented'), the
// button never re-enables and a default-timeout click would burn the whole
// test budget retrying. Fail fast instead so the suite stays cheap to re-run.
const INSTANCE_ACTION_TIMEOUT = 8_000

async function addInstance(page: Page) {
  await page
    .getByRole('button', { name: 'Adicionar repetição' })
    .click({ timeout: INSTANCE_ACTION_TIMEOUT })
}

async function removeInstanceByOrdinal(page: Page, ordinal: string) {
  await page
    .getByRole('button', { name: `Remover a repetição ${ordinal}` })
    .click({ timeout: INSTANCE_ACTION_TIMEOUT })
}

async function moveInstanceByOrdinal(
  page: Page,
  ordinal: string,
  direction: 'cima' | 'baixo',
) {
  await page
    .getByRole('button', {
      name: `Mover a repetição ${ordinal} para ${direction}`,
    })
    .click({ timeout: INSTANCE_ACTION_TIMEOUT })
}

async function goToReviewAndSubmit(page: Page) {
  await page.getByRole('button', { name: 'Revisar' }).click({ timeout: INSTANCE_ACTION_TIMEOUT })
  await page
    .getByRole('button', { name: /Enviar respostas/i })
    .click({ timeout: INSTANCE_ACTION_TIMEOUT })
}

// ---------------------------------------------------------------------------
// RPC-bypass fill helpers — BUG-FF1-001 (see below) means the wizard's own
// add/remove/reorder controls are entirely non-functional (the TS server
// actions wrapping the RPCs are stubs). The DB RPCs THEMSELVES are real and
// correct, so tests whose subject is the SERVER authority (rulings 3/4/6,
// sign-off, dashboard) call `add_group_instance` / `save_section_answers` /
// `submit_response` directly under the respondent's own token — same RLS,
// same evaluator, only routing around the one broken JS wrapper. Tests whose
// subject IS the wizard's UI controls (FF1-3, FF1-9) do not use these — they
// correctly fail while BUG-FF1-001 is open.
// ---------------------------------------------------------------------------

async function startResponseViaUi(page: Page, title: string): Promise<string> {
  await enterWizard(page, title)
  return responseIdFromUrl(page)
}

async function defaultSectionId(page: Page, formId: string): Promise<string> {
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  return (
    await serviceQuery<{ id: string }>(
      page,
      `form_sections?form_version_id=eq.${versionId}&select=id`,
    )
  )[0].id
}

async function addInstanceViaRpc(
  page: Page,
  token: string,
  responseId: string,
  groupItemId: string,
): Promise<string> {
  // The RPC returns the full response_group_instances row (table-typed
  // function), not a bare uuid.
  const resp = await rpcAs<{ id: string }>(page, token, 'add_group_instance', {
    p_response_id: responseId,
    p_group_item_id: groupItemId,
  })
  expect(resp.ok, `add_group_instance: ${resp.text}`).toBeTruthy()
  return resp.json.id
}

/** Save one instance's scalar (short_text/free_text) answers via the RPC. */
async function saveInstanceAnswersViaRpc(
  page: Page,
  token: string,
  responseId: string,
  sectionId: string,
  instanceId: string,
  answers: Record<string, string>,
) {
  const resp = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: sectionId,
    p_instance_answers: [{ instance_id: instanceId, answers }],
  })
  expect(resp.ok, `save_section_answers (instance): ${resp.text}`).toBeTruthy()
}

/** Save one instance's single-select choice answer (value = option CODE). */
async function saveInstanceSelectionViaRpc(
  page: Page,
  token: string,
  responseId: string,
  sectionId: string,
  instanceId: string,
  selections: Record<string, string>,
) {
  const resp = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: sectionId,
    p_instance_answers: [
      { instance_id: instanceId, selections: Object.fromEntries(
        Object.entries(selections).map(([itemId, code]) => [itemId, [code]]),
      ) },
    ],
  })
  expect(resp.ok, `save_section_answers (instance selection): ${resp.text}`).toBeTruthy()
}

async function submitViaRpc(
  page: Page,
  token: string,
  responseId: string,
): Promise<{ ok: boolean; text: string }> {
  const resp = await rpcAs<unknown>(page, token, 'submit_response', {
    p_response_id: responseId,
  })
  return { ok: resp.ok, text: resp.text }
}

// ===========================================================================
// FF1-1 — Builder: both container types, depth-1 cap, min/max cardinality
// ===========================================================================

test('FF1-1 (builder): authors group + repeating_group with children; depth cap hides "Estrutura" in child mode; cardinality persists', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Builder ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // --- Repeating group "Medicamento administrado", min 1 / max 3 -------------
  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, {
    title: 'Medicamento administrado',
    support: 'Um registro por medicamento administrado nesta visita.',
    min: '1',
    max: '3',
  })
  await submitAddDialog(rgDialog)
  await expect(page.getByText('Medicamento administrado', { exact: true })).toBeVisible()

  // Ruling 1 — depth cap: the nested "Adicionar pergunta ao grupo" menu must
  // NEVER offer "Estrutura" (a container inside a container is refused by the
  // schema itself; the builder must not even offer the trap).
  const rgCard = containerCard(page, 'Medicamento administrado')
  await rgCard.getByRole('button', { name: 'Adicionar pergunta ao grupo' }).click()
  await expect(page.getByRole('menuitem', { name: /Grupo repetível/ })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /^Grupo\b/ })).toHaveCount(0)
  await expect(page.getByText('Estrutura')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Add a child input (multiple_choice) inside the repeating group.
  const childDialog = await openChildAddBlock(
    page,
    'Medicamento administrado',
    /Múltipla escolha/,
  )
  await addMultipleChoice(childDialog, 'Nome do medicamento', ['Dipirona', 'Paracetamol'])
  await submitAddDialog(childDialog)
  await expect(page.getByText('Nome do medicamento')).toBeVisible()

  // --- Plain group "Dados do paciente" (no cardinality fields) ---------------
  const gDialog = await openAddBlock(page, /^Grupo Sub-seção/)
  await fillContainerDialog(gDialog, { title: 'Dados do paciente' })
  // A plain group's dialog must NOT offer "Repetições" (min/max) — it is a
  // pure visual container (ruling 6).
  await expect(gDialog.getByText('Repetições')).toHaveCount(0)
  await submitAddDialog(gDialog)
  await expect(page.getByText('Dados do paciente', { exact: true })).toBeVisible()

  const childDialog2 = await openChildAddBlock(page, 'Dados do paciente', /Resposta curta/)
  await addFreeText(childDialog2, 'Leito')
  await submitAddDialog(childDialog2)
  await expect(page.getByText('Leito')).toBeVisible()

  // --- DB truth: container types, parent_item_id, config cardinality ---------
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.draft&select=id`,
    )
  )[0].id
  type ItemRow = {
    id: string
    item_type: string
    label: string | null
    parent_item_id: string | null
    config: { minInstances?: number; maxInstances?: number } | null
  }
  const items = await serviceQuery<ItemRow>(
    page,
    `form_items?form_version_id=eq.${versionId}&select=id,item_type,label,parent_item_id,config&order=position.asc`,
  )
  const rg = items.find((i) => i.item_type === 'repeating_group')!
  const g = items.find((i) => i.item_type === 'group')!
  expect(rg, 'repeating_group persisted').toBeTruthy()
  expect(g, 'group persisted').toBeTruthy()
  expect(rg.config?.minInstances).toBe(1)
  expect(rg.config?.maxInstances).toBe(3)
  const rgChild = items.find((i) => i.label === 'Nome do medicamento')!
  const gChild = items.find((i) => i.label === 'Leito')!
  expect(rgChild.parent_item_id).toBe(rg.id)
  expect(gChild.parent_item_id).toBe(g.id)

  // Publishes cleanly (contiguous children, both container types legal).
  await publishForm(page)
})

// ===========================================================================
// FF1-2 — Ruling 2: condition scoping (outside-in forbidden, plain-group
// legal, same-instance sibling legal)
// ===========================================================================

test('FF1-2 (ruling 2): a repeating-group child is never a top-level condition target; publish rejects outside-in in pt-BR; plain-group children + same-instance siblings stay legal', async ({
  page,
}) => {
  test.setTimeout(200_000)
  const title = `CondScope ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // Repeating group with 2 children: a multiple_choice ("Tipo") and a
  // free_text ("Detalhe") that will condition on "Tipo" (same-instance sibling).
  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, { title: 'Verificação' })
  await submitAddDialog(rgDialog)

  const tipoDialog = await openChildAddBlock(page, 'Verificação', /Múltipla escolha/)
  await addMultipleChoice(tipoDialog, 'Tipo', ['Rotina', 'Excepcional'])
  await submitAddDialog(tipoDialog)

  // Same-instance sibling reference IS legal: "Detalhe" conditions on "Tipo".
  const detalheDialog = await openChildAddBlock(page, 'Verificação', /Resposta curta/)
  await detalheDialog.getByLabel('Enunciado da pergunta').fill('Detalhe')
  // The condition builder inside the child dialog must offer "Tipo" (the
  // earlier same-instance sibling).
  expect(await conditionTargetLabels(detalheDialog)).toContain('Tipo')
  await submitAddDialog(detalheDialog)

  // Plain group with 1 child "Setor" — its key stays an ordinary (unrestricted)
  // target since a plain group's children answer top-level (ruling 6).
  const gDialog = await openAddBlock(page, /^Grupo Sub-seção/)
  await fillContainerDialog(gDialog, { title: 'Local' })
  await submitAddDialog(gDialog)
  const setorDialog = await openChildAddBlock(page, 'Local', /Múltipla escolha/)
  await addMultipleChoice(setorDialog, 'Setor', ['UTI', 'Enfermaria'])
  await submitAddDialog(setorDialog)

  // --- Top-level question added AFTER both containers ------------------------
  // Its condition picker must offer "Setor" (plain-group child, legal) but
  // must NEVER offer "Tipo" (repeating-group child, outside-in forbidden).
  const topDialog = await openAddBlock(page, /Múltipla escolha/)
  await topDialog.getByLabel('Enunciado da pergunta').fill('Confirmação final')
  await topDialog.getByLabel('Opção 1', { exact: true }).fill('Sim')

  const topTargets = await conditionTargetLabels(topDialog)
  expect(topTargets, 'plain-group child is a legal target').toContain('Setor')
  expect(topTargets, 'repeating-group child must NEVER be offered').not.toContain('Tipo')
  await submitAddDialog(topDialog)

  // --- DB truth + publish (should succeed: no outside-in condition authored) -
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.draft&select=id`,
    )
  )[0].id
  type ItemRow = {
    id: string
    label: string | null
    question_key: string | null
    visible_when: unknown
  }
  const items = await serviceQuery<ItemRow>(
    page,
    `form_items?form_version_id=eq.${versionId}&select=id,label,question_key,visible_when`,
  )
  const tipoItem = items.find((i) => i.label === 'Tipo')!
  const finalItem = items.find((i) => i.label === 'Confirmação final')!
  expect(tipoItem.question_key).toBeTruthy()
  // The picker never offered "Tipo" as a target (asserted above via
  // conditionTargetLabels), so the author could never have built a condition
  // on it — confirm that held all the way to the DB, not just in the UI: no
  // condition was authored on "Confirmação final" at all.
  expect(finalItem.visible_when, '"Confirmação final" must carry no condition').toBeNull()

  await publishForm(page)

  // --- Now prove the SERVER authority independently: inject an outside-in
  // condition directly (bypassing the UI, which never offers it) on a NEW
  // draft, and confirm publish_form_version rejects it in pt-BR. Cloning the
  // published version gives us an editable draft with the same items.
  const publishedVersionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const token = await getToken(page, 'chefe.ccih@test.local')
  const cloneResp = await rpcAs<string>(page, token, 'clone_form_version', {
    p_source_version_id: publishedVersionId,
  })
  expect(cloneResp.ok, `clone_form_version: ${cloneResp.text}`).toBeTruthy()
  const draftVersionId = cloneResp.json as unknown as string

  const draftItems = await serviceQuery<ItemRow>(
    page,
    `form_items?form_version_id=eq.${draftVersionId}&select=id,label,question_key`,
  )
  const draftFinal = draftItems.find((i) => i.label === 'Confirmação final')!
  const draftTipo = draftItems.find((i) => i.label === 'Tipo')!

  sql(
    `update form_items set visible_when = '{"match":"all","conditions":[{"question_key":"${draftTipo.question_key}","op":"equals","value":"x"}]}'::jsonb ` +
      `where id = '${draftFinal.id}';`,
  )

  const publishResp = await rpcAs<unknown>(page, token, 'publish_form_version', {
    p_form_version_id: draftVersionId,
  })
  expect(publishResp.ok, 'outside-in condition must be REJECTED, not accepted').toBeFalsy()
  expect(publishResp.text).toMatch(/dentro de um bloco repetível/)
})

// ===========================================================================
// FF1-3 — Wizard: add/remove/reorder instances, per-instance isolation, resume
// ===========================================================================

test('FF1-3 (wizard): add/remove/reorder repetitions; per-instance answers stay isolated; resume mid-fill', async ({
  page,
}) => {
  test.setTimeout(220_000)
  const title = `Fill ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, { title: 'Turno de plantão' })
  await submitAddDialog(rgDialog)
  const turnoDialog = await openChildAddBlock(page, 'Turno de plantão', /Múltipla escolha/)
  await addMultipleChoice(turnoDialog, 'Turno', ['Manhã', 'Tarde'])
  await submitAddDialog(turnoDialog)
  const obsDialog = await openChildAddBlock(page, 'Turno de plantão', /Resposta curta/)
  await addFreeText(obsDialog, 'Observação')
  await submitAddDialog(obsDialog)
  await publishForm(page)

  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // --- Add 2 instances, fill DISTINCT answers in each -------------------------
  await addInstance(page)
  await addInstance(page)
  const inst1 = instanceRegion(page, 'Turno de plantão', '1 de 2')
  const inst2 = instanceRegion(page, 'Turno de plantão', '2 de 2')
  await expect(inst1).toBeVisible()
  await expect(inst2).toBeVisible()

  // --- BUG-FF1-004: every control id in input-item.tsx is built purely from
  // the QUESTION's static `item.id` — `useFieldIds(`item-${item.id}`, ...)`
  // for text/number/date/time, `item-${item.id}-opt-${i}` for choice options
  // — with NO instance scoping. Inside a repeating group the SAME question
  // renders once PER INSTANCE, so this mints the SAME `id` (and the label's
  // matching `for=`) once per instance: a live, duplicate-id violation.
  // `document.getElementById`/label-`for` resolution always returns the
  // FIRST DOM match, so instance 1 accidentally resolves fine (it happens to
  // be first) while every instance after it is unreachable by accessible
  // name — this is why the queries below use `.nth(index)` / role-only
  // (unfiltered by name) rather than `{ name: 'Tarde' }`. Demonstrated two
  // ways, soft (the rest of this test still needs to run to cover the
  // ISOLATION claim, a distinct claim from this labelling defect):
  const inst2TardeRadio = inst2.locator('input[type="radio"]').nth(1)
  const duplicateId = await inst2TardeRadio.getAttribute('id')
  expect
    .soft(
      duplicateId ? await page.locator(`#${duplicateId}`).count() : -1,
      'BUG-FF1-004: option/field ids are not instance-scoped (input-item.tsx builds them from `item.id` alone) — the same id renders once per repeating-group instance, a duplicate-id violation. A real user clicking instance 2+\'s visible label can toggle instance 1\'s control instead (label `for=` resolves to the FIRST DOM match).',
    )
    .toBe(1)
  await expect
    .soft(
      inst2.getByRole('radio', { name: 'Tarde' }),
      'BUG-FF1-004 consequence: instance 2\'s "Tarde" radio is unreachable by accessible name (screen-reader users cannot identify any instance-2+ control by its label).',
    )
    .toBeVisible({ timeout: 2_000 })

  // Fill via POSITION (input[type=radio] .nth) / role-ONLY (no name filter,
  // exactly one textbox per instance) — this still validates per-instance
  // answer ISOLATION at the state/DB level, a claim distinct from the
  // labelling defect just flagged. A sighted mouse user clicking by visual
  // position gets this; a screen-reader / accessible-name-driven user does
  // not (that gap is BUG-FF1-004 above).
  await inst1.locator('input[type="radio"]').nth(0).click() // Manhã
  await inst1.getByRole('textbox').fill('Nota da repetição UM')
  await inst2.locator('input[type="radio"]').nth(1).click() // Tarde
  await inst2.getByRole('textbox').fill('Nota da repetição DOIS')

  // Isolation, live in the DOM: instance 1 shows only its own answers.
  await expect(inst1.locator('input[type="radio"]').nth(0)).toBeChecked() // Manhã
  await expect(inst1.locator('input[type="radio"]').nth(1)).not.toBeChecked() // Tarde
  await expect(inst2.locator('input[type="radio"]').nth(1)).toBeChecked() // Tarde
  await expect(inst2.locator('input[type="radio"]').nth(0)).not.toBeChecked() // Manhã

  // Persist via "Salvar e sair", then resume.
  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await page.waitForURL((u: URL) => !u.pathname.includes('/responder/'), { timeout: 15_000 })

  await enterWizard(page, title)
  expect(responseIdFromUrl(page)).toBe(responseId)
  const inst1r = instanceRegion(page, 'Turno de plantão', '1 de 2')
  const inst2r = instanceRegion(page, 'Turno de plantão', '2 de 2')
  await expect(inst1r.locator('input[type="radio"]').nth(0)).toBeChecked() // Manhã
  await expect(inst1r.getByRole('textbox')).toHaveValue('Nota da repetição UM')
  await expect(inst2r.locator('input[type="radio"]').nth(1)).toBeChecked() // Tarde
  await expect(inst2r.getByRole('textbox')).toHaveValue('Nota da repetição DOIS')

  // --- DB truth: two response_group_instances rows, answers scoped per-instance
  type RGI = { id: string; position: number }
  const rgiBefore = await serviceQuery<RGI>(
    page,
    `response_group_instances?response_id=eq.${responseId}&select=id,position&order=position.asc`,
  )
  expect(rgiBefore).toHaveLength(2)

  // --- Reorder: move instance 2 up -------------------------------------------
  await moveInstanceByOrdinal(page, '2 de 2', 'cima')
  // After the swap, the DOI note is now in position "1 de 2".
  const swapped1 = instanceRegion(page, 'Turno de plantão', '1 de 2')
  await expect(swapped1.getByRole('textbox')).toHaveValue('Nota da repetição DOIS')

  const rgiAfterReorder = await serviceQuery<RGI>(
    page,
    `response_group_instances?response_id=eq.${responseId}&select=id,position&order=position.asc`,
  )
  // Same two ids, positions swapped.
  expect(new Set(rgiAfterReorder.map((r) => r.id))).toEqual(
    new Set(rgiBefore.map((r) => r.id)),
  )
  expect(rgiAfterReorder[0].id).toBe(rgiBefore[1].id)

  // --- Remove one instance -----------------------------------------------------
  await removeInstanceByOrdinal(page, '2 de 2')
  await expect(page.getByRole('region', { name: /Turno de plantão 2 de/ })).toHaveCount(0)
  const rgiAfterRemove = await serviceQuery<RGI>(
    page,
    `response_group_instances?response_id=eq.${responseId}&select=id`,
  )
  expect(rgiAfterRemove).toHaveLength(1)

  // --- Submit via the REAL wizard UI — ADR 0087 §Gate's own E2E line is
  // "add/remove/reorder → resume → submit → explode aggregation"; stopping at
  // remove leaves "submit" unexercised through the actual submit button/review
  // screen (the RPC-bypass tests elsewhere in this file verify the SERVER
  // authority directly, which is a different claim from "the wizard's own
  // Revisar/Enviar respostas buttons work end-to-end"). Nothing here blocks
  // client-side validation (no min/max on this group, nothing required), so
  // the real "Revisar" → "Enviar respostas" path is reachable. -------------
  await goToReviewAndSubmit(page)
  await expect(page.getByText(/enviada|sucesso/i).first()).toBeVisible({ timeout: 20_000 })

  // --- DB truth: the SURVIVING instance's answers are the DOIS/Tarde ones
  // (not the removed UM/Manhã ones) — cross-checks the UI's `toHaveValue`
  // claims above against the actual persisted `answers` rows, the same
  // belt-and-suspenders discipline every other test in this file applies to
  // its core claim. -----------------------------------------------------
  const publishedVersionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  type ItemRow2 = { id: string; label: string | null }
  const finalItems = await serviceQuery<ItemRow2>(
    page,
    `form_items?form_version_id=eq.${publishedVersionId}&select=id,label`,
  )
  const turnoItemId = finalItems.find((i) => i.label === 'Turno')!.id
  const obsItemId = finalItems.find((i) => i.label === 'Observação')!.id
  const tardeCode = (
    await serviceQuery<{ code: string }>(
      page,
      `form_item_options?item_id=eq.${turnoItemId}&label=eq.Tarde&select=code`,
    )
  )[0].code

  const survivorId = rgiAfterRemove[0].id
  type AnswerRow = { item_id: string; value: unknown }
  const finalAnswers = await serviceQuery<AnswerRow>(
    page,
    `answers?response_id=eq.${responseId}&group_instance_id=eq.${survivorId}&select=item_id,value`,
  )
  const obsAnswer = finalAnswers.find((a) => a.item_id === obsItemId)
  const turnoAnswer = finalAnswers.find((a) => a.item_id === turnoItemId)
  expect(obsAnswer?.value).toBe('Nota da repetição DOIS')
  expect(turnoAnswer?.value).toBe(tardeCode)
})

// ===========================================================================
// FF1-4 — Ruling 3: empty-instance pruning + minInstances after pruning
// ===========================================================================

test('FF1-4 (ruling 3): a fully-empty instance is pruned (not incomplete); unmet minInstances blocks with "adicione ao menos", never "campo obrigatório"', async ({
  page,
}) => {
  test.setTimeout(220_000)
  const title = `Prune ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, { title: 'Ocorrência', min: '1' })
  await submitAddDialog(rgDialog)
  const descDialog = await openChildAddBlock(page, 'Ocorrência', /Resposta curta/)
  await addFreeText(descDialog, 'Descrição')
  await submitAddDialog(descDialog)
  await publishForm(page)

  const sectionId = await defaultSectionId(page, formId)
  type ItemRow = { id: string; item_type: string; label: string | null }
  const publishedVersionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const items = await serviceQuery<ItemRow>(
    page,
    `form_items?form_version_id=eq.${publishedVersionId}&select=id,item_type,label`,
  )
  const groupItemId = items.find((i) => i.item_type === 'repeating_group')!.id
  const descItemId = items.find((i) => i.label === 'Descrição')!.id

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')

  // --- Side A: minInstances=1, ZERO instances → the wizard hint reads
  // "adicione ao menos" (never "campo obrigatório"); the server AUTHORITY
  // (`submit_response`) independently rejects with the same intent. BUG-FF1-001
  // (below) means the wizard's own "Adicionar repetição" is non-functional, so
  // the add/fill steps route around it via direct RPC calls — same RLS, same
  // evaluator, only the broken JS wrapper is bypassed. -----------------------
  const responseId = await startResponseViaUi(page, title)
  await expect(page.getByText(/Adicione ao menos mais 1 repetição preenchida\./)).toBeVisible()

  const rejectA = await submitViaRpc(page, token, responseId)
  expect(rejectA.ok, 'zero instances against minInstances=1 must be REJECTED').toBeFalsy()
  expect(rejectA.text).toMatch(/exige ao menos 1 item/)
  expect(rejectA.text).not.toMatch(/há perguntas obrigatórias sem resposta/)

  // --- Side B: one filled instance + one left ENTIRELY blank → submit
  // succeeds; the blank instance is pruned server-side, not counted. --------
  const filledId = await addInstanceViaRpc(page, token, responseId, groupItemId)
  await saveInstanceAnswersViaRpc(page, token, responseId, sectionId, filledId, {
    [descItemId]: 'Queda de paciente leito 4',
  })
  await addInstanceViaRpc(page, token, responseId, groupItemId) // blank, on purpose

  const rgiBefore = await serviceQuery<{ id: string }>(
    page,
    `response_group_instances?response_id=eq.${responseId}&select=id`,
  )
  expect(rgiBefore, 'two instances exist pre-submit').toHaveLength(2)

  const submitB = await submitViaRpc(page, token, responseId)
  expect(submitB.ok, `submit must succeed once minInstances is met by the survivor: ${submitB.text}`).toBeTruthy()

  const rgiAfter = await serviceQuery<{ id: string }>(
    page,
    `response_group_instances?response_id=eq.${responseId}&select=id`,
  )
  expect(rgiAfter, 'the empty instance is pruned at submit — only the filled one survives').toHaveLength(1)
  expect(rgiAfter[0].id).toBe(filledId)

  type Resp = { status: string }
  const resp = (
    await serviceQuery<Resp>(page, `responses?id=eq.${responseId}&select=status`)
  )[0]
  expect(resp.status).toBe('submitted')
})

// ===========================================================================
// FF1-5 — Ruling 4: conditional + required, at top level AND per-instance
// ===========================================================================

test('FF1-5 (ruling 4): a required item hidden by its own condition never blocks submit — top level and per-instance', async ({
  page,
}) => {
  test.setTimeout(220_000)
  const title = `CondReq ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // --- Top-level: "Houve intercorrência?" (Sim/Não) gates a REQUIRED "Qual?" -
  const gateDialog = await openAddBlock(page, /Múltipla escolha/)
  await addMultipleChoice(gateDialog, 'Houve intercorrência?', ['Sim', 'Não'])
  await submitAddDialog(gateDialog)

  const condDialog = await openAddBlock(page, /Resposta curta/)
  await condDialog.getByLabel('Enunciado da pergunta').fill('Qual intercorrência?')
  await setQuestionCondition(condDialog, 'Houve intercorrência?', 'Sim')
  await condDialog.getByLabel('Resposta obrigatória').check()
  await submitAddDialog(condDialog)

  // --- Repeating group: same pattern, per-instance ---------------------------
  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, { title: 'Medicação' })
  await submitAddDialog(rgDialog)
  const usouDialog = await openChildAddBlock(page, 'Medicação', /Múltipla escolha/)
  await addMultipleChoice(usouDialog, 'Usou antibiótico?', ['Sim', 'Não'])
  await submitAddDialog(usouDialog)

  const qualDialog = await openChildAddBlock(page, 'Medicação', /Resposta curta/)
  await qualDialog.getByLabel('Enunciado da pergunta').fill('Qual antibiótico?')
  await setQuestionCondition(qualDialog, 'Usou antibiótico?', 'Sim')
  await qualDialog.getByLabel('Resposta obrigatória').check()
  await submitAddDialog(qualDialog)

  await publishForm(page)

  // --- Fixture ids (published version) ----------------------------------------
  const sectionId = await defaultSectionId(page, formId)
  const publishedVersionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  type ItemRow = { id: string; item_type: string; label: string | null }
  const allItems = await serviceQuery<ItemRow>(
    page,
    `form_items?form_version_id=eq.${publishedVersionId}&select=id,item_type,label`,
  )
  const gateId = allItems.find((i) => i.label === 'Houve intercorrência?')!.id
  const groupItemId = allItems.find((i) => i.item_type === 'repeating_group')!.id
  const usouId = allItems.find((i) => i.label === 'Usou antibiótico?')!.id
  const qualAntibioticoId = allItems.find((i) => i.label === 'Qual antibiótico?')!.id
  const qualIntercorrenciaId = allItems.find((i) => i.label === 'Qual intercorrência?')!.id

  // --- BUG-FF1-002 (below): the builder's own save path silently drops
  // "obrigatória" whenever a condition is present — `parseItemFields` in
  // src/lib/forms/actions.ts unconditionally clears `required` when
  // `visible_when` is set (stale pre-FF-1 defence for the CHECK constraint
  // ruling 4 already drops). Both items above were built with "Resposta
  // obrigatória" checked; DB truth shows it never landed. -------------------
  type ReqRow = { id: string; required: boolean }
  const reqRows = await serviceQuery<ReqRow>(
    page,
    `form_items?id=in.(${qualIntercorrenciaId},${qualAntibioticoId})&select=id,required`,
  )
  const requiredSurvived = reqRows.every((r) => r.required === true)
  // Soft: flags BUG-FF1-002 (this test correctly ends RED) while still
  // letting the rest of the test verify the completeness AUTHORITY below,
  // via the SQL repair — see the block's own comment.
  expect
    .soft(
      requiredSurvived,
      'BUG-FF1-002: parseItemFields (src/lib/forms/actions.ts) clears `required` whenever `visible_when` is set — "obrigatória" beside a condition is silently discarded on save, for both top-level items and repeating-group children.',
    )
    .toBeTruthy()
  if (!requiredSurvived) {
    // Route around the broken authoring layer so the REST of this test can
    // still validate the completeness AUTHORITY (submit_response /
    // response_required_complete) that ruling 4 is actually about — BE-5's
    // pgTAP claims that logic is correct; this isolates the two claims.
    // published-version items are immutable (guard_published_structure);
    // bypass for this diagnostic repair only, same technique as purge().
    sql(
      `set session_replication_role = replica; ` +
        `update form_items set required = true where id in ` +
        `('${qualIntercorrenciaId}','${qualAntibioticoId}'); ` +
        `set session_replication_role = default;`,
    )
  }

  type OptRow = { item_id: string; code: string; label: string }
  const opts = await serviceQuery<OptRow>(
    page,
    `form_item_options?item_id=in.(${gateId},${usouId})&select=item_id,code,label`,
  )
  const codeFor = (itemId: string, label: string) =>
    opts.find((o) => o.item_id === itemId && o.label === label)!.code

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')

  // BUG-FF1-001 (below) means the wizard's own instance controls are
  // non-functional — the fill routes around it via direct RPC calls (same
  // RLS, same evaluator as the wizard would use).
  const responseId = await startResponseViaUi(page, title)

  // Top level: gate = "Não" → "Qual intercorrência?" hidden, never blocks.
  const topResp = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: sectionId,
    p_selections: { [gateId]: [codeFor(gateId, 'Não')] },
  })
  expect(topResp.ok, `top-level gate save: ${topResp.text}`).toBeTruthy()

  // Repeating group: instance 1 = "Não" (hidden, satisfied); instance 2 =
  // "Sim" but leave "Qual antibiótico?" BLANK (visible + required → blocks).
  const inst1Id = await addInstanceViaRpc(page, token, responseId, groupItemId)
  const inst2Id = await addInstanceViaRpc(page, token, responseId, groupItemId)
  await saveInstanceSelectionViaRpc(page, token, responseId, sectionId, inst1Id, {
    [usouId]: codeFor(usouId, 'Não'),
  })
  await saveInstanceSelectionViaRpc(page, token, responseId, sectionId, inst2Id, {
    [usouId]: codeFor(usouId, 'Sim'),
  })

  // Reload the wizard fresh — proves the READ side renders per-instance
  // conditional visibility correctly (independent of BUG-FF1-001, which only
  // breaks the WRITE side / instance controls).
  await page.goto(`/o/${ORG}/c/${SLUG}/forms/${formId}/responder/${responseId}`)
  const inst1 = instanceRegion(page, 'Medicação', '1 de 2')
  const inst2 = instanceRegion(page, 'Medicação', '2 de 2')
  await expect(inst1).toBeVisible({ timeout: 15_000 })
  await expect(inst1.getByText('Qual antibiótico?')).toHaveCount(0)
  await expect(inst2.getByText('Qual antibiótico?')).toBeVisible()

  // Blocked: instance 2's required-but-visible child is unanswered.
  const rejectFF15 = await submitViaRpc(page, token, responseId)
  expect(rejectFF15.ok, 'instance 2 visible+required+blank must block submit').toBeFalsy()
  expect(rejectFF15.text).toMatch(/há perguntas obrigatórias sem resposta/)

  // Fix instance 2, and hide instance 1's requirement stays satisfied
  // (sibling-instance-absent never falls back) → submit succeeds.
  await saveInstanceAnswersViaRpc(page, token, responseId, sectionId, inst2Id, {
    [qualAntibioticoId]: 'Amoxicilina',
  })
  const submitFF15 = await submitViaRpc(page, token, responseId)
  expect(submitFF15.ok, `expected success: ${submitFF15.text}`).toBeTruthy()
})

// ===========================================================================
// FF1-6 — Ruling 6: plain `group` renders with NO instance chrome
// ===========================================================================

test('FF1-6 (ruling 6): a plain group renders as a nested sub-section with no add/remove/reorder controls', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `PlainGroup ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)

  const gDialog = await openAddBlock(page, /^Grupo Sub-seção/)
  await fillContainerDialog(gDialog, { title: 'Identificação' })
  await submitAddDialog(gDialog)
  const nomeDialog = await openChildAddBlock(page, 'Identificação', /Resposta curta/)
  await addFreeText(nomeDialog, 'Nome completo')
  await submitAddDialog(nomeDialog)
  await publishForm(page)

  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)

  const region = page.getByRole('region', { name: 'Identificação' })
  await expect(region).toBeVisible()
  await expect(region.getByRole('textbox', { name: 'Nome completo' })).toBeVisible()
  // No instance chrome anywhere: no add/remove/reorder affordances.
  await expect(page.getByRole('button', { name: 'Adicionar repetição' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Remover a repetição/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Mover a repetição/ })).toHaveCount(0)
})

// ===========================================================================
// FF1-7 — Sign-off: every instance's answers visible BY VALUE
// ===========================================================================

test('FF1-7 (sign-off): a staff_admin counter-signing sees every repeating-group instance answer by value', async ({
  page,
}) => {
  test.setTimeout(220_000)
  const title = `Signoff ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // A default section can NEVER require sign-off (form_sections_default_shape:
  // `NOT is_default OR (visible_when IS NULL AND requires_signoff = false)`),
  // so the group goes in a second, NAMED section built via the real UI —
  // orthogonal, pre-existing sign-off machinery; not what FF-1 is testing.
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  const section2 = page.locator('section, article').filter({ hasText: 'Seção sem título' }).first()
  await section2.getByRole('button', { name: 'Renomear seção' }).click()
  const renameDialog = page.getByRole('dialog')
  await renameDialog.getByLabel('Título da seção').fill('Verificação em campo')
  await renameDialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(renameDialog).toBeHidden({ timeout: 15_000 })

  const namedSection = page.locator('section, article').filter({ hasText: 'Verificação em campo' }).first()
  const rgDialog = await openChildAddBlockInSection(namedSection, page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, { title: 'Item verificado' })
  await submitAddDialog(rgDialog)
  const obsDialog = await openChildAddBlock(page, 'Item verificado', /Resposta curta/)
  await addFreeText(obsDialog, 'Observação')
  await submitAddDialog(obsDialog)

  await namedSection.getByRole('button', { name: 'Configurações da seção (condição e assinatura)' }).click()
  const settingsDialog = page.getByRole('dialog')
  await settingsDialog.getByRole('checkbox', { name: 'Exigir assinatura para concluir esta seção' }).click()
  await settingsDialog.getByLabel('Quem assina').selectOption({ label: 'Coordenação da comissão' })
  await settingsDialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(settingsDialog).toBeHidden({ timeout: 15_000 })

  await publishForm(page)

  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const sectionId = (
    await serviceQuery<{ id: string; requires_signoff: boolean; signoff_role: string | null }>(
      page,
      `form_sections?form_version_id=eq.${versionId}&is_default=eq.false&select=id,requires_signoff,signoff_role`,
    )
  )[0].id

  type ItemRow = { id: string; item_type: string; label: string | null }
  const items = await serviceQuery<ItemRow>(
    page,
    `form_items?form_version_id=eq.${versionId}&select=id,item_type,label`,
  )
  const groupItemId = items.find((i) => i.item_type === 'repeating_group')!.id
  const obsItemId = items.find((i) => i.label === 'Observação')!.id

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')
  // BUG-FF1-001 (below): the wizard's own instance controls are
  // non-functional, so the fill routes around it via direct RPC calls.
  const responseId = await startResponseViaUi(page, title)
  const inst1Id = await addInstanceViaRpc(page, token, responseId, groupItemId)
  const inst2Id = await addInstanceViaRpc(page, token, responseId, groupItemId)
  await saveInstanceAnswersViaRpc(page, token, responseId, sectionId, inst1Id, {
    [obsItemId]: 'Nota da repetição UM (ff1-sign)',
  })
  await saveInstanceAnswersViaRpc(page, token, responseId, sectionId, inst2Id, {
    [obsItemId]: 'Nota da repetição DOIS (ff1-sign)',
  })
  // NOT submitted: `ResponseForSignoff` / the review-and-sign screen is for a
  // staff_admin counter-signing a response that is still `in_progress` (the
  // sign-off queue's own doc comment) — `submit_response` itself refuses to
  // finalize while a required staff_admin section is unsigned (HC012 "há
  // seções pendentes de assinatura"), so signing necessarily happens first.

  // --- The staff_admin opens the review-and-sign screen. Both instance
  // values must be VISIBLE BY VALUE — not merely "no error rendering". ------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/assinaturas/${responseId}`)

  await expect(page.getByText('Nota da repetição UM (ff1-sign)')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Nota da repetição DOIS (ff1-sign)')).toBeVisible()
})

// ===========================================================================
// FF1-8 — Dashboard: explode by child question_key, sane per-instance %
// ===========================================================================

test('FF1-8 (dashboard): repeating-group answers explode by child question_key with sane per-instance percentages', async ({
  page,
}) => {
  test.setTimeout(220_000)
  const title = `Dash ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, { title: 'Verificação' })
  await submitAddDialog(rgDialog)
  const resultDialog = await openChildAddBlock(page, 'Verificação', /Múltipla escolha/)
  await addMultipleChoice(resultDialog, 'Resultado', ['Conforme', 'Não conforme'])
  await submitAddDialog(resultDialog)
  await publishForm(page)

  const sectionId = await defaultSectionId(page, formId)
  const publishedVersionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  type ItemRow = { id: string; item_type: string; label: string | null }
  const items = await serviceQuery<ItemRow>(
    page,
    `form_items?form_version_id=eq.${publishedVersionId}&select=id,item_type,label`,
  )
  const groupItemId = items.find((i) => i.item_type === 'repeating_group')!.id
  const resultItemId = items.find((i) => i.label === 'Resultado')!.id
  type OptRow = { code: string; label: string }
  const opts = await serviceQuery<OptRow>(
    page,
    `form_item_options?item_id=eq.${resultItemId}&select=code,label`,
  )
  const codeFor = (label: string) => opts.find((o) => o.label === label)!.code

  // ONE response, 3 instances: Conforme, Conforme, Não conforme. BUG-FF1-001
  // (below) means the wizard's own instance controls are non-functional, so
  // the fill routes around it via direct RPC calls.
  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')
  const responseId = await startResponseViaUi(page, title)
  const inst1Id = await addInstanceViaRpc(page, token, responseId, groupItemId)
  const inst2Id = await addInstanceViaRpc(page, token, responseId, groupItemId)
  const inst3Id = await addInstanceViaRpc(page, token, responseId, groupItemId)
  await saveInstanceSelectionViaRpc(page, token, responseId, sectionId, inst1Id, {
    [resultItemId]: codeFor('Conforme'),
  })
  await saveInstanceSelectionViaRpc(page, token, responseId, sectionId, inst2Id, {
    [resultItemId]: codeFor('Conforme'),
  })
  await saveInstanceSelectionViaRpc(page, token, responseId, sectionId, inst3Id, {
    [resultItemId]: codeFor('Não conforme'),
  })
  const submitResp = await submitViaRpc(page, token, responseId)
  expect(submitResp.ok, `submit: ${submitResp.text}`).toBeTruthy()

  // --- Dashboard: assert VALUES, not mere rendering ---------------------------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/dashboard?form=${formId}`)

  const card = page.locator('article').filter({ hasText: 'Resultado' })
  await expect(card).toBeVisible({ timeout: 20_000 })

  const rows = card.locator('tbody tr')
  await expect(rows).toHaveCount(2)

  const conformeRow = rows.filter({ hasText: 'Conforme' }).filter({ hasNotText: 'Não conforme' })
  const naoConformeRow = rows.filter({ hasText: 'Não conforme' })

  // 3 instances total exist for this group in scope → denominator = 3
  // (the BE-8 fix: instances, not responses). 2 Conforme / 1 Não conforme.
  await expect(conformeRow).toContainText('2')
  await expect(conformeRow).toContainText('67%')
  await expect(naoConformeRow).toContainText('1')
  await expect(naoConformeRow).toContainText('33%')

  // Sanity bound regardless of exact rounding: no share may exceed 100% (the
  // pre-fix defect: 3 instances in 1 response produced a 300% share).
  const cardText = (await card.innerText())
  const percents = [...cardText.matchAll(/(\d+)%/g)].map((m) => Number(m[1]))
  expect(percents.length).toBeGreaterThan(0)
  for (const p of percents) expect(p).toBeLessThanOrEqual(100)
})

// ===========================================================================
// FF1-9 — Keyboard-only (CLAUDE.md §8): add/remove/reorder instances
// ===========================================================================

test('FF1-9 (keyboard-only): add, reorder and remove repetitions entirely via keyboard, with visible focus', async ({
  page,
}) => {
  test.setTimeout(200_000)
  const title = `Keyboard ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)

  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await fillContainerDialog(rgDialog, { title: 'Vistoria' })
  await submitAddDialog(rgDialog)
  const notaDialog = await openChildAddBlock(page, 'Vistoria', /Resposta curta/)
  await addFreeText(notaDialog, 'Nota')
  await submitAddDialog(notaDialog)
  await publishForm(page)

  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)

  // Add repetition #1 via keyboard (focus + Enter — the established
  // keyboard-only convention in this suite, e.g. NORM-4).
  const addBtn = page.getByRole('button', { name: 'Adicionar repetição' })
  await addBtn.focus()
  await expect(addBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(instanceRegion(page, 'Vistoria', '1 de 1')).toBeVisible()

  // Add repetition #2, then Tab from the add button into the new instance's
  // own field and type — proves the whole surface is keyboard-reachable, not
  // just the add button.
  await addBtn.focus()
  await page.keyboard.press('Enter')
  await expect(instanceRegion(page, 'Vistoria', '2 de 2')).toBeVisible()

  // BUG-FF1-004 (see FF1-3 for the full write-up): input-item.tsx builds every
  // control's id/label purely from the QUESTION's static item.id, with no
  // instance scoping, so accessible-name lookups only ever resolve to the
  // FIRST instance. Exactly one textbox per instance here, so an unfiltered
  // role query still reaches instance 2's own field — but a real screen-reader
  // user relying on the ANNOUNCED label cannot tell it apart from instance 1's,
  // which is precisely the "labelled" half of this test's own acceptance bar.
  const nota2 = instanceRegion(page, 'Vistoria', '2 de 2').getByRole('textbox')
  await expect
    .soft(
      instanceRegion(page, 'Vistoria', '2 de 2').getByRole('textbox', { name: 'Nota' }),
      "BUG-FF1-004: instance 2's \"Nota\" field is unreachable by its accessible name (duplicate id/label — see FF1-3).",
    )
    .toBeVisible({ timeout: 2_000 })
  await nota2.focus()
  await expect(nota2).toBeFocused()
  await page.keyboard.type('Preenchido via teclado')
  await expect(nota2).toHaveValue('Preenchido via teclado')

  // Reorder instance 2 up via keyboard (focus its labelled move button, Enter).
  const moveUp2 = page.getByRole('button', { name: 'Mover a repetição 2 de 2 para cima' })
  await moveUp2.focus()
  await expect(moveUp2).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    instanceRegion(page, 'Vistoria', '1 de 2').getByRole('textbox'),
  ).toHaveValue('Preenchido via teclado')

  // Remove that (now first) repetition via keyboard.
  const remove1 = page.getByRole('button', { name: 'Remover a repetição 1 de 2' })
  await remove1.focus()
  await expect(remove1).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(instanceRegion(page, 'Vistoria', '1 de 1')).toBeVisible()
  await expect(
    instanceRegion(page, 'Vistoria', '1 de 1').getByRole('textbox'),
  ).not.toHaveValue('Preenchido via teclado')
})
