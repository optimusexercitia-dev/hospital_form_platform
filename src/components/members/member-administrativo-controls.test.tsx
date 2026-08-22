/**
 * The Administrativo appoint dialog's capability checklist (ADR 0061; ADR 0134 D6 +
 * Amendments 4 & 5) — accessibility wiring and the two claims the `read_cases` entry
 * must not silently lose.
 *
 * ⭐ WHY THIS FILE EXISTS. The component had ZERO unit coverage when `read_cases` — an
 * authorization-facing entry — was added to it. The entry was verified once, by a
 * throwaway spec, which is not coverage: the next edit had nothing to red against.
 *
 * ⛔ THE TWO CLAIMS, and why each is here rather than left to E2E:
 *  1. **The checkbox is checked because the GRANT exists**, never because the client
 *     pre-ticks it (Amendment 5). A box ticked with no grant behind it is a mirror
 *     wider than its door — the exact defect this branch closed. Pinned in both
 *     directions: unchecked with an empty `initialCapabilities`, checked with the
 *     grant present.
 *  2. **The reach word "todos" lives in the HINT, not the label.** The label stands
 *     alone in a checklist and is what a coordinator makes a delegation decision on;
 *     `read_cases` does NOT reach an `explicit_grants_only` case (Amendment 4), so a
 *     label claiming "todos" would be false for a whole class of cases. The hint says
 *     it and bounds it in the next sentence.
 *
 * ⛔ COPY IS DELIBERATELY UNDER-PINNED. Only the label (an accessible name, which E2E
 * keys on) and the ONE phrase carrying the ceiling are asserted. Pinning the hint's
 * wording would make an ordinary copy edit fail for the wrong reason.
 *
 * ⭐ NEUTRALIZATION RECORD — every mutation below was RUN against this file on
 * 2026-08-22 and produced the RED named beside it (`lint:vacuous`, gate 5, cannot see
 * an assertion that was never written, so these are measured, not assumed):
 *  · `aria-describedby={undefined}` on the input → "wires its hint to the checkbox"
 *      REDs: `expected null to be "cap-u1-read_cases-hint"`.
 *  · `CAPABILITIES.slice(0, 4)` at the render (the entry absent) → 4 tests RED;
 *      "renders the five capabilities in array order" REDs on the id list itself.
 *  · `checked={checked || c.key === "read_cases"}` (a client-side default-tick)
 *      → "is unchecked until the grant exists" REDs, and ONLY that one.
 *  · "todos" restored to the label → 3 tests RED. Two red at their by-name query,
 *      which is intended (a rename must force a look at the E2E spec); the third REDs
 *      on the assertion itself — `expected 'Visualizar todos os casos da comissão' not
 *      to match /todos/i` — which is why that test queries by id. See its comment: the
 *      first draft queried by name there, and the `todos` assertion could not have
 *      failed on its own, because the label text IS the accessible name.
 *
 * Text is read through `renderedText` rather than `textContent`: the latter fuses
 * sibling text with no separator, so an assertion can silently miss anything sitting
 * at an element edge (see `disposal-copy-property.ts`).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/members/actions", () => ({
  appointAdministrativo: vi.fn(),
  revokeAdministrativo: vi.fn(),
  grantMemberCapability: vi.fn(),
  revokeMemberCapability: vi.fn(),
}));

import { renderedText } from "@/components/dsr/disposal-copy-property";
import { MemberAdministrativoControls } from "./member-administrativo-controls";

/** The `read_cases` entry's accessible name — also what E2E keys on. */
const READ_CASES_LABEL = "Visualizar os casos da comissão";

/**
 * The one phrase that carries Amendment 4's ceiling: the coordinator must read that
 * this capability stops at a case whose visibility policy is `explicit_grants_only`.
 * Quoted from `VISIBILITY_POLICY_LABELS` so the dialog names the policy with the same
 * words the case itself shows.
 */
const CEILING_PHRASE = "Somente quem receber acesso";

function renderControls(
  overrides: Partial<
    Parameters<typeof MemberAdministrativoControls>[0]
  > = {},
) {
  return render(
    <MemberAdministrativoControls
      commissionId="c1"
      userId="u1"
      memberName="Enfermeiro CCIH Um"
      initialAppointed
      initialCapabilities={[]}
      showPhiNotice={false}
      {...overrides}
    />,
  );
}

