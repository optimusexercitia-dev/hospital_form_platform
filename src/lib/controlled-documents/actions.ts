'use server'

import { revalidatePath } from 'next/cache'

import {
  beginDocumentUpload,
  finalizeDocumentUpload,
  openDocumentVersion,
} from '@/lib/documents/actions'
import type {
  DocumentActionErrorCode,
  DocumentUploadCredential,
  OpenDocumentVersionResult,
} from '@/lib/documents/types'
import { createClient } from '@/lib/supabase/server'

/**
 * Controlled-document server actions (Phase 17; Architecture Rules 6, 9, 10, 11).
 *
 * Every write routes through a SECURITY DEFINER RPC (posture (b) — the tables have
 * no direct write grant). Authoring (create/edit/add-version/submit/publish/
 * supersede/obsolete) is `is_staff_admin_of OR is_tenancy_admin_of`, enforced in
 * the RPC — the sole authority (no client pre-check). Approve/reject is SIGN-OWN-ROW:
 * only a named, entitled (active same-hospital), still-pending approver may decide,
 * enforced in the RPC. All writes are AUDITED (Rule 11).
 *
 * The storage upload is IMMUTABLE (Rule 6): every version gets a NEW path
 * `{commission_id}/{document_id}/{uuid}.{ext}`; objects are never overwritten. The
 * upload precedes the metadata RPC; if the RPC then fails the object is orphaned but
 * never overwritten (Rule 6 — orphans tolerated, no GC in v1), never a racy
 * post-create round-trip (memory `phi-write-atomic-with-create`; PHI-free here but
 * the same discipline applies).
 *
 * `useActionState`-shaped `{ ok, error?, fieldErrors? }`. pt-BR strings (Rule 10);
 * raw Postgres errors never reach the UI (§8). SQLSTATEs HC089–HC093 mapped below.
 */

/** `useActionState`-shaped result (the indicators/action-items-hub convention). */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Create/update return the document id so the UI can route to its detail.
 *
 * `versionId` (DM3, lead-ruled 2026-08-13): the draft version minted alongside
 * the header. The wizard needs BOTH ids before it can call
 * {@link beginControlledVersionUpload}, because on the DM2 substrate the
 * document and version must exist before an upload can be reserved — so
 * "create + upload + submit" is not expressible as one atomic server action and
 * the wizard orchestrates the chain client-side. `create_controlled_document`
 * already returns the whole row; this stops discarding its `current_version_id`.
 */
export interface CreateDocumentState extends ActionState {
  documentId?: string
  versionId?: string
}

/** Add-version returns the new version id so the UI can route/refresh. */
export interface AddVersionState extends ActionState {
  versionId?: string
}

/**
 * The revise-in-place terminal state (the `changes_requested` wizard). Returns the
 * `documentId` so the FE can (re)land on the document detail after a partial-failure.
 */
