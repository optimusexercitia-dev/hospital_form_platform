import { test, expect, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'
import { cachedSignIn } from './helpers/auth'
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  createDocumentFixture,
  openDocumentVersion,
  auditRows,
  svcGet,
  svcPatch,
  clickAndCapturePopup,
  escapeRegExp,
} from './helpers/document-model'

/**
 * DM2 — Wave A Document Model (ADR 0114 + Amendment 1 D15/D16; ADR 0117/0118) —
 * REWRITE of the retired Phase F2 (Centralized Attachments, ADR 0063) spec, per
 * ADR 0114 D5 ("rewritten, never merely deleted"; FUP-DM1-E2E).
 *
 * DM1 (migration `20260923000100`) dropped the `attachments` substrate this file
 * used to exercise. DM2 rebuilt it as the CORE document model: `documents` /
 * `document_versions` / `file_objects`, a three-step signed-URL write path
 * (`begin_document_upload` → PUT → `finalize_document_upload` →
 * `complete_document_upload_verification`), and one audited byte corridor
 * (`open_document_version`). This file is the general Wave-A spec: the write path
 * (upload / retry / expiry — the sharpest, never-before-exercised seam in DM2),
 * flag gating, the interview file/link split, and the availability-state surface.
 *
 * Coverage map:
 *   DM2-U1        the write path, browser-driven: begin→PUT→finalize→verify lands
 *                 `available`, downloads for real, audited exactly once (PRIORITY 1).
 *   DM2-U2        `upload_incomplete` retry reuses the SAME reservation (329 U11).
 *   DM2-U3        `upload_expired` drops the reservation; "Tentar novamente" reverts
 *                 to "Enviar" (329 U12).
 *   DM2-U4        meeting (standard tier) upload; the D11 floor audit conditional
 *                 (same-creator standard-tier opens are NOT logged; a non-creator's
 *                 IS) — read straight from `open_document_version`'s live body.
 *   DM2-INTERVIEW interview FILE (Documents/"Anexos") vs external LINK ("Gravações e
 *                 links") — two independent sections, non-regression.
 *   DM2-FLAGOFF   `documents_wave_a` OFF: upload/delete ABSENT (not disabled); the
 *                 audited open control ABSENT for an existing row (a change from the
 *                 old F2 "disabled" pattern — pinned literally).
 *   DM2-KEYBOARD  keyboard-only: tab to the audited download button, Enter opens it.
 *   DM2-STATES    `pending` / `disposed` render distinctly and are not confusable;
 *                 a disposed document stays LISTED with a redacted title (governance
 *                 record, not a leak).
 *   DM2-BUG-1     (test.fail — known bug, filed) a verification FAILURE
 *                 (`complete_document_upload_verification(verified:=false)`) never
 *                 binds `document_version_files`, so the row reads `pending` forever
 *                 instead of `failed` — confirmed against the live catalog + a direct
 *                 RPC probe before writing this test.
 *   DM2-BUG-2     (test.fail — known bug, filed) the D15 ceiling denies at ROW-level
 *                 RLS (the whole `documents` row is invisible to an uncleared reader),
 *                 so `canOpen` (`availability === 'available'`, no separate door call)
 *                 can never be `false` on a rendered row — the `DocumentRestrictedBadge`
 *                 ("Restrito") is dead code, confirmed via a live RPC probe.
 *
 * Ground truth (read from `pg_proc`/`pg_policies` on the local stack, 2026-08-13 —
 * migration text is stale by design, CLAUDE.md graphify exception):
 *   - `begin_document_upload` derives tier server-side: case/interview → `phi`
 *     bucket, meeting/action_item → `standard`. It ALSO writes an unconditional
 *     `document.upload_started` audit row.
 *   - `complete_document_upload_verification` writes `document.uploaded` on success
 *     (binds `document_version_files`) or `document.upload_failed` on failure (does
 *     NOT bind — see DM2-BUG-1).
 *   - `open_document_version` writes `document.opened` ONLY when
 *     `file.sensitivity_tier = 'phi' OR opener <> document.created_by` (the D11
 *     floor) — a same-creator standard-tier open is deliberately unlogged.
 *   - Supabase Storage's signed UPLOAD url path is
 *     `/storage/v1/object/upload/sign/{bucket}/{path}?token=...` (probed directly
 *     against local Storage, not assumed) — the `page.route` match for DM2-U2/U3.
 *
 * Personas (password `Test1234!`): chefe.ccih@test.local (staff_admin, CCIH, Rede A) —
 * creator/coordinator on every fixture below; staff1.ccih@test.local (staff, CCIH) —
 * the non-creator reader for the D11 floor check.
 *
 * Run: npx playwright test e2e/phase-f2-attachments.spec.ts --project=chromium --workers=1
 * Prereq: `supabase db reset --local` (seed forces `documents_foundation` +
 * `documents_wave_a` ON for local/E2E — commit 01134b1).
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (from supabase/seed.sql)
// ---------------------------------------------------------------------------

const SEEDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001, CCIH
const SEEDED_MEETING_ID = 'f1000000-0000-0000-0000-0000000000e1'
const SEEDED_INTERVIEW_ID = 'f2000000-0000-0000-0000-0000000000e1'
const CHEFE_CCIH_ID = '00000000-0000-0000-0000-000000000002'
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003'

const CASE_URL = `/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`
const MEETING_URL = `/o/rede-a/c/ccih/meetings/${SEEDED_MEETING_ID}`
const INTERVIEW_URL = `/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}/interviews/${SEEDED_INTERVIEW_ID}`

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await cachedSignIn(page, email, password)
}

async function getOwnerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Flip the `documents_wave_a` flag (lives in `app.feature_flags`, not PostgREST-reachable). */
function setDocumentsWaveAFlag(enabled: boolean): void {
  execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "update app.feature_flags set enabled = ${enabled} where key = 'documents_wave_a';"`,
    { encoding: 'utf8' },
  )
}

function pdfFile(name: string, seed = Date.now()) {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4 e2e fixture ${seed}\n%%EOF\n`),
  }
}

