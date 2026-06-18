import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The shared shell for a triage step (README_triage §5): a card with a numbered
 * head (accent when active, success+check when done, outline when todo) + a serif
 * title and sub. Later steps render DIMMED + non-interactive (`disabled`) until
 * their gate opens — the gating is enforced by the parent (it also strips the
 * inner controls from the tab order via `inert`/`aria-disabled`).
 */
export function StepCard({
  step,
  title,
  sub,
  state,
  disabled,
  headingId,
  children,
}: {
  step: number;
  title: string;
  sub: string;
  state: "todo" | "active" | "done";
  disabled: boolean;
  headingId: string;
  children: React.ReactNode;
}) {
  return (
    // `inert` (not `aria-disabled`, which the `region` role rejects) removes a
    // gated step from the tab order AND the a11y tree until its gate opens — the
    // exact step-gating behaviour, lint-clean.
    <section
      aria-labelledby={headingId}
      inert={disabled || undefined}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-opacity",
        disabled && "opacity-45 select-none",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
            state === "active" && "bg-primary text-primary-foreground",
            state === "done" && "bg-success/15 text-success",
            state === "todo" && "border border-border bg-muted text-muted-foreground",
          )}
        >
          {state === "done" ? <Check className="size-4" /> : step}
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 id={headingId} className="text-base leading-tight">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground text-pretty">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
