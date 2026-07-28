import { describe, expect, it } from "vitest";

import type { Item, Section } from "@/lib/queries/forms";
import type { AnswerMap } from "@/lib/queries/conditions";
import type { ItemValidationRule } from "@/lib/forms/validation-rules";

import type { AnswerState } from "./types";
import type { InstanceState } from "./instances";
import { validateInstanceRules, validateSectionRules } from "./validation";

/**
 * FF-3 (ADR 0090) — the wizard's live rule feedback.
 *
 * The evaluator's own semantics are pinned by the SQL↔TS golden vectors. What is
 * covered here is the WIRING the wizard adds around it, which the vectors cannot
 * see: severity routing, per-instance PLACEMENT (a violation in repetition 2 must
 * not mark repetition 1 — the requirement most likely to regress silently),
 * `unique_within_group`'s peer set, `required_if`, and the rule that visibility
 * wins unconditionally.
 */

function rule(over: Partial<ItemValidationRule>): ItemValidationRule {
  return {
    id: "r1",
    itemId: "i1",
    formVersionId: "v1",
    position: 0,
    ruleType: "text_length",
    config: { min: 5 },
    severity: "error",
    message: "Muito curto.",
    ...over,
  } as ItemValidationRule;
}

function item(over: Partial<Item>): Item {
  return {
    id: "i1",
    itemType: "short_text",
    questionKey: "q1",
    label: "Pergunta",
    required: false,
    requiredIf: null,
    validations: [],
    children: [],
    config: null,
    visibleWhen: null,
    ...over,
  } as unknown as Item;
}

function section(items: Item[]): Section {
  return { id: "s1", position: 0, items } as unknown as Section;
}

function answerState(entries: Record<string, { key: string; value: unknown }>): AnswerState {
  const out: AnswerState = {};
  for (const [itemId, { key, value }] of Object.entries(entries)) {
    out[itemId] = {
      itemId,
      questionKey: key,
      // The fixture mirrors what the wizard stores; `Json` is the stored type.
      value: value as never,
    };
  }
  return out;
}

function instance(
  id: string,
  groupItemId: string,
  position: number,
  answers: AnswerState,
): InstanceState {
  return { id, groupItemId, position, answers };
}

describe("validateSectionRules — severity routing", () => {
  const short = item({
    validations: [rule({ severity: "error", message: "Mínimo 5 caracteres." })],
  });

  it("routes a failing `error` rule to errors, never to warnings", () => {
    const answers = answerState({ i1: { key: "q1", value: "abc" } });
    const map: AnswerMap = { q1: "abc" };
    const fb = validateSectionRules(section([short]), { answers }, map);
    expect(fb.errors).toEqual({ i1: "Mínimo 5 caracteres." });
    expect(fb.warnings).toEqual({});
  });

  it("routes a failing `warn` rule to warnings, never to errors", () => {
    const warned = item({
      validations: [rule({ severity: "warn", message: "Costuma ser mais longo." })],
    });
    const answers = answerState({ i1: { key: "q1", value: "abc" } });
    const fb = validateSectionRules(section([warned]), { answers }, { q1: "abc" });
    expect(fb.warnings).toEqual({ i1: "Costuma ser mais longo." });
    expect(fb.errors).toEqual({});
  });

  it("says nothing about an EMPTY value — an untouched field never accuses", () => {
    const answers = answerState({ i1: { key: "q1", value: "" } });
    const fb = validateSectionRules(section([short]), { answers }, { q1: "" });
    expect(fb.errors).toEqual({});
    expect(fb.warnings).toEqual({});
  });

  it("says nothing when the value satisfies the rule", () => {
    const answers = answerState({ i1: { key: "q1", value: "abcdef" } });
    const fb = validateSectionRules(section([short]), { answers }, { q1: "abcdef" });
    expect(fb.errors).toEqual({});
  });

  it("reports only the FIRST failing rule of each severity, in position order", () => {
    const multi = item({
      validations: [
        rule({ id: "a", position: 0, severity: "error", message: "primeiro erro" }),
        rule({ id: "b", position: 1, severity: "error", message: "segundo erro" }),
        rule({ id: "c", position: 2, severity: "warn", message: "primeiro aviso" }),
        rule({ id: "d", position: 3, severity: "warn", message: "segundo aviso" }),
      ],
    });
    const answers = answerState({ i1: { key: "q1", value: "ab" } });
    const fb = validateSectionRules(section([multi]), { answers }, { q1: "ab" });
    expect(fb.errors.i1).toBe("primeiro erro");
    expect(fb.warnings.i1).toBe("primeiro aviso");
  });

  it("skips a HIDDEN item entirely — visibility wins over every rule", () => {
    const answers = answerState({ i1: { key: "q1", value: "abc" } });
    const fb = validateSectionRules(
      section([short]),
      { answers },
      { q1: "abc" },
      new Set<string>(), // nothing visible
    );
    expect(fb.errors).toEqual({});
  });

  it("validates a plain group's children (they answer at top level)", () => {
    const child = item({ id: "c1", questionKey: "qc", validations: [rule({})] });
    const group = item({
      id: "g1",
      itemType: "group",
      questionKey: null,
      children: [child],
    });
    const answers = answerState({ c1: { key: "qc", value: "ab" } });
    const fb = validateSectionRules(
      section([group]),
      { answers },
      { qc: "ab" },
      new Set(["c1", "g1"]),
    );
    expect(fb.errors).toEqual({ c1: "Muito curto." });
  });
});

