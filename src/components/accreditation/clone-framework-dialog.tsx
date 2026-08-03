"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { cloneFramework, type CloneFrameworkState } from "@/lib/accreditation/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * Clone a GLOBAL framework skeleton into a commission-owned, fully editable
 * copy (`clone_framework`; ADR 0093 D2/D9). staff_admin-only — the trigger is
 * shown to the caller only when `canManage` (checked by the parent list). On
 * success, routes straight to the new (clone) framework's standards tree.
 */
export function CloneFrameworkDialogTrigger({
  frameworkId,
  frameworkName,
  commissionId,
  frameworkHref,
}: {
  frameworkId: string;
  frameworkName: string;
  commissionId: string;
  frameworkHref: (frameworkId: string) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Clonar para editar
      </Button>
      {open && (
        <CloneFrameworkDialog
          open={open}
          onOpenChange={setOpen}
          frameworkId={frameworkId}
          frameworkName={frameworkName}
          commissionId={commissionId}
          frameworkHref={frameworkHref}
        />
      )}
    </>
  );
}

function CloneFrameworkDialog({
  open,
  onOpenChange,
  frameworkId,
  frameworkName,
  commissionId,
  frameworkHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frameworkId: string;
  frameworkName: string;
  commissionId: string;
  frameworkHref: (frameworkId: string) => string;
}) {
  const [state, formAction, isPending] = useActionState<CloneFrameworkState | undefined, FormData>(
    cloneFramework,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.frameworkId) {
      onOpenChange(false);
      router.push(frameworkHref(state.frameworkId));
      router.refresh();
    }
  }, [state, onOpenChange, router, frameworkHref]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clonar &ldquo;{frameworkName}&rdquo;</DialogTitle>
          <DialogDescription>
            Cria uma cópia editável deste framework para a sua comissão. Use a cópia
            para colar o texto completo dos padrões, sob a licença do manual da sua
            instituição — o pacote global permanece somente leitura.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="frameworkId" value={frameworkId} />
          <input type="hidden" name="commissionId" value={commissionId} />

          {state && !state.ok && <FormBanner tone="error">{state.error}</FormBanner>}

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Clonando…" : "Clonar framework"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
