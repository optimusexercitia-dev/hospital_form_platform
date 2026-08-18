import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { printSourceRegisters } from "@/lib/pdf/documents/print-source";

import { PREVIA_BUTTON_LABEL, previaHref } from "./labels";
import { PreviaLink } from "./previa-link";

/**
 * ADR 0125 D1/D2/D5 — the ephemeral affordance and its vocabulary.
 *
 * ⛔ **Every assertion here is TWO-SIDED.** A test that only asserts *"does not
 * say Emitir"* passes against a component that renders nothing at all — the
 * exact shape that nearly shipped a vacuous D6 keystone on the SQL side, where a
 * deny-leg `throws_ok(…, '42501')` passed on the fixture's own permission error.
 * Every negative below is paired with the positive that proves the subject
 * exists and is capable of failing.
 */

const SOURCE_ID = "11111111-2222-3333-4444-555555555555";
const RESERVED_VERB = /emit|emiss/i;

describe("PreviaLink: the ephemeral affordance", () => {
  it("renders the prévia label and links to the streaming route", () => {
    const { container } = render(
      <PreviaLink sourceKind="form_response" sourceId={SOURCE_ID} />,
    );
    const anchor = container.querySelector("a")!;
    expect(anchor).not.toBeNull();
    expect(anchor.textContent).toContain(PREVIA_BUTTON_LABEL);
    expect(anchor.getAttribute("href")).toBe(
      `/api/previa/form_response/${SOURCE_ID}`,
    );
  });

  it("⛔ never uses the RESERVED VERB — and the subject provably exists", () => {
    const { container } = render(
      <PreviaLink sourceKind="meeting" sourceId={SOURCE_ID} />,
    );
    // POSITIVE half FIRST: the component rendered real content. Without this,
    // the negative below is satisfied by a component returning null.
    expect(container.textContent!.length).toBeGreaterThan(40);
    expect(container.querySelector("a")).not.toBeNull();
    // NEGATIVE half:
    expect(RESERVED_VERB.test(container.textContent!)).toBe(false);
  });

  it("states that the prévia is unregistered and unverifiable", () => {
    const { container } = render(
      <PreviaLink sourceKind="meeting" sourceId={SOURCE_ID} />,
    );
    expect(container.textContent).toMatch(/não é registrada/i);
    expect(container.textContent).toMatch(/código de verificação/i);
    expect(container.textContent).toMatch(/RASCUNHO/);
  });

  it("opens in a new tab safely (target=_blank implies rel=noopener)", () => {
    const { container } = render(
      <PreviaLink sourceKind="form_response" sourceId={SOURCE_ID} />,
    );
    const anchor = container.querySelector("a")!;
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toContain("noopener");
  });
});

describe("⛔ the helper copy states the CONSEQUENCE, never the CAUSE", () => {
  it("names no specific reason a source fails to register", () => {
    // A source can be non-registering because it is a draft, because an open
    // correction is still rejectable, because its phase was voided, because the
    // ata was cancelled, or because its minutes were disposed. Naming ONE would
    // be right for some sources and a lie for the rest — the §K class exactly.
    const { container } = render(
      <PreviaLink sourceKind="meeting" sourceId={SOURCE_ID} />,
    );
    const text = container.textContent!;
    for (const cause of [
      /ainda não foi enviad/i,
      /ainda não .*assinatura/i,
      /não foi assinad/i,
      /rascunho ainda/i,
    ]) {
      expect(cause.test(text), `copy asserts a specific cause: ${cause}`).toBe(false);
    }
    // ...and it DOES say something (the negatives above are not vacuous).
    expect(text).toMatch(/prévia/i);
  });
});

describe("⭐ the DERIVED choice — which affordance a source gets (ADR 0125 D1)", () => {
  // These pin the predicate the panel branches on, so a change to
  // `printSourceRegisters` that would silently re-route an affordance reds here
  // as well as in the vector suite.

  it("a LOCKED source registers → the mint affordance, not the prévia", () => {
    expect(printSourceRegisters("form_response", { status: "submitted" })).toBe(true);
    expect(printSourceRegisters("meeting", { status: "signed" })).toBe(true);
  });

  it("⭐ an in_signature ata REGISTERS — the boundary is LOCK, not finality", () => {
    // "Emitir documento" is CORRECT here even though the ata is non-final: it
    // registers, stamped RASCUNHO. Getting this wrong would relabel a genuine
    // record-producing act as a preview.
    expect(printSourceRegisters("meeting", { status: "in_signature" })).toBe(true);
  });

  it("⛔ a DISPOSED signed ata must NOT be offered 'Emitir documento'", () => {
    // ADR 0126 Amendment 1 §F — disposal empties the content without touching
    // status, so the ata stops registering while still reading `signed`.
    expect(
      printSourceRegisters("meeting", { status: "signed", meetingDisposed: true }),
    ).toBe(false);
    // The DIFFERENTIAL: the same ata undisposed still registers, so this is not
    // satisfied by a predicate that refuses every meeting.
    expect(printSourceRegisters("meeting", { status: "signed" })).toBe(true);
  });

  it("⛔ a submitted correction draft and a voided phase get the PRÉVIA", () => {
    expect(
      printSourceRegisters("form_response", { status: "submitted", correctionOpen: true }),
    ).toBe(false);
    expect(
      printSourceRegisters("form_response", { status: "submitted", phaseVoided: true }),
    ).toBe(false);
    // Differential against a fail-closed stub:
    expect(printSourceRegisters("form_response", { status: "submitted" })).toBe(true);
  });

  it("the prévia href is kind-correct for both active kinds", () => {
    expect(previaHref("form_response", SOURCE_ID)).toBe(
      `/api/previa/form_response/${SOURCE_ID}`,
    );
    expect(previaHref("meeting", SOURCE_ID)).toBe(`/api/previa/meeting/${SOURCE_ID}`);
  });
});
