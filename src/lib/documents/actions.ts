'use server'

import { createHash } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'
import { mapDocumentErrorCode } from '@/lib/documents/errors'
import type {
  BeginDocumentUploadInput,
  BeginDocumentUploadResult,
  DocumentActionState,
  DocumentAvailability,
  DocumentConfidentialityLevel,
  DocumentDispositionReason,
  DocumentHoldReason,
  DocumentSensitivityTier,
  FinalizeDocumentUploadResult,
  OpenDocumentVersionResult,
} from '@/lib/documents/types'

/**
 * Document model — COMMAND-LAYER SERVER ACTIONS (DM2·S2; ADR 0118).
 *
 * Topology (ADR 0118, deviating from ADR 0111/0113 deliberately): the DB
 * doors authorize/validate/audit and return IDS ONLY; THIS module is the only
 * place that resolves storage coordinates (service client) and signs. A
 * direct PostgREST caller of any door gets authorization semantics and
 * nothing signable. Callers should `router.refresh()` after a mutation (the
 * house pattern); no revalidatePath here — the panels' routes are S3's.
 *
 * Signed-URL TTLs: PO-RULED 2026-08-13 (ADR 0114 O4 closure): PHI 120 s /
 * standard 300 s, no streaming proxy. The split is deliberate — a signed URL
 * is a bearer token, so PHI bytes get a strictly smaller exposure window.
 * Never "simplify" to one number.
 */

const SIGNED_URL_TTL_SECONDS: Record<DocumentSensitivityTier, number> = {
  phi: 120,
  standard: 300,
}

/** node crypto sha256 over the downloaded bytes — the D9 verifier. */
function sha256Hex(buf: ArrayBuffer): string {
  return createHash('sha256').update(Buffer.from(buf)).digest('hex')
}

const MIME_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
}

function downloadFileName(title: string, mime: string | null): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return (base || 'documento') + (mime ? (MIME_EXT[mime] ?? '') : '')
}

function errCode(error: { code?: string | null } | null): ReturnType<typeof mapDocumentErrorCode> {
  return mapDocumentErrorCode(error?.code ?? null)
}

/** Whether the Wave-A document experience is on (`documents_wave_a`). */
export async function documentsWaveAEnabled(): Promise<boolean> {
  return featureEnabled('documents_wave_a')
}

/**
 * Wave B (DM3 — controlled documents on the core model). Mirrors
 * {@link documentsWaveAEnabled}. UI-gating only.
 *
 * The DB gate is `app.assert_documents_wave_b_enabled()`, asserted by
 * `begin_document_upload` for a `controlled_document` home (HC0D7) and by
 * `attach_controlled_document_version_file`. Because BEGIN refuses, a stale
 * client cannot reserve a path or land bytes — which is the property that
 * matters; the flag gates the corridor, not merely what gets recorded.
 *
 * ⚠ This comment previously claimed "every DM3 door calls it", and that was
 * FALSE: until M11 the assert lived only on the final pointer write, so with the
 * flag off a caller could still create, reserve, PUT and finalize — leaving
 * orphaned bytes behind — and only the last step refused (QA MAJOR-1). It is NOT
 * true today either that every door asserts it, and it should not be: the gate
 * is deliberately scoped to the `controlled_document` home so Wave A, which
 * shares this door, is unaffected. Keep the claim narrow enough to stay true.
 */
export async function documentsWaveBEnabled(): Promise<boolean> {
  return featureEnabled('documents_wave_b')
}

/** Reserves a file object + upload session (server-derived path/tier/bucket)
 * and returns the short-TTL signed upload credential. */
export async function beginDocumentUpload(
  input: BeginDocumentUploadInput,
): Promise<BeginDocumentUploadResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('begin_document_upload', {
    p_resource_type: input.homeResourceType,
    p_resource_id: input.homeResourceId,
    p_title: input.title,
    p_description: input.description ?? undefined,
    p_confidentiality_level: input.confidentialityLevel ?? undefined,
    p_document_id: input.documentId ?? undefined,
    p_declared_file_name: input.declaredFileName,
    p_declared_mime: input.declaredMimeType,
    p_declared_size: input.declaredSizeBytes,
    p_kind: input.kind ?? undefined,
    p_occurred_on: input.occurredOn ?? undefined,
  })
  if (error || !data) return { ok: false, error: errCode(error) }

  const r = data as Record<string, string>
  // Coordinates never cross PostgREST: resolved here with the service client,
  // signed, and handed out only as a short-TTL credential.
  const admin = createAdminClient()
  const { data: file, error: fileError } = await admin
    .from('file_objects')
    .select('storage_bucket, storage_path')
    .eq('id', r.file_object_id)
    .single()
  if (fileError || !file) return { ok: false, error: 'unknown' }
  const { data: signed, error: signError } = await admin.storage
    .from(file.storage_bucket)
    .createSignedUploadUrl(file.storage_path)
  if (signError || !signed) return { ok: false, error: 'unknown' }

  return {
    ok: true,
    uploadSessionId: r.upload_session_id,
    documentId: r.document_id,
    documentVersionId: r.document_version_id,
    upload: {
      method: 'PUT',
      url: signed.signedUrl,
      headers: { 'x-upsert': 'false' },
      expiresAt: r.expires_at,
    },
  }
}

