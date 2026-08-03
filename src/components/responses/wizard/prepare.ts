import "server-only";

import { flattenItem, getSignedAssetUrl } from "@/lib/queries/forms";
import type { Item, VersionTree } from "@/lib/queries/forms";
import type {
  GroupInstance,
  ReferenceAnswer,
  ResponseForFill,
  RiskMatrixAnswer,
} from "@/lib/queries/responses";
import type { RiskMatrixState } from "@/lib/forms/matrix";
import type { SignoffRecord } from "@/lib/queries/signoffs";
import type { CasePhaseForFill } from "@/lib/queries/cases";
import { signoffRecordsToMap } from "@/components/signoffs/adapt";

import type { InstanceState } from "./instances";
import type { ReferenceState } from "./references";
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
  // FF-1: `Section.items` holds only TOP-LEVEL items, so walk through
  // `flattenItem`. A plain `group`'s children answer at TOP LEVEL (ruling 6) and
  // belong in this state; a `repeating_group`'s children never carry a top-level
  // answer, so they simply contribute nothing here (their values live on the
  // per-instance state built by `toInstanceStates`).
  for (const section of response.tree.sections) {
    for (const item of section.items.flatMap(flattenItem)) {
      if (!item.questionKey) continue; // display + container items carry no answer
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
 * FF-1 (ADR 0087) — map the response's saved {@link GroupInstance} rows to the
 * wizard's per-instance answer state.
 *
 * Only `answersByItemId` is consumed here. `GroupInstance.answersByKey` is the
 * backend-composed 2-tier overlay for EVALUATION; the wizard recomposes it live
 * from the current top-level map as the user types (via the parity-locked
 * `overlayAnswerMap`), because a saved overlay goes stale on the first keystroke.
 * An instance whose container is no longer in the tree is dropped rather than
 * rendered orphaned.
 */
export function toInstanceStates(
  tree: VersionTree,
  instances: GroupInstance[],
): InstanceState[] {
  const childrenByGroup = new Map<string, Item[]>();
  for (const section of tree.sections) {
    for (const item of section.items) {
      if (item.itemType === "repeating_group") {
        childrenByGroup.set(item.id, item.children);
      }
    }
  }

  const states: InstanceState[] = [];
  for (const instance of instances) {
    const children = childrenByGroup.get(instance.groupItemId);
    if (!children) continue;
    const answers: AnswerState = {};
    for (const child of children) {
      if (!child.questionKey) continue;
      const value = instance.answersByItemId[child.id];
      const observation = instance.observationsByItemId[child.id];
      const otherText = instance.otherTextByItemId[child.id];
      if (
        value === undefined &&
        observation === undefined &&
        otherText === undefined
      ) {
        continue;
      }
      answers[child.id] = {
        itemId: child.id,
        questionKey: child.questionKey,
        value: value ?? null,
        ...(observation !== undefined ? { observation } : {}),
        ...(otherText !== undefined ? { otherText } : {}),
      };
    }
    states.push({
      id: instance.id,
      groupItemId: instance.groupItemId,
      position: instance.position,
      answers,
      // FF-2 — this instance's matrix answers, already code-keyed by the query
      // layer. ABSENT on the sign-off review path (whose instances come from a
      // JSON payload that does not carry matrix answers yet), hence `?? {}`.
      matrixCells: instance.matrixCellsByItemId ?? {},
      riskMatrix: toRiskSelections(instance.riskMatrixByItemId),
      // FF-5 — this instance's own references. `?? {}` for the same reason as
      // the matrix slice above: the sign-off review path builds instances from a
      // JSON payload that does not carry them.
      references: toReferenceState(instance.referencesByItemId),
    });
  }
  return states.sort((a, b) => a.position - b.position);
}

/**
 * FF-2 — drop the read-only `riskScore` from a saved risk answer.
 *
 * The wizard holds `{ severity, likelihood }` and nothing else, on purpose. The
 * score is SERVER-DERIVED output (`severity.weight * likelihood.weight`), the
 * write contract has no score field, and a client-held copy would be a second
 * source of truth that goes stale the moment an author reweighs an axis in a
 * later draft. The fill UI recomputes it for display from the axes it is
 * already rendering.
 */
function toRiskSelections(
  saved: Record<string, RiskMatrixAnswer> | undefined,
): RiskMatrixState {
  const out: RiskMatrixState = {};
  for (const [itemId, answer] of Object.entries(saved ?? {})) {
    out[itemId] = { severity: answer.severity, likelihood: answer.likelihood };
  }
  return out;
}

/**
 * FF-5 — map the saved references to the wizard's reference state.
 *
 * Only ANSWERED items appear, and never a `null` entry: `null` in
 * {@link ReferenceState} means "the filler cleared this during THIS session,
 * write the clear", which is a statement about the current edit, not about what
 * is stored. Seeding a null from the server would send a pointless clear for
 * every unanswered reference on the first save of every section.
 *
 * The label/sublabel come across as-is because the query layer already resolved
 * them by live join (ruling 4) — the client never re-fetches them to render a
 * resumed answer, and never sends them back.
 */
function toReferenceState(
  saved: Record<string, ReferenceAnswer> | undefined,
): ReferenceState {
  const out: ReferenceState = {};
  for (const [itemId, answer] of Object.entries(saved ?? {})) {
    out[itemId] = {
      kind: answer.kind,
      targetId: answer.targetId,
      label: answer.label,
      sublabel: answer.sublabel,
    };
  }
  return out;
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
  /**
   * FF-4 (ADR 0092 ruling 5) — the filling user's e-mail and the response's
   * owning commission's name, for the `current_user_email`/`commission_name`
   * dynamic-default tokens. Both REQUIRED (not optional): the route page
   * already resolves them via `getCommissionAccessByOrg` for other purposes
   * (`access.context.email`, `access.commission.name`), so there is nothing
   * for a caller to omit accidentally — same "no silent gap" reasoning as
   * every other required field on {@link WizardData}.
   */
  respondentEmail: string,
  commissionName: string,
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
    initialInstances: toInstanceStates(response.tree, response.instances),
    // FF-2 — the TOP-LEVEL matrix answers, kept in their own slices so they can
    // never reach the condition evaluator's answer map (a matrix has no `value`
    // and is not a condition target).
    initialMatrixCells: response.matrixCellsByItemId ?? {},
    initialRiskMatrix: toRiskSelections(response.riskMatrixByItemId),
    // FF-5 — the TOP-LEVEL references, kept in their own slice so they can never
    // reach the condition evaluator's answer map (ruling 5).
    initialReferences: toReferenceState(response.referencesByItemId),
    lastSectionId: response.lastSectionId,
    dynamicDefaultContext: {
      startedAt: response.startedAt,
      userName: respondentName,
      userEmail: respondentEmail,
      commissionName,
    },
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
  // FF-1: walk THROUGH containers — an image block authored inside a group would
  // otherwise resolve to no signed URL and render as a permanent placeholder.
  for (const section of response.tree.sections) {
    for (const item of section.items.flatMap(flattenItem)) {
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
