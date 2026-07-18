'use server'

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
  SanctionType,
  VoteValue,
} from '@/lib/queries/ethics'

/**
 * Ethics procedure write authority (ETH·E2; ADR 0073 §2.3). Every mutation
 * below is a planned `SECURITY DEFINER` RPC (never a direct table write): each
 * REVOKEs PUBLIC then GRANTs `authenticated, service_role` (t19), asserts the
 * `ethics` flag, and authorizes per ADR 0073 (mostly coordinator-gated —
 * `is_staff_admin_of_for`/admin — a few self-service per D13/D4). SQLSTATEs
 * are the `HC0J0–HC0J9` block (D11; relocated from the pre-0078 `HC0F·` — see
 * ADR 0073's 2026-07-18 Amendment §1).
 *
 * ============================ CONTRACT-FIRST STUB (BE-1) ============================
 * Signatures + input shapes are the frozen contract `frontend` (E2's own
 * minimal UI + E3a) binds to. Bodies land across BE-2..BE-9 (build-plan §3) —
 * each `notImplemented(...)` call names the RPC it will wrap. All user-facing
 * strings will be pt-BR (Rule 10); raw Postgres errors never reach the UI
 * (CLAUDE.md §8) — the real bodies get a `mapEthicsError` helper mirroring
 * `mapNarrativeError` (`src/lib/case-narratives/actions.ts`) once HC0J·
 * messages are authored at BE-6. Reads live in `src/lib/queries/ethics.ts`
 * (Rule 9); the `case_votes` recusal/respondent exclusion (HC0J5) and the M2
 * retention-pin/redaction (HC0J7) are the two highest-risk bodies (BE-3/BE-5 —
 * full plan review, not a one-line ack).
 *
 * **Scope note — the 5 already-live ethics-coordinator doors are OUT of this
 * file.** `set_case_confidentiality` / `declare_conflict` / `record_recusal` /
 * `lift_recusal` are ALREADY stubbed in `src/lib/case-recusals/actions.ts`
 * (ETH·E1 BE-1) and get WIRED, not recreated, at BE-10 — do not duplicate them
 * here. **Gap found while verifying that claim (report this to the lead):**
 * only 4 of the 5 are stubbed there. `set_case_visibility(p_case_id uuid,
 * p_policy text)` IS live in the catalog (`public`, `prosecdef=true`, HC0F5/
 * HC0F6 — the ADR-0078 M1·4 authority-first block), but grep across `src/`
 * finds NO `setCaseVisibility` action anywhere — not in
 * `case-recusals/actions.ts`, not here, not stubbed at all. BE-10 needs a
 * fifth stub before it can "wire" this door; flagged, not fixed here (out of
 * this file's declared scope per the spawn brief).
 *
 * **Naming collision found while authoring D13 (report this to the lead):**
 * ADR 0073's original §2.3 "Respondent-statement targeting (D10)" names
 * `set_response_target_participant(p_response_id, p_case_participant_id)`
 * (coordinator OR the response's writer, both `can_write_case_content`, no
 * stated cross-case/case-type validation). The 2026-07-18 Amendment's §D13
 * then adds `target_case_response(p_response_id, p_case_participant_id)` —
 * IDENTICAL signature, same column it writes (`target_case_participant_id`),
 * but COORDINATOR-ONLY (narrower — drops the "or the writer" arm) and adds a
 * same-case + ethics-typed validation the D10 spec never mentioned. D0's own
 * text ("D13 upgrades this column from a projection into a narrow access
 * door") reads as `target_case_response` SUPERSEDING `set_response_target_
 * participant`, not living beside it — two RPCs writing the same column under
 * different authority would be a real correctness hazard (which one does a
 * form's targeting button call?). This file stubs ONLY `targetCaseResponse`
 * (the D13 name, per this task's explicit instruction); `setResponseTarget
 * Participant` is deliberately NOT stubbed. Needs an explicit lead ruling
 * before BE-6 implements the RPC.
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
  sanctionType?: SanctionType | null
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
// Not-implemented stub helper (BE-1). References every arg so the frozen
// param names stay lint-clean; the listed BE-N task replaces each body with
// the real RPC call.
// ---------------------------------------------------------------------------

function notImplemented(fn: string, ..._args: unknown[]): never {
  throw new Error(`${fn} not implemented (ETH·E2 — contract stub)`)
}

// ---------------------------------------------------------------------------
// Admissibility / intake (D1) — BE-2 / BE-6
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
  return notImplemented('upsertEthicsCaseDetails', caseId, input)
}

/** Decide admissibility (`decide_admissibility`; coordinator-gated). An
 * `inadmissible` case may close without a decision/vote. `HC0J0` on an
 * invalid status. */
