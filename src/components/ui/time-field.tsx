"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  isValidHhmm,
  maskTimeInput,
  normalizeHhmm,
} from "@/components/ui/time-format";

export interface TimeFieldProps {
  value?: string; // "HH:mm" or ""
  onChange?: (value: string) => void;
  name?: string; // for FormData (renders hidden input)
  defaultValue?: string; // "HH:mm"
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * 24-hour time input as an auto-formatting numeric mask: the user types digits
 * and the colon is inserted automatically (`930` → `09:30`), `inputMode="numeric"`.
 * Validated against `HH:mm` in 00:00–23:59 with inline invalid feedback; the entry
 * is normalized on blur (e.g. `9` → `09:00`). Replaces the previous react-aria
 * segmented control while keeping the SAME public contract, so every
 * `DateTimePicker` consumer (meetings, interviews, RCA timeline) works unchanged:
 *
 * - Controlled: `value` ("HH:mm" | "") + `onChange(string)` — emits a canonical
 *   `"HH:mm"` once the entry is valid, or `""` when cleared/invalid.
 * - Uncontrolled: `name` + optional `defaultValue`; a hidden input carries the
 *   canonical value for FormData.
 * - Output format: "HH:mm" — same as needed by downstream server actions.
 */
export function TimeField({
  value,
  onChange,
  name,
  defaultValue,
  disabled = false,
  required = false,
  id,
  className,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: TimeFieldProps) {
  const isControlled = onChange !== undefined || value !== undefined;

  // The canonical committed value ("HH:mm" | "") — the source of truth for
  // downstream consumers and the hidden FormData input.
  const committed = isControlled ? (value ?? "") : undefined;

  // Uncontrolled canonical value (only used when not controlled).
  const [uncontrolled, setUncontrolled] = React.useState<string>(
    () => normalizeHhmm(defaultValue ?? ""),
  );
  const canonical = isControlled ? (committed ?? "") : uncontrolled;

  // The visible text buffer, so the user can type a partial mask ("9", "09:3")
  // without the canonical value snapping the caret. It is authoritative ONLY
  // while the field is focused; when blurred, the displayed value is derived
  // from the canonical value (so an external change reflects with no effect —
  // the recommended no-`useEffect` sync). `buffer` holds nothing meaningful
  // between edits.
  const [buffer, setBuffer] = React.useState<string>(canonical);
  const [focused, setFocused] = React.useState(false);
  const [dirtyInvalid, setDirtyInvalid] = React.useState(false);

  // Blurred → mirror the canonical value; focused → the live typing buffer.
  const text = focused ? buffer : canonical;
  const setText = setBuffer;

  function commit(next: string) {
    if (isControlled) {
      onChange?.(next);
    } else {
      setUncontrolled(next);
    }
  }

  function handleChange(raw: string) {
    const masked = maskTimeInput(raw);
    setText(masked);
    // Clearing the field emits "".
    if (masked === "") {
      setDirtyInvalid(false);
      commit("");
      return;
    }
    // Emit a canonical value as soon as the entry is a complete, valid HH:mm.
    if (isValidHhmm(masked)) {
      setDirtyInvalid(false);
      commit(masked);
      return;
    }
    // Not yet a complete HH:mm. Only flag INVALID when the entry is genuinely
    // UNSALVAGEABLE — i.e. it would normalize to "" on blur (e.g. "25:60"). A
    // salvageable partial (the mask's "93:0" for "930", which normalizes to
    // "09:30") must NOT show a red error mid-type (FBE-007). Don't commit yet;
    // the buffer holds it until blur normalizes.
    setDirtyInvalid(normalizeHhmm(masked) === "");
  }

  function handleBlur() {
    setFocused(false);
    // Normalize friendly short forms ("9" → "09:00", "930" → "09:30") on blur.
    const normalized = normalizeHhmm(text);
    setText(normalized);
    setDirtyInvalid(text.trim() !== "" && normalized === "");
    commit(normalized);
  }

  const propInvalid = ariaInvalid === true || ariaInvalid === "true";
  const isInvalid = propInvalid || dirtyInvalid;

  const errorId = id ? `${id}-time-error` : undefined;
  const describedBy =
    [ariaDescribedBy, dirtyInvalid ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {name && <input type="hidden" name={name} value={canonical} />}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        id={id}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          // Seed the live buffer from the canonical value so editing continues
          // from what's shown, then hand authority to the buffer.
          setBuffer(canonical);
          setFocused(true);
        }}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        placeholder="hh:mm"
        maxLength={5}
        aria-label={ariaLabel ?? "Hora"}
        aria-invalid={isInvalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "flex h-10 w-full items-center rounded-lg border border-input bg-card px-3 text-sm tabular-nums shadow-xs outline-none transition-[color,box-shadow,border-color]",
          "placeholder:text-muted-foreground/70",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          isInvalid &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          disabled && "cursor-not-allowed opacity-50",
        )}
      />
      {dirtyInvalid && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          Informe uma hora válida (00:00–23:59).
        </p>
      )}
    </div>
  );
}
