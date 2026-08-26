/**
 * The `DatePicker` clear affordance — the AFF4 regression guard.
 *
 * ⛔ WHAT BROKE, stated as the differential it was measured as. One variable changed,
 * otherwise identical DOM, WITH A DATE SET:
 *
 *     clearable={false} → "Suspenso até (opcional) 01/03/2023"
 *     clearable={true}  → "Suspenso até (opcional) 01/03/2023 Remover data"
 *
 * The trigger announced a DIFFERENT action's name, at 10 call sites. Two defects, one
 * repair: the clear affordance was a `<span role="button" tabIndex={-1} aria-label>`
 * NESTED INSIDE the trigger `<button>` (pre-existing, invalid, and unreachable), and F0's
 * `aria-labelledby="{labelId} {buttonId}"` self-reference re-admitted the button's own
 * contents — which is what pulled that nested name into the trigger's. The fix moves the
 * control OUT as a real sibling `<button>`.
 *
 * ⛔⛔ THESE TESTS DELIBERATELY DO NOT USE `toHaveAccessibleName`, AND UPGRADING THEM TO
 * IT WOULD MAKE THEM VACUOUS. Measured under this repo's jsdom + `dom-accessibility-api`
 * on the PRE-REPAIR component, both `clearable` states, date set:
 *
 *   with a `<label for>` (the real call-site shape) → "Suspenso até (opcional)" for BOTH
 *   without one, `aria-labelledby` at a <span>     → "Suspenso até (opcional) 01/03/2023"
 *                                                    for BOTH
 *
 * `dom-accessibility-api` resolves the self-referencing token through the `<label for>`
 * instead of the button's contents, and even in the second shape it never walks a
 * descendant's `aria-label`. So the *name string* differential — the thing the defect
 * actually is — is INVISIBLE here and is only observable in Chromium. What IS visible,
 * and what the defect actually consists of, is the MECHANISM: a named, interactive
 * descendant inside the trigger. That is what is asserted below.
 *
 * ⚠ EVERY CASE SETS A DATE, AND THAT IS LOAD-BEARING. The clear affordance does not
 * render at all while the field is empty, so a measurement taken from a freshly-opened
 * dialog is systematically blind to this entire defect — which is exactly how
 * `FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME` came to record the empty-state name
 * as its worked example. `expectsHasADate` below fails loudly if a future edit lets the
 * fixture drift back to empty, so the suite cannot go green having measured the state in
 * which the bug cannot exist.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { DatePicker } from "@/components/ui/date-picker";

/** The date every case carries. Chosen to match the recorded differential above. */
const D = "2023-03-01";
const D_DISPLAY = "01/03/2023";
const LABEL = "Suspenso até (opcional)";

/**
 * The exact call-site shape of the 10 affected sites: an external `<label htmlFor>` whose
 * id is handed to the picker as `labelId`, which is what produces the self-reference.
 */
function Field({ clearable, disabled }: { clearable: boolean; disabled?: boolean }) {
  return (
    <>
      <label id="lbl" htmlFor="dp">
        {LABEL}
      </label>
      <DatePicker
        id="dp"
        labelId="lbl"
        value={D}
        onChange={() => {}}
        clearable={clearable}
        disabled={disabled}
      />
    </>
  );
}

function trigger(): HTMLButtonElement {
  const el = document.getElementById("dp");
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error("#dp did not resolve to the trigger button");
  }
  return el;
}

/**
 * The fixture guard. If this ever fails, the differential below is measuring the EMPTY
 * state, where the defect cannot exist and every assertion passes for the wrong reason.
 */
function expectsHasADate() {
  expect(trigger()).toHaveTextContent(D_DISPLAY);
}

/**
 * Every author-supplied NAME reachable inside the trigger.
 *
 * This is the contamination channel itself, not a proxy for it: the trigger's
 * `aria-labelledby` self-reference resolves `{buttonId}` by walking its own contents, and
 * any descendant carrying a name of its own is appended to the trigger's name at that
 * point. An empty list is the invariant; a non-empty one IS the bug.
 */
function authoredNamesInsideTrigger(): string[] {
  return Array.from(
    trigger().querySelectorAll<HTMLElement>("[aria-label], [aria-labelledby]"),
  ).map(
    (n) => n.getAttribute("aria-label") ?? `labelledby:${n.getAttribute("aria-labelledby")}`,
  );
}

/** Every element inside the trigger that claims an interactive role. */
function interactiveInsideTrigger(): string[] {
  return Array.from(
    trigger().querySelectorAll<HTMLElement>("[role], button, a[href], input, select, textarea"),
  ).map((n) => n.getAttribute("role") ?? n.tagName.toLowerCase());
}

