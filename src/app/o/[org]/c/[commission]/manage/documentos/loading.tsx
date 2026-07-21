import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the register — header + KPI strip + filters + table skeleton. */
export default function DocumentsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-full max-w-prose" />
        <Skeleton className="mt-2 h-11 w-44 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
