import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the indicator detail — header + chart + grid skeletons. */
export default function IndicatorDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-80 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
