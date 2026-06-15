"use client";

import { Trash2 } from "lucide-react";

import type { ActionState } from "@/lib/meetings/actions";
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
import { useMeetingAction } from "./use-meeting-action";

/**
 * A small icon button that confirms, then runs a one-shot meetings delete action
 * and refreshes the route — the shared destructive affordance across the meeting
 * panels (agenda remove, attendee remove, case unlink, attachment soft-delete,
 * action-item delete). Mirrors the cases `ConfirmDeleteButton` but typed against
 * the meetings action module. The pt-BR error surfaces inline on failure.
 */
export function ConfirmDeleteButton({
  action,
  label,
  title,
  description,
  confirmLabel = "Remover",
}: {
  /** The bound delete thunk (e.g. `() => removeMeetingAttendee(id)`). */
  action: () => Promise<ActionState>;
  /** Accessible label for the trigger button. */
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const { run, isPending, error } = useMeetingAction();

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
