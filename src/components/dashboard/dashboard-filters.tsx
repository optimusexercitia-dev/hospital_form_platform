"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * F3 — date-range filter + CSV export.
 *
 * The range is URL-driven (`?from=&to=`): changing a date pushes to the URL and
 * the Server Component re-queries `getFormDashboard` with the new range (no
 * client data fetching). Both inputs are native `<input type="date">` with an
 * associated `<label>` and the project focus ring, so the whole control is
 * keyboard-operable.
 *
 * The CSV export is a real `<a download>` pointing at backend's export ROUTE
 * (`/c/[slug]/dashboard/export`, owned by backend) carrying the current
 * form + range params. We build the bytes nowhere on the client — the route owns
 * the pt-BR header row and the raw submitted rows.
 */
export function DashboardFilters({
  slug,
  selectedFormId,
  from,
  to,
}: {
  slug: string;
  selectedFormId: string | null;
  from: string | null;
  to: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromId = useId();
  const toId = useId();

  function setParam(key: "from" | "to", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearRange() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("from");
    next.delete("to");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const hasRange = Boolean(from || to);

  // The export URL mirrors the current filter so the CSV matches what's on screen.
  const exportParams = new URLSearchParams();
  if (selectedFormId) exportParams.set("form", selectedFormId);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  const exportHref = `/c/${slug}/dashboard/export?${exportParams.toString()}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fromId}>De</Label>
          <Input
            id={fromId}
            type="date"
            value={from ?? ""}
            max={to ?? undefined}
            onChange={(e) => setParam("from", e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={toId}>Até</Label>
          <Input
            id={toId}
            type="date"
            value={to ?? ""}
            min={from ?? undefined}
            onChange={(e) => setParam("to", e.target.value)}
            className="w-auto"
          />
        </div>
        {hasRange && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearRange}
          >
            <X aria-hidden="true" />
            Limpar período
          </Button>
        )}
      </div>

      <Button
        asChild
        variant="outline"
        // No client-side download attribute trickery — the route sets
        // Content-Disposition; this is just a normal download link.
      >
        <a href={exportHref} download>
          <Download aria-hidden="true" />
          Exportar CSV
        </a>
      </Button>
    </div>
  );
}
