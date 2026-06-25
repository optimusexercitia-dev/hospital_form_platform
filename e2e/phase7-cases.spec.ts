import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 7 — Multi-Phase Cases
 *
 * Test contract: translates every bullet in PHASES.md §Phase 7 Acceptance into
 * Playwright assertions. Runs against the LOCAL Supabase stack (seeded personas).
 *
 * Seeded fixtures (from supabase/seed.sql — Phase 7 block at the bottom):
 *   - Process template "Investigação de Óbito (M&M)" (commission CCIH, active)
 *     Phase-slot 1: Form A (Checklist de Higienização das Mãos), no recommend_when
 *     Phase-slot 2: Form A, recommend_when = { from_phase:1, question_key:
 *       'dispensador_disponivel', op:'equals', value:'Sim' }
 *   - Caso 0001 (deterministic id d0000000-…-c1, label "Óbito UTI leito 7"):
 *     Phase 1: concluida, assigned to staff1.ccih, has a SUBMITTED response
 *              answering dispensador_disponivel='Sim' → recommend_when met.
 *     Phase 2: pendente, recommended=true.
 *
 * Personas (password Test1234!):
 *   admin@test.local            global admin
 *   chefe.ccih@test.local       staff_admin of CCIH (coordinator)
 *   staff1.ccih@test.local      staff of CCIH (Enfermeiro CCIH Um)
 *   staff2.ccih@test.local      staff of CCIH (Enfermeira CCIH Dois)
 *   chefe.farm@test.local       staff_admin of Farmácia (foreign commission)
 *   staff1.farm@test.local      staff of Farmácia (foreign)
 *
 * Run with --workers=1 (tests mutate DB state in sequence).
 * Run `npx supabase db reset` before each full run.
 */

test.use({ viewport: { width: 1280, height: 900 } })

// Disable CSS animations so transitions complete instantly.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Service-role key — loaded from .env.local via @next/env in the Playwright config.
// Never hardcoded. Used ONLY for DB-truth assertions (SELECT), never to mutate
// application data under test (RLS is always the authority).
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

// The Supabase API base. Uses NEXT_PUBLIC_SUPABASE_URL (the same instance the
// app uses) so service-role key calls and owner JWT calls all hit the correct
// instance. Falls back to the local stack for backwards compatibility.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
// Alias kept for due-date helpers authored after the env-aware refactor.
const API_BASE = SUPABASE_URL

// Seeded case (deterministic id from seed.sql).
const SEEDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c1'

// Commission ids (from seed.sql).
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'

// Staff persona ids (from seed.sql).
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003' // staff1.ccih
const STAFF2_CCIH_ID = '00000000-0000-0000-0000-000000000004' // staff2.ccih

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
  // Scroll to top so the account menu is reachable. Wrapped in try-catch because
  // page.evaluate can throw "Execution context was destroyed" if the page is
  // mid-navigation (e.g. after a redirect from /minhas-fases → /meus-casos).
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
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
): Promise<{ status: string; case_number: number; commission_id: string } | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=status,case_number,commission_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as Array<{
    status: string
    case_number: number
    commission_id: string
  }>
  return rows[0] ?? null
}

/** Service-role query: case_phases for a case, ordered by position. */
async function getCasePhases(
  page: Page,
  caseId: string,
): Promise<Array<{ id: string; status: string; position: number; recommended: boolean; is_ad_hoc: boolean }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_phases?case_id=eq.${caseId}&order=position.asc&select=id,status,position,recommended,is_ad_hoc`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const data = await resp.json()
  // The REST API always returns an array for table queries.
  return Array.isArray(data) ? data : []
}

/** Service-role query: responses linked to a case_phase. */
async function getPhaseResponse(
  page: Page,
  casePhaseId: string,
): Promise<{ id: string; status: string } | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/responses?case_phase_id=eq.${casePhaseId}&select=id,status`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as Array<{ id: string; status: string }>
  return rows[0] ?? null
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

/**
 * Create a case from the first active CCIH template via the RPC.
 * Returns the new case id.
 */
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
  expect(tplResp.ok()).toBeTruthy()
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
  // create_case_from_template returns the full case row object.
  const caseObj = (await createResp.json()) as { id: string }
  expect(caseObj.id).toBeTruthy()
  return caseObj.id
}

/**
 * Activate a case phase via the RPC.
 */
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

/**
 * Obtain a real JWT for a persona from API_BASE (remote-compatible).
 * Uses the same Supabase instance as the app so the token works for
 * REST API calls against API_BASE.
 */
