import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for "minhas respostas". Skeletons the header and a stack of
 * response rows.
 */
export default function MyResponsesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
