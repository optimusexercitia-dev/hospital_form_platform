import type { Metadata } from "next";

import { PasswordSetForm } from "@/components/auth/password-set-form";

export const metadata: Metadata = {
  title: "Ativar conta",
};

/**
 * Invite acceptance. An invited user follows the invite link, which (via
 * `/auth/confirm`) verifies the invite OTP and establishes a session; here they
 * set a password to activate the account. Same `updatePassword` action as the
 * recovery flow — only the copy differs.
 */
export default function InvitePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Ativar sua conta</h1>
        <p className="text-muted-foreground text-pretty">
          Defina uma senha para ativar a sua conta e acessar a plataforma das
          comissões hospitalares.
        </p>
      </header>
      <PasswordSetForm submitLabel="Ativar conta" />
    </div>
  );
}
