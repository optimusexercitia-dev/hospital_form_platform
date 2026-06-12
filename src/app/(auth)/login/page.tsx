import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { FormBanner } from "@/components/auth/form-banner";

export const metadata: Metadata = {
  title: "Entrar",
};

/**
 * Login screen. Reads `redirect` (forwarded to the sign-in action) and `error`
 * (e.g. an expired recovery/invite link bounced here) from the query string.
 * Server Component — only the form is a client island.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { redirect, error } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Entrar</h1>
        <p className="text-muted-foreground">
          Acesse a plataforma das comissões hospitalares.
        </p>
      </header>

      {error === "link_invalido" ? (
        <FormBanner tone="info">
          O link expirou ou já foi utilizado. Faça login ou solicite um novo
          link de redefinição de senha.
        </FormBanner>
      ) : null}

      <LoginForm redirect={redirect} />
    </div>
  );
}
