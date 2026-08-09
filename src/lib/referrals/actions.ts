'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { REFERRAL_MESSAGES, mapReferralError } from '@/lib/referrals/messages'
import {
  getCaseSafetyEventPatientPrefill,
  getReferralPatient,
} from '@/lib/queries/referrals'
import type { CaseSafetyPrefill } from '@/lib/queries/referrals'
import type { PhiDisposeReason } from '@/lib/cases/types'
import type {
  AddReplyAttachmentInput,
  AddSharedItemInput,
  AssignReferralReviewerInput,
  ConcludeReferralInput,
  CreateReferralInput,
  CreateReferralInternalNoteInput,
  CreateReferralState,
  CreateRequestedActionInput,
  DeclineReferralInput,
  LinkReferralCaseInput,
  LinkReferralRelatedCaseInput,
  PostReferralMessageInput,
  ProvideReferralInfoInput,
  RecordReferralReceiptInput,
  RedactReferralMessageInput,
  RedactReferralNoteInput,
  ReferralActionState,
  ReferralPatient,
  ReopenReferralInput,
  RequestReferralInfoInput,
  ResolveReferralInput,
  SetReferralDeadlineInput,
  SetReferralPatientInput,
  UpdateReferralAssignmentInput,
  UpdateReferralInput,
  UpdateRequestedActionInput,
} from '@/lib/referrals/types'

// Result + input shapes live in the CLIENT-SAFE `@/lib/referrals/types` (a
// `"use server"` module may export only async functions, and the client binds its
// forms to these). This module exports ONLY the action functions below.
//
// Every write routes through a Phase-22 SECURITY DEFINER RPC — RLS + the RPC's own
// gates are the authority (HC070–HC079 / 42501); these actions add no broad authz
// pre-check, only the client-side field validation that shapes `fieldErrors`. All
// user-facing strings are pt-BR (centralized in `./messages.ts`); raw
// Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8). The RPCs gate the
// `case_referrals` flag via `assert_referrals_enabled`.

const COMMISSION_REFERRALS_PATH = '/o/[org]/c/[commission]/encaminhamentos'
const REFERRAL_DETAIL_PATH = '/o/[org]/c/[commission]/encaminhamentos/[referralId]'
const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'
// NSP-per-org (ADR 0042): the QPS referral dashboard moved /admin/nsp/encaminhamentos
// → /o/[org]/nsp/encaminhamentos. Revalidate the per-org NSP LAYOUT across all [org]
// values — 'layout' invalidates the layout AND every page beneath it (incl. the
// referral dashboard), so one call refreshes the QPS view. RLS-scoped → no leak.
const NSP_PATH = '/o/[org]/nsp'

/** Revalidate the hub + referral detail + case detail + the per-org QPS dashboard
 * after a referral mutation (the referral may surface on any of them). */
