import type { DocumentAvailability } from '@/lib/documents/types'

/**
 * Controlled Documents (Phase 17 — Gestão de Documentos Controlados) — CLIENT-SAFE
 * domain types + label maps.
 *
 * ⚠ The `@/lib/documents/types` import above is types + consts only (no
 * server-only runtime), so the client-safety rule in the header below still
 * holds. Do not "upgrade" it to a value import from `@/lib/queries/*` — that is
 * the BUG-FBE-005 class, which aborts `next build` while tsc/lint/vitest pass.
 *
 * **Purity contract** (the `indicators/types.ts` / `safety/capa-types.ts` discipline).
 * This module has ZERO runtime imports of server-only code — it stays importable
 * from CLIENT components (the register list, the detail view, the approval queue,
 * the upload dialog). It must NEVER import `@/lib/supabase/*`, `next/headers`,
 * `server-only`, or any data-access/action module. The server-only readers
 * (`@/lib/queries/controlled-documents`) and the `"use server"` actions
 * (`@/lib/controlled-documents/actions`) import their types FROM here.
 *
 * A controlled document is a hospital policy/POP/protocolo/regimento/manual under a
 * controlled lifecycle (`draft → in_approval → effective → obsolete`) with a
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
 * The controlled-document kind (JCI MOI categories). English internal keys
 * (anglicized in ADR 0081 by ADR 0069's 1:1 method — pt-BR labels unchanged):
 * `policy` (Política), `sop` (POP — procedimento operacional padrão),
 * `protocol` (Protocolo), `bylaws` (Regimento — named `bylaws` not `charter` to
 * avoid overlap with the `commission_charters` feature), `manual` (Manual),
 * `other` (Outro — catch-all).
 */
export type DocType = 'policy' | 'sop' | 'protocol' | 'bylaws' | 'manual' | 'other'

/**
 * The version lifecycle (the header `status` mirrors its CURRENT version).
 * `draft` (editable) → `in_approval` (approver set frozen, awaiting
 * e-signatures) → `effective` (published/in-force, immutable) → `obsolete`
 * (superseded/retired, retained + downloadable). A reviewer `rejected` decision
 * moves the version from `in_approval` to `changes_requested` — a first-class,
 * visible "revise in place" state (NOT `draft`): the coordinator re-attaches a
 * corrected file + reviewer set and re-submits the SAME version (no version bump).
 * The card keeps listing all originally-named approvers with their verdicts.
 */
export type DocStatus = 'draft' | 'in_approval' | 'changes_requested' | 'effective' | 'obsolete'

/**
 * A single approver's decision on a version. `null` while the approval is PENDING
 * (the row exists — and GRANTS READ — from submit; the decision lands at sign
 * time). English keys (ADR 0081): `approved` (Aprovado) / `rejected` (Rejeitado,
 * with a note).
 */
export type ApprovalDecision = 'approved' | 'rejected'

/**
 * Why an obsolete version was retired (`controlled_document_versions.obsolete_kind`;
 * ADR 0081). `superseded` — a newer version was published over it (stamped by
 * `publish_document`). `retired` — retired without a replacement (`mark_document_obsolete`).
 * `null` while the version is not obsolete.
 */
export type ObsoleteKind = 'superseded' | 'retired'

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
  /** Free-text category (ADR 0081 O1) — null when unset. */
  category: string | null
  /** Free-text tag set (ADR 0081) — `[]` when none. */
  tags: string[]
  /** Free-text description (ADR 0081 Wave 2.5a) — null when unset. */
  description: string | null
  reviewCycleMonths: number | null
  status: DocStatus
  currentVersionId: string | null
  createdAt: string
  updatedAt: string
  // ⚠ NO `coreDocumentId` here, deliberately (§7 amendment, DM3). The core
  // `documents` id is an internal seam: `beginControlledVersionUpload` resolves
  // it server-side from the domain id, so no caller needs it. Exposing it would
  // also have forced a lie in the list projection — `list_commission_documents`
  // is a DEFINER rollup that does not return the column, so every list row
  // would have carried `null`, which reads as "this document has no core
  // document" rather than "this projection doesn't carry it".
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
  /**
   * The core `document_versions` row carrying this version's file (DM3 M3).
   * `null` until a file is attached. Movable only while the domain version is
   * `draft`/`changes_requested` — the DB enforces that twice (the door's HC089
   * and `app.guard_controlled_core_binding`'s HC0DB).
   *
   * ⚠ Do NOT gate affordances on this being non-null: a bound version can still
   * be unservable (upload in flight, scan failed, disposed). Gate on
   * {@link ControlledDocumentVersion.availability}.
   */
  coreDocumentVersionId: string | null
  /**
   * Whether the byte door would serve this version RIGHT NOW — derived by the
   * shared `documentVersionAvailability` predicate, which is written to agree
   * with `open_document_version` exactly. `available` ⟺ the door serves.
   */
  availability: DocumentAvailability
  summaryOfChangesMd: string | null
  effectiveDate: string | null
  reviewDueDate: string | null
  expiryDate: string | null
  /**
   * The wizard's proposed effective date; `publish_document` defaults the effective
   * date from it. Not a scheduler (ADR 0081). Null when not collected.
   */
  proposedEffectiveDate: string | null
  /** Reviewer-response deadline (ADR 0081 O2) — feeds Remind/overdue reminders. */
  approvalDueDate: string | null
  status: DocStatus
  /**
   * Set only when `status === 'obsolete'`: `superseded` (a newer version published
   * over it) vs `retired` (marked obsolete with no replacement). Null otherwise.
   */
  obsoleteKind: ObsoleteKind | null
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
  /**
   * The current version's `obsoleteKind` (ADR 0081) — lets the "Arquivados" chip
   * distinguish superseded vs retired without a detail round trip. Null unless the
   * document (its current version) is obsolete.
   */
  obsoleteKind: ObsoleteKind | null
  /**
   * True when the current version is `effective` AND an open sibling draft/
   * in_approval version exists (Wave 2.5a) — drives the derived "Em revisão"
   * chip/KPI. Computed DB-side (no FE N+1).
   */
  hasOpenRevision: boolean
  /**
   * Approvals over the document's in_approval version (Wave 2.5a) — drives the
   * `in_approval` mini-bar (`signed/total`). Both 0 when no version is in approval.
   */
  approvalsSignedCount: number
  approvalsTotalCount: number
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
  policy: 'Política',
  sop: 'POP',
  protocol: 'Protocolo',
  bylaws: 'Regimento',
  manual: 'Manual',
  other: 'Outro',
}

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft: 'Rascunho',
  in_approval: 'Em aprovação',
  changes_requested: 'Alterações solicitadas',
  effective: 'Vigente',
  obsolete: 'Obsoleto',
}

export const APPROVAL_DECISION_LABELS: Record<ApprovalDecision, string> = {
  approved: 'Aprovado',
  // The reviewer verdict key stays English `rejected`; its label reads as the
  // action it now triggers — a first-class `changes_requested` revision round.
  rejected: 'Alterações solicitadas',
}

export const OBSOLETE_KIND_LABELS: Record<ObsoleteKind, string> = {
  superseded: 'Substituído',
  retired: 'Descontinuado',
}
