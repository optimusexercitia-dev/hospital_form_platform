import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { getCommissionOverview } from "@/lib/queries/dashboard";
import { CommissionOverview } from "@/components/dashboard/commission-overview";

export const metadata: Metadata = {
  title: "Painel global",
};

/**
 * Admin cross-commission overview (F6): submission volume across every
 * commission. Admin access is enforced by `admin/layout.tsx` (server-side
 * `notFound()` for non-admins); the backing read (`getCommissionOverview`, B5)
 * is admin-only and RLS scopes the data regardless.
 */
export default async function AdminOverviewPage() {
  const rows = await getCommissionOverview();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração global
        </p>
        <h1 className="text-3xl text-balance">Painel</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Visão geral do volume de respostas enviadas em todas as comissões.
          Abra uma comissão para ver suas estatísticas detalhadas.
        </p>
      </header>

      {rows.length === 0 ? (
        <section
          aria-label="Sem comissões"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BarChart3 aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhuma comissão ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Crie comissões e publique formulários para acompanhar o volume de
            respostas aqui.
          </p>
        </section>
      ) : (
        <CommissionOverview rows={rows} />
      )}
    </div>
  );
}
