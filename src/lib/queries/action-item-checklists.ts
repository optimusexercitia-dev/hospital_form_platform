import { createClient } from '@/lib/supabase/server'

/**
 * Action-item CHECKLIST data-access (Architecture Rule 9). Satellite of the shared
 * `action_items` hub (ADR 0050; plan §2.4) — lightweight ordered SUBTASK rows
 * scoped to one action item. A checklist row is a binary subtask (`is_done`); a
 * subtask that needs its own owner/lifecycle should become its own `action_item`
 * instead (partner-handoff guidance §16). Reads are RLS-gated by the satellite
 * SELECT policy (verbatim `app.can_read_action_item`). Writes go through the
 * DEFINER `*_committee_action_item_checklist` RPCs (reader-with-a-stake gate;
 * HC0I2 otherwise) — see `src/lib/action-items/satellite-actions.ts`. PHI-free.
 */

/** One checklist subtask attached to an action item. */
export interface ActionItemChecklistRow {
  id: string
  actionItemId: string
  title: string
  isDone: boolean
  sortOrder: number
  completedAt: string | null
  completedBy: string | null
  /** Completer display name (query-layer `profiles` join); `null` if unresolved. */
  completedByName: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

interface ActionItemChecklistDbRow {
  id: string
  action_item_id: string
  title: string
  is_done: boolean
  sort_order: number
  completed_at: string | null
  completed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  completer: { full_name: string | null } | null
}

/**
 * The checklist rows of one action item, ordered by `sort_order` then creation.
 * RLS-scoped via the satellite SELECT policy (verbatim `app.can_read_action_item`),
 * so `[]` when the parent item is unreadable. The completer display name is joined
 * from the member-readable `profiles`. Returns `[]` on error (fail-closed).
 */
export async function listActionItemChecklist(
  actionItemId: string,
): Promise<ActionItemChecklistRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('action_item_checklists')
    .select(
      `
      id, action_item_id, title, is_done, sort_order,
      completed_at, completed_by, created_by, created_at, updated_at,
      completer:profiles!action_item_checklists_completed_by_fkey ( full_name )
    `,
    )
    .eq('action_item_id', actionItemId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<ActionItemChecklistDbRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    actionItemId: r.action_item_id,
    title: r.title,
    isDone: r.is_done,
    sortOrder: r.sort_order,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    completedByName: r.completer?.full_name ?? null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}
