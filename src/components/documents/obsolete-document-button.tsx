"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

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

type ObsoleteAction = (documentId: string) => Promise<{
  ok: boolean;
  error?: string;
}>;

/**
 * Mark-obsolete flow (Phase 17, F3). Retires the document's current version
 * without a replacement → `obsoleto` (the version is retained + downloadable).
 * Confirms, then calls `markDocumentObsolete(documentId)` (passed in as a prop —
 * it takes a plain id, not FormData). A failure stays on screen inside the open
 * dialog; on success we close + refresh.
 */
export function ObsoleteDocumentButton({
  documentId,
  action,
}: {
  documentId: string;
  action: ObsoleteAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await action(documentId);
      if (!result.ok) {
        setError(
          result.error ?? "Não foi possível tornar o documento obsoleto.",
        );
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
        <Button type="button" variant="outline" size="lg">
          <Archive aria-hidden="true" className="size-4" />
          Tornar obsoleto
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tornar o documento obsoleto?</AlertDialogTitle>
          <AlertDialogDescription>
            A versão vigente deixa de valer e o documento passa a obsoleto. O
            arquivo continua disponível para consulta. Esta ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Processando…" : "Tornar obsoleto"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
