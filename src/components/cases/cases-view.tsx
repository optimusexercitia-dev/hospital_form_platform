"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { KanbanSquare, Search, Table as TableIcon } from "lucide-react";

import type { CaseBoardRow, ResolvedCaseOutcome } from "@/lib/queries/cases";
import type { CaseActionItemKpis } from "@/lib/queries/case-action-items";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/text";
import { CasesTable } from "./cases-table";
import { CasesKanban } from "./cases-kanban";
import { CasesKpiStrip } from "./cases-kpi-strip";
import { CasesOutcomeStrip } from "./cases-outcome-strip";
import {
  CaseActiveFilters,
  CaseChipRow,
  CaseSavedViewTabs,
  SaveViewDialog,
} from "./cases-filter-bar";
import { CasesFilterPanel } from "./cases-filter-panel";
import { computeCaseKpis, computeOutcomeBreakdown } from "./case-derive";
import {
  DEFAULT_CASE_FILTERS,
  matchesCaseFilters,
  type CaseFilterContext,
  type CaseFilterState,
} from "./case-filters";
import { useCaseSavedViews } from "./use-case-saved-views";

export type CasesViewMode = "table" | "kanban";

/** The minimal case-type projection the board needs: an id and a label. */
export interface CaseTypeOption {
  id: string;
  displayName: string;
}

/**
 * Client orchestrator for the cases screen.
 *
 * It owns ONE filter state and hands it to every control that reads or writes it — the
 * KPI cards, the saved-view tabs, the quick chips, the advanced panel and the summary
 * bar — plus the segmented Tabela/Kanban toggle (synced to `?view` through the History
 * API so it is shareable and survives a refresh without a server round-trip).
 *
 * ⚠ The KPI strip lives HERE, not on the server page, because its cards are filter
 * controls now (R1): a card must be able to read whether its own filter is applied and
 * write it when clicked. The numbers it shows are still derived from the full,
 * UNFILTERED row set — a KPI that moved as you filtered could never be clicked to
 * "show me those".
 *
 * All filtering stays client-side over the already-loaded board rows (the board read is
 * capped, not paginated), so no control here causes a refetch.
 */
