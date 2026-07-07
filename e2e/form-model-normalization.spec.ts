import { execSync } from 'node:child_process'
import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * Form data-model normalization (T-1) — the acceptance criteria the pre-existing
 * label-driven specs do NOT already cover.
 *
 * What changed under the hood (branch feat/form-model-normalization):
 *   - `form_items.options` JSONB → normalized `form_item_options` (each option now
 *     has a stable hidden `code`, plus label, color, nullable `score`, free-text
 *     `analytics_code`, position).
 *   - choice answers moved to `answer_selected_options` (FK to the option row);
 *     `answers.value` is scalars-only.
 *   - conditions / recommend-when / result-rulesets store option CODES, not labels.
 *   - dashboards / export group by `code`, resolve the CURRENT label.
 *
 * The wide regression surface (wizard fill, submit-immutability, sign-off,
 * dashboards-by-count, CSV-row-count) is already exercised by phase4/5/6/8 +
 * form-builder-enhancements, which interact by VISIBLE LABEL and so validate the
 * refactor transparently. This spec adds the NEW-capability coverage those specs
 * lack:
 *
 *   NORM-1 (builder): a choice question with per-option label + color + SCORE +
 *          ANALYTICS_CODE; reorder; then EDIT an option's label and confirm the
 *          item still saves AND the option `code` is PRESERVED server-side
 *          (the editor emits a hidden `optionCode` per row). DB-truth assertions.
 *   NORM-2 (clone): clone a published version → new draft; the option CODES
 *          survive the clone verbatim (new rows, same codes) and a section
 *          condition referencing an option code still resolves after cloning.
 *   NORM-3 (dashboard): distributions aggregate by the stable CODE while showing
 *          the CURRENT label — publish v2 with a RENAMED option label; the
 *          dashboard shows the new label yet still counts the v1 responses.
 *   NORM-4 (keyboard-only, CLAUDE.md §8): reorder two options entirely by
 *          keyboard in the item editor and confirm the persisted order.
 *
 * Hermetic: every form here is spec-owned (title carries a unique tag), built via
 * the service role and driven with real RPCs; the seeded Form A/B are never
 * touched, so phase8's count assertions stay valid. Cleanup deletes by title
 * pattern via docker exec (session_replication_role=replica bypasses the
 * immutability guards). Run with --workers=1.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH  (…002)  — builder + dashboard
 *   staff1.ccih@test.local  staff, CCIH        (…003)  — respondent
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

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH (seeded)
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'

const SPEC_TAG = 'NORM-SPEC'

// ---------------------------------------------------------------------------
// Helpers
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

/**
 * Run SQL as postgres via docker exec, returning stripped rows. Used for
 * hermetic FIXTURE building (create/publish a form) and cleanup — never to test
 * application behavior (RPCs under a real token do that).
 */
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

// ---------------------------------------------------------------------------
// Builder navigation helpers (mirror phase4-builder.spec.ts)
// ---------------------------------------------------------------------------

async function createForm(page: Page, title: string): Promise<string> {
  await page.goto('/o/rede-a/c/ccih/manage/forms')
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
  // Generous timeout — a first-hit (cold-compiled) publish under prod-start can
  // take a while before the read-only view appears.
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 40_000 })
}

