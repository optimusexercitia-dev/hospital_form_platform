import { test, expect, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  COMMISSION_A_ID,
  DB_CONTAINER,
  signInAs,
  serviceQuery,
  docIdByCode,
  commissionDocHref,
  sql,
  pickApprover,
  coreFileOfVersion,
  waitForVersionFile,
  publishViaDialog,
  ownerToken,
  focusByTabbing,
  selectDocType,
  toggleReviewer,
  continuarButton,
  enviarButton,
  salvarRascunhoButton,
} from './helpers/documents'
import {
  beginUpload,
  putBytesServiceRole,
  finalizeUpload,
  clickAndCapturePopup,
  svcGet,
} from './helpers/document-model'

/**
 * DM3 — Wave B: controlled documents on the core document model (ADR 0114/0118,
 * `docs/plans/dm3-controlled-documents-plan.md`).
 *
 * ## Why this file exists at all
 *
 * Everything DM3 proved before this file was either a DB-layer proof (pgTAP,
 * whose `DM3·X3a` fixture is SQL-built — no object ever transits Storage) or an
 * ABSENCE proof (the frontend's "zero render-time signed-URL anchors in the
 * DOM"). An absence proof cannot establish that the replacement works. Before
 * this file, NO BYTE had crossed the new corridor in the entire phase.
 *
 * So the headline test here is the round trip, end to end and through the real
 * browser:
 *
 *   signed PUT (client) → real bytes land in the bucket → `finalize` DERIVES
 *   size/MIME/hash from what actually landed → `open_document_version` signs it
 *   back → the bytes that come out are compared to the bytes that went in.
 *
 * No seeded controlled document has bytes. They are fileless by two independent
 * mechanisms — the M3 backfill binds each domain version to a deliberately
 * fileless core version, and a newly created document's version has a NULL
 * pointer until a real upload. Every one of them renders `pending`. **Every test
 * here that needs bytes must therefore upload them first**; there is nothing to
 * borrow from the seed.
 *
 * ## The trap this file is written against
 *
 * DM2's P0: a spec asserted a download BUTTON had count 0, passed, and the door
 * was wide open the whole time. An assertion whose subject is a rendered control
 * cannot carry an authorization claim. So every access claim below CALLS THE
 * DOOR (`open_document_version`) under a real persona JWT and pins the SPECIFIC
 * refusal — exact SQLSTATE and message — never "it refuses somehow", which stays
 * green when it starts refusing for an unrelated reason.
 *
 * Local Supabase stack, seeded personas (password `Test1234!`), `documents_wave_b`
 * forced ON by `seed.sql`. Run `supabase db reset --local` before a full pass.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Local scaffolding
// ---------------------------------------------------------------------------

/** A distinctive, per-test PDF payload — unique bytes so a mix-up between two
 *  versions cannot pass as a match. */
function uniquePdf(marker: string): { name: string; mimeType: string; buffer: Buffer } {
  const body =
    `%PDF-1.4\n% DM3 Wave B round-trip marker: ${marker}\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n` +
    `trailer<</Root 1 0 R>>\n%%EOF\n`
  return { name: `dm3-${marker}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(body, 'utf8') }
}

const sha256Hex = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Run SQL expecting it to FAIL, and return psql's error text. Used to prove a
 *  constraint actually bites rather than asserting it exists in the catalog
 *  (structural ≠ behavioural). Throws if the statement unexpectedly SUCCEEDS. */
function sqlExpectError(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  try {
    const out = execSync(
      `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -v ON_ERROR_STOP=1 -c "${escaped}" 2>&1`,
      { encoding: 'utf8' },
    )
    throw new Error(`statement was expected to FAIL but succeeded: ${out}`)
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string }
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}` || err.message
    if (/expected to FAIL but succeeded/.test(text)) throw e
    return text
  }
}

type CoreFileFacts = NonNullable<Awaited<ReturnType<typeof coreFileOfVersion>>>

/** The core-model file facts behind a DOMAIN controlled-document version — the
 *  substrate AC-7/AC-11 used to read off `controlled_document_versions.storage_path`,
 *  which DM3 M4 dropped. Asserts presence (the shared helper returns `null`). */
async function coreFileFor(page: Page, domainVersionId: string): Promise<CoreFileFacts> {
  const facts = await coreFileOfVersion(page, domainVersionId)
  expect(facts, `version ${domainVersionId} is bound to a core version with a source file`).not.toBeNull()
  return facts!
}

/** The single draft version of a document. */
async function soleVersion(page: Page, docId: string): Promise<{ id: string; version_number: number; status: string }> {
  const rows = await serviceQuery<{ id: string; version_number: number; status: string }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&select=id,version_number,status&order=version_number`,
  )
  expect(rows.length, 'document has exactly one version').toBe(1)
  return rows[0]
}

/**
 * Create a DRAFT-ONLY controlled document through the wizard (title + type,
 * "Salvar rascunho"), landing on its detail page with the `AddVersionForm`
 * available. Signed in as `chefe.ccih` on entry.
 */
async function createDraftOnlyDoc(page: Page, title: string): Promise<string> {
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await selectDocType(page, 'Protocolo')
  await salvarRascunhoButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=rascunho$/, { timeout: 20_000 })
  return page.url().split('/').pop()!.split('?')[0]
}

/** Attach bytes to the working draft via the real client corridor (the
 *  `AddVersionForm` on the detail page: begin → client PUT → finalize). */
async function uploadViaDetailForm(
  page: Page,
  payload: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await expect(fileForm, 'the draft upload form is on the detail page').toBeVisible({ timeout: 20_000 })
  await fileForm.locator('input[type="file"]').setInputFiles(payload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()
}

/** Fetch the bytes behind a signed download URL. */
async function fetchBytes(page: Page, url: string): Promise<Buffer> {
  const resp = await page.request.get(url)
  expect(resp.status(), `signed download URL served (${url.split('?')[0]})`).toBe(200)
  return await resp.body()
}

/** `open_document_version` under a persona JWT, returning the raw PostgREST body
 *  so a refusal's SQLSTATE + message can be pinned exactly. */
async function callOpenDoor(
  page: Page,
  token: string,
  coreVersionId: string,
): Promise<{ status: number; body: Record<string, unknown>; raw: string }> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/open_document_version`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { p_document_version_id: coreVersionId },
  })
  const raw = await resp.text()
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    /* non-JSON body stays visible through `raw` */
  }
  return { status: resp.status(), body, raw }
}

