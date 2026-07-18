import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton for the "Processo ético" tab — mirrors the real layout
 * (a coordinator-controls card + procedure section cards) so the swap-in is
 * seamless. The global reduced-motion guard freezes the pulse for opted-out users.
 */
export default function EthicsProcedureLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          <Skeleton className="h-6 w-52" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
