import "server-only";

import { getSignedAssetUrl } from "@/lib/queries/forms";
import type { ResponseForFill } from "@/lib/queries/responses";
import type { SignoffRecord } from "@/lib/queries/signoffs";
import type { CasePhaseForFill } from "@/lib/queries/cases";
import { signoffRecordsToMap } from "@/components/signoffs/adapt";

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
      // An observation can exist on a saved answer (BE-7); rehydrate it so a
      // resumed fill keeps the note and shows it on the review screen.
      const observation = response.observationsByItemId[item.id];
      // The "Outros" free text likewise rides on a saved answer ("Outros" open
      // option); rehydrate so a resumed fill keeps the typed Outro value.
      const otherText = response.otherTextByItemId[item.id];
      if (
        value === undefined &&
        observation === undefined &&
        otherText === undefined
      )
        continue;
      state[item.id] = {
        itemId: item.id,
        questionKey: item.questionKey,
        value: value ?? null,
        ...(observation !== undefined ? { observation } : {}),
        ...(otherText !== undefined ? { otherText } : {}),
      };
    }
  }
  return state;
}

/**
 * Map a `ResponseForFill` (+ the response's existing sign-off rows from B2's
 * standalone `getResponseSignoffs`) to the client `WizardData` shape. Backend
 * did NOT extend `getResponseForFill`; the wizard route page loads the sign-off
 * rows separately and threads them here (F3 wiring correction).
 */
export function toWizardData(
  response: ResponseForFill,
  org: string,
  slug: string,
  respondentName: string,
  signoffs: SignoffRecord[],
  /**
   * The case-phase RESULT context (phase-results feature), present ONLY on the
   * case-phase responder page. `casePhaseId` plus the phase's `result` context
   * (snapshotted ruleset + active options + the current stashed override) drives
   * the end-of-wizard override panel. Omitted/null for standalone form fills.
   */
  phaseResultContext?: {
    casePhaseId: string;
    result: CasePhaseForFill["result"];
  } | null,
  /**
   * Case Correction Lifecycle context (ADR 0085): present ONLY when this draft is a
   * correction (`supersedes_id != null`), resolved by the responder page. When set,
   * the result-override panel is SUPPRESSED (mutually exclusive with `phaseResult`)
   * and the wizard submits via `resubmitCorrection`.
   */
  correction?: WizardData["correction"] | null,
): WizardData {
  // In correction mode the override panel is hidden and never fires
  // `set_case_phase_result_override` — the result recompute is owned by
  // `approve_correction` (plan §Confirmed-traps). Force `phaseResult` off so the
  // panel + the `submitCasePhaseResponse` path can never render, even if a caller
  // passes result context too.
  const phaseResult =
    !correction && phaseResultContext && phaseResultContext.result
      ? {
          casePhaseId: phaseResultContext.casePhaseId,
          mode: phaseResultContext.result.mode,
          ruleset: phaseResultContext.result.resultRuleset,
          options: phaseResultContext.result.options,
          currentOverrideId: phaseResultContext.result.currentOverrideId,
        }
      : undefined;

  return {
    org,
    slug,
    formId: response.formId,
    responseId: response.id,
    formTitle: response.formTitle,
    respondentName,
    tree: response.tree,
    initialAnswers: toAnswerState(response),
    lastSectionId: response.lastSectionId,
    signoffsBySectionId: signoffRecordsToMap(signoffs),
    phaseResult,
    correction: correction ?? undefined,
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
