"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Json } from "@/lib/types/database";
import type { AnswerMap } from "@/lib/queries/conditions";
import type { Item, Section } from "@/lib/queries/forms";
import { OTHER_OPTION_CODE } from "@/lib/forms/option-constants";
import {
  isDefaultSourceEligible,
  type DefaultSource,
} from "@/lib/forms/item-tree";
import type {
  MatrixCellsState,
  RiskMatrixState,
  RiskSelection,
} from "@/lib/forms/matrix";

import type { AnswerRecord, AnswerState, WizardData } from "./types";
import {
  computeEffectiveVisibility,
  computeInstanceVisibility,
  isAnswerableItem,
  isInputItem,
  isChoiceItem,
  isMatrixItem,
  isReferenceItem,
  type EffectiveVisibility,
} from "./effective-visibility";
import type { ReferenceAnswerRecord, ReferenceState } from "./references";
import {
  groupInstances,
  instanceAnswerMap,
  type InstanceState,
  type InstancesByGroup,
} from "./instances";

// Re-export so existing importers (validation, section-step, review-screen,
// block dispatcher) keep their `./use-wizard` import path unchanged.
export {
  computeEffectiveVisibility,
  computeInstanceVisibility,
  isAnswerableItem,
  isInputItem,
  isChoiceItem,
  isMatrixItem,
  isReferenceItem,
};
export type { EffectiveVisibility };

/**
 * The wizard's single source of navigation truth (F2). It owns the answer
 * state, derives the `question_key → value` map for condition evaluation, and
 * recomputes the VISIBLE step list live as controlling answers change.
 *
 * Section AND item show/skip is delegated to `evalVisibility` (the TypeScript
 * mirror of the SQL `app.eval_visibility`, ARCHITECTURE Rule 3 — group-safe over
 * the legacy single OR AND/OR shape) via {@link computeEffectiveVisibility},
 * which is the EXACT mirror of the backend `submit_response` forward pass: a
 * single document-order walk over an effective answer map that drops each hidden
 * section's/item's `question_key` as it goes, so a downstream condition sees a
 * hidden controller as absent (refs are strictly-earlier, so one pass handles
 * cascades). The wizard never re-implements the evaluator.
 *
 * Flat vs sectioned (mirrors `read-only-tree`'s rule): a version whose only
 * section is the default renders as a single flat page (one "step"); otherwise
 * it is a one-visible-section-per-page wizard.
 */

/** A section dropped from the visible steps that still holds saved answers. */
export interface OrphanedSection {
  section: Section;
  /** item ids whose answers must be cleared on warn-confirm (F4). */
  itemIds: string[];
}

export interface WizardState {
  /** All sections (immutable). */
  sections: Section[];
  /** Whether this is a flat single-page form (default-section-only). */
  isFlat: boolean;
  /** Sections currently visible, in order — the live step list. */
  visibleSections: Section[];
  /**
   * Input-item ids currently visible under item-level conditions
   * (form-builder-enhancements). Hidden items collect no answer and are skipped
   * in validation; display items are not tracked here.
   */
  visibleItemIds: Set<string>;
  /** Index into `visibleSections` of the section being shown. */
  currentStepIndex: number;
  /** The section being shown, or null on the review step. */
  currentSection: Section | null;
  /** Total step count (visible sections; the review screen is step N+1). */
  stepCount: number;
  /** True when the user is on the final review screen (past the last section). */
  isReview: boolean;
  /** Per-item answer state. */
  answers: AnswerState;
  /**
   * FF-2 — the TOP-LEVEL matrix answers, held in their own slices and
   * deliberately NOT merged into {@link answers}. A matrix has no scalar value,
   * is not a condition target, and must never reach {@link answerMap}.
   */
  matrixCells: MatrixCellsState;
  riskMatrix: RiskMatrixState;
  /**
   * FF-5 — the TOP-LEVEL entity references, in their own slice for the same
   * reason the matrix slices are: a reference has `answers.value` NULL and is
   * not a condition target (ADR 0091 ruling 5), so merging it into
   * {@link answers} would put a non-value into {@link answerMap} and corrupt
   * every condition evaluated after it.
   */
  references: ReferenceState;
  /** Derived question_key → value map for `evalCondition`. */
  answerMap: AnswerMap;
  /**
   * FF-1 — the CONTAINER ids currently visible. A hidden container hides its
   * children and requires nothing, including its `minInstances` (ruling 3).
   */
  visibleContainerIds: Set<string>;
  /**
   * FF-1 — the repeating-group instances of this response, grouped by container
   * item id and ordered by position. `{}` for a form with no repeating group.
   */
  instancesByGroup: InstancesByGroup;
  /**
   * FF-1 — per-instance visible child ids, keyed by instance id. Derived by
   * {@link computeInstanceVisibility} against the 2-tier overlay (ruling 2), so a
   * child hidden inside instance A can be visible inside instance B.
   */
  visibleItemIdsByInstance: Map<string, Set<string>>;

