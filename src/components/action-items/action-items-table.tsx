"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import type {
  ActionItemSource,
  MyActionItem,
} from "@/lib/queries/action-items";
import {
  ActionItemSourceBadge,
  ActionItemStatusBadge,
} from "./action-item-badges";
import { formatDateTime, formatDueDate, isOverdue } from "./format";

/**
 * The interactive island of "Meus itens de ação" (`"use client"` — the server
 * page fetches the rows and passes them as plain props, mirroring the
 * WizardRunner / cases-table boundary). Read-only: acting on an item happens on
 * its linked source page.
 *
 * Client behaviors:
 *  - default filter = ACTIVE only (open + in_progress), a toggle reveals
 *    done + cancelled;
 *  - a source-type filter (Caso / Reunião / ambos);
 *  - default sort = due date ASC with overdue first and no-deadline last, then
 *    createdAt DESC — computed here, independent of the server's ordering.
 *
 * The link target per row is member-reachable by design: a case links to the
 * member case detail (`casos/{caseId}`, opened by any reader incl. an action-item
 * assignee), NOT the coordinator `manage/cases/...` route which would 404 for a
 * plain staff assignee. The case link is suppressed (rendered as plain text) when
 * `caseDetailLinkable` is false (the `case_access` flag is OFF and that route
 * 404s); the number + label still show.
 */
