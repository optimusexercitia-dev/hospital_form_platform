"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Stethoscope, Plus } from "lucide-react";

import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import {
  archiveCaseOutcome,
  reorderCaseOutcomes,
} from "@/lib/cases/outcomes-actions";
import { cn } from "@/lib/utils";
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
import { useFlipReorder } from "@/components/forms/use-flip-reorder";
import { OutcomeDefDialog } from "./outcome-def-dialog";
import { TOKEN_STYLES } from "./case-status-badge";
import { useCaseAction } from "./use-case-action";

/**
 * Outcome-vocabulary manager (D8–D11, staff_admin): create / rename / recolour /
 * reorder / archive a commission's case outcomes, including the advisory
 * "requires action plan" / "is adverse" flags. Shows the NON-archived set (what
 * `listCaseOutcomes` returns); archiving hides an outcome from the pickers while
 * cases/processes that reference it keep showing it (D11). Mirrors
 * {@link TagManager}, with up/down reorder (the order processes/pickers present).
 */
export function OutcomeManager({
  commissionId,
  outcomes,
}: {
  commissionId: string;
  outcomes: CaseOutcome[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useCaseAction();
  const { containerRef, captureBeforeReorder } = useFlipReorder<HTMLUListElement>();

  // Reorder by swapping a row with its neighbour and persisting the full order.
  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= outcomes.length) return;
    const next = [...outcomes];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderCaseOutcomes(
        commissionId,
        next.map((o) => o.id),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Defina os desfechos que os processos desta comissão podem oferecer.
          Marque um desfecho como evento adverso para acompanhá-lo no painel.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Novo desfecho
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {outcomes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum desfecho ainda. Crie o primeiro desfecho deste vocabulário.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {outcomes.map((outcome, index) => (
            <li
              key={outcome.id}
              data-flip-id={`outcome-${outcome.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "up")}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${outcome.label} para cima`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "down")}
                  disabled={index === outcomes.length - 1 || isPending}
                  aria-label={`Mover ${outcome.label} para baixo`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TOKEN_STYLES[outcome.colorToken] ?? TOKEN_STYLES.muted,
                )}
              >
                {outcome.label}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {outcome.requiresActionPlan && (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-warning">
                    <Stethoscope aria-hidden="true" className="size-3.5" />
                    Plano de ação
                  </span>
                )}
                {outcome.isAdverse && (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-destructive">
                    <AlertTriangle aria-hidden="true" className="size-3.5" />
                    Adverso
                  </span>
                )}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <OutcomeEditButton
                  commissionId={commissionId}
                  outcome={outcome}
                />
                <ArchiveOutcomeButton outcome={outcome} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <OutcomeDefDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        commissionId={commissionId}
      />
    </div>
  );
}

function OutcomeEditButton({
  commissionId,
  outcome,
}: {
  commissionId: string;
  outcome: CaseOutcome;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar o desfecho ${outcome.label}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <OutcomeDefDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        commissionId={commissionId}
        outcome={outcome}
      />
    </>
  );
}

function ArchiveOutcomeButton({ outcome }: { outcome: CaseOutcome }) {
  const { run, isPending, error } = useCaseAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Arquivar o desfecho ${outcome.label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Arquivar o desfecho “{outcome.label}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            O desfecho deixará de aparecer ao montar processos e ao concluir casos.
            Casos que já o possuem continuam exibindo-o.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(() => archiveCaseOutcome(outcome.id))}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
