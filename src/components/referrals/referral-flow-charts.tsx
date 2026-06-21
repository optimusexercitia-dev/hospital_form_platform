"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  CircleCheck,
  CircleSlash,
  Inbox,
  Layers,
  Undo2,
} from "lucide-react";

import {
  RESOLVED_REFERRAL_STATUSES,
  type ReferralFlowMetrics,
  type ReferralListItem,
} from "@/lib/referrals/types";
import { useReducedMotion } from "@/components/dashboard/use-reduced-motion";

/** The petrol-anchored chart ramp from globals.css (`--chart-1..5`). */
const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/** Aging buckets (days since send) for reply-expecting in-flight referrals. */
const AGING_BUCKETS = [
  { key: "0-7", label: "0–7 dias", min: 0, max: 7 },
  { key: "8-15", label: "8–15 dias", min: 8, max: 15 },
  { key: "16-30", label: "16–30 dias", min: 16, max: 30 },
  { key: "31+", label: "31+ dias", min: 31, max: Infinity },
] as const;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/**
 * The QPS dashboard charts + KPIs (Decision 13). PHI-free aggregate. The headline
 * counts come from {@link ReferralFlowMetrics} ({@link referrals}-independent); the
 * two charts are derived CLIENT-SIDE from the already-loaded {@link ReferralListItem}
 * list (the contract's metrics shape carries only the six counts, so aging +
 * by-committee flow are computed here from the list — no extra query).
 *
 * Each chart ships with an always-present accessible DATA TABLE — the canonical
 * source; the SVG is `aria-hidden` (mirrors `distribution-chart.tsx`). Recharts
 * entrance animation is disabled under reduced motion.
 */
export function ReferralFlowCharts({
  metrics,
  referrals,
}: {
  metrics: ReferralFlowMetrics;
  referrals: ReferralListItem[];
}) {
  const reduced = useReducedMotion();

  // Aging — reply-expecting referrals still in flight, bucketed by days since send.
  const aging = useMemo(() => {
    const counts = new Map<string, number>(
      AGING_BUCKETS.map((b) => [b.key, 0]),
    );
    for (const r of referrals) {
      if (!r.responseExpected) continue;
      if (RESOLVED_REFERRAL_STATUSES.has(r.status)) continue;
      const age = daysSince(r.sentAt);
      if (age == null) continue;
      const bucket = AGING_BUCKETS.find((b) => age >= b.min && age <= b.max);
      if (bucket) counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
    }
    return AGING_BUCKETS.map((b) => ({
      label: b.label,
      count: counts.get(b.key) ?? 0,
    }));
  }, [referrals]);

  // By-committee flow — referrals grouped by "Origem → Destino" pair, top 8.
  const flow = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of referrals) {
      const key = `${r.sourceCommissionName ?? "—"} → ${r.targetCommissionName ?? "—"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [referrals]);

  const kpis: {
    key: string;
    label: string;
    value: number;
    icon: typeof Inbox;
    tone: string;
  }[] = [
    { key: "open", label: "Em aberto", value: metrics.open, icon: Layers, tone: "text-primary" },
    {
      key: "awaiting",
      label: "Aguardando resposta",
      value: metrics.awaitingReply,
      icon: Clock,
      tone: "text-warning",
    },
    {
      key: "concluded",
      label: "Concluídos",
      value: metrics.concluded,
      icon: CircleCheck,
      tone: "text-success",
    },
    {
      key: "declined",
      label: "Recusados",
      value: metrics.declined,
      icon: CircleSlash,
      tone: "text-destructive",
    },
    {
      key: "withdrawn",
      label: "Retirados",
      value: metrics.withdrawn,
      icon: Undo2,
      tone: "text-muted-foreground",
    },
    { key: "total", label: "Total", value: metrics.total, icon: Inbox, tone: "text-foreground" },
  ];

  const agingHasData = aging.some((a) => a.count > 0);
  const flowHasData = flow.some((f) => f.count > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.key}
              className="animate-rise-in flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 shadow-xs"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <Icon aria-hidden="true" className={`size-3.5 ${k.tone}`} />
                {k.label}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {k.value}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging buckets */}
        <article
          aria-labelledby="referral-aging-heading"
          className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <h3 id="referral-aging-heading" className="text-sm font-semibold">
              Tempo de espera por resposta
            </h3>
            <p className="text-xs text-muted-foreground">
              Encaminhamentos que aguardam resposta, por tempo desde o envio.
            </p>
          </div>
          {agingHasData ? (
            <>
              <div className="h-56 w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={aging}
                    layout="vertical"
                    margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={92}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive={!reduced}
                    >
                      {aging.map((_, i) => (
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
              <SimpleTable
                caption="Encaminhamentos aguardando resposta por faixa de tempo"
                rowLabel="Faixa"
                rows={aging}
              />
            </>
          ) : (
            <EmptyChart label="Nenhum encaminhamento aguardando resposta." />
          )}
        </article>

        {/* By-committee flow */}
        <article
          aria-labelledby="referral-flow-heading"
          className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex flex-col gap-1">
            <h3 id="referral-flow-heading" className="text-sm font-semibold">
              Fluxo entre comissões
            </h3>
            <p className="text-xs text-muted-foreground">
              Volume de encaminhamentos por par origem → destino (10 maiores).
            </p>
          </div>
          {flowHasData ? (
            <>
              <div className="h-72 w-full" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={flow}
                    layout="vertical"
                    margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
                  >
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={160}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive={!reduced}
                    >
                      {flow.map((_, i) => (
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
              <SimpleTable
                caption="Volume de encaminhamentos por par origem → destino"
                rowLabel="Origem → Destino"
                rows={flow}
              />
            </>
          ) : (
            <EmptyChart label="Nenhum encaminhamento no recorte atual." />
          )}
        </article>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

/** The accessible text alternative: a real table of each bucket/pair's count. */
function SimpleTable({
  caption,
  rowLabel,
  rows,
}: {
  caption: string;
  rowLabel: string;
  rows: { label: string; count: number }[];
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 pr-2 font-medium">
            {rowLabel}
          </th>
          <th scope="col" className="py-1.5 pl-2 text-right font-medium">
            Encaminhamentos
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.label}
            className="border-b border-border/60 last:border-b-0"
          >
            <th scope="row" className="py-1.5 pr-2 font-normal text-foreground/90">
              {r.label}
            </th>
            <td className="py-1.5 pl-2 text-right tabular-nums">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
