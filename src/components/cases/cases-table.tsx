"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarClock, ChevronsUpDown } from "lucide-react";

import type { CaseBoardRow, CasePhaseStatus } from "@/lib/queries/cases";
import { CASE_STATUSES } from "@/lib/cases/case-status";
import { cn } from "@/lib/utils";
import { CaseStatusBadge, CaseStatusBadgeFixed } from "./case-status-badge";
import { AssigneeAvatar } from "./assignee-avatar";
import { activePhases, currentPhase, phaseProgress } from "./case-derive";
import { formatCaseNumber, formatDate, formatDueDate, isOverdue } from "./format";

type SortKey = "caso" | "status" | "criado";
type SortDir = "asc" | "desc";

const PHASE_DOT: Record<CasePhaseStatus, string> = {
  ativa: "bg-primary",
  concluida: "bg-success",
  pendente: "bg-muted-foreground/35",
  nao_necessaria: "bg-muted-foreground/15",
};

const PHASE_WORD: Record<CasePhaseStatus, string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  pendente: "Pendente",
  nao_necessaria: "Não necessária",
};

// Status sort rank = the fixed board order; every status is present.
const STATUS_RANK: Record<(typeof CASE_STATUSES)[number], number> =
  Object.fromEntries(CASE_STATUSES.map((s, i) => [s, i])) as Record<
    (typeof CASE_STATUSES)[number],
    number
  >;

function PhaseDots({ row }: { row: CaseBoardRow }) {
  const ordered = [...row.phases].sort((a, b) => a.position - b.position);
  const { done, total } = phaseProgress(row);
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1" aria-hidden="true">
        {ordered.map((p) => (
          <span
            key={p.position}
            className={cn("size-1.5 rounded-full", PHASE_DOT[p.status])}
          />
        ))}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

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
          className={cn("size-3", active ? "text-foreground" : "text-muted-foreground/60")}
        />
      </button>
    </th>
  );
}

/**
 * The cases TABLE view: a sortable, scannable table. Rows are already
 * filtered/searched by the parent {@link CasesView}. Clicking a row (or the case
 * id) opens the case detail. Read-only — no mutations. The status column shows the
 * FIXED computed status; a dedicated Desfecho column shows the assigned outcome
 * (D14). When a case has more than one `ativa` phase the "Fase atual" cell reads
 * "N fases ativas" instead of a single phase (A5).
 */
export function CasesTable({
  rows,
  slug,
}: {
  rows: CaseBoardRow[];
  slug: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "caso",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "caso") cmp = a.case.caseNumber - b.case.caseNumber;
      else if (sort.key === "criado")
        cmp =
          new Date(a.case.createdAt).getTime() -
          new Date(b.case.createdAt).getTime();
      else cmp = STATUS_RANK[a.case.status] - STATUS_RANK[b.case.status];
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  return (
    <div className="animate-fade-in overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <SortHeader
              label="Caso"
              active={sort.key === "caso"}
              dir={sort.dir}
              onClick={() => toggle("caso")}
            />
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Rótulo
            </th>
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
              Desfecho
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Progresso
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Fase atual
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Resp.
            </th>
            <SortHeader
              label="Criado"
              active={sort.key === "criado"}
              dir={sort.dir}
              onClick={() => toggle("criado")}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-3 py-10 text-center text-sm text-muted-foreground"
              >
                Nenhum caso corresponde aos filtros.
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const href = `/c/${slug}/manage/cases/${row.case.id}`;
              const cp = currentPhase(row);
              const actives = activePhases(row);
              return (
                <tr
                  key={row.case.id}
                  onClick={() => router.push(href)}
                  className="cursor-pointer border-b border-border/70 odd:bg-card even:bg-muted/20 transition-colors hover:bg-accent/40"
                >
                  <td className="px-3 py-2.5 align-middle">
                    <Link
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-[0.8rem] font-semibold text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      {formatCaseNumber(row.case.caseNumber)}
                    </Link>
                  </td>
                  <td className="max-w-[16rem] px-3 py-2.5 align-middle">
                    {row.case.label ? (
                      <span className="block truncate text-foreground">
                        {row.case.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/70 italic">
                        Sem rótulo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <CaseStatusBadgeFixed status={row.case.status} />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    {row.outcome ? (
                      <CaseStatusBadge
                        label={row.outcome.label}
                        colorToken={row.outcome.colorToken}
                      />
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <PhaseDots row={row} />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    {actives.length > 1 ? (
                      <span className="text-xs font-medium text-foreground">
                        {actives.length} fases ativas
                      </span>
                    ) : cp ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">
                          Fase {cp.position}
                        </span>
                        <span className="truncate text-[0.7rem] text-muted-foreground">
                          {cp.title ? cp.title : PHASE_WORD[cp.status]}
                        </span>
                        {cp.dueDate &&
                          (() => {
                            const overdue = isOverdue(cp.dueDate, cp.status);
                            return (
                              <span
                                className={cn(
                                  "mt-0.5 inline-flex items-center gap-1 text-[0.7rem] tabular-nums",
                                  overdue
                                    ? "font-medium text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                <CalendarClock
                                  aria-hidden="true"
                                  className="size-3"
                                />
                                {formatDueDate(cp.dueDate)}
                                {overdue && " · Atrasada"}
                              </span>
                            );
                          })()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <AssigneeAvatar name={cp?.assigneeName ?? null} />
                  </td>
                  <td className="px-3 py-2.5 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDate(row.case.createdAt)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