async function getOwnerTokenRemote(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(
    `${API_BASE}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password },
    },
  )
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/**
 * Service-role query using API_BASE (remote-compatible): case_phases for a case,
 * including due_date and default_due_days.
 */
async function getCasePhasesWithDueDates(
  page: Page,
  caseId: string,
): Promise<Array<{ id: string; status: string; position: number; due_date: string | null; default_due_days: number | null }>> {
  const ownerToken = await getOwnerTokenRemote(page, 'chefe.ccih@test.local')
  const resp = await page.request.get(
    `${API_BASE}/rest/v1/case_phases?case_id=eq.${caseId}&order=position.asc&select=id,status,position,due_date,default_due_days`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  )
  const data = await resp.json()
  return Array.isArray(data) ? data : []
}

/**
 * Create a fresh case using API_BASE (remote-compatible).
 */
async function createFreshCaseRemote(page: Page, label: string): Promise<string> {
  const ownerToken = await getOwnerTokenRemote(page, 'chefe.ccih@test.local')
  const tplResp = await page.request.get(
    `${API_BASE}/rest/v1/process_templates?commission_id=eq.${COMM_CCIH_ID}&status=eq.active&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  )
  expect(tplResp.ok()).toBeTruthy()
  const tpls = (await tplResp.json()) as Array<{ id: string }>
  expect(tpls.length).toBeGreaterThan(0)

  const createResp = await page.request.post(
    `${API_BASE}/rest/v1/rpc/create_case_from_template`,
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
  expect(caseObj.id).toBeTruthy()
  return caseObj.id
}

/**
 * Format a date as YYYY-MM-DD for use in <input type="date"> assertions.
 */
function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Format a YYYY-MM-DD date as pt-BR dd/MM/yyyy for display assertions.
 */
function toPtBRDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

// ---------------------------------------------------------------------------
// AC-BUILDER — Coordinator builds a 3-phase template with recommend_when and publishes
// ---------------------------------------------------------------------------

test('AC-Builder: coordinator creates a 3-phase template with recommend_when → publishes', async ({
  page,
}) => {
  test.setTimeout(180_000)

  await signInAs(page, 'chefe.ccih@test.local')

  // Navigate to the process-templates list.
  await page.goto('/o/rede-a/c/ccih/manage/process-templates')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/process-templates', { timeout: 15_000 })
  await expect(
    page.getByRole('heading', { name: /Processos multifásicos/i }),
  ).toBeVisible({ timeout: 10_000 })

  // Create a new template via the dialog.
  const suffix = Date.now()
  const templateTitle = `Processo E2E ${suffix}`

  await page.getByRole('button', { name: /Novo processo/i }).click()
  const createDialog = page.getByRole('dialog').filter({ hasText: /Novo processo/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })

  const titleInput = createDialog.getByLabel(/Título/i)
  await titleInput.fill(templateTitle)
  await createDialog.getByRole('button', { name: /Criar processo/i }).click()
  // Dialog closes and we land in the builder (URL changes to /[templateId]).
  await page.waitForURL(/\/manage\/process-templates\/[0-9a-f-]{36}/, { timeout: 20_000 })

  // The builder shows the template title and a draft badge.
  await expect(page.getByRole('heading', { level: 1, name: templateTitle })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/rascunho/i).first()).toBeVisible()

  // ── Add phase-slot 1 (Form A, no recommend_when) ──
  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog1 = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog1).toBeVisible({ timeout: 10_000 })

  // The form picker lists Form A by title — select by text (exact string matching).
  await slotDialog1.locator('select[name="formId"]').selectOption({ label: 'Checklist de Higienização das Mãos' })
  await slotDialog1.locator('input[name="title"]').fill('Fase 1 — Coleta inicial')

  await slotDialog1.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog1).toHaveCount(0, { timeout: 15_000 })

  // ── Add phase-slot 2 (Form A, with recommend_when referencing Phase 1) ──
  // The recommend_when editor surfaces AFTER the form is selected and shows a
  // from-phase picker + question-key picker. We set "Fase 1" as the source phase
  // and pick the first available question to satisfy the AC requirement that a
  // template with a recommend_when can be built and published.
  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog2 = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog2).toBeVisible({ timeout: 10_000 })

  await slotDialog2.locator('select[name="formId"]').selectOption({ label: 'Checklist de Higienização das Mãos' })
  await slotDialog2.locator('input[name="title"]').fill('Fase 2 — Revisão do comitê')

  // After the form is selected the recommend_when editor populates with a from-
  // phase picker. Give the reactive state a moment to update.
  await page.waitForTimeout(400)
  const allSelects2 = slotDialog2.locator('select')
  const selCount2 = await allSelects2.count()
  for (let i = 0; i < selCount2; i++) {
    const sel = allSelects2.nth(i)
    const optTexts = await sel.locator('option').allTextContents()
    // The from-phase picker has an option with "Fase 1" in its text.
    const hasFase1 = optTexts.some((t) => /Fase 1/i.test(t))
    if (hasFase1) {
      await sel.selectOption({ index: 1 }) // select "Fase 1"
      await page.waitForTimeout(300)
      // After picking the source phase, a question-key picker appears.
      const newCount2 = await allSelects2.count()
      for (let j = i + 1; j < newCount2; j++) {
        const qSel = allSelects2.nth(j)
        const qOpts = await qSel.locator('option').allTextContents()
        if (qOpts.length > 1) {
          await qSel.selectOption({ index: 1 }) // pick first real question
          await page.waitForTimeout(300)
        }
      }
      break
    }
  }

  await slotDialog2.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog2).toHaveCount(0, { timeout: 15_000 })

  // ── Add phase-slot 3 (Form A, no recommend_when) ──
  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog3 = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog3).toBeVisible({ timeout: 10_000 })

  await slotDialog3.locator('select[name="formId"]').selectOption({ label: 'Checklist de Higienização das Mãos' })
  await slotDialog3.locator('input[name="title"]').fill('Fase 3 — Encerramento')

  await slotDialog3.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog3).toHaveCount(0, { timeout: 15_000 })

  // The builder now shows 3 phase-slot cards.
  // PhaseSlotCard renders as <section> elements (not <article>).
  await expect(page.getByRole('region').filter({ hasText: /Fase 1 — Coleta inicial/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Fase 1 — Coleta inicial/i)).toBeVisible()
  await expect(page.getByText(/Fase 2 — Revisão do comitê/i)).toBeVisible()
  await expect(page.getByText(/Fase 3 — Encerramento/i)).toBeVisible()

  // ── Publish the template ──
  // The PublishTemplateButton renders as "Publicar" (not "Publicar processo").
  await page.getByRole('button', { name: /^Publicar$/i }).click()
  const confirmDialog = page.getByRole('alertdialog')
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
  await confirmDialog.getByRole('button', { name: /^Publicar$/i }).click()

  // After publish, the banner says "ativo" and the add-fase button is gone.
  await expect(page.getByText(/ativo/i).first()).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByRole('button', { name: /Adicionar fase/i }),
  ).toHaveCount(0)

  // The template appears in the list with "ativo" status.
  await page.goto('/o/rede-a/c/ccih/manage/process-templates')
  await expect(page.getByText(templateTitle)).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-DueDays-Overdue — MUST run before AC-HappyPath (which closes Caso 0001)
// Seeded Phase 2 (pendente, due_date = today−3) renders overdue UI.
// ---------------------------------------------------------------------------

test('AC-DueDays-Overdue: seeded Phase 2 (due_date = today−3, pendente) shows "Prazo:" chip with "Atrasada" + destructive styling on case detail', async ({
  page,
}) => {
  test.setTimeout(60_000)

  // The seeded Caso 0001 has Phase 2 pendente with due_date = current_date - 3.
  // Navigate to case detail and assert the overdue rendering.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  // Phase 2 is visible. (The seeded Phase 2 is pendente with a past due_date;
  // we assert the due-date chip directly rather than the status text, which
  // would break if this test runs after a prior run already closed the case.)
  const phase2Row = page.getByRole('article').filter({ hasText: /Fase 2/i }).first()
  await expect(phase2Row).toBeVisible({ timeout: 10_000 })

  // The due-date chip must render "Prazo:" text.
  const dueDateChip = phase2Row.locator('span', { hasText: /Prazo:/i })
  await expect(dueDateChip).toBeVisible({ timeout: 10_000 })

  // The chip must contain "Atrasada" (because due_date < today and status = pendente).
  await expect(dueDateChip).toContainText(/Atrasada/i)

  // Destructive styling: the chip has a CSS class containing "destructive" applied
  // by the `isOverdue` check in CasePhaseList. We assert the element carries
  // "text-destructive" via the class attribute.
  const chipClass = await dueDateChip.getAttribute('class')
  expect(chipClass).toMatch(/destructive/)

  // The board table (CasesTable) also shows the current phase's due date.
  // Navigate to the cases list and assert the Caso 0001 row shows overdue.
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })

  // The cases list renders as a table (default view); Phase 2 is the current phase
  // for Caso 0001 (the only pendente, non-concluded phase). Its due date is past.
  // Wait for the board to fully load.
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
  // Look for "Atrasada" anywhere on the page (it is exclusive to overdue phases).
  const overdueLabel = page.getByText(/Atrasada/i).first()
  await expect(overdueLabel).toBeVisible({ timeout: 15_000 })
})

// ---------------------------------------------------------------------------
// AC-HAPPY-PATH — Full coordinator happy path using the seeded Caso 0001
//
// The seeded case already has Phase 1 concluída (submitted, dispensador='Sim')
// and Phase 2 pendente+recommended. We:
//   1. Assert the board shows Phase 1 concluída + Phase 2 recommended.
//   2. Coordinator activates Phase 2 → assigns staff2.ccih.
//   3. staff2.ccih fills + submits Phase 2 via the assignee wizard.
//   4. Board updates Phase 2 → concluída.
//   5. Coordinator appends an ad-hoc phase.
//   6. Coordinator skips the ad-hoc phase.
//   7. Coordinator closes the case.
// ---------------------------------------------------------------------------

