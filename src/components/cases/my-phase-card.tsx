import { CalendarClock, FileText, PlayCircle } from "lucide-react";

import type { MyAssignedPhase } from "@/lib/queries/cases";
import { StartPhaseButton } from "@/components/cases/start-phase-button";
import { formatCaseNumber, formatDueDate, isOverdue } from "@/components/cases/format";
import { cn } from "@/lib/utils";

/**
 * One row in "Minhas fases" (F5): a case phase the caller is assigned to and that
 * is ACTIVE. Shows the case number, the phase, and the bound form, with a
 * "Preencher" action ({@link StartPhaseButton}) that starts/resumes the response
 * on CLICK and navigates into the wizard. Mirrors {@link MyResponseCard}; status
 * is the single "ativa" state here (the query returns only active assigned
 * phases), so the affordance is always "Preencher".
 */
export function MyPhaseCard({
  org,
  slug,
  phase,
  index,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  phase: MyAssignedPhase;
  index: number;
}) {
  const heading = phase.phaseTitle || `Fase ${phase.position}`;

  return (
    <article
      style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
      className="animate-rise-in flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-primary">
            {formatCaseNumber(phase.caseNumber)}
          </span>
          {phase.caseLabel && (
            <span className="truncate text-xs text-muted-foreground">
              {phase.caseLabel}
            </span>
          )}
        </div>
        <h2 className="truncate text-base font-semibold">{heading}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-accent-foreground">
            <PlayCircle aria-hidden="true" className="size-3.5" />
            Ativa
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText aria-hidden="true" className="size-3.5" />
            {phase.formTitle}
          </span>
          {phase.dueDate &&
            (() => {
              const overdue = isOverdue(phase.dueDate, "ativa");
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

      <div className="shrink-0">
        <StartPhaseButton
          org={org} slug={slug}
          caseId={phase.caseId}
          phaseId={phase.phaseId}
        />
      </div>
    </article>
  );
}
