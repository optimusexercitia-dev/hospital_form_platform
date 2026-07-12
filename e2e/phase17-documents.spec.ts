import { test, expect, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'
import { pickDate, readHiddenDateValue } from './helpers/date-pickers'

/**
 * Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)
 *
 * Test contract: translates the Acceptance list of
 * docs/phases/accreditation-track.md §Phase 17 (~490–506) + ADR 0057 into
 * Playwright assertions. Runs against the LOCAL Supabase stack (seeded personas).
 * Run `supabase db reset --local` before a full run; `--workers=1`, chromium.
 *
 * Seeded Phase-17 dataset (supabase/seed.sql, commission A / CCIH, org rede-a,
 * hospital central-a; `controlled_docs` flag flipped ON locally by seed.sql):
 *   DOC-0001  "Política de Higienização das Mãos"  politica, VIGENTE, review_due
 *             2026-01-15 (PAST → overdue). Two aprovado approvers.
 *   DOC-0002  "POP de Isolamento de Contato"  pop, EM_APROVACAO. Two PENDING
 *             approvers: staff1.ccih (in-commission) + chefe.farm (OUTSIDE CCIH,
 *             same hospital — the outside-commission approver persona).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin of CCIH — the document author/coordinator.
 *   staff1.ccih@test.local  plain staff of CCIH — an in-commission approver on DOC-0002.
 *   chefe.farm@test.local   staff_admin of Farmácia (commission B, SAME hospital,
 *                           NOT a CCIH member) — the outside-commission approver
 *                           named on DOC-0002.
 *   admin@test.local        org_admin of rede-a (⇒ staff_admin on CCIH pages).
 *   hospitaladmin.a1@test.local  hospital_admin of central-a — the register rollup.
 *   orgadmin.b@test.local   org_admin of rede-b — foreign-hospital register (empty).
 *
 * Route base: /o/rede-a/c/ccih/manage/documentos(/{id}); org queue
 * /o/rede-a/documentos-pendentes(/{id}); hospital register /o/rede-a/manage/documentos.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const COMMISSION_A_ID = 'a0000000-0000-0000-0000-0000000000a1' // CCIH
const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

/** Run SQL as postgres via docker exec — fixture/flag scaffold ONLY (never data under test). */
function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`, {
    encoding: 'utf8',
  })
    .toString()
    .trim()
}

/** Flip the controlled_docs flag (the surface gate lives in app.feature_flags, not PostgREST-reachable). */
function setControlledDocsFlag(enabled: boolean): void {
  sql(`update app.feature_flags set enabled = ${enabled} where key = 'controlled_docs';`)
}

/**
 * Per-persona auth-cookie cache. This spec switches personas MANY times (each test
 * runs an author → approver → author cycle); a fresh `/login` on every switch
 * exhausts the local GoTrue rate-limit (→ "Não foi possível concluir"). So we log
 * each persona in ONCE, cache its cookies, and on later switches just restore the
 * cookies (no login round-trip). Scoped by browser-context (cleared on re-login).
 */
const cookieJar = new Map<string, import('@playwright/test').Cookie[]>()

async function loginFresh(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Always clear first — navigating to /login while still authenticated redirects to
  // the previous user's home (no login form appears).
  await page.context().clearCookies()

  const cached = cookieJar.get(email)
  if (cached && cached.length > 0) {
    // Restore the cached session cookies — no GoTrue login round-trip.
    await page.context().addCookies(cached)
    return
  }

  await loginFresh(page, email, password)
  cookieJar.set(email, await page.context().cookies())
}

/** Service-role REST query (DB-truth assertions only — never mutates data under test). */
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

async function docIdByCode(page: Page, code: string): Promise<string> {
  const rows = await serviceQuery<{ id: string }>(
    page,
    `controlled_documents?commission_id=eq.${COMMISSION_A_ID}&code=eq.${code}&select=id`,
  )
  expect(rows.length, `document ${code} seeded`).toBe(1)
  return rows[0].id
}

const commissionDocHref = (id: string) => `/o/rede-a/c/ccih/manage/documentos/${id}`

/**
 * Choose an approver in the submit-for-approval picker by a display-name substring,
 * then click "Adicionar". The `<select>` options are labelled with each candidate's
 * full name (± a role hint), so resolve the matching option's value from the DOM.
 */
async function pickApprover(form: import('@playwright/test').Locator, nameSubstring: string): Promise<void> {
  const picker = form.getByLabel(/adicionar aprovador/i)
  const value = await picker
    .locator('option')
    .evaluateAll(
      (opts, needle) => {
        const match = (opts as HTMLOptionElement[]).find(
          (o) => o.value && o.textContent?.toLowerCase().includes(needle.toLowerCase()),
        )
        return match?.value ?? ''
      },
      nameSubstring,
    )
  if (!value) throw new Error(`approver option matching "${nameSubstring}" not found in picker`)
  await picker.selectOption(value)
  await form.getByRole('button', { name: /^adicionar$/i }).click()
}

// A tiny inline PDF as a Playwright file payload (avoids relying on a fixture file
// where a spec only needs *some* valid upload).
const pdfPayload = {
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
  ),
}

// ===========================================================================
// AC-1: Full lifecycle with TWO approvers, one outside-commission (chefe.farm).
//   author creates a doc → uploads a version → submits naming an in-commission
//   approver + chefe.farm → both e-sign aprovado → publish → publish stamps
//   effective + computed review-due dates.
// ===========================================================================

test('AC-1: full lifecycle — create, upload, submit two approvers, both e-sign, publish', async ({ page }) => {
  const uniqueTitle = `Protocolo Lifecycle ${Date.now()}`

  // --- Author creates the document (chefe.ccih). ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel(/título/i).fill(uniqueTitle)
  // doc_type select — pick "Protocolo".
  await page.getByLabel(/tipo/i).selectOption('protocolo')
  await page.getByLabel(/ciclo de revisão/i).fill('12')
  await page.getByRole('button', { name: /criar/i }).click()

  // Lands on the new document's detail (rascunho).
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  const detailUrl = page.url()
  const docId = detailUrl.split('/').pop() as string
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible()

  // --- Upload the version file (the "Arquivo da versão" add-version form). ---
  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()

  // After a successful upload the version has a storage_path (DB-truth).
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ storage_path: string | null }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=storage_path`,
      )
      return rows[0]?.storage_path ?? null
    }, { timeout: 15_000, message: 'version storage_path set after upload' })
    .not.toBeNull()

  await page.reload()

  // --- Submit for approval naming staff1.ccih (in-commission) + chefe.farm (outside). ---
  const submitForm = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await expect(submitForm).toBeVisible({ timeout: 15_000 })

  // Add approver 1: staff1.ccih ("Enfermeiro CCIH Um") — in-commission.
  await pickApprover(submitForm, 'Enfermeiro CCIH Um')
  // Add approver 2: chefe.farm ("Chefe Farmácia") — OUTSIDE CCIH, same hospital.
  await pickApprover(submitForm, 'Chefe Farmácia')

  await submitForm.getByRole('button', { name: /enviar para aprovação/i }).click()

  // DB-truth: the version is em_aprovacao with exactly two pending approval rows.
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=status`,
      )
      return rows[0]?.status
    }, { timeout: 15_000, message: 'version → em_aprovacao after submit' })
    .toBe('in_approval')

  const approvals = await serviceQuery<{ approver_id: string; decision: string | null }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&select=id,document_approvals(approver_id,decision)`,
  ).then(async () => {
    const vrows = await serviceQuery<{ id: string }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&select=id`,
    )
    return serviceQuery<{ approver_id: string; decision: string | null }>(
      page,
      `document_approvals?document_version_id=eq.${vrows[0].id}&select=approver_id,decision`,
    )
  })
  expect(approvals.length, 'two pending approvals created').toBe(2)
  expect(approvals.every((a) => a.decision === null), 'both pending').toBeTruthy()

  const versionId = (
    await serviceQuery<{ id: string }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&select=id`,
    )
  )[0].id

  // --- Approver 1 (staff1.ccih) e-signs from the org queue. ---
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ decision: string | null }>(
        page,
        `document_approvals?document_version_id=eq.${versionId}&order=created_at&select=decision`,
      )
      return rows.filter((r) => r.decision === 'aprovado').length
    }, { timeout: 15_000, message: 'staff1 signed aprovado' })
    .toBe(1)

  // --- Approver 2 (chefe.farm, OUTSIDE commission) e-signs. ---
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ decision: string | null }>(
        page,
        `document_approvals?document_version_id=eq.${versionId}&select=decision`,
      )
      return rows.filter((r) => r.decision === 'aprovado').length
    }, { timeout: 15_000, message: 'both approvers signed aprovado' })
    .toBe(2)

  // --- Coordinator publishes (chefe.ccih). Cycle is 12 months → review_due =
  //     effective + 12 months (computed by the RPC). ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  const effective = await publishViaDialog(page)
  const expectedReview = addMonthsIso(effective, 12)

  // DB-truth: version vigente; effective = the picked date; review_due = +12 months.
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string; effective_date: string; review_due_date: string }>(
        page,
        `controlled_document_versions?id=eq.${versionId}&select=status,effective_date,review_due_date`,
      )
      return rows[0]
    }, { timeout: 15_000, message: 'version published vigente with computed dates' })
    .toMatchObject({ status: 'effective', effective_date: effective, review_due_date: expectedReview })

  // The header status chip reflects vigente + a real, downloadable file is present.
  await page.reload()
  await expect(page.getByText(/vigente/i).first()).toBeVisible()
  const versionsSection = page.locator('section').filter({ hasText: 'Versões' })
  await expect(versionsSection.getByRole('link', { name: /baixar arquivo/i }).first()).toBeVisible()
})

