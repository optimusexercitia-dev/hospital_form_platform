'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'

/**
 * Shared Action-Items Hub — COMMITTEE (manual-source) authoring actions.
 *
 * The hub's case- and meeting-sourced create paths already have exported actions
 * (`src/lib/cases/action-items-actions.ts` requires a `caseId` + is `cases_extras`-
 * gated; `src/lib/meetings/actions.ts` requires a `meeting_id`). This module
 * exposes the hub's **`manual`** source — a committee-scoped action item with no
 * case/meeting parent — which nothing else surfaced. It is a GENERAL hub
 * capability; the Phase-15 off-target two-tier fallback (F5) is its first consumer
 * (a non-operator staff_admin who cannot open a CAPA creates a committee action
 * item instead — ADR 0057), but it is not indicator-specific.
 *
 * Routed through `create_committee_action_item` (`p_source_type='manual'`), whose
 * authority is `is_staff_admin_of OR is_commission_admin_of` of the commission
 * (verified live), and which emits an `action_item.created` audit row. Gated on
 * the hub's own **`action_items`** flag (NOT `cases_extras`). No schema change —
 * the table + RPC already exist.
 *
 * `useActionState`-shaped `{ ok, error?, fieldErrors? }`; pt-BR errors; raw
 * Postgres errors never reach the UI (§8, Rule 10).
 */

/** `useActionState`-shaped result (the action-items-hub convention). */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** Create returns the new hub item id so a caller can link to / highlight it. */
export interface CreateActionItemState extends ActionState {
  actionItemId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'Este recurso ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCommission: 'Comissão não encontrada.',
  titleRequired: 'Informe o título do item.',
  assigneeNotMember: 'O responsável deve ser membro da comissão.',
  dateInvalid: 'Informe uma data válida.',
  created: 'Item de ação criado.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_FORBIDDEN = '42501'
const HC_ASSIGNEE_NOT_MEMBER = 'HC021'

const HUB_LIST_PATH = '/o/[org]/c/[commission]'
const OVERVIEW_PATH = '/o/[org]/c/[commission]/manage/overview'

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

/**
 * Create a COMMITTEE (manual-source) action item on the shared hub.
 * `useActionState`-shaped. Fields: `commissionId`, `title`, `description?`,
 * `assignedTo?`, `dueDate?`. Routed through `create_committee_action_item`
 * (`source_type='manual'`), whose authority is a staff_admin / commission_admin of
 * the commission (the RPC gate is the sole authority; the pre-check below is a
 * fast fail-friendly guard, not the boundary). Gated on the `action_items` flag.
 * Returns the new `actionItemId`.
 */
export async function createManualActionItem(
  _prev: CreateActionItemState | undefined,
  formData: FormData,
): Promise<CreateActionItemState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const assignedTo = String(formData.get('assignedTo') ?? '').trim()
  const dueDate = parseDate(String(formData.get('dueDate') ?? ''))

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  }
  if (dueDate === null) {
    return { ok: false, fieldErrors: { dueDate: MESSAGES.dateInvalid } }
  }

  if (!(await featureEnabled('action_items'))) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  // No client-side authority pre-check: the RPC's `is_staff_admin_of OR
  // is_commission_admin_of` gate is the SOLE authority (a commission_admin who is
  // an org_admin/hospital_admin but not a direct staff_admin member is valid and a
  // membership-only pre-check would wrongly reject them). A 42501 maps to the
  // friendly `forbidden` message (same discipline as the case-source create).
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_committee_action_item', {
    p_commission: commissionId,
    p_source_type: 'manual',
    p_title: title,
    p_description: description || undefined,
    p_assigned_to: assignedTo || undefined,
    p_due_date: dueDate || undefined,
  })

  if (error || !data) return { ok: false, error: mapItemError(error) }

  revalidatePath(HUB_LIST_PATH, 'page')
  revalidatePath(OVERVIEW_PATH, 'page')
  return { ok: true, error: MESSAGES.created, actionItemId: data.id }
}
