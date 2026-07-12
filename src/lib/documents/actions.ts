'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Controlled-document server actions (Phase 17; Architecture Rules 6, 9, 10, 11).
 *
 * Every write routes through a SECURITY DEFINER RPC (posture (b) — the tables have
 * no direct write grant). Authoring (create/edit/add-version/submit/publish/
 * supersede/obsolete) is `is_staff_admin_of OR is_commission_admin_of`, enforced in
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

/** Create/update return the document id so the UI can route to its detail. */
export interface CreateDocumentState extends ActionState {
  documentId?: string
}

/** Add-version returns the new version id so the UI can route/refresh. */
export interface AddVersionState extends ActionState {
  versionId?: string
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
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_FORBIDDEN = '42501'
const PG_UNIQUE_VIOLATION = '23505'

// The controlled-documents bucket allowed MIME → extension map (mirrors the bucket's
// allowed_mime_types in B1). 25 MB cap.
const MAX_DOCUMENT_BYTES = 26214400
const ALLOWED_DOCUMENT_MIME = new Map<string, string>([
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
  })

  if (error || !data) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.updated, documentId: data.id }
}

// --- immutable upload helper (Rule 6) -------------------------------------

/**
 * Upload a file to a NEW immutable object under `{commissionId}/{documentId}/{uuid}.{ext}`
 * and return the path. An `error` result means a validation/upload failure (the caller
 * surfaces the pt-BR message on the given field). Never overwrites (`upsert: false`).
 */
async function uploadDocumentFile(
  file: File,
  commissionId: string,
  documentId: string,
): Promise<{ path: string } | { error: string; field: string }> {
  if (!(file instanceof File) || file.size === 0) {
    return { error: MESSAGES.fileRequired, field: 'file' }
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: MESSAGES.fileTooLarge, field: 'file' }
  }
  const ext = ALLOWED_DOCUMENT_MIME.get(file.type)
  if (!ext) return { error: MESSAGES.fileTypeInvalid, field: 'file' }

  const supabase = await createClient()
  const path = `${commissionId}/${documentId}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from('controlled-documents')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (error) return { error: MESSAGES.uploadFailed, field: 'file' }
  return { path }
}

/**
 * Attach/replace the file of a `draft` version (immutable upload). Fields:
 * `commissionId`, `documentId`, `versionId`, the uploaded `file`, optional
 * `summaryOfChangesMd`/`expiryDate`. Uploads to a NEW path then routes to
 * `set_document_version_file`. Returns `versionId`.
 */
export async function addDocumentVersion(
  _prev: AddVersionState | undefined,
  formData: FormData,
): Promise<AddVersionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const documentId = String(formData.get('documentId') ?? '')
  const versionId = String(formData.get('versionId') ?? '')
  const file = formData.get('file')
  const expiryDate = parseDate(formData.get('expiryDate'))

  if (!commissionId || !documentId || !versionId) return { ok: false, error: MESSAGES.notFound }
  if (expiryDate === null) return { ok: false, fieldErrors: { expiryDate: MESSAGES.dateInvalid } }
  if (!(file instanceof File)) return { ok: false, fieldErrors: { file: MESSAGES.fileRequired } }

  const uploaded = await uploadDocumentFile(file, commissionId, documentId)
  if ('error' in uploaded) {
    return { ok: false, fieldErrors: { [uploaded.field]: uploaded.error } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_document_version_file', {
    p_version_id: versionId,
    p_storage_path: uploaded.path,
    p_summary_of_changes_md: String(formData.get('summaryOfChangesMd') ?? '').trim() || undefined,
    p_expiry_date: expiryDate ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapDocumentError(error) }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.versionAdded, versionId: data.id }
}

/**
 * Submit a `draft` version for approval, naming its approvers. Fields:
 * `versionId`, `approvers` (a JSON array of `{ approver_id, approver_title? }` —
 * each MUST be an active same-hospital user). Routes to
 * `submit_document_for_approval` (→ `in_approval`; delete-then-insert the pending
 * rows that GRANT READ; rejects foreign-hospital/inactive/duplicate approvers).
 */
export async function submitDocumentForApproval(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get('versionId') ?? '')
  if (!versionId) return { ok: false, error: MESSAGES.notFound }

  let approvers: unknown
  try {
    approvers = JSON.parse(String(formData.get('approvers') ?? '[]'))
  } catch {
    return { ok: false, error: MESSAGES.approversRequired }
  }
  if (!Array.isArray(approvers) || approvers.length === 0) {
    return { ok: false, error: MESSAGES.approversRequired }
  }

  // Camel→snake at the TS↔SQL boundary (BUG-DOC-003): the client form emits the
  // app-layer camelCase contract (`{approverId, approverTitle}`, matching
  // `ApproverCandidate`), but `submit_document_for_approval` reads snake_case
  // (`->> 'approver_id'` / `->> 'approver_title'`). Map here so DB naming never leaks
  // into the client, and reject a malformed element (missing `approverId`) with a
  // pt-BR error instead of letting it reach the RPC as a NULL id (which would surface
  // as the misleading HC091 "not entitled"). The FRONTEND form stays camelCase.
  const payload: { approver_id: string; approver_title: string | null }[] = []
  for (const raw of approvers) {
    const a = raw as { approverId?: unknown; approverTitle?: unknown }
    const approverId = typeof a.approverId === 'string' ? a.approverId.trim() : ''
    if (!approverId) return { ok: false, error: MESSAGES.approversRequired }
    const approverTitle =
      typeof a.approverTitle === 'string' && a.approverTitle.trim() ? a.approverTitle.trim() : null
    payload.push({ approver_id: approverId, approver_title: approverTitle })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_document_for_approval', {
    p_version_id: versionId,
    p_approvers: payload as never,
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
 * `signature_hash` = sha256 over storage_path:approver_id:decision).
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
 * the prior stays `effective` until the new one publishes). The frontend then uploads
 * a file to the returned version via {@link addDocumentVersion}. Returns `versionId`.
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

// NOTE: no `export type { … }` re-exports here — a `'use server'` module may export
// ONLY async server functions + plain interfaces (the RSC action compiler rejects
// value re-exports). Consumers import the field-value unions (DocType /
// ApprovalDecision / …) directly from the pure `@/lib/documents/types`.
