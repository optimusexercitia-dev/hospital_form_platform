'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { CaseStatusColorToken } from '@/lib/queries/case-statuses'
import type { CaseStatusKey } from '@/lib/queries/cases'

/**
 * Case-status server actions (Cases-Extras batch, R2): set a case's macro status
 * (the coordinator board move / status picker) and manage the per-commission
 * status VOCABULARY (create / update / reorder / archive).
 *
 * Architecture Rules 9 & 10: all mutations go through vetted RPCs; user-facing
 * strings are pt-BR; raw Postgres errors never reach the UI (CLAUDE.md §8).
 * SECURITY: RLS staff_admin-write + each RPC's internal gate are the authority;
 * each action also re-verifies commission-scoped authz server-side for a clean
 * pt-BR forbidden. `setCaseStatus` funnels through `set_case_status` (the only
 * path that flips `cases.status` and, on entering a terminal status, closes open
 * phases). The vocabulary CRUD + `set_case_status` are gated by the
 * `cases_extras` feature flag (the modified CORE phase RPCs keep gating only
 * `cases_multi_phase`).
 *
 * New SQLSTATEs mapped to pt-BR:
 *   HC024 invalid case status key for this commission;
 *   HC025 case already terminal (frozen).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A `create`/`update` status-definition input (label + presentation + flags). */
export interface CaseStatusInput {
  label: string
  colorToken: CaseStatusColorToken
  isInitial: boolean
  isTerminal: boolean
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCase: 'Caso não encontrado.',
  missingCommission: 'Comissão não encontrada.',
  labelRequired: 'Informe o nome do estado.',
  invalidStatus: 'Estado de caso inválido para esta comissão.',
  caseTerminal: 'Este caso está em um estado final e não pode mais ser alterado.',
  nameTaken: 'Já existe um estado com esse nome nesta comissão.',
  cannotArchiveInitial: 'Defina outro estado inicial antes de arquivar este.',
  statusSet: 'Estado do caso atualizado.',
  statusCreated: 'Estado criado com sucesso.',
  statusUpdated: 'Estado atualizado com sucesso.',
  statusReordered: 'Ordem dos estados atualizada.',
  statusArchived: 'Estado arquivado.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
const PG_FORBIDDEN = '42501'
const HC_INVALID_STATUS = 'HC024'
const HC_CASE_TERMINAL = 'HC025'

const CASES_LIST_PATH = '/c/[slug]/manage/cases'
const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const STATUS_SETTINGS_PATH = '/c/[slug]/manage/settings/statuses'

function revalidateCases(): void {
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
}

function revalidateStatusSettings(): void {
  revalidatePath(STATUS_SETTINGS_PATH, 'page')
  revalidateCases()
}

/** Authorize a status action: admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

/** Resolve a case's commission via the RLS-scoped client (null = unseen). */
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

/** Map a status RPC error to friendly pt-BR (prefer the RPC's own message). */
function mapStatusError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_INVALID_STATUS:
      return error.message || MESSAGES.invalidStatus
    case HC_CASE_TERMINAL:
      return error.message || MESSAGES.caseTerminal
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.nameTaken
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      // The "set another initial before archiving" guard + a blank-label guard
      // both raise check_violation with their own pt-BR text; prefer it.
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Case-level: move a case to another configured status
// ---------------------------------------------------------------------------

/**
 * Set a case's macro status to `statusKey` (the coordinator board move / status
 * picker). Funnels through `set_case_status`: validates the key against the
 * case's commission (HC024), rejects a case already terminal (HC025), and — when
 * `statusKey` is terminal — flips remaining open phases to `nao_necessaria` and
 * stamps `closed_at`/`closed_by`. Any non-terminal → any defined status is
 * allowed (no transition matrix).
 */
export async function setCaseStatus(
  caseId: string,
  statusKey: CaseStatusKey,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!statusKey) return { ok: false, error: MESSAGES.invalidStatus }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_case_status', {
    p_case_id: caseId,
    p_status_key: statusKey,
  })

  if (error) return { ok: false, error: mapStatusError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.statusSet }
}

// ---------------------------------------------------------------------------
// Vocabulary CRUD (staff_admin settings)
// ---------------------------------------------------------------------------

/**
 * Create a new status in a commission's vocabulary (appended at the end of the
 * order; the key is slugified from the label server-side). staff_admin-only.
 */
export async function createCaseStatus(
  commissionId: string,
  input: CaseStatusInput,
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_case_status', {
    p_commission_id: commissionId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_is_initial: input.isInitial,
    p_is_terminal: input.isTerminal,
  })

  if (error) return { ok: false, error: mapStatusError(error) }

  revalidateStatusSettings()
  return { ok: true, error: MESSAGES.statusCreated }
}

/**
 * Update a status definition (label / colour / initial / terminal flags). The
 * `key` is immutable (it is the value stored on existing cases). staff_admin-
 * only; promoting a status to `is_initial` demotes the previous initial.
 */
export async function updateCaseStatus(
  statusKey: CaseStatusKey,
  commissionId: string,
  input: CaseStatusInput,
): Promise<ActionState> {
  if (!statusKey) return { ok: false, error: MESSAGES.invalidStatus }
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_case_status', {
    p_status_key: statusKey,
    p_commission_id: commissionId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_is_initial: input.isInitial,
    p_is_terminal: input.isTerminal,
  })

  if (error) return { ok: false, error: mapStatusError(error) }

  revalidateStatusSettings()
  return { ok: true, error: MESSAGES.statusUpdated }
}

/**
 * Reorder a status within its commission's set (drag in the settings manager).
 * `orderedKeys` is the full set of NON-archived keys in their new order.
 * staff_admin-only; persisted via the DEFERRABLE position-unique swap.
 */
export async function reorderCaseStatus(
  commissionId: string,
  orderedKeys: CaseStatusKey[],
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (orderedKeys.length === 0) return { ok: true }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_case_status', {
    p_commission_id: commissionId,
    p_ordered_keys: orderedKeys,
  })

  if (error) return { ok: false, error: mapStatusError(error) }

  revalidateStatusSettings()
  return { ok: true, error: MESSAGES.statusReordered }
}

/**
 * Archive (retire) a status: hidden from board columns / pickers but still
 * renders existing cases that reference it. staff_admin-only. Cannot archive the
 * sole non-archived `is_initial`.
 */
export async function archiveCaseStatus(
  statusKey: CaseStatusKey,
  commissionId: string,
): Promise<ActionState> {
  if (!statusKey) return { ok: false, error: MESSAGES.invalidStatus }
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_case_status', {
    p_status_key: statusKey,
    p_commission_id: commissionId,
  })

  if (error) return { ok: false, error: mapStatusError(error) }

  revalidateStatusSettings()
  return { ok: true, error: MESSAGES.statusArchived }
}
