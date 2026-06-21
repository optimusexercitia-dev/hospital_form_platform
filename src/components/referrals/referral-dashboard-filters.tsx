"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** A commission option for the source / target filters. */
export interface DashboardCommissionOption {
  id: string;
  name: string;
}

/** A `[id, label]` option for the type filter / `[slug, label]` for status.
 * Passed from the Server Component as plain data (a client component must not
 * value-import the server-only query module). */
export type DashboardOption = readonly [value: string, label: string];

/**
 * The QPS referral-dashboard filter bar (Decision 13). URL-driven
 * (`?status=&source=&target=&type=&response=`) so the Server Component re-queries
 * + re-aggregates. Every control has an associated `<label>` + the project focus
 * ring (keyboard-operable). PHI-free — the dashboard never filters on patient
 * identifiers.
 */
export function ReferralDashboardFilters({
  statusOptions,
  typeOptions,
  commissions,
  status,
  source,
  target,
  type,
  response,
}: {
  statusOptions: DashboardOption[];
  typeOptions: DashboardOption[];
  commissions: DashboardCommissionOption[];
  status: string | null;
  source: string | null;
  target: string | null;
  type: string | null;
  response: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusId = useId();
  const sourceId = useId();
  const targetId = useId();
  const typeId = useId();
  const responseId = useId();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const hasAnyFilter = Boolean(status || source || target || type || response);

  const selectClasses = cn(
    "h-11 w-full min-w-44 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color]",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={statusId}>Estado</Label>
          <select
            id={statusId}
            value={status ?? ""}
            onChange={(e) => setParam("status", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {statusOptions.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={sourceId}>Origem</Label>
          <select
            id={sourceId}
            value={source ?? ""}
            onChange={(e) => setParam("source", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todas</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={targetId}>Destino</Label>
          <select
            id={targetId}
            value={target ?? ""}
            onChange={(e) => setParam("target", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todas</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={typeId}>Tipo</Label>
          <select
            id={typeId}
            value={type ?? ""}
            onChange={(e) => setParam("type", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {typeOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={responseId}>Resposta</Label>
          <select
            id={responseId}
            value={response ?? ""}
            onChange={(e) => setParam("response", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todas</option>
            <option value="true">Aguarda resposta</option>
            <option value="false">Apenas ciência</option>
          </select>
        </div>
      </div>

      {hasAnyFilter && (
        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            <X aria-hidden="true" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