function titleRe(prefix: string, title: string): RegExp {
  return new RegExp(`${prefix} ${escapeRegExp(title)}`, 'i')
}

/** Tab through the page until `predicate` matches the focused element, or give up. */
async function tabUntil(
  page: Page,
  predicate: (info: { tag: string; text: string; ariaLabel: string | null }) => boolean,
  maxPresses = 150,
): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      return { tag: el.tagName, text: (el.textContent ?? '').trim(), ariaLabel: el.getAttribute('aria-label') }
    })
    if (info && predicate(info)) return true
  }
  return false
}

// ===========================================================================
// DM2-U1 (PRIORITY 1) — the write path, driven through the real browser
// ===========================================================================

test('DM2-U1: uploads a document through the browser on a case home — available, downloads for real, audited exactly once', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  const docPanel = page.getByRole('region', { name: /Documentos/i })
  await expect(docPanel).toBeVisible({ timeout: 10_000 })

  await docPanel.getByRole('button', { name: 'Anexar documento' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Enviar documento' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const title = `DM2-U1 documento ${Date.now()}`
  await dialog.locator('input[type="file"]').setInputFiles(pdfFile('dm2-u1.pdf'))
  await dialog.locator('input[name="title"]').fill(title)
  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 30_000 })

  const row = docPanel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })

  // 'available' renders NO badge at all — the enabled download control IS the signal.
  await expect(
    row.getByText(/Processando envio|Falha no envio|Indisponível|Eliminado|Sem arquivo|Restrito/i),
  ).toHaveCount(0)

  const openBtn = row.getByRole('button', { name: titleRe('Baixar', title) })
  await expect(openBtn).toBeVisible()

  // DB truth: exactly one document, one version (v1), one 'source' binding, servable,
  // case home ⇒ phi tier (server-derived, never a caller input).
  const docs = await svcGet<{ id: string; status: string; confidentiality_level: string | null }>(
    request,
    `documents?title=eq.${encodeURIComponent(title)}&select=id,status,confidentiality_level`,
  )
  expect(docs.length).toBe(1)
  const documentId = docs[0].id
  expect(docs[0].status).toBe('active')

  const versions = await svcGet<{ id: string; version_number: number }>(
    request,
    `document_versions?document_id=eq.${documentId}&select=id,version_number`,
  )
  expect(versions.length).toBe(1)
  expect(versions[0].version_number).toBe(1)

  const dvfs = await svcGet<{ rendition_kind: string; file_object_id: string }>(
    request,
    `document_version_files?document_version_id=eq.${versions[0].id}&select=rendition_kind,file_object_id`,
  )
  expect(dvfs.length).toBe(1)
  expect(dvfs[0].rendition_kind).toBe('source')

  const files = await svcGet<{ upload_state: string; sensitivity_tier: string }>(
    request,
    `file_objects?id=eq.${dvfs[0].file_object_id}&select=upload_state,sensitivity_tier`,
  )
  expect(files[0].upload_state).toBe('unscanned_accepted')
  expect(files[0].sensitivity_tier).toBe('phi')

  // Audit exactness through the whole state machine so far: begin + verify-success
  // are UNCONDITIONAL; open has not happened yet.
  expect((await auditRows(request, 'document.upload_started', documentId)).length).toBe(1)
  expect((await auditRows(request, 'document.uploaded', documentId)).length).toBe(1)
  expect((await auditRows(request, 'document.opened', documentId)).length).toBe(0)

  // The real download round trip — a genuinely fetchable signed URL (real bytes).
  const url = await clickAndCapturePopup(page, openBtn)
  expect(url).toMatch(/\/storage\/v1\/object\/sign\//)
  const dl = await page.request.get(url)
  expect(dl.ok(), `expected the signed URL to 200, got ${dl.status()}`).toBeTruthy()

  // Case-tier ⇒ PHI ⇒ audited unconditionally (D11 floor), even for the creator's own open.
  const opened = await auditRows(request, 'document.opened', documentId)
  expect(opened.length).toBe(1)
  expect(opened[0].actor_id).toBe(CHEFE_CCIH_ID)

  // A second open writes a SECOND row — every open is independently audited.
  const url2 = await clickAndCapturePopup(page, openBtn)
  expect(url2).toMatch(/\/storage\/v1\/object\/sign\//)
  expect((await auditRows(request, 'document.opened', documentId)).length).toBe(2)
})

