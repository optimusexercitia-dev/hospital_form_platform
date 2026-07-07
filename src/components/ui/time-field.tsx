"use client";

import * as React from "react";
import {
  TimeField as AriaTimeField,
  DateInput,
  DateSegment,
} from "react-aria-components";
import { Time } from "@internationalized/date";

import { cn } from "@/lib/utils";

/** Parse "HH:mm" → {@link Time}. Returns null for blank/invalid input. */
function parseHhmm(value: string | undefined): Time | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return new Time(hours, minutes);
}

/** Format a {@link Time} → "HH:mm" string. */
function formatHhmm(time: Time): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

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
 * Segmented time input using react-aria-components TimeField.
 * 24-hour format (hourCycle=24), locale pt-BR.
 * Styled to match the project's h-10 FIELD_CLASS pattern.
 *
 * - Controlled: `value` ("HH:mm" | "") + `onChange(string)`.
 * - Uncontrolled: `name` + optional `defaultValue`; renders hidden input for FormData.
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

  // Internal Time state for uncontrolled mode only.
  // In controlled mode the selected time is derived directly from the `value` prop.
  const [uncontrolledTime, setUncontrolledTime] = React.useState<Time | null>(() =>
    parseHhmm(defaultValue),
  );

  // Derive selected time: controlled → parse from prop; uncontrolled → internal state.
  const selectedTime = isControlled ? parseHhmm(value) : uncontrolledTime;

  const hiddenValue = selectedTime ? formatHhmm(selectedTime) : "";

  function handleChange(time: Time | null) {
    if (isControlled) {
      onChange?.(time ? formatHhmm(time) : "");
    } else {
      setUncontrolledTime(time);
    }
  }

  const isInvalid = ariaInvalid === true || ariaInvalid === "true";

  return (
    <>
      {name && <input type="hidden" name={name} value={hiddenValue} />}
      <AriaTimeField
        // react-aria TimeField is generic over TimeValue; null/undefined means unset.
        value={selectedTime ?? undefined}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-aria onChange passes TimeValue which includes Time
        onChange={(v: any) => handleChange(v as Time | null)}
        hourCycle={24}
        isDisabled={disabled}
        isRequired={required}
        id={id}
        aria-label={ariaLabel ?? "Hora"}
        aria-describedby={ariaDescribedBy}
        className={cn("flex flex-col gap-1", className)}
      >
        <DateInput
          data-invalid={isInvalid ? "true" : undefined}
          className={cn(
            // Match FIELD_CLASS h-10 pattern
            "flex h-10 w-full items-center rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color]",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
            isInvalid && "border-destructive",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                "inline rounded px-0.5 tabular-nums outline-none",
                "data-[type=literal]:text-muted-foreground/60 data-[type=literal]:select-none",
                "data-[placeholder]:text-muted-foreground",
                "data-[focused]:bg-accent data-[focused]:text-accent-foreground",
                "focus:bg-accent focus:text-accent-foreground",
              )}
            />
          )}
        </DateInput>
      </AriaTimeField>
    </>
  );
}
