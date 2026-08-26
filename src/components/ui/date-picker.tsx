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
   *
   * ⛔ THE PRICE OF THAT SELF-REFERENCE: the trigger's name is now built from its own
   * CONTENTS, so ANY descendant carrying a name of its own is appended to it. That is
   * how the clear affordance — then a nested `<span aria-label="Remover data">` — came
   * to make the trigger announce a different action's name at 10 call sites. Never put
   * a named or interactive element inside this button; put it beside it. Pinned by
   * `date-picker-clear-affordance.test.tsx`, whose differential is the one thing that
   * reds if someone nests one again.
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
  const clearId = `${buttonId}-clear`;

  // Focus has to be MOVED when the clear button unmounts (see `handleClear`), so the
  // trigger needs a handle. Radix's `asChild` Slot composes this with its own ref.
  const triggerRef = React.useRef<HTMLButtonElement>(null);

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
    // ⚠ STILL NEEDED, for a DIFFERENT reason than before. It used to stop the click
    // reaching the trigger that CONTAINED this control; the control is now a sibling, so
    // that reason is gone. What remains: several call sites wrap the picker in a
    // `<label>` with no `htmlFor`, whose activation behaviour forwards a click to its
    // first labelable descendant — the trigger — which would re-open the calendar the
    // moment the user cleared it. (A real `<button>` is interactive content, which most
    // browsers already exempt; the old `<span role="button">` was not, so this guard was
    // load-bearing there too.)
    e.stopPropagation();
    if (isControlled) {
      onChange?.("");
    } else {
      setUncontrolledDate(undefined);
    }
    setOpen(false);
    // ⛔ MOVE FOCUS, do not let it fall to <body>. This control unmounts the instant the
    // value clears, and a removed focused element drops focus to the document — which
    // silently costs a keyboard user their place in the form. It is only reachable at all
    // as of the sibling-button change (it was `tabIndex={-1}` before), so this is the
    // other half of making it a real control rather than an optional nicety.
    triggerRef.current?.focus();
  }

  // Map aria-invalid → a data attribute suitable for a <button> (which does not
  // support aria-invalid per ARIA spec). Consumer error spans + fieldErrors are
  // what convey invalidity semantically; the data attribute is purely for styling.
  const isInvalid = ariaInvalid === true || ariaInvalid === "true";

  /** The clear affordance renders only for a clearable field that HAS a value. */
  const showClear = clearable && selectedDate !== undefined;

  return (
    <>
      {/* Hidden input for uncontrolled / FormData usage. In controlled mode with
          a `name` prop we also emit the hidden input so FormData contains the value. */}
      {name && <input type="hidden" name={name} value={hiddenValue} />}

      {/*
        ⛔ THIS WRAPPER IS LOAD-BEARING AND MUST NOT GAIN A WIDTH CLASS.

        It exists to be the positioning context for the clear button, which is a SIBLING
        of the trigger rather than a child of it (see the button below). `relative` and
        nothing else: ten call sites pass `className="w-auto"`, which tailwind-merge lets
        beat the trigger's built-in `w-full` so the field can size to its content inside a
        content-driven filter bar. A block `div` with `width: auto` passes that intrinsic
        sizing straight through; a `w-full` here would resolve those ten to a percentage
        of the container and silently neutralise every one of them.
      */}
      <div className="relative">
        <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              ref={triggerRef}
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
              {showClear && (
                /*
                  A SPACER, NOT A CONTROL — it has no role, no name, no handler, and
                  holds nothing. It reserves exactly the width the clear affordance used
                  to occupy IN FLOW, so the trigger's box and the value's truncation
                  point stay pixel-identical to before this change across all 29 call
                  sites. The alternative (`pr-9` on the trigger) collides with the base
                  `px-3` across Tailwind v4's logical/physical padding split, where which
                  declaration wins is a stylesheet-ordering question rather than a
                  readable one.

                  ⛔ Its `aria-hidden` is NOT the banned "hide the clear button from
                  assistive tech" fix. The clear button is a real, named, focusable
                  sibling below; this element is empty scaffolding and is invisible to
                  the accessible-name computation precisely because it must contribute
                  nothing.
                */
                <span aria-hidden="true" className="size-3.5 shrink-0" />
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

        {showClear && (
          /*
            ⛔ A REAL `<button>`, AND A SIBLING OF THE TRIGGER — both halves are the fix.

            It used to be a `<span role="button" tabIndex={-1}>` NESTED INSIDE the trigger
            `<button>`, which was two defects at once:

            1. Interactive content inside a button is invalid HTML regardless — and being
               `tabIndex={-1}` it was not independently reachable either, so the markup
               claimed a control that no keyboard user could operate.
            2. Its `aria-label` was pulled INTO THE TRIGGER'S OWN ACCESSIBLE NAME, because
               the trigger's `aria-labelledby="{labelId} {buttonId}"` self-reference
               re-admits the button's contents. Measured differential, one variable
               changed against otherwise identical DOM:
                   clearable={false} → "Suspenso até (opcional) 01/03/2023"
                   clearable={true}  → "Suspenso até (opcional) 01/03/2023 Remover data"
               The trigger announced a DIFFERENT action's name. 10 call sites.

            Moving it out repairs both at once: there is no nested interactive content to
            be invalid, and nothing inside the trigger carries a name to contaminate it.

            ⛔ `aria-hidden` on this control is NOT an acceptable alternative repair. It
            would silence the contamination by deleting a control from assistive tech
            entirely — worse than the bug it fixes.

            ⚠ THE VALUE-DEPENDENCE IS THE TRAP. This element does not exist while the
            field is empty, so any measurement taken from a freshly-opened dialog is
            systematically blind to the whole defect — which is exactly how the
            follow-up's own worked example came to record the empty-state name.
          */
          <button
            type="button"
            id={clearId}
            disabled={disabled}
            onClick={handleClear}
            /*
              Named from its own text PLUS the field's label, so two clearable date
              fields in one dialog do not both announce as a bare "Remover data" — the
              same disambiguation `ActionsReview` keeps for its sibling triggers.

              ⚠ This self-reference is safe where the trigger's was not, and the
              difference is the whole lesson: contents are one `sr-only` string here,
              with no descendant carrying a name of its own.
            */
            aria-labelledby={labelId ? `${clearId} ${labelId}` : undefined}
            aria-label={labelId ? undefined : "Remover data"}
            className={cn(
              "absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {/* The name's own text. `sr-only` rather than `aria-label` so the value is
                a real text node the label composition above can reference. */}
            <span className="sr-only">Remover data</span>
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
    </>
  );
}
