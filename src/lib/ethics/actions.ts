'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type {
  AdmissibilityStatus,
  AllegationSeverity,
  AllegationStatus,
  AppealStatus,
  ComplaintChannel,
  EthicsCaseDetails,
  ExternalReportingTarget,
  FindingValue,
  HearingType,
  NotificationDeliveryMethod,
  NotificationType,
  VoteValue,
} from '@/lib/queries/ethics'

/**
 * Ethics procedure write actions (ETH·E2; ADR 0073 §2.3, wired in BE-11).
 *
 * Every mutation below is a `SECURITY DEFINER` RPC (never a direct table write): each
 * REVOKEs PUBLIC then GRANTs `authenticated, service_role` (t19), asserts the `ethics`
 * flag (HC000), and authorizes per ADR 0073 — case procedure RPCs are coordinator-gated
 * via `app.assert_ethics_coordinator` (HC0J1, authority-first + distinct from every
 * exclusion code); org-catalog CRUD gates on `can_manage_professional` (42501); a few are
 * self-service (D13/D4). SQLSTATEs are the `HC0J0–HC0J9` block (D11). Raw Postgres errors
 * never reach the UI (CLAUDE.md §8) — {@link mapEthicsError} maps to pt-BR (preferring the
 * RPC's own message, the `mapNarrativeError` / `mapCoordinatorError` precedent).
 *
 * Reads live in `src/lib/queries/ethics.ts` (Rule 9). Signatures are the FROZEN contract
 * `frontend` compiles against — BE-11 fills bodies only.
 */

// ---------------------------------------------------------------------------
// Result shapes (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every ethics-procedure mutation. */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** `upsert_ethics_case_details` returns the full (upserted) row. */
export interface UpsertEthicsCaseDetailsState extends ActionState {
  details?: EthicsCaseDetails
}

/** `add_ethics_allegation` returns the new `ethics_allegations.id`. */
export interface AddAllegationState extends ActionState {
  allegationId?: string
}

/** `record_ethics_finding` returns the new `ethics_findings.id`. */
export interface RecordFindingState extends ActionState {
  findingId?: string
}

/** `create_case_decision` returns the new `case_decisions.id`. */
export interface CreateDecisionState extends ActionState {
  decisionId?: string
}

/** `cast_case_vote` returns the new `case_votes.id`. */
export interface CastVoteState extends ActionState {
  voteId?: string
}

/** `issue_ethics_notification` returns the new `ethics_notifications.id`. */
export interface IssueNotificationState extends ActionState {
  notificationId?: string
}

/** `schedule_ethics_hearing` returns the new `ethics_hearings.id`. */
export interface ScheduleHearingState extends ActionState {
  hearingId?: string
}

/** `submit_ethics_appeal` returns the new `ethics_appeals.id`. */
export interface SubmitAppealState extends ActionState {
  appealId?: string
}

/** A catalog create returns the new `ethics_allegation_categories.id`. */
export interface CreateAllegationCategoryState extends ActionState {
  categoryId?: string
}

/** A catalog create returns the new `case_assignment_roles.id`. */
export interface CreateAssignmentRoleState extends ActionState {
  roleId?: string
}

// ---------------------------------------------------------------------------
// Input shapes (camelCase; the forms bind to these)
// ---------------------------------------------------------------------------

/** Optional fields for `update_ethics_allegation` — all a partial edit of the
 * fields `add_ethics_allegation` first sets, plus the workflow `status`. */
export interface UpdateEthicsAllegationInput {
  categoryId?: string
  descriptionMd?: string
  allegedEventDate?: string | null
  severity?: AllegationSeverity | null
  status?: AllegationStatus
}

/** Fields for `set_ethics_decision_details` (D3 — the CRM/CFM hand-off is
 * modeled explicitly, never a free string; §D7). */
export interface SetEthicsDecisionDetailsInput {
  /** `ethics_sanction_types.id`, or `null` (no sanction). Catalog FK per lead ruling 4. */
  sanctionTypeId?: string | null
  sanctionStartDate?: string | null
  sanctionEndDate?: string | null
  remediationRequired?: boolean
  remediationDescriptionMd?: string | null
  externalReportingRequired?: boolean
  externalReportingTarget?: ExternalReportingTarget | null
  externalReportingDeadline?: string | null
  externalReportingCompletedAt?: string | null
  appealAllowed?: boolean
  appealDeadline?: string | null
  decisionLetterDocumentId?: string | null
}