// ===========================================================================
// DM2-U2 — upload_incomplete: a failed PUT leaves the reservation retryable
// ===========================================================================

test('DM2-U2: a failed PUT reports upload_incomplete and reuses the SAME reservation on retry — no duplicate document_version/file_object', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(MEETING_URL)
  await page.waitForURL(`**/meetings/${SEEDED_MEETING_ID}`, { timeout: 15_000 })

  const panel = page.getByRole('region', { name: /Anexos/i })
  await expect(panel).toBeVisible({ timeout: 10_000 })
  await panel.getByRole('button', { name: 'Enviar anexo' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Enviar anexo' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const title = `DM2-U2 retry ${Date.now()}`
  await dialog.locator('input[type="file"]').setInputFiles(pdfFile('dm2-u2.pdf'))
  await dialog.locator('input[name="title"]').fill(title)

  // Fail the FIRST Storage PUT only — the client never learns bucket/path directly,
  // so match Storage's own signed-upload path shape (confirmed against local
  // Storage before writing this test, not assumed).
  let putAttempts = 0
  await page.route('**/storage/v1/object/upload/sign/**', async (route) => {
    putAttempts++
    if (putAttempts === 1) {
      await route.abort('failed')
    } else {
      await route.continue()
    }
  })

  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click()
  // Inline failure — "tente enviar novamente", never "comece de novo": the
  // RESERVATION stays valid. `FormBanner` renders `role="status"` (a polite live
  // region), not `role="alert"` — confirmed against its source before fixing this
  // locator (the first run used the wrong role and timed out on a real element).
  await expect(
    dialog.getByRole('status').filter({ hasText: 'O arquivo não chegou por completo. Tente enviar novamente.' }),
  ).toBeVisible({ timeout: 15_000 })
  const retryBtn = dialog.getByRole('button', { name: 'Tentar novamente', exact: true })
  await expect(retryBtn).toBeVisible()

  // DB truth: begin_document_upload ran exactly ONCE — one document, one version.
  const docsAfterFail = await svcGet<{ id: string }>(
    request,
    `documents?title=eq.${encodeURIComponent(title)}&select=id`,
  )
  expect(docsAfterFail.length).toBe(1)
  const documentId = docsAfterFail[0].id
  const versionsAfterFail = await svcGet<{ id: string }>(
    request,
    `document_versions?document_id=eq.${documentId}&select=id`,
  )
  expect(versionsAfterFail.length).toBe(1)
  expect((await auditRows(request, 'document.upload_started', documentId)).length).toBe(1)
  // No binding yet — the failed PUT never reached Storage.
  expect(
    (await svcGet(request, `document_version_files?document_version_id=eq.${versionsAfterFail[0].id}&select=id`))
      .length,
  ).toBe(0)

  // Retry — reuses the SAME reservation; this PUT goes through for real.
  await retryBtn.click()
  await expect(dialog).toHaveCount(0, { timeout: 30_000 })

  const row = panel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row.getByRole('button', { name: titleRe('Baixar', title) })).toBeVisible()

  // STILL exactly one document_version — no duplicate reservation minted by the retry,
  // and begin_document_upload was never re-called.
  const versionsAfterRetry = await svcGet<{ id: string }>(
    request,
    `document_versions?document_id=eq.${documentId}&select=id`,
  )
  expect(versionsAfterRetry.length).toBe(1)
  expect(versionsAfterRetry[0].id).toBe(versionsAfterFail[0].id)
  expect((await auditRows(request, 'document.upload_started', documentId)).length).toBe(1)
  expect((await auditRows(request, 'document.uploaded', documentId)).length).toBe(1)
})

// ===========================================================================
// DM2-U3 — upload_expired: an elapsed reservation cannot be retried
// ===========================================================================