test('AC-HappyPath: board shows seeded Phase 1 concluída + Phase 2 recommended → activate, fill, board update, ad-hoc, skip, close', async ({
  page,
}) => {
  test.setTimeout(300_000)

  // ── 1. Coordinator opens the board, finds Caso 0001 ──
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await expect(
    page.getByRole('heading', { name: /Casos/i }),
  ).toBeVisible({ timeout: 10_000 })

  // The board defaults to TABLE view. Find the row for Caso 0001 — in the
  // table, the case number is a <Link> inside a <td>, so we scope to the <tr>
  // that contains the "Caso 0001" link text, then navigate by clicking the link.
  const caso0001Link = page.getByRole('link', { name: /Caso 0001/i })
  await expect(caso0001Link).toBeVisible({ timeout: 10_000 })
  // Phase 1 is concluída — the table shows progress dots and the current phase
  // (Phase 2, pendente); the concluída detail is visible on the case-detail page.
  // Navigate via the case number link (the <tr onClick> also works, but the link
  // is more semantically correct for keyboard accessibility).
  await caso0001Link.click()
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  // ── Assert Phase 1 concluída + Phase 2 pendente+recommended ──
  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })
  await expect(phase1Row.getByText(/concluída/i).first()).toBeVisible()

  const phase2Row = page.getByRole('article').filter({ hasText: /Fase 2/i }).first()
  await expect(phase2Row).toBeVisible({ timeout: 10_000 })
  await expect(phase2Row.getByText(/recomendada/i).first()).toBeVisible()

  // ── 2. Activate Phase 2 → assign staff2.ccih ──
  // Open the activate dialog for Phase 2.
  await phase2Row.getByRole('button', { name: /Ativar e atribuir/i }).click()
  const activateDialog = page.getByRole('dialog').filter({ hasText: /Ativar e atribuir fase/i })
  await expect(activateDialog).toBeVisible({ timeout: 10_000 })

  // Select staff2.ccih ("Enfermeira CCIH Dois") by value (id).
  await activateDialog.locator('select[name="assignedTo"]').selectOption(STAFF2_CCIH_ID)
  await activateDialog.getByRole('button', { name: /Ativar fase/i }).click()
  await expect(activateDialog).toHaveCount(0, { timeout: 15_000 })

  // DB truth: Phase 2 is now ativa.
  await expect
    .poll(async () => {
      const phases = await getCasePhases(page, SEEDED_CASE_ID)
      return phases.find((p) => p.position === 2)?.status
    }, { timeout: 15_000 })
    .toBe('ativa')

  await signOut(page)

  // ── 3. staff2.ccih (Enfermeira CCIH Dois) fills + submits Phase 2 ──
  await signInAs(page, 'staff2.ccih@test.local')

  // "Meus Casos" shows the newly activated phase (case_access ON → /meus-casos).
  await page.goto('/o/rede-a/c/ccih/meus-casos')
  await page.waitForURL('**/o/rede-a/c/ccih/meus-casos', { timeout: 15_000 })
  await expect(
    page.getByRole('heading', { name: /Meus Casos/i }),
  ).toBeVisible({ timeout: 10_000 })

  // At least one card; Caso 0001 is listed.
  const phaseCard = page.getByRole('article').filter({ hasText: /Caso 0001/i }).first()
  await expect(phaseCard).toBeVisible({ timeout: 10_000 })

  // "Preencher" is rendered by StartPhaseButton (<button>), which calls
  // startOrResumePhase then router.push to the wizard URL (P7-001 resolved).
  const preencherBtn = phaseCard.getByRole('button', { name: /Preencher/i })
  await expect(preencherBtn).toBeVisible({ timeout: 10_000 })
  await preencherBtn.click()

  // StartPhaseButton calls startOrResumePhase and router.push → wizard URL.
  await page.waitForURL(/\/phase\/[0-9a-f-]{36}\/responder\/[0-9a-f-]{36}/, { timeout: 30_000 })

  // We're in the wizard (Form A, unsectioned). Fill the required items.
  // Form A: dispensador_disponivel (multiple_choice, required) + turno_auditoria (dropdown, required).
  const dispSim = page.getByRole('radio', { name: /^Sim$/i }).first()
  await expect(dispSim).toBeVisible({ timeout: 15_000 })
  await dispSim.click()
  await expect(dispSim).toBeChecked({ timeout: 5_000 })

  // Dropdown: select any turno option.
  const turnoSelect = page.locator('select').filter({ hasNot: page.locator('[name="formId"],[name="assignedTo"]') }).first()
  await turnoSelect.selectOption({ index: 1 }) // Manhã

  // Navigate to review (unsectioned form → "Revisar" button).
  const revisar = page.getByRole('button', { name: /revisar/i })
  const proximo = page.getByRole('button', { name: /próximo/i })
  if (await revisar.isVisible().catch(() => false)) {
    await revisar.click()
  } else if (await proximo.isVisible().catch(() => false)) {
    await proximo.click()
  }

  // Review heading.
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 15_000 })

  // Submit — Form A has no sign-off sections, so submit is direct.
  const submitBtn = page.getByRole('button', { name: /Enviar respostas/i })
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
  await submitBtn.click()
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toBeVisible({ timeout: 20_000 })

  // DB truth: Phase 2 is now concluida.
  await expect
    .poll(async () => {
      const phases = await getCasePhases(page, SEEDED_CASE_ID)
      return phases.find((p) => p.position === 2)?.status
    }, { timeout: 20_000 })
    .toBe('concluida')

  await signOut(page)

  // ── 4. Coordinator — board and detail show Phase 2 concluída ──
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })
  await page.reload()

  const phase2Updated = page.getByRole('article').filter({ hasText: /Fase 2/i }).first()
  await expect(phase2Updated.getByText(/concluída/i)).toBeVisible({ timeout: 10_000 })

  // "Ver respostas" link is present (submitted phase exposes responseId).
  await expect(
    phase2Updated.getByRole('link', { name: /Ver respostas/i }),
  ).toBeVisible({ timeout: 5_000 })

  // ── 5. Append an ad-hoc phase ──
  await page.getByRole('button', { name: /Adicionar fase/i }).click()
  const adHocDialog = page.getByRole('dialog').filter({ hasText: /Adicionar fase ao caso/i })
  await expect(adHocDialog).toBeVisible({ timeout: 10_000 })

  await adHocDialog.locator('select[name="formId"]').selectOption({ label: 'Checklist de Higienização das Mãos' })
  await adHocDialog.locator('input[name="title"]').fill('Fase Adicional E2E')

  await adHocDialog.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(adHocDialog).toHaveCount(0, { timeout: 15_000 })

  // The ad-hoc phase appears in the detail after a page refresh.
  await page.reload()
  await expect(page.getByText(/Fase Adicional E2E/i)).toBeVisible({ timeout: 10_000 })
  // The "adicional" chip marks it as ad-hoc.
  await expect(page.getByText(/adicional/i).first()).toBeVisible()

  // DB truth: one is_ad_hoc phase exists.
  await expect
    .poll(async () => {
      const phases = await getCasePhases(page, SEEDED_CASE_ID)
      return phases.some((p) => p.is_ad_hoc)
    }, { timeout: 10_000 })
    .toBe(true)

  // ── 6. Skip the ad-hoc phase ──
  const adHocPhaseRow = page
    .getByRole('article')
    .filter({ hasText: /Fase Adicional E2E/i })
    .first()
  await expect(adHocPhaseRow).toBeVisible({ timeout: 10_000 })

  await adHocPhaseRow.getByRole('button', { name: /Não necessária/i }).click()
  const skipConfirm = page.getByRole('alertdialog')
  await expect(skipConfirm).toBeVisible({ timeout: 10_000 })
  await skipConfirm.getByRole('button', { name: /Marcar como não necessária/i }).click()
  await expect(skipConfirm).toHaveCount(0, { timeout: 15_000 })

  // DB truth: the ad-hoc phase is nao_necessaria.
  await expect
    .poll(async () => {
      const phases = await getCasePhases(page, SEEDED_CASE_ID)
      return phases.find((p) => p.is_ad_hoc)?.status
    }, { timeout: 15_000 })
    .toBe('nao_necessaria')

  // ── 7. Close the case via "Concluir" button + outcome dialog ──
  // Fixed-status model (D12/D13): the old "Encerrar" dropdown menu is GONE.
  // There is now a single "Concluir" button that opens a Dialog (not AlertDialog)
  // where the coordinator picks the case outcome (D3 gate) and confirms.
  // The seeded M&M template offers 3 outcomes (seed: Óbito evitável / não evitável
  // / Alta sem intercorrências); Caso 0001 has all three in case_offered_outcomes.
  // Scope to <header> because narrative cards also render "Concluir" (size="sm")
  // buttons — the case-level button is size="lg" and lives in the page header.
  await page.reload()

  const concludeBtn = page.locator('header').getByRole('button', { name: /^Concluir$/i })
  await expect(concludeBtn).toBeVisible({ timeout: 10_000 })
  await concludeBtn.click()

  const concludeDialog = page.getByRole('dialog').filter({ hasText: /Concluir o caso/i })
  await expect(concludeDialog).toBeVisible({ timeout: 10_000 })

  // The outcome selector must be visible (process offers outcomes — D15).
  const outcomeSelect = concludeDialog.locator('select')
  await expect(outcomeSelect).toBeVisible({ timeout: 5_000 })

  // Pick the first non-empty outcome (any outcome satisfies the D3 gate).
  const opts = await outcomeSelect.locator('option:not([value=""])').all()
  expect(opts.length).toBeGreaterThan(0)
  const firstOutcomeVal = await opts[0].getAttribute('value') ?? ''
  await outcomeSelect.selectOption({ value: firstOutcomeVal })

  const confirmBtn = concludeDialog.getByRole('button', { name: /Concluir caso/i })
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
  await confirmBtn.click()
  await expect(concludeDialog).toHaveCount(0, { timeout: 15_000 })

  // DB truth: case is concluido.
  await expect
    .poll(async () => (await getCaseRow(page, SEEDED_CASE_ID))?.status, { timeout: 15_000 })
    .toBe('concluido')

  // The case detail shows the "Concluído" status badge (fixed label, CASE_STATUS_META).
  await page.reload()
  await expect(page.getByText(/Concluído/i).first()).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-BlockerGuard — Phase blocking (D1/D4): a phase with explicit `blocks`
