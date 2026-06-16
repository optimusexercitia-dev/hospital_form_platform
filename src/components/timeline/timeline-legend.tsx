"use client";

import type { TimelineEventType } from "@/lib/timeline/event-model";
import { cn } from "@/lib/utils";

import { TYPE_META, TYPE_ORDER } from "./type-meta";

/**
 * The 8-type legend that DOUBLES as a show/hide filter (plan decision 8 / README
 * §3 legend). Each chip is a toggle button: active types are filled with their
 * soft tint + coloured icon; hidden types dim to a muted, struck-through look so
 * the hidden state reads by shape + text, not colour alone. `aria-pressed`
 * exposes the toggle state; the group is keyboard-operable (each chip is a
 * button with a visible focus ring).
 *
 * `visible` is the set of CURRENTLY shown types; toggling a type calls
 * `onToggle`. At least one type always stays on (the shell guards the
 * last-one-off case), so the legend never blanks the timeline.
 */
export function TimelineLegend({
  visible,
  onToggle,
}: {
  visible: Set<TimelineEventType>;
  onToggle: (type: TimelineEventType) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrar tipos de evento"
      className="flex flex-wrap items-center gap-1.5"
    >
      {TYPE_ORDER.map((type) => {
        const meta = TYPE_META[type];
        const Icon = meta.icon;
        const on = visible.has(type);
        return (
          <button
            key={type}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(type)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-[--dur-fast] ease-[--ease-out-soft] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              on
                ? "border-border text-foreground"
                : "border-transparent text-muted-foreground/70 line-through decoration-1 hover:text-muted-foreground",
            )}
            style={on ? { backgroundColor: meta.softVar } : undefined}
          >
            <Icon
              aria-hidden="true"
              className="size-3.5"
              style={{ color: on ? meta.colorVar : undefined }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
