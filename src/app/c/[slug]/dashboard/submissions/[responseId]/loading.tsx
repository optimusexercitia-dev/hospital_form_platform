import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the submission detail. The commission shell persists; this
 * skeletons the header and a couple of section cards.
 */
export default function SubmissionDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-56" />
      </div>

      <div className="flex flex-col gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
