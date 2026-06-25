import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * Form Builder Enhancements — seven additive author/respondent capabilities.
 *
 * Plan: docs/plans/form-builder-enhancements.md (Verification section + locked
 * decisions). NO feature flag — the feature ships ON; nothing to toggle.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HERMETICITY DESIGN (mirrors case-phase-result.spec.ts; avoids BUG-CPR-001
 * cross-contamination)
 * ──────────────────────────────────────────────────────────────────────────────
 * This spec creates its OWN commission-scoped forms via the service role; it
 * never touches the seeded Form A/B.
 *
 *   FORM_BUILDER  — a fresh DRAFT in CCIH used by the BUILDER tests (add the new
 *                   types, colour options, build a QUESTION + a SECTION
 *                   condition, publish). Created empty; the tests compose it.
 *
 *   FORM_FILL     — a PUBLISHED multi-section form used by the FILL / SUBMIT /
 *                   READ-VIEW tests. Built once in beforeAll via direct
 *                   service-role inserts + the publish RPC, with:
 *                     S0 (default): controller MC "fill_ctrl" (Sim/Não),
 *                                   same-section conditional short_text
 *                                   "fill_same" (shown when fill_ctrl = Sim),
 *                                   a coloured MC "fill_color" (green/red),
 *                                   a number "fill_num" (config min 1 / max 10),
 *                                   a date "fill_date", a time "fill_time".
 *                     S1 "Detalhes" : cross-section conditional free_text
 *                                   "fill_cross" (shown when fill_ctrl = Sim).
 *
 * Cleanup (purgeLeftoverState) deletes by title pattern via docker exec +
 * session_replication_role=replica (bypasses the immutability guards). Called at
 * the START of beforeAll (idempotent) and in afterAll (best-effort).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH  (…002)
 *   staff1.ccih@test.local  staff, CCIH        (…003)
 *
 * Serial mode — beforeAll writes shared fixtures and the builder tests mutate the
 * same draft. Run with --workers=1.
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
    'SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local (Playwright loads it via @next/env).',
  )
}

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH (seeded)
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'

const SPEC_TAG = 'FBE-SPEC'
const FORM_BUILDER_TITLE = `Builder ${SPEC_TAG}`
const FORM_FILL_TITLE = `Fill ${SPEC_TAG}`
const FORM_SIGNOFF_TITLE = `Signoff ${SPEC_TAG}`
// AC-15: a fresh draft for the number-condition regression guard (MAJOR-1).
// FORM_BUILDER is published after AC-6 and cannot accept new items.
const FORM_NUMCOND_TITLE = `NumCond ${SPEC_TAG}`

// ---------------------------------------------------------------------------
// Fixture state (populated in beforeAll)
// ---------------------------------------------------------------------------

let builderFormId: string

let fillFormId: string
let fillVersionId: string
let fillS0Id: string // default section
let fillS1Id: string // "Detalhes"
let fillCtrlId: string // controller MC (fill_ctrl)
let fillSameId: string // same-section conditional short_text (fill_same)
let fillColorId: string // coloured MC (fill_color)
let fillNumId: string // number with min/max (fill_num)
let fillDateId: string // date (fill_date)
let fillTimeId: string // time (fill_time)
let fillCrossId: string // cross-section conditional free_text (fill_cross)

// AC-14 sign-off review form (FORM_SIGNOFF)
let signoffFormId: string

// AC-15 number-condition regression guard (FORM_NUMCOND)
let numCondFormId: string
let signoffVersionId: string
let signoffS0Id: string // default flat section (no signoff)
let signoffS1Id: string // "Revisão" section — requires_signoff=true, staff_admin
let signoffS0TxtId: string // short_text in S0 (fill before advancing)
let signoffS1McId: string // MC in S1 (the item that carries an observation)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Clear existing auth cookies so the middleware does not redirect an already-
  // authenticated session away from /login before the form can render.
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

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function svcInsert<T>(
  req: APIRequestContext,
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data,
  })
  expect(
    resp.ok(),
    `svcInsert(${table}) failed ${resp.status()}: ${await resp.text()}`,
  ).toBeTruthy()
  const rows = (await resp.json()) as T[]
  return rows[0]
}

