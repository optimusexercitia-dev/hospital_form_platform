import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the commission audit trail. The commission shell persists;
 * this skeletons the header, the filter bar, and a few feed rows — mirroring the
 * real layout so the swap is calm.
 */
export default function CommissionAuditLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <Skeleton className="h-28 w-full rounded-2xl" />

      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
