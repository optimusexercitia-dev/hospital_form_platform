import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the document register — header + filter + a few card skeletons. */
export default function DocumentsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-full max-w-prose" />
        <Skeleton className="mt-2 h-11 w-44 rounded-lg" />
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
