import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the commission area — a calm skeleton of the shell so the
 * layout doesn't pop. Shown while the layout resolves access + the page loads.
 */
export default function CommissionLoading() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
          <div className="ml-2 hidden gap-2 md:flex">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="ml-auto size-9 rounded-full" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
