import { Skeleton } from "@/components/ui/skeleton";

/** Dashboards skeleton — header, pickers, filter row, then the chart cards. */
export default function QualityDashboardsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-96" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-36 rounded-xl" />
        ))}
      </div>

      <div className="flex gap-3">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
