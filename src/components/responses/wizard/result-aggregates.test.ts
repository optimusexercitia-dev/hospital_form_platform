import { describe, expect, it } from "vitest";

import type { Item, ItemOption, Section } from "@/lib/queries/forms";
import type { AnswerMap } from "@/lib/queries/conditions";
import {
  FLAGGED_COUNT_KEY,
  TOTAL_SCORE_KEY,
  walkResultRuleset,
} from "@/lib/queries/conditions";

import type { AnswerState } from "./types";
import type { InstanceState } from "./instances";
import { buildResultAnswerMap } from "./result-aggregates";

/**
 * The wizard's end-of-fill RESULT preview reads an evaluator that is UNCHANGED on
 * both sides of the mirror, so a rule keyed on `__total_score__` /
 * `__flagged_count__` only fires because the CALLER injected the key. The preview
 * used to hand `walkResultRuleset` the bare answer map: every score/flag rule
 * tested an absent key, fell through to `default_result_id`, and disagreed with
 * the result `app.compute_case_phase_result` recorded moments later.
 *
 * These pin the injection itself and the exact disagreement that motivated it.
 */

function option(over: Partial<ItemOption>): ItemOption {
  return {
    id: `o-${over.code ?? "x"}`,
    code: "sim",
    label: "Sim",
    colorToken: null,
    score: null,
    analyticsCode: null,
    flagged: false,
    isOther: false,
    position: 0,
    ...over,
  } as unknown as ItemOption;
}

function item(over: Partial<Item>): Item {
  return {
    id: "i1",
    sectionId: "s1",
    position: 0,
    itemType: "multiple_choice",
    questionKey: "q1",
    label: "Pergunta",
    options: null,
    config: null,
    visibleWhen: null,
    required: false,
    children: [],
    ...over,
  } as unknown as Item;
}

function section(items: Item[]): Section {
  return { id: "s1", position: 0, items } as unknown as Section;
}

function answerState(
  entries: Record<string, { key: string; value: unknown }>,
): AnswerState {
  const out: AnswerState = {};
  for (const [itemId, { key, value }] of Object.entries(entries)) {
    out[itemId] = { itemId, questionKey: key, value: value as never };
  }
  return out;
}

function instance(
  id: string,
  groupItemId: string,
  answers: AnswerState,
): InstanceState {
  return { id, groupItemId, position: 0, answers };
}

/** Two scored multiple-choice questions — the reported repro's shape. */
const SCORED_ITEMS = [
  item({
    id: "i1",
    questionKey: "q1",
    options: [
      option({ code: "sim", score: 1 }),
      option({ code: "nao", label: "Não", score: null, position: 1 }),
    ],
  }),
  item({
    id: "i2",
    questionKey: "q2",
    options: [
      option({ code: "sim", score: 1 }),
      option({ code: "nao", label: "Não", score: null, position: 1 }),
    ],
  }),
];

describe("buildResultAnswerMap — __total_score__", () => {
  it("sums the SELECTED options' scores across items", () => {
    const answerMap: AnswerMap = { q1: "sim", q2: "sim" };
    const map = buildResultAnswerMap({
      sections: [section(SCORED_ITEMS)],
      answers: answerState({
        i1: { key: "q1", value: "sim" },
        i2: { key: "q2", value: "sim" },
      }),
      instances: [],
      answerMap,
    });

    expect(map[TOTAL_SCORE_KEY]).toBe(2);
    // The plain answers survive the merge — the aggregates are ADDED, not a
    // replacement map.
    expect(map.q1).toBe("sim");
    expect(map.q2).toBe("sim");
  });

  it("counts a null-scored option as 0 and ignores unselected options", () => {
    const map = buildResultAnswerMap({
      sections: [section(SCORED_ITEMS)],
      answers: answerState({
        i1: { key: "q1", value: "nao" },
        i2: { key: "q2", value: "sim" },
      }),
      instances: [],
      answerMap: { q1: "nao", q2: "sim" },
    });

    expect(map[TOTAL_SCORE_KEY]).toBe(1);
  });

  it("sums EVERY selected code of a checkbox answer", () => {
    const checkbox = item({
      id: "i3",
      itemType: "checkbox",
      questionKey: "q3",
      options: [
        option({ code: "a", score: 2 }),
        option({ code: "b", score: 3, position: 1 }),
        option({ code: "c", score: 5, position: 2 }),
      ],
    });
    const map = buildResultAnswerMap({
      sections: [section([checkbox])],
      answers: answerState({ i3: { key: "q3", value: ["a", "b"] } }),
      instances: [],
      answerMap: { q3: ["a", "b"] },
    });

    expect(map[TOTAL_SCORE_KEY]).toBe(5);
  });

  it("scores a repeating group's per-instance answers too (the SQL aggregate has no group_instance_id filter)", () => {
    const child = item({
      id: "child",
      questionKey: "qc",
      options: [option({ code: "sim", score: 4 })],
    });
    const group = item({
      id: "grp",
      itemType: "repeating_group",
      questionKey: null,
      options: null,
      children: [child],
    });

    const map = buildResultAnswerMap({
      sections: [section([group])],
      answers: {},
      instances: [
        instance("inst-1", "grp", answerState({ child: { key: "qc", value: "sim" } })),
        instance("inst-2", "grp", answerState({ child: { key: "qc", value: "sim" } })),
      ],
      answerMap: {},
    });

    expect(map[TOTAL_SCORE_KEY]).toBe(8);
  });

  it("is 0 — present, not absent — when nothing scored is answered", () => {
    const map = buildResultAnswerMap({
      sections: [section(SCORED_ITEMS)],
      answers: {},
      instances: [],
      answerMap: {},
    });

    expect(map[TOTAL_SCORE_KEY]).toBe(0);
    expect(TOTAL_SCORE_KEY in map).toBe(true);
  });
});

