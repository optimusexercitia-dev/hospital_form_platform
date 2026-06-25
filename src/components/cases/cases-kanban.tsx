"use client";

import { commissionHref } from "@/lib/routing";
import { useMemo } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

import type { CaseBoardRow, CasePhaseStatus } from "@/lib/queries/cases";
import { CASE_STATUS_META } from "@/lib/cases/case-status";
import { cn } from "@/lib/utils";
import { AssigneeAvatar } from "./assignee-avatar";
import {
  activePhases,
  currentPhase,
  groupByFixedStatus,
  hasRecommendedPending,
  phaseProgress,
} from "./case-derive";
import { CaseStatusBadge, TOKEN_COLOR_VAR } from "./case-status-badge";
import { ageLabel, formatCaseNumber } from "./format";

const PHASE_DOT: Record<CasePhaseStatus, string> = {
  ativa: "bg-primary",
  concluida: "bg-success",
  pendente: "bg-muted-foreground/35",
  nao_necessaria: "bg-muted-foreground/15",
};

function CaseCard({
  row,
  org,
  slug,
  index,
}: {
  row: CaseBoardRow;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  index: number;
}) {
  const color = TOKEN_COLOR_VAR[CASE_STATUS_META[row.case.status].colorToken];
  const { done, total } = phaseProgress(row);
  const actives = activePhases(row);
  const cp = currentPhase(row);
  const ordered = [...row.phases].sort((a, b) => a.position - b.position);

  return (
    <Link
      href={commissionHref(org, slug, "manage", "cases", row.case.id)}
      style={{
        borderLeftColor: color,
        ["--rise-delay" as string]: `${Math.min(index, 8) * 40}ms`,
      }}
      className="animate-rise-in group/card relative block rounded-lg border border-l-[3px] border-border bg-card p-3 shadow-xs transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[0.8rem] font-semibold text-primary">
          {formatCaseNumber(row.case.caseNumber)}
        </span>
        {hasRecommendedPending(row) ? (
          <span className="rounded-full bg-warning/12 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide text-warning uppercase">
            Fase recomendada
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-1.5 line-clamp-2 text-[0.8rem]",
          row.case.label ? "text-foreground" : "text-muted-foreground/70 italic",
        )}
      >
        {row.case.label ?? "Sem rótulo"}
      </p>

      {row.outcome ? (
        <div className="mt-2">
          <CaseStatusBadge
            label={row.outcome.label}
            colorToken={row.outcome.colorToken}
          />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted-foreground">
        <span className="flex items-center gap-1" aria-hidden="true">
          {ordered.map((p) => (
            <span
              key={p.position}
              className={cn("size-1.5 rounded-full", PHASE_DOT[p.status])}
            />
          ))}
        </span>
        <span className="tabular-nums">
          {done}/{total}
        </span>
        {actives.length > 1 ? (
          <span className="truncate">· {actives.length} fases ativas</span>
        ) : cp ? (
          <span className="truncate">· Fase {cp.position}</span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/70 pt-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <AssigneeAvatar name={cp?.assigneeName ?? null} />
          <span className="truncate text-[0.72rem] text-muted-foreground">
            {actives.length > 1
              ? `${actives.length} responsáveis`
              : (cp?.assigneeName ?? "Não atribuído")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[0.7rem] text-muted-foreground tabular-nums">
          <Clock aria-hidden="true" className="size-3" />
          {ageLabel(row.case.createdAt)}
        </span>
      </div>
    </Link>
  );
}

/**
 * The cases KANBAN view (D13): FIVE FIXED, READ-ONLY columns — the auto-computed
 * statuses in board order ({@link CASE_STATUSES} via {@link groupByFixedStatus}),
 * each card placed by its computed `case.status`. There is NO drag and NO
 * `setCaseStatus`: status is derived from phase state (the DB recompute is the
 * authority), so a coordinator changes it by acting on phases / concluding /
 * cancelling — not by moving a card. Cards are plain links to the case detail; the
 * card left-border tint comes from the fixed status's palette token.
 */
export function CasesKanban({
  org,
  rows,
  slug,
}: {
  /** Org slug for hrefs. */
  org: string;
  rows: CaseBoardRow[];
  slug: string;
}) {
  const columns = useMemo(() => groupByFixedStatus(rows), [rows]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {columns.map(({ status, rows: items }) => {
        const meta = CASE_STATUS_META[status];
        const color = TOKEN_COLOR_VAR[meta.colorToken];
        return (
          <section
            key={status}
            aria-label={meta.label}
            className="flex flex-col rounded-2xl border border-border bg-muted/30"
          >
            <header className="flex items-center gap-2 rounded-t-2xl border-b border-border bg-card px-3 py-2.5">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <h3 className="flex-1 truncate text-[0.82rem] font-bold text-foreground">
                {meta.label}
              </h3>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
                {items.length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2.5 p-2.5">
              {items.length === 0 ? (
                <p className="px-1 py-6 text-center text-[0.72rem] text-muted-foreground/60">
                  Nenhum caso
                </p>
              ) : (
                items.map((row, i) => (
                  <CaseCard key={row.case.id} row={row} org={org} slug={slug} index={i} />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