/** Confirms the PUT landed (server-derived size/MIME), then verifies the
 * bytes (sha256, service role) and binds the version file. Idempotent. */
export async function finalizeDocumentUpload(
  uploadSessionId: string,
): Promise<FinalizeDocumentUploadResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('finalize_document_upload', {
    p_upload_session_id: uploadSessionId,
  })
  if (error || !data) return { ok: false, error: errCode(error) }
  const r = data as Record<string, string>

  if (r.upload_state === 'unscanned_accepted' || r.upload_state === 'clean') {
    // Idempotent re-call after a completed verification.
    return {
      ok: true,
      documentId: r.document_id ?? '',
      documentVersionId: r.document_version_id,
      availability: 'available',
    }
  }

  if (r.upload_state === 'failed') {
    // QA r1 MAJOR-3: TERMINAL. `failed` has no outbound arc in the D9
    // machine (catalog: guard_file_object_transition) and the bytes are
    // immutable (Rule 6), so re-verifying cannot change the outcome — and
    // pre-fix, every retry click re-entered the branch below: a service-role
    // download of the WHOLE object, unaudited, ending in HC0D9. Short-circuit
    // with no download and no RPC; the only recovery is a NEW upload.
    return { ok: false, error: 'upload_incomplete', terminal: true }
  }

  // D9 verification — the service role is the byte verifier (SQL cannot hash).
  const admin = createAdminClient()
  const { data: file, error: fileError } = await admin
    .from('file_objects')
    .select('storage_bucket, storage_path')
    .eq('id', (data as Record<string, string>).file_object_id)
    .single()
  if (fileError || !file) return { ok: false, error: 'unknown' }
  const { data: blob, error: dlError } = await admin.storage
    .from(file.storage_bucket)
    .download(file.storage_path)
  let verified = false
  let sha = ''
  if (!dlError && blob) {
    sha = sha256Hex(await blob.arrayBuffer())
    verified = true
  }
  const { data: done, error: doneError } = await admin.rpc(
    'complete_document_upload_verification',
    { p_upload_session_id: uploadSessionId, p_sha256: sha, p_verified: verified },
  )
  if (doneError || !done) return { ok: false, error: errCode(doneError) }
  const d = done as Record<string, string>
  if (d.upload_state !== 'unscanned_accepted') {
    // The verifier just ruled: the file is now `failed` — terminal from the
    // FIRST failure (MAJOR-3), not only on the retry that discovers it.
    return { ok: false, error: 'upload_incomplete', terminal: true }
  }
  return {
    ok: true,
    documentId: d.document_id,
    documentVersionId: d.document_version_id,
    availability: 'available' satisfies DocumentAvailability,
  }
}

/** THE byte corridor: the door authorizes (kernel + D15 ceiling + serving
 * states) and audits; only then does this module sign, short-TTL. */
export async function openDocumentVersion(
  documentVersionId: string,
): Promise<OpenDocumentVersionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('open_document_version', {
    p_document_version_id: documentVersionId,
  })
  if (error || !data) return { ok: false, error: errCode(error) }
  const r = data as Record<string, string>

  const admin = createAdminClient()
  const { data: binding, error: bindError } = await admin
    .from('document_version_files')
    .select('file_objects ( storage_bucket, storage_path, sensitivity_tier )')
    .eq('document_version_id', documentVersionId)
    .eq('rendition_kind', 'source')
    .single()
  const file = binding?.file_objects
  if (bindError || !file) return { ok: false, error: 'unknown' }

  const ttl = SIGNED_URL_TTL_SECONDS[(file.sensitivity_tier as DocumentSensitivityTier) ?? 'phi']
  const fileName = downloadFileName(r.title ?? 'documento', r.mime_type ?? null)
  const { data: signed, error: signError } = await admin.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, ttl, { download: fileName })
  if (signError || !signed) return { ok: false, error: 'unknown' }

  return {
    ok: true,
    url: signed.signedUrl,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    fileName,
  }
}

