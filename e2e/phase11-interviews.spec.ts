import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * Phase 11 — Interviews
 *
 * Test contract: translates every bullet in PHASES.md §Phase 11 Acceptance into
 * Playwright assertions. Runs against the LOCAL Supabase stack (seeded personas).
 *
 * Seeded fixtures (supabase/seed.sql — Phase 11 block):
 *   Seeded interview f2000000-…-e1: "Entrevista sobre o Caso 0001" on Caso 0001
 *     - status: `em_andamento`
 *     - commission: CCIH (a0000000-…-a1)
 *     - case: d0000000-…-c1 (Caso 0001)
 *     - interviewers: chefe.ccih (REGISTERED, entrevistador_principal) + Dra. Helena Marques (EXTERNAL)
 *     - subjects: staff1.ccih (REGISTERED, clinical_role "Enfermeiro(a) da unidade") + Carlos Pereira (EXTERNAL)
 *     - attachments: one file (transcricao_assinada) + one link (gravacao_audio, external https URL)
 *
 * Personas (password Test1234!):
 *   admin@test.local            global admin
 *   chefe.ccih@test.local       staff_admin of CCIH (id …0002), registered interviewer on seeded interview
 *   staff1.ccih@test.local      staff of CCIH (id …0003), registered SUBJECT on seeded interview (NOT interviewer)
 *   staff2.ccih@test.local      staff of CCIH (id …0004), NOT an interviewer on any interview
 *   chefe.farm@test.local       staff_admin of Farmácia (foreign commission)
 *
 * Run with --workers=1 (tests mutate DB state in sequence).
 * Run `npx supabase db reset` before each full run.
 *
 * Note: AlertDialog lifecycle buttons use e.preventDefault() — dialogs close via
 * route refresh on success, staying open with an inline error on failure.
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
// Persona UUIDs used in DB-truth assertions
const CHEFE_CCIH_ID = '00000000-0000-0000-0000-000000000002'
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003'

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

/** Service-role JWT: read an interview row by id. */
async function getInterviewRow(
  page: Page,
  interviewId: string,
): Promise<{
  status: string
  interview_number: number
  registry_event_id: string | null
  concluded_at: string | null
  cancelled_at: string | null
} | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interviews?id=eq.${interviewId}&select=status,interview_number,registry_event_id,concluded_at,cancelled_at`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const data = await resp.json()
  if (!Array.isArray(data) || data.length === 0) return null
  return data[0] as {
    status: string
    interview_number: number
    registry_event_id: string | null
    concluded_at: string | null
    cancelled_at: string | null
  }
}

/** Service-role JWT: list case_events for a case. */
async function getCaseEvents(
  page: Page,
  caseId: string,
): Promise<Array<{ id: string; kind: string; title: string | null }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_events?case_id=eq.${caseId}&select=id,kind,title`,
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

/** Service-role JWT: list interviewers for an interview. */
async function getInterviewers(
  page: Page,
  interviewId: string,
): Promise<Array<{ id: string; user_id: string | null; external_name: string | null; role: string }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interview_interviewers?interview_id=eq.${interviewId}&select=id,user_id,external_name,role`,
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

/** Service-role JWT: list subjects for an interview. */
async function getSubjects(
  page: Page,
  interviewId: string,
): Promise<Array<{ id: string; user_id: string | null; external_name: string | null }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interview_subjects?interview_id=eq.${interviewId}&select=id,user_id,external_name`,
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

/** Service-role JWT: list attachments for an interview (active only). */
async function getAttachments(
  page: Page,
  interviewId: string,
): Promise<Array<{ id: string; kind: string; storage_path: string | null; external_url: string | null; deleted_at: string | null }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interview_attachments?interview_id=eq.${interviewId}&deleted_at=is.null&select=id,kind,storage_path,external_url,deleted_at`,
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

/** Obtain a real JWT for a persona (RLS-scoped token). */
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

/** Call an RPC via the REST API with a caller-supplied JWT (tests RLS authority). */
async function callRPC(
  page: Page,
  token: string,
  rpcName: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: body,
    },
  )
  const text = await resp.text()
  let body_parsed: unknown
  try { body_parsed = JSON.parse(text) } catch { body_parsed = text }
  return { status: resp.status(), body: body_parsed }
}

/** Navigate to Caso 0001 detail as the currently signed-in coordinator. */
async function goToCaseDetail(page: Page) {
  await page.goto(`/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(`**/c/ccih/manage/cases/${SEEDED_CASE_ID}`, { timeout: 15_000 })
  // Entrevistas panel should be visible
  await expect(page.getByRole('heading', { name: /Entrevistas/i }).first()).toBeVisible({
    timeout: 15_000,
  })
}

