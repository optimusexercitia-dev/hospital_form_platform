"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { archiveIndicator } from "@/lib/indicators/actions";

/**
 * Archive an indicator (Phase 15, F1). A destructive-style confirmation over the
 * `archiveIndicator` action; on success routes back to the list. The action is
 * the write authority (staff_admin/commission_admin, RPC-enforced).
 */
export function ArchiveIndicatorButton({
  indicatorId,
  listHref,
}: {
  indicatorId: string;
  listHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirmArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveIndicator(indicatorId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível arquivar o indicador.");
        return;
      }
      setOpen(false);
      router.push(listHref);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="lg" className="w-fit">
            <Archive aria-hidden="true" className="size-4" />
            Arquivar indicador
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar este indicador?</AlertDialogTitle>
            <AlertDialogDescription>
              O indicador deixará de aceitar novas medições. O histórico
              permanece disponível. Esta ação pode ser revertida pela
              coordenação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmArchive();
              }}
              disabled={pending}
            >
              {pending ? "Arquivando…" : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
