import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the NSP roster ("Equipe do NSP") — header + enroll card + roster list. */
export default function NspRosterLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </div>
  );
}