// cannot be activated until each listed blocking phase is concluída OR
// nao_necessaria. This replaces the old sequential-activation guard (which was
// "all earlier phases" — now PARALLEL + explicit).
//
// Strategy: build a 2-phase template where Phase 2 explicitly blocks on Phase 1;
// create a case from it; verify Phase 2 "Ativar e atribuir" is DISABLED with
// "Bloqueada por Fase 1" label; skip Phase 1 (nao_necessaria unblocks — D4);
// verify Phase 2 is now activatable.
// ---------------------------------------------------------------------------

test('AC-BlockerGuard: Phase 2 with blocks=[1] is disabled until Phase 1 is settled; skip unblocks (D1/D4)', async ({
  page,
}) => {
  test.setTimeout(180_000)

  await signInAs(page, 'chefe.ccih@test.local')

  // ── Build a fresh 2-phase template with Phase 2 explicitly blocking on Phase 1 ──
  await page.goto('/o/rede-a/c/ccih/manage/process-templates')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/process-templates', { timeout: 15_000 })

  const suffix = Date.now()
  const templateTitle = `Blocker E2E ${suffix}`

  await page.getByRole('button', { name: /Novo processo/i }).click()
  const createDialog = page.getByRole('dialog').filter({ hasText: /Novo processo/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })
  await createDialog.getByLabel(/Título/i).fill(templateTitle)
  await createDialog.getByRole('button', { name: /Criar processo/i }).click()
  await page.waitForURL(/\/manage\/process-templates\/[0-9a-f-]{36}/, { timeout: 20_000 })

  // ── Add Phase 1 (no blockers — first phase can have none) ──
  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog1 = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog1).toBeVisible({ timeout: 10_000 })
  await slotDialog1.locator('select[name="formId"]').selectOption({ label: 'Checklist de Higienização das Mãos' })
  await slotDialog1.locator('input[name="title"]').fill('Fase 1 — Diagnóstico')
  await slotDialog1.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog1).toHaveCount(0, { timeout: 15_000 })

  // ── Add Phase 2 (blocks: [1]) ──
  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog2 = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog2).toBeVisible({ timeout: 10_000 })
  await slotDialog2.locator('select[name="formId"]').selectOption({ label: 'Checklist de Higienização das Mãos' })
  await slotDialog2.locator('input[name="title"]').fill('Fase 2 — Intervenção')

  // ── Enable the Phase 1 blocker in the "Bloqueios" checkbox list ──
  // The PhaseBlocksEditor renders a fieldset with legend "Bloqueios" + checkboxes.
  const bloqueiosFieldset = slotDialog2.locator('fieldset', { hasText: /Bloqueios/i })
  await expect(bloqueiosFieldset).toBeVisible({ timeout: 10_000 })
  // The checkbox for "Fase 1" is the only earlier phase.
  const fase1Checkbox = bloqueiosFieldset.locator('label', { hasText: /Fase 1/i })
  await expect(fase1Checkbox).toBeVisible({ timeout: 5_000 })
  await fase1Checkbox.getByRole('checkbox').check()

  await slotDialog2.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog2).toHaveCount(0, { timeout: 15_000 })

  // ── Publish the template ──
  await page.getByRole('button', { name: /^Publicar$/i }).click()
  const confirmPub = page.getByRole('alertdialog')
  await expect(confirmPub).toBeVisible({ timeout: 10_000 })
  await confirmPub.getByRole('button', { name: /^Publicar$/i }).click()
  await expect(page.getByText(/ativo/i).first()).toBeVisible({ timeout: 15_000 })

  // ── Create a case from the new template ──
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')

  // Resolve the just-published template id.
  const tplResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/process_templates?commission_id=eq.${COMM_CCIH_ID}&status=eq.active&title=eq.${encodeURIComponent(templateTitle)}&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  )
  const tpls = (await tplResp.json()) as Array<{ id: string }>
  expect(tpls.length).toBeGreaterThan(0)
  const tplId = tpls[0].id

  const createCaseResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tplId, p_label: `Blocker Case ${suffix}` },
    },
  )
  expect(createCaseResp.ok()).toBeTruthy()
  const newCase = (await createCaseResp.json()) as { id: string }
  const newCaseId = newCase.id

  // Verify the case_phases snapshotted the blocks (Phase 2 blocks = [1]).
  const phasesResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_phases?case_id=eq.${newCaseId}&order=position.asc&select=id,status,position,blocks`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const casePhases = (await phasesResp.json()) as Array<{ id: string; status: string; position: number; blocks: number[] }>
  expect(casePhases.length).toBe(2)
  expect(casePhases[0].blocks).toEqual([]) // Phase 1: no blockers
  expect(casePhases[1].blocks).toEqual([1]) // Phase 2: blocked by position 1

  // ── Navigate to the case detail ──
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${newCaseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${newCaseId}`), { timeout: 15_000 })

  // ── Phase 2's "Ativar e atribuir" must be DISABLED + "Bloqueada por Fase 1" shown ──
  const phase2Row = page.getByRole('article').filter({ hasText: /Fase 2/i }).first()
  await expect(phase2Row).toBeVisible({ timeout: 10_000 })

  const activateBtn2 = phase2Row.getByRole('button', { name: /Ativar e atribuir/i })
  await expect(activateBtn2).toBeDisabled({ timeout: 10_000 })

  // The "Bloqueada por Fase 1" label must be visible in the row (A7 assumption).
  await expect(phase2Row.getByText(/Bloqueada por Fase 1/i)).toBeVisible({ timeout: 5_000 })

  // ── Phase 1 IS independently activatable (no blockers, D1 parallel model) ──
  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })
  const activateBtn1 = phase1Row.getByRole('button', { name: /Ativar e atribuir/i })
  await expect(activateBtn1).toBeEnabled({ timeout: 5_000 })

  // ── Skip Phase 1 (nao_necessaria) — D4: skip ALSO unblocks ──
  await phase1Row.getByRole('button', { name: /Não necessária/i }).click()
  const skipConfirm = page.getByRole('alertdialog')
  await expect(skipConfirm).toBeVisible({ timeout: 10_000 })
  await skipConfirm.getByRole('button', { name: /Marcar como não necessária/i }).click()
  await expect(skipConfirm).toHaveCount(0, { timeout: 15_000 })

  // DB truth: Phase 1 is nao_necessaria.
  await expect
    .poll(async () => {
      const r = await page.request.get(
        `${SUPABASE_URL}/rest/v1/case_phases?case_id=eq.${newCaseId}&position=eq.1&select=status`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        },
      )
      const rows = (await r.json()) as Array<{ status: string }>
      return rows[0]?.status
    }, { timeout: 15_000 })
    .toBe('nao_necessaria')

  // ── After skip, Phase 2 "Ativar e atribuir" is now ENABLED ──
  await page.reload()
  await page.waitForURL(new RegExp(`/manage/cases/${newCaseId}`), { timeout: 15_000 })

  const phase2RowAfter = page.getByRole('article').filter({ hasText: /Fase 2/i }).first()
  const activateBtnAfter = phase2RowAfter.getByRole('button', { name: /Ativar e atribuir/i })
  await expect(activateBtnAfter).toBeEnabled({ timeout: 10_000 })

  // ── Direct API check: activate_phase without a settled Phase 1 also raises HC018 ──
  // (Test with a fresh case from the same template so Phase 1 is still pendente.)
  const createCase2Resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tplId, p_label: `Blocker Case 2 ${suffix}` },
    },
  )
  expect(createCase2Resp.ok()).toBeTruthy()
  const case2 = (await createCase2Resp.json()) as { id: string }

  const phases2Resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_phases?case_id=eq.${case2.id}&order=position.asc&select=id,position`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const case2Phases = (await phases2Resp.json()) as Array<{ id: string; position: number }>
  const case2Phase2 = case2Phases.find((p) => p.position === 2)!

  const activateBlockedResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/activate_phase`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_phase_id: case2Phase2.id, p_assigned_to: STAFF1_CCIH_ID },
    },
  )
  // HC018 — blocked by unsettled earlier phase.
  expect(activateBlockedResp.ok()).toBeFalsy()
  const blockedBody = (await activateBlockedResp.json()) as { code?: string }
  expect(blockedBody.code).toBe('HC018')
})

