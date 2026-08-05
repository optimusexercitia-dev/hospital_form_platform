"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { publishTemplateVersion } from "@/lib/process-templates/actions";
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
 * Publish a DRAFT process-template version (ADR 0096 D2) — the action that closes
 * the loop the {@link BeginTemplateEditButton} opened.
 *
 * The confirm copy names BOTH sides of the swap, because publishing here does two
 * things atomically and an author who only understands one of them will be
 * surprised by the other: this draft becomes the version used for new cases, AND
 * the incumbent published version is archived in the same statement. Cases already
 * running are untouched either way — they snapshot their phases at creation.
 *
 * A validation failure (too few phases, an unresolvable `recommendWhen`, a missing
 * allowed-result subset) comes back as a mapped pt-BR message and is kept ON SCREEN
 * inside the open dialog, so the author can read it without losing the dialog. The
 * RPC remains the authority; `canPublish` only gates the trigger for a clearer
 * empty-state.
 */
export function PublishTemplateVersionButton({
  templateVersionId,
  versionNumber,
  supersededVersionNumber,
  canPublish,
}: {
  templateVersionId: string;
  /** The draft being published, named in the copy. */
  versionNumber: number;
  /**
   * The incumbent published version this publish will ARCHIVE, or `null` when the
   * template has never published (nothing is superseded — it simply goes live).
   */
  supersededVersionNumber: number | null;
  /** ≥1 phase. The RPC re-checks; this is a UI affordance only. */
  canPublish: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await publishTemplateVersion(templateVersionId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível publicar esta versão.");
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
          Publicar versão {versionNumber}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Publicar a versão {versionNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {supersededVersionNumber != null ? (
              <>
                A partir de agora, novos casos passam a ser abertos com a versão{" "}
                {versionNumber}, e a versão {supersededVersionNumber} é arquivada.
                Uma versão publicada não pode mais ser alterada — para mudar algo
                depois, será preciso criar um novo rascunho. Os casos já em
                andamento continuam com as fases definidas quando foram criados.
              </>
            ) : (
              <>
                A partir de agora, este processo passa a permitir a abertura de
                casos, usando a versão {versionNumber}. Uma versão publicada não
                pode mais ser alterada — para mudar algo depois, será preciso criar
                um novo rascunho.
              </>
            )}
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
