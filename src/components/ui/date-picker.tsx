"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Parse a YYYY-MM-DD string to a Date using local date parts (no TZ shift). */
function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

/** Format a Date to YYYY-MM-DD string using local date parts. */
function formatIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Format a Date for display in pt-BR: dd/MM/yyyy. */
function formatDisplay(date: Date): string {
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export interface DatePickerProps {
  // Controlled mode
  value?: string; // YYYY-MM-DD or ""
  onChange?: (value: string) => void;
  // Uncontrolled mode (for server-action FormData)
  name?: string;
  defaultValue?: string; // YYYY-MM-DD or ""
  // Constraints
  min?: string; // YYYY-MM-DD — disables earlier dates
  max?: string; // YYYY-MM-DD — disables later dates
  // UX
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  id?: string;
  /**
   * The `id` of an external `<Label>`/`<FieldLabel>` associated to this control
   * via `htmlFor`. When set, the trigger button's accessible name is built from
   * `aria-labelledby="{labelId} {buttonId}"` — the label's text PLUS the
   * button's own displayed value (formatted date or placeholder).
   *
   * ⚠ REQUIRED to fix FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME. Without
   * it, a `<label for={id}>` association still wins the accessible-name
   * computation on its own (`relatedElement:labelfor` outranks `contents:`),
   * which announces the label text only and silently drops the selected date —
   * measured via Chromium CDP name-sources. Omit only for a site with no
   * external label (an `aria-label` is already load-bearing there, or the
   * caller has its own labelling strategy).
   */
  labelId?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-label"?: string;
}

/**
 * Calendar popover for single-date selection. Replaces `<input type="date">`.
 *
 * - Controlled mode: `value` (YYYY-MM-DD or "") + `onChange(string)`.
 * - Uncontrolled mode: `name` + optional `defaultValue`; renders a hidden input
 *   so server-action FormData receives the same YYYY-MM-DD format as a native
 *   date input.
 * - Output format: YYYY-MM-DD — identical to native `<input type="date">`.
 */
export function DatePicker({
  value,
  onChange,
  name,
  defaultValue,
  min,
  max,
  disabled = false,
  clearable = false,
  placeholder = "Selecionar data",
  id,
  labelId,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const isControlled = onChange !== undefined || value !== undefined;

  // The button needs a REAL id for the `aria-labelledby` self-reference below —
  // most call sites already pass one (for `htmlFor`), but some don't. `useId()`
  // backfills it rather than leaving the self-reference pointing at nothing.
  const generatedId = React.useId();
  const buttonId = id ?? generatedId;

  // Internal Date state — only managed in uncontrolled mode.
  // In controlled mode we derive the selected date directly from the `value` prop.
  const [uncontrolledDate, setUncontrolledDate] = React.useState<Date | undefined>(() =>
    parseIsoDate(defaultValue ?? ""),
  );
  const [open, setOpen] = React.useState(false);

  // Derive selected date: in controlled mode read prop; otherwise use internal state.
  const selectedDate = isControlled ? parseIsoDate(value ?? "") : uncontrolledDate;

  // Hidden input value for uncontrolled / FormData mode.
  const hiddenValue = selectedDate ? formatIsoDate(selectedDate) : "";

  // Build the disabled matcher for react-day-picker.
  const disabledMatcher: ((date: Date) => boolean) | undefined =
    min || max
      ? (date: Date) => {
          if (min) {
            const minDate = parseIsoDate(min);
            if (minDate && date < minDate) return true;
          }
          if (max) {
            const maxDate = parseIsoDate(max);
            if (maxDate && date > maxDate) return true;
          }
          return false;
        }
      : undefined;

  function handleSelect(day: Date | undefined) {
    if (!day) return;
    if (isControlled) {
      onChange?.(formatIsoDate(day));
    } else {
      setUncontrolledDate(day);
    }
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    if (isControlled) {
      onChange?.("");
    } else {
      setUncontrolledDate(undefined);
    }
    setOpen(false);
  }

  // Map aria-invalid → a data attribute suitable for a <button> (which does not
  // support aria-invalid per ARIA spec). Consumer error spans + fieldErrors are
  // what convey invalidity semantically; the data attribute is purely for styling.
  const isInvalid = ariaInvalid === true || ariaInvalid === "true";

  return (
    <>
      {/* Hidden input for uncontrolled / FormData usage. In controlled mode with
          a `name` prop we also emit the hidden input so FormData contains the value. */}
      {name && <input type="hidden" name={name} value={hiddenValue} />}

      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={buttonId}
            disabled={disabled}
            data-invalid={isInvalid ? "true" : undefined}
            aria-label={ariaLabel}
            aria-labelledby={labelId ? `${labelId} ${buttonId}` : undefined}
            aria-describedby={ariaDescribedBy}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none",
              "transition-[color,box-shadow,border-color]",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "flex items-center gap-2 text-left",
              isInvalid && "border-destructive",
              !selectedDate && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="flex-1 truncate">
              {selectedDate ? formatDisplay(selectedDate) : placeholder}
            </span>
            {clearable && selectedDate && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Remover data"
                onClick={handleClear}
                className="ml-auto shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <X aria-hidden="true" className="size-3.5" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onInteractOutside={() => setOpen(false)}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={ptBR}
            captionLayout="dropdown"
            disabled={disabledMatcher}
            defaultMonth={selectedDate ?? (min ? parseIsoDate(min) : undefined)}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