export interface ReviseDocumentState extends ActionState {
  documentId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'O recurso de documentos controlados não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',
  notFound: 'Documento não encontrado.',
  titleRequired: 'Informe o título do documento.',
  commissionRequired: 'Comissão não encontrada.',
  docTypeRequired: 'Selecione o tipo de documento.',
  cycleInvalid: 'Informe um ciclo de revisão válido (meses).',
  fileRequired: 'Selecione o arquivo do documento.',
  summaryRequired: 'Descreva as alterações desta versão.',
  fileTooLarge: 'O arquivo excede o tamanho máximo (25 MB).',
  fileTypeInvalid: 'Tipo de arquivo não permitido.',
  uploadFailed: 'Falha ao enviar o arquivo. Tente novamente.',
  approversRequired: 'Informe ao menos um aprovador.',
  dateInvalid: 'Informe uma data válida.',
  wrongState: 'Esta operação não é permitida no estado atual do documento.',
  publishPending: 'Todos os aprovadores devem aprovar antes da publicação.',
  approverNotEntitled: 'Aprovador não pertence a este hospital ou está inativo.',
  duplicateApprover: 'Há aprovadores duplicados na lista.',
  frozenSet: 'O conjunto de aprovadores está congelado durante a aprovação.',
  created: 'Documento criado.',
  updated: 'Documento atualizado.',
  versionAdded: 'Versão adicionada.',
  submitted: 'Documento enviado para aprovação.',
  approved: 'Documento aprovado.',
  rejected: 'Documento rejeitado.',
  published: 'Documento publicado.',
  superseded: 'Nova versão criada.',
  obsoleted: 'Documento tornado obsoleto.',
  remindSent: 'Lembrete enviado.',
  remindSkipped: 'Lembrete já enviado recentemente.',
  // Partial-failure banners for the chained create (B3): the draft is saved and
  // recoverable — the user is landed on its detail to finish the missing step.
  draftSavedUploadLater: 'Rascunho salvo, mas o arquivo não foi anexado. Anexe-o na página do documento.',
  draftSavedSubmitLater: 'Rascunho salvo, mas o envio para aprovação não foi concluído. Conclua na página do documento.',
  // Partial-failure banner for the revise-in-place chain (the file WAS updated on the
  // changes_requested version, but the re-submit did not complete).
  revisionSavedSubmitLater: 'Arquivo da revisão atualizado, mas o reenvio para aprovação não foi concluído. Conclua na página do documento.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_FORBIDDEN = '42501'
const PG_UNIQUE_VIOLATION = '23505'

// (The MIME→extension map and the 25 MB cap died with `uploadDocumentFile` —
// DM3. They mirrored the RETIRED `controlled-documents` bucket, and both caps
// are now server-derived: `begin_document_upload` validates the declared hints
// against `storage.buckets` for the tier it picks, and `finalize` re-derives
// size/MIME/hash from the bytes that actually landed. The client-side mirrors
// live in `DOCUMENT_MAX_SIZE_BYTES` / `DOCUMENT_ACCEPTED_MIME_TYPES`
// (`@/lib/documents/types`) so the dialog can refuse before the wait.)

/**
 * Map a controlled-document RPC error (SQLSTATE HC089–HC093 + generic) to a pt-BR
 * string. NEVER returns a raw `error.message` — an HCxxx code maps to a fixed pt-BR
 * message; anything else (including any CHECK-violation message, which may be a raw
 * Postgres string) falls back to the generic pt-BR string so a raw Postgres error can
 * never reach the UI (§8, Rule 10).
 */
function mapDocumentError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case 'HC089':
      return MESSAGES.wrongState
    case 'HC090':
      return MESSAGES.publishPending
    case 'HC091':
      return MESSAGES.approverNotEntitled
    case 'HC092':
      return MESSAGES.duplicateApprover
    case 'HC093':
      return MESSAGES.frozenSet
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.duplicateApprover
    // A CHECK-violation (23514) message may be a raw Postgres string OR our
    // "não encontrado"/"não está disponível" — never echo it; use generic pt-BR.
    case PG_CHECK_VIOLATION:
      return MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// --- form-field parsing helpers -------------------------------------------

/** Parse an optional ISO date (YYYY-MM-DD). `undefined` empty, `null` invalid. */
function parseDate(raw: FormDataEntryValue | null): string | undefined | null {
  const t = String(raw ?? '').trim()
  if (!t) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) return null
  return t
}

/** Parse an optional positive integer field. `undefined` empty, `null` invalid. */
function parseOptionalPositiveInt(raw: FormDataEntryValue | null): number | undefined | null {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  const n = Number(s)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

/** Parse the optional free-text `category` field — trimmed, or `undefined` if blank. */
function parseCategory(raw: FormDataEntryValue | null): string | undefined {
  const t = String(raw ?? '').trim()
  return t || undefined
}

/**
 * Parse the optional `tags` field (a JSON array of strings, the TagField convention).
 * Trims + de-dupes + drops blanks; `undefined` when absent/empty/malformed (the RPC
 * defaults to `{}`). Never throws — a malformed value degrades to no tags.
 */
function parseTags(raw: FormDataEntryValue | null): string[] | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed)) return undefined
  const tags = Array.from(
    new Set(parsed.map((t) => (typeof t === 'string' ? t.trim() : '')).filter((t) => t.length > 0)),
  )
  return tags.length > 0 ? tags : undefined
}

