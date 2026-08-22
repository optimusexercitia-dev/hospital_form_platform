/**
 * The post-creation identifier confirmation (ADR 0134 §A2.4).
 *
 * ⛔ THE PROPERTY THIS PROTECTS: the values shown come from the CLIENT draft, and the
 * server contributes field NAMES only. The narrowing that made option D acceptable is
 * that the creation response carries no identifier value — someone "simplifying" this
 * by rendering a server-supplied value would turn a write-only capability into a PHI
 * read path wearing a different name.
 *
 * ⚠ WHAT HOLDS THAT LINE — corrected after QA finding B5-4. An earlier version of this
 * header claimed the `readonly string[]` type on `fieldsSet` meant it "cannot carry" a
 * value. **A type is not a runtime guarantee**: `readonly string[]` accepts
 * `["MRN-4471"]` as happily as `["mrn"]`, erases at compile time, and constrains
 * nothing about what a server actually sends. That sentence asserted the reassuring,
 * structurally-true thing while the mechanisms that can actually break went untested.
 * There are exactly two, and this file's relationship to each is stated rather than
 * implied:
 *
 *  1. **The `FIELDS` whitelist in this component** — an unrecognised key is DROPPED,
 *     never rendered as a label or a value. This is the mechanism that turns a
 *     regressed server response into a no-op instead of a leak, it lives in the file
 *     under test, and it is pinned below with its own neutralization.
 *  2. **`patientFieldsSet`'s keys-only construction** — the reason the response carries
 *     names at all. Still not pinned in THIS file (it is not this component's code),
 *     but ✅ **CLOSED 2026-08-22**, beside the function, in
 *     `src/lib/cases/patient-payload.test.ts`.
 *
 *     ⚠ CORRECTED, and the correction is the useful part. This note previously said the
 *     helper was untestable because it was "module-private (no `export`)". That was the
 *     symptom, not the cause: it lived in `src/lib/cases/actions.ts`, which is
 *     `'use server'`, and such a module may export **only async functions** — so a
 *     synchronous helper there is unreachable from any test regardless of the `export`
 *     keyword. Adding `export` would NOT have fixed it. The helper moved to a pure
 *     module (`src/lib/cases/patient-payload.ts`) precisely because of that constraint.
 *     Recorded because the wrong diagnosis would have sent the next person to add an
 *     `export` and conclude the problem was elsewhere when it still failed.
 *
 * ⭐ NEUTRALIZATION RECORD (run 2026-08-22, each mutation applied alone):
 *  · render `row.key` instead of `row.value` → "shows the value the user typed" REDs.
 *  · drop the `fieldsSet` filter (render every FIELDS entry) → "shows only the fields
 *    the server reported as set" REDs.
 *  · replace the whitelist miss with a passthrough
 *    (`FIELDS[key] ?? { label: key, from: "name" }`) → BOTH whitelist tests RED, each
 *    on the canary string itself (`expected … not to contain
 *    'PRONTUARIO-CANARIO-88231'`), which is the mechanism doing the work made visible.
 *
 * ⚠ All three were re-run after the file was reshaped for B5-4, not carried over from
 * the earlier shape — a recorded control that has not been run against the CURRENT
 * code is a claim about a program that no longer exists.
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

/**
 * ⭐ THE DIFFERENTIAL, and the sharpest pin available here (QA finding B5-4).
 *
 * One distinctive string, two channels. Through `draft` — the channel that is SUPPOSED
 * to show values — it must render. Through `fieldsSet` — the channel that must only
 * ever carry field names — it must not. Same string, same component, same assertion
 * style, opposite verdicts: that is what makes the absence half meaningful rather than
 * a check that would pass against a component rendering nothing at all.
 *
 * ⚠ Without the positive control this pair is exactly the vacuity trap: `not.toContain`
 * passes trivially when the surface is empty, and the emptiest possible component would
 * score perfectly. The control is what proves the canary is renderable in principle.
 */
describe("a value arriving where a field NAME belongs is dropped", () => {
  const CANARY = "PRONTUARIO-CANARIO-88231";

  it("drops a key that is not in the whitelist", () => {
    // Simulates the regression the narrowing exists to prevent: a server that echoed
    // an identifier VALUE into the slot reserved for field names.
    const { container } = render(
      <CasePatientConfirmation
        fieldsSet={[CANARY]}
        draft={DRAFT}
        headingId="h"
      />,
    );
    expect(renderedText(container)).not.toContain(CANARY);
  });

  it("POSITIVE CONTROL — the same string renders when it arrives as a value", () => {
    const { container } = render(
      <CasePatientConfirmation
        fieldsSet={["mrn"]}
        draft={{ ...DRAFT, mrn: CANARY }}
        headingId="h"
      />,
    );
    expect(renderedText(container)).toContain(CANARY);
  });

  it("keeps the good keys while dropping the bad one, in one render", () => {
    // A mixed payload: the whitelist must not be all-or-nothing. The labels of the
    // recognised keys still render, so the drop is targeted rather than a bail-out.
    const { container } = render(
      <CasePatientConfirmation
        fieldsSet={["name", CANARY, "mrn"]}
        draft={DRAFT}
        headingId="h"
      />,
    );
    const text = renderedText(container);
    expect(text).toContain("Nome");
    expect(text).toContain("Maria de Teste");
    expect(text).toContain("MRN-4471");
    expect(text).not.toContain(CANARY);
  });
});
