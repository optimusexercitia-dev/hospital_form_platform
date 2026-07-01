import { describe, expect, it } from "vitest";

import type {
  ConditionTarget,
  ConditionTargetOption,
  InputItemType,
} from "@/lib/queries/forms";

import { toCondition, toDrafts, type DraftRow } from "./condition-builder";

/**
 * Unit coverage for the ConditionBuilder's SERIALIZATION (QA MAJOR-1). The
 * shared SQL↔TS evaluator vectors don't catch this: the evaluator is correct;
 * the bug was the builder emitting a number-target value as a STRING, so the
 * evaluator's "both operands numeric?" branch never fired and `qty > 5` fell to
 * lexical compare. These assert `toCondition` emits the value TYPE that matches
 * how the answer is stored, keyed on the target's type, and that a number
 * condition round-trips through `toDrafts` for editing.
 *
 * form-model-normalization: a choice condition now STORES the option CODE (not
 * the label); `singleValue`/`multiValue` therefore carry codes. `toCondition`
 * passes them through as-is, so the choice assertions below use codes.
 */

function target(
  type: InputItemType,
  options: ConditionTargetOption[] = [],
): ConditionTarget {
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

  it("keeps the option-code string for a choice equals/not_equals", () => {
    const cond = toCondition(
      row({ op: "equals", singleValue: "sim_a1b2" }),
      target("multiple_choice", [
        { code: "sim_a1b2", label: "Sim" },
        { code: "nao_c3d4", label: "Não" },
      ]),
    );
    expect(cond.value).toBe("sim_a1b2");
  });

  it("emits the selected-code array for `in`", () => {
    const cond = toCondition(
      row({ op: "in", multiValue: ["sim_a1b2", "talvez_e5f6"] }),
      target("checkbox", [
        { code: "sim_a1b2", label: "Sim" },
        { code: "nao_c3d4", label: "Não" },
        { code: "talvez_e5f6", label: "Talvez" },
      ]),
    );
    expect(cond.value).toEqual(["sim_a1b2", "talvez_e5f6"]);
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
