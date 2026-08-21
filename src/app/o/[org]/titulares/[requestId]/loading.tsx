import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for one subject request. Mirrors the real layout: header, the
 * two-tier outcome record, the adjudication panel and the task list.
 *
 * ⚠ This file is load-bearing, not decorative: a route without a `loading.tsx`
 * has left dialogs stuck on the production build in this codebase before
 * (case-dialog-prod-refresh scar), and this route hosts two AlertDialogs. Do not
 * "simplify" it away.
 */
export default function DsrRequestDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-5 w-full max-w-prose" />
      </div>

      {/* The outcome record: header + the two tier cards + the residue list. */}
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <Skeleton className="h-6 w-56" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>

      <Skeleton className="h-56 w-full rounded-2xl" />

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
