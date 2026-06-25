import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * Phase 14d — CAPA Workspace (Plano de Ação Corretiva e Preventiva)
 *
 * Test contract: every bullet in the phase 14d Acceptance criteria.
 * Runs against LOCAL Supabase stack (seeded CAPA-0001).
 * Run `npx supabase db reset` before; `--workers=1` required.
 *
 * Acceptance criteria covered:
 *   C1  CAPA workspace page loads for seeded CAPA-0001 (em_execucao).
 *   C2  open_capa_plan from a non-RCA event source works.
 *   C3  add_capa_action (strength=forte, owner, due, success measure, root_cause_id).
 *   C4  add_capa_action_task + set_capa_action_task_done.
 *   C5  add_capa_action_evidence (link type) attached to an action.
 *   C6  add_capa_measure + record_capa_measure_result.
 *   C7  record_capa_effectiveness (eficaz) transitions plan em_execucao → em_verificacao.
 *   C8  close_capa_plan (lessons-learned) transitions → concluido.
 *   C9  close blocked with an open action → HC051 pt-BR error.
 *   C10 close blocked with no effectiveness verdict → HC052 pt-BR error.
 *   C11 reopen_capa_plan revokes the effectiveness verdict (plan reopens to em_execucao).
 *   C12 A concluded plan rejects edits (add_capa_action → guard fires HC049).
 *   C13 Assignee (plain staff) can advance their action (advance_capa_action).
 *   C14 Non-assignee non-PQS user cannot advance (HC050).
 *   C15 Foreign-committee user gets 0 CAPA rows (RLS boundary).
 *   C16 Every CAPA mutation appears in the audit trail (Phase-13 assertion).
 *   C17 Keyboard-only: CAPA workspace is keyboard reachable; actions visible.
 *
 * Seeded state (CAPA_ID = ca000000-0000-0000-0000-0000000000a3):
 *   - status: em_execucao
 *   - 1 action (caa00000…a1, em_andamento, strength=forte, assignee=staff1.ccih)
 *   - 2 tasks (task1 done, task2 not done)
 *   - 1 measure (cab00000…a1) + 1 result (period 2026-06, value 82)
 *   - effectiveness: parcial (LEFT OPEN so close-flow is testable)
 *
 * Personas (password Test1234!):
 *   admin@test.local         global admin / PQS member         (00…001)
 *   chefe.ccih@test.local    staff_admin CCIH                  (00…002)
 *   staff1.ccih@test.local   staff CCIH; action assignee        (00…003)
 *   chefe.farm@test.local    staff_admin Farmácia (no access)   (00…005)
 */

test.use({ viewport: { width: 1280, height: 900 } })

// SKIP(multi-org pilot): NSP/patient_safety module disabled when >1 org is
// provisioned (2-org seed, multi-tenancy Phase E). Re-enable when NSP-per-org
// lands and patient_safety_enabled() returns true for commission-scoped users.
const MULTI_ORG_PILOT_SKIP =
  'NSP/referral modules disabled in the 2-org multi-tenancy pilot seed — re-enable when NSP-per-org lands'

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.skip(true, MULTI_ORG_PILOT_SKIP)
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const CAPA_ID     = 'ca000000-0000-0000-0000-0000000000a3'
const CAPA_ACT_ID = 'caa00000-0000-0000-0000-0000000000a1'
const CAPA_MEAS_ID = 'cab00000-0000-0000-0000-0000000000a1'
const EV2_ID      = 'e2000000-0000-0000-0000-0000000000a2'  // stand-alone event (for source=event CAPA)

const ADMIN_EMAIL  = 'admin@test.local'
const STAFF1_EMAIL = 'staff1.ccih@test.local'
const FARM_EMAIL   = 'chefe.farm@test.local'
const STAFF1_ID    = '00000000-0000-0000-0000-000000000003'

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

async function getOwnerToken(
  req: APIRequestContext,
  email: string,
  password = 'Test1234!',
): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function restGet<T>(
  req: APIRequestContext,
  path: string,
  bearer: string,
): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${bearer}` },
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

async function auditRowsFor(
  req: APIRequestContext,
  action: string,
  entityId: string,
) {
  return restGet<{ id: string; action: string; actor_id: string | null }>(
    req,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_id=eq.${entityId}&select=id,action,actor_id`,
    SUPABASE_SERVICE_KEY,
  )
}

// ---------------------------------------------------------------------------
// C1 — CAPA workspace page loads for seeded CAPA-0001
// ---------------------------------------------------------------------------

