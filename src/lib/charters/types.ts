/**
 * Committee Charters & Meeting Cadence (S4·CH, Phase 21) — domain types.
 *
 * ============================ CONTRACT-FIRST STUB (CH-BE-1) ============================
 * These are the FROZEN domain shapes `frontend` builds against (the `manage/charter`
 * page, the meetings-list cadence indicator, and the schedule-flow carry-forward step).
 * They are PURE (no `server-only`, no `Database`-generated imports) so both Server and
 * Client Components may import them — the cadence badge and the carry-forward step are
 * interactive/client, and a server-only value module dragged into the client bundle
 * aborts `next build` (BUG-FBE-005). Mirrors the `src/lib/referrals/types.ts` split.
 *
 * Casing: camelCase domain types, matching every other data-access layer in the repo
 * (e.g. `src/lib/queries/ethics.ts`). The plan §3 / ADR 0080 describe the raw RPC JSON
 * payloads in snake_case; the `src/lib/queries/charters.ts` layer is responsible for
 * returning these camelCase shapes (either the CH-BE-3 DEFINER RPCs emit camelCase
 * verbatim — the `get_ethics_case_procedure` precedent — or `charters.ts` maps them).
 *
 * Storage VALUES stay Portuguese by design: `meeting_frequency` is a CHECK-constrained
 * enum ({semanal,…,trimestral}, plan §2) and the cadence `status` is the ratified
 * `em_dia`/`em_atraso`/`sem_reunioes`/`sem_regimento` set (ADR 0080 D5). These are
 * contract values, not user-facing labels — the UI resolves pt-BR badge text (Rule 10).
 *
 * Bind: ADR docs/decisions/0080-committee-charters-cadence-model.md; build plan
 * docs/plans/charters-cadence.md §3. No PHI (Rule 12).
 * =======================================================================================
 */

/**
 * `commission_charters.meeting_frequency` (plan §2 CHECK). The cadence window each value
 * maps to (semanal→1 week … trimestral→3 months) is computed server-side (plan §4).
 */
export type MeetingFrequency =
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'bimestral'
  | 'trimestral'

/**
 * `meeting_cadence_status(...).status` (ADR 0080 D5). `sem_regimento` = no charter row;
 * `sem_reunioes` = a frequency is set but zero qualifying meetings (neutral, never-met);
 * `em_dia` / `em_atraso` = within / past the cadence window of the last held meeting.
 */
export type CadenceStatus =
  | 'em_dia'
  | 'em_atraso'
  | 'sem_reunioes'
  | 'sem_regimento'

/**
 * One `commission_charters` row (plan §2 / ADR 0080 D4) — a thin per-commission
 * cadence-config record that optionally links the commission's regimento controlled
 * document. `sem_regimento` = the ABSENCE of this row (there is no `null` charter).
 */
export interface CommissionCharter {
  commissionId: string
  meetingFrequency: MeetingFrequency
  /** `controlled_documents.id` of the linked `doc_type='regimento'` doc, or `null`
   * (a commission may set a cadence before it has a ratified regimento). */
  controlledDocumentId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * The `meeting_cadence_status(p_commission)` RPC return (plan §4). Computed by a DEFINER
 * over base tables (not RLS-filtered) so the indicator is consistent regardless of the
 * caller's meeting visibility; member-scoped entry (non-members are denied → the read
 * layer surfaces `null`, HC0K2).
 */
export interface MeetingCadenceStatus {
  status: CadenceStatus
  /** `max(held_at)` over the commission's held `commission_default` meetings, or `null`
   * (never met / no charter). */
  lastHeldAt: string | null
  /** The configured frequency, or `null` when `status === 'sem_regimento'`. */
  meetingFrequency: MeetingFrequency | null
}

/** One unresolved agenda item proposed for carry-forward (plan §5). */
export interface CarryForwardAgendaItem {
  title: string
  description: string | null
  /** The most-recent held `commission_default` meeting the item is carried from. */
  sourceMeetingId: string
}

/** One open meeting-sourced action item, surfaced READ-ONLY (plan §5 — never copied). */
export interface CarryForwardActionItem {
  id: string
  title: string
  /** The `action_item_statuses` key (non-terminal); the UI resolves the pt-BR label. */
  status: string
  dueDate: string | null
}

/**
 * The `suggest_carry_forward(p_commission)` RPC return (plan §5 / ADR 0080 D7) — a pure,
 * confidentiality-filtered DEFINER read (each item passes `app.can_read_action_item` so
 * `case_restricted`/hearing items never leak). Ticked agenda items are copied forward by
 * the FE via the existing `create_meeting_agenda_item`; action items are read-only.
 */
export interface CarryForwardSuggestions {
  agendaItems: CarryForwardAgendaItem[]
  actionItems: CarryForwardActionItem[]
}

/**
 * The {@link import('@/lib/queries/charters').upsertCharter} result. Discriminated union:
 * on success the persisted row; on failure a pt-BR message already resolved via
 * {@link import('@/lib/charters/messages').mapCharterError} (raw Postgres text never
 * reaches the UI — CLAUDE.md §8). The FE's `manage/charter` form consumes `ok`/`error`.
 */
export type CharterUpsertResult =
  | { ok: true; charter: CommissionCharter }
  | { ok: false; error: string }