// The OptionsEditor score / analytics fields (label text, options-editor.tsx).
// The form-builder-enhancements batch redesigned the option row: score /
// Código de análise / colour / flagged now live behind a per-row progressive-
// disclosure ("Opções") toggle (Settings2), collapsed by default. The score /
// analytics inputs are only in the DOM while their row is expanded, so a helper
// must open the row's disclosure before returning the field.
//
// `.nth(position - 1)` counts across the CURRENTLY-expanded rows (the panel is
// `{isOpen && …}`), so we expand rows in ascending order and keep them open —
// which NORM-1 does (it fills row 1, then adds+fills row 2, then row 3). Keeping
// every lower-indexed row expanded keeps the nth() index aligned with `position`.
async function ensureRowOptionsExpanded(dialog: Locator, position: number): Promise<void> {
  // The toggle's accessible name is "Mostrar opções da opção N" (collapsed) /
  // "Ocultar opções da opção N" (open); it carries aria-expanded. Idempotent:
  // only click when the row is not already expanded.
  const toggle = dialog.getByRole('button', { name: new RegExp(`opções da opção ${position}`, 'i') })
  await expect(toggle).toBeVisible({ timeout: 10_000 })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  }
}
async function scoreInput(dialog: Locator, position: number): Promise<Locator> {
  await ensureRowOptionsExpanded(dialog, position)
  // "Pontuação (opcional)" label wraps the score input; one per EXPANDED row, in
  // DOM order. Positions are 1-based.
  return dialog.getByLabel(/Pontuação/i).nth(position - 1)
}
async function analyticsInput(dialog: Locator, position: number): Promise<Locator> {
  await ensureRowOptionsExpanded(dialog, position)
  return dialog.getByLabel(/Código de análise/i).nth(position - 1)
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
// NORM-1 — builder: label + color + score + analytics_code + reorder, then
// edit a label and confirm the option CODE is preserved server-side.
// ===========================================================================

test('NORM-1 (builder): options carry score + analytics_code; reorder persists; editing a label preserves the option code', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Builder ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // --- Add a multiple_choice question with 3 fully-specified option rows ------
  const d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Classificação do risco?')

  // Row 1 — "Baixo", color Verde, score 1, analytics "conforme".
  await d.getByLabel('Opção 1', { exact: true }).fill('Baixo')
  await (await scoreInput(d, 1)).fill('1')
  await (await analyticsInput(d, 1)).fill('conforme')
  // color: open the row-1 colour dropdown and pick Verde. The palette swatches
  // are plain buttons that PORTAL to <body> (DropdownMenuContent) — scope to the
  // page, not the dialog. Picking sets aria-pressed and closes the dropdown.
  await d.getByRole('button', { name: /Cor da opção 1/i }).click()
  const verdeSwatch = page.getByRole('button', { name: 'Verde', exact: true })
  await verdeSwatch.click()
  await expect(verdeSwatch).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')

  // Row 2 — "Médio", score 2, analytics "atencao".
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Médio')
  await (await scoreInput(d, 2)).fill('2')
  await (await analyticsInput(d, 2)).fill('atencao')

  // Row 3 — "Alto", score 3, analytics "critico".
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 3', { exact: true }).fill('Alto')
  await (await scoreInput(d, 3)).fill('3')
  await (await analyticsInput(d, 3)).fill('critico')

  // --- Reorder: move row 3 ("Alto") up once so order becomes Baixo, Alto, Médio
  await d.getByRole('button', { name: /Mover a opção 3 para cima/i }).click()
  // The inputs are index-bound, so after the swap row 2 now reads "Alto".
  await expect(d.getByLabel('Opção 2', { exact: true })).toHaveValue('Alto')
  await expect(d.getByLabel('Opção 3', { exact: true })).toHaveValue('Médio')

  await submitAddDialog(d)
  await expect(page.getByText('Classificação do risco?')).toBeVisible()

  // --- DB truth #1: the three option rows persisted with score + analytics +
  // the reordered positions, and each has a stable non-blank code -------------
  type OptRow = {
    code: string
    label: string
    color_token: string | null
    score: number | null
    analytics_code: string | null
    position: number
  }
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.draft&select=id`,
    )
  )[0].id
  const itemRow = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${versionId}&item_type=eq.multiple_choice&select=id`,
    )
  )[0]
  let opts = await serviceQuery<OptRow>(
    page,
    `form_item_options?item_id=eq.${itemRow.id}` +
      `&select=code,label,color_token,score,analytics_code,position&order=position.asc`,
  )
  expect(opts.map((o) => o.label)).toEqual(['Baixo', 'Alto', 'Médio'])
  // score / analytics carried through
  const byLabel = Object.fromEntries(opts.map((o) => [o.label, o]))
  expect(Number(byLabel['Baixo'].score)).toBe(1)
  expect(byLabel['Baixo'].analytics_code).toBe('conforme')
  expect(byLabel['Baixo'].color_token).toBe('green')
  expect(Number(byLabel['Médio'].score)).toBe(2)
  expect(byLabel['Médio'].analytics_code).toBe('atencao')
  expect(Number(byLabel['Alto'].score)).toBe(3)
  expect(byLabel['Alto'].analytics_code).toBe('critico')
  // every code is a non-blank stable identity
  for (const o of opts) expect(o.code.trim().length).toBeGreaterThan(0)

  // Capture the code of "Baixo" — it must survive a label rename.
  const baixoCodeBefore = byLabel['Baixo'].code

  // --- Edit the block: rename "Baixo" → "Risco baixo" and re-save -------------
  await page.getByRole('button', { name: 'Editar bloco' }).first().click()
  const ed = page.getByRole('dialog')
  await expect(ed).toBeVisible({ timeout: 10_000 })
  // Row 1 label is "Baixo" (positions are stable in the editor).
  const row1 = ed.getByLabel('Opção 1', { exact: true })
  await expect(row1).toHaveValue('Baixo')
  await row1.fill('Risco baixo')
  // Blur so the controlled OptionsEditor onChange commits to the parent form
  // state before submit (avoids a fill→click race on a cold prod-start).
  await row1.blur()
  await expect(row1).toHaveValue('Risco baixo')
  await ed.getByRole('button', { name: 'Salvar' }).click()
  // The Salvar server action (updateItem) can be slow on a first (cold) hit.
  await expect(ed).toBeHidden({ timeout: 30_000 })

  // --- DB truth #2: the label changed but the CODE is byte-for-byte preserved
  opts = await serviceQuery<OptRow>(
    page,
    `form_item_options?item_id=eq.${itemRow.id}` +
      `&select=code,label,score,analytics_code,position&order=position.asc`,
  )
  const baixoAfter = opts.find((o) => o.code === baixoCodeBefore)
  expect(baixoAfter, 'the "Baixo" option row must survive the edit by code').toBeTruthy()
  expect(baixoAfter!.label).toBe('Risco baixo')
  // score + analytics also preserved across the label edit
  expect(Number(baixoAfter!.score)).toBe(1)
  expect(baixoAfter!.analytics_code).toBe('conforme')
  // still exactly 3 options — the rename did not create a 4th (regenerated) row
  expect(opts.length).toBe(3)
})

