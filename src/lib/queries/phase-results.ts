import { createClient } from '@/lib/supabase/server'
import type { CaseStatusColorToken } from '@/lib/cases/case-status'

/**
 * Per-phase RESULT vocabulary data-access (phase-results feature). A
 * per-commission vocabulary of categorical result labels (default 2-value
 * Pass/Fail, extensible) emitted when a case phase's form is submitted, computed
 * from the phase's OWN answers against an ordered ruleset (or set by a manual
 * override). Modeled on `case_outcomes` (Architecture Rule 9 — all reads go
 * through `src/lib/queries/`).
 *
 *   - `phase_results` — the commission's result vocabulary (`unique(commission_id,
 *     label)`, colour token, `is_adverse` flag, archivable, ordered by `position`).
 *   - The per-template ruleset lives on `process_template_phases.result_ruleset`
 *     and is snapshotted onto `case_phases.result_ruleset`.
 *   - `case_phase_offered_results` — the PER-CASE FROZEN reachable set,
 *     snapshotted at case creation (the computed-path guard reads THIS).
 *
 * Everything is gated behind the `case_phase_results` feature flag and is a no-op
 * when the flag is off. Vocabulary CRUD lives in `@/lib/cases/result-actions`;
 * this module is the READ side.
 *
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Result badge colour token (shares the constrained shared palette). */
export type PhaseResultColorToken = CaseStatusColorToken

/** One result option in a commission's vocabulary (the settings manager view). */
export interface PhaseResult {
  id: string
  commissionId: string
  /** pt-BR label (unique per commission). */
  label: string
  colorToken: PhaseResultColorToken
  /**
   * Tracking flag: marks the result as an adverse signal for a future dashboard
   * "% por resultado" breakdown. NOT a gate (this cut records & surfaces only).
   */
  isAdverse: boolean
  /** `true` when retired — hidden from pickers, but still renders existing references. */
  archived: boolean
  /** 1-based order within the commission's vocabulary. */
  position: number
}

/**
 * A result resolved for DISPLAY (label + presentation only) — the trimmed
 * projection rendered by the result badge on the board / detail / wizard. Resolved
 * LIVE from the vocabulary (propagates label/colour edits). Carries `source`
 * (`computed` vs `manual`) so the badge can show a "manual" marker; `null` source
 * on a freshly-resolved vocabulary option that is not yet an effective result.
 */
export interface ResolvedPhaseResult {
  id: string
  /** pt-BR label (resolved LIVE). */
  label: string
  colorToken: PhaseResultColorToken
  isAdverse: boolean
  /** How an EFFECTIVE phase result was set; `null` for a plain vocabulary option. */
  source: 'computed' | 'manual' | null
}

// ---------------------------------------------------------------------------
// Row shape + mapper
// ---------------------------------------------------------------------------

interface PhaseResultRow {
  id: string
  commission_id: string
  label: string
  color_token: PhaseResultColorToken
  is_adverse: boolean
  archived: boolean
  position: number
}

function mapResult(r: PhaseResultRow): PhaseResult {
  return {
    id: r.id,
    commissionId: r.commission_id,
    label: r.label,
    colorToken: r.color_token,
    isAdverse: r.is_adverse,
    archived: r.archived,
    position: r.position,
  }
}

const RESULT_SELECT =
  'id, commission_id, label, color_token, is_adverse, archived, position' as const

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The commission's result vocabulary, ordered by `position`. RLS-scoped (members
 * read); `[]` when unreadable or the flag is off.
 *
 * By default only NON-archived results are returned (rule editor / override
 * picker). Pass `includeArchived = true` (the staff_admin settings manager) for
 * the full vocabulary — an ADDITIVE optional param.
 */
export async function listPhaseResults(
  commissionId: string,
  includeArchived = false,
): Promise<PhaseResult[]> {
  const supabase = await createClient()
  let query = supabase
    .from('phase_results')
    .select(RESULT_SELECT)
    .eq('commission_id', commissionId)

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data, error } = await query
    .order('position', { ascending: true })
    .returns<PhaseResultRow[]>()

  if (error || !data) return []
  return data.map(mapResult)
}

/**
 * Flag probe for the `case_phase_results` feature (mirror `casePatientEnabled`).
 * `false` when the flag is off or unreadable — the UI hides the result surfaces.
 */
export async function phaseResultsEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('case_phase_results_enabled')
  if (error) return false
  return data === true
}