// ===========================================================================
// AC-2: Approver isolation (security-critical). chefe.farm (NOT a CCIH member)
//   sees only DOC-0002 in the org queue, can open + download it, and canNOT
//   reach DOC-0001 or the CCIH commission surface.
// ===========================================================================

test('AC-2: outside-commission approver sees only her named document; no CCIH data leak', async ({ page }) => {
  const doc0001 = await docIdByCode(page, 'DOC-0001') // vigente, chefe.farm NOT named
  const doc0002 = await docIdByCode(page, 'DOC-0002') // em_aprovacao, chefe.farm named

  await signInAs(page, 'chefe.farm@test.local')

  // The org approval queue lists DOC-0002 (she is a pending approver) …
  await page.goto('/o/rede-a/documentos-pendentes')
  await expect(page.getByRole('heading', { name: /aprovações pendentes/i })).toBeVisible()
  await expect(page.getByText('DOC-0002')).toBeVisible({ timeout: 15_000 })
  // … and does NOT list DOC-0001.
  await expect(page.getByText('DOC-0001')).toHaveCount(0)

  // She can open DOC-0002's approver-detail page (the approver-read RLS arm). The
  // "download" affordance is exercised against a REAL uploaded object in AC-1; the
  // SEEDED DOC-0002 has a storage_path but no storage object (seed-fixture gap,
  // BUG-DOC-002), so here we assert only that the file section renders for her.
  await page.goto(`/o/rede-a/documentos-pendentes/${doc0002}`)
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /arquivo em aprovação/i })).toBeVisible()

  // She CANNOT reach DOC-0001's approver-detail (no approval row → 404, no leak).
  const resp = await page.goto(`/o/rede-a/documentos-pendentes/${doc0001}`)
  expect(resp?.status(), 'DOC-0001 approver-detail 404 for non-approver').toBe(404)

  // Foreign-COMMISSION read denied: the CCIH commission register is coordinator-
  // gated; chefe.farm is not a CCIH staff_admin → 404 (no CCIH doc list leak).
  const regResp = await page.goto('/o/rede-a/c/ccih/manage/documentos')
  expect(regResp?.status(), 'CCIH register 404 for non-CCIH-coordinator').toBe(404)

  // And she cannot open DOC-0001's coordinator detail either.
  const detResp = await page.goto(commissionDocHref(doc0001))
  expect(detResp?.status(), 'DOC-0001 coordinator detail 404').toBe(404)
})

