"use client";

import { Trash2 } from "lucide-react";

import type { ActionState } from "@/lib/action-items/satellite-actions";
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

import { useSatelliteAction } from "./use-satellite-action";

/**
 * Confirm-then-delete icon button for a satellite row (a reminder rule or a
 * checklist subtask). Mirrors the cases/meetings `ConfirmDeleteButton`, but is
 * typed against the satellite `ActionState` and — crucially — refreshes the
 * lazily-loaded satellite lists via `onDeleted` on success (the parent's
 * `router.refresh()` alone would not re-fetch the client-held lists).
 */
export function SatelliteConfirmDelete({
  action,
  onDeleted,
  label,
  title,
  description,
  confirmLabel = "Remover",
}: {
  /** The bound delete thunk (e.g. `() => deleteActionItemReminder(id)`). */
  action: () => Promise<ActionState>;
  /** Re-fetch the satellite lists after a successful delete. */
  onDeleted: () => void | Promise<void>;
  /** Accessible label for the trigger button. */
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const { run, isPending, error } = useSatelliteAction();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
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
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(action, { onSuccess: onDeleted })}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
