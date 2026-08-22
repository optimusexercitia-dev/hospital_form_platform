/**
 * The post-creation identifier confirmation (ADR 0134 §A2.4).
 *
 * ⛔ THE PROPERTY THIS PROTECTS: the values shown come from the CLIENT draft, and the
 * server contributes field NAMES only. The narrowing that made option D acceptable is
 * that the creation response carries no identifier value — someone "simplifying" this
 * by rendering a server-supplied value would turn a write-only capability into a PHI
 * read path wearing a different name. The `fieldsSet` prop is typed `readonly string[]`
 * precisely so it cannot carry one; these tests pin that the rendered values track the
 * DRAFT and nothing else.
 *
 * ⭐ NEUTRALIZATION RECORD (run 2026-08-22): rendering `row.key` instead of
 * `row.value` turns "shows the value the user typed" RED; dropping the `fieldsSet`
 * filter (rendering every FIELDS entry) turns "shows only the fields the server
 * reported as set" RED.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderedText } from "@/components/dsr/disposal-copy-property";
import { CasePatientConfirmation } from "./case-patient-confirmation";
import type { PatientDraft } from "@/components/safety/patient-fields";

const DRAFT: PatientDraft = {
  name: "Maria de Teste",
  mrn: "MRN-4471",
  dateOfBirth: "1980-02-01",
  ageYears: "",
  sex: "female",
  encounterRef: "",
  unit: "",
  attending: "",
};

describe("CasePatientConfirmation", () => {
  it("shows the value the user typed, under its own label", () => {
    const { container } = render(
      <CasePatientConfirmation
        fieldsSet={["name", "mrn"]}
        draft={DRAFT}
        headingId="h"
      />,
    );
    const text = renderedText(container);
    expect(text).toContain("Maria de Teste");
    expect(text).toContain("MRN-4471");
    expect(text).toContain("Prontuário");
  });

  it("shows only the fields the server reported as set", () => {
    const { container } = render(
      <CasePatientConfirmation fieldsSet={["mrn"]} draft={DRAFT} headingId="h" />,
    );
    const text = renderedText(container);
    expect(text).toContain("MRN-4471");
    // The draft HAS a name; the server did not report it, so it is not shown.
    expect(text).not.toContain("Maria de Teste");
  });

  it("never claims to show what was stored", () => {
    // The confirmation catches a TYPING error. A server-side normalization
    // difference is invisible to it by design, so the copy must not imply otherwise.
    const { container } = render(
      <CasePatientConfirmation
        fieldsSet={["name"]}
        draft={DRAFT}
        headingId="h"
      />,
    );
    const text = renderedText(container);
    expect(text).toMatch(/digitou/i);
    expect(text).not.toMatch(/salvo|armazenad|gravad/i);
  });

  it("renders nothing when no reported field has a value", () => {
    const { container } = render(
      <CasePatientConfirmation
        fieldsSet={["attending"]}
        draft={DRAFT}
        headingId="h"
      />,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
