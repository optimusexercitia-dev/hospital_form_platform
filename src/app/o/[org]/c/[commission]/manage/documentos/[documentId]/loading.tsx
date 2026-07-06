import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the document detail — header + affordance + versions skeletons. */
export default function DocumentDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