const DOCUMENTS_PATH = '/o/[org]/c/[commission]/manage/documentos'
const DOCUMENT_DETAIL_PATH = '/o/[org]/c/[commission]/manage/documentos/[documentId]'
const PENDING_PATH = '/o/[org]/documentos-pendentes'

function revalidateDocuments(): void {
  revalidatePath(DOCUMENTS_PATH, 'page')
  revalidatePath(DOCUMENT_DETAIL_PATH, 'page')
  revalidatePath(PENDING_PATH, 'page')
}

// ---------------------------------------------------------------------------
// Authoring (staff_admin OR commission_admin — RPC-enforced)
// ---------------------------------------------------------------------------

/**
 * Create a controlled document (header) with an initial `draft` version. Fields:
 * `commissionId`, `title`, `docType`, optional `reviewCycleMonths`. Routes to
 * `create_controlled_document`; mints the per-commission `code`. Returns
 * `documentId`.
 */
export async function createControlledDocument(
  _prev: CreateDocumentState | undefined,
  formData: FormData,
): Promise<CreateDocumentState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const docType = String(formData.get('docType') ?? '')
  const reviewCycleMonths = parseOptionalPositiveInt(formData.get('reviewCycleMonths'))

  if (!commissionId) return { ok: false, error: MESSAGES.commissionRequired }
  if (!title) return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  if (!docType) return { ok: false, fieldErrors: { docType: MESSAGES.docTypeRequired } }
  if (reviewCycleMonths === null) {
    return { ok: false, fieldErrors: { reviewCycleMonths: MESSAGES.cycleInvalid } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_controlled_document', {
    p_commission: commissionId,
    p_title: title,
    p_doc_type: docType,
    p_review_cycle_months: reviewCycleMonths ?? undefined,
    p_category: parseCategory(formData.get('category')),
    p_tags: parseTags(formData.get('tags')),
    p_description: parseCategory(formData.get('description')),
  })

  if (error || !data) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.created, documentId: data.id }
}

/**
 * Edit a document's header metadata (title/doc_type/review cycle). Expects a hidden
 * `documentId` field plus the same fields as create. Routes to
 * `update_controlled_document` — editable ONLY while the current version is `draft`
 * (HC089 otherwise). Returns the `documentId` (create-state shape) so the editar page
 * can route back to the detail.
 */
