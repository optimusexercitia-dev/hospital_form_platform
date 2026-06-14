/**
 * Pure presentation logic for the cases views (KPI strip, table, kanban).
 *
 * IMPORTANT: this derives display-only state from EXISTING case/phase fields —
 * it changes no data model and persists nothing.
 *
 * Cases-Extras R2: the case "stage" is no longer a derived heuristic. The kanban
 * columns are now the commission's configurable `case_status_defs` (grouped by
 * `case.status`), and terminal/open is read from the def's `is_terminal` flag —
 * NOT the old hard-coded `'aberto'`/`'concluido'` literals. The
 * `deriveStage`/`STAGE_*`/`CaseStage` heuristic is removed (superseded). The
 * still-valid PHASE helpers (`phaseProgress`, `currentPhase`, `hasUnassignedWork`,
 * `hasRecommendedPending`) are kept — they read phase status, which is a separate
 * fixed lifecycle.
 */

import type {
  CaseBoardRow,
  CasePhaseStatus,
  CaseStatusKey,
} from "@/lib/queries/cases";
import type { CaseStatusDef } from "@/lib/queries/case-statuses";

// ---------------------------------------------------------------------------
// Client-safe pure helper
// ---------------------------------------------------------------------------

/**
 * Whether `key` is a TERMINAL status given the loaded defs. A pure twin of the
 * lib's `caseStatusIsTerminal`, re-homed HERE so CLIENT components can import it
 * WITHOUT pulling in `@/lib/queries/case-statuses` — that module value-imports
 * the server-only supabase client (`next/headers`) once its read is implemented,
 * so a value import from a client component drags `next/headers` into the bundle
 * (design-system client/server boundary rule). Server components may use either;
 * client components must use this one. Same fail-open-to-"live" semantics for an
 * unknown key.
 */
export function caseStatusIsTerminal(
  defs: CaseStatusDef[],
  key: CaseStatusKey,
): boolean {
  return defs.find((d) => d.key === key)?.isTerminal ?? false;
}

// ---------------------------------------------------------------------------
// Status-def grouping (kanban columns)
// ---------------------------------------------------------------------------

/** One kanban column: a status def + the rows currently in that status. */
export interface CaseStatusColumn {
  def: CaseStatusDef;
  rows: CaseBoardRow[];
}

/**
 * Group board rows into one column per NON-archived status def, ordered by the
 * def `position`. Rows whose `status` matches no live def (an orphaned/archived
 * key) are dropped from the columns — they still render in the table, but the
 * board only shows the configured columns. (`defs` is assumed already filtered to
 * non-archived + ordered, as `listCaseStatusDefs` returns; we sort defensively.)
 */
export function groupByStatus(
  rows: CaseBoardRow[],
  defs: CaseStatusDef[],
): CaseStatusColumn[] {
  const ordered = [...defs].sort((a, b) => a.position - b.position);
  const byKey = new Map<string, CaseBoardRow[]>();
  for (const def of ordered) byKey.set(def.key, []);
  for (const row of rows) {
    const bucket = byKey.get(row.case.status);
    if (bucket) bucket.push(row);
  }
  return ordered.map((def) => ({ def, rows: byKey.get(def.key) ?? [] }));
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

/** The "current" phase: the active one, else the lowest-position pending one. */
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
 * ativa/pendente phase with no assignee. Reads terminal-ness from the defs (R2)
 * instead of the old `=== "aberto"` literal.
 */
export function hasUnassignedWork(
  row: CaseBoardRow,
  defs: CaseStatusDef[],
): boolean {
  if (caseStatusIsTerminal(defs, row.case.status)) return false;
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
// KPI strip
// ---------------------------------------------------------------------------

export interface CaseKpis {
  /** Cases in a NON-terminal status (R2: "em aberto", was "casos abertos"). */
  casosAbertos: number;
  abertosEsteMes: number;
  fasesAtivas: number;
  casosComFaseAtiva: number;
  fasesPendentes: number;
  semResponsavel: number;
  /** Cases in a TERMINAL status (concluído / cancelado / any custom terminal). */
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
 * "closed" is now decided by the def `is_terminal` flag (R2) — a case in a custom
 * non-terminal status (e.g. `em_revisao`) counts as open, and any terminal status
 * (not just `concluido`) counts as closed.
 */
export function computeCaseKpis(
  rows: CaseBoardRow[],
  defs: CaseStatusDef[],
): CaseKpis {
  const now = new Date();
  let fasesAtivas = 0;
  let fasesPendentes = 0;
  let semResponsavel = 0;
  let casosComFaseAtiva = 0;

  for (const row of rows) {
    const open = !caseStatusIsTerminal(defs, row.case.status);
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

  const abertos = rows.filter(
    (r) => !caseStatusIsTerminal(defs, r.case.status),
  );
  const concluidosRows = rows.filter((r) =>
    caseStatusIsTerminal(defs, r.case.status),
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
