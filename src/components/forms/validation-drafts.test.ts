import { describe, expect, it } from "vitest";

import type { Item, Section } from "@/lib/queries/forms";
import {
  CLIENT_UNEVALUATED_RULE_TYPES,
  VALIDATION_RULE_TYPES,
} from "@/lib/forms/validation-rules";
import type { ItemValidationRule } from "@/lib/forms/validation-rules";
import {
  allowedRuleTypes,
  blankDraft,
  datetimeOrderTargets,
  itemAcceptsValidations,
  parentItemTypeOf,
  toRuleConfig,
  regexCompilesInJs,
  toRuleDrafts,
  toRulePayload,
  validateRuleDrafts,
  type RuleDraft,
} from "./validation-drafts";

/**
 * FF-3 (ADR 0090) — the builder's pure validation-rule layer.
 *
 * The evaluator itself is covered by the SQL↔TS golden vectors; what is covered
 * here is everything the BUILDER can get wrong on its own: offering a rule the
 * coverage trigger would refuse, smuggling a stale buffer across a type change,
 * mis-numbering `position`, or letting a rule through with no message (which the
 * database would refuse with a CHECK the author cannot read).
 */

/** The pre-flight's message, or undefined when the list is clean. m-5b turned the
 *  return into `{ index, message }`; the assertions below care about the text. */
function problemText(
  drafts: RuleDraft[],
): string | undefined {
  return validateRuleDrafts(drafts)?.message;
}

function draft(over: Partial<RuleDraft> = {}): RuleDraft {
  return {
    key: "k1",
    ruleType: "number_range",
    severity: "error",
    message: "Informe um valor válido.",
    min: "",
    max: "",
    pattern: "",
    caseInsensitive: false,
    op: "before",
    questionKey: "",
    ...over,
  };
}

/** A minimal item. Only the fields this module reads are meaningful; the cast
 *  keeps the fixture honest about being partial rather than inventing values. */
function item(over: Partial<Item>): Item {
  return {
    id: "i1",
    itemType: "short_text",
    questionKey: "q1",
    label: "Pergunta",
    children: [],
    ...over,
  } as unknown as Item;
}

function section(position: number, items: Item[]): Section {
  return { id: `s${position}`, position, items } as unknown as Section;
}

describe("coverage — allowedRuleTypes / itemAcceptsValidations", () => {
  it("offers the text rules on short_text, and not the numeric one", () => {
    const types = allowedRuleTypes("short_text", null);
    expect(types).toContain("text_length");
    expect(types).toContain("regex");
    expect(types).not.toContain("number_range");
    expect(types).not.toContain("date_range");
  });

  it("offers number_range only on number", () => {
    expect(allowedRuleTypes("number", null)).toEqual(["number_range"]);
  });

  it("offers date_range + datetime_order on date and time", () => {
    for (const t of ["date", "time"]) {
      expect(allowedRuleTypes(t, null)).toEqual(["date_range", "datetime_order"]);
    }
  });

  it("offers unique_within_group ONLY inside a repeating_group", () => {
    expect(allowedRuleTypes("short_text", "repeating_group")).toContain(
      "unique_within_group",
    );
    // A plain `group`'s children answer at top level — there are no instances to
    // be unique across, so the rule is meaningless there.
    expect(allowedRuleTypes("short_text", "group")).not.toContain(
      "unique_within_group",
    );
    expect(allowedRuleTypes("short_text", null)).not.toContain(
      "unique_within_group",
    );
  });

  it("accepts NO rule on containers, display items, matrix, risk_matrix, reference", () => {
    for (const t of [
      "group",
      "repeating_group",
      "section_text",
      "image",
      "matrix",
      "risk_matrix",
      "reference",
    ]) {
      expect(itemAcceptsValidations(t, null)).toBe(false);
      expect(allowedRuleTypes(t, null)).toEqual([]);
    }
  });

  it("blankDraft starts on a type the item actually allows", () => {
    expect(allowedRuleTypes("number", null)).toContain(
      blankDraft("number", null).ruleType,
    );
    expect(allowedRuleTypes("date", null)).toContain(
      blankDraft("date", null).ruleType,
    );
  });
});

