/**
 * Controlled Documents (Phase 17 — Gestão de Documentos Controlados) — CLIENT-SAFE
 * domain types + label maps.
 *
 * **Purity contract** (the `indicators/types.ts` / `safety/capa-types.ts` discipline).
 * This module has ZERO runtime imports of server-only code — it stays importable
 * from CLIENT components (the register list, the detail view, the approval queue,
 * the upload dialog). It must NEVER import `@/lib/supabase/*`, `next/headers`,
 * `server-only`, or any data-access/action module. The server-only readers
 * (`@/lib/queries/documents`) and the `"use server"` actions
 * (`@/lib/documents/actions`) import their types FROM here.
 *
 * A controlled document is a hospital policy/POP/protocolo/regimento/manual under a
 * controlled lifecycle (`rascunho → em_aprovacao → vigente → obsoleto`) with a
 * named-approver e-signature workflow, effective/expiry dates, and a scheduled
 * review cycle (JCI MOI document control). Version-level status: the header's
 * status is DERIVED from its current version. Commission-owned; the hospital tier
 * sees only the read-only DEFINER register rollup. PHI-FREE by design (ADR 0057,
 * ARCHITECTURE.md Rule 12).
 *
 * Stable ASCII union slugs are the storage/logic values; user-facing strings are
 * pt-BR (via the label maps below). The `summary_of_changes` / approval `note`
 * bodies are sanitized Markdown (Rule 7) and are NEVER copied into the audit log
 * (Rule 11).
 */

// ---------------------------------------------------------------------------
// Domain unions — the FIXED vocabulary (ASCII storage values; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * The controlled-document kind (JCI MOI categories). `politica` (policy),
 * `pop` (procedimento operacional padrão), `protocolo`, `regimento`, `manual`,
 * `outro` (catch-all).
 */
export type DocType = 'politica' | 'pop' | 'protocolo' | 'regimento' | 'manual' | 'outro'

/**
 * The version lifecycle (the header `status` mirrors its CURRENT version).
 * `rascunho` (draft, editable) → `em_aprovacao` (approver set frozen, awaiting
 * e-signatures) → `vigente` (published/in-force, immutable) → `obsoleto`
 * (superseded/retired, retained + downloadable). A `rejeitado` decision returns a
 * version from `em_aprovacao` to `rascunho` (it is not a status of its own).
 */
export type DocStatus = 'rascunho' | 'em_aprovacao' | 'vigente' | 'obsoleto'

/**
 * A single approver's decision on a version. `null` while the approval is PENDING
 * (the row exists — and GRANTS READ — from submit; the decision lands at sign
 * time). `aprovado` (approved) / `rejeitado` (rejected, with a note).
 */
export type ApprovalDecision = 'aprovado' | 'rejeitado'

// ---------------------------------------------------------------------------
// Row-shaped domain objects (camelCase; the query layer maps snake_case rows)
// ---------------------------------------------------------------------------

/**
 * A controlled document (the header). Commission-owned (`commissionId`); the
 * hospital tier sees only the read-only register rollup, never the row (ADR 0057).
 * `status` is DERIVED from the current version (`currentVersionId`).
 */