function revalidateReferrals(): void {
  revalidatePath(COMMISSION_REFERRALS_PATH, 'page')
  revalidatePath(REFERRAL_DETAIL_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(NSP_PATH, 'layout')
}

// ---------------------------------------------------------------------------
// Draft / assemble (source coordinator)
// ---------------------------------------------------------------------------

/**
 * Open a referral draft on the source case (source coordinator only; the RPC
 * raises HC071 otherwise). Returns the new id + `ENC-NNNN` code on success.
 */
export async function createReferralDraft(
  input: CreateReferralInput,
): Promise<CreateReferralState> {
  if (!input.sourceCaseId) {
    return { ok: false, error: REFERRAL_MESSAGES.sourceCaseRequired }
  }
  // ADR 0094 W4 D7 — EXACTLY ONE destination. Mirrored from the RPC's own two-sided
  // test rather than "is a commission set?", because the one-sided form admits the
  // "both" case, and the RPC would then refuse with a raw check_violation that maps
  // to a generic string. Stated the same way in both places so neither can drift into
  // accepting what the other rejects.
  const hasCommissionTarget = Boolean(input.targetCommissionId)
  const hasHospitalTarget = Boolean(input.targetHospitalId)
  if (hasCommissionTarget === hasHospitalTarget) {
    return { ok: false, error: REFERRAL_MESSAGES.referralTargetRequired }
  }
  if (!input.referralTypeId) {
    return { ok: false, error: REFERRAL_MESSAGES.referralTypeRequired }
  }
  if (!input.subject?.trim()) {
    return { ok: false, error: REFERRAL_MESSAGES.subjectRequired }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_referral_draft', {
    p_source_case_id: input.sourceCaseId,
    // ⚠ The GENERATED Args type says `string`, but NULL is the correct value on the
    // technical-direction arm — the RPC's XOR requires exactly one destination, so
    // this parameter must be null whenever `p_target_hospital_id` is set. The type is
    // too narrow because the SQL parameter carries no DEFAULT, and it cannot be given
    // one: it is argument 2, and Postgres refuses a default on a parameter followed by
    // mandatory ones (`p_referral_type_id`, `p_subject`). Expressing the sum type in
    // the signature would need a parameter REORDER — filed rather than smuggled in
    // here. Sent as an explicit null and never omitted: PostgREST resolves the
    // overload from the keys present, so omitting a defaultless argument is a PGRST202
    // "function not found", not a NULL.
    p_target_commission_id: input.targetCommissionId as unknown as string,
    // ADR 0094 W4 — the technical-direction arm of the destination sum type. This one
    // DOES carry `DEFAULT NULL`, so omitting it is a genuine "no hospital target".
    p_target_hospital_id: input.targetHospitalId ?? undefined,
    p_referral_type_id: input.referralTypeId,
    p_subject: input.subject.trim(),
    p_response_expected: input.responseExpected,
    p_description_md: input.descriptionMd ?? undefined,
    // RV2 R2: PHI-free triage (priority defaults routine; action/due optional).
    p_priority: input.priority ?? undefined,
    p_requested_action_id: input.requestedActionId ?? undefined,
    p_response_due_at: input.responseDueAt ?? undefined,
    // RV2 R3: optional parent-referral lineage (HC0A6 if invalid/unauthorized).
    p_parent_referral_id: input.parentReferralId ?? undefined,
  })
  if (error || !data) {
    // Log the RAW Postgres error server-side (code never reaches the UI — §8). A
    // failed referral draft must be diagnosable: the mapped pt-BR string hides the
    // SQLSTATE, so surface it here for the server log.
    console.error('[createReferralDraft] RPC failed', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    })
    return { ok: false, error: mapReferralError(error) }
  }

  revalidateReferrals()
  return {
    ok: true,
    message: REFERRAL_MESSAGES.referralDrafted,
    referralId: data.id,
    code: data.code,
  }
}

/** Edit a draft's type/subject/description/response-expected (only while
 * `draft`; the RPC raises HC070 otherwise). */
export async function updateReferralDraft(
  referralId: string,
  input: UpdateReferralInput,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  if (!input.subject?.trim()) {
    return { ok: false, error: REFERRAL_MESSAGES.subjectRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_referral_draft', {
    p_referral_id: referralId,
    p_referral_type_id: input.referralTypeId,
    p_subject: input.subject.trim(),
    p_description_md: input.descriptionMd ?? undefined,
    p_response_expected: input.responseExpected,
    // RV2 R2: PHI-free triage.
    p_priority: input.priority ?? undefined,
    p_requested_action_id: input.requestedActionId ?? undefined,
    p_response_due_at: input.responseDueAt ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralUpdated }
}

/** Set/update the SLA deadline on an in-flight referral (RV2 R2). Either
 * coordinator (source or target); the RPC rejects a past date (HC0A4) and a
 * terminal/draft status (HC070). `responseDueAt: null` clears the deadline. */
export async function setReferralDeadline(
  input: SetReferralDeadlineInput,
): Promise<ReferralActionState> {
  if (!input.referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_referral_deadline', {
    p_referral_id: input.referralId,
    p_response_due_at: input.responseDueAt ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.deadlineSet }
}

/** Freeze one snapshot item (narrative or document) onto a draft. Exactly one of
 * `sourceNarrativeId` / `sourceDocumentId` must match `kind`. */
export async function addReferralSharedItem(
  input: AddSharedItemInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }
  const hasNarrative = input.kind === 'narrative' && !!input.sourceNarrativeId
  const hasDocument = input.kind === 'document' && !!input.sourceDocumentId
  if (!hasNarrative && !hasDocument) {
    return { ok: false, error: REFERRAL_MESSAGES.sharedItemKindInvalid }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_referral_shared_item', {
    p_referral_id: input.referralId,
    p_kind: input.kind,
    p_source_narrative_id: input.sourceNarrativeId ?? undefined,
    p_source_document_id: input.sourceDocumentId ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.sharedItemAdded }
}

