import type { ConditionTarget, InputItemType, Section } from "@/lib/queries/forms";

/**
 * Client-side computation of the eligible `visible_when` targets for a section
 * or a question, from the in-memory builder tree. The TS twin of the server's
 * `conditionTargets` / `questionConditionTargets` (`src/lib/queries/forms.ts`),
 * declared HERE as a pure module so the client builder dialogs never
 * value-import the server-only query module (which would drag `next/headers`
 * into the bundle — the design-system client/server boundary rule).
 *
 * A target is an input question STRICTLY EARLIER in document order (decision #6:
 * an earlier section, OR an earlier item in the same section) of an eligible
 * type (choice + number/date/time; `free_text`/`short_text` excluded — no
 * discrete or ordered value to compare). Publish-time `validate_visible_when`
 * remains the server authority on forward/self refs and operator↔type
 * compatibility; this only narrows what the UI offers so an author can only
 * build a structurally valid condition.
 */

/** Input types a condition may TARGET (decision #7). Declared locally to keep
 *  this a pure, server-free module (mirrors `CONDITION_TARGET_TYPES`). */
const CONDITION_TARGET_TYPES: readonly InputItemType[] = [
  "multiple_choice",
  "dropdown",
  "checkbox",
  "number",
  "date",
  "time",
];

function isEligibleTarget(itemType: string): itemType is InputItemType {
  return CONDITION_TARGET_TYPES.includes(itemType as InputItemType);
}

/** Map an eligible input item to a {@link ConditionTarget} (label strings out
 *  of `ItemOption[]`; number/date/time carry `options: []`). */
function toTarget(
  item: Section["items"][number],
  sectionPosition: number,
): ConditionTarget {
  return {
    questionKey: item.questionKey as string,
    label: item.label ?? (item.questionKey as string),
    sectionPosition,
    type: item.itemType as InputItemType,
    options: (item.options ?? []).map((o) => o.label),
  };
}

/**
 * SECTION targets: eligible input questions in STRICTLY-EARLIER sections (lower
 * position), in document order. `sections` is the full ordered tree;
 * `sectionId` is the section being edited.
 */
export function sectionConditionTargets(
  sections: Section[],
  sectionId: string,
): ConditionTarget[] {
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return [];
  return sections.slice(0, idx).flatMap((s) =>
    s.items
      .filter((it) => isEligibleTarget(it.itemType) && it.questionKey != null)
      .map((it) => toTarget(it, s.position)),
  );
}

/**
 * QUESTION targets for an EXISTING item: eligible inputs strictly earlier in
 * document order — every item of an earlier section, plus the earlier items of
 * the item's own section (decision #6).
 */
export function questionConditionTargets(
  sections: Section[],
  sectionId: string,
  itemId: string,
): ConditionTarget[] {
  const sectionIdx = sections.findIndex((s) => s.id === sectionId);
  if (sectionIdx < 0) return [];
  const ownSection = sections[sectionIdx];
  const itemIdx = ownSection.items.findIndex((it) => it.id === itemId);

  // Earlier sections (all their items).
  const earlierSections = sections.slice(0, sectionIdx).flatMap((s) =>
    s.items
      .filter((it) => isEligibleTarget(it.itemType) && it.questionKey != null)
      .map((it) => toTarget(it, s.position)),
  );

  // Earlier items in the OWN section (only if the item was found).
  const earlierInSection =
    itemIdx < 0
      ? []
      : ownSection.items
          .slice(0, itemIdx)
          .filter((it) => isEligibleTarget(it.itemType) && it.questionKey != null)
          .map((it) => toTarget(it, ownSection.position));

  return [...earlierSections, ...earlierInSection];
}

/**
 * QUESTION targets for a NEW (not-yet-created) item being ADDED to a section:
 * the item will be appended at the END, so EVERY existing eligible input in its
 * section and all earlier sections is strictly earlier.
 */
export function newQuestionConditionTargets(
  sections: Section[],
  sectionId: string,
): ConditionTarget[] {
  const sectionIdx = sections.findIndex((s) => s.id === sectionId);
  if (sectionIdx < 0) return [];
  return sections.slice(0, sectionIdx + 1).flatMap((s) =>
    s.items
      .filter((it) => isEligibleTarget(it.itemType) && it.questionKey != null)
      .map((it) => toTarget(it, s.position)),
  );
}
