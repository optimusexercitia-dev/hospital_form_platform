import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the commission events read-back list. The commission shell
 * persists; this skeletons the header, the filter bar, and a grid of event cards.
 */
export default function CommissionEventsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 rounded-lg" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
