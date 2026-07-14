'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'
import type { ReminderType } from '@/lib/queries/action-item-reminders'
import type { ActionItemUpdateType } from '@/lib/queries/action-item-updates'

/**
 * Server actions for the three action-item SATELLITES (reminders / updates /
 * checklists — plan §2.2–2.4). Every write routes through a DEFINER committee_*
 * satellite RPC; this layer maps the RPC's SQLSTATE to a pt-BR message so raw
 * Postgres errors never reach the UI (Rule 10). All gated by the `action_items`
 * flag (the RPCs re-check it, raising HC000 when off).
 *
 * Authority (enforced in the RPC, mirrored in the messages here):
 *   - reminders  -> staff_admin/org_admin of the item's commission (HC0I0);
 *   - updates    -> reader-with-a-stake (HC0I1);
 *   - checklists -> reader-with-a-stake (HC0I2).
 */

export interface ActionState {
  ok: boolean
  error?: string
}

const MESSAGES = {
  unavailable: 'Este recurso ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',
  reminderForbidden: 'Você não pode gerenciar lembretes deste item.',
  updateForbidden: 'Você não pode adicionar atualizações a este item.',
  checklistForbidden: 'Você não pode gerenciar a checklist deste item.',
  invalid: 'Dados inválidos. Verifique e tente novamente.',
  reminderCreated: 'Lembrete criado.',
  reminderUpdated: 'Lembrete atualizado.',
  reminderDeleted: 'Lembrete removido.',
  updateCreated: 'Atualização registrada.',
  checklistCreated: 'Item da checklist criado.',
  checklistUpdated: 'Item da checklist atualizado.',
  checklistDeleted: 'Item da checklist removido.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_RAISE_CHECK = 'HC000' // feature-off sentinel from the RPCs
const HC0I0 = 'HC0I0'
const HC0I1 = 'HC0I1'
const HC0I2 = 'HC0I2'
const CHECK_VIOLATION = 'check_violation'

const DETAIL_PATHS = [
  '/o/[org]/c/[commission]/manage/cases/[caseId]',
  '/o/[org]/c/[commission]/manage/meetings/[meetingId]',
  '/o/[org]/c/[commission]',
] as const

function revalidateActionItemSurfaces(): void {
  for (const p of DETAIL_PATHS) revalidatePath(p, 'page')
}

function mapError(
  error: { code?: string; message?: string } | null,
  forbidden: string,
): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case PG_RAISE_CHECK:
      return MESSAGES.unavailable
    case HC0I0:
    case HC0I1:
    case HC0I2:
      return forbidden
    case CHECK_VIOLATION:
    case PG_CHECK_VIOLATION:
      return MESSAGES.invalid
    default:
      return MESSAGES.generic
  }
}

async function ensureEnabled(): Promise<boolean> {
  return featureEnabled('action_items')
}

// ---------------------------------------------------------------------------
// Reminders (staff_admin/org_admin of the item's commission — RPC-enforced)
// ---------------------------------------------------------------------------

export async function createActionItemReminder(
  actionItemId: string,
  reminderType: ReminderType,
  offsetDays: number | null,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MESSAGES.generic }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_committee_action_item_reminder', {
    p_action_item_id: actionItemId,
    p_reminder_type: reminderType,
    p_offset_days: offsetDays ?? undefined,
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.reminderForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.reminderCreated }
}

export async function toggleActionItemReminder(
  reminderId: string,
  isActive: boolean,
): Promise<ActionState> {
  if (!reminderId) return { ok: false, error: MESSAGES.generic }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_committee_action_item_reminder', {
    p_id: reminderId,
    p_is_active: isActive,
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.reminderForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.reminderUpdated }
}

export async function deleteActionItemReminder(
  reminderId: string,
): Promise<ActionState> {
  if (!reminderId) return { ok: false, error: MESSAGES.generic }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_committee_action_item_reminder', {
    p_id: reminderId,
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.reminderForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.reminderDeleted }
}

// ---------------------------------------------------------------------------
// Updates feed (reader-with-a-stake — RPC-enforced; append-only)
// ---------------------------------------------------------------------------

export async function createActionItemUpdate(
  actionItemId: string,
  updateType: ActionItemUpdateType,
  body: string,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MESSAGES.generic }
  if (!body.trim()) return { ok: false, error: MESSAGES.invalid }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_committee_action_item_update', {
    p_action_item_id: actionItemId,
    p_update_type: updateType,
    p_body: body.trim(),
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.updateForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.updateCreated }
}

// ---------------------------------------------------------------------------
// Checklists (reader-with-a-stake — RPC-enforced)
// ---------------------------------------------------------------------------

export async function createActionItemChecklist(
  actionItemId: string,
  title: string,
  sortOrder: number | null = null,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MESSAGES.generic }
  if (!title.trim()) return { ok: false, error: MESSAGES.invalid }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_committee_action_item_checklist', {
    p_action_item_id: actionItemId,
    p_title: title.trim(),
    p_sort_order: sortOrder ?? undefined,
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.checklistForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.checklistCreated }
}

export async function toggleActionItemChecklist(
  checklistId: string,
  isDone: boolean,
): Promise<ActionState> {
  if (!checklistId) return { ok: false, error: MESSAGES.generic }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('toggle_committee_action_item_checklist', {
    p_id: checklistId,
    p_is_done: isDone,
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.checklistForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.checklistUpdated }
}

export async function updateActionItemChecklist(
  checklistId: string,
  title: string,
  sortOrder: number | null = null,
): Promise<ActionState> {
  if (!checklistId) return { ok: false, error: MESSAGES.generic }
  if (!title.trim()) return { ok: false, error: MESSAGES.invalid }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_committee_action_item_checklist', {
    p_id: checklistId,
    p_title: title.trim(),
    p_sort_order: sortOrder ?? undefined,
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.checklistForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.checklistUpdated }
}

export async function deleteActionItemChecklist(
  checklistId: string,
): Promise<ActionState> {
  if (!checklistId) return { ok: false, error: MESSAGES.generic }
  if (!(await ensureEnabled())) return { ok: false, error: MESSAGES.unavailable }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_committee_action_item_checklist', {
    p_id: checklistId,
  })

  if (error) return { ok: false, error: mapError(error, MESSAGES.checklistForbidden) }
  revalidateActionItemSurfaces()
  return { ok: true, error: MESSAGES.checklistDeleted }
}