const coreVersionOf = async (page: Page, domainVersionId: string): Promise<string> => {
  const [row] = await serviceQuery<{ core_document_version_id: string | null }>(
    page,
    `controlled_document_versions?id=eq.${domainVersionId}&select=core_document_version_id`,
  )
  expect(row?.core_document_version_id, 'domain version has a core pointer').toBeTruthy()
  return row!.core_document_version_id!
}

// ===========================================================================
// DM3B-1 ⭐ THE BYTE ROUND TRIP — the test this phase actually needed.
//
// Upload a real file through the real client corridor, prove the bytes LANDED
// in the bucket, prove `finalize` derived size/MIME/hash from what landed, then
// download through `open_document_version` and compare the bytes that came out
// with the bytes that went in.
// ===========================================================================

test('DM3B-1: a real file makes the FULL round trip — client PUT → bucket → derived facts → door-signed download returns byte-identical content', async ({
  page,
}) => {
  const marker = `rt-${Date.now()}`
  const payload = uniquePdf(marker)
  const expectedSha = sha256Hex(payload.buffer)

  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, `Round Trip ${marker}`)
  const draft = await soleVersion(page, docId)

  // Before the upload there is NOTHING to serve: a fresh domain version has a
  // NULL core pointer. Stated so the "after" assertions cannot be satisfied by
  // something the seed already provided.
  const [before] = await serviceQuery<{ core_document_version_id: string | null }>(
    page,
    `controlled_document_versions?id=eq.${draft.id}&select=core_document_version_id`,
  )
  expect(before.core_document_version_id, 'a new draft version starts fileless').toBeNull()

  // --- The upload: a real File through the browser, PUT by the CLIENT. ------
  await uploadViaDetailForm(page, payload)
  await waitForVersionFile(page, draft.id)

  const core = await coreFileFor(page, draft.id)

  // (a) The bytes physically LANDED in Storage — asserted against
  //     `storage.objects` itself, which is what `finalize` reads its facts from.
  const objectRow = sql(
    `select coalesce((o.metadata->>'size'), 'MISSING') from storage.objects o ` +
      `where o.bucket_id = '${core.storageBucket}' and o.name = '${core.storagePath}';`,
  ).trim()
  expect(objectRow, 'an object exists at the reserved coordinate').not.toBe('')
  expect(objectRow, 'the stored object reports the uploaded byte length').toBe(String(payload.buffer.length))

  // (b) `finalize` DERIVED the facts from what landed (D9). The size is the real
  //     byte length; the MIME is the Content-Type Storage recorded; the sha256 is
  //     the hash of the bytes the verifier downloaded back.
  expect(core.sizeBytes, 'size derived from the stored object').toBe(payload.buffer.length)
  expect(core.mimeType, 'MIME derived from the stored object').toBe('application/pdf')
  expect(core.sha256, 'sha256 computed over the bytes that landed').toBe(expectedSha)
  expect(core.uploadState, 'verification completed').toBe('unscanned_accepted')

  // (c) A controlled document is `standard` tier BY CONSTRUCTION — the tier is
  //     server-derived at `begin_document_upload`, never caller-supplied.
  expect(core.sensitivityTier, 'controlled documents are standard tier').toBe('standard')
  expect(core.storageBucket, 'standard tier lands in the standard bucket').toBe('documents-standard')

  // --- The download: through the audited door, then byte comparison. --------
  await page.reload()
  const downloadButton = page.getByRole('button', { name: 'Baixar', exact: true })
  await expect(downloadButton, 'an available version offers the door-backed control').toBeVisible({
    timeout: 20_000,
  })

  const signedUrl = await clickAndCapturePopup(page, downloadButton)
  expect(signedUrl, 'the door signed a URL').toMatch(/\/storage\/v1\/object\/sign\//)
  // ADR 0118 §1: coordinates never cross the door's own boundary, but the SIGNED
  // url necessarily carries the path — what must never appear is a raw,
  // unsigned coordinate. The token is the proof it went through the signer.
  expect(signedUrl, 'the URL is signed, not a raw object path').toContain('token=')

  const returned = await fetchBytes(page, signedUrl)

  // ⭐ THE ASSERTION THE PHASE WAS MISSING.
  expect(returned.length, 'byte length out == byte length in').toBe(payload.buffer.length)
  expect(sha256Hex(returned), 'sha256 out == sha256 in').toBe(expectedSha)
  expect(
    Buffer.compare(returned, payload.buffer),
    'the bytes that came out are byte-for-byte the bytes that went in',
  ).toBe(0)
  expect(returned.toString('utf8'), 'the round-tripped content carries this test\'s unique marker').toContain(marker)
})

