"use client";

import { useMemo, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";

import type { PqsInboxItem } from "@/lib/safety/types";
import type { EventStatus, SuspectedHarmLevel } from "@/lib/safety/types";
import { cn } from "@/lib/utils";
import { formatDate, formatEventCode } from "../format";
import { priorityDotClass, sourceChipClass } from "./triage-visuals";

/** The reporter's suspected harm → a coarse queue priority. */
function priorityOf(level: SuspectedHarmLevel): "high" | "medium" | "low" {
  switch (level) {
    case "severe":
    case "death":
      return "high";
    case "moderate":
    case "mild":
      return "medium";
    default:
      return "low";
  }
}

/**
 * The queue stage from the event lifecycle (the queue carries no worksheet, so the
 * coarse stage comes from `status`): `reported`/`acknowledged` are still awaiting a
 * confirmed triage; `triaged`/`closed`/`cancelled` are resolved.
 */
type QueueStage = "awaiting" | "triaged";
function stageOf(status: EventStatus): QueueStage {
  return status === "reported" || status === "acknowledged"
    ? "awaiting"
    : "triaged";
}

type FilterTab = "all" | "awaiting" | "triaged";

const STAGE_BADGE: Record<
  EventStatus,
  { label: string; className: string; rca?: boolean }
> = {
  reported: {
    label: "Aguardando triagem",
    className: "border-warning/30 bg-warning/12 text-warning",
  },
  acknowledged: {
    label: "Em triagem",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  triaged: {
    label: "Triado",
    className: "border-success/30 bg-success/12 text-success",
  },
  closed: {
    label: "Encerrado",
    className: "border-border bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Cancelado",
    className: "border-border bg-muted text-muted-foreground",
  },
};

function QueueCard({
  item,
  commissionName,
  selected,
  onSelect,
}: {
  item: PqsInboxItem;
  commissionName: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const priority = priorityOf(item.suspectedHarmLevel);
  const badge = STAGE_BADGE[item.status];

  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(item.id)}
        className={cn(
          "flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-xs transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          selected
            ? "border-primary/50 shadow-sm ring-1 ring-primary/20"
            : "border-border",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", priorityDotClass(priority))}
          />
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
              sourceChipClass(item.reportingCommissionId),
            )}
          >
            {commissionName ?? "Comissão"}
          </span>
          <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground tabular-nums">
            {formatDate(item.reportedAt)}
          </span>
        </div>

        <p className="line-clamp-2 text-sm leading-snug text-foreground text-pretty">
          {item.title}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[0.7rem] text-muted-foreground">
            {formatEventCode(item.code)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
              badge.className,
            )}
          >
            {item.status === "triaged" && (
              <RefreshCw aria-hidden="true" className="size-3" />
            )}
            {badge.label}
          </span>
        </div>
      </button>
    </li>
  );
}

/**
 * The intake QUEUE (left pane). Filterable by stage (Todos / Aguardando / Triados,
 * each with a count); selecting a card drives the workstation's `?event` selection.
 * PHI-FREE — it renders only governance metadata from {@link PqsInboxItem}.
 */
export function TriageQueue({
  items,
  commissionNames,
  selectedId,
  onSelect,
}: {
  items: PqsInboxItem[];
  commissionNames: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<FilterTab>("all");

  const counts = useMemo(() => {
    let awaiting = 0;
    let triaged = 0;
    for (const it of items) {
      if (stageOf(it.status) === "awaiting") awaiting++;
      else triaged++;
    }
    return { all: items.length, awaiting, triaged };
  }, [items]);

  const visible = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((it) =>
      tab === "awaiting"
        ? stageOf(it.status) === "awaiting"
        : stageOf(it.status) === "triaged",
    );
  }, [items, tab]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: counts.all },
    { key: "awaiting", label: "Aguardando", count: counts.awaiting },
    { key: "triaged", label: "Triados", count: counts.triaged },
  ];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Inbox aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Entrada de eventos</h2>
        {counts.awaiting > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full border border-warning/30 bg-warning/12 px-2 py-0.5 text-[0.7rem] font-medium text-warning tabular-nums">
            {counts.awaiting} novo{counts.awaiting === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Filtrar a fila por estágio"
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              tab === t.key
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="tabular-nums opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum evento neste filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
          {visible.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              commissionName={
                item.reportingCommissionName ??
                commissionNames[item.reportingCommissionId] ??
                null
              }
              selected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
