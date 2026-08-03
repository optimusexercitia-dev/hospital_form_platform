import type { CaseDetail, CaseViewerCapabilities } from "@/lib/queries/cases";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import type {
  CorrectionRequest,
  NarrativeRevision,
} from "@/lib/queries/corrections";
import { mergeCaseLayout } from "@/lib/queries/case-narratives";
import { CasePhaseArticle } from "@/components/cases/case-phase-article";
import { CaseNarrativeCard } from "@/components/cases/case-narrative-card";
import { canEditNarrative } from "@/components/cases/narrative-access";
import {
  findOpenRequestForNarrative,
  findOpenRequestForPhase,
  requestsForNarrative,
  requestsForPhase,
  type CorrectionCaps,
} from "@/components/cases/correction-labels";

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
 *    `aberta` + case open); conclude = assignee/coordinator.
 *
 * Server-Component-safe wrapper; the per-row phase actions and the narrative editor
 * are client islands.
 */
export function CasePhaseList({
  org,
  slug,
  detail,
  assignees,
  isOpen,
  caps,
  canAssignPhases = false,
  viewerId,
  caseAccessEnabled = true,
  canCorrectResult = false,
  resultOptions = [],
  correctionCaps = null,
  corrections = [],
  memberNames = {},
  narrativeRevisions = {},
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  detail: CaseDetail;
  assignees: AssigneeOption[];
  /** Whether the parent case is still open (gates lifecycle + narrative editing). */
  isOpen: boolean;
  /** The viewer's capability descriptor for this case. */
  caps: CaseViewerCapabilities;
  /** Whether the viewer may ACTIVATE / REASSIGN phases (coordinator OR an
   * `assign_case_phases` Administrativo, ADR 0061). Default `false`. */
  canAssignPhases?: boolean;
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
   * LEGACY mode (no status/assignee/Concluir; editability = `isOpen` +
   * coordinator), so the flag-OFF invariant holds.
   */
  caseAccessEnabled?: boolean;
  /**
   * The viewer's Case Correction Lifecycle capabilities (ADR 0085), or `null` when
   * the `case_corrections` flag is off. Threaded to each phase article + narrative card
   * so the contextual "Corrigir…" / "Continuar correção" affordances can render.
   */
  correctionCaps?: CorrectionCaps | null;
  /**
   * Every correction request for the case. Both the per-row OPEN request and each
   * row's full request list (rendered at the bottom of its own card, replacing the
   * case-wide cockpit) are derived here.
   */
  corrections?: CorrectionRequest[];
  /** userId → display name, for the per-card request lists' requester / corrector lines. */
  memberNames?: Record<string, string>;
  /** narrativeId → its revision history (newest-first). A lookup miss means `[]`. */
  narrativeRevisions?: Record<string, NarrativeRevision[]>;
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
              org={org} slug={slug}
              phase={item.phase}
              allPhases={allPhases}
              assignees={assignees}
              isOpen={isOpen}
              canManageLifecycle={caps.canManageLifecycle}
              canAssignPhases={canAssignPhases}
              canCorrectResult={canCorrectResult}
              resultOptions={resultOptions}
              correctionCaps={correctionCaps}
              openCorrection={
                correctionCaps
                  ? findOpenRequestForPhase(corrections, item.phase.id)
                  : null
              }
              corrections={
                correctionCaps ? requestsForPhase(corrections, item.phase.id) : []
              }
              memberNames={memberNames}
            />
          ) : (
            (() => {
              const narrative = item.narrative;
              // Case Correction Lifecycle (ADR 0085): the open request + revision
              // history for THIS narrative, threaded into whichever card branch renders.
              const narrativeOpenCorrection = correctionCaps
                ? findOpenRequestForNarrative(corrections, narrative.id)
                : null;
              const narrativeCorrections = correctionCaps
                ? requestsForNarrative(corrections, narrative.id)
                : [];
              const revisions = narrativeRevisions[narrative.id] ?? [];
              if (!caseAccessEnabled) {
                // Legacy: today's rule — a coordinator edits while the case is open;
                // no assignee/status/conclude chrome.
                return (
                  <CaseNarrativeCard
                    narrative={narrative}
                    canEdit={isOpen && caps.canManageLifecycle}
                    // Removing an AD-HOC narrative is orthogonal to `case_access`:
                    // adding one is gated on the narratives flag, not this one, so
                    // an ad-hoc narrative can exist here — leaving it undeletable
                    // in the flag-OFF branch would strand it.
                    canDelete={narrative.isAdHoc && caps.canManageLifecycle}
                    showLifecycle={false}
                    correctionCaps={correctionCaps}
                    openCorrection={narrativeOpenCorrection}
                    corrections={narrativeCorrections}
                    memberNames={memberNames}
                    narrativeRevisions={revisions}
                  />
                );
              }
              const editable = canEditNarrative(narrative, caps, isOpen, viewerId);
              const isAssignee =
                viewerId != null && narrative.assignedTo === viewerId;
              // Conclude: assignee or coordinator, while `aberta` + case open.
              const canConclude =
                isOpen &&
                narrative.status === "open" &&
                (caps.canManageLifecycle || isAssignee);
              // Attribution (ADR 0033 D5): a coordinator may (re)assign the narrative's
              // author from the card while it is `aberta` + the case is open. Mirrors the
              // conclude gating; the legacy (flag-OFF) branch never passes this.
              const canAssign =
                caps.canManageLifecycle &&
                isOpen &&
                narrative.status === "open";
              return (
                <CaseNarrativeCard
                  narrative={narrative}
                  canEdit={editable}
                  canConclude={canConclude}
                  // Only an AD-HOC narrative is removable, by the same lifecycle
                  // authority that adds one.
                  canDelete={narrative.isAdHoc && caps.canManageLifecycle}
                  assignees={assignees}
                  canAssign={canAssign}
                  showLifecycle
                  correctionCaps={correctionCaps}
                  openCorrection={narrativeOpenCorrection}
                  corrections={narrativeCorrections}
                  memberNames={memberNames}
                  narrativeRevisions={revisions}
                />
              );
            })()
          )}
        </div>
      ))}
    </section>
  );
}