export async function decideAdmissibility(
  caseId: string,
  status: AdmissibilityStatus,
  rationaleMd: string,
): Promise<ActionState> {
  return notImplemented('decideAdmissibility', caseId, status, rationaleMd)
}

// ---------------------------------------------------------------------------
// Allegations / findings (D2) — BE-2 / BE-6
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
  return notImplemented(
    'addEthicsAllegation',
    caseId,
    categoryId,
    descriptionMd,
    severity,
    allegedEventDate,
  )
}

/** Edit an allegation (`update_ethics_allegation`; coordinator-gated). */
export async function updateEthicsAllegation(
  allegationId: string,
  input: UpdateEthicsAllegationInput,
): Promise<ActionState> {
  return notImplemented('updateEthicsAllegation', allegationId, input)
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
  return notImplemented(
    'recordEthicsFinding',
    allegationId,
    finding,
    rationaleMd,
    evidenceSummaryMd,
  )
}

/** Add an allegation-category catalog entry (org/staff_admin-gated). Returns
 * the new category id. */
export async function createEthicsAllegationCategory(
  organizationId: string,
  key: string,
  displayName: string,
): Promise<CreateAllegationCategoryState> {
  return notImplemented(
    'createEthicsAllegationCategory',
    organizationId,
    key,
    displayName,
  )
}

/** Soft-archive an allegation-category catalog entry (`is_active = false`). */
export async function archiveEthicsAllegationCategory(
  categoryId: string,
): Promise<ActionState> {
  return notImplemented('archiveEthicsAllegationCategory', categoryId)
}

// ---------------------------------------------------------------------------
// Decision / votes (D3 / D4) — BE-3 / BE-6 (the vote-exclusion is the
// highest-risk body: full plan review, not a one-line ack)
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
  return notImplemented(
    'createCaseDecision',
    caseId,
    decisionType,
    summaryMd,
    rationaleMd,
  )
}

/** Set/update the ethics extension of a decision (`set_ethics_decision_
 * details`; coordinator-gated) — sanction, remediation, the CRM/CFM
 * hand-off (§D7), and the appeal deadline. */
export async function setEthicsDecisionDetails(
  decisionId: string,
  input: SetEthicsDecisionDetailsInput,
): Promise<ActionState> {
  return notImplemented('setEthicsDecisionDetails', decisionId, input)
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
  return notImplemented('castCaseVote', decisionId, vote, rationaleMd)
}

/** Issue a decision (`issue_decision`; coordinator-gated): `draft`/`voted` →
 * `issued`, stamps `decided_*`, and FIRES the M2 retention-pin trigger (§D9)
 * on every `respondent_doctor` of the case. `HC0J8` if a vote-quorum gate is
 * enforced (O-3, optional) and not met. */
export async function issueDecision(decisionId: string): Promise<ActionState> {
  return notImplemented('issueDecision', decisionId)
}

/** Void a decision (`void_decision`; coordinator-gated). */
export async function voidDecision(
  decisionId: string,
  reason: string,
): Promise<ActionState> {
  return notImplemented('voidDecision', decisionId, reason)
}

// ---------------------------------------------------------------------------
// Notifications (D5) — BE-4 / BE-6
// ---------------------------------------------------------------------------

/** Issue a formal notice (`issue_ethics_notification`; coordinator-gated).
 * Returns the new `ethics_notifications.id`. `dueAt` (the *prazo*) feeds the
 * N scan arm once BE-7 lands the additive `union all` branch. */
