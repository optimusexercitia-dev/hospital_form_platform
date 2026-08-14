'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { finalizeDocumentUpload, openDocumentVersion } from '@/lib/documents/actions'
import { SAFETY_MESSAGES, mapCapaError } from '@/lib/safety/messages'
import { mapNspEvidenceErrorCode } from '@/lib/safety/evidence-contract'
import { narrowDocumentEvidenceError } from '@/lib/safety/evidence-mapping'
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
  NspEvidenceErrorCode,
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
 * SQLSTATE → contract code, CODE ALONE (Rule 10). Private helper: a
 * `"use server"` module may export only async functions.
 */
function evidenceErrCode(error: { code?: string | null } | null): NspEvidenceErrorCode {
  return mapNspEvidenceErrorCode(error?.code ?? null)
}

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
  actionId: string,
  request: NspEvidenceUploadRequest,
): Promise<NspEvidenceActionState & { ticket?: NspEvidenceUploadTicket }> {
  if (!actionId || !request?.title?.trim() || !request.declaredFileName?.trim()) {
    return { ok: false, code: 'invalid_input' }
  }

  // Home PINNED server-side on the `capa_action` securable (ADR 0114 D8 / ADR
  // 0120 D14). `app.can_write_document`'s `capa_action` arm resolves the plan
  // and defers to `app.can_write_capa` — the caller-minted `{capa}/{action}/…`
  // path of the retired `uploadCapaEvidenceFile` (BUG-DM5-CAPA-1, which failed
  // closed for every persona) has no successor here.
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('begin_document_upload', {
    p_resource_type: 'capa_action',
    p_resource_id: actionId,
    p_title: request.title.trim(),
    p_declared_file_name: request.declaredFileName,
    p_declared_mime: request.declaredMime,
    p_declared_size: request.declaredSize,
  })
  if (error || !data) return { ok: false, code: evidenceErrCode(error) }
  const r = data as Record<string, string>

  // Coordinates never cross PostgREST: the door returned IDS ONLY.
  const admin = createAdminClient()
  const { data: file, error: fileError } = await admin
    .from('file_objects')
    .select('storage_bucket, storage_path')
    .eq('id', r.file_object_id)
    .single()
  if (fileError || !file) return { ok: false, code: 'unknown' }
  const { data: signed, error: signError } = await admin.storage
    .from(file.storage_bucket)
    .createSignedUploadUrl(file.storage_path)
  if (signError || !signed) return { ok: false, code: 'unknown' }

  return {
    ok: true,
    ticket: {
      uploadSessionId: r.upload_session_id,
      upload: {
        method: 'PUT',
        url: signed.signedUrl,
        headers: { 'x-upsert': 'false' },
        expiresAt: r.expires_at,
      },
    },
  }
}

/** Verify server-side and create the evidence row atomically. */
export async function finalizeCapaEvidenceUpload(
  uploadSessionId: string,
): Promise<NspEvidenceActionState & { evidenceId?: string }> {
  if (!uploadSessionId) return { ok: false, code: 'invalid_input' }

  // Step 1 — the D9 verifier, REUSED not copied (see the RCA twin for the full
  // reasoning): `finalize_document_upload` → service-role download → sha256 →
  // `complete_document_upload_verification`. `terminal` is its ruling, relayed.
  const finalized = await finalizeDocumentUpload(uploadSessionId)
  if (!finalized.ok) {
    const code = narrowDocumentEvidenceError(finalized.error)
    return finalized.terminal ? { ok: false, code, terminal: true } : { ok: false, code }
  }

  // Step 2 — resolve the document from the VERSION id, never from
  // `finalized.documentId`: the RPC's idempotent arm returns no `document_id`,
  // so the twin yields `''` there. Structure, not authority (settled by the
  // door above and again by `add_capa_action_evidence` below).
  const admin = createAdminClient()
  const { data: version } = await admin
    .from('document_versions')
    .select('documents!document_versions_document_id_fkey ( id, title, home_resource_id )')
    .eq('id', finalized.documentVersionId)
    .maybeSingle()
    .returns<{ documents: { id: string; title: string; home_resource_id: string } } | null>()
  const doc = version?.documents
  if (!doc) return { ok: false, code: 'unknown' }

  const supabase = await createClient()

  // Step 3 — idempotency guard: a retried finalize must not mint a SECOND
  // evidence row over the same document (no unique index forbids it).
  const { data: existing } = await supabase
    .from('capa_action_evidence')
    .select('id')
    .eq('document_id', doc.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
    .returns<{ id: string } | null>()
  if (existing) return { ok: true, evidenceId: existing.id }

  // Step 4 — the evidence row. `p_action_id` is the document's OWN home, which
  // the RPC re-verifies (`d.home_resource_id = p_action_id` AND
  // `s.resource_type = 'capa_action'`).
  const { data: evidence, error } = await supabase.rpc('add_capa_action_evidence', {
    p_action_id: doc.home_resource_id,
    p_kind: 'document',
    p_title: doc.title,
    p_document_id: doc.id,
  })
  if (error || !evidence) return { ok: false, code: evidenceErrCode(error) }

  revalidateNsp()
  return { ok: true, evidenceId: evidence.id }
}

/** Add a `link`-kind row (unchanged in behaviour; re-typed onto the union). */
export async function addCapaEvidenceLink(
  actionId: string,
  input: NspEvidenceLinkInput,
): Promise<NspEvidenceActionState> {
  if (!actionId || !input?.title?.trim() || !input.externalUrl?.trim()) {
    return { ok: false, code: 'invalid_input' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_capa_action_evidence', {
    p_action_id: actionId,
    p_kind: 'link',
    p_title: input.title.trim(),
    p_external_url: input.externalUrl.trim(),
  })
  if (error) return { ok: false, code: evidenceErrCode(error) }

  revalidateNsp()
  return { ok: true }
}

/** Resolve a short-TTL signed URL through the single audited door. */
export async function openCapaEvidence(
  evidenceId: string,
): Promise<NspEvidenceActionState & { url?: string }> {
  if (!evidenceId) return { ok: false, code: 'invalid_input' }

  // RLS-scoped: `capa_action_evidence_select` is `can_read_capa(plan)`, the
  // same predicate `app.can_read_document`'s `capa_action` arm resolves to.
  // Absence ≡ denial.
  const supabase = await createClient()
  const { data: ev } = await supabase
    .from('capa_action_evidence')
    .select('kind, document_id')
    .eq('id', evidenceId)
    .is('deleted_at', null)
    .maybeSingle()
    .returns<{ kind: string; document_id: string | null } | null>()
  if (!ev || ev.kind !== 'document' || !ev.document_id) return { ok: false, code: 'not_found' }

  const { data: version } = await supabase
    .from('document_versions')
    .select('id')
    .eq('document_id', ev.document_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<{ id: string } | null>()
  if (!version) return { ok: false, code: 'unavailable' }

  // THE audited byte door (`open_document_version`): kernel + D15 ceiling +
  // servable-state checks, one Rule-11 `document.opened` row, then the command
  // layer signs short-TTL (ADR 0114 O4). Replaces the retired list-time
  // `createSignedUrl(path, 3600)`.
  const opened = await openDocumentVersion(version.id)
  if (!opened.ok) return { ok: false, code: narrowDocumentEvidenceError(opened.error) }
  return { ok: true, url: opened.url }
}
