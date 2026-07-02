"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Unlock, PauseCircle } from "lucide-react";

import type { UserStatus } from "@/lib/users/types";
import {
  deactivateUser,
  reactivateUser,
  suspendUser,
  resendInvite,
} from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { FormBanner } from "@/components/auth/form-banner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Lifecycle controls for the per-user management page (FE-3): deactivate,
 * reactivate, suspend (with an until-date), resend invite. Each destructive
 * or state-changing action goes through a confirm step (`AlertDialog`, like
 * `ConfirmRemoveButton`); resend is non-destructive so it confirms inline via
 * its own lightweight dialog rather than firing immediately. All driven by
 * `useTransition` (plain typed actions, not `useActionState`-shaped).
 */
export function UserLifecycleActions({
  userId,
  status,
  fullName,
}: {
  userId: string;
  status: UserStatus;
  fullName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<
    "deactivate" | "reactivate" | "suspend" | "resend" | null
  >(null);
  const [suspendUntil, setSuspendUntil] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Não foi possível concluir a ação.");
        return;
      }
      setOpenDialog(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      <div className="flex flex-wrap gap-2">
        {status === "deactivated" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenDialog("reactivate")}
            disabled={isPending}
          >
            <Unlock aria-hidden="true" />
            Reativar
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setOpenDialog("deactivate")}
            disabled={isPending}
          >
            <Lock aria-hidden="true" />
            Desativar
          </Button>
        )}

        {status !== "deactivated" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenDialog("suspend")}
            disabled={isPending}
          >
            <PauseCircle aria-hidden="true" />
            Suspender
          </Button>
        ) : null}

        {status === "pending" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenDialog("resend")}
            disabled={isPending}
          >
            <Mail aria-hidden="true" />
            Reenviar convite
          </Button>
        ) : null}
      </div>

      {/* Deactivate */}
      <AlertDialog
        open={openDialog === "deactivate"}
        onOpenChange={(o) => setOpenDialog(o ? "deactivate" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa perderá o acesso à plataforma na próxima requisição.
              Esta ação pode ser desfeita reativando a conta depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => run(() => deactivateUser(userId))}
            >
              {isPending ? "Desativando…" : "Desativar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate */}
      <AlertDialog
        open={openDialog === "reactivate"}
        onOpenChange={(o) => setOpenDialog(o ? "reactivate" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar {fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa volta a ter acesso à plataforma, e qualquer suspensão
              residual é removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => run(() => reactivateUser(userId))}
            >
              {isPending ? "Reativando…" : "Reativar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend (with until-date) */}
      <AlertDialog
        open={openDialog === "suspend"}
        onOpenChange={(o) => setOpenDialog(o ? "suspend" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender {fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa perde o acesso até a data escolhida, quando a conta é
              reativada automaticamente. Deixe em branco para uma suspensão
              indefinida (até reativação manual).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="suspend-until">Suspenso até (opcional)</Label>
            <DatePicker
              id="suspend-until"
              value={suspendUntil}
              onChange={setSuspendUntil}
              clearable
              placeholder="Selecionar data"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  suspendUser(
                    userId,
                    suspendUntil ? `${suspendUntil}T00:00:00.000Z` : null,
                  ),
                )
              }
            >
              {isPending ? "Suspendendo…" : "Confirmar suspensão"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resend invite */}
      <AlertDialog
        open={openDialog === "resend"}
        onOpenChange={(o) => setOpenDialog(o ? "resend" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar convite?</AlertDialogTitle>
            <AlertDialogDescription>
              Um novo e-mail de ativação será enviado para {fullName}. Útil
              quando o link anterior expirou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => run(() => resendInvite(userId))}
            >
              {isPending ? "Enviando…" : "Reenviar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
