'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { SAFETY_MESSAGES, mapRcaError } from '@/lib/safety/messages'
import type { ActionState } from '@/lib/safety/types'
import type {
  RcaFactorInput,
  RcaMemberInput,
  RcaMemberRole,
  RcaRootCauseInput,
  RcaTimelineEntryInput,
  RootCauseClassification,
  RootCauseType,
  UpdateRcaInput,
} from '@/lib/safety/rca-types'
import type {
  NspEvidenceActionState,
  NspEvidenceLinkInput,
  NspEvidenceUploadRequest,
  NspEvidenceUploadTicket,
  RcaEvidenceCitationInput,
} from '@/lib/safety/evidence-contract'

// Result + input shapes live in the CLIENT-SAFE `@/lib/safety/{types,rca-types}`
// (a `"use server"` module may export only async functions, and the client binds its
// forms to these) — see P14a-002. This module exports ONLY the action functions below.

/**
 * Patient-safety / NSP RCA server actions (Phase 14c — Root Cause Analysis;
 * Architecture Rules 9, 10, 11). Every write routes through a SECURITY DEFINER RPC
 * authorized by `app.can_write_rca` (PQS/admin OR a non-observer assigned team
 * member) — RLS + the RPC's gate are the authority. The RPC raises HC047 for a
 * wrong-state/frozen RCA, HC048 for an unauthorized writer, and `check_violation`
 * (with a distinct pt-BR message) for an invalid evidence shape.
 *
 * The INPUT shapes + the action SIGNATURES are the FROZEN contract the frontend
 * binds its forms to. All user-facing strings are pt-BR (centralized in
 * `./messages.ts` via `mapRcaError`); raw Supabase/Postgres errors NEVER reach the UI.
 */

// NSP-per-org (ADR 0042): console moved /admin/nsp → /o/[org]/nsp/**. Revalidate the
// per-org NSP LAYOUT across all [org] values (Next-15 dynamic-segment form; 'layout'
// covers the layout + every page beneath it). RLS-scoped data → no cross-org leak.
const NSP_PATH = '/o/[org]/nsp'

function revalidateNsp(): void {
  revalidatePath(NSP_PATH, 'layout')
}


// ---------------------------------------------------------------------------
// RCA lifecycle
// ---------------------------------------------------------------------------

/** Edit the problem statement + findings summary (also bumps `draft → in_progress`). */
export async function updateRca(
  rcaId: string,
  input: UpdateRcaInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca', {
    p_rca_id: rcaId,
    p_what_md: input.whatMd ?? undefined,
    p_expected_md: input.expectedMd ?? undefined,
    p_detected: input.detected ?? undefined,
    p_impact: input.impact ?? undefined,
    p_scope: input.scope ?? undefined,
    p_summary_md: input.summaryMd ?? undefined,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaUpdated }
}

export async function submitRcaForReview(rcaId: string): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_rca_for_review', { p_rca_id: rcaId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaSubmitted }
}

export async function completeRca(rcaId: string): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_rca', { p_rca_id: rcaId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaCompleted }
}

export async function reopenRca(rcaId: string): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reopen_rca', { p_rca_id: rcaId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaReopened }
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export async function addRcaMember(
  rcaId: string,
  input: RcaMemberInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  const hasUser = !!input.userId
  const hasExternal = !!input.externalName?.trim()
  if (hasUser === hasExternal) {
    return { ok: false, error: SAFETY_MESSAGES.rcaMemberShapeInvalid }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_member', {
    p_rca_id: rcaId,
    p_user_id: input.userId ?? undefined,
    p_external_name: input.externalName?.trim() ?? undefined,
    p_role: input.role,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaMemberAdded }
}

export async function updateRcaMemberRole(
  memberId: string,
  role: RcaMemberRole,
): Promise<ActionState> {
  if (!memberId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_member_role', {
    p_member_id: memberId,
    p_role: role,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaMemberUpdated }
}

