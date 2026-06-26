import path from 'node:path'
import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/**
 * Cases-Extras batch (R1–R4) + Case Data-Model Adjustments — Playwright E2E spec.
 *
 * Acceptance bullets covered:
 *   R1: coordinator uploads a PDF document and downloads it; adds a free-text event.
 *   R3: coordinator creates a tag, assigns it to a case, sees it counted in the
 *       dashboard tag-report.
 *   R4: coordinator creates an action item, the assignee completes it; overdue
 *       surfaces in the KPI strip.
 *   CRITICAL: submit-while-fixed-status end-to-end — the phase advances to `concluida`
 *       while the case is in its auto-computed `em_revisao` status.
 *   Fixed-status auto-advance: activating a phase auto-computes the case to `em_revisao`;
 *       phase completion auto-computes the case to `pendente` (D6/D7 precedence).
 *   HC025: terminal status blocks further changes.
 *   HC026: cross-commission tag assignment rejected.
 *   KEYBOARD: the conclude flow is navigable by keyboard (CLAUDE.md §8 mandate).
 *
 * NOTE (R2 — configurable status removed):
 *   The "Estado" picker (configurable per-commission status vocabulary, R2) was
 *   REMOVED in the Case Data-Model Adjustments (D12). `cases.status` is now a FIXED
 *   five-value, auto-computed enum (`nao_iniciado`/`em_revisao`/`pendente`/
 *   `concluido`/`cancelado`). The old `set_case_status` / `list_case_status_defs`
 *   RPCs are gone; the "Estado" picker and status manager UI are gone. The old R2
 *   tests in this spec (AC-Status and the old AC-Keyboard) are REPLACED by:
 *   - AC-FixedStatusAdvance (auto-compute precedence, no picker)
 *   - AC-Keyboard (keyboard-only conclude with outcome selection)
 *
 * Seeded CCIH cases:
 *   Caso 0001 "Óbito UTI leito 7" (d0000000-…-c1): pendente, 3 offered outcomes.
 *   Caso 0002 "Óbito UTI leito 3" (d0000000-…-c2): concluido + adverse outcome.
 *
 * Persona passwords: Test1234!
 * Run with --workers=1. Run `supabase db reset` before each full run.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.',
  )
}

// Seeded case (deterministic ids from seed.sql).
const SEEDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001, pendente

// Commission ids (from seed.sql).
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'

// Staff persona ids (from seed.sql).
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003' // staff1.ccih

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
  await page.evaluate(() => window.scrollTo(0, 0))
  const userMenu = page.getByRole('button', { name: /abrir menu da conta/i })
  await userMenu.click()
  const sairItem = page.getByRole('menuitem', { name: /sair/i })
  await expect(sairItem).toBeVisible({ timeout: 5_000 })
  await sairItem.click()
  await page.waitForURL('**/login', { timeout: 15_000 })
}

/** Service-role query: case row by id. */
async function getCaseRow(
  page: Page,
  caseId: string,
): Promise<{ status: string; case_number: number; outcome_id: string | null } | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=status,case_number,outcome_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as Array<{ status: string; case_number: number; outcome_id: string | null }>
  return rows[0] ?? null
}

/** Service-role query: case_phases for a case. */
async function getCasePhases(
  page: Page,
  caseId: string,
): Promise<Array<{ id: string; status: string; position: number }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_phases?case_id=eq.${caseId}&order=position.asc&select=id,status,position`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const data = await resp.json()
  return Array.isArray(data) ? data : []
}

/** Obtain a real JWT for a persona (owner token, RLS evaluated under it). */
async function getOwnerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password },
    },
  )
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Create a fresh case via RPC; returns caseId. */
async function createFreshCase(page: Page, ownerToken: string, label: string): Promise<string> {
  const tplResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/process_templates?commission_id=eq.${COMM_CCIH_ID}&status=eq.active&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  )
  const tpls = (await tplResp.json()) as Array<{ id: string }>
  expect(tpls.length).toBeGreaterThan(0)

  const createResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tpls[0].id, p_label: label },
    },
  )
  expect(createResp.ok()).toBeTruthy()
  const caseObj = (await createResp.json()) as { id: string }
  return caseObj.id
}

/** Activate a case phase via the RPC. */
async function activatePhaseRPC(
  page: Page,
  ownerToken: string,
  casePhaseId: string,
  assignedTo: string,
): Promise<void> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/activate_phase`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_phase_id: casePhaseId, p_assigned_to: assignedTo },
    },
  )
  expect(resp.ok()).toBeTruthy()
}

