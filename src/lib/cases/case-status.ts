/**
 * The FIXED case-status model — single source of truth (Case data-model
 * adjustments, decisions D6/D7 + status precedence; assumption A1).
 *
 * As of this change the per-commission CONFIGURABLE status vocabulary
 * (`case_status_defs`, the R2 system) is removed (D12) and replaced by a fixed,
 * five-value, AUTO-COMPUTED status. `concluido`/`cancelado` are MANUAL terminal
 * actions; the other three auto-compute from phase state (the DB
 * `app.recompute_case_status` is the authority — this module is its display +
 * ordering twin, never a writer).
 *
 * This is a PURE module — no server-only imports — so CLIENT components
 * (kanban/table/badge/filters/`case-derive.ts`) import the order, the labels and
 * the colour token from HERE without dragging `next/headers` into the bundle
 * (the design-system client/server boundary rule). It also RE-HOMES
 * {@link CaseStatusColorToken} (formerly in `@/lib/queries/case-statuses`, which
 * is being deleted) since the shared palette is still needed by tags + outcomes
 * + the colour picker.
 *
 * pt-BR labels (Rule 10); colours are constrained palette TOKENS resolved to CSS
 * by the badge component, never raw CSS here.
 */

// ---------------------------------------------------------------------------
// Shared colour palette (re-homed from the deleted `case-statuses` module)
// ---------------------------------------------------------------------------

/**
 * The constrained colour palette for a status / tag / outcome badge. Resolved to
 * CSS variables in the UI (the badge component owns the token→class mapping);
 * `muted` is the guaranteed fallback so a never-styled token always renders.
 *
 * RE-HOMED here from `@/lib/queries/case-statuses` (deleted with the
 * configurable-status system). Still the SHARED palette across case statuses,
 * tags (`CaseTagColorToken`) and the new outcomes (`CaseOutcomeColorToken`), and
 * the `ColorTokenPicker`.
 */
export type CaseStatusColorToken =
  | 'muted'
  | 'slate'
  | 'blue'
  | 'amber'
  | 'green'
  | 'red'
  | 'violet'

// ---------------------------------------------------------------------------
// The fixed status union
// ---------------------------------------------------------------------------

/**
 * A case's GLOBAL macro status — a FIXED five-value union (restores
 * compile-time exhaustiveness, the point of the change).
 *
 *   - `nao_iniciado` — no phase is `ativa`/`concluida` yet (a skip-only case
 *     stays here, D7).
 *   - `em_revisao`   — at least one phase is `ativa` (work in progress).
 *   - `pendente`     — ≥1 phase `concluida`, none `ativa` (awaiting the next
 *     step / conclusion).
 *   - `concluido`    — MANUAL terminal (D6); the conclude gate passed.
 *   - `cancelado`    — MANUAL terminal (D6); cancellable anytime.
 *
 * Precedence (the DB recompute mirrors this): `cancelado` > `concluido` >
 * `em_revisao` > `pendente` > `nao_iniciado`. The first two are manual and never
 * overridden by recompute; the last three auto-compute from phase state.
 *
 * NOTE (phase vs case status): this is the CASE-level macro status. The per-phase
 * status (`CasePhaseStatus` in `@/lib/queries/cases`) is a SEPARATE fixed
 * lifecycle.
 */
export type CaseStatus =
  | 'nao_iniciado'
  | 'pendente'
  | 'em_revisao'
  | 'concluido'
  | 'cancelado'

/**
 * The five statuses in BOARD / display order (D13 — the read-only kanban
 * columns, left→right): a case progresses `nao_iniciado → em_revisao →
 * pendente`, then resolves to one of the terminal columns `concluido` /
 * `cancelado`. This is the canonical order the kanban, the status filter chips
 * and any status legend iterate.
 */
export const CASE_STATUSES: readonly CaseStatus[] = [
  'nao_iniciado',
  'em_revisao',
  'pendente',
  'concluido',
  'cancelado',
] as const

/** Per-status display metadata: pt-BR label + constrained palette token. */
export interface CaseStatusMeta {
  /** pt-BR display label (Rule 10). */
  label: string
  /** Constrained palette token (resolved to CSS by the badge component). */
  colorToken: CaseStatusColorToken
}

/**
 * The pt-BR label + colour token for each fixed status (assumption A1). Tokens:
 * `slate` (not started), `blue` (in review), `amber` (pending), `green`
 * (concluded), `red` (cancelled) — all from the shared 7-token palette.
 */
export const CASE_STATUS_META: Record<CaseStatus, CaseStatusMeta> = {
  nao_iniciado: { label: 'Não iniciado', colorToken: 'slate' },
  em_revisao: { label: 'Em revisão', colorToken: 'blue' },
  pendente: { label: 'Pendente', colorToken: 'amber' },
  concluido: { label: 'Concluído', colorToken: 'green' },
  cancelado: { label: 'Cancelado', colorToken: 'red' },
}

/**
 * The two MANUAL terminal statuses (D6): a case here is frozen — no further
 * status change, the outcome selector is locked, and the recompute trigger
 * early-returns instead of overriding it. The TS twin of the DB terminal check.
 */
export function isTerminalCaseStatus(status: CaseStatus): boolean {
  return status === 'concluido' || status === 'cancelado'
}
