import "server-only";

import { getSignedAssetUrl } from "@/lib/queries/forms";
import type { ResponseForFill } from "@/lib/queries/responses";

import type { AnswerState, WizardData } from "./types";

/**
 * Server-side adapters that turn B2's `ResponseForFill` into the wizard's
 * client props. Kept out of the client bundle (`server-only`) so the wizard
 * tree never value-imports the query module.
 */

/**
 * Build the per-item answer state the wizard holds. B2 hands us answers keyed
 * by item_id AND by question_key; here we attach each saved value to its item's
 * stable `questionKey` (from the tree) so the engine can derive the `AnswerMap`
 * for `evalCondition` without a lossy reverse-lookup (lead's F4 steer).
 */
export function toAnswerState(response: ResponseForFill): AnswerState {
  const state: AnswerState = {};
  for (const section of response.tree.sections) {
    for (const item of section.items) {
      if (!item.questionKey) continue; // display items carry no answer
      const value = response.answersByItemId[item.id];
      if (value === undefined) continue;
      state[item.id] = {
        itemId: item.id,
        questionKey: item.questionKey,
        value,
      };
    }
  }
  return state;
}

/** Map a `ResponseForFill` to the client `WizardData` shape. */
export function toWizardData(
  response: ResponseForFill,
  slug: string,
): WizardData {
  return {
    slug,
    formId: response.formId,
    responseId: response.id,
    formTitle: response.formTitle,
    tree: response.tree,
    initialAnswers: toAnswerState(response),
    lastSectionId: response.lastSectionId,
  };
}

/**
 * Resolve a `{ storage_path → signed URL }` map for every image block in the
 * response's version tree (server-side, so previews render immediately). A null
 * URL falls back to a placeholder in `ImagePreview`. Mirrors the builder's
 * resolver so the two never drift.
 */
export async function resolveImageUrls(
  response: ResponseForFill,
): Promise<Record<string, string>> {
  const paths = new Set<string>();
  for (const section of response.tree.sections) {
    for (const item of section.items) {
      if (item.itemType === "image" && item.content) {
        const path = (item.content as { storage_path?: string }).storage_path;
        if (path) paths.add(path);
      }
    }
  }
  const entries = await Promise.all(
    [...paths].map(
      async (path) => [path, await getSignedAssetUrl(path)] as const,
    ),
  );
  const map: Record<string, string> = {};
  for (const [path, url] of entries) {
    if (url) map[path] = url;
  }
  return map;
}