describe("validateSectionRules — required_if", () => {
  const conditional = item({
    required: false,
    requiredIf: { question_key: "tipo", op: "equals", value: "medicacao" },
  });

  it("requires the item when the condition holds and it is unanswered", () => {
    const answers = answerState({ i1: { key: "q1", value: "" } });
    const fb = validateSectionRules(
      section([conditional]),
      { answers },
      { tipo: "medicacao" },
    );
    expect(fb.errors.i1).toBe("Esta pergunta é obrigatória.");
  });

  it("does NOT require it when the condition does not hold", () => {
    const answers = answerState({ i1: { key: "q1", value: "" } });
    const fb = validateSectionRules(
      section([conditional]),
      { answers },
      { tipo: "outro" },
    );
    expect(fb.errors).toEqual({});
  });

  it("is satisfied once answered", () => {
    const answers = answerState({ i1: { key: "q1", value: "algo" } });
    const fb = validateSectionRules(
      section([conditional]),
      { answers },
      { tipo: "medicacao" },
    );
    expect(fb.errors).toEqual({});
  });

  it("NEVER requires a HIDDEN item, whatever required_if says", () => {
    const answers = answerState({ i1: { key: "q1", value: "" } });
    const fb = validateSectionRules(
      section([conditional]),
      { answers },
      { tipo: "medicacao" },
      new Set<string>(),
    );
    expect(fb.errors).toEqual({});
  });

  it("leaves plain `required` to the other pass (no duplicate report)", () => {
    const always = item({ required: true, validations: [] });
    const answers = answerState({ i1: { key: "q1", value: "" } });
    const fb = validateSectionRules(section([always]), { answers }, {});
    expect(fb.errors).toEqual({});
  });
});

