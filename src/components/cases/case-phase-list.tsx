import type { CaseDetail } from "@/lib/queries/cases";
import { mergeCaseLayout } from "@/lib/queries/case-narratives";
import { CasePhaseArticle } from "@/components/cases/case-phase-article";
import { CaseNarrativeCard } from "@/components/cases/case-narrative-card";

/** An assignee option for the activate / reassign pickers. */
export interface AssigneeOption {
  userId: string;
  name: string;
}

/**
 * The case's MERGED left-column layout (per-case detail): phases interleaved with
 * narratives in one ordered list via
 * {@link import('@/lib/queries/case-narratives').mergeCaseLayout} (Case Narratives
 * increment, ADR 0032). A `kind:'phase'` item renders the existing
 * {@link CasePhaseArticle} (unchanged markup + coordinator actions); a
 * `kind:'narrative'` item renders {@link CaseNarrativeCard}.
 *
 * Before the increment this was a flat `position`-sorted phase list; the merge
 * preserves that for narrative-free cases (the narratives array is empty when the
 * feature is off or the case defines none, so the layout collapses to phases in
 * `displayPosition`≈`position` order). The `--rise-delay` entrance stagger runs
 * across the WHOLE merged list. Server-Component-safe wrapper; the per-row phase
 * actions and the narrative editor are client islands.
 */
export function CasePhaseList({
  slug,
  detail,
  assignees,
  isOpen,
  canEditNarratives,
}: {
  slug: string;
  detail: CaseDetail;
  assignees: AssigneeOption[];
  /** Whether the parent case is still `aberto` (gates the coordinator actions). */
  isOpen: boolean;
  /**
   * Whether the viewer may edit narratives (`isOpen && coordinator`). When false,
   * narrative cards render read-only; the parent ALSO filters empty narratives out
   * of `detail.narratives` for non-editors, so this gates only the edit affordance.
   */
  canEditNarratives: boolean;
}) {
  const allPhases = detail.phases;
  const items = mergeCaseLayout(detail);

  return (
    <section aria-label="Fases e narrativas do caso" className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div
          key={`${item.kind}-${item.kind === "phase" ? item.phase.id : item.narrative.id}`}
          style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
          className="animate-rise-in"
        >
          {item.kind === "phase" ? (
            <CasePhaseArticle
              slug={slug}
              phase={item.phase}
              allPhases={allPhases}
              assignees={assignees}
              isOpen={isOpen}
            />
          ) : (
            <CaseNarrativeCard
              narrative={item.narrative}
              canEdit={canEditNarratives}
            />
          )}
        </div>
      ))}
    </section>
  );
}
