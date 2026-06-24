import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the admin commission detail. The admin layout persists;
 * this skeletons the detail content (header + the two management cards).
 */
export default function AdminCommissionDetailLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-44" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