async function svcGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function rpc(
  req: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/**
 * Purge any state left by a previous (possibly aborted) run. Bypasses the
 * immutability triggers via session_replication_role=replica through the DB
 * container (the supabase CLI can't run multi-statement SQL in one --local call).
 */
async function purgeLeftoverState() {
  const { spawnSync } = await import('child_process')
  const sql = [
    'SET session_replication_role = replica',
    // Responses against our fill form's versions (may be submitted + guarded).
    `DELETE FROM responses
       WHERE form_version_id IN (
         SELECT fv.id FROM form_versions fv
         JOIN forms f ON f.id = fv.form_id
         WHERE f.commission_id = '${COMM_A}'
           AND f.title IN ('${FORM_BUILDER_TITLE}', '${FORM_FILL_TITLE}', '${FORM_SIGNOFF_TITLE}', '${FORM_NUMCOND_TITLE}')
       )`,
    // The spec forms (cascades form_versions → form_sections → form_items).
    `DELETE FROM forms
       WHERE commission_id = '${COMM_A}'
         AND title IN ('${FORM_BUILDER_TITLE}', '${FORM_FILL_TITLE}', '${FORM_SIGNOFF_TITLE}', '${FORM_NUMCOND_TITLE}')`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')

  spawnSync(
    'docker',
    [
      'exec',
      'supabase_db_azkbbhskturikxpgmafq',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      sql,
    ],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

/** Insert one input item via the service role. */
async function insertItem(
  req: APIRequestContext,
  fields: Record<string, unknown>,
): Promise<string> {
  const row = await svcInsert<{ id: string }>(req, 'form_items', fields)
  return row.id
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purgeLeftoverState()

  // ---- FORM_BUILDER: an empty draft for the builder tests -----------------
  const builderForm = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_BUILDER_TITLE,
    description: 'Spec-owned draft for form-builder-enhancements builder tests.',
    created_by: UID_CHEFE_A,
  })
  builderFormId = builderForm.id

  const builderVersion = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: builderFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  // The auto-create-default-section trigger may already add S0; ensure one exists.
  const existingSections = await svcGet<{ id: string }>(
    request,
    `form_sections?form_version_id=eq.${builderVersion.id}&select=id`,
  )
  if (existingSections.length === 0) {
    await svcInsert(request, 'form_sections', {
      form_version_id: builderVersion.id,
      position: 0,
      is_default: true,
      title: null,
    })
  }

  // ---- FORM_FILL: a published, multi-section form for fill/submit/read -----
  const fillForm = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_FILL_TITLE,
    description: 'Spec-owned published form for fill/submit/read-view tests.',
    created_by: UID_CHEFE_A,
  })
  fillFormId = fillForm.id

  const fillVersion = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: fillFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  fillVersionId = fillVersion.id

  // Default section S0 — clear any auto-created default first so positions are
  // deterministic, then create S0 (default) + S1.
  const autoSections = await svcGet<{ id: string }>(
    request,
    `form_sections?form_version_id=eq.${fillVersionId}&select=id`,
  )
  if (autoSections.length > 0) {
    // Reuse the auto-created default as S0.
    fillS0Id = autoSections[0].id
  } else {
    const s0 = await svcInsert<{ id: string }>(request, 'form_sections', {
      form_version_id: fillVersionId,
      position: 0,
      is_default: true,
      title: null,
    })
    fillS0Id = s0.id
  }

  const s1 = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: fillVersionId,
    position: 1,
    is_default: false,
    title: 'Detalhes',
  })
  fillS1Id = s1.id

  // S0 items (positions 0..5).
  fillCtrlId = await insertItem(request, {
    section_id: fillS0Id,
    position: 0,
    item_type: 'multiple_choice',
    question_key: 'fill_ctrl',
    label: 'Houve ocorrência?',
    options: ['Sim', 'Não'],
    required: true,
  })
  // Same-section conditional: visible only when fill_ctrl = Sim.
  fillSameId = await insertItem(request, {
    section_id: fillS0Id,
    position: 1,
    item_type: 'short_text',
    question_key: 'fill_same',
    label: 'Quem identificou a ocorrência?',
    required: false,
    visible_when: {
      match: 'all',
      conditions: [{ question_key: 'fill_ctrl', op: 'equals', value: 'Sim' }],
    },
  })
  // Coloured MC (green/red).
  fillColorId = await insertItem(request, {
    section_id: fillS0Id,
    position: 2,
    item_type: 'multiple_choice',
    question_key: 'fill_color',
    label: 'Classificação de risco',
    options: [
      { label: 'Baixo', color: 'green' },
      { label: 'Alto', color: 'red' },
    ],
    required: false,
  })
  // Number with config min 1 / max 10.
  fillNumId = await insertItem(request, {
    section_id: fillS0Id,
    position: 3,
    item_type: 'number',
    question_key: 'fill_num',
    label: 'Nota de gravidade (1 a 10)',
    required: false,
    config: { min: 1, max: 10 },
  })
  // Date.
  fillDateId = await insertItem(request, {
    section_id: fillS0Id,
    position: 4,
    item_type: 'date',
    question_key: 'fill_date',
    label: 'Data da ocorrência',
    required: false,
  })
  // Time.
  fillTimeId = await insertItem(request, {
    section_id: fillS0Id,
    position: 5,
    item_type: 'time',
    question_key: 'fill_time',
    label: 'Horário da ocorrência',
    required: false,
  })

  // S1 item: cross-section conditional (shown when fill_ctrl = Sim).
  fillCrossId = await insertItem(request, {
    section_id: fillS1Id,
    position: 0,
    item_type: 'free_text',
    question_key: 'fill_cross',
    label: 'Descreva a ocorrência em detalhe',
    required: false,
    visible_when: {
      match: 'all',
      conditions: [{ question_key: 'fill_ctrl', op: 'equals', value: 'Sim' }],
    },
  })

  // Publish FORM_FILL (chefe.ccih is a CCIH member; the conditions reference an
  // earlier item / earlier section, so validate_visible_when accepts them).
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  const publishResp = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: fillVersionId,
  })
  expect(
    publishResp.ok(),
    `beforeAll: publish FORM_FILL failed: ${await publishResp.text()}`,
  ).toBeTruthy()

  // ---- FORM_SIGNOFF: a published 2-section form for the AC-14 sign-off review
  // test. S0 is a plain default section with one short_text question; S1 is a
  // "Revisão" section with requires_signoff=true, signoff_role='staff_admin', and
  // one multiple_choice question (non-free-text) so an observation can be added.
  // get_response_for_signoff (SECURITY DEFINER gate 3) requires a pending
  // staff_admin sign-off section on the form to grant the read.
  const signoffForm = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_SIGNOFF_TITLE,
    description: 'Spec-owned sign-off form for AC-14.',
    created_by: UID_CHEFE_A,
  })
  signoffFormId = signoffForm.id

  const signoffVersion = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: signoffFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  signoffVersionId = signoffVersion.id

  // Reuse auto-created default section as S0 or create it.
  const signoffAutoSections = await svcGet<{ id: string }>(
    request,
    `form_sections?form_version_id=eq.${signoffVersionId}&select=id`,
  )
  if (signoffAutoSections.length > 0) {
    signoffS0Id = signoffAutoSections[0].id
  } else {
    const s0 = await svcInsert<{ id: string }>(request, 'form_sections', {
      form_version_id: signoffVersionId,
      position: 0,
      is_default: true,
      title: null,
    })
    signoffS0Id = s0.id
  }

  // S1 "Revisão" — requires_signoff=true, signoff_role='staff_admin'.
  const signoffS1 = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: signoffVersionId,
    position: 1,
    is_default: false,
    title: 'Revisão',
    requires_signoff: true,
    signoff_role: 'staff_admin',
  })
  signoffS1Id = signoffS1.id

  // S0: one short_text question (plain, always visible, no observation needed here).
  signoffS0TxtId = await insertItem(request, {
    section_id: signoffS0Id,
    position: 0,
    item_type: 'short_text',
    question_key: 'sign_intro',
    label: 'Nome do responsável',
    required: true,
  })

  // S1: one multiple_choice question — NOT free_text so the observation affordance
  // appears (decision #11). Staff1 will select an option and add an observation.
  signoffS1McId = await insertItem(request, {
    section_id: signoffS1Id,
    position: 0,
    item_type: 'multiple_choice',
    question_key: 'sign_avaliacao',
    label: 'Avaliação da revisão',
    options: ['Aprovado', 'Reprovado'],
    required: false,
  })

  // Publish FORM_SIGNOFF.
  const publishSignoffResp = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: signoffVersionId,
  })
  expect(
    publishSignoffResp.ok(),
    `beforeAll: publish FORM_SIGNOFF failed: ${await publishSignoffResp.text()}`,
  ).toBeTruthy()

  // ---- FORM_NUMCOND: an empty DRAFT for the AC-15 number-condition test -----
  // AC-15 adds items via the builder UI and publishes the form itself, so the
  // beforeAll only creates the shell (the test drives all builder interactions).
  const numCondForm = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_NUMCOND_TITLE,
    description: 'Spec-owned draft for AC-15 number-condition regression guard.',
    created_by: UID_CHEFE_A,
  })
  numCondFormId = numCondForm.id

  const numCondVersion = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: numCondFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  // Ensure the auto-created default section exists (trigger fires on insert).
  const numCondAutoSections = await svcGet<{ id: string }>(
    request,
    `form_sections?form_version_id=eq.${numCondVersion.id}&select=id`,
  )
  if (numCondAutoSections.length === 0) {
    await svcInsert(request, 'form_sections', {
      form_version_id: numCondVersion.id,
      position: 0,
      is_default: true,
      title: null,
    })
  }
})