describe("validateInstanceRules — placement per repetition", () => {
  const child = item({
    id: "c1",
    questionKey: "dose",
    validations: [rule({ config: { min: 3 }, message: "Muito curto." })],
  });
  const group = item({
    id: "g1",
    itemType: "repeating_group",
    questionKey: null,
    children: [child],
  });
  const visibleAll = new Map<string, Set<string>>([
    ["inst-1", new Set(["c1"])],
    ["inst-2", new Set(["c1"])],
  ]);

  it("marks ONLY the offending repetition", () => {
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance("inst-1", "g1", 0, answerState({ c1: { key: "dose", value: "500mg" } })),
          instance("inst-2", "g1", 1, answerState({ c1: { key: "dose", value: "ab" } })),
        ],
      },
      {},
      visibleAll,
    );
    expect(fb.errors).toEqual({ "inst-2:c1": "Muito curto." });
    expect(fb.errors["inst-1:c1"]).toBeUndefined();
  });

  /**
   * ⚠ This one needs `required_if`, not a bounds rule, to have any force.
   *
   * With a `text_length` rule the assertion is VACUOUS: `evalValidation` treats an
   * empty value as satisfied, so a blank repetition reports nothing whether it was
   * pruned or not — the test passes under both readings and proves neither. Only a
   * rule that fires ON emptiness distinguishes them, and `required_if` is the one.
   * Confirmed by mutation: removing the prune turns THIS red and left the
   * bounds-shaped version green.
   */
  it("reports nothing for a wholly EMPTY repetition (prune, then check)", () => {
    const conditionalChild = item({
      id: "c1",
      questionKey: "dose",
      required: false,
      // Holds against the top-level map, so an unpruned blank row WOULD be
      // reported as "obrigatória" — which is precisely the wrong advice: the fix
      // is to remove the row, not to fill it.
      requiredIf: { question_key: "tipo", op: "equals", value: "medicacao" },
      validations: [],
    });
    const conditionalGroup = item({
      id: "g1",
      itemType: "repeating_group",
      questionKey: null,
      children: [conditionalChild],
    });

    const fb = validateInstanceRules(
      section([conditionalGroup]),
      {
        g1: [
          instance("inst-1", "g1", 0, answerState({ c1: { key: "dose", value: "" } })),
        ],
      },
      { tipo: "medicacao" },
      new Map([["inst-1", new Set(["c1"])]]),
    );
    expect(fb.errors).toEqual({});
  });

  it("DOES report a conditionally-required child in a repetition that has content", () => {
    // The positive twin of the test above: without it, "reports nothing" would
    // also pass if the required_if arm simply never ran inside instances.
    const conditionalChild = item({
      id: "c1",
      questionKey: "dose",
      required: false,
      requiredIf: { question_key: "tipo", op: "equals", value: "medicacao" },
      validations: [],
    });
    const other = item({ id: "c2", questionKey: "nome", validations: [] });
    const conditionalGroup = item({
      id: "g1",
      itemType: "repeating_group",
      questionKey: null,
      children: [conditionalChild, other],
    });

    const fb = validateInstanceRules(
      section([conditionalGroup]),
      {
        g1: [
          instance(
            "inst-1",
            "g1",
            0,
            answerState({
              c1: { key: "dose", value: "" },
              // Something else IS answered, so the repetition is not empty and
              // survives the prune.
              c2: { key: "nome", value: "Dipirona" },
            }),
          ),
        ],
      },
      { tipo: "medicacao" },
      new Map([["inst-1", new Set(["c1", "c2"])]]),
    );
    expect(fb.errors["inst-1:c1"]).toBe("Esta pergunta é obrigatória.");
  });

  it("skips the whole group when the CONTAINER is hidden", () => {
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance("inst-1", "g1", 0, answerState({ c1: { key: "dose", value: "ab" } })),
        ],
      },
      {},
      visibleAll,
      new Set<string>(), // container hidden
    );
    expect(fb.errors).toEqual({});
  });
});

