import { createClient } from '@/lib/supabase/server'
import type { CaseStatusColorToken } from '@/lib/cases/case-status'

/**
 * Case OUTCOME data-access (Case data-model adjustments — outcomes; decisions
 * D8–D11, D15). A per-commission outcome vocabulary (mirrors `case_tags`): each
 * process selects which outcomes it OFFERS, and each case is assigned at most one
 * (Architecture Rule 9 — all reads go through `src/lib/queries/`).
 *
 *   - `case_outcomes` — the commission's outcome vocabulary (`unique(commission_id,
 *     label)`, colour token, `requires_action_plan` + `is_adverse` flags,
 *     archivable, ordered by `position`).
 *   - `process_template_outcomes` — the (template, outcome) join: the set a draft
 *     process OFFERS; a same-commission guard asserts the outcome belongs to the
 *     template's commission (HC030).
 *   - `case_offered_outcomes` — the PER-CASE FROZEN offered set, snapshotted at
 *     case creation; the conclude gate + the case selector read THIS (not the live
 *     template join, whose link is `ON DELETE SET NULL` and would leak post-publish
 *     edits into live cases).
 *
 * Both flags are SIGNALS, not gates (D10): `requires_action_plan` = advisory
 * marker; `is_adverse` = tracking/reporting. Vocabulary edits propagate everywhere
 * (D11 — no per-case snapshot of the outcome ROW; only the OFFERED-set membership
 * is frozen). RLS member-read / staff_admin-write throughout. Reuses the shared
 * palette token for badges. Outcome writes / vocabulary CRUD live in
 * `@/lib/cases/outcomes-actions`; this module is the READ side.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Outcome badge colour token (shares the constrained shared palette). */
export type CaseOutcomeColorToken = CaseStatusColorToken

/** One outcome in a commission's vocabulary. */
export interface CaseOutcome {
  id: string
  commissionId: string
  /** pt-BR label (unique per commission). */
  label: string
  colorToken: CaseOutcomeColorToken
  /**
   * Advisory marker (D10): when set, a case concluded with this outcome shows a
   * "requires action plan" reminder. NOT a conclusion gate.
   */
  requiresActionPlan: boolean
  /**
   * Tracking flag (D10): marks the outcome as an adverse event for the dashboard
   * "% adverse" breakdown. NOT a conclusion gate.
   */
  isAdverse: boolean
  /** `true` when retired — hidden from pickers, but still renders existing
   * references (D11 propagation). */
  archived: boolean
  /** 1-based order within the commission's vocabulary (the settings manager). */
  position: number
}

// ---------------------------------------------------------------------------
// Row shape + mapper
// ---------------------------------------------------------------------------

interface CaseOutcomeRow {
  id: string
  commission_id: string
  label: string
  color_token: CaseOutcomeColorToken
  requires_action_plan: boolean
  is_adverse: boolean
  archived: boolean
  position: number
}

function mapOutcome(r: CaseOutcomeRow): CaseOutcome {
  return {
    id: r.id,
    commissionId: r.commission_id,
    label: r.label,
    colorToken: r.color_token,
    requiresActionPlan: r.requires_action_plan,
    isAdverse: r.is_adverse,
    archived: r.archived,
    position: r.position,
  }
}

const OUTCOME_SELECT =
  'id, commission_id, label, color_token, requires_action_plan, is_adverse, archived, position' as const

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The commission's outcome vocabulary, ordered by `position`. RLS-scoped
 * (members read); `[]` when unreadable.
 *
 * By default only NON-archived outcomes are returned (process picker / case
 * selector). Pass `includeArchived = true` (the staff_admin settings manager) for
 * the full vocabulary — an ADDITIVE optional param, so the original one-arg call
 * is unchanged.
 */
export async function listCaseOutcomes(
  commissionId: string,
  includeArchived = false,
): Promise<CaseOutcome[]> {
  const supabase = await createClient()
  let query = supabase
    .from('case_outcomes')
    .select(OUTCOME_SELECT)
    .eq('commission_id', commissionId)

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data, error } = await query
    .order('position', { ascending: true })
    .returns<CaseOutcomeRow[]>()

  if (error || !data) return []
  return data.map(mapOutcome)
}

/**
 * The outcomes a PROCESS TEMPLATE offers (the draft builder's selected set),
 * ordered by the vocabulary `position`. Backed by the `process_template_outcomes`
 * join → `case_outcomes`. RLS-scoped (members read); `[]` when unreadable or the
 * template offers none (D15 — outcomes are optional per process).
 *
 * NOTE: this is the LIVE template offering (for the draft builder). A live CASE's
 * offered set is the FROZEN snapshot exposed on `CaseDetail.offeredOutcomes`
 * (`case_offered_outcomes`), not this.
 */
export async function listProcessOutcomes(
  templateId: string,
): Promise<CaseOutcome[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('process_template_outcomes')
    .select(`case_outcomes ( ${OUTCOME_SELECT} )`)
    .eq('template_id', templateId)
    .returns<{ case_outcomes: CaseOutcomeRow | null }[]>()

  if (error || !data) return []
  return data
    .map((r) => r.case_outcomes)
    .filter((o): o is CaseOutcomeRow => o != null)
    .map(mapOutcome)
    .sort((a, b) => a.position - b.position)
}
