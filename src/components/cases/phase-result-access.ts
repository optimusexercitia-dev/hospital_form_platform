import type { CasePhaseStatus } from "@/lib/queries/cases";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";

/**
 * Per-PHASE authority for setting a case phase's result — the UI mirror of
 * `public.set_case_phase_result_override` (`prosecdef = t`).
 *
 * ⛔ THE DOOR IS TWO BRANCHES, NOT ONE GUARD. Measured from the live catalog
 * (`pg_get_functiondef`, 2026-08-22 — never from the migration text, which this
 * repo rewrites at runtime):
 *
 * ```
 *   if v_phase_status not in ('active','completed') then raise HC057   -- nobody
 *   if v_phase_status = 'active' then
 *       if not (v_assigned_to = auth.uid() or v_is_staff_admin) then raise 42501
 *   else                                                              -- completed
 *       if not v_is_staff_admin then raise 42501
 *       if v_case_status in ('completed','cancelled') then raise HC060
 * ```
 *
 * So the admitted set is:
 *   - `active`    → the phase's OWN assignee ∨ coordinator (`app.is_staff_admin_of`);
 *   - `completed` → coordinator only, AND the case must be non-terminal;
 *   - `pending` / `not_required` / `voided` → nobody.
 *
 * ⛔ There is **no `member_can` arm**, so an *administrativo* is refused by the
 * door and must never be offered the affordance. The obvious widening — adding a
 * capability arm — would make this mirror WIDER than its door, the defect this
 * program has already closed twice (`canInCommission`; a rejected reading of ADR
 * 0134 Amendment 5).
 *
 * ⚠ The assignee disjunct is per-PHASE. That is why this cannot be a per-case
 * boolean — the finding recorded as FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT:
 * the old `canManagePhaseResults` prop could express only the coordinator arm, so
 * an active phase's assignee was offered nothing on the case-detail surface.
 */

/**
 * What the result affordance on ONE phase row is, for ONE viewer.
 *
 * A KIND rather than a boolean on purpose: the two admitted branches are
 * different acts with different copy — `set` PRE-STASHES the result an `active`
 * phase will conclude with (the door does not recompute), while `correct` is the
 * after-the-fact correction of a `completed` phase (the door recomputes and
 * re-flips downstream recommendations). Collapsing them to `true` is what loses
 * the distinction the door draws.
 */
export type PhaseResultAffordance = "none" | "set" | "correct";

/**
 * The per-CASE half of the authority, resolved once by the host page. `null`
 * means the affordance is off entirely — the `case_phase_results` flag is off, or
 * this is a READING surface (`/casos`), which passes nothing (ADR 0134 D2).
 *
 * The per-PHASE half (`status`, `assignedTo`) and the viewer identity are NOT in
 * here — they are read from server state at the point of use, so the affordance
 * can never be derived from a client-side assumption about who the viewer is.
 */
export interface PhaseResultGate {
  /**
   * Whether the viewer is a COORDINATOR of the case's commission — the mirror of
   * the door's `app.is_staff_admin_of` arm, i.e. a MEMBERSHIP `staff_admin`.
   * ⛔ NOT `canManageLifecycle` and NOT `canInCommission`: both are wider than
   * this door, which has no capability arm at all.
   */
  isCoordinator: boolean;
  /**
   * The commission's live ACTIVE result vocabulary — the picker's source. Read
   * RLS-scoped by the host; `phase_results_select` is `app.is_member_of`, so a
   * plain-member assignee can read it (no dead-end on the data side).
   */
  options: ResolvedPhaseResult[];
}

/**
 * Which result affordance ONE phase offers ONE viewer — the exact mirror of the
 * door above (NOT the security boundary; the RPC re-checks server-side, Rule 1).
 *
 * Argument order mirrors the house precedent `canEditNarrative(narrative, caps,
 * caseOpen, viewerId)`.
 *
 * @param phase     the phase's SERVER state — `status` and `assignedTo`.
 * @param gate      the per-case authority, or `null` when the affordance is off.
 * @param caseOpen  whether the case is non-terminal. Applied to the `completed`
 *                  branch ONLY, because that is the only branch the door gates on
 *                  it (HC060). The `active` branch is deliberately NOT narrowed by
 *                  it: measured, `close_case` and `cancel_case` both sweep every
 *                  `pending`/`active` phase to `not_required` in the same
 *                  transaction, so "terminal case with an active phase" is
 *                  unreachable — and adding a narrowing the door does not have is
 *                  how an under-grant gets re-introduced.
 * @param viewerId  the current user id from the SESSION, or `null` if unknown —
 *                  in which case the assignee arm can never fire.
 */
export function phaseResultAffordance(
  phase: { status: CasePhaseStatus; assignedTo: string | null },
  gate: PhaseResultGate | null,
  caseOpen: boolean,
  viewerId: string | null,
): PhaseResultAffordance {
  if (gate === null) return "none";

  if (phase.status === "active") {
    // `v_assigned_to = auth.uid()`: SQL yields NULL (not true) on an unassigned
    // phase, so an unassigned active phase is coordinator-only. The `viewerId`
    // null-guard is what reproduces that — without it, `null === null` would
    // hand the affordance to an anonymous viewer on every unassigned phase.
    const isAssignee = viewerId !== null && phase.assignedTo === viewerId;
    return gate.isCoordinator || isAssignee ? "set" : "none";
  }

  if (phase.status === "completed") {
    // No assignee arm on this branch — the door falls through to coordinator-only
    // once the phase is `completed`, and additionally requires a non-terminal case.
    if (!gate.isCoordinator) return "none";
    return caseOpen ? "correct" : "none";
  }

  // `pending` / `not_required` / `voided` — the door's first guard raises HC057
  // for everybody, coordinator included.
  return "none";
}
