"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";

/**
 * Date-range filter for the oversight dashboards. URL-driven (`?from=&to=`) so
 * the Server Component re-queries — no client data fetching.
 *
 * ⚠ THIS IS NOT `DashboardFilters`, AND THE DIFFERENCE IS THE POINT. The
 * commission dashboard's filter bar renders a CSV export link into
 * `/c/[commission]/dashboard/export`, which is `dashboard_export_rows` — one of
 * the three ROW-LEVEL doors ADR 0100 D11 deliberately leaves closed to the
 * reviewer, on a route the reviewer 404s. Reusing that component would have
 * shipped a visible affordance that is denied twice over. So this is the same
 * date range with the export removed, not a variant flag on the original.
 */
export function QualityDashboardFilters({
  from,
  to,
}: {
  from: string | null;
  to: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromId = useId();
  const toId = useId();

  function setRange(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const hasRange = Boolean(from || to);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={fromId}
          className="text-xs font-medium text-muted-foreground"
        >
          De
        </label>
        <input
          id={fromId}
          type="date"
          value={from ?? ""}
          onChange={(e) => setRange("from", e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={toId}
          className="text-xs font-medium text-muted-foreground"
        >
          Até
        </label>
        <input
          id={toId}
          type="date"
          value={to ?? ""}
          onChange={(e) => setRange("to", e.target.value)}
          className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        />
      </div>
      {hasRange ? (
        <button
          type="button"
          onClick={clear}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Limpar período
        </button>
      ) : null}
    </div>
  );
}
