import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";

import {
  getCommissionAccessByOrg,
  canConfigureCommission,
} from "@/lib/queries/session";
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
  type Indicator,
} from "@/lib/indicators/types";

export const metadata: Metadata = {
  title: "Indicador",
};

/**
 * Indicator detail (Phase 15, F4 + F3 + F5 operator arm). Server shell: loads the
 * indicator, its series, measurements, and any CAPA plans in parallel, then
 * renders the run chart (F4), the measurement grid (F3), and the two-tier CAPA
 * affordance (F5). Gated by the area layout + `canConfigureCommission`.
 *
 * ⭐ ADR 0100 D12, ruling Q3 — this page STRADDLES the content wall and is the
 * one KEEP surface that splits:
 *
 *   - the indicator DEFINITION (code, name, target, direction, periodicity, data
 *     source, description) is configuration → renders for a tenancy admin;
 *   - the MEASUREMENT half (run chart, measurement grid, CAPA escalation) is
 *     committee content → renders only for a principal with a MEMBERSHIP role.
 *
 * The content half is skipped at the READ, not hidden at the render: the four
 * measurement reads never run for a tenancy admin. Rendering the panels against
 * a DB that returns nothing would look identical to "this indicator has never
 * been measured" — a wall that reads as missing data is a wall that gets filed
 * as a bug, and the empty state would be a lie about the committee's work.
 */
export default async function IndicatorDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; indicatorId: string }>;
}) {
  const { org, commission, indicatorId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || !canConfigureCommission(access)) {
    notFound();
  }

  const indicator = await getIndicator(indicatorId);
  if (!indicator || indicator.commissionId !== access.commission.id) {
    notFound();
  }

  // The measurement half is membership-gated (Q3). `role !== null` is the
  // membership test post-BUG-QOB-003 — a bare tenancy admin resolves `null`.
  // `null` here means "withheld", never "empty": the reads did not run.
  const measurementHalf =
    access.role !== null ? await loadMeasurementHalf(indicator) : null;

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
              {indicator.status === "archived" ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {INDICATOR_STATUS_LABELS.archived}
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
          {indicator.status === "active" ? (
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

      {measurementHalf ? (
        <>
          <RunChartLoader
            points={measurementHalf.series}
            unit={indicator.unit}
            lowerWarn={indicator.lowerWarn}
            upperWarn={indicator.upperWarn}
          />

          <CapaAffordance
            indicator={indicator}
            latestMeasurement={measurementHalf.latestMeasurement}
            isPqsOperator={measurementHalf.isPqsOperator}
            openCapaAction={openCapaFromIndicator}
            createManualAction={createManualActionItem}
            org={org}
            plans={measurementHalf.plans}
          />

          <MeasurementGrid
            indicator={indicator}
            measurements={measurementHalf.measurements}
            recordAction={recordIndicatorMeasurement}
            computeAction={computeDerivedMeasurement}
          />
        </>
      ) : (
        <MeasurementsWithheldNote />
      )}
    </div>
  );
}

/**
 * The measurement half of the indicator page (ruling Q3): the series behind the
 * run chart, the recorded measurements, the CAPA plans, and whether the reader
 * operates the indicator hospital's NSP. Loaded together, or not at all.
 */
async function loadMeasurementHalf(indicator: Indicator) {
  const [series, measurements, plans, isPqsOperator] = await Promise.all([
    getIndicatorSeries(indicator.id),
    listIndicatorMeasurements(indicator.id),
    listCapaPlansForIndicator(indicator.id),
    isPqsOperatorOfIndicatorHospital(indicator),
  ]);

  return {
    series,
    measurements,
    plans,
    isPqsOperator,
    // Measurements come newest-first; the latest drives the off-target escalation.
    latestMeasurement: measurements[0] ?? null,
  };
}

/**
 * What a tenancy admin sees where the measurement half would be (ruling Q3).
 * States the boundary plainly instead of rendering an empty chart + empty grid,
 * which would misreport the committee as having measured nothing.
 */
function MeasurementsWithheldNote() {
  return (
    <section
      aria-labelledby="medicoes-restritas-heading"
      className="animate-rise-in max-w-prose rounded-2xl border border-border bg-card p-6 shadow-xs"
    >
      <h2
        id="medicoes-restritas-heading"
        className="text-lg font-semibold"
      >
        Medições
      </h2>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        As medições, o gráfico de série e os planos de ação deste indicador
        pertencem à comissão e não são exibidos à administração da rede ou do
        hospital. A definição do indicador acima permanece sob sua gestão.
      </p>
    </section>
  );
}
