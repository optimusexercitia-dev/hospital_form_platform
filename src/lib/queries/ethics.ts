import 'server-only'

import { cache } from 'react'

/**
 * Ethics procedure — read projection (ETH·E2; ADR 0073; Architecture Rule 9).
 * Backs the disciplinary lifecycle: admissibility → allegations/findings →
 * hearing → vote → decision → appeal, on top of the E1 (ADR 0072) access spine.
 *
 * ============================ CONTRACT-FIRST STUB (BE-1) ============================
 * Typed SIGNATURES + domain types are the frozen contract `frontend` (E2's own
 * minimal UI + E3a) builds against. Bodies `throw new Error('not implemented')`
 * until BE-2..BE-8 land the migrations + the backing RPC. The exported
 * shapes/types are the stable contract — do NOT change them without telling the
 * lead so `frontend` can adapt. No `Database` (`src/lib/types/database.ts`) types
 * are referenced here: no ethics migration has landed yet, so these are
 * HAND-AUTHORED ahead of the generator (Rule 8) and get reconciled against it
 * once BE-2 regenerates `database.ts`.
 *
 * **Companion-read decision (build-plan §2.3 "Modified reads" call).** Rather
 * than extend `getCaseDetail` (`src/lib/queries/cases.ts`) — the platform's
 * most-consumed case read, already carrying the ADR-0033/0024/0032 fields + the
 * E1 (ADR 0072) confidentiality/visibility/participants/recusal additions —
 * this is a COMPANION read, `get_ethics_case_procedure(p_case_id)`, a new
 * `SECURITY DEFINER` RPC mirroring `get_case_detail` exactly: internally
 * `can_read_case`-gated (no new RLS shape — E1 D2/§7 of the reconciliation
 * addendum), `null` when the caller cannot read the case, the case does not
 * exist, or the case is not ethics-typed. This is the plan's own recommended
 * option (limits blast radius on `get_case_detail`); flag to the lead if a
 * merged single read is preferred instead.
 *
 * **Design calls made resolving §2.3 under-specification (flag if wrong):**
 *  - `EthicsFinding` is EMBEDDED on its parent `EthicsAllegation` (1:1 —
 *    `unique(allegation_id)`), not a parallel top-level array. Avoids a second
 *    client-side join over a constraint that already guarantees at most one.
 *  - The "eligible-voter count, and the caller's vote" (§2.3) is inherently
 *    PER-DECISION, not per-case (`case_votes.decision_id`, `unique(decision_id,
 *    voter_id)`; a case may carry several `case_decisions`). Modeled on
 *    {@link CaseDecision} as `eligibleVoterCount` / `castVoteCount` / `myVote`,
 *    backed by `app.eligible_voters(p_case_id)` (§2.2) — never an RLS term, so
 *    it does not leak WHO is recused to a non-coordinator (ADR 0073 §D4).
 *  - `AllegationCategory` / `CaseAssignmentRole` catalog LIST reads
 *    ({@link listEthicsAllegationCategories}, {@link listCaseAssignmentRoles})
 *    are added beyond the §2.3 "Modified reads" list because the allegation /
 *    assignment-role PICKERS need them; mirrors no existing catalog-list
 *    precedent verbatim (`case_participant_roles` today resolves inline via a
 *    join, not a standalone list) but follows the vocabulary-CRUD shape used
 *    elsewhere (e.g. `case_outcomes`).
 *  - `SanctionType` is `string | null` (free text), NOT a closed union, even
 *    though ADR 0073 §D3's prose calls `sanction_type` "a catalog" — the §2.1
 *    DDL declares `sanction_type text` with NO CHECK constraint and NO catalog
 *    table (unlike `ethics_allegation_categories` / `case_assignment_roles`,
 *    which the DDL genuinely tables). Flagged to the lead as a reconciliation
 *    gap in the BE-1 report; do not treat this as a closed enum until BE-2
 *    resolves it one way or the other.
 * =======================================================================================
 */

// ---------------------------------------------------------------------------
// Not-implemented stub helper (BE-1). References every arg so the frozen
// param names stay lint-clean; BE-2..BE-8 replace each body with the real
// RPC call (mirrors `src/lib/case-recusals/actions.ts`).
// ---------------------------------------------------------------------------

