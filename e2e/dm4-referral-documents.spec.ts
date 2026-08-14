import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { createHash } from 'node:crypto'

import { cachedSignIn, accessToken } from './helpers/auth'
import { sql, focusByTabbing } from './helpers/documents'
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  beginUpload,
  putBytesServiceRole,
  finalizeUpload,
  verifyUploadServiceRole,
  createDocumentFixture,
  svcGet,
  auditRows,
  clickAndCapturePopup,
  type BeginUploadResult,
} from './helpers/document-model'

/**
 * DM4 — Wave C: referral documents on the core document model (ADR 0114 Wave C /
 * ADR 0119, `docs/plans/dm4-referrals-plan.md`).
 *
 * ## Why this file exists
 *
 * Gate step 1 proved DM4 at the DB layer (pgTAP), at static gates (tsc/lint/build),
 * and by ABSENCE (no render-time signed-URL anchor in the DOM). None of that is a
 * runtime proof that a byte has ever crossed the corridor. This file is that proof —
 * the DM3 lesson applied to a second corridor:
 *
 *   begin (reserve) → PUT (real client bytes) → finalize (server DERIVES facts from
 *   what actually landed) → the audited click-time door signs it back → the bytes
 *   that come out are compared, byte-for-byte, to the bytes that went in.
 *
 * ## Fixture economy
 *
 * Every test below builds its OWN referral + document fixtures via the real RPCs
 * under a real persona JWT (never a raw table write for anything RLS/RPC-gated), so
 * no test depends on another's leftover state or on execution order. The ONE
 * exception is deliberate: DM4-RT-1 is the single test that drives the upload
 * through the REAL BROWSER (file input → client PUT) — every other test uses the
 * API-level begin/PUT/finalize helpers for speed, exactly as DM3B-2 onward did once
 * DM3B-1 had proven the browser corridor once.
 *
 * ## Two write doors, no authz-arm coverage
 *
 * `add_referral_shared_item` and `begin_document_upload`'s `case_referral` arm are
 * BOTH in the unruled census blind class (ADR 0119 §Consequences) — no §6 arm can
 * see either door. This file is not a substitute for the bespoke pgTAP keystones
 * (backend's job); it is the runtime proof the plan says nothing before it supplied.
 *
 * Local Supabase stack, seeded personas (password `Test1234!`). `case_referrals` and
 * `documents_wave_c` are forced ON by `seed.sql` for local/E2E, but — per the
 * `technical-direction-referrals.spec.ts` scar (a same-batch spec left
 * `case_referrals` OFF and silently zeroed four tests) — this file asserts and
 * restores both flags itself rather than trusting the seed default to survive batch
 * order.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (seeded, stable across resets — cross-checked against the live
// catalog 2026-08-14, matching phase22-referrals.spec.ts /
// technical-direction-referrals.spec.ts).
// ---------------------------------------------------------------------------

const ORG = 'rede-a'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH — source
const COMM_B = 'b0000000-0000-0000-0000-0000000000b1' // Farmácia — target
const HOSPITAL_CENTRAL_A = '05000000-0000-0000-0000-00000000000a'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002' // chefe.ccih

// pt-BR wording this file pins verbatim (mirrors
// `src/components/referrals/referral-document-labels.ts` — NOT imported, so an
// E2E spec never pulls app source into the test bundle; a drift here is a real
// UI regression, not a stale mirror, because both strings are asserted against
// the RENDERED page).
const NO_ACCESS_BADGE = 'Sem permissão para abrir'
const SNAPSHOT_NO_ACCESS_DETAIL =
  'Você pode ver que este documento foi compartilhado, mas não tem autorização para abrir arquivos com dados de paciente deste encaminhamento.'
const ATTACHMENT_NO_ACCESS_DETAIL =
  'Você pode ver que este anexo existe, mas não tem autorização para abrir arquivos com dados de paciente deste encaminhamento.'

// ---------------------------------------------------------------------------
// Flag lifecycle — asserted and restored, never assumed.
// ---------------------------------------------------------------------------

function readFlag(key: string): boolean {
  return sql(`select enabled from app.feature_flags where key = '${key}';`) === 't'
}

function setFlag(key: string, enabled: boolean): void {
  sql(`update app.feature_flags set enabled = ${enabled} where key = '${key}';`)
  expect(readFlag(key), `${key} flag did not take the requested value`).toBe(enabled)
}

let referralsFlagBefore: boolean
let waveCFlagBefore: boolean

test.beforeAll(() => {
  referralsFlagBefore = readFlag('case_referrals')
  waveCFlagBefore = readFlag('documents_wave_c')
  setFlag('case_referrals', true)
  setFlag('documents_wave_c', true)
})

test.afterAll(() => {
  setFlag('case_referrals', referralsFlagBefore)
  setFlag('documents_wave_c', waveCFlagBefore)
})

// ---------------------------------------------------------------------------
// RPC / REST plumbing (mirrors phase22-referrals.spec.ts's own local helpers).
// ---------------------------------------------------------------------------

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

/** A distinctive, per-test PDF payload — unique bytes so a mix-up between two
 *  fixtures cannot pass as a match. */