export function CasesView({
  rows,
  org,
  slug,
  commissionId,
  initialView,
  staffCaseRoute = false,
  caseCustomFieldsEnabled = false,
  actionItems,
  actionItemsHref,
  caseTypes = [],
}: {
  rows: CaseBoardRow[];
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  /** Scopes the user's saved views to this commission (localStorage key). */
  commissionId: string;
  initialView: CasesViewMode;
  /** Whether the `case_custom_fields` flag is on — gates the list column + search fold (ADR 0083). */
  caseCustomFieldsEnabled?: boolean;
  /** Action-item counts (R4) for the sixth KPI card. */
  actionItems?: CaseActionItemKpis;
  /** Where that card links; omit when the action-items surface is unavailable. */
  actionItemsHref?: string;
  /** The org's active case types (ADR 0064 D4) — labels for the "Tipo de caso" filter. */
  caseTypes?: CaseTypeOption[];
  /**
   * Point each row at the STAFF case route (`casos/[id]`) instead of the
   * coordinator `(detail)` route (`manage/cases/[id]`). Set for a non-coordinator
   * who reaches the board via the `create_cases` capability (ADR 0061) — the
   * coordinator `(detail)` route 404s them, while the staff route renders their
   * edit-meta + phase affordances. Coordinators keep the `/manage` link. Default `false`.
   */
  staffCaseRoute?: boolean;
}) {
  const pathname = usePathname();
  const [view, setView] = useState<CasesViewMode>(initialView);
  const [filters, setFilters] = useState<CaseFilterState>(DEFAULT_CASE_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const { views, saveView, removeView } = useCaseSavedViews(commissionId);

  // One clock for the whole component, so a relative period ("últimos 7 dias") cannot
  // straddle midnight between the count line and the rows listed beneath it.
  const filterContext: CaseFilterContext = useMemo(
    () => ({ includeCustomFields: caseCustomFieldsEnabled, now: new Date() }),
    [caseCustomFieldsEnabled],
  );

  // KPIs + the outcome breakdown are computed over the FULL row set (see the class
  // comment) — they describe the commission, not the current filter.
  const kpis = useMemo(() => computeCaseKpis(rows), [rows]);
  const outcomeBreakdown = useMemo(() => computeOutcomeBreakdown(rows), [rows]);

  /** Distinct outcomes present on the loaded rows, label-ordered — the Desfecho menu. */
  const outcomeOptions = useMemo(() => {
    const byId = new Map<string, ResolvedCaseOutcome>();
    for (const r of rows) if (r.outcome) byId.set(r.outcome.id, r.outcome);
    return [...byId.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }, [rows]);

  const caseTypeNameById = useMemo(
    () => new Map(caseTypes.map((t) => [t.id, t.displayName])),
    [caseTypes],
  );
  const tagNameById = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) for (const t of r.tags) byId.set(t.id, t.name);
    return byId;
  }, [rows]);

  const changeView = (v: CasesViewMode) => {
    setView(v);
    const url = v === "table" ? pathname : `${pathname}?view=${v}`;
    window.history.replaceState(null, "", url);
  };

  const filtered = useMemo(
    () => rows.filter((r) => matchesCaseFilters(r, filters, filterContext)),
    [rows, filters, filterContext],
  );

  // Show the custom-fields column only when the flag is on AND at least one loaded
  // row carries a `show_in_list` value — a heterogeneous, opt-in column (D8).
  const showCustomFields =
    caseCustomFieldsEnabled && rows.some((r) => r.customFields.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <CasesKpiStrip
        kpis={kpis}
        actionItems={actionItems}
        actionItemsHref={actionItemsHref}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <CasesOutcomeStrip breakdown={outcomeBreakdown} />

      <div className="flex flex-col gap-2.5">
        <div
          style={{ ["--rise-delay" as string]: "160ms" }}
          className="animate-rise-in flex flex-wrap items-center gap-2"
        >
          <CaseSavedViewTabs
            filters={filters}
            onFiltersChange={setFilters}
            userViews={views}
            onRemoveView={removeView}
            onRequestSave={() => setSaveOpen(true)}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Buscar caso, rótulo ou etiqueta"
                aria-label="Buscar caso, rótulo ou etiqueta"
                className="h-[2.125rem] w-full rounded-[0.625rem] border border-border bg-card pr-3 pl-8 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:w-[13.75rem]"
              />
            </div>

            <div
              role="group"
              aria-label="Modo de visualização"
              className="inline-flex shrink-0 items-center rounded-[0.625rem] border border-border bg-muted p-0.5"
            >
              {(["table", "kanban"] as const).map((v) => {
                const active = view === v;
                const Icon = v === "table" ? TableIcon : KanbanSquare;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={active}
                    onClick={() => changeView(v)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                      active
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                    {v === "table" ? "Tabela" : "Kanban"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <CaseChipRow
          filters={filters}
          onFiltersChange={setFilters}
          rows={rows}
          outcomes={outcomeOptions}
          onOpenPanel={() => setPanelOpen(true)}
        />

        <CaseActiveFilters
          filters={filters}
          onFiltersChange={setFilters}
          outcomes={outcomeOptions}
          typeNameById={caseTypeNameById}
          tagNameById={tagNameById}
        />

        {/* A LIVE REGION, not decoration: every control on this screen changes the
            result set without moving focus, so a screen-reader user would otherwise
            get no feedback that a filter did anything. */}
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-muted-foreground tabular-nums"
        >
          {filtered.length === rows.length
            ? `${rows.length} ${plural(rows.length, "caso", "casos")}`
            : `${filtered.length} de ${rows.length} casos`}
        </p>

        {view === "kanban" ? (
          <CasesKanban
            rows={filtered}
            org={org}
            slug={slug}
            staffCaseRoute={staffCaseRoute}
            showCustomFields={showCustomFields}
          />
        ) : (
          <CasesTable
            rows={filtered}
            org={org}
            slug={slug}
            staffCaseRoute={staffCaseRoute}
            showCustomFields={showCustomFields}
          />
        )}
      </div>

      <CasesFilterPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        filters={filters}
        onApply={setFilters}
        rows={rows}
        filterContext={filterContext}
        caseTypeNameById={caseTypeNameById}
      />

      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onSave={(name) => saveView(name, filters)}
      />
    </div>
  );
}
