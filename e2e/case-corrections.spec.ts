import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * Case Correction Lifecycle — Phases + Narratives (ADR 0085, plan
 * `~/.claude/plans/agreed-tender-pixel.md`, T-1).
 *
 * Test contract: translates the plan's §Build T-1 acceptance bullets into
 * Playwright assertions for the CLICKABLE happy/rejected/withdrawn/one-open-slot
 * loops (phase kind) plus narrative-correction parity. `e2e/case-void-reopen.spec.ts`
 * covers void / reopen_case / cancelled-terminal separately.
 *
 * Flag `case_corrections` is seed-forced ON locally (BE-5) — no flag setup needed.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HERMETICITY DESIGN (mirrors case-phase-result.spec.ts)
 * ──────────────────────────────────────────────────────────────────────────────
 * beforeAll builds ONE spec-owned form (1 required multiple_choice item,
 * options Sim/Não) + ONE spec-owned process template with a single phase-slot on
 * that form AND a narrative-slot (the seeded "Resumo Clínico" narrative type,
 * deterministic id `e2000000-…-f1`) — so this spec never touches the shared
 * Caso 0001 / M&M fixtures other specs mutate. Four cases are created from the
 * template: HAPPY (full loop + self-approval badge), REJECT (reject→re-edit
 * loop), WITHDRAW (one-open-slot block + withdraw, keyboard-only file), and NARR
 * (narrative correction parity). Phase 1 of HAPPY/REJECT/WITHDRAW is driven to
 * `completed` via RPC (activate → start → save → submit, staff1 as assignee); the
 * NARR case's "Resumo Clínico" narrative is filled + concluded via RPC.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local    staff_admin, CCIH — coordinator/approver, and the
 *                            request FILER in every scenario here (so every
 *                            approval it performs is *self*-approved — the only
 *                            staff_admin seeded in CCIH; the badge assertion is a
 *                            structural consequence, not a special-cased path).
 *   staff1.ccih@test.local   staff, CCIH — plain member; the phase's default
 *                            assignee AND (left un-designated) the default
 *                            corrector — exercises the non-admin-corrector path.
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
const STAFF_BASE = `/o/${ORG}/c/${SLUG}/casos`

const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF_1 = '00000000-0000-0000-0000-000000000003'

// The seeded "Resumo Clínico" narrative type (deterministic id, seed.sql).
const SEEDED_RESUMO_TYPE_ID = 'e2000000-0000-0000-0000-0000000000f1'

const SPEC_TAG = 'CORR-SPEC'
const FORM_TITLE = `Checklist ${SPEC_TAG}`
const TEMPLATE_TITLE = `Template ${SPEC_TAG}`

// ---------------------------------------------------------------------------
// Fixture state (populated in beforeAll)
// ---------------------------------------------------------------------------

let specVersionId: string
let specSectionId: string
let specItemId: string
let templateId: string

let caseHappyId: string
let caseRejectId: string
let caseWithdrawId: string
let caseNarrId: string

let phaseHappyId: string
let phaseRejectId: string
let phaseWithdrawId: string
let narrHappyNarrativeId: string // the NARR case's "Resumo Clínico" narrative

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

