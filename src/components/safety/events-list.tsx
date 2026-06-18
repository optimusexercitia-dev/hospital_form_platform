"use client";

import { useMemo, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";

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

function EventCard({
  event,
  index,
}: {
  event: SafetyEventListItem;
  index: number;
}) {
  return (
    <li
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
      style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            {formatEventCode(event.code)}
            {event.caseNumber != null
              ? ` · Caso ${String(event.caseNumber).padStart(4, "0")}`
              : ""}
          </span>
          <h3 className="text-lg leading-snug text-balance">{event.title}</h3>
        </div>
        <EventStatusChip status={event.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SuspectedHarmChip level={event.suspectedHarmLevel} />
        <OwnerChip ownerKind={event.currentOwnerKind} />
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        Notificado em {formatDate(event.reportedAt)}
      </p>
    </li>
  );
}

/**
 * The committee read-back list (F2): the events this commission reported OR
 * currently holds, with a status filter. PHI-FREE by construction — it shows only
 * governance metadata (code, title, status, owner, when). Fed plain props by the
 * Server page; RLS already scoped the data (a foreign committee gets `[]`).
 *
 * Rows are NOT links: in 14a the committee has read-back status only; the working
 * detail (and any PHI) lives in the access-audited NSP workspace under `/admin/nsp`.
 */
export function EventsList({ events }: { events: SafetyEventListItem[] }) {
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");

  const filtered = useMemo(
    () =>
      events.filter(
        (e) => statusFilter === "all" || e.status === statusFilter,
      ),
    [events, statusFilter],
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
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((e, i) => (
            <EventCard key={e.id} event={e} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}
