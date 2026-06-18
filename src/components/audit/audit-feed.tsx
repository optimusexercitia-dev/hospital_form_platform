"use client";

import { Building2, Cpu } from "lucide-react";

import type { AuditLogEntry } from "@/lib/queries/audit";

import { AuditMotion } from "./audit-motion";
import { EntityIcon } from "./audit-icon";
import { useClientNow } from "./use-client-now";
import {
  actionLabel,
  entityLabel,
  formatAbsolute,
  formatRelative,
  parseMetadataDiff,
  shortEntityRef,
  type AuditLabelMap,
} from "./audit-meta";

/**
 * The audit timeline — one row per {@link AuditLogEntry}, newest-first, on a
 * continuous spine (reuses the case-timeline feed's visual language without
 * coupling to its case-specific event model). Each row shows: the actor
 * (or "Sistema" for a null actor), the pt-BR action label, the entity type + a
 * short reference, the `summary`, a relative + absolute timestamp, and the
 * `metadata` diff rendered GENERICALLY as key / "antes" → "depois".
 *
 * READ-ONLY: no row is interactive (the log is append-only and there is nothing
 * to drill into) — so rows are plain `<li>`s, not buttons. Pure presentational:
 * a function of the entries; the entrance is best-effort GSAP (reduced-motion
 * guarded) layered over the visible baseline.
 *
 * `showCommission` adds the commission column for the admin cross-commission view
 * (a global/admin row with no commission renders "—").
 */
export function AuditFeed({
  entries,
  actionLabels,
  entityLabels,
  showCommission = false,
  runKey,
}: {
  entries: AuditLogEntry[];
  /** pt-BR action label map (from the server — see `audit-meta.ts` rationale). */
  actionLabels: AuditLabelMap;
  /** pt-BR entity-type label map (from the server). */
  entityLabels: AuditLabelMap;
  showCommission?: boolean;
  /** Re-runs the entrance animation when it changes (the active page number). */
  runKey: string;
}) {
  // A single client "now" (null until hydration) shared by every row so the
  // relative timestamps agree. See `use-client-now.ts` for why it's a store, not
  // a render-time `Date.now()`.
  const now = useClientNow();

  return (
    <AuditMotion runKey={runKey}>
      <ol
        className="relative flex flex-col gap-3"
        aria-label="Registros de auditoria"
      >
        {entries.map((entry) => (
          <AuditRow
            key={entry.id}
            entry={entry}
            actionLabels={actionLabels}
            entityLabels={entityLabels}
            showCommission={showCommission}
            now={now}
          />
        ))}
      </ol>
    </AuditMotion>
  );
}

function AuditRow({
  entry,
  actionLabels,
  entityLabels,
  showCommission,
  now,
}: {
  entry: AuditLogEntry;
  actionLabels: AuditLabelMap;
  entityLabels: AuditLabelMap;
  showCommission: boolean;
  /** Client "now" (ms); `null` before mount — render the absolute date only. */
  now: number | null;
}) {
  const isSystem = entry.actorId === null;
  const actorDisplay = isSystem
    ? "Sistema"
    : (entry.actorName ?? "Usuário removido");
  const diff = parseMetadataDiff(entry.metadata);

  return (
    <li
      data-rise
      className="grid grid-cols-[1.875rem_1fr] items-stretch"
    >
      {/* Spine + node */}
      <div className="relative flex justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
        />
        <span
          aria-hidden="true"
          className="relative z-10 mt-1.5 inline-flex size-7 items-center justify-center rounded-full border border-border bg-accent text-accent-foreground ring-4 ring-background"
        >
          {isSystem ? (
            <Cpu className="size-3.5" />
          ) : (
            <EntityIcon entity={entry.entityType} className="size-3.5" />
          )}
        </span>
      </div>

      {/* Card */}
      <div className="ml-1 w-full rounded-2xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{actorDisplay}</span>
          {entry.actorIsAdmin && !isSystem ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              Admin
            </span>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {actionLabel(entry.action, actionLabels)}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/60 px-1.5 py-0.5 font-medium text-accent-foreground">
            <EntityIcon entity={entry.entityType} className="size-3" />
            {entityLabel(entry.entityType, entityLabels)}
          </span>
          <span className="font-mono text-[0.7rem] tracking-tight">
            {shortEntityRef(entry.entityId)}
          </span>
          {showCommission ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Building2 aria-hidden="true" className="size-3" />
                {entry.commissionName ?? "—"}
              </span>
            </>
          ) : null}
        </div>

        {entry.summary ? (
          <p className="mt-2 text-pretty text-sm text-foreground/90">
            {entry.summary}
          </p>
        ) : null}

        {diff.length > 0 ? (
          <dl className="mt-2.5 flex flex-col gap-1 border-t border-border/60 pt-2.5">
            {diff.map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-[minmax(6rem,9rem)_1fr] items-baseline gap-x-3 text-xs"
              >
                <dt className="truncate font-medium text-muted-foreground">
                  {field.key}
                </dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through decoration-1">
                    {field.before}
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground/70">
                    →
                  </span>
                  <span className="rounded bg-success/12 px-1.5 py-0.5 text-success dark:bg-success/15">
                    {field.after}
                  </span>
                  <span className="sr-only">
                    de {field.before} para {field.after}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {now !== null ? (
            <>
              <time
                dateTime={entry.occurredAt}
                title={formatAbsolute(entry.occurredAt)}
              >
                {formatRelative(entry.occurredAt, now)}
              </time>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
            </>
          ) : null}
          <time
            dateTime={entry.occurredAt}
            className="text-muted-foreground/80"
          >
            {formatAbsolute(entry.occurredAt)}
          </time>
          <span aria-hidden="true" className="mx-1.5">
            ·
          </span>
          <span className="text-muted-foreground/70">seq {entry.seq}</span>
        </p>
      </div>
    </li>
  );
}
