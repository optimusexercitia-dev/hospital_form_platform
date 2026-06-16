"use client";

import { Rows3, Rows4 } from "lucide-react";

import { cn } from "@/lib/utils";

export type TimelineDensity = "comfortable" | "compact";

const OPTIONS: { value: TimelineDensity; label: string; icon: typeof Rows3 }[] = [
  { value: "comfortable", label: "Confortável", icon: Rows3 },
  { value: "compact", label: "Compacto", icon: Rows4 },
];

/**
 * Density toggle (comfortable ↔ compact) — same segmented visual language as the
 * view switch, tuned to a `radiogroup`. Drives the row gap / row height in both
 * layouts (README §3.1 ROW_H compact, §4.1 row gap compact). Keyboard-operable;
 * state by fill + text + `aria-checked`.
 */
export function TimelineDensitySwitch({
  value,
  onChange,
}: {
  value: TimelineDensity;
  onChange: (next: TimelineDensity) => void;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const idx = OPTIONS.findIndex((o) => o.value === value);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = OPTIONS[(idx + delta + OPTIONS.length) % OPTIONS.length];
    onChange(next.value);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Densidade"
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-1 rounded-xl bg-muted p-1"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            title={option.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-[--dur-fast] ease-[--ease-out-soft] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              selected
                ? "bg-card text-accent-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
