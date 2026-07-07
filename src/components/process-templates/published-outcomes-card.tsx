import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

/**
 * Read-only counterpart of {@link ProcessOutcomesPicker} for a PUBLISHED /
 * ARCHIVED process: a published process is frozen, so its offered-outcome set is
 * shown as static badges instead of an editable multiselect (the picker only
 * mounts for drafts). Resolves `offeredOutcomeIds` against the commission's
 * outcome vocabulary, preserving vocabulary (`position`) order, and reuses the
 * shared palette token for each badge. Pure presentational, Server-Component-safe.
 */
export function PublishedOutcomesCard({
  outcomes,
  offeredOutcomeIds,
}: {
  /** The commission's non-archived outcome vocabulary. */
  outcomes: CaseOutcome[];
  /** Ids offered by this (now frozen) template. */
  offeredOutcomeIds: string[];
}) {
  const offered = new Set(offeredOutcomeIds);
  // Keep the vocabulary order (`outcomes` is already ordered by position).
  const offeredOutcomes = outcomes.filter((o) => offered.has(o.id));

  return (
    <section
      aria-labelledby="published-outcomes-heading"
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id="published-outcomes-heading" className="text-lg font-semibold">
          Desfechos disponíveis
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Os casos criados a partir deste processo poderão receber um destes
          desfechos.
        </p>
      </div>

      {offeredOutcomes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          Este processo não oferece desfechos. Seus casos serão concluídos sem
          desfecho.
        </p>
      ) : (
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
      )}
    </section>
  );
}
