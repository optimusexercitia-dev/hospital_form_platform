"use client";

import { Trash2 } from "lucide-react";

import type { ActionState } from "@/lib/interviews/actions";
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
import { useInterviewAction } from "./use-interview-action";

/**
 * A small icon button that confirms, then runs a one-shot interviews delete action
 * and refreshes the route — the shared destructive affordance across the interview
 * panels (subject remove, interviewer remove, attachment soft-delete). Mirrors the
 * meetings `ConfirmDeleteButton` but typed against the interviews action module.
 * The pt-BR error surfaces inline on failure.
 */
export function ConfirmDeleteButton({
  action,
  label,
  title,
  description,
  confirmLabel = "Remover",
}: {
  /** The bound delete thunk (e.g. `() => removeInterviewSubject(id)`). */
  action: () => Promise<ActionState>;
  /** Accessible label for the trigger button. */
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const { run, isPending, error } = useInterviewAction();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          aria-label={label}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={() => run(action)}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
