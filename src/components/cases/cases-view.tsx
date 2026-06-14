"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

import type { CaseBoardRow } from "@/lib/queries/cases";
import type { CaseStatusDef } from "@/lib/queries/case-statuses";
import { cn } from "@/lib/utils";
import { CasesTable } from "./cases-table";
import { CasesKanban } from "./cases-kanban";
import { caseStatusIsTerminal, hasUnassignedWork } from "./case-derive";
import { formatCaseNumber } from "./format";

export type CasesViewMode = "table" | "kanban";

/**
 * Filter chips. The status-based ones are DATA-DRIVEN against the configurable
 * defs (R2): "Em aberto" / "Encerrados" key off the def `is_terminal` flag rather
 * than the old fixed `aberto`/`concluido`/`cancelado` literals. "Sem responsável"
 * is phase-derived.
 */
type ChipKey = "todos" | "sem_resp" | "abertos" | "encerrados";

const CHIPS: Array<{ key: ChipKey; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "sem_resp", label: "Sem responsável" },
  { key: "abertos", label: "Em aberto" },
  { key: "encerrados", label: "Encerrados" },
];

function matchesChip(
  row: CaseBoardRow,
  chip: ChipKey,
  defs: CaseStatusDef[],
): boolean {
  switch (chip) {
    case "todos":
      return true;
    case "sem_resp":
      return hasUnassignedWork(row, defs);
    case "abertos":
      return !caseStatusIsTerminal(defs, row.case.status);
    case "encerrados":
      return caseStatusIsTerminal(defs, row.case.status);
  }
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
 * without a server round-trip on every toggle), plus client-side filter chips +
 * search that drive BOTH views over the already-loaded rows. No backend.
 */
export function CasesView({
  rows,
  slug,
  defs,
  initialView,
}: {
  rows: CaseBoardRow[];
  slug: string;
  /** The commission's non-archived status defs (kanban columns + badges). */
  defs: CaseStatusDef[];
  initialView: CasesViewMode;
}) {
  const pathname = usePathname();
  const [view, setView] = useState<CasesViewMode>(initialView);
  const [chip, setChip] = useState<ChipKey>("todos");
  const [query, setQuery] = useState("");

  const changeView = (v: CasesViewMode) => {
    setView(v);
    const url = v === "table" ? pathname : `${pathname}?view=${v}`;
    window.history.replaceState(null, "", url);
  };

  const filtered = useMemo(
    () =>
      rows.filter((r) => matchesChip(r, chip, defs) && matchesQuery(r, query)),
    [rows, chip, query, defs],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Filter chips. */}
        <div
          role="group"
          aria-label="Filtrar casos"
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

        <div className="flex items-center gap-2">
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
              className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-8 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none lg:w-64"
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

      <p className="text-xs text-muted-foreground tabular-nums">
        {filtered.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "caso" : "casos"}`
          : `${filtered.length} de ${rows.length} casos`}
      </p>

      {view === "kanban" ? (
        <CasesKanban rows={filtered} slug={slug} defs={defs} />
      ) : (
        <CasesTable rows={filtered} slug={slug} defs={defs} />
      )}
    </div>
  );
}
