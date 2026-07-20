import 'server-only'

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
 * ============================ CONTRACT-FIRST STUB (CH-BE-1) ============================
 * The exported SIGNATURES + the imported domain types (`src/lib/charters/types.ts`) are
 * the frozen contract `frontend` builds against — do NOT change a signature without
 * telling the lead so `frontend` can adapt. Bodies `throw` a "not implemented (CH-BE-5)"
 * error until the CH-BE-2..BE-4 migrations land and CH-BE-5 wires them: the RPC names
 * (`upsert_commission_charter`, `meeting_cadence_status`, `suggest_carry_forward`) and
 * the `commission_charters` relation do not yet exist in the generated `database.ts`
 * (Rule 8), so calling `.rpc(...)` / `.from(...)` here now would fail `tsc`. CH-BE-5
 * fills the bodies (client factory + camelCase mapping + `mapCharterError` for the write)
 * AFTER regenerating types.
 *
 * ⛔ CH-BE-5 catalog note: re-verify every RPC/predicate name against the LIVE catalog
 * before wiring (the MEM §6.1 collapse renamed the `is_*_of` family to `has_role()`
 * shims; CLAUDE.md graphify exception — migration text is stale by design).
 *
 * Bind: ADR docs/decisions/0080-committee-charters-cadence-model.md; build plan
 * docs/plans/charters-cadence.md §3. Gated behind the `charters` flag (OFF pre-pilot).
 * No PHI (Rule 12). Client Components import the shapes from `@/lib/charters/types`
 * (this module is `server-only`).
 * =======================================================================================
 */

const NOT_IMPLEMENTED = 'not implemented (CH-BE-5)'

/**
 * The commission's charter row, or `null` when none is configured (`sem_regimento`) /
 * the caller cannot read it. Backed by the `commission_charters` member-read RLS
 * (SELECT `app.is_member_of(commission_id)`; plan §2).
 */
export async function getCharter(
  _commissionId: string,
): Promise<CommissionCharter | null> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Create or update the commission's charter (frequency + optional regimento link).
 * Sole write door = the `upsert_commission_charter` DEFINER RPC (staff_admin authority,
 * HC0K0; valid regimento link or HC0K1). Returns a discriminated result — on failure a
 * pt-BR message already resolved via `mapCharterError` (`@/lib/charters/messages`).
 */
export async function upsertCharter(
  _commissionId: string,
  _meetingFrequency: MeetingFrequency,
  _controlledDocumentId?: string | null,
): Promise<CharterUpsertResult> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * The commission's cadence-adherence status (plan §4). Backed by the DEFINER
 * `meeting_cadence_status(p_commission)` RPC (member-scoped, HC0K2; computed over base
 * tables, not the RLS-filtered visible-meeting list). `null` when the caller is not a
 * member of the commission (or on error) — the FE simply omits the indicator.
 */
export async function getMeetingCadenceStatus(
  _commissionId: string,
): Promise<MeetingCadenceStatus | null> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Carry-forward suggestions for the schedule-meeting flow (plan §5): unresolved agenda
 * items + open meeting-sourced action items from the most-recent held `commission_default`
 * meeting, confidentiality-filtered. Pure read via the `suggest_carry_forward(p_commission)`
 * DEFINER RPC (member-scoped, HC0K2). Empty lists on error / no member authority.
 */
export async function getCarryForwardSuggestions(
  _commissionId: string,
): Promise<CarryForwardSuggestions> {
  throw new Error(NOT_IMPLEMENTED)
}