function notImplemented(fn: string, ..._args: unknown[]): never {
  throw new Error(`${fn} not implemented (ETH·E2 BE-2..BE-8 — contract stub)`)
}

// ---------------------------------------------------------------------------
// Domain unions — the FROZEN vocabulary (ASCII storage values; pt-BR labels
// resolved by the UI, per feature — none minted yet, Rule 10)
// ---------------------------------------------------------------------------

/** `ethics_case_details.admissibility_status` (ADR 0073 D1). */
export type AdmissibilityStatus = 'pending' | 'admissible' | 'inadmissible'

/** `ethics_case_details.complaint_channel` (D1). */
export type ComplaintChannel =
  | 'internal'
  | 'patient'
  | 'external_body'
  | 'anonymous'
  | 'other'

/** `ethics_allegations.status` (D2). */
export type AllegationStatus =
  | 'under_review'
  | 'substantiated'
  | 'not_substantiated'
  | 'partially_substantiated'
  | 'dismissed'
  | 'referred_elsewhere'

/** `ethics_allegations.severity` (D2; nullable). */
export type AllegationSeverity = 'low' | 'moderate' | 'high' | 'critical'

/** `ethics_findings.finding` (D2). */
export type FindingValue =
  | 'substantiated'
  | 'not_substantiated'
  | 'partially_substantiated'
  | 'inconclusive'
  | 'dismissed'

/** `case_decisions.status` (D3 — engine-level). */
export type DecisionStatus =
  | 'draft'
  | 'proposed'
  | 'voted'
  | 'issued'
  | 'appealed'
  | 'voided'

/** `case_votes.vote` (D4). Deliberately NO `'recused'` member — recusal is an
 * access fact (E1), not a ballot option; see `cast_case_vote` (HC0J5). */
export type VoteValue = 'approve' | 'reject' | 'abstain'

/**
 * One `ethics_sanction_types` row (D3; lead ruling 4 — the CEM sanction vocabulary
 * IS a catalog, org-scoped, seeded advertência/censura/suspensão/cassação). Mirrors
 * {@link AllegationCategory} / {@link CaseAssignmentRole}.
 * `ethics_decision_details.sanction_type_id` FKs here (nullable — null = no sanction).
 */
export interface SanctionType {
  id: string
  organizationId: string
  key: string
  displayName: string
  isActive: boolean
  position: number
}

/** `ethics_decision_details.external_reporting_target` (D3). */
export type ExternalReportingTarget =
  | 'crm'
  | 'cfm'
  | 'legal_department'
  | 'police'
  | 'other'

/** `ethics_notifications.notification_type` (D5). */
export type NotificationType =
  | 'complaint_acknowledgement'
  | 'respondent_notification'
  | 'request_for_response'
  | 'hearing_notice'
  | 'decision_notice'
  | 'appeal_notice'
  | 'external_reporting_notice'
  | 'other'

/** `ethics_notifications.delivery_method` (D5). */
export type NotificationDeliveryMethod =
  | 'email'
  | 'letter'
  | 'in_person'
  | 'system'
  | 'phone'
  | 'other'

/** `ethics_notifications.status` (D5). */
export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'acknowledged'
  | 'failed'
  | 'cancelled'

/** `ethics_hearings.hearing_type` (D8). */
export type HearingType =
  | 'initial_hearing'
  | 'evidence_hearing'
  | 'deliberation_hearing'
  | 'appeal_hearing'
  | 'other'

/** `ethics_appeals.status` (D-appeals). */
export type AppealStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'closed'

// ---------------------------------------------------------------------------
// Catalog row types (dialect-2, ADR 0065; org-scoped, extensible without a
// migration — Appendix B)
// ---------------------------------------------------------------------------

/** One `ethics_allegation_categories` row (D2). */
export interface AllegationCategory {
  id: string
  organizationId: string
  key: string
  displayName: string
  isActive: boolean
  position: number
}

/** One `case_assignment_roles` row (D10 — relator/revisor/presidente/…). */
export interface CaseAssignmentRole {
  id: string
  organizationId: string
  key: string
  displayName: string
  isActive: boolean
}

// ---------------------------------------------------------------------------
// Procedure domain shapes
// ---------------------------------------------------------------------------