// ===========================================================================
// DM3B-2: `finalize` derives size and MIME from what LANDED, never from the
// caller's declaration (ADR 0114 D9). Proven by DECLARING A LIE at `begin` and
// requiring the truth to win — DM3B-1 alone cannot show this, because a browser
// declares its File's real size and type.
// ===========================================================================

test('DM3B-2: finalize derives size/MIME from the stored object, discarding a false declaration', async ({ page }) => {
  const marker = `derive-${Date.now()}`
  const payload = uniquePdf(marker)

  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, `Derivação ${marker}`)
  const [doc] = await serviceQuery<{ core_document_id: string | null }>(
    page,
    `controlled_documents?id=eq.${docId}&select=core_document_id`,
  )
  expect(doc.core_document_id, 'M3 bound the controlled document to a core document').toBeTruthy()

  const token = await ownerToken(page, 'chefe.ccih@test.local')

  // Declare a size of 1 byte and `text/plain` — both accepted at `begin` (they
  // are within limits and on the allow-list) and both FALSE.
  const begun = await beginUpload(page.request, token, {
    resourceType: 'controlled_document',
    resourceId: docId,
    documentId: doc.core_document_id!,
    title: `Derivação ${marker}`,
    kind: 'documento_controlado',
    declaredFileName: payload.name,
    declaredMime: 'text/plain',
    declaredSize: 1,
  })
  expect(begun.ok, `begin_document_upload accepted a controlled_document home: ${JSON.stringify(begun.body)}`).toBeTruthy()
  const reservation = begun.body as { upload_session_id: string; file_object_id: string }

  // Real bytes, real Content-Type, at the reserved coordinate.
  await putBytesServiceRole(page.request, reservation.file_object_id, payload.buffer, 'application/pdf')

  const finalized = await finalizeUpload(page.request, token, reservation.upload_session_id)
  expect(finalized.ok, `finalize_document_upload: ${JSON.stringify(finalized.body)}`).toBeTruthy()

  const [fo] = await svcGet<{ size_bytes: number; mime_type: string | null }>(
    page.request,
    `file_objects?id=eq.${reservation.file_object_id}&select=size_bytes,mime_type`,
  )
  expect(Number(fo.size_bytes), 'the declared 1 byte was discarded for the real length').toBe(payload.buffer.length)
  expect(Number(fo.size_bytes), 'the declaration did not win').not.toBe(1)
  expect(fo.mime_type, 'the declared text/plain was discarded for the stored Content-Type').toBe('application/pdf')
})

// ===========================================================================
// DM3B-3 ⭐ PRIOR-VERSION DOWNLOAD — a DM3 exit criterion.
//
// `open_document_version` takes a VERSION id and never consults
// `current_version_id` or the domain status, so v1 of a superseded document must
// still serve ITS OWN bytes. Two distinct payloads, so serving the wrong version
// cannot pass as success.
// ===========================================================================