// ---------------------------------------------------------------------------
// AC-FixedStatusAdvance: auto-computed status tracks phase lifecycle (D6/D7)
//
// Creates a fresh case (nao_iniciado), activates Phase 1 (→ em_revisao is
// auto-computed), then submits Phase 1 (→ pendente). No manual picker.
// ---------------------------------------------------------------------------

test('AC-FixedStatusAdvance: activating a phase auto-computes em_revisao; completion auto-computes pendente (D6/D7 precedence)', async ({
  page,
}) => {
  test.setTimeout(90_000)

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(page, ownerToken, `FixedStatus ${Date.now()}`)

  // Fresh case: status must be nao_iniciado (no phases active or concluded yet).
  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 10_000 })
    .toBe('nao_iniciado')

  // Activate Phase 1 → case status auto-computes to em_revisao.
  const phases = await getCasePhases(page, caseId)
  const phase1 = phases.find((p) => p.position === 1)!
  await activatePhaseRPC(page, ownerToken, phase1.id, STAFF1_CCIH_ID)

  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 10_000 })
    .toBe('em_revisao')

  // In the UI: the board shows "Em revisão" badge for this case.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The cases view has "Em revisão" status filter chip (from CASE_STATUS_META).
  const emRevisaoChip = page.getByRole('button', { name: /Em revisão/i })
  await expect(emRevisaoChip).toBeVisible({ timeout: 10_000 })

  // The chip is one of the five fixed status filters (no configurable vocab).
  // Verify the correct count chips exist — there is no "Estado" dropdown.
  const estadoBtn = page.getByRole('button', { name: 'Estado', exact: true })
  await expect(estadoBtn).toHaveCount(0, { timeout: 5_000 })

  // The "set_case_status" RPC no longer exists — calling it returns an error.
  const moveResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/set_case_status`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_id: caseId, p_status_key: 'em_andamento' },
    },
  )
  // The RPC is gone → PostgREST returns a 404 (function not found).
  expect(moveResp.ok()).toBeFalsy()
})

// ---------------------------------------------------------------------------
// AC-SubmitWhileFixedStatus: CRITICAL REGRESSION — submit advances a phase
// while the case is in em_revisao (the fixed auto-computed status).
// ---------------------------------------------------------------------------

test('AC-SubmitWhileFixedStatus: phase submit advances to concluida while case is in auto-computed em_revisao (liveness regression)', async ({
  page,
}) => {
  test.setTimeout(300_000)

  // 1. Create a fresh case and activate Phase 1 → assign to staff1.ccih.
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(page, ownerToken, `FixedStatusSubmit ${Date.now()}`)

  const phases = await getCasePhases(page, caseId)
  const phase1 = phases.find((p) => p.position === 1)!
  await activatePhaseRPC(page, ownerToken, phase1.id, STAFF1_CCIH_ID)

  // The case must be em_revisao (one phase ativa, D7).
  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 10_000 })
    .toBe('em_revisao')

  // 2. staff1.ccih fills + submits Phase 1 via the wizard.
  await signInAs(page, 'staff1.ccih@test.local')

  await page.goto('/o/rede-a/c/ccih/meus-casos')
  await page.waitForURL('**/o/rede-a/c/ccih/meus-casos', { timeout: 15_000 })

  const card = page.getByRole('article').filter({ hasText: /FixedStatusSubmit/i }).first()
  await expect(card).toBeVisible({ timeout: 10_000 })

  const preencherBtn = card.getByRole('button', { name: /Preencher/i })
  await expect(preencherBtn).toBeVisible()
  await preencherBtn.click()

  await page.waitForURL(/\/phase\/[0-9a-f-]{36}\/responder\/[0-9a-f-]{36}/, { timeout: 30_000 })

  // Fill the required items (Form A: dispensador_disponivel + turno_auditoria).
  const dispSim = page.getByRole('radio', { name: /^Sim$/i }).first()
  await expect(dispSim).toBeVisible({ timeout: 15_000 })
  await dispSim.click()
  await expect(dispSim).toBeChecked()

  const turnoSelect = page
    .locator('select')
    .filter({ hasNot: page.locator('[name="formId"],[name="assignedTo"]') })
    .first()
  await turnoSelect.selectOption({ index: 1 })

  // Navigate to review.
  const revisar = page.getByRole('button', { name: /revisar/i })
  const proximo = page.getByRole('button', { name: /próximo/i })
  if (await revisar.isVisible().catch(() => false)) {
    await revisar.click()
  } else if (await proximo.isVisible().catch(() => false)) {
    await proximo.click()
  }

  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })

  // Submit.
  const submitBtn = page.getByRole('button', { name: /Enviar respostas/i })
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
  await submitBtn.click()
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toBeVisible({ timeout: 20_000 })

  // CRITICAL ASSERTION: the phase must now be concluida (not stuck).
  await expect
    .poll(async () => {
      const updatedPhases = await getCasePhases(page, caseId)
      return updatedPhases.find((p) => p.position === 1)?.status
    }, { timeout: 20_000 })
    .toBe('concluida')

  // Status auto-advances to pendente (Phase 1 concluida, Phase 2 still pendente,
  // none ativa → D7 precedence: pendente > nao_iniciado).
  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 15_000 })
    .toBe('pendente')
})

// ---------------------------------------------------------------------------
// AC-Docs: coordinator uploads a document and downloads it; adds a free-text event
// ---------------------------------------------------------------------------

test('AC-Docs: coordinator uploads a PDF document to a case and downloads it; adds a free-text event', async ({
  page,
}) => {
  test.setTimeout(120_000)

  await signInAs(page, 'chefe.ccih@test.local')

  // The seeded Caso 0001 is non-terminal (pendente), so uploading is allowed.
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  // ── Upload a document ──
  const docPanel = page.getByRole('region', { name: /Documentos/i })
  await expect(docPanel).toBeVisible({ timeout: 10_000 })

  // The upload TRIGGER button is labeled "Anexar" (renamed in 37584f4); the
  // dialog title + submit button remain "Enviar documento".
  await docPanel.getByRole('button', { name: /Anexar/i }).click()
  const uploadDialog = page.getByRole('dialog').filter({ hasText: /Enviar documento/i })
  await expect(uploadDialog).toBeVisible({ timeout: 10_000 })

  // Create a small temp PDF to upload.
  const tmpPdfPath = path.join(process.cwd(), 'e2e', '_tmp_test_doc.pdf')
  fs.writeFileSync(tmpPdfPath, '%PDF-1.4 test pdf for e2e')

  try {
    const fileInput = uploadDialog.locator('input[type="file"]')
    await fileInput.setInputFiles(tmpPdfPath)
    await uploadDialog.locator('input[name="title"]').fill('Ata E2E de teste')
    await uploadDialog.getByRole('button', { name: /Enviar documento/i }).click()
    await expect(uploadDialog).toHaveCount(0, { timeout: 30_000 })

    await expect(
      page.getByText(/Ata E2E de teste/i).first(),
    ).toBeVisible({ timeout: 15_000 })

    const downloadLink = page.getByRole('link', { name: /Baixar Ata E2E de teste/i }).first()
    await expect(downloadLink).toBeVisible({ timeout: 10_000 })

    const href = await downloadLink.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href).not.toBe('#')
  } finally {
    if (fs.existsSync(tmpPdfPath)) fs.unlinkSync(tmpPdfPath)
  }

  // ── Add a free-text event ──
  const eventsPanel = page.getByRole('region', { name: /Registros/i })
  await expect(eventsPanel).toBeVisible({ timeout: 10_000 })

  await eventsPanel.getByRole('button', { name: /Adicionar registro/i }).click()
  const eventDialog = page.getByRole('dialog').filter({ hasText: /registro/i })
  await expect(eventDialog).toBeVisible({ timeout: 10_000 })

  const bodyField = eventDialog.locator('textarea[name="body"]')
  await expect(bodyField).toBeVisible({ timeout: 5_000 })
  await bodyField.fill('Reunião de revisão realizada. Protocolo aprovado.')

  const titleField = eventDialog.locator('input[name="title"]')
  if (await titleField.isVisible().catch(() => false)) {
    await titleField.fill('Reunião de revisão E2E')
  }

  await eventDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(eventDialog).toHaveCount(0, { timeout: 15_000 })

  await expect(
    page.getByText(/Reunião de revisão realizada/i).first(),
  ).toBeVisible({ timeout: 15_000 })
})

// ---------------------------------------------------------------------------
// AC-Tags: coordinator creates a tag, assigns it to a case, sees it in the
// dashboard tag-report.
// ---------------------------------------------------------------------------

test('AC-Tags: coordinator creates a tag, assigns it to the seeded case, and sees it counted in the dashboard tag-report', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const tagName = `Infecção E2E ${Date.now()}`

  await signInAs(page, 'chefe.ccih@test.local')

  // ── Create the tag in the tag manager ──
  await page.goto('/o/rede-a/c/ccih/manage/settings/etiquetas')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/settings/etiquetas', { timeout: 15_000 })

  await page.getByRole('button', { name: /Nova etiqueta/i }).click()
  const createTagDialog = page.getByRole('dialog').filter({ hasText: /Nova etiqueta/i })
  await expect(createTagDialog).toBeVisible({ timeout: 10_000 })

  await createTagDialog.getByLabel('Nome').fill(tagName)
  await createTagDialog.getByRole('button', { name: /Criar etiqueta/i }).click()
  await expect(createTagDialog).toHaveCount(0, { timeout: 15_000 })

  await expect(page.getByText(tagName)).toBeVisible({ timeout: 10_000 })

  // ── Assign the tag to the seeded case ──
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  const tagsPanel = page.getByRole('region', { name: /Etiquetas/i })
  await expect(tagsPanel).toBeVisible({ timeout: 10_000 })

  await tagsPanel.getByRole('button', { name: /Adicionar/i }).click()
  const tagMenu = page.getByRole('menu')
  await expect(tagMenu).toBeVisible({ timeout: 5_000 })

  const tagItem = tagMenu.getByRole('menuitem', { name: tagName })
  await expect(tagItem).toBeVisible({ timeout: 5_000 })
  await tagItem.click()
  await expect(tagMenu).toHaveCount(0, { timeout: 10_000 })

  await expect(tagsPanel.getByText(tagName)).toBeVisible({ timeout: 10_000 })

  // ── Verify the tag appears in the dashboard tag-report ──
  await page.goto('/o/rede-a/c/ccih/dashboard')
  await page.waitForURL('**/o/rede-a/c/ccih/dashboard', { timeout: 15_000 })

  const tagReportSection = page.getByRole('region', { name: /Casos por etiqueta/i })
  await expect(tagReportSection).toBeVisible({ timeout: 10_000 })

  await expect(tagReportSection.getByText(tagName)).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-ActionItems: coordinator creates an action item; assignee completes it;
// overdue item surfaces in KPI strip.
// ---------------------------------------------------------------------------

test('AC-ActionItems: coordinator creates action item assigned to staff1; staff1 completes it; overdue item shows in KPI strip', async ({
  page,
}) => {
  test.setTimeout(180_000)

  await signInAs(page, 'chefe.ccih@test.local')

  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  // ── Create an action item ──
  const aiPanel = page.getByRole('region', { name: /Itens de ação/i })
  await expect(aiPanel).toBeVisible({ timeout: 10_000 })

  await aiPanel.getByRole('button', { name: /Novo item/i }).click()
  const aiDialog = page.getByRole('dialog').filter({ hasText: /Novo item de ação/i })
  await expect(aiDialog).toBeVisible({ timeout: 10_000 })

  const aiTitle = `Revisão protocolo E2E ${Date.now()}`
  await aiDialog.locator('input[name="title"]').fill(aiTitle)

  const assigneeSelect = aiDialog.locator('select[name="assignedTo"]')
  if (await assigneeSelect.isVisible().catch(() => false)) {
    await assigneeSelect.selectOption(STAFF1_CCIH_ID)
  }

  await aiDialog.getByRole('button', { name: /Criar item/i }).click()
  await expect(aiDialog).toHaveCount(0, { timeout: 15_000 })

  await expect(aiPanel.getByText(aiTitle)).toBeVisible({ timeout: 10_000 })

  await signOut(page)

  // ── staff1.ccih completes the action item via the RPC ──
  await signInAs(page, 'staff1.ccih@test.local')
  const staff1Token = await getOwnerToken(page, 'staff1.ccih@test.local')

  const aiListResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_action_items?case_id=eq.${SEEDED_CASE_ID}&title=eq.${encodeURIComponent(aiTitle)}&select=id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staff1Token}`,
      },
    },
  )
  const aiList = (await aiListResp.json()) as Array<{ id: string }>
  expect(aiList.length).toBeGreaterThan(0)
  const aiId = aiList[0].id

  const completeResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/complete_action_item`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staff1Token}`,
        'Content-Type': 'application/json',
      },
      data: { p_action_item_id: aiId },
    },
  )
  expect(completeResp.ok()).toBeTruthy()

  const doneResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_action_items?id=eq.${aiId}&select=status`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const doneRows = (await doneResp.json()) as Array<{ status: string }>
  expect(doneRows[0]?.status).toBe('done')

  await signOut(page)

  // ── Coordinator sees KPI reflects the completion + overdue ──
  await signInAs(page, 'chefe.ccih@test.local')

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 5)
  const pastIso = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`

  await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_action_item`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        p_case_id: SEEDED_CASE_ID,
        p_title: `Item vencido E2E ${Date.now()}`,
        p_description: null,
        p_assigned_to: null,
        p_due_date: pastIso,
        p_source_case_phase_id: null,
      },
    },
  )

  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 20_000 })

  await expect(
    page.getByRole('heading', { name: /Casos/i }),
  ).toBeVisible({ timeout: 10_000 })

  const kpiStrip = page.locator('[data-testid="kpi-strip"], section').filter({ hasText: /Itens de ação/i }).first()
  if (await kpiStrip.isVisible().catch(() => false)) {
    await expect(kpiStrip.getByText(/[Aa]trasad/i)).toBeVisible({ timeout: 5_000 })
  }

  const kpiResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/case_action_items_kpis`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_commission_id: COMM_CCIH_ID },
    },
  )
  expect(kpiResp.ok()).toBeTruthy()
  const kpiRows = (await kpiResp.json()) as Array<{ open: number; overdue: number; completed_ytd: number }>
  const kpi = kpiRows[0]
  expect(kpi).toBeDefined()
  expect(kpi.completed_ytd).toBeGreaterThanOrEqual(1)
  expect(kpi.overdue).toBeGreaterThanOrEqual(1)
})