/** Fields for `issue_ethics_notification` (D5 — feeds the N scan arm via `dueAt`). */
export interface IssueEthicsNotificationInput {
  caseId: string
  notificationType: NotificationType
  deliveryMethod: NotificationDeliveryMethod
  recipientParticipantId?: string | null
  recipientUserId?: string | null
  dueAt?: string | null
  relatedDocumentId?: string | null
  notesMd?: string | null
}

/** Fields for `complete_ethics_hearing` (D8). */
export interface CompleteEthicsHearingInput {
  summaryMd: string
  outcomeMd: string
  respondentPresent?: boolean | null
  complainantPresent?: boolean | null
  legalRepresentativePresent?: boolean | null
}

// ---------------------------------------------------------------------------
// Error mapping + revalidation (pt-BR; prefer the door's own message).
// ---------------------------------------------------------------------------

const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'

const MESSAGES = {
  generic: 'Não foi possível concluir. Tente novamente.',
  unavailable: 'O módulo de ética não está disponível.',
  forbidden: 'Você não tem permissão para esta ação.',
  notFound: 'Registro não encontrado.',
} as const

/** Map an ethics RPC error to friendly pt-BR (prefer the RPC's own message). */
function mapEthicsError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case 'HC000': // ethics flag off
      return MESSAGES.unavailable
    case 'HC0J1': // coordinator authority
      return error.message || MESSAGES.forbidden
    case 'HC0J0': // invalid lifecycle/state
    case 'HC0J2': // invalid allegation category
    case 'HC0J3': // a finding already exists
    case 'HC0J4': // duplicate vote
    case 'HC0J5': // membro impedido (recused / respondent) cannot vote
    case 'HC0J6': // notification already acknowledged/cancelled
    case 'HC0J7': // retention-pinned profile cannot be redacted
    case 'HC0J8': // no vote quorum
    case 'HC0J9': // not the targeted participant
      return error.message || MESSAGES.generic
    case '42501':
      return error.message || MESSAGES.forbidden
    case 'P0002':
      return error.message || MESSAGES.notFound
    default:
      return MESSAGES.generic
  }
}

function revalidateCase(): void {
  revalidatePath(CASE_PATH, 'page')
}

// ---------------------------------------------------------------------------
// Admissibility / intake (D1)
// ---------------------------------------------------------------------------

/** Create/update the case's admissibility-intake extension (`upsert_ethics_
 * case_details`; coordinator-gated). Returns the upserted row. */
export async function upsertEthicsCaseDetails(
  caseId: string,
  input?: {
    complaintChannel?: ComplaintChannel | null
    complaintReceivedAt?: string | null
    summaryMd?: string | null
  },
): Promise<UpsertEthicsCaseDetailsState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('upsert_ethics_case_details', {
    p_case_id: caseId,
    p_complaint_channel: input?.complaintChannel ?? undefined,
    p_complaint_received_at: input?.complaintReceivedAt ?? undefined,
    p_summary_md: input?.summaryMd ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | null
    | undefined
  const details: EthicsCaseDetails | undefined = row
    ? {
        caseId: row.case_id as string,
        admissibilityStatus: row.admissibility_status as AdmissibilityStatus,
        admissibilityDecidedAt: (row.admissibility_decided_at as string) ?? null,
        admissibilityDecidedBy: (row.admissibility_decided_by as string) ?? null,
        admissibilityRationaleMd:
          (row.admissibility_rationale_md as string) ?? null,
        complaintChannel: (row.complaint_channel as ComplaintChannel) ?? null,
        complaintReceivedAt: (row.complaint_received_at as string) ?? null,
        summaryMd: (row.summary_md as string) ?? null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }
    : undefined
  return { ok: true, details }
}

/** Decide admissibility (`decide_admissibility`; coordinator-gated). An
 * `inadmissible` case may close without a decision/vote. `HC0J0` on an
 * invalid status. */
export async function decideAdmissibility(
  caseId: string,
  status: AdmissibilityStatus,
  rationaleMd: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('decide_admissibility', {
    p_case_id: caseId,
    p_status: status,
    p_rationale_md: rationaleMd,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Allegations / findings (D2)
// ---------------------------------------------------------------------------

/** Add an allegation to an ethics case (`add_ethics_allegation`;
 * coordinator-gated). Returns the new allegation id. `HC0J2` on an invalid
 * `categoryId`. */
export async function addEthicsAllegation(
  caseId: string,
  categoryId: string,
  descriptionMd: string,
  severity?: AllegationSeverity | null,
  allegedEventDate?: string | null,
): Promise<AddAllegationState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_ethics_allegation', {
    p_case_id: caseId,
    p_category_id: categoryId,
    p_description_md: descriptionMd,
    p_severity: severity ?? undefined,
    p_alleged_event_date: allegedEventDate ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, allegationId: data ?? undefined }
}

/** Edit an allegation (`update_ethics_allegation`; coordinator-gated). */
export async function updateEthicsAllegation(
  allegationId: string,
  input: UpdateEthicsAllegationInput,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_ethics_allegation', {
    p_allegation_id: allegationId,
    p_category_id: input.categoryId ?? undefined,
    p_description_md: input.descriptionMd ?? undefined,
    p_severity: input.severity ?? undefined,
    p_alleged_event_date: input.allegedEventDate ?? undefined,
    p_status: input.status ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

/** Record the (current) finding on an allegation (`record_ethics_finding`;
 * coordinator-gated). Returns the new finding id. `HC0J3` if a finding
 * already exists for this allegation (`unique(allegation_id)`). */
export async function recordEthicsFinding(
  allegationId: string,
  finding: FindingValue,
  rationaleMd?: string | null,
  evidenceSummaryMd?: string | null,
): Promise<RecordFindingState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_ethics_finding', {
    p_allegation_id: allegationId,
    p_finding: finding,
    p_rationale_md: rationaleMd ?? undefined,
    p_evidence_summary_md: evidenceSummaryMd ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, findingId: data ?? undefined }
}

/** Add an allegation-category catalog entry (org/staff_admin-gated). Returns
 * the new category id. */
export async function createEthicsAllegationCategory(
  organizationId: string,
  key: string,
  displayName: string,
): Promise<CreateAllegationCategoryState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    'create_ethics_allegation_category',
    { p_org: organizationId, p_key: key, p_display_name: displayName },
  )
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, categoryId: data ?? undefined }
}

