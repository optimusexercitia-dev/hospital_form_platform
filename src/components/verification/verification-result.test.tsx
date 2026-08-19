import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import type { PrintCurrency } from "@/components/printing/currency";
import type { PrintedDocumentVerification } from "@/lib/queries/printed-documents";

import { VerificationResult, type VerificationOutcome } from "./verification-result";

/**
 * ADR 0126 D3/D4 — `/verificar` states authenticity, registry status and
 * CURRENCY as three separate facts.
 *
 * This page is the one a surveyor holding paper actually reads, so the tests
 * below are about what it SAYS, not how it is composed.
 */

/**
 * `matchMedia` is polyfilled as REDUCED MOTION (the house pattern — see
 * `version-history-panel.test.tsx`), so `VerificationSeal` bails out of its
 * dynamic GSAP import. The DOM is then exactly what was rendered — deterministic
 * — and it exercises the accessibility-mandated path rather than the decorative
 * one.
 */
beforeAll(() => {
  if (typeof window.matchMedia === "undefined") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }),
    });
  }
});

const verification = {
  matched: true,
  status: "active",
  mintedAt: "2026-01-02T14:00:00.000Z",
  sourceKind: "meeting",
  hospitalName: "Hospital Canônico",
  documentId: null,
} as unknown as PrintedDocumentVerification;

const found = (status: string): VerificationOutcome => ({
  state: "found",
  verification: { ...verification, status } as PrintedDocumentVerification,
});

describe("VerificationResult: authenticity no longer asserts CURRENCY", () => {
  it("⛔ an ACTIVE document does not claim to be the current one from its STATUS", () => {
    // The copy used to read "...e é a emissão vigente deste documento", which
    // derived currency from registry status. ADR 0126 D3 makes that unfounded:
    // `status` records deliberate acts only, and an `active` print can legally
    // not be current. The claim must come from the currency axis or not at all.
    render(<VerificationResult outcome={found("active")} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Documento autêntico",
    );
    expect(document.body.textContent).not.toMatch(/emiss[ãa]o vigente/i);
  });

  it("still states authenticity plainly — the removal did not gut the page", () => {
    // Without this, the assertion above is satisfied by a page that says nothing.
    render(<VerificationResult outcome={found("active")} />);
    expect(document.body.textContent).toContain("gerada pela plataforma");
  });
});

describe("VerificationResult: the currency statement (D4's third term)", () => {
  const renderWith = (currency: PrintCurrency, status = "active") =>
    render(<VerificationResult outcome={found(status)} currency={currency} />);

  it("states OUTDATED as its own fact, without claiming a newer print exists", () => {
    renderWith({ kind: "outdated" });
    expect(document.body.textContent).toContain(
      "emitido de uma revisão que não é mais a atual",
    );
    // ⛔ `Substituído` would assert a newer EMISSION exists when none does — an
    // auditor would then ask for a document that was never emitted (D4).
    const currencyBlock = document.querySelector('[data-currency="outdated"]');
    expect(currencyBlock?.textContent?.toLowerCase()).not.toContain("substitu");
  });

  it("states CURRENT as its own fact", () => {
    renderWith({ kind: "current" });
    expect(document.querySelector('[data-currency="current"]')).not.toBeNull();
  });

  it("⛔ a REVOKED document says ANULADO and says NOTHING about currency", () => {
    // D3: the revoked arm performs no join, so there is nothing to report.
    renderWith({ kind: "notApplicable" }, "revoked");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Documento anulado",
    );
    expect(document.querySelector("[data-currency]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/revis[ãa]o atual/i);
  });

  it("⭐ POSITIVE CONTROL: the same page DOES render a currency block when there is one", () => {
    // Without this, "revoked renders no currency block" is satisfied by a
    // component that never renders one at all.
    renderWith({ kind: "current" });
    expect(document.querySelector("[data-currency]")).not.toBeNull();
  });

  it("renders NOTHING about currency when the prop is omitted (not yet sourced)", () => {
    // The door does not return currency yet. Silence is the honest behaviour —
    // far better than telling every surveyor "could not determine" on every
    // document, which is what a `?? null` adapter would have produced.
    render(<VerificationResult outcome={found("active")} />);
    expect(document.querySelector("[data-currency]")).toBeNull();
  });

  it("distinguishes INDETERMINATE from notApplicable on the page, not just in the type", () => {
    // Two absences that mean different things must not read the same. One is a
    // contract violation; the other is a deliberate non-evaluation.
    const { unmount } = renderWith({ kind: "indeterminate" });
    const indeterminateText = document.body.textContent ?? "";
    expect(indeterminateText).toMatch(/não foi possível apurar/i);
    unmount();

    renderWith({ kind: "notApplicable" }, "revoked");
    expect(document.body.textContent ?? "").not.toMatch(/não foi possível apurar/i);
  });

  it("conveys currency by TEXT, never by colour alone (a11y)", () => {
    // Surveyors read this under whatever conditions the audit happens in —
    // greyscale print, screen readers. Strip every class and the meaning must
    // survive.
    renderWith({ kind: "outdated" });
    const block = document.querySelector('[data-currency="outdated"]') as HTMLElement;
    expect(block.textContent?.trim().length ?? 0).toBeGreaterThan(20);
  });
});