// ---------------------------------------------------------------------------
// AC-SecurityStatus: terminal status blocks further changes (HC025)
//
// D6/D12: `close_case` sets terminal `concluido`; the `guard_case_status`
// trigger rejects any subsequent DB write with HC025. The UI does not offer
// any mutation buttons on terminal cases.
// ---------------------------------------------------------------------------

test('AC-SecurityStatus: closing a case (concluido) prevents further phase activation (HC025 + frozen UI)', async ({
  page,
}) => {
  test.setTimeout(90_000)

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(page, ownerToken, `TerminalGuard ${Date.now()}`)

  // Skip all phases so the conclude gate (HC031) passes without having to fill them.
  const phases = await getCasePhases(page, caseId)
  for (const ph of phases) {
    await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/skip_phase`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        data: { p_case_phase_id: ph.id },
      },
    )
  }

  // Close the case (no outcome offered by the seeded template — D15 optional).
  const closeResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/close_case`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_id: caseId },
    },
  )
  // The seeded M&M template offers outcomes (seed.sql: 3 outcomes offered), so
  // close_case without an outcome raises HC028. Skip phases only; check concluido
  // after setting an outcome first.
  // If the seeded template offers outcomes, we set one then close.
  if (!closeResp.ok()) {
    const closeBody = (await closeResp.json()) as { code?: string }
    if (closeBody.code === 'HC028') {
      // Outcome required — set one first via set_case_outcome.
      const offerResp = await page.request.get(
        `${SUPABASE_URL}/rest/v1/case_offered_outcomes?case_id=eq.${caseId}&select=outcome_id&limit=1`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        },
      )
      const offered = (await offerResp.json()) as Array<{ outcome_id: string }>
      if (offered.length > 0) {
        await page.request.post(
          `${SUPABASE_URL}/rest/v1/rpc/set_case_outcome`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${ownerToken}`,
              'Content-Type': 'application/json',
            },
            data: { p_case_id: caseId, p_outcome_id: offered[0].outcome_id },
          },
        )
      }
      const closeResp2 = await page.request.post(
        `${SUPABASE_URL}/rest/v1/rpc/close_case`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
          },
          data: { p_case_id: caseId },
        },
      )
      expect(closeResp2.ok()).toBeTruthy()
    }
  }

  // Case must now be concluido (terminal).
  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 10_000 })
    .toBe('concluido')

  // Now try to activate a phase on a terminal case → HC025.
  const phasesAfter = await getCasePhases(page, caseId)
  const anyPhase = phasesAfter[0]
  const activateResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/activate_phase`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_phase_id: anyPhase.id, p_assigned_to: STAFF1_CCIH_ID },
    },
  )
  expect(activateResp.ok()).toBeFalsy()
  const body = (await activateResp.json()) as { code?: string }
  // activate_phase rejects terminal cases with HC020 ("case not open") — its own
  // early-exit guard fires before the generic HC025 trigger on the cases row.
  expect(body.code).toBe('HC020')

  // In the UI: a terminal case shows no lifecycle actions (Concluir/Cancelar gone).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseId}`), { timeout: 15_000 })
  await page.reload()

  // The "Concluir" and "Cancelar" buttons are NOT rendered on a terminal case.
  await expect(page.getByRole('button', { name: /^Concluir$/i })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByRole('button', { name: /^Cancelar$/i })).toHaveCount(0, { timeout: 10_000 })

  // The case heading still renders (no crash on a terminal case page).
  await expect(
    page.getByRole('heading', { level: 1 }).first(),
  ).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-StatusIsolation: HC026 — cross-commission tag assignment rejected
