"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

import type { CaseBoardRow } from "@/lib/queries/cases";
import {
  CASE_STATUSES,
  CASE_STATUS_META,
  type CaseStatus,
} from "@/lib/cases/case-status";
import { cn } from "@/lib/utils";
import { CasesTable } from "./cases-table";
import { CasesKanban } from "./cases-kanban";
import { hasUnassignedWork } from "./case-derive";
import { formatCaseNumber } from "./format";

export type CasesViewMode = "table" | "kanban";

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-card px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

/**
 * Status filter chips: "Todos", the five FIXED statuses (D13), then the
 * phase-derived "Sem responsável". A `status:<key>` chip keys off the fixed
 * computed status.
 */
type ChipKey = `status:${CaseStatus}` | "todos" | "sem_resp";

const CHIPS: Array<{ key: ChipKey; label: string }> = [
  { key: "todos", label: "Todos" },
  ...CASE_STATUSES.map((s) => ({
    key: `status:${s}` as ChipKey,
    label: CASE_STATUS_META[s].label,
  })),
  { key: "sem_resp", label: "Sem responsável" },
];

/** The outcome filter selection: any, a specific outcome id, or "no outcome". */
type OutcomeFilter = "todos" | "sem" | string;

function matchesChip(row: CaseBoardRow, chip: ChipKey): boolean {
  if (chip === "todos") return true;
  if (chip === "sem_resp") return hasUnassignedWork(row);
  // status:<key>
  return row.case.status === (chip.slice("status:".length) as CaseStatus);
}

function matchesOutcome(
  row: CaseBoardRow,
  outcome: OutcomeFilter,
  adverseOnly: boolean,
): boolean {
  if (adverseOnly && !(row.outcome?.isAdverse ?? false)) return false;
  if (outcome === "todos") return true;
  if (outcome === "sem") return row.outcome === null;
  return row.outcome?.id === outcome;
}

function matchesQuery(row: CaseBoardRow, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const idText = formatCaseNumber(row.case.caseNumber).toLowerCase();
  const label = row.case.label?.toLowerCase() ?? "";
  return (
    idText.includes(needle) ||
    String(row.case.caseNumber).includes(needle) ||
    label.includes(needle)
  );
}

/**
 * Client orchestrator for the cases screen: the segmented Tabela/Kanban toggle
 * (synced to ?view via the History API so it's shareable + survives refresh,
 * without a server round-trip on every toggle), plus client-side filters
 * (status chips + outcome select + "apenas adversos" + search, D14) that drive
 * BOTH views over the already-loaded rows. No backend — the outcome options are
 * derived from the resolved outcomes already on the board rows.
 */
export function CasesView({
  rows,
  slug,
  initialView,
}: {
  rows: CaseBoardRow[];
  slug: string;
  initialView: CasesViewMode;
}) {
  const pathname = usePathname();
  const [view, setView] = useState<CasesViewMode>(initialView);
  const [chip, setChip] = useState<ChipKey>("todos");
  const [outcome, setOutcome] = useState<OutcomeFilter>("todos");
  const [adverseOnly, setAdverseOnly] = useState(false);
  const [query, setQuery] = useState("");

  // Distinct outcomes present on the loaded rows (for the outcome <select>),
  // ordered by label. Only shows the filter at all when ≥1 case carries one.
  const outcomeOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) if (r.outcome) byId.set(r.outcome.id, r.outcome.label);
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [rows]);
  const hasOutcomes = outcomeOptions.length > 0;

  const changeView = (v: CasesViewMode) => {
    setView(v);
    const url = v === "table" ? pathname : `${pathname}?view=${v}`;
    window.history.replaceState(null, "", url);
  };

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesChip(r, chip) &&
          matchesOutcome(r, outcome, adverseOnly) &&
          matchesQuery(r, query),
      ),
    [rows, chip, outcome, adverseOnly, query],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Status filter chips. */}
        <div
          role="group"
          aria-label="Filtrar casos por status"
          className="flex flex-wrap items-center gap-1.5"
        >
          {CHIPS.map((c) => {
            const active = chip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={active}
                onClick={() => setChip(c.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search. */}
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar caso ou rótulo"
              aria-label="Buscar caso ou rótulo"
              className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-8 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none lg:w-56"
            />
          </div>

          {/* Segmented view toggle. */}
          <div
            role="group"
            aria-label="Modo de visualização"
            className="inline-flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-0.5"
          >
            {(["table", "kanban"] as const).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeView(v)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                    active
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "table" ? "Tabela" : "Kanban"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outcome filters (only when at least one case carries an outcome). */}
      {hasOutcomes && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">Desfecho</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              aria-label="Filtrar por desfecho"
              className={SELECT_CLASS}
            >
              <option value="todos">Todos os desfechos</option>
              <option value="sem">Sem desfecho</option>
              {outcomeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            aria-pressed={adverseOnly}
            onClick={() => setAdverseOnly((v) => !v)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              adverseOnly
                ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
                : "border border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            Apenas adversos
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {filtered.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "caso" : "casos"}`
          : `${filtered.length} de ${rows.length} casos`}
      </p>

      {view === "kanban" ? (
        <CasesKanban rows={filtered} slug={slug} />
      ) : (
        <CasesTable rows={filtered} slug={slug} />
      )}
    </div>
  );
}
