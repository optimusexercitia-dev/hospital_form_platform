"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";

import type { PhaseResult } from "@/lib/queries/phase-results";
import {
  archivePhaseResult,
  reorderPhaseResults,
} from "@/lib/cases/result-actions";
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
import { ResultDefDialog } from "./result-def-dialog";
import { TOKEN_STYLES } from "./case-status-badge";
import { useResultAction } from "./use-result-action";

/**
 * Per-phase RESULT-vocabulary manager (phase-results feature, staff_admin):
 * create / rename / recolour / reorder / archive a commission's phase results,
 * including the advisory "is adverse" flag (NO "requires action plan"). Shows the
 * NON-archived set (what `listPhaseResults` returns by default); archiving hides a
 * result from the pickers while cases/templates that reference it keep showing it.
 * Mirrors {@link OutcomeManager}, with up/down reorder (the order the rule editor
 * + override picker present).
 */
export function ResultVocabManager({
  commissionId,
  results,
}: {
  commissionId: string;
  results: PhaseResult[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useResultAction();
  const { containerRef, captureBeforeReorder } = useFlipReorder<HTMLUListElement>();

  // Reorder by swapping a row with its neighbour and persisting the full order.
  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= results.length) return;
    const next = [...results];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderPhaseResults(
        commissionId,
        next.map((r) => r.id),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Defina os resultados que as fases dos processos desta comissão podem
          emitir. Marque um resultado como adverso para acompanhá-lo no painel.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Novo resultado
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {results.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum resultado ainda. Crie o primeiro resultado deste vocabulário.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {results.map((result, index) => (
            <li
              key={result.id}
              data-flip-id={`result-${result.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "up")}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${result.label} para cima`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "down")}
                  disabled={index === results.length - 1 || isPending}
                  aria-label={`Mover ${result.label} para baixo`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TOKEN_STYLES[result.colorToken] ?? TOKEN_STYLES.muted,
                )}
              >
                {result.label}
              </span>

              {result.isAdverse && (
                <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-destructive">
                  <AlertTriangle aria-hidden="true" className="size-3.5" />
                  Adverso
                </span>
              )}

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <ResultEditButton commissionId={commissionId} result={result} />
                <ArchiveResultButton result={result} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ResultDefDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        commissionId={commissionId}
      />
    </div>
  );
}

function ResultEditButton({
  commissionId,
  result,
}: {
  commissionId: string;
  result: PhaseResult;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar o resultado ${result.label}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <ResultDefDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        commissionId={commissionId}
        result={result}
      />
    </>
  );
}

function ArchiveResultButton({ result }: { result: PhaseResult }) {
  const { run, isPending, error } = useResultAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Arquivar o resultado ${result.label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Arquivar o resultado “{result.label}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            O resultado deixará de aparecer ao montar processos e ao preencher
            fases. Casos e processos que já o utilizam continuam exibindo-o.
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
            onClick={() => run(() => archivePhaseResult(result.id))}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
