"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Unlock, PauseCircle, ShieldAlert } from "lucide-react";

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
 *
 * ⚠ AFF W3/T3.3 (ADR 0097 D14): deactivate / reactivate / suspend are
 * `org_admin`-ONLY. `app.is_active` is folded into every membership predicate, so
 * deactivation is a PLATFORM-WIDE kill switch — one hospital's offboarding would end
 * the person's access at every other hospital and committee they hold. A hospital
 * admin's offboarding is `end_affiliation` (the affiliations panel), never this.
 * Resending an invite stays available: it is not a kill switch.
 *
 * ⚠ `canManageAccountStatus` IS UX, NOT SECURITY (Architecture Rule 1). All three
 * actions re-derive the caller's authority server-side and refuse with
 * `MESSAGES.orgAdminOnly`; that refusal is rendered here. Hiding the buttons only
 * spares an admin an attempt that was always going to fail.
 */
export function UserLifecycleActions({
  userId,
  status,
  fullName,
  canManageAccountStatus,
}: {
  userId: string;
  status: UserStatus;
  fullName: string;
  /** Whether the caller is an `org_admin` of this person's organisation. UX only. */
  canManageAccountStatus: boolean;
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
      // Close the confirm dialog EITHER WAY. The error banner lives in the PAGE, and
      // Radix marks everything outside an open modal `aria-hidden` — so closing only
      // on success rendered a failure (e.g. the D14 `orgAdminOnly` refusal) dimmed
      // behind the overlay and unreadable to assistive tech, which looks to the admin
      // like a button that does nothing. Same defect class as the affiliation
      // end-refusal; found by sweeping for branches no test reaches.
      setOpenDialog(null);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível concluir a ação.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      <div className="flex flex-wrap gap-2">
        {canManageAccountStatus ? (
          <>
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
          </>
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

      {!canManageAccountStatus ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Desativar ou suspender uma conta encerra o acesso da pessoa em toda a
          plataforma, inclusive em outros hospitais, e por isso é feito por um
          administrador da organização. Para desligá-la deste hospital, encerre o
          vínculo hospitalar.
        </p>
      ) : null}

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