function uniquePdf(marker: string): { name: string; mimeType: string; buffer: Buffer } {
  const body =
    `%PDF-1.4\n% DM4 Wave C round-trip marker: ${marker}\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n` +
    `trailer<</Root 1 0 R>>\n%%EOF\n`
  return { name: `dm4-${marker}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(body, 'utf8') }
}

const sha256Hex = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Create a disposable pending case (direct service-role insert — the same
 * shortcut phase22-referrals.spec.ts uses for its own throwaway fixtures). */
async function createCase(
  request: APIRequestContext,
  commissionId: string,
  label: string,
  createdBy: string,
): Promise<string> {
  const resp = await request.post(`${SUPABASE_URL}/rest/v1/cases`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: { commission_id: commissionId, label, status: 'pending', created_by: createdBy },
  })
  expect(resp.ok(), `create case "${label}": ${await resp.text()}`).toBeTruthy()
  const [row] = (await resp.json()) as Array<{ id: string }>
  return row.id
}

async function firstActiveReferralTypeId(request: APIRequestContext): Promise<string> {
  const rows = await svcGet<{ id: string }>(
    request,
    `referral_types?is_active=eq.true&select=id&order=position.asc&limit=1`,
  )
  expect(rows.length, 'at least one active referral type is seeded').toBeGreaterThan(0)
  return rows[0].id
}

async function firstReplyOutcomeId(request: APIRequestContext): Promise<string> {
  const rows = await svcGet<{ id: string }>(request, `reply_outcomes?select=id&limit=1`)
  expect(rows.length, 'at least one reply outcome is seeded').toBeGreaterThan(0)
  return rows[0].id
}

/** `create_referral_draft` under the SOURCE coordinator's own JWT. Always
 * passes a non-empty description so `send_referral`'s "empty referral" gate
 * (HC077-class) never blocks a test that has nothing else to share. */
async function createReferralDraft(
  request: APIRequestContext,
  sourceToken: string,
  opts: {
    sourceCaseId: string
    subject: string
    targetCommissionId?: string
    targetHospitalId?: string
  },
): Promise<string> {
  const typeId = await firstActiveReferralTypeId(request)
  const resp = await rpc(request, 'create_referral_draft', sourceToken, {
    p_source_case_id: opts.sourceCaseId,
    p_target_commission_id: opts.targetCommissionId ?? null,
    p_target_hospital_id: opts.targetHospitalId ?? null,
    p_referral_type_id: typeId,
    p_subject: opts.subject,
    p_response_expected: true,
    p_description_md: `Descrição sintética — ${opts.subject}.`,
  })
  expect(resp.ok(), `create_referral_draft(${opts.subject}): ${await resp.text()}`).toBeTruthy()
  const data = (await resp.json()) as { id: string }
  return data.id
}

async function sendReferralDraft(
  request: APIRequestContext,
  sourceToken: string,
  referralId: string,
): Promise<void> {
  const resp = await rpc(request, 'send_referral', sourceToken, { p_referral_id: referralId })
  expect(resp.ok(), `send_referral: ${await resp.text()}`).toBeTruthy()
}

/** Freeze a CASE document into a DRAFT referral (`add_referral_shared_item`'s
 * `document` arm — the write seam DM4 un-parked, ADR 0119 D3). */
async function freezeDocument(
  request: APIRequestContext,
  sourceToken: string,
  referralId: string,
  documentId: string,
): Promise<void> {
  const resp = await rpc(request, 'add_referral_shared_item', sourceToken, {
    p_referral_id: referralId,
    p_kind: 'document',
    p_source_document_id: documentId,
  })
  expect(resp.ok(), `add_referral_shared_item(document): ${await resp.text()}`).toBeTruthy()
}

/** Advance a SENT referral through `received → accepted → in_review` under the
 * TARGET's JWT (commission coordinator OR the DT office — both share the same
 * RPC surface). */
async function advanceToInReview(
  request: APIRequestContext,
  targetToken: string,
  referralId: string,
): Promise<void> {
  const r1 = await rpc(request, 'receive_referral', targetToken, { p_referral_id: referralId })
  expect(r1.ok(), `receive_referral: ${await r1.text()}`).toBeTruthy()
  const r2 = await rpc(request, 'accept_referral', targetToken, { p_referral_id: referralId })
  expect(r2.ok(), `accept_referral: ${await r2.text()}`).toBeTruthy()
  const r3 = await rpc(request, 'start_referral_review', targetToken, { p_referral_id: referralId })
  expect(r3.ok(), `start_referral_review: ${await r3.text()}`).toBeTruthy()
}

/** `conclude_referral` — delivers + freezes the reply. */
async function conclude(
  request: APIRequestContext,
  targetToken: string,
  referralId: string,
  resultMd: string,
): Promise<void> {
  const outcomeId = await firstReplyOutcomeId(request)
  const resp = await rpc(request, 'conclude_referral', targetToken, {
    p_referral_id: referralId,
    p_reply_outcome_id: outcomeId,
    p_result_md: resultMd,
    p_acknowledged_only: false,
  })
  expect(resp.ok(), `conclude_referral: ${await resp.text()}`).toBeTruthy()
}

/** Fetch the bytes behind a signed download URL. */
async function fetchBytes(page: Page, url: string): Promise<Buffer> {
  const resp = await page.request.get(url)
  expect(resp.status(), `signed download URL served (${url.split('?')[0]})`).toBe(200)
  return await resp.body()
}

// ===========================================================================
// DM4-RT-1 ⭐ THE BYTE ROUND TRIP — the highest-value artifact of this phase.
//
// A reply attachment through the REAL corridor: begin (client action) → PUT
// (real browser bytes) → finalize (server verifies + derives) → click-time
// audited door → byte-for-byte comparison.
// ===========================================================================

test('DM4-RT-1: a reply attachment makes the full round trip through the real browser corridor — begin → PUT → finalize → click-time door returns byte-identical content', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const marker = `rt-${Date.now()}`
  const payload = uniquePdf(marker)
  const attachmentTitle = `Anexo Round Trip ${marker}`

  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso RT ${marker}`, UID_CHEFE_A)
  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs RT ${marker}`,
    targetCommissionId: COMM_B,
  })
  await sendReferralDraft(request, chefeAToken, referralId)
  await advanceToInReview(request, chefeBToken, referralId)

  // --- The upload: a real File through the browser, PUT by the CLIENT. -----
  await cachedSignIn(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/farmacia/encaminhamentos/${referralId}`)

  await page.getByRole('button', { name: 'Responder e concluir' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 20_000 })

  await dialog.getByLabel('Arquivo do anexo').setInputFiles(payload)
  await dialog.getByLabel('Título do anexo').fill(attachmentTitle)
  await dialog.getByRole('button', { name: /anexar arquivo/i }).click()

  const attachedRow = dialog.locator('li').filter({ hasText: attachmentTitle })
  await expect(attachedRow, 'the attachment finished the begin→PUT→finalize round trip').toBeVisible({
    timeout: 30_000,
  })

  // Fill the required reply fields and conclude — moving the referral to
  // `answered` so the reply (and its attachment) becomes visible on BOTH sides.
  // ⚠ NativeSelect folds every <option>'s text into the wrapping <label>'s
  // accessible name — `exact: true` can never match; use an anchored non-exact
  // matcher (the documented DM4 locator hazard).
  await dialog.getByLabel(/^Desfecho da análise/).selectOption({ index: 1 })
  await dialog.getByLabel('Resultado').fill('Resultado sintético — round trip DM4.')
  await dialog.getByRole('button', { name: /enviar resposta e concluir/i }).click()

  await expect
    .poll(() => sql(`select status from public.case_referral where id = '${referralId}';`).trim(), {
      timeout: 20_000,
      message: 'conclude_referral moved the referral to answered',
    })
    .toBe('answered')

  // --- DB truth: the bytes physically landed and finalize DERIVED the facts. -
  const [doc] = await svcGet<{ id: string }>(request, `documents?home_resource_id=eq.${referralId}&select=id`)
  expect(doc, 'the reply attachment minted a referral-homed document').toBeTruthy()
  const [ver] = await svcGet<{ id: string }>(
    request,
    `document_versions?document_id=eq.${doc.id}&select=id&order=version_number.desc&limit=1`,
  )
  const [vf] = await svcGet<{ file_object_id: string }>(
    request,
    `document_version_files?document_version_id=eq.${ver.id}&rendition_kind=eq.source&select=file_object_id`,
  )
  const [fo] = await svcGet<{
    size_bytes: number
    mime_type: string | null
    sha256: string | null
    upload_state: string
    sensitivity_tier: string
    storage_bucket: string
  }>(
    request,
    `file_objects?id=eq.${vf.file_object_id}&select=size_bytes,mime_type,sha256,upload_state,sensitivity_tier,storage_bucket`,
  )
  expect(fo.upload_state, 'the real PUT was verified').toBe('unscanned_accepted')
  expect(Number(fo.size_bytes), 'size derived from the object that actually landed').toBe(payload.buffer.length)
  expect(fo.mime_type, 'MIME derived from the stored object').toBe('application/pdf')
  expect(fo.sha256, 'sha256 computed over the bytes that landed').toBe(sha256Hex(payload.buffer))
  expect(fo.sensitivity_tier, 'referral reply attachments are PHI tier (Rule 12)').toBe('phi')
  expect(fo.storage_bucket, 'PHI tier lands in the PHI bucket').toBe('documents-phi')

  // --- The download: through the click-time audited door, then byte compare. -
  await page.reload()
  const openButton = page.getByRole('button', { name: `Baixar anexo da resposta ${attachmentTitle}` })
  await expect(openButton, 'the concluded reply offers the door-backed control').toBeVisible({ timeout: 20_000 })

  const signedUrl = await clickAndCapturePopup(page, openButton)
  expect(signedUrl, 'the door signed a URL').toMatch(/\/storage\/v1\/object\/sign\//)
  expect(signedUrl, 'signed, not a raw coordinate').toContain('token=')

  const returned = await fetchBytes(page, signedUrl)
  expect(returned.length, 'byte length out == byte length in').toBe(payload.buffer.length)
  expect(sha256Hex(returned), 'sha256 out == sha256 in').toBe(sha256Hex(payload.buffer))
  expect(Buffer.compare(returned, payload.buffer), 'byte-for-byte identical').toBe(0)
  expect(returned.toString('utf8'), 'carries this test\'s unique marker').toContain(marker)
})

