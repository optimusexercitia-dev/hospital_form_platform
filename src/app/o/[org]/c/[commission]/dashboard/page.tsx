import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  listDashboardForms,
  getFormDashboard,
} from "@/lib/queries/dashboard";
import { getCaseTagReport } from "@/lib/queries/case-tags";
import { DashboardForms } from "@/components/dashboard/dashboard-forms";
import { TagReportCard } from "@/components/dashboard/tag-report-card";
import { formatDueDate } from "@/components/cases/format";

export const metadata: Metadata = {
  title: "Painel",
};

/**
 * Per-commission dashboard (coordinator area, F1–F3). Charts the answer
 * distributions of one form's SUBMITTED responses, grouped by section, with a
 * date-range filter and CSV export.
 *
 * Access is gated HERE on the server in addition to RLS: only a `staff_admin` of
 * this commission OR a global admin may reach it — mirroring the cases board /
 * builder. Everyone else (staff of this commission, members of another
 * commission, unknown slug) gets `notFound()` (the friendly in-shell 404). The
 * backing dashboard reads are SECURITY DEFINER + `is_staff_admin_of`-gated, so
 * RLS remains the ultimate boundary.
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
  const { org, commission } = await params;
  const slug = commission;
  const { form: formParam, from, to } = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const range =
    from || to ? { from: from || undefined, to: to || undefined } : undefined;

  // Pass the active date window so the form-picker tab badges reflect the same
  // ?from/?to filter as the body headline (no all-time/filtered mismatch). The
  // case tag report (R3) honours the same window (bounded on `cases.created_at`).
  const [forms, tagReport] = await Promise.all([
    listDashboardForms(access.commission.id, range),
    getCaseTagReport(access.commission.id, range),
  ]);

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

      <TagReportCard rows={tagReport} rangeLabel={rangeLabel} />
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