export async function updateControlledDocument(
  _prev: CreateDocumentState | undefined,
  formData: FormData,
): Promise<CreateDocumentState> {
  const id = String(formData.get('documentId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const docType = String(formData.get('docType') ?? '')
  const reviewCycleMonths = parseOptionalPositiveInt(formData.get('reviewCycleMonths'))

  if (!id) return { ok: false, error: MESSAGES.notFound }
  if (!title) return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  if (!docType) return { ok: false, fieldErrors: { docType: MESSAGES.docTypeRequired } }
  if (reviewCycleMonths === null) {
    return { ok: false, fieldErrors: { reviewCycleMonths: MESSAGES.cycleInvalid } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('update_controlled_document', {
    p_id: id,
    p_title: title,
    p_doc_type: docType,
    p_review_cycle_months: reviewCycleMonths ?? undefined,
    p_category: parseCategory(formData.get('category')),
    p_tags: parseTags(formData.get('tags')),
    p_description: parseCategory(formData.get('description')),
  })

  if (error || !data) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.updated, documentId: data.id }
}

// ---------------------------------------------------------------------------
// DM3 Wave B — the three-step file flow (ADR 0114 D8; plan §7)
//
// `addDocumentVersion` is GONE. It uploaded the bytes SERVER-side and then
// pointed the domain row at a raw `storage_path`; both halves of that are
// retired (M4/M5). The replacement is the DM2 corridor:
//
//   beginControlledVersionUpload   → reserve a core version + a signed PUT
//   (client uploads the bytes)     → uploadDocumentFile from
//                                    @/lib/documents/upload-client
//   finalizeControlledVersionUpload→ server-verifies size/MIME/hash, then
//                                    points the domain version at the core one
//
// The bucket and path never cross this boundary (ADR 0118 §1).
// ---------------------------------------------------------------------------

/** What the client needs to PUT the bytes, plus the ids to finalize with. */
export interface BeginControlledVersionUploadInput {
  commissionId: string
  /** `controlled_documents.id` — also its `securable_resources.id` (shared PK). */
  documentId: string
  /** `controlled_document_versions.id` — the DOMAIN version being filled. */
  versionId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export type BeginControlledVersionUploadResult =
  | {
      ok: true
      credential: DocumentUploadCredential
      coreDocumentVersionId: string
      /**
       * ⚠ ADDED to the §7 sketch (lead + frontend notified): §7 omitted it, and
       * without it {@link finalizeControlledVersionUpload} is uncallable — the
       * finalize step is keyed on the upload SESSION, not on the version.
       */
      uploadSessionId: string
    }
  | { ok: false; error: string; code: DocumentActionErrorCode }

/**
 * Finalize's state: {@link AddVersionState} plus the MAJOR-3 `terminal` flag,
 * carried through from the core contract. `terminal: true` means the bytes
 * landed but FAILED verification — the reservation is spent and re-running
 * finalize can never succeed, so the dialog must not offer "Tentar novamente".
 * Absent = retryable (e.g. a PUT that left no object).
 */
export interface FinalizeControlledVersionUploadState extends AddVersionState {
  terminal?: boolean
}

/**
 * Reserve a core `document_versions` row + `file_objects` path for a controlled
 * document version and return the upload credential. Wraps
 * `begin_document_upload(p_resource_type := 'controlled_document')`, which
 * derives the tier SERVER-side — a controlled document is always `standard`,
 * and `reclassify_document` refuses to move it to `phi` (HC0DH, M6).
 *
 * Returns a machine `code` on the failure arm so the caller can render its own
 * pt-BR copy; `finalizeControlledVersionUpload` returns a pre-rendered string.
 */
export async function beginControlledVersionUpload(
  input: BeginControlledVersionUploadInput,
): Promise<BeginControlledVersionUploadResult> {
  const doc = await getControlledCoreDocumentId(input.documentId)
  if (!doc) return { ok: false, error: MESSAGES.notFound, code: 'not_found' }

  const begun = await beginDocumentUpload({
    homeResourceType: 'controlled_document',
    homeResourceId: input.documentId,
    documentId: doc,
    title: input.fileName,
    kind: 'documento_controlado',
    declaredFileName: input.fileName,
    declaredMimeType: input.mimeType,
    declaredSizeBytes: input.sizeBytes,
  })
  if (!begun.ok) {
    // The core returns the CODE in `error`; this wrapper's contract is a
    // machine code PLUS a fallback pt-BR string (§7), so the component layer
    // can render its own copy per code without inventing one for the default.
    return { ok: false, error: MESSAGES.generic, code: begun.error }
  }

  return {
    ok: true,
    credential: begun.upload,
    coreDocumentVersionId: begun.documentVersionId,
    uploadSessionId: begun.uploadSessionId,
  }
}

/**
 * Verify the uploaded bytes server-side and point the DOMAIN version at the
 * core one. Two RPCs: `finalize_document_upload` (derives + verifies
 * size/MIME/hash — caller-supplied values are hints, never trusted) then
 * `attach_controlled_document_version_file`, which re-checks staff-admin
 * authority and the draft/changes_requested freeze (HC089).
 */
export async function finalizeControlledVersionUpload(input: {
  versionId: string
  uploadSessionId: string
  coreDocumentVersionId: string
  summaryOfChangesMd?: string | null
  expiryDate?: string | null
}): Promise<FinalizeControlledVersionUploadState> {
  const finalized = await finalizeDocumentUpload(input.uploadSessionId)
  if (!finalized.ok) {
    return {
      ok: false,
      error: finalized.error === 'file_too_large' ? MESSAGES.fileTooLarge
        : finalized.error === 'file_type_not_allowed' ? MESSAGES.fileTypeInvalid
        : finalized.error === 'forbidden' ? MESSAGES.forbidden
        : finalized.error === 'not_found' ? MESSAGES.notFound
        : MESSAGES.uploadFailed,
      terminal: finalized.terminal,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('attach_controlled_document_version_file', {
    p_version_id: input.versionId,
    p_core_version_id: input.coreDocumentVersionId,
    p_summary_of_changes_md: input.summaryOfChangesMd?.trim() || undefined,
    p_expiry_date: input.expiryDate ?? undefined,
  })
  if (error || !data) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.versionAdded, versionId: data.id }
}

/**
 * Authorize and sign a short-TTL download for ANY version of a controlled
 * document — current or PRIOR. Takes the DOMAIN
 * `controlled_document_versions.id`; the core version is resolved from the
 * pointer here so callers never handle core ids.
 *
 * Replaces `createSignedDownloadUrl`. Authority is now checked at CALL time by
 * `open_document_version` (member OR entitled approver, via the kernel arm),
 * which also refuses disposed/non-servable state and emits the D11 audit row.
 * Prior-version downloads keep working because the door takes a version id and
 * never consults `current_version_id`.
 */
export async function openControlledDocumentVersion(
  versionId: string,
): Promise<OpenDocumentVersionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('controlled_document_versions')
    .select('core_document_version_id')
    .eq('id', versionId)
    .maybeSingle<{ core_document_version_id: string | null }>()

  if (error || !data?.core_document_version_id) {
    // Absence ≡ denial: an unreadable version and an unbound one are reported
    // identically, matching the door's own oracle-kill. `error` carries the
    // machine CODE here (the core OpenDocumentVersionResult contract) — the UI
    // owns the pt-BR wording.
    return { ok: false, error: 'not_found' }
  }
  return openDocumentVersion(data.core_document_version_id)
}

/** The core `documents.id` a controlled document owns (DM3 M3), or `null`. */
async function getControlledCoreDocumentId(documentId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('controlled_documents')
    .select('core_document_id')
    .eq('id', documentId)
    .maybeSingle<{ core_document_id: string | null }>()
  return data?.core_document_id ?? null
}

/**
 * Submit a `draft` version for approval, naming its approvers. Fields:
 * `versionId`, `approvers` (a JSON array of `{ approver_id, approver_title? }` —
 * each MUST be an active same-hospital user). Routes to
 * `submit_document_for_approval` (→ `in_approval`; delete-then-insert the pending
 * rows that GRANT READ; rejects foreign-hospital/inactive/duplicate approvers).
 */
/** The snake_case approver element the `submit_document_for_approval` RPC reads. */
type ApproverPayload = { approver_id: string; approver_title: string | null }

/**
 * Parse + camel→snake the `approvers` JSON field (BUG-DOC-003): the client form emits
 * the app-layer camelCase contract (`{approverId, approverTitle}`, matching
 * `ApproverCandidate`), but the RPC reads snake_case. Rejects a malformed/empty list
 * with a pt-BR error rather than letting a NULL id reach the RPC (which would surface
 * as the misleading HC091 "not entitled"). The FRONTEND form stays camelCase.
 */
function parseApprovers(raw: FormDataEntryValue | null): { payload: ApproverPayload[] } | { error: string } {
  let approvers: unknown
  try {
    approvers = JSON.parse(String(raw ?? '[]'))
  } catch {
    return { error: MESSAGES.approversRequired }
  }
  if (!Array.isArray(approvers) || approvers.length === 0) {
    return { error: MESSAGES.approversRequired }
  }
  const payload: ApproverPayload[] = []
  for (const el of approvers) {
    const a = el as { approverId?: unknown; approverTitle?: unknown }
    const approverId = typeof a.approverId === 'string' ? a.approverId.trim() : ''
    if (!approverId) return { error: MESSAGES.approversRequired }
    const approverTitle =
      typeof a.approverTitle === 'string' && a.approverTitle.trim() ? a.approverTitle.trim() : null
    payload.push({ approver_id: approverId, approver_title: approverTitle })
  }
  return { payload }
}

export async function submitDocumentForApproval(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get('versionId') ?? '')
  if (!versionId) return { ok: false, error: MESSAGES.notFound }

  const parsed = parseApprovers(formData.get('approvers'))
  if ('error' in parsed) return { ok: false, error: parsed.error }

  const proposedEffectiveDate = parseDate(formData.get('proposedEffectiveDate'))
  const approvalDueDate = parseDate(formData.get('approvalDueDate'))
  if (proposedEffectiveDate === null) {
    return { ok: false, fieldErrors: { proposedEffectiveDate: MESSAGES.dateInvalid } }
  }
  if (approvalDueDate === null) {
    return { ok: false, fieldErrors: { approvalDueDate: MESSAGES.dateInvalid } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_document_for_approval', {
    p_version_id: versionId,
    p_approvers: parsed.payload as never,
    p_proposed_effective_date: proposedEffectiveDate ?? undefined,
    p_approval_due_date: approvalDueDate ?? undefined,
  })

  if (error) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.submitted }
}

// ---------------------------------------------------------------------------
// E-signature (sign-own-row — RPC-enforced)
// ---------------------------------------------------------------------------

/**
 * Record the caller's `aprovado` decision on a version they were named on. Fields:
 * `versionId`, optional `note`. Routes to `approve_document` (sign-own-row; computes
 * `signature_hash` = sha256 over storagePath:approver_id:decision, where the
 * path is now resolved through the core binding by
 * `app.controlled_version_source_path` — the DOMAIN column is gone (DM3 M4).
 * The basis is unchanged on purpose: it stays an immutable storage path rather
 * than moving to `file_objects.sha256`, because re-basing an existing
 * e-signature is a semantic change to a signing artifact (FUP-DM3-SIGBASIS).
 */
export async function approveDocument(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get('versionId') ?? '')
  if (!versionId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_document', {
    p_version_id: versionId,
    p_note: String(formData.get('note') ?? '').trim() || undefined,
  })

  if (error) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.approved }
}

