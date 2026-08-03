import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

/**
 * The offered-outcome badge list shared by the DRAFT
 * {@link import('./process-outcomes-picker').ProcessOutcomesPicker} and the
 * frozen {@link import('./published-outcomes-card').PublishedOutcomesCard}, so a
 * process's offered set reads identically before and after publish.
 *
 * Resolves `offeredOutcomeIds` against the commission's vocabulary, preserving
 * vocabulary (`position`) order, and reuses the shared palette token per badge
 * plus the advisory "Plano de ação" / "Adverso" markers. Pure presentational,
 * Server-Component-safe; the caller supplies the pt-BR empty copy because the
 * editable and frozen cards say different things about an empty set.
 */
export function OfferedOutcomeBadges({
  outcomes,
  offeredOutcomeIds,
  emptyMessage,
}: {
  /** The commission's non-archived outcome vocabulary (already position-ordered). */
  outcomes: CaseOutcome[];
  /** Ids offered by this template. */
  offeredOutcomeIds: string[];
  /** pt-BR copy rendered when the template offers none. */
  emptyMessage: string;
}) {
  const offered = new Set(offeredOutcomeIds);
  // Keep the vocabulary order (`outcomes` is already ordered by position).
  const offeredOutcomes = outcomes.filter((o) => offered.has(o.id));

  if (offeredOutcomes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {offeredOutcomes.map((o) => (
        <li key={o.id} className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              TOKEN_STYLES[o.colorToken] ?? TOKEN_STYLES.muted,
            )}
          >
            {o.label}
          </span>
          {o.requiresActionPlan && (
            <span className="text-[0.68rem] font-medium text-warning">
              Plano de ação
            </span>
          )}
          {o.isAdverse && (
            <span className="text-[0.68rem] font-medium text-destructive">
              Adverso
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