async function signOut(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
  const userMenu = page.getByRole('button', { name: /abrir menu da conta/i })
  await userMenu.click()
  const sairItem = page.getByRole('menuitem', { name: /sair/i })
  await expect(sairItem).toBeVisible({ timeout: 5_000 })
  await sairItem.click()
  await page.waitForURL(/\/login/, { timeout: 10_000 })
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
    `DELETE FROM case_narrative_revisions WHERE case_narrative_id IN (
       SELECT cn.id FROM case_narratives cn
       JOIN cases c ON c.id = cn.case_id
       WHERE c.label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM responses WHERE case_phase_id IN (
       SELECT cp.id FROM case_phases cp
       JOIN cases c ON c.id = cp.case_id
       WHERE c.label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'`,
    `DELETE FROM process_templates WHERE title = '${TEMPLATE_TITLE}' AND commission_id = '${COMM_A}'`,
    `DELETE FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'`,
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
    description: 'Spec-owned form for case-corrections E2E tests.',
    created_by: UID_CHEFE_A,
  })
  const versionRow = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: formRow.id,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  specVersionId = versionRow.id
  const sectionRow = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: specVersionId,
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
    p_form_version_id: specVersionId,
  })
  expect(publishFormResp.ok(), `publish_form_version failed: ${await publishFormResp.text()}`).toBeTruthy()

  // 2. Spec-owned template: 1 phase-slot (our form) + 1 narrative-slot (seeded
  //    "Resumo Clínico" type) — self-contained, never touches the M&M template.
  const templateRow = await svcInsert<{ id: string }>(request, 'process_templates', {
    commission_id: COMM_A,
    title: TEMPLATE_TITLE,
    description: 'Template criado pela suite case-corrections.spec.ts.',
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  templateId = templateRow.id

  const phaseResp = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_id: templateId,
    p_form_id: formRow.id,
    p_title: 'Fase 1 — Inspeção',
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [],
    p_result_ruleset: null,
  })
  expect(phaseResp.ok(), `add_template_phase failed: ${await phaseResp.text()}`).toBeTruthy()

  const narrResp = await rpc(request, 'add_template_narrative', chefeToken, {
    p_template_id: templateId,
    p_narrative_type_id: SEEDED_RESUMO_TYPE_ID,
    p_title: undefined,
    p_instructions: undefined,
    p_is_expected: false,
  })
  expect(narrResp.ok(), `add_template_narrative failed: ${await narrResp.text()}`).toBeTruthy()

  const publishTemplateResp = await rpc(request, 'publish_process_template', chefeToken, {
    p_template_id: templateId,
  })
  expect(publishTemplateResp.ok(), `publish_process_template failed: ${await publishTemplateResp.text()}`).toBeTruthy()

  // 3. Create the 4 cases.
  async function createCase(label: string): Promise<string> {
    const r = await rpc(request, 'create_case_from_template', chefeToken, {
      p_template_id: templateId,
      p_label: label,
    })
    expect(r.ok(), `create_case_from_template (${label}) failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  caseHappyId = await createCase(`Caso ${SPEC_TAG} — Happy`)
  caseRejectId = await createCase(`Caso ${SPEC_TAG} — Reject`)
  caseWithdrawId = await createCase(`Caso ${SPEC_TAG} — Withdraw`)
  caseNarrId = await createCase(`Caso ${SPEC_TAG} — Narr`)

  async function getPhaseId(caseId: string): Promise<string> {
    const rows = await svcGet<{ id: string }>(request, `case_phases?case_id=eq.${caseId}&position=eq.1&select=id`)
    expect(rows.length, `phase 1 not found for case ${caseId}`).toBeGreaterThan(0)
    return rows[0].id
  }
  phaseHappyId = await getPhaseId(caseHappyId)
  phaseRejectId = await getPhaseId(caseRejectId)
  phaseWithdrawId = await getPhaseId(caseWithdrawId)

  // 4. Drive each phase to `completed` (assignee staff1, initial answer "Sim").
  async function completePhase(phaseId: string): Promise<void> {
    const activateResp = await rpc(request, 'activate_phase', chefeToken, {
      p_case_phase_id: phaseId,
      p_assigned_to: UID_STAFF_1,
    })
    expect(activateResp.ok(), `activate_phase(${phaseId}) failed: ${await activateResp.text()}`).toBeTruthy()

    const startResp = await rpc(request, 'start_or_resume_phase', staff1Token, {
      p_case_phase_id: phaseId,
    })
    expect(startResp.ok(), `start_or_resume_phase(${phaseId}) failed: ${await startResp.text()}`).toBeTruthy()
    const responseId = ((await startResp.json()) as { id: string }).id

    const saveResp = await rpc(request, 'save_section_answers', staff1Token, {
      p_response_id: responseId,
      p_section_id: specSectionId,
      p_answers: {},
      p_selections: { [specItemId]: [slug('Sim')] },
    })
    expect(saveResp.ok(), `save_section_answers(${responseId}) failed: ${await saveResp.text()}`).toBeTruthy()

    const submitResp = await rpc(request, 'submit_response', staff1Token, {
      p_response_id: responseId,
    })
    expect(submitResp.ok(), `submit_response(${responseId}) failed: ${await submitResp.text()}`).toBeTruthy()
  }
  await completePhase(phaseHappyId)
  await completePhase(phaseRejectId)
  await completePhase(phaseWithdrawId)

  // 5. NARR case — fill + conclude the "Resumo Clínico" narrative (chefe = coordinator).
  const narrRows = await svcGet<{ id: string }>(
    request,
    `case_narratives?case_id=eq.${caseNarrId}&select=id,type_label&order=display_position.asc`,
  )
  expect(narrRows.length, 'NARR case must have at least one narrative slot').toBeGreaterThan(0)
  narrHappyNarrativeId = narrRows[0].id

  const saveNarrResp = await rpc(request, 'save_narrative_body', chefeToken, {
    p_narrative: narrHappyNarrativeId,
    p_body_md: 'Texto original registrado pela suite.',
  })
  expect(saveNarrResp.ok(), `save_narrative_body failed: ${await saveNarrResp.text()}`).toBeTruthy()

  const concludeResp = await rpc(request, 'conclude_narrative', chefeToken, {
    p_narrative: narrHappyNarrativeId,
  })
  expect(concludeResp.ok(), `conclude_narrative failed: ${await concludeResp.text()}`).toBeTruthy()
})

test.afterAll(async () => {
  await purgeLeftoverState()
})

// ---------------------------------------------------------------------------
// AC-1 — Full happy path: file (default corrector) → continue → wizard (no
// override panel) → edit → resubmit → approve (self-approved badge) →
// corrected answer becomes CURRENT on the phase respostas page.
// ---------------------------------------------------------------------------

test('AC-1: full correction loop — file, continue as plain-staff corrector, edit+resubmit, approve, self-approved badge, corrected answer current', async ({ page }) => {
  test.setTimeout(150_000)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseHappyId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseHappyId}`), { timeout: 15_000 })

  const phaseArticle = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phaseArticle).toBeVisible({ timeout: 10_000 })
  await expect(phaseArticle.getByText(/Concluída/i)).toBeVisible()

  // File a "correção" — leave classification + corrector at their defaults
  // (default corrector resolves server-side to the phase's assignee, staff1).
  await phaseArticle.getByRole('button', { name: /Corrigir/i }).click()
  const fileMenuItem = page.getByRole('menuitem', { name: /Solicitar correção/i })
  await expect(fileMenuItem).toBeVisible({ timeout: 5_000 })
  await fileMenuItem.click()

  const fileDialog = page.getByRole('dialog').filter({ hasText: /Solicitar correção/i })
  await expect(fileDialog).toBeVisible({ timeout: 5_000 })
  const reasonField = fileDialog.getByLabel(/Motivo/i)
  await expect(reasonField).toBeFocused()
  await reasonField.fill('A resposta original está incorreta — o item foi reavaliado.')
  await fileDialog.getByRole('button', { name: /^Solicitar correção$/ }).click()
  await expect(fileDialog).not.toBeVisible({ timeout: 10_000 })

  // "Em correção" + "Solicitada" chips appear; the "Corrigir…" menu is gone
  // (one open request per target).
  await expect(phaseArticle.getByText(/Em correção/i)).toBeVisible({ timeout: 10_000 })
  await expect(phaseArticle.getByText(/Solicitada/i)).toBeVisible()
  await expect(phaseArticle.getByRole('button', { name: /^Corrigir/i })).not.toBeVisible()

  // DB truth: corrector defaulted to the phase's assignee (staff1).
  const [request1] = await svcGet<{ id: string; permitted_corrector: string; status: string }>(
    page.request as unknown as APIRequestContext,
    `case_correction_requests?case_phase_id=eq.${phaseHappyId}&status=eq.requested&select=id,permitted_corrector,status`,
  )
  expect(request1).toBeTruthy()
  expect(request1.permitted_corrector).toBe(UID_STAFF_1)
  const requestId = request1.id

  // ── Switch to the plain-staff corrector ──
  await signOut(page)
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${STAFF_BASE}/${caseHappyId}`)
  await page.waitForURL(new RegExp(`/casos/${caseHappyId}`), { timeout: 15_000 })

  const staffPhaseArticle = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(staffPhaseArticle).toBeVisible({ timeout: 10_000 })
  const continueBtn = staffPhaseArticle.getByRole('button', { name: /Continuar correção/i })
  await expect(continueBtn).toBeVisible({ timeout: 10_000 })
  await continueBtn.click()

  await page.waitForURL(/\/phase\/.+\/responder\//, { timeout: 20_000 })
  await expect(page.getByText(/corrigindo o envio anterior/i)).toBeVisible({ timeout: 15_000 })

  // The successor is pre-populated from the predecessor: "Sim" checked.
  const simRadio = page.getByRole('radio', { name: 'Sim' })
  await expect(simRadio).toBeChecked({ timeout: 10_000 })

  // The result-override panel is STRUCTURALLY ABSENT in correction mode.
  await expect(page.getByRole('heading', { name: /Resultado da fase/i })).toHaveCount(0)

  // Edit the answer.
  const naoRadio = page.getByRole('radio', { name: 'Não' })
  await naoRadio.click()
  await expect(naoRadio).toBeChecked()

  // Reach the review step (even a flat single-item form gates submit behind it).
  await page.getByRole('button', { name: /^Revisar$/ }).click()
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })

  // Submit label is "Enviar para revisão" (not "Enviar respostas").
  const submitBtn = page.getByRole('button', { name: /Enviar para revisão/i })
  await expect(submitBtn).toBeVisible({ timeout: 10_000 })
  await submitBtn.click()

  await expect(page.getByRole('heading', { name: /Correção enviada para revisão/i })).toBeVisible({
    timeout: 20_000,
  })

  // DB truth: request now `resubmitted`.
  const [request2] = await svcGet<{ status: string; draft_response_id: string }>(
    page.request as unknown as APIRequestContext,
    `case_correction_requests?id=eq.${requestId}&select=status,draft_response_id`,
  )
  expect(request2.status).toBe('resubmitted')
  const draftResponseId = request2.draft_response_id

  // ── Approve as chefe (staff_admin) — this is also the requester → self-approved ──
  await signOut(page)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseHappyId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseHappyId}`), { timeout: 15_000 })

  const correctionsPanel = page.getByRole('region', { name: /Solicitações de correção/i })
  await expect(correctionsPanel).toBeVisible({ timeout: 10_000 })
  const requestCard = correctionsPanel.locator('li').filter({ hasText: /Fase 1/i }).first()
  await expect(requestCard).toBeVisible()
  await expect(requestCard.getByText(/Reenviada/i)).toBeVisible()

  await requestCard.getByRole('button', { name: /^Aprovar$/ }).click()
  const approveDialog = page.getByRole('alertdialog').filter({ hasText: /Aprovar a correção/i })
  await expect(approveDialog).toBeVisible({ timeout: 5_000 })
  // Self-approval warning is shown (chefe filed AND is approving).
  await expect(approveDialog.getByText(/aprovando uma correção que você mesmo solicitou/i)).toBeVisible()
  await approveDialog.getByRole('button', { name: /Aprovar correção/i }).click()
  await expect(approveDialog).not.toBeVisible({ timeout: 15_000 })

  // The request card now shows Aprovada + the self-approved badge.
  await expect(requestCard.getByText(/^Aprovada$/i)).toBeVisible({ timeout: 15_000 })
  await expect(requestCard.getByText(/Aprovada pelo próprio corretor/i)).toBeVisible()

  // The phase stays "Concluída" — never reopens — and "Em correção" is gone.
  await expect(phaseArticle.getByText(/Concluída/i)).toBeVisible()
  await expect(phaseArticle.getByText(/Em correção/i)).not.toBeVisible()

  // DB truth: the pointer moved to the successor.
  const [phaseRow] = await svcGet<{ current_response_id: string; status: string }>(
    page.request as unknown as APIRequestContext,
    `case_phases?id=eq.${phaseHappyId}&select=current_response_id,status`,
  )
  expect(phaseRow.status).toBe('completed')
  expect(phaseRow.current_response_id).toBe(draftResponseId)

  // The corrected answer is now CURRENT on the phase respostas page.
  await page.goto(`${MANAGE_BASE}/${caseHappyId}/fase/${phaseHappyId}/respostas`)
  await page.waitForURL(new RegExp(`/fase/${phaseHappyId}/respostas`), { timeout: 15_000 })
  await expect(page.getByText(/\batual\b/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Não', { exact: true }).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-2 — Reject → back to editing → re-edit → resubmit → approve loop.
// ---------------------------------------------------------------------------

test('AC-2: reject sends the corrector back to editing; re-edit + resubmit + approve closes the loop', async ({ page }) => {
  test.setTimeout(150_000)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseRejectId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseRejectId}`), { timeout: 15_000 })

  const phaseArticle = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await phaseArticle.getByRole('button', { name: /Corrigir/i }).click()
  await page.getByRole('menuitem', { name: /Solicitar correção/i }).click()
  const fileDialog = page.getByRole('dialog').filter({ hasText: /Solicitar correção/i })
  await fileDialog.getByLabel(/Motivo/i).fill('Reavaliação necessária após revisão interna.')
  await fileDialog.getByRole('button', { name: /^Solicitar correção$/ }).click()
  await expect(fileDialog).not.toBeVisible({ timeout: 10_000 })

  await signOut(page)
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${STAFF_BASE}/${caseRejectId}`)
  await page.waitForURL(new RegExp(`/casos/${caseRejectId}`), { timeout: 15_000 })

  async function editAndResubmit(finalAnswer: 'Sim' | 'Não') {
    const staffPhaseArticle = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
    await staffPhaseArticle.getByRole('button', { name: /Continuar correção/i }).click()
    await page.waitForURL(/\/phase\/.+\/responder\//, { timeout: 20_000 })
    const radio = page.getByRole('radio', { name: finalAnswer })
    await radio.click()
    await expect(radio).toBeChecked()
    await page.getByRole('button', { name: /^Revisar$/ }).click()
    await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: /Enviar para revisão/i }).click()
    await expect(page.getByRole('heading', { name: /Correção enviada para revisão/i })).toBeVisible({
      timeout: 20_000,
    })
  }

  await editAndResubmit('Não')

  // ── chefe rejects with a mandatory reason ──
  await signOut(page)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseRejectId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseRejectId}`), { timeout: 15_000 })

  const correctionsPanel = page.getByRole('region', { name: /Solicitações de correção/i })
  const requestCard = correctionsPanel.locator('li').filter({ hasText: /Fase 1/i }).first()
  await expect(requestCard.getByText(/Reenviada/i)).toBeVisible({ timeout: 10_000 })

  await requestCard.getByRole('button', { name: /Reprovar/i }).click()
  const rejectDialog = page.getByRole('dialog').filter({ hasText: /Reprovar a correção/i })
  await expect(rejectDialog).toBeVisible({ timeout: 5_000 })
  // Empty reason blocked client-side.
  await rejectDialog.getByRole('button', { name: /Reprovar correção/i }).click()
  await expect(rejectDialog.getByText(/Informe o motivo da reprovação/i)).toBeVisible()
  await rejectDialog.getByLabel(/Motivo da reprovação/i).fill('Falta justificar a mudança de valor.')
  await rejectDialog.getByRole('button', { name: /Reprovar correção/i }).click()
  await expect(rejectDialog).not.toBeVisible({ timeout: 10_000 })

  await expect(requestCard.getByText(/Reprovada/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(requestCard.getByText(/Falta justificar a mudança de valor/i)).toBeVisible()

  // "Em correção" persists on the phase article; "Continuar correção" reappears
  // for the corrector (rejected is a resting/editing state).
  const phaseArticleAfterReject = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phaseArticleAfterReject.getByText(/Em correção/i)).toBeVisible()

  // ── staff1 re-edits and resubmits ──
  await signOut(page)
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${STAFF_BASE}/${caseRejectId}`)
  await page.waitForURL(new RegExp(`/casos/${caseRejectId}`), { timeout: 15_000 })
  await editAndResubmit('Sim')

  // ── chefe approves this time ──
  await signOut(page)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseRejectId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseRejectId}`), { timeout: 15_000 })
  const requestCard2 = page
    .getByRole('region', { name: /Solicitações de correção/i })
    .locator('li')
    .filter({ hasText: /Fase 1/i })
    .first()
  await expect(requestCard2.getByText(/Reenviada/i)).toBeVisible({ timeout: 10_000 })
  await requestCard2.getByRole('button', { name: /^Aprovar$/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: /Aprovar correção/i }).click()
  await expect(requestCard2.getByText(/^Aprovada$/i)).toBeVisible({ timeout: 15_000 })

  // DB truth: the phase is completed and points at the re-edited successor; the
  // corrected value ("Sim", the re-edit after rejection) is verified via the UI
  // below (the respostas page renders the pointer's answers).
  const [phaseRow] = await svcGet<{ current_response_id: string; status: string }>(
    page.request as unknown as APIRequestContext,
    `case_phases?id=eq.${phaseRejectId}&select=current_response_id,status`,
  )
  expect(phaseRow.status).toBe('completed')
  expect(phaseRow.current_response_id).toBeTruthy()
  await page.goto(`${MANAGE_BASE}/${caseRejectId}/fase/${phaseRejectId}/respostas`)
  await expect(page.getByText(/\batual\b/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Sim', { exact: true }).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-3 — Keyboard-only file; one-open-slot second file blocked (server-side
// AND UI-hidden); withdraw frees the slot.
// ---------------------------------------------------------------------------

test('AC-3: keyboard-only file, one-open-slot blocks a second request (server + UI), withdraw frees it', async ({ page }) => {
  test.setTimeout(120_000)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseWithdrawId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseWithdrawId}`), { timeout: 15_000 })

  const phaseArticle = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phaseArticle).toBeVisible({ timeout: 10_000 })

  // ── Keyboard-only: focus "Corrigir…", open with Enter, arrow to the first
  // item, activate with Enter, type the reason, submit with Enter. ──
  const correctBtn = phaseArticle.getByRole('button', { name: /Corrigir/i })
  await correctBtn.focus()
  await expect(correctBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // Radix auto-focuses the FIRST item ("Solicitar correção") when the menu opens
  // via keyboard — no ArrowDown needed (that would move focus to the SECOND item).
  const fileMenuItem = page.getByRole('menuitem', { name: /Solicitar correção/i })
  await expect(fileMenuItem).toBeVisible({ timeout: 5_000 })
  await expect(fileMenuItem).toBeFocused()
  await page.keyboard.press('Enter')

  const fileDialog = page.getByRole('dialog').filter({ hasText: /Solicitar correção/i })
  await expect(fileDialog).toBeVisible({ timeout: 5_000 })
  const reasonField = fileDialog.getByLabel(/Motivo/i)
  await expect(reasonField).toBeFocused()
  await page.keyboard.type('Solicitação preenchida somente via teclado.')
  await expect(reasonField).toHaveValue(/somente via teclado/)

  // Tab to the submit button and activate with the keyboard.
  let submitFocused = false
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const isSubmit = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      return a?.tagName === 'BUTTON' && /^Solicitar correção$/.test(a.textContent?.trim() ?? '')
    })
    if (isSubmit) {
      submitFocused = true
      break
    }
  }
  expect(submitFocused).toBe(true)
  await page.keyboard.press('Enter')
  await expect(fileDialog).not.toBeVisible({ timeout: 10_000 })

  await expect(phaseArticle.getByText(/Em correção/i)).toBeVisible({ timeout: 10_000 })
  // The "Corrigir…" control disappears while a request is open (UI-level block).
  await expect(phaseArticle.getByRole('button', { name: /^Corrigir/i })).not.toBeVisible()

  // ── Server-side proof: a second `file_correction_request` on the SAME target
  // is rejected even bypassing the (already-hidden) UI control. ──
  const chefeToken = await getToken(page.request as unknown as APIRequestContext, 'chefe.ccih@test.local')
  const secondFileResp = await rpc(
    page.request as unknown as APIRequestContext,
    'file_correction_request',
    chefeToken,
    {
      p_kind: 'correction',
      p_case_phase_id: phaseWithdrawId,
      p_case_narrative_id: null,
      p_reason: 'Segunda tentativa — deve ser bloqueada.',
      p_classification: 'clerical',
    },
  )
  expect(secondFileResp.ok(), 'a second file_correction_request on an open target must be rejected').toBe(false)
  expect([400, 409]).toContain(secondFileResp.status())

  // ── Withdraw the open request ──
  const correctionsPanel = page.getByRole('region', { name: /Solicitações de correção/i })
  const requestCard = correctionsPanel.locator('li').filter({ hasText: /Fase 1/i }).first()
  await expect(requestCard.getByText(/^Solicitada$/i)).toBeVisible({ timeout: 10_000 })
  await requestCard.getByRole('button', { name: /Retirar/i }).click()
  const withdrawDialog = page.getByRole('alertdialog').filter({ hasText: /Retirar a solicitação/i })
  await expect(withdrawDialog).toBeVisible({ timeout: 5_000 })
  await withdrawDialog.getByRole('button', { name: /Retirar solicitação/i }).click()
  await expect(withdrawDialog).not.toBeVisible({ timeout: 10_000 })

  await expect(requestCard.getByText(/Retirada/i)).toBeVisible({ timeout: 10_000 })

  // The slot is freed: "Corrigir…" reappears and "Em correção" is gone.
  await expect(phaseArticle.getByRole('button', { name: /Corrigir/i })).toBeVisible({ timeout: 10_000 })
  await expect(phaseArticle.getByText(/Em correção/i)).not.toBeVisible()

  // A fresh request CAN now be filed on the same target (slot genuinely freed).
  await phaseArticle.getByRole('button', { name: /Corrigir/i }).click()
  await page.getByRole('menuitem', { name: /Solicitar correção/i }).click()
  const secondDialog = page.getByRole('dialog').filter({ hasText: /Solicitar correção/i })
  await secondDialog.getByLabel(/Motivo/i).fill('Nova solicitação após retirada da anterior.')
  await secondDialog.getByRole('button', { name: /^Solicitar correção$/ }).click()
  await expect(secondDialog).not.toBeVisible({ timeout: 10_000 })
  await expect(phaseArticle.getByText(/Em correção/i)).toBeVisible({ timeout: 10_000 })

  const openRequests = await svcGet<{ id: string; status: string }>(
    page.request as unknown as APIRequestContext,
    `case_correction_requests?case_phase_id=eq.${phaseWithdrawId}&status=eq.requested&select=id,status`,
  )
  expect(openRequests.length).toBe(1)
})