export async function issueEthicsNotification(
  input: IssueEthicsNotificationInput,
): Promise<IssueNotificationState> {
  return notImplemented('issueEthicsNotification', input)
}

/** Acknowledge a notice (`acknowledge_ethics_notification`). `HC0J6` if
 * already acknowledged/cancelled. */
export async function acknowledgeEthicsNotification(
  notificationId: string,
): Promise<ActionState> {
  return notImplemented('acknowledgeEthicsNotification', notificationId)
}

/** Cancel a pending notice (`cancel_ethics_notification`; coordinator-gated).
 * `HC0J6` if already acknowledged/cancelled. */
export async function cancelEthicsNotification(
  notificationId: string,
): Promise<ActionState> {
  return notImplemented('cancelEthicsNotification', notificationId)
}

// ---------------------------------------------------------------------------
// Hearings (D8) — BE-4 / BE-6. `schedule_ethics_hearing` creates the
// `meetings` row itself (`visibility_policy='participants_only'` + the
// eligible-panel roster) — it does NOT call `create_meeting` (D14
// reconciliation onto Stage C; ADR 0073's 2026-07-18 Amendment §2).
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
  return notImplemented(
    'scheduleEthicsHearing',
    caseId,
    hearingType,
    meetingId,
    scheduledAt,
  )
}

/** Record hearing outcome (`complete_ethics_hearing`; coordinator-gated). */
export async function completeEthicsHearing(
  hearingId: string,
  input: CompleteEthicsHearingInput,
): Promise<ActionState> {
  return notImplemented('completeEthicsHearing', hearingId, input)
}

// ---------------------------------------------------------------------------
// Appeals (D-appeals) — BE-4 / BE-6
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
  return notImplemented(
    'submitEthicsAppeal',
    caseId,
    decisionId,
    appealReasonMd,
    submittedByParticipantId,
  )
}

/** Review an appeal (`review_ethics_appeal`; coordinator-gated). */
export async function reviewEthicsAppeal(
  appealId: string,
  status: AppealStatus,
  outcome?: string | null,
  outcomeRationaleMd?: string | null,
): Promise<ActionState> {
  return notImplemented(
    'reviewEthicsAppeal',
    appealId,
    status,
    outcome,
    outcomeRationaleMd,
  )
}

// ---------------------------------------------------------------------------
// M2 redaction (D9) — BE-5. The platform's FIRST professional-erasure path;
// full plan review (novel trigger + the ADR-0072 §7 human-signed-off posture).
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
  return notImplemented('redactProfessionalProfile', profileId, reason)
}

// ---------------------------------------------------------------------------
// Assignment-role vocabulary + phase assignment (D10) — BE-6
// ---------------------------------------------------------------------------

/** Add a case-assignment-role catalog entry (org/staff_admin-gated). Returns
 * the new role id. */
export async function createCaseAssignmentRole(
  organizationId: string,
  key: string,
  displayName: string,
): Promise<CreateAssignmentRoleState> {
  return notImplemented(
    'createCaseAssignmentRole',
    organizationId,
    key,
    displayName,
  )
}

/** Soft-archive a case-assignment-role catalog entry. */
export async function archiveCaseAssignmentRole(
  roleId: string,
): Promise<ActionState> {
  return notImplemented('archiveCaseAssignmentRole', roleId)
}

/** Set (or clear, `roleId = null`) a phase's assignment role
 * (`set_case_phase_assignment_role`; coordinator-gated). */
export async function setCasePhaseAssignmentRole(
  phaseId: string,
  roleId: string | null,
): Promise<ActionState> {
  return notImplemented('setCasePhaseAssignmentRole', phaseId, roleId)
}

// ---------------------------------------------------------------------------
// D13 — respondent targeted-submission door (`app.can_access_targeted_
// response`; never `can_read_case`, never a re-opening of the 0072 D2·0
// respondent hard-deny). BE-3b — full review.
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
  return notImplemented('targetCaseResponse', responseId, caseParticipantId)
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
  return notImplemented('submitTargetedCaseResponse', responseId)
}
