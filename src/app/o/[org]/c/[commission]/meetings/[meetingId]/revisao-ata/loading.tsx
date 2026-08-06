import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for MIN's review page — skeletons the header + the Ata block + a
 * stack of section-card placeholders, mirroring the meeting detail `loading.tsx`'s
 * pattern (the review route has no `loading.tsx` of its own to inherit).
 */
export default function ReviewAtaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}