// ===========================================================================
// DM4-RT-2 ⭐ DERIVATION — `finalize` derives size/MIME from what LANDED, never
// from the caller's declaration (ADR 0114 D9 / ADR 0119). Declares a LIE at
// `begin` and requires the TRUTH to win. DM4-RT-1 alone cannot show this — a
// real browser always declares its File's true size/type.
// ===========================================================================

test('DM4-RT-2: finalize derives size/MIME from the stored object on the referral corridor, discarding a false declaration at begin', async ({
  request,
}) => {
  const marker = `derive-${Date.now()}`
  const payload = uniquePdf(marker)

  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso derivação ${marker}`, UID_CHEFE_A)
  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs derivação ${marker}`,
    targetCommissionId: COMM_B,
  })
  await sendReferralDraft(request, chefeAToken, referralId)
  await advanceToInReview(request, chefeBToken, referralId)

  // Declare 1 byte / text/plain — both accepted at `begin` (within limits, on
  // the allow-list) and both FALSE.
  const begun = await beginUpload(request, chefeBToken, {
    resourceType: 'case_referral',
    resourceId: referralId,
    title: `Anexo Derivação ${marker}`,
    kind: 'anexo_resposta',
    declaredFileName: payload.name,
    declaredMime: 'text/plain',
    declaredSize: 1,
  })
  expect(begun.ok, `begin_document_upload accepted a case_referral home: ${JSON.stringify(begun.body)}`).toBeTruthy()
  const reservation = begun.body as BeginUploadResult

  // The full fixture (real bytes, real Content-Type) at the reserved
  // coordinate, then finalize + verify — mirroring `createDocumentFixture`'s
  // own sequence exactly, but driven inline so the DECLARED lie above is
  // visible in the same test.
  await putBytesServiceRole(request, reservation.file_object_id, payload.buffer, 'application/pdf')
  const finalized = await finalizeUpload(request, chefeBToken, reservation.upload_session_id)
  expect(finalized.ok, `finalize_document_upload: ${JSON.stringify(finalized.body)}`).toBeTruthy()

  const sha256 = sha256Hex(payload.buffer)
  const verified = await verifyUploadServiceRole(request, reservation.upload_session_id, sha256)
  expect(verified.ok, `complete_document_upload_verification: ${JSON.stringify(verified.body)}`).toBeTruthy()

  const [fo] = await svcGet<{ size_bytes: number; mime_type: string | null; sha256: string | null }>(
    request,
    `file_objects?id=eq.${reservation.file_object_id}&select=size_bytes,mime_type,sha256`,
  )
  expect(Number(fo.size_bytes), 'the declared 1 byte was discarded for the real length').toBe(payload.buffer.length)
  expect(Number(fo.size_bytes), 'the declaration did not win').not.toBe(1)
  expect(fo.mime_type, 'the declared text/plain was discarded for the stored Content-Type').toBe('application/pdf')
  expect(fo.sha256, 'sha256 computed over the real bytes').toBe(sha256)
})

