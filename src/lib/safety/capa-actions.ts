'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { SAFETY_MESSAGES, mapCapaError } from '@/lib/safety/messages'
import type { ActionState } from '@/lib/safety/types'
import type {
  CapaActionInput,
  CapaActionStatus,
  CapaEffectivenessInput,
  CapaMeasureInput,
  CapaMeasureResultInput,
  OpenCapaInput,
  UpdateCapaInput,
} from '@/lib/safety/capa-types'
import type {
  NspEvidenceActionState,
  NspEvidenceLinkInput,
  NspEvidenceUploadRequest,
  NspEvidenceUploadTicket,
} from '@/lib/safety/evidence-contract'

// Result + input shapes live in the CLIENT-SAFE `@/lib/safety/{types,capa-types}`.
// This module exports ONLY the action functions below.

/**
 * Patient-safety / NSP CAPA server actions (Phase 14d; Architecture Rules 9, 10, 11).
 * Every write routes through a SECURITY DEFINER RPC. CAPA management is PQS/admin;
 * an action assignee (plain `staff`) advances their action ONLY via the narrow
 * {@link advanceCapaAction}/{@link completeCapaAction} path (HC050). All user-facing
 * strings are pt-BR (`./messages.ts` via `mapCapaError`).
 */

// NSP-per-org (ADR 0042): console moved /admin/nsp → /o/[org]/nsp/**. Revalidate the
// per-org NSP LAYOUT across all [org] values (Next-15 dynamic-segment form; 'layout'
// covers the layout + every page beneath it). RLS-scoped data → no cross-org leak.
const NSP_PATH = '/o/[org]/nsp'

function revalidateNsp(): void {
  revalidatePath(NSP_PATH, 'layout')
}


// ---------------------------------------------------------------------------
// Plan lifecycle
// ---------------------------------------------------------------------------