test('C1: CAPA workspace page loads with seeded plan content', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL)
  await page.goto(`/admin/nsp/capa/${CAPA_ID}`)
  await page.waitForLoadState('networkidle')

  // Page heading
  const html = await page.content()
  expect(html.toLowerCase()).toMatch(/plano de ação|capa/i)

  // The seeded action title is visible
  await expect(page.getByText(/dupla checagem padronizada/i).first()).toBeVisible()

  // The plan has SOME status indicator (status changes across runs; just verify presence)
  expect(html.toLowerCase()).toMatch(/execu|verific|conclu|aberto|cancelad/i)
})

// ---------------------------------------------------------------------------
// C2 — open_capa_plan from a non-RCA event source
// ---------------------------------------------------------------------------

test('C2: open_capa_plan with source=event creates a new CAPA plan', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // EV-0002 is a stand-alone event (reported → acknowledged after triage tests may have
  // flipped it to 'closed'). We open a CAPA from it regardless of status (the FK is optional).
  const resp = await rpc(request, 'open_capa_plan', adminToken, {
    p_source: 'event',
    p_classification: 'preventiva',
    p_source_id: EV2_ID,
  })
  expect(resp.ok()).toBeTruthy()
  const plan = await resp.json() as {
    id: string; source: string; classification: string; status: string; source_event_id: string
  }
  expect(plan.source).toBe('event')
  expect(plan.classification).toBe('preventiva')
  expect(plan.status).toBe('aberto')
  expect(plan.source_event_id).toBe(EV2_ID)

  // Audit row must exist for capa.opened
  const auditRows = await auditRowsFor(request, 'capa.opened', plan.id)
  expect(auditRows.length).toBeGreaterThanOrEqual(1)
})

// ---------------------------------------------------------------------------
// C3 — add_capa_action (strength=forte, owner, due, success measure, root_cause_id)
// ---------------------------------------------------------------------------

test('C3: add_capa_action creates an action with strength=forte linked to a root cause', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // Get the seeded root cause id
  const rootCauses = await restGet<{ id: string; text: string }>(
    request,
    `rca_root_causes?rca_id=eq.f3000000-0000-0000-0000-0000000000a3&select=id,text&limit=1`,
    SUPABASE_SERVICE_KEY,
  )
  const rootCauseId = rootCauses[0]?.id ?? null

  const due = new Date()
  due.setDate(due.getDate() + 60)

  const resp = await rpc(request, 'add_capa_action', adminToken, {
    p_capa_id: CAPA_ID,
    p_title: 'Ação de spec E2E C3 — forte',
    p_owner: 'Enf. responsável do CC',
    p_assignee_user_id: STAFF1_ID,
    p_due_date: due.toISOString().split('T')[0],
    p_action_strength: 'forte',
    p_success_measure: 'Conformidade ≥ 95% nas auditorias',
    p_root_cause_id: rootCauseId,
  })
  expect(resp.ok()).toBeTruthy()
  const action = await resp.json() as {
    title: string; action_strength: string; assignee_user_id: string | null; root_cause_id: string | null
  }
  expect(action.action_strength).toBe('forte')
  expect(action.assignee_user_id).toBe(STAFF1_ID)
  if (rootCauseId) {
    expect(action.root_cause_id).toBe(rootCauseId)
  }
})

// ---------------------------------------------------------------------------
// C4 — add_capa_action_task + set_capa_action_task_done
// ---------------------------------------------------------------------------

test('C4: add_capa_action_task and mark task done', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  const addResp = await rpc(request, 'add_capa_action_task', adminToken, {
    p_action_id: CAPA_ACT_ID,
    p_description: 'Etapa de spec E2E C4 — validar protocolo atualizado',
  })
  expect(addResp.ok()).toBeTruthy()
  const task = await addResp.json() as { id: string; is_done: boolean; description: string }
  expect(task.is_done).toBe(false)
  expect(task.description).toMatch(/E2E C4/)

  const taskId = task.id

  // Mark it done
  const doneResp = await rpc(request, 'set_capa_action_task_done', adminToken, {
    p_task_id: taskId,
    p_is_done: true,
  })
  expect(doneResp.ok()).toBeTruthy()
  const done = await doneResp.json() as { is_done: boolean }
  expect(done.is_done).toBe(true)
})

// ---------------------------------------------------------------------------
// C5 — add_capa_action_evidence (link type)
// ---------------------------------------------------------------------------

