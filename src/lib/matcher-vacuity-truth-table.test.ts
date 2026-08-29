import matchers from "../../scripts/absent-subject-matchers.json"
import { describe, expect, it } from "vitest"

/**
 * THE POSITIVE CONTROL FOR `scripts/check-absent-subject-assertions.mjs`.
 *
 * FUP-E2E-ABSENT-ROW-ASSERTIONS turns on ONE runtime fact: which matchers does
 * `undefined` satisfy? `row?.field` on an ABSENT row is `undefined`, so every matcher
 * that accepts it converts a missing row into a passing assertion.
 *
 * That fact has been asserted four times in this repo's record and been wrong four times.
 * So it is not asserted here -- it is MEASURED, every time the suite runs, and compared
 * against the set the detector actually enforces. If Vitest ever changes a matcher's
 * behaviour toward `undefined`, this reds and names the matcher, instead of the detector
 * silently enforcing a rule that stopped being true.
 *
 * ⛔ Do not "fix" a failure here by editing the JSON to match. Read which matcher moved,
 * decide what that means for the detector, and change both together.
 */

/** Every matcher below is applied to `undefined` -- the value an absent row yields. */
const PROBES: Array<{ label: string; run: () => void }> = [
  // --- claims the field HAS a value -------------------------------------------------
  { label: ".not.toBeNull()", run: () => expect(undefined).not.toBeNull() },
  { label: ".not.toBe(null)", run: () => expect(undefined).not.toBe(null) },
  { label: ".not.toEqual(null)", run: () => expect(undefined).not.toEqual(null) },
  { label: ".not.toStrictEqual(null)", run: () => expect(undefined).not.toStrictEqual(null) },
  { label: ".not.toBe(<literal>)", run: () => expect(undefined).not.toBe("x") },
  { label: ".not.toEqual(expect.any(...))", run: () => expect(undefined).not.toEqual(expect.any(String)) },
  // --- claims the field is ERASED / absent (the Rule 12 half) -----------------------
  { label: ".toBeUndefined()", run: () => expect(undefined).toBeUndefined() },
  { label: ".toBeFalsy()", run: () => expect(undefined).toBeFalsy() },
  { label: ".not.toBeDefined()", run: () => expect(undefined).not.toBeDefined() },
  { label: ".not.toBeTruthy()", run: () => expect(undefined).not.toBeTruthy() },
  // --- the SAFE set: these throw, so an absent row fails loudly ---------------------
  { label: ".toBeNull()", run: () => expect(undefined).toBeNull() },
  { label: ".toBeDefined()", run: () => expect(undefined).toBeDefined() },
  { label: ".toBeTruthy()", run: () => expect(undefined).toBeTruthy() },
  { label: ".toBe(false)", run: () => expect(undefined).toBe(false) },
  { label: ".toBe(<literal>)", run: () => expect(undefined).toBe("x") },
  { label: ".toEqual(expect.any(...))", run: () => expect(undefined).toEqual(expect.any(String)) },
  { label: ".not.toContain(...)", run: () => expect(undefined).not.toContain("x") },
  { label: ".not.toMatch(...)", run: () => expect(undefined).not.toMatch(/x/) },
]

function measure() {
  const accepts: string[] = []
  const rejects: string[] = []
  for (const p of PROBES) {
    try {
      p.run()
      accepts.push(p.label)
    } catch {
      rejects.push(p.label)
    }
  }
  return { accepts, rejects }
}

describe("matcher vacuity truth table (FUP-E2E-ABSENT-ROW-ASSERTIONS)", () => {
  const recorded = [
    ...matchers.acceptsUndefined.claimsFieldHasAValue,
    ...matchers.acceptsUndefined.claimsFieldIsErasedOrAbsent,
  ]

  it("every matcher the detector treats as vacuous really is satisfied by `undefined`", () => {
    const { accepts } = measure()
    expect([...accepts].sort()).toEqual([...recorded].sort())
  })

  it("every matcher recorded as SAFE really does throw on `undefined`", () => {
    const { rejects } = measure()
    expect([...rejects].sort()).toEqual([...matchers.throwsOnUndefined].sort())
  })

  it("the probe list covers both recorded sets with nothing left over", () => {
    // A probe that exists in neither recorded set would be measured and then ignored --
    // the detector would not enforce it and nothing would say so.
    expect(PROBES.length).toBe(recorded.length + matchers.throwsOnUndefined.length)
  })

  it("⛔ the two halves are DISJOINT -- a matcher cannot be both vacuous and safe", () => {
    const overlap = recorded.filter((m) => matchers.throwsOnUndefined.includes(m))
    expect(overlap).toEqual([])
  })

  // ───────────────────────────────────────────────────────────────────────────────────
  // SUBJECT SHAPES. The matcher is only half the composition; the other half is whether
  // the SUBJECT yields `undefined` or throws when the row is absent. These are measured
  // because the detector's first version got one of them wrong from reasoning, and its
  // hand-classified self-test fixture encoded the same wrong belief and so agreed with it.
  // ───────────────────────────────────────────────────────────────────────────────────
  describe("subject shapes on an absent row", () => {
    // Built through a function so TypeScript cannot narrow the empty literal to `never[]`
    // and constant-fold the very access these tests exist to measure at RUNTIME.
    type Row = { field?: string }
    const emptyRows = (): Row[] => []
    const absentRow = (): Row | undefined => undefined
    const rows = emptyRows()
    const row = absentRow()

    const yieldsUndefined = (fn: () => unknown) => {
      try {
        return fn() === undefined ? "undefined" : "value"
      } catch {
        return "throws"
      }
    }

    it("`row?.field` yields undefined — vacuous with an accepting matcher (class A)", () => {
      expect(yieldsUndefined(() => row?.field)).toBe("undefined")
    })

    it("`rows[0]` yields undefined — vacuous when it IS the subject (class B)", () => {
      expect(yieldsUndefined(() => rows[0])).toBe("undefined")
    })

    it("`rows[0]?.field` yields undefined — vacuous (class A, via the chain)", () => {
      expect(yieldsUndefined(() => rows[0]?.field)).toBe("undefined")
    })

    it("⛔ `rows[0].field` THROWS — it is SAFE, and flagging it cost 19 false positives", () => {
      // The correction that matters: a plain dot after an index fails loudly on an empty
      // read. Noisy, never silent. The detector must NOT flag this shape.
      expect(yieldsUndefined(() => rows[0].field)).toBe("throws")
    })
  })

  it("⭐ `.toBeNull()` is the SAFE way to assert erasure and `.toBeFalsy()` is not", () => {
    // The single most load-bearing row for Rule 12: a PHI-erasure claim written with
    // `.toBeFalsy()` passes on a row that was never created.
    expect(matchers.throwsOnUndefined).toContain(".toBeNull()")
    expect(matchers.acceptsUndefined.claimsFieldIsErasedOrAbsent).toContain(".toBeFalsy()")
  })
})
