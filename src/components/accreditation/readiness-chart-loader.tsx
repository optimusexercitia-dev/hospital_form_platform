"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { ReadinessBar } from "@/components/accreditation/readiness-chart";

/**
 * Client wrapper that lazy-loads the Recharts {@link ReadinessChart} via
 * `next/dynamic` so the charting bundle stays off the critical path — the
 * rest of the framework overview renders immediately and the chart chunk
 * streams in behind a skeleton. Mirrors
 * `src/components/indicators/run-chart-loader.tsx` (SSR left ON — Recharts
 * SSRs cleanly inside a fixed-height container).
 */
const ReadinessChart = dynamic(
  () => import("@/components/accreditation/readiness-chart").then((m) => m.ReadinessChart),
  {
    loading: () => (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    ),
  },
);

export function ReadinessChartLoader({ bars }: { bars: ReadinessBar[] }) {
  return <ReadinessChart bars={bars} />;
}
