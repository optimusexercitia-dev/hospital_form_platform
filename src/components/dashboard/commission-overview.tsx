"use client";

import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";

import type { CommissionOverviewRow } from "@/lib/queries/dashboard";

import { useReducedMotion } from "./use-reduced-motion";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/**
 * Admin cross-commission overview (F6): submission volume per commission as a
 * bar chart paired with the canonical data table (the SVG is `aria-hidden`;
 * the table carries forms, total submitted, and last-30-day activity, and links
 * to each commission's own dashboard). Mirrors the per-commission dashboard's
 * chart styling and reduced-motion guard.
 */
export function CommissionOverview({
  org,
  rows,
}: {
  /**
   * The organization slug these commissions belong to. Under the multi-tenant
   * rescoping, this rollup is org-scoped — every row is a commission in the
   * caller's org — so a single org slug links each row to its dashboard.
   */
  org: string;
  rows: CommissionOverviewRow[];
}) {
  const reduced = useReducedMotion();
  const hasVolume = rows.some((r) => r.submittedCount > 0);
  const chartData = rows.map((r) => ({
    name: r.commissionName,
    count: r.submittedCount,
  }));

  return (
    <div className="flex flex-col gap-7">
      <section
        aria-labelledby="overview-volume-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <h2
          id="overview-volume-heading"
          className="text-lg font-semibold text-balance"
        >
          Respostas enviadas por comissão
        </h2>

        {hasVolume ? (
          <div className="h-64 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 32, bottom: 4, left: 8 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={!reduced}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    className="fill-foreground"
                    style={{ fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
            Ainda não há respostas enviadas em nenhuma comissão.
          </p>
        )}

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Volume de formulários e respostas por comissão
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 pr-2 font-medium">
                Comissão
              </th>
              <th scope="col" className="py-1.5 px-2 text-right font-medium">
                Formulários
              </th>
              <th scope="col" className="py-1.5 px-2 text-right font-medium">
                Enviadas
              </th>
              <th scope="col" className="py-1.5 px-2 text-right font-medium">
                Últimos 30 dias
              </th>
              <th scope="col" className="py-1.5 pl-2 text-right font-medium">
                <span className="sr-only">Abrir painel</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.commissionId}
                className="border-b border-border/60 last:border-b-0"
              >
                <th
                  scope="row"
                  className="py-2 pr-2 font-normal text-foreground/90"
                >
                  {row.commissionName}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    /{row.slug}
                  </span>
                </th>
                <td className="py-2 px-2 text-right tabular-nums">
                  {row.formCount}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {row.submittedCount}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                  {row.submittedLast30Days}
                </td>
                <td className="py-2 pl-2 text-right">
                  <Link
                    href={commissionHref(org, row.slug, "dashboard")}
                    aria-label={`Abrir painel de ${row.commissionName}`}
                    className="inline-flex items-center gap-1 rounded text-sm text-primary transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    Painel
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
