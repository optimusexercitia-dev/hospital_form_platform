import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the CAPA workspace — header + wheel + actions/measures. */
export default function NspCapaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}
