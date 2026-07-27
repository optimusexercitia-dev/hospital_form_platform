import type { ConditionTarget, Item, InputItemType, Section } from "@/lib/queries/forms";
import { isRepeatingGroup } from "@/lib/forms/item-tree";

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
 *
 * FF-1 (ADR 0087 ruling 2) adds the CONTAINER dimension, and it makes the target
 * list a function of the ITEM being edited — not of its section alone:
 *   - **Outside-in is forbidden.** A `question_key` belonging to a child of a
 *     `repeating_group` is never offered to anything outside that group: with N
 *     instances there is no single value to compare. Publish-time
 *     `validate_visible_when` is the authority; this stops an author building the
 *     condition in the first place.
 *   - **Inside-out resolves.** A child of a `repeating_group` MAY target an
 *     earlier same-instance sibling, which resolves against the instance overlay
 *     map (`overlayAnswerMap`).
 *   - A plain `group`'s children answer at TOP LEVEL (ruling 6), so their keys
 *     are unambiguous and stay ordinary targets everywhere.
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

/** Map an eligible input item to a {@link ConditionTarget}. form-model-
 *  normalization: a choice target exposes `{ code, label }` per option — the
 *  condition STORES the `code` (clone-stable identity the evaluator keys on)
 *  while the picker SHOWS the `label`. number/date/time carry `options: []`. */
function toTarget(item: Item, sectionPosition: number): ConditionTarget {
  return {
    questionKey: item.questionKey as string,
    label: item.label ?? (item.questionKey as string),
    sectionPosition,
    type: item.itemType as InputItemType,
    options: (item.options ?? []).map((o) => ({ code: o.code, label: o.label })),
  };
}

/**
 * One item in the tree's DOCUMENT order, annotated with the scope facts ruling 2
 * needs: which section it belongs to and, when it is a child of a
 * `repeating_group`, that group's id (`null` for a top-level item OR a child of
 * a plain `group` — both answer at top level and are unrestricted targets).
 */
interface WalkEntry {
  item: Item;
  sectionPosition: number;
  /** The owning `repeating_group`'s id, or null when outside every repeating group. */
  repeatingParentId: string | null;
}

/**
 * The whole tree flattened into document order: sections by position, and within
 * a section each top-level item followed immediately by its children (the same
 * order their contiguous `form_items.position` slots hold). Depth is capped at 1
 * (ruling 1), so one pass is exhaustive.
 */
function walk(sections: Section[]): WalkEntry[] {
  const entries: WalkEntry[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      entries.push({
        item,
        sectionPosition: section.position,
        repeatingParentId: null,
      });
      const repeatingParentId = isRepeatingGroup(item.itemType) ? item.id : null;
      for (const child of item.children) {
        entries.push({
          item: child,
          sectionPosition: section.position,
          repeatingParentId,
        });
      }
    }
  }
  return entries;
}

/**
 * Turn the entries STRICTLY BEFORE `cutoff` into targets, applying ruling 2's
 * scope rule from the perspective of a referencing item that lives inside
 * `viewerRepeatingId` (`null` = outside every repeating group).
 *
 * `cutoff` is an index into {@link walk}'s output; `0` means "nothing is
 * earlier" and yields `[]`, while `entries.length` means "everything is".
 */
function targetsBefore(
  entries: WalkEntry[],
  cutoff: number,
  viewerRepeatingId: string | null,
): ConditionTarget[] {
  if (cutoff <= 0) return [];
  return entries
    .slice(0, cutoff)
    .filter((entry) => {
      if (!isEligibleTarget(entry.item.itemType)) return false;
      if (entry.item.questionKey == null) return false;
      // Outside-in is forbidden; inside-out (same repeating group) resolves.
      if (entry.repeatingParentId === null) return true;
      return entry.repeatingParentId === viewerRepeatingId;
    })
    .map((entry) => toTarget(entry.item, entry.sectionPosition));
}

/**
 * SECTION targets: eligible input questions in STRICTLY-EARLIER sections (lower
 * position), in document order. `sections` is the full ordered tree;
 * `sectionId` is the section being edited. A section always sits outside every
 * repeating group, so a repeating-group child's key is never offered here
 * (ruling 2 outside-in).
 */
export function sectionConditionTargets(
  sections: Section[],
  sectionId: string,
): ConditionTarget[] {
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return [];
  const entries = walk(sections);
  const own = sections[idx];
  const cutoff = entries.findIndex((e) => e.sectionPosition >= own.position);
  return targetsBefore(entries, cutoff < 0 ? entries.length : cutoff, null);
}

/**
 * QUESTION targets for an EXISTING item: eligible inputs strictly earlier in
 * document order — every item of an earlier section, plus the earlier items of
 * the item's own section (decision #6), narrowed by ruling 2's container scope.
 *
 * `itemId` may name a top-level item OR a container child; the scope is derived
 * from where that item actually sits, which is why the answer depends on the
 * item and not on its section alone.
 */
export function questionConditionTargets(
  sections: Section[],
  sectionId: string,
  itemId: string,
): ConditionTarget[] {
  if (!sections.some((s) => s.id === sectionId)) return [];
  const entries = walk(sections);
  const idx = entries.findIndex((e) => e.item.id === itemId);
  if (idx < 0) return [];
  return targetsBefore(entries, idx, entries[idx].repeatingParentId);
}

/**
 * QUESTION targets for a NEW (not-yet-created) item being ADDED to a section at
 * TOP LEVEL: it appends at the END of the section, so every existing eligible
 * input in its section and all earlier sections is strictly earlier. Being
 * top-level, it may not reference any repeating-group child (ruling 2).
 */
export function newQuestionConditionTargets(
  sections: Section[],
  sectionId: string,
): ConditionTarget[] {
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return [];
  const entries = walk(sections);
  const nextSection = sections[idx + 1];
  const cutoff = nextSection
    ? entries.findIndex((e) => e.sectionPosition >= nextSection.position)
    : -1;
  return targetsBefore(entries, cutoff < 0 ? entries.length : cutoff, null);
}

/**
 * FF-1 — QUESTION targets for a NEW child being ADDED to the container
 * `parentItemId`: the child appends as that container's LAST child, so
 * everything up to and including the container's existing children is earlier.
 *
 * When the container is a `repeating_group`, its own earlier children ARE
 * offered (inside-out, same-instance siblings) while every OTHER repeating
 * group's children are not. When it is a plain `group`, its children answer at
 * top level and the scope is the ordinary one.
 */
export function newChildConditionTargets(
  sections: Section[],
  parentItemId: string,
): ConditionTarget[] {
  const entries = walk(sections);
  const parentIdx = entries.findIndex((e) => e.item.id === parentItemId);
  if (parentIdx < 0) return [];
  const parent = entries[parentIdx].item;
  const viewerRepeatingId = isRepeatingGroup(parent.itemType) ? parent.id : null;
  // The container itself is not a target (it holds no answer); its children
  // occupy the slots immediately after it, and all of them precede the new one.
  return targetsBefore(
    entries,
    parentIdx + 1 + parent.children.length,
    viewerRepeatingId,
  );
}