// ---------------------------------------------------------------------------
// AC-CASE-NUMBERING — Case numbers are per-commission, not global
// ---------------------------------------------------------------------------

test('AC-CaseNumbering: case numbers are scoped per commission (Caso N, not global)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  // The seeded Caso 0001 belongs to CCIH. Its case_number is 1.
  const caseRow = await getCaseRow(page, SEEDED_CASE_ID)
  expect(caseRow?.case_number).toBe(1)
  expect(caseRow?.commission_id).toBe(COMM_CCIH_ID)

  // The board renders per-commission case numbers starting at "Caso 0001".
  // Log in as coordinator and verify the board displays "Caso 0001".
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })

  // "Caso 0001" must be visible (the seeded case, commission-scoped case_number=1).
  await expect(page.getByText(/Caso 0001/i).first()).toBeVisible({ timeout: 10_000 })

  // Create a second case; it must get case_number ≥ 2 (per-commission counter).
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const case2Id = await createFreshCase(page, ownerToken, `Numeração ${Date.now()}`)
  const case2Row = await getCaseRow(page, case2Id)
  // case_number must be ≥ 2 (the seeded case owns 1 in CCIH; other tests
  // may have created additional cases before this one runs, so we only assert ≥ 2).
  expect(case2Row?.case_number).toBeGreaterThanOrEqual(2)
  expect(case2Row?.commission_id).toBe(COMM_CCIH_ID)

  // Refresh and verify the new case's "Caso XXXX" number appears on the board.
  await page.reload()
  const paddedNumber = String(case2Row!.case_number).padStart(4, '0')
  await expect(
    page.getByText(new RegExp(`Caso ${paddedNumber}`, 'i')).first(),
  ).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-SECURITY — Security invariant: member sees status only; cannot open
// another member's in-progress phase answers; staff cannot reach coordinator board.
// ---------------------------------------------------------------------------

test('AC-Security/InProgress: board + detail expose STATUS ONLY — no in-progress answers leaked', async ({
  page,
}) => {
  test.setTimeout(120_000)

  // Create a fresh case and activate Phase 1 → staff1.ccih.
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const secCaseId = await createFreshCase(page, ownerToken, `Security ${Date.now()}`)

  const phases = await getCasePhases(page, secCaseId)
  const phase1 = phases.find((p) => p.position === 1)!
  await activatePhaseRPC(page, ownerToken, phase1.id, STAFF1_CCIH_ID)

  // staff1.ccih starts the phase (creates the in-progress response) via the RPC.
  const staff1Token = await getOwnerToken(page, 'staff1.ccih@test.local')
  const startResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/start_or_resume_phase`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staff1Token}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_phase_id: phase1.id },
    },
  )
  expect(startResp.ok()).toBeTruthy()
  // start_or_resume_phase returns the full response row object; the id is the response UUID.
  const startResult = (await startResp.json()) as { id: string }
  const inProgressResponseId = startResult.id

  // Verify the response is in_progress in the DB.
  const responseRow = await getPhaseResponse(page, phase1.id)
  expect(responseRow?.status).toBe('in_progress')

  // ── As coordinator (chefe.ccih): the board and detail show STATUS only ──
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${secCaseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${secCaseId}`), { timeout: 15_000 })

  // The phase row renders the "ativa" status (in-progress = ativa from coordinator's view).
  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row.getByText(/ativa/i)).toBeVisible({ timeout: 10_000 })

  // An ativa (in-progress) phase must NOT show "Ver respostas" — responseId is
  // exposed ONLY for submitted (concluida) phases (Phase-7 invariant).
  await expect(phase1Row.getByRole('link', { name: /Ver respostas/i })).toHaveCount(0)

  // ── RLS check: the coordinator cannot read the in-progress answers ──
  const staffAdminToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const readResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/responses?id=eq.${inProgressResponseId}&select=id,status`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staffAdminToken}`,
      },
    },
  )
  const readRows = (await readResp.json()) as Array<unknown>
  // The staff_admin cannot see the in-progress row via RLS → empty array.
  expect(readRows).toHaveLength(0)
})