describe("toRuleConfig — the config is keyed on ruleType", () => {
  it("emits only the bounds that are set, as numbers", () => {
    expect(toRuleConfig(draft({ ruleType: "number_range", min: "3.5" }))).toEqual({
      min: 3.5,
    });
    expect(
      toRuleConfig(draft({ ruleType: "number_range", min: "-2", max: "10" })),
    ).toEqual({ min: -2, max: 10 });
  });

  it("truncates text_length bounds to integers", () => {
    expect(
      toRuleConfig(draft({ ruleType: "text_length", min: "2.9", max: "10.7" })),
    ).toEqual({ min: 2, max: 10 });
  });

  it("omits caseInsensitive unless set", () => {
    expect(toRuleConfig(draft({ ruleType: "regex", pattern: "^a$" }))).toEqual({
      pattern: "^a$",
    });
    expect(
      toRuleConfig(
        draft({ ruleType: "regex", pattern: "^a$", caseInsensitive: true }),
      ),
    ).toEqual({ pattern: "^a$", caseInsensitive: true });
  });

  it("keeps date/time bounds as the ISO strings both evaluators compare", () => {
    expect(
      toRuleConfig(
        draft({ ruleType: "date_range", min: "2026-01-01", max: "2026-12-31" }),
      ),
    ).toEqual({ min: "2026-01-01", max: "2026-12-31" });
  });

  it("emits the datetime_order pair", () => {
    expect(
      toRuleConfig(
        draft({ ruleType: "datetime_order", op: "not_after", questionKey: "fim" }),
      ),
    ).toEqual({ op: "not_after", question_key: "fim" });
  });

  it("emits {} for unique_within_group", () => {
    expect(toRuleConfig(draft({ ruleType: "unique_within_group" }))).toEqual({});
  });

  it("does NOT smuggle a stale buffer across a type change", () => {
    // The author typed a regex, then switched the rule to text_length. The
    // pattern must not ride along, and the length bounds must not carry a
    // pattern-shaped leftover.
    const switched = draft({
      ruleType: "text_length",
      pattern: "^[0-9]+$",
      min: "5",
    });
    expect(toRuleConfig(switched)).toEqual({ min: 5 });
    expect(toRuleConfig(switched)).not.toHaveProperty("pattern");

    const back = draft({
      ruleType: "regex",
      pattern: "^x$",
      min: "5",
      max: "9",
      questionKey: "fim",
    });
    expect(toRuleConfig(back)).toEqual({ pattern: "^x$" });
  });
});

describe("toRulePayload — position is the array index", () => {
  it("numbers the rules by their order, from 0, and trims the message", () => {
    const payload = toRulePayload([
      draft({ key: "a", min: "1", message: "  primeira  " }),
      draft({ key: "b", ruleType: "number_range", max: "9", message: "segunda" }),
    ]);
    expect(payload.map((r) => r.position)).toEqual([0, 1]);
    expect(payload[0].message).toBe("primeira");
    expect(payload[1].config).toEqual({ max: 9 });
  });
});

describe("toRuleDrafts — read-back for editing", () => {
  function rule(over: Partial<ItemValidationRule>): ItemValidationRule {
    return {
      id: "r1",
      itemId: "i1",
      formVersionId: "v1",
      position: 0,
      ruleType: "number_range",
      config: { min: 1 },
      severity: "error",
      message: "msg",
      ...over,
    } as ItemValidationRule;
  }

  it("sorts by position, not by arrival order", () => {
    const drafts = toRuleDrafts([
      rule({ id: "b", position: 1, message: "segunda" }),
      rule({ id: "a", position: 0, message: "primeira" }),
    ]);
    expect(drafts.map((d) => d.message)).toEqual(["primeira", "segunda"]);
  });

  it("round-trips every rule type through drafts and back to config", () => {
    const cases: ItemValidationRule[] = [
      rule({ ruleType: "number_range", config: { min: 1, max: 5 } }),
      rule({ ruleType: "text_length", config: { min: 2, max: 8 } }),
      rule({ ruleType: "regex", config: { pattern: "^a+$", caseInsensitive: true } }),
      rule({ ruleType: "date_range", config: { min: "2026-01-01" } }),
      rule({
        ruleType: "datetime_order",
        config: { op: "after", question_key: "inicio" },
      }),
      rule({ ruleType: "unique_within_group", config: {} }),
    ];
    for (const r of cases) {
      const [d] = toRuleDrafts([r]);
      expect(d.ruleType).toBe(r.ruleType);
      expect(toRuleConfig(d)).toEqual(r.config);
    }
  });

  it("returns [] for null/empty rather than a phantom row", () => {
    expect(toRuleDrafts(null)).toEqual([]);
    expect(toRuleDrafts(undefined)).toEqual([]);
    expect(toRuleDrafts([])).toEqual([]);
  });

  it("falls back to a valid op when a stored datetime_order op is unrecognized", () => {
    const [d] = toRuleDrafts([
      rule({
        ruleType: "datetime_order",
        // Not in DATETIME_ORDER_OPS — must not become the emitted value.
        config: { op: "sideways", question_key: "x" } as never,
      }),
    ]);
    expect(["before", "after", "not_before", "not_after"]).toContain(d.op);
  });
});