export function ActionItemsTable({
  org,
  commission,
  items,
  caseDetailLinkable,
}: {
  org: string;
  commission: string;
  items: MyActionItem[];
  /** Whether the member case-detail route (`casos/{id}`) is reachable (flag ON). */
  caseDetailLinkable: boolean;
}) {
  // Default: hide done/cancelled (show active only). Toggle reveals all.
  const [showResolved, setShowResolved] = useState(false);
  // Source-type filter: "all" | "case" | "meeting".
  const [sourceFilter, setSourceFilter] = useState<"all" | ActionItemSource>(
    "all",
  );

  const rows = useMemo(() => {
    const filtered = items.filter((item) => {
      const isActive = item.status === "open" || item.status === "in_progress";
      if (!showResolved && !isActive) return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      return true;
    });
    return [...filtered].sort(compareItems);
  }, [items, showResolved, sourceFilter]);

  // Counts for the empty-state messaging: distinguish "no items at all" from
  // "none match the current filters".
  const hasAnyItems = items.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Filters
        showResolved={showResolved}
        onToggleResolved={setShowResolved}
        sourceFilter={sourceFilter}
        onSourceFilter={setSourceFilter}
      />

      {rows.length === 0 ? (
        <EmptyState hasAnyItems={hasAnyItems} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">
              Itens de ação atribuídos a você, com origem, datas, prazo, status e
              autor.
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <Th className="w-[32%]">Título</Th>
                <Th>Gerado de</Th>
                <Th>Criado em</Th>
                <Th>Prazo</Th>
                <Th>Status</Th>
                <Th>Atribuído por</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <ItemRow
                  key={`${item.source}-${item.id}`}
                  org={org}
                  commission={commission}
                  item={item}
                  caseDetailLinkable={caseDetailLinkable}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Default order: overdue items first; then by due date ascending; items with no
 * deadline last; ties broken by createdAt descending (newest first). "Overdue"
 * only applies to active items — a done/cancelled item is never overdue, so it
 * sorts by its due date like any other dated row.
 */
function compareItems(a: MyActionItem, b: MyActionItem): number {
  const aOverdue = isOverdue(a.dueDate, a.status);
  const bOverdue = isOverdue(b.dueDate, b.status);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

  // No-deadline rows sink below any dated row.
  const aHasDue = a.dueDate !== null;
  const bHasDue = b.dueDate !== null;
  if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;

  if (aHasDue && bHasDue && a.dueDate !== b.dueDate) {
    // Both are `YYYY-MM-DD`; lexical compare equals chronological compare.
    return a.dueDate! < b.dueDate! ? -1 : 1;
  }

  // Tie-break: newest created first.
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

const SOURCE_OPTIONS: { value: "all" | ActionItemSource; label: string }[] = [
  { value: "all", label: "Ambos" },
  { value: "case", label: "Caso" },
  { value: "meeting", label: "Reunião" },
];

function Filters({
  showResolved,
  onToggleResolved,
  sourceFilter,
  onSourceFilter,
}: {
  showResolved: boolean;
  onToggleResolved: (next: boolean) => void;
  sourceFilter: "all" | ActionItemSource;
  onSourceFilter: (next: "all" | ActionItemSource) => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      {/* Source-type filter — a labeled radio group (keyboard-operable segmented
          control). */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium tracking-wide text-muted-foreground">
          Origem
        </legend>
        <div
          role="radiogroup"
          aria-label="Filtrar por origem"
          className="inline-flex rounded-lg border border-border bg-card p-0.5"
        >
          {SOURCE_OPTIONS.map((opt) => {
            const active = sourceFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSourceFilter(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Resolved toggle — a labeled checkbox. Default off = active items only. */}
      <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium select-none">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => onToggleResolved(e.target.checked)}
          className="size-4 rounded border-input text-primary accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        />
        Mostrar concluídos e cancelados
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ItemRow({
  org,
  commission,
  item,
  caseDetailLinkable,
}: {
  org: string;
  commission: string;
  item: MyActionItem;
  caseDetailLinkable: boolean;
}) {
  const overdue = isOverdue(item.dueDate, item.status);

  return (
    <tr className="border-b border-border/70 align-top last:border-b-0 hover:bg-muted/30">
      {/* Título + inline description preview. */}
      <Td>
        <span className="font-medium text-foreground">{item.title}</span>
        {item.description ? (
          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {item.description}
          </span>
        ) : null}
      </Td>

      {/* Gerado de = neutral type badge + clickable label to the source detail. */}
      <Td>
        <SourceCell
          org={org}
          commission={commission}
          item={item}
          caseDetailLinkable={caseDetailLinkable}
        />
      </Td>

      {/* Criado em = date + time. */}
      <Td className="whitespace-nowrap text-muted-foreground tabular-nums">
        {formatDateTime(item.createdAt)}
      </Td>

      {/* Prazo = date only; overdue active items get a red icon+text flag. */}
      <Td className="whitespace-nowrap tabular-nums">
        {item.dueDate ? (
          overdue ? (
            <span className="inline-flex items-center gap-1 font-medium text-destructive">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              {formatDueDate(item.dueDate)}
              <span className="sr-only">(em atraso)</span>
            </span>
          ) : (
            <span className="text-foreground">{formatDueDate(item.dueDate)}</span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Td>

      {/* Status. */}
      <Td>
        <ActionItemStatusBadge status={item.status} />
      </Td>

      {/* Atribuído por. */}
      <Td className="text-muted-foreground">
        {item.createdByName ?? "—"}
      </Td>
    </tr>
  );
}

/**
 * The "Gerado de" cell: the neutral Caso/Reunião badge followed by a link to the
 * source detail. Case → `casos/{caseId}` (member-reachable) when linkable; else
 * plain text. Meeting → `meetings/{meetingId}` (member-reachable).
 */
function SourceCell({
  org,
  commission,
  item,
  caseDetailLinkable,
}: {
  org: string;
  commission: string;
  item: MyActionItem;
  caseDetailLinkable: boolean;
}) {
  if (item.source === "case") {
    const numberLabel =
      item.caseNumber != null
        ? `Caso ${String(item.caseNumber).padStart(4, "0")}`
        : "Caso";
    const text = item.caseLabel ? `${numberLabel} — ${item.caseLabel}` : numberLabel;
    const href =
      caseDetailLinkable && item.caseId
        ? commissionHref(org, commission, "casos", item.caseId)
        : null;

    return (
      <div className="flex flex-col gap-1">
        <ActionItemSourceBadge source="case" />
        {href ? (
          <SourceLink href={href}>{text}</SourceLink>
        ) : (
          <span className="text-sm text-foreground">{text}</span>
        )}
      </div>
    );
  }

  // Meeting.
  const numberLabel =
    item.meetingNumber != null
      ? `Reunião ${String(item.meetingNumber).padStart(4, "0")}`
      : "Reunião";
  const dateLabel = item.meetingScheduledStart
    ? formatDateTime(item.meetingScheduledStart)
    : null;
  const text = dateLabel ? `${numberLabel} — ${dateLabel}` : numberLabel;
  const href = item.meetingId
    ? commissionHref(org, commission, "meetings", item.meetingId)
    : null;

  return (
    <div className="flex flex-col gap-1">
      <ActionItemSourceBadge source="meeting" />
      {href ? (
        <SourceLink href={href}>{text}</SourceLink>
      ) : (
        <span className="text-sm text-foreground">{text}</span>
      )}
    </div>
  );
}

function SourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span className="underline-offset-2 group-hover:underline">{children}</span>
      <ArrowUpRight
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Table cell primitives + empty state
// ---------------------------------------------------------------------------

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3", className)}>
      <div className="flex flex-col">{children}</div>
    </td>
  );
}

function EmptyState({ hasAnyItems }: { hasAnyItems: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <h2 className="text-base font-semibold">
        {hasAnyItems
          ? "Nenhum item corresponde aos filtros"
          : "Você não tem itens de ação atribuídos"}
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground text-pretty">
        {hasAnyItems
          ? "Ajuste a origem ou mostre os itens concluídos e cancelados para ver mais."
          : "Quando a coordenação atribuir uma tarefa a você em um caso ou reunião, ela aparecerá aqui."}
      </p>
    </div>
  );
}