// ===========================================================================
// AC-3: Publish gate — rejected (pt-BR) while ANY approval is pending or rejeitado.
//   DOC-0002 has two PENDING approvers → publish must be blocked (HC090).
// ===========================================================================

test('AC-3: publish is rejected in pt-BR while an approval is pending', async ({ page }) => {
  const doc0002 = await docIdByCode(page, 'DOC-0002')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(doc0002))
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible({ timeout: 15_000 })

  // Open the publish dialog and attempt to publish while approvals pending.
  await page.getByRole('button', { name: /^publicar$/i }).click()
  const dialog = page.getByRole('dialog')
  await pickDate(dialog, page, { trigger: dialog.locator('button[aria-haspopup="dialog"]').first() })
  await dialog.getByRole('button', { name: /^publicar$/i }).click()

  // pt-BR error surfaced in the still-open dialog; version stays em_aprovacao.
  await expect(dialog.getByRole('alert')).toContainText(/aprovadores devem aprovar/i, { timeout: 15_000 })

  const rows = await serviceQuery<{ status: string }>(
    page,
    `controlled_documents?id=eq.${doc0002}&select=status`,
  )
  expect(rows[0].status, 'DOC-0002 remains em_aprovacao').toBe('in_approval')
})

// ===========================================================================
// AC-4: Rejection flow — a rejeitado decision returns the version to rascunho
//   (note preserved); resubmit works. Uses a throwaway document.
// ===========================================================================

