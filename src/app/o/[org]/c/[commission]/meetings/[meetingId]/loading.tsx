import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the meeting detail hub. The commission shell persists; this
 * skeletons the header and the stack of registry panels.
 */
export default function MeetingDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-2xl" />
      ))}
    </div>
  );
}
