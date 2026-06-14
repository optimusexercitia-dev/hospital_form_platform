import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the dashboard. The commission shell persists; this skeletons
 * the header, the form picker, the headline count, and a couple of chart cards.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-36 rounded-xl" />
          ))}
        </div>

        <Skeleton className="h-12 w-48" />

        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
