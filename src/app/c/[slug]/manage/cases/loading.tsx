import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the cases board. The commission shell persists; this
 * skeletons the header and a stack of case rows.
 */
export default function CasesBoardLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
