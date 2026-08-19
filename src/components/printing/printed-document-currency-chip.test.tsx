import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PrintCurrency } from "./currency";
import { PrintedDocumentCurrencyChip } from "./printed-document-currency-chip";
import { PrintedDocumentStatusChip } from "./printed-document-status-chip";

/**
 * ADR 0126 D2/D3/D4 — the panel's new legal `active`-but-NOT-current state.
 */

const chipFor = (currency: PrintCurrency) => {
  const { container, unmount } = render(
    <PrintedDocumentCurrencyChip currency={currency} />,
  );
  const html = container.innerHTML;
  const text = container.textContent ?? "";
  unmount();
  return { html, text };
};

describe("PrintedDocumentCurrencyChip", () => {
  it("renders a chip for OUTDATED — the row that needs attention", () => {
    const { text } = chipFor({ kind: "outdated" });
    expect(text).toContain("Revisão anterior");
  });

  it("renders NOTHING for current — chipping every row buries the one that matters", () => {
    expect(chipFor({ kind: "current" }).html).toBe("");
  });

  it("renders NOTHING for notApplicable — a revoked document says nothing about currency", () => {
    expect(chipFor({ kind: "notApplicable" }).html).toBe("");
  });

  it("⭐ POSITIVE CONTROL: the component CAN render — the two blanks are not a broken chip", () => {
    // Without this, "renders nothing" twice is satisfied by a component that
    // always returns null.
    expect(chipFor({ kind: "outdated" }).html).not.toBe("");
    expect(chipFor({ kind: "indeterminate" }).html).not.toBe("");
  });

  it("carries its meaning in TEXT, not colour alone (design system §6)", () => {
    for (const kind of ["outdated", "indeterminate"] as const) {
      const { text } = chipFor({ kind });
      expect(text.trim().length, `${kind} chip has no text`).toBeGreaterThan(3);
    }
  });

  it("does not leak a wire identifier into the label (Rule 10)", () => {
    for (const kind of ["outdated", "indeterminate"] as const) {
      expect(chipFor({ kind }).text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

describe("⛔ currency and registry STATUS are separate chips (ADR 0126 D3)", () => {
  it("an ACTIVE print can carry an outdated-currency chip — the new legal combination", () => {
    // The whole reason currency is a third axis. A single merged chip would have
    // to choose which fact to hide, and the row would look ordinary in exactly
    // the case that needs attention.
    const { container } = render(
      <>
        <PrintedDocumentStatusChip status="active" />
        <PrintedDocumentCurrencyChip currency={{ kind: "outdated" }} />
      </>,
    );
    expect(container.textContent).toContain("Ativo");
    expect(container.textContent).toContain("Revisão anterior");
  });

  it("the two chips are distinct elements, not one merged label", () => {
    const { container } = render(
      <>
        <PrintedDocumentStatusChip status="active" />
        <PrintedDocumentCurrencyChip currency={{ kind: "outdated" }} />
      </>,
    );
    expect(container.querySelectorAll("span[class*='rounded-full']").length).toBe(2);
    expect(container.querySelector("[data-currency]")).not.toBeNull();
  });
});
