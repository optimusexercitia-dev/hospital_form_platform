"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { publishProcessTemplate } from "@/lib/process-templates/actions";
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
 * Publish flow for a process template (`draft → active`). Confirms, then calls
 * {@link publishProcessTemplate} (which requires ≥1 phase and validates every
 * `recommend_when`). A validation failure (P0016/P0017) comes back as a pt-BR
 * message kept ON SCREEN inside the open dialog; on success we close and refresh.
 * Mirrors the form {@link PublishButton}.
 *
 * `canPublish` (≥1 phase) gates the trigger up front for a clear empty-state, but
 * the RPC remains the authority.
 */
export function PublishTemplateButton({
  templateId,
  canPublish,
}: {
  templateId: string;
  canPublish: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await publishProcessTemplate(templateId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível publicar o processo.");
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
        <Button type="button" size="lg" disabled={!canPublish}>
          <Send aria-hidden="true" />
          Publicar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publicar este processo?</AlertDialogTitle>
          <AlertDialogDescription>
            Ao publicar, o processo fica disponível para criar casos e não poderá
            mais ser editado. Os casos já criados preservam as fases definidas no
            momento da criação.
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
