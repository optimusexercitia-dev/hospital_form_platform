import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";

/**
 * Root role-landing. Server Component — resolves where the signed-in user
 * belongs and redirects there. Middleware already bounces the unauthenticated
 * to /login, but we re-check defensively.
 *
 * Precedence (confirmed with backend): admin first, then memberships.
 *  - admin                     → /admin
 *  - exactly one membership    → /c/<slug>
 *  - more than one membership  → /c  (picker)
 *  - none and not admin        → friendly "sem acesso" screen (below)
 */
export default async function Home() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  if (context.isAdmin) {
    redirect("/admin");
  }

  if (context.memberships.length === 1) {
    redirect(`/c/${context.memberships[0].commission.slug}`);
  }

  if (context.memberships.length > 1) {
    redirect("/c");
  }

  // No commissions and not an admin — nothing to route to. Show a calm,
  // actionable pt-BR message rather than a dead redirect loop.
  return <NoAccess email={context.email} />;
}

function NoAccess({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
        Comissões Hospitalares
      </p>
      <h1 className="text-3xl text-balance">Você ainda não tem acesso</h1>
      <p className="text-muted-foreground text-pretty">
        Sua conta ({email}) ainda não está vinculada a nenhuma comissão. Fale
        com o administrador da sua instituição para receber acesso.
      </p>
      {/* Escape hatch so the user isn't stuck — go to login to switch accounts. */}
      <a
        href="/login"
        className="rounded-lg px-4 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        Entrar com outra conta
      </a>
    </main>
  );
}
