"use client";

import { GanttChartSquare, List } from "lucide-react";

import { cn } from "@/lib/utils";

export type TimelineView = "feed" | "gantt";

const OPTIONS: { value: TimelineView; label: string; icon: typeof List }[] = [
  { value: "feed", label: "Feed", icon: List },
  { value: "gantt", label: "Duração", icon: GanttChartSquare },
];

/**
 * Segmented Feed | Duração control (README §5). No existing segmented control in
 * the repo, so this is built to the design system: a `surface-2` (`bg-muted`)
 * track holding two options; the selected one lifts to a `surface` (`bg-card`)
 * pill with `accent` text + a resting shadow. State conveyed by fill + text +
 * `aria-pressed`, never colour alone.
 *
 * Keyboard-operable: a `radiogroup` of `role="radio"` buttons. Arrow keys move
 * the selection; Tab moves in/out (roving via the buttons' natural focus). Each
 * option has a visible focus ring.
 */
export function TimelineViewSwitch({
  value,
  onChange,
}: {
  value: TimelineView;
  onChange: (next: TimelineView) => void;
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
      aria-label="Modo de visualização"
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
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-[--dur-fast] ease-[--ease-out-soft] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              selected
                ? "bg-card text-accent-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
