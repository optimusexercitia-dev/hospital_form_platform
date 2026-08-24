/**
 * The cases-board FILTER MODEL — one flat state object plus the pure predicate that
 * decides whether a board row survives it, shared by every control that writes into
 * it (KPI cards, quick chips, the advanced panel, the saved-view tabs) and by the
 * counts each of them shows.
 *
 * Why one module: the redesign has FIVE surfaces mutating the same filter state and
 * THREE reading counts off it — the chip-row counts (over the UNFILTERED rows), the
 * panel's live preview (over its DRAFT), and the board's own "N de M". A second copy
 * of the predicate is how those three would come to disagree, so there is exactly one
 * {@link matchesCaseFilters} and every count calls it.
 *
 * All filtering is CLIENT-SIDE over the already-loaded board rows (`list_cases_board`
 * returns the whole capped board) — no new backend, no refetch on a filter change.
 *
 * PURE module (no server-only imports) — it is imported by client components only,
 * and `@/lib/queries/cases` is type-only here.
 */

import type { CaseBoardRow } from "@/lib/queries/cases";
import {
  CASE_STATUS_META,
  isTerminalCaseStatus,
  type CaseStatus,
} from "@/lib/cases/case-status";
import { hasOverdueWork, hasUnassignedWork, phaseProgress } from "./case-derive";
import { formatCaseNumber } from "./format";
import { customFieldDisplay } from "./custom-field-input";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/**
 * The status filter: every fixed {@link CaseStatus}, plus `"todos"` (no constraint)
 * and the VIRTUAL `"abertos"` — any non-terminal status. "Abertos" is not a status a
 * case can hold; it is the "Em aberto" KPI's filter, and it is spelled out here rather
 * than expanded into a three-status set so the saved-view comparison and the
 * active-filter chip can name it ("Em aberto") the way the user picked it.
 */
export type CaseStatusFilter = "todos" | "abertos" | CaseStatus;

/** A custom `createdAt` window; either bound may be absent (open-ended). */
export interface CasePeriodRange {
  /** ISO `YYYY-MM-DD`, inclusive. */
  from?: string;
  /** ISO `YYYY-MM-DD`, inclusive. */
  to?: string;
}

/** The period filter: "any date", a rolling/calendar preset, or a custom range. */
export type CasePeriodFilter =
  | "all"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | CasePeriodRange;

/** Phase-progress buckets, read off {@link phaseProgress}'s done/total. */
export type CaseProgressFilter = "any" | "none" | "partial" | "all";

/**
 * The complete board filter state. Groups AND together; values WITHIN a multi-select
 * group OR (a case matching any selected responsável passes that group).
 */
export interface CaseFilterState {
  status: CaseStatusFilter;
  /** `null` = any · `"sem"` = no outcome assigned · otherwise an outcome id. Single-select. */
  outcome: null | "sem" | string;
  period: CasePeriodFilter;
  /** Only cases with an overdue active/pending phase ({@link hasOverdueWork}). */
  overdue: boolean;
  /** Assignee display NAMES (the board row carries names, not ids, per phase). */
  resp: string[];
  /** Case-type ids. */
  types: string[];
  /** Tag ids. */
  tags: string[];
  /** Department display names (the board resolves a name, and "Outro" has no id). */
  depts: string[];
  /** Only cases with unassigned open work ({@link hasUnassignedWork}). */
  semResp: boolean;
  /** Only cases whose assigned outcome is flagged adverse. */
  adverseOnly: boolean;
  progress: CaseProgressFilter;
  /** Free-text search. Deliberately NOT part of a saved view (see {@link sameFilters}). */
  q: string;
}

/** The empty filter state — "Todos os casos". */
export const DEFAULT_CASE_FILTERS: CaseFilterState = {
  status: "todos",
  outcome: null,
  period: "all",
  overdue: false,
  resp: [],
  types: [],
  tags: [],
  depts: [],
  semResp: false,
  adverseOnly: false,
  progress: "any",
  q: "",
};

/** The fields the ADVANCED PANEL owns — its "Limpar" resets exactly these. */
export type PanelOwnedFilters = Pick<
  CaseFilterState,
  "resp" | "types" | "tags" | "depts" | "semResp" | "adverseOnly" | "progress"
>;

// ---------------------------------------------------------------------------
// Period
// ---------------------------------------------------------------------------

/** The period presets, in menu order. */
export const CASE_PERIOD_PRESETS: ReadonlyArray<{
  value: Exclude<CasePeriodFilter, "all" | CasePeriodRange>;
  label: string;
}> = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Este mês" },
] as const;

/** The phase-progress options, in chip order. */
export const CASE_PROGRESS_OPTIONS: ReadonlyArray<{
  value: CaseProgressFilter;
  label: string;
}> = [
  { value: "any", label: "Qualquer" },
  { value: "none", label: "Nenhuma concluída" },
  { value: "partial", label: "Em andamento" },
  { value: "all", label: "Todas concluídas" },
] as const;