/**
 * Record the caller's `rejeitado` decision on a version they were named on. Fields:
 * `versionId`, `note` (the reason, surfaced on the returned draft). Routes to
 * `reject_document` (sign-own-row; returns the version to `draft` with the note).
 */
export async function rejectDocument(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get('versionId') ?? '')
  if (!versionId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_document', {
    p_version_id: versionId,
    p_note: String(formData.get('note') ?? '').trim() || undefined,
  })

  if (error) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.rejected }
}

// ---------------------------------------------------------------------------
// Publish / supersede / obsolete (staff_admin OR commission_admin — RPC-enforced)
// ---------------------------------------------------------------------------

/**
 * Publish an approved version (→ `effective`). Requires ALL named approvers
 * `aprovado` (else HC090). Fields: `versionId`, optional `effectiveDate`,
 * `reviewDueDate` override, `expiryDate`. Routes to `publish_document` (sets
 * `effective_date`; computes `review_due_date = effective + review_cycle_months`
 * unless overridden; repoints the header + retires the prior effective version).
 */
export async function publishDocument(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get('versionId') ?? '')
  const effectiveDate = parseDate(formData.get('effectiveDate'))
  const reviewDueDate = parseDate(formData.get('reviewDueDate'))
  const expiryDate = parseDate(formData.get('expiryDate'))

  if (!versionId) return { ok: false, error: MESSAGES.notFound }
  if (effectiveDate === null) return { ok: false, fieldErrors: { effectiveDate: MESSAGES.dateInvalid } }
  if (reviewDueDate === null) return { ok: false, fieldErrors: { reviewDueDate: MESSAGES.dateInvalid } }
  if (expiryDate === null) return { ok: false, fieldErrors: { expiryDate: MESSAGES.dateInvalid } }

  const supabase = await createClient()
  const { error } = await supabase.rpc('publish_document', {
    p_version_id: versionId,
    p_effective_date: effectiveDate ?? undefined,
    p_review_due_date: reviewDueDate ?? undefined,
    p_expiry_date: expiryDate ?? undefined,
  })

  if (error) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.published }
}

