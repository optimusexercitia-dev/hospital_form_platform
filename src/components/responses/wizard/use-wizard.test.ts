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
    // form-model-normalization: options are normalized rows. The option CODE is
    // the answer-map identity, so codes are chosen to equal the condition values
    // these tests assert on ("sim"/"não").
    options: [
      { id: "o-sim", code: "sim", label: "Sim", color: null, score: null, analyticsCode: null, flagged: false, isOther: false, position: 0 },
      { id: "o-nao", code: "não", label: "Não", color: null, score: null, analyticsCode: null, flagged: false, isOther: false, position: 1 },
    ],
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
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
    org: "org-a",
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

/**
 * form-model-normalization (FE-2 CRITICAL): the wizard's client-side answer map
 * (`question_key → value`) that drives live show/skip via the frozen
 * `evalVisibility` MUST match the SQL `app.answer_map` shape EXACTLY, or live
 * visibility diverges from submit-time visibility (a real bug):
 *   - single-select (multiple_choice / dropdown) → a SCALAR option-code string;
 *   - checkbox → an ARRAY of option codes (even for a 1-element selection);
 *   - scalars (number / date / time / text) → the raw value.
 * The wizard stores the option CODE(s) in the answer record `value` (set by
 * `InputItem`); `toAnswerMap` copies the value verbatim — so asserting
 * `result.current.answerMap` is the true end-to-end check that the map-builder
 * produces exactly these shapes.
 */
describe("answer-map shape mirrors app.answer_map (FE-2)", () => {
  function singleData(): WizardData {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        title: null,
        items: [
          inputItem({ id: "mc", sectionId: "s0", questionKey: "mc", itemType: "multiple_choice" }),
          inputItem({ id: "dd", sectionId: "s0", questionKey: "dd", itemType: "dropdown" }),
          inputItem({ id: "cb", sectionId: "s0", questionKey: "cb", itemType: "checkbox" }),
          inputItem({
            id: "num",
            sectionId: "s0",
            questionKey: "num",
            itemType: "number",
            options: null,
          }),
          inputItem({
            id: "txt",
            sectionId: "s0",
            questionKey: "txt",
            itemType: "short_text",
            options: null,
          }),
        ],
      }),
    ]);
    return data(t);
  }

  it("single-select (multiple_choice / dropdown) → a scalar code string", () => {
    const { result } = renderHook(() => useWizard(singleData()));
    act(() => {
      // InputItem emits the option CODE; here we feed codes directly.
      result.current.setAnswer({ id: "mc", questionKey: "mc" }, "sim");
      result.current.setAnswer({ id: "dd", questionKey: "dd" }, "não");
    });
    expect(result.current.answerMap.mc).toBe("sim");
    expect(typeof result.current.answerMap.mc).toBe("string");
    expect(result.current.answerMap.dd).toBe("não");
  });

  it("checkbox → an array of codes (even for a 1-element selection)", () => {
    const { result } = renderHook(() => useWizard(singleData()));
    act(() => {
      result.current.setAnswer({ id: "cb", questionKey: "cb" }, ["sim"]);
    });
    expect(Array.isArray(result.current.answerMap.cb)).toBe(true);
    expect(result.current.answerMap.cb).toEqual(["sim"]);

    act(() => {
      result.current.setAnswer({ id: "cb", questionKey: "cb" }, ["sim", "não"]);
    });
    expect(result.current.answerMap.cb).toEqual(["sim", "não"]);
  });

  it("scalars (number / text) → the raw value, unwrapped", () => {
    const { result } = renderHook(() => useWizard(singleData()));
    act(() => {
      result.current.setAnswer({ id: "num", questionKey: "num" }, 7);
      result.current.setAnswer({ id: "txt", questionKey: "txt" }, "olá");
    });
    expect(result.current.answerMap.num).toBe(7);
    expect(result.current.answerMap.txt).toBe("olá");
  });
});