/** `ethics_case_details` (D1) — the 1:1 admissibility/intake extension. */
export interface EthicsCaseDetails {
  caseId: string
  admissibilityStatus: AdmissibilityStatus
  admissibilityDecidedAt: string | null
  admissibilityDecidedBy: string | null
  admissibilityRationaleMd: string | null
  complaintChannel: ComplaintChannel | null
  complaintReceivedAt: string | null
  summaryMd: string | null
  createdAt: string
  updatedAt: string
}

/** `ethics_findings` (D2) — the current conclusion on one allegation. */
export interface EthicsFinding {
  id: string
  allegationId: string
  /** Denormalized from the parent allegation (R6-safe base-table RLS). */
  caseId: string
  finding: FindingValue
  rationaleMd: string | null
  evidenceSummaryMd: string | null
  decidedBy: string | null
  decidedAt: string
  createdAt: string
  updatedAt: string
}

/** `ethics_allegations` (D2), with its current {@link EthicsFinding} embedded
 * (`unique(allegation_id)` — at most one; `null` before `record_ethics_finding`). */
export interface EthicsAllegation {
  id: string
  caseId: string
  allegationCategoryId: string
  /** Resolved LIVE against the catalog (label may change post-hoc), mirroring
   * `ResolvedCaseOutcome`. `null` if the category was archived-away. */
  category: AllegationCategory | null
  descriptionMd: string
  allegedEventDate: string | null
  severity: AllegationSeverity | null
  status: AllegationStatus
  createdBy: string | null
  createdAt: string
  updatedAt: string
  finding: EthicsFinding | null
}

/** `case_votes` (D4) — one member's cast ballot on one decision. */
export interface CaseVote {
  id: string
  caseId: string
  decisionId: string
  meetingId: string | null
  voterId: string
  vote: VoteValue
  rationaleMd: string | null
  votedAt: string
}