test.afterAll(async () => {
  await purgeLeftoverState()
})

// ---------------------------------------------------------------------------
// Helpers for the FILL wizard (start a fresh response via RPC, then drive UI)
// ---------------------------------------------------------------------------

/**
 * Start (or resume) an in_progress response for FORM_FILL as `email`, returning
 * the response id. Always clears any prior in_progress draft for the user first
 * so the wizard starts clean.
 */
async function startFillResponse(
  req: APIRequestContext,
  email: string,
): Promise<string> {
  // Clear leftover in_progress drafts for this user on this version.
  const token = await getToken(req, email)
  await req.delete(
    `${SUPABASE_URL}/rest/v1/responses?form_version_id=eq.${fillVersionId}` +
      `&status=eq.in_progress`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
  const resp = await rpc(req, 'start_or_resume_response', token, {
    p_form_version_id: fillVersionId,
  })
  expect(
    resp.ok(),
    `start_or_resume_response failed: ${await resp.text()}`,
  ).toBeTruthy()
  return ((await resp.json()) as { id: string }).id
}

/** The fill wizard URL for a response. */
function fillUrl(responseId: string): string {
  return `/o/rede-a/c/ccih/forms/${fillFormId}/responder/${responseId}`
}

// ===========================================================================
// BUILDER (chefe.ccih)
// ===========================================================================

/**
 * Open the "Adicionar bloco" picker (trigger inside `scope`) and choose a type
 * by its pt-BR menu label, returning the open dialog.
 */
async function openAddBlock(page: Page, menuName: RegExp) {
  const trigger = page.getByRole('button', { name: 'Adicionar bloco' }).first()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: menuName }).click()
  return page.getByRole('dialog')
}

async function addSubmit(dialog: ReturnType<Page['getByRole']>) {
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

// AC-1 — the add-block menu offers the new types with pt-BR labels; add one of each.
test('AC-1 (builder): new question types appear with pt-BR labels and can be added', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${builderFormId}`)
  await expect(
    page.getByRole('heading', { level: 1, name: FORM_BUILDER_TITLE }),
  ).toBeVisible({ timeout: 20_000 })

  // Open the menu once and assert ALL five labels are present under "Perguntas".
  await page.getByRole('button', { name: 'Adicionar bloco' }).first().click()
  await expect(page.getByRole('menuitem', { name: 'Resposta curta' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Resposta longa' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Número' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Data' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Hora' })).toBeVisible()
  // Close the menu (Escape) before driving each add via the helper.
  await page.keyboard.press('Escape')

  // short_text
  let d = await openAddBlock(page, /Resposta curta/)
  await d.getByLabel('Enunciado da pergunta').fill('Nome do auditor')
  await addSubmit(d)

  // free_text (relabelled "Resposta longa"). The menuitem's accessible name is
  // label + description concatenated, so match the label as a substring.
  d = await openAddBlock(page, /Resposta longa/)
  await d.getByLabel('Enunciado da pergunta').fill('Comentários gerais')
  await addSubmit(d)

  // number
  d = await openAddBlock(page, /Número/)
  await d.getByLabel('Enunciado da pergunta').fill('Quantidade observada')
  await addSubmit(d)

  // date
  d = await openAddBlock(page, /Data, com mínimo/)
  await d.getByLabel('Enunciado da pergunta').fill('Data da auditoria')
  await addSubmit(d)

  // time
  d = await openAddBlock(page, /Hora.*24h/)
  await d.getByLabel('Enunciado da pergunta').fill('Horário da auditoria')
  await addSubmit(d)

  // All five blocks render in the builder.
  for (const label of [
    'Nome do auditor',
    'Comentários gerais',
    'Quantidade observada',
    'Data da auditoria',
    'Horário da auditoria',
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
  }
})

// AC-2 — Number/Date items accept optional Mínimo/Máximo (→ config).
test('AC-2 (builder): number and date items accept optional Mínimo/Máximo', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${builderFormId}`)

  // number with bounds
  let d = await openAddBlock(page, /Número/)
  await d.getByLabel('Enunciado da pergunta').fill('Temperatura registrada')
  // The "Limites (opcional)" fieldset exposes Mínimo / Máximo inputs.
  await expect(d.getByText(/Limites/i)).toBeVisible()
  await d.getByLabel('Mínimo', { exact: true }).fill('2')
  await d.getByLabel('Máximo', { exact: true }).fill('8')
  await addSubmit(d)

  // date with bounds
  d = await openAddBlock(page, /Data, com mínimo/)
  await d.getByLabel('Enunciado da pergunta').fill('Data dentro do trimestre')
  await d.getByLabel('Mínimo', { exact: true }).fill('2026-01-01')
  await d.getByLabel('Máximo', { exact: true }).fill('2026-03-31')
  await addSubmit(d)

  await expect(page.getByText('Temperatura registrada', { exact: true })).toBeVisible()
  await expect(page.getByText('Data dentro do trimestre', { exact: true })).toBeVisible()
})

