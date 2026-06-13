import type {
  ProcessTemplatePhase,
  PhaseConditionTarget,
} from "@/lib/queries/process-templates";

/**
 * A template phase-slot augmented (client-side) with the CHOICE-question targets
 * of its bound form's published version. The targets are resolved server-side by
 * `phaseConditionTargets` (RLS-scoped, server-only) and attached in the builder
 * page, so the `recommend_when` editor — a pure client component — can offer a
 * question + value picker for an EARLIER phase with no per-keystroke round trip.
 *
 * Kept separate from the backend `ProcessTemplatePhase` type (which carries no
 * UI-only fields) so we never mutate or re-declare the contract shape.
 */
export type PhaseWithTargets = ProcessTemplatePhase & {
  conditionTargets: PhaseConditionTarget[];
};

/** Attach each phase's bound-form targets from a `{ formId -> targets }` map. */
export function attachTargets(
  phases: ProcessTemplatePhase[],
  byForm: Record<string, PhaseConditionTarget[]>,
): PhaseWithTargets[] {
  return phases.map((p) => ({
    ...p,
    conditionTargets: byForm[p.formId] ?? [],
  }));
}