/** `ethics_decision_details` (D3) — the 1:1 ethics extension of a `case_decisions` row. */
export interface EthicsDecisionDetails {
  decisionId: string
  /** `ethics_sanction_types.id`, or `null` (no sanction). */
  sanctionTypeId: string | null
  /** The sanction resolved LIVE against the catalog (label propagates), or `null`
   * when unset / archived-away. Same shape as {@link EthicsAllegation.category}. */
  sanctionType: SanctionType | null
  sanctionStartDate: string | null
  sanctionEndDate: string | null
  remediationRequired: boolean
  remediationDescriptionMd: string | null
  externalReportingRequired: boolean
  externalReportingTarget: ExternalReportingTarget | null
  /** The ADR-0037 hand-off (§D7), or `null` (off-platform target — see the
   * `ethics_notifications` `external_reporting_notice` fallback). */
  externalReportingReferralId: string | null
  externalReportingDeadline: string | null
  externalReportingCompletedAt: string | null
  appealAllowed: boolean
  appealDeadline: string | null
  /** F2 attachment; rides the ORDINARY case-confidentiality gate pre-pilot —
   * the `legal_privileged` clearance ceiling defers to Stage E (post-pilot,
   * 0078 A19/B3; see ADR 0073's 2026-07-18 Amendment §3). */
  decisionLetterDocumentId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * `case_decisions` (D3 — ENGINE-LEVEL; M&M/credentialing reuse it) with its
 * ethics extension + vote-roster projection embedded. `eligibleVoterCount` /
 * `castVoteCount` / `myVote` are `app.eligible_voters` / `case_votes`
 * projections, NOT RLS terms (§2.2) — safe to show "5 de 7 membros aptos a
 * votar" without leaking who is recused to a non-coordinator.
 */
export interface CaseDecision {
  id: string
  caseId: string
  decisionType: string
  summaryMd: string
  rationaleMd: string | null
  status: DecisionStatus
  decidedAt: string | null
  decidedBy: string | null
  createdAt: string
  updatedAt: string
  /** `null` until `set_ethics_decision_details` runs. */
  details: EthicsDecisionDetails | null
  /** `app.eligible_voters(case_id)` roster size (commission members minus
   * recused minus respondent). */
  eligibleVoterCount: number
  /** How many of the eligible roster have cast a ballot so far (any of
   * approve/reject/abstain) — the optional-quorum affordance (O-3). */
  castVoteCount: number
  /** The CALLER's own ballot on THIS decision, or `null` if not cast / not eligible. */
  myVote: CaseVote | null
}

/** `ethics_notifications` (D5) — a formal notice with a deadline; feeds the N
 * scan arm (X-ζ, BE-7) via `due_at`. */
export interface EthicsNotification {
  id: string
  caseId: string
  recipientParticipantId: string | null
  /** Set when the recipient is a platform user; `null` routes reminders to
   * the case's coordinator instead (X-ζ contract). */
  recipientUserId: string | null
  notificationType: NotificationType
  deliveryMethod: NotificationDeliveryMethod
  status: NotificationStatus
  sentAt: string | null
  acknowledgedAt: string | null
  /** The *prazo* — `null` for a notice with no response window. */
  dueAt: string | null
  relatedDocumentId: string | null
  notesMd: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** `ethics_hearings` (D8) — hearing-specific metadata riding a `meetings` row
 * (`meetingId`); the meeting itself is `participants_only` per the D14
 * reconciliation (Stage C `can_reach_meeting` isolation), not a bespoke
 * `restricted_to_case_id` root. */
export interface EthicsHearing {
  id: string
  caseId: string
  meetingId: string | null
  hearingType: HearingType
  scheduledAt: string | null
  completedAt: string | null
  respondentPresent: boolean | null
  complainantPresent: boolean | null
  legalRepresentativePresent: boolean | null
  summaryMd: string | null
  outcomeMd: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** `ethics_appeals` (D-appeals). */
export interface EthicsAppeal {
  id: string
  caseId: string
  decisionId: string
  submittedByParticipantId: string | null
  submittedAt: string
  appealReasonMd: string
  status: AppealStatus
  reviewedBy: string | null
  reviewedAt: string | null
  outcome: string | null
  outcomeRationaleMd: string | null
  createdAt: string
  updatedAt: string
}

/**
 * The full ethics procedure envelope for one case — the {@link
 * getEthicsCaseProcedure} return shape. `null` on a non-ethics-typed case (the
 * companion read simply has nothing to project).
 */
export interface EthicsCaseProcedure {
  caseId: string
  /** `null` before `upsert_ethics_case_details` runs (pre-BE-6 default; also
   * possible pre-admissibility-decision in practice, though the row is
   * upserted eagerly on case creation per the intended BE-6 flow). */
  details: EthicsCaseDetails | null
  allegations: EthicsAllegation[]
  decisions: CaseDecision[]
  hearings: EthicsHearing[]
  notifications: EthicsNotification[]
  appeals: EthicsAppeal[]
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Request-scoped memoized read of the full ethics procedure for one case
 * (React `cache()` — mirrors {@link import('@/lib/queries/cases').getCaseDetail},
 * since an ethics case detail route will fetch this from both the shared
 * layout spine and a child tab). Backed by the new SECURITY DEFINER
 * `get_ethics_case_procedure(p_case_id)` RPC (§2.3 "Modified reads"),
 * internally `can_read_case`-gated — no new RLS shape (E1 D2/§7). `null` when
 * the caller cannot read the case, the case does not exist, or the case is
 * not ethics-typed. Requires the `ethics` flag (BE-9); flag-OFF this returns
 * `null` byte-for-byte (no ethics case type is seeded, so there is nothing to
 * project).
 */
export const getEthicsCaseProcedure = cache(
  async (caseId: string): Promise<EthicsCaseProcedure | null> => {
    return notImplemented('getEthicsCaseProcedure', caseId)
  },
)

/**
 * The organization's active allegation-category catalog (D2), ordered by
 * `position`, for the allegation-add picker. `[]` on any error / no rows.
 */
export async function listEthicsAllegationCategories(
  organizationId: string,
): Promise<AllegationCategory[]> {
  return notImplemented('listEthicsAllegationCategories', organizationId)
}

/**
 * The organization's active case-assignment-role catalog (D10 —
 * relator/revisor/presidente/…), for the phase-assignment-role picker. `[]` on
 * any error / no rows.
 */
export async function listCaseAssignmentRoles(
  organizationId: string,
): Promise<CaseAssignmentRole[]> {
  return notImplemented('listCaseAssignmentRoles', organizationId)
}
