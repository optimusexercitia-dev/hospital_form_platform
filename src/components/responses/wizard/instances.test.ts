import { describe, expect, it } from "vitest";

import type { Item, ItemType, Section } from "@/lib/queries/forms";
import type { AnswerMap } from "@/lib/queries/conditions";

import { computeInstanceVisibility } from "./effective-visibility";
import {
  canAddInstance,
  describeInstanceShortfall,
  isEmptyInstance,
  survivingInstances,
  type InstanceState,
} from "./instances";
import { collectInstances, topLevelItems } from "./collect";
import { validateInstances } from "./validation";
import type { AnswerState } from "./types";

/**
 * Unit coverage for FF-1's INSTANCE engine (ADR 0087), concentrated on the three
 * rulings the wizard has to get right on its own:
 *
 *   - **ruling 2 (inside-out)** — a child's condition resolves against
 *     top-level ⊕ THIS instance: a same-instance sibling WINS, and a sibling this
 *     instance hasn't answered is ABSENT, never a fallback to another instance's
 *     value. That last one is the whole reason the overlay exists, and it is
 *     invisible to any single-instance test.
 *   - **ruling 3 (prune, then check)** — a fully-empty repetition is not
 *     incomplete, it is NOT THERE: it reports no field errors, and `minInstances`
 *     is measured on what survives.
 *   - **ruling 6** — a plain `group` has no instances and its children answer at
 *     top level, so they must appear in the TOP-LEVEL save payload.
 */

