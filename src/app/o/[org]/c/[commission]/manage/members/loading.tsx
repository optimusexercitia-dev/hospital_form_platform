import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the member-management page. The commission shell persists;
 * this skeletons the header, the invite card, and the member list.
 */
export default function ManageMembersLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <Skeleton className="h-48 w-full rounded-2xl" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    </div>
  );
}
