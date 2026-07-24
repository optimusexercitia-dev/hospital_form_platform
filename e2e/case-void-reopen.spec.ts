import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * Case Correction Lifecycle — Void + Reopen (ADR 0085, plan
 * `~/.claude/plans/agreed-tender-pixel.md`, T-1).
 *
 * Test contract: file anulação → approve → "Anulada" pill + result cleared + a
 * phase BLOCKED on the voided one may proceed (voided satisfies `blocks`, same as
 * `not_required`); redo the voided work via an ad-hoc phase; `reopen_case` on a
 * CONCLUDED case makes it correctable again; a CANCELLED case never offers reopen
 * (HC0M8 terminal-forever). `e2e/case-corrections.spec.ts` covers the
 * file/continue/edit/resubmit/approve/reject/withdraw phase+narrative loops.
 *
 * Flag `case_corrections` is seed-forced ON locally — no flag setup needed.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HERMETICITY DESIGN (mirrors case-phase-result.spec.ts / case-corrections.spec.ts)
 * ──────────────────────────────────────────────────────────────────────────────
 * beforeAll builds a spec-owned form + a spec-owned 2-phase template: Phase 1
 * emits a result (ruleset: "Sim" → Conforme, default → Não-conforme) so voiding it
 * has an observable result to clear; Phase 2 explicitly `blocks: [1]` (D1/D4 model)
 * so voiding Phase 1 is provably what unblocks it. Three cases are created:
 *   - VOID    — Phase 1 completed (Sim → Conforme); void it, then redo via an
 *               ad-hoc phase.
 *   - REOPEN  — single phase completed, case closed (`close_case`), then
 *               `reopen_case`'d.
 *   - CANCELLED — cancelled via `cancel_case`; never offers "Reabrir caso".
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH — files, approves, reopens/cancels
 *                           (every action in this spec needs staff_admin authority).
 *
 * Run `npx supabase db reset` before this run; `--workers=1` (stateful, serial).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

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

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const ORG = 'rede-a'
const SLUG = 'ccih'
const MANAGE_BASE = `/o/${ORG}/c/${SLUG}/manage/cases`

const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF_1 = '00000000-0000-0000-0000-000000000003'

const SPEC_TAG = 'VOID-SPEC'
const FORM_TITLE = `Checklist ${SPEC_TAG}`
const TEMPLATE_TITLE = `Template ${SPEC_TAG}`
const LABEL_CONFORME = `Conforme ${SPEC_TAG}`
const LABEL_NAO_CONFORME = `Não-conforme ${SPEC_TAG}`

// ---------------------------------------------------------------------------
// Fixture state (populated in beforeAll)
// ---------------------------------------------------------------------------

let specSectionId: string
let specItemId: string
let formId: string

let caseVoidId: string
let caseReopenId: string
let caseCancelledId: string

let voidPhase1Id: string
let voidPhase2Id: string
let reopenPhaseId: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
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
  expect(resp.ok(), `svcInsert(${table}) failed ${resp.status()}: ${await resp.text()}`).toBeTruthy()
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

function slug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function insertChoiceOptions(
  req: APIRequestContext,
  itemId: string,
  formVersionId: string,
  labels: string[],
): Promise<void> {
  for (let i = 0; i < labels.length; i++) {
    await svcInsert(req, 'form_item_options', {
      item_id: itemId,
      form_version_id: formVersionId,
      position: i,
      code: slug(labels[i]),
      label: labels[i],
    })
  }
}