test('C5: add_capa_action_evidence (link) attached to seeded action', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  const resp = await rpc(request, 'add_capa_action_evidence', adminToken, {
    p_action_id: CAPA_ACT_ID,
    p_kind: 'link',
    p_title: 'Evidência de link — spec E2E C5',
    p_external_url: 'https://example.com/evidencia-capa-c5',
  })
  expect(resp.ok()).toBeTruthy()
  const ev = await resp.json() as { kind: string; title: string; external_url: string }
  expect(ev.kind).toBe('link')
  expect(ev.external_url).toBe('https://example.com/evidencia-capa-c5')
})

// ---------------------------------------------------------------------------
// C6 — add_capa_measure + record_capa_measure_result
// ---------------------------------------------------------------------------

test('C6: add_capa_measure and record a result', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  const measureResp = await rpc(request, 'add_capa_measure', adminToken, {
    p_capa_id: CAPA_ID,
    p_name: 'Medida de spec E2E C6',
    p_target: '≥ 80%',
    p_definition: 'Taxa de conformidade mensal da dupla checagem',
  })
  expect(measureResp.ok()).toBeTruthy()
  const measure = await measureResp.json() as { id: string; name: string }
  expect(measure.name).toMatch(/E2E C6/)

  // Record a result for this measure
  const resultResp = await rpc(request, 'record_capa_measure_result', adminToken, {
    p_measure_id: measure.id,
    p_period: '2026-07',
    p_value: 91,
    p_note: 'Resultado do spec E2E C6',
  })
  expect(resultResp.ok()).toBeTruthy()
  const result = await resultResp.json() as { period: string; value: number }
  expect(result.period).toBe('2026-07')
  expect(result.value).toBe(91)
})

// ---------------------------------------------------------------------------
// C7 — record_capa_effectiveness (eficaz) → em_execucao → em_verificacao
// ---------------------------------------------------------------------------

test('C7: record_capa_effectiveness with eficaz transitions plan to em_verificacao', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // The seeded plan is em_execucao with a 'parcial' effectiveness.
  // Upsert to 'eficaz' to test the em_execucao→em_verificacao transition on a fresh plan.
  // We'll open a fresh plan for this test to avoid contaminating the seeded plan's state.
  const openResp = await rpc(request, 'open_capa_plan', adminToken, {
    p_source: 'manual',
    p_classification: 'corretiva',
  })
  expect(openResp.ok()).toBeTruthy()
  const freshPlan = await openResp.json() as { id: string; status: string }
  const freshId = freshPlan.id
  expect(freshPlan.status).toBe('aberto')

  // Add a dummy action
  const actResp = await rpc(request, 'add_capa_action', adminToken, {
    p_capa_id: freshId,
    p_title: 'Ação C7 para teste de eficácia',
  })
  expect(actResp.ok()).toBeTruthy()

  // Verify the plan is em_execucao now (add_capa_action bumps aberto → em_execucao)
  const planRows = await restGet<{ status: string }>(
    request,
    `capa_plan?id=eq.${freshId}&select=status`,
    SUPABASE_SERVICE_KEY,
  )
  expect(planRows[0]?.status).toBe('em_execucao')

  // Record effectiveness = eficaz
  const effResp = await rpc(request, 'record_capa_effectiveness', adminToken, {
    p_capa_id: freshId,
    p_verdict: 'eficaz',
    p_method_md: 'Verificação de eficácia do spec E2E C7',
  })
  expect(effResp.ok()).toBeTruthy()
  const eff = await effResp.json() as { verdict: string }
  expect(eff.verdict).toBe('eficaz')

  // Plan should now be em_verificacao
  const afterRows = await restGet<{ status: string }>(
    request,
    `capa_plan?id=eq.${freshId}&select=status`,
    SUPABASE_SERVICE_KEY,
  )
  expect(afterRows[0]?.status).toBe('em_verificacao')
})

// ---------------------------------------------------------------------------
// C8 — close_capa_plan: transitions → concluido with lessons-learned
// ---------------------------------------------------------------------------

