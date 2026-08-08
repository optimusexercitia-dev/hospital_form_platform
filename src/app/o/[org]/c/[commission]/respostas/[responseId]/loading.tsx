import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for one submitted response (the respondent's read-only view).
 * Overrides the parent list skeleton for this segment — a detail route
 * flashing a list of rows reads as the wrong page having loaded.
 */
export default function MyResponseDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
