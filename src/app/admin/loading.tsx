import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the admin area content. The admin layout (header/nav)
 * persists; this fills the main region with a calm skeleton of the commissions
 * page so the layout doesn't pop while data resolves.
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <Skeleton className="h-56 w-full rounded-2xl" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
