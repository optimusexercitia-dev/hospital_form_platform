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

// ---------------------------------------------------------------------------
// B3 · All-in-one create (chained actions — NO new RPC; ADR 0081 decision 1)
// ---------------------------------------------------------------------------
//
// The wizard's terminal action chains the existing RPCs
// (`create → uploadDocumentFile → set_document_version_file → submit`). The chain is
// NOT transactional across Storage + DB (ADR 0081 risk): once the document is created,
// ANY later failure returns the created `documentId` (never swallows the error), so the
// UI lands the user on the recoverable draft's detail with a mapped pt-BR banner
// (memory: phi-write-atomic-with-create — never a silently-dropped write). A future
// orchestration RPC is noted, not built.

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

/**
 * The all-in-one wizard's terminal action: create → attach file → submit for
 * approval, in one chained call. On ANY post-create failure it returns `documentId`
 * (so the UI redirects to the created draft's detail) + a mapped pt-BR banner naming
 * what to finish. Fields: create fields + `category`/`tags` + `file` (required) +
 * optional `summaryOfChangesMd`/`expiryDate`/`proposedEffectiveDate`/`approvalDueDate`
 * + `approvers` (JSON, ≥1).
 */
export async function createAndSubmitDocument(
  _prev: CreateDocumentState | undefined,
  formData: FormData,
): Promise<CreateDocumentState> {
  const fields = readCreateFields(formData)
  if ('ok' in fields) return fields

  // Validate the submit-only inputs UP FRONT (avoid an orphan draft on trivially
  // invalid input — nothing is created if these fail).
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileRequired } }
  }
  const parsedApprovers = parseApprovers(formData.get('approvers'))
  if ('error' in parsedApprovers) return { ok: false, error: parsedApprovers.error }
  const expiryDate = parseDate(formData.get('expiryDate'))
  const proposedEffectiveDate = parseDate(formData.get('proposedEffectiveDate'))
  const approvalDueDate = parseDate(formData.get('approvalDueDate'))
  if (expiryDate === null) return { ok: false, fieldErrors: { expiryDate: MESSAGES.dateInvalid } }
  if (proposedEffectiveDate === null) {
    return { ok: false, fieldErrors: { proposedEffectiveDate: MESSAGES.dateInvalid } }
  }
  if (approvalDueDate === null) return { ok: false, fieldErrors: { approvalDueDate: MESSAGES.dateInvalid } }

  // 1) create (the point of no return — after this, failures carry documentId).
  const created = await createDocumentRow(fields, formData)
  if ('ok' in created) return created
  const { documentId, versionId } = created

  const supabase = await createClient()

  // 2) upload the immutable file object + attach it to the draft version.
  const uploaded = await uploadDocumentFile(file, fields.commissionId, documentId)
  if ('error' in uploaded) {
    revalidateDocuments()
    return { ok: false, error: MESSAGES.draftSavedUploadLater, documentId }
  }
  const { error: fileError } = await supabase.rpc('set_document_version_file', {
    p_version_id: versionId,
    p_storage_path: uploaded.path,
    p_summary_of_changes_md: String(formData.get('summaryOfChangesMd') ?? '').trim() || undefined,
    p_expiry_date: expiryDate ?? undefined,
  })
  if (fileError) {
    revalidateDocuments()
    return { ok: false, error: MESSAGES.draftSavedUploadLater, documentId }
  }

  // 3) submit for approval (persists proposed/approval dates + enqueues approvers).
  const { error: submitError } = await supabase.rpc('submit_document_for_approval', {
    p_version_id: versionId,
    p_approvers: parsedApprovers.payload as never,
    p_proposed_effective_date: proposedEffectiveDate ?? undefined,
    p_approval_due_date: approvalDueDate ?? undefined,
  })
  if (submitError) {
    revalidateDocuments()
    return { ok: false, error: MESSAGES.draftSavedSubmitLater, documentId }
  }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.submitted, documentId }
}

/**
 * The wizard's "Salvar rascunho" exit: create the header + draft version, and — if a
 * `file` was provided — attach it, WITHOUT submitting. Returns `documentId`. A file
 * failure after create still returns `documentId` + a banner (the draft is saved).
 */
