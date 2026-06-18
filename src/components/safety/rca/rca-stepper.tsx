"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  RCA_STAGE_META,
  RCA_STAGE_ORDER,
  type RcaStageId,
} from "./rca-derive";

/**
 * The 4-stage RCA stepper (README_rca §3). Each segment = a circular badge (number,
 * or a check when `done[stage]`) + label + sub-label. The active segment is an
 * accent card; clicking a segment jumps to it (free navigation — not gated). Stage 4
 * (corrective actions) is a Phase-14d placeholder, marked accordingly.
 */
export function RcaStepper({
  active,
  done,
  onSelect,
}: {
  active: RcaStageId;
  done: Record<RcaStageId, boolean>;
  onSelect: (stage: RcaStageId) => void;
}) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
      {RCA_STAGE_ORDER.map((stage, i) => {
        const meta = RCA_STAGE_META[stage];
        const isActive = stage === active;
        const isDone = done[stage];
        const isPlaceholder = stage === "actions";
        return (
          <li key={stage} className="flex flex-1 items-center">
            <button
              type="button"
              aria-current={isActive ? "step" : undefined}
              onClick={() => onSelect(stage)}
              className={cn(
                "flex flex-1 items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                isActive
                  ? "border-primary/40 bg-card shadow-sm"
                  : "border-transparent hover:bg-muted/50",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums",
                  isActive && "bg-primary text-primary-foreground",
                  !isActive && isDone && "bg-success/15 text-success",
                  !isActive &&
                    !isDone &&
                    "border border-border bg-muted text-muted-foreground",
                )}
              >
                {isDone && !isActive ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{meta.label}</span>
                <span
                  className={cn(
                    "truncate text-xs",
                    isPlaceholder
                      ? "text-muted-foreground/70 italic"
                      : "text-muted-foreground",
                  )}
                >
                  {meta.sub}
                </span>
              </span>
            </button>
            {i < RCA_STAGE_ORDER.length - 1 && (
              <span
                aria-hidden="true"
                className="mx-1 hidden h-px w-4 shrink-0 bg-border sm:block"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
