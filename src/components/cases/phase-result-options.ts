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
