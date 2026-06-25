import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the QPS cross-committee patient view. The admin shell
 * persists; this skeletons the header and the search card, mirroring the real
 * layout (results render only after a search, so no result skeleton).
 */
export default function NspPatientsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-full max-w-prose" />
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>
    </div>
  );
}