export interface ControlledDocument {
  id: string
  commissionId: string
  /**
   * The hospital the document's commission belongs to (`hospital_of_commission`).
   * DISPLAY-ONLY — lets the UI decide which affordances to render (e.g. name an
   * approver from the same hospital) without provoking a 42501. The real authority
   * boundary stays the RPC-side approver-entitlement check.
   */
  hospitalId: string
  code: string
  title: string
  docType: DocType
  reviewCycleMonths: number | null
  status: DocStatus
  currentVersionId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * One version of a controlled document. `storagePath` is IMMUTABLE and NEW per
 * upload (Rule 6) — the file object is never overwritten. `reviewDueDate` is
 * computed `effectiveDate + reviewCycleMonths` at publish (overridable). `status`
 * is the version's own lifecycle state; the header mirrors the current version.
 */
export interface ControlledDocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  storagePath: string | null
  summaryOfChangesMd: string | null
  effectiveDate: string | null
  reviewDueDate: string | null
  expiryDate: string | null
  status: DocStatus
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

/**
 * One named-approver e-signature slot for a version. Created PENDING at submit
 * (`decision` null) — the pending row is what GRANTS READ of the document/version/
 * storage object to an approver from OUTSIDE the commission (the case_access-style
 * OR-arm). `signatureHash` is the sha256 e-signature over the storage object
 * reference + decision, set at sign time (mirrors `meeting_signatures.content_hash`).
 */
export interface DocumentApproval {
  id: string
  documentVersionId: string
  approverId: string
  approverName: string | null
  approverTitle: string | null
  decision: ApprovalDecision | null
  decidedAt: string | null
  note: string | null
  signatureHash: string | null
  createdAt: string
}

/**
 * A controlled document plus its current version summary, for the register list.
 * Lets the F1 list render the status chip + review-due state WITHOUT a per-row
 * detail round trip.
 */
export interface ControlledDocumentListItem extends ControlledDocument {
  currentVersionNumber: number | null
  effectiveDate: string | null
  reviewDueDate: string | null
  /** Convenience flag: `reviewDueDate` is non-null and in the past (as of read). */
  isReviewOverdue: boolean
}

/**
 * A full document detail bundle: the header, its versions (newest first), and the
 * approvals of the current (or a named) version. What the F3 detail page renders.
 */
export interface ControlledDocumentDetail {
  document: ControlledDocument
  versions: ControlledDocumentVersion[]
  /** Approvals of the current version (or the version under approval). */
  approvals: DocumentApproval[]
}

/**
 * One row of the per-user approval queue ("pendentes de aprovação"). Surfaced at
 * ORG level (not commission-gated) so an outside-commission same-hospital approver
 * can reach the documents they were named on. Carries just enough to render the
 * queue row + link to the document.
 */
export interface PendingApprovalRow {
  approvalId: string
  documentId: string
  documentVersionId: string
  code: string
  title: string
  docType: DocType
  versionNumber: number
  commissionId: string
  commissionName: string
  submittedAt: string
}

/**
 * One row of the review-due list: a controlled document (or a published form
 * version acting as a controlled document) whose `reviewDueDate` has passed or is
 * approaching. `sourceKind` distinguishes the two feeds; `formVersionId` is set
 * only for the form arm.
 */
export interface ReviewDueRow {
  sourceKind: 'document' | 'form'
  /** The controlled-document id (document arm) — null for the form arm. */
  documentId: string | null
  /** The form-version id (form arm) — null for the document arm. */
  formVersionId: string | null
  code: string
  title: string
  commissionId: string
  commissionName: string
  reviewDueDate: string | null
  isOverdue: boolean
}

/**
 * One row of the PHI-FREE hospital-wide controlled-document register (the DEFINER
 * rollup, gated `is_hospital_admin_of`/org-admin — the `nsp_org_*` pattern). The
 * institution-wide list across commissions: type/status/review-due, NO Markdown
 * bodies or storage paths.
 */
export interface HospitalDocumentRegisterRow {
  documentId: string
  commissionId: string
  commissionName: string
  code: string
  title: string
  docType: DocType
  status: DocStatus
  currentVersionNumber: number | null
  effectiveDate: string | null
  reviewDueDate: string | null
  isReviewOverdue: boolean
}

// ---------------------------------------------------------------------------
// pt-BR label maps (user-facing strings; storage stays ASCII)
// ---------------------------------------------------------------------------

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  politica: 'Política',
  pop: 'POP',
  protocolo: 'Protocolo',
  regimento: 'Regimento',
  manual: 'Manual',
  outro: 'Outro',
}

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  rascunho: 'Rascunho',
  em_aprovacao: 'Em aprovação',
  vigente: 'Vigente',
  obsoleto: 'Obsoleto',
}

export const APPROVAL_DECISION_LABELS: Record<ApprovalDecision, string> = {
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}