/** Remove a frozen snapshot item from a draft (only while `draft`). */
export async function removeReferralSharedItem(
  sharedItemId: string,
): Promise<ReferralActionState> {
  if (!sharedItemId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingSharedItem }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_referral_shared_item', {
    p_shared_item_id: sharedItemId,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.sharedItemRemoved }
}

/**
 * Upsert the ISOLATED patient PHI on a referral (Rule 12; same 9-arg shape as
 * `setEventPatient`). Write authority is the SOURCE coordinator ONLY (disclosure for a
 * new snapshot, amend for an existing one) while not concluded — read never implies
 * write (ADR 0078 D7 defect ②; the RPC raises HC078 otherwise). Routes through the
 * `save_referral_patient` public door; the underlying `set_referral_patient` helper is
 * off the public API. The write is audited WITHOUT copying any identifier into metadata.
 */
export async function setReferralPatient(
  referralId: string,
  input: SetReferralPatientInput,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  if (!input.name?.trim() && !input.mrn?.trim()) {
    return { ok: false, error: REFERRAL_MESSAGES.patientNameOrMrnRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_referral_patient', {
    p_referral_id: referralId,
    p_name: input.name ?? undefined,
    p_mrn: input.mrn ?? undefined,
    p_date_of_birth: input.dateOfBirth ?? undefined,
    p_age_years: input.ageYears ?? undefined,
    p_sex: input.sex,
    p_encounter_ref: input.encounterRef ?? undefined,
    p_unit: input.unit ?? undefined,
    p_attending: input.attending ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.patientSaved }
}

// ---------------------------------------------------------------------------
// Source transitions
// ---------------------------------------------------------------------------

/** Send a draft to the target commission (`draft → sent`; freezes the
 * snapshot). Source coordinator only (HC071); HC070 if not a draft. */
export async function sendReferral(
  referralId: string,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }

  const supabase = await createClient()
  const { error } = await supabase.rpc('send_referral', { p_referral_id: referralId })
  if (error) {
    console.error('[sendReferral] RPC failed', {
      referralId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { ok: false, error: mapReferralError(error) }
  }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralSent }
}

/** Withdraw an in-flight referral (`→ withdrawn`). Source coordinator only;
 * resolves the close-case gate. */
export async function withdrawReferral(
  referralId: string,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }

  const supabase = await createClient()
  const { error } = await supabase.rpc('withdraw_referral', { p_referral_id: referralId })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralWithdrawn }
}

// ---------------------------------------------------------------------------
// Target transitions (target coordinator)
// ---------------------------------------------------------------------------

/** Take receipt of a sent referral (`sent → received`). Target coordinator
 * only (HC072). */
export async function receiveReferral(
  referralId: string,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }

  const supabase = await createClient()
  const { error } = await supabase.rpc('receive_referral', { p_referral_id: referralId })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralReceived }
}

/** Accept a received referral (`received → accepted`). Target coordinator only. */
export async function acceptReferral(
  referralId: string,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }

  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_referral', { p_referral_id: referralId })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralAccepted }
}

/** Decline a received referral with an optional note (`→ rejected`). Target
 * coordinator only; resolves the close-case gate. */
