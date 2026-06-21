import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the commission referrals hub. The commission shell persists;
 * this skeletons the header and the two direction sections (Recebidos + Enviados),
 * each with a filter bar and a table block.
 */
export default function CommissionReferralsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-full max-w-prose" />
      </div>
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="flex flex-col gap-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
