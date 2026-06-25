'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { SAFETY_MESSAGES, mapSafetyError } from '@/lib/safety/messages'
import type {
  ActionState,
  NotifyEventInput,
  NotifyEventState,
  PhiDisposeReason,
  SetEventPatientInput,
  TransferCustodyInput,
  UpdateEventInput,
} from '@/lib/safety/types'

// Result + input shapes live in the CLIENT-SAFE `@/lib/safety/types` (a `"use server"`
// module may export only async functions, and the client binds its forms to these) —
// see P14a-002. This module exports ONLY the action functions below.

/**
 * Patient-safety / NSP server actions (Phase 14a — NSP Foundation; Architecture
 * Rules 9, 10, 11 & 12).
 *
 * The INPUT shapes + the action SIGNATURES are the FROZEN contract the frontend
 * binds its forms to (mirroring meetings/interviews). Every write routes through a
 * SECURITY DEFINER RPC (B4) — RLS + the RPC's own gates are the authority; these
 * actions add no broad authz pre-check (the RPC raises HC043/HC044/42501).
 *
 * Write model (ADR 0030/0031):
 *  - {@link notifySafetyEvent} is a JUST-CULTURE exception to the staff_admin-write
 *    default: ANY member of the reporting commission may file an event. So it does
 *    NOT pre-check staff_admin; the RPC authorizes membership of the reporting
 *    commission. It opens the initial custody row at the NSP and, when case-linked,
 *    writes the `case_events kind='safety_event'` registry row.
 *  - {@link acknowledgeEvent}, {@link transferEventCustody}, {@link updateEvent},
 *    {@link setEventPatient}, {@link cancelEvent} are custodian/PQS actions — the
 *    RPC's access-follows-custody gate (→ HC044 not-the-current-custodian / HC043
 *    wrong-state) is the authority; the action does no broad pre-check.
 *
 * PHI (Rule 12): {@link setEventPatient} writes the ISOLATED `event_patient` row;
 * the write is audited WITHOUT copying any identifier into the audit metadata.
 * Identifiers NEVER flow through any other action or into the audit log.
 *
 * All user-facing strings are pt-BR (centralized in `./messages.ts`); raw
 * Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8). The direct entry
 * gates the `patient_safety` flag (via the RPC's `assert_patient_safety_enabled`).
 */

// ---------------------------------------------------------------------------
// Actions (all route through the B4 SECURITY DEFINER RPCs)
// ---------------------------------------------------------------------------

const COMMISSION_EVENTS_PATH = '/c/[slug]/eventos'
const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
// NSP-per-org (ADR 0042): console moved /admin/nsp → /o/[org]/nsp/**. The NSP path now
// carries a dynamic [org] segment, so it revalidates as a LAYOUT (covers the layout +
// every NSP page beneath it). The commission/case paths above are unchanged.
const NSP_PATH = '/o/[org]/nsp'

/** Revalidate the committee read-back + case detail + the per-org NSP workspaces after
 * a safety mutation (the event may surface on any of them). */
function revalidateSafety(): void {
  revalidatePath(COMMISSION_EVENTS_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(NSP_PATH, 'layout')
}

/**
 * Notify the NSP of a patient-safety event (just-culture: ANY member of the
 * reporting commission — the RPC authorizes membership, 42501 otherwise). Opens
 * the initial custody row at the NSP and, when case-linked, writes the
 * `case_events kind='safety_event'` registry row. Returns the new id + code.
 */
export async function notifySafetyEvent(
  input: NotifyEventInput,
): Promise<NotifyEventState> {
  if (!input.reportingCommissionId) {
    return { ok: false, error: SAFETY_MESSAGES.missingCommission }
  }
  if (!input.title?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.titleRequired }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('notify_safety_event', {
    p_reporting_commission_id: input.reportingCommissionId,
    p_title: input.title.trim(),
    p_description_md: input.descriptionMd ?? undefined,
    p_suspected_harm_level: input.suspectedHarmLevel,
    p_case_id: input.caseId ?? undefined,
    p_event_type_id: input.eventTypeId ?? undefined,
    p_location: input.location ?? undefined,
    p_discovered_at: input.discoveredAt ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapSafetyError(error) }

  revalidateSafety()
  return {
    ok: true,
    error: undefined,
    message: SAFETY_MESSAGES.eventNotified,
    eventId: data.id,
    code: data.code,
  }
}

/** NSP takes receipt of an event (`reported → acknowledged`; records who/when). */
export async function acknowledgeEvent(eventId: string): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }

  const supabase = await createClient()
  const { error } = await supabase.rpc('acknowledge_event', { p_event_id: eventId })
  if (error) return { ok: false, error: mapSafetyError(error) }

  revalidateSafety()
  return { ok: true, error: undefined, message: SAFETY_MESSAGES.eventAcknowledged }
}