// AC-3 — multiple_choice + checkbox show a per-row colour picker; dropdown does NOT.
test('AC-3 (builder): colour picker on multiple_choice + checkbox, NOT on dropdown', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${builderFormId}`)

  // multiple_choice → colour picker present.
  // The implementation uses a DropdownMenu: a swatch trigger button with
  // aria-label "Cor da opção N: sem cor. Clique para alterar"; clicking it
  // opens a dropdown with "Sem cor" and palette buttons.
  let d = await openAddBlock(page, /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Resultado MC com cor')
  await d.getByLabel('Opção 1', { exact: true }).fill('Conforme')
  // Trigger button must be visible (proves colour picker is present for mc).
  const mcColorTrigger = d.getByRole('button', { name: /Cor da opção 1/i })
  await expect(mcColorTrigger).toBeVisible()
  // Open the dropdown and assert the "Sem cor" button is there.
  // Note: DropdownMenuContent portals to <body>; scope to page, not the dialog.
  await mcColorTrigger.click()
  const semCorBtn = page.getByRole('button', { name: 'Sem cor' })
  await expect(semCorBtn).toBeVisible()
  // Pick a colour (Verde) and assert it gets aria-pressed="true".
  const verdeBtn = page.getByRole('button', { name: 'Verde' })
  await verdeBtn.click()
  await expect(verdeBtn).toHaveAttribute('aria-pressed', 'true')
  // Close the dropdown (click outside or press Escape) so we can continue.
  await page.keyboard.press('Escape')
  await d.getByRole('button', { name: 'Cancelar' }).click()
  await expect(d).toBeHidden()

  // checkbox → colour picker trigger present.
  d = await openAddBlock(page, /Caixas de seleção/)
  await d.getByLabel('Enunciado da pergunta').fill('Checkbox com cor')
  await d.getByLabel('Opção 1', { exact: true }).fill('Item A')
  await expect(d.getByRole('button', { name: /Cor da opção 1/i })).toBeVisible()
  await d.getByRole('button', { name: 'Cancelar' }).click()
  await expect(d).toBeHidden()

  // dropdown → NO colour picker trigger (native <select> can't render colour).
  d = await openAddBlock(page, /Lista suspensa/)
  await d.getByLabel('Enunciado da pergunta').fill('Dropdown sem cor')
  await d.getByLabel('Opção 1', { exact: true }).fill('Opção X')
  await expect(d.getByRole('button', { name: /Cor da opção/i })).toHaveCount(0)
  await d.getByRole('button', { name: 'Cancelar' }).click()
  await expect(d).toBeHidden()
})

// AC-4 — a QUESTION condition disables + clears the "obrigatória" toggle, with note.
test('AC-4 (builder): question condition disables and clears "obrigatória" with a note', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${builderFormId}`)

  // Add a controller multiple_choice question FIRST (an earlier-in-doc-order
  // target the conditional question can reference).
  let d = await openAddBlock(page, /Múltipla escolha/)
  await d.getByLabel('Enunciado da pergunta').fill('Pergunta controladora?')
  await d.getByLabel('Opção 1', { exact: true }).fill('Sim')
  await d.getByRole('button', { name: 'Adicionar opção' }).click()
  await d.getByLabel('Opção 2', { exact: true }).fill('Não')
  await addSubmit(d)

  // Add a conditional question; FIRST mark it required, then enable the
  // condition → the toggle must DISABLE (and a conditional question can never be
  // persisted as required — decision #9).
  d = await openAddBlock(page, /Resposta curta/)
  await d.getByLabel('Enunciado da pergunta').fill('Detalhe condicional')

  const requiredToggle = d.getByRole('checkbox', { name: /Resposta obrigatória/i })
  await requiredToggle.check()
  await expect(requiredToggle).toBeChecked()

  // Turn on "Aparência condicional" (the QUESTION-context toggle).
  await d
    .getByRole('checkbox', { name: /Exibir somente sob condições/i })
    .check()

  // Build the condition: target = "Pergunta controladora?", value = "Sim".
  // The shared ConditionBuilder's selects carry stable id suffixes
  // (`-target` / `-op` / `-value`) — robust against label-association nuances.
  await d
    .locator('select[id$="-target"]')
    .selectOption({ label: 'Pergunta controladora?' })
  await d.locator('select[id$="-value"]').selectOption({ label: 'Sim' })

  // The required toggle is now DISABLED, with the inline note (decision #9).
  await expect(requiredToggle).toBeDisabled()
  await expect(d.getByText(/não pode ser\s+obrigatória/i)).toBeVisible()

  await addSubmit(d)
  await expect(page.getByText('Detalhe condicional', { exact: true })).toBeVisible()

  // The persisted conditional item is NOT required and carries the condition —
  // the authoritative "cannot be required" guarantee (UI defense + DB CHECK).
  const rows = await svcGet<{ required: boolean; visible_when: unknown }>(
    request,
    `form_items?label=eq.${encodeURIComponent('Detalhe condicional')}` +
      `&select=required,visible_when`,
  )
  expect(rows.length, 'conditional item should exist').toBeGreaterThan(0)
  expect(rows[0].required, 'conditional question must not be required').toBe(false)
  expect(rows[0].visible_when, 'conditional question must carry its condition').not.toBeNull()
})

