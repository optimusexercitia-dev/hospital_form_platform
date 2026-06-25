import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the NSP-coordination surface — header + appoint card + list. */
export default function OrgNspCoordinationLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="flex max-w-3xl flex-col gap-5">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
