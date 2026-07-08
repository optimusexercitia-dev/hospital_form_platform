"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

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
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    // Any filter change invalidates the keyset cursor (it encodes a position in
    // the OLD result set), so reset to the first page (WS-6 P3).
    next.delete("cursor");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const hasAnyFilter = Boolean(status || priority || commission);


  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs transition-opacity duration-200",
        isPending && "opacity-60",
      )}
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={statusId}>Estado</Label>
          <NativeSelect
            id={statusId}
            value={status ?? ""}
            onChange={(e) => setParam("status", e.target.value)}
            disabled={isPending}
            className="min-w-44"
          >
            <option value="">Em aberto (padrão)</option>
            {statusOptions.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={priorityId}>Dano suspeito</Label>
          <NativeSelect
            id={priorityId}
            value={priority ?? ""}
            onChange={(e) => setParam("priority", e.target.value)}
            disabled={isPending}
            className="min-w-44"
          >
            <option value="">Todos</option>
            {priorityOptions.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={commissionId}>Comissão notificante</Label>
          <NativeSelect
            id={commissionId}
            value={commission ?? ""}
            onChange={(e) => setParam("commission", e.target.value)}
            disabled={isPending}
            className="min-w-44"
          >
            <option value="">Todas as comissões</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {hasAnyFilter && (
        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={isPending}
          >
            <X aria-hidden="true" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
