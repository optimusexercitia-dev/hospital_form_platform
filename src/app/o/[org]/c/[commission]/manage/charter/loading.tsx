import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the charter page — header + three card skeletons mirroring the layout. */
export default function CharterLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-prose" />
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
