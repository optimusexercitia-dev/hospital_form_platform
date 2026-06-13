"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileText, GitBranch, Pencil, Trash2 } from "lucide-react";

import type { ProcessTemplatePhase } from "@/lib/queries/process-templates";
import {
  moveTemplatePhase,
  removeTemplatePhase,
} from "@/lib/process-templates/actions";
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
import { useBuilderAction } from "@/components/process-templates/use-template-action";
import { PhaseSlotDialog } from "@/components/process-templates/phase-slot-dialog";
import type { PhaseWithTargets } from "@/components/process-templates/phase-with-targets";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";

/**
 * One phase-slot in the template builder. Mirrors the form {@link SectionCard}
 * but as a leaf node — a slot binds a whole form (no nested items), with an
 * optional cross-phase `recommend_when`. Header carries the phase position, the
 * bound form's title, a "recomendação" badge when a `recommend_when` is set, and
 * (when `editable`) reorder up/down + edit + remove.
 *
 * Reorder is plain up/down controls animated via the shared GSAP Flip hook (each
 * card carries a stable `data-flip-id`); motion is best-effort and never blocks
 * the persisted move.
 */
export function PhaseSlotCard({
  phase,
  phases,
  forms,
  isFirst,
  isLast,
  editable,
  onBeforeReorder,
}: {
  phase: ProcessTemplatePhase;
  phases: PhaseWithTargets[];
  forms: SlotForm[];
  isFirst: boolean;
  isLast: boolean;
  editable: boolean;
  onBeforeReorder: () => void;
}) {
  const { run, isPending, error } = useBuilderAction();
  const [editOpen, setEditOpen] = useState(false);

  const heading = phase.title || `Fase ${phase.position}`;
  const formLabel = phase.formTitle ?? "Formulário não encontrado";

  function handleMove(direction: "up" | "down") {
    onBeforeReorder();
    run(() => moveTemplatePhase(phase.id, direction));
  }

  function handleRemove() {
    run(() => removeTemplatePhase(phase.id));
  }

  return (
    <section
      data-flip-id={`phase-${phase.id}`}
      aria-label={heading}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Fase {phase.position}
            </span>
            {phase.recommendWhen && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-secondary-foreground uppercase">
                <GitBranch aria-hidden="true" className="size-3" />
                recomendação
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold">{heading}</h2>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{formLabel}</span>
          </p>
        </div>

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleMove("up")}
              disabled={isFirst || isPending}
              aria-label={`Mover a fase ${phase.position} para cima`}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleMove("down")}
              disabled={isLast || isPending}
              aria-label={`Mover a fase ${phase.position} para baixo`}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar a fase ${phase.position}`}
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
                  aria-label={`Remover a fase ${phase.position}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover esta fase?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A fase “{heading}” será removida do processo e as fases
                    seguintes serão renumeradas. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove}>
                    Remover fase
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {editable && (
        <PhaseSlotDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          templateId={phase.templateId}
          phase={phase}
          forms={forms}
          phases={phases}
        />
      )}
    </section>
  );
}