/**
 * Supersede the current `effective` version with a NEW draft version. Fields:
 * `documentId`. Routes to `supersede_document` (creates the next `draft` version;
 * the prior stays `effective` until the new one publishes). Returns `versionId`.
 *
 * This is STEP 1 of the wizard's new-version path (DM3); the bytes follow as
 * {@link beginControlledVersionUpload} → PUT →
 * {@link finalizeControlledVersionUpload} → {@link submitDocumentForApproval}.
 * (Previously this line pointed at `addDocumentVersion`, which DM3 deleted.)
 */
export async function supersedeDocument(
  _prev: AddVersionState | undefined,
  formData: FormData,
): Promise<AddVersionState> {
  const documentId = String(formData.get('documentId') ?? '')
  if (!documentId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('supersede_document', { p_document_id: documentId })

  if (error || !data) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.superseded, versionId: data.id }
}

/**
 * Mark a document's current version `obsolete` (retire without a replacement).
 * Routes to `mark_document_obsolete`. The version is retained + downloadable.
 */
export async function markDocumentObsolete(documentId: string): Promise<ActionState> {
  if (!documentId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_document_obsolete', { p_document_id: documentId })

  if (error) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.obsoleted }
}

// ---------------------------------------------------------------------------
// B3 · Create (ADR 0081 decision 1 — NO new RPC), rewired by DM3
// ---------------------------------------------------------------------------
//
// ⚠ REWRITTEN (DM3). This section previously described a SERVER-side chain
// (`create → uploadDocumentFile → set_document_version_file → submit`) run by
// `createAndSubmitDocument`. Every element of that sentence is now retired: the
// upload helper, the RPC, and the composite verb itself. What survives here is
// `createDraftOnly` — metadata only, step 1 of the wizard's create path.
//
// The chain still exists, but the CLIENT drives it (it cannot be one server
// action: the document and version must EXIST before an upload can be
// reserved):
//   createDraftOnly → beginControlledVersionUpload → PUT →
//   finalizeControlledVersionUpload → submitDocumentForApproval
//
// The ADR 0081 non-atomicity risk is unchanged in KIND and narrower in scope:
// nothing spans Storage + DB in one action any more, and a failure after
// `createDraftOnly` leaves a recoverable draft the UI can land on — the file
// simply has not been attached yet, which `availability: 'pending'` already
// renders. A future orchestration RPC is still noted, not built.

