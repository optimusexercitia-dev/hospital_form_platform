import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Conta inativa",
};

/**
 * Inactive-account landing page (FE-5). A top-level PUBLIC route
 * (`/conta-inativa`) that backend's `requireUser` redirects to when a signed-in
 * user is not active — deactivated (master switch off) or currently suspended
 * (`deriveUserStatus`). The middleware allowlists this path, so it deliberately
 * does NOT gate or read the session itself: routing here is backend's job, and
 * reading the session would defeat the purpose (the session is exactly the one
 * being denied). Purely informational + a sign-out control to clear the stale
 * session.
 *
 * Server Component — `signOut` is a plain server action wired directly to a
 * `<form action>`, so no client JS is needed and the whole flow stays
 * keyboard-operable with a visible focus ring.
 */
export default function ContaInativaPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground"
      >
        <ShieldAlert className="size-7" />
      </div>

      <div className="animate-rise-in flex flex-col gap-3">
        <h1 className="text-3xl text-balance">Conta inativa</h1>
        <p className="text-muted-foreground text-pretty">
          Sua conta está temporariamente sem acesso à plataforma — ela pode
          estar suspensa ou desativada.
        </p>
        <p className="text-muted-foreground text-pretty">
          Para reativar o acesso, entre em contato com o administrador da sua
          organização.
        </p>
      </div>

      <form action={signOut}>
        <Button type="submit" size="lg" variant="outline">
          Sair
        </Button>
      </form>
    </main>
  );
}