describe("buildResultAnswerMap — __flagged_count__", () => {
  it("counts selected FLAGGED options plus satisfied per-item flaggedWhen conditions", () => {
    const flaggedChoice = item({
      id: "i1",
      questionKey: "q1",
      options: [
        option({ code: "sim", flagged: true }),
        option({ code: "nao", label: "Não", position: 1 }),
      ],
    });
    const numberItem = item({
      id: "i2",
      itemType: "number",
      questionKey: "q2",
      options: null,
      config: { flaggedWhen: { op: "gt", value: 10 } },
    });

    const hit = buildResultAnswerMap({
      sections: [section([flaggedChoice, numberItem])],
      answers: answerState({
        i1: { key: "q1", value: "sim" },
        i2: { key: "q2", value: 12 },
      }),
      instances: [],
      answerMap: { q1: "sim", q2: 12 },
    });
    expect(hit[FLAGGED_COUNT_KEY]).toBe(2);

    const miss = buildResultAnswerMap({
      sections: [section([flaggedChoice, numberItem])],
      answers: answerState({
        i1: { key: "q1", value: "nao" },
        i2: { key: "q2", value: 3 },
      }),
      instances: [],
      answerMap: { q1: "nao", q2: 3 },
    });
    expect(miss[FLAGGED_COUNT_KEY]).toBe(0);
  });

  it("does not count a flaggedWhen whose item is unanswered", () => {
    const numberItem = item({
      id: "i2",
      itemType: "number",
      questionKey: "q2",
      options: null,
      config: { flaggedWhen: { op: "gt", value: 10 } },
    });

    const map = buildResultAnswerMap({
      sections: [section([numberItem])],
      answers: {},
      instances: [],
      answerMap: {},
    });

    expect(map[FLAGGED_COUNT_KEY]).toBe(0);
  });
});

describe("the review-screen preview now agrees with the conclude-time compute", () => {
  const ruleset = {
    rules: [
      {
        when: { question_key: TOTAL_SCORE_KEY, op: "gte" as const, value: 2 },
        result_id: "conforme",
      },
    ],
    default_result_id: "nao-conforme",
  };
  const answers = answerState({
    i1: { key: "q1", value: "sim" },
    i2: { key: "q2", value: "sim" },
  });
  const answerMap: AnswerMap = { q1: "sim", q2: "sim" };

  it("REGRESSION: the bare answer map falls through to the default", () => {
    // What the panel used to be handed — the exact reported bug: score 2 on a
    // `>= 2` rule, and the preview showed the default result.
    expect(walkResultRuleset(ruleset, answerMap)).toBe("nao-conforme");
  });

  it("the aggregate-bearing map fires the score rule", () => {
    const map = buildResultAnswerMap({
      sections: [section(SCORED_ITEMS)],
      answers,
      instances: [],
      answerMap,
    });

    expect(map[TOTAL_SCORE_KEY]).toBe(2);
    expect(walkResultRuleset(ruleset, map)).toBe("conforme");
  });

  it("still takes the default when the score really is below the threshold", () => {
    const map = buildResultAnswerMap({
      sections: [section(SCORED_ITEMS)],
      answers: answerState({ i1: { key: "q1", value: "sim" } }),
      instances: [],
      answerMap: { q1: "sim" },
    });

    expect(map[TOTAL_SCORE_KEY]).toBe(1);
    expect(walkResultRuleset(ruleset, map)).toBe("nao-conforme");
  });
});