  /**
   * The LATEST committed answer state + its derived visible-item ids, read from a
   * ref (not a render snapshot). The save-time collectors call this so a handler
   * memoized before the final keystroke still serializes the final state
   * (BUG-FBE-008 stale-closure fix). NOT for render — use `answers` there.
   *
   * FF-1 extends it with the instances + their per-instance visibility, so the
   * instance arm of the save payload is collected from the same non-stale source
   * as the top-level arm rather than a second, differently-timed one.
   */
  getLatestSnapshot: () => {
    answers: AnswerState;
    /** FF-2 — the top-level matrix slices, from the same ref discipline. */
    matrixCells: MatrixCellsState;
    riskMatrix: RiskMatrixState;
    /** FF-5 — the top-level references, from the same ref discipline. */
    references: ReferenceState;
    visibleItemIds: Set<string>;
    instances: InstanceState[];
    visibleItemIdsByInstance: Map<string, Set<string>>;
  };

  setAnswer: (item: { id: string; questionKey: string }, value: Json) => void;
  clearAnswer: (itemId: string) => void;
  /**
   * Set (or clear) the optional observation note on an item's answer record
   * (form-builder-enhancements, decision #11). No-op if the item has no answer
   * record yet — an observation rides on an existing answer row.
   */
  setObservation: (itemId: string, observation: string) => void;
  /**
   * Set (or clear) the optional "Outros" free text on an item's answer record
   * ("Outros" open option). UPSERTS the record (BUG-FBE-008): if the answer record
   * isn't present yet (the selection's `setAnswer` hasn't landed), a minimal record
   * for the reserved `__other__` selection is created so the text is never dropped;
   * a following value commit preserves it via record spread. Takes the item's
   * `{id, questionKey}` so an upserted record is well-formed for the evaluator.
   */
  setOtherText: (
    item: { id: string; questionKey: string },
    otherText: string,
  ) => void;

  // --- FF-2 (ADR 0089): matrix edits. A `matrix` commits ONE ROW at a time
  // (each row takes exactly one column, so setting a row replaces that row's
  // whole selection); a `risk_matrix` commits the whole cell at once, which is
  // what makes the half-filled state the server rejects with HC0P8 unreachable.
  // Neither writes into `answers`, so neither can reach the condition evaluator.
  setMatrixCell: (itemId: string, rowCode: string, colCode: string) => void;
  clearMatrix: (itemId: string) => void;
  setRiskMatrix: (itemId: string, selection: RiskSelection) => void;
  clearRiskMatrix: (itemId: string) => void;
  setInstanceMatrixCell: (
    instanceId: string,
    itemId: string,
    rowCode: string,
    colCode: string,
  ) => void;
  clearInstanceMatrix: (instanceId: string, itemId: string) => void;
  setInstanceRiskMatrix: (
    instanceId: string,
    itemId: string,
    selection: RiskSelection,
  ) => void;
  clearInstanceRiskMatrix: (instanceId: string, itemId: string) => void;

  // --- FF-5 (ADR 0091): entity-reference edits. ONE verb per tier, not the
  // set/clear pair the matrix slices use, because a reference is single-target
  // (ruling 9): `null` IS the clear, and it must be RECORDED rather than
  // deleted, since an absent key means "leave the saved row alone" while an
  // explicit null means "clear it".
  setReference: (itemId: string, next: ReferenceAnswerRecord | null) => void;
  setInstanceReference: (
    instanceId: string,
    itemId: string,
    next: ReferenceAnswerRecord | null,
  ) => void;

  // --- FF-1: per-instance answer edits (same three verbs, scoped to one
  // instance). A repeating-group child NEVER writes into the top-level state.
  setInstanceAnswer: (
    instanceId: string,
    item: { id: string; questionKey: string },
    value: Json,
  ) => void;
  setInstanceObservation: (
    instanceId: string,
    itemId: string,
    observation: string,
  ) => void;
  setInstanceOtherText: (
    instanceId: string,
    item: { id: string; questionKey: string },
    otherText: string,
  ) => void;

  // --- FF-1: instance lifecycle, applied LOCALLY after the server action
  // succeeded. The RPCs own the authoritative positions (`add` is
  // `max(position)+1` under `maxInstances`; `remove` re-packs to 0..n-1), so
  // these mirror the outcome rather than predicting it.
  addInstanceLocal: (instance: {
    id: string;
    groupItemId: string;
    position: number;
  }) => void;
  removeInstanceLocal: (instanceId: string) => void;
  reorderInstancesLocal: (groupItemId: string, instanceIds: string[]) => void;

  goToStep: (index: number) => void;
  next: () => void;
  back: () => void;
  goToReview: () => void;
  goToSection: (sectionId: string) => void;

  /**
   * Build the prospective answer state that applying `value` to `item` would
   * produce, WITHOUT committing it. F4 feeds this into `detectOrphans` to decide
   * whether to warn before the change lands. Pure — no state mutation.
   */
  previewAnswerChange: (
    item: { id: string; questionKey: string },
    value: Json,
  ) => AnswerState;