// ===========================================================================
// DM4-TTL-1 ⭐ CLICK-TIME BYTE DOORS survive a delay longer than the 120 s PHI
// TTL — the regression F-14 exists to prevent. Both lanes (frozen snapshot +
// reply attachment) opened from ONE page load, after ONE real wait.
// ===========================================================================

test('DM4-TTL-1: both byte doors (shared snapshot + reply attachment) still open correctly after a delay that would have expired a render-time credential', async ({
  page,
  request,
}) => {
  test.setTimeout(220_000)
  const marker = `ttl-${Date.now()}`
  const docPayload = uniquePdf(`${marker}-doc`)
  const attachPayload = uniquePdf(`${marker}-attach`)
  const docTitle = `Documento TTL ${marker}`
  const attachTitle = `Anexo TTL ${marker}`

  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso TTL ${marker}`, UID_CHEFE_A)
  const docFixture = await createDocumentFixture(request, chefeAToken, {
    resourceType: 'case',
    resourceId: caseId,
    title: docTitle,
    bytes: docPayload.buffer,
    mime: 'application/pdf',
  })

  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs TTL ${marker}`,
    targetCommissionId: COMM_B,
  })
  await freezeDocument(request, chefeAToken, referralId, docFixture.documentId)
  await sendReferralDraft(request, chefeAToken, referralId)
  await advanceToInReview(request, chefeBToken, referralId)

  await createDocumentFixture(request, chefeBToken, {
    resourceType: 'case_referral',
    resourceId: referralId,
    title: attachTitle,
    kind: 'anexo_resposta',
    bytes: attachPayload.buffer,
    mime: 'application/pdf',
  })
  await conclude(request, chefeBToken, referralId, 'Resultado sintético — TTL DM4.')

  // The SOURCE coordinator reads both lanes unconditionally (can_read_referral_phi's
  // source arm carries no status restriction).
  await cachedSignIn(page, 'chefe.ccih@test.local')
  const loadedAt = Date.now()
  await page.goto(`/o/${ORG}/c/ccih/encaminhamentos/${referralId}`)
  await expect(page.getByRole('heading', { name: `DM4 referral docs TTL ${marker}` })).toBeVisible({
    timeout: 20_000,
  })

  const snapshotButton = page.getByRole('button', { name: `Baixar documento compartilhado ${docTitle}` })
  const attachmentButton = page.getByRole('button', { name: `Baixar anexo da resposta ${attachTitle}` })
  await expect(snapshotButton).toBeVisible({ timeout: 20_000 })
  await expect(attachmentButton).toBeVisible({ timeout: 20_000 })

  // A render-time credential is PHI-tier — 120 s (ADR 0114 O4). Wait past that
  // from page load, WITHOUT reloading, then click. A render-time signer would
  // already be dead; the click-time door signs fresh right now.
  const elapsed = Date.now() - loadedAt
  const remaining = 125_000 - elapsed
  if (remaining > 0) {
    await page.waitForTimeout(remaining)
  }

  const snapshotUrl = await clickAndCapturePopup(page, snapshotButton)
  const snapshotBytes = await fetchBytes(page, snapshotUrl)
  expect(
    Buffer.compare(snapshotBytes, docPayload.buffer),
    'the shared-document door signed FRESH at click time, past the 120s PHI TTL',
  ).toBe(0)

  const attachmentUrl = await clickAndCapturePopup(page, attachmentButton)
  const attachmentBytes = await fetchBytes(page, attachmentUrl)
  expect(
    Buffer.compare(attachmentBytes, attachPayload.buffer),
    'the reply-attachment door signed FRESH at click time, past the 120s PHI TTL',
  ).toBe(0)
})

// ===========================================================================
// DM4-META-1 — `canOpen: false` renders VISIBLE, EXPLAINED, NON-INTERACTIVE for
// a genuine metadata-tier reader — both lanes — and the audited door is NEVER
// called merely to compute the answer (a genuinely reachable state here, unlike
// Wave A: two DIFFERENT predicates, plan §3.2).
// ===========================================================================

