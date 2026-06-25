import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";

import { getNspAccessByOrg } from "@/lib/queries/session";
import { nspHref } from "@/lib/routing";
import { listCommissionsForOrg } from "@/lib/queries/org";
import {
  listAllReferrals,
  listReferralTypes,
  referralsEnabled,
  REFERRAL_STATUS_LABELS,
  type ReferralDashboardFilters,
  type ReferralFlowMetrics,
  type ReferralListItem,
  type ReferralStatus,
} from "@/lib/queries/referrals";
import { ReferralDashboardFilters as FiltersBar } from "@/components/referrals/referral-dashboard-filters";
import { ReferralFlowCharts } from "@/components/referrals/referral-flow-charts";
import { ReferralDashboardTable } from "@/components/referrals/referral-dashboard-table";

export const metadata: Metadata = {
  title: "NSP — encaminhamentos",
};

/**
 * The QPS per-org referrals dashboard (Decision 6/13): the macro, end-to-end
 * view of inter-committee referrals across THIS org's committees — filters, flow
 * metrics + charts, and a drill-down table.
 *
 * Access: the `/o/[org]/nsp` layout gates to a PQS member/coordinator of THIS
 * org + the `case_referrals` flag → 404 when off; the page pins the org. The
 * data layer (`listAllReferrals`/`referralFlowMetrics`) reads `case_referral`
 * via the RLS-scoped cookie client AND gates on `is_pqs_member_self()`, so the
 * rebound per-org `can_read_referral` policy bounds the rows to the caller's
 * org(s) and a non-enrolled coordinator gets `[]` (sees it empty, not a 404).
 * PHI-FREE throughout — patient context never appears on this aggregate; it
 * lives behind the per-referral audited PHI door.
 *
 * Filters are URL-driven (`?status=&source=&target=&type=&response=`); the Server
 * Component re-queries + re-aggregates on each change.
 *
 * Org-scoping (NSP-per-org, ADR 0042 — settled contract, lead 2026-06-25): the
 * data layer stays as-is (no `…ForOrg` variant — RLS bounds the rows to the
 * caller's org(s) and `is_pqs_member_self()` gates the dashboard; verified not a
 * `capa_kpis`-style DEFINER leak). For a MULTI-org PQS member we additionally
 * CLIENT-FILTER the RLS-bounded rows to THIS route's org — keeping only referrals
 * whose source OR target commission belongs to `access.orgId` (resolved via
 * `listCommissionsForOrg`) — and DERIVE the flow-metrics headline from that
 * filtered set (so the counts reflect this org, not the union of the caller's
 * orgs). The filter bar's commission options come from the same org-scoped list.
 */
export default async function NspReferralsDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    status?: string;
    source?: string;
    target?: string;
    type?: string;
    response?: string;
  }>;
}) {
  const { org } = await params;
  const access = await getNspAccessByOrg(org);
  if (!access) {
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

  const [allReferrals, commissions, types] = await Promise.all([
    listAllReferrals(filters),
    listCommissionsForOrg(access.orgId),
    listReferralTypes(),
  ]);

  // Org-scope the RLS-bounded rows to THIS org: keep a referral iff its source OR
  // target commission belongs to the route's org (a multi-org PQS member would
  // otherwise see the union). The metrics headline is derived from this set.
  const orgCommissionIds = new Set(commissions.map((c) => c.id));
  const referrals = allReferrals.filter(
    (r) =>
      orgCommissionIds.has(r.sourceCommissionId) ||
      orgCommissionIds.has(r.targetCommissionId),
  );
  const metrics = deriveFlowMetrics(referrals);

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
          href={nspHref(org)}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Núcleo de Segurança do Paciente
        </Link>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Núcleo de Segurança do Paciente
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

/**
 * Derive the flow-metrics headline from an already-resolved (and org-filtered)
 * referral list — the per-org counterpart of the all-orgs `referralFlowMetrics()`
 * aggregate. The status partitions mirror that function 1:1 (the `resolved` /
 * `inFlight` sets), so the headline stays consistent with the rest of the app; we
 * recompute locally only to scope the counts to THIS org without a second query.
 * PHI-free (status + reply-expected flag only).
 */
function deriveFlowMetrics(referrals: ReferralListItem[]): ReferralFlowMetrics {
  const resolved = new Set<ReferralStatus>([
    "concluida",
    "recusada",
    "retirada",
  ]);
  const inFlight = new Set<ReferralStatus>([
    "enviada",
    "recebida",
    "aceita",
    "em_analise",
  ]);
  return {
    total: referrals.length,
    open: referrals.filter((r) => !resolved.has(r.status)).length,
    awaitingReply: referrals.filter(
      (r) => r.responseExpected && inFlight.has(r.status),
    ).length,
    concluded: referrals.filter((r) => r.status === "concluida").length,
    declined: referrals.filter((r) => r.status === "recusada").length,
    withdrawn: referrals.filter((r) => r.status === "retirada").length,
  };
}