/** Click a lifecycle button and wait for the confirm dialog, then confirm. */
async function confirmLifecycle(page: Page, buttonName: string | RegExp, confirmLabel: string | RegExp) {
  await page.getByRole('button', { name: buttonName }).click()
  // Wait for AlertDialog
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  // Click the confirm button
  await dialog.getByRole('button', { name: confirmLabel }).click()
  // Wait for dialog to close (success causes route refresh + unmount)
  await expect(dialog).not.toBeVisible({ timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// AC1 — Happy path: create → add subjects → add interviewers → start →
//         upload PDF → add audio link → conclude → case_events row appears
// ---------------------------------------------------------------------------

test('AC1 — happy path: create interview, add participants, start, add attachments, conclude → case_events', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await goToCaseDetail(page)

  // --- 1. Create a new interview via "Nova entrevista" ---
  const interviewsSection = page.getByRole('region', {
    name: /Entrevistas/i,
  }).first()
  await interviewsSection.getByRole('button', { name: /Nova entrevista/i }).click()
  const createDialog = page.getByRole('dialog', { name: /Nova entrevista/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })

  // Fill in title
  await createDialog.getByPlaceholder(/Entrevista com a equipe/i).fill('Entrevista AC1')
  // Select modality: keep presencial (default)
  // Submit
  await createDialog.getByRole('button', { name: /Criar entrevista/i }).click()

  // Should navigate to the new interview detail page
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/.+\/interviews\/.+/, { timeout: 20_000 })
  // Confirm we're on the detail page
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  // Capture interview URL for later
  const interviewUrl = page.url()
  const interviewIdMatch = interviewUrl.match(/interviews\/([a-f0-9-]+)/)
  expect(interviewIdMatch).not.toBeNull()
  const newInterviewId = interviewIdMatch![1]

  // --- 2. Add a registered subject (staff2.ccih) ---
  const subjectsSection = page.getByRole('region', { name: /Entrevistados/i })
  await subjectsSection.getByRole('button', { name: /Adicionar/i }).click()
  const subjectDialog = page.getByRole('dialog', { name: /Adicionar entrevistado/i })
  await expect(subjectDialog).toBeVisible({ timeout: 10_000 })
  // Default kind is "Membro da comissão" — select staff2 (label must be an exact string)
  const memberSelect = subjectDialog.locator('select').first()
  await memberSelect.selectOption({ label: 'Enfermeira CCIH Dois' })
  await subjectDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(subjectDialog).not.toBeVisible({ timeout: 15_000 })

  // --- 3. Add an external subject ---
  await subjectsSection.getByRole('button', { name: /Adicionar/i }).click()
  const subjectDialog2 = page.getByRole('dialog', { name: /Adicionar entrevistado/i })
  await expect(subjectDialog2).toBeVisible({ timeout: 10_000 })
  // Switch to external
  await subjectDialog2.getByRole('button', { name: /Profissional externo/i }).click()
  await subjectDialog2.getByPlaceholder(/Dra. Ana Lima/i).fill('Dr. Externo Sujeito')
  await subjectDialog2.getByRole('button', { name: /Adicionar/i }).click()
  await expect(subjectDialog2).not.toBeVisible({ timeout: 15_000 })

  // Verify 2 subjects visible in panel
  await expect(subjectsSection.locator('li')).toHaveCount(2, { timeout: 10_000 })

  // --- 4. Add a registered interviewer (staff1.ccih) ---
  const interviewersSection = page.getByRole('region', { name: /Entrevistadores/i })
  await interviewersSection.getByRole('button', { name: /Adicionar/i }).click()
  const interviewerDialog = page.getByRole('dialog', { name: /Adicionar entrevistador/i })
  await expect(interviewerDialog).toBeVisible({ timeout: 10_000 })
  // Default kind is "Membro da comissão"
  const interviewerMemberSelect = interviewerDialog.locator('select').first()
  await interviewerMemberSelect.selectOption({ label: 'Enfermeiro CCIH Um' })
  await interviewerDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(interviewerDialog).not.toBeVisible({ timeout: 15_000 })

  // --- 5. Add an external interviewer ---
  await interviewersSection.getByRole('button', { name: /Adicionar/i }).click()
  const interviewerDialog2 = page.getByRole('dialog', { name: /Adicionar entrevistador/i })
  await expect(interviewerDialog2).toBeVisible({ timeout: 10_000 })
  await interviewerDialog2.getByRole('button', { name: 'Externo', exact: true }).click()
  await interviewerDialog2.getByPlaceholder(/Dr. Paulo Mendes/i).fill('Dr. Externo Entrevistador')
  await interviewerDialog2.getByRole('button', { name: /Adicionar/i }).click()
  await expect(interviewerDialog2).not.toBeVisible({ timeout: 15_000 })

  // Verify 2 interviewers visible
  await expect(interviewersSection.locator('li')).toHaveCount(2, { timeout: 10_000 })

  // --- 6. The interview is in rascunho — schedule it first ---
  // Status badge renders as a <span> with text "Rascunho"
  await expect(page.getByText('Rascunho', { exact: true })).toBeVisible()

  // Schedule (requires a start date — we need to edit first then schedule).
  // Use exact: true to match only the "Editar" header button (not per-row "Editar X" buttons).
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  const editDialog = page.getByRole('dialog', { name: /Editar entrevista/i })
  await expect(editDialog).toBeVisible({ timeout: 10_000 })
  // Set scheduled start (datetime-local value)
  const startInput = editDialog.locator('input[type="datetime-local"]').first()
  await startInput.fill('2026-06-20T10:00')
  await editDialog.getByRole('button', { name: /Salvar/i }).click()
  await expect(editDialog).not.toBeVisible({ timeout: 15_000 })

  // Now schedule
  await confirmLifecycle(page, /Agendar/i, /Agendar entrevista/i)

  // --- 7. Start the interview ---
  // Now status is agendada
  await confirmLifecycle(page, /Iniciar/i, /Iniciar entrevista/i)

  // Status should now be em_andamento
  await expect(page.locator('text=Em andamento').first()).toBeVisible({ timeout: 15_000 })

  // --- 8. Upload a PDF attachment ---
  const attachmentsSection = page.getByRole('region', { name: /Anexos e gravações/i })
  await attachmentsSection.getByRole('button', { name: /Enviar anexo/i }).click()
  const uploadDialog = page.getByRole('dialog', { name: /Enviar anexo/i })
  await expect(uploadDialog).toBeVisible({ timeout: 10_000 })

  // Create a small dummy PDF file for upload
  const tmpPdfPath = path.join(__dirname, '__tmp_test.pdf')
  fs.writeFileSync(tmpPdfPath, '%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n3 0 obj<</Type /Page /MediaBox [0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4 /Root 1 0 R>>\nstartxref\n190\n%%EOF\n')

  await uploadDialog.locator('input[type="file"]').setInputFiles(tmpPdfPath)
  await uploadDialog.locator('input[name="title"]').fill('Transcrição de Teste AC1')
  await uploadDialog.getByRole('button', { name: /Enviar anexo/i }).click()
  await expect(uploadDialog).not.toBeVisible({ timeout: 25_000 })

  // Clean up temp file
  fs.unlinkSync(tmpPdfPath)

  // --- 9. Add an audio link ---
  await attachmentsSection.getByRole('button', { name: /Adicionar gravação/i }).click()
  const linkDialog = page.getByRole('dialog', { name: /Adicionar gravação/i })
  await expect(linkDialog).toBeVisible({ timeout: 10_000 })
  await linkDialog.locator('input[type="text"]').fill('Gravação de Áudio AC1')
  await linkDialog.locator('input[type="url"]').fill('https://example.com/audio-ac1.mp3')
  await linkDialog.getByRole('button', { name: /Adicionar gravação/i }).click()
  await expect(linkDialog).not.toBeVisible({ timeout: 15_000 })

  // Verify 2+ attachments
  await expect(attachmentsSection.locator('li')).toHaveCount(2, { timeout: 10_000 })

  // --- 10. Conclude the interview ---
  await confirmLifecycle(page, /Concluir/i, /Concluir entrevista/i)

  // Status should be concluida
  await expect(page.locator('text=Concluída').first()).toBeVisible({ timeout: 20_000 })

  // --- 11. Assert a case_events kind='interview' row appears on the case timeline ---
  const eventsAfterConclude = await getCaseEvents(page, SEEDED_CASE_ID)
  const interviewEvents = eventsAfterConclude.filter((e) => e.kind === 'interview')
  expect(interviewEvents.length).toBeGreaterThanOrEqual(1)

  // Assert the interview row has a registry_event_id
  const dbRow = await getInterviewRow(page, newInterviewId)
  expect(dbRow?.status).toBe('concluida')
  expect(dbRow?.registry_event_id).not.toBeNull()
  const registryEventId = dbRow!.registry_event_id!

  // --- 12. Reopen and re-conclude — same timeline row is UPDATED, not duplicated ---
  await confirmLifecycle(page, /Reabrir/i, /Reabrir entrevista/i)
  await expect(page.locator('text=Em andamento').first()).toBeVisible({ timeout: 15_000 })

  // Re-conclude
  await confirmLifecycle(page, /Concluir/i, /Concluir entrevista/i)
  await expect(page.locator('text=Concluída').first()).toBeVisible({ timeout: 20_000 })

  // The registry_event_id must be the SAME row (no duplicate)
  const dbRowAfterReopen = await getInterviewRow(page, newInterviewId)
  expect(dbRowAfterReopen?.registry_event_id).toBe(registryEventId)

  // Total interview events must still be 1 more than before (no new duplicate)
  const eventsAfterReconclude = await getCaseEvents(page, SEEDED_CASE_ID)
  const interviewEventsAfterReconclude = eventsAfterReconclude.filter((e) => e.kind === 'interview')
  // Should be the same count as after the first conclude (no duplicate added)
  expect(interviewEventsAfterReconclude.length).toBe(interviewEvents.length)

  // --- 13. Cancel a separate interview ---
  // Create a fresh interview to cancel (avoids state contamination from seeded interview
  // being cancelled by prior runs when the full suite runs without a fresh db reset).
  const cancelToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const cancelCreateResult = await callRPC(page, cancelToken, 'create_interview', {
    p_case_id: SEEDED_CASE_ID,
    p_title: 'Entrevista AC1 Para Cancelar',
    p_modality: 'presencial',
  })
  expect(cancelCreateResult.status).toBe(200)
  const cancelInterviewId = (cancelCreateResult.body as { id: string }).id

  // Navigate to the freshly created interview and cancel it
  await page.goto(`/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${cancelInterviewId}`)
  await page.waitForURL(`**/interviews/${cancelInterviewId}`, { timeout: 15_000 })
  await expect(page.locator('text=Rascunho').first()).toBeVisible({ timeout: 15_000 })
  // Cancel from rascunho state (cancel is available in any non-terminal state)
  await confirmLifecycle(page, /Cancelar/i, /Cancelar entrevista/i)
  // Status should be cancelada
  await expect(page.locator('text=Cancelada').first()).toBeVisible({ timeout: 20_000 })

  // Verify DB state
  const cancelledRow = await getInterviewRow(page, cancelInterviewId)
  expect(cancelledRow?.status).toBe('cancelada')
  expect(cancelledRow?.cancelled_at).not.toBeNull()
})

// ---------------------------------------------------------------------------
// AC2 — Participant write grant: both directions tested
//        (a) plain-staff interviewer CAN write  [UI + RPC]
//        (b) different plain-staff NON-interviewer CANNOT write  [UI + RPC]
// ---------------------------------------------------------------------------

test('AC2a — participant write grant: registered interviewer (staff role) CAN write', async ({ page }) => {
  // chefe.ccih is a registered interviewer on the SEEDED interview.
  // But chefe.ccih is also staff_admin — use a fresh interview where staff1 is added.
  // Per seed: staff1.ccih is a SUBJECT (not an interviewer) on the seeded interview.
  // We need to create a fresh interview and add staff2 as a registered INTERVIEWER.
  // The seeded interview already has chefe.ccih as an interviewer (staff_admin role
  // but also proves the grant). For the true plain-staff test we create one.

  // 1. Create a fresh interview as chefe (staff_admin), add staff2 as interviewer
  await signInAs(page, 'chefe.ccih@test.local')
  await goToCaseDetail(page)

  // Create interview
  const interviewsSection = page.getByRole('region', { name: /Entrevistas/i }).first()
  await interviewsSection.getByRole('button', { name: /Nova entrevista/i }).click()
  const createDialog = page.getByRole('dialog', { name: /Nova entrevista/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })
  await createDialog.getByPlaceholder(/Entrevista com a equipe/i).fill('Entrevista AC2 Grant')
  await createDialog.getByRole('button', { name: /Criar entrevista/i }).click()
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/.+\/interviews\/.+/, { timeout: 20_000 })

  const interviewUrl = page.url()
  const interviewIdMatch = interviewUrl.match(/interviews\/([a-f0-9-]+)/)
  expect(interviewIdMatch).not.toBeNull()
  const grantInterviewId = interviewIdMatch![1]

  // Add a subject (so we can conclude later)
  const subjectsSection = page.getByRole('region', { name: /Entrevistados/i })
  await subjectsSection.getByRole('button', { name: /Adicionar/i }).click()
  const subjectDialog = page.getByRole('dialog', { name: /Adicionar entrevistado/i })
  await expect(subjectDialog).toBeVisible({ timeout: 10_000 })
  await subjectDialog.getByRole('button', { name: /Profissional externo/i }).click()
  await subjectDialog.getByPlaceholder(/Dra. Ana Lima/i).fill('Dr. Sujeito AC2')
  await subjectDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(subjectDialog).not.toBeVisible({ timeout: 15_000 })

  // Add staff2.ccih as a registered INTERVIEWER
  const interviewersSection = page.getByRole('region', { name: /Entrevistadores/i })
  await interviewersSection.getByRole('button', { name: /Adicionar/i }).click()
  const interviewerDialog = page.getByRole('dialog', { name: /Adicionar entrevistador/i })
  await expect(interviewerDialog).toBeVisible({ timeout: 10_000 })
  const interviewerMemberSelect = interviewerDialog.locator('select').first()
  await interviewerMemberSelect.selectOption({ label: 'Enfermeira CCIH Dois' })
  await interviewerDialog.getByRole('button', { name: /Adicionar/i }).click()
  await expect(interviewerDialog).not.toBeVisible({ timeout: 15_000 })

  // Schedule + start (so staff2 can operate in em_andamento state)
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  const editDialog = page.getByRole('dialog', { name: /Editar entrevista/i })
  await expect(editDialog).toBeVisible({ timeout: 10_000 })
  await editDialog.locator('input[type="datetime-local"]').first().fill('2026-06-21T10:00')
  await editDialog.getByRole('button', { name: /Salvar/i }).click()
  await expect(editDialog).not.toBeVisible({ timeout: 15_000 })
  await confirmLifecycle(page, /Agendar/i, /Agendar entrevista/i)
  await confirmLifecycle(page, /Iniciar/i, /Iniciar entrevista/i)
  await expect(page.locator('text=Em andamento').first()).toBeVisible({ timeout: 15_000 })

  await signOut(page)

  // 2. Sign in as staff2 — a plain-staff registered INTERVIEWER
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(
    `/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${grantInterviewId}`,
  )
  await page.waitForURL(`**/interviews/${grantInterviewId}`, { timeout: 15_000 })

  // staff2 should see the interview detail (member SELECT works)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  // Write CONTROLS must be present (viewerCanWrite=true)
  // The Concluir button is a write control
  await expect(page.getByRole('button', { name: /Concluir/i })).toBeVisible({ timeout: 10_000 })
  // The Adicionar button in subjects panel (canEditContent=true for an interviewer in em_andamento)
  const subjectsPanelStaff = page.getByRole('region', { name: /Entrevistados/i })
  await expect(subjectsPanelStaff.getByRole('button', { name: /Adicionar/i })).toBeVisible()

  // Perform an actual write (conclude) to prove the grant works end-to-end
  await confirmLifecycle(page, /Concluir/i, /Concluir entrevista/i)
  await expect(page.locator('text=Concluída').first()).toBeVisible({ timeout: 20_000 })

  // DB truth: interview is concluded
  const dbRow = await getInterviewRow(page, grantInterviewId)
  expect(dbRow?.status).toBe('concluida')

  await signOut(page)
})