test('DM3B-3: after supersession, v1 still downloads through the door and returns v1 bytes (not v2)', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const marker = `prior-${Date.now()}`
  const v1Payload = uniquePdf(`${marker}-V1`)
  const v2Payload = uniquePdf(`${marker}-V2`)
  expect(Buffer.compare(v1Payload.buffer, v2Payload.buffer), 'the two payloads differ').not.toBe(0)

  // --- v1: create → upload → approve → publish. ----------------------------
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, `Prior Version ${marker}`)
  const v1 = await soleVersion(page, docId)
  await uploadViaDetailForm(page, v1Payload)
  await waitForVersionFile(page, v1.id)

  await page.reload()
  const submitForm = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await expect(submitForm).toBeVisible({ timeout: 20_000 })
  await pickApprover(submitForm, 'Enfermeiro CCIH Um')
  await submitForm.getByRole('button', { name: /enviar para aprovação/i }).click()
  await expect
    .poll(
      async () =>
        (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${v1.id}&select=status`))[0]
          ?.status,
      { timeout: 20_000 },
    )
    .toBe('in_approval')

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ decision: string | null }>(
            page,
            `document_approvals?document_version_id=eq.${v1.id}&select=decision`,
          )
        )[0]?.decision,
      { timeout: 20_000 },
    )
    .toBe('approved')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  await publishViaDialog(page)
  await expect
    .poll(
      async () =>
        (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${v1.id}&select=status`))[0]
          ?.status,
      { timeout: 20_000 },
    )
    .toBe('effective')

  // --- v2: inline supersede → upload DIFFERENT bytes. ----------------------
  await page.goto(commissionDocHref(docId))
  await page.getByRole('button', { name: /mais ações/i }).click()
  await page.getByRole('menuitem', { name: /substituir por rascunho em branco/i }).click()
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ version_number: number }>(
            page,
            `controlled_document_versions?document_id=eq.${docId}&select=version_number`,
          )
        ).length,
      { timeout: 20_000, message: 'a v2 draft was created' },
    )
    .toBe(2)

  const [v2] = await serviceQuery<{ id: string }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&version_number=eq.2&select=id`,
  )
  await page.reload()
  await uploadViaDetailForm(page, v2Payload)
  await waitForVersionFile(page, v2.id)

  // The two versions hold DIFFERENT bytes and DIFFERENT coordinates.
  const v1Core = await coreFileFor(page, v1.id)
  const v2Core = await coreFileFor(page, v2.id)
  expect(v1Core.sha256, 'v1 kept its own hash').toBe(sha256Hex(v1Payload.buffer))
  expect(v2Core.sha256, 'v2 has its own hash').toBe(sha256Hex(v2Payload.buffer))
  expect(v2Core.storagePath, 'v2 landed at a NEW path (Rule 6)').not.toBe(v1Core.storagePath)

  // --- ⭐ The exit criterion: download v1 — the PRIOR version — and get v1. --
  await page.reload()
  const v1Card = page
    .locator('li')
    .filter({ has: page.getByText('v1', { exact: true }) })
    .first()
  await expect(v1Card, 'the v1 card is on the history').toBeVisible({ timeout: 20_000 })
  const v1Download = v1Card.getByRole('button', { name: 'Baixar', exact: true })
  await expect(v1Download, 'the PRIOR version still offers a download control').toBeVisible()

  const v1Url = await clickAndCapturePopup(page, v1Download)
  const v1Bytes = await fetchBytes(page, v1Url)
  expect(
    Buffer.compare(v1Bytes, v1Payload.buffer),
    'the prior version served ITS OWN bytes, byte-for-byte',
  ).toBe(0)
  expect(v1Bytes.toString('utf8'), 'and not v2 bytes').toContain(`${marker}-V1`)
  expect(v1Bytes.toString('utf8'), 'v2 marker must be absent').not.toContain(`${marker}-V2`)
})

// ===========================================================================
// DM3B-4 ⭐ THE APPROVER ARM, proven AT THE DOOR.
//
// DM3 M5 dropped `controlled_documents_obj_select_member`, the Storage policy
// that used to carry the approver's byte access. The arm now lives in the KERNEL
// (`app.can_read_document`'s `controlled_document` branch → `is_document_approver_of`).
// This is the highest-impact silent loss in the phase.
//
// Positive: an approver who is NOT a commission member gets the bytes.
// Negative: an outsider who is an approver on a DIFFERENT document is refused —
//           and the refusal is pinned to the exact SQLSTATE + message, at the
//           DOOR, not at a rendered button (the DM2 P0 lesson).
// ===========================================================================

test('DM3B-4: a non-member approver opens the version through the door; an approver on a DIFFERENT document is refused P0002 with no leakage', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const marker = `approver-${Date.now()}`
  const title = `Arm do Aprovador ${marker}`
  const payload = uniquePdf(marker)

  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, title)
  const version = await soleVersion(page, docId)
  await uploadViaDetailForm(page, payload)
  await waitForVersionFile(page, version.id)

  // ⭐ THE CONTROL, taken BEFORE she is named. Without it the positive arm below
  // is unfalsifiable: a green "she can open it" proves nothing unless she
  // demonstrably could NOT a moment earlier. This is what makes the approver arm
  // the CAUSE rather than a coincidence.
  const coreVersionIdEarly = await coreVersionOf(page, version.id)
  const beforeNaming = await callOpenDoor(
    page,
    await ownerToken(page, 'chefe.farm@test.local'),
    coreVersionIdEarly,
  )
  expect(
    beforeNaming.body.code,
    'BEFORE being named an approver, the same non-member is refused by the same door',
  ).toBe('P0002')

  // Name ONLY the outside-commission approver: "Chefe Farmácia" is staff_admin of
  // Farmácia — same hospital, NOT a CCIH member. Her access can therefore come
  // from the approver arm and from nothing else.
  await page.reload()
  const submitForm = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await expect(submitForm).toBeVisible({ timeout: 20_000 })
  await pickApprover(submitForm, 'Chefe Farmácia')
  await submitForm.getByRole('button', { name: /enviar para aprovação/i }).click()
  await expect
    .poll(
      async () =>
        (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${version.id}&select=status`))[0]
          ?.status,
      { timeout: 20_000 },
    )
    .toBe('in_approval')

  const coreVersionId = await coreVersionOf(page, version.id)

  // --- Positive: the non-member approver reaches the BYTES through the door. -
  const approverToken = await ownerToken(page, 'chefe.farm@test.local')
  const allowed = await callOpenDoor(page, approverToken, coreVersionId)
  expect(allowed.status, `the approver arm serves the door: ${allowed.raw}`).toBe(200)
  expect(allowed.body.document_version_id, 'the door returned this version').toBe(coreVersionId)
  expect(allowed.body.size_bytes, 'with the real byte length').toBe(payload.buffer.length)
  // ADR 0118 §1: ids + metadata only — no bucket, no path in the door's payload.
  expect(Object.keys(allowed.body), 'the door leaks no storage coordinate').not.toContain('storage_path')
  expect(allowed.raw, 'no bucket name in the door payload').not.toContain('documents-standard')

  // …and end to end through her own screen, which is the only place a signed URL
  // is minted. The bytes she receives are the bytes that were uploaded.
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  const approverDownload = page.getByRole('button', { name: 'Baixar arquivo', exact: true })
  await expect(approverDownload, 'the approver screen offers the door-backed control').toBeVisible({
    timeout: 20_000,
  })
  const approverUrl = await clickAndCapturePopup(page, approverDownload)
  const approverBytes = await fetchBytes(page, approverUrl)
  expect(Buffer.compare(approverBytes, payload.buffer), 'the approver received the exact bytes').toBe(0)

  // --- Negative: an outsider who is an approver on a DIFFERENT document. -----
  // `staff1.farm` ("Farmacêutico Um") is an approved approver on the SEEDED
  // DOC-0001 and is not a CCIH member — so she holds the approver hat, just not
  // on this document. Assert against the DOOR with her JWT, pinning the exact
  // refusal, because a hidden button proves nothing about what the door permits.
  const foreignApproverToken = await ownerToken(page, 'staff1.farm@test.local')
  const denied = await callOpenDoor(page, foreignApproverToken, coreVersionId)
  // The claim is pinned on the SQLSTATE + message, not on the HTTP status.
  // MEASURED: PostgREST surfaces this door's `P0002` as HTTP 500, not 404 — a
  // pre-existing `open_document_version` transport quirk (DM2, not DM3), so the
  // status is asserted only as "a refusal". Pinning 500 here would encode a
  // PostgREST implementation detail as a DM3 contract.
  expect(denied.status, 'the door refuses an approver of another document').toBeGreaterThanOrEqual(400)
  expect(denied.status, 'and certainly does not serve').not.toBe(200)
  expect(denied.body.code, 'the exact SQLSTATE — a kernel denial, oracle-killed to look like absence').toBe('P0002')
  expect(denied.body.message, 'the exact pt-BR refusal').toBe('versão de documento não encontrada')
  // No data leakage: nothing about the document survives into the refusal.
  expect(denied.raw, 'the refusal does not disclose the title').not.toContain(title)
  expect(denied.raw, 'nor the marker').not.toContain(marker)
  expect(denied.raw, 'nor a storage coordinate').not.toContain('documents-standard')

  // Her own document is still reachable — a control proving the denial above is
  // about THIS document, not about a broken session or an inactive account.
  const doc1Id = await docIdByCode(page, 'DOC-0001')
  const [doc1Version] = await serviceQuery<{ id: string; core_document_version_id: string | null }>(
    page,
    `controlled_document_versions?document_id=eq.${doc1Id}&select=id,core_document_version_id`,
  )
  const control = await callOpenDoor(page, foreignApproverToken, doc1Version.core_document_version_id!)
  // DOC-0001 is a BACKFILLED, deliberately fileless version — so the door gets
  // past the kernel and refuses on ABSENCE OF BYTES, with a DIFFERENT code. That
  // difference is the point: P0002 above was an authorization denial, not a
  // generic "no".
  expect(control.body.code, 'the kernel admitted her to her own document (refusal is about the FILE, not access)').toBe(
    'HC0D8',
  )
  expect(control.body.message, 'the fileless refusal, verbatim').toBe('arquivo ainda não disponível')
})

