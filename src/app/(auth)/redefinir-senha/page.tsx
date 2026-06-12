import type { Metadata } from "next";

import { PasswordSetForm } from "@/components/auth/password-set-form";

export const metadata: Metadata = {
  title: "Redefinir senha",
};

/**
 * Set a new password after following a recovery link. Reached after
 * `/auth/confirm` verified the recovery OTP and established a session; the
 * `updatePassword` action requires that session and redirects to `/` on
 * success. If someone lands here without a valid recovery session, the action
 * returns a generic pt-BR error (it never crashes).
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Redefinir senha</h1>
        <p className="text-muted-foreground text-pretty">
          Escolha uma nova senha para a sua conta.
        </p>
      </header>
      <PasswordSetForm submitLabel="Redefinir senha" />
    </div>
  );
}
