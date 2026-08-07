import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming placeholder for the verification answer. Mirrors
 * `VerificationResult`'s layout — seal, heading block, detail card — so the
 * verdict lands in place instead of shifting the page under someone who is
 * mid-read.
 *
 * Announced politely rather than silently: on this page the wait itself is
 * information, and a screen-reader user must not be left with an empty region
 * while the lookup runs.
 */
export default function VerificacaoLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-7"
    >
      <span className="sr-only">Verificando o documento…</span>

      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Skeleton className="size-18 shrink-0 rounded-full" />
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-56" />
        </div>
      </div>
    </div>
  );
}
