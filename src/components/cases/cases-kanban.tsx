"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, GripVertical, MoveRight } from "lucide-react";

import type { CaseBoardRow, CasePhaseStatus } from "@/lib/queries/cases";
import type { CaseStatusDef } from "@/lib/queries/case-statuses";
import { setCaseStatus } from "@/lib/cases/status-actions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssigneeAvatar } from "./assignee-avatar";
import {
  groupByStatus,
  caseStatusIsTerminal,
  currentPhase,
  hasRecommendedPending,
  phaseProgress,
} from "./case-derive";
import { TOKEN_COLOR_VAR } from "./case-status-badge";
import { useCaseAction } from "./use-case-action";
import { ageLabel, formatCaseNumber } from "./format";

const PHASE_DOT: Record<CasePhaseStatus, string> = {
  ativa: "bg-primary",
  concluida: "bg-success",
  pendente: "bg-muted-foreground/35",
  nao_necessaria: "bg-muted-foreground/15",
};

function CaseCard({
  row,
  slug,
  defs,
  index,
  draggable,
  onMove,
  onDragStart,
  onDragEnd,
  isMoving,
}: {
  row: CaseBoardRow;
  slug: string;
  defs: CaseStatusDef[];
  index: number;
  /** False when the case is in a terminal status (frozen — no move). */
  draggable: boolean;
  onMove: (targetKey: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isMoving: boolean;
}) {
  const color = TOKEN_COLOR_VAR[
    defs.find((d) => d.key === row.case.status)?.colorToken ?? "muted"
  ];
  const { done, total } = phaseProgress(row);
  const cp = currentPhase(row);
  const ordered = [...row.phases].sort((a, b) => a.position - b.position);

  // Move targets: every defined status EXCEPT the current one (any
  // non-terminal → any defined status is allowed by the R2 guard).
  const moveTargets = defs.filter((d) => d.key !== row.case.status);

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.case.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{
        borderLeftColor: color,
        ["--rise-delay" as string]: `${Math.min(index, 8) * 40}ms`,
      }}
      className={cn(
        "animate-rise-in group/card relative rounded-lg border border-l-[3px] border-border bg-card p-3 shadow-xs transition-[transform,box-shadow,border-color,opacity]",
        draggable && "cursor-grab active:cursor-grabbing",
        isMoving && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-mono text-[0.8rem] font-semibold text-primary">
          {draggable && (
            <GripVertical
              aria-hidden="true"
              className="size-3.5 text-muted-foreground/40 transition-colors group-hover/card:text-muted-foreground/70"
            />
          )}
          {formatCaseNumber(row.case.caseNumber)}
        </span>
        <div className="flex items-center gap-1">
          {hasRecommendedPending(row) ? (
            <span className="rounded-full bg-warning/12 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide text-warning uppercase">
              Fase recomendada
            </span>
          ) : null}
          {draggable && moveTargets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isMoving}
                  aria-label={`Mover ${formatCaseNumber(row.case.caseNumber)} para outro estado`}
                  className="grid size-6 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <MoveRight aria-hidden="true" className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {moveTargets.map((d) => (
                  <DropdownMenuItem
                    key={d.key}
                    onSelect={() => onMove(d.key)}
                    className="gap-2"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: TOKEN_COLOR_VAR[d.colorToken] }}
                    />
                    {d.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Link
        href={`/c/${slug}/manage/cases/${row.case.id}`}
        className="mt-1.5 block rounded focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <p
          className={cn(
            "line-clamp-2 text-[0.8rem]",
            row.case.label
              ? "text-foreground"
              : "text-muted-foreground/70 italic",
          )}
        >
          {row.case.label ?? "Sem rótulo"}
        </p>
      </Link>

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
        {cp ? <span className="truncate">· Fase {cp.position}</span> : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/70 pt-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <AssigneeAvatar name={cp?.assigneeName ?? null} />
          <span className="truncate text-[0.72rem] text-muted-foreground">
            {cp?.assigneeName ?? "Não atribuído"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[0.7rem] text-muted-foreground tabular-nums">
          <Clock aria-hidden="true" className="size-3" />
          {ageLabel(row.case.createdAt)}
        </span>
      </div>
    </div>
  );
}

/**
 * The cases KANBAN view, DATA-DRIVEN against the commission's configurable
 * `case_status_defs` (Cases-Extras R2): one column per NON-archived def, ordered
 * by `position`, with the card left-border tint from the def's colour token.
 *
 * Cards are **drag-to-set-status** (the R2 guard now allows any non-terminal →
 * any defined status). A case in a TERMINAL status is frozen (not draggable, no
 * move menu). For keyboard users — and as a non-drag affordance — each movable
 * card also exposes a "Mover para" menu listing the other statuses. Both paths
 * funnel through `setCaseStatus`; on failure the move reverts (the route refresh
 * re-reads the unchanged status) and a pt-BR error shows above the board.
 */
export function CasesKanban({
  rows,
  slug,
  defs,
}: {
  rows: CaseBoardRow[];
  slug: string;
  defs: CaseStatusDef[];
}) {
  const { run, isPending, error } = useCaseAction();
  // The case id currently being dragged (for visual feedback) and the column
  // under the cursor (drop highlight).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  // The case id with an in-flight status write (dim its card until refresh).
  const [movingId, setMovingId] = useState<string | null>(null);

  const columns = useMemo(() => groupByStatus(rows, defs), [rows, defs]);

  function move(caseId: string, targetKey: string, currentKey: string) {
    if (targetKey === currentKey) return;
    setMovingId(caseId);
    run(() => setCaseStatus(caseId, targetKey), {
      onSuccess: () => setMovingId(null),
    });
    // On failure useCaseAction surfaces the error and skips refresh; clear the
    // dimming so the card returns to its (unchanged) column.
    setTimeout(() => setMovingId((id) => (id === caseId ? null : id)), 4000);
  }

  function handleDrop(targetKey: string) {
    const caseId = draggingId;
    setOverKey(null);
    setDraggingId(null);
    if (!caseId) return;
    const row = rows.find((r) => r.case.id === caseId);
    if (!row) return;
    move(caseId, targetKey, row.case.status);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {columns.map(({ def, rows: items }) => {
          const color = TOKEN_COLOR_VAR[def.colorToken];
          const isOver = overKey === def.key;
          return (
            <section
              key={def.key}
              aria-label={def.label}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overKey !== def.key) setOverKey(def.key);
              }}
              onDragLeave={(e) => {
                // Only clear when leaving the column entirely (not entering a child).
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverKey((k) => (k === def.key ? null : k));
                }
              }}
              onDrop={() => handleDrop(def.key)}
              className={cn(
                "flex flex-col rounded-2xl border bg-muted/30 transition-colors",
                isOver
                  ? "border-primary/60 bg-accent/40 ring-2 ring-ring/30"
                  : "border-border",
              )}
            >
              <header className="flex flex-col gap-0.5 rounded-t-2xl border-b border-border bg-card px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <h3 className="flex-1 truncate text-[0.82rem] font-bold text-foreground">
                    {def.label}
                  </h3>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                {def.isTerminal && (
                  <p className="pl-4 text-[0.68rem] text-muted-foreground">
                    Estado final
                  </p>
                )}
              </header>
              <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                {items.length === 0 ? (
                  <p className="px-1 py-6 text-center text-[0.72rem] text-muted-foreground/60">
                    {isOver ? "Soltar aqui" : "Nenhum caso"}
                  </p>
                ) : (
                  items.map((row, i) => (
                    <CaseCard
                      key={row.case.id}
                      row={row}
                      slug={slug}
                      defs={defs}
                      index={i}
                      draggable={
                        !caseStatusIsTerminal(defs, row.case.status) && !isPending
                      }
                      isMoving={movingId === row.case.id}
                      onMove={(targetKey) =>
                        move(row.case.id, targetKey, row.case.status)
                      }
                      onDragStart={() => setDraggingId(row.case.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverKey(null);
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