// ===========================================================================
// DM3B-5: abandonment between `begin` and `finalize`.
//
// New to this surface and EXPECTED — not a bug. Navigating away mid-PUT leaves a
// created draft plus an unfinalized upload session. What must hold is that the
// user lands on a resumable draft: the document exists, the version is unbound,
// and the upload form is there to try again.
// ===========================================================================

test('DM3B-5: abandoning the upload mid-PUT leaves a resumable draft — no binding, no orphaned pointer', async ({
  page,
}) => {
  const marker = `abandon-${Date.now()}`
  const payload = uniquePdf(marker)

  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, `Abandono ${marker}`)
  const draft = await soleVersion(page, docId)
  const [docCore] = await serviceQuery<{ core_document_id: string | null }>(
    page,
    `controlled_documents?id=eq.${docId}&select=core_document_id`,
  )
  const coreDocId = docCore.core_document_id!

  // Hold the signed PUT open forever, so the client chain is stuck between
  // `begin` (already committed server-side) and `finalize` (never reached).
  const PUT_GLOB = '**/storage/v1/object/upload/sign/**'
  let putSeen = false
  await page.route(PUT_GLOB, async () => {
    putSeen = true
    // Deliberately never fulfilled/continued: the request hangs in flight.
  })

  await uploadViaDetailForm(page, payload)

  // `begin` landed for THIS document — a reservation scoped to its own core
  // document, not "some reserved session somewhere" (which any concurrent spec
  // could satisfy).
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ id: string; state: string }>(
            page,
            `upload_sessions?select=id,state&state=eq.reserved` +
              `&document_version_id=in.(${(
                await serviceQuery<{ id: string }>(page, `document_versions?document_id=eq.${coreDocId}&select=id`)
              )
                .map((r) => r.id)
                .join(',') || '00000000-0000-0000-0000-000000000000'})`,
          )
        ).length,
      { timeout: 30_000, message: 'begin_document_upload reserved a session for THIS document' },
    )
    .toBe(1)
  await expect
    .poll(() => putSeen, { timeout: 15_000, message: 'the client attempted the signed PUT' })
    .toBe(true)

  // --- Walk away mid-flight. -----------------------------------------------
  // ⚠ Do NOT `unroute` first: removing the handler releases the held request,
  // the PUT then completes, and the still-live client goes on to call finalize —
  // which is the opposite of abandonment. The navigation is what tears down the
  // client chain, so it must happen while the route is still held.
  await page.goto(commissionDocHref(docId))
  await page.unroute(PUT_GLOB)

  // The draft is intact and RESUMABLE.
  const [docRow] = await serviceQuery<{ status: string }>(
    page,
    `controlled_documents?id=eq.${docId}&select=status`,
  )
  expect(docRow.status, 'the document survives as a draft').toBe('draft')

  const after = await soleVersion(page, docId)
  expect(after.id, 'no extra version was minted by the abandoned attempt').toBe(draft.id)
  const [ptr] = await serviceQuery<{ core_document_version_id: string | null }>(
    page,
    `controlled_document_versions?id=eq.${draft.id}&select=core_document_version_id`,
  )
  expect(ptr.core_document_version_id, 'nothing was bound — finalize never ran').toBeNull()

  // The EXPECTED residue, stated rather than glossed: `begin` had already
  // committed a core `document_versions` row and an upload reservation, and
  // abandonment does not roll those back. They are unconsumed, unbound, and
  // owned by the reconciliation sweep — NOT a bug, and not something the UI is
  // supposed to clean up mid-flight.
  const coreVersions = await serviceQuery<{ id: string }>(
    page,
    `document_versions?document_id=eq.${coreDocId}&select=id`,
  )
  expect(coreVersions.length, 'begin committed exactly one core version').toBe(1)
  const sessions = await serviceQuery<{ state: string }>(
    page,
    `upload_sessions?document_version_id=eq.${coreVersions[0].id}&select=state`,
  )
  expect(sessions.map((s) => s.state), 'the reservation is left unconsumed').toEqual(['reserved'])
  const objects = sql(
    `select count(*) from storage.objects o join public.file_objects f ` +
      `on f.storage_bucket = o.bucket_id and f.storage_path = o.name ` +
      `join public.upload_sessions u on u.file_object_id = f.id ` +
      `where u.document_version_id = '${coreVersions[0].id}';`,
  ).trim()
  expect(objects, 'and NO object was ever written — the PUT never completed').toBe('0')

  // The UI recovers sanely: the version reads as fileless and the upload form is
  // offered again.
  await expect(page.getByRole('heading', { name: `Abandono ${marker}` })).toBeVisible({ timeout: 20_000 })
  await expect(
    page.locator('form').filter({ hasText: 'Arquivo da versão' }),
    'the draft is resumable — the upload form is back',
  ).toBeVisible()
  await expect(page.getByText('Sem arquivo', { exact: true }).first(), 'the version reads as fileless').toBeVisible()

  // And a second, completed attempt succeeds over the top of the abandoned one.
  await uploadViaDetailForm(page, payload)
  await waitForVersionFile(page, draft.id)
  const core = await coreFileFor(page, draft.id)
  expect(core.sha256, 'the retry produced a real, verified file').toBe(sha256Hex(payload.buffer))
})