describe("useWizard default-value prefill (answer-model-v2 FE-2)", () => {
  it("seeds a visible, unanswered scalar item from its defaultValue", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [
          inputItem({
            id: "txt",
            sectionId: "s0",
            itemType: "short_text",
            questionKey: "txt",
            options: null,
            defaultValue: "valor padrão",
          }),
        ],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    expect(result.current.answers.txt?.value).toBe("valor padrão");
    expect(result.current.answerMap.txt).toBe("valor padrão");
  });

  it("seeds a choice item's defaultValue as the option code", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0", defaultValue: "sim" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    expect(result.current.answers.mc?.value).toBe("sim");
  });

  it("never seeds a default into an item hidden by a condition", () => {
    const controlling = inputItem({
      id: "ctrl",
      sectionId: "s0",
      questionKey: "ctrl",
    });
    const hidden = inputItem({
      id: "hidden",
      sectionId: "s0",
      itemType: "short_text",
      questionKey: "hidden",
      options: null,
      visibleWhen: { question_key: "ctrl", op: "equals", value: "sim" },
      defaultValue: "nunca deveria aparecer",
    });
    const t = tree([
      section({ id: "s0", isDefault: true, items: [controlling, hidden] }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));

    // The controlling question is unanswered → `hidden` stays hidden → no seed.
    expect(result.current.answers.hidden).toBeUndefined();
    expect(result.current.visibleItemIds.has("hidden")).toBe(false);
  });

  it("never overwrites an existing saved answer with the default", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [
          inputItem({
            id: "txt",
            sectionId: "s0",
            itemType: "short_text",
            questionKey: "txt",
            options: null,
            defaultValue: "valor padrão",
          }),
        ],
      }),
    ]);
    const initialAnswers: AnswerState = {
      txt: { itemId: "txt", questionKey: "txt", value: "resposta salva" },
    };
    const { result } = renderHook(() => useWizard(data(t, initialAnswers)));
    expect(result.current.answers.txt?.value).toBe("resposta salva");
  });

  it("lets the user clear a prefilled default (defaults never re-apply after edit)", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [
          inputItem({
            id: "txt",
            sectionId: "s0",
            itemType: "short_text",
            questionKey: "txt",
            options: null,
            defaultValue: "valor padrão",
          }),
        ],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    expect(result.current.answers.txt?.value).toBe("valor padrão");

    act(() => {
      result.current.setAnswer({ id: "txt", questionKey: "txt" }, "");
    });
    expect(result.current.answers.txt?.value).toBe("");
  });

  it("does not seed a display item or an item with no defaultValue", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [
          inputItem({
            id: "mc",
            sectionId: "s0",
            defaultValue: null,
          }),
        ],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    expect(result.current.answers.mc).toBeUndefined();
  });
});