test('AC2b — participant write grant: non-interviewer staff CANNOT write', async ({ page }) => {
  // staff1.ccih is NOT an interviewer on the seeded interview (they are a SUBJECT).
  // They should be able to READ the interview (member SELECT) but NOT write.

  // For this test the seeded interview may be cancelled from AC1 — create a fresh one
  // in em_andamento so the "cannot write" scenario is clear regardless of lock state.
  // Use the RPC path to create without going through the UI.

  // First create a fresh interview with ONLY chefe.ccih as interviewer (no staff1)
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const createResult = await callRPC(page, chefeToken, 'create_interview', {
    p_case_id: SEEDED_CASE_ID,
    p_title: 'Entrevista AC2b Sem Grant',
    p_modality: 'presencial',
  })
  expect(createResult.status).toBe(200)
  const noGrantInterviewId = (createResult.body as { id: string }).id

  // Schedule and start it via RPC (so staff1 sees em_andamento — not locked)
  const scheduleResult = await callRPC(page, chefeToken, 'schedule_interview', {
    p_interview_id: noGrantInterviewId,
    p_scheduled_start: '2026-06-22T10:00:00Z',
  })
  expect(scheduleResult.status).toBe(200)

  const startResult = await callRPC(page, chefeToken, 'start_interview', {
    p_interview_id: noGrantInterviewId,
  })
  expect(startResult.status).toBe(200)

  // --- UI layer: staff1 (non-interviewer) should see NO write controls ---
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(
    `/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${noGrantInterviewId}`,
  )
  await page.waitForURL(`**/interviews/${noGrantInterviewId}`, { timeout: 15_000 })

  // staff1 can READ (member SELECT allows it)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  // But no write controls must be visible (viewerCanWrite=false)
  await expect(page.getByRole('button', { name: /Concluir/i })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Cancelar/i })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Iniciar/i })).not.toBeVisible()
  // The Adicionar button in subjects panel is absent
  const subjectsPanelNonWriter = page.getByRole('region', { name: /Entrevistados/i })
  await expect(subjectsPanelNonWriter.getByRole('button', { name: /Adicionar/i })).not.toBeVisible()

  // --- API layer: staff1's token is rejected by the conclude RPC (HC039) ---
  const staff1Token = await getOwnerToken(page, 'staff1.ccih@test.local')
  const concludeResult = await callRPC(page, staff1Token, 'conclude_interview', {
    p_interview_id: noGrantInterviewId,
  })
  expect(concludeResult.status).toBe(400)
  expect((concludeResult.body as { code: string }).code).toBe('HC039')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC3 — Security: foreign-commission user gets 404 (no data leakage)