// AC-5 — a SECTION condition persists across a builder reload (BE-6).
test('AC-5 (builder): section condition persists after reload (BE-6)', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${builderFormId}`)

  // Add a second section so the builder enters sectioned mode. The controller
  // "Pergunta controladora?" (added in AC-4) lives in the default section S0,
  // strictly earlier than the new section → a valid section condition target.
  await page.getByRole('button', { name: 'Adicionar seção' }).click()
  const unnamed = page.getByRole('region', { name: 'Seção sem título' })
  await expect(unnamed.first()).toBeVisible({ timeout: 15_000 })
  await unnamed.first().getByRole('button', { name: 'Renomear seção' }).click()
  const rd = page.getByRole('dialog')
  await rd.getByLabel('Título da seção').fill('Detalhes extras FBE')
  await rd.getByRole('button', { name: 'Salvar' }).click()
  await expect(rd).toBeHidden({ timeout: 10_000 })

  const condSection = page.getByRole('region', { name: 'Detalhes extras FBE' })
  // Open settings → build a SECTION condition via the shared ConditionBuilder.
  await condSection
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  let settings = page.getByRole('dialog')
  await settings
    .getByRole('checkbox', { name: /Exibir somente sob condições/i })
    .check()
  await settings
    .locator('select[id$="-target"]')
    .selectOption({ label: 'Pergunta controladora?' })
  await settings.locator('select[id$="-value"]').selectOption({ label: 'Sim' })
  await settings.getByRole('button', { name: 'Salvar' }).click()
  await expect(settings).toBeHidden({ timeout: 10_000 })

  // The section card shows the "condicional" badge (persisted to the DB).
  await expect(
    condSection.getByText('condicional', { exact: true }),
  ).toBeVisible({ timeout: 10_000 })

  // RELOAD the builder — the previously-broken path (BE-6). Reopen settings and
  // assert the ConditionBuilder rehydrated the saved condition.
  await page.reload()
  const condSection2 = page.getByRole('region', { name: 'Detalhes extras FBE' })
  await expect(
    condSection2.getByText('condicional', { exact: true }),
  ).toBeVisible({ timeout: 15_000 })

  await condSection2
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  settings = page.getByRole('dialog')
  // The condition toggle is ON and the target/value are repopulated.
  await expect(
    settings.getByRole('checkbox', { name: /Exibir somente sob condições/i }),
  ).toBeChecked()
  // The target select rehydrated to a non-empty value whose selected option is
  // the controller question (BE-6: the saved condition survived the reload).
  const targetSelect = settings.locator('select[id$="-target"]')
  const selectedTargetLabel = await targetSelect.evaluate((el) => {
    const s = el as HTMLSelectElement
    return s.options[s.selectedIndex]?.textContent?.trim() ?? ''
  })
  expect(selectedTargetLabel).toBe('Pergunta controladora?')
  // The value select retained "Sim".
  await expect(settings.locator('select[id$="-value"]')).toHaveValue('Sim')
  await settings.getByRole('button', { name: 'Cancelar' }).click()
  await expect(settings).toBeHidden()
})

// AC-6 — publishing the builder form succeeds with valid conditions.
test('AC-6 (builder): publish succeeds with valid question + section conditions', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${builderFormId}`)

  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Publicar' }).click()

  // Published read-only view: the "Editar publicado" CTA appears.
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })
  // The draft builder affordances are gone.
  await expect(page.getByRole('button', { name: 'Adicionar bloco' })).toHaveCount(0)
})

// ===========================================================================
// FILL (staff1.ccih)
// ===========================================================================

// AC-7 — all new inputs render correctly in the wizard.
test('AC-7 (fill): short_text, number, date, time render with the right controls', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const responseId = await startFillResponse(request, 'staff1.ccih@test.local')
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(fillUrl(responseId))

  // The controller question is visible.
  await expect(page.getByText('Houve ocorrência?').first()).toBeVisible({
    timeout: 15_000,
  })

  // number: a text input with inputMode=decimal (pt-BR comma display) + bounds hint.
  const numInput = page.getByLabel(/Nota de gravidade/i)
  await expect(numInput).toBeVisible()
  await expect(numInput).toHaveAttribute('inputmode', 'decimal')
  await expect(page.getByText(/Entre 1 e 10/i)).toBeVisible()

  // date: a native date input.
  const dateInput = page.getByLabel(/Data da ocorrência/i)
  await expect(dateInput).toBeVisible()
  await expect(dateInput).toHaveAttribute('type', 'date')

  // time: a native time input.
  const timeInput = page.getByLabel(/Horário da ocorrência/i)
  await expect(timeInput).toBeVisible()
  await expect(timeInput).toHaveAttribute('type', 'time')

  // short_text only appears once the controller = Sim (AC-8 covers the live
  // toggle); the coloured MC is always visible.
  await expect(page.getByText('Classificação de risco').first()).toBeVisible()

  // pt-BR comma display: typing "3,5" keeps the comma in the field.
  await numInput.fill('3,5')
  await expect(numInput).toHaveValue('3,5')
})

// AC-8 — live show/hide of conditional questions: same-section AND cross-section.
test('AC-8 (fill): conditional questions show/hide live (same-section + cross-section)', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const responseId = await startFillResponse(request, 'staff1.ccih@test.local')
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(fillUrl(responseId))

  const sameSection = page.getByLabel(/Quem identificou a ocorrência/i)
  const ctrlSim = page.getByRole('radio', { name: 'Sim' })
  const ctrlNao = page.getByRole('radio', { name: 'Não' })

  // Initially the controller is unanswered → same-section conditional is HIDDEN.
  await expect(sameSection).toHaveCount(0)

  // Answer Sim → same-section conditional appears live.
  await ctrlSim.check()
  await expect(sameSection).toBeVisible({ timeout: 10_000 })

  // Answer Não → it hides again live.
  await ctrlNao.check()
  await expect(sameSection).toHaveCount(0)

  // --- cross-section ref ---
  // Set Sim, advance to section "Detalhes" → cross-section conditional shows.
  await ctrlSim.check()
  await expect(sameSection).toBeVisible()
  // Navigate to the next section.
  await page.getByRole('button', { name: /Próximo|Avançar|Continuar/i }).first().click()
  await expect(
    page.getByText('Descreva a ocorrência em detalhe').first(),
  ).toBeVisible({ timeout: 15_000 })

  // Go back, flip controller to Não, return to "Detalhes" → cross item is gone.
  await page.getByRole('button', { name: /Voltar|Anterior/i }).first().click()
  await expect(ctrlNao).toBeVisible({ timeout: 10_000 })
  await ctrlNao.check()
  await page.getByRole('button', { name: /Próximo|Avançar|Continuar/i }).first().click()
  // The "Detalhes" section now has its only item hidden.
  await expect(
    page.getByText('Descreva a ocorrência em detalhe'),
  ).toHaveCount(0)
})