// ===========================================================================
// DM3B-6: validation ORDERING — a trivially invalid file is refused BEFORE the
// document is created, leaving no orphan draft. This was a live defect fixed
// mid-phase (7cbe6b7): the client chain checked size/MIME inside `attachFile`,
// i.e. AFTER create/supersede had already run.
// ===========================================================================

test('DM3B-6: an oversized file is refused BEFORE step 1 creates anything (no orphan draft), and a wrong-MIME file likewise', async ({
  page,
}) => {
  const marker = `preflight-${Date.now()}`

  await signInAs(page, 'chefe.ccih@test.local')

  // --- Oversized: 25 MiB is the ceiling; go one byte over. -----------------
  const tooBigTitle = `Grande Demais ${marker}`
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(tooBigTitle)
  await selectDocType(page, 'Protocolo')
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles({
    name: 'gigante.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(26_214_401, 0x41),
  })
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()

  // Refused inline, and the wizard walks back to the file step.
  await expect(page.getByText(/arquivo excede|até 25 MB|muito grande|excede o tamanho/i).first()).toBeVisible({
    timeout: 20_000,
  })
  // ⭐ The ordering claim: nothing was created.
  expect(
    (await serviceQuery<{ id: string }>(
      page,
      `controlled_documents?commission_id=eq.${COMMISSION_A_ID}&title=eq.${encodeURIComponent(tooBigTitle)}&select=id`,
    )).length,
    'an oversized file left NO orphan document behind',
  ).toBe(0)
  // Still on the wizard, not redirected to a detail page.
  expect(page.url(), 'the wizard did not land on a created document').toContain('/documentos/novo')

  // --- Wrong MIME: same ordering, cheaper input. ---------------------------
  const badMimeTitle = `Tipo Invalido ${marker}`
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(badMimeTitle)
  await selectDocType(page, 'Protocolo')
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles({
    name: 'payload.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('MZ not a document'),
  })
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()

  await expect(page.getByText(/formato|tipo de arquivo|não é aceito|não suportado/i).first()).toBeVisible({
    timeout: 20_000,
  })
  expect(
    (await serviceQuery<{ id: string }>(
      page,
      `controlled_documents?commission_id=eq.${COMMISSION_A_ID}&title=eq.${encodeURIComponent(badMimeTitle)}&select=id`,
    )).length,
    'a wrong-MIME file left NO orphan document behind',
  ).toBe(0)
})

// ===========================================================================
// DM3B-7: the `pending` label. Wave A's `pending` always means "an upload is in
// flight"; Wave B reaches it a third way — a version BACKFILLED by M3, bound to
// a core version that is fileless BY DESIGN. "Processando envio" would promise a
// coordinator something that is never going to arrive.
// ===========================================================================