// ---------------------------------------------------------------------------

test('AC3 — security: foreign-commission user gets 404, no leakage', async ({ page }) => {
  // chefe.farm is staff_admin of Farmácia but NOT a member of CCIH
  await signInAs(page, 'chefe.farm@test.local')

  // Attempt to access the seeded CCIH interview
  await page.goto(
    `/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${SEEDED_INTERVIEW_ID}`,
  )
  // Next.js renders the not-found page via notFound() — chefe.farm is NOT a member of
  // CCIH so the commission layout calls notFound() → global 404 page renders.
  // The global 404 page has: <p>Erro 404</p> and <h1>Não encontramos esta página.</h1>
  // (not the heading role, but the h1 element; we assert on the paragraph text "Erro 404"
  // which is also present in the commission-scoped not-found page inside the shell).
  await expect(page.getByText(/Erro 404/i).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Não encontramos esta página/i })).toBeVisible({ timeout: 5_000 })
  // Specifically: the interview title MUST NOT appear
  await expect(page.getByText(/Entrevista sobre o Caso 0001/i)).not.toBeVisible()

  // Also test the case detail itself (also coordinator-only, but still commission-gated)
  await page.goto(`/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  // chefe.farm can't access CCIH's cases (coordinator-only case detail) — renders 404
  await expect(page.getByText(/Erro 404/i).first()).toBeVisible({ timeout: 15_000 })

  // API layer: service role check — verify PostgREST RLS denies reads
  const farmToken = await getOwnerToken(page, 'chefe.farm@test.local')
  const resp2 = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_interviews?id=eq.${SEEDED_INTERVIEW_ID}&select=id,title`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${farmToken}`,
      },
    },
  )
  const data = await resp2.json()
  // RLS SELECT policy: must be a member of the commission → returns empty, not the row
  expect(Array.isArray(data)).toBe(true)
  expect((data as unknown[]).length).toBe(0)

  // Navigate to chefe.farm's own commission before signing out (the CCIH 404 page
  // has no commission shell / account menu button — signing out requires the shell).
  await page.goto('/c/farmacia')
  await page.waitForURL('**/c/farmacia', { timeout: 15_000 })
  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC4 — Negatives: MIME/size rejection, non-https link (HC040),
//         conclude without subjects (HC041), non-member interviewer (HC021)
// ---------------------------------------------------------------------------

test('AC4 — negatives: MIME rejection, https-only link, conclude without subject, non-member interviewer', async ({ page }) => {
  // Use the seeded interview (already has subjects; we need a fresh one for HC041)
  // Get a token for chefe.ccih for RPC-layer tests
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')

  // --- HC041: conclude_interview without any subjects (RPC layer) ---
  // Create a fresh interview, don't add subjects
  const createResult = await callRPC(page, chefeToken, 'create_interview', {
    p_case_id: SEEDED_CASE_ID,
    p_title: 'Entrevista AC4 Sem Entrevistados',
    p_modality: 'presencial',
  })
  expect(createResult.status).toBe(200)
  const noSubjectInterviewId = (createResult.body as { id: string }).id

  // Start it (rascunho → agendada → em_andamento)
  await callRPC(page, chefeToken, 'schedule_interview', {
    p_interview_id: noSubjectInterviewId,
    p_scheduled_start: '2026-06-23T10:00:00Z',
  })
  await callRPC(page, chefeToken, 'start_interview', {
    p_interview_id: noSubjectInterviewId,
  })

  // Attempt to conclude without subjects → HC041
  const concludeResult = await callRPC(page, chefeToken, 'conclude_interview', {
    p_interview_id: noSubjectInterviewId,
  })
  expect(concludeResult.status).toBe(400)
  expect((concludeResult.body as { code: string }).code).toBe('HC041')

  // --- HC021: add a non-member registered interviewer ---
  // chefe.farm is NOT a member of CCIH → adding them as a registered interviewer fails
  const addInterviewerResult = await callRPC(page, chefeToken, 'add_interview_interviewer', {
    p_interview_id: noSubjectInterviewId,
    p_user_id: '00000000-0000-0000-0000-000000000005', // chefe.farm
    p_role: 'entrevistador',
  })
  expect(addInterviewerResult.status).toBe(400)
  expect((addInterviewerResult.body as { code: string }).code).toBe('HC021')

  // --- HC040: non-https link ---
  const addLinkResult = await callRPC(page, chefeToken, 'add_interview_attachment', {
    p_interview_id: noSubjectInterviewId,
    p_kind: 'gravacao_audio',
    p_title: 'Link Inválido',
    p_external_url: 'http://insecure.example.com/audio.mp3', // http not https
  })
  expect(addLinkResult.status).toBe(400)
  expect((addLinkResult.body as { code: string }).code).toBe('HC040')

  // --- UI layer: MIME rejection on upload (client-side validation, then server) ---
  await signInAs(page, 'chefe.ccih@test.local')
  // Navigate to an em_andamento interview for the upload test
  await page.goto(
    `/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${noSubjectInterviewId}`,
  )
  await page.waitForURL(`**/interviews/${noSubjectInterviewId}`, { timeout: 15_000 })

  // The interview should be in em_andamento and the upload button visible
  const attachmentsSection2 = page.getByRole('region', { name: /Anexos e gravações/i })
  await attachmentsSection2.getByRole('button', { name: /Enviar anexo/i }).click()
  const uploadDialog = page.getByRole('dialog', { name: /Enviar anexo/i })
  await expect(uploadDialog).toBeVisible({ timeout: 10_000 })

  // Try to upload an audio file (should be rejected by size or MIME)
  const tmpAudioPath = path.join(__dirname, '__tmp_test.mp3')
  // Create a minimal fake MP3 (just bytes, not a real MP3)
  fs.writeFileSync(tmpAudioPath, Buffer.from([0xFF, 0xFB, 0x90, 0x00]))
  await uploadDialog.locator('input[type="file"]').setInputFiles(tmpAudioPath)
  await uploadDialog.locator('input[name="title"]').fill('Audio Upload Test')
  await uploadDialog.getByRole('button', { name: /Enviar anexo/i }).click()
  // Should show an error (MIME not accepted server-side)
  await expect(uploadDialog.locator('[role="alert"]').first()).toBeVisible({ timeout: 15_000 })
  fs.unlinkSync(tmpAudioPath)
  // Close the dialog
  await uploadDialog.getByRole('button', { name: /Cancelar/i }).click()

  // --- UI layer: client-side non-https link validation ---
  await attachmentsSection2.getByRole('button', { name: /Adicionar gravação/i }).click()
  const linkDialog = page.getByRole('dialog', { name: /Adicionar gravação/i })
  await expect(linkDialog).toBeVisible({ timeout: 10_000 })
  await linkDialog.locator('input[type="text"]').fill('Link Inválido')
  await linkDialog.locator('input[type="url"]').fill('http://insecure.example.com/audio.mp3')
  await linkDialog.getByRole('button', { name: /Adicionar gravação/i }).click()
  // Client-side validation shows an error about https
  await expect(linkDialog.locator('[role="alert"]').first()).toBeVisible({ timeout: 10_000 })
  await expect(linkDialog.locator('[role="alert"]').first()).toContainText(/https/i)
  await linkDialog.getByRole('button', { name: /Cancelar/i }).click()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC5 — Keyboard-only flow: create → fill → submit → land on detail
//        (Tab/Enter only, no mouse clicks)
// ---------------------------------------------------------------------------

test('AC5 — keyboard-only: create interview dialog via Tab/Enter, navigate to detail', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await goToCaseDetail(page)

  // Focus on the "Nova entrevista" button via keyboard
  // Tab into the interviews section's "Nova entrevista" button
  await page.getByRole('button', { name: /Nova entrevista/i }).focus()
  await expect(page.getByRole('button', { name: /Nova entrevista/i })).toBeFocused()
  await page.keyboard.press('Enter')

  // Dialog should open
  const createDialog = page.getByRole('dialog', { name: /Nova entrevista/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })

  // Type the title into the title input (focused via .focus() — we avoid clicking
  // the mouse; the initial focus move uses programmatic focus which is permitted in
  // keyboard-only testing to replace the "initial element is focused on dialog open"
  // behaviour that Radix Dialog provides via autoFocus).
  await createDialog.locator('input[type="text"]').first().focus()
  await page.keyboard.type('Entrevista Teclado AC5')

  // Keyboard-only navigation proof: Tab through every interactive field in the dialog
  // without using the mouse. datetime-local inputs expose multiple internal sub-fields
  // (month/day/year/hour/minute) each consuming one Tab stop, so the count to reach
  // the submit button is higher than the field count. We loop-Tab until we hit the
  // submit button (max 40 presses), proving it is keyboard-reachable without a mouse.
  const submitBtn = createDialog.getByRole('button', { name: /Criar entrevista/i })
  let reached = false
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    reached = await submitBtn.evaluate((el) => document.activeElement === el)
    if (reached) break
  }
  // The submit button MUST be reachable by Tab alone (keyboard accessibility requirement)
  expect(reached).toBe(true)

  // Press Enter to submit the form via keyboard (keyboard-only submit — no mouse)
  await page.keyboard.press('Enter')

  // Should navigate to the interview detail page
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/.+\/interviews\/.+/, { timeout: 25_000 })

  // The interview detail page renders (h1 heading present)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Entrevista Teclado AC5/i })).toBeVisible()

  // Back-link is focusable and points to the case (coordinator → "← Caso N")
  const backLink = page.getByRole('link', { name: /caso\s*\d+|caso/i })
  await expect(backLink.first()).toBeVisible()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC6 — Seeded interview panel: panel is visible on case detail, links to detail
// ---------------------------------------------------------------------------

test('AC6 — seeded interview panel visible on case detail; back-link conditional', async ({ page }) => {
  // Coordinator sees "← Caso N" back-link
  await signInAs(page, 'chefe.ccih@test.local')
  await goToCaseDetail(page)

  // Entrevistas panel shows the seeded interview
  const interviewsSection = page.getByRole('region', { name: /Entrevistas/i }).first()
  await expect(interviewsSection).toBeVisible()
  // Should show the seeded interview title or number
  await expect(interviewsSection).toContainText(/Entrevista sobre o Caso 0001/i)

  // Click through to the detail
  await interviewsSection.getByRole('link').first().click()
  await page.waitForURL(/\/interviews\//, { timeout: 15_000 })

  // The interview detail page must render (heading visible). Note: the seeded
  // interview has attachments with a delete button. If the interview detail page
  // crashes (app bug P11-001 — AttachmentsPanel RSC lambda), this assertion catches
  // it as a failing test rather than silently passing.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  // Coordinator sees "← Caso N" back-link (caseNumber is non-null) — this is the
  // back-link in the <InterviewHeader>, NOT the sidebar nav. Scoped to the <header>
  // element to exclude the sidebar's "Casos 1" link from matching.
  const interviewHeader = page.locator('header').first()
  const backLink = interviewHeader.getByRole('link', { name: /caso\s*\d+/i })
  await expect(backLink.first()).toBeVisible()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC7 — HC038: wrong-state transitions are rejected
// ---------------------------------------------------------------------------

test('AC7 — HC038: wrong-state transition (start already-started interview) is rejected', async ({ page }) => {
  // Create and start an interview
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const createResult = await callRPC(page, chefeToken, 'create_interview', {
    p_case_id: SEEDED_CASE_ID,
    p_title: 'Entrevista AC7 Wrong State',
    p_modality: 'presencial',
  })
  expect(createResult.status).toBe(200)
  const wrongStateId = (createResult.body as { id: string }).id

  await callRPC(page, chefeToken, 'schedule_interview', {
    p_interview_id: wrongStateId,
    p_scheduled_start: '2026-06-24T10:00:00Z',
  })
  await callRPC(page, chefeToken, 'start_interview', {
    p_interview_id: wrongStateId,
  })

  // Trying to start again → HC038
  const startAgainResult = await callRPC(page, chefeToken, 'start_interview', {
    p_interview_id: wrongStateId,
  })
  expect(startAgainResult.status).toBe(400)
  expect((startAgainResult.body as { code: string }).code).toBe('HC038')

  // UI: After cancelling, "Reabrir" should not appear (cancelada has no reopen)
  // Let's also test that trying to reopen a rascunho (wrong state) returns HC038
  const createResult2 = await callRPC(page, chefeToken, 'create_interview', {
    p_case_id: SEEDED_CASE_ID,
    p_title: 'Entrevista AC7 Rascunho',
    p_modality: 'presencial',
  })
  expect(createResult2.status).toBe(200)
  const rascunhoId = (createResult2.body as { id: string }).id

  const reopenRascunhoResult = await callRPC(page, chefeToken, 'reopen_interview', {
    p_interview_id: rascunhoId,
  })
  expect(reopenRascunhoResult.status).toBe(400)
  expect((reopenRascunhoResult.body as { code: string }).code).toBe('HC038')
})

// ---------------------------------------------------------------------------
// AC8 — Seeded interview detail: attachments display (file + link), subjects,
//        interviewers, case_events count from seed
// ---------------------------------------------------------------------------

test('AC8 — seeded interview detail: all panels render with correct seeded data', async ({ page }) => {
  // IMPORTANT: by the time this test runs, AC1 may have cancelled the seeded
  // interview. Since Playwright runs tests in sequence (--workers=1) and AC1
  // does cancel the seeded interview, we verify from the DB directly and skip
  // the UI check on the cancelled state.
  // However, we still assert the DB-level seeded counts.

  const attachments = await getAttachments(page, SEEDED_INTERVIEW_ID)
  // The seeded interview has 2 active attachments (1 file + 1 link)
  // Note: AC1 may have soft-deleted none of them since it cancels by lifecycle, not attachment changes.
  // We only assert >= 2 to be resilient.
  expect(attachments.length).toBeGreaterThanOrEqual(2)
  const fileAtt = attachments.find((a) => a.storage_path !== null)
  const linkAtt = attachments.find((a) => a.external_url !== null)
  expect(fileAtt).toBeDefined()
  expect(linkAtt).toBeDefined()
  expect(linkAtt!.external_url).toMatch(/^https:\/\//)

  const subjects = await getSubjects(page, SEEDED_INTERVIEW_ID)
  // 2 subjects: staff1.ccih (registered) + Carlos Pereira (external)
  expect(subjects.length).toBe(2)
  expect(subjects.some((s) => s.user_id === STAFF1_CCIH_ID)).toBe(true)
  expect(subjects.some((s) => s.external_name === 'Carlos Pereira')).toBe(true)

  const interviewers = await getInterviewers(page, SEEDED_INTERVIEW_ID)
  // 2 interviewers: chefe.ccih (registered, principal) + Dra. Helena Marques (external)
  expect(interviewers.length).toBe(2)
  expect(interviewers.some((i) => i.user_id === CHEFE_CCIH_ID && i.role === 'entrevistador_principal')).toBe(true)
  expect(interviewers.some((i) => i.external_name === 'Dra. Helena Marques')).toBe(true)

  // UI: sign in as chefe.ccih and navigate to the seeded interview.
  // NOTE: The seeded interview has attachments AND canEdit=true for chefe.ccih
  // (staff_admin + registered interviewer). If app bug P11-001 is unfixed
  // (AttachmentsPanel passes a closure instead of a bound server action to the
  // ConfirmDeleteButton Client Component), the detail page renders an error boundary
  // "Algo deu errado" instead of the interview content. We assert on that boundary
  // so the bug surfaces as a test failure rather than a silent pass.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${SEEDED_INTERVIEW_ID}`)
  await page.waitForURL(
    `**/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${SEEDED_INTERVIEW_ID}`,
    { timeout: 15_000 },
  )

  // The interview title must render as an h1 (app bug P11-001 prevents this when
  // the interview has attachments and canEdit=true → error boundary fires instead).
  // When the bug is fixed, this assertion will pass and the rest of the UI checks run.
  await expect(page.getByRole('heading', { name: /Entrevista sobre o Caso 0001/i }).first()).toBeVisible({ timeout: 15_000 })

  // Panels present in the interview detail:
  await expect(page.getByRole('region', { name: /Entrevistados/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /Entrevistadores/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /Anexos e gravações/i })).toBeVisible()

  // Seeded data visible in panels
  const subPanelEl = page.getByRole('region', { name: /Entrevistados/i })
  await expect(subPanelEl).toContainText(/Carlos Pereira/i)
  const intPanelEl = page.getByRole('region', { name: /Entrevistadores/i })
  await expect(intPanelEl).toContainText(/Dra. Helena Marques/i)
  const attPanelEl = page.getByRole('region', { name: /Anexos e gravações/i })
  await expect(attPanelEl).toContainText(/Transcrição assinada/i)
  await expect(attPanelEl).toContainText(/Gravação de áudio/i)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC9 — QA MINOR-1 locking assertion (ADR 0026):