/** Soft-archive an allegation-category catalog entry (`is_active = false`). */
export async function archiveEthicsAllegationCategory(
  categoryId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_ethics_allegation_category', {
    p_category_id: categoryId,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Decision / votes (D3 / D4)
// ---------------------------------------------------------------------------

/** Open a decision on an ethics case (`create_case_decision`;
 * coordinator-gated; the case must be admissible — `HC0J0`). Returns the new
 * `case_decisions.id`. */
export async function createCaseDecision(
  caseId: string,
  decisionType: string,
  summaryMd: string,
  rationaleMd?: string | null,
): Promise<CreateDecisionState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_case_decision', {
    p_case_id: caseId,
    p_decision_type: decisionType,
    p_summary_md: summaryMd,
    p_rationale_md: rationaleMd ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, decisionId: data ?? undefined }
}

/** Set/update the ethics extension of a decision (`set_ethics_decision_
 * details`; coordinator-gated) — sanction, remediation, the CRM/CFM
 * hand-off (§D7), and the appeal deadline. */
export async function setEthicsDecisionDetails(
  decisionId: string,
  input: SetEthicsDecisionDetailsInput,
): Promise<ActionState> {
  const supabase = await createClient()
  // NOTE: decisionLetterDocumentId is part of the frozen input contract but the
  // set_ethics_decision_details RPC does not accept it yet — the decision-letter /
  // legal_privileged clearance path defers to Stage E (0078 A19/B3; ADR 0073 Amendment
  // §3). Passing the fields the RPC supports; the doc id is a no-op until Stage E.
  const { error } = await supabase.rpc('set_ethics_decision_details', {
    p_decision_id: decisionId,
    p_sanction_type_id: input.sanctionTypeId ?? undefined,
    p_sanction_start_date: input.sanctionStartDate ?? undefined,
    p_sanction_end_date: input.sanctionEndDate ?? undefined,
    p_remediation_required: input.remediationRequired ?? undefined,
    p_remediation_description_md: input.remediationDescriptionMd ?? undefined,
    p_external_reporting_required: input.externalReportingRequired ?? undefined,
    p_external_reporting_target: input.externalReportingTarget ?? undefined,
    p_external_reporting_deadline: input.externalReportingDeadline ?? undefined,
    p_appeal_allowed: input.appealAllowed ?? undefined,
    p_appeal_deadline: input.appealDeadline ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

/**
 * Cast a formal vote (`cast_case_vote`; the RECUSAL-EXCLUSION keystone — ADR
 * 0073 §D4). The RPC hard-checks `app.is_recused_from_case` /
 * `app.is_case_respondent` BEFORE inserting — either true raises `HC0J5`
 * ("membro impedido não pode votar"). This is the BELT: E1's `can_read_case`
 * already denies a recused/respondent caller the whole case (the deliberation
 * is unreachable), so this door is defense-in-depth, not the sole gate.
 * `HC0J4` on a duplicate vote (`unique(decision_id, voter_id)`). Returns the
 * new `case_votes.id`.
 */
export async function castCaseVote(
  decisionId: string,
  vote: VoteValue,
  rationaleMd?: string | null,
): Promise<CastVoteState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cast_case_vote', {
    p_decision_id: decisionId,
    p_vote: vote,
    p_rationale_md: rationaleMd ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, voteId: data ?? undefined }
}

/** Issue a decision (`issue_decision`; coordinator-gated): `draft`/`voted` →
 * `issued`, stamps `decided_*`, and FIRES the M2 retention-pin trigger (§D9)
 * on every `respondent_doctor` of the case. `HC0J8` if a vote-quorum gate is
 * enforced (O-3, optional) and not met. */
export async function issueDecision(decisionId: string): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('issue_decision', {
    p_decision_id: decisionId,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

/** Void a decision (`void_decision`; coordinator-gated). */
export async function voidDecision(
  decisionId: string,
  reason: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('void_decision', {
    p_decision_id: decisionId,
    p_reason: reason,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Notifications (D5)
// ---------------------------------------------------------------------------

/** Issue a formal notice (`issue_ethics_notification`; coordinator-gated).
 * Returns the new `ethics_notifications.id`. `dueAt` (the *prazo*) feeds the
 * N scan arm once BE-7 lands the additive `union all` branch. */
export async function issueEthicsNotification(
  input: IssueEthicsNotificationInput,
): Promise<IssueNotificationState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_ethics_notification', {
    p_case_id: input.caseId,
    p_notification_type: input.notificationType,
    p_delivery_method: input.deliveryMethod,
    p_recipient_participant_id: input.recipientParticipantId ?? undefined,
    p_recipient_user_id: input.recipientUserId ?? undefined,
    p_due_at: input.dueAt ?? undefined,
    p_related_document_id: input.relatedDocumentId ?? undefined,
    p_notes_md: input.notesMd ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, notificationId: data ?? undefined }
}

/** Acknowledge a notice (`acknowledge_ethics_notification`). `HC0J6` if
 * already acknowledged/cancelled. */
export async function acknowledgeEthicsNotification(
  notificationId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('acknowledge_ethics_notification', {
    p_notification_id: notificationId,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

/** Cancel a pending notice (`cancel_ethics_notification`; coordinator-gated).
 * `HC0J6` if already acknowledged/cancelled. */
export async function cancelEthicsNotification(
  notificationId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_ethics_notification', {
    p_notification_id: notificationId,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Hearings (D8). `schedule_ethics_hearing` creates the `meetings` row itself
// (`visibility_policy='participants_only'` + the eligible-panel roster) — it
// does NOT call `create_meeting` (D14 reconciliation onto Stage C; ADR 0073's
// 2026-07-18 Amendment §2).
// ---------------------------------------------------------------------------

/** Schedule a hearing (`schedule_ethics_hearing`; coordinator-gated). Creates
 * a `participants_only` `meetings` row (roster = the eligible panel, which
 * excludes the recused + the respondent by construction) unless `meetingId`
 * is supplied to attach an existing one. Returns the new `ethics_hearings.id`. */
export async function scheduleEthicsHearing(
  caseId: string,
  hearingType: HearingType,
  meetingId?: string | null,
  scheduledAt?: string | null,
): Promise<ScheduleHearingState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('schedule_ethics_hearing', {
    p_case_id: caseId,
    p_hearing_type: hearingType,
    p_meeting_id: meetingId ?? undefined,
    p_scheduled_at: scheduledAt ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, hearingId: data ?? undefined }
}

/** Record hearing outcome (`complete_ethics_hearing`; coordinator-gated). */
export async function completeEthicsHearing(
  hearingId: string,
  input: CompleteEthicsHearingInput,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_ethics_hearing', {
    p_hearing_id: hearingId,
    p_summary_md: input.summaryMd,
    p_outcome_md: input.outcomeMd,
    p_respondent_present: input.respondentPresent ?? undefined,
    p_complainant_present: input.complainantPresent ?? undefined,
    p_legal_representative_present:
      input.legalRepresentativePresent ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Appeals (D-appeals)
// ---------------------------------------------------------------------------

/** Submit an appeal against an `issued`/`appealed` decision
 * (`submit_ethics_appeal`); sets `case_decisions.status = 'appealed'`.
 * Returns the new `ethics_appeals.id`. */
export async function submitEthicsAppeal(
  caseId: string,
  decisionId: string,
  appealReasonMd: string,
  submittedByParticipantId?: string | null,
): Promise<SubmitAppealState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('submit_ethics_appeal', {
    p_case_id: caseId,
    p_decision_id: decisionId,
    p_appeal_reason_md: appealReasonMd,
    p_submitted_by_participant_id: submittedByParticipantId ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, appealId: data ?? undefined }
}

/** Review an appeal (`review_ethics_appeal`; coordinator-gated). */
export async function reviewEthicsAppeal(
  appealId: string,
  status: AppealStatus,
  outcome?: string | null,
  outcomeRationaleMd?: string | null,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('review_ethics_appeal', {
    p_appeal_id: appealId,
    p_status: status,
    p_outcome: outcome ?? undefined,
    p_outcome_rationale_md: outcomeRationaleMd ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// M2 redaction (D9)
// ---------------------------------------------------------------------------

/**
 * Erase (minimise-not-destroy) a professional's identity
 * (`redact_professional_profile`; coordinator/org-admin-gated). `HC0J7` if the
 * profile is retention-pinned (`retention_pinned_at is not null` — set by the
 * `app.trg_pin_respondent_retention` trigger when a `respondent_doctor`'s case
 * reaches an `issued` decision) OR is a respondent in ANY case with an issued
 * decision (belt check). On success: identity fields nulled (`full_name` →
 * "Profissional (dados removidos)", `license_number`/`license_region`/
 * `specialty` → null, `user_id` → null, `link_state` → `'no_account'` per B7),
 * the row + every `case_participants` linkage + audit history PRESERVED —
 * NEVER a row delete. Audited `professional_profile.redacted` (PHI-free: that
 * + who, never the old identity).
 */
export async function redactProfessionalProfile(
  profileId: string,
  reason: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('redact_professional_profile', {
    p_profile_id: profileId,
    p_reason: reason,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Assignment-role vocabulary + phase assignment (D10)
// ---------------------------------------------------------------------------

/** Add a case-assignment-role catalog entry (org/staff_admin-gated). Returns
 * the new role id. */
export async function createCaseAssignmentRole(
  organizationId: string,
  key: string,
  displayName: string,
): Promise<CreateAssignmentRoleState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_case_assignment_role', {
    p_org: organizationId,
    p_key: key,
    p_display_name: displayName,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true, roleId: data ?? undefined }
}

/** Soft-archive a case-assignment-role catalog entry. */
export async function archiveCaseAssignmentRole(
  roleId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_case_assignment_role', {
    p_role_id: roleId,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

/** Set (or clear, `roleId = null`) a phase's assignment role
 * (`set_case_phase_assignment_role`; coordinator-gated). */
export async function setCasePhaseAssignmentRole(
  phaseId: string,
  roleId: string | null,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_case_phase_assignment_role', {
    p_phase_id: phaseId,
    p_role_id: roleId ?? undefined,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// D13 — respondent targeted-submission door (`app.can_access_targeted_
// response`; never `can_read_case`, never a re-opening of the 0072 D2·0
// respondent hard-deny).
// ---------------------------------------------------------------------------

/**
 * Target a response at a specific case participant
 * (`target_case_response`; COORDINATOR-ONLY). Validates the participant
 * belongs to the SAME case as the response's `case_phase_id → case_phases →
 * cases` chain and that the case is ethics-typed; sets `responses.target_
 * case_participant_id`. Audited `case.response_targeted`. `HC0J1`
 * (authority) / `HC0J0` (invalid state or a cross-case participant).
 *
 * This is the mechanism by which a respondent's written defense (a
 * form/narrative — the ADR-0064 graduation test keeps it OFF the table set)
 * gets bound to them: the coordinator creates an empty `in_progress`
 * targeted response via the ordinary phase-response path, then calls this to
 * target it. See the module header for the `setResponseTargetParticipant`
 * naming-collision note this stub resolves in favor of the D13 name.
 */
export async function targetCaseResponse(
  responseId: string,
  caseParticipantId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('target_case_response', {
    p_response_id: responseId,
    p_case_participant_id: caseParticipantId,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}

/**
 * Submit a targeted response as the targeted respondent
 * (`submit_targeted_case_response`; the TARGETED USER only). Asserts
 * `app.can_access_targeted_response` (else `HC0J9` — "usuário não autorizado a
 * esta submissão dirigida") and `status = 'in_progress'`, then transitions to
 * `submitted`, freezing answers via the existing submitted-immutability
 * guards. Deliberately does NOT call `submit_response` — that path checks
 * authorship / `can_write_case_content`, which the respondent fails BY DESIGN
 * (0072 D2·0). Audited `case.targeted_response_submitted`.
 */
export async function submitTargetedCaseResponse(
  responseId: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_targeted_case_response', {
    p_response_id: responseId,
  })
  if (error) return { ok: false, error: mapEthicsError(error) }
  revalidateCase()
  return { ok: true }
}
