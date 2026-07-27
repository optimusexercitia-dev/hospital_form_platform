import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the ethics dashboard (ETH·E3a). The commission shell
 * persists; this skeletons the header, the two headline stat cards, and the
 * breakdown chart cards — mirroring the real layout so first paint doesn't jump.
 */
export default function EthicsDashboardLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-7">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
