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
  ConcludeReferralInput,
  CreateReferralInput,
  CreateReferralState,
  DeclineReferralInput,
  LinkReferralCaseInput,
  PostReferralMessageInput,
  ProvideReferralInfoInput,
  ReferralActionState,
  ReferralPatient,
  RequestReferralInfoInput,
  SetReferralPatientInput,
  UpdateReferralInput,
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
  if (!input.targetCommissionId) {
    return { ok: false, error: REFERRAL_MESSAGES.targetCommissionRequired }
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
    p_target_commission_id: input.targetCommissionId,
    p_referral_type_id: input.referralTypeId,
    p_subject: input.subject.trim(),
    p_response_expected: input.responseExpected,
    p_description_md: input.descriptionMd ?? undefined,
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
  })
  if (error) return { ok: false, error: mapReferralError(error) }

  revalidateReferrals()
  return { ok: true, message: REFERRAL_MESSAGES.referralUpdated }
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
 * `setEventPatient`). Entitlement is source-coordinator/QPS/target-analyst while
 * not concluded (the RPC raises HC078 otherwise); the write is audited WITHOUT
 * copying any identifier into the audit metadata.
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
  const { error } = await supabase.rpc('set_referral_patient', {
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
 * door. The `dispose_referral_phi` DEFINER is the authority: gated
 * `is_admin() OR is_commission_admin_of(source) OR is_pqs_operator_of(referral
 * hospital)` (42501 otherwise; one-shot → HC056), audited at the HOSPITAL tier via the
 * source commission. `reason` is a CONSTRAINED category ({@link PhiDisposeReason}),
 * never free text. Backed by migration `20260710000000_nsp_per_hospital.sql`.
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
