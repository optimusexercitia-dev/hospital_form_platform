import type { CasePhaseStatus } from "@/lib/queries/cases";

/**
 * ATTRIBUTED WORK IS ACTIONABLE (ADR 0137 **D8**) — one definition of "this row is
 * mine", shared by the phase article and the narrative card.
 *
 * ⭐ This is the half of ADR 0134 **D1** that was never built. D1 reads *"the case as
 * the committee sees it, PLUS the viewer's own name-attributed work"*, and
 * `./reading-surface` documents that the assignee tests run BEFORE the capability
 * tests precisely so attributed work survives `narrowToReadingSurface`. The narrative
 * branch honoured that ({@link import('./narrative-access').canEditNarrative}); the
 * phase branch never did — {@link import('./coordinator-phase-actions').CoordinatorPhaseActions}
 * returns `null` for any viewer who is neither coordinator nor `assign_case_phases`,
 * so a `staff_admin`, an *administrativo* AND a plain member all saw an assigned
 * phase they could not open.
 *
 * ⛔ **KEYED ON IDENTITY, NEVER ON CAPABILITY.** Nothing here reads
 * `CaseViewerCapabilities`, and no caller may pass a capability-derived flag into it.
 * `narrowToReadingSurface` zeroes the CAPABILITY OBJECT, so an affordance gated on a
 * capability disappears on `/casos` — which is exactly the defect D8 closes. A prop
 * the narrowing could zero would re-introduce it one prop later (the ADR 0134 F-1
 * condition; see `./reading-surface`).
 *
 * ⚠ NOT the security boundary (Rule 1). `public.start_or_resume_phase` re-checks
 * assignment server-side and returns a pt-BR refusal to anyone else; this only decides
 * what is OFFERED.
 */

/**
 * Is `assignedTo` THIS viewer?
 *
 * The `viewerId != null` guard is the whole point of the helper. Without it
 * `null === null` hands every UN-assigned row to a viewer whose identity could not be
 * resolved — the same footgun `phaseResultAffordance` documents on its assignee
 * disjunct, where SQL's `v_assigned_to = auth.uid()` yields NULL (not true) on an
 * unassigned phase.
 */
export function isAssignedTo(
  assignedTo: string | null,
  viewerId: string | null,
): boolean {
  return viewerId != null && assignedTo === viewerId;
}

/**
 * May this viewer FILL this phase now — i.e. does the row render the primary
 * "Preencher" action ({@link import('./start-phase-button').StartPhaseButton},
 * backed by `startOrResumePhase`)?
 *
 * Argument order mirrors the house precedent `canEditNarrative(narrative, caps,
 * caseOpen, viewerId)` / `phaseResultAffordance(phase, gate, caseOpen, viewerId)`,
 * minus the capability argument, which this predicate deliberately does not take.
 *
 * @param phase    the phase's SERVER state — `status` and `assignedTo`.
 * @param caseOpen whether the case is non-terminal.
 *                 ⚠ Provably behaviour-NEUTRAL rather than a real narrowing:
 *                 `close_case` and `cancel_case` both sweep every `pending`/`active`
 *                 phase to `not_required` in the same transaction (measured — see the
 *                 `caseOpen` note in `./phase-result-access`), so "terminal case with
 *                 an `active` phase" is unreachable. Kept because a frozen case must
 *                 never offer a write, not because it changes any reachable outcome.
 * @param viewerId the current user id from the SESSION, or `null` if unknown — in
 *                 which case this can never fire.
 */
export function canFillAssignedPhase(
  phase: { status: CasePhaseStatus; assignedTo: string | null },
  caseOpen: boolean,
  viewerId: string | null,
): boolean {
  if (!caseOpen) return false;
  // Only an ACTIVE phase has a response to start or resume. `pending` is not yet
  // released to its assignee, `completed` and `awaiting_signoff` (ADR 0136) are
  // submitted and FROZEN, and `not_required`/`voided` are terminal — the door
  // (`start_or_resume_phase`, `v_status <> 'active'` → HC019) refuses all five.
  if (phase.status !== "active") return false;
  return isAssignedTo(phase.assignedTo, viewerId);
}