test('DM3B-7: a backfilled, fileless version reads "Aguardando arquivo" — never "Processando envio"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await docIdByCode(page, 'DOC-0001')

  // Ground truth first: this seeded version IS bound to a core version (so it is
  // not the "Sem arquivo" branch) and that core version has NO file.
  const [v] = await serviceQuery<{ id: string; core_document_version_id: string | null }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&select=id,core_document_version_id`,
  )
  expect(v.core_document_version_id, 'the M3 backfill bound this version to a core version').toBeTruthy()
  const binds = await serviceQuery<{ file_object_id: string }>(
    page,
    `document_version_files?document_version_id=eq.${v.core_document_version_id}&select=file_object_id`,
  )
  expect(binds.length, 'the backfilled core version is fileless BY DESIGN').toBe(0)

  await page.goto(commissionDocHref(docId))
  await expect(page.getByText('Aguardando arquivo').first(), 'the Wave-B wording').toBeVisible({ timeout: 20_000 })
  await expect(
    page.getByText('Processando envio'),
    'Wave A\'s wording must NOT appear — nothing is being processed',
  ).toHaveCount(0)

  // The affordance follows the same truth: no download control is offered for a
  // version the door could only refuse. (An AFFORDANCE claim, deliberately not
  // dressed up as an authorization claim — the door assertion is DM3B-4's.)
  await expect(page.getByRole('button', { name: 'Baixar versão vigente', exact: true })).toHaveCount(0)

  // …and the door itself agrees, pinned exactly.
  const token = await ownerToken(page, 'chefe.ccih@test.local')
  const res = await callOpenDoor(page, token, v.core_document_version_id!)
  expect(res.body.code, 'the door refuses a fileless version on ABSENCE OF BYTES').toBe('HC0D8')
  expect(res.body.message, 'verbatim').toBe('arquivo ainda não disponível')
})

// ===========================================================================
// DM3B-8: Rule 6 on the CORE model — the property phase17 AC-7 pinned on the now
// dropped `controlled_document_versions.storage_path`.
//
// It is a STRENGTHENING: `begin_document_upload` mints a per-upload path and
// `file_objects_bucket_path_uniq UNIQUE (storage_bucket, storage_path)` makes a
// collision IMPOSSIBLE rather than merely unobserved. Green-on-first-run is not
// proof, so the second half deliberately reuses a live path and REQUIRES 23505.
// ===========================================================================

test('DM3B-8: each upload lands at a NEW immutable path, and reusing a live path is refused 23505', async ({
  page,
}) => {
  const marker = `paths-${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, `Caminhos ${marker}`)
  const draft = await soleVersion(page, docId)

  await uploadViaDetailForm(page, uniquePdf(`${marker}-A`))
  await waitForVersionFile(page, draft.id)
  const first = await coreFileFor(page, draft.id)

  // A REPLACEMENT upload on the same draft — the flow that used to UPDATE
  // `storage_path` in place. It must mint a new core version + a new coordinate,
  // never rebind or overwrite.
  await page.reload()
  await uploadViaDetailForm(page, uniquePdf(`${marker}-B`))
  await expect
    .poll(
      async () => (await coreFileFor(page, draft.id)).fileObjectId,
      { timeout: 30_000, message: 'the replacement upload bound a NEW file object' },
    )
    .not.toBe(first.fileObjectId)
  const second = await coreFileFor(page, draft.id)

  expect(second.storagePath, 'the second upload landed at a DIFFERENT path (Rule 6)').not.toBe(first.storagePath)
  expect(second.sha256, 'and carries the second payload').toBe(sha256Hex(uniquePdf(`${marker}-B`).buffer))

  // The first object is PRESERVED, not overwritten — Rule 6's other half.
  const stillThere = sql(
    `select count(*) from storage.objects where bucket_id = '${first.storageBucket}' and name = '${first.storagePath}';`,
  ).trim()
  expect(stillThere, 'the superseded object was preserved, never overwritten').toBe('1')

  // ⭐ Prove the guarantee can FAIL: deliberately reuse a live coordinate.
  //
  // Every other column is copied from the row that already occupies the path, so
  // the ONLY thing wrong with this insert is the duplicated coordinate — a NOT
  // NULL tripping first would make this test pass for the wrong reason (it did,
  // on the first run: `created_by` fired before the UNIQUE ever ran).
  const err = sqlExpectError(
    `insert into public.file_objects ` +
      `(storage_bucket, storage_path, sensitivity_tier, upload_state, disposal_state, created_by) ` +
      `select storage_bucket, storage_path, sensitivity_tier, 'reserved', 'none', created_by ` +
      `from public.file_objects where id = '${first.fileObjectId}';`,
  )
  expect(err, 'a reused (bucket, path) is refused, not merely unobserved').toMatch(
    /duplicate key value violates unique constraint/,
  )
  // Name the constraint: "some unique index fired" would stay green if the
  // coordinate guarantee were replaced by an unrelated one (e.g. the PK).
  expect(err, 'and it is the bucket+path guarantee specifically that fired').toContain(
    'file_objects_bucket_path_uniq',
  )
})

// ===========================================================================
// DM3B-9: keyboard-only. The download moved from an `<a href>` to an on-click
// button; a keyboard user must still be able to reach and fire it, and get the
// bytes.
//
// NOTE: `.focus()` is deliberately NOT used — it is not auto-waiting, races RSC
// streaming and no-ops silently. Real Tab presses only.
// ===========================================================================

