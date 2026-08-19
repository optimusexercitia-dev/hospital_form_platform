import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the referral detail. The commission shell persists; this
 * skeletons the MINIMAL header (back link, code, subject, two chips) and the
 * two-column body.
 *
 * ⚠ LOCKSTEP with `page.tsx`: the grid template, the `contents lg:flex …` column
 * wrappers and the `order-N lg:order-none` interleaving are duplicated here on
 * purpose, so the skeleton lands where the real cards will. Change one, change both
 * in the same commit — a skeleton whose layout has drifted is worse than none,
 * because the content visibly jumps when it swaps in.
 */
export default function ReferralDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <div className="flex gap-2 pt-0.5">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_408px] lg:items-start lg:gap-8">
        {/* MAIN — description, snapshot, Diálogo. */}
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <Skeleton className="order-4 h-28 w-full rounded-2xl lg:order-none" />
          <Skeleton className="order-5 h-40 w-full rounded-2xl lg:order-none" />
          <Skeleton className="order-8 h-72 w-full rounded-2xl lg:order-none" />
        </div>

        {/* RAIL — Ações, Detalhes, Responsáveis, the side case card. */}
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <Skeleton className="order-1 h-32 w-full rounded-2xl lg:order-none" />
          <Skeleton className="order-3 h-64 w-full rounded-2xl lg:order-none" />
          <Skeleton className="order-6 h-28 w-full rounded-2xl lg:order-none" />
          <Skeleton className="order-7 h-28 w-full rounded-2xl lg:order-none" />
        </div>
      </div>
    </div>
  );
}
