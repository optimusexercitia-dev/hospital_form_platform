import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the technical-direction area (inbox + referral detail).
 *
 * ⚠ Unlike the commission hub's skeleton, this mirrors ONE section, not two: the
 * office is a destination only and can never author a referral, so there is no
 * "Enviados" half to stand in for. A two-block skeleton would promise a surface that
 * resolves to nothing.
 *
 * There is no org shell above this route (`/o/[org]` has no layout), so the skeleton
 * carries its own page padding to match the pages it stands in for.
 */
export default function TechnicalDirectionLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-96" />
        <Skeleton className="h-5 w-full max-w-prose" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}