export async function removeRcaMember(memberId: string): Promise<ActionState> {
  if (!memberId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_member', { p_member_id: memberId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaMemberRemoved }
}

// ---------------------------------------------------------------------------
// Incident timeline
// ---------------------------------------------------------------------------

export async function addRcaTimelineEntry(
  rcaId: string,
  input: RcaTimelineEntryInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  if (!input.description?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaTimelineDescriptionRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_timeline_entry', {
    p_rca_id: rcaId,
    p_occurred_at: input.occurredAt,
    p_description: input.description.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

export async function updateRcaTimelineEntry(
  entryId: string,
  input: RcaTimelineEntryInput,
): Promise<ActionState> {
  if (!entryId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.description?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaTimelineDescriptionRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_timeline_entry', {
    p_entry_id: entryId,
    p_occurred_at: input.occurredAt,
    p_description: input.description.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

export async function removeRcaTimelineEntry(entryId: string): Promise<ActionState> {
  if (!entryId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_timeline_entry', { p_entry_id: entryId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

export async function reorderRcaTimeline(
  rcaId: string,
  orderedIds: string[],
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_rca_timeline', {
    p_rca_id: rcaId,
    p_ordered_ids: orderedIds,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

// ---------------------------------------------------------------------------
// Evidence (upload XOR link XOR citation; soft-delete)
// ---------------------------------------------------------------------------



export async function deleteRcaEvidence(evidenceId: string): Promise<ActionState> {
  if (!evidenceId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_rca_evidence', { p_evidence_id: evidenceId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaEvidenceRemoved }
}

// ---------------------------------------------------------------------------
// Fishbone factors
// ---------------------------------------------------------------------------

export async function addRcaFactor(
  rcaId: string,
  input: RcaFactorInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  if (!input.text?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaFactorTextRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_factor', {
    p_rca_id: rcaId,
    p_category: input.category,
    p_text: input.text.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

export async function updateRcaFactor(
  factorId: string,
  text: string,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!text?.trim()) return { ok: false, error: SAFETY_MESSAGES.rcaFactorTextRequired }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_factor', {
    p_factor_id: factorId,
    p_text: text.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

export async function setRcaFactorKey(
  factorId: string,
  isKey: boolean,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_rca_factor_key', {
    p_factor_id: factorId,
    p_is_key: isKey,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

export async function removeRcaFactor(factorId: string): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_factor', { p_factor_id: factorId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

// ---------------------------------------------------------------------------
// 5-Whys (keyed by factor; lazily created)
// ---------------------------------------------------------------------------

export async function setRcaWhyStep(
  factorId: string,
  index: number,
  text: string,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_rca_why_step', {
    p_factor_id: factorId,
    p_index: index,
    p_text: text,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaWhySaved }
}

export async function setRcaWhyRoot(
  factorId: string,
  rootText: string,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_rca_why_root', {
    p_factor_id: factorId,
    p_root_text: rootText,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaWhySaved }
}

// ---------------------------------------------------------------------------
// Root causes (stage 3) — the FK target for Phase-14d capa_action
// ---------------------------------------------------------------------------

export async function addRcaRootCause(
  rcaId: string,
  input: RcaRootCauseInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  if (!input.text?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaRootCauseTextRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_root_cause', {
    p_rca_id: rcaId,
    p_text: input.text.trim(),
    p_category: input.category ?? undefined,
    p_classification: input.classification,
    p_type: input.type,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

export async function updateRcaRootCause(
  rootCauseId: string,
  input: RcaRootCauseInput,
): Promise<ActionState> {
  if (!rootCauseId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.text?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaRootCauseTextRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_root_cause', {
    p_root_cause_id: rootCauseId,
    p_text: input.text.trim(),
    p_category: input.category ?? undefined,
    p_classification: input.classification,
    p_type: input.type,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

export async function setRcaRootCauseClassification(
  rootCauseId: string,
  classification: RootCauseClassification,
  type: RootCauseType,
): Promise<ActionState> {
  if (!rootCauseId) return { ok: false, error: SAFETY_MESSAGES.generic }

  // Reuse update_rca_root_cause's classification/type fields without re-sending text:
  // the dedicated set keeps text/category untouched by reading the current row first.
  const supabase = await createClient()
  const { data: current } = await supabase
    .from('rca_root_causes')
    .select('text, category')
    .eq('id', rootCauseId)
    .maybeSingle()
    .returns<{ text: string; category: string | null } | null>()
  if (!current) return { ok: false, error: SAFETY_MESSAGES.generic }

  const { error } = await supabase.rpc('update_rca_root_cause', {
    p_root_cause_id: rootCauseId,
    p_text: current.text,
    p_category: current.category ?? undefined,
    p_classification: classification,
    p_type: type,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

export async function removeRcaRootCause(rootCauseId: string): Promise<ActionState> {
  if (!rootCauseId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_root_cause', {
    p_root_cause_id: rootCauseId,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

// ---------------------------------------------------------------------------
// DM5 S2 CONTRACT — posted before implementation (contract-first). Bodies land
// with migrations 20260927000100-000299. Signatures are STABLE once posted.
// Contract + error union: `src/lib/safety/evidence-contract.ts`.
// ---------------------------------------------------------------------------

/**
 * Reserve an upload for a `document`-kind RCA evidence file.
 *
 * Replaces `uploadRcaEvidenceFile`, which minted its own `{event}/{rca}/{uuid}`
 * path and PUT straight to `nsp-evidence`. Bucket and path are now derived
 * server-side from the `rca` securable resource (ADR 0114 D8/D9, ADR 0120 D1).
 * Declared size/MIME are re-derived and re-verified at finalize; nothing the
 * caller says about the bytes is trusted.
 */
export async function beginRcaEvidenceUpload(
  _rcaId: string,
  _request: NspEvidenceUploadRequest,
): Promise<NspEvidenceActionState & { ticket?: NspEvidenceUploadTicket }> {
  throw new Error('not implemented — DM5 S2')
}

/** Verify the uploaded bytes server-side and create the evidence row atomically. */
export async function finalizeRcaEvidenceUpload(
  _uploadSessionId: string,
): Promise<NspEvidenceActionState & { evidenceId?: string }> {
  throw new Error('not implemented — DM5 S2')
}

/** Add a `link`-kind row. No bytes; untouched by the substrate move — listed so
 *  frontend sees the whole surface, not only the parts that change. */
export async function addRcaEvidenceLink(
  _rcaId: string,
  _input: NspEvidenceLinkInput,
): Promise<NspEvidenceActionState> {
  throw new Error('not implemented — DM5 S2')
}

/**
 * Add a `citation`-kind row.
 *
 * ⚠ The SECOND, INDEPENDENT seam: `cited_document_id` is the citation slot
 * (`kind = 'citation'`, mutually exclusive with the uploaded byte). S2 un-parks
 * it by dropping BOTH the `HC0DM` arm and the table CHECK
 * `rca_evidence_cited_document_parked`, then adding the real FK. Passing
 * `citationTarget: 'document'` is refused today and accepted after S2.
 */
export async function addRcaEvidenceCitation(
  _rcaId: string,
  _input: RcaEvidenceCitationInput,
): Promise<NspEvidenceActionState> {
  throw new Error('not implemented — DM5 S2')
}

/** Resolve a short-TTL signed URL through the single audited door. Emits the
 *  Rule-11 read row; never called from a list. */
export async function openRcaEvidence(
  _evidenceId: string,
): Promise<NspEvidenceActionState & { url?: string }> {
  throw new Error('not implemented — DM5 S2')
}
