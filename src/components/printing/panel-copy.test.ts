import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { printedDocumentsIntroCopy } from "./labels";

/**
 * ADR 0125 D5 + Consequences — **the reserved verb in the panel's FURNITURE.**
 *
 * ⛔ The defect this exists for was live and user-facing: the registry panel
 * stated *"cada emissão gera um PDF permanente, verificável pelo QR code
 * impresso"* **unconditionally**, directly above the prévia control, which
 * produces neither a permanent PDF nor a QR code.
 *
 * ⭐ **Why four reserved-verb sweeps could not see it.** Every one of them reads
 * a RENDERED PRIMITIVE — the prévia footer, the QR footer, the whole rendered
 * document. **None reads the composed panel.** The verb was never in the thing
 * being printed; it was in the page that frames the button. *A sweep bounded by
 * "the artifact we render" cannot see the surface that surrounds it.*
 *
 * ⚠ This one also differs from every other stale-prose defect in this build in
 * the way that matters most: the others mislead the next developer, this one
 * misled a hospital coordinator about whether their document was a record.
 */

const RESERVED_VERB = /emit|emiss/i;

describe("printedDocumentsIntroCopy: two-sided, because one side was the bug", () => {
  it("the REGISTERING branch still promises permanence and verifiability", () => {
    // The positive half. Without it, every assertion below is satisfied by a
    // function returning "" for both branches.
    const copy = printedDocumentsIntroCopy(true);
    expect(copy).toMatch(/permanente/i);
    expect(copy).toMatch(/QR/);
    expect(RESERVED_VERB.test(copy), "the registering branch DOES speak of emission").toBe(
      true,
    );
  });

  it("⛔ the NON-registering branch never claims this source produces emissions", () => {
    const copy = printedDocumentsIntroCopy(false);
    expect(copy.length).toBeGreaterThan(30); // it says something
    // The exact false promise that shipped:
    expect(copy).not.toMatch(/cada emiss[ãa]o gera/i);
    // ...and no forward-looking claim that this source will produce one.
    expect(copy).not.toMatch(/este registro (gera|ser[áa] emitido)/i);
  });

  it("the two branches actually DIFFER — a constant would satisfy both above", () => {
    expect(printedDocumentsIntroCopy(true)).not.toBe(printedDocumentsIntroCopy(false));
  });

  it("the non-registering copy names NO cause", () => {
    // A source stops registering from a draft, a rejectable correction, a voided
    // phase, a cancellation, or a disposal. Naming one is right for some and a
    // lie for the rest — and "ainda" is wrong for a disposed ata, whose state is
    // not a waypoint.
    const copy = printedDocumentsIntroCopy(false);
    for (const cause of [/ainda/i, /rascunho/i, /assinatura/i, /enviad/i, /corre[çc]/i]) {
      expect(cause.test(copy), `copy names a cause: ${cause}`).toBe(false);
    }
  });

  it("⭐ it is honest that PAST emissions remain valid — the list can be non-empty", () => {
    // A reopened or disposed ata keeps the prints it minted while locked, so the
    // panel below this sentence is not necessarily empty. Denying emissions
    // outright would be its own false statement.
    expect(printedDocumentsIntroCopy(false)).toMatch(/anteriores/i);
  });
});

describe("⛔ the composed PANEL holds no hardcoded emission sentence", () => {
  /**
   * The structural half — an assertion on the composed surface, which is the
   * thing no primitive-level sweep reads. It reds if the conditional copy is
   * ever inlined back into the panel, which is precisely how the defect arose.
   */
  const ROOT = join(__dirname, "..", "..", "..");
  const panel = readFileSync(
    join(ROOT, "src/components/printing/printed-documents-panel.tsx"),
    "utf8",
  )
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

  it("the stripper left real code behind", () => {
    expect(panel).toContain("export function PrintedDocumentsSection");
  });

  it("routes its intro through the conditional helper, not a literal", () => {
    expect(panel).toContain("printedDocumentsIntroCopy(props.registers)");
    expect(panel).not.toMatch(/Cada emiss[ãa]o gera/i);
  });

  it("⭐ POSITIVE CONTROL: that sentence DOES live in labels.ts", () => {
    // Without this, "the panel has no such sentence" is satisfied by a needle
    // that matches nothing anywhere — a stale regex reading as a clean result.
    const labels = readFileSync(join(ROOT, "src/components/printing/labels.ts"), "utf8");
    expect(labels).toMatch(/Cada emiss[ãa]o gera/i);
  });
});
