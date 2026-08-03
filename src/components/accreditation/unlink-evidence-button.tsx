"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { unlinkEvidence } from "@/lib/accreditation/actions";
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
 * Remove one evidence link (`unlink_evidence`). Confirmation dialog rather
 * than a bare click-to-delete — the same discipline as
 * `confirm-remove-button.tsx` elsewhere in the app — since the standard's
 * readiness rollup changes immediately. Does NOT delete the underlying
 * artifact, only the link; the dialog copy says so explicitly.
 */
export function UnlinkEvidenceButton({
  evidenceLinkId,
  label,
}: {
  evidenceLinkId: string;
  /** The evidence item's display label, for the confirmation copy — may be "Evidência restrita". */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await unlinkEvidence(evidenceLinkId);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? null);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Desvincular
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desvincular evidência?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{label}&rdquo; deixará de contar como evidência para este padrão. O item
            original não é apagado — apenas o vínculo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Removendo…" : "Desvincular"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