test('DM4-META-1: a metadata-tier reader sees both files listed but not openable, explained in text and shape, and the byte doors are never called to find out', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const marker = `meta-${Date.now()}`
  const docTitle = `Documento Metadata ${marker}`
  const attachTitle = `Anexo Metadata ${marker}`

  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso metadata ${marker}`, UID_CHEFE_A)
  const docFixture = await createDocumentFixture(request, chefeAToken, {
    resourceType: 'case',
    resourceId: caseId,
    title: docTitle,
  })
  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs metadata ${marker}`,
    targetCommissionId: COMM_B,
  })
  await freezeDocument(request, chefeAToken, referralId, docFixture.documentId)
  await sendReferralDraft(request, chefeAToken, referralId)
  await advanceToInReview(request, chefeBToken, referralId)
  await createDocumentFixture(request, chefeBToken, {
    resourceType: 'case_referral',
    resourceId: referralId,
    title: attachTitle,
    kind: 'anexo_resposta',
  })
  await conclude(request, chefeBToken, referralId, 'Resultado sintético — metadata DM4.')

  // `staff1.farm` is a PLAIN staff of the TARGET commission — once sent, it
  // gets `can_read_referral_metadata` (member of target) but NOT
  // `can_read_referral_phi` (not staff_admin, not an assigned analyst). This
  // is the genuine metadata-tier reader the task calls for.
  let doorCalls = 0
  await page.route('**/rest/v1/rpc/open_referral_snapshot_document', async (route) => {
    doorCalls++
    await route.continue()
  })
  await page.route('**/rest/v1/rpc/open_document_version', async (route) => {
    doorCalls++
    await route.continue()
  })

  await cachedSignIn(page, 'staff1.farm@test.local')
  await page.goto(`/o/${ORG}/c/farmacia/encaminhamentos/${referralId}`)
  await expect(page.getByRole('heading', { name: `DM4 referral docs metadata ${marker}` })).toBeVisible({
    timeout: 20_000,
  })

  // ROW NEVER HIDDEN: both titles are visible to the metadata-tier reader.
  await expect(page.getByText(docTitle, { exact: true }), 'the shared-document row is never hidden').toBeVisible()
  await expect(
    page.getByText(attachTitle, { exact: true }),
    'the reply-attachment row is never hidden',
  ).toBeVisible()

  // NON-INTERACTIVE: no open button for either.
  await expect(page.getByRole('button', { name: `Baixar documento compartilhado ${docTitle}` })).toHaveCount(0)
  await expect(page.getByRole('button', { name: `Baixar anexo da resposta ${attachTitle}` })).toHaveCount(0)

  // EXPLAINED: badge + the exact pt-BR sentence, per lane.
  const snapshotRow = page.locator('li').filter({ hasText: docTitle })
  await expect(snapshotRow.getByText(NO_ACCESS_BADGE)).toBeVisible()
  await expect(snapshotRow.getByText(SNAPSHOT_NO_ACCESS_DETAIL)).toBeVisible()

  const attachmentRow = page.locator('li').filter({ hasText: attachTitle })
  await expect(attachmentRow.getByText(NO_ACCESS_BADGE)).toBeVisible()
  await expect(attachmentRow.getByText(ATTACHMENT_NO_ACCESS_DETAIL)).toBeVisible()

  // The door was NEVER called merely to render the row's canOpen state.
  expect(doorCalls, 'the audited byte doors must never be called to DISCOVER the answer').toBe(0)
})

// ===========================================================================
// DM4-DT-1/2/3 — the DT upload path (ADR 0119; pgTAP 340 B5b/B5c). Positive:
// the DT office IS admitted on a DT-targeted referral. Negative (both arms of
// the same predicate): a commission coordinator is NOT the DT office, and the
// DT is NOT admitted on a commission-targeted referral.
// ===========================================================================

test('DM4-DT-1/2/3: the DT office is admitted to upload on a DT-targeted referral; a commission coordinator is refused there; the DT is refused on a commission-targeted referral', async ({
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `dt-${Date.now()}`
  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')
  const dtToken = await accessToken(request, 'dt.a@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso DT ${marker}`, UID_CHEFE_A)

  // --- The DT-targeted referral. --------------------------------------------
  const dtReferralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs dt-alvo ${marker}`,
    targetHospitalId: HOSPITAL_CENTRAL_A,
  })
  await sendReferralDraft(request, chefeAToken, dtReferralId)
  await advanceToInReview(request, dtToken, dtReferralId)

  // Positive: the DT office begins an upload.
  const beginDt = await beginUpload(request, dtToken, {
    resourceType: 'case_referral',
    resourceId: dtReferralId,
    title: `Anexo DT ${marker}`,
    kind: 'anexo_resposta',
  })
  expect(beginDt.ok, `the DT office must be admitted: ${JSON.stringify(beginDt.body)}`).toBeTruthy()

  // Negative A: a commission coordinator (not the DT office) on the SAME
  // DT-targeted referral is refused — absence ≡ denial (P0002).
  const beginChefeB = await beginUpload(request, chefeBToken, {
    resourceType: 'case_referral',
    resourceId: dtReferralId,
    title: `Anexo Indevido ${marker}`,
    kind: 'anexo_resposta',
  })
  expect(beginChefeB.ok, 'a commission coordinator is NOT the DT office').toBeFalsy()
  expect((beginChefeB.body as { code?: string }).code, 'refused P0002 (absence ≡ denial)').toBe('P0002')

  // --- The commission-targeted referral, for the mirror negative. -----------
  const commReferralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs dt-negativo ${marker}`,
    targetCommissionId: COMM_B,
  })
  await sendReferralDraft(request, chefeAToken, commReferralId)
  await advanceToInReview(request, chefeBToken, commReferralId)

  // Negative B: the DT is NOT admitted on a COMMISSION-targeted referral.
  const beginDtOnComm = await beginUpload(request, dtToken, {
    resourceType: 'case_referral',
    resourceId: commReferralId,
    title: `Anexo DT Indevido ${marker}`,
    kind: 'anexo_resposta',
  })
  expect(beginDtOnComm.ok, 'the DT is NOT admitted on a commission-targeted referral').toBeFalsy()
  expect((beginDtOnComm.body as { code?: string }).code, 'refused P0002').toBe('P0002')

  // Control: the commission coordinator IS admitted on ITS OWN referral —
  // proving the negative above is about identity, not a broken fixture.
  const beginChefeBControl = await beginUpload(request, chefeBToken, {
    resourceType: 'case_referral',
    resourceId: commReferralId,
    title: `Anexo Controle ${marker}`,
    kind: 'anexo_resposta',
  })
  expect(
    beginChefeBControl.ok,
    `control: the target coordinator IS admitted on her own commission-targeted referral: ${JSON.stringify(beginChefeBControl.body)}`,
  ).toBeTruthy()
})

