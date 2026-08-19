import { describe, expect, it } from "vitest";

import type { PrintedDocumentStatus } from "@/lib/pdf/types";

import { printCurrencyFrom, type PrintCurrency } from "./currency";
import { printCurrencyChipLabel, printCurrencyStatement } from "./labels";

/**
 * ADR 0126 D2/D3/D4 — the currency adapter and its statements.
 *
 * ⛔ The load-bearing test here is NOT "the mapping is right". It is that an
 * ABSENT currency value can never be mistaken for a DELIBERATELY-NOT-EVALUATED
 * one. That confusion renders cleanly, tells every surveyor nothing, and reds no
 * other test in the codebase.
 */

const ALL_STATUSES: PrintedDocumentStatus[] = ["active", "superseded", "revoked"];
const ALL_VALUES: (boolean | null)[] = [true, false, null];

describe("printCurrencyFrom: the adapter is TOTAL", () => {
  it("maps every (status × value) combination without throwing", () => {
    const seen: PrintCurrency["kind"][] = [];
    for (const status of ALL_STATUSES) {
      for (const value of ALL_VALUES) {
        const result = printCurrencyFrom(status, value);
        expect(result, `${status}/${String(value)}`).toBeDefined();
        seen.push(result.kind);
      }
    }
    expect(seen).toHaveLength(ALL_STATUSES.length * ALL_VALUES.length);
  });

  it("the sweep genuinely REACHES all four verdicts (no vacuous mapping)", () => {
    // "No bad mapping" is also true of an adapter that returns one constant, and
    // of a sweep that never reaches the interesting inputs. Anchor it.
    const reached = new Set(
      ALL_STATUSES.flatMap((status) =>
        ALL_VALUES.map((value) => printCurrencyFrom(status, value).kind),
      ),
    );
    expect(reached).toEqual(
      new Set(["current", "outdated", "notApplicable", "indeterminate"]),
    );
  });
});

describe("⛔ THE KEYSTONE — absent is not the same as not-evaluated", () => {
  it("an ACTIVE print with a missing currency value is INDETERMINATE, never notApplicable", () => {
    // ⭐ THE MUTATION THIS EXISTS FOR, named so it cannot be misread as a style
    // preference: `isCurrent: row.is_current ?? null` on an RPC that does not
    // return the column yields `null` for EVERY row. If `null` mapped to
    // `notApplicable`, `/verificar` would state "currency not assessed" for every
    // document — including current ones — and the panel would show nothing as
    // current. A page that renders cleanly and says nothing true.
    expect(printCurrencyFrom("active", null)).toEqual({ kind: "indeterminate" });
    expect(printCurrencyFrom("superseded", null)).toEqual({ kind: "indeterminate" });
    // ...and the two verdicts SAY DIFFERENT THINGS, which is the point of
    // keeping them apart. Equal wording would make the type distinction cosmetic.
    expect(printCurrencyStatement({ kind: "indeterminate" })).not.toBe(
      printCurrencyStatement({ kind: "notApplicable" }),
    );
  });

  it("REVOKED is the ONLY status that yields notApplicable (D3 — the no-join arm)", () => {
    for (const value of ALL_VALUES) {
      expect(printCurrencyFrom("revoked", value)).toEqual({ kind: "notApplicable" });
    }
    // The differential: no other status reaches it, whatever the value.
    for (const status of ["active", "superseded"] as PrintedDocumentStatus[]) {
      for (const value of ALL_VALUES) {
        expect(printCurrencyFrom(status, value).kind).not.toBe("notApplicable");
      }
    }
  });

  it("an ACTIVE print can legally be NOT CURRENT — the new combination (D3)", () => {
    // The whole reason currency is a third axis: registry status records
    // deliberate acts, currency is derived at read time, and they disagree.
    expect(printCurrencyFrom("active", false)).toEqual({ kind: "outdated" });
    expect(printCurrencyFrom("active", true)).toEqual({ kind: "current" });
  });
});

describe("the statements (ADR 0126 D4)", () => {
  it("a REVOKED document says NOTHING about currency", () => {
    // D3: the revoked arm performs no join, so there is nothing to report.
    // Inventing a sentence here would assert a fact the door never established.
    expect(printCurrencyStatement({ kind: "notApplicable" })).toBeNull();
    expect(printCurrencyChipLabel({ kind: "notApplicable" })).toBeNull();
  });

  it("⭐ POSITIVE CONTROL: the other arms DO produce a statement", () => {
    // Without this, "revoked says nothing" is satisfied by a function that
    // returns null for everything.
    for (const kind of ["current", "outdated", "indeterminate"] as const) {
      const statement = printCurrencyStatement({ kind });
      expect(statement, `${kind} produced no statement`).toBeTruthy();
      expect(statement!.length).toBeGreaterThan(10);
    }
  });

  it("never reuses 'Substituído' — it would claim a newer print exists (D4)", () => {
    // The rejected shortcut, pinned. An auditor who asked for the superseding
    // document would be asking for one that was never emitted.
    for (const kind of ["current", "outdated", "indeterminate"] as const) {
      expect(printCurrencyStatement({ kind })?.toLowerCase()).not.toContain("substitu");
    }
  });

  it("every statement is distinct — three facts, three sentences", () => {
    const statements = (["current", "outdated", "indeterminate"] as const).map((kind) =>
      printCurrencyStatement({ kind }),
    );
    expect(new Set(statements).size).toBe(statements.length);
  });

  it("only the NON-current states earn a panel chip", () => {
    expect(printCurrencyChipLabel({ kind: "current" })).toBeNull();
    expect(printCurrencyChipLabel({ kind: "outdated" })).toBeTruthy();
    expect(printCurrencyChipLabel({ kind: "indeterminate" })).toBeTruthy();
  });

  it("the copy is pt-BR, not an English or snake_case leak (Rule 10)", () => {
    for (const kind of ["current", "outdated", "indeterminate"] as const) {
      const statement = printCurrencyStatement({ kind })!;
      expect(statement).not.toMatch(/[a-z]+_[a-z]+/); // no wire identifiers
      expect(statement).toMatch(/[ãáéíóúâêôç]/i); // real pt-BR orthography
    }
  });
});