/** Read + validate the shared create fields. `{error}`/`{fieldErrors}` on failure. */
function readCreateFields(
  formData: FormData,
): { commissionId: string; title: string; docType: string; reviewCycleMonths: number | undefined } | CreateDocumentState {
  const commissionId = String(formData.get('commissionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const docType = String(formData.get('docType') ?? '')
  const reviewCycleMonths = parseOptionalPositiveInt(formData.get('reviewCycleMonths'))

  if (!commissionId) return { ok: false, error: MESSAGES.commissionRequired }
  if (!title) return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  if (!docType) return { ok: false, fieldErrors: { docType: MESSAGES.docTypeRequired } }
  if (reviewCycleMonths === null) return { ok: false, fieldErrors: { reviewCycleMonths: MESSAGES.cycleInvalid } }
  return { commissionId, title, docType, reviewCycleMonths: reviewCycleMonths ?? undefined }
}

/**
 * Create the header + its initial draft version via `create_controlled_document`
 * (passing category/tags). Returns the created ids or a mapped error state.
 */
async function createDocumentRow(
  fields: { commissionId: string; title: string; docType: string; reviewCycleMonths: number | undefined },
  formData: FormData,
): Promise<{ documentId: string; versionId: string } | CreateDocumentState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_controlled_document', {
    p_commission: fields.commissionId,
    p_title: fields.title,
    p_doc_type: fields.docType,
    p_review_cycle_months: fields.reviewCycleMonths,
    p_category: parseCategory(formData.get('category')),
    p_tags: parseTags(formData.get('tags')),
    p_description: parseCategory(formData.get('description')),
  })
  if (error || !data) return { ok: false, error: mapDocumentError(error) }
  if (!data.current_version_id) return { ok: false, error: MESSAGES.generic, documentId: data.id }
  return { documentId: data.id, versionId: data.current_version_id }
}

