/**
 * Component tests for the masked {@link TimeField} (grouped-adjustments §F): the
 * auto-formatting numeric mask, `HH:mm` validation with inline invalid feedback,
 * blur normalization of friendly short forms, and the controlled contract every
 * `DateTimePicker` consumer relies on. Deterministic under jsdom (the app's own
 * dev-server preview is flaky), so these stand in for the manual valid/invalid
 * time-entry check.
 */

import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TimeField } from "./time-field";
import { isValidHhmm, maskTimeInput, normalizeHhmm } from "./time-format";

function Controlled({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <TimeField
      aria-label="Hora"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("time-format helpers", () => {
  it("validates HH:mm in the 24h range", () => {
    expect(isValidHhmm("09:30")).toBe(true);
    expect(isValidHhmm("23:59")).toBe(true);
    expect(isValidHhmm("00:00")).toBe(true);
    expect(isValidHhmm("24:00")).toBe(false);
    expect(isValidHhmm("09:60")).toBe(false);
    expect(isValidHhmm("9:30")).toBe(false); // needs two-digit hour
    expect(isValidHhmm("")).toBe(false);
  });

  it("masks digits into a partial HH:mm as the user types", () => {
    expect(maskTimeInput("9")).toBe("9");
    expect(maskTimeInput("09")).toBe("09");
    expect(maskTimeInput("093")).toBe("09:3");
    expect(maskTimeInput("0930")).toBe("09:30");
    expect(maskTimeInput("09:30")).toBe("09:30");
    expect(maskTimeInput("093012")).toBe("09:30"); // capped at 4 digits
  });

  it("normalizes friendly short forms on blur", () => {
    expect(normalizeHhmm("9")).toBe("09:00");
    expect(normalizeHhmm("930")).toBe("09:30");
    expect(normalizeHhmm("0930")).toBe("09:30");
    expect(normalizeHhmm("9:3")).toBe("09:03");
    expect(normalizeHhmm("99")).toBe(""); // out of range
    expect(normalizeHhmm("")).toBe("");
  });
});

/**
 * FBE-007: the isolated helper tests above passed while the field was broken
 * because they never ran the mask → normalize PIPELINE. These exercise the exact
 * runtime sequence — `maskTimeInput(raw)` (what onChange produces) then
 * `normalizeHhmm(masked)` (what blur consumes) — so a mask that mis-places the
 * colon can never blur-clear a salvageable entry.
 */
describe("time-format mask→normalize pipeline (FBE-007)", () => {
  const pipe = (raw: string) => normalizeHhmm(maskTimeInput(raw));

  it("930 → mask '93:0' → normalize '09:30' (the locked AC)", () => {
    expect(maskTimeInput("930")).toBe("93:0");
    expect(pipe("930")).toBe("09:30");
  });

  it("9 → '09:00'", () => {
    expect(pipe("9")).toBe("09:00");
  });

  it("9:3 (explicit colon short form) → '09:03'", () => {
    // A pasted/explicit colon: the mask keeps digits only, so drive normalize
    // directly with the colon form the field would hold.
    expect(normalizeHhmm("9:3")).toBe("09:03");
  });

  it("2560 → mask '25:60' → normalize '' (out of range)", () => {
    expect(maskTimeInput("2560")).toBe("25:60");
    expect(pipe("2560")).toBe("");
  });

  it("2400 → mask '24:00' → normalize '' (out of range)", () => {
    expect(maskTimeInput("2400")).toBe("24:00");
    expect(pipe("2400")).toBe("");
  });

  it("a valid full entry survives the pipeline unchanged", () => {
    expect(pipe("0930")).toBe("09:30");
    expect(pipe("2359")).toBe("23:59");
    expect(pipe("0000")).toBe("00:00");
  });
});

describe("TimeField", () => {
  it("auto-inserts the colon and emits a canonical HH:mm when valid (930 → 09:30)", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Hora") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0930" } });

    // The visible value carries the colon…
    expect(input.value).toBe("09:30");
    // …and the canonical value is emitted.
    expect(onChange).toHaveBeenLastCalledWith("09:30");
  });

  it("flags an out-of-range entry invalid without emitting it", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Hora") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2560" } });

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe uma hora válida",
    );
    // 25:60 is invalid → never emitted as a canonical value.
    expect(onChange).not.toHaveBeenCalledWith("25:60");
  });

  it("normalizes a short hour on blur (9 → 09:00)", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Hora") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);

    expect(input.value).toBe("09:00");
    expect(onChange).toHaveBeenLastCalledWith("09:00");
  });

  it("typing 930 then blurring yields 09:30, never blur-clears (FBE-007)", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Hora") as HTMLInputElement;

    fireEvent.focus(input);
    // The user types 9, 3, 0 — the final change carries the full run "930".
    fireEvent.change(input, { target: { value: "930" } });
    // Mid-type the field holds the mask's partial "93:0" but is NOT flagged
    // invalid (it is salvageable, not out-of-range).
    expect(input.value).toBe("93:0");
    expect(input).not.toHaveAttribute("aria-invalid", "true");

    fireEvent.blur(input);
    // Blur recovers the intended value — the field must NOT clear.
    expect(input.value).toBe("09:30");
    expect(onChange).toHaveBeenLastCalledWith("09:30");
  });

  it("an out-of-range entry (2560) blur-clears to empty (FBE-007)", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Hora") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2560" } });
    fireEvent.blur(input);

    expect(input.value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("emits an empty string when cleared", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText("Hora") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0930" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("renders a hidden input carrying the canonical value for FormData (uncontrolled)", () => {
    const { container } = render(
      <TimeField name="hora" defaultValue="08:15" aria-label="Hora" />,
    );
    const hidden = container.querySelector(
      'input[type="hidden"][name="hora"]',
    ) as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(hidden.value).toBe("08:15");
  });
});
