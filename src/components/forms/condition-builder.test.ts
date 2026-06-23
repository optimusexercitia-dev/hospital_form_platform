import { describe, expect, it } from "vitest";

import type { ConditionTarget, InputItemType } from "@/lib/queries/forms";

import { toCondition, toDrafts, type DraftRow } from "./condition-builder";

/**
 * Unit coverage for the ConditionBuilder's SERIALIZATION (QA MAJOR-1). The
 * shared SQL↔TS evaluator vectors don't catch this: the evaluator is correct;
 * the bug was the builder emitting a number-target value as a STRING, so the
 * evaluator's "both operands numeric?" branch never fired and `qty > 5` fell to
 * lexical compare. These assert `toCondition` emits the value TYPE that matches
 * how the answer is stored, keyed on the target's type, and that a number
 * condition round-trips through `toDrafts` for editing.
 */

function target(type: InputItemType, options: string[] = []): ConditionTarget {
  return { questionKey: "q", label: "Pergunta", sectionPosition: 0, type, options };
}

function row(over: Partial<DraftRow> = {}): DraftRow {
  return {
    uid: "r1",
    questionKey: "q",
    op: "equals",
    singleValue: "",
    multiValue: [],
    ...over,
  };
}

describe("ConditionBuilder toCondition (value typing — MAJOR-1)", () => {
  it("emits a JSON number for a number target (not a string)", () => {
    const cond = toCondition(
      row({ op: "gt", singleValue: "5" }),
      target("number"),
    );
    expect(cond).toEqual({ question_key: "q", op: "gt", value: 5 });
    expect(typeof cond.value).toBe("number");
  });

  it("coerces a decimal/negative number value", () => {
    expect(toCondition(row({ op: "lte", singleValue: "-3.5" }), target("number")).value).toBe(
      -3.5,
    );
  });

  it("keeps the ISO string for a date target (sorts lexically)", () => {
    const cond = toCondition(
      row({ op: "gte", singleValue: "2026-01-15" }),
      target("date"),
    );
    expect(cond.value).toBe("2026-01-15");
    expect(typeof cond.value).toBe("string");
  });

  it("keeps the 24h string for a time target", () => {
    const cond = toCondition(
      row({ op: "lt", singleValue: "08:30" }),
      target("time"),
    );
    expect(cond.value).toBe("08:30");
    expect(typeof cond.value).toBe("string");
  });

  it("keeps the label string for a choice equals/not_equals", () => {
    const cond = toCondition(
      row({ op: "equals", singleValue: "Sim" }),
      target("multiple_choice", ["Sim", "Não"]),
    );
    expect(cond.value).toBe("Sim");
  });

  it("emits the selected-label array for `in`", () => {
    const cond = toCondition(
      row({ op: "in", multiValue: ["Sim", "Talvez"] }),
      target("checkbox", ["Sim", "Não", "Talvez"]),
    );
    expect(cond.value).toEqual(["Sim", "Talvez"]);
  });

  it("round-trips a number condition through toDrafts (JSON number → input string)", () => {
    // A stored number condition (JSON number) must show its value as a string in
    // the `<input type="number">` when reopened for editing.
    const drafts = toDrafts({ question_key: "q", op: "gt", value: 5 });
    expect(drafts.rows).toHaveLength(1);
    expect(drafts.rows[0].singleValue).toBe("5");
    // ...and re-serializing yields the JSON number again.
    expect(toCondition(drafts.rows[0], target("number")).value).toBe(5);
  });
});
