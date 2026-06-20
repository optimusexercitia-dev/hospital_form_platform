"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronsUpDown,
  FolderOpen,
  Inbox,
} from "lucide-react";

import type { PqsInboxItem } from "@/lib/safety/types";
import { cn } from "@/lib/utils";
import { EventStatusChip, OwnerChip, SuspectedHarmChip } from "./event-chips";
import { SafetyMotion } from "./safety-motion";
import { formatDate, formatEventCode } from "./format";

type SortKey = "evento" | "status" | "notificado";
type SortDir = "asc" | "desc";

// Status sort rank = the lifecycle order (matches the inbox's default ordering).
const STATUS_RANK: Record<PqsInboxItem["status"], number> = {
  reported: 0,
  acknowledged: 1,
  triaged: 2,
  closed: 3,
  cancelled: 4,
};

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3",
            active ? "text-foreground" : "text-muted-foreground/60",
          )}
        />
      </button>
    </th>
  );
}

/**
 * The NSP inbox/queue list (F3): a sortable, scannable table — one row per
 * {@link PqsInboxItem}, each linking to the event detail (`/admin/nsp/[eventId]`)
 * where the analyst acknowledges and (in scope) opens the audited PHI panel.
 * PHI-FREE — the queue shows governance metadata only.
 *
 * Mirrors the coordinator cases board (`cases-table.tsx`): a rounded card with a
 * muted header row, clickable striped rows, and sortable Evento/Status/Notificado
 * columns. Fed plain props by the Server page; `commissionNames` resolves the
 * reporting- and holding-committee ids → names. Best-effort GSAP rise-in via
 * {@link SafetyMotion}, keyed on the filter signature so a filter change re-runs
 * the entrance; reduced-motion-safe.
 */
export function PqsInboxList({
  items,
  commissionNames,
  runKey,
}: {
  items: PqsInboxItem[];
  /** Map of commission id → display name (server-resolved). */
  commissionNames: Record<string, string>;
  /** Re-runs the entrance when it changes (the active filter signature). */
  runKey: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "notificado",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "evento") cmp = a.code.localeCompare(b.code, "pt-BR");
      else if (sort.key === "status")
        cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      else
        cmp =
          new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime();
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [items, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  if (items.length === 0) {
    return (
      <section
        aria-label="Fila vazia"
        className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Nenhum evento na fila</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Eventos notificados pelas comissões aparecerão aqui para reconhecimento
          e triagem. Ajuste os filtros para ver eventos já encerrados.
        </p>
      </section>
    );
  }

  return (
    <SafetyMotion
      runKey={runKey}
      className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs"
    >
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <SortHeader
              label="Evento"
              active={sort.key === "evento"}
              dir={sort.dir}
              onClick={() => toggle("evento")}
            />
            <SortHeader
              label="Status"
              active={sort.key === "status"}
              dir={sort.dir}
              onClick={() => toggle("status")}
            />
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Gravidade
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Responsável
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Comissão
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Caso
            </th>
            <SortHeader
              label="Notificado"
              active={sort.key === "notificado"}
              dir={sort.dir}
              onClick={() => toggle("notificado")}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const href = `/admin/nsp/${item.id}`;
            const commissionName =
              item.reportingCommissionName ??
              commissionNames[item.reportingCommissionId] ??
              null;
            const ownerCommissionName = item.currentOwnerCommissionId
              ? (commissionNames[item.currentOwnerCommissionId] ?? null)
              : null;
            return (
              <tr
                key={item.id}
                data-rise
                onClick={() => router.push(href)}
                className="cursor-pointer border-b border-border/70 odd:bg-card even:bg-muted/20 transition-colors hover:bg-accent/40"
              >
                <td className="max-w-[22rem] px-3 py-2.5 align-middle">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="flex min-w-0 flex-col gap-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatEventCode(item.code)}
                    </span>
                    <span className="truncate font-medium text-foreground">
                      {item.title}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <EventStatusChip status={item.status} />
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <SuspectedHarmChip level={item.suspectedHarmLevel} />
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <OwnerChip
                    ownerKind={item.currentOwnerKind}
                    commissionName={ownerCommissionName}
                  />
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Building2 aria-hidden="true" className="size-4" />
                    {commissionName ?? "Comissão"}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {item.caseNumber != null ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                      <FolderOpen aria-hidden="true" className="size-4" />
                      {String(item.caseNumber).padStart(4, "0")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatDate(item.reportedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </SafetyMotion>
  );
}
