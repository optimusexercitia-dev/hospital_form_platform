"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { plural } from "@/lib/text";
import type { OutcomeBreakdown } from "./case-derive";
import { CaseStatusBadge, TOKEN_COLOR_VAR } from "./case-status-badge";

/**
 * The outcome breakdown, compacted to a ONE-LINE collapsible strip (R2).
 *
 * It used to be a full panel occupying a screenful above the board. The two facts a
 * chair actually reads at a glance — the mix, and the adverse share — are carried by
 * the stacked bar and the "% adversos" figure in the header row, so the per-outcome
 * rows are folded away by default and the board itself comes back above the fold.
 *
 * "% adversos" is over the OUTCOME-BEARING cases, and its denominator is shown
 * (`n/total`) rather than implied: a case with no outcome yet is neither adverse nor
 * counted, so the honest reading is "of the cases we classified, how many were adverse".
 * With no classified case at all the percentage renders "—", never a misleading 0%.
 *
 * Rendered only when at least one case carries an outcome (the parent checks).
 */
export function CasesOutcomeStrip({
  breakdown,
}: {
  breakdown: OutcomeBreakdown;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const { rows, totalWithOutcome, adverseCount, adversePercent } = breakdown;

  if (totalWithOutcome === 0) return null;

  return (
    <section
      aria-labelledby={`${bodyId}-heading`}
      style={{ ["--rise-delay" as string]: "120ms" }}
      className="animate-rise-in rounded-xl border border-border bg-card shadow-xs"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:gap-3.5"
      >
        <span
          id={`${bodyId}-heading`}
          className="shrink-0 text-[0.84rem] font-semibold text-foreground"
        >
          Desfechos
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {totalWithOutcome}{" "}
          {plural(totalWithOutcome, "caso com desfecho", "casos com desfecho")}
        </span>

        {/* The mix, as one proportional bar. Decorative — every segment it encodes is
            also listed as text in the expanded body. */}
        <span
          aria-hidden="true"
          className="flex h-2 min-w-[7.5rem] flex-1 overflow-hidden rounded-full bg-muted"
        >
          {rows.map((r) => (
            <span
              key={r.outcomeId}
              title={`${r.label} · ${r.count}`}
              style={{
                width: `${(r.count / totalWithOutcome) * 100}%`,
                backgroundColor: TOKEN_COLOR_VAR[r.colorToken],
              }}
            />
          ))}
        </span>

        <span className="shrink-0 text-xs font-semibold text-destructive tabular-nums">
          {adversePercent === null ? "—" : `${adversePercent}%`} adversos (
          {adverseCount}/{totalWithOutcome})
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          id={bodyId}
          className="grid grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-x-6 gap-y-2 border-t border-border px-4 py-3"
        >
          {rows.map((r) => {
            const pct = Math.round((r.count / totalWithOutcome) * 100);
            return (
              <li
                key={r.outcomeId}
                className="flex items-center gap-2 text-xs text-foreground"
              >
                <CaseStatusBadge label={r.label} colorToken={r.colorToken} />
                {r.isAdverse && (
                  <span className="text-[0.6rem] font-semibold tracking-wide text-destructive uppercase">
                    Adverso
                  </span>
                )}
                <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                  {r.count} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
