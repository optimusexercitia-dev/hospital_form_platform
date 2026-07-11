import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { execSync } from 'node:child_process'
import path from 'path'
import fs from 'fs'

/**
 * Phase F2 — Centralized Attachments (ADR 0063)
 *
 * Test contract: translates the F2 acceptance criteria (PROGRESS.md "F2 — Centralized
 * Attachments") into Playwright assertions. Runs against the LOCAL Supabase stack
 * (seeded personas + `attachments` flag ON by seed).
 *
 * The keystone invariant under test (Rule 12): a PHI-tier attachment lists with NO
 * inline blob URL — the row renders an audited "Baixar" BUTTON that calls the
 * `openAttachment` server action on click, which mints a service-role signed URL AND
 * writes exactly one `attachment.read` audit row per open. Standard-tier blobs keep a
 * direct inline signed `<a>` (unaudited), as before the F2 substrate swap.
 *
 * Seeded fixtures (supabase/seed.sql):
 *   Case d0000000-…-c1 (Caso 0001, CCIH) → document "Prescrição digitalizada",
 *     attachment id a3300000-…-a1 (phi tier / audited door). NOTE: this seeded row
 *     has NO backing storage bytes (seed.sql §"BUG-DOC-002" convention — a SQL seed
 *     cannot write into the container's storage-api file backend), so its signed URL
 *     404s on fetch. That is expected and NOT asserted here; the structural/audit
 *     invariants (button-not-link, exactly-one-audit-row-per-open) do not depend on
 *     the blob existing. Real-bytes download coverage comes from the upload flows
 *     below (meeting + a fresh case document), which upload through the real UI.
 *   Interview f2000000-…-e1 (on Caso 0001) → file "Transcrição assinada (rascunho)"
 *     (phi / audited) + link "Gravação de áudio (link externo)" →
 *     https://example.com/recordings/caso-0001-entrevista.mp3 (direct anchor).
 *   Meeting f1000000-…-e1 → 0 seeded attachments (meetings default to standard tier).
 *
 * Personas (password Test1234!): chefe.ccih@test.local (staff_admin, CCIH, Rede A).
 *
 * Run: npx playwright test e2e/phase-f2-attachments.spec.ts --project=chromium --workers=1
 * Prereq: `supabase db reset --local` (seed enables the `attachments` flag).
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
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

const SEEDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001
const SEEDED_MEETING_ID = 'f1000000-0000-0000-0000-0000000000e1'
const SEEDED_INTERVIEW_ID = 'f2000000-0000-0000-0000-0000000000e1'
const CASE_DOC_ATTACHMENT_ID = 'a3300000-0000-0000-0000-0000000000a1'
const CHEFE_CCIH_ID = '00000000-0000-0000-0000-000000000002'

const CASE_DOC_TITLE = 'Prescrição digitalizada'
const INTERVIEW_FILE_TITLE = 'Transcrição assinada (rascunho)'
const INTERVIEW_LINK_TITLE = 'Gravação de áudio (link externo)'
const INTERVIEW_LINK_URL = 'https://example.com/recordings/caso-0001-entrevista.mp3'

const CASE_URL = `/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`
const MEETING_URL = `/o/rede-a/c/ccih/meetings/${SEEDED_MEETING_ID}`
const INTERVIEW_URL = `/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${SEEDED_INTERVIEW_ID}`

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

/** Run SQL as postgres via docker exec — flag scaffold ONLY (never data under test). */
function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`, {
    encoding: 'utf8',
  })
    .toString()
    .trim()
}

/** Flip the `attachments` flag (the surface gate lives in app.feature_flags, not PostgREST-reachable). */
function setAttachmentsFlag(enabled: boolean): void {
  sql(`update app.feature_flags set enabled = ${enabled} where key = 'attachments';`)
}

/** Service-role REST GET. */
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

/** Audit rows for a given action + entity (service-role truth read; same mechanism as phi-remediation.spec.ts). */
async function auditRows(req: APIRequestContext, action: string, entityId: string) {
  return svcGet<{
    id: string
    action: string
    actor_id: string | null
    entity_id: string
    occurred_at: string
  }>(
    req,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_id=eq.${entityId}` +
      `&select=id,action,actor_id,entity_id,occurred_at&order=occurred_at.asc`,
  )
}

/** Escape regex metacharacters in a dynamic string before embedding it in `new RegExp(...)`
 *  (several seeded titles contain literal parentheses — e.g. "(rascunho)"). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function titleRe(prefix: string, title: string): RegExp {
  return new RegExp(`${prefix} ${escapeRegExp(title)}`, 'i')
}

/**
 * Click an OpenAttachmentButton, capture the URL it opens via `window.open(signedUrl,
 * "_blank", …)`, return that URL. For a real `application/pdf` blob, headless
 * Chromium treats the navigation as a native file DOWNLOAD (not a page render) — the
 * popup Page's own `url()` never commits (stays `""`), but the browser still emits a
 * `download` event on the context carrying the real target URL. Race both: use the
 * download's URL when Chromium took the download path, else fall back to the popup's
 * committed URL (e.g. a future non-PDF mime type that renders inline instead).
 */
