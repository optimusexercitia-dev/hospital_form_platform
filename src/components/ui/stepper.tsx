"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

/**
 * Horizontal step header for a multi-step flow. Done steps show a check + an
 * accent connector; the current step carries `aria-current="step"`; upcoming
 * steps are muted. Visited steps (index ≤ `maxReached`) are clickable to jump
 * back. Connectors shrink (`flex-1 min-w-2`) so the header never bleeds past its
 * column at narrow widths. Reduced-motion collapses the color transition
 * globally (globals.css).
 */
export function Stepper({
  steps,
  current,
  maxReached,
  onStepClick,
  className,
}: {
  steps: StepperStep[];
  current: number;
  /** Highest step index the user has reached — gates backward jumps. */
  maxReached: number;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol
      aria-label="Etapas do formulário"
      className={cn("flex items-center overflow-hidden", className)}
    >
      {steps.map((step, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const visitable = onStepClick != null && i <= maxReached && i !== current;
        const isLast = i === steps.length - 1;

        return (
          <li
            key={step.label}
            className={cn("flex items-center", !isLast && "min-w-0 flex-1")}
          >
            <button
              type="button"
              onClick={visitable ? () => onStepClick(i) : undefined}
              disabled={!visitable}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "group inline-flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                visitable ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-accent text-primary",
                  !done &&
                    !isCurrent &&
                    "border-border bg-card text-muted-foreground",
                  visitable && "group-hover:border-primary/50",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden whitespace-nowrap text-sm sm:inline",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 h-px min-w-2 flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