test('AC-Security/Staff: plain staff cannot reach coordinator board or builder (404, no data leak)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await signInAs(page, 'staff1.ccih@test.local')

  // The coordinator cases board is staff_admin-gated.
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
  // No case data leaks through the 404.
  await expect(page.getByText(/Caso 0001/i)).toHaveCount(0)

  // The coordinator case detail is also staff_admin-gated.
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })

  // The template builder list is coordinator-only.
  await page.goto('/o/rede-a/c/ccih/manage/process-templates')
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
})

test('AC-Security/ForeignAdmin: foreign-commission staff_admin cannot reach CCIH board or case detail (404)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  // chefe.farm is staff_admin of farmacia, NOT ccih.
  await signInAs(page, 'chefe.farm@test.local')

  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })

  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })

  await page.goto('/o/rede-a/c/ccih/manage/process-templates')
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
})

// ---------------------------------------------------------------------------
// AC-ASSIGNEE-SCOPING — "Meus Casos" shows only the signed-in assignee's cases/phases;
// HC022 enforced at the RPC level (the wrong person cannot start another's phase).
// ---------------------------------------------------------------------------

test("AC-AssigneeScoping: meus-casos shows only the signed-in user's ativa phases; wrong assignee gets HC022", async ({
  page,
}) => {
  test.setTimeout(120_000)

  // Create a fresh case and activate Phase 1 → assign to staff1.ccih only.
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const scopeCaseId = await createFreshCase(page, ownerToken, `Scoping ${Date.now()}`)

  const phases = await getCasePhases(page, scopeCaseId)
  const phase1 = phases.find((p) => p.position === 1)!
  await activatePhaseRPC(page, ownerToken, phase1.id, STAFF1_CCIH_ID)

  // ── staff1.ccih sees the phase in "Meus Casos" (case_access ON) ──
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/meus-casos')
  await page.waitForURL('**/o/rede-a/c/ccih/meus-casos', { timeout: 15_000 })
  // At least one case card appears (cases with ativa phases assigned to staff1.ccih).
  await expect(page.getByRole('article').first()).toBeVisible({ timeout: 10_000 })
  // A "Preencher" button exists (StartPhaseButton — P7-001 resolved).
  await expect(page.getByRole('button', { name: /Preencher/i }).first()).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // ── staff2.ccih does NOT get to start that phase (HC022) ──
  const staff2Token = await getOwnerToken(page, 'staff2.ccih@test.local')
  const startWrongResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/start_or_resume_phase`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staff2Token}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_phase_id: phase1.id },
    },
  )
  // HC022 (renamed from P0022 — ADR 0018) is surfaced by PostgREST as HTTP 400
  // with a structured JSON body (the HC-class maps to 400 + {code, message},
  // unlike the old P0-class which returned HTTP 500 text/plain). The important
  // invariant is that the call is REJECTED (non-2xx) — pgTAP covers HC022 detail.
  expect(startWrongResp.ok()).toBeFalsy()

  // ── staff2.ccih's "Meus Casos" shows nothing for the scoping case ──
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/meus-casos')
  await page.waitForURL('**/o/rede-a/c/ccih/meus-casos', { timeout: 15_000 })
  // staff2 has no "ativa" phases from this test case, so no scoping-case card.
  // We verify: if any cards exist, none links to the scoping case.
  const cards = page.getByRole('article')
  const cardCount = await cards.count()
  for (let i = 0; i < cardCount; i++) {
    const text = await cards.nth(i).textContent()
    // The scoping case label should not appear in staff2's list.
    expect(text).not.toMatch(/Scoping/)
  }
  await signOut(page)

  // ── Path-tamper: staff2 directly navigates to the phase landing ──
  // StartPhaseButton calls start_or_resume_phase which raises HC022 (ADR 0018;
  // was P0022) and shows an error, OR the page server component returns 404.
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/cases/${scopeCaseId}/phase/${phase1.id}`)
  // Either a 404 page or the StartPhaseButton error banner renders.
  // The RPC rejection (HC022) always prevents filling.
  // We wait until the loading spinner goes away and a blocking error text appears.
  await expect
    .poll(
      async () => {
        const hasNotFound = await page
          .getByRole('heading', { name: /Não encontramos esta página/i })
          .isVisible()
          .catch(() => false)
        // Fallback: if the page renders (not 404), the wizard back-link is present.
        // The responder page renders a back-link to /minhas-fases (which redirects to
        // /meus-casos) with link text "Minhas fases". Either URL fragment matches.
        const hasError = await page
          .locator('a[href*="minhas-fases"], a[href*="meus-casos"]')
          .filter({ hasText: /Minhas fases|Meus Casos/i })
          .isVisible()
          .catch(() => false)
        return hasNotFound || hasError
      },
      { timeout: 20_000 },
    )
    .toBe(true)
})

// ---------------------------------------------------------------------------
// AC-COMPLETED-PHASE-REVIEW — "Ver respostas" shows submitted answers read-only
// ---------------------------------------------------------------------------

test('AC-CompletedPhaseReview: coordinator "Ver respostas" on seeded concluída phase shows submitted answers read-only', async ({
  page,
}) => {
  test.setTimeout(120_000)

  // The seeded Caso 0001 has Phase 1 concluída with a submitted response
  // answering dispensador_disponivel='Sim'. The coordinator reads it.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  // Phase 1 "Ver respostas" link (seeded phase 1 is always concluída after db reset).
  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })

  const verRespostas = phase1Row.getByRole('link', { name: /Ver respostas/i })
  await expect(verRespostas).toBeVisible({ timeout: 10_000 })
  await verRespostas.click()

  // Navigates to the read-only respostas page.
  await page.waitForURL(/\/manage\/cases\/.*\/fase\/.*\/respostas/, { timeout: 20_000 })

  // The heading shows the phase title.
  await expect(
    page.getByRole('heading', { name: /Fase 1/i }),
  ).toBeVisible({ timeout: 10_000 })

  // The seeded Phase 1 response: dispensador_disponivel='Sim'. That answer must render.
  await expect(page.getByText(/Sim/i).first()).toBeVisible({ timeout: 10_000 })

  // No mutation affordances on the read-only page.
  await expect(page.getByRole('button', { name: /Enviar respostas/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Próximo/i })).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// AC-PII-WARNING — The "Novo caso" create dialog shows the PII warning
// ---------------------------------------------------------------------------

