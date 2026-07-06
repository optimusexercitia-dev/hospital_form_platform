/**
 * Controlled-document version selection (Phase 17) — the SINGLE source of truth for
 * "which version does an ACTION target?" vs "which version is IN FORCE?". CLIENT-SAFE
 * and PURE (no I/O, no server-only imports) — the `types.ts` purity contract — so
 * both the coordinator detail page and the org-level approver-detail page consume
 * ONE implementation and can never diverge again (the BUG-DOC-004 / BUG-DOC-005 class).
 *
 * The distinction that these helpers encode (do NOT collapse them):
 *  - **In-force version** = `controlled_documents.current_version_id` (resolved by the
 *    caller). It drives the READ view — status chip, effective/review dates, the
 *    register, review-due, and the "current" download. After a supersede it stays on
 *    the prior `vigente` version until the new one publishes. NEVER pick an ACTION
 *    target off this pointer.
 *  - **Working draft** = the single open revision (`rascunho` OR `em_aprovacao`).
 *    There is AT MOST ONE, guaranteed by the DB's HC089 single-open-draft rule. This
 *    is what authoring affordances (upload / submit / sign / publish) target.
 *  - **Signable version** = the `em_aprovacao` working draft specifically — the only
 *    version an approver may sign on.
 */

import type {
  ControlledDocumentVersion,
  DocumentApproval,
} from '@/lib/documents/types'

/**
 * The single OPEN revision of a document — the `rascunho` or `em_aprovacao` version —
 * or `null` when the document has no in-progress draft (fully published/obsoleted).
 * At most one exists (HC089 single-open-draft rule); if the data ever violates that,
 * the earliest such version wins (deterministic — `versions` arrive newest-first, so
 * we scan for the last match to prefer the lowest version_number). This is the version
 * ALL authoring affordances (upload → submit → sign → publish) must target — NOT the
 * in-force `current_version_id`.
 */
export function selectWorkingDraft(
  versions: ControlledDocumentVersion[],
): ControlledDocumentVersion | null {
  const open = versions.filter(
    (v) => v.status === 'rascunho' || v.status === 'em_aprovacao',
  )
  if (open.length === 0) return null
  // Prefer the lowest version_number for stability if the invariant is ever broken.
  return open.reduce((lowest, v) =>
    v.versionNumber < lowest.versionNumber ? v : lowest,
  )
}

/**
 * The version an approver may SIGN — the `em_aprovacao` working draft — or `null` when
 * no version is under approval. The only signable state; an approver named on this
 * version signs against ITS id, never the in-force `current_version_id`.
 */
export function selectSignableVersion(
  versions: ControlledDocumentVersion[],
): ControlledDocumentVersion | null {
  const draft = selectWorkingDraft(versions)
  return draft && draft.status === 'em_aprovacao' ? draft : null
}

/**
 * The caller's own approval row on a SPECIFIC version (matched by
 * `documentVersionId` — NOT the first row across all versions, which would resolve
 * off the wrong version after a supersede). `null` when the caller was not named on
 * that version.
 */
export function findMyApprovalForVersion(
  approvals: DocumentApproval[],
  versionId: string,
  userId: string,
): DocumentApproval | null {
  return (
    approvals.find(
      (a) => a.documentVersionId === versionId && a.approverId === userId,
    ) ?? null
  )
}
