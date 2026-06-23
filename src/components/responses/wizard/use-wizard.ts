"use client";

import { useCallback, useMemo, useState } from "react";

import type { Json } from "@/lib/types/database";
import type { AnswerMap } from "@/lib/queries/conditions";
import type { Section } from "@/lib/queries/forms";

import type { AnswerRecord, AnswerState, WizardData } from "./types";
import {
  computeEffectiveVisibility,
  isInputItem,
  type EffectiveVisibility,
} from "./effective-visibility";

// Re-export so existing importers (validation, section-step, review-screen,
// block dispatcher) keep their `./use-wizard` import path unchanged.
export { computeEffectiveVisibility, isInputItem };
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
  /** Derived question_key → value map for `evalCondition`. */
  answerMap: AnswerMap;

  setAnswer: (item: { id: string; questionKey: string }, value: Json) => void;
  clearAnswer: (itemId: string) => void;
  /**
   * Set (or clear) the optional observation note on an item's answer record
   * (form-builder-enhancements, decision #11). No-op if the item has no answer
   * record yet — an observation rides on an existing answer row.
   */
  setObservation: (itemId: string, observation: string) => void;
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

export function useWizard(data: WizardData): WizardState {
  const sections = data.tree.sections;
  const isFlat = sections.length === 1 && sections[0].isDefault;

  const [answers, setAnswers] = useState<AnswerState>(data.initialAnswers);

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
      for (const section of sections) {
        if (!visibleSectionIds.has(section.id)) {
          // Whole section hidden → every answered input in it is orphaned.
          const itemIds = answeredItemIds(section, nextAnswers);
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
        if (hiddenAnswered.length > 0) {
          orphans.push({ section, itemIds: hiddenAnswered });
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
    },
    [],
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
    answerMap,
    setAnswer,
    clearAnswer,
    setObservation,
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