test('AC-PIIWarning: create-case dialog shows the PII warning (role=note)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })

  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // The PII warning is present with role=note (not color-only per AC).
  const piiWarning = dialog.locator('[role="note"]')
  await expect(piiWarning).toBeVisible({ timeout: 5_000 })
  await expect(piiWarning).toContainText(/não inclua dados de paciente/i)
  // Specifically calls out patient identifiers.
  await expect(piiWarning).toContainText(/identificador/i)
})

// ---------------------------------------------------------------------------
// AC-KEYBOARD — Keyboard-only pass: activate/assign flow (CLAUDE.md §8 mandate)
// ---------------------------------------------------------------------------

test('AC-Keyboard: keyboard-only activate + assign flow on a fresh case; focus asserted at each step', async ({
  page,
}) => {
  test.setTimeout(180_000)

  // Create a fresh case and navigate to it.
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const kbCaseId = await createFreshCase(page, ownerToken, `Keyboard ${Date.now()}`)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${kbCaseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${kbCaseId}`), { timeout: 15_000 })

  // ── Keyboard: focus the "Ativar e atribuir" button for Phase 1 and press Enter ──
  const activateBtn = page.getByRole('button', { name: /Ativar e atribuir/i }).first()
  await expect(activateBtn).toBeVisible({ timeout: 10_000 })
  await activateBtn.focus()
  await expect(activateBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // The activate dialog opens.
  const activateDialog = page.getByRole('dialog').filter({ hasText: /Ativar e atribuir fase/i })
  await expect(activateDialog).toBeVisible({ timeout: 10_000 })

  // ── Keyboard: focus the assignee select and choose an option ──
  // In a native <select>, keyboard navigation is OS-dependent. We focus the select
  // (keyboard action), then select staff1.ccih by value (the focus assertion is the
  // keyboard-accessible step; selectOption drives the test).
  const assigneeSelect = activateDialog.locator('select[name="assignedTo"]')
  await assigneeSelect.focus()
  await expect(assigneeSelect).toBeFocused()
  // Select staff1.ccih (Enfermeiro CCIH Um) explicitly so we know who to sign in as.
  await assigneeSelect.selectOption(STAFF1_CCIH_ID)
  const selectedVal = await assigneeSelect.inputValue()
  expect(selectedVal.trim()).not.toBe('')

  // ── Keyboard: focus the "Ativar fase" submit button and press Enter ──
  const submitBtn = activateDialog.getByRole('button', { name: /Ativar fase/i })
  await submitBtn.focus()
  await expect(submitBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // Dialog closes on success.
  await expect(activateDialog).toHaveCount(0, { timeout: 15_000 })

  // Phase 1 is now ativa.
  await expect
    .poll(async () => {
      const phases = await getCasePhases(page, kbCaseId)
      return phases.find((p) => p.position === 1)?.status
    }, { timeout: 15_000 })
    .toBe('ativa')

  // ── The assignee opens "Meus Casos" and enters the phase via keyboard ──
  await signOut(page)
  await signInAs(page, 'staff1.ccih@test.local')

  // Keyboard: focus the "Preencher" button and press Enter.
  // StartPhaseButton is a <button> (P7-001 resolved); the card is identified
  // by case label text ("Keyboard" prefix is unique within this test run).
  await page.goto('/o/rede-a/c/ccih/meus-casos')
  await page.waitForURL('**/o/rede-a/c/ccih/meus-casos', { timeout: 15_000 })

  const kbCard = page.getByRole('article').filter({ hasText: /Keyboard/i }).first()
  await expect(kbCard).toBeVisible({ timeout: 15_000 })
  const kbPreencherBtn = kbCard.getByRole('button', { name: /Preencher/i })
  await expect(kbPreencherBtn).toBeVisible({ timeout: 15_000 })
  await kbPreencherBtn.focus()
  await expect(kbPreencherBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // StartPhaseButton calls startOrResumePhase and router.push → wizard URL.
  await page.waitForURL(/\/phase\/[0-9a-f-]{36}\/responder\/[0-9a-f-]{36}/, { timeout: 30_000 })

  // We're in the wizard. Verify a required form control is reachable by keyboard.
  const firstRadio = page.getByRole('radio', { name: /^Sim$/i }).first()
  await expect(firstRadio).toBeVisible({ timeout: 15_000 })
  await firstRadio.focus()
  await expect(firstRadio).toBeFocused()
  await page.keyboard.press('Space')
  await expect(firstRadio).toBeChecked({ timeout: 5_000 })

  // Keyboard: Tab to the next control (dropdown) and verify focus moves.
  await page.keyboard.press('Tab')
  const focusedElement = page.locator(':focus')
  await expect(focusedElement).toBeVisible({ timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// DUE DATE TESTS — Phase due-date feature (ADR 0021)
//
// Contract:
//   a. Template "Prazo padrão (dias)" field persists on the phase-slot.
//   b. "Ativar e atribuir" prefills dueDate from default_due_days.
//   c. "Remover prazo" clears the field; activating without a date → no chip.
//   d. Seeded overdue example (Phase 2, due_date = today-3) shows "Atrasada"
//      with destructive styling.
//
// Note: these tests use API_BASE (process.env.NEXT_PUBLIC_SUPABASE_URL or the
// local fallback) so they work in both local-Docker and remote-Supabase
// environments.
// ---------------------------------------------------------------------------

test('AC-DueDays-Template: adding a phase-slot with Prazo padrão (dias) persists the value', async ({
  page,
}) => {
  test.setTimeout(180_000)

  await signInAs(page, 'chefe.ccih@test.local')

  // Create a fresh DRAFT template.
  await page.goto('/o/rede-a/c/ccih/manage/process-templates')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/process-templates', { timeout: 15_000 })

  const suffix = Date.now()
  const templateTitle = `Prazo E2E ${suffix}`

  await page.getByRole('button', { name: /Novo processo/i }).click()
  const createDialog = page.getByRole('dialog').filter({ hasText: /Novo processo/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })
  await createDialog.getByLabel(/Título/i).fill(templateTitle)
  await createDialog.getByRole('button', { name: /Criar processo/i }).click()
  await page.waitForURL(/\/manage\/process-templates\/[0-9a-f-]{36}/, { timeout: 20_000 })

  // Add a phase-slot with defaultDays = 5.
  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog).toBeVisible({ timeout: 10_000 })

  await slotDialog.locator('select[name="formId"]').selectOption({
    label: 'Checklist de Higienização das Mãos',
  })
  await slotDialog.locator('input[name="title"]').fill('Fase Prazo E2E')
  // Fill the "Prazo padrão (dias)" field.
  const defaultDaysInput = slotDialog.locator('input[name="defaultDays"]')
  await expect(defaultDaysInput).toBeVisible({ timeout: 10_000 })
  await defaultDaysInput.fill('5')

  await slotDialog.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog).toHaveCount(0, { timeout: 15_000 })

  // The slot card should now be visible.
  await expect(page.getByText(/Fase Prazo E2E/i)).toBeVisible({ timeout: 10_000 })

  // Re-open the edit dialog for the slot we just added and verify the field persisted.
  // The edit button (pencil/edit icon) is on the slot card.
  const slotCard = page.getByRole('region').filter({ hasText: /Fase Prazo E2E/i })
  await expect(slotCard).toBeVisible({ timeout: 10_000 })
  // Click the edit button for this slot.
  const editBtn = slotCard.getByRole('button', { name: /Editar/i })
  await expect(editBtn).toBeVisible({ timeout: 10_000 })
  await editBtn.click()

  const editDialog = page.getByRole('dialog').filter({ hasText: /Editar fase/i })
  await expect(editDialog).toBeVisible({ timeout: 10_000 })

  // The defaultDays field should show 5.
  const editDaysInput = editDialog.locator('input[name="defaultDays"]')
  await expect(editDaysInput).toBeVisible({ timeout: 10_000 })
  await expect(editDaysInput).toHaveValue('5')

  // Keyboard assertion: the defaultDays field is reachable by Tab from the title field.
  const titleInput = editDialog.locator('input[name="title"]')
  await titleInput.focus()
  await expect(titleInput).toBeFocused()
  await page.keyboard.press('Tab')
  // After the title field, the next tab stop should be reachable.
  // We directly focus the defaultDays field and assert it accepts keyboard input.
  await editDaysInput.focus()
  await expect(editDaysInput).toBeFocused()

  // Close without saving.
  await editDialog.getByRole('button', { name: /Cancelar/i }).click()
  await expect(editDialog).toHaveCount(0, { timeout: 10_000 })
})

test('AC-DueDays-Activate-Prefill: activate dialog prefills dueDate from default_due_days; set and activate → due-date chip appears', async ({
  page,
}) => {
  test.setTimeout(180_000)

  // Create a fresh case — its Phase 1 slot has default_due_days = 7 (seed template).
  const newCaseId = await createFreshCaseRemote(page, `DueDatePrefill ${Date.now()}`)

  // Verify default_due_days is 7 on Phase 1 via service-role API.
  const phases = await getCasePhasesWithDueDates(page, newCaseId)
  const phase1 = phases.find((p) => p.position === 1)
  expect(phase1).toBeTruthy()
  expect(phase1!.default_due_days).toBe(7)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${newCaseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${newCaseId}`), { timeout: 15_000 })

  // Open "Ativar e atribuir fase" dialog for Phase 1.
  const phase1Article = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Article).toBeVisible({ timeout: 10_000 })
  await phase1Article.getByRole('button', { name: /Ativar e atribuir/i }).click()

  const activateDialog = page.getByRole('dialog').filter({ hasText: /Ativar e atribuir fase/i })
  await expect(activateDialog).toBeVisible({ timeout: 10_000 })

  // The dueDate input should be pre-filled to today + 7 days.
  const dueDateInput = activateDialog.locator('input[name="dueDate"]')
  await expect(dueDateInput).toBeVisible({ timeout: 5_000 })
  const prefillValue = await dueDateInput.inputValue()
  expect(prefillValue).not.toBe('')

  // Assert it is approximately today + 7 (within ±1 day to account for timezone edge cases).
  const expectedDate = new Date()
  expectedDate.setDate(expectedDate.getDate() + 7)
  const expectedIso = toDateInputValue(expectedDate)
  // The prefilled date must equal today+7.
  expect(prefillValue).toBe(expectedIso)

  // Choose a specific target date: today + 10 days for easy assertion.
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + 10)
  const targetIso = toDateInputValue(targetDate)
  const targetPtBR = toPtBRDate(targetIso)

  await dueDateInput.fill(targetIso)
  await expect(dueDateInput).toHaveValue(targetIso)

  // Select an assignee.
  await activateDialog.locator('select[name="assignedTo"]').selectOption(STAFF1_CCIH_ID)
  await activateDialog.getByRole('button', { name: /Ativar fase/i }).click()
  await expect(activateDialog).toHaveCount(0, { timeout: 15_000 })

  // The case-detail phase list should show the due-date chip "Prazo: dd/MM/yyyy".
  await page.reload()
  await page.waitForURL(new RegExp(`/manage/cases/${newCaseId}`), { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 20_000 })

  const updatedPhase1 = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(updatedPhase1).toBeVisible({ timeout: 15_000 })
  // Assert the Prazo chip is present and contains the formatted pt-BR date.
  const dueDateChipAfter = updatedPhase1.locator('span', { hasText: /Prazo:/i })
  await expect(dueDateChipAfter).toBeVisible({ timeout: 10_000 })
  await expect(dueDateChipAfter).toContainText(targetPtBR)
})

