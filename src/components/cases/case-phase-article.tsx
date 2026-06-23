import { CalendarClock, FileText, User } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import {
  PhaseStatusPill,
  RecommendedChip,
} from "@/components/cases/phase-status-pill";
import { CoordinatorPhaseActions } from "@/components/cases/coordinator-phase-actions";
import { PhaseResultBadge } from "@/components/cases/phase-result-badge";
import { PhaseResultCorrectButton } from "@/components/cases/phase-result-correct-button";
import { formatDueDate, isOverdue } from "@/components/cases/format";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import { cn } from "@/lib/utils";

/** A phase as it appears in the merged case layout (`get_case_detail` shape). */
type DetailPhase = CaseDetail["phases"][number];

/**
 * ONE phase row of a case's detail — the existing phase `<article>` markup,
 * extracted verbatim from {@link CasePhaseList} so it can be reused unchanged by
 * the merged-layout renderer ({@link CaseLayoutList}) alongside narrative cards.
 * Mirrors the {@link MyResponseCard} idiom: form/title, a status pill
 * (icon+text+shape), the `recommended` highlight, the assignee, and the
 * contextual coordinator actions. Server-Component-safe; the per-row actions are
 * client islands.
 */
export function CasePhaseArticle({
  slug,
  phase,
  allPhases,
  assignees,
  isOpen,
  canManageLifecycle = true,
  canCorrectResult = false,
  resultOptions = [],
}: {
  slug: string;
  phase: DetailPhase;
  /** Every phase of the case (the reassign/skip pickers need the full set). */
  allPhases: DetailPhase[];
  assignees: AssigneeOption[];
  isOpen: boolean;
  /** Whether the viewer may run phase lifecycle (ADR 0033); default `true`. */
  canManageLifecycle?: boolean;
  /**
   * Whether the viewer may CORRECT this phase's result post-conclusion
   * (phase-results feature; task #10): resolved at the page level as
   * `phaseResultsEnabled` + staff_admin + the case is non-terminal. The button
   * also requires the phase to be `concluida`. Default `false`.
   */
  canCorrectResult?: boolean;
  /** The commission's active result options (the correction dialog's picker). */
  resultOptions?: ResolvedPhaseResult[];
}) {
  const heading = phase.title || `Fase ${phase.position}`;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Fase {phase.position}
            </span>
            <PhaseStatusPill status={phase.status} />
            {phase.recommended && phase.status === "pendente" && (
              <RecommendedChip />
            )}
            {phase.isAdHoc && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                adicional
              </span>
            )}
            {phase.status === "concluida" && (
              <PhaseResultBadge result={phase.result} />
            )}
          </div>
          <h2 className="text-base font-semibold">{heading}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText aria-hidden="true" className="size-3.5" />
              {phase.formTitle ?? "Formulário não encontrado"}
            </span>
            {phase.assigneeName && (
              <span className="inline-flex items-center gap-1">
                <User aria-hidden="true" className="size-3.5" />
                {phase.assigneeName}
              </span>
            )}
            {phase.dueDate &&
              (() => {
                const overdue = isOverdue(phase.dueDate, phase.status);
                return (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      overdue && "font-medium text-destructive",
                    )}
                  >
                    <CalendarClock aria-hidden="true" className="size-3.5" />
                    Prazo: {formatDueDate(phase.dueDate)}
                    {overdue && " · Atrasada"}
                  </span>
                );
              })()}
          </div>
        </div>
      </div>

      <CoordinatorPhaseActions
        slug={slug}
        phase={phase}
        allPhases={allPhases}
        assignees={assignees}
        isOpen={isOpen}
        canManageLifecycle={canManageLifecycle}
      />

      {canCorrectResult && phase.status === "concluida" && (
        <div className="flex justify-end">
          <PhaseResultCorrectButton
            casePhaseId={phase.id}
            options={resultOptions}
            currentResultId={phase.resultId}
            phaseLabel={heading}
          />
        </div>
      )}
    </article>
  );
}
