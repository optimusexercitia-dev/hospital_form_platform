import { Skeleton } from "@/components/ui/skeleton";

/** Loading skeleton mirroring the bulk-case wizard shell (header + stepper + card). */
export default function BulkCreateCasesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-full" />
            ))}
          </div>
          <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}