// ---------------------------------------------------------------------------
// AC-4 — Narrative correction parity: concluded narrative → Corrigir → draft →
// resubmit → approve → still "Concluída" + revision history.
// ---------------------------------------------------------------------------

test('AC-4: narrative correction — concluded narrative stays Concluída, revision history records the old body', async ({ page }) => {
  test.setTimeout(120_000)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${caseNarrId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseNarrId}`), { timeout: 15_000 })

  const narrativeCard = page.getByRole('region', { name: /Resumo Clínico/i })
  await expect(narrativeCard).toBeVisible({ timeout: 10_000 })
  await expect(narrativeCard.getByText(/^Concluída$/i)).toBeVisible()
  await expect(narrativeCard.getByText(/Bloqueada/i)).toBeVisible()
  await expect(narrativeCard.getByText(/Texto original registrado pela suite/i)).toBeVisible()
  // No inline "Editar" — the narrative is frozen; correction goes through Corrigir.
  await expect(narrativeCard.getByRole('button', { name: /^Editar$/ })).not.toBeVisible()

  await narrativeCard.getByRole('button', { name: /Corrigir/i }).click()
  await page.getByRole('menuitem', { name: /Solicitar correção/i }).click()
  const fileDialog = page.getByRole('dialog').filter({ hasText: /Solicitar correção/i })
  await expect(fileDialog).toBeVisible({ timeout: 5_000 })
  await fileDialog.getByLabel(/Motivo/i).fill('Reescrever o resumo com termos mais precisos.')
  // Explicitly self-designate chefe as corrector (staff_admin may designate anyone).
  const correctorSelect = fileDialog.getByLabel(/Corretor/i)
  await expect(correctorSelect).toBeVisible()
  await correctorSelect.selectOption(UID_CHEFE_A)
  await fileDialog.getByRole('button', { name: /^Solicitar correção$/ }).click()
  await expect(fileDialog).not.toBeVisible({ timeout: 10_000 })

  // Because chefe IS the designated corrector, the draft editor renders
  // immediately (narratives have no separate "start draft" step).
  const editorTextarea = narrativeCard.locator('textarea')
  await expect(editorTextarea).toBeVisible({ timeout: 10_000 })
  await editorTextarea.fill('## Resumo revisado\n\nTexto corrigido pela suite de testes.')
  await narrativeCard.getByRole('button', { name: /Enviar para revisão/i }).click()

  await expect(narrativeCard.getByText(/Reenviada/i)).toBeVisible({ timeout: 15_000 })

  // Approve.
  const correctionsPanel = page.getByRole('region', { name: /Solicitações de correção/i })
  const requestCard = correctionsPanel.locator('li').filter({ hasText: /Resumo Clínico/i }).first()
  await expect(requestCard.getByText(/Reenviada/i)).toBeVisible({ timeout: 10_000 })
  await requestCard.getByRole('button', { name: /^Aprovar$/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: /Aprovar correção/i }).click()
  await expect(requestCard.getByText(/^Aprovada$/i)).toBeVisible({ timeout: 15_000 })

  // The narrative body is now the corrected text; it is STILL "Concluída" — the
  // conclusion stamp is preserved (never re-opened by a correction).
  await expect(narrativeCard.getByText(/Resumo revisado/i)).toBeVisible({ timeout: 10_000 })
  await expect(narrativeCard.getByText(/^Concluída$/i)).toBeVisible()
  await expect(narrativeCard.getByText(/Bloqueada/i)).toBeVisible()

  // Revision history holds the OLD body.
  const historyToggle = narrativeCard.getByRole('button', { name: /Histórico de revisões/i })
  await expect(historyToggle).toBeVisible({ timeout: 10_000 })
  await historyToggle.click()
  await expect(narrativeCard.getByText(/Texto original registrado pela suite/i)).toBeVisible({
    timeout: 5_000,
  })

  // DB truth: concluded_at/by untouched, body updated, revision snapshot exists.
  const [narrRow] = await svcGet<{ status: string; concluded_at: string | null; concluded_by: string | null; body_md: string }>(
    page.request as unknown as APIRequestContext,
    `case_narratives?id=eq.${narrHappyNarrativeId}&select=status,concluded_at,concluded_by,body_md`,
  )
  expect(narrRow.status).toBe('completed')
  expect(narrRow.concluded_at).toBeTruthy()
  expect(narrRow.concluded_by).toBe(UID_CHEFE_A)
  expect(narrRow.body_md).toContain('Resumo revisado')

  const revisions = await svcGet<{ body_md: string; revision_number: number }>(
    page.request as unknown as APIRequestContext,
    `case_narrative_revisions?case_narrative_id=eq.${narrHappyNarrativeId}&select=body_md,revision_number`,
  )
  expect(revisions.length).toBeGreaterThanOrEqual(1)
  expect(revisions.some((r) => r.body_md.includes('Texto original registrado pela suite'))).toBe(true)
})