test('AC-4: a rejection returns the version to rascunho with the note; resubmit works', async ({ page }) => {
  const title = `Doc Rejeição ${Date.now()}`

  // Build a doc, upload, submit naming staff1.ccih only (in-commission).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel(/título/i).fill(title)
  await page.getByLabel(/tipo/i).selectOption('pop')
  await page.getByRole('button', { name: /criar/i }).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop() as string

  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ storage_path: string | null }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=storage_path`,
      )
      return rows[0]?.storage_path ?? null
    }, { timeout: 15_000 })
    .not.toBeNull()
  await page.reload()

  const submitForm = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await pickApprover(submitForm, 'Enfermeiro CCIH Um')
  await submitForm.getByRole('button', { name: /enviar para aprovação/i }).click()

  const versionId = await expect
    .poll(async () => {
      const rows = await serviceQuery<{ id: string; status: string }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=id,status`,
      )
      return rows[0]?.status === 'in_approval' ? rows[0].id : null
    }, { timeout: 15_000 })
    .not.toBeNull()
    .then(async () => {
      const rows = await serviceQuery<{ id: string }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=id`,
      )
      return rows[0].id
    })

  // staff1.ccih REJECTS with a note.
  const rejectNote = `Revisar seção 3 — ${Date.now()}`
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^rejeitar$/i }).click()
  await page.getByLabel(/motivo da rejeição/i).fill(rejectNote)
  await page.getByRole('button', { name: /confirmar rejeição/i }).click()

  // DB-truth: version back to rascunho; the note is preserved on the approval row.
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string }>(
        page,
        `controlled_document_versions?id=eq.${versionId}&select=status`,
      )
      return rows[0]?.status
    }, { timeout: 15_000, message: 'version returned to rascunho after rejection' })
    .toBe('draft')

  const noteRows = await serviceQuery<{ note: string | null; decision: string | null }>(
    page,
    `document_approvals?document_version_id=eq.${versionId}&select=note,decision`,
  )
  expect(noteRows.some((r) => r.decision === 'rejeitado' && r.note === rejectNote), 'note preserved').toBeTruthy()

  // Resubmit works: the coordinator can submit again from the rascunho detail.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  const resubmit = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await expect(resubmit).toBeVisible({ timeout: 15_000 })
  await pickApprover(resubmit, 'Enfermeiro CCIH Um')
  await resubmit.getByRole('button', { name: /enviar para aprovação/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string }>(
        page,
        `controlled_document_versions?id=eq.${versionId}&select=status`,
      )
      return rows[0]?.status
    }, { timeout: 15_000, message: 'resubmit → em_aprovacao again' })
    .toBe('in_approval')
})

// ===========================================================================
// AC-5: Supersede — a new version supersedes; the prior version becomes obsoleto
//   but is retained + still downloadable. Operates on the AC-1-published doc via
//   a fresh throwaway lifecycle to stay order-independent.
// ===========================================================================

test('AC-5: supersede retires the prior version to obsoleto (retained + downloadable)', async ({ page }) => {
  // Build + publish a doc quickly (create → upload → submit staff1 → sign → publish).
  const title = `Doc Supersede ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await buildPublishedDoc(page, title)

  const v1 = (
    await serviceQuery<{ id: string; version_number: number }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&select=id,version_number&order=version_number`,
    )
  )[0]

  // Supersede = a TWO-STEP flow (the action contract). STEP 1: "Criar nova versão"
  // on the vigente detail creates a v2 rascunho (button-only, NO file input).
  await page.goto(commissionDocHref(docId))
  const supersedeForm = page.locator('form').filter({ hasText: 'Nova versão' })
  await expect(supersedeForm).toBeVisible({ timeout: 15_000 })
  await supersedeForm.getByRole('button', { name: /criar nova versão/i }).click()

  // DB-truth: a v2 rascunho now exists; the vigente v1 is still vigente (until v2 publishes).
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ version_number: number }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=version_number`,
      )
      return rows.length
    }, { timeout: 15_000, message: 'a second version was created' })
    .toBe(2)

  const v2 = (
    await serviceQuery<{ id: string; version_number: number; status: string }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&version_number=eq.2&select=id,version_number,status`,
    )
  )[0]

  // STEP 2: the page refreshes into rascunho — upload the file to v2 via the
  // corrected AddVersionForm (carrying v2's versionId), then submit, sign, publish.
  await page.reload()
  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await expect(fileForm).toBeVisible({ timeout: 15_000 })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ storage_path: string | null }>(
        page,
        `controlled_document_versions?id=eq.${v2.id}&select=storage_path`,
      )
      return rows[0]?.storage_path ?? null
    }, { timeout: 15_000, message: 'v2 file uploaded' })
    .not.toBeNull()
  await page.reload()
  const submitForm = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await pickApprover(submitForm, 'Enfermeiro CCIH Um')
  await submitForm.getByRole('button', { name: /enviar para aprovação/i }).click()
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string }>(
        page,
        `controlled_document_versions?id=eq.${v2.id}&select=status`,
      )
      return rows[0]?.status
    }, { timeout: 15_000 })
    .toBe('in_approval')

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ decision: string | null }>(
        page,
        `document_approvals?document_version_id=eq.${v2.id}&select=decision`,
      )
      return rows[0]?.decision
    }, { timeout: 15_000 })
    .toBe('aprovado')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  await publishViaDialog(page)

  // DB-truth: v2 vigente; v1 retired to obsoleto but RETAINED with its storage_path.
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ id: string; status: string; storage_path: string | null }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=id,status,storage_path&order=version_number`,
      )
      const v1row = rows.find((r) => r.id === v1.id)
      const v2row = rows.find((r) => r.id === v2.id)
      return `${v1row?.status}/${v2row?.status}/${v1row?.storage_path ? 'kept' : 'gone'}`
    }, { timeout: 15_000, message: 'v1 obsoleto+retained, v2 vigente' })
    .toBe('obsolete/effective/kept')

  // The prior version is still downloadable in the versions history (signed URL link).
  await page.reload()
  const versionsSection = page.getByRole('region', { name: /versões/i }).or(
    page.locator('section').filter({ hasText: 'Versões' }),
  )
  await expect(versionsSection.getByRole('link', { name: /baixar arquivo/i })).toHaveCount(2)
})

// ===========================================================================
// AC-6: Review-due — the past-due DOC-0001 surfaces in the commission review-due
//   list AND (as hospital_admin) the hospital register; an overdue published FORM
//   joins the review-due list (form arm).
// ===========================================================================

