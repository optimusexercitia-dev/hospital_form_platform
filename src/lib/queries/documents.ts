/**
 * Controlled-documents data-access (Phase 17 — Gestão de Documentos Controlados;
 * Architecture Rule 9 — all reads go through `src/lib/queries/`). Backs the
 * `manage/documentos/**` register, the document detail view, the per-user approval
 * queue, the review-due list, and the hospital-wide register rollup.
 *
 * The domain TYPES are the FROZEN contract the frontend builds against; they live
 * in the import-free, client-safe `@/lib/documents/types` (re-exported here for
 * convenience, mirroring the `queries/indicators.ts` re-export pattern).
 *
 * RLS (the security boundary — Rule 1):
 *  - `controlled_documents` + `controlled_document_versions`: member-READ (RLS
 *    SELECT policy) OR the APPROVER-READ arm (holds a pending/decided approval row
 *    on a version of this doc — the case_access-style OR-term, so an outside-
 *    commission same-hospital signer sees only the document they were named on) /
 *    DEFINER-RPC-only WRITE (posture (b) — no direct write grant).
 *  - `document_approvals`: sign-own-row (SELECT own rows + rows on readable docs;
 *    no broad write). The pending row is the grant.
 *  - The hospital tier reads ONLY via `hospital_document_register` (a PHI-free
 *    DEFINER rollup — counts/metadata, no bodies/paths), never the row.
 *  - Storage reads are signed-URL only, minted server-side (`createSignedDownloadUrl`).
 *
 * PHI-FREE: controlled documents are governance artifacts (ADR 0057).
 */

import { createClient } from '@/lib/supabase/server'
import type {
  ApprovalDecision,
  ControlledDocument,
  ControlledDocumentDetail,
  ControlledDocumentListItem,
  ControlledDocumentVersion,
  DocStatus,
  DocType,
  DocumentApproval,
  HospitalDocumentRegisterRow,
  ObsoleteKind,
  PendingApprovalRow,
  ReviewDueRow,
} from '@/lib/documents/types'

// Re-export the client-safe contract so consumers can import types/labels from
// the query module too (mirrors queries/indicators.ts).
export type {
  ApprovalDecision,
  ControlledDocument,
  ControlledDocumentDetail,
  ControlledDocumentListItem,
  ControlledDocumentVersion,
  DocStatus,
  DocType,
  DocumentApproval,
  HospitalDocumentRegisterRow,
  ObsoleteKind,
  PendingApprovalRow,
  ReviewDueRow,
} from '@/lib/documents/types'
export {
  APPROVAL_DECISION_LABELS,
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  OBSOLETE_KIND_LABELS,
} from '@/lib/documents/types'

const SIGNED_URL_TTL_SECONDS = 3600

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

interface DocumentRow {
  id: string
  commission_id: string
  code: string
  title: string
  doc_type: string
  category: string | null
  tags: string[] | null
  description: string | null
  review_cycle_months: number | null
  status: string
  current_version_id: string | null
  created_at: string
  updated_at: string
  commission?: { hospital_id: string | null } | null
}

const DOCUMENT_SELECT =
  'id, commission_id, code, title, doc_type, category, tags, description, review_cycle_months, status, ' +
  'current_version_id, created_at, updated_at, ' +
  'commission:commissions!controlled_documents_commission_id_fkey(hospital_id)'

