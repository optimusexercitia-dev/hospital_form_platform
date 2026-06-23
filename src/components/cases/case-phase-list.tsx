import type { CaseDetail, CaseViewerCapabilities } from "@/lib/queries/cases";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import { mergeCaseLayout } from "@/lib/queries/case-narratives";
import { CasePhaseArticle } from "@/components/cases/case-phase-article";
import { CaseNarrativeCard } from "@/components/cases/case-narrative-card";
import { canEditNarrative } from "@/components/cases/narrative-access";

/** An assignee option for the activate / reassign pickers. */
export interface AssigneeOption {
  userId: string;
  name: string;
}

/**
 * The case's MERGED left-column layout (per-case detail): phases interleaved with
 * narratives in one ordered list via
 * {@link import('@/lib/queries/case-narratives').mergeCaseLayout} (ADR 0032). A
 * `kind:'phase'` item renders {@link CasePhaseArticle}; a `kind:'narrative'` item
 * renders {@link CaseNarrativeCard}.
 *
 * Case Access Control (ADR 0033): the row affordances are CAPABILITY-gated.
 *  - Phase lifecycle (activate/skip/reassign) shows only when `caps.canManageLifecycle`.
 *  - Narrative editing follows Q14 ({@link canEditNarrative}: coordinator, the
 *    narrative's assignee, or a write-grantee on an un-attributed narrative, while
 *    `aberta` + case open); conclude = assignee/coordinator; reopen = coordinator.
 *
 * Server-Component-safe wrapper; the per-row phase actions and the narrative editor
 * are client islands.
 */
export function CasePhaseList({
  slug,
  detail,
  assignees,
  isOpen,
  caps,
  viewerId,
  caseAccessEnabled = true,
  canCorrectResult = false,
  resultOptions = [],
}: {
  slug: string;
  detail: CaseDetail;
  assignees: AssigneeOption[];
  /** Whether the parent case is still open (gates lifecycle + narrative editing). */
  isOpen: boolean;
  /** The viewer's capability descriptor for this case. */
  caps: CaseViewerCapabilities;
  /** The viewer's user id — for the per-narrative assignee check (Q14); `null` if unknown. */
  viewerId: string | null;
  /**
   * Whether the viewer may CORRECT a concluded phase's result post-conclusion
   * (phase-results feature; task #10): `phaseResultsEnabled` + staff_admin + the
   * case is non-terminal, resolved at the page level. Default `false`.
   */
  canCorrectResult?: boolean;
  /** The commission's active result options (the correction dialog's picker). */
  resultOptions?: ResolvedPhaseResult[];
  /**
   * Whether the `case_access` flag is on (ADR 0033). `false` renders narratives in
   * LEGACY mode (no status/assignee/Concluir/Reabrir; editability = `isOpen` +
   * coordinator), so the flag-OFF invariant holds.
   */
  caseAccessEnabled?: boolean;
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
              canManageLifecycle={caps.canManageLifecycle}
              canCorrectResult={canCorrectResult}
              resultOptions={resultOptions}
            />
          ) : (
            (() => {
              const narrative = item.narrative;
              if (!caseAccessEnabled) {
                // Legacy: today's rule — a coordinator edits while the case is open;
                // no assignee/status/conclude chrome.
                return (
                  <CaseNarrativeCard
                    narrative={narrative}
                    canEdit={isOpen && caps.canManageLifecycle}
                    showLifecycle={false}
                  />
                );
              }
              const editable = canEditNarrative(narrative, caps, isOpen, viewerId);
              const isAssignee =
                viewerId != null && narrative.assignedTo === viewerId;
              // Conclude: assignee or coordinator, while `aberta` + case open.
              const canConclude =
                isOpen &&
                narrative.status === "aberta" &&
                (caps.canManageLifecycle || isAssignee);
              // Reopen: coordinator, while `concluida` + case open.
              const canReopen =
                isOpen &&
                narrative.status === "concluida" &&
                caps.canManageLifecycle;
              // Attribution (ADR 0033 D5): a coordinator may (re)assign the narrative's
              // author from the card while it is `aberta` + the case is open. Mirrors the
              // conclude/reopen gating; the legacy (flag-OFF) branch never passes this.
              const canAssign =
                caps.canManageLifecycle &&
                isOpen &&
                narrative.status === "aberta";
              return (
                <CaseNarrativeCard
                  narrative={narrative}
                  canEdit={editable}
                  canConclude={canConclude}
                  canReopen={canReopen}
                  assignees={assignees}
                  canAssign={canAssign}
                  showLifecycle
                />
              );
            })()
          )}
        </div>
      ))}
    </section>
  );
}