//        concluded interview → attachments are STILL manageable (upload / add-link
//        controls present; add-link succeeds); content panels (summary, subjects,
//        interviewers) are read-only (edit controls absent).
// ---------------------------------------------------------------------------

test('AC9 — concluded interview: attachments manageable; content panels read-only', async ({ page }) => {
  // Create, add a subject, schedule, start, and conclude a fresh interview via RPC
  // so we reach `concluida` without going through the full UI lifecycle (AC1 does that).
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')

  const createRes = await callRPC(page, token, 'create_interview', {
    p_case_id: SEEDED_CASE_ID,
    p_title: 'Entrevista AC9 Concluída',
    p_modality: 'presencial',
  })
  expect(createRes.status).toBe(200)
  const ac9Id = (createRes.body as { id: string }).id

  // A subject is required to conclude (HC041).
  const addSubjectRes = await callRPC(page, token, 'add_interview_subject', {
    p_interview_id: ac9Id,
    p_external_name: 'Sujeito AC9',
    p_clinical_role: 'Técnico',
  })
  expect(addSubjectRes.status).toBe(200)

  // Advance through full lifecycle: rascunho → agendada → em_andamento → concluida
  const scheduleRes = await callRPC(page, token, 'schedule_interview', {
    p_interview_id: ac9Id,
    p_scheduled_start: '2026-06-25T10:00:00Z',
  })
  expect(scheduleRes.status).toBe(200)

  const startRes = await callRPC(page, token, 'start_interview', {
    p_interview_id: ac9Id,
  })
  expect(startRes.status).toBe(200)

  const concludeRes = await callRPC(page, token, 'conclude_interview', {
    p_interview_id: ac9Id,
  })
  expect(concludeRes.status).toBe(200)

  // Verify DB-level status
  const row = await getInterviewRow(page, ac9Id)
  expect(row?.status).toBe('concluida')

  // --- UI layer ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${ac9Id}`)
  await page.waitForURL(`**/interviews/${ac9Id}`, { timeout: 15_000 })

  // Page must render without error boundary
  await expect(
    page.getByRole('heading', { name: /Entrevista AC9 Concluída/i }).first()
  ).toBeVisible({ timeout: 15_000 })

  // Status badge shows Concluída
  await expect(page.getByText('Concluída', { exact: true })).toBeVisible()

  // --- MINOR-1 fix: canManageAttachments = canWrite && status !== 'cancelada' ---
  // `concluida` must expose both upload and add-link controls
  const attPanel = page.getByRole('region', { name: /Anexos e gravações/i })
  await expect(attPanel.getByRole('button', { name: /Enviar anexo/i })).toBeVisible()
  await expect(attPanel.getByRole('button', { name: /Adicionar gravação/i })).toBeVisible()

  // Add-link actually succeeds on a concluida interview (no status check in
  // add_interview_attachment per ADR 0026 — late transcripts can be uploaded after
  // conclusion). Verify end-to-end: open dialog → fill → submit → dialog closes.
  await attPanel.getByRole('button', { name: /Adicionar gravação/i }).click()
  const linkDialog = page.getByRole('dialog', { name: /Adicionar gravação/i })
  await expect(linkDialog).toBeVisible({ timeout: 10_000 })
  await linkDialog.locator('input[type="text"]').fill('Gravação pós-conclusão AC9')
  await linkDialog.locator('input[type="url"]').fill('https://example.com/ac9-audio.mp3')
  await linkDialog.getByRole('button', { name: /Adicionar gravação/i }).click()
  // Dialog must close on success (would stay open on RPC error)
  await expect(linkDialog).not.toBeVisible({ timeout: 15_000 })
  // Attachment appears in the list
  await expect(attPanel.locator('li')).toHaveCount(1, { timeout: 10_000 })

  // --- canEditContent = false on concluida → content panels are READ-ONLY ---
  // Summary panel: no "Editar" button (editor is in view-only mode)
  const summaryPanel = page.getByRole('region', { name: /Resumo/i }).first()
  await expect(summaryPanel.getByRole('button', { name: /Editar/i })).not.toBeVisible()

  // Subjects panel: no "Adicionar" button
  const subjectsPanel = page.getByRole('region', { name: /Entrevistados/i })
  await expect(subjectsPanel.getByRole('button', { name: /Adicionar/i })).not.toBeVisible()

  // Interviewers panel: no "Adicionar" button
  const interviewersPanel = page.getByRole('region', { name: /Entrevistadores/i })
  await expect(interviewersPanel.getByRole('button', { name: /Adicionar/i })).not.toBeVisible()

  await signOut(page)
})
