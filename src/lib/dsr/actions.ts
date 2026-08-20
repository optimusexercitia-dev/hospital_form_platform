'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { disposeCasePhi } from '@/lib/cases/actions'
import { disposeEventPhi } from '@/lib/safety/actions'
import { disposeReferralPhi } from '@/lib/referrals/actions'
import { disposeMeetingMinutes } from '@/lib/meetings/actions'
import { DSR_MESSAGES, DSR_SEARCH, mapDsrError } from '@/lib/dsr/messages'
import { searchDsrSubject } from '@/lib/queries/dsr'
import type { DsrOutcome } from '@/lib/queries/dsr'
import type { PatientSearchResult } from '@/lib/patient-index/types'

/**
 * DSR ("Direitos do Titular") server actions — ADR 0130 Slice 2.
 *
 * ⛔ THE LOAD-BEARING CONSTRAINT (ADR 0130 Decision 2). This module ASSIGNS
 * disposal work; it never grants any. {@link executeDisposalTask} calls the
 * EXISTING module action — `disposeCasePhi` / `disposeEventPhi` /
 * `disposeReferralPhi` — under the executor's OWN session, so each door's own
 * gate applies exactly as it does everywhere else, and none of the four gates
 * changed for this program. `complete_dsr_task` then verifies the EFFECT (the
 * module row's `phi_disposed_at`) rather than re-deciding permission: a fifth
 * copy of four different gate expressions is a mirror nothing keeps in sync.
 *
 * ⚠ SLICE 3 CHANGED THE MEETINGS LINE ABOVE, so the old comment is replaced
 * rather than left to go stale. `dispose_meeting` IS executable here now — via
 * {@link disposeMeetingMinutesTask}, calling `src/lib/meetings/actions.ts`'s
 * `disposeMeetingMinutes` under the caller's own session, exactly like the other
 * three. What has NOT changed is where the task comes from: the intake fan-out
 * still NEVER mints it (ADR 0130 Amendment 2 item 3 — a whole-minutes erasure over
 * one agenda item would destroy other committees' records). Only a human
 * adjudication escalates a meeting, per meeting, in {@link adjudicateDsrRequest}.
 * A meeting the adjudication did NOT escalate stays an `attest_review`, whose
 * procedure is the revoke → edit → re-sign corridor (Q10a).
 */

export type DsrActionState = {
  ok: boolean
  message?: string
  error?: string
}

function revalidateDsr(org: string) {
  revalidatePath(`/o/${org}/titulares`)
}

/**
 * Open a subject request. Encarregado-gated at the door; the fan-out of execution
 * tasks happens inside it, from `patient_xref`.
 *
 * The MRN never lands in a DSR row — `create_dsr_request` hashes it via
 * `app.derive_patient_key` and stores only the hash (Q6, and what keeps Rule 12's
 * "exactly three PHI modules" true).
 */
export async function createDsrRequest(input: {
  org: string
  hospitalId: string
  mrn: string
  fileRef: string
  encounter?: string | null
}): Promise<DsrActionState> {
  if (!input.hospitalId) return { ok: false, error: DSR_MESSAGES.missingHospital }
  if (!input.mrn?.trim()) return { ok: false, error: DSR_MESSAGES.missingMrn }
  if (!input.fileRef?.trim()) return { ok: false, error: DSR_MESSAGES.missingFileRef }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_dsr_request', {
    p_hospital_id: input.hospitalId,
    p_mrn: input.mrn.trim(),
    p_file_ref: input.fileRef.trim(),
    p_encounter: input.encounter?.trim() || undefined,
  })
  if (error) return { ok: false, error: mapDsrError(error) }

  revalidateDsr(input.org)
  return { ok: true, message: DSR_MESSAGES.requestCreated }
}

/**
 * Fire the module's own disposal door, then close the task.
 *
 * Both calls run under the caller's session. If the disposal succeeds and the
 * completion does not, the task simply stays pending and "Concluir tarefa"
 * finishes it — the effect check will pass by then. There is no half-state to
 * repair, because the record of truth is the module row, not the task.
 */
