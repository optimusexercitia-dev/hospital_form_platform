"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { useReducedMotion } from "@/components/dashboard/use-reduced-motion";
import { MeasurementStatusChip } from "@/components/indicators/indicator-format";
import { formatPeriodLabel } from "@/components/indicators/indicator-format";
import type {
  IndicatorSeriesPoint,
  MeasurementStatus,
} from "@/lib/indicators/types";

/**
 * Trend-vs-target run chart (Phase 15, F4). A Recharts `ComposedChart` plotting
 * the measurement values over time with:
 *   - the TARGET line (dashed reference),
 *   - the WARNING band (shaded area between lowerWarn/upperWarn), when set,
 *   - a per-point status chip in the accompanying data table.
 *
 * Follows the dashboard chart idiom: the SVG is `aria-hidden` (decorative) and the
 * accessible source of truth is the data table beside it; entrance animation is
 * disabled under `prefers-reduced-motion` (`isAnimationActive={!reduced}`). Colours
 * come from the design tokens. Rendered via `next/dynamic` from the detail page so
 * Recharts stays off the critical path.
 */
export function RunChart({
  points,
  unit,
  lowerWarn,
  upperWarn,
}: {
  points: IndicatorSeriesPoint[];
  unit: string | null;
  lowerWarn: number | null;
  upperWarn: number | null;
}) {
  const reduced = useReducedMotion();

  const plotted = points.filter((p) => p.value != null);
  const hasData = plotted.length > 0;
  const target = points.find((p) => p.target != null)?.target ?? null;

  const data = points.map((p) => ({
    ...p,
    label: formatPeriodLabel(p.periodLabel),
    // The warning band is drawn as an Area from lowerWarn to upperWarn; encode as
    // a [low, high] tuple per point so a single Area renders the shaded region.
    band:
      lowerWarn != null && upperWarn != null
        ? [lowerWarn, upperWarn]
        : undefined,
  }));

  return (
    <section
      aria-labelledby="run-chart-heading"
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="run-chart-heading" className="text-lg font-semibold">
          Tendência vs. meta
        </h2>
        {target != null ? (
          <span className="text-sm text-muted-foreground">
            Meta:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {new Intl.NumberFormat("pt-BR", {
                maximumFractionDigits: 2,
              }).format(target)}
              {unit ? ` ${unit}` : ""}
            </span>
          </span>
        ) : null}
      </div>

      {hasData ? (
        <>
          <div className="h-64 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 4, left: -12 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                {lowerWarn != null && upperWarn != null ? (
                  <Area
                    type="monotone"
                    dataKey="band"
                    stroke="none"
                    fill="var(--color-warning)"
                    fillOpacity={0.1}
                    isAnimationActive={!reduced}
                  />
                ) : null}
                {target != null ? (
                  <ReferenceLine
                    y={target}
                    stroke="var(--color-primary)"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-chart-1)" }}
                  connectNulls
                  isAnimationActive={!reduced}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <ChartDataTable points={points} unit={unit} />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda não há medições com valor para exibir a tendência.
        </p>
      )}
    </section>
  );
}

function ChartDataTable({
  points,
  unit,
}: {
  points: IndicatorSeriesPoint[];
  unit: string | null;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Valores do indicador por período</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 pr-2 font-medium">
            Período
          </th>
          <th scope="col" className="py-1.5 px-2 text-right font-medium">
            Valor
          </th>
          <th scope="col" className="py-1.5 pl-2 font-medium">
            Situação
          </th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr
            key={p.periodLabel}
            className="border-b border-border/60 last:border-b-0"
          >
            <th
              scope="row"
              className="py-1.5 pr-2 font-normal text-foreground/90"
            >
              {formatPeriodLabel(p.periodLabel)}
            </th>
            <td className="py-1.5 px-2 text-right tabular-nums">
              {p.value != null
                ? `${new Intl.NumberFormat("pt-BR", {
                    maximumFractionDigits: 2,
                  }).format(p.value)}${unit ? ` ${unit}` : ""}`
                : "—"}
            </td>
            <td className="py-1.5 pl-2">
              <MeasurementStatusChip status={p.status as MeasurementStatus} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