// ===========================================================================
// DM4-AUDIT-1 ⭐ AUDIT-ROW EXACTNESS — a DM4 exit criterion. A fresh centralized
// PHI snapshot opens from the CANONICAL bucket exactly once per open with
// exactly one audit row per open (count asserted, not presence); the retired
// bucket path serves nothing (behavioral AND catalog-level).
// ===========================================================================

test('DM4-AUDIT-1: opening the shared-document snapshot audits exactly once per open, from the canonical documents-phi bucket — the retired case-documents path serves nothing', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `audit-${Date.now()}`
  const payload = uniquePdf(marker)
  const docTitle = `Documento Auditoria ${marker}`

  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso auditoria ${marker}`, UID_CHEFE_A)
  const docFixture = await createDocumentFixture(request, chefeAToken, {
    resourceType: 'case',
    resourceId: caseId,
    title: docTitle,
    bytes: payload.buffer,
    mime: 'application/pdf',
  })
  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs auditoria ${marker}`,
    targetCommissionId: COMM_B,
  })
  await freezeDocument(request, chefeAToken, referralId, docFixture.documentId)
  await sendReferralDraft(request, chefeAToken, referralId)

  const [item] = await svcGet<{ id: string }>(
    request,
    `referral_shared_item?referral_id=eq.${referralId}&kind=eq.document&select=id`,
  )
  expect(item, 'the frozen shared item exists').toBeTruthy()

  const opened = async () => (await auditRows(request, 'referral.viewed', referralId)).length
  const baseline = await opened()

  // Open #1 — via the RPC directly (target coordinator, entitled once sent).
  const open1 = await rpc(request, 'open_referral_snapshot_document', chefeBToken, {
    p_shared_item_id: item.id,
  })
  expect(open1.ok(), `open #1: ${await open1.text()}`).toBeTruthy()
  const body1 = (await open1.json()) as { size_bytes: number }
  expect(body1.size_bytes, 'the door returns the real byte length').toBe(payload.buffer.length)
  await expect.poll(opened, { timeout: 15_000, message: 'exactly ONE row after open #1' }).toBe(baseline + 1)

  // Open #2 — same reader, same item: the count must be a FLOOR, not a
  // presence check — catches BOTH a missing row and a silent duplicate.
  const open2 = await rpc(request, 'open_referral_snapshot_document', chefeBToken, {
    p_shared_item_id: item.id,
  })
  expect(open2.ok()).toBeTruthy()
  await expect.poll(opened, { timeout: 15_000, message: 'exactly TWO rows after open #2' }).toBe(baseline + 2)

  // Open #3 — through the REAL UI, proving the CANONICAL bucket end to end.
  //
  // ⚠ A genuine finding (routed to `backend`, not a spec bug): `get_referral_detail`
  // ALSO emits `referral.viewed` for a PHI-entitled NON-SOURCE reader (Rule 11 — the
  // CONTENT view is audited independently of the FILE-open door,
  // `open_referral_snapshot_document`). Navigating to the page therefore adds its OWN
  // row, on top of the click's — the COUNT assertions below stay exact throughout
  // (never weakened to "at least"), so this is proven precisely rather than papered
  // over with a looser predicate.
  await cachedSignIn(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/farmacia/encaminhamentos/${referralId}`)
  await expect
    .poll(opened, {
      timeout: 15_000,
      message: 'the CONTENT view itself (get_referral_detail) audits independently of any file open',
    })
    .toBe(baseline + 3)
  const postNavBaseline = await opened()

  const openButton = page.getByRole('button', { name: `Baixar documento compartilhado ${docTitle}` })
  await expect(openButton).toBeVisible({ timeout: 20_000 })
  const signedUrl = await clickAndCapturePopup(page, openButton)
  expect(signedUrl, 'served from the CANONICAL bucket').toContain('/documents-phi/')
  expect(signedUrl, 'NEVER from the retired bucket').not.toContain('/case-documents/')
  const bytes = await fetchBytes(page, signedUrl)
  expect(Buffer.compare(bytes, payload.buffer), 'the UI-driven open served the exact bytes').toBe(0)
  await expect
    .poll(opened, { timeout: 15_000, message: 'exactly ONE more row for the click-time FILE open, on top of the page view' })
    .toBe(postNavBaseline + 1)

  // Rule 11: the audit row records THAT and WHO, never a coordinate or title.
  const rows = await svcGet<{ metadata: Record<string, unknown> | null }>(
    request,
    `audit_log?action=eq.referral.viewed&entity_id=eq.${referralId}&select=metadata&order=occurred_at.asc`,
  )
  for (const r of rows) {
    const meta = JSON.stringify(r.metadata ?? {})
    expect(meta, 'no storage coordinate in the audit metadata').not.toContain('documents-phi')
    expect(meta, 'no title in the audit metadata').not.toContain(marker)
  }

  // ⭐ THE EXIT CRITERION, precisely: the file-open event must be
  // DISTINGUISHABLE from the content-view event by a STRUCTURED field, not
  // only by which of two free-text pt-BR sentences `log_audit_access` was
  // handed (Rule 10 — user-facing prose is translatable/reworded and is a
  // brittle place to pin a security-audit exit criterion). The last row in
  // this sequence is the click's FILE open; the row before it (from the page
  // navigation) is the CONTENT view.
  //
  // ⛔ THIS MUST FAIL TODAY. `get_referral_detail` and
  // `open_referral_snapshot_document` both call
  // `log_audit_access('referral.viewed', 'referral', <id>, <commission>, '<pt-BR
  // sentence>', '{}'::jsonb)` — identical action, entity, and EMPTY metadata;
  // only the sentence differs. Routed to `backend` as a real finding (not a
  // spec fault) to add a structured discriminator to the open door's metadata;
  // this assertion is deliberately left RED until that lands, and must be
  // re-pointed at whatever field backend designates — never at the sentence.
  const fileOpenRow = rows[rows.length - 1]
  const contentViewRow = rows[rows.length - 2]
  expect(
    JSON.stringify(fileOpenRow.metadata ?? {}),
    'a FILE OPEN and a CONTENT VIEW must be structurally distinguishable in metadata — ' +
      'currently BOTH write empty metadata ({}), so a PHI-access-audit consumer cannot ' +
      'tell "the file was downloaded" from "the referral page was viewed" without parsing ' +
      'translatable pt-BR prose (Rule 10). See PROGRESS.md Bug Log.',
  ).not.toEqual(JSON.stringify(contentViewRow.metadata ?? {}))

  // Catalog-level: the retired bucket path serves NOTHING — because the doors
  // and policies that used to serve it are GONE, not merely unreachable.
  const retiredPolicies = sql(
    `select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' ` +
      `and (qual ilike '%case-documents%' or qual ilike '%referral-attachments%');`,
  ).trim()
  expect(retiredPolicies, 'no storage policy references either retired bucket').toBe('0')
  const retiredRoutines = sql(
    `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace ` +
      `where p.proname in ('get_referral_snapshot_document_path','get_referral_attachment_path',` +
      `'add_referral_reply_attachment','can_read_snapshot_document');`,
  ).trim()
  expect(retiredRoutines, 'the four legacy referral-document routines no longer exist').toBe('0')
  const retiredTable = sql(
    `select count(*) from information_schema.tables where table_schema='public' and table_name='referral_reply_attachment';`,
  ).trim()
  expect(retiredTable, 'the legacy referral_reply_attachment table no longer exists').toBe('0')
})

