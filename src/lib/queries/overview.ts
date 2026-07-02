import { createClient } from '@/lib/supabase/server'

/**
 * "Visão Geral" member-overview data-access (Architecture Rule 9 — all reads go
 * through `src/lib/queries/`). Backs the per-member overview cards at
 * `/o/[org]/c/[commission]/` — five self-scoped counts (same for staff and
 * staff_admin) plus two cheap secondary hints, in ONE round-trip.
 *
 * Distinct from `dashboard.ts`, which is the staff_admin AGGREGATE surface
 * (submitted-response stats, `is_staff_admin_of`-gated). This module is a
 * PER-MEMBER, self-scoped read available to any member of the commission.
 *
 * Backed by the SECURITY DEFINER `get_member_overview(p_commission)`, which
 * self-scopes every count to `auth.uid()`. Each flag-dependent count/hint
 * returns 0/null when its feature flag is OFF (never raises). This is a read of
 * the caller's OWN work + own aggregate counts (self-scoped), so no audit row is
 * emitted (Rule 11). All user-facing strings are the caller's (pt-BR).
 */

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

/**
 * The current member's "Visão Geral" for one commission: five counts + two
 * secondary hints. Every count respects the same visibility rules the underlying
 * feature path enforces; a count whose feature flag is OFF is 0 (never an error).
 */
export interface MemberOverview {
  /**
   * Cases the caller is PERSONALLY attributed on or granted, with a non-terminal
   * status (excludes `concluido` AND `cancelado`). The attribution disjuncts
   * (phase/narrative assignee) count REGARDLESS of the `case_access` flag (the
   * `minhas-fases` reality when the flag is off); the explicit read/write grant
   * disjunct counts only when `case_access` is ON. 0 when the cases feature is
   * entirely disabled. Faithful to `app.can_read_case`'s attribution logic.
   */
  casesNotConcluded: number
  /**
   * Action items assigned to the caller with status ∈ {open, in_progress} — the
   * "Meus itens de ação" union count. 0 when both source flags
   * (`cases_extras` + `meetings`) are off.
   */
  pendingActionItems: number
  /** Of {@link pendingActionItems}, how many are overdue (`due_date < today`). Secondary hint. */
  pendingActionItemsOverdue: number
  /**
   * Meetings the caller ATTENDS (`meeting_attendees.user_id = auth.uid()`) whose
   * status is not concluded — status ∈ {agendada, realizada, em_assinatura}
   * (excludes assinada/distribuida/cancelada). 0 when `meetings` is off.
   */
  meetingsNotConcluded: number
  /**
   * The caller's NEXT attended meeting's `scheduled_start` (ISO), or `null` when
   * none is upcoming / `meetings` is off. Secondary hint.
   */
  nextMeetingStart: string | null
  /**
   * Meeting-minute signatures the caller still owes (the
   * `my_pending_meeting_signatures` count, scoped to this commission). 0 when
   * `meetings` is off.
   */
  pendingSignatures: number
  /** The caller's own `in_progress` form responses (drafts) in this commission. */
  inProgressResponses: number
}

// ---------------------------------------------------------------------------
// RPC payload shape
// ---------------------------------------------------------------------------

/** The `get_member_overview` jsonb object (snake_case). */
interface MemberOverviewJson {
  cases_not_concluded: number
  pending_action_items: number
  pending_action_items_overdue: number
  meetings_not_concluded: number
  next_meeting_start: string | null
  pending_signatures: number
  in_progress_responses: number
}

const ZERO: MemberOverview = {
  casesNotConcluded: 0,
  pendingActionItems: 0,
  pendingActionItemsOverdue: 0,
  meetingsNotConcluded: 0,
  nextMeetingStart: null,
  pendingSignatures: 0,
  inProgressResponses: 0,
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Load the caller's member overview for one commission in a single round-trip.
 * Backed by the SECURITY DEFINER `get_member_overview`, self-scoped to
 * `auth.uid()`. Returns an all-zero overview on error / unauthenticated
 * (fail-closed).
 */
export async function getMemberOverview(
  commissionId: string,
): Promise<MemberOverview> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_member_overview', {
    p_commission: commissionId,
  })

  if (error || !data) return ZERO

  const row = data as unknown as MemberOverviewJson

  return {
    casesNotConcluded: Number(row.cases_not_concluded),
    pendingActionItems: Number(row.pending_action_items),
    pendingActionItemsOverdue: Number(row.pending_action_items_overdue),
    meetingsNotConcluded: Number(row.meetings_not_concluded),
    nextMeetingStart: row.next_meeting_start,
    pendingSignatures: Number(row.pending_signatures),
    inProgressResponses: Number(row.in_progress_responses),
  }
}
