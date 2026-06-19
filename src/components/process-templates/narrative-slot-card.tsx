"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileText, Pencil, Star, Trash2 } from "lucide-react";

import type { CaseNarrativeType } from "@/lib/queries/case-narratives";
import type { ProcessTemplateNarrative } from "@/lib/queries/process-templates";
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
import { NarrativeSlotDialog } from "@/components/process-templates/narrative-slot-dialog";

/**
 * One NARRATIVE-slot in the merged template builder list (ADR 0032), the
 * narrative-side analogue of {@link PhaseSlotCard}. Header carries the bound
 * type's label, an optional per-slot title, an "esperada" chip when `is_expected`,
 * and (when `editable`) reorder up/down + edit + remove.
 *
 * Reorder + remove are CROSS-TABLE operations (the narrative interleaves with the
 * phases), so the card delegates them to the shell via `onMove` / `onRemove` — the
 * shell owns the single action runner and persists through `reorderCaseLayout` /
 * `removeTemplateNarrative`. The card carries a stable `data-flip-id` so the
 * shared GSAP Flip hook animates the move; motion is best-effort.
 */
export function NarrativeSlotCard({
  narrative,
  narrativeTypes,
  isFirst,
  isLast,
  editable,
  isPending,
  onMove,
  onRemove,
}: {
  narrative: ProcessTemplateNarrative;
  /** The commission's NON-archived narrative vocabulary (the edit dialog's picker). */
  narrativeTypes: CaseNarrativeType[];
  isFirst: boolean;
  isLast: boolean;
  editable: boolean;
  /** True while any builder action is in flight (disables the controls). */
  isPending: boolean;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);

  // The live type label (so vocabulary renames show in the draft builder); the
  // snapshot `typeLabel` is the fallback if the type was archived/removed.
  const typeLabel = narrative.typeLabel ?? "Narrativa";
  const heading = narrative.title || typeLabel;
  const slotLabel = narrative.title ? `“${narrative.title}”` : typeLabel;

  return (
    <section
      data-flip-id={`narrative-${narrative.id}`}
      aria-label={heading}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FileText aria-hidden="true" className="size-3.5" />
              Narrativa
            </span>
            {narrative.isExpected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-warning uppercase">
                <Star aria-hidden="true" className="size-3" />
                esperada
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold">{heading}</h2>
          {/* When a title overrides the type label, still surface the bound type. */}
          {narrative.title && (
            <p className="text-sm text-muted-foreground">{typeLabel}</p>
          )}
          {narrative.instructions && (
            <p className="max-w-prose text-sm text-muted-foreground text-pretty">
              {narrative.instructions}
            </p>
          )}
        </div>

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove("up")}
              disabled={isFirst || isPending}
              aria-label={`Mover a narrativa ${slotLabel} para cima`}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove("down")}
              disabled={isLast || isPending}
              aria-label={`Mover a narrativa ${slotLabel} para baixo`}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar a narrativa ${slotLabel}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  aria-label={`Remover a narrativa ${slotLabel}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover esta narrativa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A narrativa {slotLabel} será removida do processo e as etapas
                    seguintes serão reordenadas. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>
                    Remover narrativa
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {editable && (
        <NarrativeSlotDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          templateId={narrative.templateId}
          narrative={narrative}
          narrativeTypes={narrativeTypes}
        />
      )}
    </section>
  );
}
