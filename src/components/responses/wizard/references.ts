import type { Item } from "@/lib/queries/forms";
import {
  toReferenceKind,
  type ParticipantType,
  type ReferenceCandidate,
  type ReferenceKind,
} from "@/lib/forms/reference-constants";

/**
 * FF-5 (ADR 0091) — the wizard's ENTITY-REFERENCE state, kept pure so
 * `use-wizard`, the collectors, the validators and the read-only summaries share
 * one shape (the same discipline `instances.ts` and `matrix` already follow).
 *
 * A `reference` item answers with EXACTLY ONE target (ruling 9): the payload is
 * a single `answer_references` row keyed by `answer_id`, not a selection set. It
 * carries no scalar `answers.value`, so — exactly like a matrix — it is
 * ANSWERABLE but not an INPUT item, it never enters the condition `AnswerMap`
 * (ruling 5), and every "is this answered?" check must dispatch on TYPE rather
 * than read `value`.
 */

/**
 * One saved/in-flight reference answer.
 *
 * The `label`/`sublabel` are carried on the client purely so the picker can
 * render what was chosen without a round trip. They are NOT the stored answer
 * and are never sent back: ruling 4 resolves labels by LIVE JOIN, never from a
 * snapshot, and aggregation keys on {@link targetId} alone. A stale label here
 * lives exactly as long as one page view.
 */
export interface ReferenceAnswerRecord extends ReferenceCandidate {
  /**
   * The lane this answer belongs to. The only field a saved answer adds to a
   * CANDIDATE — which is exactly how `ReferenceAnswer` is defined on the query
   * side, so extending the shared candidate type here keeps the client and the
   * read layer structurally identical rather than merely similar.
   */
  kind: ReferenceKind;
}

/**
 * One SCOPE's reference answers, keyed by item id.
 *
 * `null` is MEANINGFUL and distinct from an absent key, mirroring the matrix
 * REPLACE contract: an explicit `null` means "the filler cleared this one, write
 * the clear", while an absent key means "untouched, leave whatever is saved".
 * Collapsing the two would make clearing a reference a silent no-op.
 */
export type ReferenceState = Record<string, ReferenceAnswerRecord | null>;

/** The candidate rows the search action returns, as the picker consumes them.
 *  An alias, not a redeclaration: one shape, one owner. */
export type ReferenceCandidateRow = ReferenceCandidate;

/**
 * The lane a reference item reads from. An absent or unrecognised config falls
 * back to `participant`, matching the column default the server applies — a
 * block authored before the lane picker existed must render as a working field,
 * not a broken one. Narrowing goes through the shared `toReferenceKind` so the
 * client cannot accept a lane the CHECK constraint would refuse.
 */
export function referenceKindOf(item: Item): ReferenceKind {
  return toReferenceKind(item.config?.referenceKind) ?? "participant";
}

/**
 * The allowed `participant_type`s for a participant-lane item — `null` meaning
 * "every type", which is what both an absent key and an empty array mean to the
 * server. Normalized to `null` here so no consumer has to test for both.
 */
export function participantTypesOf(item: Item): ParticipantType[] | null {
  const types = item.config?.participantTypes;
  if (types == null || types.length === 0) return null;
  return types;
}

/** Whether this scope holds a reference answer for the item. */
export function hasReference(
  references: ReferenceState | undefined,
  itemId: string,
): boolean {
  return references?.[itemId] != null;
}

/**
 * Whether ANY reference answer is present in a scope — the emptiness arm
 * `instances.ts` needs.
 *
 * ⚠ Not cosmetic, and the reason it exists as a named function: a reference
 * answer's payload lives in `answer_references` with `answers.value` NULL, so an
 * instance whose only content is a reference looks EMPTY to a value-only test.
 * `submit_response` would then prune it and cascade the reference away — the
 * blindness ADR 0091 ruling 6 exists to close, and the exact shape FF-2 hit with
 * matrix cells before it.
 */
export function hasAnyReference(references: ReferenceState | undefined): boolean {
  if (!references) return false;
  return Object.values(references).some((rec) => rec != null);
}
