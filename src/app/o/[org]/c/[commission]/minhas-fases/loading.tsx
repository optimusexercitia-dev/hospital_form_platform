import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for "Minhas fases". The commission shell persists; this skeletons
 * the header and a stack of assigned-phase rows.
 */
export default function MyPhasesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