test('DM2-U3: an expired reservation refuses the retry with upload_expired and drops the session (button reverts to "Enviar")', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(MEETING_URL)
  await page.waitForURL(`**/meetings/${SEEDED_MEETING_ID}`, { timeout: 15_000 })

  const panel = page.getByRole('region', { name: /Anexos/i })
  await panel.getByRole('button', { name: 'Enviar anexo' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Enviar anexo' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const title = `DM2-U3 expired ${Date.now()}`
  await dialog.locator('input[type="file"]').setInputFiles(pdfFile('dm2-u3.pdf'))
  await dialog.locator('input[name="title"]').fill(title)

  // Fail the first PUT to reach the retryable "Tentar novamente" state with a live
  // (but not yet consumed) reservation, exactly as DM2-U2 does.
  let putAttempts = 0
  await page.route('**/storage/v1/object/upload/sign/**', async (route) => {
    putAttempts++
    if (putAttempts === 1) await route.abort('failed')
    else await route.continue()
  })
  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click()
  const retryBtn = dialog.getByRole('button', { name: 'Tentar novamente', exact: true })
  await expect(retryBtn).toBeVisible({ timeout: 15_000 })

  // Backdate the live reservation's expiry (service role) — a real 15-minute wait is
  // impractical for E2E; this exercises the SAME `expires_at < now()` branch in
  // `finalize_document_upload` a genuine timeout would.
  const docs = await svcGet<{ id: string }>(request, `documents?title=eq.${encodeURIComponent(title)}&select=id`)
  const versions = await svcGet<{ id: string }>(
    request,
    `document_versions?document_id=eq.${docs[0].id}&select=id`,
  )
  const sessions = await svcGet<{ id: string; expires_at: string }>(
    request,
    `upload_sessions?document_version_id=eq.${versions[0].id}&select=id,expires_at`,
  )
  expect(sessions.length).toBe(1)
  await svcPatch(request, `upload_sessions?id=eq.${sessions[0].id}`, {
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  })

  // Retry again — this PUT reaches Storage for real (no route interception this
  // time), but `finalize_document_upload` now refuses on the backdated expiry.
  await retryBtn.click()
  await expect(
    dialog
      .getByRole('status')
      .filter({ hasText: 'O tempo para enviar o arquivo expirou. Feche e comece o envio novamente.' }),
  ).toBeVisible({ timeout: 15_000 })

  // The session was dropped (`fail('upload_expired')` clears it) — the button
  // reverts from "Tentar novamente" to plain "Enviar", proving the dialog forgot
  // the dead reservation rather than offering to retry into it again.
  await expect(dialog.getByRole('button', { name: 'Enviar', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tentar novamente', exact: true })).toHaveCount(0)

  // DB truth: no binding was ever made — the functional refusal holds regardless
  // of the `state` column's own value (see DM2-BUG-3 below for that column).
  expect(
    (await svcGet(request, `document_version_files?document_version_id=eq.${versions[0].id}&select=id`)).length,
  ).toBe(0)
})

// ===========================================================================
// DM2-BUG-3 (test.fail — filed) — the expiry branch's own UPDATE is rolled
// back by its own RAISE EXCEPTION in the same statement
// ===========================================================================

test('DM2-BUG-3 [KNOWN BUG, filed]: upload_sessions.state should read "expired" after HC0DE — it stays "reserved" forever (the UPDATE is rolled back by the RAISE EXCEPTION in the same function call)', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  // Filed as a bug — confirmed BOTH by static reading of `finalize_document_upload`
  // (no BEGIN/EXCEPTION block, no dblink/autonomous-transaction call; a plpgsql
  // `RAISE EXCEPTION` with no handler aborts the ENTIRE calling transaction — a
  // single PostgREST RPC call is one implicit transaction, so the preceding
  // `UPDATE ... SET state = 'expired'` in the SAME branch is unconditionally
  // undone) AND empirically, live, in DM2-U3's own run before this test was split
  // out (the functional HC0DE refusal is correct and unaffected — only the
  // `state` COLUMN itself never reflects it). Consequence: any future code that
  // queries `upload_sessions.state = 'expired'` directly (a cleanup sweep, an
  // admin report of abandoned uploads) will find nothing, even though the
  // refusal-by-timestamp behavior keeps working via `expires_at < now()` alone.
  // `test.fail()` — see DM2-BUG-1's comment for the convention.
  test.fail()

  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const begunResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/begin_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_resource_type: 'meeting',
      p_resource_id: SEEDED_MEETING_ID,
      p_title: `DM2-BUG-3 ${Date.now()}`,
      p_declared_file_name: 'x.pdf',
      p_declared_mime: 'application/pdf',
      p_declared_size: 10,
    },
  })
  const begun = (await begunResp.json()) as { upload_session_id: string }

  await svcPatch(request, `upload_sessions?id=eq.${begun.upload_session_id}`, {
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  })

  const finalizeResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/finalize_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
    },
    data: { p_upload_session_id: begun.upload_session_id },
  })
  expect(finalizeResp.ok()).toBeFalsy()
  const finalizeBody = (await finalizeResp.json()) as { code?: string }
  expect(finalizeBody.code).toBe('HC0DE') // the refusal itself is correct

  const sessionAfter = await svcGet<{ state: string }>(
    request,
    `upload_sessions?id=eq.${begun.upload_session_id}&select=state`,
  )
  // The DOCUMENTED contract (the CHECK-enumerated state vocabulary, and 329 U12):
  // this should read 'expired'. It reads 'reserved' instead — see the bug.
  expect(sessionAfter[0].state).toBe('expired')
})

// ===========================================================================
// DM2-U4 — meeting (standard tier); the D11 floor audit conditional
// ===========================================================================

