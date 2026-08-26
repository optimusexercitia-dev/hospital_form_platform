"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-field";

/** Split "YYYY-MM-DDTHH:mm" → { date: "YYYY-MM-DD", time: "HH:mm" }. */
function splitDatetime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const tIndex = value.indexOf("T");
  if (tIndex === -1) return { date: value, time: "" };
  return {
    date: value.slice(0, tIndex),
    time: value.slice(tIndex + 1, tIndex + 6), // "HH:mm" (5 chars after T)
  };
}

/** Merge date + time parts into a datetime string; "" if no date. */
function buildDatetime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export interface DateTimePickerProps {
  value?: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange?: (value: string) => void;
  name?: string; // renders hidden input for FormData
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  placeholder?: string; // passed to DatePicker trigger
  id?: string; // wired to the DatePicker trigger (for label htmlFor)
  /** Forwarded to the internal DatePicker — see DatePickerProps.labelId. */
  labelId?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * Date + time combined picker. Replaces `<input type="datetime-local">`.
 *
 * Renders a DatePicker (flex-[3]) and a TimeField (flex-[2]) side by side.
 * Either part changing merges date + time into "YYYY-MM-DDTHH:mm" and calls
 * onChange. Missing time defaults to "00:00" so a date-only selection still
 * produces a valid datetime string.
 *
 * Output format: "YYYY-MM-DDTHH:mm" — same as native datetime-local.
 */
export function DateTimePicker({
  value,
  onChange,
  name,
  defaultValue,
  disabled = false,
  required = false,
  clearable = false,
  placeholder = "Selecionar data e hora",
  id,
  labelId,
  className,
  "aria-invalid": ariaInvalid,
}: DateTimePickerProps) {
  const isControlled = onChange !== undefined || value !== undefined;

  // Internal sub-states for date + time parts (uncontrolled mode only).
  // In controlled mode we derive these from the `value` prop during render.
  const initial = splitDatetime(isControlled ? (value ?? "") : (defaultValue ?? ""));
  const [uncontrolledDate, setUncontrolledDate] = React.useState(initial.date);
  const [uncontrolledTime, setUncontrolledTime] = React.useState(initial.time);

  // Derive current date+time parts.
  const currentParts = isControlled
    ? splitDatetime(value ?? "")
    : { date: uncontrolledDate, time: uncontrolledTime };
  const { date: currentDate, time: currentTime } = currentParts;

  const hiddenValue = buildDatetime(currentDate, currentTime);

  function handleDateChange(newDate: string) {
    if (isControlled) {
      onChange?.(buildDatetime(newDate, currentTime));
    } else {
      setUncontrolledDate(newDate);
    }
  }

  function handleTimeChange(newTime: string) {
    if (isControlled) {
      // Only emit a combined value if we have a date; otherwise the time is
      // stored in uncontrolled state so it's available when the date is picked.
      if (currentDate) {
        onChange?.(buildDatetime(currentDate, newTime));
      }
    } else {
      setUncontrolledTime(newTime);
    }
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={hiddenValue} />}
      <div className={cn("flex gap-2", className)}>
        {/* Date part: ~60% */}
        <div className="min-w-0 flex-[3]">
          <DatePicker
            id={id}
            labelId={labelId}
            value={currentDate}
            onChange={handleDateChange}
            disabled={disabled}
            clearable={clearable}
            placeholder={placeholder}
            aria-invalid={ariaInvalid}
          />
        </div>
        {/* Time part: ~40% */}
        <div className="min-w-0 flex-[2]">
          <TimeField
            value={currentTime}
            onChange={handleTimeChange}
            disabled={disabled}
            required={required}
            aria-label="Hora"
            aria-invalid={ariaInvalid}
          />
        </div>
      </div>
    </>
  );
}
