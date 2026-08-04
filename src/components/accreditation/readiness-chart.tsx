"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { useReducedMotion } from "@/components/motion/use-reduced-motion";

/** One bar: a level ("Nível 1") or a chapter ("AOP — Acesso e Avaliação"). */
export interface ReadinessBar {
  key: string;
  label: string;
  /** 0-100. */
  pct: number;
  /** Renders the bar in the primary token instead of the neutral chart token (e.g. a certifiable level). */
  highlight?: boolean;
}

/**
 * Readiness-% bar chart (leveled → one bar per ONA level; non-leveled → one
 * bar per JCI chapter). Follows the `run-chart.tsx` idiom: the SVG is
 * `aria-hidden` (decorative) and a real `<table>` beside it is the
 * accessible source of truth; entrance animation is disabled under
 * `prefers-reduced-motion`. Rendered via `next/dynamic` from
 * `readiness-chart-loader.tsx` so Recharts stays off the critical path.
 */
export function ReadinessChart({ bars }: { bars: ReadinessBar[] }) {
  const reduced = useReducedMotion();
  const hasData = bars.length > 0;

  return (
    <section
      aria-labelledby="readiness-chart-heading"
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <h2 id="readiness-chart-heading" className="text-lg font-semibold">
        Prontidão
      </h2>

      {hasData ? (
        <>
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} isAnimationActive={!reduced}>
                  {bars.map((bar) => (
                    <Cell
                      key={bar.key}
                      fill={bar.highlight ? "var(--color-primary)" : "var(--color-chart-1)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ReadinessDataTable bars={bars} />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum padrão cadastrado neste framework ainda.
        </p>
      )}
    </section>
  );
}

function ReadinessDataTable({ bars }: { bars: ReadinessBar[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Percentual de prontidão por grupo</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 pr-2 font-medium">
            Grupo
          </th>
          <th scope="col" className="py-1.5 pl-2 text-right font-medium">
            Prontidão
          </th>
        </tr>
      </thead>
      <tbody>
        {bars.map((bar) => (
          <tr key={bar.key} className="border-b border-border/60 last:border-b-0">
            <th scope="row" className="py-1.5 pr-2 font-normal text-foreground/90">
              {bar.label}
            </th>
            <td className="py-1.5 pl-2 text-right tabular-nums">
              {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(bar.pct)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