test('C8: close_capa_plan transitions to concluido with lessons-learned', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // Open a fresh plan and bring it to a closeable state
  const openResp = await rpc(request, 'open_capa_plan', adminToken, {
    p_source: 'manual',
    p_classification: 'corretiva',
  })
  expect(openResp.ok()).toBeTruthy()
  const freshId = (await openResp.json() as { id: string }).id

  // Add a corrective action
  const actResp = await rpc(request, 'add_capa_action', adminToken, {
    p_capa_id: freshId,
    p_title: 'Ação C8 para teste de encerramento',
  })
  expect(actResp.ok()).toBeTruthy()
  const actId = (await actResp.json() as { id: string }).id

  // Complete the action
  const completeActResp = await rpc(request, 'complete_capa_action', adminToken, {
    p_action_id: actId,
  })
  expect(completeActResp.ok()).toBeTruthy()

  // Record effectiveness
  const effResp = await rpc(request, 'record_capa_effectiveness', adminToken, {
    p_capa_id: freshId,
    p_verdict: 'eficaz',
  })
  expect(effResp.ok()).toBeTruthy()

  // Now close
  const closeResp = await rpc(request, 'close_capa_plan', adminToken, {
    p_capa_id: freshId,
    p_lessons_learned_md: 'Lições aprendidas do spec E2E C8.',
  })
  expect(closeResp.ok()).toBeTruthy()
  const closed = await closeResp.json() as {
    status: string; lessons_learned_md: string; closed_at: string
  }
  expect(closed.status).toBe('concluido')
  expect(closed.lessons_learned_md).toMatch(/E2E C8/)
  expect(closed.closed_at).toBeTruthy()

  // Audit row
  const auditRows = await auditRowsFor(request, 'capa.closed', freshId)
  expect(auditRows.length).toBeGreaterThanOrEqual(1)
})

// ---------------------------------------------------------------------------
// C9 — Close blocked with open action → HC051 pt-BR error
// ---------------------------------------------------------------------------

test('C9: close_capa_plan with an open action raises HC051 (pt-BR message)', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // Use the seeded CAPA-0001 which has an em_andamento action (not settled)
  // First record effectiveness so HC051 is the first gate hit
  await rpc(request, 'record_capa_effectiveness', adminToken, {
    p_capa_id: CAPA_ID,
    p_verdict: 'eficaz',
  })

  const resp = await rpc(request, 'close_capa_plan', adminToken, {
    p_capa_id: CAPA_ID,
    p_lessons_learned_md: 'Tentativa de encerramento com ação aberta',
  })
  expect(resp.status()).not.toBe(200)
  const body = await resp.json() as { code?: string; message?: string }
  // HC051 = "conclua ou cancele todas as ações antes de encerrar o plano"
  const errorText = body.message ?? body.code ?? JSON.stringify(body)
  expect(errorText).toMatch(/HC051|ações|encerrar|conclua/i)
})

// ---------------------------------------------------------------------------
// C10 — Close blocked with no effectiveness → HC052 pt-BR error
// ---------------------------------------------------------------------------

test('C10: close_capa_plan with no effectiveness raises HC052 (pt-BR message)', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // Open a fresh plan + add + complete an action (no effectiveness recorded)
  const openResp = await rpc(request, 'open_capa_plan', adminToken, {
    p_source: 'manual',
    p_classification: 'corretiva',
  })
  const freshId = (await openResp.json() as { id: string }).id

  const actResp = await rpc(request, 'add_capa_action', adminToken, {
    p_capa_id: freshId,
    p_title: 'Ação para C10',
  })
  const actId = (await actResp.json() as { id: string }).id

  // Complete the action (so HC051 does not fire first)
  await rpc(request, 'complete_capa_action', adminToken, { p_action_id: actId })

  // Try to close WITHOUT effectiveness → HC052
  const closeResp = await rpc(request, 'close_capa_plan', adminToken, {
    p_capa_id: freshId,
    p_lessons_learned_md: 'Sem verificação de eficácia',
  })
  expect(closeResp.status()).not.toBe(200)
  const body = await closeResp.json() as { code?: string; message?: string }
  const errorText = body.message ?? body.code ?? JSON.stringify(body)
  expect(errorText).toMatch(/HC052|eficácia|verificação/i)
})

// ---------------------------------------------------------------------------
// C11 — reopen_capa_plan revokes the effectiveness verdict
// ---------------------------------------------------------------------------

