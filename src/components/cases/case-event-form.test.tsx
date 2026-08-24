/**
 * Component tests for the **Adicionar / Editar registro** dialog.
 *
 * ⛔ WHY THIS FILE EXISTS AT ALL: as of 2026-08-24 this dialog is the ONLY way to
 * author a case record. The Atividade card's inline composer was removed (superseding
 * half of ADR 0137 D12), and the composer was where these properties were asserted.
 * Deleting a subject deletes its assertions in two directions, and a REMOVED
 * assertion is invisible to `lint:vacuous` — the gate reads the tests that exist, not
 * the ones that used to. So the three surviving properties MOVED here rather than
 * dying with their old host.
 *
 * ⚠ ONE OF THEM WAS ALREADY BROKEN HERE when it moved. The composer had been fixed
 * for FUP-0137-ALERT-INSIDE-LABEL-MUTATES-NAME; this dialog never was, because at the
 * time it was the secondary path and nobody swept the sibling. Removing the composer
 * promoted the defect to the only path. The last test below is what caught it.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const createCaseEvent = vi.fn();
const updateCaseEvent = vi.fn();

// The dialog imports the `'use server'` actions module (pulls next/headers) — stub it.
vi.mock("@/lib/cases/documents-actions", () => ({
  createCaseEvent: (...args: unknown[]) => createCaseEvent(...args),
  updateCaseEvent: (...args: unknown[]) => updateCaseEvent(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { CaseEventForm } from "./case-event-form";

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

beforeEach(() => {
  createCaseEvent.mockReset();
  updateCaseEvent.mockReset();
});

function open(props: Partial<React.ComponentProps<typeof CaseEventForm>> = {}) {
  return render(
    <CaseEventForm
      mode="create"
      open
      onOpenChange={() => {}}
      caseId="case-1"
      {...props}
    />,
  );
}

describe("Adicionar registro — the kind vocabulary", () => {
  it("offers the six manual kinds and no others", () => {
    open();
    // ⚠ Scoped to the Tipo select, not the whole dialog: `Visibilidade` is a second
    // <select> whose options would otherwise be counted into this total, and the
    // count is the assertion.
    const tipo = screen.getByRole("combobox", { name: "Tipo" });
    expect(within(tipo).getAllByRole("option")).toHaveLength(6);

    // ⛔ The four ACTION-ITEM types from the `case_activity_card` handoff must never
    // appear here. Adopting them would be a three-place vocabulary migration
    // (`case_events_kind_check`, `app.is_manual_case_event_kind` — the `kind` arm of
    // four RLS write policies — and the referral internal-notes picker), so the
    // pressure to add them "just in the UI" is exactly what this guards.
    expect(within(tipo).queryByRole("option", { name: "Impedimento" })).toBeNull();
    expect(within(tipo).queryByRole("option", { name: "Progresso" })).toBeNull();
  });
});

describe("Adicionar registro — Visibilidade is coordinator-only (ETH·E3a)", () => {
  it("omits the control entirely for a non-coordinator and offers it to a coordinator", () => {
    // ⚠ Both halves in one test, on two renders. The absence alone would pass on a
    // dialog that failed to render; the presence alone would not pin that a
    // non-coordinator cannot reach `coordinator_only`.
    const { unmount } = open();
    expect(screen.queryByRole("combobox", { name: "Visibilidade" })).toBeNull();
    unmount();

    open({ canSetVisibility: true });
    const vis = screen.getByRole("combobox", { name: "Visibilidade" });
    expect(vis).toBeInTheDocument();
    expect(
      within(vis).getByRole("option", { name: "Somente coordenação" }),
    ).toBeInTheDocument();
  });
});

describe("Adicionar registro — the body control's accessible name", () => {
  /**
   * FUP-0137-ALERT-INSIDE-LABEL-MUTATES-NAME, re-homed from the composer.
   *
   * ⛔ THE PROPERTY IS INVARIANCE OF THE NAME ACROSS THE ERROR TRANSITION, not the
   * presence of one string. Querying `{ name: "Descrição" }` in the clean state alone
   * passes on the DEFECTIVE build too — the defect appears only once the error
   * renders, and only in the NAME. So the same query runs twice, either side of a
   * failed submit, and the second half is the one that reds on the old markup (where
   * the `role="alert"` was a child of the wrapping `<label>`, making the name
   * "Descrição Descreva o registro.").
   *
   * ⚠ Paired with a presence assertion on the MESSAGE: a "fix" that dropped the alert
   * entirely would keep the name invariant and silently lose the error — a worse
   * defect wearing this test's green.
   */
  it("stays 'Descrição' when the body errors, and the message is reachable from it", async () => {
    createCaseEvent.mockResolvedValueOnce({
      ok: false,
      fieldErrors: { body: "Descreva o registro." },
    });

    open();

    const clean = screen.getByRole("textbox", { name: "Descrição" });
    expect(clean).toBeInTheDocument();

    fireEvent.change(clean, { target: { value: "Reunião realizada." } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    // The message must actually arrive — otherwise the invariance below is measured
    // over a transition that never happened.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Descreva o registro.",
    );

    // THE ASSERTION.
    expect(
      screen.getByRole("textbox", { name: "Descrição" }),
    ).toBeInTheDocument();

    // …and the message is REACHABLE from the control, which the old markup never
    // provided: a user tabbing back to the invalid field heard nothing at all.
    const described = screen
      .getByRole("textbox", { name: "Descrição" })
      .getAttribute("aria-describedby");
    expect(described).toBeTruthy();
    expect(document.getElementById(described!)).toHaveTextContent(
      "Descreva o registro.",
    );
  });
});
