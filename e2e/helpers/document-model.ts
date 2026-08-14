import type { APIRequestContext, Page } from '@playwright/test'
import { createHash } from 'node:crypto'

/**
 * Shared helpers for the core DOCUMENT MODEL (DM2; ADR 0114/0117/0118) — the
 * `documents` / `document_versions` / `file_objects` write path (`begin_document_upload`
 * → PUT → `finalize_document_upload` → `complete_document_upload_verification`) and its
 * audited open door (`open_document_version`).
 *
 * ⚠ Not to be confused with `e2e/helpers/documents.ts`, which is the Phase-17
 * CONTROLLED-document module (`controlled_docs` flag) — a different feature entirely.
 *
 * `createDocumentFixture` replicates the app's OWN multi-step contract (service-role
 * bytes PUT + a real `finalize`/`complete_document_upload_verification` round trip)
 * rather than a raw table INSERT, so every trigger/guard/audit row fires exactly as it
 * would for a real user. Use it for FIXTURE SETUP (a document a test needs to already
 * exist); the write-path tests themselves drive the real signed-URL flow through the
 * browser — see `phase-f2-attachments.spec.ts`.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

/**
 * DM3 Wave B added `controlled_document` to the admitted home set
 * (`securable_resources_type_check` + `..._tenant_shape`, migration M1), so a
 * controlled document's bytes ride the SAME begin/PUT/finalize/open corridor as
 * every Wave-A home. Kept in sync with `DocumentHomeResourceType` in
 * `src/lib/documents/types.ts` — this is the E2E mirror, not the source.
 */
export type DocumentHomeResourceType =
  | 'case'
  | 'meeting'
  | 'interview'
  | 'action_item'
  | 'controlled_document'

export interface BeginUploadResult {
  upload_session_id: string
  document_id: string
  document_version_id: string
  file_object_id: string
  expires_at: string
}

/** `begin_document_upload` under a real user JWT (RLS/authorization evaluated for real). */
export async function beginUpload(
  request: APIRequestContext,
  token: string,
  input: {
    resourceType: DocumentHomeResourceType
    resourceId: string
    title: string
    documentId?: string
    confidentialityLevel?: string
    kind?: string
    declaredFileName?: string
    declaredMime?: string
    declaredSize?: number
  },
): Promise<{ ok: boolean; status: number; body: BeginUploadResult | { code?: string; message?: string } }> {
  const resp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/begin_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_resource_type: input.resourceType,
      p_resource_id: input.resourceId,
      p_title: input.title,
      ...(input.documentId ? { p_document_id: input.documentId } : {}),
      ...(input.confidentialityLevel ? { p_confidentiality_level: input.confidentialityLevel } : {}),
      ...(input.kind ? { p_kind: input.kind } : {}),
      p_declared_file_name: input.declaredFileName ?? 'fixture.pdf',
      p_declared_mime: input.declaredMime ?? 'application/pdf',
      p_declared_size: input.declaredSize ?? 128,
    },
  })
  const body = await resp.json()
  return { ok: resp.ok(), status: resp.status(), body }
}

/** Service-role direct PUT to the reserved storage path — the fixture-setup shortcut
 * (bypasses the signed-URL dance real browser traffic uses; service role has full
 * Storage access). */
export async function putBytesServiceRole(
  request: APIRequestContext,
  fileObjectId: string,
  bytes: Buffer,
  mime: string,
): Promise<void> {
  const foResp = await request.get(
    `${SUPABASE_URL}/rest/v1/file_objects?id=eq.${fileObjectId}&select=storage_bucket,storage_path`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  )
  const rows = (await foResp.json()) as Array<{ storage_bucket: string; storage_path: string }>
  if (rows.length !== 1) throw new Error(`file_objects lookup: expected 1 row, got ${rows.length}`)
  const { storage_bucket, storage_path } = rows[0]

  const putResp = await request.post(
    `${SUPABASE_URL}/storage/v1/object/${storage_bucket}/${encodeURI(storage_path)}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'false',
      },
      data: bytes,
    },
  )
  if (!putResp.ok()) {
    throw new Error(`storage PUT failed ${putResp.status()}: ${await putResp.text()}`)
  }
}

/** `finalize_document_upload` under the uploader's real JWT. */
export async function finalizeUpload(
  request: APIRequestContext,
  token: string,
  uploadSessionId: string,
): Promise<{ ok: boolean; status: number; body: Record<string, string> }> {
  const resp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/finalize_document_upload`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { p_upload_session_id: uploadSessionId },
  })
  const body = await resp.json()
  return { ok: resp.ok(), status: resp.status(), body }
}

/** `complete_document_upload_verification` — service-role only (mirrors
 * `finalizeDocumentUpload`'s own admin-client verification step in actions.ts). */
