'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { disposeCasePhi } from '@/lib/cases/actions'
import { disposeEventPhi } from '@/lib/safety/actions'
import { disposeReferralPhi } from '@/lib/referrals/actions'
import { DSR_MESSAGES, mapDsrError } from '@/lib/dsr/messages'

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
 * ⛔ `dispose_meeting` is NOT executable here. Slice 2 never mints that task kind
 * (ADR 0130 Amendment 2 item 3 — a whole-minutes erasure over one agenda item
 * would destroy other committees' records), so shipping the affordance now would
 * ship a door nothing can reach. Meetings arrive as `attest_review`, whose
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
    default:
      // 'meeting' lands here by construction — see the module header.
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
  outcome: string
  outcomeBasis?: string | null
  legalConsultationRef?: string | null
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