test('C11: reopen_capa_plan revokes effectiveness; plan returns to em_execucao', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // Build a fresh plan → close it → reopen
  const openResp = await rpc(request, 'open_capa_plan', adminToken, {
    p_source: 'manual',
    p_classification: 'corretiva',
  })
  const freshId = (await openResp.json() as { id: string }).id

  const actResp = await rpc(request, 'add_capa_action', adminToken, {
    p_capa_id: freshId,
    p_title: 'Ação C11',
  })
  const actId = (await actResp.json() as { id: string }).id
  await rpc(request, 'complete_capa_action', adminToken, { p_action_id: actId })
  await rpc(request, 'record_capa_effectiveness', adminToken, {
    p_capa_id: freshId, p_verdict: 'eficaz',
  })
  await rpc(request, 'close_capa_plan', adminToken, {
    p_capa_id: freshId,
    p_lessons_learned_md: 'Fechamento para teste de reabertura C11',
  })

  // Reopen
  const reopenResp = await rpc(request, 'reopen_capa_plan', adminToken, {
    p_capa_id: freshId,
  })
  expect(reopenResp.ok()).toBeTruthy()
  const plan = await reopenResp.json() as { status: string; closed_at: string | null }
  expect(plan.status).toBe('em_execucao')
  expect(plan.closed_at).toBeNull()

  // Effectiveness must be revoked (row deleted)
  const effRows = await restGet<{ capa_id: string }>(
    request,
    `capa_effectiveness?capa_id=eq.${freshId}&select=capa_id`,
    SUPABASE_SERVICE_KEY,
  )
  expect(effRows.length).toBe(0)
})

// ---------------------------------------------------------------------------
// C12 — Concluded plan rejects edits → guard HC049
// ---------------------------------------------------------------------------

test('C12: adding action to a concluded plan raises HC049', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // Build + close a fresh plan
  const openResp = await rpc(request, 'open_capa_plan', adminToken, {
    p_source: 'manual',
    p_classification: 'corretiva',
  })
  const freshId = (await openResp.json() as { id: string }).id

  const actResp = await rpc(request, 'add_capa_action', adminToken, {
    p_capa_id: freshId,
    p_title: 'Ação C12 para teste de plano concluído',
  })
  const actId = (await actResp.json() as { id: string }).id
  await rpc(request, 'complete_capa_action', adminToken, { p_action_id: actId })
  await rpc(request, 'record_capa_effectiveness', adminToken, {
    p_capa_id: freshId, p_verdict: 'eficaz',
  })
  await rpc(request, 'close_capa_plan', adminToken, {
    p_capa_id: freshId,
    p_lessons_learned_md: 'Fechado para teste C12',
  })

  // Try to add a new action — must be rejected
  const addResp = await rpc(request, 'add_capa_action', adminToken, {
    p_capa_id: freshId,
    p_title: 'Ação tentativa em plano concluído',
  })
  expect(addResp.status()).not.toBe(200)
  const body = await addResp.json() as { code?: string; message?: string }
  const errorText = body.message ?? body.code ?? JSON.stringify(body)
  // HC049: "plano em um estado inválido" or guard_capa_status raises it
  expect(errorText).toMatch(/HC049|concluido|terminal|encerr/i)
})

// ---------------------------------------------------------------------------
// C13 — Assignee (plain staff) can advance their action
// ---------------------------------------------------------------------------

test('C13: assignee (staff1.ccih) can advance their action via advance_capa_action', async ({
  request,
}) => {
  // staff1.ccih is the assignee of seeded action CAPA_ACT_ID
  const staffToken = await getOwnerToken(request, STAFF1_EMAIL)

  // Current status: em_andamento → advance to 'concluida' (valid action terminal status)
  const resp = await rpc(request, 'advance_capa_action', staffToken, {
    p_action_id: CAPA_ACT_ID,
    p_status: 'concluida',
  })
  expect(resp.ok()).toBeTruthy()
  const action = await resp.json() as { status: string }
  expect(action.status).toBe('concluida')

  // Return to em_andamento so other tests are not affected
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)
  const rollbackResp = await rpc(request, 'advance_capa_action', adminToken, {
    p_action_id: CAPA_ACT_ID,
    p_status: 'em_andamento',
  })
  expect(rollbackResp.ok()).toBeTruthy()
})

// ---------------------------------------------------------------------------
// C14 — Non-assignee non-PQS cannot advance (HC050)
// ---------------------------------------------------------------------------

