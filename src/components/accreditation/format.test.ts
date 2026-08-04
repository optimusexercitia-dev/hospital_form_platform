import { describe, expect, it } from "vitest";

import { plural } from "./format";

/**
 * QA INFO (Phase 16) — the shared pt-BR literal-pair pluralizer. The two
 * cases below are not generic coverage: each encodes the EXACT wrong word a
 * suffix-concatenation approach (`` `${word}s` ``) produced live in this
 * phase, so a future regression back to that pattern fails a test instead of
 * shipping silently past lint/typecheck/build the way both bugs originally
 * did.
 */
describe("plural", () => {
  it("returns the singular form for count === 1", () => {
    expect(plural(1, "padrão", "padrões")).toBe("padrão");
  });

  it("returns the plural form for count !== 1 (0 and 2+)", () => {
    expect(plural(0, "padrão", "padrões")).toBe("padrões");
    expect(plural(2, "padrão", "padrões")).toBe("padrões");
    expect(plural(5, "padrão", "padrões")).toBe("padrões");
  });

  it("BUG-P16-005: 'padrão' pluralizes to the irregular 'padrões', never 'padrãoes'", () => {
    const result = plural(2, "padrão", "padrões");
    expect(result).toBe("padrões");
    expect(result).not.toBe("padrãoes"); // what `"padrão" + "es"` produces
  });

  it("BUG-P16-005's sibling: 'em atenção' pluralizes to 'em atenções', never 'em atençãos'", () => {
    const result = plural(2, "em atenção", "em atenções");
    expect(result).toBe("em atenções");
    expect(result).not.toBe("em atençãos"); // what `"em atenção" + "s"` produces
  });

  it("supports a regular plural too (not just the irregular -ão class)", () => {
    expect(plural(1, "evidência", "evidências")).toBe("evidência");
    expect(plural(3, "evidência", "evidências")).toBe("evidências");
  });

  it("supports a verb+adjective pair, independent of the noun's own count", () => {
    // readiness-dashboard.tsx's LevelCard calls this twice in one sentence,
    // once per DIFFERENT count (totalStandards for the noun, cleanStandards
    // for this pair) — this only proves the pair mechanism itself is
    // count-agnostic; the two-different-counts composition is exercised at
    // the call site, not here.
    expect(plural(1, "está conforme", "estão conformes")).toBe("está conforme");
    expect(plural(3, "está conforme", "estão conformes")).toBe("estão conformes");
  });
});
