import type { AnswerMap } from "@/lib/queries/conditions";
import { evalVisibility } from "@/lib/queries/conditions";
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

/** True for items that collect an answer (input items, not display blocks). */
export function isInputItem(itemType: string): boolean {
  return INPUT_TYPES.has(itemType);
}

/**
 * The result of one document-order visibility pass: the section and input-item
 * ids currently visible, and the effective answer map (hidden controllers'
 * keys dropped).
 */
export interface EffectiveVisibility {
  visibleSectionIds: Set<string>;
  visibleItemIds: Set<string>;
  /** The answer map after dropping hidden sections'/items' keys. */
  effectiveMap: AnswerMap;
}

/**
 * Walk sections in document order over an effective answer map (seeded from
 * `answerMap`):
 *   - if a section is HIDDEN under the effective map, it (and all its input
 *     items) are excluded and EVERY one of its input keys is dropped from the
 *     map, so a later condition sees them absent;
 *   - if a section is VISIBLE, its input items are walked in position order: a
 *     hidden item is excluded and its key dropped; a visible item stays.
 * Refs are strictly-earlier in document order, so one forward pass resolves all
 * cascades. Section AND item visibility use the group-safe `evalVisibility`.
 */
export function computeEffectiveVisibility(
  sections: Section[],
  answerMap: AnswerMap,
): EffectiveVisibility {
  const effectiveMap: AnswerMap = { ...answerMap };
  const visibleSectionIds = new Set<string>();
  const visibleItemIds = new Set<string>();

  const dropItemKey = (item: Item) => {
    if (item.questionKey != null) delete effectiveMap[item.questionKey];
  };

  for (const section of sections) {
    if (!evalVisibility(section.visibleWhen, effectiveMap)) {
      for (const item of section.items) {
        if (isInputItem(item.itemType)) dropItemKey(item);
      }
      continue;
    }
    visibleSectionIds.add(section.id);
    for (const item of section.items) {
      if (!isInputItem(item.itemType)) continue;
      if (evalVisibility(item.visibleWhen, effectiveMap)) {
        visibleItemIds.add(item.id);
      } else {
        dropItemKey(item);
      }
    }
  }

  return { visibleSectionIds, visibleItemIds, effectiveMap };
}
