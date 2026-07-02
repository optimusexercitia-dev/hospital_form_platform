import type { Metadata } from "next";

import { PasswordSetForm } from "@/components/auth/password-set-form";

export const metadata: Metadata = {
  title: "Ativar conta",
};

/**
 * Invite acceptance. An invited user follows the invite link, which (via
 * `/auth/confirm`) verifies the invite OTP and establishes a session — this is
 * the e-mail verification step. Here they set a password to activate the
 * account. Same `updatePassword` action as the recovery flow — only the copy
 * differs. Copy reflects both halves of the flow (verify e-mail + define
 * password) so a newly registered user (status `pending` until this
 * completes) understands what just happened and what's left — User
 * Registration & Identity Management, FE-4.
 */
export default function InvitePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Ativar sua conta</h1>
        <p className="text-muted-foreground text-pretty">
          Seu e-mail já foi verificado ao abrir este link. Para concluir a
          ativação e acessar a plataforma das comissões hospitalares, defina
          uma senha abaixo.
        </p>
      </header>
      <PasswordSetForm submitLabel="Ativar conta" />
    </div>
  );
}
