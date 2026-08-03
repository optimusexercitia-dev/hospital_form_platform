import { describe, expect, it } from "vitest";

import type { Item } from "@/lib/queries/forms";
import { initialDefaultConfig, initialDefaultValue } from "./default-value-editor";

/**
 * FF-4 (ADR 0092 rulings 5/6): coverage for {@link initialDefaultConfig}, the
 * read-side XOR resolver that turns an item's persisted `defaultValue` /
 * `defaultSource` into the single {@link DefaultConfig} the editor renders.
 * The DB CHECK is the write-time authority for the XOR; this is the read-side
 * mirror that must agree with it.
 */

function baseItem(over: Partial<Item> = {}): Item {
  return {
    id: "it-1",
    sectionId: "s0",
    position: 0,
    itemType: "short_text",
    questionKey: "q1",
    label: "Pergunta",
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

describe("initialDefaultConfig", () => {
  it("returns { kind: 'none' } for a null item", () => {
    expect(initialDefaultConfig(null)).toEqual({ kind: "none" });
  });

  it("returns { kind: 'none' } when neither defaultValue nor defaultSource is set", () => {
    expect(initialDefaultConfig(baseItem())).toEqual({ kind: "none" });
  });

  it("returns the literal config from defaultValue", () => {
    expect(
      initialDefaultConfig(baseItem({ defaultValue: "valor padrão" })),
    ).toEqual({ kind: "literal", value: "valor padrão" });
  });

  it("returns the dynamic config from a recognized defaultSource token", () => {
    expect(
      initialDefaultConfig(
        baseItem({ itemType: "date", defaultValue: null, defaultSource: "today" }),
      ),
    ).toEqual({ kind: "dynamic", source: "today" });
  });

  it("ignores an unrecognized defaultSource value (defensive narrowing)", () => {
    expect(
      initialDefaultConfig(
        baseItem({
          defaultValue: null,
          // Simulates a stale/unknown token reaching the client — narrowed to
          // null by `toDefaultSource`, so this degrades to "none" rather than
          // throwing or rendering a broken picker.
          defaultSource: "not_a_real_token" as never,
        }),
      ),
    ).toEqual({ kind: "none" });
  });

  it("prefers defaultSource when both are somehow populated (XOR should make this unreachable)", () => {
    expect(
      initialDefaultConfig(
        baseItem({
          itemType: "date",
          defaultValue: "2099-12-31",
          defaultSource: "today",
        }),
      ),
    ).toEqual({ kind: "dynamic", source: "today" });
  });
});

describe("initialDefaultValue", () => {
  it("returns null for a null item", () => {
    expect(initialDefaultValue(null)).toBeNull();
  });

  it("passes through scalar and string-array shapes, and rejects anything else", () => {
    expect(initialDefaultValue(baseItem({ defaultValue: "texto" }))).toBe("texto");
    expect(initialDefaultValue(baseItem({ defaultValue: 7 }))).toBe(7);
    expect(initialDefaultValue(baseItem({ defaultValue: ["a", "b"] }))).toEqual([
      "a",
      "b",
    ]);
    expect(initialDefaultValue(baseItem({ defaultValue: { odd: true } }))).toBeNull();
  });
});