describe("Administrativo capability checklist", () => {
  it("renders the five capabilities in array order, one checkbox each", () => {
    renderControls();
    const ids = screen.getAllByRole("checkbox").map((el) => el.id);
    expect(ids).toEqual([
      "cap-u1-schedule_meetings",
      "cap-u1-create_cases",
      "cap-u1-assign_case_phases",
      "cap-u1-view_signoffs",
      "cap-u1-read_cases",
    ]);
  });

  it("gives every checkbox an associated label and keyboard reachability", () => {
    renderControls();
    const boxes = screen.getAllByRole("checkbox");
    // ⚠ Unconditional, and load-bearing: every assertion below is inside the loop, so
    // an empty collection would pass this test having checked nothing at all.
    expect(boxes).toHaveLength(5);
    for (const box of boxes) {
      // The name must come from a real <label for=…>, not an ancestor accident.
      const label = document.querySelector(`label[for="${box.id}"]`);
      expect(label).not.toBeNull();
      expect(box.tagName).toBe("INPUT");
      // Native control, never removed from the tab order.
      expect(box.getAttribute("tabindex")).toBeNull();
      expect(box).toBeEnabled();
      box.focus();
      expect(document.activeElement).toBe(box);
      // The project's visible-focus pattern (CLAUDE.md §8).
      expect(box.className).toContain("focus-visible:ring-[3px]");
    }
  });

  it("renders nothing until the member is appointed", () => {
    renderControls({ initialAppointed: false });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("the read_cases capability entry (ADR 0134 D6)", () => {
  it("wires its hint to the checkbox via aria-describedby", () => {
    const { container } = renderControls();
    const box = screen.getByRole("checkbox", { name: READ_CASES_LABEL });

    const describedBy = box.getAttribute("aria-describedby");
    expect(describedBy).toBe("cap-u1-read_cases-hint");
    const hint = document.getElementById(describedBy!);
    expect(hint).not.toBeNull();

    // The ceiling reaches the coordinator, and it reaches them THROUGH the wiring:
    // asserted on the element `aria-describedby` actually resolves to, not on the page.
    expect(renderedText(hint!)).toContain(CEILING_PHRASE);
    expect(renderedText(container)).toContain(CEILING_PHRASE);

    // Only this entry carries a hint today. Scoped to the no-PHI-notice render on
    // purpose: the `create_cases` PHI notice is currently NOT wired via
    // aria-describedby, and pinning that gap here would red the fix for it.
    const described = screen
      .getAllByRole("checkbox")
      .filter((el) => el.getAttribute("aria-describedby"));
    expect(described).toHaveLength(1);
  });

  it("keeps the reach claim out of the label and inside the bounded hint", () => {
    renderControls();
    // ⚠ Reached by ID, not by accessible name, ON PURPOSE. Keyed on the name, this
    // test would red at the QUERY for any label edit, and the `todos` assertion below
    // could never fail on its own — the label text IS the accessible name. The id is
    // derived from the capability key, so it survives a copy edit and lets the
    // assertion carry its own weight.
    const box = document.getElementById("cap-u1-read_cases")!;
    expect(box).not.toBeNull();
    const label = document.querySelector(`label[for="${box.id}"]`) as HTMLElement;

    // Amendment 4: `read_cases` does not reach an `explicit_grants_only` case, so a
    // bare "todos" in the label would be false for a whole class of cases.
    expect(renderedText(label)).not.toMatch(/todos/i);
    // The label is also an E2E-facing accessible name; pin it so a rename is a
    // deliberate act that forces a look at `e2e/administrativo.spec.ts`.
    expect(renderedText(label).trim()).toBe(READ_CASES_LABEL);

    // …but the reach itself is not lost: the hint states it, and bounds it.
    const hint = document.getElementById("cap-u1-read_cases-hint")!;
    const hintText = renderedText(hint);
    expect(hintText).toMatch(/todos/i);
    expect(hintText).toContain(CEILING_PHRASE);
  });

  it("is unchecked until the grant exists, and checked when it does", () => {
    // Amendment 5: the tick follows the GRANT. No client-side default-checked state.
    const withoutGrant = renderControls();
    expect(
      screen.getByRole("checkbox", { name: READ_CASES_LABEL }),
    ).not.toBeChecked();
    withoutGrant.unmount();

    renderControls({ initialCapabilities: ["read_cases"] });
    expect(
      screen.getByRole("checkbox", { name: READ_CASES_LABEL }),
    ).toBeChecked();
  });
});