  /**
   * Given a *prospective* next answer state, report any section that WAS
   * visible (and holds answers) but WOULD become hidden. F4 uses this to drive
   * the warn-and-clear flow before committing the answer change. Returns [] in
   * the common case (no orphaning).
   */
  detectOrphans: (nextAnswers: AnswerState) => OrphanedSection[];

  /**
   * Commit an answer change AND clear any orphaned items in one state update —
   * the path F4 takes after the user confirms the warn-and-clear. Clearing the
   * orphan items here keeps the local state consistent with what the backend
   * `saveSection(..., clearItemIds)` will persist.
   */
  commitAnswerChange: (
    item: { id: string; questionKey: string },
    value: Json,
    clearItemIds: string[],
  ) => void;
}

/** Build the question_key → value map the evaluator consumes. */
function toAnswerMap(answers: AnswerState): AnswerMap {
  const map: AnswerMap = {};
  for (const rec of Object.values(answers)) {
    // A non-empty answer wins; if two items share a key (shouldn't within a
    // version, but be defensive) the last seen is used, matching the DB map.
    map[rec.questionKey] = rec.value;
  }
  return map;
}

/** The visible sections for a given answer map, in document order. */
function computeVisible(sections: Section[], answerMap: AnswerMap): Section[] {
  const { visibleSectionIds } = computeEffectiveVisibility(sections, answerMap);
  return sections.filter((s) => visibleSectionIds.has(s.id));
}

/**
 * Input items (in a section) that currently hold a non-empty answer. Optionally
 * restricted to a set of item ids — used to find the answers ORPHANED when a
 * section or item becomes hidden.
 */
function answeredItemIds(
  section: Section,
  answers: AnswerState,
  restrictTo?: Set<string>,
): string[] {
  return section.items
    .filter(
      (it) =>
        isInputItem(it.itemType) &&
        hasAnswer(answers[it.id]) &&
        (restrictTo ? restrictTo.has(it.id) : true),
    )
    .map((it) => it.id);
}

/**
 * A section's TOP-LEVEL answerable items — flat ones plus a plain `group`'s
 * children (ruling 6). A `repeating_group`'s children are excluded: their
 * answers are per-instance and are never addressed by a top-level `clearItemIds`.
 */
function sectionAnswerables(section: Section): Item[] {
  return section.items.flatMap((item) =>
    item.itemType === "group" ? item.children : [item],
  );
}

/** Whether an answer record carries a meaningful value. */
export function hasAnswer(rec: AnswerRecord | undefined): boolean {
  if (!rec) return false;
  return !isEmptyValue(rec.value);
}

/** Empty = null/undefined, empty string, or empty array (checkbox). */
export function isEmptyValue(value: Json): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * FF-4 (ADR 0092 ruling 5) — resolve a dynamic-default TOKEN to the concrete
 * value it seeds, against the response's own draft-start context.
 * `today`/`now` read `ctx.startedAt` (`responses.started_at`) rather than a
 * live clock, because the ADR's contract is "draft-start date/time", not
 * "whatever date/time this mount happens to run at" — a value frozen at
 * `startedAt` can never drift across a resume days later the way `new
 * Date()` would (the exact idempotent/never-destructive contract
 * `defaultValue` already has — ruling 5's closing line — `defaultSource`
 * inherits it by resolving from a fact that is itself frozen per-response).
 */
function resolveDynamicDefault(
  source: DefaultSource,
  ctx: WizardData["dynamicDefaultContext"],
): Json {
  const startedAtIso = new Date(ctx.startedAt).toISOString();
  switch (source) {
    case "today":
      return startedAtIso.slice(0, 10);
    case "now":
      return startedAtIso.slice(11, 16);
    case "current_user_name":
      return ctx.userName;
    case "current_user_email":
      return ctx.userEmail;
    case "commission_name":
      return ctx.commissionName;
  }
}

/**
 * answer-model-v2 (FE-2, ADR 0046 / P2.4) + FF-4 (ADR 0092 rulings 5/6): seed
 * the initial answer state with each VISIBLE, unanswered input item's default
 * — a literal `defaultValue` or a resolved `defaultSource` token, the two
 * being XOR by construction (a DB CHECK; `item.defaultValue` is checked
 * first purely as a branch order, never both). Visibility is computed from
 * the SAVED answers only (mirrors `computeEffectiveVisibility`), so a
 * default is never applied to an item hidden by a condition — a hidden item's
 * question_key is dropped from the effective map before any later item is
 * evaluated, so this can never leak a default into a controlling answer either.
 * Runs once, at wizard mount (the initializer of the `answers` state): a kept
 * default then saves like any ordinary answer on the next section save; the
 * user is always free to change or clear it — and once cleared or edited,
 * `item.id in initialAnswers` is true on the next mount (the answer, even an
 * empty one, is now saved), so this never refills behind them.
 *
 * `isDefaultSourceEligible` is a defensive re-check, not load-bearing: BE-3's
 * write-time CHECK already pins each token to the type set that can honour
 * it, so an ineligible pairing should never reach this read path. Kept
 * anyway so a stale/legacy row can never seed a shape `answers.value` can't
 * hold, rather than trusting the invariant silently.
 */
