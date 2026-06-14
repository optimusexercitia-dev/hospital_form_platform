"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { QuestionDistribution } from "@/lib/queries/dashboard";

import { useReducedMotion } from "./use-reduced-motion";

/** The petrol-anchored chart ramp from globals.css (`--chart-1..5`). */
const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/**
 * One choice-question distribution, rendered as a chart WITH an always-present
 * data table (the accessible text alternative — the table is the canonical
 * source, the SVG is `aria-hidden`). Bar is the default; a pie is used only for
 * a small single-select (`multiple_choice`/`dropdown` with ≤4 options).
 * `checkbox` is always a bar (multi-select, values unnested per option).
 *
 * Each card renders its OWN denominator: "{n} de {N} respostas em que a pergunta
 * era aplicável" — so a question in a conditional section shows the smaller N.
 */
export function DistributionChart({
  distribution,
}: {
  distribution: QuestionDistribution;
}) {
  const reduced = useReducedMotion();
  const { label, options, denominator, n, type } = distribution;
  const headingId = `dist-${distribution.questionKey}`;

  const usePie =
    (type === "multiple_choice" || type === "dropdown") &&
    options.length > 0 &&
    options.length <= 4;

  const hasData = options.some((o) => o.count > 0);

  return (
    <article
      aria-labelledby={headingId}
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h4 id={headingId} className="text-sm font-semibold text-balance">
          {label}
        </h4>
        <p className="text-xs text-muted-foreground">
          {n} de {denominator}{" "}
          {denominator === 1 ? "resposta" : "respostas"} em que a pergunta era
          aplicável
        </p>
      </div>

      {hasData ? (
        <>
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              {usePie ? (
                <PieChart>
                  <Pie
                    data={options}
                    dataKey="count"
                    nameKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    isAnimationActive={!reduced}
                    label={(entry: { name?: string | number; value?: number }) =>
                      `${entry.name}: ${entry.value}`
                    }
                  >
                    {options.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              ) : (
                <BarChart
                  data={options}
                  layout="vertical"
                  margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="value"
                    width={120}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={!reduced}
                  >
                    {options.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      className="fill-foreground"
                      style={{ fontSize: 12 }}
                    />
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <DistributionTable
            label={label}
            options={options}
            denominator={denominator}
          />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
          Sem respostas para esta pergunta.
        </p>
      )}
    </article>
  );
}

/**
 * The accessible text alternative: a real table of every option's count and
 * share. Rendered visually (it doubles as the legend) — never `sr-only`-only —
 * so the data is available to everyone, screen reader or not.
 */
function DistributionTable({
  label,
  options,
  denominator,
}: {
  label: string;
  options: QuestionDistribution["options"];
  denominator: number;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Distribuição de respostas para: {label}
      </caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 pr-2 font-medium">
            Opção
          </th>
          <th scope="col" className="py-1.5 px-2 text-right font-medium">
            Respostas
          </th>
          <th scope="col" className="py-1.5 pl-2 text-right font-medium">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {options.map((opt) => {
          const pct =
            denominator > 0
              ? Math.round((opt.count / denominator) * 100)
              : 0;
          return (
            <tr
              key={opt.value}
              className="border-b border-border/60 last:border-b-0"
            >
              <th
                scope="row"
                className="py-1.5 pr-2 font-normal text-foreground/90"
              >
                {opt.value}
              </th>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {opt.count}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">
                {pct}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
