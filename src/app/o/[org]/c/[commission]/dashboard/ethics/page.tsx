import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getFeatureFlags } from "@/lib/queries/feature-flags";
import { getEthicsDashboard } from "@/lib/queries/ethics-dashboard";
import { EthicsDashboardView } from "@/components/ethics/ethics-dashboard-view";

export const metadata: Metadata = {
  title: "Painel ético",
};

/**
 * Per-commission ETHICS dashboard (ETH·E3a; ADR 0064 D4 terminology + ADR 0073
 * procedure surface). Aggregates the commission's ethics cases — counts by
 * admissibility + decision status, the median tramitação cycle time, and the
 * sanction-outcome distribution — mirroring the platform dashboard's Recharts
 * idiom, but as its OWN area (like NSP/PQS), reachable only when the `ethics`
 * feature is on.
 *
 * Gated HERE in addition to RLS (defense in depth), exactly like the main
 * `dashboard/page.tsx`: only a `staff_admin` of this commission (coordinator; an
 * org/hospital admin resolves to that role) may reach it — everyone else gets the
 * friendly in-shell 404. The `ethics` flag off → the surface does not exist.
 *
 * THE confidentiality keystone lives in `getEthicsDashboard`: it is an ordinary
 * RLS-scoped read (never a service-role/DEFINER bypass), so a case the viewer
 * cannot read contributes ZERO to every count here. This page only presents the
 * already-scoped summary. (The query body is a stub until BE-7; the plumbing is
 * wired so it lights up when the read lands.)
 */
export default async function EthicsDashboardPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  // The `ethics` flag is not a typed `FeatureFlags` key (backend gates ethics
  // reads inside their query functions), so read it off the untyped consolidated
  // flag record — request-memoized, safe-defaults to absent → 404.
  const flags = await getFeatureFlags();
  if (flags["ethics"] !== true) {
    notFound();
  }

  const summary = await getEthicsDashboard(access.commission.id);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Painel ético</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Estatísticas dos processos éticos desta comissão — admissibilidade,
          situação das decisões, prazo de tramitação e sanções. Os números
          consideram apenas os processos aos quais você tem acesso.
        </p>
      </header>

      <EthicsDashboardView summary={summary} />
    </div>
  );
}
