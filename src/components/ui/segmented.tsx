"use client";

import { cn } from "@/lib/utils";

/**
 * One option of a {@link Segmented} control. `hint` renders as a quiet mono
 * suffix (e.g. the computed version number under a "Maior"/"Menor" increment).
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Inline segmented control — a compact single-choice picker (document type,
 * version increment). Proper `radiogroup`/`radio` semantics with roving
 * tabindex + arrow-key navigation, a visible focus ring, and an optional hidden
 * mirror input so it posts inside a native `<form>`. Token-driven; no hardcoded
 * color. Reduced-motion collapses the transition globally (globals.css).
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
  ariaLabel,
  disabled = false,
  className,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** When set, a hidden input mirrors the value so a native form submit posts it. */
  name?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const activeIndex = options.findIndex((o) => o.value === value);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    let dir = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") dir = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") dir = -1;
    if (dir === 0) return;
    e.preventDefault();
    const next = (activeIndex + dir + options.length) % options.length;
    onChange(options[next].value);
    const group = e.currentTarget.parentElement;
    group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/40",
              "disabled:pointer-events-none disabled:opacity-50",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {option.hint ? (
              <span className="font-mono text-xs text-muted-foreground">
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
