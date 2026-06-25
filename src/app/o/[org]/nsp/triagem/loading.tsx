import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the triage workstation — skeletons the topbar + the three
 * panes (queue / flow / disposition), mirroring the real layout.
 */
export default function NspTriageLoading() {
  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex flex-col gap-5 px-4 sm:px-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-8 w-40" />
        </div>

        <div className="flex gap-5 overflow-hidden">
          <div className="flex w-[312px] shrink-0 flex-col gap-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="flex min-w-[468px] flex-1 flex-col gap-5">
            <Skeleton className="h-40 w-full rounded-2xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
          <div className="w-[320px] shrink-0">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