export async function createDraftOnly(
  _prev: CreateDocumentState | undefined,
  formData: FormData,
): Promise<CreateDocumentState> {
  const fields = readCreateFields(formData)
  if ('ok' in fields) return fields

  const file = formData.get('file')
  const hasFile = file instanceof File && file.size > 0
  const expiryDate = parseDate(formData.get('expiryDate'))
  if (expiryDate === null) return { ok: false, fieldErrors: { expiryDate: MESSAGES.dateInvalid } }

  const created = await createDocumentRow(fields, formData)
  if ('ok' in created) return created
  const { documentId, versionId } = created

  if (hasFile) {
    const supabase = await createClient()
    const uploaded = await uploadDocumentFile(file, fields.commissionId, documentId)
    if ('error' in uploaded) {
      revalidateDocuments()
      return { ok: false, error: MESSAGES.draftSavedUploadLater, documentId }
    }
    const { error: fileError } = await supabase.rpc('set_document_version_file', {
      p_version_id: versionId,
      p_storage_path: uploaded.path,
      p_summary_of_changes_md: String(formData.get('summaryOfChangesMd') ?? '').trim() || undefined,
      p_expiry_date: expiryDate ?? undefined,
    })
    if (fileError) {
      revalidateDocuments()
      return { ok: false, error: MESSAGES.draftSavedUploadLater, documentId }
    }
  }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.created, documentId }
}

/**
 * The all-in-one NEW-VERSION action (Wave 2.5a): supersede the current effective
 * version → attach the new draft's file → submit for approval, chained. Mirrors
 * {@link createAndSubmitDocument} for the supersede path. Identity is LOCKED — this
 * takes NO title/docType/category/tags/reviewCycle/description; the header is frozen
 * with the artifact. FormData: `documentId`, `commissionId` (for the immutable upload
 * path — same as {@link addDocumentVersion}), `file` (required), `summaryOfChangesMd`
 * (required), optional `expiryDate`/`proposedEffectiveDate`/`approvalDueDate`,
 * `approvers` (JSON `{approverId, approverTitle?}[]`, ≥1). On ANY post-supersede
 * failure it returns `documentId` (so the FE lands on the detail) + a mapped pt-BR
 * banner; never swallows the error.
 */
export async function supersedeAndSubmitDocument(
  _prev: CreateDocumentState | undefined,
  formData: FormData,
): Promise<CreateDocumentState> {
  const documentId = String(formData.get('documentId') ?? '')
  const commissionId = String(formData.get('commissionId') ?? '')
  if (!documentId || !commissionId) return { ok: false, error: MESSAGES.notFound }

  // Validate submit-only inputs UP FRONT (avoid superseding into an orphan draft on
  // trivially invalid input — nothing is created if these fail).
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileRequired } }
  }
  const summary = String(formData.get('summaryOfChangesMd') ?? '').trim()
  if (!summary) return { ok: false, fieldErrors: { summaryOfChangesMd: MESSAGES.summaryRequired } }
  const parsedApprovers = parseApprovers(formData.get('approvers'))
  if ('error' in parsedApprovers) return { ok: false, error: parsedApprovers.error }
  const expiryDate = parseDate(formData.get('expiryDate'))
  const proposedEffectiveDate = parseDate(formData.get('proposedEffectiveDate'))
  const approvalDueDate = parseDate(formData.get('approvalDueDate'))
  if (expiryDate === null) return { ok: false, fieldErrors: { expiryDate: MESSAGES.dateInvalid } }
  if (proposedEffectiveDate === null) {
    return { ok: false, fieldErrors: { proposedEffectiveDate: MESSAGES.dateInvalid } }
  }
  if (approvalDueDate === null) return { ok: false, fieldErrors: { approvalDueDate: MESSAGES.dateInvalid } }

  const supabase = await createClient()

  // 1) supersede → a NEW draft version (creates nothing lasting if it fails: e.g. the
  // doc is not effective, or an open version already exists → HC089). documentId is
  // known from input, so land the FE on the detail regardless.
  const { data: sup, error: supError } = await supabase.rpc('supersede_document', {
    p_document_id: documentId,
  })
  if (supError || !sup) return { ok: false, error: mapDocumentError(supError), documentId }
  const versionId = sup.id

  // 2) upload the immutable file object + attach it to the new draft version.
  const uploaded = await uploadDocumentFile(file, commissionId, documentId)
  if ('error' in uploaded) {
    revalidateDocuments()
    return { ok: false, error: MESSAGES.draftSavedUploadLater, documentId }
  }
  const { error: fileError } = await supabase.rpc('set_document_version_file', {
    p_version_id: versionId,
    p_storage_path: uploaded.path,
    p_summary_of_changes_md: summary,
    p_expiry_date: expiryDate ?? undefined,
  })
  if (fileError) {
    revalidateDocuments()
    return { ok: false, error: MESSAGES.draftSavedUploadLater, documentId }
  }

  // 3) submit the new version for approval.
  const { error: submitError } = await supabase.rpc('submit_document_for_approval', {
    p_version_id: versionId,
    p_approvers: parsedApprovers.payload as never,
    p_proposed_effective_date: proposedEffectiveDate ?? undefined,
    p_approval_due_date: approvalDueDate ?? undefined,
  })
  if (submitError) {
    revalidateDocuments()
    return { ok: false, error: MESSAGES.draftSavedSubmitLater, documentId }
  }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.submitted, documentId }
}

