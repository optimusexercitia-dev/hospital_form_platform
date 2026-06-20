"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FileText,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";

import {
  EVENT_STATUS_LABELS,
  type EventStatus,
  type SafetyEventListItem,
} from "@/lib/safety/types";
import { cn } from "@/lib/utils";
import { EventStatusChip, OwnerChip, SuspectedHarmChip } from "./event-chips";
import { formatDate, formatEventCode } from "./format";

/** Status filter options in lifecycle order; "all" is the default sentinel. */
const STATUS_FILTER_ORDER: EventStatus[] = [
  "reported",
  "acknowledged",
  "triaged",
  "closed",
  "cancelled",
];

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

type SortKey = "evento" | "status" | "notificado";
type SortDir = "asc" | "desc";

// Status sort rank = the lifecycle order.
const STATUS_RANK: Record<EventStatus, number> = Object.fromEntries(
  STATUS_FILTER_ORDER.map((s, i) => [s, i]),
) as Record<EventStatus, number>;

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
 * The committee read-back list (F2): the events this commission reported OR
 * currently holds, as a sortable, scannable table with a status filter. PHI-FREE
 * by construction — it shows only governance metadata (code, title, status,
 * severity, owner, case, when). Fed plain props by the Server page; RLS already
 * scoped the data (a foreign committee gets `[]`).
 *
 * Mirrors the coordinator cases board (`cases-table.tsx`): a rounded card with a
 * muted header row, striped rows, and sortable Evento/Status/Notificado columns.
 * Rows are NOT links: in 14a the committee has read-back status only; the working
 * detail (and any PHI) lives in the access-audited NSP workspace under `/admin/nsp`.
 */
export function EventsList({ events }: { events: SafetyEventListItem[] }) {
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "notificado",
    dir: "desc",
  });

  const filtered = useMemo(
    () =>
      events.filter(
        (e) => statusFilter === "all" || e.status === statusFilter,
      ),
    [events, statusFilter],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
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
  }, [filtered, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Estado</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as EventStatus | "all")
            }
            className={SELECT_CLASS}
            aria-label="Filtrar por estado"
          >
            <option value="all">Todos</option>
            {STATUS_FILTER_ORDER.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <span
          className={cn(
            "ml-auto text-sm text-muted-foreground tabular-nums",
            filtered.length === 0 && "text-muted-foreground/70",
          )}
        >
          {filtered.length} {filtered.length === 1 ? "evento" : "eventos"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <section
          aria-label="Nenhum evento"
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {statusFilter === "all" ? (
              <ShieldCheck aria-hidden="true" className="size-6" />
            ) : (
              <FileText aria-hidden="true" className="size-6" />
            )}
          </span>
          <h2 className="text-lg font-semibold">
            {statusFilter === "all"
              ? "Nenhum evento notificado"
              : "Nenhum evento neste estado"}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {statusFilter === "all"
              ? "Eventos de segurança notificados ao NSP por esta comissão aparecerão aqui, com o estado atualizado."
              : "Ajuste o filtro de estado para ver outros eventos."}
          </p>
        </section>
      ) : (
        <div className="animate-fade-in overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[760px] border-collapse text-sm">
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
              {sorted.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-border/70 odd:bg-card even:bg-muted/20 transition-colors hover:bg-muted/30"
                >
                  <td className="max-w-[22rem] px-3 py-2.5 align-middle">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatEventCode(event.code)}
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {event.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <EventStatusChip status={event.status} />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <SuspectedHarmChip level={event.suspectedHarmLevel} />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <OwnerChip ownerKind={event.currentOwnerKind} />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    {event.caseNumber != null ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                        <FolderOpen aria-hidden="true" className="size-4" />
                        {String(event.caseNumber).padStart(4, "0")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDate(event.reportedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
