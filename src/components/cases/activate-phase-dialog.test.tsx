/**
 * Regression tests for the **Atribuir / Reatribuir fase** dialog's due-date field.
 *
 * ⛔ WHY THIS FILE EXISTS: the due-date field used to be a native `<label>` that
 * WRAPPED both a conditional "Remover prazo" `<button>` and the `DatePicker`
 * trigger. A `<label>`'s control is its FIRST labelable descendant, and "Remover
 * prazo" renders before the picker and only once a date is set — so the moment
 * the field had a value, clicking the visible "Prazo (opcional)" text activated
 * "Remover prazo" and **silently cleared the user's date**
 * (BUG-CASEPHASE-DUEDATE-001). The same mis-association also cost the picker its
 * accessible name, and the hint below the control leaked INTO that name.
 *
 * ⚠ THE CLICK TEST MUST BE ABLE TO GO RED. jsdom implements label-activation
 * forwarding, and the first test pins that it does — without it the click test
 * would pass on a build where the label activates nothing at all, which is
 * indistinguishable from "the bug is fixed". Observed red on the pre-fix code:
 * the date was cleared, the name was `"01/03/2023"` (label lost), and the empty
 * state's name was `"Prazo (opcional) Deixe em branco para remover o prazo."`.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

// The dialog imports the `'use server'` actions module (pulls next/headers) — stub it.
vi.mock("@/lib/cases/actions", () => ({
  activatePhase: vi.fn(),
  reassignPhase: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { ActivatePhaseDialog } from "./activate-phase-dialog";

// Radix Dialog needs both — jsdom ships neither.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

/** Reassign mode with an existing deadline — the field renders already filled. */
function openWithDueDate(dueDate = "2023-03-01") {
  return render(
    <ActivatePhaseDialog
      mode="reassign"
      open
      onOpenChange={() => {}}
      casePhaseId="phase-1"
      phaseLabel="Análise"
      currentAssignee="user-1"
      assignees={[
        { userId: "user-1", name: "Ana Souza" },
        { userId: "user-2", name: "Bruno Lima" },
      ]}
      defaultDueDays={null}
      currentDueDate={dueDate}
    />,
  );
}

/**
 * The due-date label and the control it points at.
 *
 * ⚠ Resolved THROUGH `htmlFor`, deliberately: that association is half of what
 * regressed, so a helper that found the button any other way would keep working
 * on a build where the label points somewhere else entirely.
 */
function dueDateField() {
  const label = screen.getByText(/^Prazo/).closest("label");
  if (!label) throw new Error("due-date label is not a <label>");
  const control = document.getElementById(label.htmlFor);
  if (!(control instanceof HTMLButtonElement)) {
    throw new Error(`label htmlFor="${label.htmlFor}" does not resolve to a button`);
  }
  return { label, control };
}

describe("Atribuir fase — the due-date label", () => {
  // ⚠ VACUITY CONTROL for the click test below. If jsdom ever stops forwarding a
  // label click to its control, this reds and the click test's green becomes
  // meaningless — which is the point of asserting it separately.
  it("jsdom forwards a label-text click to the label's control", () => {
    const onClick = vi.fn();
    const { container } = render(
      <label>
        <span>Rótulo</span>
        <button type="button" onClick={onClick} />
      </label>,
    );
    fireEvent.click(container.querySelector("span")!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("clicking the label text does not clear an existing date", () => {
    openWithDueDate();
    expect(dueDateField().control).toHaveTextContent("01/03/2023");

    fireEvent.click(screen.getByText(/^Prazo/));

    // The date must survive. Before the fix this cleared it: the wrapping
    // <label> resolved to "Remover prazo", the first labelable descendant.
    expect(dueDateField().control).toHaveTextContent("01/03/2023");
    // And the clear affordance is still there — the fix must not have worked by
    // simply deleting the button the label was mis-resolving to.
    expect(
      screen.getByRole("button", { name: "Remover prazo" }),
    ).toBeInTheDocument();
  });

  it("wires the trigger's name from the label AND its own contents", () => {
    openWithDueDate();
    const { label, control } = dueDateField();
    // `aria-labelledby="{labelId} {buttonId}"` — the self-reference is what
    // re-admits the button's own rendered date after the label text.
    expect(control).toHaveAttribute("aria-labelledby", `${label.id} ${control.id}`);
    expect(label.id).toBeTruthy();
    expect(control.id).toBeTruthy();
  });

  it("announces the label, and no longer the hint text, when empty", () => {
    openWithDueDate("");
    const { control } = dueDateField();
    expect(control).toHaveAccessibleName(/Prazo/);
    // The hint used to be swept into the name by the wrapping <label>; it is now
    // a description instead.
    expect(control).not.toHaveAccessibleName(/Deixe em branco/);
    expect(control).toHaveAccessibleDescription(/Deixe em branco/);
  });

  /**
   * ⛔ INSTRUMENT LIMIT, PINNED ON PURPOSE — not a wish.
   *
   * The assertion this file would most like to make is that the accessible name
   * CONTAINS the selected date. It cannot, and the reason is narrower than "the
   * self-reference is unsupported" — `dom-accessibility-api` resolves a BARE
   * self-reference fine. It diverges only in the exact shape shipped here: when a
   * `<label for>` ALSO points at the control, the self-referencing token resolves
   * through that label again instead of through the button's own contents, so the
   * rendered date never enters the name.
   *
   * Chromium does not do this — measured via CDP `Accessibility.getPartialAXTree`
   * on this component's real rendered DOM, post-fix:
   *
   *     name = "Prazo (opcional) 01/03/2023"   sources = [relatedElement:aria-labelledby]
   *
   * This test pins the DIVERGENCE on the exact shape, so if testing-library ever
   * aligns with the browser it reds and the real assertion can replace the
   * structural one above, instead of the gap sitting here unnoticed forever.
   */
  it("jsdom's accname drops the contents when a <label for> also names the control", () => {
    const { container } = render(
      <>
        {/* Bare self-reference — jsdom DOES admit the contents here. */}
        <span id="bare-label">Rótulo</span>
        <button id="bare-btn" type="button" aria-labelledby="bare-label bare-btn">
          Valor
        </button>
        {/* The shipped shape: a <label for> as well. jsdom drops "Valor". */}
        <label id="for-label" htmlFor="for-btn">
          Rótulo
        </label>
        <button id="for-btn" type="button" aria-labelledby="for-label for-btn">
          Valor
        </button>
      </>,
    );
    expect(container.querySelector("#bare-btn")).toHaveAccessibleName("Rótulo Valor");
    expect(container.querySelector("#for-btn")).not.toHaveAccessibleName(/Valor/);
  });
});