test('AC-6: past-due document surfaces in the commission review-due list and hospital register', async ({ page }) => {
  const doc0001 = await docIdByCode(page, 'DOC-0001') // vigente — NO rascunho draft

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/revisoes')
  await expect(page.getByRole('heading', { name: /revis/i }).first()).toBeVisible({ timeout: 15_000 })

  // DOC-0001 (review_due 2026-01-15, past) appears with the overdue chip in the
  // review-due LIST (post-MINOR-3 the chip lives here + on the register, not on the
  // coordinator detail-page header).
  const doc0001Row = page.locator('li').filter({ hasText: 'DOC-0001' })
  await expect(doc0001Row).toBeVisible({ timeout: 15_000 })
  await expect(doc0001Row.getByText(/vencida/i)).toBeVisible()

  // MINOR-2: the editar route renders the not-found UI for a doc with no `rascunho`
  // working draft. DOC-0001 is vigente → editing by URL is not allowed. (A page-level
  // `notFound()` renders the 404 UI; in Next dev the RSC navigation returns a 200
  // status for it, so assert on the rendered content + the ABSENCE of the editor
  // form, not the HTTP status — mirrors the phase-15 404 assertions.)
  await page.goto(`/o/rede-a/c/ccih/manage/documentos/${doc0001}/editar`)
  await expect(page.getByRole('heading', { name: /Editar documento$/ })).toHaveCount(0)
  await expect(page.locator('input[name="title"]')).toHaveCount(0)
  await expect(
    page.getByText(/não encontramos esta página|Erro 404|página não encontrada/i).first(),
  ).toBeVisible({ timeout: 10_000 })

  // Hospital register (as hospital_admin): DOC-0001 present + flagged review-overdue.
  await signInAs(page, 'hospitaladmin.a1@test.local')
  await page.goto('/o/rede-a/manage/documentos')
  await expect(page.getByText('DOC-0001')).toBeVisible({ timeout: 15_000 })
})

