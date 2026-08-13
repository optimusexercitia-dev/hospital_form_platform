"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { softDeleteDocument } from "@/lib/documents/actions";
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
import { DOCUMENT_ERROR_FALLBACK, documentErrorMessage } from "./document-labels";

/**
 * Soft-delete a Wave-A document (DM2·S3).
 *
 * Takes the document id as a STRING and calls the action itself, rather than
 * receiving a bound thunk from the Server Component parent. Passing a server
 * function across the RSC → Client boundary is a recorded crash class in this
 * repo (BUG-QI-001, which has recurred); `.bind()` is serializable but a plain
 * string needs no such reasoning to be correct.
 *
 * Failure renders inline in pt-BR, mapped from the action's error CODE — never
 * a raw server string (Rule 10).
 *
 * ## Why the confirm button prevents its own default (QA r1 MINOR-4)
 *
 * `AlertDialogAction` is Radix's `AlertDialogPrimitive.Action`: clicking it
 * CLOSES the dialog. Without `preventDefault` this component set its error into
 * a subtree that was already unmounting, so the `role="alert"` paragraph below
 * was dead UI — a refused delete told the user nothing at all and simply left
 * the row in place. Observed, not reasoned: a delete refused by a legal hold
 * left `documents.status = 'active'` with the dialog already gone. The sibling
 * confirm dialogs that render an inline error (`ethics-decisions-panel`,
 * `archive-indicator-button`, `meeting-type-manager`) all prevent the default;
 * this one did not. The dialog now closes only on success.
 */
export function DocumentDeleteButton({
  documentId,
  title,
  description,
}: {
  documentId: string;
  /** Document title — used for the trigger's accessible name. */
  title: string;
  /** pt-BR confirmation body, home-specific. */
  description: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await softDeleteDocument(documentId);
        if (result.ok) {
          setOpen(false);
          router.refresh();
          return;
        }
        // The premise this once guarded against is gone: `softDeleteDocument`
        // returns `DocumentActionState`, whose `error` is the CLOSED
        // `DocumentActionErrorCode` union, and `documentErrorMessage` maps every
        // member to pt-BR. Discarding it cost the one message written for this
        // button — a delete refused by a legal hold read as a generic failure.
        // A value outside the union still cannot reach the UI: the mapper falls
        // back rather than rendering an unknown string.
        setError(documentErrorMessage(result.error));
      } catch {
        setError(DOCUMENT_ERROR_FALLBACK);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Remover ${title}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover este documento?</AlertDialogTitle>
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
            onClick={(event) => {
              // Radix closes on click; a refusal must keep the dialog open so
              // its message can be read. `handleConfirm` closes on success.
              event.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? "Removendo…" : "Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