describe("validateInstanceRules — unique_within_group", () => {
  const child = item({
    id: "c1",
    questionKey: "lote",
    validations: [
      rule({ ruleType: "unique_within_group", config: {}, message: "Lote repetido." }),
    ],
  });
  const group = item({
    id: "g1",
    itemType: "repeating_group",
    questionKey: null,
    children: [child],
  });
  const visible = new Map<string, Set<string>>([
    ["inst-1", new Set(["c1"])],
    ["inst-2", new Set(["c1"])],
    ["inst-3", new Set(["c1"])],
  ]);

  it("flags a duplicate across two non-empty repetitions (both sides)", () => {
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance("inst-1", "g1", 0, answerState({ c1: { key: "lote", value: "A1" } })),
          instance("inst-2", "g1", 1, answerState({ c1: { key: "lote", value: "A1" } })),
        ],
      },
      {},
      visible,
    );
    expect(fb.errors["inst-1:c1"]).toBe("Lote repetido.");
    expect(fb.errors["inst-2:c1"]).toBe("Lote repetido.");
  });

  it("accepts distinct values", () => {
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance("inst-1", "g1", 0, answerState({ c1: { key: "lote", value: "A1" } })),
          instance("inst-2", "g1", 1, answerState({ c1: { key: "lote", value: "B2" } })),
        ],
      },
      {},
      visible,
    );
    expect(fb.errors).toEqual({});
  });

  it("does not count an EMPTIED repetition as a peer", () => {
    // inst-2 was cleared, so it is pruned and contributes no peer value —
    // inst-1's "A1" is then unique even though a blank row sits beside it.
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance("inst-1", "g1", 0, answerState({ c1: { key: "lote", value: "A1" } })),
          instance("inst-2", "g1", 1, answerState({ c1: { key: "lote", value: "" } })),
        ],
      },
      {},
      visible,
    );
    expect(fb.errors).toEqual({});
  });

  it("does not let a top-level answer leak in as a peer", () => {
    // A blank child must contribute NOTHING, not the top-level fallback for the
    // same question_key — otherwise two blank rows would collide against it.
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance("inst-1", "g1", 0, answerState({ c1: { key: "lote", value: "A1" } })),
          instance("inst-2", "g1", 1, answerState({ c1: { key: "lote", value: "X9" } })),
        ],
      },
      { lote: "A1" }, // a top-level answer under the SAME key
      visible,
    );
    // inst-2's peer set is {A1} from inst-1 only; its own value X9 is unique.
    expect(fb.errors["inst-2:c1"]).toBeUndefined();
  });
});

describe("validateInstanceRules — datetime_order resolves the SAME-instance sibling", () => {
  const start = item({ id: "cs", itemType: "date", questionKey: "inicio" });
  const end = item({
    id: "ce",
    itemType: "date",
    questionKey: "fim",
    validations: [
      rule({
        ruleType: "datetime_order",
        config: { op: "after", question_key: "inicio" },
        message: "O fim deve ser depois do início.",
      }),
    ],
  });
  const group = item({
    id: "g1",
    itemType: "repeating_group",
    questionKey: null,
    children: [start, end],
  });
  const visible = new Map<string, Set<string>>([
    ["inst-1", new Set(["cs", "ce"])],
    ["inst-2", new Set(["cs", "ce"])],
  ]);

  it("compares within the repetition, not across repetitions", () => {
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          // valid: fim > inicio
          instance(
            "inst-1",
            "g1",
            0,
            answerState({
              cs: { key: "inicio", value: "2026-01-01" },
              ce: { key: "fim", value: "2026-01-05" },
            }),
          ),
          // invalid WITHIN itself, even though it would pass against inst-1
          instance(
            "inst-2",
            "g1",
            1,
            answerState({
              cs: { key: "inicio", value: "2026-03-01" },
              ce: { key: "fim", value: "2026-02-01" },
            }),
          ),
        ],
      },
      {},
      visible,
    );
    expect(fb.errors["inst-1:ce"]).toBeUndefined();
    expect(fb.errors["inst-2:ce"]).toBe("O fim deve ser depois do início.");
  });

  it("is inert when the compared sibling is unanswered in this repetition", () => {
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance(
            "inst-1",
            "g1",
            0,
            answerState({
              cs: { key: "inicio", value: "" },
              ce: { key: "fim", value: "2026-02-01" },
            }),
          ),
        ],
      },
      {},
      new Map([["inst-1", new Set(["cs", "ce"])]]),
    );
    expect(fb.errors).toEqual({});
  });
});
