import { Skeleton } from "@/components/ui/skeleton";

/**
 * Board skeleton — mirrors the real layout (header, 4 KPI cards, chip row,
 * table) so the page does not reflow when the data lands.
 */
export default function QualityBoardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[6.5rem] rounded-xl" />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-28 rounded-full" />
        ))}
      </div>

      <Skeleton className="h-[26rem] w-full rounded-2xl" />
    </div>
  );
}
