import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the phase-fill wizard route. Mirrors the form wizard's
 * loading: header, progress bar, and a few input skeletons while the response
 * loads.
 */
export default function PhaseResponderLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
