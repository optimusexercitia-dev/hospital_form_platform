import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the meetings settings page. The commission shell persists;
 * this skeletons the header and the two settings cards.
 */
export default function MeetingsSettingsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
