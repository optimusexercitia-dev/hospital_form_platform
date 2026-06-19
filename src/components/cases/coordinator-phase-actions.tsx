"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, PlayCircle, SkipForward, UserCog } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import { skipPhase } from "@/lib/cases/actions";
import { blockedBy } from "@/components/cases/case-derive";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCaseAction } from "@/components/cases/use-case-action";
import { ActivatePhaseDialog } from "@/components/cases/activate-phase-dialog";
import type { AssigneeOption } from "@/components/cases/case-phase-list";

type DetailPhase = CaseDetail["phases"][number];

/**
 * The contextual coordinator controls for one phase row, dispatched by status:
 *  - **pendente** → "Ativar e atribuir" (the activate dialog) + "Marcar como não
 *    necessária" (skip, confirmed). When earlier BLOCKING phases (D1/D4) are not
 *    yet concluída/não-necessária, "Ativar e atribuir" is DISABLED with a
 *    "Bloqueada por Fase N" note (the server also rejects via HC018).
 *  - **ativa** → "Alterar responsável" (reassign — only succeeds before the
 *    assignee starts; the backend returns a pt-BR message otherwise).
 *  - **concluída** → "Ver respostas" deep-link to the read-only answer view
 *    (`responseId` is populated only for submitted phases — the Phase-7
 *    invariant).
 *  - **não necessária** → no action.
 *
 * All controls are hidden when the case is closed (`isOpen=false`), except the
 * concluída "Ver respostas" link, which stays available so a closed case's
 * answers remain reviewable.
 *
 * Case Access Control (ADR 0033): the MUTATING controls (activate / skip / reassign)
 * are lifecycle ops — `staff_admin`/admin only. A read/write-grantee viewing the
 * case (`canManageLifecycle=false`) sees the phase rows but NO lifecycle actions; the
 * "Ver respostas" deep-link is also coordinator-only (it targets the `/manage/...`
 * read view), so it is suppressed for non-coordinators too.
 */
export function CoordinatorPhaseActions({
  slug,
  phase,
  allPhases,
  assignees,
  isOpen,
  canManageLifecycle = true,
}: {
  slug: string;
  phase: DetailPhase;
  /** The case's full phase list — to evaluate this phase's blockers (D4). */
  allPhases: DetailPhase[];
  assignees: AssigneeOption[];
  isOpen: boolean;
  /**
   * Whether the viewer may run phase lifecycle (activate/skip/reassign) + see the
   * coordinator answer deep-link. Default `true` preserves every coordinator
   * call-site; the staff full-case view passes `false`.
   */
  canManageLifecycle?: boolean;
}) {
  const { run, isPending, error } = useCaseAction();
  const [activateOpen, setActivateOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const phaseLabel = phase.title ? `“${phase.title}”` : `a fase ${phase.position}`;
  // Earlier blocking phases not yet settled (D4); `[]` = activatable.
  const blockingPositions = blockedBy(phase, allPhases);
  const isBlocked = blockingPositions.length > 0;
  const blockedLabel =
    blockingPositions.length === 1
      ? `Bloqueada por Fase ${blockingPositions[0]}`
      : `Bloqueada por Fases ${blockingPositions.join(", ")}`;

  // A non-coordinator viewer (read/write grantee) gets no phase controls: lifecycle
  // is coordinator-only and the answer deep-link targets the coordinator-only view.
  if (!canManageLifecycle) return null;

  // Concluída: a read-only answer view is always available (even when closed).
  if (phase.status === "concluida") {
    if (!phase.responseId) return null;
    return (
      <div className="flex items-center justify-end">
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/c/${slug}/manage/cases/${phase.caseId}/fase/${phase.id}/respostas`}
          >
            Ver respostas
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  // A closed case shows no mutating controls.
  if (!isOpen) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {phase.status === "pendente" && (
          <>
            {isBlocked && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Lock aria-hidden="true" className="size-3.5" />
                {blockedLabel}
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setActivateOpen(true)}
              disabled={assignees.length === 0 || isPending || isBlocked}
              title={isBlocked ? blockedLabel : undefined}
            >
              <PlayCircle aria-hidden="true" />
              Ativar e atribuir
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                >
                  <SkipForward aria-hidden="true" />
                  Não necessária
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Marcar como não necessária?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    A {phaseLabel} será marcada como não necessária e a próxima
                    fase poderá ser ativada. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Voltar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    onClick={() => run(() => skipPhase(phase.id))}
                  >
                    Marcar como não necessária
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {phase.status === "ativa" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReassignOpen(true)}
            disabled={assignees.length === 0 || isPending}
          >
            <UserCog aria-hidden="true" />
            Alterar responsável
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {phase.status === "pendente" && (
        <ActivatePhaseDialog
          mode="activate"
          open={activateOpen}
          onOpenChange={setActivateOpen}
          casePhaseId={phase.id}
          phaseLabel={phaseLabel}
          currentAssignee={phase.assignedTo}
          assignees={assignees}
          defaultDueDays={phase.defaultDueDays}
        />
      )}
      {phase.status === "ativa" && (
        <ActivatePhaseDialog
          mode="reassign"
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          casePhaseId={phase.id}
          phaseLabel={phaseLabel}
          currentAssignee={phase.assignedTo}
          assignees={assignees}
          defaultDueDays={null}
          currentDueDate={phase.dueDate}
        />
      )}
    </div>
  );
}
