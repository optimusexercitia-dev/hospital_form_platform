import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  listDashboardForms,
  getFormDashboard,
} from "@/lib/queries/dashboard";
import { DashboardForms } from "@/components/dashboard/dashboard-forms";
import { TagReportCardAsync } from "@/components/dashboard/tag-report-card-async";
import { IndicatorsPanelAsync } from "@/components/indicators/indicators-panel-async";
import { commissionHref } from "@/lib/routing";
import { formatDueDate } from "@/components/cases/format";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Painel",
};

/**
 * Per-commission dashboard (coordinator area, F1–F3). Charts the answer
 * distributions of one form's SUBMITTED responses, grouped by section, with a
 * date-range filter and CSV export.
 *
 * Access is gated HERE on the server in addition to RLS: only a `staff_admin` of
 * this commission may reach it — mirroring the cases board / builder. Everyone
 * else (staff of this commission, members of another commission, unknown slug)
 * gets `notFound()` (the friendly in-shell 404).
 *
 * ⚠ `access.role === "staff_admin"` is WIDER than it reads: `getCommissionAccessByOrg`
 * maps an `org_admin` of the org (or a `hospital_admin` of the hospital) into the
 * coordinator branch (ADR 0051 Decision 1), so those two reach this page as well.
 * A bare `platform_admin` holding no role here resolves to `null` and is 404'd.
 *
 * The backing dashboard reads are SECURITY DEFINER, gated on
 * `is_staff_admin_of(cid) OR is_tenancy_admin_of(cid)` — the SAME pair, so the
 * route guard and the RPC gate admit the same people. They did not always: five of
 * the nine `dashboard_*` functions used to gate on `is_staff_admin_of OR is_admin()`,
 * which BOTH admitted a bare platform_admin over PostgREST AND returned empty sets
 * to the org/hospital admins this page lets in (BUG-AUTHZ-001, migration
 * 20260903000700 + pgTAP 270). RLS remains the ultimate boundary.
 *
 * The dashboard is per-form: a form picker (`?form=`) selects which form to
 * chart; the date range (`?from=&to=`) scopes `submitted_at`. Both are URL-driven
 * so the Server Component re-queries — no client-side data fetching.
 */
export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string }>;
  searchParams: Promise<{ form?: string; from?: string; to?: string }>;
}) {
  const [{ org, commission }, { form: formParam, from, to }] =
    await Promise.all([params, searchParams]);
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const range =
    from || to ? { from: from || undefined, to: to || undefined } : undefined;

  // Pass the active date window so the form-picker tab badges reflect the same
  // ?from/?to filter as the body headline (no all-time/filtered mismatch). The
  // case tag report (R3) and the Indicadores panel (Phase 15, F6) are secondary
  // blocks streamed independently below (Suspense) so they never block the
  // primary chart's first paint (frontend-audit-2026-07 #2).
  const forms = await listDashboardForms(access.commission.id, range);

  const rangeLabel =
    from && to
      ? `${formatDueDate(from)} a ${formatDueDate(to)}`
      : from
        ? `desde ${formatDueDate(from)}`
        : to
          ? `até ${formatDueDate(to)}`
          : "todo o período";

  // Resolve the selected form: the requested one if it has data, else the first.
  const selectedFormId =
    formParam && forms.some((f) => f.formId === formParam)
      ? formParam
      : (forms[0]?.formId ?? null);

  const dashboard = selectedFormId
    ? await getFormDashboard(selectedFormId, range)
    : null;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Painel</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Estatísticas das respostas enviadas, agrupadas por seção. Os números
          consideram apenas formulários já enviados.
        </p>
      </header>

      {forms.length === 0 ? (
        <EmptyState />
      ) : (
        <DashboardForms
          org={org} slug={slug}
          forms={forms}
          selectedFormId={selectedFormId}
          range={{ from: from ?? null, to: to ?? null }}
          dashboard={dashboard}
        />
      )}

      <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
        <IndicatorsPanelAsync
          commissionId={access.commission.id}
          indicatorsHref={commissionHref(
            org,
            slug,
            "manage",
            "indicadores",
          )}
        />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
        <TagReportCardAsync
          commissionId={access.commission.id}
          range={range}
          rangeLabel={rangeLabel}
        />
      </Suspense>
    </div>
  );
}

function EmptyState() {
  return (
    <section
      aria-label="Sem dados para o painel"
      className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BarChart3 aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Ainda não há respostas enviadas</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Quando os membros enviarem formulários desta comissão, as estatísticas
        aparecerão aqui.
      </p>
    </section>
  );
}
