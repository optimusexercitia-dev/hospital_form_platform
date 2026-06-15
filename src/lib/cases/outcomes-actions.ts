'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { CaseOutcomeColorToken } from '@/lib/queries/case-outcomes'

/**
 * Case OUTCOME server actions (Case data-model adjustments — outcomes; D8–D11,
 * D15): set a case's single outcome, manage a commission's outcome VOCABULARY
 * (create / update / reorder / archive), and set which outcomes a draft PROCESS
 * offers.
 *
 * Architecture Rules 9 & 10: all mutations go through vetted RPCs (which gate
 * `cases_extras` + `is_staff_admin_of` server-side); user-facing strings are
 * pt-BR; raw Postgres errors never reach the UI (CLAUDE.md §8). Each action also
 * re-verifies commission-scoped authz server-side for a clean pt-BR forbidden,
 * mirroring `@/lib/cases/tags-actions`.
 *
 * `setCaseOutcome` writes `cases.outcome_id` on a NON-terminal case (rejected on a
 * terminal case — HC025); a non-null outcome must be in the case's FROZEN
 * `case_offered_outcomes` (HC029). `setProcessOutcomes` is DRAFT-only and
 * delete-then-insert; the same-commission guard raises HC030.
 *
 * New SQLSTATEs mapped to pt-BR: HC025 (case terminal), HC029 (outcome not
 * offered by this case's process), HC030 (outcome/commission mismatch).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A `create`/`update` outcome-definition input (label + presentation + flags). */
export interface CaseOutcomeInput {
  label: string
  colorToken: CaseOutcomeColorToken
  requiresActionPlan: boolean
  isAdverse: boolean
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCase: 'Caso não encontrado.',
  missingCommission: 'Comissão não encontrada.',
  missingOutcome: 'Desfecho não encontrado.',
  missingTemplate: 'Processo não encontrado.',
  labelRequired: 'Informe o nome do desfecho.',
  labelTaken: 'Já existe um desfecho com esse nome nesta comissão.',
  caseTerminal: 'Este caso está em um estado final e não pode mais ser alterado.',
  outcomeNotOffered: 'Este desfecho não está disponível para este caso.',
  commissionMismatch: 'Este desfecho não pertence à comissão deste processo.',
  outcomeSet: 'Desfecho do caso atualizado.',
  outcomeCleared: 'Desfecho do caso removido.',
  outcomeCreated: 'Desfecho criado com sucesso.',
  outcomeUpdated: 'Desfecho atualizado com sucesso.',
  outcomeReordered: 'Ordem dos desfechos atualizada.',
  outcomeArchived: 'Desfecho arquivado.',
  processOutcomesSet: 'Desfechos do processo atualizados.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
const PG_FORBIDDEN = '42501'
const HC_CASE_TERMINAL = 'HC025'
const HC_OUTCOME_NOT_OFFERED = 'HC029'
const HC_COMMISSION_MISMATCH = 'HC030'

const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const CASES_LIST_PATH = '/c/[slug]/manage/cases'
const OUTCOME_SETTINGS_PATH = '/c/[slug]/manage/settings/desfechos'
const DASHBOARD_PATH = '/c/[slug]/dashboard'
const TEMPLATE_PATH = '/c/[slug]/manage/process-templates/[templateId]'

function revalidateOutcomeVocabulary(): void {
  revalidatePath(OUTCOME_SETTINGS_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
}

function revalidateCaseOutcome(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

/** Authorize an outcome action: admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

async function commissionOfCase(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('cases')
    .select('commission_id')
    .eq('id', caseId)
    .maybeSingle()
  return data?.commission_id ?? null
}

async function commissionOfOutcome(
  supabase: SupabaseClient<Database>,
  outcomeId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('case_outcomes')
    .select('commission_id')
    .eq('id', outcomeId)
    .maybeSingle()
  return data?.commission_id ?? null
}

async function commissionOfTemplate(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('process_templates')
    .select('commission_id')
    .eq('id', templateId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/** Map an outcome RPC error to friendly pt-BR (prefer the RPC's own message). */
function mapOutcomeError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_CASE_TERMINAL:
      return error.message || MESSAGES.caseTerminal
    case HC_OUTCOME_NOT_OFFERED:
      return error.message || MESSAGES.outcomeNotOffered
    case HC_COMMISSION_MISMATCH:
      return error.message || MESSAGES.commissionMismatch
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.labelTaken
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Case-level: assign / clear a case's single outcome
// ---------------------------------------------------------------------------

/**
 * Set (or clear, with `null`) a case's single outcome (D9). Funnels through
 * `set_case_outcome`: rejects a terminal case (HC025); a non-null `outcomeId`
 * must be one the case's PROCESS offered (the frozen `case_offered_outcomes` —
 * HC029). Used by the case-detail selector (non-terminal) and captured by the
 * conclude dialog before `closeCase`. staff_admin-only.
 */
export async function setCaseOutcome(
  caseId: string,
  outcomeId: string | null,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_case_outcome', {
    p_case_id: caseId,
    p_outcome_id: outcomeId ?? undefined,
  })

  if (error) return { ok: false, error: mapOutcomeError(error) }

  revalidateCaseOutcome()
  return {
    ok: true,
    error: outcomeId ? MESSAGES.outcomeSet : MESSAGES.outcomeCleared,
  }
}

// ---------------------------------------------------------------------------
// Vocabulary CRUD (staff_admin settings — the `desfechos` manager)
// ---------------------------------------------------------------------------

/**
 * Create a new outcome in a commission's vocabulary (appended at the end of the
 * order). staff_admin-only; `unique(commission_id, label)` → already-exists.
 */
export async function createCaseOutcome(
  commissionId: string,
  input: CaseOutcomeInput,
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_case_outcome', {
    p_commission_id: commissionId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_requires_action_plan: input.requiresActionPlan,
    p_is_adverse: input.isAdverse,
  })

  if (error) return { ok: false, error: mapOutcomeError(error) }

  revalidateOutcomeVocabulary()
  return { ok: true, error: MESSAGES.outcomeCreated }
}

