import { AlertTriangle, Hand } from "lucide-react";

import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

/**
 * Badge for the EFFECTIVE result of a concluded case phase (phase-results
 * feature). Renders the resolved label in its commission-configured colour token,
 * with two subtle markers conveyed by ICON + TEXT (never colour alone, per the
 * a11y rules):
 *   - a "manual" marker when the result came from a human override
 *     (`source === 'manual'`), so a reader can tell a corrected/overridden result
 *     from a computed one;
 *   - an "adverse" marker when the result option is flagged `isAdverse`.
 *
 * Pure presentational, Server-Component-safe. Mirrors {@link PhaseStatusPill}; the
 * colour token → class mapping is the shared {@link TOKEN_STYLES} (same source as
 * statuses / outcomes / tags). Renders nothing for a `null` result (a phase with
 * no ruleset/override, or not yet concluded).
 */
export function PhaseResultBadge({
  result,
  className,
}: {
  result: ResolvedPhaseResult | null;
  className?: string;
}) {
  if (!result) return null;

  const isManual = result.source === "manual";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
          TOKEN_STYLES[result.colorToken] ?? TOKEN_STYLES.muted,
        )}
      >
        Resultado: {result.label}
        {result.isAdverse && (
          <AlertTriangle aria-hidden="true" className="size-3" />
        )}
      </span>
      {result.isAdverse && <span className="sr-only">Resultado adverso.</span>}
      {isManual && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
          <Hand aria-hidden="true" className="size-3" />
          Manual
        </span>
      )}
    </span>
  );
}
