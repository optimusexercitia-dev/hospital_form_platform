"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * WS-6 (Wave 2 perf sweep) — pagination chrome for cursor-based `Page<T>`
 * lists (`src/lib/types/pagination.ts`, backend-owned).
 *
 * URL-driven, matching the shipped `AuditPagination` / `UserPagination`
 * convention: a `"use client"` control sets a searchParams value and the
 * Server Component re-queries with no server action and no client fetch.
 * This is deliberate on two counts:
 *  1. Consistency with the existing list-pagination pattern.
 *  2. BUG-AIF-001: on the Windows prod-standalone gate, non-redirect
 *     server-action responses are truncated (the body never arrives), so a
 *     "load more" that fetched the next page via a data-returning server
 *     action would hang exactly on the gate while passing on `dev`. Plain
 *     `router` navigation re-renders the Server Component with no action and
 *     no fetch → zero AIF-001 exposure.
 *
 * The cursor is opaque and forward-only (a Postgres keyset cursor), so there is
 * no total/page-count to render a "Página X de Y" summary from. We render a
 * single forward "Próxima página" control that pushes `?cursor=<nextCursor>`
 * (via `push`, not `replace`, so browser-Back returns to the prior page) and
 * renders `null` once `nextCursor` is null (last page). Forward-only + browser-
 * Back is the pilot UX; there is no speculative client-side cursor stack.
 *
 * Purely presentational otherwise: the Server Component reads
 * `searchParams.cursor`, passes it to the list fn as `page.cursor`, and hands
 * the returned `nextCursor` back here.
 */
export function CursorPagination({
  nextCursor,
  paramName = "cursor",
  label = "Próxima página",
  className,
}: {
  /** `page.nextCursor` — the opaque cursor for the next page, or `null` on the
   * last page (in which case this renders nothing). */
  nextCursor: string | null;
  /** The searchParams key that carries the cursor (default `cursor`). */
  paramName?: string;
  /** pt-BR button label. */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Last page — render nothing rather than a disabled dead end.
  if (nextCursor === null) return null;

  function goToNext() {
    const params = new URLSearchParams(searchParams.toString());
    // `nextCursor` is non-null here (guarded above); assert for TS.
    params.set(paramName, nextCursor as string);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex items-center justify-center pt-2", className)}
    >
      <Button type="button" variant="outline" onClick={goToNext}>
        {label}
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
