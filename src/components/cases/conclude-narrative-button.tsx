"use client";

import { CheckCircle2 } from "lucide-react";

import { concludeNarrative } from "@/lib/case-narratives/actions";
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

/**
 * "Concluir" affordance for an OPEN narrative assigned to the viewer (Case Access
 * Control increment, ADR 0033 D5). Concluding freezes the body (`aberta → concluida`),
 * so it is confirmed. Routed through `concludeNarrative`; the assignee or a
 * coordinator may conclude (authorized server-side; a denied call surfaces the
 * pt-BR error inline). Used on the "Meus Casos" card and the focused editor.
 *
 * `variant`/`size` default to a compact secondary button for the card; the editor
 * passes a fuller treatment.
 */
export function ConcludeNarrativeButton({
  narrativeId,
  variant = "outline",
  size = "sm",
  onConcluded,
}: {
  narrativeId: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  /** Optional callback after a successful conclude (e.g. the editor leaves edit mode). */
  onConcluded?: () => void;
}) {
  const { run, isPending, error } = useCaseAction();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant={variant} size={size} disabled={isPending}>
            <CheckCircle2 aria-hidden="true" />
            Concluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir esta narrativa?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao concluir, o conteúdo desta narrativa é congelado e deixa de ser
              editável. A coordenação pode reabri-la depois, se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() =>
                run(() => concludeNarrative(narrativeId), {
                  onSuccess: onConcluded,
                })
              }
            >
              Concluir narrativa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
