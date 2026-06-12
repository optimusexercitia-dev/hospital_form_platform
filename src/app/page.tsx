import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Temporary root placeholder (F0). The real role-aware landing — calling
 * `getSessionContext()` and redirecting admin → /admin, single-membership →
 * /c/[slug], multi → /c, none → no-access — lands in F5 once backend's
 * session query is published. Kept minimal and pt-BR so no create-next-app
 * boilerplate is ever shown to users.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Comissões Hospitalares
      </p>
      <h1 className="max-w-2xl text-4xl leading-tight text-balance sm:text-5xl">
        Formulários das comissões, agora digitais.
      </h1>
      <p className="max-w-md text-lg text-muted-foreground text-pretty">
        Substitua os checklists em papel por formulários inteligentes e gere
        estatísticas automaticamente.
      </p>
      <Button asChild size="lg">
        <Link href="/login">Entrar na plataforma</Link>
      </Button>
    </main>
  );
}
