"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** A commission option for the reporting-committee filter. */
export interface InboxCommissionOption {
  id: string;
  name: string;
}

/** A `[slug, pt-BR label]` option for the status / priority dropdowns. Passed
 * from the Server Component (the frozen label-map entries) as plain data — a
 * client component must not value-import the server-only query module. */
export type InboxLabelOption = readonly [slug: string, label: string];

/**
 * The NSP inbox filter bar (F3): status, priority (suspected harm), and reporting
 * committee. URL-driven (`?status=&priority=&commission=`) so the Server
 * Component re-queries. The status/priority dropdowns are driven by the FROZEN
 * label-map ENTRIES passed from the server, so an additively-added slug appears
 * automatically. Every control has an associated `<label>` + the project focus
 * ring (keyboard-operable).
 */
export function PqsInboxFiltersBar({
  statusOptions,
  priorityOptions,
  commissions,
  status,
  priority,
  commission,
}: {
  statusOptions: InboxLabelOption[];
  priorityOptions: InboxLabelOption[];
  commissions: InboxCommissionOption[];
  status: string | null;
  priority: string | null;
  commission: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusId = useId();
  const priorityId = useId();
  const commissionId = useId();

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

  const hasAnyFilter = Boolean(status || priority || commission);

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
            <option value="">Em aberto (padrão)</option>
            {statusOptions.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={priorityId}>Dano suspeito</Label>
          <select
            id={priorityId}
            value={priority ?? ""}
            onChange={(e) => setParam("priority", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todos</option>
            {priorityOptions.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={commissionId}>Comissão notificante</Label>
          <select
            id={commissionId}
            value={commission ?? ""}
            onChange={(e) => setParam("commission", e.target.value)}
            className={selectClasses}
          >
            <option value="">Todas as comissões</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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