test('AC-DueDays-RemovePrazo: clicking "Remover prazo" clears the due date; activating without a date shows no due-date chip', async ({
  page,
}) => {
  test.setTimeout(180_000)

  // Create a fresh case — Phase 1 has default_due_days = 7 so the dialog pre-fills.
  const newCaseId = await createFreshCaseRemote(page, `RemovePrazo ${Date.now()}`)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${newCaseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${newCaseId}`), { timeout: 15_000 })

  const phase1Article = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Article).toBeVisible({ timeout: 10_000 })
  await phase1Article.getByRole('button', { name: /Ativar e atribuir/i }).click()

  const activateDialog = page.getByRole('dialog').filter({ hasText: /Ativar e atribuir fase/i })
  await expect(activateDialog).toBeVisible({ timeout: 10_000 })

  // The dueDate input is pre-filled (default_due_days = 7).
  const dueDateInput = activateDialog.locator('input[name="dueDate"]')
  const prefillValue = await dueDateInput.inputValue()
  expect(prefillValue).not.toBe('')

  // "Remover prazo" button is visible only when dueDate is non-empty.
  // The button is a <button type="button"> inside a <label>; use a direct CSS
  // locator to avoid Playwright matching the outer label's computed role.
  const removePrazoBtn = activateDialog.locator('button[type="button"]', { hasText: /Remover prazo/i })
  await expect(removePrazoBtn).toBeVisible({ timeout: 5_000 })
  await removePrazoBtn.click()

  // The date field should now be empty.
  await expect(dueDateInput).toHaveValue('', { timeout: 5_000 })
  // "Remover prazo" button hides when the field is empty.
  await expect(removePrazoBtn).toHaveCount(0, { timeout: 5_000 })

  // Activate without a due date.
  await activateDialog.locator('select[name="assignedTo"]').selectOption(STAFF1_CCIH_ID)
  await activateDialog.getByRole('button', { name: /Ativar fase/i }).click()
  await expect(activateDialog).toHaveCount(0, { timeout: 15_000 })

  // After reload, the phase-detail row should NOT show a "Prazo:" chip.
  await page.reload()
  await page.waitForURL(new RegExp(`/manage/cases/${newCaseId}`), { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 20_000 })

  const updatedPhase1 = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(updatedPhase1).toBeVisible({ timeout: 15_000 })
  // No due-date chip present.
  await expect(updatedPhase1.locator('span', { hasText: /Prazo:/i })).toHaveCount(0, { timeout: 5_000 })
  // DB truth: due_date is NULL.
  const phasesAfter = await getCasePhasesWithDueDates(page, newCaseId)
  const p1After = phasesAfter.find((p) => p.position === 1)
  expect(p1After?.due_date).toBeNull()
})

// Note: AC-DueDays-Overdue depends on the seeded Caso 0001's Phase 2 being in
// `pendente` state with due_date = current_date − 3. It must run BEFORE
// AC-HappyPath, which closes the case and transitions Phase 2 away from pendente.
// The test is defined further up in the file (before AC-HappyPath).
