import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { getCommissionOverview } from "@/lib/queries/dashboard";
import { CommissionOverview } from "@/components/dashboard/commission-overview";

export const metadata: Metadata = {
  title: "Painel da organização",
};

/**
 * Organization rollup (org_admin): submission volume across the org's
 * commissions. Access is enforced by the `/o/[org]/manage` layout
 * (`is_org_admin_of(org)`); under the Phase B rescoping, `getCommissionOverview`
 * (via the re-scoped `commission_overview()` DEFINER) returns only the caller's
 * org commissions, so no extra filtering is needed here — the DEFINER gate is the
 * authority.
 */
export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const rows = await getCommissionOverview();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração da organização
        </p>
        <h1 className="text-3xl text-balance">Painel</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Visão geral do volume de respostas enviadas nas comissões da sua
          organização. Abra uma comissão para ver suas estatísticas detalhadas.
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
        <CommissionOverview org={org} rows={rows} />
      )}
    </div>
  );
}
