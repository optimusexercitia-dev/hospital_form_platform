import { describe, expect, it } from "vitest";

import type { Item, ItemType, Section } from "@/lib/queries/forms";

import {
  newChildConditionTargets,
  newQuestionConditionTargets,
  questionConditionTargets,
  sectionConditionTargets,
} from "./condition-targets";

/**
 * Unit coverage for FF-1's condition-target SCOPING (ADR 0087 ruling 2), the
 * half of the rule the UI owns: the picker must never offer a target that
 * publish-time `validate_visible_when` would refuse, and must still offer the
 * one the ruling explicitly permits.
 *
 *   - OUTSIDE-IN is forbidden — nothing outside a `repeating_group` may target
 *     one of its children (with N instances there is no single value).
 *   - INSIDE-OUT resolves — a child MAY target an earlier SAME-instance sibling.
 *   - A plain `group`'s children answer at TOP LEVEL (ruling 6), so their keys
 *     stay ordinary targets everywhere.
 *
 * KEYSTONE INTENT: delete the `repeatingParentId` filter in `targetsBefore` and
 * the outside-in cases go red; delete the `viewerRepeatingId` argument (pass
 * `null` always) and the inside-out case goes red. Neither can pass vacuously —
 * each expectation names the exact keys that must and must not appear.
 */

function item(
  id: string,
  itemType: ItemType = "multiple_choice",
  children: Item[] = [],
): Item {
  return {
    id,
    sectionId: "s1",
    position: 0,
    itemType,
    // Containers carry NO question_key (the live `form_items_input_vs_display`
    // container arm requires `question_key IS NULL`).
    questionKey:
      itemType === "group" || itemType === "repeating_group" ? null : id,
    label: id,
    questionExplanation: null,
    options: [],
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children,
    content: null,
  };
}

function section(id: string, position: number, items: Item[]): Section {
  return {
    id,
    position,
    title: id,
    description: null,
    isDefault: position === 0,
    visibleWhen: null,
    requiresSignoff: false,
    signoffRole: null,
    items,
  };
}

function keys(targets: { questionKey: string }[]): string[] {
  return targets.map((t) => t.questionKey);
}

/**
 * One section, document order:
 *   top1 · GRP(plain){g1, g2} · REP(repeating){r1, r2} · top2
 */
function tree(): Section[] {
  return [
    section("s1", 0, [
      item("top1"),
      item("GRP", "group", [item("g1"), item("g2")]),
      item("REP", "repeating_group", [item("r1"), item("r2")]),
      item("top2"),
    ]),
  ];
}

describe("condition targets — outside-in is forbidden (ruling 2)", () => {
  it("never offers a repeating-group child to a later TOP-LEVEL item", () => {
    const result = keys(questionConditionTargets(tree(), "s1", "top2"));
    // Everything earlier and outside the repeating group is offered…
    expect(result).toEqual(["top1", "g1", "g2"]);
    // …and the repeating group's children specifically are NOT.
    expect(result).not.toContain("r1");
    expect(result).not.toContain("r2");
  });

  it("never offers a repeating-group child to a NEW top-level block", () => {
    const result = keys(newQuestionConditionTargets(tree(), "s1"));
    expect(result).toEqual(["top1", "g1", "g2", "top2"]);
    expect(result).not.toContain("r1");
  });

  it("never offers a repeating-group child to a SECTION condition", () => {
    const sections = [
      ...tree(),
      section("s2", 1, [item("later")]),
    ];
    const result = keys(sectionConditionTargets(sections, "s2"));
    expect(result).toEqual(["top1", "g1", "g2", "top2"]);
    expect(result).not.toContain("r1");
  });

  it("never offers ANOTHER repeating group's children to a child", () => {
    const sections = [
      section("s1", 0, [
        item("REP_A", "repeating_group", [item("a1")]),
        item("REP_B", "repeating_group", [item("b1"), item("b2")]),
      ]),
    ];
    // b2 sits inside REP_B; a1 belongs to a DIFFERENT repeating group.
    const result = keys(questionConditionTargets(sections, "s1", "b2"));
    expect(result).toEqual(["b1"]);
    expect(result).not.toContain("a1");
  });
});

describe("condition targets — inside-out resolves (ruling 2)", () => {
  it("offers an earlier SAME-instance sibling to a repeating-group child", () => {
    const result = keys(questionConditionTargets(tree(), "s1", "r2"));
    // r1 is the same-instance sibling; top1/g1/g2 are top-level and legal too.
    expect(result).toEqual(["top1", "g1", "g2", "r1"]);
  });

  it("does NOT offer a LATER sibling (strictly-earlier still holds)", () => {
    const result = keys(questionConditionTargets(tree(), "s1", "r1"));
    expect(result).toEqual(["top1", "g1", "g2"]);
    expect(result).not.toContain("r2");
  });

  it("offers the existing siblings to a NEW child of a repeating group", () => {
    const result = keys(newChildConditionTargets(tree(), "REP"));
    expect(result).toEqual(["top1", "g1", "g2", "r1", "r2"]);
  });
});

describe("condition targets — a plain `group` is transparent (ruling 6)", () => {
  it("offers a plain group's children as ordinary targets", () => {
    const result = keys(questionConditionTargets(tree(), "s1", "g2"));
    expect(result).toEqual(["top1", "g1"]);
  });

  it("offers a plain group's earlier children to a NEW child of that group", () => {
    const result = keys(newChildConditionTargets(tree(), "GRP"));
    expect(result).toEqual(["top1", "g1", "g2"]);
  });

  it("never offers the CONTAINER itself (it holds no answer)", () => {
    const result = keys(newQuestionConditionTargets(tree(), "s1"));
    expect(result).not.toContain("GRP");
    expect(result).not.toContain("REP");
  });
});
