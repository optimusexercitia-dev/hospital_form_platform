import { test, expect, type Page, type Locator } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { setDateTimeField } from './helpers/date-pickers'

/**
 * Phase 11 — Interviews v2 (IV2 — ADR 0070, plan §I5)
 *
 * IV2 replaced the one-encounter-per-interview model with an `interview_sessions`
 * 1:N child: the interview stays the lifecycle coordinator (`draft → scheduled →
 * in_progress ⇄ awaiting_follow_up → completed`, plus `cancelled`) while sessions
 * carry scheduling + their own status. `schedule_interview`/`start_interview` are
 * GONE — replaced by `schedule_session`/`start_session`/`complete_session`/
 * `cancel_session`/`no_show_session`/`update_session`. `interview_category` is now
 * required at create; `confidentiality_level` is a NON-ENFORCING tag; subjects
 * require `relationship_to_case`. State machine: docs/plans/interviews-v2-sessions.md §4.
 *
 * Test contract: translates every bullet of plan §I5 into Playwright assertions.
 * Runs against the LOCAL Supabase stack (seeded personas).
 *
 * Seeded fixture (supabase/seed.sql — Phase 11 / IV2 block):
 *   Seeded interview f2000000-…-e1: "Entrevista sobre o Caso 0001" on Caso 0001
 *     - status: `awaiting_follow_up` (session #1 completed, session #2 scheduled)
 *     - commission: CCIH (a0000000-…-a1); case: d0000000-…-c1 (Caso 0001)
 *     - interview_category: clinical_team; confidentiality_level: standard
 *     - interviewers: chefe.ccih (REGISTERED, entrevistador_principal) + Dra. Helena Marques (EXTERNAL)
 *     - subjects: staff1.ccih (REGISTERED, relationship_to_case=nurse) + Carlos Pereira (EXTERNAL, other_professional)
 *     - attachments: one file (transcricao_assinada) + one link (gravacao_audio, external https URL)
 *   None of the specs below MUTATE the seeded interview — every test creates its
 *   own fresh interview via RPC, so tests are independent under --workers=1.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local       staff_admin of CCIH (id …0002), registered interviewer on seeded interview
 *   staff1.ccih@test.local      staff of CCIH (id …0003), registered SUBJECT on seeded interview (NOT interviewer)
 *   staff2.ccih@test.local      staff of CCIH (id …0004), NOT an interviewer on any interview
 *   chefe.farm@test.local       staff_admin of Farmácia (foreign commission)
 *
 * Run with --workers=1. Run `npx supabase db reset` before a full run.
 *
 * Note: AlertDialog lifecycle buttons use e.preventDefault() — dialogs close via
 * route refresh on success, staying open with an inline error on failure. Because
 * "Concluir" and "Cancelar" exist BOTH at the interview level (header) and the
 * session level (sessions panel), every such assertion below is scoped to either
 * `page.locator('header')` or the sessions-panel region to avoid Playwright
 * strict-mode multi-match errors.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (deterministic IDs from seed.sql)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const SEEDED_INTERVIEW_ID = 'f2000000-0000-0000-0000-0000000000e1'
const SEEDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001

// ---------------------------------------------------------------------------
// Auth / navigation helpers
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
  await page.evaluate(() => window.scrollTo(0, 0))
  const userMenu = page.getByRole('button', { name: /abrir menu da conta/i })
  await userMenu.click()
  const sairItem = page.getByRole('menuitem', { name: /sair/i })
  await expect(sairItem).toBeVisible({ timeout: 5_000 })
  await sairItem.click()
  await page.waitForURL('**/login', { timeout: 15_000 })
}

/** Navigate to Caso 0001 detail as the currently signed-in coordinator. */
async function goToCaseDetail(page: Page) {
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(`**/c/ccih/manage/cases/${SEEDED_CASE_ID}`, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Entrevistas/i }).first()).toBeVisible({
    timeout: 15_000,
  })
}

async function goToInterview(page: Page, interviewId: string) {
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${interviewId}`)
  await page.waitForURL(`**/interviews/${interviewId}`, { timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// REST / RPC helpers (service-role DB truth + caller-scoped RLS/RPC calls)
// ---------------------------------------------------------------------------

async function getInterviewRow(
  page: Page,
  interviewId: string,
): Promise<{
  status: string
  interview_category: string
  confidentiality_level: string
  registry_event_id: string | null
  concluded_at: string | null
  cancelled_at: string | null
} | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interviews?id=eq.${interviewId}&select=status,interview_category,confidentiality_level,registry_event_id,concluded_at,cancelled_at`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    },
  )
  const data = await resp.json()
  if (!Array.isArray(data) || data.length === 0) return null
  return data[0]
}

async function getSessions(
  page: Page,
  interviewId: string,
): Promise<
  Array<{
    id: string
    sequence_number: number
    session_type: string
    status: string
    scheduled_start: string | null
    actual_start: string | null
    actual_end: string | null
    cancellation_reason: string | null
  }>
> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/interview_sessions?interview_id=eq.${interviewId}&select=id,sequence_number,session_type,status,scheduled_start,actual_start,actual_end,cancellation_reason&order=sequence_number.asc`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    },
  )
  const data = await resp.json()
  return Array.isArray(data) ? data : []
}

async function getSubjects(
  page: Page,
  interviewId: string,
): Promise<Array<{ id: string; user_id: string | null; external_name: string | null; relationship_to_case: string }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interview_subjects?interview_id=eq.${interviewId}&select=id,user_id,external_name,relationship_to_case`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    },
  )
  const data = await resp.json()
  return Array.isArray(data) ? data : []
}

/** Service-role JWT: list case_events for a case. */
async function getCaseEvents(
  page: Page,
  caseId: string,
): Promise<Array<{ id: string; kind: string; title: string | null }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_events?case_id=eq.${caseId}&select=id,kind,title`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    },
  )
  const data = await resp.json()
  return Array.isArray(data) ? data : []
}

/** Obtain a real JWT for a persona (RLS-scoped token). */
async function getOwnerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call an RPC via the REST API with a caller-supplied JWT (tests RLS/RPC authority). */
async function callRPC(
  page: Page,
  token: string,
  rpcName: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: body,
  })
  const text = await resp.text()
  let body_parsed: unknown
  try {
    body_parsed = JSON.parse(text)
  } catch {
    body_parsed = text
  }
  return { status: resp.status(), body: body_parsed }
}

/** Create a fresh interview via RPC (fast test setup — the UI create flow itself is covered by IV2-1/IV2-8). */
async function createInterviewRpc(
  page: Page,
  token: string,
  opts: { title: string; category: string; caseId?: string; confidentiality?: string },
): Promise<string> {
  const res = await callRPC(page, token, 'create_interview', {
    p_case_id: opts.caseId ?? SEEDED_CASE_ID,
    p_title: opts.title,
    p_interview_category: opts.category,
    ...(opts.confidentiality ? { p_confidentiality_level: opts.confidentiality } : {}),
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return (res.body as { id: string }).id
}

async function scheduleSessionRpc(
  page: Page,
  token: string,
  interviewId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await callRPC(page, token, 'schedule_session', {
    p_interview_id: interviewId,
    ...extra,
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return (res.body as { id: string }).id
}

async function startSessionRpc(page: Page, token: string, sessionId: string): Promise<void> {
  const res = await callRPC(page, token, 'start_session', { p_session_id: sessionId })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

async function completeSessionRpc(page: Page, token: string, sessionId: string): Promise<void> {
  const res = await callRPC(page, token, 'complete_session', { p_session_id: sessionId })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
}

async function addSubjectRpc(
  page: Page,
  token: string,
  interviewId: string,
  opts: { externalName?: string; relationship?: string } = {},
): Promise<string> {
  const res = await callRPC(page, token, 'add_interview_subject', {
    p_interview_id: interviewId,
    p_external_name: opts.externalName ?? 'Sujeito de Teste',
    p_relationship_to_case: opts.relationship ?? 'witness',
  })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return (res.body as { id: string }).id
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Locate a `<select>`/`<textarea>` nested inside a `<label>` by the label's text
 * (structural lookup — sidesteps ARIA implicit-label computation through the
 * NativeSelect wrapper `<div>`; mirrors `fieldContainer` in helpers/date-pickers.ts). */
function selectByLabel(scope: Locator, labelText: string): Locator {
  return scope.locator('label').filter({ hasText: labelText }).locator('select')
}
function textareaByLabel(scope: Locator, labelText: string): Locator {
  return scope.locator('label').filter({ hasText: labelText }).locator('textarea')
}

/**
 * Click an AlertDialog-confirm lifecycle trigger and confirm it. `trigger` must
 * already be scoped (header vs. sessions-panel region) by the caller — "Concluir"
 * and "Cancelar" exist at BOTH the interview and session level, so an unscoped
 * `page.getByRole('button', …)` would multi-match.
 */
async function confirmLifecycle(
  page: Page,
  trigger: Locator,
  confirmLabel: string | RegExp,
): Promise<void> {
  await trigger.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole('button', { name: confirmLabel }).click()
  await expect(dialog).not.toBeVisible({ timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// IV2-0 — Seeded fixture read assertions (no mutation)
// ---------------------------------------------------------------------------

test('IV2-0 — seeded fixture: awaiting_follow_up (1 completed + 1 scheduled session); subjects carry relationship_to_case', async ({ page }) => {
  const dbRow = await getInterviewRow(page, SEEDED_INTERVIEW_ID)
  expect(dbRow?.status).toBe('awaiting_follow_up')
  expect(dbRow?.interview_category).toBe('clinical_team')
  expect(dbRow?.confidentiality_level).toBe('standard')

  const sessions = await getSessions(page, SEEDED_INTERVIEW_ID)
  expect(sessions.length).toBe(2)
  expect(sessions.find((s) => s.status === 'completed')).toBeDefined()
  expect(sessions.find((s) => s.status === 'scheduled')).toBeDefined()

  const subjects = await getSubjects(page, SEEDED_INTERVIEW_ID)
  expect(subjects.length).toBe(2)
  expect(subjects.every((s) => typeof s.relationship_to_case === 'string' && s.relationship_to_case.length > 0)).toBe(
    true,
  )

  // UI: the detail page renders (no RSC crash from the model migration) and shows
  // the awaiting_follow_up badge + both sessions + the seeded subject.
  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, SEEDED_INTERVIEW_ID)
  await expect(page.getByRole('heading', { name: /Entrevista sobre o Caso 0001/i }).first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.locator('header').getByText('Aguardando follow-up', { exact: true })).toBeVisible()

  const sessionsSection = page.getByRole('region', { name: /Sessões/i })
  await expect(sessionsSection).toBeVisible()
  await expect(sessionsSection.locator('li')).toHaveCount(2)

  const subjectsSection = page.getByRole('region', { name: /Entrevistados/i })
  await expect(subjectsSection).toContainText(/Carlos Pereira/i)

  const interviewersSection = page.getByRole('region', { name: /Entrevistadores/i })
  await expect(interviewersSection).toContainText(/Dra. Helena Marques/i)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-1 — create requires interview_category; confidentiality non-enforcing copy
// ---------------------------------------------------------------------------

test('IV2-1 — create requires interview_category (cannot submit without it); confidentiality picker shows non-enforcing helper copy; RPC rejects a missing category (HC0B1)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await goToCaseDetail(page)

  const interviewsSection = page.getByRole('region', { name: /Entrevistas/i }).first()
  await interviewsSection.getByRole('button', { name: /Nova entrevista/i }).click()
  const createDialog = page.getByRole('dialog', { name: /Nova entrevista/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })

  await createDialog.getByPlaceholder(/Entrevista com a equipe/i).fill('Entrevista IV2-1')

  // The confidentiality helper copy is visible and states the tag does not
  // restrict access yet (mandatory pt-BR clarification — plan §2.6 / §6 risk).
  await expect(createDialog.getByText(/não restringe o acesso/i)).toBeVisible()

  // Isolate: don't schedule a first session inline for this test.
  await createDialog.getByRole('checkbox', { name: /Agendar a primeira sessão agora/i }).uncheck()

  // Submit WITHOUT selecting a category → blocked client-side; dialog stays open.
  await createDialog.getByRole('button', { name: /Criar entrevista/i }).click()
  await expect(createDialog).toBeVisible()
  const categoryAlert = createDialog.getByRole('alert')
  await expect(categoryAlert).toBeVisible({ timeout: 5_000 })
  await expect(categoryAlert).toContainText(/categoria/i)

  // Now select a category and submit successfully.
  await selectByLabel(createDialog, 'Categoria').selectOption({ label: 'Testemunha' })
  await createDialog.getByRole('button', { name: /Criar entrevista/i }).click()

  await page.waitForURL(/\/c\/ccih\/manage\/cases\/.+\/interviews\/.+/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  const interviewId = page.url().match(/interviews\/([a-f0-9-]+)/)![1]
  await expect(page.locator('header').getByText('Rascunho', { exact: true })).toBeVisible()
  await expect(page.locator('header')).toContainText('Testemunha')
  await expect(page.locator('header')).toContainText('Padrão') // default confidentiality_level

  const dbRow = await getInterviewRow(page, interviewId)
  expect(dbRow?.interview_category).toBe('witness')
  expect(dbRow?.confidentiality_level).toBe('standard')

  // Server-level defense in depth: create_interview rejects a missing category (HC0B1).
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const rpcResult = await callRPC(page, chefeToken, 'create_interview', {
    p_case_id: SEEDED_CASE_ID,
    p_title: 'Sem Categoria IV2-1',
  })
  expect(rpcResult.status).toBe(400)
  expect((rpcResult.body as { code: string }).code).toBe('HC0B1')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-2 — session lifecycle: schedule → start → complete
// ---------------------------------------------------------------------------

test('IV2-2 — session lifecycle: schedule a session, start it, complete it (interview stays em_andamento — no other session pending)', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-2 Sessão',
    category: 'clinical_team',
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, interviewId)

  const sessionsSection = page.getByRole('region', { name: /Sessões/i })
  await expect(sessionsSection.locator('li')).toHaveCount(0)

  // Schedule
  await sessionsSection.getByRole('button', { name: /Agendar sessão/i }).click()
  const scheduleDialog = page.getByRole('dialog', { name: /Agendar sessão/i })
  await expect(scheduleDialog).toBeVisible({ timeout: 10_000 })
  await selectByLabel(scheduleDialog, 'Tipo de sessão').selectOption({ label: 'Inicial' })
  await setDateTimeField(page, scheduleDialog, 'Início', { time: '10:00' })
  await scheduleDialog.getByRole('button', { name: /Agendar sessão/i }).click()
  await expect(scheduleDialog).not.toBeVisible({ timeout: 15_000 })

  await expect(page.locator('header').getByText('Agendada', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(sessionsSection.locator('li')).toHaveCount(1)
  await expect(sessionsSection).toContainText('Agendada')
  await expect(sessionsSection).toContainText('Inicial')

  // Start
  const startBtn = sessionsSection.getByRole('button', { name: /Iniciar/i })
  await confirmLifecycle(page, startBtn, /Iniciar sessão/i)
  await expect(page.locator('header').getByText('Em andamento', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(sessionsSection.getByText('Em andamento', { exact: true })).toBeVisible()

  // Complete
  const completeBtn = sessionsSection.getByRole('button', { name: /Concluir/i })
  await confirmLifecycle(page, completeBtn, /Concluir sessão/i)

  // No OTHER scheduled session exists → the interview stays em_andamento (does
  // NOT flip to awaiting_follow_up); this is the precise §4 derivation contract.
  await expect(page.locator('header').getByText('Em andamento', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(sessionsSection.getByText('Concluída', { exact: true })).toBeVisible()

  const sessions = await getSessions(page, interviewId)
  expect(sessions.length).toBe(1)
  expect(sessions[0].status).toBe('completed')
  expect(sessions[0].actual_start).not.toBeNull()
  expect(sessions[0].actual_end).not.toBeNull()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-3 — follow-up session → awaiting_follow_up derivation
// ---------------------------------------------------------------------------

test('IV2-3 — adding a follow-up session while em_andamento, then completing the first, flips the interview to aguardando follow-up', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-3 Follow-up',
    category: 'witness',
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, interviewId)
  const sessionsSection = page.getByRole('region', { name: /Sessões/i })

  // Session 1: schedule + start (em_andamento)
  await sessionsSection.getByRole('button', { name: /Agendar sessão/i }).click()
  let sessionDialog = page.getByRole('dialog', { name: /Agendar sessão/i })
  await expect(sessionDialog).toBeVisible({ timeout: 10_000 })
  await selectByLabel(sessionDialog, 'Tipo de sessão').selectOption({ label: 'Inicial' })
  await sessionDialog.getByRole('button', { name: /Agendar sessão/i }).click()
  await expect(sessionDialog).not.toBeVisible({ timeout: 15_000 })

  const startBtn = sessionsSection.getByRole('button', { name: /Iniciar/i })
  await confirmLifecycle(page, startBtn, /Iniciar sessão/i)
  await expect(page.locator('header').getByText('Em andamento', { exact: true })).toBeVisible({ timeout: 15_000 })

  // Add the FOLLOW-UP session (still scheduled) while session 1 is still in_progress.
  // Scheduling from em_andamento does not itself change the interview status.
  await sessionsSection.getByRole('button', { name: /Agendar sessão/i }).click()
  sessionDialog = page.getByRole('dialog', { name: /Agendar sessão/i })
  await expect(sessionDialog).toBeVisible({ timeout: 10_000 })
  // Default session type is already "Follow-up" — leave it.
  await sessionDialog.getByRole('button', { name: /Agendar sessão/i }).click()
  await expect(sessionDialog).not.toBeVisible({ timeout: 15_000 })

  await expect(sessionsSection.locator('li')).toHaveCount(2)
  await expect(page.locator('header').getByText('Em andamento', { exact: true })).toBeVisible()
  await expect(sessionsSection).toContainText('Follow-up')

  // Complete session 1: exactly one "Concluir" inside the sessions region now
  // (session 2 is scheduled, not in_progress, so it shows no Concluir button).
  const completeBtn = sessionsSection.getByRole('button', { name: /Concluir/i })
  await confirmLifecycle(page, completeBtn, /Concluir sessão/i)

  // Session 2 is still `scheduled` → the interview derives awaiting_follow_up.
  await expect(page.locator('header').getByText('Aguardando follow-up', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  // canConclude also covers awaiting_follow_up — the header's Concluir stays available.
  await expect(page.locator('header').getByRole('button', { name: /Concluir/i })).toBeVisible()

  const dbRow = await getInterviewRow(page, interviewId)
  expect(dbRow?.status).toBe('awaiting_follow_up')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-4 — conclude requires >=1 subject; single registry event; content lock
// ---------------------------------------------------------------------------

test('IV2-4 — conclude requires >=1 subject (HC041 surfaces inline); exactly one registry event, no duplicate on reopen+reconclude; content locks but attachments stay manageable', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-4 Sem Sujeito',
    category: 'witness',
  })
  const s1 = await scheduleSessionRpc(page, chefeToken, interviewId)
  await startSessionRpc(page, chefeToken, s1)
  await completeSessionRpc(page, chefeToken, s1)
  // interview em_andamento (no other scheduled session), 0 subjects

  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, interviewId)
  await expect(page.locator('header').getByText('Em andamento', { exact: true })).toBeVisible({ timeout: 15_000 })

  // Attempt to conclude WITHOUT a subject → HC041 surfaces inline; dialog stays open.
  const concludeBtn = page.locator('header').getByRole('button', { name: /Concluir/i })
  await concludeBtn.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole('button', { name: /Concluir entrevista/i }).click()
  const inlineError = dialog.getByRole('alert')
  await expect(inlineError).toBeVisible({ timeout: 10_000 })
  await expect(inlineError).toContainText(/entrevistado/i)
  await dialog.getByRole('button', { name: /Voltar/i }).click()
  await expect(dialog).not.toBeVisible()

  // Add a subject via the UI.
  const subjectsSection = page.getByRole('region', { name: /Entrevistados/i })
  await subjectsSection.getByRole('button', { name: /Adicionar/i }).click()
  const subjectDialog = page.getByRole('dialog', { name: /Adicionar entrevistado/i })
  await expect(subjectDialog).toBeVisible({ timeout: 10_000 })
  await subjectDialog.getByRole('button', { name: /Profissional externo/i }).click()
  await subjectDialog.getByPlaceholder(/Dra. Ana Lima/i).fill('Sujeito IV2-4')
  await selectByLabel(subjectDialog, 'Relação com o caso').selectOption({ label: 'Testemunha' })
  await subjectDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(subjectDialog).not.toBeVisible({ timeout: 15_000 })

  // Conclude successfully now.
  await confirmLifecycle(page, concludeBtn, /Concluir entrevista/i)
  await expect(page.locator('header').getByText('Concluída', { exact: true })).toBeVisible({ timeout: 20_000 })

  const dbRow = await getInterviewRow(page, interviewId)
  expect(dbRow?.status).toBe('completed')
  expect(dbRow?.registry_event_id).not.toBeNull()
  const registryEventId = dbRow!.registry_event_id!

  const eventsAfterConclude = await getCaseEvents(page, SEEDED_CASE_ID)
  const interviewEventsBefore = eventsAfterConclude.filter((e) => e.kind === 'interview').length

  // Reopen + re-conclude — same registry row UPDATED, never duplicated.
  const reopenBtn = page.locator('header').getByRole('button', { name: /Reabrir/i })
  await confirmLifecycle(page, reopenBtn, /Reabrir entrevista/i)
  await expect(page.locator('header').getByText('Em andamento', { exact: true })).toBeVisible({ timeout: 15_000 })

  const concludeBtn2 = page.locator('header').getByRole('button', { name: /Concluir/i })
  await confirmLifecycle(page, concludeBtn2, /Concluir entrevista/i)
  await expect(page.locator('header').getByText('Concluída', { exact: true })).toBeVisible({ timeout: 20_000 })

  const dbRowAfter = await getInterviewRow(page, interviewId)
  expect(dbRowAfter?.registry_event_id).toBe(registryEventId)

  const eventsAfterReconclude = await getCaseEvents(page, SEEDED_CASE_ID)
  const interviewEventsAfter = eventsAfterReconclude.filter((e) => e.kind === 'interview').length
  expect(interviewEventsAfter).toBe(interviewEventsBefore)

  // Content is locked once concluded (canEditContent=false): no session/subject/
  // interviewer "add" controls — but attachments stay manageable (ADR 0026).
  const sessionsSection = page.getByRole('region', { name: /Sessões/i })
  await expect(sessionsSection.getByRole('button', { name: /Agendar sessão/i })).not.toBeVisible()
  await expect(subjectsSection.getByRole('button', { name: /Adicionar/i })).not.toBeVisible()
  const interviewersSection = page.getByRole('region', { name: /Entrevistadores/i })
  await expect(interviewersSection.getByRole('button', { name: /Adicionar/i })).not.toBeVisible()

  const attachmentsSection = page.getByRole('region', { name: /Anexos e gravações/i })
  await expect(attachmentsSection.getByRole('button', { name: /Enviar anexo/i })).toBeVisible()
  await expect(attachmentsSection.getByRole('button', { name: /Adicionar gravação/i })).toBeVisible()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-5 — reschedule a session
// ---------------------------------------------------------------------------

test('IV2-5 — reschedule a session (edit times)', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-5 Reagendar',
    category: 'clinical_team',
  })
  const sessionId = await scheduleSessionRpc(page, chefeToken, interviewId, {
    p_scheduled_start: '2026-08-01T10:00:00Z',
  })
  const before = await getSessions(page, interviewId)
  expect(before[0].scheduled_start).toBe('2026-08-01T10:00:00+00:00')

  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, interviewId)
  const sessionsSection = page.getByRole('region', { name: /Sessões/i })

  await sessionsSection.getByRole('button', { name: /Reagendar/i }).click()
  const rescheduleDialog = page.getByRole('dialog', { name: /Reagendar sessão/i })
  await expect(rescheduleDialog).toBeVisible({ timeout: 10_000 })
  await setDateTimeField(page, rescheduleDialog, 'Início', { time: '14:30', day: '20' })
  await rescheduleDialog.getByRole('button', { name: /Salvar/i }).click()
  await expect(rescheduleDialog).not.toBeVisible({ timeout: 15_000 })

  const after = await getSessions(page, interviewId)
  expect(after.length).toBe(1)
  expect(after[0].id).toBe(sessionId)
  expect(after[0].scheduled_start).not.toBe(before[0].scheduled_start)
  expect(after[0].scheduled_start).not.toBeNull()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-6 — cancel a session / mark another as no-show
// ---------------------------------------------------------------------------

test('IV2-6 — cancel a session and mark another as no-show (both terminal, with reason)', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-6 Cancelar/Não Compareceu',
    category: 'expert',
  })
  await scheduleSessionRpc(page, chefeToken, interviewId) // session #1
  await scheduleSessionRpc(page, chefeToken, interviewId) // session #2

  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, interviewId)
  const sessionsSection = page.getByRole('region', { name: /Sessões/i })
  await expect(sessionsSection.locator('li')).toHaveCount(2)

  // Session #1 (first row, sequence_number=1): cancel with a reason.
  const row1 = sessionsSection.locator('li').nth(0)
  await row1.getByRole('button', { name: /Cancelar/i }).click()
  let dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await textareaByLabel(dialog, 'Motivo do cancelamento').fill('Reagendada a pedido do entrevistado')
  await dialog.getByRole('button', { name: /Cancelar sessão/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 15_000 })

  await expect(row1).toContainText('Cancelada')
  await expect(row1).toContainText('Reagendada a pedido do entrevistado')

  // Session #2 (second row, sequence_number=2): mark as no-show with a reason.
  const row2 = sessionsSection.locator('li').nth(1)
  await row2.getByRole('button', { name: /Não compareceu/i }).click()
  dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await textareaByLabel(dialog, 'Observação').fill('Entrevistado não compareceu e não avisou')
  await dialog.getByRole('button', { name: /Registrar não comparecimento/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 15_000 })

  await expect(row2).toContainText('Não compareceu')
  await expect(row2).toContainText('Entrevistado não compareceu e não avisou')

  // Both sessions are terminal → no more lifecycle buttons on either row.
  await expect(row1.getByRole('button')).toHaveCount(0)
  await expect(row2.getByRole('button')).toHaveCount(0)

  const sessions = await getSessions(page, interviewId)
  const s1 = sessions.find((s) => s.sequence_number === 1)!
  const s2 = sessions.find((s) => s.sequence_number === 2)!
  expect(s1.status).toBe('cancelled')
  expect(s1.cancellation_reason).toBe('Reagendada a pedido do entrevistado')
  expect(s2.status).toBe('no_show')
  expect(s2.cancellation_reason).toBe('Entrevistado não compareceu e não avisou')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-7 — subject relationship_to_case required
// ---------------------------------------------------------------------------

test('IV2-7 — subject relationship_to_case is required (UI blocks submit; RPC rejects a missing value with HC0B2)', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-7 Relação',
    category: 'clinical_team',
  })

  // RPC-level: omitting p_relationship_to_case is rejected (HC0B2).
  const rpcResult = await callRPC(page, chefeToken, 'add_interview_subject', {
    p_interview_id: interviewId,
    p_external_name: 'Sujeito RPC Sem Relação',
  })
  expect(rpcResult.status).toBe(400)
  expect((rpcResult.body as { code: string }).code).toBe('HC0B2')

  // UI-level: the picker blocks submit until a relationship is chosen.
  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, interviewId)

  const subjectsSection = page.getByRole('region', { name: /Entrevistados/i })
  await subjectsSection.getByRole('button', { name: /Adicionar/i }).click()
  const subjectDialog = page.getByRole('dialog', { name: /Adicionar entrevistado/i })
  await expect(subjectDialog).toBeVisible({ timeout: 10_000 })
  await subjectDialog.getByRole('button', { name: /Profissional externo/i }).click()
  await subjectDialog.getByPlaceholder(/Dra. Ana Lima/i).fill('Sujeito UI Sem Relação')
  await subjectDialog.getByRole('button', { name: /Adicionar/i }).click()

  // Blocked: dialog stays open with an inline error; nothing was submitted.
  await expect(subjectDialog).toBeVisible()
  const relationshipAlert = subjectDialog.getByRole('alert')
  await expect(relationshipAlert).toBeVisible({ timeout: 5_000 })
  await expect(relationshipAlert).toContainText(/relação/i)

  // Select a relationship and submit successfully.
  await selectByLabel(subjectDialog, 'Relação com o caso').selectOption({ label: 'Enfermeiro(a)' })
  await subjectDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(subjectDialog).not.toBeVisible({ timeout: 15_000 })

  const subjects = await getSubjects(page, interviewId)
  expect(subjects.length).toBe(1)
  expect(subjects[0].relationship_to_case).toBe('nurse')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-8 — keyboard-only: create flow via Tab/Enter
// ---------------------------------------------------------------------------

test('IV2-8 — keyboard-only: create interview dialog via Tab/Enter, required category selected via native-select keyboard type-ahead, submit', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await goToCaseDetail(page)

  // Focus the "Nova entrevista" button via keyboard and open the dialog with Enter.
  await page.getByRole('button', { name: /Nova entrevista/i }).focus()
  await expect(page.getByRole('button', { name: /Nova entrevista/i })).toBeFocused()
  await page.keyboard.press('Enter')

  const createDialog = page.getByRole('dialog', { name: /Nova entrevista/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })

  // Programmatic focus + keyboard typing to fill the title (replaces the
  // Radix Dialog autoFocus this environment can't rely on for a fresh
  // click-free flow — mirrors the existing convention in this spec).
  await createDialog.locator('input[type="text"]').first().focus()
  await page.keyboard.type('Entrevista Teclado IV2')

  // Category is REQUIRED — select it via keyboard type-ahead on the native
  // <select> (no mouse): typing "T" jumps to "Testemunha" (witness).
  const categorySelect = selectByLabel(createDialog, 'Categoria')
  await categorySelect.focus()
  await expect(categorySelect).toBeFocused()
  await page.keyboard.press('T')
  await expect(categorySelect).toHaveValue('witness')

  // Tab through every remaining interactive field (confidentiality picker, the
  // schedule-first checkbox + its session sub-fields) without a mouse until the
  // submit button is reached — proving the entire dialog is keyboard-navigable.
  const submitBtn = createDialog.getByRole('button', { name: /Criar entrevista/i })
  let reached = false
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    reached = await submitBtn.evaluate((el) => document.activeElement === el)
    if (reached) break
  }
  expect(reached).toBe(true)

  // Submit via keyboard (Enter) — no mouse click anywhere in this test.
  await page.keyboard.press('Enter')

  await page.waitForURL(/\/c\/ccih\/manage\/cases\/.+\/interviews\/.+/, { timeout: 25_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Entrevista Teclado IV2/i })).toBeVisible()
  await expect(page.locator('header')).toContainText('Testemunha')

  const backLink = page.getByRole('link', { name: /caso\s*\d+|caso/i })
  await expect(backLink.first()).toBeVisible()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-9 — participant write grant (both directions)
// ---------------------------------------------------------------------------

test('IV2-9a — participant write grant: registered interviewer (plain staff) CAN write — schedule/start/complete a session, conclude the interview', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-9a Grant',
    category: 'clinical_team',
  })
  await addSubjectRpc(page, chefeToken, interviewId, { relationship: 'witness' })

  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, interviewId)
  const interviewersSection = page.getByRole('region', { name: /Entrevistadores/i })
  await interviewersSection.getByRole('button', { name: /Adicionar/i }).click()
  const interviewerDialog = page.getByRole('dialog', { name: /Adicionar entrevistador/i })
  await expect(interviewerDialog).toBeVisible({ timeout: 10_000 })
  const interviewerMemberSelect = interviewerDialog.locator('select').first()
  await interviewerMemberSelect.selectOption({ label: 'Enfermeira CCIH Dois' })
  await interviewerDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(interviewerDialog).not.toBeVisible({ timeout: 15_000 })
  await signOut(page)

  // staff2.ccih — a plain-staff registered interviewer, not staff_admin.
  await signInAs(page, 'staff2.ccih@test.local')
  await goToInterview(page, interviewId)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  const sessionsSection = page.getByRole('region', { name: /Sessões/i })
  await expect(sessionsSection.getByRole('button', { name: /Agendar sessão/i })).toBeVisible()
  await sessionsSection.getByRole('button', { name: /Agendar sessão/i }).click()
  const sessionDialog = page.getByRole('dialog', { name: /Agendar sessão/i })
  await expect(sessionDialog).toBeVisible({ timeout: 10_000 })
  await selectByLabel(sessionDialog, 'Tipo de sessão').selectOption({ label: 'Inicial' })
  await sessionDialog.getByRole('button', { name: /Agendar sessão/i }).click()
  await expect(sessionDialog).not.toBeVisible({ timeout: 15_000 })
  await expect(page.locator('header').getByText('Agendada', { exact: true })).toBeVisible({ timeout: 15_000 })

  const startBtn = sessionsSection.getByRole('button', { name: /Iniciar/i })
  await confirmLifecycle(page, startBtn, /Iniciar sessão/i)
  await expect(page.locator('header').getByText('Em andamento', { exact: true })).toBeVisible({ timeout: 15_000 })

  const completeBtn = sessionsSection.getByRole('button', { name: /Concluir/i })
  await confirmLifecycle(page, completeBtn, /Concluir sessão/i)

  const concludeBtn = page.locator('header').getByRole('button', { name: /Concluir/i })
  await confirmLifecycle(page, concludeBtn, /Concluir entrevista/i)
  await expect(page.locator('header').getByText('Concluída', { exact: true })).toBeVisible({ timeout: 20_000 })

  const dbRow = await getInterviewRow(page, interviewId)
  expect(dbRow?.status).toBe('completed')

  await signOut(page)
})

test('IV2-9b — participant write grant: non-interviewer staff CANNOT write (UI controls absent; RPC rejects with HC039)', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-9b Sem Grant',
    category: 'other',
  })
  const s1 = await scheduleSessionRpc(page, chefeToken, interviewId)
  await startSessionRpc(page, chefeToken, s1)
  // em_andamento; staff1.ccih is NOT an interviewer on this interview.

  await signInAs(page, 'staff1.ccih@test.local')
  await goToInterview(page, interviewId)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  await expect(page.locator('header').getByRole('button', { name: /Concluir/i })).not.toBeVisible()
  await expect(page.locator('header').getByRole('button', { name: /Cancelar/i })).not.toBeVisible()
  const sessionsSection = page.getByRole('region', { name: /Sessões/i })
  await expect(sessionsSection.getByRole('button', { name: /Agendar sessão/i })).not.toBeVisible()
  await expect(sessionsSection.getByRole('button', { name: /Iniciar/i })).not.toBeVisible()

  const staff1Token = await getOwnerToken(page, 'staff1.ccih@test.local')
  const concludeResult = await callRPC(page, staff1Token, 'conclude_interview', { p_interview_id: interviewId })
  expect(concludeResult.status).toBe(400)
  expect((concludeResult.body as { code: string }).code).toBe('HC039')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-10 — security: foreign-commission user gets 404, no data leakage
// ---------------------------------------------------------------------------

test('IV2-10 — security: foreign-commission user gets 404, no data leakage', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')

  await goToInterview(page, SEEDED_INTERVIEW_ID)
  await expect(page.getByText(/Erro 404/i).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Não encontramos esta página/i })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText(/Entrevista sobre o Caso 0001/i)).not.toBeVisible()

  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await expect(page.getByText(/Erro 404/i).first()).toBeVisible({ timeout: 15_000 })

  const farmToken = await getOwnerToken(page, 'chefe.farm@test.local')
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interviews?id=eq.${SEEDED_INTERVIEW_ID}&select=id,title`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${farmToken}` } },
  )
  const data = await resp.json()
  expect(Array.isArray(data)).toBe(true)
  expect((data as unknown[]).length).toBe(0)

  const respSessions = await page.request.get(
    `${SUPABASE_URL}/rest/v1/interview_sessions?interview_id=eq.${SEEDED_INTERVIEW_ID}&select=id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${farmToken}` } },
  )
  const sessionsData = await respSessions.json()
  expect(Array.isArray(sessionsData)).toBe(true)
  expect((sessionsData as unknown[]).length).toBe(0)

  await page.goto('/o/rede-a/c/farmacia')
  await page.waitForURL('**/o/rede-a/c/farmacia', { timeout: 15_000 })
  await signOut(page)
})

// ---------------------------------------------------------------------------
// IV2-11 — server-level negatives
// ---------------------------------------------------------------------------

test('IV2-11 — server-level negatives: HC021 non-member interviewer, non-https link CHECK, HC038 wrong-state, HC0B0 schedule precondition, MIME rejection', async ({ page }) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const interviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-11 Negativos',
    category: 'other',
  })

  // HC021 — chefe.farm is not a CCIH member.
  const addInterviewerResult = await callRPC(page, chefeToken, 'add_interview_interviewer', {
    p_interview_id: interviewId,
    p_user_id: '00000000-0000-0000-0000-000000000005',
    p_role: 'entrevistador',
  })
  expect(addInterviewerResult.status).toBe(400)
  expect((addInterviewerResult.body as { code: string }).code).toBe('HC021')

  // Non-https link — DB CHECK boundary (bypasses the addInterviewLink action's own check).
  const addLinkResp = await page.request.post(`${SUPABASE_URL}/rest/v1/case_interview_links`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      interview_id: interviewId,
      title: 'Link Inválido',
      external_url: 'http://insecure.example.com/audio.mp3',
    },
  })
  expect(addLinkResp.status()).toBe(400)
  const addLinkBody = (await addLinkResp.json()) as { code?: string; message?: string }
  expect(String(addLinkBody.code ?? '') + String(addLinkBody.message ?? '')).toMatch(/check|external_url|23514/i)

  // HC038 — starting an already-started session.
  const s1 = await scheduleSessionRpc(page, chefeToken, interviewId)
  await startSessionRpc(page, chefeToken, s1)
  const startAgain = await callRPC(page, chefeToken, 'start_session', { p_session_id: s1 })
  expect(startAgain.status).toBe(400)
  expect((startAgain.body as { code: string }).code).toBe('HC038')

  // HC0B0 — scheduling a session on a CANCELLED interview.
  const cancelRes = await callRPC(page, chefeToken, 'cancel_interview', { p_interview_id: interviewId })
  expect(cancelRes.status).toBe(200)
  const scheduleAfterCancel = await callRPC(page, chefeToken, 'schedule_session', { p_interview_id: interviewId })
  expect(scheduleAfterCancel.status).toBe(400)
  expect((scheduleAfterCancel.body as { code: string }).code).toBe('HC0B0')

  // UI: MIME rejection on upload (fresh unlocked interview).
  const uploadInterviewId = await createInterviewRpc(page, chefeToken, {
    title: 'Entrevista IV2-11 Upload',
    category: 'other',
  })
  await signInAs(page, 'chefe.ccih@test.local')
  await goToInterview(page, uploadInterviewId)

  const attachmentsSection = page.getByRole('region', { name: /Anexos e gravações/i })
  await attachmentsSection.getByRole('button', { name: /Enviar anexo/i }).click()
  const uploadDialog = page.getByRole('dialog', { name: /Enviar anexo/i })
  await expect(uploadDialog).toBeVisible({ timeout: 10_000 })

  const tmpAudioPath = path.join(__dirname, '__tmp_iv2_test.mp3')
  fs.writeFileSync(tmpAudioPath, Buffer.from([0xff, 0xfb, 0x90, 0x00]))
  await uploadDialog.locator('input[type="file"]').setInputFiles(tmpAudioPath)
  await uploadDialog.locator('input[name="title"]').fill('Audio Upload Test')
  await uploadDialog.getByRole('button', { name: /Enviar anexo/i }).click()
  await expect(uploadDialog.locator('[role="alert"]').first()).toBeVisible({ timeout: 15_000 })
  fs.unlinkSync(tmpAudioPath)
  await uploadDialog.getByRole('button', { name: /Cancelar/i }).click()

  await signOut(page)
})