test('AC-6b: an overdue published form joins the review-due list (form arm)', async ({ page }) => {
  // Seed an overdue published form via a service scaffold: publish a fresh form
  // version with a PAST effective + short cycle through the widened RPC. Simplest
  // path here is to stamp an existing published form's metadata is blocked by
  // immutability — so instead publish a NEW draft form with the F7 fields.
  //
  // Build the form through the builder is heavy; instead assert the review-due
  // FORM ARM directly: create a draft form + version + default section via
  // service role, then publish with review metadata via an owner-token RPC, then
  // confirm it appears in the commission review-due list UI.
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  // Create a minimal draft form (service role) in CCIH.
  const formId = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const sectionId = crypto.randomUUID()
  await servicePost(page, 'forms', {
    id: formId,
    commission_id: COMMISSION_A_ID,
    title: `Form Revisão Vencida ${Date.now()}`,
    created_by: '00000000-0000-0000-0000-000000000002',
  })
  await servicePost(page, 'form_versions', {
    id: versionId,
    form_id: formId,
    version_number: 1,
    status: 'draft',
  })
  await servicePost(page, 'form_sections', {
    id: sectionId,
    form_version_id: versionId,
    position: 0,
    is_default: true,
  })

  // Publish with a PAST effective + a 1-month cycle → review_due ~11 months ago.
  const publishResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/publish_form_version`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_form_version_id: versionId,
      p_effective_date: pastDateIso(400),
      p_review_cycle_months: 1,
    },
  })
  expect(publishResp.ok(), 'publish_form_version with review metadata').toBeTruthy()

  // DB-truth: the version carries a past review_due_date.
  const fvRows = await serviceQuery<{ review_due_date: string | null; status: string }>(
    page,
    `form_versions?id=eq.${versionId}&select=review_due_date,status`,
  )
  expect(fvRows[0].status).toBe('published')
  expect(fvRows[0].review_due_date, 'review_due computed from cycle').not.toBeNull()

  // The review-due UI shows the FORM arm (labelled "Formulário").
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/revisoes')
  const formRow = page.locator('li').filter({ hasText: 'Formulário' })
  await expect(formRow.first()).toBeVisible({ timeout: 15_000 })
})

// ===========================================================================
// AC-7: Immutable storage (Rule 6) — each version upload lands at a NEW path.
// ===========================================================================

test('AC-7: each version upload lands at a NEW storage path (Rule 6)', async ({ page }) => {
  const title = `Doc Paths ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await buildPublishedDoc(page, title)

  // Supersede (STEP 1: button-only, creates the v2 rascunho) → then (STEP 2) upload.
  await page.goto(commissionDocHref(docId))
  const supersedeForm = page.locator('form').filter({ hasText: 'Nova versão' })
  await supersedeForm.getByRole('button', { name: /criar nova versão/i }).click()
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ version_number: number }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=version_number`,
      )
      return rows.length
    }, { timeout: 15_000 })
    .toBe(2)
  await page.reload()
  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ storage_path: string | null }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=storage_path,version_number&order=version_number`,
      )
      return rows.length === 2 && rows.every((r) => r.storage_path)
    }, { timeout: 15_000 })
    .toBeTruthy()

  const paths = await serviceQuery<{ storage_path: string }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&select=storage_path&order=version_number`,
  )
  expect(paths.length).toBe(2)
  expect(paths[0].storage_path, 'v1 and v2 have distinct immutable paths').not.toBe(paths[1].storage_path)
})

// ===========================================================================
// AC-8: Form-publish metadata (F7/B4) — publishing a form WITH the fields captures
//   approver/effective/review-due; publishing WITHOUT them stays NULL (compat).
// ===========================================================================

test('AC-8: publish_form_version captures metadata with fields and leaves it NULL without', async ({ page }) => {
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  // --- WITH metadata. ---
  const f1 = crypto.randomUUID(), v1 = crypto.randomUUID(), s1 = crypto.randomUUID()
  await servicePost(page, 'forms', { id: f1, commission_id: COMMISSION_A_ID, title: `Meta ${Date.now()}`, created_by: '00000000-0000-0000-0000-000000000002' })
  await servicePost(page, 'form_versions', { id: v1, form_id: f1, version_number: 1, status: 'draft' })
  await servicePost(page, 'form_sections', { id: s1, form_version_id: v1, position: 0, is_default: true })
  // chefe.farm as the named approver (metadata only — any profile id).
  const farmId = (await serviceQuery<{ id: string }>(page, `profiles?full_name=eq.Chefe%20Farm%C3%A1cia&select=id`))[0]?.id
    ?? '00000000-0000-0000-0000-000000000005'
  const withResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/publish_form_version`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_form_version_id: v1, p_approved_by: farmId, p_effective_date: '2024-03-01', p_review_cycle_months: 6 },
  })
  expect(withResp.ok()).toBeTruthy()
  const withRows = await serviceQuery<{ approved_by: string | null; effective_date: string | null; review_due_date: string | null; approved_at: string | null }>(
    page,
    `form_versions?id=eq.${v1}&select=approved_by,effective_date,review_due_date,approved_at`,
  )
  expect(withRows[0]).toMatchObject({ approved_by: farmId, effective_date: '2024-03-01', review_due_date: '2024-09-01' })
  expect(withRows[0].approved_at, 'approved_at stamped').not.toBeNull()

  // --- WITHOUT metadata (backward-compatible: all four NULL). ---
  const f2 = crypto.randomUUID(), v2 = crypto.randomUUID(), s2 = crypto.randomUUID()
  await servicePost(page, 'forms', { id: f2, commission_id: COMMISSION_A_ID, title: `Plain ${Date.now()}`, created_by: '00000000-0000-0000-0000-000000000002' })
  await servicePost(page, 'form_versions', { id: v2, form_id: f2, version_number: 1, status: 'draft' })
  await servicePost(page, 'form_sections', { id: s2, form_version_id: v2, position: 0, is_default: true })
  const plainResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/publish_form_version`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_form_version_id: v2 },
  })
  expect(plainResp.ok()).toBeTruthy()
  const plainRows = await serviceQuery<{ approved_by: string | null; approved_at: string | null; effective_date: string | null; review_due_date: string | null }>(
    page,
    `form_versions?id=eq.${v2}&select=approved_by,approved_at,effective_date,review_due_date`,
  )
  expect(plainRows[0]).toEqual({ approved_by: null, approved_at: null, effective_date: null, review_due_date: null })
})

// ===========================================================================
// AC-9: Foreign-hospital approver rejected (HC091 → pt-BR) at submit.
// ===========================================================================

test('AC-9: a foreign-hospital user cannot be named approver (pt-BR error)', async ({ page }) => {
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  // Build a fresh rascunho doc with a file (via UI) so we have a version to submit.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel(/título/i).fill(`Doc Foreign ${Date.now()}`)
  await page.getByLabel(/tipo/i).selectOption('politica')
  await page.getByRole('button', { name: /criar/i }).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop() as string
  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()
  await expect
    .poll(async () => (await serviceQuery<{ storage_path: string | null }>(page, `controlled_document_versions?document_id=eq.${docId}&select=storage_path`))[0]?.storage_path ?? null, { timeout: 15_000 })
    .not.toBeNull()
  const versionId = (await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`))[0].id

  // A user in a DIFFERENT hospital (org rede-b): "Analista Qualidade B".
  const foreignId = (await serviceQuery<{ id: string }>(page, `profiles?full_name=eq.Analista%20Qualidade%20B&select=id`))[0]?.id
  expect(foreignId, 'a foreign-hospital user exists in seed').toBeTruthy()

  // Direct RPC (bypasses the picker, which never offers a foreign-hospital user) →
  // the server rejects with HC091, mapped to the pt-BR message by the action layer.
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/submit_document_for_approval`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_version_id: versionId, p_approvers: [{ approver_id: foreignId }] },
  })
  expect(resp.status(), 'foreign-hospital approver rejected').toBe(400)
  const body = await resp.json()
  expect(body.code, 'HC091 raised').toBe('HC091')
})

// ===========================================================================
// AC-10: Hospital-wide register — a hospital_admin sees the cross-commission
//   register; a foreign-hospital admin sees empty.
// ===========================================================================

test('AC-10: hospital_admin sees the cross-commission register; a foreign-hospital admin sees empty', async ({ page }) => {
  // hospital_admin of central-a sees CCIH's DOC-0001/DOC-0002.
  await signInAs(page, 'hospitaladmin.a1@test.local')
  await page.goto('/o/rede-a/manage/documentos')
  await expect(page.getByText('DOC-0001')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('DOC-0002')).toBeVisible()

  // A foreign-org admin (rede-b) reaching rede-a's hospital register → 404 (no leak).
  await signInAs(page, 'orgadmin.b@test.local')
  const resp = await page.goto('/o/rede-a/manage/documentos')
  expect([403, 404]).toContain(resp?.status() ?? 0)
})

// ===========================================================================
// AC-11: Audit — lifecycle actions emit audit rows; the metadata never contains
//   title/summary_of_changes_md/note/storage_path.
// ===========================================================================

test('AC-11: document lifecycle emits audit rows with no sensitive fields', async ({ page }) => {
  const title = `Doc Audit ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel(/título/i).fill(title)
  await page.getByLabel(/tipo/i).selectOption('manual')
  await page.getByRole('button', { name: /criar/i }).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop() as string

  // A document.created audit row exists for this entity.
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ action: string }>(
            page,
            `audit_log?entity_id=eq.${docId}&action=eq.document.created&select=action`,
          )
        ).length,
      { timeout: 15_000, message: 'document.created audit row' },
    )
    .toBeGreaterThanOrEqual(1)

  const rows = await serviceQuery<{ action: string; entity_id: string; metadata: unknown }>(
    page,
    `audit_log?entity_id=eq.${docId}&action=eq.document.created&select=action,entity_id,metadata`,
  )
  expect(rows.length, 'document.created row present').toBeGreaterThanOrEqual(1)

  // The audit metadata (whole row serialized) must NOT carry the sensitive fields.
  const serialized = JSON.stringify(rows)
  expect(serialized).not.toContain(title) // title never audited
  expect(serialized.toLowerCase()).not.toContain('summary_of_changes')
  expect(serialized.toLowerCase()).not.toContain('storage_path')
})

