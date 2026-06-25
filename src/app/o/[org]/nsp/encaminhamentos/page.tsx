import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";

import { requireUser } from "@/lib/queries/session";
import { listCommissionsForAdmin } from "@/lib/queries/commissions";
import {
  listAllReferrals,
  listReferralTypes,
  referralFlowMetrics,
  referralsEnabled,
  REFERRAL_STATUS_LABELS,
  type ReferralDashboardFilters,
  type ReferralStatus,
} from "@/lib/queries/referrals";
import { ReferralDashboardFilters as FiltersBar } from "@/components/referrals/referral-dashboard-filters";
import { ReferralFlowCharts } from "@/components/referrals/referral-flow-charts";
import { ReferralDashboardTable } from "@/components/referrals/referral-dashboard-table";

export const metadata: Metadata = {
  title: "NSP — encaminhamentos",
};

/**
 * The QPS cross-commission referrals dashboard (Decision 6/13): the macro,
 * end-to-end view of inter-committee referrals across ALL committees — filters,
 * flow metrics + charts, and a drill-down table.
 *
 * Gating: the admin layout enforces `isAdmin`; re-checked here defensively, plus
 * the `case_referrals` flag → 404 when off. The DUTY-SEPARATION boundary is the
 * DATA layer — `listAllReferrals` + `referralFlowMetrics` gate on `is_pqs_member`
 * server-side, so a non-PQS admin reaching this page gets empty data (a tailored
 * "não autorizado" screen is an existing FE-backlog item; RLS is the boundary).
 * PHI-FREE throughout — patient context never appears on this aggregate; it lives
 * behind the per-referral audited PHI door.
 *
 * Filters are URL-driven (`?status=&source=&target=&type=&response=`); the Server
 * Component re-queries + re-aggregates on each change.
 */
export default async function NspReferralsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    source?: string;
    target?: string;
    type?: string;
    response?: string;
  }>;
}) {
  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await referralsEnabled())) {
    notFound();
  }

  const sp = await searchParams;

  const filters: ReferralDashboardFilters = {
    status: (sp.status as ReferralStatus) || undefined,
    sourceCommissionId: sp.source || undefined,
    targetCommissionId: sp.target || undefined,
    referralTypeId: sp.type || undefined,
    responseExpected:
      sp.response === "true" ? true : sp.response === "false" ? false : undefined,
  };

  const [referrals, metrics, commissions, types] = await Promise.all([
    listAllReferrals(filters),
    referralFlowMetrics(),
    listCommissionsForAdmin(),
    listReferralTypes(),
  ]);

  const statusOptions = Object.entries(REFERRAL_STATUS_LABELS) as [
    string,
    string,
  ][];
  const typeOptions = types.map(
    (t) => [t.id, t.label] as [string, string],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/nsp"
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Núcleo de Segurança do Paciente
        </Link>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <ArrowLeftRight aria-hidden="true" className="size-7 text-primary" />
          Encaminhamentos entre comissões
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Visão macro de ponta a ponta dos encaminhamentos entre comissões.
          Acompanhe o volume, o tempo de espera por resposta e o fluxo entre
          comissões. A identificação do paciente não aparece nesta visão — apenas
          dentro de cada encaminhamento, com acesso registrado.
        </p>
      </header>

      <FiltersBar
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        commissions={commissions.map((c) => ({ id: c.id, name: c.name }))}
        status={sp.status ?? null}
        source={sp.source ?? null}
        target={sp.target ?? null}
        type={sp.type ?? null}
        response={sp.response ?? null}
      />

      <ReferralFlowCharts metrics={metrics} referrals={referrals} />

      <section aria-labelledby="referral-dashboard-list-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="referral-dashboard-list-heading" className="text-xl">
            Encaminhamentos
          </h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {referrals.length}{" "}
            {referrals.length === 1 ? "encaminhamento" : "encaminhamentos"}
          </span>
        </div>
        <ReferralDashboardTable referrals={referrals} />
      </section>
    </div>
  );
}
