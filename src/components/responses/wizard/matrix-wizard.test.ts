import { describe, expect, it } from "vitest";

import type { Item, ItemType, MatrixAxisEntry, Section } from "@/lib/queries/forms";

import { computeEffectiveVisibility } from "./effective-visibility";
import { isEmptyInstance, type InstanceState } from "./instances";
import { collectInstances, collectScope, topLevelItems } from "./collect";
import { validateInstances, validateSection } from "./validation";

/**
 * FF-2 (ADR 0089) — the wizard's matrix seams.
 *
 * Concentrated on the four things that are silent when wrong, each of which a
 * value-shaped test would pass right over:
 *
 *  1. **A matrix takes part in visibility** even though it is not an "input
 *     item". If `computeEffectiveVisibility` skipped it, a matrix would be in no
 *     `visibleItemIds` set and therefore rendered nowhere and saved never — with
 *     no error anywhere.
 *  2. **The collector dispatches on TYPE, not on a `value`.** A matrix answer
 *     has `answers.value` NULL by design, so any presence check written against
 *     `value` treats every filled matrix as unanswered.
 *  3. **`isEmptyInstance` counts matrix content** — the client twin of ADR 0089
 *     §A. The SQL predicate was blind to the matrix tables, which would have let
 *     `submit_response` prune a repetition whose only content was a filled grid.
 *  4. **`required` is ROW-complete** (ruling 3), in the flat arm AND the
 *     per-instance arm.
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

function axis(code: string, position: number, weight: number | null = null): MatrixAxisEntry {
  return { id: `id-${code}`, code, label: code.toUpperCase(), weight, position };
}

/** A `matrix` with rows a/b and columns sim/nao. */
function matrixItem(id: string, over: Partial<Item> = {}): Item {
  return item(
    id,
    {
      matrixRows: [axis("a", 0), axis("b", 1)],
      matrixColumns: [axis("sim", 0), axis("nao", 1)],
      ...over,
    },
    "matrix",
  );
}