/**
 * The REVISE-IN-PLACE terminal action (`changes_requested` wizard): re-attach the
 * corrected file to an EXISTING `changes_requested` version → re-submit it for
 * approval with the (possibly changed) approver set, chained. Mirrors
 * {@link supersedeAndSubmitDocument} but targets a version that ALREADY exists — there
 * is NO supersede/version bump: rejection produced a `changes_requested` state and the
 * coordinator revises the SAME version. Identity (title/docType/category/tags/cycle/
 * description) stays LOCKED — this takes none of it. The re-submit rebuilds a fresh
 * all-pending approver roster (server-side, in `submit_document_for_approval`).
 *
 * FormData contract (the FE revise wizard builds this):
 *   - `documentId`   (required) — the controlled-document id (for revalidate + the
 *                     partial-failure landing; not passed to any RPC).
 *   - `commissionId` (required) — the immutable upload path prefix (as {@link addDocumentVersion}).
 *   - `versionId`    (required) — the `changes_requested` version to revise in place.
 *   - `file`         (required) — the corrected artifact (immutable upload, new path).
 *   - `summaryOfChangesMd` (required) — describe the revision.
 *   - `approvers`    (required) — JSON `{approverId, approverTitle?}[]`, ≥1 (may differ
 *                     from the prior round; each must be an active same-hospital user).
 *   - `expiryDate` / `proposedEffectiveDate` / `approvalDueDate` (optional, YYYY-MM-DD).
 *
 * On ANY post-file-set failure it returns `documentId` (so the FE lands on the detail)
 * + a mapped pt-BR banner; it never swallows the error.
 */
export async function reviseChangesRequestedDocument(
  _prev: ReviseDocumentState | undefined,
  formData: FormData,
): Promise<ReviseDocumentState> {
  const documentId = String(formData.get('documentId') ?? '')
  const commissionId = String(formData.get('commissionId') ?? '')
  const versionId = String(formData.get('versionId') ?? '')
  if (!documentId || !commissionId || !versionId) return { ok: false, error: MESSAGES.notFound }

  // Validate all inputs UP FRONT (avoid uploading an orphan object / mutating the
  // version on trivially invalid input).
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileRequired } }
  }
  const summary = String(formData.get('summaryOfChangesMd') ?? '').trim()
  if (!summary) return { ok: false, fieldErrors: { summaryOfChangesMd: MESSAGES.summaryRequired } }
  const parsedApprovers = parseApprovers(formData.get('approvers'))
  if ('error' in parsedApprovers) return { ok: false, error: parsedApprovers.error }
  const expiryDate = parseDate(formData.get('expiryDate'))
  const proposedEffectiveDate = parseDate(formData.get('proposedEffectiveDate'))
  const approvalDueDate = parseDate(formData.get('approvalDueDate'))
  if (expiryDate === null) return { ok: false, fieldErrors: { expiryDate: MESSAGES.dateInvalid } }
  if (proposedEffectiveDate === null) {
    return { ok: false, fieldErrors: { proposedEffectiveDate: MESSAGES.dateInvalid } }
  }
  if (approvalDueDate === null) return { ok: false, fieldErrors: { approvalDueDate: MESSAGES.dateInvalid } }

  // 1) upload the immutable file object (nothing on the version has changed yet — an
  // upload failure leaves the version untouched, so surface it as a field error).
  const uploaded = await uploadDocumentFile(file, commissionId, documentId)
  if ('error' in uploaded) {
    return { ok: false, fieldErrors: { [uploaded.field]: uploaded.error } }
  }

  const supabase = await createClient()

  // 2) attach the corrected file to the existing changes_requested version (HC089 if
  // the version is no longer in a revisable state — draft/changes_requested only).
  const { error: fileError } = await supabase.rpc('set_document_version_file', {
    p_version_id: versionId,
    p_storage_path: uploaded.path,
    p_summary_of_changes_md: summary,
    p_expiry_date: expiryDate ?? undefined,
  })
  if (fileError) {
    revalidateDocuments()
    return { ok: false, error: mapDocumentError(fileError), documentId }
  }

  // 3) re-submit for approval (rebuilds a fresh all-pending roster server-side).
  const { error: submitError } = await supabase.rpc('submit_document_for_approval', {
    p_version_id: versionId,
    p_approvers: parsedApprovers.payload as never,
    p_proposed_effective_date: proposedEffectiveDate ?? undefined,
    p_approval_due_date: approvalDueDate ?? undefined,
  })
  if (submitError) {
    revalidateDocuments()
    return { ok: false, error: MESSAGES.revisionSavedSubmitLater, documentId }
  }

  revalidateDocuments()
  return { ok: true, error: MESSAGES.submitted, documentId }
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
// ApprovalDecision / …) directly from the pure `@/lib/documents/types`.