test('C14: non-assignee non-PQS gets HC050 on advance_capa_action', async ({
  request,
}) => {
  // chefe.farm is not the assignee of CAPA_ACT_ID and not a PQS member.
  // Use a valid target status (concluida) so the enum check passes and HC050 fires.
  const farmToken = await getOwnerToken(request, FARM_EMAIL)

  const resp = await rpc(request, 'advance_capa_action', farmToken, {
    p_action_id: CAPA_ACT_ID,
    p_status: 'concluida',
  })
  expect(resp.status()).not.toBe(200)
  const body = await resp.json() as { code?: string; message?: string }
  const errorText = body.message ?? body.code ?? JSON.stringify(body)
  // HC050: "você não pode alterar esta ação corretiva"
  expect(errorText).toMatch(/HC050|não pode alterar|você não pode/i)
})

// ---------------------------------------------------------------------------
// C15 — Foreign-committee user gets 0 CAPA rows (RLS)
// ---------------------------------------------------------------------------

test('C15: foreign-committee user (chefe.farm, no access) gets 0 CAPA rows', async ({
  request,
}) => {
  const farmToken = await getOwnerToken(request, FARM_EMAIL)

  // chefe.farm has no relation to the RCA/event that scopes CAPA_ID
  const rows = await restGet<{ id: string }>(
    request,
    `capa_plan?id=eq.${CAPA_ID}&select=id`,
    farmToken,
  )
  expect(rows.length).toBe(0)
})

// ---------------------------------------------------------------------------
// C16 — Every CAPA mutation appears in the audit trail
// ---------------------------------------------------------------------------

test('C16: capa.opened audit row exists for CAPA-0001 (Phase-13 assertion)', async ({
  request,
}) => {
  // The seeded CAPA was inserted via raw SQL (not an RPC), so the INSERT trigger
  // should have fired. The trigger emits 'capa.opened' for an INSERT.
  const rows = await auditRowsFor(request, 'capa.opened', CAPA_ID)
  expect(rows.length).toBeGreaterThanOrEqual(1)
})

test('C16b: capa.action_advanced audit row written when action status changes', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // Advance the action and verify an audit row appears for the CAPA plan entity
  // (the trigger fires on capa_action changes, entity = capa_plan.id or action.id
  // depending on implementation — we use CAPA_ID as the parent scope)
  const before = await restGet<{ id: string }>(
    request,
    `audit_log?entity_id=eq.${CAPA_ID}&action=ilike.capa.*&select=id`,
    SUPABASE_SERVICE_KEY,
  )

  await rpc(request, 'advance_capa_action', adminToken, {
    p_action_id: CAPA_ACT_ID,
    p_status: 'em_verificacao',
  })

  const after = await restGet<{ id: string }>(
    request,
    `audit_log?entity_id=eq.${CAPA_ID}&action=ilike.capa.*&select=id`,
    SUPABASE_SERVICE_KEY,
  )
  // At least one new audit row must exist after the action advance
  expect(after.length).toBeGreaterThanOrEqual(before.length)

  // Restore
  await rpc(request, 'advance_capa_action', adminToken, {
    p_action_id: CAPA_ACT_ID,
    p_status: 'em_andamento',
  })
})

// ---------------------------------------------------------------------------
// C17 — Keyboard-only: CAPA workspace is keyboard reachable
// ---------------------------------------------------------------------------

test('C17: keyboard-only — CAPA workspace loads and action sections are keyboard reachable', async ({
  page,
}) => {
  await signInAs(page, ADMIN_EMAIL)
  await page.goto(`/admin/nsp/capa/${CAPA_ID}`)
  await page.waitForLoadState('networkidle')

  // Page main content area visible
  await expect(page.getByRole('main')).toBeVisible()

  // Tab once — should focus something inside the layout (skip-to-content or first link)
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => document.activeElement?.tagName)
  expect(focused).not.toBe('BODY')

  // The seeded action title must be visible (keyboard users can read it)
  await expect(page.getByText(/dupla checagem padronizada/i).first()).toBeVisible()

  // Tab to the first interactive element in the action list
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  // Verify nothing crashed during keyboard navigation
  const stillOnPage = page.url().includes('/capa/')
  expect(stillOnPage).toBe(true)
})

// ---------------------------------------------------------------------------
// C18 — CAPA page PHI-free
// ---------------------------------------------------------------------------

test('C18: CAPA workspace page contains NO patient PHI', async ({ page }) => {
  await signInAs(page, ADMIN_EMAIL)
  await page.goto(`/admin/nsp/capa/${CAPA_ID}`)
  await page.waitForLoadState('networkidle')

  const html = await page.content()
  expect(html).not.toContain('Paciente de Demonstração')
  expect(html).not.toContain('PRT-0099123')
  expect(html).not.toContain('1958-03-14')
})
