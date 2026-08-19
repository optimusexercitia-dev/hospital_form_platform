import { PenLine } from "lucide-react";

import type { CaseDetail, CaseViewerCapabilities } from "@/lib/queries/cases";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import type {
  CorrectionRequest,
  NarrativeRevision,
} from "@/lib/queries/corrections";
import { mergeCaseLayout } from "@/lib/queries/case-narratives";
import type { CaseLayoutItem } from "@/lib/queries/case-narratives";
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
import { cn } from "@/lib/utils";

/**
 * Static — this section is mounted once per case-detail page (both the
 * coordinator `(detail)` route and the staff `/casos/[caseId]` route render a
 * single {@link CasePhaseList}), so a stable id is safe and keeps the component
 * a plain Server Component (no `useId`).
 */
const WORK_HEADING_ID = "case-work-heading";

/**
 * Is this layout item still EXPECTED work? A phase ruled out (`not_required`) or
 * a phase/narrative voided by an approved correction request (ADR 0085) is no
 * longer owed by anyone, so it leaves BOTH sides of the progress ratio —
 * otherwise a case with one skipped phase could never read as fully worked.
 */
function isTrackedWork(item: CaseLayoutItem): boolean {
  return item.kind === "phase"
    ? item.phase.status !== "not_required" && item.phase.status !== "voided"
    : item.narrative.status !== "voided";
}

/** Has this layout item been concluded by its owner? */
function isConcludedWork(item: CaseLayoutItem): boolean {
  return item.kind === "phase"
    ? item.phase.status === "completed"
    : item.narrative.status === "completed";
}

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
  footerActions = null,
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
  /**
   * Authoring actions rendered at the BOTTOM of the work card, below the timeline
   * — today the "Adicionar fase" / "Adicionar narrativa" pair
   * ({@link import('./add-case-work-actions').AddCaseWorkActions}).
   *
   * A SLOT rather than a capability flag, deliberately: those dialogs need the
   * commission's published forms + narrative vocabulary, which only the
   * coordinator route loads. A host that passes nothing renders no footer at all
   * and never has to load that data — the staff route's case. A flag would have
   * left the data reaching a page that only hides the button.
   */
  footerActions?: React.ReactNode;
}) {
  const allPhases = detail.phases;
  const items = mergeCaseLayout(detail);

  // Header progress meter. Counts the merged layout, so a case's narratives weigh
  // the same as its phases — both are work a committee member owes.
  const trackedCount = items.filter(isTrackedWork).length;
  const concludedCount = items.filter(
    (item) => isTrackedWork(item) && isConcludedWork(item),
  ).length;
  const progressPct =
    trackedCount === 0 ? 0 : Math.round((concludedCount / trackedCount) * 100);
  const progressLabel = `${concludedCount} de ${trackedCount} ${
    trackedCount === 1 ? "concluída" : "concluídas"
  }`;

  return (
    /* The case's WORK ZONE — deliberately a tier above the other main-column
       cards (participants, action items, records). Phases and narratives are the
       only surfaces committee members actively fill, so they get a titled frame
       with its own progress meter and a timeline spine, and the individual
       phase/narrative cards nest INSIDE it. Everything else on the page stays a
       flat sibling card. */
    <section
      aria-labelledby={WORK_HEADING_ID}
      className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-4">
        <div className="min-w-0 flex-1">
          <h2 id={WORK_HEADING_ID} className="text-base font-semibold">
            Trabalho do caso
          </h2>
          <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
            Fases e narrativas preenchidas pelos membros da comissão
          </p>
        </div>
        {trackedCount > 0 && (
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {progressLabel}
            </span>
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={concludedCount}
              aria-valuemin={0}
              aria-valuemax={trackedCount}
              aria-valuetext={progressLabel}
              aria-label="Progresso das fases e narrativas"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]",
                  concludedCount === trackedCount ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* The accessible name stays `Fases e narrativas do caso` — the E2E suite
          scopes to this region by that name. The frame above carries the visible
          title, so the two never collide. */}
      <section
        aria-label="Fases e narrativas do caso"
        className="mt-4 flex flex-col"
      >
        {/* A process-less case (ADR 0090) starts with neither. Before this card
            existed the list simply rendered nothing, which was invisible rather
            than empty; a titled frame with a blank body is not — so say so. */}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-pretty text-muted-foreground">
            Nenhuma fase ou narrativa neste caso ainda.
          </p>
        )}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <div
              key={`${item.kind}-${item.kind === "phase" ? item.phase.id : item.narrative.id}`}
              style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
              className="animate-rise-in grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-x-4"
            >
              {/* Spine. Decorative: the ordinal is already in the card's own
                  "Fase N" eyebrow and the kind in its heading, so a screen
                  reader gains nothing from re-reading it here. */}
              <div aria-hidden="true" className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium sm:size-8",
                    item.kind === "phase"
                      ? "border-primary/20 bg-accent font-mono text-accent-foreground"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {item.kind === "phase" ? (
                    item.phase.position
                  ) : (
                    <PenLine className="size-3.5" />
                  )}
                </span>
                {!isLast && <span className="my-1.5 w-px flex-1 bg-border" />}
              </div>

              <div className={cn("min-w-0", !isLast && "pb-4")}>
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
            </div>
          );
        })}
      </section>

      {/* Authoring footer — "+ Adicionar fase / narrativa". Sits below the
          timeline and aligns with the cards (not the spine gutter), so it reads
          as appending to the list rather than as a case-level action. Absent
          entirely on a host that passes no slot. */}
      {footerActions && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 sm:pl-[3rem]">
          {footerActions}
        </div>
      )}
    </section>
  );
}