function withDefaults(
  sections: Section[],
  initialAnswers: AnswerState,
  dynamicDefaultContext: WizardData["dynamicDefaultContext"],
): AnswerState {
  const initialMap = toAnswerMap(initialAnswers);
  const { visibleItemIds } = computeEffectiveVisibility(sections, initialMap);

  let next: AnswerState | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (!isInputItem(item.itemType)) continue;
      if (!visibleItemIds.has(item.id)) continue;
      if (item.id in initialAnswers) continue; // already has a saved answer
      if (item.questionKey == null) continue;

      let seed: Json | undefined;
      if (item.defaultValue !== null && item.defaultValue !== undefined) {
        seed = item.defaultValue;
      } else if (
        item.defaultSource &&
        isDefaultSourceEligible(item.defaultSource, item.itemType)
      ) {
        seed = resolveDynamicDefault(item.defaultSource, dynamicDefaultContext);
      }
      if (seed === undefined) continue;

      if (next === null) next = { ...initialAnswers };
      next[item.id] = {
        itemId: item.id,
        questionKey: item.questionKey,
        value: seed,
      };
    }
  }
  return next ?? initialAnswers;
}

/**
 * FF-1 — per-instance visible child ids for every instance in the response.
 *
 * An instance inside a HIDDEN container contributes an empty set: a hidden group
 * requires nothing (ruling 3) and renders nothing. `baseMap` is the EFFECTIVE
 * top-level map (hidden controllers already dropped), so a child's condition
 * sees exactly what the server's forward pass sees before the overlay is applied.
 */
function deriveInstanceVisibility(
  sections: Section[],
  instances: InstanceState[],
  baseMap: AnswerMap,
  visibleContainerIds: Set<string>,
): Map<string, Set<string>> {
  const byInstance = new Map<string, Set<string>>();
  if (instances.length === 0) return byInstance;

  const containersById = new Map<string, Item>();
  for (const section of sections) {
    for (const item of section.items) {
      if (item.itemType === "repeating_group") containersById.set(item.id, item);
    }
  }

  for (const instance of instances) {
    const container = containersById.get(instance.groupItemId);
    if (!container || !visibleContainerIds.has(container.id)) {
      byInstance.set(instance.id, new Set<string>());
      continue;
    }
    byInstance.set(
      instance.id,
      computeInstanceVisibility(container, baseMap, instanceAnswerMap(instance)),
    );
  }
  return byInstance;
}

