import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the indicator list — header + a few card skeletons. */
export default function IndicatorsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-full max-w-prose" />
        <Skeleton className="mt-2 h-11 w-40 rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