describe("useWizard — setOtherText (Others open option, task #6)", () => {
  it("rides on an existing answer record", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() =>
      useWizard(
        data(t, {
          mc: { itemId: "mc", questionKey: "mc", value: "__other__" },
        }),
      ),
    );
    act(() =>
      result.current.setOtherText(
        { id: "mc", questionKey: "mc" },
        "Reação alérgica",
      ),
    );
    expect(result.current.answers.mc?.otherText).toBe("Reação alérgica");
    // The answer value is preserved alongside the Outro text.
    expect(result.current.answers.mc?.value).toBe("__other__");
  });

  it("UPSERTS a __other__ record when text arrives before the selection (FBE-008)", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    // No record yet — a NON-empty Outro text creates a well-formed __other__ record
    // so the text is never dropped (the old guard silently discarded it).
    act(() =>
      result.current.setOtherText({ id: "mc", questionKey: "mc" }, "texto"),
    );
    expect(result.current.answers.mc?.value).toBe("__other__");
    expect(result.current.answers.mc?.otherText).toBe("texto");
  });

  it("does NOT resurrect an absent record when clearing (empty text)", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    act(() => result.current.setOtherText({ id: "mc", questionKey: "mc" }, ""));
    expect(result.current.answers.mc).toBeUndefined();
  });

  it("preserves otherText across a value change (setAnswer spreads the record)", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() =>
      useWizard(
        data(t, {
          mc: {
            itemId: "mc",
            questionKey: "mc",
            value: "__other__",
            otherText: "nota",
          },
        }),
      ),
    );
    act(() =>
      result.current.setAnswer({ id: "mc", questionKey: "mc" }, "__other__"),
    );
    expect(result.current.answers.mc?.otherText).toBe("nota");
  });

  // BUG-FBE-008 regression: the REAL flow starts with NO answer record, then the
  // user SELECTS __other__ (creating the record) and TYPES the Outro text in the
  // same interaction. React batches both state updates, so `setOtherText` must not
  // drop the text just because the selection's record isn't flushed to the render
  // snapshot yet — the functional updaters run in sequence.
  it("keeps the Outro text when selection + text land in the same batch (from empty)", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    // Item starts unanswered.
    expect(result.current.answers.mc).toBeUndefined();
    // Select __other__ then type — BATCHED in one act() (mirrors the browser).
    act(() => {
      result.current.setAnswer({ id: "mc", questionKey: "mc" }, "__other__");
      result.current.setOtherText(
        { id: "mc", questionKey: "mc" },
        "Reação alérgica",
      );
    });
    expect(result.current.answers.mc?.value).toBe("__other__");
    expect(result.current.answers.mc?.otherText).toBe("Reação alérgica");
  });

  it("keeps Outro text committed via the orphan-aware commit path then typed", () => {
    // Mirrors wizard-client.onChange's no-orphan branch (setAnswer) + the first
    // keystroke, batched — the exact FBE-008 sequence.
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    act(() => {
      result.current.commitAnswerChange(
        { id: "mc", questionKey: "mc" },
        "__other__",
        [],
      );
      result.current.setOtherText({ id: "mc", questionKey: "mc" }, "detalhe");
    });
    expect(result.current.answers.mc?.otherText).toBe("detalhe");
  });

  it("survives the WORST ordering: text BEFORE the selection lands (FBE-008)", () => {
    // The precise defect: `setOtherText` fires while the selection's record isn't
    // in `answers` yet. The UPSERT keeps the text; the following `setAnswer`
    // (spread) preserves it. Then it's collectable for save.
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));
    // Text arrives first (record absent) — upserts a __other__ record.
    act(() =>
      result.current.setOtherText({ id: "mc", questionKey: "mc" }, "detalhe"),
    );
    expect(result.current.answers.mc?.otherText).toBe("detalhe");
    // The selection commits later — spread preserves the Outro text.
    act(() =>
      result.current.setAnswer({ id: "mc", questionKey: "mc" }, "__other__"),
    );
    expect(result.current.answers.mc?.value).toBe("__other__");
    expect(result.current.answers.mc?.otherText).toBe("detalhe");
  });
});

describe("useWizard — getLatestSnapshot (FBE-008 stale-closure fix)", () => {
  // CONFIRMS THE MECHANISM: a save handler captures a getLatestSnapshot reference
  // BEFORE the last keystroke commits. The RENDER-time `answers`/memo captured at
  // that instant is STALE, but `getLatestSnapshot()` (a ref) must return the
  // POST-commit state — proving the collectors read latest regardless of which
  // handler instance fires.
  it("a captured getLatestSnapshot reference reflects a LATER commit", () => {
    const t = tree([
      section({
        id: "s0",
        isDefault: true,
        items: [inputItem({ id: "mc", sectionId: "s0" })],
      }),
    ]);
    const { result } = renderHook(() => useWizard(data(t)));

    // Simulate the selection committing at render N.
    act(() =>
      result.current.setAnswer({ id: "mc", questionKey: "mc" }, "__other__"),
    );
    // Capture the snapshot accessor + the render-N `answers` snapshot NOW (as a
    // save handler memoized at render N would close over them).
    const capturedGetLatest = result.current.getLatestSnapshot;
    const staleAnswers = result.current.answers;
    expect(staleAnswers.mc?.otherText).toBeUndefined();

    // The last keystroke commits at render N+1.
    act(() =>
      result.current.setOtherText({ id: "mc", questionKey: "mc" }, "detalhe"),
    );

    // The captured RENDER snapshot is stale — it never saw the keystroke…
    expect(staleAnswers.mc?.otherText).toBeUndefined();
    // …but the captured accessor reads the LATEST committed state.
    const latest = capturedGetLatest();
    expect(latest.answers.mc?.value).toBe("__other__");
    expect(latest.answers.mc?.otherText).toBe("detalhe");
    // The item is visible in the latest snapshot (flat default section).
    expect(latest.visibleItemIds.has("mc")).toBe(true);
  });
});
