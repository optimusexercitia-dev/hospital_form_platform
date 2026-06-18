"use client";

import { useState } from "react";
import { Archive, ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";

import type { ActionState } from "@/lib/safety/types";
import type { VocabInput } from "@/lib/safety/triage-types";
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
import { useSafetyAction } from "../use-safety-action";
import { VocabDefDialog, type VocabEntry } from "./vocab-def-dialog";

/** The actions this manager drives (passed in so it serves both vocabularies). */
export interface VocabActions {
  create: (input: VocabInput) => Promise<ActionState>;
  update: (id: string, input: VocabInput) => Promise<ActionState>;
  reorder: (orderedIds: string[]) => Promise<ActionState>;
  archive: (id: string) => Promise<ActionState>;
}

/** A manageable vocabulary row — the shared shape of `EventType` / `SentinelCriterion`. */
export interface ManagedVocabEntry extends VocabEntry {
  position: number;
  isActive: boolean;
}

/**
 * The configurable-vocabulary MANAGER (event types OR sentinel criteria). Mirrors
 * the cases `OutcomeManager`: a list with up/down GSAP-Flip reorder, archive via a
 * confirm dialog, and create/edit through {@link VocabDefDialog}. The config page
 * passes the full set (incl. inactive) so archived entries show a muted badge while
 * existing flags/events keep resolving them.
 */
export function VocabManager({
  kind,
  entries,
  actions,
}: {
  kind: "eventType" | "criterion";
  entries: ManagedVocabEntry[];
  actions: VocabActions;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useSafetyAction();
  const { containerRef, captureBeforeReorder } = useFlipReorder<HTMLUListElement>();

  // Reorder operates over the ACTIVE set only (archived entries have no position
  // in the pickers); we send the full active order to the action.
  const active = entries.filter((e) => e.isActive);
  const archived = entries.filter((e) => !e.isActive);

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= active.length) return;
    const next = [...active];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() => actions.reorder(next.map((e) => e.id)));
  }

  const nounSingular =
    kind === "eventType" ? "tipo de evento" : "critério sentinela";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          {kind === "eventType"
            ? "Defina os tipos de evento que as comissões podem selecionar ao notificar."
            : "Defina as categorias que qualificam automaticamente um evento como sentinela."}
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Novo {nounSingular}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum {nounSingular} ativo. Crie o primeiro deste vocabulário.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {active.map((entry, index) => (
            <li
              key={entry.id}
              data-flip-id={`vocab-${entry.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "up")}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${entry.label} para cima`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "down")}
                  disabled={index === active.length - 1 || isPending}
                  aria-label={`Mover ${entry.label} para baixo`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{entry.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {entry.key}
                </span>
                {entry.description && (
                  <span className="text-xs text-muted-foreground text-pretty">
                    {entry.description}
                  </span>
                )}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <VocabEditButton kind={kind} entry={entry} actions={actions} />
                <ArchiveVocabButton
                  entry={entry}
                  nounSingular={nounSingular}
                  onArchive={actions.archive}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="rounded-xl border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Arquivados ({archived.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {archived.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase",
                  )}
                >
                  Arquivado
                </span>
                {entry.label}
                <span className="font-mono text-xs">{entry.key}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <VocabDefDialog
        mode="create"
        kind={kind}
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={actions.create}
        onUpdate={actions.update}
      />
    </div>
  );
}

function VocabEditButton({
  kind,
  entry,
  actions,
}: {
  kind: "eventType" | "criterion";
  entry: VocabEntry;
  actions: VocabActions;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${entry.label}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <VocabDefDialog
        mode="edit"
        kind={kind}
        open={open}
        onOpenChange={setOpen}
        entry={entry}
        onCreate={actions.create}
        onUpdate={actions.update}
      />
    </>
  );
}

function ArchiveVocabButton({
  entry,
  nounSingular,
  onArchive,
}: {
  entry: VocabEntry;
  nounSingular: string;
  onArchive: (id: string) => Promise<ActionState>;
}) {
  const { run, isPending, error } = useSafetyAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Arquivar ${entry.label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <Archive aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar “{entry.label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            O {nounSingular} deixará de aparecer nas seleções. Eventos e triagens que
            já o referenciam continuam exibindo-o.
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
            onClick={() => run(() => onArchive(entry.id))}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
