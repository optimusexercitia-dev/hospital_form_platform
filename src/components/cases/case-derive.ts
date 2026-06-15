/**
 * Pure presentation logic for the cases views (KPI strip, table, kanban, detail).
 *
 * IMPORTANT: this derives display-only state from EXISTING case/phase fields —
 * it changes no data model and persists nothing.
 *
 * Case data-model adjustments (D12/D13): the case "status" is now a FIXED,
 * auto-computed five-value enum (`@/lib/cases/case-status`), NOT a per-commission
 * configurable vocabulary. The kanban columns are the five fixed statuses in board
 * order; terminal/open reads from {@link isTerminalCaseStatus}. The phase helpers
 * (`phaseProgress`, `activePhases`, `currentPhase`, `hasUnassignedWork`,
 * `hasRecommendedPending`) are unchanged — they read phase status, a separate
 * fixed lifecycle. Two new derivations land here: {@link blockedBy} (D1/D4 — a
 * phase blocked by an unsettled earlier phase) and {@link computeOutcomeBreakdown}
 * (D14 — the dashboard outcome breakdown + % adverse).
 *
 * This module is PURE (no server-only imports) so CLIENT components import it
 * without dragging `next/headers` into the bundle.
 */

import type { CaseBoardRow, CasePhaseStatus } from "@/lib/queries/cases";
import {
  CASE_STATUSES,
  isTerminalCaseStatus,
  type CaseStatus,
  type CaseStatusColorToken,
} from "@/lib/cases/case-status";

// ---------------------------------------------------------------------------
// Fixed-status grouping (kanban columns)
// ---------------------------------------------------------------------------

/** One kanban column: a fixed status + the rows currently in that status. */
export interface CaseStatusColumn {
  status: CaseStatus;
  rows: CaseBoardRow[];
}

/**
 * Group board rows into the five FIXED status columns, in board order
 * ({@link CASE_STATUSES}). Every row lands in exactly one column (the fixed enum
 * is exhaustive); empty columns still render so the board layout is stable.
 */
