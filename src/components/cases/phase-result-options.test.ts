import { describe, expect, it } from "vitest";

import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";

import { resolvePhaseCorrectionOptions } from "./phase-result-options";

/**
 * Unit coverage for {@link resolvePhaseCorrectionOptions} — the pure resolver that
 * decides what the POST-CONCLUSION result-correction picker offers per phase
 * (phase-result-manual-mode). Asserts the three modes (none / automatic / manual),
 * the manual subset's order + archived-drop, and the `allowClear` flag.
 */

function opt(id: string, label = id): ResolvedPhaseResult {
  return { id, label, colorToken: "muted", isAdverse: false, source: null };
}

const VOCAB: ResolvedPhaseResult[] = [
  opt("a", "Conforme"),
  opt("b", "Parcial"),
  opt("c", "Não-conforme"),
];

describe("resolvePhaseCorrectionOptions", () => {
  it("non-emitting phase → mode 'none', no options, not clearable", () => {
    const r = resolvePhaseCorrectionOptions(
      { emitsResult: false, manualResultIds: null },
      VOCAB,
    );
    expect(r).toEqual({ mode: "none", options: [], allowClear: false });
  });

  it("automatic phase → full active vocabulary, clearable", () => {
    const r = resolvePhaseCorrectionOptions(
      { emitsResult: true, manualResultIds: null },
      VOCAB,
    );
    expect(r.mode).toBe("automatic");
    expect(r.allowClear).toBe(true);
    expect(r.options).toEqual(VOCAB);
  });

  it("manual phase → only the allowed subset, NOT clearable", () => {
    const r = resolvePhaseCorrectionOptions(
      { emitsResult: true, manualResultIds: ["a", "c"] },
      VOCAB,
    );
    expect(r.mode).toBe("manual");
    expect(r.allowClear).toBe(false);
    expect(r.options.map((o) => o.id)).toEqual(["a", "c"]);
  });

  it("manual subset preserves the AUTHOR's order, not the vocabulary order", () => {
    const r = resolvePhaseCorrectionOptions(
      { emitsResult: true, manualResultIds: ["c", "a"] },
      VOCAB,
    );
    expect(r.options.map((o) => o.id)).toEqual(["c", "a"]);
  });

  it("manual subset drops a since-archived id (absent from the live vocabulary)", () => {
    const r = resolvePhaseCorrectionOptions(
      { emitsResult: true, manualResultIds: ["a", "gone", "b"] },
      VOCAB,
    );
    expect(r.options.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("empty manual subset (all archived) → manual mode with no options", () => {
    const r = resolvePhaseCorrectionOptions(
      { emitsResult: true, manualResultIds: ["gone"] },
      VOCAB,
    );
    expect(r).toEqual({ mode: "manual", options: [], allowClear: false });
  });
});
