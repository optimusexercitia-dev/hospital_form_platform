"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { useReducedMotion } from "@/components/motion/use-reduced-motion";

/** The petrol-anchored chart ramp from globals.css (`--chart-1..5`). */
const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/** One category row of an ethics breakdown (status count or sanction tally). */
export interface EthicsBreakdownRow {
  /** Stable identity (status key or sanction-type id) — the React key. */
  key: string;
  /** pt-BR display label (resolved by the caller from the label maps / catalog). */
  label: string;
  count: number;
}

/**
 * A single ethics-dashboard breakdown: a horizontal bar chart paired with an
 * always-present data table (the accessible source of truth — the SVG is
 * `aria-hidden`, the table carries every category including zero-count ones).
 * Mirrors the platform dashboard idiom (`distribution-chart.tsx` /
 * `volume-trend.tsx`): tokenized colours, reduced-motion-guarded animation.
 *
 * Prop-driven and client-only for the Recharts + reduced-motion hook; the server
 * view resolves the pt-BR labels and passes plain rows, so no query module is
 * dragged into the client bundle (Rule 9 / design §7).
 */
export function EthicsBreakdownChart({
  heading,
  headingId,
  rows,
  categoryLabel,
  emptyLabel,
}: {
  heading: string;
  /** Unique id so the section's heading labels its region. */
  headingId: string;
  rows: EthicsBreakdownRow[];
  /** Header for the table's category column (e.g. "Situação", "Sanção"). */
  categoryLabel: string;
  /** pt-BR empty-state copy when every category is zero. */
  emptyLabel: string;
}) {
  const reduced = useReducedMotion();
  const hasData = rows.some((r) => r.count > 0);

  return (
    <section
      aria-labelledby={headingId}
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <h3 id={headingId} className="text-base font-semibold text-balance">
        {heading}
      </h3>

      {hasData ? (
        <>
          <div
            className="w-full"
            style={{ height: `${Math.max(rows.length * 44, 120)}px` }}
            aria-hidden="true"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={!reduced}
                >
                  {rows.map((row, i) => (
                    <Cell
                      key={row.key}
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
            </ResponsiveContainer>
          </div>

          <BreakdownTable
            heading={heading}
            categoryLabel={categoryLabel}
            rows={rows}
          />
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </section>
  );
}

/**
 * The accessible text alternative: a real table of every category's count (and
 * share of the total). Rendered visually — it doubles as the legend — so the data
 * is available to screen-reader and sighted users alike.
 */
function BreakdownTable({
  heading,
  categoryLabel,
  rows,
}: {
  heading: string;
  categoryLabel: string;
  rows: EthicsBreakdownRow[];
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{heading}</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 pr-2 font-medium">
            {categoryLabel}
          </th>
          <th scope="col" className="py-1.5 px-2 text-right font-medium">
            Quantidade
          </th>
          <th scope="col" className="py-1.5 pl-2 text-right font-medium">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <tr
              key={row.key}
              className="border-b border-border/60 last:border-b-0"
            >
              <th
                scope="row"
                className="py-1.5 pr-2 font-normal text-foreground/90"
              >
                {row.label}
              </th>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {row.count}
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