export async function openCapaPlan(input: OpenCapaInput): Promise<ActionState> {
  if (input.source !== 'manual' && !input.sourceId) {
    return { ok: false, error: SAFETY_MESSAGES.capaSourceShapeInvalid }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('open_capa_plan', {
    p_source: input.source,
    p_classification: input.classification,
    p_source_id: input.sourceId ?? undefined,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaOpened }
}

export async function updateCapaPlan(
  capaId: string,
  input: UpdateCapaInput,
): Promise<ActionState> {
  if (!capaId) return { ok: false, error: SAFETY_MESSAGES.capaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_capa_plan', {
    p_capa_id: capaId,
    p_classification: input.classification,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaUpdated }
}

export async function closeCapaPlan(
  capaId: string,
  lessonsLearnedMd: string,
): Promise<ActionState> {
  if (!capaId) return { ok: false, error: SAFETY_MESSAGES.capaMissing }
  if (!lessonsLearnedMd?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.capaLessonsRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('close_capa_plan', {
    p_capa_id: capaId,
    p_lessons_learned_md: lessonsLearnedMd.trim(),
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaClosed }
}

export async function cancelCapaPlan(capaId: string): Promise<ActionState> {
  if (!capaId) return { ok: false, error: SAFETY_MESSAGES.capaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_capa_plan', { p_capa_id: capaId })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaCancelled }
}

export async function reopenCapaPlan(capaId: string): Promise<ActionState> {
  if (!capaId) return { ok: false, error: SAFETY_MESSAGES.capaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reopen_capa_plan', { p_capa_id: capaId })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaReopened }
}

// ---------------------------------------------------------------------------
// Corrective actions
// ---------------------------------------------------------------------------

export async function addCapaAction(
  capaId: string,
  input: CapaActionInput,
): Promise<ActionState> {
  if (!capaId) return { ok: false, error: SAFETY_MESSAGES.capaMissing }
  if (!input.title?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.capaActionTitleRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_capa_action', {
    p_capa_id: capaId,
    p_title: input.title.trim(),
    p_owner: input.owner ?? undefined,
    p_assignee_user_id: input.assigneeUserId ?? undefined,
    p_due_date: input.dueDate ?? undefined,
    p_action_strength: input.actionStrength,
    p_success_measure: input.successMeasure ?? undefined,
    p_root_cause_id: input.rootCauseId ?? undefined,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaActionSaved }
}

export async function updateCapaAction(
  actionId: string,
  input: CapaActionInput,
): Promise<ActionState> {
  if (!actionId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.title?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.capaActionTitleRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_capa_action', {
    p_action_id: actionId,
    p_title: input.title.trim(),
    p_owner: input.owner ?? undefined,
    p_assignee_user_id: input.assigneeUserId ?? undefined,
    p_due_date: input.dueDate ?? undefined,
    p_action_strength: input.actionStrength,
    p_success_measure: input.successMeasure ?? undefined,
    p_root_cause_id: input.rootCauseId ?? undefined,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaActionSaved }
}

export async function removeCapaAction(actionId: string): Promise<ActionState> {
  if (!actionId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_capa_action', { p_action_id: actionId })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaActionRemoved }
}

export async function advanceCapaAction(
  actionId: string,
  status: CapaActionStatus,
): Promise<ActionState> {
  if (!actionId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('advance_capa_action', {
    p_action_id: actionId,
    p_status: status,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaActionAdvanced }
}

export async function completeCapaAction(actionId: string): Promise<ActionState> {
  if (!actionId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_capa_action', { p_action_id: actionId })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaActionAdvanced }
}

// ---------------------------------------------------------------------------
// Execution tasks
// ---------------------------------------------------------------------------

export async function addCapaActionTask(
  actionId: string,
  description: string,
): Promise<ActionState> {
  if (!actionId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!description?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.capaTaskDescriptionRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_capa_action_task', {
    p_action_id: actionId,
    p_description: description.trim(),
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaTaskSaved }
}

export async function setCapaActionTaskDone(
  taskId: string,
  isDone: boolean,
): Promise<ActionState> {
  if (!taskId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_capa_action_task_done', {
    p_task_id: taskId,
    p_is_done: isDone,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaTaskSaved }
}

export async function removeCapaActionTask(taskId: string): Promise<ActionState> {
  if (!taskId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_capa_action_task', { p_task_id: taskId })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaTaskSaved }
}

export async function deleteCapaActionEvidence(evidenceId: string): Promise<ActionState> {
  if (!evidenceId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_capa_action_evidence', {
    p_evidence_id: evidenceId,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaEvidenceRemoved }
}

// ---------------------------------------------------------------------------
// Measures → results
// ---------------------------------------------------------------------------

export async function addCapaMeasure(
  capaId: string,
  input: CapaMeasureInput,
): Promise<ActionState> {
  if (!capaId) return { ok: false, error: SAFETY_MESSAGES.capaMissing }
  if (!input.name?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.capaMeasureNameRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_capa_measure', {
    p_capa_id: capaId,
    p_name: input.name.trim(),
    p_target: input.target ?? undefined,
    p_definition: input.definition ?? undefined,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaMeasureSaved }
}

export async function updateCapaMeasure(
  measureId: string,
  input: CapaMeasureInput,
): Promise<ActionState> {
  if (!measureId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.name?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.capaMeasureNameRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_capa_measure', {
    p_measure_id: measureId,
    p_name: input.name.trim(),
    p_target: input.target ?? undefined,
    p_definition: input.definition ?? undefined,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaMeasureSaved }
}

export async function removeCapaMeasure(measureId: string): Promise<ActionState> {
  if (!measureId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_capa_measure', { p_measure_id: measureId })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaMeasureRemoved }
}

export async function recordCapaMeasureResult(
  measureId: string,
  input: CapaMeasureResultInput,
): Promise<ActionState> {
  if (!measureId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.period?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.generic }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_capa_measure_result', {
    p_measure_id: measureId,
    p_period: input.period.trim(),
    p_value: input.value ?? undefined,
    p_note: input.note ?? undefined,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaResultRecorded }
}

// ---------------------------------------------------------------------------
// Effectiveness (the close precondition)
// ---------------------------------------------------------------------------

export async function recordCapaEffectiveness(
  capaId: string,
  input: CapaEffectivenessInput,
): Promise<ActionState> {
  if (!capaId) return { ok: false, error: SAFETY_MESSAGES.capaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_capa_effectiveness', {
    p_capa_id: capaId,
    p_verdict: input.verdict,
    p_method_md: input.methodMd ?? undefined,
  })
  if (error) return { ok: false, error: mapCapaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.capaEffectivenessRecorded }
}

// ---------------------------------------------------------------------------
// DM5 S2 CONTRACT — see src/lib/safety/evidence-contract.ts. CAPA has no
// citation seam (`capa_action_evidence.kind` is document | link only).
// ---------------------------------------------------------------------------

/**
 * Reserve an upload for a `document`-kind CAPA implementation-evidence file.
 *
 * ⚠ Replaces `uploadCapaEvidenceFile`, which is BROKEN TODAY for every user
 * (BUG-DM5-CAPA-1): it writes `{capa_id}/{action_id}/…` while
 * `capa_evidence_obj_insert_writable` resolves `foldername[1]` through
 * `app.hospital_of_event`, an EVENT resolver, so the arm is false for every
 * CAPA and every persona. Fails closed — refused, never leaked.
 */
export async function beginCapaEvidenceUpload(
  _actionId: string,
  _request: NspEvidenceUploadRequest,
): Promise<NspEvidenceActionState & { ticket?: NspEvidenceUploadTicket }> {
  throw new Error('not implemented — DM5 S2')
}

/** Verify server-side and create the evidence row atomically. */
export async function finalizeCapaEvidenceUpload(
  _uploadSessionId: string,
): Promise<NspEvidenceActionState & { evidenceId?: string }> {
  throw new Error('not implemented — DM5 S2')
}

/** Add a `link`-kind row (unchanged in behaviour; re-typed onto the union). */
export async function addCapaEvidenceLink(
  _actionId: string,
  _input: NspEvidenceLinkInput,
): Promise<NspEvidenceActionState> {
  throw new Error('not implemented — DM5 S2')
}

/** Resolve a short-TTL signed URL through the single audited door. */
export async function openCapaEvidence(
  _evidenceId: string,
): Promise<NspEvidenceActionState & { url?: string }> {
  throw new Error('not implemented — DM5 S2')
}
