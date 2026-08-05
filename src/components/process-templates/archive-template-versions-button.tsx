"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

import { archiveTemplateVersions } from "@/lib/process-templates/actions";
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
 * Archive the WHOLE process template (ADR 0096): every non-archived version is
 * archived, so the template stops offering case creation entirely.
 *
 * This is the scope that distinguishes it from {@link DiscardTemplateDraftButton},
 * and the distinction is worth stating plainly in the dialog — the two buttons sit
 * near each other and both sound like "stop working on this". Discarding touches
 * only the open draft and leaves the process live; archiving retires the process.
 *
 * Live cases are unaffected either way: they snapshot their phases at creation, and
 * `cases.template_version_id` is `ON DELETE RESTRICT`, so the version they ran under
 * survives archival and keeps answering "which version was this case opened with".
 *
 * On success we return to the template list, since an archived template is no
 * longer editable here.
 */
export function ArchiveTemplateVersionsButton({
  templateId,
  listPath,
}: {
  templateId: string;
  /** Absolute path of the template LIST (built with `commissionHref`). */
  listPath: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await archiveTemplateVersions(templateId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível arquivar o processo.");
        return;
      }
      setOpen(false);
      router.push(listPath);
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
          <Archive aria-hidden="true" />
          Arquivar processo
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar este processo?</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as versões deste processo são arquivadas, incluindo a que está em
            vigor, e não será mais possível abrir casos com ele. Os casos já
            criados continuam funcionando normalmente e mantêm o registro da versão
            sob a qual foram abertos.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && <FormBanner tone="error">{error}</FormBanner>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            size="lg"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Arquivando…" : "Arquivar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