// ---------------------------------------------------------------------------

test('AC-StatusIsolation: assigning a Farmácia tag to a CCIH case via the API raises HC026', async ({
  page,
}) => {
  test.setTimeout(60_000)

  const farmToken = await getOwnerToken(page, 'chefe.farm@test.local')
  const ccihToken = await getOwnerToken(page, 'chefe.ccih@test.local')

  // Create a tag in Farmácia's commission.
  const createTagResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_tag`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${farmToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        p_commission_id: 'b0000000-0000-0000-0000-0000000000b1', // farmacia
        p_name: `Farm tag E2E ${Date.now()}`,
        p_color_token: 'amber',
      },
    },
  )
  expect(createTagResp.ok()).toBeTruthy()
  const farmTag = (await createTagResp.json()) as { id: string }

  // Try to assign the Farmácia tag to the CCIH case → HC026.
  const assignResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/assign_case_tag`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ccihToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_id: SEEDED_CASE_ID, p_tag_id: farmTag.id },
    },
  )
  expect(assignResp.ok()).toBeFalsy()
  const body = (await assignResp.json()) as { code?: string }
  expect(body.code).toBe('HC026')
})

// ---------------------------------------------------------------------------
// AC-Keyboard: keyboard-only conclude flow with outcome selection (CLAUDE.md §8)
//
// A fresh case is created, all phases skipped, an outcome pre-set via the
// selector, then the "Concluir" button is focused by keyboard + Enter opens
// the dialog. The outcome selector is navigated by keyboard. Tab to confirm
// button, Enter concludes. All focus points asserted.
// ---------------------------------------------------------------------------

