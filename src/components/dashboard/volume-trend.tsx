"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type {
  SubmissionsOverTimePoint,
  CompletionByMember,
} from "@/lib/queries/dashboard";

import { useReducedMotion } from "./use-reduced-motion";

/** Short pt-BR day label (e.g. "13 jun") from an ISO `YYYY-MM-DD`. */
function shortDay(iso: string): string {
  // Parse as UTC midnight to avoid a TZ shift moving the date.
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

/** Full pt-BR date for the table / axis tooltips. */
function fullDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(d);
}

/**
 * Submission volume over time (trend line) + the per-member completion breakdown,
 * each paired with a data table (the accessible source; the SVG is `aria-hidden`).
 */
export function VolumeTrend({
  points,
  byMember,
}: {
  points: SubmissionsOverTimePoint[];
  byMember: CompletionByMember[];
}) {
  const reduced = useReducedMotion();
  const data = points.map((p) => ({ ...p, label: shortDay(p.day) }));
  const hasData = points.some((p) => p.count > 0);

  return (
    <section
      aria-labelledby="volume-trend-heading"
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <h3
        id="volume-trend-heading"
        className="text-base font-semibold text-balance"
      >
        Envios ao longo do tempo
      </h3>

      {hasData ? (
        <>
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 4, left: -16 }}
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
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-chart-1)" }}
                  isAnimationActive={!reduced}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Quantidade de respostas enviadas por dia
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  Dia
                </th>
                <th
                  scope="col"
                  className="py-1.5 pl-2 text-right font-medium"
                >
                  Envios
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr
                  key={p.day}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <th
                    scope="row"
                    className="py-1.5 pr-2 font-normal text-foreground/90"
                  >
                    {fullDay(p.day)}
                  </th>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {p.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
          Ainda não há envios no período.
        </p>
      )}

      {byMember.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
          <h4 className="text-sm font-semibold">Respostas por membro</h4>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Quantidade de respostas enviadas por membro
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  Membro
                </th>
                <th
                  scope="col"
                  className="py-1.5 pl-2 text-right font-medium"
                >
                  Envios
                </th>
              </tr>
            </thead>
            <tbody>
              {byMember.map((m) => (
                <tr
                  key={m.memberId}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <th
                    scope="row"
                    className="py-1.5 pr-2 font-normal text-foreground/90"
                  >
                    {m.name ?? "Membro removido"}
                  </th>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {m.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
