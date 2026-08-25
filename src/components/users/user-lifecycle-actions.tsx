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
import { useFieldIds } from "@/components/ui/field";
import { LiveBanner } from "@/components/auth/form-banner";
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
 * Lifecycle controls in the profile's identity band (FE-3; redesign 2a): deactivate,
 * reactivate, suspend (with an until-date), resend invite. Each destructive or
 * state-changing action goes through a confirm step (`AlertDialog`); resend is
 * non-destructive but confirms too, because "reenviar" is easy to hit twice. All driven
 * by `useTransition` (plain typed actions, not `useActionState`-shaped).
 *
 * ⚠ AFF2 (ADR 0133 D3 + Amdt 1 ruling 1): deactivate / reactivate / suspend are gated
 * by the **SUBSET bound**, not by role. A `hospital_admin` holds them over a person
 * whose entire active footprint lies inside the hospitals they administer; a person who
 * ALSO works elsewhere, holds an org- or hospital-tier seat, or has no footprint at all
 * stays `org_admin`-only.
 *
 * ⚠ Why lifecycle kept the TIGHTER bound while person-level fields widened to
 * intersection: `app.is_active` is folded into every membership predicate, so
 * deactivation is a PLATFORM-WIDE kill switch — for a person who spans hospitals it
 * would end their access at hospitals the caller does not administer. That is the same
 * rationale the pre-amendment `org_admin`-only rule rested on; the amendment did not
 * discard it, it scoped it to the people it actually protects. A hospital admin's LOCAL
 * offboarding is still `end_affiliation` (the affiliations panel), never this. Resending
 * an invite stays available: it is not a kill switch.
 *
 * ⚠ `canManageAccountStatus` IS UX, NOT SECURITY (Architecture Rule 1). All three
 * actions re-derive authority server-side via
 * `authorizePersonScopedAdmin(userId, 'lifecycle')` and refuse with
 * `MESSAGES.orgAdminOnly`; that refusal is rendered here. Hiding the buttons only spares
 * an admin an attempt that was always going to fail.
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
  /**
   * Whether the caller holds the ACCOUNT-LIFECYCLE capability over THIS person — the
   * subset bound, resolved server-side by `getPersonAdminView`. UX only.
   *
   * ⛔ Deliberately not "whether the caller is an `org_admin`". That is what this said
   * before ADR 0133 Amdt 1, and it went false the moment a footprint-scoped
   * `hospital_admin` gained the capability — while the prop kept behaving correctly, so
   * nothing could contradict the sentence. A capability flag must describe the
   * CAPABILITY, never the role that happened to be its only holder: the role is an
   * implementation of the answer, and it is the half that changes.
   */
  canManageAccountStatus: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<
    "deactivate" | "reactivate" | "suspend" | "resend" | null
  >(null);
  const [suspendUntil, setSuspendUntil] = useState("");
  // ⛔ GENERATED, never the literal `"suspend-until"` it used to be. A hardcoded DOM id
  // is unique only while exactly one instance renders, and `htmlFor` resolves to
  // whichever element comes FIRST in document order — so the second instance silently
  // steals the first one's label (BUG-A11Y-001, which is why `useFieldIds` exists).
  // "Only one renders today" is a fact about the page, not a property of this component,
  // and it is the half that changes.
  const suspendUntilField = useFieldIds("suspendUntil");

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
    <div className="flex w-full flex-col gap-3 lg:w-auto">
      {/* PERMANENTLY MOUNTED — see `LiveBanner`. This banner is the ONLY report of a
          refused lifecycle action, because the confirm dialog closes on either
          outcome; a region that mounted with its own text would leave the refusal
          painted and unspoken. */}
      <LiveBanner tone="error">{error}</LiveBanner>

      <div className="flex flex-wrap gap-2">
        {status === "pending" ? (
          <ActionButton
            onClick={() => setOpenDialog("resend")}
            disabled={isPending}
          >
            <Mail aria-hidden="true" />
            Reenviar convite
          </ActionButton>
        ) : null}

        {canManageAccountStatus ? (
          <>
            {status !== "deactivated" ? (
              <ActionButton
                onClick={() => setOpenDialog("suspend")}
                disabled={isPending}
              >
                <PauseCircle aria-hidden="true" />
                Suspender
              </ActionButton>
            ) : null}

            {status === "deactivated" ? (
              <ActionButton
                onClick={() => setOpenDialog("reactivate")}
                disabled={isPending}
              >
                <Unlock aria-hidden="true" />
                Reativar
              </ActionButton>
            ) : (
              <ActionButton
                tone="destructive"
                onClick={() => setOpenDialog("deactivate")}
                disabled={isPending}
              >
                <Lock aria-hidden="true" />
                Desativar
              </ActionButton>
            )}
          </>
        ) : null}
      </div>

      {!canManageAccountStatus ? (
        /* ⛔ THE EXPLANATION REPLACES THE BUTTONS, it does not vanish with them. An
           admin who simply finds no controls concludes the feature is broken; one who
           reads this knows the action exists, why it is not theirs, and which action IS
           theirs. Never hide data — only actions. */
        <p className="flex max-w-sm items-start gap-2 text-xs text-muted-foreground text-pretty">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
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
              A pessoa perderá o acesso à plataforma na próxima requisição, em
              todos os hospitais. Esta ação pode ser desfeita reativando a conta
              depois.
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
            <Label htmlFor={suspendUntilField.controlProps.id}>
              Suspenso até (opcional)
            </Label>
            <DatePicker
              id={suspendUntilField.controlProps.id}
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

/**
 * The identity band's compact action button (redesign 2a): a bordered card-coloured
 * chip, `Desativar` tinted destructive.
 *
 * ⚠ THE ICON IS `aria-hidden` VIA `Button`'s own SVG handling and the label is real
 * text, so the accessible name is exactly the visible word — "Desativar", "Suspender",
 * "Reativar", "Reenviar convite". Those names are load-bearing: the tier suite addresses
 * them with anchored patterns, and more importantly a lifecycle control that announces
 * anything other than what it does is a control an admin can fire by mistake.
 */
function ActionButton({
  tone = "default",
  className,
  ...props
}: React.ComponentProps<typeof Button> & { tone?: "default" | "destructive" }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={`h-9 gap-1.5 bg-card px-3 text-xs font-semibold ${
        tone === "destructive"
          ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
          : ""
      } ${className ?? ""}`}
      {...props}
    />
  );
}
