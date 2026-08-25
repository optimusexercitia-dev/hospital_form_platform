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
      <PreviaLink sourceKind="form_response" sourceId={SOURCE_ID} phiCapable={false} />,
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
      <PreviaLink sourceKind="meeting" sourceId={SOURCE_ID} phiCapable={false} />,
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
      <PreviaLink sourceKind="meeting" sourceId={SOURCE_ID} phiCapable={false} />,
    );
    expect(container.textContent).toMatch(/não é registrada/i);
    expect(container.textContent).toMatch(/código de verificação/i);
    expect(container.textContent).toMatch(/RASCUNHO/);
  });

  it("opens in a new tab safely (target=_blank implies rel=noopener)", () => {
    const { container } = render(
      <PreviaLink sourceKind="form_response" sourceId={SOURCE_ID} phiCapable={false} />,
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
      <PreviaLink sourceKind="meeting" sourceId={SOURCE_ID} phiCapable={false} />,
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

describe("⭐ the PHI fork on a prévia (ADR 0144 D9)", () => {
  it("⛔ a PHI-INCAPABLE kind gets exactly ONE link — and it is the real one", () => {
    const { container } = render(
      <PreviaLink sourceKind="meeting" sourceId={SOURCE_ID} phiCapable={false} />,
    );
    const anchors = [...container.querySelectorAll("a")];
    // POSITIVE half FIRST — a component rendering nothing would also have no
    // identified link, which is the vacuity this file's header forbids.
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe(`/api/previa/meeting/${SOURCE_ID}`);
    // NEGATIVE half: no query string at all, and no identified wording.
    expect(anchors[0].getAttribute("href")).not.toContain("phi");
    expect(container.textContent).not.toMatch(/identificad/i);
  });

  it("⭐ a PHI-CAPABLE kind gets a SECOND, separately-addressed link", () => {
    const { container } = render(
      <PreviaLink sourceKind="case" sourceId={SOURCE_ID} phiCapable />,
    );
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toHaveLength(2);
    // The DIFFERENTIAL that matters: the de-identified link is UNCHANGED by the
    // capability. A component that appended `?phi=1` to both — or that swapped
    // the single link's destination instead of adding one — passes a bare
    // "contains ?phi=1" assertion and fails this one.
    expect(hrefs[0]).toBe(`/api/previa/case/${SOURCE_ID}`);
    expect(hrefs[1]).toBe(`/api/previa/case/${SOURCE_ID}?phi=1`);
  });

  it("⛔ the identified link is a LINK, not a checkbox beside the first one", () => {
    // A toggle would let a mis-click silently change what the next click
    // produces — a prévia has no confirm step to catch it (unlike the mint).
    const { container } = render(
      <PreviaLink sourceKind="case" sourceId={SOURCE_ID} phiCapable />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(2);
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector('[role="checkbox"]')).toBeNull();
  });

  it("⛔ never promises ABSENCE on the de-identified link", () => {
    // ADR 0144 D6: the confidentiality band derives from free-text presence, so
    // the de-identified variant is NOT "sem dados do paciente". Copy that says
    // otherwise is the most dangerous string on this surface — a user who
    // believes it hands the PDF to someone they otherwise would not.
    const { container } = render(
      <PreviaLink sourceKind="case" sourceId={SOURCE_ID} phiCapable />,
    );
    const text = container.textContent!;
    for (const promise of [
      /sem dados do paciente/i,
      /sem identificação/i,
      /anônim/i,
      /não contém dados/i,
    ]) {
      expect(promise.test(text), `copy promises absence: ${promise}`).toBe(false);
    }
    // ...and it DOES say something about the identified variant (the negatives
    // above are not satisfied by an empty render).
    expect(text).toMatch(/identificação do paciente/i);
  });

  it("⛔ states that an identified prévia is AUDITED, without the reserved verb", () => {
    const { container } = render(
      <PreviaLink sourceKind="case" sourceId={SOURCE_ID} phiCapable />,
    );
    const text = container.textContent!;
    expect(text).toMatch(/trilha de auditoria/i);
    // The reserved-verb rule (ADR 0125 D5) still holds with the fork rendered —
    // "mesmo sem emissão" would deny the act while putting the reserved token on
    // a prévia surface, which is exactly what the standing sweep looks for.
    expect(RESERVED_VERB.test(text)).toBe(false);
  });

  it("previaHref emits EXACTLY `?phi=1`, and only when asked", () => {
    // The literal form is a contract with the route that parses it; `phi=true`
    // or `phi` alone would render a de-identified document from a link the user
    // chose for the opposite reason, silently.
    expect(previaHref("case", SOURCE_ID, true)).toBe(
      `/api/previa/case/${SOURCE_ID}?phi=1`,
    );
    expect(previaHref("case", SOURCE_ID, false)).toBe(
      `/api/previa/case/${SOURCE_ID}`,
    );
    // Default is the de-identified variant, mirroring the mint's default-OFF.
    expect(previaHref("case", SOURCE_ID)).toBe(`/api/previa/case/${SOURCE_ID}`);
  });
});