async function clickAndCapturePopup(page: Page, button: ReturnType<Page['getByRole']>) {
  const context = page.context()
  const downloadPromise = context.waitForEvent('download', { timeout: 5_000 }).catch(() => null)
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()])
  const download = await downloadPromise
  const url = download ? download.url() : popup.url()
  await popup.close().catch(() => {})
  return url
}

/**
 * Click an OpenAttachmentButton for an attachment whose blob has NO backing storage
 * bytes (the seeded fixtures — seed.sql's documented convention: a SQL seed cannot
 * write real object bytes into the storage-api file backend, so `createSignedUrl`
 * legitimately 404s). The RPC still authorizes + audits the read BEFORE the signing
 * attempt (`open_attachment` writes `attachment.read` unconditionally for a phi-tier
 * row it authorizes), so no popup opens and the button surfaces the inline pt-BR
 * failure message instead. This is the correct, by-design outcome for these fixtures.
 */
async function clickExpectingMintFailure(page: Page, button: ReturnType<Page['getByRole']>) {
  await button.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível abrir o anexo.' })).toBeVisible({
    timeout: 10_000,
  })
}

function writeTmpPdf(name: string): string {
  const p = path.join(process.cwd(), 'e2e', name)
  fs.writeFileSync(p, '%PDF-1.4 test pdf for F2 e2e\n%%EOF\n')
  return p
}

// ---------------------------------------------------------------------------
// AC1 (criterion 1) — Standard-tier meeting attachment: upload → inline
//                       download link → download succeeds (non-regression)
// ---------------------------------------------------------------------------

test('F2-1: meeting attachment (standard tier) uploads and downloads via a direct inline link', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(MEETING_URL)
  await page.waitForURL(`**/c/ccih/meetings/${SEEDED_MEETING_ID}`, { timeout: 15_000 })

  const attPanel = page.getByRole('region', { name: /Anexos/i })
  await expect(attPanel).toBeVisible({ timeout: 10_000 })

  await attPanel.getByRole('button', { name: /Enviar anexo/i }).click()
  const uploadDialog = page.getByRole('dialog', { name: /Enviar anexo/i })
  await expect(uploadDialog).toBeVisible({ timeout: 10_000 })

  // Unique title per run: this file may be re-run against a not-freshly-reset DB
  // during a fix loop, and a stale row from a prior run must never collide with a
  // `filter({ hasText })` match (strict mode would then see >1 element).
  const title = `Pauta F2 E2E ${Date.now()}`
  const tmpPdf = writeTmpPdf('_tmp_f2_meeting.pdf')
  try {
    await uploadDialog.locator('input[type="file"]').setInputFiles(tmpPdf)
    await uploadDialog.locator('input[name="title"]').fill(title)
    await uploadDialog.getByRole('button', { name: /Enviar anexo/i }).click()
    await expect(uploadDialog).toHaveCount(0, { timeout: 30_000 })
  } finally {
    if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf)
  }

  const row = attPanel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })

  // Standard tier ⇒ a direct inline <a>, not the audited button.
  const link = row.getByRole('link', { name: titleRe('Baixar', title) })
  await expect(link).toBeVisible()
  await expect(row.getByRole('button', { name: titleRe('Baixar', title) })).toHaveCount(0)

  const href = await link.getAttribute('href')
  expect(href).toBeTruthy()
  expect(href).not.toBe('#')

  // Value assertion, not mere rendering: the blob is actually fetchable (real bytes,
  // uploaded through the real UI flow — unlike the seeded PHI doc below).
  const resp = await page.request.get(href!)
  expect(resp.ok(), `expected the signed URL to 200, got ${resp.status()}`).toBeTruthy()

  // Delete affordance also renders + works while the flag is ON (criterion 4a).
  const deleteBtn = row.getByRole('button', { name: titleRe('Remover', title) })
  await expect(deleteBtn).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC2 (criterion 2, THE KEYSTONE) — PHI-tier audited download: no inline URL,
//                       audited button, exactly one attachment.read row per open
// ---------------------------------------------------------------------------

