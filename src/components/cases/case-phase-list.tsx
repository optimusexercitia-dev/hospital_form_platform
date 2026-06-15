import { CalendarClock, FileText, User } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import {
  PhaseStatusPill,
  RecommendedChip,
} from "@/components/cases/phase-status-pill";
import { CoordinatorPhaseActions } from "@/components/cases/coordinator-phase-actions";
import { formatDueDate, isOverdue } from "@/components/cases/format";
import { cn } from "@/lib/utils";

/** An assignee option for the activate / reassign pickers. */
export interface AssigneeOption {
  userId: string;
  name: string;
}

/**
 * The ordered list of a case's phases (per-case detail). Each row mirrors the
 * {@link MyResponseCard} idiom: form/title, a status pill (icon+text+shape), the
 * `recommended` highlight, the assignee, and the contextual coordinator actions.
 * Server-Component-safe wrapper; the per-row actions are client islands.
 */
export function CasePhaseList({
  slug,
  detail,
  assignees,
  isOpen,
}: {
  slug: string;
  detail: CaseDetail;
  assignees: AssigneeOption[];
  /** Whether the parent case is still `aberto` (gates the coordinator actions). */
  isOpen: boolean;
}) {
  const phases = [...detail.phases].sort((a, b) => a.position - b.position);

  return (
    <section aria-label="Fases do caso" className="flex flex-col gap-3">
      {phases.map((phase, index) => {
        const heading = phase.title || `Fase ${phase.position}`;
        return (
          <article
            key={phase.id}
            style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
            className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
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
              allPhases={phases}
              assignees={assignees}
              isOpen={isOpen}
            />
          </article>
        );
      })}
    </section>
  );
}