export async function executeDisposalTask(input: {
  org: string
  taskId: string
  module: string
  entityId: string
}): Promise<DsrActionState> {
  if (!input.taskId || !input.entityId) {
    return { ok: false, error: DSR_MESSAGES.notFound }
  }

  let result
  switch (input.module) {
    case 'case':
      result = await disposeCasePhi(input.entityId, 'subject_request')
      break
    case 'event':
      result = await disposeEventPhi(input.entityId, 'subject_request')
      break
    case 'referral':
      result = await disposeReferralPhi(input.entityId, 'subject_request')
      break
    case 'meeting':
      // ⚠ The caller MUST have been shown DSR_MEETING_DISPOSAL_WARNING first —
      // this erases the whole ata, every agenda item, including items unrelated
      // to the subject. The warning is copy, not a gate; the gate is the door's.
      result = await disposeMeetingMinutes(input.entityId, 'subject_request')
      break
    default:
      return { ok: false, error: DSR_MESSAGES.forbidden }
  }

  if (!result.ok) {
    return { ok: false, error: result.error ?? DSR_MESSAGES.unexpected }
  }

  return completeDsrTask({ org: input.org, taskId: input.taskId })
}

/**
 * Close a task. For a `dispose_*` kind the door refuses (HCDS3) unless the module
 * row is actually stamped disposed; for an attestation it refuses unless a note
 * is present — an attestation with no attestor statement is not an attestation.
 */
export async function completeDsrTask(input: {
  org: string
  taskId: string
  note?: string | null
}): Promise<DsrActionState> {
  if (!input.taskId) return { ok: false, error: DSR_MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_dsr_task', {
    p_task_id: input.taskId,
    p_note: input.note?.trim() || undefined,
  })
  if (error) return { ok: false, error: mapDsrError(error) }

  revalidateDsr(input.org)
  return { ok: true, message: DSR_MESSAGES.taskCompleted }
}

/**
 * Close the request with its outcome. Encarregado-only (Q16iii — the executors
 * who did the work still cannot close it).
 *
 * ⚠ The refusal copy the DPO writes cites the INSTITUTIONAL RETENTION POLICY
 * (20 years, adopted per counsel 2026-08-19) and NEVER CFM 1821/2007: counsel
 * held that statute does not cover committee records, so citing it to a data
 * subject would be a false legal basis (ADR 0035 Amendment 1 / ADR 0130 Amdt 1).
 */