test('F2-2: case PHI document has NO inline URL — opens only via the audited door, exactly one attachment.read row per open attempt', async ({
  page,
  request,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')

  const before = await auditRows(request, 'attachment.read', CASE_DOC_ATTACHMENT_ID)

  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  const docPanel = page.getByRole('region', { name: /Documentos/i })
  await expect(docPanel).toBeVisible({ timeout: 10_000 })

  const row = docPanel.locator('li').filter({ hasText: CASE_DOC_TITLE })
  await expect(row).toBeVisible({ timeout: 10_000 })

  // NO inline blob URL anywhere in this row's DOM/href — the Rule-12 guarantee.
  await expect(row.locator('a')).toHaveCount(0)

  const openBtn = row.getByRole('button', { name: titleRe('Baixar', CASE_DOC_TITLE) })
  await expect(openBtn).toBeVisible()

  // NOTE: the seeded fixture has NO backing storage bytes (seed.sql's documented
  // convention — a SQL seed cannot write real object bytes into the storage-api file
  // backend), so `open_attachment` authorizes + audits the read but the SUBSEQUENT
  // `createSignedUrl` mint legitimately 404s — no popup opens; the UI surfaces the
  // inline pt-BR failure message instead. That is the correct, by-design outcome
  // (verified directly against local storage-api). It does NOT weaken the invariant
  // under test here: `open_attachment` writes `attachment.read` BEFORE attempting to
  // sign, so the audit-per-open-attempt guarantee holds independent of blob bytes.
  // The "opens the blob" half of criterion 2 is proven with real bytes in F2-4.

  // --- First open attempt: exactly one audit row ---
  await clickExpectingMintFailure(page, openBtn)

  const after1 = await auditRows(request, 'attachment.read', CASE_DOC_ATTACHMENT_ID)
  expect(after1.length).toBe(before.length + 1)
  expect(after1[after1.length - 1].actor_id).toBe(CHEFE_CCIH_ID)

  // --- Second open attempt: each open is independently audited — two rows now ---
  await clickExpectingMintFailure(page, openBtn)

  const after2 = await auditRows(request, 'attachment.read', CASE_DOC_ATTACHMENT_ID)
  expect(after2.length).toBe(before.length + 2)
})

// ---------------------------------------------------------------------------
// AC3 (criterion 3) — Interview: FILE routes through the audited door; LINK is
//                       a plain unaudited external anchor
// ---------------------------------------------------------------------------

test('F2-3: interview file opens via the audited door; the external link is a plain unaudited anchor', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(INTERVIEW_URL)
  await page.waitForURL(`**/interviews/${SEEDED_INTERVIEW_ID}`, { timeout: 15_000 })

  const attSection = page.getByRole('region', { name: /Anexos e gravações/i })
  await expect(attSection).toBeVisible({ timeout: 10_000 })

  // FILE row (phi tier, no default backing bytes) — audited button, no <a>.
  const fileRow = attSection.locator('li').filter({ hasText: INTERVIEW_FILE_TITLE })
  await expect(fileRow).toBeVisible()
  await expect(fileRow.locator('a')).toHaveCount(0)
  await expect(
    fileRow.getByRole('button', { name: titleRe('Baixar', INTERVIEW_FILE_TITLE) }),
  ).toBeVisible()

  // LINK row — a plain unaudited external anchor, exact href, no button.
  const linkRow = attSection.locator('li').filter({ hasText: INTERVIEW_LINK_TITLE })
  await expect(linkRow).toBeVisible()
  const linkAnchor = linkRow.getByRole('link', { name: titleRe('Abrir', INTERVIEW_LINK_TITLE) })
  await expect(linkAnchor).toBeVisible()
  // No "Baixar"/audited-open button on a link row — only the (unrelated) delete button.
  await expect(linkRow.getByRole('button', { name: /^Baixar/i })).toHaveCount(0)

  const href = await linkAnchor.getAttribute('href')
  expect(href).toBe(INTERVIEW_LINK_URL)
  const target = await linkAnchor.getAttribute('target')
  expect(target).toBe('_blank')
})

// ---------------------------------------------------------------------------
// AC4 (criterion 5) — Fold-in non-regression: a FRESH case-document upload
//                       (real bytes) also routes through the audited door and
//                       its open is genuinely fetchable + audited
// ---------------------------------------------------------------------------

