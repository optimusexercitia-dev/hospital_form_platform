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

/**
 * FF-3 (ADR 0090 ruling 5) — the two UNARY operators.
 *
 * `app.is_valid_condition` exempts `is_empty`/`is_not_empty` from its
 * `p ? 'value'` requirement BY NAME, so the builder must emit them with no
 * meaningful operand and must not lose them on a reopen-and-resave round trip.
 * The value it does emit is `null`, which the gate accepts exactly as an absent
 * key (the `or (p ? 'value')` short-circuits) — verified against the live
 * catalog, not against the migration text.
 */
describe("ConditionBuilder unary operators (FF-3 ruling 5)", () => {
  it.each(["is_empty", "is_not_empty"] as const)(
    "emits %s with a null value and no operand",
    (op) => {
      const cond = toCondition(row({ op, singleValue: "" }), target("date"));
      expect(cond).toEqual({ question_key: "q", op, value: null });
    },
  );

  it("ignores any stale operand left in the draft buffer", () => {
    // Switching op from `equals` to `is_empty` clears the buffer via onPickOp,
    // but serialization must not depend on that having happened: a unary
    // condition carries no operand regardless of what the row still holds.
    const cond = toCondition(
      row({ op: "is_empty", singleValue: "2026-01-15" }),
      target("date"),
    );
    expect(cond.value).toBeNull();
  });

  it("round-trips a unary condition through toDrafts without inventing a value", () => {
    const drafts = toDrafts({ question_key: "q", op: "is_not_empty", value: null });
    expect(drafts.rows).toHaveLength(1);
    expect(drafts.rows[0].op).toBe("is_not_empty");
    expect(drafts.rows[0].singleValue).toBe("");
    expect(drafts.rows[0].multiValue).toEqual([]);
    // Re-serializing is stable — the reopen/resave cycle is a fixed point.
    expect(toCondition(drafts.rows[0], target("date"))).toEqual({
      question_key: "q",
      op: "is_not_empty",
      value: null,
    });
  });

  it("round-trips a unary condition stored with NO value key at all", () => {
    // The gate permits an absent `value`, so a condition authored elsewhere (or
    // by a later writer) may arrive without one. Reopening must not crash or
    // silently rewrite the operator.
    const stored = { question_key: "q", op: "is_empty" } as unknown as Parameters<
      typeof toDrafts
    >[0];
    const drafts = toDrafts(stored);
    expect(drafts.rows[0].op).toBe("is_empty");
    expect(drafts.rows[0].singleValue).toBe("");
  });
});
