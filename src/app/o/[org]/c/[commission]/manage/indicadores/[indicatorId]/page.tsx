import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getIndicator,
  getIndicatorSeries,
  listIndicatorMeasurements,
  listCapaPlansForIndicator,
} from "@/lib/queries/indicators";
import {
  recordIndicatorMeasurement,
  computeDerivedMeasurement,
  openCapaFromIndicator,
} from "@/lib/indicators/actions";
import { createManualActionItem } from "@/lib/action-items/actions";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { RunChartLoader } from "@/components/indicators/run-chart-loader";
import { MeasurementGrid } from "@/components/indicators/measurement-grid";
import { CapaAffordance } from "@/components/indicators/capa-affordance";
import { isPqsOperatorOfIndicatorHospital } from "@/components/indicators/capa-operator-gate";
import {
  IndicatorKindBadge,
  formatTarget,
} from "@/components/indicators/indicator-format";
import {
  DATA_SOURCE_LABELS,
  INDICATOR_DIRECTION_LABELS,
  INDICATOR_FREQUENCY_LABELS,
  INDICATOR_STATUS_LABELS,
} from "@/lib/indicators/types";

export const metadata: Metadata = {
  title: "Indicador",
};

/**
 * Indicator detail (Phase 15, F4 + F3 + F5 operator arm). Server shell: loads the
 * indicator, its series, measurements, and any CAPA plans in parallel, then
 * renders the run chart (F4), the measurement grid (F3), and the two-tier CAPA
 * affordance (F5). Coordinator-gated by the area layout.
 */
export default async function IndicatorDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; indicatorId: string }>;
}) {
  const { org, commission, indicatorId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const indicator = await getIndicator(indicatorId);
  if (!indicator || indicator.commissionId !== access.commission.id) {
    notFound();
  }

  const [series, measurements, plans, isPqsOperator] = await Promise.all([
    getIndicatorSeries(indicatorId),
    listIndicatorMeasurements(indicatorId),
    listCapaPlansForIndicator(indicatorId),
    isPqsOperatorOfIndicatorHospital(indicator),
  ]);

  // Measurements come newest-first; the latest drives the off-target escalation.
  const latestMeasurement = measurements[0] ?? null;

  const listHref = commissionHref(org, commission, "manage", "indicadores");
  const editHref = commissionHref(
    org,
    commission,
    "manage",
    "indicadores",
    indicatorId,
    "editar",
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={listHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar aos indicadores
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {indicator.code}
              </span>
              <IndicatorKindBadge kind={indicator.kind} />
              {indicator.status === "arquivado" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {INDICATOR_STATUS_LABELS.arquivado}
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl text-balance">{indicator.name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                {formatTarget(
                  indicator.targetComparator,
                  indicator.targetValue,
                  indicator.unit,
                )}
              </span>
              <span aria-hidden="true">·</span>
              <span>{INDICATOR_DIRECTION_LABELS[indicator.direction]}</span>
              <span aria-hidden="true">·</span>
              <span>{INDICATOR_FREQUENCY_LABELS[indicator.frequency]}</span>
              <span aria-hidden="true">·</span>
              <span>{DATA_SOURCE_LABELS[indicator.dataSource]}</span>
            </p>
          </div>
          {indicator.status === "ativo" ? (
            <Button asChild variant="outline" size="lg">
              <Link href={editHref}>
                <Pencil aria-hidden="true" className="size-4" />
                Editar
              </Link>
            </Button>
          ) : null}
        </div>

        {indicator.descriptionMd ? (
          <div className="max-w-prose rounded-2xl border border-border bg-card p-5 shadow-xs">
            <MarkdownRenderer content={indicator.descriptionMd} />
          </div>
        ) : null}
      </header>

      <RunChartLoader
        points={series}
        unit={indicator.unit}
        lowerWarn={indicator.lowerWarn}
        upperWarn={indicator.upperWarn}
      />

      <CapaAffordance
        indicator={indicator}
        latestMeasurement={latestMeasurement}
        isPqsOperator={isPqsOperator}
        openCapaAction={openCapaFromIndicator}
        createManualAction={createManualActionItem}
        org={org}
        plans={plans}
      />

      <MeasurementGrid
        indicator={indicator}
        measurements={measurements}
        recordAction={recordIndicatorMeasurement}
        computeAction={computeDerivedMeasurement}
      />
    </div>
  );
}
