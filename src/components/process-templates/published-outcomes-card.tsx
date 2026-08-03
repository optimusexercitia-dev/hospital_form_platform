import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { OfferedOutcomeBadges } from "@/components/process-templates/offered-outcome-badges";

/**
 * Read-only counterpart of {@link ProcessOutcomesPicker} for a PUBLISHED /
 * ARCHIVED process: a published process is frozen, so its offered-outcome set is
 * shown without the "Selecionar desfechos" affordance (the editable picker only
 * mounts for drafts). Both cards render the same {@link OfferedOutcomeBadges}, so
 * the set reads identically before and after publish. Pure presentational,
 * Server-Component-safe.
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

      <OfferedOutcomeBadges
        outcomes={outcomes}
        offeredOutcomeIds={offeredOutcomeIds}
        emptyMessage="Este processo não oferece desfechos. Seus casos serão concluídos sem desfecho."
      />
    </section>
  );
}
