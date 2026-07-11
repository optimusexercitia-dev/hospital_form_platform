'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { featureEnabled } from '@/lib/queries/feature-flags'
import {
  ATTACHMENT_KINDS,
  bucketForTier,
  defaultKind,
  effectiveTier,
  type AttachmentActionState,
  type AttachmentOwnerType,
  type AttachmentTier,
  type ConfidentialityLabel,
  type OpenAttachmentResult,
  type PhiDisposalReason,
  type UploadAttachmentState,
} from '@/lib/attachments/constants'

/**
 * Centralized-attachments SERVER ACTIONS (Phase F2; ADR 0063). Contract-first: the
 * frontend builds against these signatures. All mutating RPCs are DEFINER + flag-gated
 * (`app.assert_attachments_enabled`), so every action is inert while the `attachments`
 * flag is OFF (pre-pilot). Raw Postgres errors never reach the UI (Rule 10).
 *
 * PHI door (§C): `openAttachment` calls the audited `open_attachment` RPC, which returns
 * the (bucket, path) ONLY to an authorized reader (NULL-out-of-scope otherwise) and writes
 * exactly one `attachment.read` for a phi open. The blob is then signed with the SERVICE
 * ROLE (`createAdminClient`) — the only reader of the phi bucket.
 *
 * A `'use server'` module may export ONLY async functions — shared result types live in
 * `./constants` (a pure module safe for client import).
 */

const SIGNED_URL_TTL_SECONDS = 3600
const MAX_BYTES = 25 * 1024 * 1024 // mirrors the buckets' 25 MiB limit

// MIME → extension (mirrors the two buckets' superset allow-list).
const ALLOWED_MIME = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.ms-powerpoint', 'ppt'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  ['text/csv', 'csv'],
  ['text/plain', 'txt'],
])

const MESSAGES = {
  unavailable: 'O recurso de anexos ainda não está disponível.',
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missing: 'Anexo não encontrado.',
  titleRequired: 'Informe um título para o anexo.',
  ownerRequired: 'Recurso de destino inválido.',
  kindInvalid: 'Tipo de documento inválido para este anexo.',
  fileRequired: 'Selecione um arquivo.',
  fileTooLarge: 'O arquivo excede o tamanho máximo de 25 MB.',
  fileTypeInvalid: 'Envie um PDF, imagem, documento Office, CSV ou texto.',
  reasonInvalid: 'Motivo de descarte inválido.',
  uploadFailed: 'Não foi possível enviar o arquivo. Tente novamente.',
  added: 'Anexo adicionado com sucesso.',
  removed: 'Anexo removido.',
  reclassified: 'Classificação do anexo atualizada.',
  disposed: 'Dados do anexo descartados.',
} as const

const OWNER_TYPES: AttachmentOwnerType[] = [
  'case',
  'meeting',
  'interview',
  'action_item',
  'form_upload',
]
const DISPOSAL_REASONS: PhiDisposalReason[] = [
  'retention_expired',
  'subject_request',
  'entered_in_error',
  'duplicate',
  'other',
]

/** Whether the `attachments` feature flag is on (gates all reachability). */
export async function attachmentsEnabled(): Promise<boolean> {
  return featureEnabled('attachments')
}

/**
 * Upload + record a new attachment. `useActionState`-shaped. Fields: `ownerType`,
 * `ownerId`, `title`, `file`, and optional `kind`, `description`, `occurredOn`, `tier`,
 * `label`. Uploads to a FRESH immutable path `{ownerType}/{ownerId}/{uuid}.{ext}` in the
 * tier bucket (Rule 6), then calls `create_attachment` (which re-validates + inserts).
 */