test('DM3B-9: keyboard-only — Tab to the door-backed download control and activate it with Enter', async ({
  page,
}) => {
  const marker = `kbd-${Date.now()}`
  const payload = uniquePdf(marker)

  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, `Teclado ${marker}`)
  const draft = await soleVersion(page, docId)
  await uploadViaDetailForm(page, payload)
  await waitForVersionFile(page, draft.id)

  await page.goto(commissionDocHref(docId))
  const download = page.getByRole('button', { name: 'Baixar', exact: true })
  await expect(download).toBeVisible({ timeout: 20_000 })

  await page.locator('body').click({ position: { x: 2, y: 2 } })
  await focusByTabbing(page, async () => {
    const focused = page.locator(':focus')
    if ((await focused.count()) === 0) return false
    const name = (await focused.textContent())?.trim() ?? ''
    return /^Baixar$/.test(name)
  })

  // A visible focus ring is part of the contract (CLAUDE.md §8).
  await expect(download).toBeFocused()

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

// ===========================================================================
// DM3B-10: the D11 audit split for a controlled-document open (plan §5.1b).
//
// The contract is NOT "one row per download". Controlled documents are `standard`
// tier by construction, so the PHI clause never fires; the NON-CREATOR clause is
// what produces the row. A creator's own standard-tier open logs NOTHING, and a
// denial logs nothing at all.
// ===========================================================================

test('DM3B-10: opening a controlled version audits a NON-CREATOR exactly once, the creator zero times, and a denial not at all', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const marker = `audit-${Date.now()}`
  const payload = uniquePdf(marker)

  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await createDraftOnlyDoc(page, `Auditoria ${marker}`)
  const version = await soleVersion(page, docId)
  await uploadViaDetailForm(page, payload)
  await waitForVersionFile(page, version.id)

  const [doc] = await serviceQuery<{ core_document_id: string | null }>(
    page,
    `controlled_documents?id=eq.${docId}&select=core_document_id`,
  )
  const coreDocId = doc.core_document_id!
  const coreVersionId = await coreVersionOf(page, version.id)

  const openedCount = async () =>
    (
      await serviceQuery<{ id: string }>(
        page,
        `audit_log?action=eq.document.opened&entity_id=eq.${coreDocId}&select=id`,
      )
    ).length

  const baseline = await openedCount()

  // (a) The CREATOR opens her own standard-tier document → NO row (D11 floor).
  const creatorToken = await ownerToken(page, 'chefe.ccih@test.local')
  const creatorOpen = await callOpenDoor(page, creatorToken, coreVersionId)
  expect(creatorOpen.status, 'the creator can open it').toBe(200)
  expect(await openedCount(), 'a creator opening her own standard-tier document is NOT logged').toBe(baseline)

  // (b) A DENIED caller → still no row (denials raise, never log).
  const outsiderToken = await ownerToken(page, 'staff1.farm@test.local')
  const deniedOpen = await callOpenDoor(page, outsiderToken, coreVersionId)
  expect(deniedOpen.body.code, 'the outsider is refused').toBe('P0002')
  expect(await openedCount(), 'a denial writes NO audit row').toBe(baseline)

  // (c) A NON-CREATOR member → EXACTLY ONE row per open.
  const memberToken = await ownerToken(page, 'staff1.ccih@test.local')
  const memberOpen = await callOpenDoor(page, memberToken, coreVersionId)
  expect(memberOpen.status, `a commission member opens it: ${memberOpen.raw}`).toBe(200)
  await expect
    .poll(openedCount, { timeout: 15_000, message: 'exactly one document.opened row for the non-creator' })
    .toBe(baseline + 1)

  // A second open by the same non-creator adds exactly one more — the assertion
  // catches a MISSING row and a DUPLICATE with the same shape.
  await callOpenDoor(page, memberToken, coreVersionId)
  await expect.poll(openedCount, { timeout: 15_000 }).toBe(baseline + 2)

  // Rule 11: the trail records THAT and WHO, never the payload or a coordinate.
  const rows = await serviceQuery<{ metadata: Record<string, unknown> | null }>(
    page,
    `audit_log?action=eq.document.opened&entity_id=eq.${coreDocId}&select=metadata`,
  )
  for (const r of rows) {
    const meta = JSON.stringify(r.metadata ?? {})
    expect(meta, 'no storage coordinate in the audit metadata').not.toContain('storage_path')
    expect(meta, 'no bucket in the audit metadata').not.toContain('documents-standard')
    expect(meta, 'no title in the audit metadata').not.toContain(marker)
  }
})

// ===========================================================================
// DM3B-11: the ethics document seams are writable via the API and carry NO UI —
// ADR 0114 Amendment 2's scope boundary (FUP-DM3-ETHICS-UI). Pinned so the
// ABSENCE is recorded as a ruling rather than rediscovered as a bug, and so a UI
// appearing without the follow-up being closed is noticed.
//
// DB-LEVEL ONLY BY DESIGN. There is nothing to click, and this test must never
// grow a UI assertion.
// ===========================================================================

test('DM3B-11: the ethics document seams exist as real FKs with no UI surface (scope boundary, not a gap)', async () => {
  // Both seam columns carry a real FK to `documents(id)` — read from the catalog.
  const fks = sql(
    `select con.conname from pg_constraint con ` +
      `join pg_class src on src.oid = con.conrelid ` +
      `join pg_class tgt on tgt.oid = con.confrelid ` +
      `where con.contype = 'f' and tgt.relname = 'documents' ` +
      `and src.relname in ('ethics_decision_details','ethics_notifications');`,
  )
  expect(fks.split('\n').filter(Boolean).length, 'both ethics seam columns carry a real FK to documents').toBe(2)

  // `set_ethics_decision_details` gained the 12th parameter.
  const argCount = sql(
    `select p.pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace ` +
      `where n.nspname = 'public' and p.proname = 'set_ethics_decision_details';`,
  ).trim()
  expect(argCount, 'the decision-letter parameter landed (12 args, DROP+CREATE)').toBe('12')

  // …and the DROP+CREATE did NOT lose its ACL (a rebuild restores the Postgres
  // default: PUBLIC EXECUTE, no `authenticated` grant).
  const acl = sql(
    `select coalesce(array_to_string(p.proacl, ','), 'DEFAULT') from pg_proc p ` +
      `join pg_namespace n on n.oid = p.pronamespace ` +
      `where n.nspname = 'public' and p.proname = 'set_ethics_decision_details';`,
  ).trim()
  expect(acl, 'authenticated is granted explicitly after the rebuild').toContain('authenticated=X')
  expect(acl, 'PUBLIC EXECUTE was revoked (no bare "=X/" entry)').not.toMatch(/(^|,)=X\//)

  // NO UI, deliberately: ADR 0114 Amendment 2's scope boundary, tracked as
  // FUP-DM3-ETHICS-UI. There is nothing to click and this test must never grow a
  // UI assertion — the absence is the ruling, not a gap to file.
})
