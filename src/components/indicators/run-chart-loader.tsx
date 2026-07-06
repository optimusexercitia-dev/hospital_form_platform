"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { IndicatorSeriesPoint } from "@/lib/indicators/types";

/**
 * Client wrapper that lazy-loads the Recharts {@link RunChart} via `next/dynamic`
 * so the (heavy) charting bundle stays code-split OFF the initial critical path —
 * the rest of the detail page renders immediately and the chart chunk streams in,
 * with a skeleton mirroring its height while it loads.
 *
 * NB: SSR is left ON (the default) rather than `ssr:false`. Recharts SSRs cleanly
 * inside a FIXED-height container (`h-64 w-full` here — `ResponsiveContainer`
 * measures on mount via ResizeObserver, harmless at 0-size on the server), so the
 * chart server-renders and hydrates normally. `ssr:false` was observed to leave the
 * loading skeleton stuck (the Suspense boundary never swapped to the component on
 * the standalone prod server); keeping SSR on removes that swap dependency while
 * still code-splitting the Recharts bundle.
 */
const RunChart = dynamic(
  () => import("@/components/indicators/run-chart").then((m) => m.RunChart),
  {
    loading: () => (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    ),
  },
);

export function RunChartLoader(props: {
  points: IndicatorSeriesPoint[];
  unit: string | null;
  lowerWarn: number | null;
  upperWarn: number | null;
}) {
  return <RunChart {...props} />;
}