/**
 * Collapse a period filter to its canonical form: a custom range with neither bound
 * set is exactly "any date". Used for comparison and for the chip label, so the three
 * places that ask "is a period filtering anything" cannot answer differently.
 */
export function normalizePeriod(period: CasePeriodFilter): CasePeriodFilter {
  if (!isPeriodRange(period)) return period;
  if (!period.from && !period.to) return "all";
  return { from: period.from ?? "", to: period.to ?? "" };
}

/** Whether a period filter is the custom-range object rather than a preset key. */
export function isPeriodRange(
  period: CasePeriodFilter,
): period is CasePeriodRange {
  return typeof period === "object" && period !== null;
}

/**
 * Parse an ISO `YYYY-MM-DD` as a LOCAL midnight date. Never `new Date(iso)` — that
 * parses date-only strings as UTC midnight, which lands on the previous day in a
 * negative-offset timezone (Brazil). The twin of `format.ts`'s parse.
 */
function parseLocalDate(iso: string): Date | null {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A compact pt-BR day+month label for a custom range bound ("18 ago"). */
function shortDate(iso: string): string {
  const date = parseLocalDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

/**
 * The chip label for a period filter, or `null` for "any date" (the chip then shows
 * its bare name). A custom range renders "18 ago – 24 ago", with "…" for an open bound.
 */
export function periodLabel(period: CasePeriodFilter): string | null {
  if (period === "all") return null;
  if (isPeriodRange(period)) {
    if (!period.from && !period.to) return null;
    return `${period.from ? shortDate(period.from) : "…"} – ${
      period.to ? shortDate(period.to) : "…"
    }`;
  }
  return (
    CASE_PERIOD_PRESETS.find((p) => p.value === period)?.label ?? null
  );
}

/**
 * Whether a case's `createdAt` falls inside the period. `now` is injected so every
 * caller in one render shares a single clock (and so this stays testable).
 */
function inPeriod(
  createdAtIso: string,
  period: CasePeriodFilter,
  now: Date,
): boolean {
  if (period === "all") return true;
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return false;

  if (isPeriodRange(period)) {
    if (period.from) {
      const from = parseLocalDate(period.from);
      // An unparseable bound must not silently widen the filter to "everything".
      if (!from || created.getTime() < from.getTime()) return false;
    }
    if (period.to) {
      const to = parseLocalDate(period.to);
      if (!to) return false;
      // Inclusive of the whole `to` day, not its midnight.
      const endOfDay = new Date(
        to.getFullYear(),
        to.getMonth(),
        to.getDate(),
        23,
        59,
        59,
        999,
      );
      if (created.getTime() > endOfDay.getTime()) return false;
    }
    return true;
  }

  if (period === "month") {
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth()
    );
  }

  const days = { "7d": 7, "30d": 30, "90d": 90 }[period];
  const elapsed = (now.getTime() - created.getTime()) / 86_400_000;
  return elapsed <= days;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * The search haystack: the case number (both "Caso 0042" and the bare digits), the
 * label, the TAG names, and — when the `case_custom_fields` flag is on — each
 * `show_in_list` field's label and resolved display value (ADR 0083).
 */
function matchesQuery(
  row: CaseBoardRow,
  needle: string,
  includeCustomFields: boolean,
): boolean {
  if (!needle) return true;
  const idText = formatCaseNumber(row.case.caseNumber).toLowerCase();
  if (
    idText.includes(needle) ||
    String(row.case.caseNumber).includes(needle) ||
    (row.case.label?.toLowerCase() ?? "").includes(needle)
  ) {
    return true;
  }
  if (row.tags.some((t) => t.name.toLowerCase().includes(needle))) return true;
  if (includeCustomFields) {
    return row.customFields.some(
      (f) =>
        f.label.toLowerCase().includes(needle) ||
        customFieldDisplay(f).toLowerCase().includes(needle),
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// The predicate
// ---------------------------------------------------------------------------

/** Per-call context the predicate cannot derive from the row alone. */
export interface CaseFilterContext {
  /** The `case_custom_fields` flag — folds custom fields into the search haystack. */
  includeCustomFields: boolean;
  /**
   * "Now" for the relative period presets, injected so a whole render pass shares one
   * clock: reading `new Date()` per row could straddle midnight mid-filter and give a
   * count that does not match the rows listed beside it.
   */
  now: Date;
}

/**
 * THE board filter predicate — the single definition of "does this row survive the
 * current filters". Groups AND; multi-select values OR within their group.
 */
export function matchesCaseFilters(
  row: CaseBoardRow,
  f: CaseFilterState,
  ctx: CaseFilterContext,
): boolean {
  // Status — "abertos" is the virtual non-terminal set.
  if (f.status === "abertos") {
    if (isTerminalCaseStatus(row.case.status)) return false;
  } else if (f.status !== "todos" && row.case.status !== f.status) {
    return false;
  }

  // Outcome + the adverse-only switch (both read the resolved outcome).
  if (f.outcome === "sem" && row.outcome !== null) return false;
  if (f.outcome !== null && f.outcome !== "sem" && row.outcome?.id !== f.outcome) {
    return false;
  }
  if (f.adverseOnly && !(row.outcome?.isAdverse ?? false)) return false;

  if (!inPeriod(row.case.createdAt, f.period, ctx.now)) return false;
  if (f.overdue && !hasOverdueWork(row)) return false;
  if (f.semResp && !hasUnassignedWork(row)) return false;

  if (
    f.resp.length > 0 &&
    !row.phases.some(
      (p) => p.assigneeName !== null && f.resp.includes(p.assigneeName),
    )
  ) {
    return false;
  }
  if (
    f.types.length > 0 &&
    !(row.case.caseTypeId !== null && f.types.includes(row.case.caseTypeId))
  ) {
    return false;
  }
  if (
    f.depts.length > 0 &&
    !(
      row.case.departmentName !== null &&
      f.depts.includes(row.case.departmentName)
    )
  ) {
    return false;
  }
  if (f.tags.length > 0 && !row.tags.some((t) => f.tags.includes(t.id))) {
    return false;
  }

  if (f.progress !== "any") {
    const { done, total } = phaseProgress(row);
    if (f.progress === "none" && done !== 0) return false;
    if (f.progress === "partial" && !(done > 0 && done < total)) return false;
    // "Todas concluídas" over zero counted phases would be vacuously true; a case
    // with nothing to do has not completed everything, so `total > 0` is required.
    if (f.progress === "all" && !(total > 0 && done === total)) return false;
  }

  const needle = f.q.trim().toLowerCase();
  if (needle && !matchesQuery(row, needle, ctx.includeCustomFields)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Comparison + counting
// ---------------------------------------------------------------------------

/**
 * Whether two filter states are equivalent, IGNORING the search query. A saved view
 * describes a filter set, not a search — typing in the box must not knock the active
 * view tab off, and saving a view must not bake the current search into it.
 *
 * Multi-select arrays are compared as SETS (sorted before serializing): selecting
 * A then B must match a view saved as B then A, or the tab flickers off for a state
 * that is semantically identical.
 */
export function sameFilters(a: CaseFilterState, b: CaseFilterState): boolean {
  const norm = (f: CaseFilterState) =>
    JSON.stringify({
      status: f.status,
      outcome: f.outcome,
      // A range with BOTH bounds cleared constrains nothing, so it must compare equal
      // to "all" — otherwise typing a date into the Período popover and then deleting
      // it leaves the state filtering nothing while the active view tab stays dark,
      // and "Salvar visão" offers to save the empty filter set as a new view.
      period: normalizePeriod(f.period),
      overdue: f.overdue,
      resp: [...f.resp].sort(),
      types: [...f.types].sort(),
      tags: [...f.tags].sort(),
      depts: [...f.depts].sort(),
      semResp: f.semResp,
      adverseOnly: f.adverseOnly,
      progress: f.progress,
    });
  return norm(a) === norm(b);
}

/**
 * How many PANEL-OWNED filters are active — the badge on "Mais filtros". Counts each
 * selected value in a multi group separately, so the badge matches the number of chips
 * those groups contribute to the summary bar.
 */
export function panelFilterCount(f: CaseFilterState): number {
  return (
    f.resp.length +
    f.types.length +
    f.tags.length +
    f.depts.length +
    (f.semResp ? 1 : 0) +
    (f.adverseOnly ? 1 : 0) +
    (f.progress !== "any" ? 1 : 0)
  );
}

/** The pt-BR label for a status filter value (including the virtual "abertos"). */
export function statusFilterLabel(status: CaseStatusFilter): string {
  if (status === "todos") return "Todos os status";
  if (status === "abertos") return "Em aberto";
  return CASE_STATUS_META[status].label;
}

// ---------------------------------------------------------------------------
// Built-in saved views
// ---------------------------------------------------------------------------

/** A saved view: a named filter set surfaced as a tab. */
export interface CaseSavedView {
  id: string;
  name: string;
  filters: CaseFilterState;
}

/**
 * The four views every commission gets. `id`s are prefixed `builtin:` so the
 * user-view store (which mints `user:<timestamp>`) can never collide with them, and
 * so the delete affordance can key off the prefix rather than a separate flag.
 */
export const BUILTIN_CASE_VIEWS: readonly CaseSavedView[] = [
  {
    id: "builtin:all",
    name: "Todos os casos",
    filters: { ...DEFAULT_CASE_FILTERS },
  },
  {
    id: "builtin:review",
    name: "Fila de revisão",
    filters: { ...DEFAULT_CASE_FILTERS, status: "in_review" },
  },
  {
    id: "builtin:overdue",
    name: "Atrasados",
    filters: { ...DEFAULT_CASE_FILTERS, overdue: true },
  },
  {
    id: "builtin:adverse",
    name: "Adversos em aberto",
    filters: { ...DEFAULT_CASE_FILTERS, status: "abertos", adverseOnly: true },
  },
] as const;
