import { createClient } from '@/lib/supabase/server'
import { caseCorrectionsEnabled } from '@/lib/queries/feature-flags'
import type { Database, Json } from '@/lib/types/database'

/**
 * Case Correction Lifecycle READ side (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). RLS-scoped: the `case_correction_requests` /
 * `case_narrative_revisions` SELECT policies gate every row to case-content readers
 * (`app.can_read_case`), so the cookie (RLS) client is the authority; these readers
 * add no server-side pre-check. The WRITE side (the 8 correction doors + reopen)
 * lives in `@/lib/corrections/actions` and `@/lib/cases/actions`.
 *
 * Everything is gated behind the `case_corrections` feature flag and is a no-op
 * (`[]` / `null`) when the flag is off. Any error also safe-defaults to `[]` / `null`
 * — these reads render alongside the case detail and must never throw.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** What a correction request does to its target. */
export type CorrectionKind = 'correction' | 'addendum' | 'void'

/**
 * Workflow state. `rejected` is a RESTING state (the corrector's next edit flips it
 * back to `in_progress`); `approved` / `withdrawn` are terminal.
 */
export type CorrectionStatus =
  | 'requested'
  | 'in_progress'
  | 'resubmitted'
  | 'under_review'
  | 'rejected'
  | 'approved'
  | 'withdrawn'

/** Descriptive classification (never gates — the approver reviews the diff). */
export type CorrectionClassification =
  | 'clerical'
  | 'factual'
  | 'interpretative'
  | 'substantive'
  | 'compliance_related'

/** One correction request (camelCase projection of the row). */
export interface CorrectionRequest {
  id: string
  caseId: string
  commissionId: string
  kind: CorrectionKind
  /** Exactly one target is set (phase XOR narrative). */
  casePhaseId: string | null
  caseNarrativeId: string | null
  status: CorrectionStatus
  /** pt-BR justification (mandatory). */
  reason: string
  classification: CorrectionClassification
  requestedBy: string
  requestedAt: string
  /** The designated corrector (defaults to the target's assignee). */
  permittedCorrector: string | null
  predecessorResponseId: string | null
  /** The in-progress successor (phase kinds). */
  draftResponseId: string | null
  /** The draft narrative body (narrative kinds); PHI-bearing free text. */
  draftBodyMd: string | null
  lastRejectedBy: string | null
  lastRejectedAt: string | null
  lastRejectedReason: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  /** True when the approver was the requester or the corrector (recorded). */
  selfApproved: boolean
  /** Downstream phases active/completed at approval (jsonb array); null until approved. */
  impactSnapshot: Json | null
  createdAt: string
  updatedAt: string
}

/** One append-only snapshot of a superseded narrative body. */
export interface NarrativeRevision {
  id: string
  caseNarrativeId: string
  correctionRequestId: string | null
  revisionNumber: number
  /** The OLD (superseded) body; PHI-bearing free text. */
  bodyMd: string
  snapshottedAt: string
  snapshottedBy: string | null
}

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

type CorrectionRequestRow =
  Database['public']['Tables']['case_correction_requests']['Row']
type NarrativeRevisionRow =
  Database['public']['Tables']['case_narrative_revisions']['Row']

function toCorrectionRequest(row: CorrectionRequestRow): CorrectionRequest {
  return {
    id: row.id,
    caseId: row.case_id,
    commissionId: row.commission_id,
    kind: row.kind as CorrectionKind,
    casePhaseId: row.case_phase_id,
    caseNarrativeId: row.case_narrative_id,
    status: row.status as CorrectionStatus,
    reason: row.reason,
    classification: row.classification as CorrectionClassification,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    permittedCorrector: row.permitted_corrector,
    predecessorResponseId: row.predecessor_response_id,
    draftResponseId: row.draft_response_id,
    draftBodyMd: row.draft_body_md,
    lastRejectedBy: row.last_rejected_by,
    lastRejectedAt: row.last_rejected_at,
    lastRejectedReason: row.last_rejected_reason,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    selfApproved: row.self_approved,
    impactSnapshot: row.impact_snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toNarrativeRevision(row: NarrativeRevisionRow): NarrativeRevision {
  return {
    id: row.id,
    caseNarrativeId: row.case_narrative_id,
    correctionRequestId: row.correction_request_id,
    revisionNumber: row.revision_number,
    bodyMd: row.body_md,
    snapshottedAt: row.snapshotted_at,
    snapshottedBy: row.snapshotted_by,
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * All correction requests for a case, newest-first. RLS-scoped to case readers;
 * `[]` when the flag is off or on any error.
 */
export async function listCaseCorrectionRequests(
  caseId: string,
): Promise<CorrectionRequest[]> {
  if (!caseId) return []
  if (!(await caseCorrectionsEnabled())) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_correction_requests')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data.map(toCorrectionRequest)
}

/**
 * A single correction request by id (RLS-scoped). `null` when the flag is off,
 * not found / not visible, or on any error.
 */
export async function getCorrectionRequest(
  id: string,
): Promise<CorrectionRequest | null> {
  if (!id) return null
  if (!(await caseCorrectionsEnabled())) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_correction_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return toCorrectionRequest(data)
}

/**
 * The revision history of a narrative (the superseded bodies), newest-first.
 * RLS-scoped to case readers; `[]` when the flag is off or on any error.
 */
export async function listNarrativeRevisions(
  narrativeId: string,
): Promise<NarrativeRevision[]> {
  if (!narrativeId) return []
  if (!(await caseCorrectionsEnabled())) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_narrative_revisions')
    .select('*')
    .eq('case_narrative_id', narrativeId)
    .order('revision_number', { ascending: false })

  if (error || !data) return []
  return data.map(toNarrativeRevision)
}
