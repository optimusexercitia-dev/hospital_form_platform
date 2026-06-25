import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the RCA workspace — header + stepper + stage body + the
 * team/timeline/evidence right rail, mirroring the real layout.
 */
export default function NspRcaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 flex-1 rounded-xl" />
        ))}
      </div>

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
