"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { discardTemplateDraft } from "@/lib/process-templates/actions";
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
 * Discard an open DRAFT version (ADR 0096), deleting it and its children.
 *
 * The copy leads with the reassurance rather than the warning, because the fear
 * this button triggers is the wrong one: an author looking at "Descartar rascunho"
 * next to a live process reasonably worries they are about to take the process
 * down. They are not — discarding NEVER unpublishes anything, and the published
 * version stays exactly as it is. What is actually lost is only the edits made
 * since the draft was opened, so that is what the dialog warns about.
 *
 * Only ever offered for a `draft`: published and archived versions are immutable
 * and undeletable, the latter additionally protected by `cases.template_version_id`
 * `ON DELETE RESTRICT`.
 *
 * On success we navigate to the version that remains in force (or, for a template
 * that never published, back to the bare template screen, which resolves to the
 * newest version).
 */
export function DiscardTemplateDraftButton({
  templateVersionId,
  versionNumber,
  templatePath,
  publishedVersionId,
  publishedVersionNumber,
}: {
  templateVersionId: string;
  /** The draft being discarded, named in the copy. */
  versionNumber: number;
  /** Absolute path of the template screen (built with `commissionHref`). */
  templatePath: string;
  /** Where to land afterwards; `null` when the template has never published. */
  publishedVersionId: string | null;
  publishedVersionNumber: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await discardTemplateDraft(templateVersionId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível descartar o rascunho.");
        return;
      }
      setOpen(false);
      router.push(
        publishedVersionId
          ? `${templatePath}?v=${publishedVersionId}`
          : templatePath,
      );
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
          <Trash2 aria-hidden="true" />
          Descartar rascunho
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Descartar o rascunho da versão {versionNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {publishedVersionNumber != null ? (
              <>
                A versão {publishedVersionNumber} continua publicada e em vigor —
                descartar um rascunho nunca tira um processo do ar. O que se perde
                são as alterações feitas neste rascunho, que não podem ser
                recuperadas.
              </>
            ) : (
              <>
                As alterações feitas neste rascunho serão apagadas e não podem ser
                recuperadas. Como este processo ainda não tem nenhuma versão
                publicada, ele seguirá sem permitir a abertura de casos.
              </>
            )}
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