/**
 * Update an outcome definition (label / colour / `requiresActionPlan` /
 * `isAdverse`). Edits propagate to every case/process referencing it (D11 —
 * shared-row vocabulary, no per-case snapshot of the row). staff_admin-only.
 */
export async function updateCaseOutcome(
  outcomeId: string,
  input: CaseOutcomeInput,
): Promise<ActionState> {
  if (!outcomeId) return { ok: false, error: MESSAGES.missingOutcome }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfOutcome(supabase, outcomeId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingOutcome }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_case_outcome', {
    p_outcome_id: outcomeId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_requires_action_plan: input.requiresActionPlan,
    p_is_adverse: input.isAdverse,
  })

  if (error) return { ok: false, error: mapOutcomeError(error) }

  revalidateOutcomeVocabulary()
  return { ok: true, error: MESSAGES.outcomeUpdated }
}

/**
 * Reorder outcomes within a commission's vocabulary (drag in the settings
 * manager). `orderedIds` is the full set of NON-archived ids in their new order.
 * staff_admin-only; persisted via the DEFERRABLE position-unique swap.
 */
export async function reorderCaseOutcomes(
  commissionId: string,
  orderedIds: string[],
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (orderedIds.length === 0) return { ok: true }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_case_outcomes', {
    p_commission_id: commissionId,
    p_ordered_ids: orderedIds,
  })

  if (error) return { ok: false, error: mapOutcomeError(error) }

  revalidateOutcomeVocabulary()
  return { ok: true, error: MESSAGES.outcomeReordered }
}

/**
 * Archive (retire) an outcome: hidden from pickers but still renders cases /
 * processes that reference it (D11 propagation). A referenced vocabulary row is
 * never DELETED (the `cases.outcome_id` FK is `NO ACTION`) — archive instead.
 * staff_admin-only.
 */
export async function archiveCaseOutcome(
  outcomeId: string,
): Promise<ActionState> {
  if (!outcomeId) return { ok: false, error: MESSAGES.missingOutcome }

  const supabase = await createClient()
  const commissionId = await commissionOfOutcome(supabase, outcomeId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingOutcome }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('archive_case_outcome', {
    p_outcome_id: outcomeId,
  })

  if (error) return { ok: false, error: mapOutcomeError(error) }

  revalidateOutcomeVocabulary()
  return { ok: true, error: MESSAGES.outcomeArchived }
}

// ---------------------------------------------------------------------------
// Process-side: which outcomes a draft process offers (D15)
// ---------------------------------------------------------------------------

/**
 * Set the full set of outcomes a DRAFT process template offers (the builder's
 * multiselect). Delete-then-insert of `process_template_outcomes`; the
 * same-commission guard raises HC030 if an outcome is not in the template's
 * commission. DRAFT-only (a published template is frozen, like its phases).
 * Pass `[]` to offer none (D15 — outcomes optional per process). staff_admin-only.
 */
export async function setProcessOutcomes(
  templateId: string,
  outcomeIds: string[],
): Promise<ActionState> {
  if (!templateId) return { ok: false, error: MESSAGES.missingTemplate }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_process_outcomes', {
    p_template_id: templateId,
    p_outcome_ids: outcomeIds,
  })

  if (error) return { ok: false, error: mapOutcomeError(error) }

  revalidatePath(TEMPLATE_PATH, 'page')
  return { ok: true, error: MESSAGES.processOutcomesSet }
}
