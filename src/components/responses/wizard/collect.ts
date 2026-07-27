import type { Json } from "@/lib/types/database";
import type { Item, Section } from "@/lib/queries/forms";

import type { AnswerState } from "./types";
import type { InstanceState } from "./instances";
import { isChoiceItem, isInputItem } from "./effective-visibility";

/**
 * FF-1 (ADR 0087) — the SAVE-PAYLOAD collectors, extracted so the top-level arm
 * and the instance arm are built by ONE piece of code.
 *
 * That is the point, not tidiness: `observationsByItemId` (BUG-FBE-004) and then
 * `otherTextByItemId` (BUG-FBE-008) were each silently dropped by a hand-listed
 * payload literal, because both fields are OPTIONAL and omitting one is not a
 * type error. Multiplying the collectors by N instances multiplies that failure
 * mode, so a single collector serves both tiers and a new field is added once.
 */

/**
 * One instance's slice of a section save — structurally the wizard's half of
 * backend's `InstanceAnswersInput`. Declared here (rather than imported from
 * `src/lib/responses/actions.ts`) because a Client Component must not
 * value-import a `'use server'` module; the runner forwards it by SPREAD, so
 * the two shapes are checked against each other at the seam.
 */
export interface InstanceAnswers {
  instanceId: string;
  answersByItemId: Record<string, Json>;
  selectionsByItemId?: Record<string, string[]>;
  observationsByItemId?: Record<string, string>;
  otherTextByItemId?: Record<string, string>;
}

/** The scalar/selection split one scope produces. */
export interface CollectedAnswers {
  answersByItemId: Record<string, Json>;
  selectionsByItemId: Record<string, string[]>;
  observationsByItemId: Record<string, string>;
  otherTextByItemId: Record<string, string>;
}

/**
 * Collect one SCOPE's answers, split by the form-model-normalization contract:
 * SCALAR answers (number/date/time/text) go to `answersByItemId`; CHOICE
 * selections go to `selectionsByItemId` as arrays of option CODEs (single-select
 * → a one-element array; checkbox → the code array as-is). Only VISIBLE items
 * are sent — a hidden item collects no answer. A choice item with no/empty
 * selection sends an empty array, which clears its selection rows.
 *
 * "Scope" is the section's top level OR one repeating-group instance; both hold
 * the same {@link AnswerState} shape, which is what lets one collector serve both.
 */
export function collectScope(
  items: Item[],
  answers: AnswerState,
  visibleItemIds: Set<string>,
): CollectedAnswers {
  const answersByItemId: Record<string, Json> = {};
  const selectionsByItemId: Record<string, string[]> = {};
  const observationsByItemId: Record<string, string> = {};
  const otherTextByItemId: Record<string, string> = {};

  for (const item of items) {
    if (!isInputItem(item.itemType)) continue;
    if (!visibleItemIds.has(item.id)) continue;
    const rec = answers[item.id];
    if (!rec) continue;

    if (isChoiceItem(item.itemType)) {
      // Single-select stores a scalar code; checkbox stores a code array.
      // Normalize both to a code array (empty when cleared/absent).
      selectionsByItemId[item.id] = Array.isArray(rec.value)
        ? (rec.value as string[])
        : typeof rec.value === "string" && rec.value !== ""
          ? [rec.value]
          : [];
    } else {
      answersByItemId[item.id] = rec.value;
    }

    const note = rec.observation?.trim();
    if (note) observationsByItemId[item.id] = note;
    // The Outro value is sent RAW — blank is a valid Outro answer, and the
    // backend stores it only when the item's `__other__` option is selected.
    if (rec.otherText != null) otherTextByItemId[item.id] = rec.otherText;
  }

  return {
    answersByItemId,
    selectionsByItemId,
    observationsByItemId,
    otherTextByItemId,
  };
}

/**
 * The section's TOP-LEVEL items for save purposes: flat items plus a plain
 * `group`'s children (ruling 6 — they answer at top level). A `repeating_group`
 * and its children are excluded; they go through {@link collectInstances}.
 */
export function topLevelItems(section: Section): Item[] {
  return section.items.flatMap((item) => {
    if (item.itemType === "repeating_group") return [];
    if (item.itemType === "group") return item.children;
    return [item];
  });
}

/**
 * Collect the INSTANCE arm for a section: one {@link InstanceAnswers} per
 * instance of every `repeating_group` in it.
 *
 * Empty instances are still sent. Pruning is `submit_response`'s job (ruling 3)
 * and it happens at SUBMIT, not at save — dropping them here would make a
 * half-filled repetition vanish on navigation, which is data loss the user never
 * asked for.
 */
export function collectInstances(
  section: Section,
  instancesByGroup: Record<string, InstanceState[]>,
  visibleItemIdsByInstance: Map<string, Set<string>>,
  visibleContainerIds?: Set<string>,
): InstanceAnswers[] {
  const payload: InstanceAnswers[] = [];

  for (const container of section.items) {
    if (container.itemType !== "repeating_group") continue;
    // A hidden container's instances are not edited, so nothing to persist.
    if (visibleContainerIds && !visibleContainerIds.has(container.id)) continue;

    for (const instance of instancesByGroup[container.id] ?? []) {
      const collected = collectScope(
        container.children,
        instance.answers,
        visibleItemIdsByInstance.get(instance.id) ?? new Set<string>(),
      );
      payload.push({ instanceId: instance.id, ...collected });
    }
  }

  return payload;
}
