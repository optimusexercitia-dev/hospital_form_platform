/**
 * The `DatePicker` accessible-name contract, asserted at the call sites that used
 * to break it with `aria-label` (FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME).
 *
 * ⛔ WHY THE CONTRACT LIVES AT THE CALL SITE. `DatePicker` cannot enforce this
 * alone: the trigger's own contents ARE the value, so any author-supplied name that
 * outranks `contents:` silently displaces it. `aria-label`, `<label for>` and a
 * wrapping `<label>` all outrank it (measured, Chromium CDP name-sources). The only
 * shape that keeps both is `aria-labelledby="{labelId} {buttonId}"` — the `labelId`
 * prop — and whether a site passes it is a property of the site.
 *
 * ⚠ THESE TESTS DELIBERATELY DO NOT ASSERT THE VALUE IS IN THE NAME, even though
 * that is the point of the fix. `dom-accessibility-api` (behind jest-dom's
 * `toHaveAccessibleName`) diverges from Chromium for exactly this shape: with a
 * `<label for>` also naming the control, it resolves the self-referencing token
 * through that label instead of the button's contents, so it reports label-only.
 * `activate-phase-dialog.test.tsx` pins that divergence directly. The real names
 * here were measured in Chromium against these components' rendered DOM:
 *
 *   "Data de nascimento (obrigatório) 01/03/2023"
 *   "Prazo — Ação com responsável identificado 01/03/2023"
 *
 * So what is asserted below is the WIRING that produces them, plus the absence of
 * the `aria-label` that used to defeat it — the two things that can regress here.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { PatientFields, EMPTY_PATIENT_DRAFT } from "@/components/safety/patient-fields";
import { ActionsReview } from "@/components/meetings/review/actions-review";

const D = "2023-03-01";

/** The date trigger, and the label that claims it. */
function field(labelText: RegExp) {
  const label = screen.getByText(labelText).closest("label");
  if (!label) throw new Error("label text is not inside a <label>");
  const control = document.getElementById(label.htmlFor);
  if (!(control instanceof HTMLButtonElement)) {
    throw new Error(`htmlFor="${label.htmlFor}" does not resolve to a button`);
  }
  return { label, control };
}

/** The invariant every fixed call site must satisfy. */
function expectNameCarriesLabelAndOwnContents(
  label: HTMLLabelElement,
  control: HTMLButtonElement,
) {
  // ⛔ An `aria-label` here would outrank and DISPLACE the button's contents —
  // this is the exact regression both sites are being held against.
  expect(control).not.toHaveAttribute("aria-label");
  expect(label.id).toBeTruthy();
  expect(control.id).toBeTruthy();
  expect(control).toHaveAttribute("aria-labelledby", `${label.id} ${control.id}`);
}

describe("PatientFields — date of birth", () => {
  function open(required: boolean, dob = D) {
    return render(
      <PatientFields
        idPrefix="probe"
        draft={{ ...EMPTY_PATIENT_DRAFT, dateOfBirth: dob }}
        onChange={() => {}}
        requiredFields={required ? ["name", "mrn", "date_of_birth", "sex"] : []}
      />,
    );
  }

  it("names the trigger from its label plus its own contents", () => {
    open(true);
    const { label, control } = field(/^Data de nascimento/);
    expectNameCarriesLabelAndOwnContents(label, control);
  });

  it("keeps the required marking IN the name, because a button has no aria-required", () => {
    open(true);
    // The suffix has to be part of the NAME — `aria-required` is not supported on
    // role=button, so there is nowhere else for it to live.
    expect(field(/^Data de nascimento/).label).toHaveTextContent(
      "Data de nascimento (obrigatório)",
    );
    expect(field(/^Data de nascimento/).control).not.toHaveAttribute("aria-required");
  });

  it("omits the marking when the field is not required — it is selective", () => {
    open(false);
    const { label } = field(/^Data de nascimento/);
    expect(label).toHaveTextContent("Data de nascimento");
    expect(label).not.toHaveTextContent("(obrigatório)");
  });
});

describe("ActionsReview — action due date", () => {
  function open(title: string, due: string | null = D) {
    return render(
      <ul>
        <ActionsReview
          item={{
            key: "a1",
            title,
            description: "",
            assigned_to: null,
            owner_ref: null,
            owner_text: null,
            due_date: due,
            deadline_text: null,
            agenda_ref: null,
            include: true,
          }}
          onChange={() => {}}
          assignees={[]}
          agendaOptions={[]}
        />
      </ul>,
    );
  }

  it("names the trigger from its label plus its own contents", () => {
    open("Ação com responsável identificado");
    const { label, control } = field(/^Prazo/);
    expectNameCarriesLabelAndOwnContents(label, control);
  });

  it("keeps the row title in the name, so sibling rows stay distinguishable", () => {
    // ⛔ This is why the site had an `aria-label` at all: a review list renders many
    // of these, and a bare "Prazo" would name every one of them identically. The
    // disambiguator had to survive the fix, not be traded away for it.
    open("Ação com responsável identificado");
    expect(field(/^Prazo/).control).toHaveAccessibleName(
      /Prazo — Ação com responsável identificado/,
    );
  });

  it("falls back to a generic row name when the title is still empty", () => {
    open("");
    expect(field(/^Prazo/).control).toHaveAccessibleName(/Prazo — item de ação/);
  });
});
