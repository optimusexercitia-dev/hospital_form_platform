/**
 * Component tests for the task-#4 result-rule aggregate criteria: the
 * `score`/`flagged` criterion serializes to the reserved synthetic key with a
 * NUMERIC value (so the unchanged evaluator compares numerically), an existing
 * aggregate ruleset ROUND-TRIPS back into the editor (reverse-mapped criterion),
 * and the simulated-aggregate preview fires the rule via `walkResultRuleset` —
 * proving builder-preview == backend-compute. Deterministic under jsdom.
 */

import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import type { PhaseConditionTarget } from "@/lib/queries/process-templates";
import type { PhaseResult } from "@/lib/queries/phase-results";
import type { ResultRuleset } from "@/lib/queries/conditions";
import {
  FLAGGED_COUNT_KEY,
  TOTAL_SCORE_KEY,
} from "@/lib/queries/conditions";
import {
  PhaseResultEditor,
  type PhaseResultValue,
} from "./result-ruleset-editor";

const RESULTS: PhaseResult[] = [
  {
    id: "r1",
    commissionId: "c1",
    label: "Procedente",
    colorToken: "red",
    isAdverse: true,
    archived: false,
    position: 0,
  },
  {
    id: "r2",
    commissionId: "c1",
    label: "Improcedente",
    colorToken: "green",
    isAdverse: false,
    archived: false,
    position: 1,
  },
];

const TARGETS: PhaseConditionTarget[] = [];

/** Controlled harness capturing the latest emitted PhaseResultValue. */
function Harness({
  initial,
  onValue,
}: {
  initial: PhaseResultValue;
  onValue: (v: PhaseResultValue) => void;
}) {
  const [value, setValue] = useState<PhaseResultValue>(initial);
  return (
    <PhaseResultEditor
      targets={TARGETS}
      results={RESULTS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

function parseRuleset(json: string): ResultRuleset {
  return JSON.parse(json) as ResultRuleset;
}

describe("PhaseResultEditor — aggregate criteria (task #4)", () => {
  it("round-trips a score-aggregate ruleset into a criterion=score rule", () => {
    // A ruleset keyed on __total_score__ > 5 → Procedente. It must reverse-map to
    // the aggregate criterion, and re-serialize to the SAME shape.
    const ruleset: ResultRuleset = {
      rules: [
        {
          when: { question_key: TOTAL_SCORE_KEY, op: "gt", value: 5 },
          result_id: "r1",
        },
      ],
      default_result_id: "r2",
    };
    let latest: PhaseResultValue | null = null;
    render(
      <Harness
        initial={{
          emitsResult: true,
          resultRuleset: JSON.stringify(ruleset),
          allowedResultIds: ["r1", "r2"],
        }}
        onValue={(v) => {
          latest = v;
        }}
      />,
    );

    // The criterion select reflects the reverse-mapped "score", and the numeric
    // threshold shows 5.
    const criterionSelect = screen.getByDisplayValue(
      "Pontuação total da fase",
    ) as HTMLSelectElement;
    expect(criterionSelect).toBeInTheDocument();
    expect((screen.getByDisplayValue("5") as HTMLInputElement).value).toBe("5");

    // It re-serializes to the byte-identical synthetic-key shape.
    // (An interaction triggers the emit effect; nudge the threshold and back.)
    const threshold = screen.getByDisplayValue("5") as HTMLInputElement;
    fireEvent.change(threshold, { target: { value: "6" } });
    fireEvent.change(threshold, { target: { value: "5" } });
    expect(latest).not.toBeNull();
    const out = parseRuleset(latest!.resultRuleset);
    expect(out.rules[0].when).toEqual({
      question_key: TOTAL_SCORE_KEY,
      op: "gt",
      value: 5,
    });
    expect(out.default_result_id).toBe("r2");
  });

  it("serializes a flagged-aggregate rule with a numeric value + not_equals op", () => {
    let latest: PhaseResultValue | null = null;
    render(
      <Harness
        initial={{
          emitsResult: true,
          resultRuleset: JSON.stringify({
            rules: [
              {
                when: {
                  question_key: FLAGGED_COUNT_KEY,
                  op: "not_equals",
                  value: 0,
                },
                result_id: "r1",
              },
            ],
            default_result_id: null,
          } satisfies ResultRuleset),
          allowedResultIds: ["r1", "r2"],
        }}
        onValue={(v) => {
          latest = v;
        }}
      />,
    );

    const criterionSelect = screen.getByDisplayValue(
      "Itens marcados da fase",
    ) as HTMLSelectElement;
    expect(criterionSelect).toBeInTheDocument();

    // Nudge to trigger emit; assert numeric value + op preserved.
    const threshold = screen.getByDisplayValue("0") as HTMLInputElement;
    fireEvent.change(threshold, { target: { value: "1" } });
    const out = parseRuleset(latest!.resultRuleset);
    expect(out.rules[0].when).toEqual({
      question_key: FLAGGED_COUNT_KEY,
      op: "not_equals",
      value: 1,
    });
  });

  it("the simulated aggregate preview fires the rule (score >= 3 → Procedente)", () => {
    render(
      <Harness
        initial={{
          emitsResult: true,
          resultRuleset: JSON.stringify({
            rules: [
              {
                when: { question_key: TOTAL_SCORE_KEY, op: "gte", value: 3 },
                result_id: "r1",
              },
            ],
            default_result_id: "r2",
          } satisfies ResultRuleset),
          allowedResultIds: ["r1", "r2"],
        }}
        onValue={() => {}}
      />,
    );

    // Simulate a total score of 4 → the rule (>= 3) fires → Procedente. Scope to
    // the preview line ("Resultado: <badge>") since the result labels also appear
    // in the allowed-results checklist.
    const scoreInput = screen.getByPlaceholderText("Ex.: 8") as HTMLInputElement;
    fireEvent.change(scoreInput, { target: { value: "4" } });
    const previewLine = () =>
      screen.getByText(/^Resultado:/).closest("p") as HTMLElement;
    expect(within(previewLine()).getByText("Procedente")).toBeInTheDocument();

    // A score of 1 → below the threshold → the default (Improcedente) applies.
    fireEvent.change(scoreInput, { target: { value: "1" } });
    expect(within(previewLine()).getByText("Improcedente")).toBeInTheDocument();
  });
});