// AC-9 — add an observation on a non-free-text question.
test('AC-9 (fill): observation affordance on a non-free-text question', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const responseId = await startFillResponse(request, 'staff1.ccih@test.local')
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(fillUrl(responseId))

  // Answer the coloured MC (non-free-text) → the "Adicionar observação"
  // affordance appears (it only shows once the question is answered).
  await page.getByRole('radio', { name: 'Baixo' }).check()

  const addObsBtn = page
    .getByRole('button', { name: /Adicionar observação/i })
    .first()
  await expect(addObsBtn).toBeVisible({ timeout: 10_000 })
  await addObsBtn.click()

  // A 2-line textarea labelled "Observação" appears and accepts text.
  const obsField = page.getByLabel(/^Observação/i)
  await expect(obsField).toBeVisible()
  await expect(obsField).toHaveAttribute('rows', '2')
  await obsField.fill('Observação de teste E2E na MC colorida.')
  await expect(obsField).toHaveValue('Observação de teste E2E na MC colorida.')
})

// ===========================================================================
// SUBMIT
// ===========================================================================

// AC-10 — a conditional question answered then hidden is CLEARED on submit.
test('AC-10 (submit): an answered-then-hidden conditional answer is cleared on submit', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000)
  const responseId = await startFillResponse(request, 'staff1.ccih@test.local')
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(fillUrl(responseId))

  // Answer controller = Sim → same-section conditional appears → fill it.
  await page.getByRole('radio', { name: 'Sim' }).check()
  const sameSection = page.getByLabel(/Quem identificou a ocorrência/i)
  await expect(sameSection).toBeVisible({ timeout: 10_000 })
  await sameSection.fill('Equipe da noite')

  // Now flip controller to Não → the conditional hides (its prior answer is now
  // orphaned and must be cleared by the submit RPC).
  await page.getByRole('radio', { name: 'Não' }).check()
  await expect(sameSection).toHaveCount(0)

  // Advance through "Detalhes" (its conditional item is hidden under Não) → review.
  await page.getByRole('button', { name: /Próximo|Avançar|Continuar/i }).first().click()
  await page.getByRole('button', { name: /Revisar/i }).first().click()
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })

  // Submit.
  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toBeVisible({ timeout: 20_000 })

  // DB assertion (service role): the hidden conditional's answer is GONE.
  const sameAnswers = await svcGet<{ value: unknown }>(
    request,
    `answers?response_id=eq.${responseId}&item_id=eq.${fillSameId}&select=value`,
  )
  expect(
    sameAnswers.length,
    'orphaned conditional answer must be cleared on submit',
  ).toBe(0)

  // The controller answer (Não) persisted.
  const ctrlAnswers = await svcGet<{ value: unknown }>(
    request,
    `answers?response_id=eq.${responseId}&item_id=eq.${fillCtrlId}&select=value`,
  )
  expect(ctrlAnswers.length).toBe(1)
  expect(ctrlAnswers[0].value).toBe('Não')
})

// AC-11 — number/date min/max blocks submit with a pt-BR error (HC061).
//
// The wizard has TWO enforcement layers for min/max (Architecture Rule 3):
//   1. Client-side (validateSection): blocks "Próximo" with an inline pt-BR
//      error when the entered value is out of bounds — tested via UI below.
//   2. Server-side (submit_response HC061): rejects even if the client is
//      bypassed — tested via direct RPC call below.
// Both layers must produce pt-BR messages referencing the max bound (10).
test('AC-11 (submit): number out of bounds blocks submit with a pt-BR error (HC061)', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000)

  // ── Layer 1: client-side validation (UI) ──────────────────────────────────
  const responseId = await startFillResponse(request, 'staff1.ccih@test.local')
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(fillUrl(responseId))

  // Answer the required controller (so required-field check passes) and put the
  // number OUT of bounds (max is 10 → enter 99). Use Não so the conditional
  // items stay hidden and don't add required gates.
  await page.getByRole('radio', { name: 'Não' }).check()
  const numInput = page.getByLabel(/Nota de gravidade/i)
  await numInput.fill('99')

  // Click "Próximo" — the client interceptor (validateSection) fires before
  // navigating and renders an inline error on the number field; the wizard
  // stays on S0.
  await page.getByRole('button', { name: /Próximo|Avançar|Continuar/i }).first().click()

  // The inline error references the max bound in pt-BR.
  await expect(
    page.locator('text=/no máximo 10/i').first(),
  ).toBeVisible({ timeout: 10_000 })

  // Still on S0 — "Revisar" (S1's nav button) is NOT present yet.
  await expect(page.getByRole('button', { name: /Revisar/i })).toHaveCount(0)

  // ── Layer 2: server-side (HC061) via direct RPC ───────────────────────────
  // Bypass the UI by injecting an out-of-bounds answer directly into the DB,
  // then calling submit_response. The server must reject it.
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')

  // Save answers: controller = "Não" (required), number = 99 (out of bounds).
  // p_answers is a JSONB object keyed by item_id (not an array).
  const saveResp = await rpc(request, 'save_section_answers', staff1Token, {
    p_response_id: responseId,
    p_section_id: fillS0Id,
    p_answers: {
      [fillCtrlId]: 'Não',
      [fillNumId]: 99,
    },
  })
  // save_section_answers stores the answer (no bounds check on save).
  expect(saveResp.ok(), `save_section_answers failed: ${await saveResp.text()}`).toBeTruthy()

  // Now call submit_response — server HC061 must reject it.
  const submitResp = await rpc(request, 'submit_response', staff1Token, {
    p_response_id: responseId,
  })
  expect(submitResp.ok()).toBeFalsy()
  const body = await submitResp.text()
  // Server returns a pt-BR message referencing the bound.
  expect(body).toMatch(/menor ou igual a 10|no máximo 10/i)

  // DB assertion: the response is still in_progress.
  const rows = await svcGet<{ status: string }>(
    request,
    `responses?id=eq.${responseId}&select=status`,
  )
  expect(rows[0]?.status).toBe('in_progress')
})

// ===========================================================================
// READ VIEWS
// ===========================================================================

