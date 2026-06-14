'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { casesExtrasEnabled } from '@/lib/cases/extras-gate'
import type { ActionItemStatus } from '@/lib/queries/case-action-items'

/**
 * Case ACTION ITEM server actions (Cases-Extras batch, R4).
 *
 * Architecture Rules 9 & 10. staff_admin authors (create/update/delete);
 * ASSIGNEES advance their OWN items through the narrow `advance_action_item` /
 * `complete_action_item` RPCs (internal `assigned_to = auth.uid() or
 * is_staff_admin_of` gate, HC027 otherwise) — column control + the "mutations go
 * through vetted RPCs" ethos, not a broad UPDATE policy. Strings pt-BR; raw
 * Postgres errors never reach the UI. Writes gate the `cases_extras` flag.
 *
 * NAMING NOTE (kept to honour the posted stub signatures): `deleteActionItem` is
 * a HARD delete (authorized by the staff_admin-write RLS) for removing a
 * mistakenly-created item. To CANCEL an item (keep the audit row, status →
 * cancelled), use `advanceActionItem(id, 'cancelled')` — there is no separate
 * cancel action.
 *
 * New SQLSTATE mapped to pt-BR:
 *   HC027 not entitled to update this action item.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface CreateActionItemState extends ActionState {
  actionItemId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'Este recurso ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCase: 'Caso não encontrado.',
  missingItem: 'Item de ação não encontrado.',
  titleRequired: 'Informe o título do item.',
  assigneeNotMember: 'O responsável deve ser membro da comissão.',
  notEntitled: 'Você não pode alterar este item de ação.',
  dateInvalid: 'Informe uma data válida.',
  statusInvalid: 'Estado de item inválido.',
  created: 'Item de ação criado.',
  updated: 'Item de ação atualizado.',
  deleted: 'Item de ação removido.',
  advanced: 'Item de ação atualizado.',
  completed: 'Item de ação concluído.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_FORBIDDEN = '42501'
const HC_ASSIGNEE_NOT_MEMBER = 'HC021'
const HC_NOT_ENTITLED = 'HC027'

const ACTION_ITEM_STATUSES: ActionItemStatus[] = [
  'open',
  'in_progress',
  'done',
  'cancelled',
]

const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const CASES_LIST_PATH = '/c/[slug]/manage/cases'
const DASHBOARD_PATH = '/c/[slug]/dashboard'

function revalidateActionItems(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

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

/** Resolve {commissionId, caseId} for an action item via the RLS-scoped client. */
async function contextOfItem(
  supabase: SupabaseClient<Database>,
  actionItemId: string,
): Promise<{ commissionId: string; caseId: string } | null> {
  const { data } = await supabase
    .from('case_action_items')
    .select('case_id, cases(commission_id)')
    .eq('id', actionItemId)
    .maybeSingle<{
      case_id: string
      cases: { commission_id: string } | null
    }>()
  const commissionId = data?.cases?.commission_id
  if (!commissionId || !data) return null
  return { commissionId, caseId: data.case_id }
}

function parseDate(raw: string): string | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  if (d.toISOString().slice(0, 10) !== trimmed) return null
  return trimmed
}

function mapItemError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_NOT_ENTITLED:
      return error.message || MESSAGES.notEntitled
    case HC_ASSIGNEE_NOT_MEMBER:
      return error.message || MESSAGES.assigneeNotMember
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// staff_admin authoring
// ---------------------------------------------------------------------------

/**
 * Create an action item on a case. `useActionState`-shaped. Fields: `caseId`,
 * `title`, `description?`, `assignedTo?`, `dueDate?`, `sourceCasePhaseId?`.
 * staff_admin-only. Returns the new `actionItemId`.
 */
export async function createActionItem(
  _prev: CreateActionItemState | undefined,
  formData: FormData,
): Promise<CreateActionItemState> {
  const caseId = String(formData.get('caseId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const assignedTo = String(formData.get('assignedTo') ?? '').trim()
  const sourceCasePhaseId = String(formData.get('sourceCasePhaseId') ?? '').trim()
  const dueDate = parseDate(String(formData.get('dueDate') ?? ''))

  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  }
  if (dueDate === null) {
    return { ok: false, fieldErrors: { dueDate: MESSAGES.dateInvalid } }
  }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('create_action_item', {
    p_case_id: caseId,
    p_title: title,
    p_description: description || undefined,
    p_assigned_to: assignedTo || undefined,
    p_due_date: dueDate || undefined,
    p_source_case_phase_id: sourceCasePhaseId || undefined,
  })

  if (error || !data) return { ok: false, error: mapItemError(error) }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.created, actionItemId: data.id }
}

/**
 * Edit an action item (`title` / `description` / `assignedTo` / `dueDate`).
 * `useActionState`-shaped; expects `actionItemId`. staff_admin-only. (Status
 * changes go through advance/complete, not here.)
 */
export async function updateActionItem(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const actionItemId = String(formData.get('actionItemId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const assignedTo = String(formData.get('assignedTo') ?? '').trim()
  const dueDate = parseDate(String(formData.get('dueDate') ?? ''))

  if (!actionItemId) return { ok: false, error: MESSAGES.missingItem }
  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  }
  if (dueDate === null) {
    return { ok: false, fieldErrors: { dueDate: MESSAGES.dateInvalid } }
  }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const ctx = await contextOfItem(supabase, actionItemId)
  if (!ctx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_action_item', {
    p_action_item_id: actionItemId,
    p_title: title,
    p_description: description || undefined,
    p_assigned_to: assignedTo || undefined,
    p_due_date: dueDate || undefined,
  })

  if (error) return { ok: false, error: mapItemError(error) }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.updated }
}

/**
 * HARD-delete an action item (remove a mistakenly-created row). staff_admin-only
 * — authorized by the staff_admin-write RLS policy + an explicit authz check. To
 * CANCEL (keep the row), use `advanceActionItem(id, 'cancelled')`.
 */
export async function deleteActionItem(
  actionItemId: string,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MESSAGES.missingItem }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const ctx = await contextOfItem(supabase, actionItemId)
  if (!ctx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase
    .from('case_action_items')
    .delete()
    .eq('id', actionItemId)

  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.deleted }
}

// ---------------------------------------------------------------------------
// Assignee / staff_admin lifecycle (narrow RPC route)
// ---------------------------------------------------------------------------

/**
 * Advance an action item to another lifecycle `status`. Routed through
 * `advance_action_item`: the caller must be the assignee OR a staff_admin of the
 * case's commission (HC027 otherwise). No commission-scoped authz pre-check here
 * — a plain assignee (not staff_admin) must be allowed through, so the RPC's
 * internal gate is the sole authority (mirrors `startOrResumePhase`).
 */
export async function advanceActionItem(
  actionItemId: string,
  status: ActionItemStatus,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MESSAGES.missingItem }
  if (!ACTION_ITEM_STATUSES.includes(status)) {
    return { ok: false, error: MESSAGES.statusInvalid }
  }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('advance_action_item', {
    p_action_item_id: actionItemId,
    p_status: status,
  })

  if (error) return { ok: false, error: mapItemError(error) }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.advanced }
}

/**
 * Mark an action item `done` (stamps `completed_at`/`completed_by`). Convenience
 * over {@link advanceActionItem}; same assignee-or-staff_admin gate (HC027).
 */
export async function completeActionItem(
  actionItemId: string,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MESSAGES.missingItem }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_action_item', {
    p_action_item_id: actionItemId,
  })

  if (error) return { ok: false, error: mapItemError(error) }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.completed }
}
