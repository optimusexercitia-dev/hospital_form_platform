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
import { DOCUMENT_ERROR_FALLBACK } from "./document-labels";

/**
 * Soft-delete a Wave-A document (DM2·S3).
 *
 * Takes the document id as a STRING and calls the action itself, rather than
 * receiving a bound thunk from the Server Component parent. Passing a server
 * function across the RSC → Client boundary is a recorded crash class in this
 * repo (BUG-QI-001, which has recurred); `.bind()` is serializable but a plain
 * string needs no such reasoning to be correct.
 *
 * Failure renders inline in pt-BR. `error` from the action is not rendered
 * verbatim unless it is a known user-safe string — see the note in the handler.
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
        // ⚠ The contract types `error` as an open `string` and has not yet
        // guaranteed it is user-facing pt-BR (routed to the lead as contract
        // finding 4). Until it does, an unrecognised value is replaced rather
        // than rendered — a raw Postgres message must never reach the UI.
        setError(DOCUMENT_ERROR_FALLBACK);
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
          <AlertDialogAction disabled={isPending} onClick={handleConfirm}>
            {isPending ? "Removendo…" : "Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
