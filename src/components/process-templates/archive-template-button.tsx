"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

import { archiveProcessTemplate } from "@/lib/process-templates/actions";
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
 * Archive a process template (`draft`/`active` → `archived`). Confirms, then
 * calls {@link archiveProcessTemplate}. Live cases are unaffected (they snapshot
 * their phases). On success we navigate back to the template list, since an
 * archived template is no longer editable here.
 */
export function ArchiveTemplateButton({ templateId }: { templateId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await archiveProcessTemplate(templateId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível arquivar o processo.");
        return;
      }
      setOpen(false);
      router.push("../process-templates");
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
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar este processo?</AlertDialogTitle>
          <AlertDialogDescription>
            Um processo arquivado não pode ser usado para criar novos casos nem ser
            editado. Os casos já criados a partir dele continuam funcionando
            normalmente.
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
