import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the NSP event detail. The admin shell persists; this
 * skeletons the header spine and the two-column body (narrative/metadata/PHI
 * panel + the custody rail), mirroring the real layout.
 */
export default function NspEventDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
