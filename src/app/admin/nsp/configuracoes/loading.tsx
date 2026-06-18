import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the NSP config area — header + three config cards. */
export default function NspConfigLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-64 w-full rounded-2xl" />
      ))}
    </div>
  );
}