// ===========================================================================
// NORM-2 — clone: option codes survive the clone verbatim, and a section
// condition keyed on an option code still resolves after cloning.
// ===========================================================================

test('NORM-2 (clone): option codes survive a clone; a section condition on an option code holds after cloning', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Clone ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // Default section: a controlling multiple_choice "Houve falha?" (Sim / Não).
  let d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Houve falha?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Sim')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Não')
  await submitAddDialog(d)

  // Add a conditional section "Detalhes" shown when "Houve falha?" = Sim.
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  const unnamed = page.getByRole('region', { name: 'Seção sem título' })
  await unnamed.getByRole('button', { name: 'Renomear seção' }).click()
  const rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Detalhes')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden()

  const detalhes = page.getByRole('region', { name: 'Detalhes' })
  d = await openAddBlock(page, detalhes, /Resposta longa/)
  await d.getByLabel('Enunciado da pergunta').fill('Descreva a falha')
  await submitAddDialog(d)

  await detalhes
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  const s = page.getByRole('dialog')
  await s.getByRole('checkbox', { name: /Exibir somente sob condições/i }).check()
  await s.locator('select[id$="-target"]').selectOption({ label: 'Houve falha?' })
  await s.locator('select[id$="-value"]').selectOption({ label: 'Sim' })
  await s.getByRole('button', { name: 'Salvar' }).click()
  await expect(s).toBeHidden()

  // Publish v1.
  await publishForm(page)

  // --- Capture v1's option codes + the section condition (stores the code) ----
  const v1 = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id`,
    )
  )[0].id
  const v1Item = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${v1}&item_type=eq.multiple_choice&select=id`,
    )
  )[0]
  const v1Opts = await serviceQuery<{ code: string; label: string }>(
    page,
    `form_item_options?item_id=eq.${v1Item.id}&select=code,label&order=position.asc`,
  )
  const v1Codes = v1Opts.map((o) => o.code).sort()
  const simCode = v1Opts.find((o) => o.label === 'Sim')!.code
  expect(simCode.trim().length).toBeGreaterThan(0)

  // The conditional section stores the option CODE (not the label "Sim").
  const v1Cond = await serviceQuery<{ visible_when: unknown }>(
    page,
    `form_sections?form_version_id=eq.${v1}&is_default=eq.false&select=visible_when`,
  )
  expect(JSON.stringify(v1Cond)).toContain(simCode)
  expect(JSON.stringify(v1Cond)).not.toContain('"Sim"')

  // --- Clone: "Editar publicado" clones the published version → new draft -----
  await page.getByRole('button', { name: /Editar publicado/ }).click()
  await expect(
    page.getByRole('button', { name: 'Adicionar seção' }),
  ).toBeVisible({ timeout: 20_000 })

  const v2 = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.draft&select=id`,
    )
  )[0].id
  expect(v2).not.toBe(v1)
  const v2Item = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${v2}&item_type=eq.multiple_choice&select=id`,
    )
  )[0]
  // New option ROWS (different ids, new version) but the SAME codes verbatim.
  const v2Opts = await serviceQuery<{ id: string; code: string; label: string }>(
    page,
    `form_item_options?item_id=eq.${v2Item.id}&select=id,code,label&order=position.asc`,
  )
  expect(v2Opts.map((o) => o.code).sort()).toEqual(v1Codes)
  // and they are genuinely NEW rows (cloned, not the same PK)
  const v1Ids = (
    await serviceQuery<{ id: string }>(
      page,
      `form_item_options?item_id=eq.${v1Item.id}&select=id`,
    )
  ).map((r) => r.id)
  for (const o of v2Opts) expect(v1Ids).not.toContain(o.id)

  // --- The cloned section condition still references the SAME code -----------
  const v2Cond = await serviceQuery<{ visible_when: unknown }>(
    page,
    `form_sections?form_version_id=eq.${v2}&is_default=eq.false&select=visible_when`,
  )
  expect(JSON.stringify(v2Cond)).toContain(simCode)

  // --- Publish the clone → proves the cloned condition passes code-existence
  // validation (validate_visible_when checks the code resolves to a live option).
  await publishForm(page)
})

