import type { AnswerMap } from "@/lib/queries/conditions";
import { evalVisibility, overlayAnswerMap } from "@/lib/queries/conditions";
import type { InputItemType, Item, Section } from "@/lib/queries/forms";

/**
 * The document-order visibility forward pass — the EXACT mirror of the backend
 * `submit_response` pass (ARCHITECTURE Rule 3). A PURE module (no React, no
 * `"use client"`, no server-only imports) so BOTH the client wizard
 * (`use-wizard.ts`) and the Server-Component read views (`submission-detail-view`,
 * `review-and-sign`) share one evaluator-driven pass — no drift, no
 * client/server boundary cost.
 */

// Declared locally so this stays a pure, dependency-free module (kept in lockstep
// with `INPUT_ITEM_TYPES` in `forms.ts` — the eight input item types).
const INPUT_ITEM_TYPES: readonly InputItemType[] = [
  "multiple_choice",
  "dropdown",
  "checkbox",
  "free_text",
  "short_text",
  "number",
  "date",
  "time",
];
const INPUT_TYPES = new Set<string>(INPUT_ITEM_TYPES);

/** The three CHOICE input types (kept in lockstep with `CHOICE_ITEM_TYPES` in
 *  `forms.ts`) — the ones whose answer is a selection of option CODEs
 *  (form-model-normalization), persisted via `saveSection`'s `selectionsByItemId`
 *  rather than `answersByItemId`. Declared locally to keep this module pure. */
const CHOICE_TYPES = new Set<string>(["multiple_choice", "dropdown", "checkbox"]);

/** FF-2 — the two MATRIX types (kept in lockstep with `MATRIX_ITEM_TYPES` in
 *  `item-tree.ts`; declared locally to keep this module pure). */
const MATRIX_TYPES = new Set<string>(["matrix", "risk_matrix"]);

/** FF-5 (ADR 0091) — the ENTITY REFERENCE type. Like a matrix, it is answerable
 *  but has no scalar `answers.value`, and (ruling 5) it is deliberately NOT a
 *  condition target — reference answers never enter `app.answer_map`, so nothing
 *  here ever contributes or drops a key for one. */
const REFERENCE_TYPES = new Set<string>(["reference"]);

/** True for items that collect an answer (input items, not display or container
 *  blocks). A container collects no answer of its own.
 *
 *  ⚠ FF-2: this deliberately stays FALSE for `matrix`/`risk_matrix`. It means
 *  "the answer is a scalar in `answers.value`", and a dozen call sites depend on
 *  exactly that — the value plumbing, the condition-target picker, the orphan
 *  detector. A matrix answers in `answer_matrix_cells` instead. Use
 *  {@link isAnswerableItem} where the question is "does this item produce an
 *  answer at all?". */
export function isInputItem(itemType: string): boolean {
  return INPUT_TYPES.has(itemType);
}

/** True for `matrix` / `risk_matrix`. */
export function isMatrixItem(itemType: string): boolean {
  return MATRIX_TYPES.has(itemType);
}

/** True for `reference` (FF-5). Its answer is an `answer_references` row, so —
 *  exactly like a matrix — every "is this answered?" test must dispatch on TYPE
 *  rather than read `value`, which is NULL for it by design. */
export function isReferenceItem(itemType: string): boolean {
  return REFERENCE_TYPES.has(itemType);
}

/** True for every item that PRODUCES an answer — the scalar inputs, the two
 *  matrix types, and FF-5's reference. The client twin of
 *  `ANSWERABLE_ITEM_TYPES` in `queries/forms.ts`. */
export function isAnswerableItem(itemType: string): boolean {
  return (
    INPUT_TYPES.has(itemType) ||
    MATRIX_TYPES.has(itemType) ||
    REFERENCE_TYPES.has(itemType)
  );
}

/** True for the choice input types (multiple_choice / dropdown / checkbox) whose
 *  answer is a set of option CODEs (form-model-normalization). */
export function isChoiceItem(itemType: string): boolean {
  return CHOICE_TYPES.has(itemType);
}

/**
 * The result of one document-order visibility pass: the section and input-item
 * ids currently visible, and the effective answer map (hidden controllers'
 * keys dropped).
 */
export interface EffectiveVisibility {
  visibleSectionIds: Set<string>;
  visibleItemIds: Set<string>;
  /**
   * FF-1 — the CONTAINER ids currently visible. A hidden container hides every
   * child with it, and (ruling 3, by the precedent
   * `app.response_required_complete` already applies to sections and items) a
   * hidden group requires nothing — not even its `minInstances`.
   */
  visibleContainerIds: Set<string>;
  /** The answer map after dropping hidden sections'/items' keys. */
  effectiveMap: AnswerMap;
}