function item(
  id: string,
  over: Partial<Item> = {},
  itemType: ItemType = "short_text",
): Item {
  return {
    id,
    sectionId: "s1",
    position: 0,
    itemType,
    questionKey:
      itemType === "group" || itemType === "repeating_group" ? null : id,
    label: id,
    questionExplanation: null,
    options: null,
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

function section(items: Item[]): Section {
  return {
    id: "s1",
    position: 0,
    title: "Seção",
    description: null,
    isDefault: true,
    visibleWhen: null,
    requiresSignoff: false,
    signoffRole: null,
    items,
  };
}

function answers(pairs: Record<string, unknown>): AnswerState {
  const state: AnswerState = {};
  for (const [id, value] of Object.entries(pairs)) {
    state[id] = { itemId: id, questionKey: id, value: value as never };
  }
  return state;
}

function instance(
  id: string,
  groupItemId: string,
  position: number,
  values: Record<string, unknown> = {},
): InstanceState {
  return { id, groupItemId, position, answers: answers(values) };
}

// A repeating group: "tipo" (choice) controls whether "dose" is shown.
const DOSE = item("dose", {
  visibleWhen: { question_key: "tipo", op: "equals", value: "medicacao" },
});
const REP = item(
  "REP",
  { children: [item("tipo", {}, "multiple_choice"), DOSE] },
  "repeating_group",
);

describe("computeInstanceVisibility — ruling 2, inside-out", () => {
  it("a SAME-INSTANCE sibling satisfies the condition", () => {
    const visible = computeInstanceVisibility(REP, {}, { tipo: "medicacao" });
    expect([...visible].sort()).toEqual(["dose", "tipo"]);
  });

  it("a sibling absent IN THIS INSTANCE hides the child — no fallback", () => {
    // Instance B answered nothing. If the evaluator ever fell back to another
    // instance's "tipo", `dose` would wrongly show here.
    const visible = computeInstanceVisibility(REP, {}, {});
    expect(visible.has("dose")).toBe(false);
    expect(visible.has("tipo")).toBe(true);
  });

  it("the SAME child resolves differently per instance", () => {
    const a = computeInstanceVisibility(REP, {}, { tipo: "medicacao" });
    const b = computeInstanceVisibility(REP, {}, { tipo: "material" });
    expect(a.has("dose")).toBe(true);
    expect(b.has("dose")).toBe(false);
  });

  it("a TOP-LEVEL key is visible to a child (the base tier)", () => {
    const child = item("detalhe", {
      visibleWhen: { question_key: "setor", op: "equals", value: "uti" },
    });
    const container = item("R", { children: [child] }, "repeating_group");
    const base: AnswerMap = { setor: "uti" };
    expect(computeInstanceVisibility(container, base, {}).has("detalhe")).toBe(
      true,
    );
  });

  it("an instance answer OVERRIDES a same-keyed top-level answer", () => {
    const child = item("detalhe", {
      visibleWhen: { question_key: "tipo", op: "equals", value: "medicacao" },
    });
    const container = item(
      "R",
      { children: [item("tipo", {}, "multiple_choice"), child] },
      "repeating_group",
    );
    // Top level says "material"; THIS instance says "medicacao" → the instance wins.
    const visible = computeInstanceVisibility(
      container,
      { tipo: "material" },
      { tipo: "medicacao" },
    );
    expect(visible.has("detalhe")).toBe(true);
  });
});

describe("emptiness + cardinality — ruling 3", () => {
  it("an instance with no meaningful value is EMPTY", () => {
    expect(isEmptyInstance(instance("i1", "REP", 0))).toBe(true);
    expect(isEmptyInstance(instance("i1", "REP", 0, { tipo: null }))).toBe(true);
    expect(isEmptyInstance(instance("i1", "REP", 0, { tipo: "  " }))).toBe(true);
    expect(isEmptyInstance(instance("i1", "REP", 0, { tipo: [] }))).toBe(true);
  });

  it("any meaningful value makes it non-empty", () => {
    expect(isEmptyInstance(instance("i1", "REP", 0, { tipo: "x" }))).toBe(false);
    expect(isEmptyInstance(instance("i1", "REP", 0, { tipo: 0 }))).toBe(false);
    expect(isEmptyInstance(instance("i1", "REP", 0, { tipo: ["a"] }))).toBe(
      false,
    );
  });

  it("minInstances is measured on what SURVIVES the prune", () => {
    const container = item("REP", { config: { minInstances: 2 } }, "repeating_group");
    const list = [
      instance("i1", "REP", 0, { tipo: "x" }),
      instance("i2", "REP", 1), // blank — pruned at submit, so it does not count
    ];
    expect(survivingInstances(list)).toHaveLength(1);
    expect(describeInstanceShortfall(container, list)).toMatch(/ao menos mais 1/);
  });

  it("a satisfied minimum reports nothing", () => {
    const container = item("REP", { config: { minInstances: 1 } }, "repeating_group");
    expect(
      describeInstanceShortfall(container, [
        instance("i1", "REP", 0, { tipo: "x" }),
      ]),
    ).toBeNull();
  });

  it("maxInstances closes the add affordance", () => {
    const container = item("REP", { config: { maxInstances: 2 } }, "repeating_group");
    expect(canAddInstance(container, [instance("i1", "REP", 0)])).toBe(true);
    expect(
      canAddInstance(container, [
        instance("i1", "REP", 0),
        instance("i2", "REP", 1),
      ]),
    ).toBe(false);
  });
});

describe("validateInstances — prune, then check", () => {
  const required = item("dose", { required: true });
  const container = item(
    "REP",
    { children: [required], config: { minInstances: 1 } },
    "repeating_group",
  );
  const sec = section([container]);

  it("a BLANK repetition reports NO field error", () => {
    // The old interlock's failure mode: "campo obrigatório" pointing into a row
    // the user never meant to create, whose real fix is "remove the row".
    const errors = validateInstances(
      sec,
      { REP: [instance("i1", "REP", 0)] },
      new Map([["i1", new Set(["dose"])]]),
    );
    expect(errors["i1:dose"]).toBeUndefined();
    // …but the unmet minimum DOES block, in the right register.
    expect(errors["REP"]).toMatch(/ao menos/);
  });

  it("a FILLED repetition with a blank required child DOES block", () => {
    const errors = validateInstances(
      sec,
      { REP: [instance("i1", "REP", 0, { outro: "algo" })] },
      new Map([["i1", new Set(["dose"])]]),
    );
    expect(errors["i1:dose"]).toBe("Esta pergunta é obrigatória.");
  });

  it("errors are keyed PER INSTANCE, so one repetition can be fine", () => {
    const errors = validateInstances(
      sec,
      {
        REP: [
          instance("i1", "REP", 0, { dose: "10mg" }),
          instance("i2", "REP", 1, { outro: "algo" }),
        ],
      },
      new Map([
        ["i1", new Set(["dose"])],
        ["i2", new Set(["dose"])],
      ]),
    );
    expect(errors["i1:dose"]).toBeUndefined();
    expect(errors["i2:dose"]).toBe("Esta pergunta é obrigatória.");
  });

  it("a HIDDEN child inside an instance is not required", () => {
    const errors = validateInstances(
      sec,
      { REP: [instance("i1", "REP", 0, { outro: "algo" })] },
      new Map([["i1", new Set<string>()]]), // `dose` hidden in this instance
    );
    expect(errors["i1:dose"]).toBeUndefined();
  });

  it("a HIDDEN container requires nothing — not even its minimum", () => {
    const errors = validateInstances(
      sec,
      { REP: [] },
      new Map(),
      new Set<string>(), // the container is not visible
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe("save payload — ruling 6 keeps a plain group at TOP level", () => {
  const group = item(
    "GRP",
    { children: [item("g1"), item("g2")] },
    "group",
  );
  const sec = section([item("top1"), group, REP]);

  it("topLevelItems includes a plain group's children and excludes a repeating group", () => {
    expect(topLevelItems(sec).map((i) => i.id)).toEqual(["top1", "g1", "g2"]);
  });

  it("collectInstances emits one entry per instance, children only", () => {
    const payload = collectInstances(
      sec,
      { REP: [instance("i1", "REP", 0, { tipo: "medicacao", dose: "10mg" })] },
      new Map([["i1", new Set(["tipo", "dose"])]]),
    );
    expect(payload).toHaveLength(1);
    expect(payload[0].instanceId).toBe("i1");
    // `tipo` is a choice item → selections; `dose` is short_text → scalar answers.
    expect(payload[0].selectionsByItemId).toEqual({ tipo: ["medicacao"] });
    expect(payload[0].answersByItemId).toEqual({ dose: "10mg" });
  });

  it("a BLANK instance is still SENT (pruning is submit's job, not save's)", () => {
    // Dropping it here would make a half-cleared repetition vanish on
    // navigation — data loss the user never asked for.
    const payload = collectInstances(
      sec,
      { REP: [instance("i1", "REP", 0)] },
      new Map([["i1", new Set(["tipo", "dose"])]]),
    );
    expect(payload).toHaveLength(1);
    expect(payload[0].answersByItemId).toEqual({});
  });

  it("a hidden child is excluded from its instance's payload", () => {
    const payload = collectInstances(
      sec,
      { REP: [instance("i1", "REP", 0, { tipo: "material", dose: "10mg" })] },
      new Map([["i1", new Set(["tipo"])]]), // `dose` hidden here
    );
    expect(payload[0].answersByItemId).toEqual({});
    expect(payload[0].selectionsByItemId).toEqual({ tipo: ["material"] });
  });
});
