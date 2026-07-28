import { describe, expect, it } from "vitest";

import type { Item, Section } from "@/lib/queries/forms";
import type { AnswerMap } from "@/lib/queries/conditions";
import type { ItemValidationRule } from "@/lib/forms/validation-rules";

import type { AnswerState } from "./types";
import type { InstanceState } from "./instances";
import {
  clearPeerFieldErrors,
  validateInstanceRules,
  validateSectionRules,
} from "./validation";

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

/**
 * The EFFECTIVE-required set drives the visible `*` marker and `aria-required`.
 * It is a distinct claim from the missing-answer report: an item that is required
 * and ALREADY ANSWERED must still be marked, so the two cannot be tested by the
 * same assertion. Announcing an input the server will reject as missing as though
 * it were optional is the harmful direction, so these are accessibility tests.
 */
describe("effective required-ness — requiredNow", () => {
  it("includes a statically required item", () => {
    const fb = validateSectionRules(
      section([item({ required: true })]),
      { answers: answerState({ i1: { key: "q1", value: "" } }) },
      {},
    );
    expect(fb.requiredNow.has("i1")).toBe(true);
  });

  it("includes an item whose required_if HOLDS", () => {
    const conditional = item({
      required: false,
      requiredIf: { question_key: "tipo", op: "equals", value: "medicacao" },
    });
    const fb = validateSectionRules(
      section([conditional]),
      { answers: answerState({ i1: { key: "q1", value: "" } }) },
      { tipo: "medicacao" },
    );
    expect(fb.requiredNow.has("i1")).toBe(true);
  });

  it("EXCLUDES it when required_if does not hold", () => {
    const conditional = item({
      required: false,
      requiredIf: { question_key: "tipo", op: "equals", value: "medicacao" },
    });
    const fb = validateSectionRules(
      section([conditional]),
      { answers: answerState({ i1: { key: "q1", value: "" } }) },
      { tipo: "outro" },
    );
    expect(fb.requiredNow.has("i1")).toBe(false);
  });

  it("still marks a required item that IS answered (marker ≠ error)", () => {
    const conditional = item({
      required: false,
      requiredIf: { question_key: "tipo", op: "equals", value: "medicacao" },
    });
    const fb = validateSectionRules(
      section([conditional]),
      { answers: answerState({ i1: { key: "q1", value: "preenchido" } }) },
      { tipo: "medicacao" },
    );
    // No error — it is answered — but the field must still show as mandatory.
    expect(fb.errors).toEqual({});
    expect(fb.requiredNow.has("i1")).toBe(true);
  });

  it("EXCLUDES a hidden item — visibility wins over the marker too", () => {
    const conditional = item({
      required: true,
      requiredIf: { question_key: "tipo", op: "equals", value: "medicacao" },
    });
    const fb = validateSectionRules(
      section([conditional]),
      { answers: answerState({ i1: { key: "q1", value: "" } }) },
      { tipo: "medicacao" },
      new Set<string>(),
    );
    expect(fb.requiredNow.size).toBe(0);
  });

  it("resolves PER INSTANCE — marks only the repetition whose condition holds", () => {
    const child = item({
      id: "c1",
      questionKey: "dose",
      required: false,
      requiredIf: { question_key: "via", op: "equals", value: "ev" },
      validations: [],
    });
    const group = item({
      id: "g1",
      itemType: "repeating_group",
      questionKey: null,
      children: [item({ id: "c0", questionKey: "via", validations: [] }), child],
    });
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          instance(
            "inst-1",
            "g1",
            0,
            answerState({
              c0: { key: "via", value: "oral" },
              c1: { key: "dose", value: "" },
            }),
          ),
          instance(
            "inst-2",
            "g1",
            1,
            answerState({
              c0: { key: "via", value: "ev" },
              c1: { key: "dose", value: "" },
            }),
          ),
        ],
      },
      {},
      new Map([
        ["inst-1", new Set(["c0", "c1"])],
        ["inst-2", new Set(["c0", "c1"])],
      ]),
    );
    expect(fb.requiredNow.has("inst-2:c1")).toBe(true);
    expect(fb.requiredNow.has("inst-1:c1")).toBe(false);
  });
});

