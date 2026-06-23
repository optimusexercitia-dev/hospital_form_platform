'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { PhaseResultColorToken } from '@/lib/queries/phase-results'

/**
 * Per-phase RESULT server actions (phase-results feature): manage a commission's
 * result VOCABULARY (create / update / reorder / archive) and apply a manual
 * result OVERRIDE to a case phase. Mirrors `@/lib/cases/outcomes-actions` (the
 * outcome vocabulary), but result options carry only the `isAdverse` tracking flag
 * (no `requiresActionPlan`).
 *
 * Architecture Rules 9 & 10: all mutations go through vetted RPCs (each gates the
 * `case_phase_results` flag + `is_staff_admin_of` server-side); user-facing strings
 * are pt-BR; raw Postgres errors never reach the UI (CLAUDE.md §8). Each action also
 * re-verifies commission-scoped authz for a clean pt-BR forbidden.
 *
 * The override flows through TWO server actions: the END-OF-WIZARD override is
 * folded into `submitCasePhaseResponse` (`@/lib/responses/actions`); the
 * POST-CONCLUSION correction (staff_admin, on a concluida phase of a non-terminal
 * case) is `overrideCasePhaseResult` here.
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

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCommission: 'Comissão não encontrada.',
  missingResult: 'Resultado não encontrado.',
  missingCase: 'Caso não encontrado.',
  labelRequired: 'Informe o nome do resultado.',
  labelTaken: 'Já existe um resultado com esse nome nesta comissão.',
  // override RPC discriminated failures
  phaseNotAdjustable: 'O resultado só pode ser ajustado em uma fase ativa ou concluída.',
  resultInvalid: 'Opção de resultado inválida para esta comissão.',
  caseTerminal: 'Este caso está em um estado final e não pode mais ser alterado.',
  // success copy
  resultCreated: 'Resultado criado com sucesso.',
  resultUpdated: 'Resultado atualizado com sucesso.',
  resultReordered: 'Ordem dos resultados atualizada.',
  resultArchived: 'Resultado arquivado.',
  resultOverridden: 'Resultado da fase atualizado.',
  resultOverrideCleared: 'Ajuste de resultado removido.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
const PG_FORBIDDEN = '42501'
const PG_NO_DATA_FOUND = 'P0002'
const HC_PHASE_NOT_ADJUSTABLE = 'HC057'
const HC_RESULT_INVALID = 'HC058'
const HC_CASE_TERMINAL = 'HC060'

const RESULT_SETTINGS_PATH = '/c/[slug]/manage/settings/resultados'
const TEMPLATE_PATH = '/c/[slug]/manage/process-templates/[templateId]'
const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const CASES_LIST_PATH = '/c/[slug]/manage/cases'
const DASHBOARD_PATH = '/c/[slug]/dashboard'

function revalidateResultVocabulary(): void {
  revalidatePath(RESULT_SETTINGS_PATH, 'page')
  revalidatePath(TEMPLATE_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

function revalidateCaseResult(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

/** Authorize a result action: admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

async function commissionOfResult(
  supabase: SupabaseClient<Database>,
  resultId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('phase_results')
    .select('commission_id')
    .eq('id', resultId)
    .maybeSingle()
  return data?.commission_id ?? null
}

async function commissionOfCasePhase(
  supabase: SupabaseClient<Database>,
  casePhaseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('case_phases')
    .select('cases ( commission_id )')
    .eq('id', casePhaseId)
    .maybeSingle<{ cases: { commission_id: string } | null }>()
  return data?.cases?.commission_id ?? null
}

/** Map a result-vocabulary RPC error to friendly pt-BR (prefer the RPC's message). */
function mapVocabError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.labelTaken
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return MESSAGES.missingResult
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

/** Map the override RPC error to friendly pt-BR. */
function mapOverrideError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_PHASE_NOT_ADJUSTABLE:
      return error.message || MESSAGES.phaseNotAdjustable
    case HC_RESULT_INVALID:
      return error.message || MESSAGES.resultInvalid
    case HC_CASE_TERMINAL:
      return error.message || MESSAGES.caseTerminal
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return MESSAGES.missingCase
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Vocabulary CRUD (staff_admin settings — the `resultados de fase` manager)
// ---------------------------------------------------------------------------

/**
 * Create a new result option in a commission's vocabulary (appended at the end of
 * the order). staff_admin-only; `unique(commission_id, label)` → already-exists.
 */
export async function createPhaseResult(
  commissionId: string,
  input: PhaseResultInput,
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_phase_result', {
    p_commission_id: commissionId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_is_adverse: input.isAdverse,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultCreated }
}

/**
 * Update a result definition (label / colour / `isAdverse`). Edits propagate LIVE
 * to every case/template referencing it (shared-row vocabulary). staff_admin-only.
 */
export async function updatePhaseResult(
  resultId: string,
  input: PhaseResultInput,
): Promise<ActionState> {
  if (!resultId) return { ok: false, error: MESSAGES.missingResult }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfResult(supabase, resultId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingResult }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_phase_result', {
    p_result_id: resultId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_is_adverse: input.isAdverse,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultUpdated }
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
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (orderedIds.length === 0) return { ok: true }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_phase_results', {
    p_commission_id: commissionId,
    p_ordered_ids: orderedIds,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultReordered }
}

/**
 * Archive (retire) a result option: hidden from pickers but still renders cases /
 * templates that reference it (FK is `ON DELETE SET NULL`; archive, never delete).
 * staff_admin-only.
 */
export async function archivePhaseResult(
  resultId: string,
): Promise<ActionState> {
  if (!resultId) return { ok: false, error: MESSAGES.missingResult }

  const supabase = await createClient()
  const commissionId = await commissionOfResult(supabase, resultId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingResult }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('archive_phase_result', {
    p_result_id: resultId,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultArchived }
}

// ---------------------------------------------------------------------------
// Post-conclusion result correction (staff_admin)
// ---------------------------------------------------------------------------

/**
 * Apply a manual result override to a case phase (the POST-CONCLUSION correction
 * entry point — the case-detail surface, on a `concluida` phase of a non-terminal
 * case). Wraps `set_case_phase_result_override`, which authorizes staff_admin/admin
 * of the case's commission, enforces the non-terminal-case precondition, validates
 * the option against the live vocabulary, and RECOMPUTES the effective result in
 * the same transaction (so the correction applies immediately; `resultId = null`
 * clears the override → recompute from the snapshotted ruleset). Per Rule 11 the
 * free-text `reason` is audited as a fact only, never copied into the payload.
 *
 * (The END-OF-WIZARD override, on an `ativa` phase, flows through
 * `submitCasePhaseResponse` instead — same RPC, different entry point.)
 */
export async function overrideCasePhaseResult(
  casePhaseId: string,
  resultId: string | null,
  reason: string | null,
): Promise<ActionState> {
  if (!casePhaseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const commissionId = await commissionOfCasePhase(supabase, casePhaseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_case_phase_result_override', {
    p_case_phase_id: casePhaseId,
    // `null` (clear) is valid (RPC p_result_id has DEFAULT NULL) but supabase-gen
    // typed this mid-list defaulted param as required `string`; cast to pass the
    // real null. `?? undefined` would WRONGLY clear when the caller passed null.
    p_result_id: resultId as unknown as string,
    p_reason: reason ?? undefined,
  })

  if (error) return { ok: false, error: mapOverrideError(error) }

  revalidateCaseResult()
  return {
    ok: true,
    error: resultId ? MESSAGES.resultOverridden : MESSAGES.resultOverrideCleared,
  }
}
