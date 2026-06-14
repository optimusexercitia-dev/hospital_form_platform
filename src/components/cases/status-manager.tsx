"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Flag, Lock, Pencil, Plus } from "lucide-react";

import type { CaseStatusDef } from "@/lib/queries/case-statuses";
import {
  archiveCaseStatus,
  reorderCaseStatus,
} from "@/lib/cases/status-actions";
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
import { StatusDefDialog } from "./status-def-dialog";
import { CaseStatusBadge, TOKEN_COLOR_VAR } from "./case-status-badge";
import { useCaseAction } from "./use-case-action";

/**
 * Status-vocabulary manager (Cases-Extras R2, staff_admin): create / rename /
 * recolour / reorder / archive a commission's configurable case statuses (the
 * kanban columns). Reorder is plain up/down controls animated via the shared
 * GSAP Flip hook (best-effort; the persisted move never depends on motion),
 * funnelling the full ordered key list through `reorderCaseStatus`.
 *
 * The list shows the NON-archived set (what `listCaseStatusDefs` returns).
 * Archiving the sole `is_initial` is rejected by the backend (HC-mapped error).
 */
export function StatusManager({
  commissionId,
  defs,
}: {
  commissionId: string;
  defs: CaseStatusDef[];
}) {
  const { run, isPending, error } = useCaseAction();
  const [addOpen, setAddOpen] = useState(false);
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLUListElement>();

  const ordered = [...defs].sort((a, b) => a.position - b.position);

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderCaseStatus(
        commissionId,
        next.map((d) => d.key),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Defina os estados pelos quais um caso pode passar. A ordem determina as
          colunas do quadro. Um estado final congela o caso.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Novo estado
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}

      {ordered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum estado definido. Crie o primeiro estado deste fluxo de casos.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {ordered.map((def, index) => (
            <li
              key={def.key}
              data-flip-id={`status-${def.key}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: TOKEN_COLOR_VAR[def.colorToken] }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CaseStatusBadge
                    label={def.label}
                    colorToken={def.colorToken}
                  />
                  {def.isInitial && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.62rem] font-medium tracking-wide text-secondary-foreground uppercase">
                      <Flag aria-hidden="true" className="size-3" />
                      Inicial
                    </span>
                  )}
                  {def.isTerminal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.62rem] font-medium tracking-wide text-muted-foreground uppercase">
                      <Lock aria-hidden="true" className="size-3" />
                      Final
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {def.key}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(index, "up")}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${def.label} para cima`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(index, "down")}
                  disabled={index === ordered.length - 1 || isPending}
                  aria-label={`Mover ${def.label} para baixo`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <StatusEditButton commissionId={commissionId} def={def} />
                <ArchiveStatusButton
                  commissionId={commissionId}
                  def={def}
                  canArchive={!(def.isInitial && ordered.length > 0)}
                  run={run}
                  isPending={isPending}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <StatusDefDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        commissionId={commissionId}
      />
    </div>
  );
}

function StatusEditButton({
  commissionId,
  def,
}: {
  commissionId: string;
  def: CaseStatusDef;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${def.label}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <StatusDefDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        commissionId={commissionId}
        def={def}
      />
    </>
  );
}

function ArchiveStatusButton({
  commissionId,
  def,
  canArchive,
  run,
  isPending,
}: {
  commissionId: string;
  def: CaseStatusDef;
  canArchive: boolean;
  run: ReturnType<typeof useCaseAction>["run"];
  isPending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending || !canArchive}
          aria-label={`Arquivar ${def.label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar o estado “{def.label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            O estado deixará de aparecer no quadro e nos seletores. Casos que já
            estão nele continuam exibindo-o. Você pode criar um novo estado a
            qualquer momento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(() => archiveCaseStatus(def.key, commissionId))}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