describe("DatePicker clear affordance — the trigger's name is not contaminated", () => {
  it("⭐ THE DIFFERENTIAL: `clearable` changes NOTHING about the trigger's name sources", () => {
    // One variable, otherwise identical DOM — measured with a date SET, never empty.
    const { unmount } = render(<Field clearable={false} />);
    expectsHasADate();
    const withoutClear = authoredNamesInsideTrigger();
    unmount();

    render(<Field clearable />);
    expectsHasADate();
    const withClear = authoredNamesInsideTrigger();

    // ⛔ THIS IS THE ASSERTION THAT FAILS ON A PRE-REPAIR BUILD. There, `withClear` is
    // `["Remover data"]` while `withoutClear` is `[]` — the trigger's name gains a
    // different action's label purely because the field became clearable.
    expect(withClear).toEqual(withoutClear);
    expect(withClear).toEqual([]);
  });

  it("puts NO interactive content inside the trigger, in either state", () => {
    // Invalid HTML on its own terms, independently of the naming defect: a button may
    // not contain interactive content.
    const { unmount } = render(<Field clearable={false} />);
    expectsHasADate();
    expect(interactiveInsideTrigger()).toEqual([]);
    unmount();

    render(<Field clearable />);
    expectsHasADate();
    expect(interactiveInsideTrigger()).toEqual([]);
  });

  it("keeps the trigger's own wiring intact — the fix must not trade the F0 name away", () => {
    render(<Field clearable />);
    const t = trigger();
    // The label + own-contents composition is the whole point of F0; the repair moves a
    // sibling out, it does not undo the naming strategy.
    expect(t).toHaveAttribute("aria-labelledby", "lbl dp");
    expect(t).not.toHaveAttribute("aria-label");
    expect(t).toHaveAttribute("aria-haspopup", "dialog");
  });
});

describe("DatePicker clear affordance — it is a real, reachable control", () => {
  it("renders a sibling <button>, NOT a descendant of the trigger", () => {
    render(<Field clearable />);
    expectsHasADate();
    const clear = screen.getByRole("button", { name: /Remover data/ });
    expect(clear.tagName).toBe("BUTTON");
    // The structural half of the repair. `contains` returns true for the element itself,
    // so this also fails if the two ever collapse into one node.
    expect(trigger().contains(clear)).toBe(false);
  });

  it("⛔ is KEYBOARD REACHABLE — it was `tabIndex={-1}` before, i.e. reachable by nobody", () => {
    render(<Field clearable />);
    const clear = screen.getByRole("button", { name: /Remover data/ });
    expect(clear).not.toHaveAttribute("tabindex");
    expect(clear.tabIndex).toBe(0);
  });

  it("names itself from its own text PLUS the field's label, so siblings stay distinct", () => {
    render(<Field clearable />);
    const clear = screen.getByRole("button", { name: /Remover data/ });
    // Two clearable date fields in one dialog must not both announce as a bare
    // "Remover data" — the same disambiguation `ActionsReview` keeps for its triggers.
    expect(clear).toHaveAttribute("aria-labelledby", "dp-clear lbl");
    expect(within(clear).getByText("Remover data")).toBeInTheDocument();
  });

  it("⛔ is NOT hidden from assistive tech — `aria-hidden` here would be the wrong repair", () => {
    render(<Field clearable />);
    const clear = screen.getByRole("button", { name: /Remover data/ });
    // Silencing the control would fix the contamination by deleting a control from
    // assistive tech entirely, which is worse than the bug. `getByRole` above already
    // fails if it is hidden; this states the requirement rather than leaving it implied.
    expect(clear).not.toHaveAttribute("aria-hidden");
    expect(clear.closest("[aria-hidden='true']")).toBeNull();
  });

  it("does not render at all while the field is EMPTY — the value-dependence, pinned", () => {
    // The state every previous measurement of this defect was taken in. Pinning it is
    // what makes the "with a date" fixture above a deliberate choice rather than a
    // coincidence someone could tidy away.
    render(
      <>
        <label id="lbl" htmlFor="dp">
          {LABEL}
        </label>
        <DatePicker id="dp" labelId="lbl" value="" onChange={() => {}} clearable />
      </>,
    );
    expect(trigger()).not.toHaveTextContent(D_DISPLAY);
    expect(screen.queryByRole("button", { name: /Remover data/ })).toBeNull();
  });

  it("is inert when the field is disabled — a sibling does not inherit the trigger's state", () => {
    // The old affordance was inside a disabled `<button>`, so it was unclickable for
    // free. A sibling is not, and an enabled clear control on a disabled field would be
    // a regression introduced BY this repair.
    render(<Field clearable disabled />);
    expect(screen.getByRole("button", { name: /Remover data/ })).toBeDisabled();
  });
});