/** A `risk_matrix` with weighted 1/9 axes. */
function riskItem(id: string, over: Partial<Item> = {}): Item {
  return item(
    id,
    {
      matrixRows: [axis("leve", 0, 1), axis("grave", 1, 9)],
      matrixColumns: [axis("rara", 0, 1), axis("frequente", 1, 9)],
      ...over,
    },
    "risk_matrix",
  );
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

function instance(id: string, over: Partial<InstanceState> = {}): InstanceState {
  return {
    id,
    groupItemId: "g1",
    position: 0,
    answers: {},
    ...over,
  };
}

describe("visibility includes matrix items", () => {
  it("a matrix lands in visibleItemIds like any answerable item", () => {
    const sections = [section([matrixItem("m1"), riskItem("r1")])];
    const { visibleItemIds } = computeEffectiveVisibility(sections, {});
    expect(visibleItemIds.has("m1")).toBe(true);
    expect(visibleItemIds.has("r1")).toBe(true);
  });

  it("a matrix hidden by its own condition is excluded", () => {
    const controller = item("q1");
    const hidden = matrixItem("m1", {
      visibleWhen: { question_key: "q1", op: "equals", value: "sim" },
    });
    const sections = [section([controller, hidden])];
    expect(
      computeEffectiveVisibility(sections, { q1: "nao" }).visibleItemIds.has("m1"),
    ).toBe(false);
    expect(
      computeEffectiveVisibility(sections, { q1: "sim" }).visibleItemIds.has("m1"),
    ).toBe(true);
  });
});

describe("collectScope — matrix arms", () => {
  const m = matrixItem("m1");
  const r = riskItem("r1");
  const items = [m, r];
  const visible = new Set(["m1", "r1"]);

  it("sends the grid by CODE and the risk cell without any score", () => {
    const collected = collectScope(
      items,
      {
        answers: {},
        matrixCells: { m1: { a: "sim", b: "nao" } },
        riskMatrix: { r1: { severity: "grave", likelihood: "rara" } },
      },
      visible,
    );
    expect(collected.matrixCellsByItemId).toEqual({ m1: { a: "sim", b: "nao" } });
    expect(collected.riskMatrixByItemId).toEqual({
      r1: { severity: "grave", likelihood: "rara" },
    });
    // The score is derived server-side; there is no field for it on the wire.
    expect(
      Object.values(collected.riskMatrixByItemId).every(
        (sel) => !("riskScore" in sel),
      ),
    ).toBe(true);
  });

  it("omits a HIDDEN matrix entirely (absent = leave untouched)", () => {
    const collected = collectScope(
      items,
      { answers: {}, matrixCells: { m1: { a: "sim" } }, riskMatrix: {} },
      new Set(["r1"]),
    );
    expect(collected.matrixCellsByItemId).toEqual({});
  });

  it("omits a HALF-FILLED risk selection rather than sending an HC0P8", () => {
    const collected = collectScope(
      items,
      {
        answers: {},
        matrixCells: {},
        riskMatrix: { r1: { severity: "grave", likelihood: "" } },
      },
      visible,
    );
    expect(collected.riskMatrixByItemId).toEqual({});
  });

  it("sends an EMPTY grid (not an absent key) once the user clears one", () => {
    const collected = collectScope(
      items,
      { answers: {}, matrixCells: { m1: {} }, riskMatrix: {} },
      visible,
    );
    expect(collected.matrixCellsByItemId).toEqual({ m1: {} });
  });
});

describe("isEmptyInstance — ADR 0089 §A, client twin", () => {
  it("an instance holding ONLY a matrix answer is NOT empty", () => {
    expect(
      isEmptyInstance(instance("i1", { matrixCells: { m1: { a: "sim" } } })),
    ).toBe(false);
  });

  it("an instance holding ONLY a risk answer is NOT empty", () => {
    expect(
      isEmptyInstance(
        instance("i1", { riskMatrix: { r1: { severity: "leve", likelihood: "rara" } } }),
      ),
    ).toBe(false);
  });

  it("an instance with an EMPTY grid and nothing else is still empty", () => {
    expect(isEmptyInstance(instance("i1", { matrixCells: { m1: {} } }))).toBe(true);
  });

  it("a wholly blank instance is still empty", () => {
    expect(isEmptyInstance(instance("i1"))).toBe(true);
  });
});

describe("validateSection — required is ROW-complete (ruling 3)", () => {
  const required = matrixItem("m1", { required: true });
  const sec = section([required]);
  const visible = new Set(["m1"]);

  it("one filled row of two does NOT pass", () => {
    const errors = validateSection(
      sec,
      { answers: {}, matrixCells: { m1: { a: "sim" } }, riskMatrix: {} },
      visible,
    );
    expect(errors.m1).toMatch(/todas as linhas/i);
  });

  it("every row filled passes", () => {
    const errors = validateSection(
      sec,
      { answers: {}, matrixCells: { m1: { a: "sim", b: "nao" } }, riskMatrix: {} },
      visible,
    );
    expect(errors.m1).toBeUndefined();
  });

  it("an OPTIONAL matrix half-filled is never an error", () => {
    const optional = section([matrixItem("m2")]);
    const errors = validateSection(
      optional,
      { answers: {}, matrixCells: { m2: { a: "sim" } }, riskMatrix: {} },
      new Set(["m2"]),
    );
    expect(errors.m2).toBeUndefined();
  });

  it("a HIDDEN required matrix requires nothing — visibility wins", () => {
    const errors = validateSection(
      sec,
      { answers: {}, matrixCells: {}, riskMatrix: {} },
      new Set<string>(),
    );
    expect(errors.m1).toBeUndefined();
  });

  it("a required risk_matrix needs both halves", () => {
    const riskSection = section([riskItem("r1", { required: true })]);
    const vis = new Set(["r1"]);
    expect(
      validateSection(
        riskSection,
        { answers: {}, matrixCells: {}, riskMatrix: {} },
        vis,
      ).r1,
    ).toMatch(/severidade/i);
    expect(
      validateSection(
        riskSection,
        {
          answers: {},
          matrixCells: {},
          riskMatrix: { r1: { severity: "grave", likelihood: "rara" } },
        },
        vis,
      ).r1,
    ).toBeUndefined();
  });
});

describe("the per-instance arm carries the same rules", () => {
  const child = matrixItem("m1", { required: true });
  const group = item("g1", { children: [child] }, "repeating_group");
  const sec = section([group]);
  const visibleByInstance = new Map([["i1", new Set(["m1"])]]);

  it("an incomplete matrix inside a NON-empty repetition errors, keyed by instance", () => {
    const inst = instance("i1", { matrixCells: { m1: { a: "sim" } } });
    const errors = validateInstances(
      sec,
      { g1: [inst] },
      visibleByInstance,
      new Set(["g1"]),
    );
    expect(errors["i1:m1"]).toMatch(/todas as linhas/i);
  });

  it("a fully EMPTY repetition reports nothing (prune, then check)", () => {
    const errors = validateInstances(
      sec,
      { g1: [instance("i1")] },
      visibleByInstance,
      new Set(["g1"]),
    );
    expect(errors["i1:m1"]).toBeUndefined();
  });

  it("the instance save payload carries the grid", () => {
    const inst = instance("i1", { matrixCells: { m1: { a: "sim", b: "nao" } } });
    const payload = collectInstances(
      sec,
      { g1: [inst] },
      visibleByInstance,
      new Set(["g1"]),
    );
    expect(payload).toHaveLength(1);
    expect(payload[0].matrixCellsByItemId).toEqual({ m1: { a: "sim", b: "nao" } });
  });

  it("a repeating group's matrix child is NOT in the top-level item list", () => {
    expect(topLevelItems(sec).map((i) => i.id)).toEqual([]);
  });
});
