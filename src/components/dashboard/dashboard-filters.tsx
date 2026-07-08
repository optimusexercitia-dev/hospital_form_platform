"use client";

import { commissionHref } from "@/lib/routing";
import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";

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
  org,
  slug,
  selectedFormId,
  from,
  to,
}: {
  /** Org slug for hrefs. */
  org: string;
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
  const [isPending, startTransition] = useTransition();

  function setParam(key: "from" | "to", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function clearRange() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("from");
    next.delete("to");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  const hasRange = Boolean(from || to);

  // The export URL mirrors the current filter so the CSV matches what's on screen.
  const exportParams = new URLSearchParams();
  if (selectedFormId) exportParams.set("form", selectedFormId);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  const exportHref = `${commissionHref(org, slug, "dashboard", "export")}?${exportParams.toString()}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-end sm:justify-between">
      <div
        className={cn(
          "flex flex-wrap items-end gap-3 transition-opacity duration-200",
          isPending && "opacity-60",
        )}
        aria-busy={isPending}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fromId}>De</Label>
          <DatePicker
            id={fromId}
            value={from ?? ""}
            onChange={(v) => setParam("from", v)}
            max={to ?? undefined}
            disabled={isPending}
            className="w-auto"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={toId}>Até</Label>
          <DatePicker
            id={toId}
            value={to ?? ""}
            onChange={(v) => setParam("to", v)}
            min={from ?? undefined}
            disabled={isPending}
            className="w-auto"
          />
        </div>
        {hasRange && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearRange}
            disabled={isPending}
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
