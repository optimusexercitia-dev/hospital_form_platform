import type {
  PhaseResult,
  PhaseResultColorToken,
  ResolvedPhaseResult,
} from "@/lib/queries/phase-results";
import type { TimelinePhaseResult } from "@/lib/timeline/event-model";

/**
 * Map a commission's RESULT VOCABULARY ({@link PhaseResult}[], from
 * `listPhaseResults`) to the {@link ResolvedPhaseResult}[] shape the result
 * pickers consume (the post-conclusion correction dialog + the wizard override
 * panel). A plain vocabulary OPTION is not yet an effective result, so its
 * `source` is `null` (the badge's "manual" marker is driven by an effective
 * result's `source`, not by a picker option). Pure + client-safe — no value-import
 * of a server-only module.
 */
export function toResolvedPhaseResultOptions(
  results: PhaseResult[],
): ResolvedPhaseResult[] {
  return results.map((r) => ({
    id: r.id,
    label: r.label,
    colorToken: r.colorToken,
    isAdverse: r.isAdverse,
    source: null,
  }));
}

/** The result MODE of a case phase as it bears on the correction picker. */
export type PhaseCorrectionMode = "automatic" | "manual" | "none";

/** What the post-conclusion correction picker should offer for one phase. */
export interface PhaseCorrectionOptions {
  /**
   * `automatic` — full active vocabulary, clearable (revert to the computed
   * result); `manual` — only the phase's allowed subset, NOT clearable (a manual
   * result is mandatory); `none` — the phase emits no result, so no correction is
   * offered.
   */
  mode: PhaseCorrectionMode;
  /** The options the picker lists (`[]` for `none`). */
  options: ResolvedPhaseResult[];
  /** Whether the picker may CLEAR the result (`automatic` only). */
  allowClear: boolean;
}

/**
 * Resolve which result options the POST-CONCLUSION correction picker should offer
 * for one case phase (phase-result-manual-mode). The mirror of the wizard-side
 * `loadPhaseResultContext` subset logic, but PURE + client-safe (the active
 * vocabulary is loaded by the host page and passed in):
 *   - non-emitting phase → `none` (no result to correct);
 *   - MANUAL phase (`manualResultIds` set) → the author-selected allowed subset,
 *     resolved + ordered against the live ACTIVE vocabulary (a since-archived id
 *     is dropped), NOT clearable — so the staff_admin can only pick an option the
 *     server (`set_case_phase_result_override`) accepts, never tripping HC058;
 *   - AUTOMATIC phase → the full active vocabulary, clearable.
 */
export function resolvePhaseCorrectionOptions(
  phase: { emitsResult: boolean; manualResultIds: string[] | null },
  activeVocabulary: ResolvedPhaseResult[],
): PhaseCorrectionOptions {
  if (!phase.emitsResult) {
    return { mode: "none", options: [], allowClear: false };
  }
  if (phase.manualResultIds != null) {
    const byId = new Map(activeVocabulary.map((o) => [o.id, o]));
    const options = phase.manualResultIds
      .map((id) => byId.get(id))
      .filter((o): o is ResolvedPhaseResult => o != null);
    return { mode: "manual", options, allowClear: false };
  }
  return { mode: "automatic", options: activeVocabulary, allowClear: true };
}

/**
 * Adapt a {@link TimelinePhaseResult} (the timeline event-model's inline mirror,
 * which widens `colorToken` to a loose `string` to keep that module dependency-pure)
 * to the {@link ResolvedPhaseResult} the result badge renders. The two are otherwise
 * identical. The `colorToken` cast is safe: {@link PhaseResultBadge} resolves an
 * unknown token to the `muted` fallback via the shared palette map, so a value
 * outside the constrained set can never throw.
 */
export function timelineResultToResolved(
  result: TimelinePhaseResult,
): ResolvedPhaseResult {
  return {
    id: result.id,
    label: result.label,
    colorToken: result.colorToken as PhaseResultColorToken,
    isAdverse: result.isAdverse,
    source: result.source,
  };
}