describe("validateRuleDrafts — the pre-flight", () => {
  it("passes a well-formed list", () => {
    expect(
      validateRuleDrafts([
        draft({ ruleType: "number_range", min: "0", max: "10" }),
        draft({ key: "k2", ruleType: "number_range", max: "5" }),
      ]),
    ).toBeNull();
  });

  it("requires a message — the database CHECK the author cannot read", () => {
    expect(problemText([draft({ min: "1", message: "   " })])).toMatch(
      /mensagem/i,
    );
  });

  it("requires at least one bound on the bounded types", () => {
    for (const t of ["number_range", "text_length", "date_range"] as const) {
      expect(problemText([draft({ ruleType: t })])).toMatch(/limite/i);
    }
  });

  it("rejects min > max", () => {
    expect(
      problemText([draft({ ruleType: "number_range", min: "10", max: "2" })]),
    ).toMatch(/maior que o máximo/i);
    expect(
      problemText([
        draft({ ruleType: "date_range", min: "2026-12-31", max: "2026-01-01" }),
      ]),
    ).toMatch(/posterior ao final/i);
  });

  it("rejects a negative character count", () => {
    expect(
      problemText([draft({ ruleType: "text_length", min: "-1" })]),
    ).toMatch(/negativo/i);
  });

  it("rejects an empty or over-long regex", () => {
    expect(problemText([draft({ ruleType: "regex" })])).toMatch(/padrão/i);
    expect(
      problemText([
        draft({ ruleType: "regex", pattern: "a".repeat(201) }),
      ]),
    ).toMatch(/200/);
  });

  /**
   * JS-compilability must NOT block the save.
   *
   * `***=literal` is the measured case: a valid POSIX ARE director that Postgres
   * accepts AND matches with, on which `new RegExp` throws. Blocking on JS would
   * refuse a correct rule — the same dead end FF-3's Amendment 4 removes at fill
   * time, relocated to authoring. Since Amendment 4 the TS twin does not evaluate
   * `regex` at all, so JS has no standing to adjudicate one.
   */
  it("ACCEPTS a pattern JS cannot compile but Postgres can", () => {
    expect(regexCompilesInJs("***=literal")).toBe(false);
    expect(
      problemText([draft({ ruleType: "regex", pattern: "***=literal" })]),
    ).toBeUndefined();
  });

  it("still reports JS-uncompilability as advisory, for the editor's hint", () => {
    expect(regexCompilesInJs("([unclosed")).toBe(false);
    expect(regexCompilesInJs("^[0-9]{11}$")).toBe(true);
    // ...but it never blocks: a likely typo is surfaced, not refused.
    expect(
      problemText([draft({ ruleType: "regex", pattern: "([unclosed" })]),
    ).toBeUndefined();
  });

  it("requires the compared question on datetime_order", () => {
    expect(
      problemText([draft({ ruleType: "datetime_order", questionKey: "" })]),
    ).toMatch(/pergunta/i);
  });

  it("accepts unique_within_group with no config at all", () => {
    expect(
      validateRuleDrafts([draft({ ruleType: "unique_within_group" })]),
    ).toBeNull();
  });

  /**
   * Regression: the loop originally returned on the FIRST draft, so a bad rule
   * anywhere after position 1 was accepted and then refused by the server.
   */
  it("checks EVERY rule, not just the first", () => {
    const problem = validateRuleDrafts([
      draft({ key: "ok1", ruleType: "number_range", min: "1" }),
      draft({ key: "ok2", ruleType: "number_range", max: "9" }),
      draft({ key: "bad", ruleType: "regex", pattern: "" }),
    ]);
    expect(problem).not.toBeNull();
    // ...and it names the offending rule by its 1-based position...
    expect(problem?.message).toMatch(/regra 3/i);
    // ...while carrying the 0-based INDEX, which is what lets the editor render
    // the message inside that rule's card rather than only in a banner (m-5b).
    expect(problem?.index).toBe(2);
  });

  it("names the offending rule by its 1-based position", () => {
    expect(
      problemText([
        draft({ key: "a", min: "1" }),
        draft({ key: "b", message: "" }),
      ]),
    ).toMatch(/regra 2/i);
  });
});