/** Purge any state left by a previous (possibly aborted) run of this suite. */
async function purgeLeftoverState() {
  const { spawnSync } = await import('child_process')
  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM case_correction_requests WHERE case_id IN (
       SELECT id FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM responses WHERE case_phase_id IN (
       SELECT cp.id FROM case_phases cp
       JOIN cases c ON c.id = cp.case_id
       WHERE c.label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM case_reopenings WHERE case_id IN (
       SELECT id FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'`,
    `DELETE FROM process_templates WHERE title = '${TEMPLATE_TITLE}' AND commission_id = '${COMM_A}'`,
    `DELETE FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'`,
    `DELETE FROM phase_results WHERE commission_id = '${COMM_A}' AND label IN ('${LABEL_CONFORME}', '${LABEL_NAO_CONFORME}')`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')

  spawnSync(
    'docker',
    ['exec', 'supabase_db_azkbbhskturikxpgmafq', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purgeLeftoverState()

  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')

  // 1. Spec-owned form: ONE required multiple_choice item (Sim/Não).
  const formRow = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_TITLE,
    description: 'Spec-owned form for case-void-reopen E2E tests.',
    created_by: UID_CHEFE_A,
  })
  formId = formRow.id
  const versionRow = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: formId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  const sectionRow = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: versionRow.id,
    position: 0,
    is_default: true,
    title: null,
  })
  specSectionId = sectionRow.id
  const itemRow = await svcInsert<{ id: string; form_version_id: string }>(request, 'form_items', {
    section_id: specSectionId,
    position: 0,
    item_type: 'multiple_choice',
    question_key: 'inspecao_ok',
    label: 'A inspeção foi aprovada?',
    required: true,
  })
  specItemId = itemRow.id
  await insertChoiceOptions(request, specItemId, itemRow.form_version_id, ['Sim', 'Não'])

  const publishFormResp = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: versionRow.id,
  })
  expect(publishFormResp.ok(), `publish_form_version failed: ${await publishFormResp.text()}`).toBeTruthy()

  // 2. Result vocabulary.
  const conformeResp = await rpc(request, 'create_phase_result', chefeToken, {
    p_commission_id: COMM_A,
    p_label: LABEL_CONFORME,
    p_color_token: 'green',
    p_is_adverse: false,
  })
  expect(conformeResp.ok(), `create_phase_result Conforme failed: ${await conformeResp.text()}`).toBeTruthy()
  const conformeId = ((await conformeResp.json()) as { id: string }).id

  const naoConformeResp = await rpc(request, 'create_phase_result', chefeToken, {
    p_commission_id: COMM_A,
    p_label: LABEL_NAO_CONFORME,
    p_color_token: 'red',
    p_is_adverse: true,
  })
  expect(naoConformeResp.ok(), `create_phase_result Não-conforme failed: ${await naoConformeResp.text()}`).toBeTruthy()
  const naoConformeId = ((await naoConformeResp.json()) as { id: string }).id

  // 3. Spec-owned 2-phase template: Phase 1 emits a result; Phase 2 blocks=[1].
  const templateRow = await svcInsert<{ id: string }>(request, 'process_templates', {
    commission_id: COMM_A,
    title: TEMPLATE_TITLE,
    description: 'Template criado pela suite case-void-reopen.spec.ts.',
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  const templateId = templateRow.id

  const ruleset = {
    rules: [{ when: { question_key: 'inspecao_ok', op: 'equals', value: 'sim' }, result_id: conformeId }],
    default_result_id: naoConformeId,
  }

  const phase1Resp = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_id: templateId,
    p_form_id: formId,
    p_title: 'Fase 1 — Inspeção',
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [],
    p_result_ruleset: ruleset,
    p_emits_result: true,
    p_allowed_result_ids: [conformeId, naoConformeId],
  })
  expect(phase1Resp.ok(), `add_template_phase (phase 1) failed: ${await phase1Resp.text()}`).toBeTruthy()

  const phase2Resp = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_id: templateId,
    p_form_id: formId,
    p_title: 'Fase 2 — Intervenção',
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [1],
    p_result_ruleset: null,
  })
  expect(phase2Resp.ok(), `add_template_phase (phase 2) failed: ${await phase2Resp.text()}`).toBeTruthy()

  const publishTemplateResp = await rpc(request, 'publish_process_template', chefeToken, {
    p_template_id: templateId,
  })
  expect(publishTemplateResp.ok(), `publish_process_template failed: ${await publishTemplateResp.text()}`).toBeTruthy()

  // 4. Create the 3 cases.
  async function createCase(label: string): Promise<string> {
    const r = await rpc(request, 'create_case_from_template', chefeToken, {
      p_template_id: templateId,
      p_label: label,
    })
    expect(r.ok(), `create_case_from_template (${label}) failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  caseVoidId = await createCase(`Caso ${SPEC_TAG} — Void`)
  caseReopenId = await createCase(`Caso ${SPEC_TAG} — Reopen`)
  caseCancelledId = await createCase(`Caso ${SPEC_TAG} — Cancelled`)

  async function getPhaseId(caseId: string, position: number): Promise<string> {
    const rows = await svcGet<{ id: string }>(
      request,
      `case_phases?case_id=eq.${caseId}&position=eq.${position}&select=id`,
    )
    expect(rows.length, `phase ${position} not found for case ${caseId}`).toBeGreaterThan(0)
    return rows[0].id
  }
  voidPhase1Id = await getPhaseId(caseVoidId, 1)
  voidPhase2Id = await getPhaseId(caseVoidId, 2)
  reopenPhaseId = await getPhaseId(caseReopenId, 1)

  // 5. Complete Phase 1 of VOID + REOPEN (assignee staff1, answer "Sim" → Conforme).
  async function completePhase(phaseId: string): Promise<void> {
    const activateResp = await rpc(request, 'activate_phase', chefeToken, {
      p_case_phase_id: phaseId,
      p_assigned_to: UID_STAFF_1,
    })
    expect(activateResp.ok(), `activate_phase(${phaseId}) failed: ${await activateResp.text()}`).toBeTruthy()
    const startResp = await rpc(request, 'start_or_resume_phase', staff1Token, { p_case_phase_id: phaseId })
    expect(startResp.ok(), `start_or_resume_phase(${phaseId}) failed: ${await startResp.text()}`).toBeTruthy()
    const responseId = ((await startResp.json()) as { id: string }).id
    const saveResp = await rpc(request, 'save_section_answers', staff1Token, {
      p_response_id: responseId,
      p_section_id: specSectionId,
      p_answers: {},
      p_selections: { [specItemId]: [slug('Sim')] },
    })
    expect(saveResp.ok(), `save_section_answers(${responseId}) failed: ${await saveResp.text()}`).toBeTruthy()
    const submitResp = await rpc(request, 'submit_response', staff1Token, { p_response_id: responseId })
    expect(submitResp.ok(), `submit_response(${responseId}) failed: ${await submitResp.text()}`).toBeTruthy()
  }
  await completePhase(voidPhase1Id)
  await completePhase(reopenPhaseId)

  // Sanity: Phase 1 (VOID case) resolved to Conforme; Phase 2 is blocked.
  const [phase1Row] = await svcGet<{ result_id: string | null; status: string }>(
    request,
    `case_phases?id=eq.${voidPhase1Id}&select=result_id,status`,
  )
  expect(phase1Row.status).toBe('completed')
  expect(phase1Row.result_id).toBe(conformeId)
  const [phase2Row] = await svcGet<{ blocks: number[]; status: string }>(
    request,
    `case_phases?id=eq.${voidPhase2Id}&select=blocks,status`,
  )
  expect(phase2Row.blocks).toEqual([1])
  expect(phase2Row.status).toBe('pending')

  // 6. Close REOPEN case — the template always yields 2 phases (Phase 2 blocks
  //    on Phase 1), so Phase 2 must be settled (skip → não_necessária) before
  //    `close_case` accepts (HC031); only Phase 1 matters for the reopen test.
  const reopenPhase2Id = await getPhaseId(caseReopenId, 2)
  const skipResp = await rpc(request, 'skip_phase', chefeToken, { p_case_phase_id: reopenPhase2Id })
  expect(skipResp.ok(), `skip_phase(${reopenPhase2Id}) failed: ${await skipResp.text()}`).toBeTruthy()

  const closeResp = await rpc(request, 'close_case', chefeToken, { p_case_id: caseReopenId })
  expect(closeResp.ok(), `close_case failed: ${await closeResp.text()}`).toBeTruthy()

  // 7. Cancel CANCELLED case (no phases need to run).
  const cancelResp = await rpc(request, 'cancel_case', chefeToken, { p_case_id: caseCancelledId })
  expect(cancelResp.ok(), `cancel_case failed: ${await cancelResp.text()}`).toBeTruthy()
})

test.afterAll(async () => {
  await purgeLeftoverState()
})

// ---------------------------------------------------------------------------
// AC-1 — Void: approve → "Anulada" pill + result cleared; a phase blocked on it
// may now proceed; redo via an ad-hoc phase.
// ---------------------------------------------------------------------------

test('AC-1: void a completed phase — Anulada pill, result cleared, downstream block satisfied, redo via ad-hoc phase', async ({ page }) => {
  test.setTimeout(150_000)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseVoidId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseVoidId}`), { timeout: 15_000 })

  const phase1Article = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  const phase2Article = page.getByRole('article').filter({ hasText: /Fase 2/i }).first()
  await expect(phase1Article).toBeVisible({ timeout: 10_000 })
  await expect(phase1Article.getByText(LABEL_CONFORME)).toBeVisible()

  // Baseline: Phase 1 is already `completed` (fixture), so Phase 2's `blocks: [1]`
  // is already SETTLED — "Ativar e atribuir" is enabled, no "Bloqueada" label. A
  // phase can only be voided FROM `completed` (never from pending/active), so the
  // meaningful assertion is that VOIDING Phase 1 does not regress this: the
  // `blocks` settled-predicate must keep counting `voided` (BE-4's sweep), not
  // just `completed`/`not_required` — proven below, after the void is approved.
  await expect(phase2Article.getByRole('button', { name: /Ativar e atribuir/i })).toBeEnabled({
    timeout: 10_000,
  })
  await expect(phase2Article.getByText(/Bloqueada por Fase 1/i)).not.toBeVisible()

  // File + approve a "void" request on Phase 1.
  await phase1Article.getByRole('button', { name: /^Corrigir…/ }).click()
  await page.getByRole('menuitem', { name: /Solicitar anulação/i }).click()
  const voidDialog = page.getByRole('dialog').filter({ hasText: /Solicitar anulação/i })
  await expect(voidDialog).toBeVisible({ timeout: 5_000 })
  // A void request has NO corrector picker (no draft to correct).
  await expect(voidDialog.getByLabel(/Corretor/i)).toHaveCount(0)
  await voidDialog.getByLabel(/Motivo/i).fill('Fase registrada por engano — deve ser anulada.')
  await voidDialog.getByRole('button', { name: /^Solicitar anulação$/ }).click()
  await expect(voidDialog).not.toBeVisible({ timeout: 10_000 })

  await expect(phase1Article.getByText(/Em correção/i)).toBeVisible({ timeout: 10_000 })

  const correctionsPanel = page.getByRole('region', { name: /Solicitações de correção/i })
  const requestCard = correctionsPanel.locator('li').filter({ hasText: /Fase 1/i }).first()
  await expect(requestCard).toBeVisible({ timeout: 10_000 })
  await expect(requestCard.getByText(/^Anulação$/i)).toBeVisible()

  await requestCard.getByRole('button', { name: /Aprovar anulação/i }).click()
  const approveDialog = page.getByRole('alertdialog').filter({ hasText: /Aprovar a anulação/i })
  await expect(approveDialog).toBeVisible({ timeout: 5_000 })
  await approveDialog.getByRole('button', { name: /Aprovar anulação/i }).click()
  await expect(approveDialog).not.toBeVisible({ timeout: 15_000 })

  // Phase 1 now shows the "Anulada" pill; the Conforme result badge is gone.
  await expect(phase1Article.getByText(/^Anulada$/i)).toBeVisible({ timeout: 15_000 })
  await expect(phase1Article.getByText(LABEL_CONFORME)).not.toBeVisible()
  await expect(phase1Article.getByText(/Em correção/i)).not.toBeVisible()

  // DB truth: result cleared, phase voided (pointer kept as history).
  const [voidedPhase] = await svcGet<{ status: string; result_id: string | null }>(
    page.request as unknown as APIRequestContext,
    `case_phases?id=eq.${voidPhase1Id}&select=status,result_id`,
  )
  expect(voidedPhase.status).toBe('voided')
  expect(voidedPhase.result_id).toBeNull()

  // Phase 2 STAYS unblocked (voided settles `blocks`, like not_required — the
  // key proof: if the blocks-sweep had NOT included `voided`, this would now
  // regress to disabled/"Bloqueada por Fase 1").
  await expect(phase2Article.getByRole('button', { name: /Ativar e atribuir/i })).toBeEnabled({
    timeout: 10_000,
  })
  await expect(phase2Article.getByText(/Bloqueada por Fase 1/i)).not.toBeVisible()

  // Redo the voided work via an ad-hoc phase.
  await page.getByRole('button', { name: /^Adicionar fase$/ }).click()
  const adHocDialog = page.getByRole('dialog').filter({ hasText: /Adicionar fase ao caso/i })
  await expect(adHocDialog).toBeVisible({ timeout: 5_000 })
  await adHocDialog.locator('select[name="formId"]').selectOption({ label: FORM_TITLE })
  await adHocDialog.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(adHocDialog).not.toBeVisible({ timeout: 15_000 })

  const adHocArticle = page.getByRole('article').filter({ hasText: /adicional/i }).first()
  await expect(adHocArticle).toBeVisible({ timeout: 10_000 })
  await expect(adHocArticle.getByText(/^Pendente$/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-2 — reopen_case: a CONCLUDED case becomes correctable again.
// ---------------------------------------------------------------------------

test('AC-2: reopen_case on a concluded case makes its completed phase correctable again', async ({ page }) => {
  test.setTimeout(60_000)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseReopenId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseReopenId}`), { timeout: 15_000 })

  await expect(page.getByText(/^Concluído$/i).first()).toBeVisible({ timeout: 10_000 })

  const phaseArticle = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phaseArticle).toBeVisible({ timeout: 10_000 })
  // Concluded case → filing is closed (canFile requires the case OPEN).
  await expect(phaseArticle.getByRole('button', { name: /^Corrigir…/ })).not.toBeVisible()

  const reopenBtn = page.getByRole('button', { name: /Reabrir caso/i })
  await expect(reopenBtn).toBeVisible({ timeout: 10_000 })
  await reopenBtn.click()

  const reopenDialog = page.getByRole('dialog').filter({ hasText: /Reabrir o caso/i })
  await expect(reopenDialog).toBeVisible({ timeout: 5_000 })
  const reasonField = reopenDialog.getByLabel(/Motivo da reabertura/i)
  await expect(reasonField).toBeFocused()
  // Empty reason blocked client-side.
  await reopenDialog.getByRole('button', { name: /Reabrir caso/i }).click()
  await expect(reopenDialog.getByText(/Informe o motivo da reabertura/i)).toBeVisible()
  await reasonField.fill('Auditoria externa solicitou correção da fase concluída.')
  await reopenDialog.getByRole('button', { name: /Reabrir caso/i }).click()
  await expect(reopenDialog).not.toBeVisible({ timeout: 15_000 })

  // DB truth: no longer terminal.
  const [caseRow] = await svcGet<{ status: string }>(
    page.request as unknown as APIRequestContext,
    `cases?id=eq.${caseReopenId}&select=status`,
  )
  expect(['completed', 'cancelled']).not.toContain(caseRow.status)

  // "Reabrir caso" banner is gone; "Corrigir…" is back on the completed phase.
  await expect(page.getByRole('button', { name: /Reabrir caso/i })).not.toBeVisible({ timeout: 10_000 })
  await expect(phaseArticle.getByRole('button', { name: /^Corrigir…/ })).toBeVisible({ timeout: 10_000 })

  // Prove it is genuinely correctable again: file a request (no need to run the
  // full approve loop here — that mechanics are covered by case-corrections.spec.ts).
  await phaseArticle.getByRole('button', { name: /^Corrigir…/ }).click()
  await page.getByRole('menuitem', { name: /Solicitar correção/i }).click()
  const fileDialog = page.getByRole('dialog').filter({ hasText: /Solicitar correção/i })
  await fileDialog.getByLabel(/Motivo/i).fill('Correção pós-reabertura.')
  await fileDialog.getByRole('button', { name: /^Solicitar correção$/ }).click()
  await expect(fileDialog).not.toBeVisible({ timeout: 10_000 })
  await expect(phaseArticle.getByText(/Em correção/i)).toBeVisible({ timeout: 10_000 })

  const [openRequest] = await svcGet<{ status: string }>(
    page.request as unknown as APIRequestContext,
    `case_correction_requests?case_phase_id=eq.${reopenPhaseId}&status=eq.requested&select=status`,
  )
  expect(openRequest).toBeTruthy()
})

// ---------------------------------------------------------------------------
// AC-3 — A cancelled case NEVER offers reopen (HC0M8 terminal-forever).
// ---------------------------------------------------------------------------

test('AC-3: a cancelled case shows no "Reabrir caso" affordance', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseCancelledId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseCancelledId}`), { timeout: 15_000 })

  await expect(page.getByText(/^Cancelado$/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /Reabrir caso/i })).not.toBeVisible()

  // Server-side proof: `reopen_case` itself refuses a cancelled case (HC0M8),
  // not merely a hidden button (Rule 1 — RLS/the door is the boundary, not UI).
  const chefeToken = await getToken(page.request as unknown as APIRequestContext, 'chefe.ccih@test.local')
  const reopenResp = await rpc(
    page.request as unknown as APIRequestContext,
    'reopen_case',
    chefeToken,
    { p_case_id: caseCancelledId, p_reason: 'Tentativa direta via RPC — deve falhar.' },
  )
  expect(reopenResp.ok(), 'reopen_case on a cancelled case must be rejected (HC0M8)').toBe(false)
})