export async function createAttachment(
  _prev: UploadAttachmentState | undefined,
  formData: FormData,
): Promise<UploadAttachmentState> {
  const ownerType = String(formData.get('ownerType') ?? '') as AttachmentOwnerType
  const ownerId = String(formData.get('ownerId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const occurredOn = String(formData.get('occurredOn') ?? '').trim()
  const rawKind = String(formData.get('kind') ?? '').trim()
  const rawTier = String(formData.get('tier') ?? '').trim()
  const rawLabel = String(formData.get('label') ?? '').trim()
  const file = formData.get('file')

  if (!OWNER_TYPES.includes(ownerType) || ownerType === 'form_upload' || !ownerId) {
    return { ok: false, error: MESSAGES.ownerRequired }
  }
  if (!title) return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }

  const kind = rawKind || defaultKind(ownerType)
  if (!ATTACHMENT_KINDS[ownerType].includes(kind)) {
    return { ok: false, fieldErrors: { kind: MESSAGES.kindInvalid } }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileRequired } }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileTooLarge } }
  }
  const ext = ALLOWED_MIME.get(file.type)
  if (!ext) return { ok: false, fieldErrors: { file: MESSAGES.fileTypeInvalid } }

  if (!(await attachmentsEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const label = (rawLabel || null) as ConfidentialityLabel | null
  const requestedTier = (rawTier || null) as AttachmentTier | null
  const tier = effectiveTier(ownerType, label, requestedTier)
  const bucket = bucketForTier(tier)
  const path = `${ownerType}/${ownerId}/${crypto.randomUUID()}.${ext}`

  const supabase = await createClient()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: MESSAGES.uploadFailed }

  // create_attachment returns a single `public.attachments` composite (not a set).
  const { data, error } = await supabase.rpc('create_attachment', {
    p_owner_type: ownerType,
    p_owner_id: ownerId,
    p_storage_path: path,
    p_title: title,
    p_kind: kind,
    p_description: description || undefined,
    p_occurred_on: occurredOn || undefined,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_sensitivity_tier: tier,
    p_confidentiality_label: label ?? undefined,
  })

  if (error || !data) {
    // The object landed but the row failed — orphan tolerated (Rule 6; no GC in v1).
    return { ok: false, error: MESSAGES.generic }
  }

  return { ok: true, error: MESSAGES.added, attachmentId: data.id }
}

/**
 * The AUDITED PHI-read door. Returns a short-lived signed URL, or `null` when the caller
 * may not read it / it is missing / infected / soft-deleted (NULL-out-of-scope). A phi
 * open writes exactly one `attachment.read`; the blob is signed with the service role
 * (the only reader of the phi bucket). Standard blobs are signed the same way here.
 */
export async function openAttachment(id: string): Promise<OpenAttachmentResult> {
  if (!id) return { signedUrl: null }
  if (!(await attachmentsEnabled())) return { signedUrl: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('open_attachment', { p_id: id })
    .returns<{ bucket: string; path: string }[]>()

  if (error || !data || data.length === 0) return { signedUrl: null } // NULL-out-of-scope
  const { bucket, path } = data[0]

  // Service-role signs both tiers; it is the ONLY reader of the phi bucket.
  const admin = createAdminClient()
  const { data: signed } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return { signedUrl: signed?.signedUrl ?? null }
}

/**
 * Reclassify an attachment's tier (§F). Escalate (→ phi) = any writer; DECLASSIFY
 * (phi → standard) = staff_admin/org-admin only (enforced in the RPC). Audited as
 * `attachment.reclassified`. The caller (Next) must re-home the object across buckets
 * around this call (copy → this → remove-source; Rule-6 PHI-safety exception).
 */
export async function reclassifyAttachment(
  id: string,
  newTier: AttachmentTier,
  newLabel?: ConfidentialityLabel,
): Promise<AttachmentActionState> {
  if (!id) return { ok: false, error: MESSAGES.missing }
  if (!(await attachmentsEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reclassify_attachment', {
    p_id: id,
    p_new_tier: newTier,
    p_new_label: newLabel ?? undefined,
  })
  if (error) return { ok: false, error: MESSAGES.forbidden }
  return { ok: true, error: MESSAGES.reclassified }
}

/** Soft-delete an attachment (row hidden; storage object retained — Rule 6). */
export async function softDeleteAttachment(id: string): Promise<AttachmentActionState> {
  if (!id) return { ok: false, error: MESSAGES.missing }
  if (!(await attachmentsEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('soft_delete_attachment', { p_id: id })
  if (error) return { ok: false, error: MESSAGES.generic }
  return { ok: true, error: MESSAGES.removed }
}

/**
 * Dispose an attachment's PHI (redact title/description; retain the object — Rule 6).
 * Hard-rejects a legal-hold row (HC098) and a double-dispose (HC097) in the RPC.
 */
export async function disposeAttachmentPhi(
  id: string,
  reason: PhiDisposalReason,
): Promise<AttachmentActionState> {
  if (!id) return { ok: false, error: MESSAGES.missing }
  if (!DISPOSAL_REASONS.includes(reason)) {
    return { ok: false, error: MESSAGES.reasonInvalid }
  }
  if (!(await attachmentsEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('dispose_attachment_phi', {
    p_id: id,
    p_reason: reason,
  })
  if (error) return { ok: false, error: MESSAGES.generic }
  return { ok: true, error: MESSAGES.disposed }
}
