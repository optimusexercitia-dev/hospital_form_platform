import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getQualidadeAccessByOrg } from "@/lib/queries/session";
import { getQualityBoardSummary } from "@/lib/queries/quality";
import {
  listDashboardForms,
  getFormDashboard,
  type FormDashboard,
} from "@/lib/queries/dashboard";
import { qualidadeHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { QualityDashboardFilters } from "@/components/quality/quality-dashboard-filters";
import { QualityEmptyState } from "@/components/quality/quality-empty-state";

export const metadata: Metadata = {
  title: "Qualidade — painéis",
};

/**
 * AGGREGATE-ONLY compliance dashboards for the quality office (ADR 0100 D11).
 *
 * The reviewer arm reaches exactly the SIX aggregate `dashboard_*` doors
 * (`distributions`, `entity_references`, `form_totals`, `matrix_cells`,
 * `risk_scores`, `submissions_over_time`). The three ROW-LEVEL doors
 * (`export_rows`, `free_text`, `completion_by_member`) stay closed — individual
 * answers and per-person completion are not oversight material.
 *
 * ⚠ THE FE STRIPS THE ROW-LEVEL ARRAYS RATHER THAN TRUSTING THE DENIAL, and that
 * is deliberate. `getFormDashboard` calls all seven aggregations, and the three
 * closed doors deny by returning an EMPTY SET, not by raising — so the UI would
 * render correctly today purely as a side effect of the DB saying nothing. If a
 * later change ever opened `dashboard_free_text` even slightly, free-text
 * answers would silently appear in an oversight console that is contractually
 * forbidden to show them, with no code change here and nothing to review. Zeroing
 * them locally makes the two-class contract a property of this page, not an
 * inference from someone else's gate.
 */
export default async function QualityDashboardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    hospital?: string;
    comissao?: string;
    form?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const [{ org }, sp] = await Promise.all([params, searchParams]);
  const access = await getQualidadeAccessByOrg(org);
  if (!access) {
    notFound();
  }

  const summary = await getQualityBoardSummary(access.orgId);

  const knownHospital = access.hospitals.some(
    (h) => h.hospital.id === sp.hospital,
  );
  const hospitalFilter = knownHospital ? (sp.hospital ?? null) : null;
  const commissions = hospitalFilter
    ? summary.filter((c) => c.hospitalId === hospitalFilter)
    : summary;

  if (commissions.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <Header orgName={access.organization.name} />
        <QualityEmptyState variant="no-commissions" />
      </div>
    );
  }

  // Commission selection (`?comissao=`), resolved against the visible set.
  const selectedCommission =
    commissions.find((c) => c.commissionId === sp.comissao) ?? commissions[0];

  const range =
    sp.from || sp.to
      ? { from: sp.from || undefined, to: sp.to || undefined }
      : undefined;

  const forms = await listDashboardForms(selectedCommission.commissionId, range);

  const selectedFormId =
    sp.form && forms.some((f) => f.formId === sp.form)
      ? sp.form
      : (forms[0]?.formId ?? null);

  const raw = selectedFormId ? await getFormDashboard(selectedFormId, range) : null;
  const dashboard = raw ? toAggregatesOnly(raw) : null;

  // Preserve the hospital scope across every picker link (hospital is a filter,
  // never a segment — ADR 0041 D8).
  const baseParams = new URLSearchParams();
  if (hospitalFilter) baseParams.set("hospital", hospitalFilter);
  if (sp.from) baseParams.set("from", sp.from);
  if (sp.to) baseParams.set("to", sp.to);

  const commissionHrefFor = (commissionId: string) => {
    const p = new URLSearchParams(baseParams);
    p.set("comissao", commissionId);
    return `${qualidadeHref(org, "dashboards")}?${p.toString()}`;
  };
  const formHrefFor = (formId: string) => {
    const p = new URLSearchParams(baseParams);
    p.set("comissao", selectedCommission.commissionId);
    p.set("form", formId);
    return `${qualidadeHref(org, "dashboards")}?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <Header orgName={access.organization.name} />

      {commissions.length > 1 ? (
        <nav aria-label="Comissões sob supervisão">
          <ul className="flex flex-wrap gap-2">
            {commissions.map((c) => {
              const isActive = c.commissionId === selectedCommission.commissionId;
              return (
                <li key={c.commissionId}>
                  <Link
                    href={commissionHrefFor(c.commissionId)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                      isActive
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {c.commissionName}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <QualityDashboardFilters from={sp.from ?? null} to={sp.to ?? null} />

      {forms.length === 0 ? (
        <QualityEmptyState variant="no-dashboards" />
      ) : (
        <>
          <nav aria-label="Formulários da comissão">
            <ul className="flex flex-wrap gap-2">
              {forms.map((f) => {
                const isActive = f.formId === selectedFormId;
                return (
                  <li key={f.formId}>
                    <Link
                      href={formHrefFor(f.formId)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                        isActive
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-card text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {f.title}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {f.totalSubmitted}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {dashboard ? (
            <div className="flex flex-col gap-7">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl tabular-nums">
                  {dashboard.totalSubmitted}
                </span>
                <span className="text-sm text-muted-foreground">
                  {dashboard.totalSubmitted === 1
                    ? "resposta enviada"
                    : "respostas enviadas"}
                </span>
              </div>
              <DashboardCharts dashboard={dashboard} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione um formulário para ver as estatísticas.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Drop everything row-level before it can reach a component (D11). With
 * `freeTextSamples: []` the section grouper simply produces no free-text
 * entries, so `FreeTextSamples` is never mounted — the suppression is
 * structural, not a conditional someone can later forget to write.
 */
function toAggregatesOnly(dashboard: FormDashboard): FormDashboard {
  return { ...dashboard, freeTextSamples: [], completionByMember: [] };
}

function Header({ orgName }: { orgName: string }) {
  return (
    <header className="flex flex-col gap-2">
      <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
        Escritório da Qualidade · {orgName}
      </p>
      <h1 className="text-3xl text-balance">Painéis de conformidade</h1>
      <p className="max-w-prose text-muted-foreground text-pretty">
        Estatísticas agregadas das respostas enviadas pelas comissões sob
        supervisão. Respostas individuais, textos abertos e desempenho por pessoa
        não fazem parte da supervisão da qualidade.
      </p>
    </header>
  );
}