test('F2-4: fresh case-document upload → audited open round trip (fold-in non-regression, real bytes)', async ({
  page,
  request,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  const docPanel = page.getByRole('region', { name: /Documentos/i })
  await expect(docPanel).toBeVisible({ timeout: 10_000 })

  await docPanel.getByRole('button', { name: /Anexar/i }).click()
  const uploadDialog = page.getByRole('dialog').filter({ hasText: /Enviar documento/i })
  await expect(uploadDialog).toBeVisible({ timeout: 10_000 })

  // Unique title per run (see F2-1's comment — this file may re-run without a DB reset).
  const title = `Digitalização F2 E2E ${Date.now()}`
  const tmpPdf = writeTmpPdf('_tmp_f2_case.pdf')
  try {
    await uploadDialog.locator('input[type="file"]').setInputFiles(tmpPdf)
    await uploadDialog.locator('input[name="title"]').fill(title)
    await uploadDialog.getByRole('button', { name: /Enviar documento/i }).click()
    await expect(uploadDialog).toHaveCount(0, { timeout: 30_000 })
  } finally {
    if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf)
  }

  const row = docPanel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })

  // Case documents default to the PHI tier ⇒ audited button, not a link.
  await expect(row.locator('a')).toHaveCount(0)
  const openBtn = row.getByRole('button', { name: titleRe('Baixar', title) })
  await expect(openBtn).toBeVisible()

  // Resolve the new attachment id (service-role truth read) to scope the audit query.
  const created = await svcGet<{ id: string }>(
    request,
    `attachments?owner_type=eq.case&owner_id=eq.${SEEDED_CASE_ID}&title=eq.${encodeURIComponent(title)}&select=id`,
  )
  expect(created.length).toBe(1)
  const newAttachmentId = created[0].id

  const before = await auditRows(request, 'attachment.read', newAttachmentId)
  const url = await clickAndCapturePopup(page, openBtn)
  expect(url).toMatch(/\/storage\/v1\/object\/sign\//)

  // Real bytes this time (uploaded through the real UI): the signed URL is genuinely fetchable.
  const resp = await page.request.get(url)
  expect(resp.ok(), `expected the signed URL to 200, got ${resp.status()}`).toBeTruthy()

  const after = await auditRows(request, 'attachment.read', newAttachmentId)
  expect(after.length).toBe(before.length + 1)
})

// ---------------------------------------------------------------------------
// AC5 (criterion 4) — Flag-gating: attachments OFF ⇒ upload/delete hidden,
//                       existing rows render read-only, audited open disabled
// ---------------------------------------------------------------------------

test('F2-5: attachments flag OFF hides upload/delete and disables the audited open; rows stay read-only', async ({
  page,
}) => {
  setAttachmentsFlag(false)
  try {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(CASE_URL)
    await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

    const docPanel = page.getByRole('region', { name: /Documentos/i })
    await expect(docPanel).toBeVisible({ timeout: 10_000 })

    // Upload affordance hidden entirely (not merely disabled).
    await expect(docPanel.getByRole('button', { name: /Anexar/i })).toHaveCount(0)

    // The seeded row still renders (list reads are never gated) — read-only.
    const row = docPanel.locator('li').filter({ hasText: CASE_DOC_TITLE })
    await expect(row).toBeVisible()
    await expect(row.getByRole('button', { name: /Remover/i })).toHaveCount(0)

    // The escalated-open control is present but DISABLED (not hidden) while the flag is off.
    const openBtn = row.getByRole('button', { name: titleRe('Baixar', CASE_DOC_TITLE) })
    await expect(openBtn).toBeVisible()
    await expect(openBtn).toBeDisabled()

    // Same gating on the meeting panel.
    await page.goto(MEETING_URL)
    await page.waitForURL(`**/c/ccih/meetings/${SEEDED_MEETING_ID}`, { timeout: 15_000 })
    const meetingPanel = page.getByRole('region', { name: /Anexos/i })
    await expect(meetingPanel).toBeVisible({ timeout: 10_000 })
    await expect(meetingPanel.getByRole('button', { name: /Enviar anexo/i })).toHaveCount(0)
  } finally {
    // Always restore — the rest of the suite (and the full-regression run) assumes ON.
    setAttachmentsFlag(true)
  }
})

// ---------------------------------------------------------------------------
// AC6 (criterion 6, required) — Keyboard-only: tab/focus to the audited
//                       download button and activate it via the keyboard
// ---------------------------------------------------------------------------

test('F2-6: keyboard-only — focus the audited download button and activate with Enter', async ({
  page,
  request,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')

  const before = await auditRows(request, 'attachment.read', CASE_DOC_ATTACHMENT_ID)

  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  const docPanel = page.getByRole('region', { name: /Documentos/i })
  const row = docPanel.locator('li').filter({ hasText: CASE_DOC_TITLE })
  const openBtn = row.getByRole('button', { name: titleRe('Baixar', CASE_DOC_TITLE) })

  await openBtn.focus()
  await expect(openBtn).toBeFocused()

  // Keyboard-activate (Enter on a native <button> triggers its click handler). Same
  // seeded-fixture caveat as F2-2 — no backing bytes, so the round trip surfaces the
  // inline failure message rather than a popup; the audit write still fires.
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível abrir o anexo.' })).toBeVisible({
    timeout: 10_000,
  })

  const after = await auditRows(request, 'attachment.read', CASE_DOC_ATTACHMENT_ID)
  expect(after.length).toBe(before.length + 1)
})