export async function verifyUploadServiceRole(
  request: APIRequestContext,
  uploadSessionId: string,
  sha256: string,
  verified = true,
): Promise<{ ok: boolean; status: number; body: Record<string, string> }> {
  const resp = await request.post(
    `${SUPABASE_URL}/rest/v1/rpc/complete_document_upload_verification`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { p_upload_session_id: uploadSessionId, p_sha256: sha256, p_verified: verified },
    },
  )
  const body = await resp.json()
  return { ok: resp.ok(), status: resp.status(), body }
}

/**
 * Full fixture creation: begin → PUT (service role) → finalize → verify. Ends with the
 * document `available` (a real `document_version_files` binding, exactly as the real
 * upload dialog leaves it) unless `verified: false` is passed.
 */
export async function createDocumentFixture(
  request: APIRequestContext,
  token: string,
  opts: {
    resourceType: DocumentHomeResourceType
    resourceId: string
    title: string
    documentId?: string
    confidentialityLevel?: string
    kind?: string
    bytes?: Buffer
    mime?: string
    fileName?: string
  },
): Promise<{ documentId: string; documentVersionId: string; fileObjectId: string; uploadSessionId: string; sha256: string }> {
  const bytes = opts.bytes ?? Buffer.from(`%PDF-1.4 e2e fixture ${Date.now()}\n%%EOF\n`)
  const mime = opts.mime ?? 'application/pdf'

  const begun = await beginUpload(request, token, {
    resourceType: opts.resourceType,
    resourceId: opts.resourceId,
    title: opts.title,
    documentId: opts.documentId,
    confidentialityLevel: opts.confidentialityLevel,
    kind: opts.kind,
    declaredFileName: opts.fileName ?? 'fixture.pdf',
    declaredMime: mime,
    declaredSize: bytes.length,
  })
  if (!begun.ok) throw new Error(`begin_document_upload failed: ${JSON.stringify(begun.body)}`)
  const b = begun.body as BeginUploadResult

  await putBytesServiceRole(request, b.file_object_id, bytes, mime)

  const finalized = await finalizeUpload(request, token, b.upload_session_id)
  if (!finalized.ok) throw new Error(`finalize_document_upload failed: ${JSON.stringify(finalized.body)}`)

  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const verified = await verifyUploadServiceRole(request, b.upload_session_id, sha256)
  if (!verified.ok) throw new Error(`complete_document_upload_verification failed: ${JSON.stringify(verified.body)}`)

  return {
    documentId: b.document_id,
    documentVersionId: b.document_version_id,
    fileObjectId: b.file_object_id,
    uploadSessionId: b.upload_session_id,
    sha256,
  }
}

/** `open_document_version` under a real user JWT — the single audited byte corridor. */
export async function openDocumentVersion(
  request: APIRequestContext,
  token: string,
  documentVersionId: string,
): Promise<{ ok: boolean; status: number; body: Record<string, string> }> {
  const resp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/open_document_version`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { p_document_version_id: documentVersionId },
  })
  const body = await resp.json()
  return { ok: resp.ok(), status: resp.status(), body }
}

/** Service-role read of any table, RLS bypassed — ground truth for assertions. */
export async function svcGet<T = Record<string, unknown>>(
  request: APIRequestContext,
  path: string,
): Promise<T[]> {
  const resp = await request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Service-role PATCH — used to backdate `upload_sessions.expires_at` for the
 * `upload_expired` E2E path (real 15-minute wait is impractical). */
export async function svcPatch(
  request: APIRequestContext,
  path: string,
  data: Record<string, unknown>,
): Promise<void> {
  const resp = await request.patch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    data,
  })
  if (!resp.ok()) throw new Error(`svcPatch ${path} failed ${resp.status()}: ${await resp.text()}`)
}

/** Audit rows for (action, entity_id), ordered oldest→newest — service-role ground truth. */
export async function auditRows(
  request: APIRequestContext,
  action: string,
  entityId: string,
): Promise<Array<{ id: string; action: string; actor_id: string | null; entity_id: string; occurred_at: string }>> {
  return svcGet(
    request,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_id=eq.${entityId}` +
      `&select=id,action,actor_id,entity_id,occurred_at&order=occurred_at.asc`,
  )
}

/**
 * Click an OpenDocumentButton, capture the URL it opens via `window.open(signedUrl,
 * "_blank", …)`. For a real `application/pdf` blob, headless Chromium treats the
 * navigation as a native file DOWNLOAD (not a page render) — the popup Page's own
 * `url()` never commits, but the browser still emits a `download` event on the context
 * carrying the real target URL. Race both (same pattern as the retired
 * phase-f2-attachments.spec.ts `clickAndCapturePopup`).
 */
export async function clickAndCapturePopup(
  page: Page,
  button: ReturnType<Page['getByRole']>,
): Promise<string> {
  const context = page.context()
  const downloadPromise = context.waitForEvent('download', { timeout: 8_000 }).catch(() => null)
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()])
  const download = await downloadPromise
  const url = download ? download.url() : popup.url()
  await popup.close().catch(() => {})
  return url
}

/** Escape regex metacharacters before embedding a dynamic string in `new RegExp(...)`. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