// ===========================================================================
// AC-12: Flag gating — with controlled_docs OFF the whole surface 404s; ON reveals it.
//   Toggles the flag OFF via service SQL for this one assertion, then restores.
// ===========================================================================

test('AC-12: OFF → the controlled-documents RPCs reject (flag gate); ON → the surface renders', async ({ page }) => {
  // The layout/page gate (`controlledDocsEnabled()`) and every RPC
  // (`assert_controlled_docs_enabled()`) share the SAME `app.feature_flags` gate.
  // The layout flag read is cached by the dev server for the process lifetime (so a
  // mid-run route-404 flip is not observable), but the RPC re-reads the flag on
  // EVERY call — so the RPC path is the reliable, un-cached probe of the flag gate.
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  // --- ON (seed default): the register renders + an RPC succeeds. ---
  await signInAs(page, 'chefe.ccih@test.local')
  const onResp = await page.goto('/o/rede-a/c/ccih/manage/documentos')
  expect(onResp?.status(), 'register renders with flag ON').toBe(200)
  await expect(page.getByRole('heading', { name: /documentos controlados/i })).toBeVisible()

  const listOn = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/list_approver_candidates`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_commission: COMMISSION_A_ID },
  })
  expect(listOn.ok(), 'a controlled-docs RPC succeeds while ON').toBeTruthy()

  // --- OFF: every controlled-docs RPC rejects with the pt-BR unavailable message
  //     (assert_controlled_docs_enabled → check_violation). Restore in finally. ---
  try {
    setControlledDocsFlag(false)
    const createOff = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/create_controlled_document`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { p_commission: COMMISSION_A_ID, p_title: 'Bloqueado', p_doc_type: 'pop' },
    })
    expect(createOff.status(), 'create_controlled_document rejected while OFF').toBe(400)
    const body = await createOff.json()
    expect(String(body.message ?? ''), 'pt-BR unavailable message').toMatch(/não está disponível/i)

    const listOff = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/list_approver_candidates`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { p_commission: COMMISSION_A_ID },
    })
    expect(listOff.status(), 'list_approver_candidates rejected while OFF').toBe(400)
  } finally {
    setControlledDocsFlag(true)
  }
})

// ===========================================================================
// AC-13: One fully keyboard-only flow — chefe.ccih Tabs the register → opens
//   DOC-0002; then chefe.farm reaches documentos-pendentes → opens DOC-0002 →
//   Tab to Aprovar/Rejeitar → sign. Confirms chefe.farm is not blocked at the
//   org-level approver route.
// ===========================================================================

test('AC-13: keyboard-only — coordinator opens a doc; outside approver signs via keyboard', async ({ page }) => {
  const doc0002 = await docIdByCode(page, 'DOC-0002')

  // --- Coordinator: keyboard into the register and open a document card. ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos')
  await expect(page.getByRole('heading', { name: /documentos controlados/i })).toBeVisible()

  // Tab until the DOC-0002 CARD LINK itself (an <a> whose href ends with the doc id)
  // is the focused element, then activate with Enter. Matching on href (not text)
  // avoids stopping on a nested span or an unrelated link that merely contains the code.
  const doc0002Card = page.getByRole('link').filter({ hasText: 'DOC-0002' })
  await expect(doc0002Card).toBeVisible({ timeout: 15_000 })
  await focusByTabbing(page, async () => {
    return page.evaluate((id) => {
      const el = document.activeElement as HTMLAnchorElement | null
      return el?.tagName === 'A' && (el.getAttribute('href') ?? '').endsWith(`/documentos/${id}`)
    }, doc0002)
  })
  await page.keyboard.press('Enter')
  await page.waitForURL(new RegExp(`/documentos/${doc0002}$`), { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible()

  // --- Outside approver signs via keyboard from the org queue-detail. ---
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${doc0002}`)
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible({ timeout: 15_000 })

  // chefe.farm is NOT blocked at this org route (the sign form is present).
  const aprovarBtn = page.getByRole('button', { name: /^aprovar$/i })
  await expect(aprovarBtn).toBeVisible()

  // Keyboard to the Aprovar BUTTON (not a nested icon/span) and activate it.
  await focusByTabbing(page, async () => {
    return page.evaluate(() => {
      const el = document.activeElement
      return el?.tagName === 'BUTTON' && /aprovar/i.test(el.textContent ?? '') && !/rejeitar/i.test(el.textContent ?? '')
    })
  })
  await page.keyboard.press('Enter')
  // The note textarea + confirm appear; confirm via keyboard.
  await expect(page.getByLabel(/observação/i)).toBeVisible()
  await page.getByRole('button', { name: /confirmar aprovação/i }).focus()
  await page.keyboard.press('Enter')

  // DB-truth: chefe.farm's approval is now aprovado.
  const farmId = (await serviceQuery<{ id: string }>(page, `profiles?full_name=eq.Chefe%20Farm%C3%A1cia&select=id`))[0].id
  const versionId = (await serviceQuery<{ current_version_id: string }>(page, `controlled_documents?id=eq.${doc0002}&select=current_version_id`))[0].current_version_id
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ decision: string | null }>(
        page,
        `document_approvals?document_version_id=eq.${versionId}&approver_id=eq.${farmId}&select=decision`,
      )
      return rows[0]?.decision
    }, { timeout: 15_000, message: 'chefe.farm signed via keyboard' })
    .toBe('aprovado')
})

