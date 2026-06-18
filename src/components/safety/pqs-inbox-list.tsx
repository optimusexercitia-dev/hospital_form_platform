"use client";

import Link from "next/link";
import { Building2, CalendarClock, FolderOpen, Inbox } from "lucide-react";

import type { PqsInboxItem } from "@/lib/safety/types";
import { EventStatusChip, OwnerChip, SuspectedHarmChip } from "./event-chips";
import { SafetyMotion } from "./safety-motion";
import { formatDate, formatEventCode } from "./format";

function InboxCard({
  item,
  commissionName,
}: {
  item: PqsInboxItem;
  /** Resolved reporting-committee name (the row carries only the id + a nullable name). */
  commissionName: string | null;
}) {
  return (
    <li data-rise>
      <Link
        href={`/admin/nsp/${item.id}`}
        className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-border/80 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">
              {formatEventCode(item.code)}
            </span>
            <h3 className="text-lg leading-snug text-balance">{item.title}</h3>
          </div>
          <EventStatusChip status={item.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SuspectedHarmChip level={item.suspectedHarmLevel} />
          <OwnerChip ownerKind={item.currentOwnerKind} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 aria-hidden="true" className="size-4" />
            {commissionName ?? "Comissão"}
          </span>
          {item.caseNumber != null && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <FolderOpen aria-hidden="true" className="size-4" />
              Caso {String(item.caseNumber).padStart(4, "0")}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarClock aria-hidden="true" className="size-4" />
            {formatDate(item.reportedAt)}
          </span>
        </div>
      </Link>
    </li>
  );
}

/**
 * The NSP inbox/queue list (F3): one card per {@link PqsInboxItem}, newest-first,
 * each linking to the event detail (`/admin/nsp/[eventId]`) where the analyst
 * acknowledges and (in scope) opens the audited PHI panel. PHI-FREE — the queue
 * shows governance metadata only.
 *
 * Fed plain props by the Server page; `commissionNames` resolves the reporting-
 * committee id → name (the inbox row's `reportingCommissionName` may be null).
 * Best-effort GSAP rise-in via {@link SafetyMotion}, keyed on the filter
 * signature so a filter change re-runs the entrance; reduced-motion-safe.
 */
export function PqsInboxList({
  items,
  commissionNames,
  runKey,
}: {
  items: PqsInboxItem[];
  /** Map of reporting-commission id → display name (server-resolved). */
  commissionNames: Record<string, string>;
  /** Re-runs the entrance when it changes (the active filter signature). */
  runKey: string;
}) {
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
    <SafetyMotion runKey={runKey}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <InboxCard
            key={item.id}
            item={item}
            commissionName={
              item.reportingCommissionName ??
              commissionNames[item.reportingCommissionId] ??
              null
            }
          />
        ))}
      </ul>
    </SafetyMotion>
  );
}
