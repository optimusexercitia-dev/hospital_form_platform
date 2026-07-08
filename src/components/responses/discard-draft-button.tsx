"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

// Backend contract (F9): `discardResponse(responseId) => { ok; error? }`,
// exported from src/lib/responses/actions.ts. Built against the signature; the
// action's own revalidation is relied on plus a router.refresh() on success.
import { discardResponse } from "@/lib/responses/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * "Descartar rascunho" for a STANDALONE published form (F9) — shown only when the
 * viewer has an in_progress draft for the form's published version. Confirms via a
 * destructive AlertDialog, then calls the shared `discardResponse` action and
 * refreshes the list so the card falls back to "Preencher". Case-linked response
 * flows never mount this — standalone forms only.
 */
export function DiscardDraftButton({
  responseId,
}: {
  responseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await discardResponse(responseId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível descartar o rascunho.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
          Descartar rascunho
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar este rascunho?</AlertDialogTitle>
          <AlertDialogDescription>
            As respostas em andamento serão removidas permanentemente e você
            começará um novo preenchimento do zero. Esta ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && <FormBanner tone="error">{error}</FormBanner>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Descartando…" : "Descartar rascunho"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
