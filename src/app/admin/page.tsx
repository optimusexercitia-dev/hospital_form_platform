import type { Metadata } from "next";

import { requireUser } from "@/lib/queries/session";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Administração",
};

/**
 * Admin landing (placeholder for Phase 2). The layout already enforces admin
 * access; this page welcomes the admin and sketches the areas that arrive in
 * Phase 3 (commission CRUD, staff_admin assignment) and later.
 */
export default async function AdminHomePage() {
  const context = await requireUser();
  const firstName = context.fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração global
        </p>
        <h1 className="text-3xl text-balance">
          {firstName ? `Olá, ${firstName}.` : "Olá."}
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Daqui você administrará as comissões e suas coordenações. As
          ferramentas de gestão chegam na próxima etapa.
        </p>
      </header>

      <section
        aria-label="Próximas funcionalidades"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {ADMIN_CARDS.map((card) => (
          <article
            key={card.title}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{card.title}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                em breve
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{card.description}</p>
            <Skeleton className="mt-1 h-2 w-2/3" />
          </article>
        ))}
      </section>
    </div>
  );
}

const ADMIN_CARDS = [
  {
    title: "Comissões",
    description: "Crie e edite as comissões hospitalares da instituição.",
  },
  {
    title: "Coordenações",
    description: "Atribua e remova coordenadores (staff_admin) das comissões.",
  },
  {
    title: "Visão geral",
    description: "Acompanhe a atividade das comissões em um só lugar.",
  },
] as const;