// ===========================================================================
// NORM-3 — dashboard: distributions aggregate by the stable CODE while
// resolving the CURRENT label. Publish v2 with a renamed option; v1 responses
// keep counting, under the new label.
// ===========================================================================

test('NORM-3 (dashboard): distribution counts by stable code and shows the CURRENT label after a v2 rename', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Dash ${SPEC_TAG} ${Date.now()}`

  // --- Build + publish v1 via the service role (a flat form, one MC question)
  // A single default section keeps the wizard flat; the MC is required so a
  // submitted response must select an option.
  const chefeToken = await (async () => {
    const p = page
    return getToken(p, 'chefe.ccih@test.local')
  })()

  // Create the form + version + default section + MC item + 3 option rows, then
  // publish — all as a fixture (docker exec). Codes are the lowercase slug the
  // backend mints; we set them explicitly here to keep the assertion readable.
  const formId = '11110000-0000-0000-0000-0000000d0001'
  const versionId = '11110000-0000-0000-0000-0000000d0a01'
  const sectionId = '11110000-0000-0000-0000-0000000d0b01'
  const itemId = '11110000-0000-0000-0000-0000000d0c01'
  sql(
    `set session_replication_role = replica;` +
      `delete from forms where id = '${formId}';` +
      `insert into forms (id, commission_id, title, created_by) ` +
      `values ('${formId}', '${COMM_A}', '${title}', '${UID_CHEFE_A}');` +
      `insert into form_versions (id, form_id, version_number, status, created_by) ` +
      `values ('${versionId}', '${formId}', 1, 'draft', '${UID_CHEFE_A}');` +
      `insert into form_sections (id, form_version_id, position, is_default, title) ` +
      `values ('${sectionId}', '${versionId}', 0, true, null);` +
      `insert into form_items (id, form_version_id, section_id, position, item_type, question_key, label, required) ` +
      `values ('${itemId}', '${versionId}', '${sectionId}', 0, 'multiple_choice', 'norm_grade', 'Resultado da avaliação?', true);` +
      `insert into form_item_options (item_id, form_version_id, position, code, label) values ` +
      `('${itemId}', '${versionId}', 0, 'aprovado', 'Aprovado'),` +
      `('${itemId}', '${versionId}', 1, 'reprovado', 'Reprovado'),` +
      `('${itemId}', '${versionId}', 2, 'pendente', 'Pendente');`,
  )
  // Publish v1 through the real RPC (validation authority).
  const pub1 = await rpcAs(page, chefeToken, 'publish_form_version', {
    p_form_version_id: versionId,
  })
  expect(pub1.ok, `publish v1: ${pub1.text}`).toBeTruthy()

  // --- Submit 3 responses selecting: Aprovado ×2, Reprovado ×1 ---------------
  const staffToken = await getToken(page, 'staff1.ccih@test.local')
  async function submitOne(code: string) {
    // `start_or_resume_response` returns the full `responses` ROW (SETOF-of-one),
    // not a bare uuid — PostgREST serializes it as an object (or a 1-element
    // array). Take its `id`.
    const start = await rpcAs<{ id: string } | { id: string }[]>(
      page,
      staffToken,
      'start_or_resume_response',
      { p_form_version_id: versionId },
    )
    expect(start.ok, `start: ${start.text}`).toBeTruthy()
    const startRow = Array.isArray(start.json) ? start.json[0] : start.json
    const responseId = startRow.id
    const save = await rpcAs(page, staffToken, 'save_section_answers', {
      p_response_id: responseId,
      p_section_id: sectionId,
      p_answers: {},
      p_selections: { [itemId]: [code] },
    })
    expect(save.ok, `save (${code}): ${save.text}`).toBeTruthy()
    const sub = await rpcAs(page, staffToken, 'submit_response', {
      p_response_id: responseId,
    })
    expect(sub.ok, `submit (${code}): ${sub.text}`).toBeTruthy()
    return responseId
  }
  await submitOne('aprovado')
  await submitOne('aprovado')
  await submitOne('reprovado')

  // --- DB truth: the selections landed in answer_selected_options by option row.
  // answer-model-v2 re-keyed the table to answer_id (item_id column is gone) and
  // every choice item now has a parent answers row — resolve selections via the
  // answers rows for this item, one selection per submitted response.
  const selRows = await serviceQuery<{ answer_selected_options: { option_id: string }[] }>(
    page,
    `answers?item_id=eq.${itemId}&select=answer_selected_options(option_id)`,
  )
  const totalSel = selRows.reduce((n, a) => n + a.answer_selected_options.length, 0)
  expect(totalSel).toBe(3)

  // --- Dashboard v1: Aprovado = 2, Reprovado = 1 -----------------------------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/dashboard')
  await expect(page.getByRole('tablist', { name: /formulários/i })).toBeVisible({
    timeout: 15_000,
  })
  // Select this spec's form tab.
  await page.getByRole('tab', { name: title }).click()

  const article = page
    .locator('article')
    .filter({ hasText: /Resultado da avaliação/i })
  await expect(article).toBeVisible({ timeout: 15_000 })
  const table = article.locator('table')
  const aprovadoRow = table
    .locator('tr')
    .filter({ has: page.locator('th', { hasText: /^Aprovado$/ }) })
  await expect(aprovadoRow.locator('td').first()).toHaveText('2')
  const reprovadoRow = table
    .locator('tr')
    .filter({ has: page.locator('th', { hasText: /^Reprovado$/ }) })
  await expect(reprovadoRow.locator('td').first()).toHaveText('1')

  // --- Clone → rename "Aprovado" label to "Conforme" (same code) → publish v2
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${formId}`)
  await page.getByRole('button', { name: /Editar publicado/ }).click()
  await expect(
    page.getByRole('button', { name: 'Adicionar seção' }),
  ).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Editar bloco' }).first().click()
  const ed = page.getByRole('dialog')
  await expect(ed).toBeVisible({ timeout: 10_000 })
  const aprovadoInput = ed.getByLabel('Opção 1', { exact: true })
  await expect(aprovadoInput).toHaveValue('Aprovado')
  await aprovadoInput.fill('Conforme')
  await aprovadoInput.blur()
  await expect(aprovadoInput).toHaveValue('Conforme')
  await ed.getByRole('button', { name: 'Salvar' }).click()
  await expect(ed).toBeHidden({ timeout: 30_000 })
  await publishForm(page)

  // DB truth: v2 kept the code "aprovado" for the relabelled "Conforme" option.
  const v2 = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.published&select=id&order=version_number.desc`,
    )
  )[0].id
  const v2Item = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${v2}&question_key=eq.norm_grade&select=id`,
    )
  )[0]
  const conforme = (
    await serviceQuery<{ code: string; label: string }>(
      page,
      `form_item_options?item_id=eq.${v2Item.id}&label=eq.Conforme&select=code,label`,
    )
  )[0]
  expect(conforme.code).toBe('aprovado')

  // --- Dashboard v2: the row now shows "Conforme" but STILL counts 2 (the v1
  // responses aggregate by the stable code, not the label). "Aprovado" is gone.
  await page.goto('/o/rede-a/c/ccih/dashboard')
  await expect(page.getByRole('tablist', { name: /formulários/i })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('tab', { name: title }).click()
  const article2 = page
    .locator('article')
    .filter({ hasText: /Resultado da avaliação/i })
  await expect(article2).toBeVisible({ timeout: 15_000 })
  const table2 = article2.locator('table')
  const conformeRow = table2
    .locator('tr')
    .filter({ has: page.locator('th', { hasText: /^Conforme$/ }) })
  await expect(conformeRow.locator('td').first()).toHaveText('2')
  // The old label must NOT appear as its own row.
  await expect(
    table2.locator('th[scope="row"]', { hasText: /^Aprovado$/ }),
  ).toHaveCount(0)
  // Reprovado still counts 1 (untouched code).
  const reprovadoRow2 = table2
    .locator('tr')
    .filter({ has: page.locator('th', { hasText: /^Reprovado$/ }) })
  await expect(reprovadoRow2.locator('td').first()).toHaveText('1')

  // Cleanup this NORM-3 fixture explicitly (its title carries the tag, so the
  // afterAll purge also catches it, but delete now to keep the DB tidy).
  sql(
    `set session_replication_role = replica; delete from forms where id = '${formId}';`,
  )
})

