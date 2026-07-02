import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { PasswordSetForm } from "@/components/auth/password-set-form";

export const metadata: Metadata = {
  title: "Primeiro acesso",
};

/**
 * Forced first-access password change. A user registered through the
 * admin-sets-initial-password path (email verification OFF) is created active
 * with a temporary password chosen by the administrator; backend flags them
 * `must_change_password` and `requireUser()`/`signIn` route them here before
 * they can use the app.
 *
 * CRITICAL: this guard reads the session with `getSessionContext()`, NOT
 * `requireUser()` — `requireUser()` redirects a flagged user back to
 * `/primeiro-acesso`, which from this very page would loop forever. We enforce
 * the same precedence backend uses (inactive > must-change > normal) so a user
 * who no longer needs to be here is sent on:
 *   - no session          → /login
 *   - inactive account    → /conta-inativa
 *   - flag already cleared → / (their real landing resolves there)
 *
 * On success `updatePassword` clears the flag and redirects to `/`, so the
 * next request lands the user normally. Reuses the shared `<PasswordSetForm>`
 * (same action as /convite and /redefinir-senha); only the copy differs.
 */
export default async function PrimeiroAcessoPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }
  if (context.isInactive) {
    redirect("/conta-inativa");
  }
  if (!context.mustChangePassword) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Defina sua senha</h1>
        <p className="text-muted-foreground text-pretty">
          Sua conta foi criada com uma senha temporária definida pelo
          administrador da sua organização. Por segurança, escolha uma senha
          pessoal agora para continuar acessando a plataforma das comissões
          hospitalares.
        </p>
      </header>
      <PasswordSetForm submitLabel="Definir nova senha" />
    </div>
  );
}