// ---------------------------------------------------------------------------
// DELETED (DM3): `createAndSubmitDocument`, `supersedeAndSubmitDocument` and
// `reviseChangesRequestedDocument` — the three server-side create/attach/submit
// COMPOSITES. Each uploaded bytes server-side and then pointed the domain row at
// a raw `storage_path` via `set_document_version_file`; both halves are retired
// (M4/M5), and the chain cannot be one atomic server action on the DM2 substrate
// because the document and version must EXIST before an upload can be reserved.
//
// The wizard now drives the chain client-side:
//   create      createDraftOnly → begin → PUT → finalize → submitDocumentForApproval
//   new version supersedeDocument → begin → PUT → finalize → submitDocumentForApproval
//   revise      begin → PUT → finalize → submitDocumentForApproval (version exists)
//
// ⚠ `createDraftOnly` SURVIVES — it is step 1 of the create path and the only
// verb returning BOTH ids. It is not a composite; it lost only its file block.
// ---------------------------------------------------------------------------

/**
 * Create the header + its draft version. METADATA ONLY — no file.
 *
 * This is the create wizard's STEP 1 (DM3). The bytes follow as a client-driven
 * chain: `beginControlledVersionUpload` → PUT → `finalizeControlledVersionUpload`
 * → `submitDocumentForApproval`. It is the only verb returning BOTH ids, and the
 * wizard needs both before it can reserve an upload — which is exactly why the
 * old create+attach+submit composite could not survive: on the DM2 substrate the
 * document and version must EXIST before an upload can be reserved, so the chain
 * cannot be one atomic server action.
 *
 * FormData: the create fields + `category`/`tags`; `expiryDate` is still parsed
 * (and validated) so the wizard can post one form, but it is applied by
 * `finalizeControlledVersionUpload` with the file, not here.
 */
export async function createDraftOnly(
  _prev: CreateDocumentState | undefined,
  formData: FormData,
): Promise<CreateDocumentState> {
  const fields = readCreateFields(formData)
  if ('ok' in fields) return fields

  const expiryDate = parseDate(formData.get('expiryDate'))
  if (expiryDate === null) return { ok: false, fieldErrors: { expiryDate: MESSAGES.dateInvalid } }

  const created = await createDocumentRow(fields, formData)
  if ('ok' in created) return created
  const { documentId, versionId } = created

  revalidateDocuments()
  // versionId is returned (DM3): the wizard needs BOTH ids before it can call
  // beginControlledVersionUpload — the document and version must exist before
  // an upload can be reserved, which is why the create+upload+submit composite
  // cannot be atomic on the DM2 substrate and moves client-side.
  return { ok: true, error: MESSAGES.created, documentId, versionId }
}

// ---------------------------------------------------------------------------
// Remind (ADR 0081 §4 — staff_admin re-enqueues a still-pending approver)
// ---------------------------------------------------------------------------

/**
 * Re-send an approval lembrete to a still-pending named approver of an `in_approval`
 * version. Routes to the staff_admin-gated `remind_document_approver` DEFINER RPC
 * (authority enforced server-side). Rate-limited to one per approver per day in the
 * RPC — a `false` return (already reminded today / notifications off) surfaces a soft
 * pt-BR message, not an error.
 */
export async function remindDocumentApprover(versionId: string, approverId: string): Promise<ActionState> {
  if (!versionId || !approverId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('remind_document_approver', {
    p_version_id: versionId,
    p_approver_id: approverId,
  })

  if (error) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: data === false ? MESSAGES.remindSkipped : MESSAGES.remindSent }
}

// NOTE: no `export type { … }` re-exports here — a `'use server'` module may export
// ONLY async server functions + plain interfaces (the RSC action compiler rejects
// value re-exports). Consumers import the field-value unions (DocType /
// ApprovalDecision / …) directly from the pure `@/lib/controlled-documents/types`.
