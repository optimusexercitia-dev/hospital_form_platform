import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";

import type { Item, Section, VersionTree } from "@/lib/queries/forms";

import { useWizard, computeEffectiveVisibility } from "./use-wizard";
import type { AnswerState, WizardData } from "./types";
import type { AnswerMap } from "@/lib/queries/conditions";

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
    options: [
      { label: "sim", color: null },
      { label: "não", color: null },
    ],
    config: null,
    visibleWhen: null,
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

/**
 * Coverage for the item-level visibility forward pass
 * ({@link computeEffectiveVisibility}) — the EXACT mirror of the backend
 * `submit_response` pass. Exercised against the REAL `evalVisibility` (the
 * shared evaluator), so item show/hide, the strictly-earlier cascade, and the
 * AND/OR group shape are validated against the same logic the server runs.
 */
describe("computeEffectiveVisibility (item-level)", () => {
  it("hides an item whose same-section condition is unmet, shows it when met", () => {
    const sections = [
      section({
        id: "s1",
        position: 0,
        items: [
          inputItem({
            id: "ctrl",
            sectionId: "s1",
            position: 0,
            questionKey: "needs_detail",
          }),
          inputItem({
            id: "detail",
            sectionId: "s1",
            position: 1,
            questionKey: "detail",
            visibleWhen: {
              question_key: "needs_detail",
              op: "equals",
              value: "sim",
            },
          }),
        ],
      }),
    ];

    // Unmet → detail hidden, its key absent from the effective map.
    const hidden = computeEffectiveVisibility(sections, { needs_detail: "não" });
    expect(hidden.visibleItemIds.has("ctrl")).toBe(true);
    expect(hidden.visibleItemIds.has("detail")).toBe(false);

    // Met → detail visible.
    const shown = computeEffectiveVisibility(sections, { needs_detail: "sim" });
    expect(shown.visibleItemIds.has("detail")).toBe(true);
  });

  it("cascades: a hidden controller is seen as absent by a later dependent item", () => {
    // q2 depends on q1; q3 depends on q2. q1 hides q2 (q2's key drops), so q3's
    // condition over q2 sees it absent → q3 hidden too (single forward pass).
    const sections = [
      section({
        id: "s1",
        position: 0,
        items: [
          inputItem({ id: "q1", sectionId: "s1", position: 0, questionKey: "q1" }),
          inputItem({
            id: "q2",
            sectionId: "s1",
            position: 1,
            questionKey: "q2",
            visibleWhen: { question_key: "q1", op: "equals", value: "sim" },
          }),
          inputItem({
            id: "q3",
            sectionId: "s1",
            position: 2,
            questionKey: "q3",
            visibleWhen: { question_key: "q2", op: "equals", value: "sim" },
          }),
        ],
      }),
    ];

    // q1 = "não" → q2 hidden → q3's controller absent → q3 hidden.
    const map: AnswerMap = { q1: "não", q2: "sim", q3: "sim" };
    const eff = computeEffectiveVisibility(sections, map);
    expect(eff.visibleItemIds.has("q2")).toBe(false);
    expect(eff.visibleItemIds.has("q3")).toBe(false);
    // The hidden controllers' keys are dropped from the effective map.
    expect("q2" in eff.effectiveMap).toBe(false);
    expect("q3" in eff.effectiveMap).toBe(false);
    expect(eff.effectiveMap.q1).toBe("não");
  });

  it("drops a hidden SECTION's item keys before a later item reads them", () => {
    // s2's item q_b is hidden because s2 is hidden; a later s3 item conditioned
    // on q_b must see it absent.
    const sections = [
      section({
        id: "s1",
        position: 0,
        items: [
          inputItem({ id: "ctrl", sectionId: "s1", position: 0, questionKey: "show_s2" }),
        ],
      }),
      section({
        id: "s2",
        position: 1,
        visibleWhen: { question_key: "show_s2", op: "equals", value: "sim" },
        items: [
          inputItem({ id: "q_b", sectionId: "s2", position: 0, questionKey: "q_b" }),
        ],
      }),
      section({
        id: "s3",
        position: 2,
        items: [
          inputItem({
            id: "q_c",
            sectionId: "s3",
            position: 0,
            questionKey: "q_c",
            visibleWhen: { question_key: "q_b", op: "equals", value: "x" },
          }),
        ],
      }),
    ];

    // s2 hidden → q_b dropped → q_c's controller absent → q_c hidden.
    const eff = computeEffectiveVisibility(sections, { show_s2: "não", q_b: "x" });
    expect(eff.visibleSectionIds.has("s2")).toBe(false);
    expect(eff.visibleItemIds.has("q_b")).toBe(false);
    expect(eff.visibleItemIds.has("q_c")).toBe(false);
  });

  it("evaluates an AND group on an item (all conditions must hold)", () => {
    const sections = [
      section({
        id: "s1",
        position: 0,
        items: [
          inputItem({ id: "a", sectionId: "s1", position: 0, questionKey: "a" }),
          inputItem({ id: "b", sectionId: "s1", position: 1, questionKey: "b" }),
          inputItem({
            id: "target",
            sectionId: "s1",
            position: 2,
            questionKey: "target",
            visibleWhen: {
              match: "all",
              conditions: [
                { question_key: "a", op: "equals", value: "sim" },
                { question_key: "b", op: "equals", value: "sim" },
              ],
            },
          }),
        ],
      }),
    ];

    expect(
      computeEffectiveVisibility(sections, { a: "sim", b: "sim" }).visibleItemIds.has(
        "target",
      ),
    ).toBe(true);
    // One condition unmet → hidden under ALL.
    expect(
      computeEffectiveVisibility(sections, { a: "sim", b: "não" }).visibleItemIds.has(
        "target",
      ),
    ).toBe(false);
  });

  it("evaluates an OR group on an item (any condition suffices)", () => {
    const sections = [
      section({
        id: "s1",
        position: 0,
        items: [
          inputItem({ id: "a", sectionId: "s1", position: 0, questionKey: "a" }),
          inputItem({ id: "b", sectionId: "s1", position: 1, questionKey: "b" }),
          inputItem({
            id: "target",
            sectionId: "s1",
            position: 2,
            questionKey: "target",
            visibleWhen: {
              match: "any",
              conditions: [
                { question_key: "a", op: "equals", value: "sim" },
                { question_key: "b", op: "equals", value: "sim" },
              ],
            },
          }),
        ],
      }),
    ];

    expect(
      computeEffectiveVisibility(sections, { a: "não", b: "sim" }).visibleItemIds.has(
        "target",
      ),
    ).toBe(true);
    expect(
      computeEffectiveVisibility(sections, { a: "não", b: "não" }).visibleItemIds.has(
        "target",
      ),
    ).toBe(false);
  });

  it("supports a numeric ordered-comparison condition on an item", () => {
    const sections = [
      section({
        id: "s1",
        position: 0,
        items: [
          inputItem({
            id: "score",
            sectionId: "s1",
            position: 0,
            itemType: "number",
            questionKey: "score",
            options: null,
          }),
          inputItem({
            id: "followup",
            sectionId: "s1",
            position: 1,
            questionKey: "followup",
            visibleWhen: { question_key: "score", op: "gte", value: 7 },
          }),
        ],
      }),
    ];

    expect(
      computeEffectiveVisibility(sections, { score: 8 }).visibleItemIds.has(
        "followup",
      ),
    ).toBe(true);
    expect(
      computeEffectiveVisibility(sections, { score: 3 }).visibleItemIds.has(
        "followup",
      ),
    ).toBe(false);
  });
});