test('DM2-U4: meeting attachment (standard tier) uploads/downloads; same-creator standard-tier opens are NOT audited, a non-creator open IS (D11 floor)', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const title = `DM2-U4 standard ${Date.now()}`
  const fixture = await createDocumentFixture(request, chefeToken, {
    resourceType: 'meeting',
    resourceId: SEEDED_MEETING_ID,
    title,
  })

  const files = await svcGet<{ sensitivity_tier: string }>(
    request,
    `document_version_files?document_version_id=eq.${fixture.documentVersionId}&select=file_object_id`,
  )
  expect(files.length).toBe(1)
  const fileRow = await svcGet<{ sensitivity_tier: string }>(
    request,
    `file_objects?id=eq.${(files[0] as unknown as { file_object_id: string }).file_object_id}&select=sensitivity_tier`,
  )
  expect(fileRow[0].sensitivity_tier).toBe('standard')

  // The CREATOR opens her own standard-tier document — the D11 floor says this is
  // deliberately UNLOGGED (`sensitivity_tier = 'phi' OR opener <> created_by`, both false).
  const before = await auditRows(request, 'document.opened', fixture.documentId)
  const selfOpen = await openDocumentVersion(request, chefeToken, fixture.documentVersionId)
  expect(selfOpen.ok).toBeTruthy()
  expect((await auditRows(request, 'document.opened', fixture.documentId)).length).toBe(before.length)

  // A DIFFERENT commission member opens the SAME document — same tier, but now
  // `opener <> created_by` is true, so this open IS logged.
  const staff1Token = await getOwnerToken(page, 'staff1.ccih@test.local')
  const otherOpen = await openDocumentVersion(request, staff1Token, fixture.documentVersionId)
  expect(otherOpen.ok).toBeTruthy()
  const afterOther = await auditRows(request, 'document.opened', fixture.documentId)
  expect(afterOther.length).toBe(before.length + 1)
  expect(afterOther[afterOther.length - 1].actor_id).toBe(STAFF1_CCIH_ID)

  // UI non-regression: the row renders with a working download control.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(MEETING_URL)
  await page.waitForURL(`**/meetings/${SEEDED_MEETING_ID}`, { timeout: 15_000 })
  const panel = page.getByRole('region', { name: /Anexos/i })
  const row = panel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row.getByRole('button', { name: titleRe('Baixar', title) })).toBeVisible()
})

// ===========================================================================
// DM2-INTERVIEW — file (Documents/"Anexos") vs external link ("Gravações e links")
// ===========================================================================

test('DM2-INTERVIEW: interview file uploads through "Anexos" (the document model); the external link stays in the sibling "Gravações e links" section', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(INTERVIEW_URL)
  await page.waitForURL(`**/interviews/${SEEDED_INTERVIEW_ID}`, { timeout: 15_000 })

  // Two INDEPENDENT regions, not one merged "Anexos e gravações" (F2's old shape).
  const filesPanel = page.getByRole('region', { name: 'Anexos', exact: true })
  const linksPanel = page.getByRole('region', { name: /Gravações e links/i })
  await expect(filesPanel).toBeVisible({ timeout: 10_000 })
  await expect(linksPanel).toBeVisible({ timeout: 10_000 })

  // The seeded interview's LINK survives DM1 untouched (`case_interview_links` is a
  // separate substrate) — non-vacuous. Its FILE evidence does NOT: DM1 dropped the
  // old `attachments` fixture and DM2's `documents` table seeds zero rows (verified
  // directly against the fresh-reset catalog before writing this test), so the
  // files panel legitimately starts EMPTY — asserted via its own empty-state copy,
  // not assumed non-vacuous.
  await expect(linksPanel.locator('li').first()).toBeVisible()
  await expect(
    filesPanel.getByText('Nenhum anexo. Envie a transcrição assinada ou outra evidência.'),
  ).toBeVisible()
  // No cross-contamination: the link row's external anchor never appears inside
  // the files panel, and vice versa (two substrates, two lifecycles).
  await expect(filesPanel.getByRole('link')).toHaveCount(0)

  // Upload a NEW file — real bytes, through the real dialog.
  await filesPanel.getByRole('button', { name: 'Enviar anexo' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Enviar anexo' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  const title = `DM2-INTERVIEW evidência ${Date.now()}`
  await dialog.locator('input[type="file"]').setInputFiles(pdfFile('dm2-interview.pdf'))
  await dialog.locator('input[name="title"]').fill(title)
  await dialog.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 30_000 })

  const newRow = filesPanel.locator('li').filter({ hasText: title })
  await expect(newRow).toBeVisible({ timeout: 15_000 })
  const openBtn = newRow.getByRole('button', { name: titleRe('Baixar', title) })
  await expect(openBtn).toBeVisible()
  const url = await clickAndCapturePopup(page, openBtn)
  expect(url).toMatch(/\/storage\/v1\/object\/sign\//)
  const dl = await page.request.get(url)
  expect(dl.ok()).toBeTruthy()

  // Link row still has an anchor, not a "Baixar" audited button — unaudited,
  // no platform-held bytes.
  const linkRow = linksPanel.locator('li').first()
  await expect(linkRow.getByRole('link')).toBeVisible()
  await expect(linkRow.getByRole('button', { name: /^Baixar/i })).toHaveCount(0)
})