export async function closeDsrRequest(input: {
  org: string
  requestId: string
  /**
   * Slice 3 — OPTIONAL. When the request was adjudicated, close CONSUMES the
   * recorded decision and an omitted outcome is the normal call; a supplied one
   * must MATCH (HCDS5 otherwise), so a close can never quietly rewrite a decision.
   * The direct path survives only for outcomes that erase nothing
   * (`refused_retention` / `refused_identity` / `withdrawn`) — `granted` and
   * `granted_partial` REQUIRE a prior adjudication, because adjudication is where
   * the erasure population, including the meeting escalations, is finalized.
   */
  outcome?: DsrOutcome | null
  outcomeBasis?: string | null
  legalConsultationRef?: string | null
}): Promise<DsrActionState> {
  if (!input.requestId) return { ok: false, error: DSR_MESSAGES.notFound }
  if (!input.outcome) {
    // No outcome supplied = "close on the recorded decision". The door refuses
    // (HCDS5) if there is none, with the pt-BR pointer at the adjudication step.
    const supabase = await createClient()
    const { error } = await supabase.rpc('close_dsr_request', {
      p_request_id: input.requestId,
    })
    if (error) return { ok: false, error: mapDsrError(error) }
    revalidateDsr(input.org)
    return { ok: true, message: DSR_MESSAGES.requestClosed }
  }

  const isRefusal =
    input.outcome === 'refused_retention' || input.outcome === 'refused_identity'
  if (isRefusal && !input.outcomeBasis?.trim()) {
    return { ok: false, error: DSR_MESSAGES.missingBasis }
  }
  const needsLegalRef =
    input.outcome === 'granted' ||
    input.outcome === 'granted_partial' ||
    input.outcome === 'refused_retention'
  if (needsLegalRef && !input.legalConsultationRef?.trim()) {
    return { ok: false, error: DSR_MESSAGES.missingLegalRef }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('close_dsr_request', {
    p_request_id: input.requestId,
    p_outcome: input.outcome,
    p_outcome_basis: input.outcomeBasis?.trim() || undefined,
    p_legal_consultation_ref: input.legalConsultationRef?.trim() || undefined,
  })
  if (error) return { ok: false, error: mapDsrError(error) }

  revalidateDsr(input.org)
  return { ok: true, message: DSR_MESSAGES.requestClosed }
}

// ===========================================================================
// Slice 3 — adjudication, the attested tier, and the meetings lane.
// ===========================================================================

/**
 * Record the DECISION. This is the step counsel's holding 2 makes mandatory:
 * removal requests are decided case by case, together with legal consultation
 * (ADR 0035 Amendment 1 / ADR 0130 Amendment 1).
 *
 * ⛔ `disposeMeetingIds` is the ONLY way a `dispose_meeting` task is ever minted
 * (ADR 0130 Amendment 2 item 3). The intake fan-out deliberately mints
 * `attest_review` for a linked meeting instead, because `dispose_meeting_minutes`
 * erases the WHOLE minutes and firing it over one agenda item would destroy other
 * committees' records. Escalation to full disposal is a human adjudication, per
 * meeting, and only over meetings THIS request already enumerated.
 *
 * ⚠ The refusal basis cites the INSTITUTIONAL RETENTION POLICY (20 years, adopted
 * per counsel 2026-08-19) and NEVER CFM 1821/2007 — see `DSR_REFUSAL_RETENTION_BASIS`.
 */
export async function adjudicateDsrRequest(input: {
  org: string
  requestId: string
  outcome: DsrOutcome
  outcomeBasis?: string | null
  legalConsultationRef?: string | null
  disposeMeetingIds?: string[]
}): Promise<DsrActionState> {
  if (!input.requestId) return { ok: false, error: DSR_MESSAGES.notFound }
  if (!input.outcome) return { ok: false, error: DSR_MESSAGES.missingOutcome }

  const isRefusal =
    input.outcome === 'refused_retention' || input.outcome === 'refused_identity'
  if (isRefusal && !input.outcomeBasis?.trim()) {
    return { ok: false, error: DSR_MESSAGES.missingBasis }
  }
  const needsLegalRef =
    input.outcome === 'granted' ||
    input.outcome === 'granted_partial' ||
    input.outcome === 'refused_retention'
  if (needsLegalRef && !input.legalConsultationRef?.trim()) {
    return { ok: false, error: DSR_MESSAGES.missingLegalRef }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('adjudicate_dsr_request', {
    p_request_id: input.requestId,
    p_outcome: input.outcome,
    p_outcome_basis: input.outcomeBasis?.trim() || undefined,
    p_legal_consultation_ref: input.legalConsultationRef?.trim() || undefined,
    p_dispose_meeting_ids: input.disposeMeetingIds?.length
      ? input.disposeMeetingIds
      : undefined,
  })
  if (error) return { ok: false, error: mapDsrError(error) }

  revalidateDsr(input.org)
  return { ok: true, message: DSR_MESSAGES.requestAdjudicated }
}

/**
 * Complete an `attest_review` task as a NAMED human, with the count of mentions
 * removed (ADR 0130 Decision 6).
 *
 * ⛔ This does NOT redact anything and there is no door that does: the procedure
 * for a found mention is the revoke corridor (`reopen_meeting` → edit → re-sign),
 * documented in the task itself. An in-place redaction door for locked content is
 * "the child-lock defect's evil twin, a bypass that works" (Decision 7) and will
 * not be built.
 *
 * `complete_dsr_task` REFUSES this kind: an attestation with no attestor name and
 * no count cannot be reported in the outcome record, and an optional structured
 * tier is an unreliable one.
 */
export async function attestDsrTask(input: {
  org: string
  taskId: string
  reviewerName: string
  redactions: number
  note: string
}): Promise<DsrActionState> {
  if (!input.taskId) return { ok: false, error: DSR_MESSAGES.notFound }
  if (!input.reviewerName?.trim()) {
    return { ok: false, error: DSR_MESSAGES.missingReviewerName }
  }
  // ⚠ 0 is a REAL answer ("I looked and found nothing") — `!input.redactions`
  // would reject it. Only a non-integer or a negative is invalid.
  if (
    input.redactions === null ||
    input.redactions === undefined ||
    !Number.isInteger(input.redactions) ||
    input.redactions < 0
  ) {
    return { ok: false, error: DSR_MESSAGES.missingRedactions }
  }
  if (!input.note?.trim()) return { ok: false, error: DSR_MESSAGES.missingNote }

  const supabase = await createClient()
  const { error } = await supabase.rpc('attest_dsr_task', {
    p_task_id: input.taskId,
    p_reviewer_name: input.reviewerName.trim(),
    p_redactions: input.redactions,
    p_note: input.note.trim(),
  })
  if (error) return { ok: false, error: mapDsrError(error) }

  revalidateDsr(input.org)
  return { ok: true, message: DSR_MESSAGES.attestationRecorded }
}

/**
 * The meetings lane — ADR 0056 Consequence (a)'s never-built affordance, discharged.
 *
 * Fires `dispose_meeting_minutes` under the CALLER'S OWN SESSION (its gate is
 * `is_staff_admin_of` OR `is_tenancy_admin_of` of the meeting's commission, and it
 * does not move), then closes the task. Same shape as {@link executeDisposalTask}
 * and for the same binding reason: the DSR never fires a door on the executor's
 * behalf (ADR 0130 Decision 2), or the inbox becomes a DEFINER bypass of four gates.
 */
export async function disposeMeetingMinutesTask(input: {
  org: string
  taskId: string
  meetingId: string
}): Promise<DsrActionState> {
  if (!input.taskId || !input.meetingId) {
    return { ok: false, error: DSR_MESSAGES.notFound }
  }

  const result = await disposeMeetingMinutes(input.meetingId, 'subject_request')
  if (!result.ok) {
    return { ok: false, error: result.error ?? DSR_MESSAGES.unexpected }
  }

  return completeDsrTask({ org: input.org, taskId: input.taskId })
}

/**
 * ⭐ THE DISCOVERY LANE'S `"use server"` WRAPPER. The intake form is a client
 * component and {@link searchDsrSubject} is `server-only`; this keeps the raw MRN
 * off the client bundle and out of any URL, and it is hashed SERVER-SIDE inside
 * the DEFINER door — never persisted raw, never logged raw, never returned.
 *
 * ⚠ WHY A GENUINE FAILURE IS ALLOWED ITS OWN STRING. `search_patient_xref`'s gate
 * returns the EMPTY BUNDLE rather than raising, so an unauthorized caller and a
 * zero-match caller are already indistinguishable IN THE DATABASE — the class that
 * must stay silent structurally cannot reach the error branch below. Collapsing a
 * real RPC/infrastructure failure into a fake empty result would therefore buy no
 * privacy at all and would hide breakage. The empty RESULT, by contrast, must read
 * identically for every cause: see `DSR_SEARCH.empty`.
 */
export async function searchDsrSubjectAction(
  hospitalId: string,
  input: { mrn?: string | null; encounter?: string | null },
): Promise<{
  ok: boolean
  result?: PatientSearchResult
  error?: string
  fieldErrors?: { mrn?: string }
}> {
  const mrn = input.mrn?.trim() || null
  const encounter = input.encounter?.trim() || null

  if (!mrn && !encounter) {
    return {
      ok: false,
      error: DSR_SEARCH.identifierRequired,
      fieldErrors: { mrn: DSR_SEARCH.identifierRequired },
    }
  }

  const result = await searchDsrSubject(hospitalId, mrn, encounter)
  if (!result) return { ok: false, error: DSR_SEARCH.unavailable }

  return { ok: true, result }
}
