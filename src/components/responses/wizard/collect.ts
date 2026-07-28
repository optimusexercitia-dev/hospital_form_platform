import type { Json } from "@/lib/types/database";
import type { Item, Section } from "@/lib/queries/forms";
import type {
  MatrixCells,
  MatrixCellsState,
  RiskMatrixState,
  RiskSelection,
} from "@/lib/forms/matrix";

import type { AnswerState } from "./types";
import type { InstanceState } from "./instances";
import type { ReferenceState } from "./references";
import {
  isChoiceItem,
  isInputItem,
  isMatrixItem,
  isReferenceItem,
} from "./effective-visibility";

/**
 * FF-1 (ADR 0087) — the SAVE-PAYLOAD collectors, extracted so the top-level arm
 * and the instance arm are built by ONE piece of code.
 *
 * That is the point, not tidiness: `observationsByItemId` (BUG-FBE-004) and then
 * `otherTextByItemId` (BUG-FBE-008) were each silently dropped by a hand-listed
 * payload literal, because both fields are OPTIONAL and omitting one is not a
 * type error. Multiplying the collectors by N instances multiplies that failure
 * mode, so a single collector serves both tiers and a new field is added once.
 *
 * FF-2 takes that one step further: the collector now receives the whole
 * {@link ScopeState} rather than its three slices as separate arguments, so
 * adding a fourth kind of answer (FF-5's references) cannot produce a call site
 * that forgets to pass it — the compiler asks for the scope, not for a list.
 */

/**
 * One SCOPE's complete answer state: the section's top level, or one
 * repeating-group instance. Both tiers hold the identical shape, which is what
 * lets one collector serve both.
 */
export interface ScopeState {
  answers: AnswerState;
  /** FF-2 — `{ itemId: { rowCode: colCode } }`; absent reads as empty. */
  matrixCells?: MatrixCellsState;
  /** FF-2 — `{ itemId: { severity, likelihood } }`; absent reads as empty. */
  riskMatrix?: RiskMatrixState;
  /**
   * FF-5 — `{ itemId: record | null }`; absent reads as empty. The `null` entry
   * is MEANINGFUL (an explicit clear) and is not the same as an absent key —
   * see {@link ReferenceState}. This is the fourth kind of answer the
   * whole-scope collector shape was introduced to absorb.
   */
  references?: ReferenceState;
}

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
  /** FF-2 — this instance's matrix grids, addressed by axis CODE on both sides. */
  matrixCellsByItemId?: Record<string, MatrixCells>;
  /** FF-2 — this instance's risk selections. NEVER a score: the server derives it. */
  riskMatrixByItemId?: Record<string, RiskSelection>;
  /**
   * FF-5 — this instance's references: `itemId → target UUID`, or `null` to
   * CLEAR. Carried per instance so a reference in repetition 2 addresses
   * repetition 2's answer row; the runner forwards this to the server action's
   * matching `referencesByItemId`, which becomes each instance entry's
   * `references` key on the RPC.
   */
  referencesByItemId?: Record<string, string | null>;
}

/** The scalar/selection/matrix/reference split one scope produces. */
export interface CollectedAnswers {
  answersByItemId: Record<string, Json>;
  selectionsByItemId: Record<string, string[]>;
  observationsByItemId: Record<string, string>;
  otherTextByItemId: Record<string, string>;
  matrixCellsByItemId: Record<string, MatrixCells>;
  riskMatrixByItemId: Record<string, RiskSelection>;
  /** FF-5 — `itemId → target UUID | null` (null clears). REPLACE per item. */
  referencesByItemId: Record<string, string | null>;
}

