'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { casesExtrasEnabled } from '@/lib/cases/extras-gate'
import type { CaseDocumentType, CaseEventKind } from '@/lib/queries/case-documents'

/**
 * Case DOCUMENTS & EVENTS server actions (Cases-Extras batch, R1).
 *
 * Architecture Rules 6, 9 & 10. Document upload clones the existing
 * server-action path (`uploadFormAsset`): validate MIME/size, upload with
 * `upsert:false` to a NEW immutable path, then insert the metadata row — objects
 * are never overwritten. Document "delete" is a SOFT delete (row hidden, object
 * retained). Events are fully editable + hard-deletable working notes.
 * staff_admin-write throughout (RLS is the authority; each action re-verifies
 * commission-scoped authz for a clean pt-BR forbidden, and gates the cases_extras
 * flag); strings pt-BR; raw Postgres errors never reach the UI.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface UploadCaseDocumentState extends ActionState {
  documentId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'Este recurso ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCase: 'Caso não encontrado.',
  missingDocument: 'Documento não encontrado.',
  missingEvent: 'Registro não encontrado.',
  titleRequired: 'Informe um título para o documento.',
  bodyRequired: 'Escreva o conteúdo do registro.',
  docTypeInvalid: 'Tipo de documento inválido.',
  kindInvalid: 'Tipo de registro inválido.',
  fileRequired: 'Selecione um arquivo.',
  fileTooLarge: 'O arquivo excede o tamanho máximo de 25 MB.',
  fileTypeInvalid:
    'Envie um PDF, imagem, documento Word/Excel, CSV ou texto.',
  dateInvalid: 'Informe uma data válida.',
  uploadFailed: 'Não foi possível enviar o arquivo. Tente novamente.',
  documentAdded: 'Documento adicionado com sucesso.',
  documentRemoved: 'Documento removido.',
  eventAdded: 'Registro adicionado.',
  eventUpdated: 'Registro atualizado.',
  eventRemoved: 'Registro removido.',
} as const

const DOC_TYPES: CaseDocumentType[] = ['ata', 'digitalizacao', 'registro', 'other']
const EVENT_KINDS: CaseEventKind[] = ['note', 'meeting', 'decision', 'other']

const MAX_DOC_BYTES = 25 * 1024 * 1024 // mirrors the bucket's 25 MiB limit
// MIME → file extension, mirroring the case-documents bucket allow-list (092003).
const ALLOWED_DOC_MIME = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['application/msword', 'doc'],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx',
  ],
  ['application/vnd.ms-excel', 'xls'],
  [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xlsx',
  ],
  ['text/csv', 'csv'],
  ['text/plain', 'txt'],
])

const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'

function revalidateCase(): void {
  revalidatePath(CASE_PATH, 'page')
}

/** Authorize a case action: admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

/** Resolve a case's commission via the RLS-scoped client (null = unseen). */
async function commissionOfCase(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('cases')
    .select('commission_id')
    .eq('id', caseId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/**
 * Validate an optional `YYYY-MM-DD` date field. `undefined` when blank, the
 * string when a real calendar date, `null` to signal invalid (a native date
 * input is safe, but a hand-crafted POST could carry garbage).
 */
function parseDate(raw: string): string | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  if (d.toISOString().slice(0, 10) !== trimmed) return null
  return trimmed
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * Upload a file-backed document to a case. `useActionState`-shaped. Expected
 * fields: `caseId`, `file` (the upload), `docType` ({@link CaseDocumentType}),
 * `title`, `description?`, `occurredAt?`. Clones `uploadFormAsset`: validates the
 * MIME allow-list + 25 MiB cap, uploads to a FRESH immutable path
 * (`{commissionId}/{caseId}/{uuid}.{ext}`, `upsert:false`), then inserts the
 * metadata row. Returns the new `documentId`.
 */
export async function uploadCaseDocument(
  _prev: UploadCaseDocumentState | undefined,
  formData: FormData,
): Promise<UploadCaseDocumentState> {
  const caseId = String(formData.get('caseId') ?? '')
  const docType = String(formData.get('docType') ?? 'other')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const occurredAt = parseDate(String(formData.get('occurredAt') ?? ''))
  const file = formData.get('file')

  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!DOC_TYPES.includes(docType as CaseDocumentType)) {
    return { ok: false, error: MESSAGES.docTypeInvalid }
  }
  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  }
  if (occurredAt === null) {
    return { ok: false, fieldErrors: { occurredAt: MESSAGES.dateInvalid } }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileRequired } }
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileTooLarge } }
  }
  const ext = ALLOWED_DOC_MIME.get(file.type)
  if (!ext) {
    return { ok: false, fieldErrors: { file: MESSAGES.fileTypeInvalid } }
  }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // Immutable path: commission folder (RLS boundary) / case folder / uuid.ext.
  const path = `${commissionId}/${caseId}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: MESSAGES.uploadFailed }

  // Insert the metadata row. created_by/uploaded_by = the caller.
  const context = await getSessionContext()
  const { data, error } = await supabase
    .from('case_documents')
    .insert({
      case_id: caseId,
      doc_type: docType,
      title,
      description: description || null,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      occurred_at: occurredAt ?? null,
      uploaded_by: context?.userId ?? null,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    // The row insert failed AFTER the object landed; the object is orphaned but
    // never overwritten (Rule 6 — orphans are tolerated, no GC in v1).
    return { ok: false, error: MESSAGES.generic }
  }

  revalidateCase()
  return { ok: true, error: MESSAGES.documentAdded, documentId: data.id }
}

/**
 * SOFT-delete a document (sets `deleted_at`/`deleted_by`; the Storage object is
 * retained per Rule 6). staff_admin-only.
 */
export async function deleteCaseDocument(
  documentId: string,
): Promise<ActionState> {
  if (!documentId) return { ok: false, error: MESSAGES.missingDocument }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('case_documents')
    .select('case_id, cases(commission_id)')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle<{ case_id: string; cases: { commission_id: string } | null }>()
  const commissionId = doc?.cases?.commission_id
  if (!commissionId) return { ok: false, error: MESSAGES.missingDocument }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const context = await getSessionContext()
  const { error } = await supabase
    .from('case_documents')
    .update({ deleted_at: new Date().toISOString(), deleted_by: context?.userId ?? null })
    .eq('id', documentId)

  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateCase()
  return { ok: true, error: MESSAGES.documentRemoved }
}

// ---------------------------------------------------------------------------
// Events (manual free-text)
// ---------------------------------------------------------------------------

/**
 * Add a manual free-text event to a case. `useActionState`-shaped. Fields:
 * `caseId`, `kind` ({@link CaseEventKind}), `title?`, `body` (required),
 * `occurredAt?`. staff_admin-only.
 */
export async function createCaseEvent(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const caseId = String(formData.get('caseId') ?? '')
  const kind = String(formData.get('kind') ?? 'note')
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const occurredAt = parseDate(String(formData.get('occurredAt') ?? ''))

  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!EVENT_KINDS.includes(kind as CaseEventKind)) {
    return { ok: false, error: MESSAGES.kindInvalid }
  }
  if (!body) {
    return { ok: false, fieldErrors: { body: MESSAGES.bodyRequired } }
  }
  if (occurredAt === null) {
    return { ok: false, fieldErrors: { occurredAt: MESSAGES.dateInvalid } }
  }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const context = await getSessionContext()
  const { error } = await supabase.from('case_events').insert({
    case_id: caseId,
    kind,
    title: title || null,
    body,
    occurred_at: occurredAt ?? null,
    created_by: context?.userId ?? null,
  })

  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateCase()
  return { ok: true, error: MESSAGES.eventAdded }
}

/**
 * Edit a manual event (`title` / `body` / `kind` / `occurredAt`).
 * `useActionState`-shaped; expects `eventId` in the form data. staff_admin-only.
 */
export async function updateCaseEvent(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get('eventId') ?? '')
  const kind = String(formData.get('kind') ?? 'note')
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const occurredAt = parseDate(String(formData.get('occurredAt') ?? ''))

  if (!eventId) return { ok: false, error: MESSAGES.missingEvent }
  if (!EVENT_KINDS.includes(kind as CaseEventKind)) {
    return { ok: false, error: MESSAGES.kindInvalid }
  }
  if (!body) {
    return { ok: false, fieldErrors: { body: MESSAGES.bodyRequired } }
  }
  if (occurredAt === null) {
    return { ok: false, fieldErrors: { occurredAt: MESSAGES.dateInvalid } }
  }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data: ev } = await supabase
    .from('case_events')
    .select('case_id, cases(commission_id)')
    .eq('id', eventId)
    .maybeSingle<{ case_id: string; cases: { commission_id: string } | null }>()
  const commissionId = ev?.cases?.commission_id
  if (!commissionId) return { ok: false, error: MESSAGES.missingEvent }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase
    .from('case_events')
    .update({
      kind,
      title: title || null,
      body,
      occurred_at: occurredAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateCase()
  return { ok: true, error: MESSAGES.eventUpdated }
}

/** Hard-delete a manual event (working notes are not immutable). staff_admin-only. */
export async function deleteCaseEvent(eventId: string): Promise<ActionState> {
  if (!eventId) return { ok: false, error: MESSAGES.missingEvent }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data: ev } = await supabase
    .from('case_events')
    .select('case_id, cases(commission_id)')
    .eq('id', eventId)
    .maybeSingle<{ case_id: string; cases: { commission_id: string } | null }>()
  const commissionId = ev?.cases?.commission_id
  if (!commissionId) return { ok: false, error: MESSAGES.missingEvent }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.from('case_events').delete().eq('id', eventId)
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateCase()
  return { ok: true, error: MESSAGES.eventRemoved }
}
