"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal, XCircle } from "lucide-react";

import type { CaseDetail, CaseStatusKey } from "@/lib/queries/cases";
import type { CaseStatusDef } from "@/lib/queries/case-statuses";
import { closeCase, cancelCase } from "@/lib/cases/actions";
import { setCaseStatus } from "@/lib/cases/status-actions";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCaseAction } from "@/components/cases/use-case-action";
import { AddAdHocPhaseDialog } from "@/components/cases/add-ad-hoc-phase-dialog";
import { TOKEN_COLOR_VAR } from "@/components/cases/case-status-badge";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";

/**
 * Case-level coordinator actions in the detail header (non-terminal case only —
 * a terminal case is frozen, HC025):
 *  - a "Estado" picker (Cases-Extras R2) → move to any OTHER NON-terminal status
 *    via `setCaseStatus` (terminal moves stay the explicit Encerrar items so the
 *    "open phases → não necessária" warning is shown);
 *  - "Adicionar fase" → ad-hoc phase dialog;
 *  - an "Encerrar" menu with the terminal statuses (Concluir / Cancelar), each
 *    behind a confirm. Both flip remaining open phases to "não necessária".
 */
export function CaseLifecycleActions({
  caseId,
  currentStatus,
  statusDefs,
  forms,
  phases,
  assignees,
}: {
  caseId: string;
  currentStatus: CaseStatusKey;
  /** The commission's non-archived status defs (the picker options). */
  statusDefs: CaseStatusDef[];
  forms: SlotForm[];
  phases: CaseDetail["phases"];
  assignees: AssigneeOption[];
}) {
  const { run, isPending, error } = useCaseAction();
  const [adHocOpen, setAdHocOpen] = useState(false);

  const hasOpenPhases = phases.some(
    (p) => p.status === "pendente" || p.status === "ativa",
  );

  // Non-terminal targets the coordinator can switch to (excluding the current).
  const nonTerminalTargets = statusDefs.filter(
    (d) => !d.isTerminal && d.key !== currentStatus,
  );
  // Terminal statuses back the "Encerrar" menu (confirmed; closes open phases).
  const terminalTargets = statusDefs.filter((d) => d.isTerminal);

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {nonTerminalTargets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="lg" disabled={isPending}>
                <SlidersHorizontal aria-hidden="true" />
                Estado
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Alterar estado</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {nonTerminalTargets.map((d) => (
                <DropdownMenuItem
                  key={d.key}
                  className="gap-2"
                  onSelect={() => run(() => setCaseStatus(caseId, d.key))}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TOKEN_COLOR_VAR[d.colorToken] }}
                  />
                  {d.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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
            {terminalTargets.map((d) => (
              <TerminalItem
                key={d.key}
                caseId={caseId}
                def={d}
                hasOpenPhases={hasOpenPhases}
                run={run}
                isPending={isPending}
              />
            ))}
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

/**
 * One terminal-status item in the Encerrar menu, behind a confirm dialog. Uses
 * the legacy thin wrappers for the two seeded keys (`concluido`/`cancelado`) so
 * their well-known revalidation path is preserved; any OTHER custom terminal
 * status funnels through the generic `setCaseStatus` (which also closes open
 * phases on terminal entry).
 */
function TerminalItem({
  caseId,
  def,
  hasOpenPhases,
  run,
  isPending,
}: {
  caseId: string;
  def: CaseStatusDef;
  hasOpenPhases: boolean;
  run: ReturnType<typeof useCaseAction>["run"];
  isPending: boolean;
}) {
  const isCancel = def.key === "cancelado";
  const action = () => {
    if (def.key === "concluido") return closeCase(caseId);
    if (def.key === "cancelado") return cancelCase(caseId);
    return setCaseStatus(caseId, def.key);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className={isCancel ? "text-destructive focus:text-destructive" : undefined}
        >
          {def.label}
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Marcar o caso como “{def.label}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            O caso passará para o estado final “{def.label}”.{" "}
            {hasOpenPhases
              ? "As fases ainda abertas serão marcadas como não necessárias."
              : ""}{" "}
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={() => run(action)}>
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
