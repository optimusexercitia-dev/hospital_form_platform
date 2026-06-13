import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";

import type { Item, Section, VersionTree } from "@/lib/queries/forms";

import { useWizard } from "./use-wizard";
import type { AnswerState, WizardData } from "./types";

/**
 * Unit coverage for the wizard navigation engine (F2): the live VISIBLE-step
 * recompute via `evalCondition`, the flat-vs-sectioned branch, and the
 * orphan-detection / commit-with-clear path F4 hooks into. Pure logic — no
 * data layer, no supabase. The condition evaluator itself is covered by
 * `conditions.test.ts` (the shared SQL↔TS vector file); here we test that the
 * engine *uses* it correctly to drive the step list.
 */

function inputItem(over: Partial<Item> & Pick<Item, "id" | "sectionId">): Item {
  return {
    position: 0,
    itemType: "multiple_choice",
    questionKey: over.id,
    label: "Pergunta",
    questionExplanation: null,
    options: ["sim", "não"],
    required: false,
    content: null,
    ...over,
  };
}

function section(over: Partial<Section> & Pick<Section, "id">): Section {
  return {
    position: 0,
    title: "Seção",
    description: null,
    isDefault: false,
    visibleWhen: null,
    requiresSignoff: false,
    signoffRole: null,
    items: [],
    ...over,
  };
}

function tree(sections: Section[]): VersionTree {
  return {
    id: "v1",
    formId: "f1",
    versionNumber: 1,
    status: "published",
    publishedAt: null,
    sections,
  };
}

function data(t: VersionTree, initialAnswers: AnswerState = {}): WizardData {
  return {
    slug: "ccih",
    formId: "f1",
    responseId: "r1",
    formTitle: "Formulário",
    respondentName: "Responsável",
    tree: t,
    initialAnswers,
    lastSectionId: null,
    signoffsBySectionId: {},
  };
}

describe("useWizard navigation engine", () => {
  it("treats a default-section-only version as a flat form", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        title: null,
        items: [inputItem({ id: "q1", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    expect(result.current.isFlat).toBe(true);
    expect(result.current.visibleSections).toHaveLength(1);
  });

  it("excludes a conditional section until its controlling answer is given", () => {
    const controlling = inputItem({
      id: "ctrl",
      sectionId: "s1",
      questionKey: "needs_detail",
      options: ["sim", "não"],
    });
    const t = tree([
      section({ id: "s1", position: 0, items: [controlling] }),
      section({
        id: "s2",
        position: 1,
        visibleWhen: { question_key: "needs_detail", op: "equals", value: "sim" },
        items: [inputItem({ id: "detail", sectionId: "s2" })],
      }),
      section({ id: "s3", position: 2 }),
    ]);

    const { result } = renderHook(() => useWizard(data(t)));

    // s2 hidden initially → 2 visible steps (s1, s3).
    expect(result.current.visibleSections.map((s) => s.id)).toEqual(["s1", "s3"]);

    // Answer "sim" → s2 appears live, between s1 and s3.
    act(() => {
      result.current.setAnswer(
        { id: "ctrl", questionKey: "needs_detail" },
        "sim",
      );
    });
    expect(result.current.visibleSections.map((s) => s.id)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);

    // Switch to "não" → s2 drops out again.
    act(() => {
      result.current.setAnswer(
        { id: "ctrl", questionKey: "needs_detail" },
        "não",
      );
    });
    expect(result.current.visibleSections.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("detects a visible→hidden section that already holds answers (orphans)", () => {
    const t = tree([
      section({
        id: "s1",
        position: 0,
        items: [
          inputItem({ id: "ctrl", sectionId: "s1", questionKey: "needs_detail" }),
        ],
      }),
      section({
        id: "s2",
        position: 1,
        visibleWhen: { question_key: "needs_detail", op: "equals", value: "sim" },
        items: [
          inputItem({ id: "detail", sectionId: "s2", questionKey: "detail" }),
        ],
      }),
    ]);

    const initial: AnswerState = {
      ctrl: { itemId: "ctrl", questionKey: "needs_detail", value: "sim" },
      detail: { itemId: "detail", questionKey: "detail", value: "texto" },
    };
    const { result } = renderHook(() => useWizard(data(t, initial)));

    // s2 currently visible with an answer. Preview switching ctrl to "não".
    const next = result.current.previewAnswerChange(
      { id: "ctrl", questionKey: "needs_detail" },
      "não",
    );
    const orphans = result.current.detectOrphans(next);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].section.id).toBe("s2");
    expect(orphans[0].itemIds).toEqual(["detail"]);

    // Commit the change AND clear the orphaned item in one update.
    act(() => {
      result.current.commitAnswerChange(
        { id: "ctrl", questionKey: "needs_detail" },
        "não",
        ["detail"],
      );
    });
    expect(result.current.answers.detail).toBeUndefined();
    expect(result.current.visibleSections.map((s) => s.id)).toEqual(["s1"]);
  });

  it("opens on the last section when resuming, clamped to visibility", () => {
    const t = tree([
      section({ id: "s1", position: 0 }),
      section({ id: "s2", position: 1 }),
      section({ id: "s3", position: 2 }),
    ]);
    const d = { ...data(t), lastSectionId: "s3" };
    const { result } = renderHook(() => useWizard(d));
    expect(result.current.currentStepIndex).toBe(2);
    expect(result.current.currentSection?.id).toBe("s3");
  });
});
