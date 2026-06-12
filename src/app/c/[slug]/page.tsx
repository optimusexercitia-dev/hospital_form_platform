import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

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

      {/* Area cards. Shipped areas link through; the rest are present-but-
          inactive with an "em breve" tag (no dead links). */}
      <section
        aria-label="Áreas da comissão"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {CARDS.filter((c) => !c.coordinatorOnly || isCoordinator).map(
          (card, index) => {
            const href = card.path ? `/c/${slug}${card.path}` : null;

            // Live (shipped) card — a real link with hover/focus affordance.
            if (href) {
              return (
                <Link
                  key={card.title}
                  href={href}
                  style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
                  className="animate-rise-in group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold">{card.title}</h2>
                    <ArrowUpRight
                      className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {card.description}
                  </p>
                </Link>
              );
            }

            // Upcoming area — present but inactive.
            return (
              <article
                key={card.title}
                style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
                className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{card.title}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                    em breve
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {card.description}
                </p>
                <Skeleton className="mt-1 h-2 w-2/3" />
              </article>
            );
          },
        )}
      </section>
    </div>
  );
}

interface AreaCard {
  title: string;
  description: string;
  coordinatorOnly: boolean;
  /** Relative path under /c/[slug] for shipped areas; null = "em breve". */
  path: string | null;
}

const CARDS: AreaCard[] = [
  {
    title: "Formulários",
    description: "Preencha os checklists e formulários publicados da comissão.",
    coordinatorOnly: false,
    path: null,
  },
  {
    title: "Minhas respostas",
    description: "Acompanhe o que você já enviou e o que está em andamento.",
    coordinatorOnly: false,
    path: null,
  },
  {
    title: "Gerenciar membros",
    description: "Convide pessoas e gerencie quem tem acesso à comissão.",
    coordinatorOnly: true,
    path: "/manage/members",
  },
  {
    title: "Construtor de formulários",
    description: "Crie e publique novas versões de formulários da comissão.",
    coordinatorOnly: true,
    path: "/manage/forms",
  },
  {
    title: "Painel de estatísticas",
    description: "Visualize gráficos e exporte as respostas enviadas.",
    coordinatorOnly: true,
    path: null,
  },
];
