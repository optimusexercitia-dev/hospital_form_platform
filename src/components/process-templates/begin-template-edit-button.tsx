"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";

import { beginTemplateEdit } from "@/lib/process-templates/actions";
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
 * The "Editar" entry point for a published process (ADR 0096 D2) — the moment the
 * Rule-5 workflow becomes visible to the author.
 *
 * Two behaviours, deliberately different, because they carry different weight:
 *
 *  - **No open draft** → a confirm dialog first. Pressing "Editar" is about to
 *    FORK the process, and the author needs to understand before it happens that
 *    the published version keeps running until they publish the new draft. This is
 *    the one screen where the D2 cost is explained at the moment of the decision
 *    rather than after it.
 *  - **A draft already exists** → navigate straight there, no dialog. `beginTemplateEdit`
 *    is idempotent (it returns the open draft and clones nothing, the same guarantee
 *    the DB enforces via at-most-one-draft), so there is nothing to confirm and a
 *    dialog would just be a toll booth on "resume what I was doing".
 *
 * Navigation uses an ABSOLUTE `templatePath` supplied by the caller (built with
 * `commissionHref`) rather than a relative push — the version lives in `?v=`, and a
 * relative push would resolve against whichever version URL happened to be current.
 */
export function BeginTemplateEditButton({
  templateId,
  templatePath,
  existingDraftVersionNumber,
  publishedVersionNumber,
}: {
  templateId: string;
  /** Absolute path of the template screen, e.g. `commissionHref(org, slug, …, templateId)`. */
  templatePath: string;
  /**
   * The open draft's version number, or `null` when none exists. Drives BOTH the
   * label and whether the confirm dialog appears — see the component docs.
   */
  existingDraftVersionNumber: number | null;
  /** The version in force, named in the confirm copy. `null` if never published. */
  publishedVersionNumber: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const hasDraft = existingDraftVersionNumber != null;
  const label = hasDraft
    ? `Continuar rascunho (v${existingDraftVersionNumber})`
    : "Editar processo";

  function runEdit() {
    setError(null);
    startTransition(async () => {
      const result = await beginTemplateEdit(templateId);
      if (!result.ok || !result.templateVersionId) {
        setError(
          result.error ?? "Não foi possível abrir o rascunho deste processo.",
        );
        return;
      }
      setOpen(false);
      router.push(`${templatePath}?v=${result.templateVersionId}`);
      router.refresh();
    });
  }

  // Resume path: nothing is created, so go straight there.
  if (hasDraft) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button type="button" size="lg" onClick={runEdit} disabled={isPending}>
          <PencilLine aria-hidden="true" />
          {isPending ? "Abrindo…" : label}
        </Button>
        {error && <FormBanner tone="error">{error}</FormBanner>}
      </div>
    );
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
          <PencilLine aria-hidden="true" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar este processo?</AlertDialogTitle>
          <AlertDialogDescription>
            {publishedVersionNumber != null ? (
              <>
                A versão {publishedVersionNumber} está publicada e não pode ser
                alterada. Vamos criar um rascunho a partir dela para você editar.
                Enquanto esse rascunho não for publicado, novos casos continuam
                sendo abertos com a versão {publishedVersionNumber}, e os casos já
                em andamento não mudam.
              </>
            ) : (
              <>
                Vamos criar um rascunho a partir desta versão para você editar. Os
                casos já em andamento não mudam.
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
            onClick={runEdit}
            disabled={isPending}
          >
            {isPending ? "Criando rascunho…" : "Criar rascunho"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
