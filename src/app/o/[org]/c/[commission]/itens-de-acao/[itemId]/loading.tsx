import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the Action Item detail page. Mirrors the real layout: back
 * link, header (eyebrow / title / badges), the details card, then the
 * acompanhamento card.
 *
 * On the BUG-AIF-001 Suspense-boundary hazard: this route already sits under the
 * ancestor `o/[org]/c/[commission]/loading.tsx` boundary, so omitting a
 * route-level one here would NOT avoid the boundary. What actually closes the bug
 * is `next@16.3.0-preview.5` (past PR #95391), which this branch ships.
 */
export default function ActionItemDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-96 max-w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
