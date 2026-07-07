import { describe, expect, it } from "vitest";

import type { Item, Section, Visibility } from "@/lib/queries/forms";

import {
  buildOptionLabelMap,
  buildQuestionLabelMap,
  describeVisibility,
} from "./describe-visibility";

/**
 * Unit coverage for the builder's condition SUMMARY — the human-readable note
 * shown on a question card with a conditional appearance. Asserts key→label
 * resolution, operator phrasing, value formatting (scalar + array), the
 * single/group shapes, and the always-visible (null) case.
 */

function item(over: Partial<Item>): Item {
  return {
    id: "i",
    sectionId: "s",
    position: 0,
    itemType: "multiple_choice",
    questionKey: null,
    label: null,
    questionExplanation: null,
    options: null,
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    content: null,
    ...over,
  };
}

function section(items: Item[]): Section {
  return {
    id: "s",
    position: 0,
    title: null,
    description: null,
    isDefault: true,
    visibleWhen: null,
    requiresSignoff: false,
    signoffRole: null,
    items,
  };
}

const sections: Section[] = [
  section([
    item({ id: "q1", questionKey: "terminal", label: "Caso terminal?" }),
    item({ id: "q2", questionKey: "dias", label: "Dias internado" }),
  ]),
];

describe("describeVisibility", () => {
  it("returns null when there is no condition (always visible)", () => {
    expect(describeVisibility(null, buildQuestionLabelMap(sections))).toBeNull();
  });

  it("resolves the question_key to its label and formats a scalar value", () => {
    const v: Visibility = { question_key: "terminal", op: "equals", value: "Sim" };
    const summary = describeVisibility(v, buildQuestionLabelMap(sections));
    expect(summary).toEqual({
      clauses: [{ target: "Caso terminal?", op: "é igual a", value: "Sim" }],
      combinator: null,
    });
  });

  it("falls back to the raw key when the target is unresolved", () => {
    const v: Visibility = { question_key: "ghost", op: "equals", value: "Sim" };
    const summary = describeVisibility(v, buildQuestionLabelMap(sections));
    expect(summary?.clauses[0].target).toBe("ghost");
  });

  it("normalizes a 1-row group to a single clause with no combinator", () => {
    const v: Visibility = {
      match: "all",
      conditions: [{ question_key: "terminal", op: "equals", value: "Sim" }],
    };
    const summary = describeVisibility(v, buildQuestionLabelMap(sections));
    expect(summary?.combinator).toBeNull();
    expect(summary?.clauses).toHaveLength(1);
  });

  it("keeps the combinator and formats an array (in) value for a multi-row group", () => {
    const v: Visibility = {
      match: "any",
      conditions: [
        { question_key: "terminal", op: "in", value: ["Sim", "Não Aplica"] },
        { question_key: "dias", op: "gt", value: 5 },
      ],
    };
    const summary = describeVisibility(v, buildQuestionLabelMap(sections));
    expect(summary).toEqual({
      combinator: "any",
      clauses: [
        { target: "Caso terminal?", op: "é uma das opções", value: "Sim, Não Aplica" },
        { target: "Dias internado", op: "é maior que", value: "5" },
      ],
    });
  });

  describe("form-model-normalization: choice code → option label", () => {
    // A choice question whose stored condition value is the option CODE; the
    // card must render the human option LABEL.
    const choiceSections: Section[] = [
      section([
        item({
          id: "q1",
          questionKey: "terminal",
          label: "Caso terminal?",
          options: [
            { id: "o1", code: "sim_a1b2", label: "Sim", color: null, score: null, analyticsCode: null, flagged: false, isOther: false, position: 0 },
            { id: "o2", code: "nao_c3d4", label: "Não", color: null, score: null, analyticsCode: null, flagged: false, isOther: false, position: 1 },
            { id: "o3", code: "na_e5f6", label: "Não Aplica", color: null, score: null, analyticsCode: null, flagged: false, isOther: false, position: 2 },
          ],
        }),
      ]),
    ];

    it("resolves a scalar code to its option label", () => {
      const v: Visibility = { question_key: "terminal", op: "equals", value: "sim_a1b2" };
      const summary = describeVisibility(
        v,
        buildQuestionLabelMap(choiceSections),
        buildOptionLabelMap(choiceSections),
      );
      expect(summary?.clauses[0].value).toBe("Sim");
    });

    it("resolves an array of codes (in) to comma-joined option labels", () => {
      const v: Visibility = {
        question_key: "terminal",
        op: "in",
        value: ["sim_a1b2", "na_e5f6"],
      };
      const summary = describeVisibility(
        v,
        buildQuestionLabelMap(choiceSections),
        buildOptionLabelMap(choiceSections),
      );
      expect(summary?.clauses[0].value).toBe("Sim, Não Aplica");
    });

    it("falls back to the raw code when it is unknown (option since deleted)", () => {
      const v: Visibility = { question_key: "terminal", op: "equals", value: "gone_9999" };
      const summary = describeVisibility(
        v,
        buildQuestionLabelMap(choiceSections),
        buildOptionLabelMap(choiceSections),
      );
      expect(summary?.clauses[0].value).toBe("gone_9999");
    });
  });
});