export function useWizard(data: WizardData): WizardState {
  const sections = data.tree.sections;
  const isFlat = sections.length === 1 && sections[0].isDefault;

  const [answers, setAnswers] = useState<AnswerState>(() =>
    withDefaults(sections, data.initialAnswers, data.dynamicDefaultContext),
  );

  // FF-2 — the TOP-LEVEL matrix slices. Separate state, never merged into
  // `answers`: a matrix answers in `answer_matrix_cells` with `answers.value`
  // NULL, so merging would put a non-value into the derived `AnswerMap` and
  // corrupt every condition evaluated after it. There is also no `withDefaults`
  // pass here — `form_items.default_value` seeds `answers.value`, which a matrix
  // does not have (`supportsDefaultValue` excludes both types).
  const [matrixCells, setMatrixCells] = useState<MatrixCellsState>(
    () => data.initialMatrixCells,
  );
  const [riskMatrix, setRiskMatrix] = useState<RiskMatrixState>(
    () => data.initialRiskMatrix,
  );

  // FF-5 — the TOP-LEVEL entity references. Its own slice for the identical
  // reason as the matrix slices above: `answers.value` is NULL for a reference,
  // so merging it into `answers` would feed a non-value into the derived
  // `AnswerMap`. There is no `withDefaults` pass either — `default_value` seeds
  // `value`, which a reference does not have (`supportsDefaultValue` excludes it).
  const [references, setReferences] = useState<ReferenceState>(
    () => data.initialReferences,
  );

  // FF-1 — the repeating-group instances. A flat, position-ordered list; the
  // renderers consume the grouped/sorted view derived below.
  const [instances, setInstances] = useState<InstanceState[]>(
    () => data.initialInstances,
  );

  // Resolve the initial step from where the user left off, clamped to what's
  // currently visible (a section may have become hidden since last save).
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => {
    const initialMap = toAnswerMap(data.initialAnswers);
    const visible = computeVisible(sections, initialMap);
    if (data.lastSectionId) {
      const idx = visible.findIndex((s) => s.id === data.lastSectionId);
      if (idx >= 0) return idx;
    }
    return 0;
  });

  const answerMap = useMemo(() => toAnswerMap(answers), [answers]);

  // BUG-FBE-008: a live ref to the LATEST committed answers. The save-time
  // collectors (`collectSection`/`observationsForSection`/`otherTextForSection`)
  // read `getLatestSnapshot()` instead of a closed-over `answers` snapshot, so a
  // handler instance that was memoized BEFORE the last keystroke committed still
  // sees the final state — killing the stale-closure class for selections,
  // observations AND otherText at once. The ref is synced in a commit-phase
  // effect (after React applies state), so it holds the current answers by the
  // time any user event handler runs.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // The same live-ref treatment for instances: the save collector must serialize
  // the FINAL per-instance keystroke, not a render snapshot taken before it.
  const instancesRef = useRef(instances);
  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  // FF-2 — the same live-ref treatment for the matrix slices. A grid click can
  // land between a save handler's memoization and its invocation exactly as a
  // keystroke can, and a matrix answer that misses the payload is silently lost:
  // the item is simply absent from `matrixCellsByItemId`, which the REPLACE
  // contract reads as "leave untouched", not as an error.
  const matrixCellsRef = useRef(matrixCells);
  useEffect(() => {
    matrixCellsRef.current = matrixCells;
  }, [matrixCells]);
  const riskMatrixRef = useRef(riskMatrix);
  useEffect(() => {
    riskMatrixRef.current = riskMatrix;
  }, [riskMatrix]);

  // FF-5 — the same live-ref treatment for the reference slice. A pick lands
  // between a save handler's memoization and its invocation exactly as a
  // keystroke does, and a reference missing from the payload is silently lost:
  // the item is simply absent from `referencesByItemId`, which the REPLACE
  // contract reads as "leave untouched", not as an error.
  const referencesRef = useRef(references);
  useEffect(() => {
    referencesRef.current = references;
  }, [references]);

  /**
   * The LATEST committed answer state + the visibility derived from it, computed
   * on demand from the ref. Used only by the save-time collectors so they never
   * read a stale render snapshot (never used for render — the memoized `answers`/
   * `visibleItemIds` drive rendering).
   */
  const getLatestSnapshot = useCallback((): {
    answers: AnswerState;
    matrixCells: MatrixCellsState;
    riskMatrix: RiskMatrixState;
    references: ReferenceState;
    visibleItemIds: Set<string>;
    instances: InstanceState[];
    visibleItemIdsByInstance: Map<string, Set<string>>;
  } => {
    const latest = answersRef.current;
    const latestInstances = instancesRef.current;
    const {
      visibleItemIds: latestVisible,
      visibleContainerIds,
      effectiveMap,
    } = computeEffectiveVisibility(sections, toAnswerMap(latest));
    return {
      answers: latest,
      matrixCells: matrixCellsRef.current,
      riskMatrix: riskMatrixRef.current,
      references: referencesRef.current,
      visibleItemIds: latestVisible,
      instances: latestInstances,
      visibleItemIdsByInstance: deriveInstanceVisibility(
        sections,
        latestInstances,
        effectiveMap,
        visibleContainerIds,
      ),
    };
  }, [sections]);

  // One document-order pass drives both section AND item visibility (mirror of
  // the submit RPC), recomputed live as answers change.
  const effective = useMemo(
    () => computeEffectiveVisibility(sections, answerMap),
    [sections, answerMap],
  );
  const visibleItemIds = effective.visibleItemIds;

  const visibleSections = useMemo(
    () => sections.filter((s) => effective.visibleSectionIds.has(s.id)),
    [sections, effective],
  );

  // FF-1 — the instance views. `instancesByGroup` is what the renderers consume
  // (grouped + position-ordered); `visibleItemIdsByInstance` is the per-instance
  // inside-out visibility (ruling 2), recomputed whenever either tier changes.
  const instancesByGroup = useMemo(() => groupInstances(instances), [instances]);
  const visibleItemIdsByInstance = useMemo(
    () =>
      deriveInstanceVisibility(
        sections,
        instances,
        effective.effectiveMap,
        effective.visibleContainerIds,
      ),
    [sections, instances, effective],
  );

  // Clamp the active index whenever the visible set shrinks below it (the
  // current section was hidden by an answer change). `isReview` is index ===
  // length; we keep that valid too.
  const stepCount = visibleSections.length;
  const clampedIndex = Math.min(currentStepIndex, stepCount);
  const isReview = clampedIndex >= stepCount && stepCount > 0;
  const currentSection = isReview ? null : (visibleSections[clampedIndex] ?? null);

  const detectOrphans = useCallback(
    (nextAnswers: AnswerState): OrphanedSection[] => {
      const nextMap = toAnswerMap(nextAnswers);
      const { visibleSectionIds, visibleItemIds: nextVisibleItemIds } =
        computeEffectiveVisibility(sections, nextMap);
      const orphans: OrphanedSection[] = [];

      /**
       * FF-2 — a MATRIX that holds cells counts as orphaned exactly like a
       * scalar answer does. It is included by ITEM ID so it rides the existing
       * `clearItemIds` path: that deletes the parent `answers` row, and
       * `answer_matrix_cells` / `answer_risk_matrix` cascade off `answer_id`.
       * Without this arm a matrix hidden by a later answer change would keep its
       * saved cells forever — invisible in the UI, still counted by the server.
       *
       * A matrix can never be the CONTROLLING item (it is not a condition
       * target), so its own state cannot change under this prospective map; it
       * is read from current state rather than from `nextAnswers`.
       */
      const matrixAnswered = (item: Item): boolean => {
        if (!isMatrixItem(item.itemType)) return false;
        if (item.itemType === "risk_matrix") {
          return riskMatrixRef.current[item.id] != null;
        }
        const grid = matrixCellsRef.current[item.id];
        return grid != null && Object.keys(grid).length > 0;
      };

      /**
       * FF-5 — the SAME arm for a reference, and it exists for the same reason
       * the matrix arm does: without it, a reference hidden by a later answer
       * change keeps its saved `answer_references` row forever — invisible in
       * the UI, still counted by the server and still blocking a `delete` on the
       * participant it points at (the FK is `on delete restrict`).
       *
       * Included by ITEM ID so it rides the existing `clearItemIds` path, which
       * deletes the parent `answers` row and cascades `answer_references` off
       * `answer_id`. A reference can never be the CONTROLLING item (ruling 5
       * keeps it out of the condition evaluator entirely), so its own state
       * cannot change under the prospective map and is read from current state.
       */
      const referenceAnswered = (item: Item): boolean =>
        isReferenceItem(item.itemType) &&
        referencesRef.current[item.id] != null;

      const payloadAnswered = (item: Item): boolean =>
        matrixAnswered(item) || referenceAnswered(item);

      for (const section of sections) {
        if (!visibleSectionIds.has(section.id)) {
          // Whole section hidden → every answered input in it is orphaned.
          const itemIds = [
            ...answeredItemIds(section, nextAnswers),
            ...sectionAnswerables(section)
              .filter(payloadAnswered)
              .map((it) => it.id),
          ];
          if (itemIds.length > 0) orphans.push({ section, itemIds });
          continue;
        }
        // Section still visible: an answered input now hidden by an ITEM-level
        // condition is also orphaned (mirrors the submit RPC's per-item clear).
        const hiddenAnswered = section.items
          .filter(
            (it) =>
              isInputItem(it.itemType) &&
              !nextVisibleItemIds.has(it.id) &&
              hasAnswer(nextAnswers[it.id]),
          )
          .map((it) => it.id);
        const hiddenPayloads = sectionAnswerables(section)
          .filter((it) => !nextVisibleItemIds.has(it.id) && payloadAnswered(it))
          .map((it) => it.id);
        const itemIds = [...hiddenAnswered, ...hiddenPayloads];
        if (itemIds.length > 0) {
          orphans.push({ section, itemIds });
        }
      }
      return orphans;
    },
    [sections],
  );

  const setAnswer = useCallback(
    (item: { id: string; questionKey: string }, value: Json) => {
      setAnswers((prev) => ({
        ...prev,
        [item.id]: {
          // Preserve any existing observation across a value change.
          ...prev[item.id],
          itemId: item.id,
          questionKey: item.questionKey,
          value,
        },
      }));
    },
    [],
  );

  const setObservation = useCallback(
    (itemId: string, observation: string) => {
      setAnswers((prev) => {
        const rec = prev[itemId];
        // An observation rides on an existing answer record; ignore if absent.
        if (!rec) return prev;
        return { ...prev, [itemId]: { ...rec, observation } };
      });
    },
    [],
  );

  const setOtherText = useCallback(
    (item: { id: string; questionKey: string }, otherText: string) => {
      setAnswers((prev) => {
        const rec = prev[item.id];
        if (rec) {
          // An existing record: set/clear the Outro text on it (preserves value +
          // observation). This also handles the clear path (otherText === "").
          return { ...prev, [item.id]: { ...rec, otherText } };
        }
        // BUG-FBE-008: no record yet. The old guard (`if (!rec) return prev`)
        // silently DROPPED the first keystroke when the selection's `setAnswer`
        // hadn't landed in `answers` yet (a select+type ordering the browser hit
        // but unit tests couldn't reproduce). UPSERT a minimal record so the text
        // survives — but ONLY for a NON-empty value, so clearing an already-absent
        // item never resurrects it. The Outro field only shows when `__other__` is
        // selected, so that is the well-formed value; a following value commit
        // spreads `...prev[item.id]` and preserves this text.
        if (otherText === "") return prev;
        return {
          ...prev,
          [item.id]: {
            itemId: item.id,
            questionKey: item.questionKey,
            value: OTHER_OPTION_CODE as Json,
            otherText,
          },
        };
      });
    },
    [],
  );

  // --- FF-2: matrix edits, top level. -------------------------------------
  const setMatrixCell = useCallback(
    (itemId: string, rowCode: string, colCode: string) => {
      setMatrixCells((prev) => ({
        ...prev,
        // Setting a row REPLACES that row's selection — a row takes exactly one
        // column, so there is no accumulate case to get wrong (ruling 1).
        [itemId]: { ...(prev[itemId] ?? {}), [rowCode]: colCode },
      }));
    },
    [],
  );

  const clearMatrix = useCallback((itemId: string) => {
    setMatrixCells((prev) => {
      if (!(itemId in prev)) return prev;
      // An EMPTY grid, not a removed key: `{}` is what the REPLACE contract
      // reads as "clear this item's cells", while an absent key means "leave
      // whatever is saved untouched".
      return { ...prev, [itemId]: {} };
    });
  }, []);

  const setRiskMatrixSelection = useCallback(
    (itemId: string, selection: RiskSelection) => {
      setRiskMatrix((prev) => ({ ...prev, [itemId]: selection }));
    },
    [],
  );

  const clearRiskMatrix = useCallback((itemId: string) => {
    setRiskMatrix((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  // --- FF-5: entity-reference edits, top level. ----------------------------
  //
  // ONE verb, because a reference is single-target: picking REPLACES, and `null`
  // clears. The null is WRITTEN into state rather than deleting the key — an
  // absent key means "leave the saved row alone" to the REPLACE contract, so
  // deleting on clear would make "Remover" a silent no-op that survives a reload.
  const setReference = useCallback(
    (itemId: string, next: ReferenceAnswerRecord | null) => {
      setReferences((prev) => ({ ...prev, [itemId]: next }));
    },
    [],
  );

  /** Drop reference state for items whose `answers` row is being deleted (an
   *  orphan clear). Here the key really is REMOVED, not nulled: the row is gone
   *  server-side and `answer_references` cascaded with it, so there is nothing
   *  left to clear and no write to send. */
  const forgetReferences = useCallback((itemIds: string[]) => {
    if (itemIds.length === 0) return;
    setReferences((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of itemIds) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // --- FF-1: per-instance edits. Each writes ONLY into the addressed instance's
  // own answer state; a repeating-group child never touches the top-level map.
  const updateInstance = useCallback(
    (instanceId: string, update: (answers: AnswerState) => AnswerState) => {
      setInstances((prev) =>
        prev.map((instance) =>
          instance.id === instanceId
            ? { ...instance, answers: update(instance.answers) }
            : instance,
        ),
      );
    },
    [],
  );

  const setInstanceAnswer = useCallback(
    (
      instanceId: string,
      item: { id: string; questionKey: string },
      value: Json,
    ) => {
      updateInstance(instanceId, (prev) => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          itemId: item.id,
          questionKey: item.questionKey,
          value,
        },
      }));
    },
    [updateInstance],
  );

  const setInstanceObservation = useCallback(
    (instanceId: string, itemId: string, observation: string) => {
      updateInstance(instanceId, (prev) => {
        const rec = prev[itemId];
        if (!rec) return prev; // an observation rides on an existing answer
        return { ...prev, [itemId]: { ...rec, observation } };
      });
    },
    [updateInstance],
  );

  const setInstanceOtherText = useCallback(
    (
      instanceId: string,
      item: { id: string; questionKey: string },
      otherText: string,
    ) => {
      updateInstance(instanceId, (prev) => {
        const rec = prev[item.id];
        if (rec) return { ...prev, [item.id]: { ...rec, otherText } };
        // BUG-FBE-008, per instance: UPSERT a minimal record so a first Outro
        // keystroke landing before the selection's `setAnswer` is never dropped.
        // Only for a NON-empty value, so clearing an absent item can't resurrect it.
        if (otherText === "") return prev;
        return {
          ...prev,
          [item.id]: {
            itemId: item.id,
            questionKey: item.questionKey,
            value: OTHER_OPTION_CODE as Json,
            otherText,
          },
        };
      });
    },
    [updateInstance],
  );

  // --- FF-2: the same four verbs, scoped to ONE instance. A repeating-group
  // matrix never writes into the top-level slices.
  const patchInstance = useCallback(
    (instanceId: string, update: (instance: InstanceState) => InstanceState) => {
      setInstances((prev) =>
        prev.map((instance) =>
          instance.id === instanceId ? update(instance) : instance,
        ),
      );
    },
    [],
  );

  const setInstanceMatrixCell = useCallback(
    (instanceId: string, itemId: string, rowCode: string, colCode: string) => {
      patchInstance(instanceId, (instance) => ({
        ...instance,
        matrixCells: {
          ...(instance.matrixCells ?? {}),
          [itemId]: {
            ...(instance.matrixCells?.[itemId] ?? {}),
            [rowCode]: colCode,
          },
        },
      }));
    },
    [patchInstance],
  );

  const clearInstanceMatrix = useCallback(
    (instanceId: string, itemId: string) => {
      patchInstance(instanceId, (instance) => ({
        ...instance,
        matrixCells: { ...(instance.matrixCells ?? {}), [itemId]: {} },
      }));
    },
    [patchInstance],
  );

  const setInstanceRiskMatrix = useCallback(
    (instanceId: string, itemId: string, selection: RiskSelection) => {
      patchInstance(instanceId, (instance) => ({
        ...instance,
        riskMatrix: { ...(instance.riskMatrix ?? {}), [itemId]: selection },
      }));
    },
    [patchInstance],
  );

  const clearInstanceRiskMatrix = useCallback(
    (instanceId: string, itemId: string) => {
      patchInstance(instanceId, (instance) => {
        const next = { ...(instance.riskMatrix ?? {}) };
        delete next[itemId];
        return { ...instance, riskMatrix: next };
      });
    },
    [patchInstance],
  );

  // FF-5 — the same verb, scoped to ONE instance. A reference in repetition 2
  // can never write into repetition 1: the write is addressed by
  // `(instanceId, itemId)` and lands on that instance's own slice, exactly as
  // FF-1's answers and FF-2's grids do.
  const setInstanceReference = useCallback(
    (
      instanceId: string,
      itemId: string,
      next: ReferenceAnswerRecord | null,
    ) => {
      patchInstance(instanceId, (instance) => ({
        ...instance,
        references: { ...(instance.references ?? {}), [itemId]: next },
      }));
    },
    [patchInstance],
  );

  const addInstanceLocal = useCallback(
    (instance: { id: string; groupItemId: string; position: number }) => {
      setInstances((prev) => [
      ...prev,
      { ...instance, answers: {}, matrixCells: {}, riskMatrix: {} },
    ]);
    },
    [],
  );

  const removeInstanceLocal = useCallback((instanceId: string) => {
    setInstances((prev) => {
      const removed = prev.find((i) => i.id === instanceId);
      if (!removed) return prev;
      // Mirror the RPC's re-pack: the group's remaining positions stay
      // contiguous 0..n-1, so the client never renders a gap the server doesn't
      // have.
      return prev
        .filter((i) => i.id !== instanceId)
        .map((i) =>
          i.groupItemId === removed.groupItemId && i.position > removed.position
            ? { ...i, position: i.position - 1 }
            : i,
        );
    });
  }, []);

  const reorderInstancesLocal = useCallback(
    (groupItemId: string, instanceIds: string[]) => {
      setInstances((prev) =>
        prev.map((instance) => {
          if (instance.groupItemId !== groupItemId) return instance;
          const next = instanceIds.indexOf(instance.id);
          return next < 0 ? instance : { ...instance, position: next };
        }),
      );
    },
    [],
  );

  const previewAnswerChange = useCallback(
    (item: { id: string; questionKey: string }, value: Json): AnswerState => ({
      ...answers,
      [item.id]: {
        // Preserve any existing observation when previewing a value change.
        ...answers[item.id],
        itemId: item.id,
        questionKey: item.questionKey,
        value,
      },
    }),
    [answers],
  );

  const commitAnswerChange = useCallback(
    (
      item: { id: string; questionKey: string },
      value: Json,
      clearItemIds: string[],
    ) => {
      setAnswers((prev) => {
        const next: AnswerState = {
          ...prev,
          [item.id]: {
            ...prev[item.id],
            itemId: item.id,
            questionKey: item.questionKey,
            value,
          },
        };
        for (const id of clearItemIds) delete next[id];
        return next;
      });
      // FF-5 — `clearItemIds` can name a REFERENCE item (the orphan detector
      // includes them), and those ids do not live in `answers`, so the loop
      // above would leave a hidden reference's label sitting in state to
      // reappear if the item became visible again.
      forgetReferences(clearItemIds);
    },
    [forgetReferences],
  );

  const clearAnswer = useCallback((itemId: string) => {
    setAnswers((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      setCurrentStepIndex(Math.max(0, Math.min(index, stepCount)));
    },
    [stepCount],
  );

  const next = useCallback(() => {
    setCurrentStepIndex((i) => Math.min(i + 1, stepCount));
  }, [stepCount]);

  const back = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToReview = useCallback(() => {
    setCurrentStepIndex(stepCount);
  }, [stepCount]);

  const goToSection = useCallback(
    (sectionId: string) => {
      const idx = visibleSections.findIndex((s) => s.id === sectionId);
      if (idx >= 0) setCurrentStepIndex(idx);
    },
    [visibleSections],
  );

  return {
    sections,
    isFlat,
    visibleSections,
    visibleItemIds,
    currentStepIndex: clampedIndex,
    currentSection,
    stepCount,
    isReview,
    answers,
    matrixCells,
    riskMatrix,
    references,
    answerMap,
    visibleContainerIds: effective.visibleContainerIds,
    instancesByGroup,
    visibleItemIdsByInstance,
    getLatestSnapshot,
    setAnswer,
    clearAnswer,
    setObservation,
    setOtherText,
    setMatrixCell,
    clearMatrix,
    setRiskMatrix: setRiskMatrixSelection,
    clearRiskMatrix,
    setInstanceMatrixCell,
    clearInstanceMatrix,
    setInstanceRiskMatrix,
    clearInstanceRiskMatrix,
    setReference,
    setInstanceReference,
    setInstanceAnswer,
    setInstanceObservation,
    setInstanceOtherText,
    addInstanceLocal,
    removeInstanceLocal,
    reorderInstancesLocal,
    goToStep,
    next,
    back,
    goToReview,
    goToSection,
    previewAnswerChange,
    detectOrphans,
    commitAnswerChange,
  };
}
