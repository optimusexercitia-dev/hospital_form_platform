"use client";

import { Trash2 } from "lucide-react";

import type { ActionState } from "@/lib/safety/types";
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
import { useSafetyAction } from "../use-safety-action";

/**
 * A small icon button that confirms, then runs a one-shot RCA delete/remove action
 * and refreshes the route — the shared destructive affordance across the RCA panels
 * (member remove, timeline remove, evidence soft-delete, factor/root remove).
 * Mirrors the interviews `ConfirmDeleteButton`, typed against the SAFETY action
 * module via {@link useSafetyAction}. The pt-BR error surfaces inline on failure.
 */
export function RcaConfirmDelete({
  action,
  label,
  title,
  description,
  confirmLabel = "Remover",
}: {
  /** The bound delete thunk (e.g. `() => removeRcaMember(id)`). */
  action: () => Promise<ActionState>;
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
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
