'use server'

import type { PhaseResultColorToken } from '@/lib/queries/phase-results'

/**
 * Per-phase RESULT vocabulary server actions (phase-results feature): manage a
 * commission's result VOCABULARY (create / update / reorder / archive). Mirrors
 * `@/lib/cases/outcomes-actions` (the outcome vocabulary), but result options
 * carry only the `isAdverse` tracking flag (no `requiresActionPlan`).
 *
 * Architecture Rules 9 & 10: all mutations go through vetted RPCs (each gates the
 * `case_phase_results` flag + `is_staff_admin_of` server-side); user-facing
 * strings are pt-BR; raw Postgres errors never reach the UI (CLAUDE.md §8). Each
 * action also re-verifies commission-scoped authz for a clean pt-BR forbidden.
 *
 * NOTE: stubs — implementations land in task #4 (contract-first signatures only).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A `create`/`update` result-definition input (label + presentation + flag). */
export interface PhaseResultInput {
  label: string
  colorToken: PhaseResultColorToken
  /** Adverse-signal tracking flag (non-gating; feeds a future "% por resultado" tile). */
  isAdverse: boolean
}

/**
 * Create a new result option in a commission's vocabulary (appended at the end of
 * the order). staff_admin-only; `unique(commission_id, label)` → already-exists.
 */
export async function createPhaseResult(
  commissionId: string,
  input: PhaseResultInput,
): Promise<ActionState> {
  void commissionId
  void input
  throw new Error('not implemented')
}

/**
 * Update a result definition (label / colour / `isAdverse`). Edits propagate LIVE
 * to every case/template referencing it (shared-row vocabulary). staff_admin-only.
 */
export async function updatePhaseResult(
  resultId: string,
  input: PhaseResultInput,
): Promise<ActionState> {
  void resultId
  void input
  throw new Error('not implemented')
}

/**
 * Reorder result options within a commission's vocabulary (drag in the settings
 * manager). `orderedIds` is the full set of NON-archived ids in their new order.
 * staff_admin-only.
 */
export async function reorderPhaseResults(
  commissionId: string,
  orderedIds: string[],
): Promise<ActionState> {
  void commissionId
  void orderedIds
  throw new Error('not implemented')
}

/**
 * Archive (retire) a result option: hidden from pickers but still renders cases /
 * templates that reference it (FK is `ON DELETE SET NULL`; archive, never delete).
 * staff_admin-only.
 */
export async function archivePhaseResult(
  resultId: string,
): Promise<ActionState> {
  void resultId
  throw new Error('not implemented')
}
