"use client";

import { useCallback, useMemo, useState } from "react";

import type { Json } from "@/lib/types/database";
import { evalCondition, type AnswerMap } from "@/lib/queries/conditions";
import type { InputItemType, Section } from "@/lib/queries/forms";

import type { AnswerRecord, AnswerState, WizardData } from "./types";

// Declared locally (NOT value-imported from `@/lib/queries/forms`) so this
// client module never drags the server-only query module — and its
// `next/headers` dependency — into the client bundle. Mirrors the Phase-4
// builder's pattern. Type-only imports above are erased at build, so they're
// safe. Kept in lockstep with `INPUT_ITEM_TYPES` in `forms.ts` (the four input
// item types; display items collect no answers).
const INPUT_ITEM_TYPES: readonly InputItemType[] = [
  "multiple_choice",
  "dropdown",
  "checkbox",
  "free_text",
];

/**
 * The wizard's single source of navigation truth (F2). It owns the answer
 * state, derives the `question_key → value` map for condition evaluation, and
 * recomputes the VISIBLE step list live as controlling answers change. Section
 * show/skip is delegated ENTIRELY to `evalCondition` (the TypeScript mirror of
 * the SQL evaluator, ARCHITECTURE Rule 3) — the wizard never re-implements it.
 *
 * Flat vs sectioned (mirrors `read-only-tree`'s rule): a version whose only
 * section is the default renders as a single flat page (one "step"); otherwise
 * it is a one-visible-section-per-page wizard.
 */

const INPUT_TYPES = new Set<string>(INPUT_ITEM_TYPES);

/** True for items that collect an answer (input items, not display blocks). */
export function isInputItem(itemType: string): boolean {
  return INPUT_TYPES.has(itemType);
}

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

/** Build the question_key → value map `evalCondition` consumes. */
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
  return sections.filter((s) => evalCondition(s.visibleWhen, answerMap));
}

/** Input items in a section that currently hold a non-empty answer. */
function answeredItemIds(section: Section, answers: AnswerState): string[] {
  return section.items
    .filter((it) => isInputItem(it.itemType) && hasAnswer(answers[it.id]))
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

  const visibleSections = useMemo(
    () => computeVisible(sections, answerMap),
    [sections, answerMap],
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
      const nextVisibleIds = new Set(
        computeVisible(sections, nextMap).map((s) => s.id),
      );
      const orphans: OrphanedSection[] = [];
      for (const section of sections) {
        if (nextVisibleIds.has(section.id)) continue; // still visible
        // Use the CURRENT answers to find what's already saved in the section
        // that would be orphaned by the change.
        const itemIds = answeredItemIds(section, nextAnswers);
        if (itemIds.length > 0) orphans.push({ section, itemIds });
      }
      return orphans;
    },
    [sections],
  );

  const setAnswer = useCallback(
    (item: { id: string; questionKey: string }, value: Json) => {
      setAnswers((prev) => ({
        ...prev,
        [item.id]: { itemId: item.id, questionKey: item.questionKey, value },
      }));
    },
    [],
  );

  const previewAnswerChange = useCallback(
    (item: { id: string; questionKey: string }, value: Json): AnswerState => ({
      ...answers,
      [item.id]: { itemId: item.id, questionKey: item.questionKey, value },
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
          [item.id]: { itemId: item.id, questionKey: item.questionKey, value },
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
    currentStepIndex: clampedIndex,
    currentSection,
    stepCount,
    isReview,
    answers,
    answerMap,
    setAnswer,
    clearAnswer,
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
