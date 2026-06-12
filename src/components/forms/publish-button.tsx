"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { publishVersion } from "@/lib/forms/actions";
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
 * Publish flow (F6): confirms, then calls {@link publishVersion} (which runs the
 * `publish_form_version` RPC — condition validation + archive-previous + flip to
 * published). A validation failure (e.g. a forward/first-section condition
 * reference) comes back as a pt-BR message that we keep ON SCREEN inside the open
 * dialog; on success we close and refresh so the page re-renders the now-published
 * version read-only.
 *
 * The confirm control is a plain Button (not `AlertDialogAction`) so the dialog
 * does NOT auto-close on click — it stays open to show a validation error.
 */
export function PublishButton({ versionId }: { versionId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await publishVersion(versionId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível publicar o formulário.");
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
        <Button type="button" size="lg">
          <Send aria-hidden="true" />
          Publicar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publicar este formulário?</AlertDialogTitle>
          <AlertDialogDescription>
            Ao publicar, esta versão fica disponível para preenchimento e não
            poderá mais ser editada. Uma versão publicada anterior será
            arquivada. Para alterar depois, crie um novo rascunho a partir da
            versão publicada.
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
            {isPending ? "Publicando…" : "Publicar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