// ---------------------------------------------------------------------------
// Shared scaffolding helpers
// ---------------------------------------------------------------------------

/** An owner (persona) JWT — RLS evaluated under it; used for owner-token RPC calls.
 *  Cached per persona to avoid extra GoTrue password-grant hits (rate-limit). */
const ownerTokenCache = new Map<string, string>()
async function ownerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const cached = ownerTokenCache.get(email)
  if (cached) return cached
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok(), `token for ${email}`).toBeTruthy()
  const token = ((await resp.json()) as { access_token: string }).access_token
  ownerTokenCache.set(email, token)
  return token
}

/** Service-role INSERT (test scaffold only). */
async function servicePost(page: Page, path: string, body: unknown): Promise<void> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    data: body,
  })
  expect(resp.ok(), `service POST ${path}`).toBeTruthy()
}

/** ISO date `daysAgo` days in the past. */
function pastDateIso(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

/**
 * Add `months` to a `YYYY-MM-DD` date the way Postgres `date + make_interval(months=>n)`
 * does (month arithmetic clamps to the last valid day). Used to predict the computed
 * review_due_date from a UI-picked effective date + the document's review cycle.
 */
function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const targetMonthIndex = base.getUTCMonth() + months
  const target = new Date(Date.UTC(base.getUTCFullYear(), targetMonthIndex, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * Publish the current em_aprovacao version from the coordinator detail via the
 * publish dialog: pick an effective date in the calendar, submit, and return the
 * chosen `YYYY-MM-DD`. (The DatePicker is a custom popover with a hidden input —
 * driven via the shared pickDate helper, never `input[name].fill()`.)
 */
async function publishViaDialog(page: Page): Promise<string> {
  await page.getByRole('button', { name: /^publicar$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await pickDate(dialog, page, { trigger: dialog.locator('button[aria-haspopup="dialog"]').first() })
  const effective = await readHiddenDateValue(dialog, 'effectiveDate')
  await dialog.getByRole('button', { name: /^publicar$/i }).click()
  return effective
}

/**
 * Build + publish a controlled document end-to-end (create → upload → submit
 * naming staff1.ccih → sign → publish). Returns the document id. Signed in as
 * chefe.ccih on entry; leaves the session on chefe.ccih.
 */
async function buildPublishedDoc(page: Page, title: string): Promise<string> {
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel(/título/i).fill(title)
  await page.getByLabel(/tipo/i).selectOption('protocolo')
  await page.getByRole('button', { name: /criar/i }).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop() as string

  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()
  await expect
    .poll(async () => (await serviceQuery<{ storage_path: string | null }>(page, `controlled_document_versions?document_id=eq.${docId}&select=storage_path`))[0]?.storage_path ?? null, { timeout: 15_000 })
    .not.toBeNull()
  await page.reload()

  const submitForm = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await pickApprover(submitForm, 'Enfermeiro CCIH Um')
  await submitForm.getByRole('button', { name: /enviar para aprovação/i }).click()

  const versionId = (await expect
    .poll(async () => {
      const rows = await serviceQuery<{ id: string; status: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id,status`)
      return rows[0]?.status === 'in_approval' ? rows[0].id : null
    }, { timeout: 15_000 })
    .not.toBeNull()
    .then(async () => (await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`))[0].id))

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()
  await expect
    .poll(async () => (await serviceQuery<{ decision: string | null }>(page, `document_approvals?document_version_id=eq.${versionId}&select=decision`))[0]?.decision, { timeout: 15_000 })
    .toBe('aprovado')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  await publishViaDialog(page)
  await expect
    .poll(async () => (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${versionId}&select=status`))[0]?.status, { timeout: 15_000 })
    .toBe('effective')

  return docId
}

/**
 * Press Tab repeatedly (up to a cap) until `isTarget()` returns true. Keyboard-only
 * navigation helper for the a11y flow. Throws if the target is never focused.
 */
async function focusByTabbing(page: Page, isTarget: () => Promise<boolean>, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await isTarget()) return
    await page.keyboard.press('Tab')
  }
  if (await isTarget()) return
  throw new Error('keyboard: target element was never focused within the tab budget')
}