describe("datetimeOrderTargets — scope, not document order", () => {
  const inicio = item({ id: "d1", itemType: "date", questionKey: "inicio", label: "Início" });
  const fim = item({ id: "d2", itemType: "date", questionKey: "fim", label: "Fim" });
  const hora = item({ id: "t1", itemType: "time", questionKey: "hora", label: "Hora" });
  const texto = item({ id: "x1", itemType: "short_text", questionKey: "obs" });

  it("offers LATER date/time siblings (a comparison may point forward)", () => {
    const sections = [section(0, [inicio, fim, texto])];
    const targets = datetimeOrderTargets(sections, "d1");
    expect(targets.map((t) => t.questionKey)).toEqual(["fim"]);
  });

  it("excludes the item itself and every non-date/time question", () => {
    const sections = [section(0, [inicio, fim, hora, texto])];
    const keys = datetimeOrderTargets(sections, "d1").map((t) => t.questionKey);
    expect(keys).not.toContain("inicio");
    expect(keys).not.toContain("obs");
    expect(keys).toEqual(["fim", "hora"]);
  });

  it("keeps a repeating-group child inside its own instance scope", () => {
    const childA = item({ id: "ca", itemType: "date", questionKey: "g_inicio" });
    const childB = item({ id: "cb", itemType: "date", questionKey: "g_fim" });
    const group = item({
      id: "g1",
      itemType: "repeating_group",
      questionKey: null,
      children: [childA, childB],
    });
    const sections = [section(0, [inicio, group])];

    // Inside the group: only the same-instance sibling, never the top-level date.
    expect(datetimeOrderTargets(sections, "ca").map((t) => t.questionKey)).toEqual([
      "g_fim",
    ]);
    // Outside the group: the group's children are not offered — with N instances
    // there is no single value to compare against.
    expect(datetimeOrderTargets(sections, "d1").map((t) => t.questionKey)).toEqual(
      [],
    );
  });

  it("treats a plain group's children as top level", () => {
    const child = item({ id: "pc", itemType: "date", questionKey: "p_data" });
    const plain = item({
      id: "p1",
      itemType: "group",
      questionKey: null,
      children: [child],
    });
    const sections = [section(0, [inicio, plain])];
    expect(datetimeOrderTargets(sections, "d1").map((t) => t.questionKey)).toEqual([
      "p_data",
    ]);
  });

  it("returns [] when the item is not in the tree", () => {
    expect(datetimeOrderTargets([section(0, [inicio])], "nope")).toEqual([]);
  });

  it("spans sections", () => {
    const sections = [section(0, [inicio]), section(1, [fim])];
    expect(datetimeOrderTargets(sections, "d1").map((t) => t.questionKey)).toEqual([
      "fim",
    ]);
  });
});

describe("parentItemTypeOf", () => {
  it("distinguishes a repeating_group parent from a plain group parent", () => {
    const rgChild = item({ id: "rc" });
    const gChild = item({ id: "gc" });
    const sections = [
      section(0, [
        item({ id: "rg", itemType: "repeating_group", children: [rgChild] }),
        item({ id: "g", itemType: "group", children: [gChild] }),
        item({ id: "top" }),
      ]),
    ];
    expect(parentItemTypeOf(sections, "rc")).toBe("repeating_group");
    expect(parentItemTypeOf(sections, "gc")).toBe("group");
    expect(parentItemTypeOf(sections, "top")).toBeNull();
  });
});

/**
 * QA r2 — a `warn` + `regex` rule is INERT and the author must be told.
 *
 * Since Amendment 4 the client does not evaluate `regex`, and the server reports
 * rules only when it REFUSES a submit — which `warn` never causes. So the pairing
 * can never surface anywhere, to anyone. Authoring time is the only place it can
 * be said, because there is no filler-facing symptom to notice later.
 *
 * This pins the vocabulary the builder's note keys on; the note itself is
 * asserted in the editor's render suite.
 */
describe("client-unevaluated rule types (QA r2)", () => {
  it("names `regex` and only `regex`", () => {
    expect([...CLIENT_UNEVALUATED_RULE_TYPES]).toEqual(["regex"]);
  });

  it("every other rule type IS client-evaluated", () => {
    for (const t of VALIDATION_RULE_TYPES) {
      if (t === "regex") continue;
      expect(CLIENT_UNEVALUATED_RULE_TYPES).not.toContain(t);
    }
  });
});