// ===========================================================================
// DM4-FREEZE-R3 — an ENFORCING confidentiality label refuses the freeze
// (HC0DC). No shared-item row is created (the referral corridor has no
// clearance plane, ADR 0119 D4).
// ===========================================================================

test('DM4-FREEZE-R3: an enforcing confidentiality label refuses the freeze with HC0DC, and no shared-item row is created', async ({
  request,
}) => {
  const marker = `r3-${Date.now()}`
  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso R3 ${marker}`, UID_CHEFE_A)
  const docFixture = await createDocumentFixture(request, chefeAToken, {
    resourceType: 'case',
    resourceId: caseId,
    title: `Documento Legal ${marker}`,
  })
  const setLevel = await rpc(request, 'set_document_confidentiality', chefeAToken, {
    p_document_id: docFixture.documentId,
    p_level: 'legal_privileged',
  })
  expect(setLevel.ok(), `set_document_confidentiality: ${await setLevel.text()}`).toBeTruthy()

  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs R3 ${marker}`,
    targetCommissionId: COMM_B,
  })

  const attempt = await rpc(request, 'add_referral_shared_item', chefeAToken, {
    p_referral_id: referralId,
    p_kind: 'document',
    p_source_document_id: docFixture.documentId,
  })
  expect(attempt.ok(), 'an enforcing label must refuse the freeze').toBeFalsy()
  const body = (await attempt.json()) as { code?: string }
  expect(body.code, 'refused HC0DC').toBe('HC0DC')

  const rows = await svcGet<{ id: string }>(request, `referral_shared_item?referral_id=eq.${referralId}&select=id`)
  expect(rows.length, 'no shared-item row was created by the refused attempt').toBe(0)
})

// ===========================================================================
// DM4-FREEZE-R4-R5 — R4: a label applied AFTER a freeze does not retract
// access. R5: source soft-delete KEEPS the snapshot; D10 disposal KILLS it
// (HC0DD).
// ===========================================================================

test('DM4-FREEZE-R4-R5: a later label does not retract an already-frozen snapshot; soft-delete keeps it; disposal kills it', async ({
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `r4r5-${Date.now()}`
  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso R4R5 ${marker}`, UID_CHEFE_A)
  const payloadA = uniquePdf(`${marker}-A`)
  const payloadB = uniquePdf(`${marker}-B`)
  const docA = await createDocumentFixture(request, chefeAToken, {
    resourceType: 'case',
    resourceId: caseId,
    title: `Documento R4 ${marker}`,
    bytes: payloadA.buffer,
    mime: 'application/pdf',
  })
  const docB = await createDocumentFixture(request, chefeAToken, {
    resourceType: 'case',
    resourceId: caseId,
    title: `Documento R5 ${marker}`,
    bytes: payloadB.buffer,
    mime: 'application/pdf',
  })

  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs R4R5 ${marker}`,
    targetCommissionId: COMM_B,
  })
  await freezeDocument(request, chefeAToken, referralId, docA.documentId)
  await freezeDocument(request, chefeAToken, referralId, docB.documentId)
  await sendReferralDraft(request, chefeAToken, referralId)

  const [itemA] = await svcGet<{ id: string }>(
    request,
    `referral_shared_item?referral_id=eq.${referralId}&source_document_id=eq.${docA.documentId}&select=id`,
  )
  const [itemB] = await svcGet<{ id: string }>(
    request,
    `referral_shared_item?referral_id=eq.${referralId}&source_document_id=eq.${docB.documentId}&select=id`,
  )

  // --- R4: label AFTER freeze does not retract. -----------------------------
  const relabel = await rpc(request, 'set_document_confidentiality', chefeAToken, {
    p_document_id: docA.documentId,
    p_level: 'credentialing_sensitive',
  })
  expect(relabel.ok(), `set_document_confidentiality (after freeze): ${await relabel.text()}`).toBeTruthy()

  const openA = await rpc(request, 'open_referral_snapshot_document', chefeBToken, { p_shared_item_id: itemA.id })
  expect(openA.ok(), `R4: the freeze must survive a LATER label: ${await openA.text()}`).toBeTruthy()
  const bodyA = (await openA.json()) as { size_bytes: number }
  expect(bodyA.size_bytes, 'still the frozen bytes').toBe(payloadA.buffer.length)

  // --- R5a: source soft-delete KEEPS the snapshot. --------------------------
  const softDel = await rpc(request, 'soft_delete_document', chefeAToken, { p_document_id: docB.documentId })
  expect(softDel.ok(), `soft_delete_document: ${await softDel.text()}`).toBeTruthy()
  const [docBRow] = await svcGet<{ status: string }>(request, `documents?id=eq.${docB.documentId}&select=status`)
  expect(docBRow.status, 'the source document is soft-deleted').toBe('soft_deleted')

  const openBAfterSoftDelete = await rpc(request, 'open_referral_snapshot_document', chefeBToken, {
    p_shared_item_id: itemB.id,
  })
  expect(
    openBAfterSoftDelete.ok(),
    `R5: source soft-delete must NOT close the snapshot: ${await openBAfterSoftDelete.text()}`,
  ).toBeTruthy()

  // --- R5b: D10 disposal KILLS the snapshot. --------------------------------
  const dispose = await rpc(request, 'request_document_disposition', chefeAToken, {
    p_document_id: docB.documentId,
    p_reason: 'entered_in_error',
  })
  expect(dispose.ok(), `request_document_disposition: ${await dispose.text()}`).toBeTruthy()

  const openBAfterDisposal = await rpc(request, 'open_referral_snapshot_document', chefeBToken, {
    p_shared_item_id: itemB.id,
  })
  expect(openBAfterDisposal.ok(), 'R5: disposal must fail the snapshot CLOSED').toBeFalsy()
  const errB = (await openBAfterDisposal.json()) as { code?: string }
  expect(errB.code, 'refused HC0DD').toBe('HC0DD')
})

