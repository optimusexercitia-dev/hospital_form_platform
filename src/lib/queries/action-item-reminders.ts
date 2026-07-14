import { createClient } from '@/lib/supabase/server'

/**
 * Action-item REMINDER-rules data-access (Architecture Rule 9 — all reads go
 * through `src/lib/queries/`). Satellite of the shared `action_items` hub
 * (ADR 0050; plan `docs/plans/action-items-satellites.md` §2.2).
 *
 * A reminder is a *rule* (when to nudge relative to the item's `due_date`), NOT a
 * delivered notification — actual delivery is the Notifications track's job (the
 * inert §3 scan-arm reads these rows once that engine lands). Reads are RLS-gated
 * by the satellite SELECT policy (`app.can_read_action_item(action_item_id,
 * auth.uid())` — verbatim hub reuse): a reminder on a `case_restricted` item is
 * invisible to a non-case-reader exactly like the item itself.
 *
 * Writes go through the DEFINER `*_committee_action_item_reminder` RPCs
 * (staff_admin/org_admin of the item's commission; HC0I0 otherwise) — see
 * `src/lib/action-items/satellite-actions.ts`. PHI-free (the hub is a non-PHI
 * surface end-to-end).
 */

/** When a reminder fires relative to the item's `due_date`. */
export type ReminderType = 'before_due' | 'on_due' | 'after_due'

/** One reminder rule attached to an action item. */
export interface ActionItemReminder {
  id: string
  actionItemId: string
  reminderType: ReminderType
  /** Days offset; interpretation depends on `reminderType`. `null` iff `on_due`. */
  offsetDays: number | null
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * The reminder rules configured for one action item, oldest first. RLS-scoped via
 * the satellite SELECT policy (verbatim `app.can_read_action_item`), so `[]` when
 * the parent item is unreadable. Returns `[]` on error (fail-closed).
 */
export async function listActionItemReminders(
  actionItemId: string,
): Promise<ActionItemReminder[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('action_item_reminders')
    .select(
      'id, action_item_id, reminder_type, offset_days, is_active, created_by, created_at, updated_at',
    )
    .eq('action_item_id', actionItemId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    actionItemId: r.action_item_id,
    reminderType: r.reminder_type as ReminderType,
    offsetDays: r.offset_days,
    isActive: r.is_active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}
