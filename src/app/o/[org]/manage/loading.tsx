import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the org-management area content. The `/o/[org]/manage` layout
 * (header/nav) persists; this fills the main region with a calm skeleton of a
 * registry-style page (header + a form panel + a card grid) so the layout doesn't
 * pop while the org-scoped data resolves.
 */
export default function OrgManageLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <Skeleton className="h-56 w-full rounded-2xl" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
