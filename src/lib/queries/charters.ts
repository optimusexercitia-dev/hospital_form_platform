import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { mapCharterError } from '@/lib/charters/messages'
import type {
  CharterUpsertResult,
  CommissionCharter,
  MeetingCadenceStatus,
  MeetingFrequency,
  CarryForwardSuggestions,
} from '@/lib/charters/types'

/**
 * Committee Charters & Meeting Cadence (S4·CH, Phase 21) — data-access layer
 * (Architecture Rule 9 — no inline supabase-js in components).
 *
 * The frozen contract (exported signatures + `@/lib/charters/types` shapes) was posted
 * in CH-BE-1; these bodies (CH-BE-5) wire it to the CH-BE-2/3/4 backend. The three RPCs
 * emit the camelCase domain shapes verbatim (the `get_ethics_case_procedure` precedent),
 * so the mapping is a typed cast; `getCharter` reads the `commission_charters` table
 * (member RLS applies) and maps snake_case → camelCase.
 *
 * Bind: ADR docs/decisions/0080-committee-charters-cadence-model.md; build plan
 * docs/plans/charters-cadence.md §3. Gated behind the `charters` flag. No PHI (Rule 12).
 * Client Components import the shapes from `@/lib/charters/types` (this module is
 * `server-only`).
 */

/**
 * The commission's charter row, or `null` when none is configured (`sem_regimento`) /
 * the caller cannot read it (`commission_charters` member-read RLS).
 */
export async function getCharter(
  commissionId: string,
): Promise<CommissionCharter | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('commission_charters')
    .select(
      'commission_id, meeting_frequency, controlled_document_id, created_by, created_at, updated_at',
    )
    .eq('commission_id', commissionId)
    .maybeSingle()
  if (error || !data) return null
  return {
    commissionId: data.commission_id,
    meetingFrequency: data.meeting_frequency as MeetingFrequency,
    controlledDocumentId: data.controlled_document_id,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Create or update the commission's charter via the sole write door — the
 * `upsert_commission_charter` DEFINER RPC (staff_admin authority HC0K0; valid regimento
 * link or HC0K1). On failure returns a pt-BR message resolved by {@link mapCharterError}.
 */
export async function upsertCharter(
  commissionId: string,
  meetingFrequency: MeetingFrequency,
  controlledDocumentId?: string | null,
): Promise<CharterUpsertResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('upsert_commission_charter', {
    p_commission: commissionId,
    p_meeting_frequency: meetingFrequency,
    p_controlled_document_id: controlledDocumentId ?? undefined,
  })
  if (error || !data) return { ok: false, error: mapCharterError(error) }
  return { ok: true, charter: data as unknown as CommissionCharter }
}

/**
 * The commission's cadence-adherence status via the DEFINER `meeting_cadence_status`
 * RPC (member-scoped). `null` when the caller is not a member (HC0K2) or on error —
 * the FE then omits the indicator.
 */
export async function getMeetingCadenceStatus(
  commissionId: string,
): Promise<MeetingCadenceStatus | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('meeting_cadence_status', {
    p_commission: commissionId,
  })
  if (error || !data) return null
  return data as unknown as MeetingCadenceStatus
}

/**
 * Carry-forward suggestions via the pure DEFINER `suggest_carry_forward` RPC
 * (member-scoped, confidentiality-filtered). Empty lists on error / no member authority.
 */
export async function getCarryForwardSuggestions(
  commissionId: string,
): Promise<CarryForwardSuggestions> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('suggest_carry_forward', {
    p_commission: commissionId,
  })
  if (error || !data) return { agendaItems: [], actionItems: [] }
  return data as unknown as CarryForwardSuggestions
}
