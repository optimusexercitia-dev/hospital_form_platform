import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the DSR console. The shell persists; this skeletons the
 * header, the task inbox and the request lane, mirroring the real layout.
 *
 * ⚠ This file is load-bearing, not decorative: a route without a `loading.tsx`
 * has left dialogs stuck on the production build in this codebase before
 * (case-dialog-prod-refresh scar). Do not "simplify" it away.
 */
export default function DsrConsoleLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
