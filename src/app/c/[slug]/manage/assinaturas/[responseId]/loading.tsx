import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the review-and-sign screen. Skeletons the header, the
 * respondent-context banner, and a couple of section cards.
 */
export default function ReviewAndSignLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}
