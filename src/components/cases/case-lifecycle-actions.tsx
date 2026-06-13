"use client";

import { useState } from "react";
import { Plus, XCircle } from "lucide-react";

import type { CaseDetail } from "@/lib/queries/cases";
import { closeCase, cancelCase } from "@/lib/cases/actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCaseAction } from "@/components/cases/use-case-action";
import { AddAdHocPhaseDialog } from "@/components/cases/add-ad-hoc-phase-dialog";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";

/**
 * Case-level coordinator actions in the detail header (open case only):
 *  - "Adicionar fase" → ad-hoc phase dialog;
 *  - a "Encerrar" menu with Conclude / Cancel, each behind a confirm. Both flip
 *    remaining open phases to "não necessária".
 *
 * The assignee picker for the ad-hoc dialog comes from the page; here we only
 * need the publishable forms. Errors surface via the confirm dialogs / the
 * `useCaseAction` banner.
 */
export function CaseLifecycleActions({
  caseId,
  forms,
  phases,
  assignees,
}: {
  caseId: string;
  forms: SlotForm[];
  phases: CaseDetail["phases"];
  assignees: AssigneeOption[];
}) {
  const { run, isPending, error } = useCaseAction();
  const [adHocOpen, setAdHocOpen] = useState(false);

  const hasOpenPhases = phases.some(
    (p) => p.status === "pendente" || p.status === "ativa",
  );

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setAdHocOpen(true)}
          disabled={forms.length === 0}
        >
          <Plus aria-hidden="true" />
          Adicionar fase
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="lg">
              <XCircle aria-hidden="true" />
              Encerrar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ConcludeItem
              caseId={caseId}
              hasOpenPhases={hasOpenPhases}
              run={run}
              isPending={isPending}
            />
            <CancelItem
              caseId={caseId}
              run={run}
              isPending={isPending}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <AddAdHocPhaseDialog
        open={adHocOpen}
        onOpenChange={setAdHocOpen}
        caseId={caseId}
        forms={forms}
        assignees={assignees}
      />
    </div>
  );
}

function ConcludeItem({
  caseId,
  hasOpenPhases,
  run,
  isPending,
}: {
  caseId: string;
  hasOpenPhases: boolean;
  run: ReturnType<typeof useCaseAction>["run"];
  isPending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          Concluir caso
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Concluir este caso?</AlertDialogTitle>
          <AlertDialogDescription>
            O caso será marcado como concluído.{" "}
            {hasOpenPhases
              ? "As fases ainda abertas serão marcadas como não necessárias."
              : ""}{" "}
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(() => closeCase(caseId))}
          >
            Concluir caso
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelItem({
  caseId,
  run,
  isPending,
}: {
  caseId: string;
  run: ReturnType<typeof useCaseAction>["run"];
  isPending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="text-destructive focus:text-destructive"
        >
          Cancelar caso
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar este caso?</AlertDialogTitle>
          <AlertDialogDescription>
            O caso será marcado como cancelado e as fases abertas serão marcadas
            como não necessárias. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(() => cancelCase(caseId))}
          >
            Cancelar caso
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