// AC-12 + AC-13 — observation + coloured chip render on the read-only detail.
test('AC-12/AC-13 (read): observation line + coloured chip on submission detail', async ({
  page,
  request,
}) => {
  test.setTimeout(240_000)

  // Build a fresh submitted response with: controller=Sim, coloured MC=Alto
  // (red), and an observation on the coloured MC. Driven through the UI so the
  // observation flows via saveSection, then submitted.
  const responseId = await startFillResponse(request, 'staff1.ccih@test.local')
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(fillUrl(responseId))

  await page.getByRole('radio', { name: 'Sim' }).check()
  // Fill the same-section conditional (now visible) so nothing is orphaned.
  await page.getByLabel(/Quem identificou a ocorrência/i).fill('Auditor diurno')
  // Coloured MC = Alto (red).
  await page.getByRole('radio', { name: 'Alto' }).check()
  // Add an observation on the coloured MC.
  const addObsBtn = page.getByRole('button', { name: /Adicionar observação/i }).first()
  await expect(addObsBtn).toBeVisible({ timeout: 10_000 })
  await addObsBtn.click()
  await page
    .getByLabel(/^Observação/i)
    .fill('Risco elevado confirmado pela equipe.')

  // Advance to "Detalhes" → fill the cross-section conditional → review → submit.
  await page.getByRole('button', { name: /Próximo|Avançar|Continuar/i }).first().click()
  await page
    .getByLabel(/Descreva a ocorrência em detalhe/i)
    .fill('Ocorrência detalhada para o teste de leitura.')
  await page.getByRole('button', { name: /Revisar/i }).first().click()
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toBeVisible({ timeout: 20_000 })

  // Read-only submission detail (staff_admin view at /dashboard/submissions/{id}).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${responseId}`)
  await page.waitForLoadState('networkidle')

  // AC-13: the selected coloured option renders as a chip carrying the palette
  // token's class (a coloured chip, not a plain string). TOKEN_STYLES['red']
  // contains a red text/border utility; assert the chip exists with a colour
  // class rather than bare text.
  await expect(page.getByText('Alto', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  })
  // The chip element has rounded-full + a colour utility class (red token).
  const chipClass = await page
    .getByText('Alto', { exact: true })
    .first()
    .getAttribute('class')
  expect(chipClass ?? '', 'coloured chip should carry a rounded-full pill class').toMatch(
    /rounded-full/,
  )
  expect(chipClass ?? '', 'coloured chip should carry a red palette utility').toMatch(
    /red|destructive/i,
  )

  // AC-12: the observation renders as a muted "Observação:" line (BE-7).
  await expect(page.getByText(/Observação:/i).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page.getByText('Risco elevado confirmado pela equipe.'),
  ).toBeVisible()
})

// ===========================================================================
// ACCESSIBILITY — keyboard-only flow (CLAUDE.md §8)
// ===========================================================================

// AC-K — fill a coloured MC + add an observation using ONLY the keyboard.
test('AC-K (keyboard-only): answer a question and reveal the observation with the keyboard', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const responseId = await startFillResponse(request, 'staff1.ccih@test.local')
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(fillUrl(responseId))

  // Answer the required controller with the keyboard: focus the first "Sim"
  // radio and select it with Space.
  const ctrlSim = page.getByRole('radio', { name: 'Sim' })
  await ctrlSim.focus()
  await expect(ctrlSim).toBeFocused()
  await page.keyboard.press('Space')
  await expect(ctrlSim).toBeChecked()

  // The same-section conditional appears once the controller is answered.
  await expect(
    page.getByLabel(/Quem identificou a ocorrência/i),
  ).toBeVisible({ timeout: 10_000 })

  // Answer the coloured MC with the keyboard (focus "Baixo", Space to select).
  const baixo = page.getByRole('radio', { name: 'Baixo' })
  await baixo.focus()
  await expect(baixo).toBeFocused()
  await page.keyboard.press('Space')
  await expect(baixo).toBeChecked()

  // The "Adicionar observação" button is reachable + operable by keyboard.
  const addObsBtn = page.getByRole('button', { name: /Adicionar observação/i }).first()
  await expect(addObsBtn).toBeVisible({ timeout: 10_000 })
  await addObsBtn.focus()
  await expect(addObsBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // The observation textarea is revealed and accepts typed input.
  const obsField = page.getByLabel(/^Observação/i)
  await expect(obsField).toBeVisible()
  await obsField.focus()
  await page.keyboard.type('Observação via teclado.')
  await expect(obsField).toHaveValue('Observação via teclado.')
})

// ===========================================================================
// SIGN-OFF REVIEW READ SURFACE (BE-8 + FE-6)
// ===========================================================================

