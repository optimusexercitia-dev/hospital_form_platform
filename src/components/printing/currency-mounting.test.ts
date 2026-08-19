import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ADR 0126 D2/D4 — **the mounting guard.**
 *
 * ⭐ **This test could not have existed a day ago, and that is the point.** The
 * currency primitives shipped built-and-tested but UNMOUNTED, so the acceptance
 * criterion — *"8c is not done when the query returns `isCurrent`; it is done
 * when both surfaces RENDER it"* — was carried by the lead as a written
 * criterion precisely because a test for it would have had to FAIL to be honest,
 * and a test that must be disabled to be green is worse than no test at all: it
 * looks like coverage.
 *
 * Now that both surfaces mount it, the criterion becomes mechanically
 * checkable — and what it guards is the reverse direction: a future refactor
 * that drops the mount leaves two correct primitives that nothing reaches, with
 * every other test still green. `printed-document-currency-chip.test.tsx` and
 * `verification-result.test.tsx` both pass against a codebase where neither
 * surface renders them.
 *
 * ⛔ Comments are stripped before matching — this file's own subjects document
 * the props they pass, and an un-stripped needle would match the prose instead
 * of the code (the calibration rule `check-client-server-imports.mjs` carries,
 * and which this suite's sibling walked into once already).
 */

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const stripComments = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const PANEL = "src/components/printing/printed-documents-panel.tsx";
const VERIFICAR = "src/app/(public)/verificar/[token]/page.tsx";

describe("the currency primitives are MOUNTED, not merely correct", () => {
  const panel = stripComments(read(PANEL));
  const verificar = stripComments(read(VERIFICAR));

  it("the comment stripper leaves real code behind (not a vacuous pass)", () => {
    // Every assertion below is a `toContain` over stripped source. If the
    // stripper over-matched and returned near-nothing, they would all fail
    // loudly rather than silently — but pin the positive anyway so a future
    // stripper change cannot quietly invert the meaning.
    expect(panel).toContain("export function PrintedDocumentsSection");
    expect(verificar).toContain("export default async function");
  });

  it("the PANEL renders the currency chip from the row's own verdict", () => {
    expect(panel).toContain("PrintedDocumentCurrencyChip");
    expect(panel).toMatch(/printCurrencyFrom\(\s*doc\.status,\s*doc\.isCurrent\s*\)/);
  });

  it("/verificar passes a currency verdict to the result component", () => {
    expect(verificar).toContain("printCurrencyFrom");
    expect(verificar).toMatch(/currency=\{/);
    // ...derived from the lookup's OWN fields, not invented at the call site.
    expect(verificar).toMatch(/outcome\.verification\.status/);
    expect(verificar).toMatch(/outcome\.verification\.isCurrent/);
  });

  it("⛔ neither surface coerces the null verdict — `?? false` is the trap", () => {
    // `null` means NOT EVALUATED (revoked only). Coercing it to `false` would
    // tell a surveyor holding a revoked page that it is "not current", when the
    // honest answer is ANULADO and nothing about currency.
    for (const [name, src] of [
      ["panel", panel],
      ["verificar", verificar],
    ] as const) {
      expect(src, `${name} coerces isCurrent`).not.toMatch(/isCurrent\s*\?\?\s*false/);
      expect(src, `${name} coerces isCurrent`).not.toMatch(/isCurrent\s*\|\|\s*false/);
      expect(src, `${name} coerces isCurrent`).not.toMatch(/!!\s*\w*\.isCurrent/);
    }
  });

  it("⭐ the mount goes through the ONE adapter, never a hand-rolled ternary", () => {
    // A call site that wrote `doc.isCurrent === false ? … : …` would bypass
    // `printCurrencyFrom` and lose the revoked/indeterminate distinction the
    // four-arm union exists for — while still rendering something plausible.
    for (const [name, src] of [
      ["panel", panel],
      ["verificar", verificar],
    ] as const) {
      expect(src, `${name} hand-rolls the verdict`).not.toMatch(
        /isCurrent\s*===\s*(true|false)/,
      );
    }
  });
});