/** Audited classification change (S1-O2). NO Wave-A UI surface (lead ruling):
 * server-side command + keystones only. */
export async function setDocumentConfidentiality(
  documentId: string,
  level: DocumentConfidentialityLevel | null,
): Promise<DocumentActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_document_confidentiality', {
    p_document_id: documentId,
    // NULL clears the label (legal SQL-side); the generated arg type has no
    // null because the SQL param carries no default — cast, not `any`.
    p_level: level as unknown as string,
  })
  return error ? { ok: false, error: errCode(error) } : { ok: true }
}

/** Requests disposition (D10): reads fail closed immediately; the disposal
 * job + service-only completion door do the verified deletion. */
export async function requestDocumentDisposition(
  documentId: string,
  reason: DocumentDispositionReason,
): Promise<DocumentActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_document_disposition', {
    p_document_id: documentId,
    p_reason: reason,
  })
  return error ? { ok: false, error: errCode(error) } : { ok: true }
}

/** Places a legal hold (audience = hold visibility: staff_admin-of-home or
 * tenancy admin). */
export async function placeDocumentHold(
  documentId: string,
  reason: DocumentHoldReason,
): Promise<DocumentActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('place_document_hold', {
    p_document_id: documentId,
    p_reason: reason,
  })
  return error ? { ok: false, error: errCode(error) } : { ok: true }
}

/** Releases a legal hold. */
export async function releaseDocumentHold(holdId: string): Promise<DocumentActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('release_document_hold', { p_hold_id: holdId })
  return error ? { ok: false, error: errCode(error) } : { ok: true }
}

/** Soft-deletes a document (honors holds — HC0D3). */
export async function softDeleteDocument(documentId: string): Promise<DocumentActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('soft_delete_document', { p_document_id: documentId })
  return error ? { ok: false, error: errCode(error) } : { ok: true }
}

/** Tier reclassification (S2.8, lead-approved shape — ADR 0118 §10):
 * copy → verify (sha of the COPIED bytes) → commit as a NEW VERSION
 * (append-only; no binding edited) → retire-source through the
 * evidence-gated duplicate lane. */
export async function reclassifyDocument(
  documentId: string,
  targetTier: DocumentSensitivityTier,
): Promise<DocumentActionState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reclassify_document', {
    p_document_id: documentId,
    p_target_tier: targetTier,
  })
  if (error || !data) return { ok: false, error: errCode(error) }
  const r = data as Record<string, string>

  const admin = createAdminClient()
  // COPY: download the source, hash what we actually move, upload to the
  // reserved target path — the hash we pass is of the bytes we wrote.
  const { data: oldFile } = await admin
    .from('file_objects')
    .select('storage_bucket, storage_path, mime_type')
    .eq('id', r.old_file_object_id)
    .single()
  const { data: newFile } = await admin
    .from('file_objects')
    .select('storage_bucket, storage_path')
    .eq('id', r.new_file_object_id)
    .single()
  if (!oldFile || !newFile) return { ok: false, error: 'unknown' }
  const { data: blob, error: dlError } = await admin.storage
    .from(oldFile.storage_bucket)
    .download(oldFile.storage_path)
  if (dlError || !blob) return { ok: false, error: 'upload_incomplete' }
  const bytes = await blob.arrayBuffer()
  const sha = sha256Hex(bytes)
  const { error: upError } = await admin.storage
    .from(newFile.storage_bucket)
    .upload(newFile.storage_path, bytes, {
      contentType: oldFile.mime_type ?? 'application/octet-stream',
      upsert: false,
    })
  if (upError) return { ok: false, error: 'upload_incomplete' }

  const { error: commitError } = await admin.rpc('complete_document_reclassification', {
    p_document_version_id: r.new_document_version_id,
    p_new_file_object_id: r.new_file_object_id,
    p_old_file_object_id: r.old_file_object_id,
    p_sha256: sha,
  })
  if (commitError) return { ok: false, error: errCode(commitError) }

  // RETIRE-SOURCE: Storage-API delete, then the verified disposal (the
  // evidence-gated duplicate lane — the live successor is the evidence).
  const { error: rmError } = await admin.storage
    .from(oldFile.storage_bucket)
    .remove([oldFile.storage_path])
  if (rmError) return { ok: false, error: 'unknown' }
  const { error: disposeError } = await admin.rpc('complete_document_disposal', {
    p_file_object_id: r.old_file_object_id,
  })
  if (disposeError) return { ok: false, error: errCode(disposeError) }
  return { ok: true }
}