/**
 * Collect one SCOPE's answers, split by the form-model-normalization contract:
 * SCALAR answers (number/date/time/text) go to `answersByItemId`; CHOICE
 * selections go to `selectionsByItemId` as arrays of option CODEs (single-select
 * → a one-element array; checkbox → the code array as-is). Only VISIBLE items
 * are sent — a hidden item collects no answer. A choice item with no/empty
 * selection sends an empty array, which clears its selection rows.
 *
 * FF-2: a `matrix` sends `{ rowCode: colCode }` and a `risk_matrix` sends
 * `{ severity, likelihood }`, both keyed by item id and both addressed by
 * clone-stable axis CODEs. Like selections, each is REPLACE per item: an item
 * present has its WHOLE grid rewritten, `{}` clears it, and an item ABSENT is
 * left untouched — which is why an unanswered matrix is omitted rather than sent
 * empty, and why a hidden one is omitted too (its cells are removed through the
 * orphan clear, which drops the parent `answers` row and cascades).
 *
 * ⚠ No score is ever collected for a `risk_matrix`. The write contract has no
 * score field and the server recomputes it from the axis weights; sending one
 * would be sending a number that is silently ignored.
 *
 * FF-5: a `reference` sends its single TARGET ID — or an explicit `null` to
 * clear — keyed by item id, under the same REPLACE-per-item contract. It sends
 * no label: ruling 4 resolves labels by live join and aggregation keys on the
 * target id, so a label on the wire would be a value the server must ignore.
 */
export function collectScope(
  items: Item[],
  scope: ScopeState,
  visibleItemIds: Set<string>,
): CollectedAnswers {
  const answersByItemId: Record<string, Json> = {};
  const selectionsByItemId: Record<string, string[]> = {};
  const observationsByItemId: Record<string, string> = {};
  const otherTextByItemId: Record<string, string> = {};
  const matrixCellsByItemId: Record<string, MatrixCells> = {};
  const riskMatrixByItemId: Record<string, RiskSelection> = {};
  const referencesByItemId: Record<string, string | null> = {};

  const { answers } = scope;
  const scopeCells = scope.matrixCells ?? {};
  const scopeRisk = scope.riskMatrix ?? {};
  const scopeReferences = scope.references ?? {};

  for (const item of items) {
    if (!visibleItemIds.has(item.id)) continue;

    // FF-5 — the reference arm. Dispatched on TYPE for the same reason as the
    // matrix arms below: `answers.value` is NULL for a reference, so any
    // value-shaped check reads every answered reference as unanswered.
    //
    // The three-way distinction is the whole contract:
    //   · key ABSENT in state  → omitted → the server leaves the saved row alone;
    //   · key present, `null`  → sent as null → the server CLEARS the row;
    //   · key present, record  → sent as the target id → REPLACE.
    // Collapsing absent and null would make "Limpar" a silent no-op, which is
    // exactly the failure `clearMatrix`'s empty-grid-vs-missing-key split avoids.
    if (isReferenceItem(item.itemType)) {
      const record = scopeReferences[item.id];
      if (record !== undefined) {
        referencesByItemId[item.id] = record === null ? null : record.targetId;
      }
      continue;
    }

    // FF-2 — the matrix arms. Dispatched on TYPE, never on the presence of a
    // `value`: a matrix answer has `answers.value` NULL by design, so a
    // value-shaped check would treat every filled matrix as unanswered.
    if (isMatrixItem(item.itemType)) {
      if (item.itemType === "risk_matrix") {
        const selection = scopeRisk[item.id];
        // Both halves or neither: a half-filled risk answer is rejected with
        // HC0P8, and the UI only ever commits a whole cell.
        if (selection?.severity && selection.likelihood) {
          riskMatrixByItemId[item.id] = selection;
        }
      } else {
        const grid = scopeCells[item.id];
        if (grid) matrixCellsByItemId[item.id] = grid;
      }
      continue;
    }

    if (!isInputItem(item.itemType)) continue;
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
    matrixCellsByItemId,
    riskMatrixByItemId,
    referencesByItemId,
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
        instance,
        visibleItemIdsByInstance.get(instance.id) ?? new Set<string>(),
      );
      payload.push({ instanceId: instance.id, ...collected });
    }
  }

  return payload;
}
