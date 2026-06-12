import type { Metadata } from "next";

import { getCommissionAccess } from "@/lib/queries/session";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Visão geral",
};

/**
 * Commission overview (placeholder for Phase 2). Welcomes the user to their
 * commission area; the real widgets (form list, pending sign-offs, dashboard
 * snapshots) arrive in Phases 4–7. Access is already gated by the layout, but
 * we re-read here for the role-aware greeting (RLS-scoped, cheap).
 */
export default async function CommissionHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  // The layout already guarantees access; this is defensive (never expected).
  const commissionName = access?.commission.name ?? "";
  const firstName = access?.context.fullName?.trim().split(/\s+/)[0] ?? null;
  const isCoordinator = access?.role === "staff_admin";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {commissionName}
        </p>
        <h1 className="text-3xl text-balance">
          {firstName ? `Olá, ${firstName}.` : "Olá."}
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          {isCoordinator
            ? "Este é o painel da sua comissão. Em breve você poderá construir formulários, acompanhar respostas e visualizar estatísticas por aqui."
            : "Esta é a área da sua comissão. Em breve você poderá preencher os formulários publicados e acompanhar as suas respostas por aqui."}
        </p>
      </header>

      {/* Placeholder cards for the areas that land in later phases. */}
      <section
        aria-label="Próximas funcionalidades"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {PLACEHOLDER_CARDS.filter(
          (c) => !c.coordinatorOnly || isCoordinator,
        ).map((card) => (
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

const PLACEHOLDER_CARDS = [
  {
    title: "Formulários",
    description: "Preencha os checklists e formulários publicados da comissão.",
    coordinatorOnly: false,
  },
  {
    title: "Minhas respostas",
    description: "Acompanhe o que você já enviou e o que está em andamento.",
    coordinatorOnly: false,
  },
  {
    title: "Construtor de formulários",
    description: "Crie e publique novas versões de formulários da comissão.",
    coordinatorOnly: true,
  },
  {
    title: "Painel de estatísticas",
    description: "Visualize gráficos e exporte as respostas enviadas.",
    coordinatorOnly: true,
  },
] as const;