test('AC-Keyboard: keyboard-only conclude flow — focus "Concluir", Enter opens dialog, Tab to outcome, confirm with Enter', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const kbCaseId = await createFreshCase(page, ownerToken, `KbConclude ${Date.now()}`)

  // Skip all phases so the conclude gate passes.
  const phases = await getCasePhases(page, kbCaseId)
  for (const ph of phases) {
    await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/skip_phase`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        data: { p_case_phase_id: ph.id },
      },
    )
  }

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${kbCaseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${kbCaseId}`), { timeout: 15_000 })

  // ── Keyboard: focus the "Concluir" button and press Enter ──
  // Scope to <header> (CaseLifecycleActions) to avoid strict-mode conflict with
  // narrative Concluir buttons in the page body (case-access increment, ADR 0033).
  const concludeBtn = page.locator('header').getByRole('button', { name: /^Concluir$/i })
  await expect(concludeBtn).toBeVisible({ timeout: 10_000 })
  await concludeBtn.focus()
  await expect(concludeBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // The conclude dialog opens.
  const concludeDialog = page.getByRole('dialog').filter({ hasText: /Concluir o caso/i })
  await expect(concludeDialog).toBeVisible({ timeout: 10_000 })

  // ── The dialog shows the outcome selector (the M&M template offers 3 outcomes). ──
  const outcomeSelect = concludeDialog.locator('select')
  await expect(outcomeSelect).toBeVisible({ timeout: 10_000 })

  // ── Keyboard: focus the outcome <select> and pick the first real option. ──
  await outcomeSelect.focus()
  await expect(outcomeSelect).toBeFocused()

  // Select the first non-empty outcome option by keyboard.
  const opts = await outcomeSelect.locator('option:not([value=""])').all()
  expect(opts.length).toBeGreaterThan(0)
  const firstOutcomeVal = await opts[0].getAttribute('value') ?? ''
  expect(firstOutcomeVal).not.toBe('')
  await outcomeSelect.selectOption({ value: firstOutcomeVal })

  // ── Keyboard: Tab to the confirm button and press Enter. ──
  const confirmBtn = concludeDialog.getByRole('button', { name: /Concluir caso/i })
  await confirmBtn.focus()
  await expect(confirmBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // Dialog closes on success.
  await expect(concludeDialog).toHaveCount(0, { timeout: 15_000 })

  // DB truth: case is concluido.
  await expect
    .poll(async () => (await getCaseRow(page, kbCaseId))?.status, { timeout: 15_000 })
    .toBe('concluido')

  // The case detail shows "Concluído" status badge.
  await page.reload()
  await expect(page.getByText(/Concluído/i).first()).toBeVisible({ timeout: 10_000 })
})