export function groupByFixedStatus(rows: CaseBoardRow[]): CaseStatusColumn[] {
  const byStatus = new Map<CaseStatus, CaseBoardRow[]>();
  for (const status of CASE_STATUSES) byStatus.set(status, []);
  for (const row of rows) byStatus.get(row.case.status)?.push(row);
  return CASE_STATUSES.map((status) => ({
    status,
    rows: byStatus.get(status) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Per-row derived bits used by both the table and the kanban card
// ---------------------------------------------------------------------------

type BoardPhase = CaseBoardRow["phases"][number];

/** done / total progress, where "total" excludes não-necessária phases. */
export function phaseProgress(row: CaseBoardRow): { done: number; total: number } {
  const counted = row.phases.filter((p) => p.status !== "nao_necessaria");
  const done = counted.filter((p) => p.status === "concluida").length;
  return { done, total: counted.length };
}

/** Every `ativa` phase of a row, in position order (A5 — parallel phases). */
export function activePhases(row: CaseBoardRow): BoardPhase[] {
  return [...row.phases]
    .filter((p) => p.status === "ativa")
    .sort((a, b) => a.position - b.position);
}

/** The "current" phase: the first active one, else the lowest-position pending one. */
export function currentPhase(row: CaseBoardRow): BoardPhase | null {
  const ordered = [...row.phases].sort((a, b) => a.position - b.position);
  return (
    ordered.find((p) => p.status === "ativa") ??
    ordered.find((p) => p.status === "pendente") ??
    null
  );
}

/**
 * A case is "unassigned" when it is still OPEN (non-terminal) and has an
 * ativa/pendente phase with no assignee. Reads terminal-ness from the FIXED enum.
 */
export function hasUnassignedWork(row: CaseBoardRow): boolean {
  if (isTerminalCaseStatus(row.case.status)) return false;
  return row.phases.some(
    (p) =>
      (p.status === "ativa" || p.status === "pendente") && p.assignedTo === null,
  );
}

/** Whether the case has a recommended phase that has not started yet. */
export function hasRecommendedPending(row: CaseBoardRow): boolean {
  return row.phases.some((p) => p.recommended && p.status === "pendente");
}

// ---------------------------------------------------------------------------
// Phase blockers (D1/D4)
// ---------------------------------------------------------------------------

/** A blocker is SATISFIED when the blocking phase is concluída OR não necessária. */
function isBlockerSatisfied(status: CasePhaseStatus): boolean {
  return status === "concluida" || status === "nao_necessaria";
}

/**
 * The 1-based positions of the phases that currently BLOCK `phase` (D1/D4): its
 * listed `blocks` whose phase is NOT yet concluída/não-necessária. `[]` means the
 * phase is activatable (no blockers, or all blockers settled). The TS twin of the
 * `activate_phase` HC018 check — used to disable "Ativar e atribuir" and explain
 * why ("Bloqueada por Fase N").
 *
 * `allPhases` is the case's full phase list (any order); positions resolve against
 * it. A listed position with no matching phase is treated as unsatisfied (defensive
 * — the snapshot should always resolve, but never silently unblock).
 */
export function blockedBy(
  phase: { blocks: number[] },
  allPhases: Array<{ position: number; status: CasePhaseStatus }>,
): number[] {
  if (phase.blocks.length === 0) return [];
  const byPosition = new Map<number, CasePhaseStatus>();
  for (const p of allPhases) byPosition.set(p.position, p.status);
  return [...phase.blocks]
    .sort((a, b) => a - b)
    .filter((pos) => {
      const status = byPosition.get(pos);
      return status === undefined || !isBlockerSatisfied(status);
    });
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

export interface CaseKpis {
  /** Cases in a NON-terminal status ("Em aberto"). */
  casosAbertos: number;
  abertosEsteMes: number;
  fasesAtivas: number;
  casosComFaseAtiva: number;
  fasesPendentes: number;
  semResponsavel: number;
  /** Cases in a TERMINAL status (concluído / cancelado). */
  concluidos: number;
  concluidosEsteMes: number;
}

function isSameMonth(iso: string | null, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
  );
}

const ACTIVE_OR_PENDING: CasePhaseStatus[] = ["ativa", "pendente"];

/**
 * Compute the overview KPIs across the full (unfiltered) row set. "Open" vs
 * "closed" is decided by {@link isTerminalCaseStatus} over the FIXED enum
 * (`nao_iniciado`/`em_revisao`/`pendente` = open; `concluido`/`cancelado` = closed).
 */
export function computeCaseKpis(rows: CaseBoardRow[]): CaseKpis {
  const now = new Date();
  let fasesAtivas = 0;
  let fasesPendentes = 0;
  let semResponsavel = 0;
  let casosComFaseAtiva = 0;

  for (const row of rows) {
    const open = !isTerminalCaseStatus(row.case.status);
    let rowHasActive = false;
    for (const p of row.phases) {
      if (p.status === "ativa") {
        fasesAtivas += 1;
        rowHasActive = true;
      }
      if (p.status === "pendente") fasesPendentes += 1;
      if (
        open &&
        ACTIVE_OR_PENDING.includes(p.status) &&
        p.assignedTo === null
      ) {
        semResponsavel += 1;
      }
    }
    if (rowHasActive) casosComFaseAtiva += 1;
  }

  const abertos = rows.filter((r) => !isTerminalCaseStatus(r.case.status));
  const concluidosRows = rows.filter((r) =>
    isTerminalCaseStatus(r.case.status),
  );

  return {
    casosAbertos: abertos.length,
    abertosEsteMes: abertos.filter((r) => isSameMonth(r.case.createdAt, now))
      .length,
    fasesAtivas,
    casosComFaseAtiva,
    fasesPendentes,
    semResponsavel,
    concluidos: concluidosRows.length,
    concluidosEsteMes: concluidosRows.filter((r) =>
      isSameMonth(r.case.closedAt, now),
    ).length,
  };
}

// ---------------------------------------------------------------------------
// Outcome breakdown (D14)
// ---------------------------------------------------------------------------

/** One outcome's slice of the breakdown: its label/colour + how many cases carry it. */
export interface OutcomeBreakdownRow {
  outcomeId: string;
  label: string;
  colorToken: CaseStatusColorToken;
  isAdverse: boolean;
  count: number;
}

/** The dashboard outcome breakdown (D14): per-outcome counts + overall % adverse. */
export interface OutcomeBreakdown {
  /** Per-outcome counts, descending by count (assigned outcomes only). */
  rows: OutcomeBreakdownRow[];
  /** Cases that have ANY outcome assigned (the breakdown denominator). */
  totalWithOutcome: number;
  /** Cases whose assigned outcome is flagged adverse. */
  adverseCount: number;
  /**
   * Share of outcome-bearing cases that are adverse, 0–100 (rounded). `null` when
   * no case has an outcome yet (avoid a misleading "0%").
   */
  adversePercent: number | null;
}

/**
 * Compute the outcome breakdown over the loaded board rows (D14 — no new RPC).
 * Counts each case's RESOLVED assigned outcome (label/flags read live, so edits
 * propagate per D11); cases with no outcome are excluded from the breakdown. "%
 * adverse" is over the outcome-bearing cases (a case with no outcome is neither
 * adverse nor counted), so it answers "of the cases we classified, how many were
 * adverse events".
 */
export function computeOutcomeBreakdown(rows: CaseBoardRow[]): OutcomeBreakdown {
  const byOutcome = new Map<
    string,
    {
      label: string;
      colorToken: CaseStatusColorToken;
      isAdverse: boolean;
      count: number;
    }
  >();
  let totalWithOutcome = 0;
  let adverseCount = 0;

  for (const row of rows) {
    const outcome = row.outcome;
    if (!outcome) continue;
    totalWithOutcome += 1;
    if (outcome.isAdverse) adverseCount += 1;
    const existing = byOutcome.get(outcome.id);
    if (existing) {
      existing.count += 1;
    } else {
      byOutcome.set(outcome.id, {
        label: outcome.label,
        colorToken: outcome.colorToken,
        isAdverse: outcome.isAdverse,
        count: 1,
      });
    }
  }

  const breakdownRows: OutcomeBreakdownRow[] = [...byOutcome.entries()]
    .map(([outcomeId, v]) => ({
      outcomeId,
      label: v.label,
      colorToken: v.colorToken,
      isAdverse: v.isAdverse,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));

  return {
    rows: breakdownRows,
    totalWithOutcome,
    adverseCount,
    adversePercent:
      totalWithOutcome === 0
        ? null
        : Math.round((adverseCount / totalWithOutcome) * 100),
  };
}