// AC-14 — observation renders in the sign-off review (get_response_for_signoff
// + toClientResponseForSignoff + ReviewAndSign now carry observationsByItemId).
//
// Flow:
//   1. Staff1 fills FORM_SIGNOFF's S0 (short_text) then S1 (MC + observation).
//      Navigating from S1 to review calls persistSection → saveSection action
//      → save_section_answers(p_observations) → answers.observation persisted.
//   2. Staff_admin opens /o/rede-a/c/ccih/manage/assinaturas/[responseId] (in_progress).
//      get_response_for_signoff sees the pending staff_admin sign-off on S1 and
//      gates the SECURITY DEFINER read through (Gate 3 satisfied).
//   3. The sign-off review page renders the S1 MC answer + the "Observação:"
//      line sourced from BE-8's observations_by_item projection.
test('AC-14 (sign-off review): observation line renders in the sign-off review (BE-8/FE-6)', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)

  // Start a fresh in_progress response on FORM_SIGNOFF as staff1.
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')
  // Clear any stale in_progress draft for this version first.
  await request.delete(
    `${SUPABASE_URL}/rest/v1/responses?form_version_id=eq.${signoffVersionId}&status=eq.in_progress`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
  const startResp = await rpc(request, 'start_or_resume_response', staff1Token, {
    p_form_version_id: signoffVersionId,
  })
  expect(startResp.ok(), `AC-14 start_or_resume_response failed: ${await startResp.text()}`).toBeTruthy()
  const responseId = ((await startResp.json()) as { id: string }).id

  // Drive the fill wizard as staff1.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/forms/${signoffFormId}/responder/${responseId}`)

  // S0: fill the required short_text ("Nome do responsável").
  await page.getByLabel(/Nome do responsável/i).fill('Enfermeiro Teste')

  // Advance to S1.
  await page.getByRole('button', { name: /Próximo|Avançar|Continuar/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Revisão' })).toBeVisible({ timeout: 15_000 })

  // S1: answer the MC ("Aprovado").
  await page.getByRole('radio', { name: 'Aprovado' }).check()

  // Add an observation on the MC (the first — and only — "Adicionar observação"
  // button in S1, since it's the only answered non-free-text item).
  const addObsBtn = page.getByRole('button', { name: /Adicionar observação/i }).first()
  await expect(addObsBtn).toBeVisible({ timeout: 10_000 })
  await addObsBtn.click()
  const obsFieldS1 = page.getByLabel(/^Observação/i)
  await expect(obsFieldS1).toBeVisible({ timeout: 5_000 })
  await obsFieldS1.fill('Aprovado com ressalvas menores.')

  // Navigate to the review screen — this triggers persistSection(S1) which calls
  // saveSection action → save_section_answers(p_observations={signoffS1McId: text}).
  await page.getByRole('button', { name: /Revisar/i }).first().click()
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })

  // Switch to staff_admin (chefe.ccih) and open the sign-off review page.
  // The response stays in_progress — the sign-off panel is what appears here.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/assinaturas/${responseId}`)
  await page.waitForLoadState('networkidle')

  // The page must load the form title (not 404).
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  // AC-14 core assertion: the observation renders in the sign-off review.
  // BE-8 adds observations_by_item to get_response_for_signoff; FE-6 threads it
  // through toClientResponseForSignoff → ReviewAndSign → SectionBody → AnswerSummary.
  await expect(page.getByText(/Observação:/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Aprovado com ressalvas menores.')).toBeVisible()

  // Also confirm the MC answer itself renders (basic sanity).
  await expect(page.getByText('Aprovado', { exact: true }).first()).toBeVisible()
})

// ===========================================================================
// NUMBER-CONDITION REGRESSION GUARD (QA MAJOR-1)
// ===========================================================================

// AC-15 — a number-target condition (gt operator) evaluates NUMERICALLY, not
// lexically. The QA MAJOR-1 bug serialized condition values as strings
// ("5"), causing "10" < "5" in lexical compare → a number answer of 10 with
// threshold 5 would wrongly HIDE the dependent question.
//
// Flow (via the real ConditionBuilder UI):
//   1. chefe.ccih opens FORM_NUMCOND (draft) in the builder.
//   2. Adds number question "Pontuação".
//   3. Adds short_text "Detalhes (condição numérica)" with condition:
//      target = Pontuação  /  op = é maior que (gt)  /  value = 5
//   4. Publishes the form.
//   5. staff1.ccih starts a fill response.
//   6. Answers Pontuação = 3 → "Detalhes (condição numérica)" HIDDEN.
//   7. Changes Pontuação = 10 → "Detalhes (condição numérica)" SHOWN.
//      (10 > 5 numerically; "10" < "5" lexically → regression guard fires)
test('AC-15 (number-condition regression guard): number gt condition evaluates numerically not lexically (QA MAJOR-1)', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000)

  // ------- BUILDER phase (chefe.ccih) ----------------------------------------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/forms/${numCondFormId}`)
  await expect(
    page.getByRole('heading', { level: 1, name: FORM_NUMCOND_TITLE }),
  ).toBeVisible({ timeout: 20_000 })

  // 1. Add the number question "Pontuação" (no min/max — any positive integer ok).
  let d = await openAddBlock(page, /Número/)
  await d.getByLabel('Enunciado da pergunta').fill('Pontuação')
  await addSubmit(d)
  await expect(page.getByText('Pontuação', { exact: true }).first()).toBeVisible()

  // 2. Add the short_text "Detalhes (condição numérica)" with a number-target
  //    condition: Pontuação gt 5.
  d = await openAddBlock(page, /Resposta curta/)
  await d.getByLabel('Enunciado da pergunta').fill('Detalhes (condição numérica)')

  // Enable the condition toggle.
  await d.getByRole('checkbox', { name: /Exibir somente sob condições/i }).check()

  // Target: the "Pontuação" number question.
  await d.locator('select[id$="-target"]').selectOption({ label: 'Pontuação' })

  // Op: "é maior que" (gt). For a number target, the op select is rendered with
  // all ORDERED_OPS. Default first op is "equals"; change it to "gt".
  await d.locator('select[id$="-op"]').selectOption({ label: 'é maior que' })

  // Value: type 5 into the number <Input>. The value control for ordered targets
  // is a native <input type="number"> identified by the id-suffix "-value".
  await d.locator('input[id$="-value"]').fill('5')

  await addSubmit(d)
  await expect(
    page.getByText('Detalhes (condição numérica)', { exact: true }).first(),
  ).toBeVisible()

  // 3. Publish FORM_NUMCOND.
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirmDlg = page.getByRole('alertdialog')
  await confirmDlg.getByRole('button', { name: 'Publicar' }).click()
  await expect(
    page.getByRole('button', { name: /Editar publicado/ }),
  ).toBeVisible({ timeout: 20_000 })

  // ------- FILL phase (staff1.ccih) -------------------------------------------
  // Fetch the published version id to construct the fill URL.
  const versions = await svcGet<{ id: string; status: string }>(
    request,
    `form_versions?form_id=eq.${numCondFormId}&status=eq.published&select=id,status`,
  )
  expect(versions.length, 'AC-15: FORM_NUMCOND must have a published version').toBe(1)
  const numCondVersionId = versions[0].id

  const staff1Token = await getToken(request, 'staff1.ccih@test.local')
  const startResp = await rpc(request, 'start_or_resume_response', staff1Token, {
    p_form_version_id: numCondVersionId,
  })
  expect(startResp.ok(), `AC-15 start_or_resume_response failed: ${await startResp.text()}`).toBeTruthy()
  const responseId = ((await startResp.json()) as { id: string }).id

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/forms/${numCondFormId}/responder/${responseId}`)
  await expect(page.getByText('Pontuação').first()).toBeVisible({ timeout: 15_000 })

  // 4. Answer Pontuação = 3 → 3 is NOT greater than 5 → dependent HIDDEN.
  const numInput = page.getByLabel('Pontuação')
  await numInput.fill('3')
  // Trigger change event so the condition evaluator sees the new value.
  await numInput.press('Tab')
  await expect(
    page.getByLabel(/Detalhes \(condição numérica\)/i),
  ).toHaveCount(0, { timeout: 8_000 })

  // 5. Change Pontuação = 10 → 10 IS greater than 5 (numerically; "10" < "5"
  //    lexically — this is the MAJOR-1 regression guard). Dependent must SHOW.
  await numInput.fill('10')
  await numInput.press('Tab')
  await expect(
    page.getByLabel(/Detalhes \(condição numérica\)/i),
  ).toBeVisible({ timeout: 8_000 })
})
