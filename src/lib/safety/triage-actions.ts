'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { SAFETY_MESSAGES, mapTriageError } from '@/lib/safety/messages'
import type { ActionState } from '@/lib/safety/types'
import type { SaveTriageInput, VocabInput } from '@/lib/safety/triage-types'

// Result + input shapes live in the CLIENT-SAFE `@/lib/safety/{types,triage-types}`
// (a `"use server"` module may export only async functions, and the client binds its
// forms to these) — see P14a-002. This module exports ONLY the action functions below.

/**
 * Patient-safety / NSP TRIAGE server actions (Phase 14b — Triage & Disposition;
 * Architecture Rules 9, 10, 11). Every write routes through a SECURITY DEFINER RPC
 * (`save_triage` / `confirm_triage` / `reopen_triage` + the `is_pqs_member`-gated
 * vocab CRUD + `set_pqs_rca_due_window`) — RLS + the RPC's own gates are the
 * authority. Triage is an NSP activity, so these are PQS/admin actions (the RPC
 * raises 42501 for a non-PQS caller, HC045 for a wrong-state/frozen worksheet, HC046
 * for an inconsistent disposition).
 *
 * The INPUT shapes + the action SIGNATURES are the FROZEN contract the frontend
 * binds its forms to (mirroring Phase 14a). All user-facing strings are pt-BR
 * (centralized in `./messages.ts`); raw Supabase/Postgres errors NEVER reach the UI.
 */

const NSP_PATH = '/admin/nsp'

/** Revalidate the NSP workspaces after a triage / config mutation. */
function revalidateNsp(): void {
  revalidatePath(NSP_PATH, 'page')
}

// ---------------------------------------------------------------------------
// Triage worksheet lifecycle
// ---------------------------------------------------------------------------

/**
 * Structured upsert of the triage worksheet (does NOT freeze — stays editable).
 * The server applies the authoritative cross-field rules (non-harmful reach → harm
 * `none`; sentinel reach → harm floored to `severe`) and recomputes
 * `sentinelDetermination`; the caller re-reads the normalized worksheet afterwards.
 */
export async function saveTriage(
  eventId: string,
  input: SaveTriageInput,
): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }
  if (input.isPse === false && !input.pseClosureReason) {
    return { ok: false, error: SAFETY_MESSAGES.pseReasonRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_triage', {
    p_event_id: eventId,
    p_is_pse: input.isPse ?? undefined,
    p_pse_closure_reason: input.pseClosureReason ?? undefined,
    p_reach: input.reach ?? undefined,
    p_harm_severity: input.harmSeverity ?? undefined,
    p_natural_course: input.naturalCourse ?? undefined,
    p_review_pathway: input.reviewPathway ?? undefined,
    p_disposition_notes_md: input.dispositionNotesMd ?? undefined,
    p_sentinel_criteria_ids: input.sentinelCriteriaIds,
  })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.triageSaved }
}

/**
 * Confirm the triage (`acknowledged → triaged`; FREEZES the worksheet). Resolves
 * the disposition: a sentinel-determined event forces `review_pathway = 'rca'`
 * (non-overridable — HC046 otherwise), mints the configurable RCA due date, and
 * creates the forward-safe RCA shell; a non-PSE routes the event to `closed`.
 */
export async function confirmTriage(eventId: string): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }

  const supabase = await createClient()
  const { error } = await supabase.rpc('confirm_triage', { p_event_id: eventId })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.triageConfirmed }
}

/** Reopen a triaged worksheet (`triaged → acknowledged`; unfreezes; audited). */
export async function reopenTriage(eventId: string): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reopen_triage', { p_event_id: eventId })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.triageReopened }
}

// ---------------------------------------------------------------------------
// Config vocab CRUD (is_pqs_member-gated) — event types + sentinel criteria
// ---------------------------------------------------------------------------

function validateVocab(input: VocabInput): string | null {
  if (!input.key?.trim() || !input.label?.trim()) {
    return SAFETY_MESSAGES.vocabKeyRequired
  }
  return null
}

export async function createEventType(input: VocabInput): Promise<ActionState> {
  const err = validateVocab(input)
  if (err) return { ok: false, error: err }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_event_type', {
    p_key: input.key.trim(),
    p_label: input.label.trim(),
    p_description: input.description ?? undefined,
  })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabSaved }
}

export async function updateEventType(
  id: string,
  input: VocabInput,
): Promise<ActionState> {
  if (!id) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.label?.trim()) return { ok: false, error: SAFETY_MESSAGES.vocabKeyRequired }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_event_type', {
    p_id: id,
    p_label: input.label.trim(),
    p_description: input.description ?? undefined,
  })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabSaved }
}

export async function reorderEventTypes(
  orderedIds: string[],
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_event_types', {
    p_ordered_ids: orderedIds,
  })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabReordered }
}

export async function archiveEventType(id: string): Promise<ActionState> {
  if (!id) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_event_type', { p_id: id })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabArchived }
}

export async function createSentinelCriterion(
  input: VocabInput,
): Promise<ActionState> {
  const err = validateVocab(input)
  if (err) return { ok: false, error: err }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_sentinel_criterion', {
    p_key: input.key.trim(),
    p_label: input.label.trim(),
    p_description: input.description ?? undefined,
  })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabSaved }
}

export async function updateSentinelCriterion(
  id: string,
  input: VocabInput,
): Promise<ActionState> {
  if (!id) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.label?.trim()) return { ok: false, error: SAFETY_MESSAGES.vocabKeyRequired }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_sentinel_criterion', {
    p_id: id,
    p_label: input.label.trim(),
    p_description: input.description ?? undefined,
  })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabSaved }
}

export async function reorderSentinelCriteria(
  orderedIds: string[],
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_sentinel_criteria', {
    p_ordered_ids: orderedIds,
  })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabReordered }
}

export async function archiveSentinelCriterion(id: string): Promise<ActionState> {
  if (!id) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_sentinel_criterion', { p_id: id })
  if (error) return { ok: false, error: mapTriageError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.vocabArchived }
}

// ---------------------------------------------------------------------------
// NSP department config — the RCA due-window
// ---------------------------------------------------------------------------

/**
 * Set the configurable RCA due-window (`pqs_department.rca_default_due_days`), the
 * number of days confirm_triage adds to the event date to mint an RCA's due date.
 * `is_pqs_member`-gated; validated to a sane range (1–365 → HC046). Audited.
 */
/**
 * @deprecated NSP-per-org (ADR 0042): the RCA due-window is now PER-ORG; the
 * underlying `set_pqs_rca_due_window` RPC took a `p_org_id`. Use
 * `setPqsRcaDueWindow(orgId, days)` in `@/lib/pqs/actions`. Kept as a safe-fail stub
 * (returns the unavailable message) so the existing single-org config form keeps
 * compiling until sub-phase B re-homes it and supplies `orgId`.
 */
// TODO(nsp-per-org B): remove when the per-org config route supplies orgId
export async function setRcaDueWindow(days: number): Promise<ActionState> {
  void days
  return { ok: false, error: SAFETY_MESSAGES.unavailable }
}
