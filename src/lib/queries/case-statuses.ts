import { createClient } from '@/lib/supabase/server'
import type { CaseStatusKey } from '@/lib/queries/cases'

/**
 * Configurable per-commission CASE STATUS vocabulary (Cases-Extras batch, R2).
 *
 * Architecture Rule 9 — all reads go through `src/lib/queries/`. A commission
 * owns an ORDERED set of case statuses (the board columns); each is stored in
 * `cases.status` by its ASCII `key`. Labels are pt-BR (Rule 10); colours are a
 * constrained palette TOKEN resolved to CSS in the UI, never raw CSS.
 *
 * Status writes / vocabulary CRUD live in `@/lib/cases/status-actions`; this
 * module is the READ side. Backed by the SECURITY DEFINER `list_case_status_defs`
 * RPC, internally `is_staff_admin_of`-gated (mirrors the cases board reads).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * The constrained colour palette for a status badge. Resolved to CSS variables
 * in the UI (the badge component owns the token→class mapping); `muted` is the
 * guaranteed fallback so a never-styled key always renders.
 */
export type CaseStatusColorToken =
  | 'muted'
  | 'slate'
  | 'blue'
  | 'amber'
  | 'green'
  | 'red'
  | 'violet'

/** One configurable case-status definition for a commission. */
export interface CaseStatusDef {
  /** ASCII slug stored in `cases.status` (unique per commission). */
  key: CaseStatusKey
  /** pt-BR display label. */
  label: string
  /** 1-based order; also the kanban column order. */
  position: number
  /** Constrained palette token (resolved to CSS in the UI). */
  colorToken: CaseStatusColorToken
  /**
   * `true` for the single status new cases enter. Exactly one non-archived
   * `is_initial` per commission (DB-enforced).
   */
  isInitial: boolean
  /**
   * `true` for a FINAL status: a case here is frozen (no further status change,
   * open phases were flipped to `nao_necessaria`). May be several per commission
   * (e.g. `concluido`, `cancelado`).
   */
  isTerminal: boolean
  /** `true` when retired — hidden from board columns / pickers, but still
   * renders existing cases that reference it. */
  archived: boolean
}

// ---------------------------------------------------------------------------
// RPC row shape
// ---------------------------------------------------------------------------

/**
 * One row of `list_case_status_defs`. NOTE the column is `status_position`, not
 * `position` — `position` is a reserved word in a SQL `RETURNS TABLE` column
 * definition, so the RPC aliases it; this mapper restores it to `position`.
 */
interface StatusDefRow {
  key: string
  label: string
  status_position: number
  color_token: CaseStatusColorToken
  is_initial: boolean
  is_terminal: boolean
  archived: boolean
}

function mapStatusDef(r: StatusDefRow): CaseStatusDef {
  return {
    key: r.key,
    label: r.label,
    position: r.status_position,
    colorToken: r.color_token,
    isInitial: r.is_initial,
    isTerminal: r.is_terminal,
    archived: r.archived,
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The ordered case-status definitions for a commission (the board columns +
 * status-picker options), ascending by `position`. Backed by the SECURITY
 * DEFINER `list_case_status_defs` (internally `is_staff_admin_of`-gated), so it
 * returns `[]` for a non-staff_admin (no leak).
 *
 * By default only NON-archived defs are returned (board columns / pickers). Pass
 * `includeArchived = true` (the staff_admin settings manager) for the full
 * vocabulary — an ADDITIVE optional param, so the original one-arg call is
 * unchanged.
 */
export async function listCaseStatusDefs(
  commissionId: string,
  includeArchived = false,
): Promise<CaseStatusDef[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_case_status_defs', {
    p_commission_id: commissionId,
    p_include_archived: includeArchived,
  })

  if (error || !data) return []

  return (data as unknown as StatusDefRow[]).map(mapStatusDef)
}

// ---------------------------------------------------------------------------
// Pure helpers (data-driven; no DB)
// ---------------------------------------------------------------------------

/**
 * Whether `key` is a TERMINAL status given the commission's loaded defs. Returns
 * `false` for an unknown key (fail-open to "still live" so an orphaned key never
 * freezes a case in the UI; the DB guard is the authority on real transitions).
 * The TS twin of the SQL `app.case_status_is_terminal`.
 */
export function caseStatusIsTerminal(
  defs: CaseStatusDef[],
  key: CaseStatusKey,
): boolean {
  return defs.find((d) => d.key === key)?.isTerminal ?? false
}
