/**
 * Contract tests for {@link usePendingFocus} — the persist-on-change focus keeper
 * (FUP-0137-PERSIST-REFRESH-DROPS-FOCUS).
 *
 * ⛔ **jsdom DOES NOT REPRODUCE THE MECHANISM, and pretending otherwise would make
 * this file vacuous.** The defect is a real browser resetting `document.activeElement`
 * to `<body>` when an ancestor `<fieldset>` becomes `disabled` — measured in Chromium
 * 2026-08-24; jsdom leaves focus where it was. The first assertion below PINS that
 * gap, so nobody later reads a green run here as "the browser behaviour is covered".
 * Every test therefore drives the blur EXPLICITLY and measures what the hook does
 * about it, which is the half that lives in our code.
 */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useState } from "react";

import { usePendingFocus } from "./use-pending-focus";

/**
 * A miniature of the real shape: a control inside a fieldset the pending flag
 * disables, with `park()` called before the flag flips — exactly the order
 * `collects-patient-picker.tsx` uses.
 */
function Harness({ blurOnPending = true }: { blurOnPending?: boolean }) {
  const [pending, setPending] = useState(false);
  const park = usePendingFocus(pending);

  return (
    <div>
      <fieldset disabled={pending}>
        <button
          type="button"
          onClick={() => {
            park();
            setPending(true);
            // Stand in for the browser behaviour jsdom lacks (see the header).
            if (blurOnPending) (document.activeElement as HTMLElement)?.blur();
          }}
        >
          persistir
        </button>
      </fieldset>
      <button type="button" onClick={() => setPending(false)}>
        settle
      </button>
    </div>
  );
}

describe("usePendingFocus", () => {
  it("PINS that jsdom does not reproduce the browser's fieldset-disable blur", () => {
    render(<Harness blurOnPending={false} />);
    const control = screen.getByRole("button", { name: "persistir" });
    control.focus();
    expect(document.activeElement).toBe(control);

    act(() => {
      control.closest("fieldset")!.disabled = true;
    });

    // ⚠ If this ever reds, jsdom gained the behaviour and the explicit `blur()` in
    // the harness can go — do NOT "fix" it by deleting this assertion.
    expect(document.activeElement).toBe(control);
  });

  it("restores the parked control once the pending window closes", () => {
    render(<Harness />);
    const control = screen.getByRole("button", { name: "persistir" });
    control.focus();

    act(() => control.click());
    // The blur half — without it the restore below would be measuring nothing.
    expect(document.activeElement).toBe(document.body);

    act(() => screen.getByRole("button", { name: "settle" }).click());
    expect(document.activeElement).toBe(control);
  });

  it("does NOT steal focus back from a user who moved on", () => {
    render(<Harness />);
    const control = screen.getByRole("button", { name: "persistir" });
    const other = screen.getByRole("button", { name: "settle" });
    control.focus();

    act(() => control.click());
    expect(document.activeElement).toBe(document.body);

    // The user Tabs somewhere else while the write is in flight…
    act(() => other.focus());
    // …and settling must leave them there.
    act(() => other.click());
    expect(document.activeElement).toBe(other);
  });

  it("parks nothing when focus was on <body> to begin with", () => {
    // A mouse user on an engine that does not focus buttons on click. Parking
    // `body` and later "restoring" it would be a no-op wearing the look of a fix.
    render(<Harness blurOnPending={false} />);
    const control = screen.getByRole("button", { name: "persistir" });
    expect(document.activeElement).toBe(document.body);

    act(() => control.click());
    act(() => screen.getByRole("button", { name: "settle" }).click());

    expect(document.activeElement).toBe(document.body);
  });
});