function mapDocument(r: DocumentRow): ControlledDocument {
  return {
    id: r.id,
    commissionId: r.commission_id,
    hospitalId: r.commission?.hospital_id ?? '',
    code: r.code,
    title: r.title,
    docType: r.doc_type as DocType,
    category: r.category,
    tags: r.tags ?? [],
    description: r.description,
    reviewCycleMonths: r.review_cycle_months,
    status: r.status as DocStatus,
    currentVersionId: r.current_version_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

interface VersionRow {
  id: string
  document_id: string
  version_number: number
  storage_path: string | null
  summary_of_changes_md: string | null
  effective_date: string | null
  review_due_date: string | null
  expiry_date: string | null
  proposed_effective_date: string | null
  approval_due_date: string | null
  obsolete_kind: string | null
  status: string
  created_at: string
  updated_at: string
  profiles?: { full_name: string | null } | null
}

const VERSION_SELECT =
  'id, document_id, version_number, storage_path, summary_of_changes_md, ' +
  'effective_date, review_due_date, expiry_date, proposed_effective_date, ' +
  'approval_due_date, obsolete_kind, status, created_at, updated_at, ' +
  'profiles:created_by(full_name)'

function mapVersion(r: VersionRow): ControlledDocumentVersion {
  return {
    id: r.id,
    documentId: r.document_id,
    versionNumber: r.version_number,
    storagePath: r.storage_path,
    summaryOfChangesMd: r.summary_of_changes_md,
    effectiveDate: r.effective_date,
    reviewDueDate: r.review_due_date,
    expiryDate: r.expiry_date,
    proposedEffectiveDate: r.proposed_effective_date,
    approvalDueDate: r.approval_due_date,
    obsoleteKind: (r.obsolete_kind as ObsoleteKind | null) ?? null,
    status: r.status as DocStatus,
    createdByName: r.profiles?.full_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

interface ApprovalRow {
  id: string
  document_version_id: string
  approver_id: string
  approver_title: string | null
  decision: string | null
  decided_at: string | null
  note: string | null
  signature_hash: string | null
  created_at: string
  profiles?: { full_name: string | null } | null
}

const APPROVAL_SELECT =
  'id, document_version_id, approver_id, approver_title, decision, decided_at, ' +
  'note, signature_hash, created_at, profiles:approver_id(full_name)'

function mapApproval(r: ApprovalRow): DocumentApproval {
  return {
    id: r.id,
    documentVersionId: r.document_version_id,
    approverId: r.approver_id,
    approverName: r.profiles?.full_name ?? null,
    approverTitle: r.approver_title,
    decision: (r.decision as ApprovalDecision | null) ?? null,
    decidedAt: r.decided_at,
    note: r.note,
    signatureHash: r.signature_hash,
    createdAt: r.created_at,
  }
}

/** Is `reviewDueDate` non-null and strictly before today (as of read)? */
function isOverdue(reviewDueDate: string | null): boolean {
  if (!reviewDueDate) return false
  const today = new Date().toISOString().slice(0, 10)
  return reviewDueDate < today
}

// ---------------------------------------------------------------------------
// Approver candidates (the submit-for-approval picker source)
// ---------------------------------------------------------------------------

/**
 * A selectable approver for the submit-for-approval picker: "any active same-hospital
 * user" (ADR 0057). Minimum-necessary fields — `id` + display `name` + an optional
 * role `title` hint; NO email, NO PHI (the DEFINER RPC never selects them).
 */
export interface ApproverCandidate {
  id: string
  name: string
  title: string | null
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Optional filters for the commission register list. */
export interface DocumentListFilters {
  docType?: DocType
  status?: DocStatus
  /** Restrict to documents whose review is overdue (as of read). */
  reviewOverdueOnly?: boolean
  /** Exact free-text category match (ADR 0081 B4). */
  category?: string
  /** Documents carrying ALL of these tags (array-contains; ADR 0081 B4). */
  tags?: string[]
}

/** Optional filters for the hospital-wide register rollup. */
export interface HospitalRegisterFilters {
  docType?: DocType
  status?: DocStatus
  reviewOverdueOnly?: boolean
}

// ---------------------------------------------------------------------------
// Document reads
// ---------------------------------------------------------------------------

/** A row of the `list_commission_documents` DEFINER register read (Wave 2.5a). */
interface RegisterListRpcRow {
  id: string
  commission_id: string
  hospital_id: string | null
  code: string
  title: string
  doc_type: string
  category: string | null
  tags: string[] | null
  description: string | null
  review_cycle_months: number | null
  status: string
  current_version_id: string | null
  created_at: string
  updated_at: string
  current_version_number: number | null
  effective_date: string | null
  review_due_date: string | null
  obsolete_kind: string | null
  has_open_revision: boolean
  approvals_signed_count: number
  approvals_total_count: number
}

/**
 * All controlled documents of a commission, newest-first, each with its current-
 * version summary + the register KPI/mini-bar facts (`hasOpenRevision`,
 * `approvalsSignedCount/TotalCount`) computed DB-side by the `list_commission_documents`
 * DEFINER read — no FE N+1 (Wave 2.5a). `[]` when out of scope. Optional filters are
 * applied in TS over the (per-commission, small) result set.
 */
export async function listDocuments(
  commissionId: string,
  filters?: DocumentListFilters,
): Promise<ControlledDocumentListItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('list_commission_documents', { p_commission: commissionId })
    .returns<RegisterListRpcRow[]>()

  let items: ControlledDocumentListItem[] = (data ?? []).map((r) => {
    const reviewDueDate = r.review_due_date
    return {
      id: r.id,
      commissionId: r.commission_id,
      hospitalId: r.hospital_id ?? '',
      code: r.code,
      title: r.title,
      docType: r.doc_type as DocType,
      category: r.category,
      tags: r.tags ?? [],
      description: r.description,
      reviewCycleMonths: r.review_cycle_months,
      status: r.status as DocStatus,
      currentVersionId: r.current_version_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      currentVersionNumber: r.current_version_number,
      effectiveDate: r.effective_date,
      reviewDueDate,
      isReviewOverdue: isOverdue(reviewDueDate),
      obsoleteKind: (r.obsolete_kind as ObsoleteKind | null) ?? null,
      hasOpenRevision: r.has_open_revision,
      approvalsSignedCount: r.approvals_signed_count,
      approvalsTotalCount: r.approvals_total_count,
    }
  })

  if (filters?.docType) items = items.filter((i) => i.docType === filters.docType)
  if (filters?.status) items = items.filter((i) => i.status === filters.status)
  if (filters?.category) items = items.filter((i) => i.category === filters.category)
  if (filters?.tags && filters.tags.length > 0) {
    const want = filters.tags
    items = items.filter((i) => want.every((t) => i.tags.includes(t)))
  }
  if (filters?.reviewOverdueOnly) items = items.filter((i) => i.isReviewOverdue)

  return items
}

/**
 * One controlled document by id — the header, its versions (newest first), and the
 * approvals of the current/under-approval version. `null` when out of scope. The
 * approver-read arm lets an outside-commission signer fetch exactly the document
 * they were named on.
 */
export async function getDocument(id: string): Promise<ControlledDocumentDetail | null> {
  const supabase = await createClient()
  const { data: docRow } = await supabase
    .from('controlled_documents')
    .select(DOCUMENT_SELECT)
    .eq('id', id)
    .maybeSingle()
    .returns<DocumentRow | null>()
  if (!docRow) return null

  const { data: versionRows } = await supabase
    .from('controlled_document_versions')
    .select(VERSION_SELECT)
    .eq('document_id', id)
    .order('version_number', { ascending: false })
    .returns<VersionRow[]>()

  const versions = (versionRows ?? []).map(mapVersion)

  // Approvals of the version currently in the approval loop (in_approval), else the
  // current version. Approvers see their own rows via the sign-own-row arm.
  const focusVersion =
    versions.find((v) => v.status === 'in_approval') ??
    versions.find((v) => v.id === docRow.current_version_id) ??
    versions[0]

  let approvals: DocumentApproval[] = []
  if (focusVersion) {
    const { data: approvalRows } = await supabase
      .from('document_approvals')
      .select(APPROVAL_SELECT)
      .eq('document_version_id', focusVersion.id)
      .order('created_at', { ascending: true })
      .returns<ApprovalRow[]>()
    approvals = (approvalRows ?? []).map(mapApproval)
  }

  return { document: mapDocument(docRow), versions, approvals }
}

interface PendingApprovalQueryRow {
  id: string
  document_version_id: string
  created_at: string
  version: {
    version_number: number
    document: {
      id: string
      code: string
      title: string
      doc_type: string
      commission_id: string
      commission: { name: string | null } | null
    } | null
  } | null
}

/**
 * The caller's PENDING approval queue across ALL hospitals/commissions they were
 * named in ("pendentes de aprovação"), newest-submission first. Drives the org-
 * level approval queue (NOT commission-gated — an approver may be outside the
 * commission). `[]` when the caller has no pending approvals. The sign-own-row RLS
 * arm scopes this to the caller's own rows; the approver-read arm resolves the
 * embedded version/document/commission.
 */
export async function listPendingApprovalsForUser(): Promise<PendingApprovalRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('document_approvals')
    .select(
      'id, document_version_id, created_at, ' +
        'version:controlled_document_versions!document_approvals_document_version_id_fkey(' +
        'version_number, document:controlled_documents!controlled_document_versions_document_id_fkey(' +
        'id, code, title, doc_type, commission_id, ' +
        'commission:commissions!controlled_documents_commission_id_fkey(name)))',
    )
    .eq('approver_id', user.id)
    .is('decision', null)
    .order('created_at', { ascending: false })
    .returns<PendingApprovalQueryRow[]>()

  return (data ?? []).flatMap((r) => {
    const doc = r.version?.document
    if (!doc) return []
    return [
      {
        approvalId: r.id,
        documentId: doc.id,
        documentVersionId: r.document_version_id,
        code: doc.code,
        title: doc.title,
        docType: doc.doc_type as DocType,
        versionNumber: r.version?.version_number ?? 0,
        commissionId: doc.commission_id,
        commissionName: doc.commission?.name ?? '',
        submittedAt: r.created_at,
      } satisfies PendingApprovalRow,
    ]
  })
}

interface ReviewDueRpcRow {
  source_kind: string
  document_id: string | null
  form_version_id: string | null
  code: string
  title: string
  commission_id: string
  commission_name: string
  review_due_date: string | null
  is_overdue: boolean
}

/**
 * The review-due list for a commission: controlled documents whose `reviewDueDate`
 * has passed/approaches PLUS overdue published form versions (the form arm). Backed
 * by the `documents_due_for_review` DEFINER RPC. `[]` when out of scope.
 */
export async function listDocumentsDueForReview(commissionId: string): Promise<ReviewDueRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('documents_due_for_review', { p_commission: commissionId })
    .returns<ReviewDueRpcRow[]>()

  return (data ?? []).map((r) => ({
    sourceKind: r.source_kind === 'form' ? 'form' : 'document',
    documentId: r.document_id,
    formVersionId: r.form_version_id,
    code: r.code,
    title: r.title,
    commissionId: r.commission_id,
    commissionName: r.commission_name,
    reviewDueDate: r.review_due_date,
    isOverdue: r.is_overdue,
  }))
}

interface RegisterRpcRow {
  document_id: string
  commission_id: string
  commission_name: string
  code: string
  title: string
  doc_type: string
  status: string
  current_version_number: number | null
  effective_date: string | null
  review_due_date: string | null
  is_review_overdue: boolean
}

/**
 * The PHI-FREE hospital-wide controlled-document register (metadata + review-due,
 * across the hospital's commissions). Backed by the `hospital_document_register`
 * DEFINER RPC (admin / hospital_admin / org_admin-gated); `[]` for a foreign
 * hospital_admin.
 */
export async function getHospitalDocumentRegister(
  hospitalId: string,
  filters?: HospitalRegisterFilters,
): Promise<HospitalDocumentRegisterRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('hospital_document_register', {
      p_hospital: hospitalId,
      p_doc_type: filters?.docType ?? undefined,
      p_status: filters?.status ?? undefined,
      p_review_overdue_only: filters?.reviewOverdueOnly ?? false,
    })
    .returns<RegisterRpcRow[]>()

  return (data ?? []).map((r) => ({
    documentId: r.document_id,
    commissionId: r.commission_id,
    commissionName: r.commission_name,
    code: r.code,
    title: r.title,
    docType: r.doc_type as DocType,
    status: r.status as DocStatus,
    currentVersionNumber: r.current_version_number,
    effectiveDate: r.effective_date,
    reviewDueDate: r.review_due_date,
    isReviewOverdue: r.is_review_overdue,
  }))
}

interface ApproverCandidateRow {
  id: string
  name: string
  title: string | null
}

/**
 * The selectable approvers for a commission's submit-for-approval picker: active
 * same-hospital users (ADR 0057), callable by a staff_admin/coordinator of the
 * commission (not necessarily a hospital_admin). Backed by the
 * `list_approver_candidates` DEFINER RPC; `[]` for a foreign-hospital caller.
 * Minimum-necessary — no email/PHI.
 */
export async function listApproverCandidates(commissionId: string): Promise<ApproverCandidate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('list_approver_candidates', { p_commission: commissionId })
    .returns<ApproverCandidateRow[]>()

  return (data ?? []).map((r) => ({ id: r.id, name: r.name, title: r.title }))
}

/**
 * Mint a short-lived signed download URL for a controlled-document storage object.
 * Server-side only (the `controlled-documents` bucket is private; SELECT is gated
 * by the DEFINER storage predicate incl. the approver arm). `null` when the object
 * is not readable by the caller / does not exist.
 */
export async function createSignedDownloadUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('controlled-documents')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  return data?.signedUrl ?? null
}