// ===========================================================================
// DM4-FLAG-OFF-1 — `documents_wave_c` OFF gates the corridor at its FIRST
// residue-producing step (`begin_document_upload`), not its last: zero
// residue, and the UI control is ABSENT (not disabled).
// ===========================================================================

test('DM4-FLAG-OFF-1: documents_wave_c OFF refuses begin_document_upload before any residue, and the UI upload control is absent (not disabled)', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `flagoff-${Date.now()}`
  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso flag off ${marker}`, UID_CHEFE_A)
  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs flagoff ${marker}`,
    targetCommissionId: COMM_B,
  })
  await sendReferralDraft(request, chefeAToken, referralId)
  await advanceToInReview(request, chefeBToken, referralId)

  const docsBefore = sql(`select count(*) from public.documents;`).trim()

  setFlag('documents_wave_c', false)
  try {
    const begun = await beginUpload(request, chefeBToken, {
      resourceType: 'case_referral',
      resourceId: referralId,
      title: `Anexo Flag Off ${marker}`,
      kind: 'anexo_resposta',
    })
    expect(begun.ok, 'flag OFF must refuse begin_document_upload').toBeFalsy()
    expect((begun.body as { code?: string }).code, 'refused HC0D7 — before the first table write').toBe('HC0D7')

    const docsAfter = sql(`select count(*) from public.documents;`).trim()
    expect(docsAfter, 'ZERO residue: no documents row, no reservation, no bytes').toBe(docsBefore)

    // UI: the control is ABSENT, not merely disabled — the whole corridor has
    // no trigger.
    await cachedSignIn(page, 'chefe.farm@test.local')
    await page.goto(`/o/${ORG}/c/farmacia/encaminhamentos/${referralId}`)
    await page.getByRole('button', { name: 'Responder e concluir' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    await expect(dialog.getByText('Anexos da resposta'), 'no upload heading with the flag off').toHaveCount(0)
    await expect(dialog.getByLabel('Arquivo do anexo'), 'no file input with the flag off').toHaveCount(0)
  } finally {
    setFlag('documents_wave_c', true)
  }
})

// ===========================================================================
// DM4-KBD-1 — keyboard-only: Tab to the reply-attachment click-time door and
// activate it with Enter, receiving the exact bytes.
// ===========================================================================

test('DM4-KBD-1: keyboard-only — Tab to the reply-attachment open button and activate with Enter, receiving byte-identical content', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `kbd-${Date.now()}`
  const payload = uniquePdf(marker)
  const attachTitle = `Anexo Teclado ${marker}`

  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await accessToken(request, 'chefe.farm@test.local')

  const caseId = await createCase(request, COMM_A, `DM4 caso teclado ${marker}`, UID_CHEFE_A)
  const referralId = await createReferralDraft(request, chefeAToken, {
    sourceCaseId: caseId,
    subject: `DM4 referral docs teclado ${marker}`,
    targetCommissionId: COMM_B,
  })
  await sendReferralDraft(request, chefeAToken, referralId)
  await advanceToInReview(request, chefeBToken, referralId)
  await createDocumentFixture(request, chefeBToken, {
    resourceType: 'case_referral',
    resourceId: referralId,
    title: attachTitle,
    kind: 'anexo_resposta',
    bytes: payload.buffer,
    mime: 'application/pdf',
  })
  await conclude(request, chefeBToken, referralId, 'Resultado sintético — teclado DM4.')

  await cachedSignIn(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/farmacia/encaminhamentos/${referralId}`)
  const openButton = page.getByRole('button', { name: `Baixar anexo da resposta ${attachTitle}` })
  await expect(openButton).toBeVisible({ timeout: 20_000 })

  await page.locator('body').click({ position: { x: 2, y: 2 } })
  await focusByTabbing(page, async () => {
    const focused = page.locator(':focus')
    if ((await focused.count()) === 0) return false
    const name = (await focused.getAttribute('aria-label')) ?? ''
    return name === `Baixar anexo da resposta ${attachTitle}`
  })
  await expect(openButton, 'a visible focus ring is part of the contract (CLAUDE.md §8)').toBeFocused()

  const context = page.context()
  const downloadPromise = context.waitForEvent('download', { timeout: 10_000 }).catch(() => null)
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')])
  const evt = await downloadPromise
  const url = evt ? evt.url() : popup.url()
  await popup.close().catch(() => {})

  const bytes = await fetchBytes(page, url)
  expect(
    Buffer.compare(bytes, payload.buffer),
    'a keyboard-only user received the exact bytes through the audited door',
  ).toBe(0)
})