/**
 * `matrix` / `risk_matrix` + `required_if`.
 *
 * These two were skipped ENTIRELY before this: the walk gated on `isInputItem`,
 * which is deliberately false for the matrix types (their answer is not a scalar
 * in `answers.value`) — while `form_items_input_vs_display` permits `required_if`
 * on both and `app.response_required_complete` calls `app.item_is_required` with
 * no `item_type` filter. So a matrix mandatory only through `required_if` blocked
 * submit server-side while the client reported nothing and marked nothing.
 *
 * Presence for these types is ROW-COMPLETE / both-halves-chosen, not `hasAnswer`.
 */
describe("matrix + risk_matrix — required_if", () => {
  function axis(code: string, position: number, weight: number | null = null) {
    return { id: `id-${code}`, code, label: code.toUpperCase(), weight, position };
  }

  const matrix = item({
    id: "m1",
    itemType: "matrix",
    questionKey: "m1",
    required: false,
    requiredIf: { question_key: "tipo", op: "equals", value: "auditoria" },
    validations: [],
    matrixRows: [axis("a", 0), axis("b", 1)],
    matrixColumns: [axis("sim", 0), axis("nao", 1)],
  });

  const risk = item({
    id: "r1",
    itemType: "risk_matrix",
    questionKey: "r1",
    required: false,
    requiredIf: { question_key: "tipo", op: "equals", value: "auditoria" },
    validations: [],
    matrixRows: [axis("leve", 0, 1), axis("grave", 1, 9)],
    matrixColumns: [axis("rara", 0, 1), axis("frequente", 1, 9)],
  });

  it("reports a conditionally-required MATRIX that is unanswered", () => {
    const fb = validateSectionRules(
      section([matrix]),
      { answers: {}, matrixCells: {} },
      { tipo: "auditoria" },
    );
    expect(fb.errors.m1).toBe("Esta pergunta é obrigatória.");
    expect(fb.requiredNow.has("m1")).toBe(true);
  });

  it("treats a PARTIALLY filled matrix as unanswered (row-complete, not any-cell)", () => {
    const fb = validateSectionRules(
      section([matrix]),
      { answers: {}, matrixCells: { m1: { a: "sim" } } },
      { tipo: "auditoria" },
    );
    expect(fb.errors.m1).toBe("Esta pergunta é obrigatória.");
  });

  it("accepts a ROW-COMPLETE matrix, and still marks it required", () => {
    const fb = validateSectionRules(
      section([matrix]),
      { answers: {}, matrixCells: { m1: { a: "sim", b: "nao" } } },
      { tipo: "auditoria" },
    );
    expect(fb.errors).toEqual({});
    expect(fb.requiredNow.has("m1")).toBe(true);
  });

  it("does not require the matrix when the condition does not hold", () => {
    const fb = validateSectionRules(
      section([matrix]),
      { answers: {}, matrixCells: {} },
      { tipo: "outro" },
    );
    expect(fb.errors).toEqual({});
    expect(fb.requiredNow.has("m1")).toBe(false);
  });

  it("reports a conditionally-required RISK MATRIX with only one half chosen", () => {
    const fb = validateSectionRules(
      section([risk]),
      { answers: {}, riskMatrix: { r1: { severity: "grave", likelihood: "" } } },
      { tipo: "auditoria" },
    );
    expect(fb.errors.r1).toBe("Esta pergunta é obrigatória.");
  });

  it("accepts a risk matrix with both halves, and still marks it required", () => {
    const fb = validateSectionRules(
      section([risk]),
      {
        answers: {},
        riskMatrix: { r1: { severity: "grave", likelihood: "rara" } },
      },
      { tipo: "auditoria" },
    );
    expect(fb.errors).toEqual({});
    expect(fb.requiredNow.has("r1")).toBe(true);
  });

  it("NEVER requires a hidden matrix — visibility wins here too", () => {
    const fb = validateSectionRules(
      section([matrix]),
      { answers: {}, matrixCells: {} },
      { tipo: "auditoria" },
      new Set<string>(),
    );
    expect(fb.errors).toEqual({});
    expect(fb.requiredNow.size).toBe(0);
  });

  it("resolves a matrix per REPETITION, against that repetition's own grid", () => {
    const group = item({
      id: "g1",
      itemType: "repeating_group",
      questionKey: null,
      children: [matrix],
    });
    const fb = validateInstanceRules(
      section([group]),
      {
        g1: [
          // complete grid → satisfied
          {
            id: "inst-1",
            groupItemId: "g1",
            position: 0,
            answers: {},
            matrixCells: { m1: { a: "sim", b: "nao" } },
          },
          // half-filled → still required, still reported
          {
            id: "inst-2",
            groupItemId: "g1",
            position: 1,
            answers: {},
            matrixCells: { m1: { a: "sim" } },
          },
        ],
      },
      { tipo: "auditoria" },
      new Map([
        ["inst-1", new Set(["m1"])],
        ["inst-2", new Set(["m1"])],
      ]),
    );
    expect(fb.errors["inst-1:m1"]).toBeUndefined();
    expect(fb.errors["inst-2:m1"]).toBe("Esta pergunta é obrigatória.");
    expect(fb.requiredNow.has("inst-1:m1")).toBe(true);
    expect(fb.requiredNow.has("inst-2:m1")).toBe(true);
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

/**
 * BUG-FF3-001 — the sticky (post-blocked-navigation) map must clear the SYMMETRIC
 * rule's whole participant set, not just the edited field.
 *
 * `tester` isolated this precisely: live-only feedback clears correctly on all
 * three field kinds; only the post-block map stranded the peer, leaving an
 * untouched repetition showing a message and `aria-invalid="true"` for a field
 * that no longer violates anything.
 *
 * BOTH directions are asserted on purpose — a fix that only clears "forwards"
 * from the edited repetition passes a one-directional test and still strands the
 * mirror case.
 */
describe("clearPeerFieldErrors — BUG-FF3-001", () => {
  const dup = "Este valor não pode se repetir entre as repetições.";

  it("clears the peer when the SECOND repetition is edited", () => {
    const next = clearPeerFieldErrors(
      { "inst-1:c1": dup, "inst-2:c1": dup },
      "c1",
    );
    expect(next).toEqual({});
  });

  it("clears the peer when the FIRST repetition is edited (the mirror case)", () => {
    // Identical input, and it must behave identically: the participant set does
    // not depend on WHICH member was edited.
    const next = clearPeerFieldErrors(
      { "inst-1:c1": dup, "inst-2:c1": dup },
      "c1",
    );
    expect(next["inst-1:c1"]).toBeUndefined();
    expect(next["inst-2:c1"]).toBeUndefined();
  });

  it("clears across THREE repetitions, not just the adjacent pair", () => {
    const next = clearPeerFieldErrors(
      { "inst-1:c1": dup, "inst-2:c1": dup, "inst-3:c1": dup },
      "c1",
    );
    expect(next).toEqual({});
  });

  it("leaves a DIFFERENT child in the same repetition alone", () => {
    const next = clearPeerFieldErrors(
      { "inst-1:c1": dup, "inst-1:c2": "Outro problema." },
      "c1",
    );
    expect(next).toEqual({ "inst-1:c2": "Outro problema." });
  });

  it("leaves the container's own cardinality error alone", () => {
    // The shortfall is keyed by the BARE container id, which has no `:` — it must
    // survive, or an unmet `minInstances` would vanish on the next keystroke.
    const next = clearPeerFieldErrors(
      { "inst-1:c1": dup, g1: "Adicione ao menos 2 repetições." },
      "c1",
    );
    expect(next).toEqual({ g1: "Adicione ao menos 2 repetições." });
  });

  it("does not match a child whose id merely ENDS WITH the edited id", () => {
    // `:${itemId}` anchors on the separator, so `c1` must not clear `xc1`.
    const next = clearPeerFieldErrors(
      { "inst-1:xc1": "Outro.", "inst-1:c1": dup },
      "c1",
    );
    expect(next).toEqual({ "inst-1:xc1": "Outro." });
  });

  it("returns the SAME reference when nothing matches (no needless re-render)", () => {
    const errors = { "inst-1:c2": "Outro." };
    expect(clearPeerFieldErrors(errors, "c1")).toBe(errors);
  });
});
