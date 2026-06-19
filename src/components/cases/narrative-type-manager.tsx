"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileText, Pencil, Plus } from "lucide-react";

import type { CaseNarrativeType } from "@/lib/queries/case-narratives";
import {
  archiveNarrativeType,
  reorderNarrativeTypes,
} from "@/lib/case-narratives/actions";
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
import { NarrativeTypeDialog } from "./narrative-type-dialog";
import { useNarrativeAction } from "./use-narrative-action";

/**
 * Narrative-type vocabulary manager (ADR 0032, staff_admin): create / rename /
 * reorder / archive a commission's narrative TYPES. Mirrors {@link OutcomeManager}
 * (up/down reorder via the shared GSAP Flip hook, archive-only retire) — but
 * WITHOUT the colour token or advisory flags, since a narrative type is a plain
 * label + optional description. Shows the NON-archived set (what
 * `listNarrativeTypes` returns by default); archiving hides a type from the slot
 * picker while template slots / cases that reference it keep their snapshot label.
 */
export function NarrativeTypeManager({
  commissionId,
  narrativeTypes,
}: {
  commissionId: string;
  narrativeTypes: CaseNarrativeType[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useNarrativeAction();
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLUListElement>();

  // Reorder by swapping a row with its neighbour and persisting the full order.
  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= narrativeTypes.length) return;
    const next = [...narrativeTypes];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderNarrativeTypes(
        commissionId,
        next.map((n) => n.id),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Defina os tipos de narrativa que os processos desta comissão podem
          registrar nos casos — como um Resumo Clínico ou a Conclusão do Comitê.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Nova narrativa
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {narrativeTypes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhuma narrativa ainda. Crie o primeiro tipo deste vocabulário.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {narrativeTypes.map((narrativeType, index) => (
            <li
              key={narrativeType.id}
              data-flip-id={`narrative-type-${narrativeType.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "up")}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${narrativeType.label} para cima`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "down")}
                  disabled={index === narrativeTypes.length - 1 || isPending}
                  aria-label={`Mover ${narrativeType.label} para baixo`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <FileText
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />

              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {narrativeType.label}
                </span>
                {narrativeType.description && (
                  <span className="truncate text-xs text-muted-foreground">
                    {narrativeType.description}
                  </span>
                )}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <NarrativeTypeEditButton
                  commissionId={commissionId}
                  narrativeType={narrativeType}
                />
                <ArchiveNarrativeTypeButton narrativeType={narrativeType} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <NarrativeTypeDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        commissionId={commissionId}
      />
    </div>
  );
}

function NarrativeTypeEditButton({
  commissionId,
  narrativeType,
}: {
  commissionId: string;
  narrativeType: CaseNarrativeType;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar a narrativa ${narrativeType.label}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <NarrativeTypeDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        commissionId={commissionId}
        narrativeType={narrativeType}
      />
    </>
  );
}

function ArchiveNarrativeTypeButton({
  narrativeType,
}: {
  narrativeType: CaseNarrativeType;
}) {
  const { run, isPending, error } = useNarrativeAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Arquivar a narrativa ${narrativeType.label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Arquivar a narrativa “{narrativeType.label}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            A narrativa deixará de aparecer ao montar processos. Processos e casos
            que já a utilizam continuam exibindo-a.
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
            onClick={() => run(() => archiveNarrativeType(narrativeType.id))}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
