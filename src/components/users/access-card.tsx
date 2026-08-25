"use client";

import { useState, useTransition } from "react";

import { sendPasswordResetForUser } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CardTextButton,
  DefinitionRow,
  RailCard,
} from "@/components/users/profile-cards";

/**
 * The profile rail's "Acesso" card (redesign 2a rail).
 *
 * Facts about the ACCOUNT rather than the person: when it was created, whether the
 * invitation was ever accepted, and the one recovery action an admin can take on
 * someone else's behalf.
 *
 * ⚠ NO "Último acesso" ROW. The design asks for one; nothing in the schema records a
 * last sign-in that this surface can read (`auth.users.last_sign_in_at` is not exposed).
 * An omitted row is honest; a row reading "—" invites an admin to conclude the person
 * has never signed in, which would be a claim the data does not support.
 *
 * ⚠ THE RESET IS A REQUEST, NOT A CHANGE. `sendPasswordResetForUser` sends a recovery
 * e-mail; it never sets a password and the admin never sees one. The confirm copy says
 * so, because "redefinir senha" reads to most people like the admin is choosing the new
 * one — and an admin who believes that will tell the user a password over the phone.
 *
 * ⚠ Architecture Rule 1: the action re-derives the caller's authority server-side and
 * refuses in pt-BR. This card renders the affordance, never the permission.
 */
export function AccessCard({
  userId,
  personName,
  email,
  createdAt,
  /** `null` = the invitation has not been accepted yet. */
  emailConfirmedAt,
}: {
  userId: string;
  personName: string;
  email: string | null;
  createdAt: string;
  emailConfirmedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [outcome, setOutcome] = useState<
    { ok: boolean; message: string } | null
  >(null);

  function send() {
    setOutcome(null);
    startTransition(async () => {
      const result = await sendPasswordResetForUser(userId);
      // Close the confirm EITHER WAY. The outcome renders in this CARD, and everything
      // outside an open modal is `aria-hidden` — a message left behind the overlay is
      // unreadable to assistive tech and looks like a button that did nothing.
      setConfirmOpen(false);
      setOutcome({
        ok: result.ok,
        message: result.ok
          ? "E-mail de redefinição enviado."
          : (result.error ?? "Não foi possível enviar o e-mail."),
      });
    });
  }

  return (
    <RailCard titleId="acesso-heading" title="Acesso" riseDelay="180ms">
      {/* ⛔ PERMANENTLY MOUNTED, EMPTY UNTIL THERE IS SOMETHING TO SAY — a live region
          that mounts together with its text is announced unreliably. */}
      <p
        role="status"
        aria-live="polite"
        className={
          outcome
            ? outcome.ok
              ? "rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[0.72rem] font-medium text-success"
              : "rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-[0.72rem] font-medium text-destructive"
            : "sr-only"
        }
      >
        {outcome?.message ?? ""}
      </p>

      <dl className="flex flex-col gap-2.5 text-[0.78rem]">
        <DefinitionRow label="Conta criada">
          {formatIsoDatePtBr(createdAt)}
        </DefinitionRow>
        <DefinitionRow label="Convite">
          {emailConfirmedAt ? (
            <span className="font-semibold text-success">Aceito</span>
          ) : (
            <span className="text-muted-foreground">Pendente</span>
          )}
        </DefinitionRow>
      </dl>

      <div className="border-t border-border pt-2.5">
        <CardTextButton
          onClick={() => setConfirmOpen(true)}
          disabled={isPending || !email}
          aria-label={`Enviar redefinição de senha para ${personName}`}
        >
          {isPending ? "Enviando…" : "Enviar redefinição de senha"}
        </CardTextButton>
        {!email ? (
          <p className="mt-1.5 text-[0.7rem] text-muted-foreground text-pretty">
            Esta conta não tem e-mail cadastrado, então não há para onde enviar o
            link.
          </p>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Enviar redefinição de senha para {personName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Um link de redefinição vai para {email}. A senha atual continua
              valendo até que a própria pessoa escolha uma nova — você não define
              nem vê a senha dela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button type="button" disabled={isPending} onClick={send}>
              {isPending ? "Enviando…" : "Enviar link"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RailCard>
  );
}

/**
 * `created_at` is a TIMESTAMP, so parsing it as an instant is correct — unlike the DATE
 * columns elsewhere on this page, which shift a day west of UTC when read that way.
 */
function formatIsoDatePtBr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}