// ===========================================================================
// NORM-4 — keyboard-only (CLAUDE.md §8): reorder two options entirely by
// keyboard in the item editor; confirm the persisted order.
// ===========================================================================

test('NORM-4 (keyboard-only): reorder options via keyboard and persist the new order', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const title = `Keyboard ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // Add a checkbox question with three options via mouse (setup), then reorder
  // by keyboard (the flow under test).
  const d = await openAddBlock(page, page.locator('body'), /Caixas de seleção/)
  await d.getByLabel('Enunciado da pergunta').fill('EPIs disponíveis?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Luvas')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Avental')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 3', { exact: true }).fill('Máscara')

  // Keyboard-only reorder: focus the "Mover a opção 3 para cima" button and
  // activate it with the keyboard (Enter). This moves "Máscara" above "Avental":
  // order becomes Luvas, Máscara, Avental.
  const moveUp3 = d.getByRole('button', { name: /Mover a opção 3 para cima/i })
  await moveUp3.focus()
  await expect(moveUp3).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(d.getByLabel('Opção 2', { exact: true })).toHaveValue('Máscara')
  await expect(d.getByLabel('Opção 3', { exact: true })).toHaveValue('Avental')

  await submitAddDialog(d)

  // DB truth: the persisted positions reflect the keyboard reorder.
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.draft&select=id`,
    )
  )[0].id
  const itemRow = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${versionId}&item_type=eq.checkbox&select=id`,
    )
  )[0]
  const opts = await serviceQuery<{ label: string; position: number }>(
    page,
    `form_item_options?item_id=eq.${itemRow.id}&select=label,position&order=position.asc`,
  )
  expect(opts.map((o) => o.label)).toEqual(['Luvas', 'Máscara', 'Avental'])
})

// ===========================================================================
// NORM-5 — edit-dialog reorder of EXISTING (already-persisted) options.
//
// The QA MAJOR-1 gap: reordering options that already have DB rows goes through
// updateItem → reconcileOptionRows → the atomic reconcile_item_options RPC.
// Before the fix, moving a lower option UP into an OCCUPIED slot silently failed
// with a duplicate-key on the DEFERRABLE unique(item_id, position) (the old
// per-row position UPDATE loop ran in separate transactions). This exercises the
// exact repro: create ≥3 options, SAVE, re-open the editor, move a lower option
// up into an occupied slot, save — and assert the new order PERSISTS after a
// reload, with every option CODE preserved (stability through the reorder), and
// a section condition keyed on a reordered option still resolving.
// ===========================================================================

test('NORM-5 (edit reorder): reordering EXISTING options into an occupied slot persists and preserves codes (QA MAJOR-1)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `EditReorder ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // --- Step 1: create a multiple_choice question with FOUR options and SAVE ---
  // Saving persists the option rows (positions 0..3), so a subsequent edit
  // reconciles EXISTING rows (the path that carried the bug), not all-new ones.
  const d = await openAddBlock(page, page.locator('body'), /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Categoria do achado?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Estrutura')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Processo')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 3', { exact: true }).fill('Resultado')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 4', { exact: true }).fill('Documentação')
  await submitAddDialog(d)
  await expect(page.getByText('Categoria do achado?')).toBeVisible()

  // --- Capture the persisted rows: labels, positions, and stable codes --------
  type OptRow = { code: string; label: string; position: number }
  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `form_versions?form_id=eq.${formId}&status=eq.draft&select=id`,
    )
  )[0].id
  const itemRow = (
    await serviceQuery<{ id: string }>(
      page,
      `form_items?form_version_id=eq.${versionId}&item_type=eq.multiple_choice&select=id`,
    )
  )[0]
  const before = await serviceQuery<OptRow>(
    page,
    `form_item_options?item_id=eq.${itemRow.id}&select=code,label,position&order=position.asc`,
  )
  expect(before.map((o) => o.label)).toEqual([
    'Estrutura',
    'Processo',
    'Resultado',
    'Documentação',
  ])
  // Map each label to its DB-frozen code (must survive the reorder verbatim).
  const codeByLabel = Object.fromEntries(before.map((o) => [o.label, o.code]))
  const codesBefore = before.map((o) => o.code).sort()
  // The code we key a condition on — "Documentação", the row we're about to move.
  const docCode = codeByLabel['Documentação']
  expect(docCode.trim().length).toBeGreaterThan(0)

  // --- Step 2: re-open the item editor and MOVE "Documentação" (row 4) UP twice
  // so it lands in slot 2 — an OCCUPIED position (this is the exact repro that
  // violated the deferred unique(item_id, position) before the atomic RPC). New
  // order: Estrutura, Documentação, Processo, Resultado.
  await page.getByRole('button', { name: 'Editar bloco' }).first().click()
  const ed = page.getByRole('dialog')
  await expect(ed).toBeVisible({ timeout: 10_000 })
  await expect(ed.getByLabel('Opção 4', { exact: true })).toHaveValue('Documentação')
  await ed.getByRole('button', { name: /Mover a opção 4 para cima/i }).click()
  // Now "Documentação" is at row 3; move it up once more into slot 2.
  await ed.getByRole('button', { name: /Mover a opção 3 para cima/i }).click()
  await expect(ed.getByLabel('Opção 2', { exact: true })).toHaveValue('Documentação')
  await expect(ed.getByLabel('Opção 3', { exact: true })).toHaveValue('Processo')
  await ed.getByRole('button', { name: 'Salvar' }).click()
  // Before the fix this Salvar silently failed (duplicate-key) and the dialog
  // stayed open; with the atomic RPC it closes and the reorder persists.
  await expect(ed).toBeHidden({ timeout: 30_000 })

  // --- Step 3: assert the new order PERSISTED and codes are byte-for-byte kept
  const after = await serviceQuery<OptRow>(
    page,
    `form_item_options?item_id=eq.${itemRow.id}&select=code,label,position&order=position.asc`,
  )
  expect(after.map((o) => o.label)).toEqual([
    'Estrutura',
    'Documentação',
    'Processo',
    'Resultado',
  ])
  // No option was dropped or regenerated — still exactly the four original codes.
  expect(after.map((o) => o.code).sort()).toEqual(codesBefore)
  // Each label still carries its ORIGINAL code (stability through the reorder).
  for (const o of after) expect(o.code).toBe(codeByLabel[o.label])
  // Positions are a clean 0..3 with no collision.
  expect(after.map((o) => o.position)).toEqual([0, 1, 2, 3])

  // --- Step 4: the reorder survives a builder RELOAD (persisted, not client-only)
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: title }),
  ).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Editar bloco' }).first().click()
  const ed2 = page.getByRole('dialog')
  await expect(ed2).toBeVisible({ timeout: 10_000 })
  await expect(ed2.getByLabel('Opção 1', { exact: true })).toHaveValue('Estrutura')
  await expect(ed2.getByLabel('Opção 2', { exact: true })).toHaveValue('Documentação')
  await expect(ed2.getByLabel('Opção 3', { exact: true })).toHaveValue('Processo')
  await expect(ed2.getByLabel('Opção 4', { exact: true })).toHaveValue('Resultado')
  await ed2.getByRole('button', { name: 'Cancelar' }).click()
  await expect(ed2).toBeHidden()

  // --- Step 5 (stability): a section condition keyed on the REORDERED option's
  // code still resolves — add a conditional section shown when "Categoria do
  // achado?" = "Documentação", publish, and confirm publish-time code-existence
  // validation passes (the code survived the reorder, so the condition is valid).
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  const unnamed = page.getByRole('region', { name: 'Seção sem título' })
  await unnamed.getByRole('button', { name: 'Renomear seção' }).click()
  const rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Detalhes do achado')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden()

  const detalhes = page.getByRole('region', { name: 'Detalhes do achado' })
  const dt = await openAddBlock(page, detalhes, /Resposta longa/)
  await dt.getByLabel('Enunciado da pergunta').fill('Descreva o achado')
  await submitAddDialog(dt)

  await detalhes
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  const s = page.getByRole('dialog')
  await s.getByRole('checkbox', { name: /Exibir somente sob condições/i }).check()
  await s.locator('select[id$="-target"]').selectOption({ label: 'Categoria do achado?' })
  await s.locator('select[id$="-value"]').selectOption({ label: 'Documentação' })
  await s.getByRole('button', { name: 'Salvar' }).click()
  await expect(s).toBeHidden()

  // The stored condition references the reordered option's CODE (not the label).
  const cond = await serviceQuery<{ visible_when: unknown }>(
    page,
    `form_sections?form_version_id=eq.${versionId}&is_default=eq.false&select=visible_when`,
  )
  expect(JSON.stringify(cond)).toContain(docCode)

  // Publish must succeed — the condition's code still resolves to a live option
  // after the reorder (publish-time code-existence validation is the authority).
  await publishForm(page)
})
