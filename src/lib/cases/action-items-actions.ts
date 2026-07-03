'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { casesExtrasEnabled } from '@/lib/cases/extras-gate'
import type { ActionItemStatus } from '@/lib/queries/case-action-items'

/**
 * Case ACTION ITEM server actions.
 *
 * As of the case-fold migration (20260707), case action items are `source_type =
 * 'case'` rows on the SHARED `public.action_items` hub (the old `case_action_items`
 * table + its 4 RPCs are dropped). These actions route through the unified
 * `committee_*` RPCs with `p_source_type = 'case'`; the RPCs preserve the OLD
 * case authority model exactly:
 *   - create / update  -> app.can_write_case_content (ADR 0033 D4);
 *   - advance / complete -> the ASSIGNEE or a content-writer of the case (HC027);
 *   - delete -> staff_admin/org_admin of the commission.
 * The case-source branch is additionally gated by the `cases_extras` flag (Q8).
 *
 * The exported signatures are UNCHANGED so the panel/form keep working. The hub
 * keys status by id (not the KEY string), so {@link advanceActionItem} translates
 * the KEY -> the commission/global status id before calling the RPC (mirrors the
 * meetings action's resolver).
 *
 * NAMING NOTE: `deleteActionItem` is a HARD delete (removes a mistakenly-created
 * item). To CANCEL (keep the audit row, status -> cancelled), use
 * `advanceActionItem(id, 'cancelled')` — there is no separate cancel action.
 *
 * SQLSTATE mapped to pt-BR: HC027 not entitled to update this action item.
 * Strings pt-BR; raw Postgres errors never reach the UI. Writes gate `cases_extras`.
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

const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'
const CASES_LIST_PATH = '/o/[org]/c/[commission]/manage/cases'
const DASHBOARD_PATH = '/o/[org]/c/[commission]/dashboard'

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

/**
 * Resolve {commissionId, caseId} for a CASE-sourced hub action item via the
 * RLS-scoped client (`source_case_id` is the case link). `null` if unreadable/
 * absent or not a case-sourced row.
 */
async function contextOfItem(
  supabase: SupabaseClient<Database>,
  actionItemId: string,
): Promise<{ commissionId: string; caseId: string } | null> {
  const { data } = await supabase
    .from('action_items')
    .select('commission_id, source_case_id')
    .eq('id', actionItemId)
    .eq('source_type', 'case')
    .maybeSingle<{ commission_id: string; source_case_id: string | null }>()
  if (!data || !data.source_case_id) return null
  return { commissionId: data.commission_id, caseId: data.source_case_id }
}

/**
 * Translate a lifecycle KEY -> the shared `action_items` status id (per-commission
 * override preferred, else global default). The hub keys status by id; the panel
 * still speaks in keys. `null` when the key is unknown (never for the 4 seeded keys).
 */
async function resolveStatusId(
  supabase: SupabaseClient<Database>,
  actionItemId: string,
  statusKey: ActionItemStatus,
): Promise<string | null> {
  const { data: item } = await supabase
    .from('action_items')
    .select('commission_id')
    .eq('id', actionItemId)
    .maybeSingle()

  const { data: statuses } = await supabase
    .from('action_item_statuses')
    .select('id, commission_id')
    .eq('key', statusKey)
    .eq('archived', false)

  if (!statuses || statuses.length === 0) return null

  const commissionId = item?.commission_id ?? null
  const override = commissionId
    ? statuses.find((s) => s.commission_id === commissionId)
    : undefined
  const global = statuses.find((s) => s.commission_id === null)
  return (override ?? global ?? statuses[0]).id
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
// Authoring (content-writers of the case — RPC-enforced)
// ---------------------------------------------------------------------------

/**
 * Create an action item on a case. `useActionState`-shaped. Fields: `caseId`,
 * `title`, `description?`, `assignedTo?`, `dueDate?`, `sourceCasePhaseId?`.
 * Routed through `create_committee_action_item` (`source_type='case'`), whose
 * authority is a content-writer of the case (ADR 0033 D4). Returns the new
 * `actionItemId`.
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

  // NB: no staff_admin pre-check — a case-write GRANTEE (not staff_admin) must be
  // allowed through, so the RPC's app.can_write_case_content gate is the sole
  // authority (mirrors the meetings-assignee pattern).

  const { data, error } = await supabase.rpc('create_committee_action_item', {
    p_commission: commissionId,
    p_source_type: 'case',
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
 * `useActionState`-shaped; expects `actionItemId`. Routed through
 * `update_committee_action_item`; authority is a content-writer of the case
 * (ADR 0033 D4). (Status changes go through advance/complete, not here.)
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

  // No staff_admin pre-check — a case-write grantee must be allowed through; the
  // RPC's can_write_case_content gate is the authority.
  const { error } = await supabase.rpc('update_committee_action_item', {
    p_id: actionItemId,
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
 * HARD-delete an action item (remove a mistakenly-created row). staff_admin/
 * org_admin-only — routed through `delete_committee_action_item`, which re-checks
 * the authority, cascades to assignments + status history, and audits the delete.
 * To CANCEL (keep the row), use `advanceActionItem(id, 'cancelled')`.
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

  const { error } = await supabase.rpc('delete_committee_action_item', {
    p_id: actionItemId,
  })

  if (error) return { ok: false, error: mapItemError(error) }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.deleted }
}

// ---------------------------------------------------------------------------
// Assignee / content-writer lifecycle (narrow RPC route)
// ---------------------------------------------------------------------------

/**
 * Advance an action item to another lifecycle `status`. Routed through
 * `advance_committee_action_item` (resolving the KEY -> the hub status id): the
 * caller must be the assignee OR a content-writer of the case (HC027 otherwise).
 * No commission-scoped pre-check here — a plain assignee (not staff_admin) must be
 * allowed through, so the RPC's internal gate is the sole authority.
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
  const statusId = await resolveStatusId(supabase, actionItemId, status)
  if (!statusId) return { ok: false, error: MESSAGES.missingItem }

  const { error } = await supabase.rpc('advance_committee_action_item', {
    p_id: actionItemId,
    p_to_status_id: statusId,
  })

  if (error) return { ok: false, error: mapItemError(error) }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.advanced }
}

/**
 * Mark an action item `done` (stamps `completed_at`/`completed_by`). Convenience
 * over {@link advanceActionItem}; same assignee-or-content-writer gate (HC027).
 * Routed through `complete_committee_action_item`.
 */
export async function completeActionItem(
  actionItemId: string,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MESSAGES.missingItem }

  if (!(await casesExtrasEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_committee_action_item', {
    p_id: actionItemId,
  })

  if (error) return { ok: false, error: mapItemError(error) }

  revalidateActionItems()
  return { ok: true, error: MESSAGES.completed }
}