/**
 * Transfer custody (append a ledger row, close the prior, update the denormalized
 * owner). Access-follows-custody: the new holder gains read, provenance keeps it,
 * a foreign committee gains nothing. RPC gate → HC044 if not the current custodian.
 */
export async function transferEventCustody(
  eventId: string,
  input: TransferCustodyInput,
): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }
  if (input.toOwnerKind === 'commission' && !input.commissionId) {
    return { ok: false, error: SAFETY_MESSAGES.transferTargetRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('transfer_event_custody', {
    p_event_id: eventId,
    p_to_owner_kind: input.toOwnerKind,
    p_to_commission_id: input.commissionId ?? undefined,
    p_note: input.note ?? undefined,
  })
  if (error) return { ok: false, error: mapSafetyError(error) }

  revalidateSafety()
  return { ok: true, message: SAFETY_MESSAGES.custodyTransferred }
}

/** Edit an event's governance fields (not status, not PHI). */
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }
  if (!input.title?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.titleRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_event', {
    p_event_id: eventId,
    p_title: input.title.trim(),
    p_description_md: input.descriptionMd ?? undefined,
    p_suspected_harm_level: input.suspectedHarmLevel,
    p_event_type_id: input.eventTypeId ?? undefined,
    p_location: input.location ?? undefined,
    p_discovered_at: input.discoveredAt ?? undefined,
  })
  if (error) return { ok: false, error: mapSafetyError(error) }

  revalidateSafety()
  return { ok: true, message: SAFETY_MESSAGES.eventUpdated }
}

/**
 * Write the isolated PHI satellite (Rule 12). The write is audited WITHOUT
 * leaking any identifier into the audit metadata (only `event_patient.updated`
 * + who).
 */
export async function setEventPatient(
  eventId: string,
  input: SetEventPatientInput,
): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }
  // Minimum-necessary: require at least a name or an MRN so the panel is meaningful.
  if (!input.name?.trim() && !input.mrn?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.patientNameOrMrnRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_event_patient', {
    p_event_id: eventId,
    p_name: input.name?.trim() || undefined,
    p_mrn: input.mrn?.trim() || undefined,
    p_date_of_birth: input.dateOfBirth ?? undefined,
    p_age_years: input.ageYears ?? undefined,
    p_sex: input.sex,
    p_encounter_ref: input.encounterRef ?? undefined,
    p_unit: input.unit ?? undefined,
    p_attending: input.attending ?? undefined,
  })
  if (error) return { ok: false, error: mapSafetyError(error) }

  revalidateSafety()
  return { ok: true, message: SAFETY_MESSAGES.patientSaved }
}

/** Cancel a wrongly-filed / duplicate event (`→ cancelled`; terminal). */
export async function cancelEvent(eventId: string): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_event', { p_event_id: eventId })
  if (error) return { ok: false, error: mapSafetyError(error) }

  revalidateSafety()
  return { ok: true, message: SAFETY_MESSAGES.eventCancelled }
}

/**
 * WS C — dispose the event's PHI (LGPD Art. 18 erasure). Destructively NULLs/redacts
 * every PHI free-text column across the event + triage + RCA* + CAPA* and deletes the
 * isolated event_patient row, PRESERVING the governance skeleton (codes, status,
 * custody ledger, structured non-PHI, audit chain), then stamps who/when/why +
 * has_patient=false and emits one PHI-free `event_patient.disposed` audit row. The
 * `dispose_event_phi` DEFINER is the authority (admin/PQS gate → 42501; one-shot →
 * HC056); `reason` is a CONSTRAINED category, never free text.
 */
export async function disposeEventPhi(
  eventId: string,
  reason: PhiDisposeReason,
): Promise<ActionState> {
  if (!eventId) return { ok: false, error: SAFETY_MESSAGES.missingEvent }

  const supabase = await createClient()
  const { error } = await supabase.rpc('dispose_event_phi', {
    p_event_id: eventId,
    p_reason: reason,
  })
  if (error) return { ok: false, error: mapSafetyError(error) }

  revalidateSafety()
  return { ok: true, message: SAFETY_MESSAGES.phiDisposed }
}