// ===========================================================================
// DM2-FLAGOFF — documents_wave_a OFF: affordances ABSENT, never merely disabled
// ===========================================================================

test('DM2-FLAGOFF: flag OFF removes upload/delete/open entirely; an existing available row still lists, read-only', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const title = `DM2-FLAGOFF existing ${Date.now()}`
  await createDocumentFixture(request, chefeToken, {
    resourceType: 'case',
    resourceId: SEEDED_CASE_ID,
    title,
  })

  setDocumentsWaveAFlag(false)
  try {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(CASE_URL)
    await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

    const docPanel = page.getByRole('region', { name: /Documentos/i })
    await expect(docPanel).toBeVisible({ timeout: 10_000 })

    // Upload trigger ABSENT (not disabled).
    await expect(docPanel.getByRole('button', { name: 'Anexar documento' })).toHaveCount(0)

    // The pre-existing row still renders (list reads are never gated) — read-only.
    const row = docPanel.locator('li').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByRole('button', { name: /Remover/i })).toHaveCount(0)

    // The audited open control is ABSENT — a deliberate change from the old F2
    // "disabled" pattern (post-DM1 no rows exist while the flag is off, so a
    // disabled control would have nothing to attach to).
    await expect(row.getByRole('button', { name: titleRe('Baixar', title) })).toHaveCount(0)

    // Same gating on the meeting panel — upload trigger absent there too.
    await page.goto(MEETING_URL)
    await page.waitForURL(`**/meetings/${SEEDED_MEETING_ID}`, { timeout: 15_000 })
    const meetingPanel = page.getByRole('region', { name: /Anexos/i })
    await expect(meetingPanel).toBeVisible({ timeout: 10_000 })
    await expect(meetingPanel.getByRole('button', { name: 'Enviar anexo' })).toHaveCount(0)

    // `documents_wave_a` is a UI-ONLY gate — confirmed by reading
    // `app.assert_documents_enabled()` directly from the catalog: the RPC-level
    // backstop checks `documents_foundation` (a SEPARATE flag, independent of
    // `documents_wave_a`, and left ON here). So this door does NOT raise HC0D7
    // while only `documents_wave_a` is off — a direct API caller can still write
    // documents while the Wave-A UI is fully dark. Asserted explicitly rather
    // than assumed: the two flags gate two different things (backend readiness
    // vs. UI rollout), and a static read of the S3 doc comments alone would not
    // have caught the RPC succeeding here.
    const rpcResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/begin_document_upload`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${chefeToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        p_resource_type: 'case',
        p_resource_id: SEEDED_CASE_ID,
        p_title: 'DM2-FLAGOFF rpc-still-open probe',
        p_declared_file_name: 'x.pdf',
        p_declared_mime: 'application/pdf',
        p_declared_size: 10,
      },
    })
    expect(rpcResp.ok()).toBeTruthy()
  } finally {
    // Always restore — the rest of the suite (and the full-regression run) assumes ON.
    setDocumentsWaveAFlag(true)
  }
})

// ===========================================================================
// DM2-KEYBOARD — keyboard-only: tab to the audited download button, Enter opens it
// ===========================================================================

test('DM2-KEYBOARD: keyboard-only — focus the audited download button and activate with Enter', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const title = `DM2-KEYBOARD doc ${Date.now()}`
  const fixture = await createDocumentFixture(request, chefeToken, {
    resourceType: 'case',
    resourceId: SEEDED_CASE_ID,
    title,
  })

  const before = await auditRows(request, 'document.opened', fixture.documentId)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  const docPanel = page.getByRole('region', { name: /Documentos/i })
  const row = docPanel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10_000 })

  const reached = await tabUntil(
    page,
    (i) => i.tag === 'BUTTON' && (i.ariaLabel ?? '').toLowerCase() === `baixar ${title}`.toLowerCase(),
    120,
  )
  expect(reached).toBe(true)

  const downloadPromise = page.context().waitForEvent('download', { timeout: 8_000 }).catch(() => null)
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')])
  const download = await downloadPromise
  const url = download ? download.url() : popup.url()
  await popup.close().catch(() => {})
  expect(url).toMatch(/\/storage\/v1\/object\/sign\//)

  const after = await auditRows(request, 'document.opened', fixture.documentId)
  expect(after.length).toBe(before.length + 1)
})

// ===========================================================================
// DM2-STATES — pending / disposed render distinctly; disposed stays LISTED
// ===========================================================================

test('DM2-STATES: a not-yet-verified upload reads "pending" (with no download control); a disposed document stays listed with a redacted title and no controls', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')

  // --- pending: begin_document_upload only, no PUT/finalize — the version row
  // exists but has no document_version_files binding yet. ---
  const pendingTitle = `DM2-STATES pending ${Date.now()}`
  const begunResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/begin_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_resource_type: 'case',
      p_resource_id: SEEDED_CASE_ID,
      p_title: pendingTitle,
      p_declared_file_name: 'pending.pdf',
      p_declared_mime: 'application/pdf',
      p_declared_size: 10,
    },
  })
  expect(begunResp.ok()).toBeTruthy()

  // --- disposed: a full, real upload, then request+complete disposition. ---
  const disposedTitle = `DM2-STATES disposed ${Date.now()}`
  const fixture = await createDocumentFixture(request, chefeToken, {
    resourceType: 'case',
    resourceId: SEEDED_CASE_ID,
    title: disposedTitle,
  })
  // `reason: 'other'` hits the default PROVISIONAL retention policy's block
  // (HC0DR — confirmed by running before this fix) unless the reason is one of
  // the two EVIDENCE-GATED exemption lanes (`complete_document_disposal`, read
  // from the catalog): `subject_request` is unconditionally exempt.
  const disposeReqResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/request_document_disposition`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
    },
    data: { p_document_id: fixture.documentId, p_reason: 'subject_request' },
  })
  expect(disposeReqResp.ok(), await disposeReqResp.text()).toBeTruthy()

  const fileRows = await svcGet<{ storage_bucket: string; storage_path: string }>(
    request,
    `file_objects?id=eq.${fixture.fileObjectId}&select=storage_bucket,storage_path`,
  )
  const { storage_bucket, storage_path } = fileRows[0]
  const rmResp = await request.delete(
    `${SUPABASE_URL}/storage/v1/object/${storage_bucket}/${encodeURI(storage_path)}`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  )
  expect(rmResp.ok()).toBeTruthy()
  const completeResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/complete_document_disposal`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { p_file_object_id: fixture.fileObjectId },
  })
  expect(completeResp.ok(), await completeResp.text()).toBeTruthy()

  const disposedRow = await svcGet<{ title: string; status: string }>(
    request,
    `documents?id=eq.${fixture.documentId}&select=title,status`,
  )
  expect(disposedRow[0].status).toBe('disposed')
  expect(disposedRow[0].title).toBe('[removido]')

  // --- UI: both render, distinctly, and are not confusable with each other or
  // with an ordinary available row. ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })
  const docPanel = page.getByRole('region', { name: /Documentos/i })

  const pendingRow = docPanel.locator('li').filter({ hasText: pendingTitle })
  await expect(pendingRow).toBeVisible({ timeout: 15_000 })
  await expect(pendingRow.getByText('Processando envio')).toBeVisible()
  // 'pending' shows a DISABLED (not absent) placeholder control — a promise, not a
  // dead end, distinct from every other non-servable state. The accessible name is
  // identical to the real download button's (`Baixar {title}`); `disabled` is what
  // distinguishes it, so assert that directly rather than a (wrong) absence check —
  // a disabled <button> still carries role="button" in the a11y tree.
  const pendingBtn = pendingRow.getByRole('button', { name: titleRe('Baixar', pendingTitle) })
  await expect(pendingBtn).toBeVisible()
  await expect(pendingBtn).toBeDisabled()

  // The disposed row is listed by REDACTED title, not the original — and offers
  // no controls whatsoever. `complete_document_disposal` redacts EVERY disposed
  // document to the same literal '[removido]' (by design — redaction destroys
  // the distinguishing information), so this locator is only unambiguous when
  // this test is the sole disposer of a document on this case since the last
  // reset (true for a real gate run; NOT true if re-run repeatedly against an
  // unreset dev DB, which surfaces as a strict-mode violation, not a defect).
  const disposedRowLocator = docPanel.locator('li').filter({ hasText: '[removido]' })
  await expect(disposedRowLocator).toBeVisible({ timeout: 15_000 })
  await expect(docPanel.getByText(disposedTitle)).toHaveCount(0) // the ORIGINAL title never leaks
  // `{ exact: true }`: a plain-string getByText is a case-insensitive SUBSTRING
  // match by default, and the row's own detail sentence ("O arquivo foi
  // eliminado definitivamente…") also contains "eliminado" — confirmed by a
  // strict-mode-violation run before this fix (2 elements resolved).
  await expect(disposedRowLocator.getByText('Eliminado', { exact: true })).toBeVisible()
  await expect(disposedRowLocator.getByRole('button')).toHaveCount(0) // no download, no delete

  // Not confusable: distinct label text, distinct icon/tone class, distinct detail
  // copy — "my upload broke" vs "this was destroyed on purpose, forever" (design intent).
  expect(await pendingRow.getByText('Processando envio').textContent()).not.toBe(
    await disposedRowLocator.getByText('Eliminado', { exact: true }).textContent(),
  )
})

// ===========================================================================
// DM2-BUG-1 (test.fail — filed) — a verification FAILURE never binds
// document_version_files, so the row reads 'pending' forever, not 'failed'
// ===========================================================================

test('DM2-BUG-1 [KNOWN BUG, filed]: a verification failure should read "Falha no envio" — it actually reads "Processando envio" forever (document_version_files is never bound on the failure path)', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  // Filed as a bug in PROGRESS.md — confirmed via a direct RPC probe against the
  // live catalog before writing this test (begin → real PUT → finalize →
  // complete_document_upload_verification(verified:=false) leaves
  // document_version_files EMPTY for the version, so `versionAvailability` falls
  // through to 'pending', never inspecting `file.upload_state = 'failed'` at all).
  // `test.fail()` marks this an EXPECTED failure: the suite reports it as passing
  // precisely because the assertion below fails as documented, and Playwright
  // flips it to a hard failure the moment the bug is fixed and the row starts
  // reading "Falha no envio" — so it cannot go stale silently.
  test.fail()

  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const title = `DM2-BUG-1 verify-fail ${Date.now()}`
  const bytes = Buffer.from(`%PDF-1.4 dm2-bug-1 ${Date.now()}\n%%EOF\n`)

  const begunResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/begin_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_resource_type: 'case',
      p_resource_id: SEEDED_CASE_ID,
      p_title: title,
      p_declared_file_name: 'verify-fail.pdf',
      p_declared_mime: 'application/pdf',
      p_declared_size: bytes.length,
    },
  })
  const begun = (await begunResp.json()) as Record<string, string>

  const foResp = await request.get(
    `${SUPABASE_URL}/rest/v1/file_objects?id=eq.${begun.file_object_id}&select=storage_bucket,storage_path`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  )
  const [{ storage_bucket, storage_path }] = (await foResp.json()) as Array<{
    storage_bucket: string
    storage_path: string
  }>
  await request.post(`${SUPABASE_URL}/storage/v1/object/${storage_bucket}/${encodeURI(storage_path)}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'false',
    },
    data: bytes,
  })
  await request.post(`${SUPABASE_URL}/rest/v1/rpc/finalize_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
    },
    data: { p_upload_session_id: begun.upload_session_id },
  })
  // Deliberately verified:false — the narrow "service re-download after a
  // successful PUT failed" branch `complete_document_upload_verification` models.
  await request.post(`${SUPABASE_URL}/rest/v1/rpc/complete_document_upload_verification`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { p_upload_session_id: begun.upload_session_id, p_sha256: '', p_verified: false },
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })
  const docPanel = page.getByRole('region', { name: /Documentos/i })
  const row = docPanel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })

  // The DOCUMENTED contract (AVAILABILITY_PRESENTATION.failed): this should read
  // "Falha no envio". It currently reads "Processando envio" instead — see the bug.
  await expect(row.getByText('Falha no envio')).toBeVisible({ timeout: 5_000 })
})

// ===========================================================================
// DM2-BUG-2 (test.fail — filed) — the D15 ceiling denies via ROW-level RLS
// absence, so `canOpen` can never be false on a rendered row (dead code)
// ===========================================================================

test('DM2-BUG-2 [KNOWN BUG, filed]: an uncleared reader should see a "Restrito" badge on a legal_privileged document — the row is actually absent entirely (canOpen can never be false on a rendered row)', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  // Filed as a bug (severity: low/documentation — the SECURITY property holds,
  // arguably more strongly, via row absence than a badge would provide).
  // Confirmed via a direct RPC + PostgREST probe before writing this test:
  // `app.can_read_document` embeds the D15 ceiling as a ROW-level AND-conjunct
  // (read from `pg_proc`), and `documents_select`/`document_versions_select` both
  // use exactly that predicate — an uncleared reader gets ZERO rows for an
  // enforcing-labeled document, not a visible row with `canOpen: false`. Since
  // `DocumentVersionSummary.canOpen` is defined purely as
  // `availability === 'available'` (`queries/documents.ts`), with no separate
  // door call, the "available && !canOpen" branch that renders
  // `DocumentRestrictedBadge` ("Restrito") in `document-row.tsx` is unreachable
  // through any caller today. `document-row.tsx`'s own doc comment claims this
  // is what makes the D15 ceiling "observable from the keyboard" (cited by AC-9)
  // — it does not, because there is nothing rendered to observe.
  test.fail()

  // Uses the plain seeded CCIH case, which has NO case_access_grants row for
  // anyone — confirmed live: even the document's own creator/coordinator
  // (chefe.ccih) cannot read it back afterward (the S1 fail-closed backstop:
  // "an enforcing label with no clearance plane is readable by NO ONE").
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const title = `DM2-BUG-2 privileged ${Date.now()}`
  const begunResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/begin_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefeToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_resource_type: 'case',
      p_resource_id: SEEDED_CASE_ID,
      p_title: title,
      p_confidentiality_level: 'legal_privileged',
      p_declared_file_name: 'privileged.pdf',
      p_declared_mime: 'application/pdf',
      p_declared_size: 10,
    },
  })
  expect(begunResp.ok()).toBeTruthy()

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(CASE_URL)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })
  const docPanel = page.getByRole('region', { name: /Documentos/i })

  // The DOCUMENTED contract: a Restrito badge, no download control. It currently
  // renders NOTHING for this title at all — see the bug.
  const row = docPanel.locator('li').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('Restrito')).toBeVisible()
})