export async function declineReferral(
  input: DeclineReferralInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('decline_referral', {
    p_referral_id: input.referralId,
    p_note: input.note ?? undefined,
    // RV2 R2: PHI-free structured reason (distinct from the PHI note).
    p_decline_reason_code: input.declineReasonCode ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralDeclined }
}

/** Move an accepted referral into review (`accepted → in_review`). Target
 * coordinator only. */
export async function startReferralReview(
  referralId: string,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }

  const supabase = await createClient()
  const { error } = await supabase.rpc('start_referral_review', { p_referral_id: referralId })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.reviewStarted }
}

/** Link (or clear) a case B created in its own commission. The RPC validates the
 * case belongs to the target commission (HC079 otherwise); the link is how B's
 * analyst earns PHI access (`referral_target_analyst`). */
export async function linkReferralCase(
  input: LinkReferralCaseInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('link_referral_case', {
    p_referral_id: input.referralId,
    p_target_case_id: input.targetCaseId ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return {
    ok: true,
    message: input.targetCaseId
      ? REFERRAL_MESSAGES.caseLinked
      : REFERRAL_MESSAGES.caseUnlinked,
  }
}

/** Record a B-side reply attachment reference (the file is uploaded to a fresh
 * immutable path first — Rule 6). Target coordinator only. */
export async function addReferralReplyAttachment(
  input: AddReplyAttachmentInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }
  if (!input.title?.trim()) {
    return { ok: false, error: REFERRAL_MESSAGES.attachmentTitleRequired }
  }
  if (!input.storagePath) {
    return { ok: false, error: REFERRAL_MESSAGES.attachmentUploadFailed }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_referral_reply_attachment', {
    p_referral_id: input.referralId,
    p_title: input.title.trim(),
    p_storage_path: input.storagePath,
    p_mime_type: input.mimeType ?? undefined,
    p_size_bytes: input.sizeBytes ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.attachmentAdded }
}

/**
 * Conclude a referral, delivering + freezing the reply (`in_review → completed`).
 * Target coordinator only. When the referral expects a reply, `replyOutcomeId` +
 * `resultMd` are REQUIRED (the RPC raises HC075 otherwise); a no-reply-expected
 * referral may conclude with `acknowledgedOnly = true`.
 */
export async function concludeReferral(
  input: ConcludeReferralInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }
  if (!input.acknowledgedOnly) {
    if (!input.resultMd?.trim()) {
      return { ok: false, error: REFERRAL_MESSAGES.replyResultRequired }
    }
    if (!input.replyOutcomeId) {
      return { ok: false, error: REFERRAL_MESSAGES.replyOutcomeRequired }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('conclude_referral', {
    p_referral_id: input.referralId,
    p_reply_outcome_id: input.replyOutcomeId ?? undefined,
    p_result_md: input.resultMd ?? undefined,
    p_acknowledged_only: input.acknowledgedOnly,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralConcluded }
}

// ---------------------------------------------------------------------------
// Resolution cycles (RV2 R3) — source-side resolve / reopen
// ---------------------------------------------------------------------------

/**
 * Resolve a referral: the SOURCE coordinator formally confirms closure
 * (`answered → resolved`), appending a resolution row + clearing `waiting_on`
 * (RV2 R3). Source-coordinator only — the RPC raises 42501 for any other actor,
 * checked BEFORE the state; a referral not in `answered` raises HC0A5.
 */
export async function resolveReferral(
  input: ResolveReferralInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('resolve_referral', {
    p_referral_id: input.referralId,
    p_summary_md: input.summaryMd ?? undefined,
    p_follow_up: input.followUpRequired ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralResolved }
}

/**
 * Reopen a resolved referral (`resolved → in_review`), marking the active
 * resolution reopened; the next resolve appends a new resolution number
 * (append-only). Source-coordinator only (42501 otherwise, checked before the
 * state); requires `resolved` (HC0A5 otherwise). The reason is required.
 */
export async function reopenReferral(
  input: ReopenReferralInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }
  if (!input.reason?.trim()) {
    return { ok: false, fieldErrors: { reason: REFERRAL_MESSAGES.reopenReasonRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reopen_referral', {
    p_referral_id: input.referralId,
    p_reason: input.reason.trim(),
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralReopened }
}

// ---------------------------------------------------------------------------
// Responsibility & multi-linkage (RV2 R4) — assignments + typed case-links
// ---------------------------------------------------------------------------

/**
 * Assign a reviewer to a referral on one side (RV2 R4). The actor must coordinate
 * `commissionId`'s side (source or target) — the RPC raises 42501 for any other
 * actor, checked BEFORE any domain validation; an invalid commission/role or a
 * non-member assignee raises HC0A7. ASSIGNMENT ≠ ACCESS: this grants the assignee
 * NO read of the referral.
 */
export async function assignReferralReviewer(
  input: AssignReferralReviewerInput,
): Promise<ReferralActionState> {
  if (!input.referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  if (!input.commissionId) return { ok: false, error: REFERRAL_MESSAGES.missingCommission }
  if (!input.assigneeUserId) {
    return { ok: false, fieldErrors: { assigneeUserId: REFERRAL_MESSAGES.assigneeRequired } }
  }
  if (!input.assignmentRole) {
    return { ok: false, fieldErrors: { assignmentRole: REFERRAL_MESSAGES.assignmentRoleRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_referral_reviewer', {
    p_referral_id: input.referralId,
    p_commission_id: input.commissionId,
    p_assignee_user_id: input.assigneeUserId,
    p_assignment_role: input.assignmentRole,
    p_due_at: input.dueAt ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.assignmentCreated }
}

/**
 * Edit an assignment's status / due / role (RV2 R4). Coordinator of the
 * assignment's commission side only (42501 otherwise, checked FIRST); an invalid
 * status/role raises HC0A7. All mutable fields are optional — omit to leave a field
 * unchanged.
 */
export async function updateReferralAssignment(
  input: UpdateReferralAssignmentInput,
): Promise<ReferralActionState> {
  if (!input.assignmentId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingAssignment }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_referral_assignment', {
    p_assignment_id: input.assignmentId,
    p_status: input.status ?? undefined,
    p_due_at: input.dueAt ?? undefined,
    p_assignment_role: input.assignmentRole ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.assignmentUpdated }
}

/**
 * Cancel an assignment (RV2 R4; status → cancelled). Coordinator of the
 * assignment's commission side only (42501 otherwise).
 */
export async function cancelReferralAssignment(
  assignmentId: string,
): Promise<ReferralActionState> {
  if (!assignmentId) return { ok: false, error: REFERRAL_MESSAGES.missingAssignment }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_referral_assignment', {
    p_assignment_id: assignmentId,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.assignmentCancelled }
}

/**
 * Record a TYPED related-case pointer on a referral (RV2 R4). The actor must
 * coordinate EITHER side (42501 otherwise); an invalid relationship, a missing
 * case, or a duplicate (referral, case, relationship) triple raises HC0A8. The
 * link is a POINTER only — it grants NO access to the linked case.
 */
export async function linkReferralRelatedCase(
  input: LinkReferralRelatedCaseInput,
): Promise<ReferralActionState> {
  if (!input.referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  if (!input.caseId) {
    return { ok: false, fieldErrors: { caseId: REFERRAL_MESSAGES.relatedCaseRequired } }
  }
  if (!input.relationshipType) {
    return {
      ok: false,
      fieldErrors: { relationshipType: REFERRAL_MESSAGES.relationshipTypeRequired },
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('link_referral_related_case', {
    p_referral_id: input.referralId,
    p_case_id: input.caseId,
    p_relationship_type: input.relationshipType,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.relatedCaseLinked }
}

/**
 * Remove a typed related-case pointer (RV2 R4). Coordinator of the link's
 * commission side only (42501 otherwise). Distinct from {@link linkReferralCase}
 * (the PRIMARY target link) — this only removes an ADDITIONAL typed pointer.
 */
export async function unlinkReferralCase(
  linkId: string,
): Promise<ReferralActionState> {
  if (!linkId) return { ok: false, error: REFERRAL_MESSAGES.missingSharedItem }

  const supabase = await createClient()
  const { error } = await supabase.rpc('unlink_referral_case', {
    p_link_id: linkId,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.relatedCaseUnlinked }
}

// ---------------------------------------------------------------------------
// Private internal notes, receipts & redaction (RV2 R5)
// ---------------------------------------------------------------------------

/**
 * Create a private internal note on ONE committee side (RV2 R5). The actor must be a
 * member of `committeeId` (the referral's source OR target) — the RPC raises 42501
 * for any other actor (incl. QPS of neither side), and HC0A9 for a blank body. The
 * note is readable ONLY by members of `committeeId` (the K-R5-1 security keystone).
 */
export async function createReferralInternalNote(
  input: CreateReferralInternalNoteInput,
): Promise<ReferralActionState> {
  if (!input.referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  if (!input.committeeId) return { ok: false, error: REFERRAL_MESSAGES.missingCommission }
  if (!input.body || !input.body.trim()) {
    return { ok: false, fieldErrors: { body: REFERRAL_MESSAGES.noteBodyRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_referral_internal_note', {
    p_referral_id: input.referralId,
    p_committee_id: input.committeeId,
    p_body: input.body,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.noteCreated }
}

/**
 * Redact a private internal note (RV2 R5 — append-only). The actor must be a
 * coordinator of the note's OWNING side (42501 otherwise, checked FIRST); an
 * already-redacted note raises HC0A9. The real body is retained server-side (audited
 * who/why) and rendered `[redigido]` — distinct from disposal, which purges.
 */
export async function redactReferralNote(
  input: RedactReferralNoteInput,
): Promise<ReferralActionState> {
  if (!input.noteId) return { ok: false, error: REFERRAL_MESSAGES.missingNote }
  if (!input.reason || !input.reason.trim()) {
    return { ok: false, fieldErrors: { reason: REFERRAL_MESSAGES.redactReasonRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('redact_referral_note', {
    p_note_id: input.noteId,
    p_reason: input.reason,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.noteRedacted }
}

/**
 * Redact a thread message (RV2 R5 — append-only). The actor must be a coordinator of
 * EITHER side (42501 otherwise, checked FIRST); an already-redacted message raises
 * HC0A9. The real body is retained; the detail door renders `[redigido]`.
 */
export async function redactReferralMessage(
  input: RedactReferralMessageInput,
): Promise<ReferralActionState> {
  if (!input.messageId) return { ok: false, error: REFERRAL_MESSAGES.missingMessage }
  if (!input.reason || !input.reason.trim()) {
    return { ok: false, fieldErrors: { reason: REFERRAL_MESSAGES.redactReasonRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('redact_referral_message', {
    p_message_id: input.messageId,
    p_reason: input.reason,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.messageRedacted }
}

/**
 * Record the caller's OWN receipt on a message (RV2 R5). The actor must be a
 * metadata-tier reader of the message's referral (42501 otherwise). Self-scoped: the
 * receipt is always keyed to `auth.uid()` — a user can never forge another's (K-R5-5).
 * Returns silently (no toast) — this is a background indicator, not a user action.
 */
export async function recordReferralMessageReceipt(
  input: RecordReferralReceiptInput,
): Promise<ReferralActionState> {
  if (!input.messageId) return { ok: false, error: REFERRAL_MESSAGES.missingMessage }

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_referral_message_receipt', {
    p_message_id: input.messageId,
    p_event: input.event,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Audited PHI reveal (server action wrapper over the audited query door)
// ---------------------------------------------------------------------------

/**
 * On-demand audited PHI read for the `"use client"` patient panel. A Client
 * Component cannot import the `getReferralPatient` query (server-only, Rule 9), so
 * this thin `"use server"` wrapper triggers it on click. The audit
 * (`referral_patient.read`) fires INSIDE the `get_referral_patient` RPC; this
 * returns `null` when no PHI exists OR the caller is out of scope (the door returns
 * NULL, not an error, for an unentitled reader).
 */
export async function revealReferralPatient(
  referralId: string,
): Promise<ReferralPatient | null> {
  if (!referralId) return null
  return getReferralPatient(referralId)
}

/**
 * On-demand precedence-aware pre-fill of the referral patient block (ADR 0038). A
 * `"use client"` wizard cannot call the `getCaseSafetyEventPatientPrefill` query
 * (server-only, Rule 9), so this thin `"use server"` wrapper triggers it when the
 * coordinator actually REACHES the patient step — NOT on every case-detail render
 * — so the audited read (`case_patient.read` OR the fallback `event_patient.read`,
 * each emitted inside its own door) fires only on a real, intentional access.
 * PRECEDENCE: prefer the case's own `case_patient`, fall back to a linked event's
 * `event_patient` (`result.source` distinguishes them). Returns `null` when the
 * case has neither source with PHI OR the caller is not entitled. The returned
 * `patient.referralId` is `''` — the wizard fills it once the draft exists.
 */
export async function loadCaseSafetyPrefill(
  caseId: string,
): Promise<CaseSafetyPrefill | null> {
  if (!caseId) return null
  return getCaseSafetyEventPatientPrefill(caseId)
}

// ---------------------------------------------------------------------------
// PHI disposal (LGPD Art. 18 erasure) — NSP-per-hospital (ADR 0052 §6)
// ---------------------------------------------------------------------------

/**
 * Dispose the referral's PHI (LGPD Art. 18 erasure). Destructively deletes the
 * isolated `referral_patient` row and NULLs/redacts every PHI free-text column across
 * the referral + its reply + shared items, PRESERVING the governance skeleton
 * (`ENC-NNNN` code, structural fields, status, provenance, audit chain). Mirrors
 * `dispose_event_phi` / `dispose_case_phi` — the referral module's third disposal
 * door. The `dispose_referral_phi` DEFINER is the authority: the source-side TENANCY admin
 * OR the NSP arm of either side — `is_tenancy_admin_of(source) OR
 * is_pqs_operator_of(source hospital) OR is_pqs_operator_of(target hospital)` (42501
 * otherwise; one-shot → HC056), audited at the HOSPITAL tier via the source commission.
 * `reason` is a CONSTRAINED category ({@link PhiDisposeReason}), never free text.
 *
 * ⚠ This gate moved THREE times and this docblock was stale for the first two, so verify
 * against `pg_get_functiondef` rather than this sentence: ADR 0078 A35/M2 removed the
 * platform-admin bypass (still removed); BUG-QOB-004 (`20260917000000`) removed the
 * tenancy tier; FUP-QOB-3 (`20260917000400`) RESTORED it as a **backstop** on the same
 * day, because disposal reveals no content (the ADR 0104 D11 shape) and a hospital with no
 * NSP roster would otherwise have nobody able to honour an LGPD Art. 18 erasure request.
 * There is no staff_admin arm and never was. Note the asymmetry with drafting:
 * `create_referral_draft` stays CUT — the backstop is disposal-only (pgTAP `314` 8.6/8.7).
 */
export async function disposeReferralPhi(
  referralId: string,
  reason: PhiDisposeReason,
): Promise<ReferralActionState> {
  if (!referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('dispose_referral_phi', {
    p_referral_id: referralId,
    p_reason: reason,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.phiDisposed }
}

// ---------------------------------------------------------------------------
// Dialogue thread (RV2 R1) — post / request / provide
// ---------------------------------------------------------------------------

/**
 * Post a free-form thread message ("Comentar"). The RPC gates a PHI reader who
 * resolves to the source/target side (HC0A0) and a non-terminal status; it locks
 * the referral, allocates the sequence number, and updates `last_message_at`.
 */
export async function postReferralMessage(
  input: PostReferralMessageInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }
  if (!input.body?.trim()) {
    return { ok: false, fieldErrors: { body: REFERRAL_MESSAGES.messageBodyRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('post_referral_message', {
    p_referral_id: input.referralId,
    p_message_type: input.messageType,
    p_body: input.body.trim(),
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.messagePosted }
}

/**
 * Target coordinator/analyst asks the source a clarifying question ("Solicitar
 * informação"): posts an `information_request`, flips the referral to
 * `awaiting_information`, waiting-on = source. The RPC requires `in_review` (HC0A1).
 */
export async function requestReferralInformation(
  input: RequestReferralInfoInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }
  if (!input.body?.trim()) {
    return { ok: false, fieldErrors: { body: REFERRAL_MESSAGES.requestBodyRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('request_referral_information', {
    p_referral_id: input.referralId,
    p_body: input.body.trim(),
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.informationRequested }
}

/**
 * Source coordinator answers a pending request ("Responder"): posts an
 * `information_response`, waiting-on = target, resumes `in_review`. The RPC requires
 * `awaiting_information` (HC0A1).
 */
export async function provideReferralInformation(
  input: ProvideReferralInfoInput,
): Promise<ReferralActionState> {
  if (!input.referralId) {
    return { ok: false, error: REFERRAL_MESSAGES.missingReferral }
  }
  if (!input.body?.trim()) {
    return { ok: false, fieldErrors: { body: REFERRAL_MESSAGES.responseBodyRequired } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('provide_referral_information', {
    p_referral_id: input.referralId,
    p_body: input.body.trim(),
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.informationProvided }
}

/**
 * Permanently DELETE an unsent referral draft. Source coordinator only.
 *
 * Unlike every other referral mutation this has no RPC: RLS is the sole authority
 * (`case_referral_delete_draft_source` = `status = 'draft' AND
 * app.can_manage_referral_source(id, auth.uid())`), backed by the
 * `app.guard_referral_status` DELETE arm (`old.status <> 'draft'` → HC070).
 *
 * RLS reports NO error for a row the policy excludes — it simply deletes nothing.
 * So we `.select()` the deleted rows and treat an empty result as a refusal, or the
 * caller would get a success toast for a delete that never happened.
 *
 * On success the caller navigates away: the referral detail route will 404 once the
 * row is gone, so both the source case AND the encaminhamentos hub are revalidated.
 */
export async function deleteReferralDraft(
  referralId: string,
): Promise<ReferralActionState> {
  if (!referralId) return { ok: false, error: REFERRAL_MESSAGES.missingReferral }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_referral')
    .delete()
    .eq('id', referralId)
    .eq('status', 'draft')
    .select('id')

  if (error) return { ok: false, error: mapReferralError(error) }
  if (!data || data.length === 0) {
    return { ok: false, error: REFERRAL_MESSAGES.draftDeleteBlocked }
  }

  // Revalidates the hub + referral detail + the source case + the QPS dashboard.
  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.draftDeleted }
}

// ---------------------------------------------------------------------------
// Requested-action vocabulary CRUD (RV2 R2) — admin only (HC0A3)
// ---------------------------------------------------------------------------

/** Create one requested-action vocabulary row (RV2 R2). Admin only — the RPC
 * raises HC0A3 otherwise. PHI-free. */
export async function createReferralRequestedAction(
  input: CreateRequestedActionInput,
): Promise<ReferralActionState> {
  if (!input.key?.trim() || !input.label?.trim()) {
    return { ok: false, error: REFERRAL_MESSAGES.vocabKeyLabelRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_referral_requested_action', {
    p_key: input.key.trim(),
    p_label: input.label.trim(),
    p_description: input.description ?? undefined,
    p_color_token: input.colorToken ?? undefined,
    p_position: input.position,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.vocabSaved }
}

/** Edit one requested-action vocabulary row (RV2 R2; `isActive: false` retires it).
 * Admin only — the RPC raises HC0A3 otherwise. PHI-free. */
export async function updateReferralRequestedAction(
  input: UpdateRequestedActionInput,
): Promise<ReferralActionState> {
  if (!input.id) return { ok: false, error: REFERRAL_MESSAGES.vocabKeyLabelRequired }
  if (!input.label?.trim()) {
    return { ok: false, error: REFERRAL_MESSAGES.vocabKeyLabelRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_referral_requested_action', {
    p_id: input.id,
    p_label: input.label.trim(),
    p_description: input.description ?? undefined,
    p_color_token: input.colorToken ?? undefined,
    p_position: input.position ?? undefined,
    p_is_active: input.isActive ?? undefined,
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.vocabSaved }
}