/**
 * Walk sections in document order over an effective answer map (seeded from
 * `answerMap`):
 *   - if a section is HIDDEN under the effective map, it (and all its items) are
 *     excluded and EVERY one of its input keys is dropped from the map, so a
 *     later condition sees them absent;
 *   - if a section is VISIBLE, its items are walked in position order: a hidden
 *     item is excluded and its key dropped; a visible item stays.
 * Refs are strictly-earlier in document order, so one forward pass resolves all
 * cascades. Section AND item visibility use the group-safe `evalVisibility`.
 *
 * FF-1 (ADR 0087) adds the two CONTAINER types, which split the walk in two:
 *   - a plain `group`'s children answer at TOP LEVEL (ruling 6), so they are
 *     walked here exactly like flat items — same map, same key drops. That is
 *     also why a plain group's child keys stay legal condition targets.
 *   - a `repeating_group`'s children live in INSTANCES; their keys never appear
 *     in the top-level map at all, so they are deliberately NOT walked here.
 *     Per-instance visibility is {@link computeInstanceVisibility}, evaluated
 *     against the 2-tier overlay map (ruling 2, inside-out).
 * Either way, a hidden container contributes no key and no visible child.
 */
export function computeEffectiveVisibility(
  sections: Section[],
  answerMap: AnswerMap,
): EffectiveVisibility {
  const effectiveMap: AnswerMap = { ...answerMap };
  const visibleSectionIds = new Set<string>();
  const visibleItemIds = new Set<string>();
  const visibleContainerIds = new Set<string>();

  const dropItemKey = (item: Item) => {
    if (item.questionKey != null) delete effectiveMap[item.questionKey];
  };

  /** Drop an item's key and, for a plain group, its children's keys too. A
   *  repeating group's children never contribute a top-level key. */
  const dropSubtreeKeys = (item: Item) => {
    if (isInputItem(item.itemType)) dropItemKey(item);
    if (item.itemType === "group") {
      for (const child of item.children) {
        if (isInputItem(child.itemType)) dropItemKey(child);
      }
    }
  };

  /**
   * FF-2 — decide one ANSWERABLE item's visibility. Matrix items take part in
   * `visibleItemIds` exactly like scalar inputs (a hidden matrix collects
   * nothing, requires nothing and is not saved), but they never contribute a key
   * to the effective map: a matrix has `answers.value` NULL by design and is not
   * a condition target, so there is no key to drop when it hides.
   *
   * FF-5's `reference` behaves identically here and for the same two reasons —
   * NULL `value`, not a condition target (ruling 5). The `isInputItem` guard on
   * the drop is therefore already correct for it, unchanged.
   */
  const walkAnswerable = (item: Item) => {
    if (evalVisibility(item.visibleWhen, effectiveMap)) {
      visibleItemIds.add(item.id);
    } else if (isInputItem(item.itemType)) {
      dropItemKey(item);
    }
  };

  for (const section of sections) {
    if (!evalVisibility(section.visibleWhen, effectiveMap)) {
      for (const item of section.items) dropSubtreeKeys(item);
      continue;
    }
    visibleSectionIds.add(section.id);
    for (const item of section.items) {
      const isContainer =
        item.itemType === "group" || item.itemType === "repeating_group";

      if (isContainer) {
        if (!evalVisibility(item.visibleWhen, effectiveMap)) {
          dropSubtreeKeys(item);
          continue;
        }
        visibleContainerIds.add(item.id);
        // A plain group is transparent: its children are ordinary top-level
        // items in the same ordinal space. A repeating group's children are
        // per-instance and are handled by computeInstanceVisibility.
        if (item.itemType === "group") {
          for (const child of item.children) {
            if (!isAnswerableItem(child.itemType)) continue;
            walkAnswerable(child);
          }
        }
        continue;
      }

      if (!isAnswerableItem(item.itemType)) continue;
      walkAnswerable(item);
    }
  }

  return { visibleSectionIds, visibleItemIds, visibleContainerIds, effectiveMap };
}

/**
 * FF-1 (ADR 0087 ruling 2, inside-out) — the visible child items of ONE
 * repeating-group instance.
 *
 * The evaluation map is the response's TOP-LEVEL effective map overlaid with
 * this instance's own answers, composed by the parity-locked `overlayAnswerMap`
 * (the pure TS half of the rule; the SQL mirror is `app.overlay_answer_map`).
 * A same-instance sibling therefore WINS, and a key this instance has not
 * answered is ABSENT — never a fallback to another instance's value.
 *
 * `baseMap` must already be the EFFECTIVE map from
 * {@link computeEffectiveVisibility} (hidden controllers dropped), so a child
 * condition sees a hidden outer controller as absent exactly as the server does.
 */
export function computeInstanceVisibility(
  container: Item,
  baseMap: AnswerMap,
  instanceAnswers: AnswerMap,
): Set<string> {
  const map = overlayAnswerMap(baseMap, instanceAnswers);
  const visible = new Set<string>();
  for (const child of container.children) {
    // FF-2: a matrix INSIDE a repeating group is per-instance like any other
    // answerable child, so it must take part in this set or it would render in
    // no instance at all.
    if (!isAnswerableItem(child.itemType)) continue;
    if (evalVisibility(child.visibleWhen, map)) {
      visible.add(child.id);
    } else if (isInputItem(child.itemType) && child.questionKey != null) {
      // A hidden child's key must not leak into a LATER same-instance sibling's
      // condition — the same forward-pass drop the top-level walk performs.
      delete map[child.questionKey];
    }
  }
  return visible;
}
