"use client";

import { commissionHref } from "@/lib/routing";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteDraftVersion } from "@/lib/forms/actions";
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

export function DeleteDraftButton({
  versionId,
  org,
  slug,
  formId,
}: {
  versionId: string;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  formId: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteDraftVersion(versionId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível excluir o rascunho.");
        return;
      }
      setOpen(false);
      if (result.redirectToForms) {
        router.push(commissionHref(org, slug, "manage", "forms"));
      } else {
        router.push(commissionHref(org, slug, "manage", "forms", formId));
      }
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
          <Trash2 aria-hidden="true" />
          Excluir rascunho
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este rascunho?</AlertDialogTitle>
          <AlertDialogDescription>
            O rascunho e todas as suas seções e perguntas serão removidos
            permanentemente. Esta ação não pode ser desfeita.
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
            {isPending ? "Excluindo…" : "Excluir rascunho"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
