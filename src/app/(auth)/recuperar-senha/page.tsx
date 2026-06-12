import type { Metadata } from "next";

import { ResetRequestForm } from "@/components/auth/reset-request-form";

export const metadata: Metadata = {
  title: "Recuperar senha",
};

/**
 * Password-reset request. The user enters their e-mail; the action sends a
 * recovery link (and always reports neutral success). The link lands on
 * `/auth/confirm` (backend), which verifies the OTP and forwards to
 * `/redefinir-senha`.
 */
export default function RecoverPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Recuperar senha</h1>
        <p className="text-muted-foreground text-pretty">
          Informe o seu e-mail e enviaremos as instruções para redefinir a sua
          senha.
        </p>
      </header>
      <ResetRequestForm />
    </div>
  );
}
