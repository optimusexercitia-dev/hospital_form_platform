import { createClient } from '@/lib/supabase/server'

/**
 * Action-item UPDATES-feed data-access (Architecture Rule 9). Satellite of the
 * shared `action_items` hub (ADR 0050; plan §2.3) — the append-only NARRATIVE
 * timeline (what a human typed: notes, progress, blockers, deadline changes),
 * distinct from the system-authored structured `action_item_status_history` the
 * hub already keeps.
 *
 * Append-only: there is no update/delete RPC by design — a mistaken post is
 * superseded by a correcting note, not edited away (keeps the audit trail honest,
 * mirrors `action_item_status_history`). Reads are RLS-gated by the satellite
 * SELECT policy (verbatim `app.can_read_action_item`). Writes go through the
 * DEFINER `create_committee_action_item_update` RPC (reader-with-a-stake gate:
 * assignee / active assignment / staff_admin / org_admin; HC0I1 otherwise) — see
 * `src/lib/action-items/satellite-actions.ts`. PHI-free.
 */

/** The kind of narrative update posted to the feed. */
export type ActionItemUpdateType =
  | 'note'
  | 'progress'
  | 'blocker'
  | 'deadline_change'

/** One narrative update on an action item's feed. */
export interface ActionItemUpdate {
  id: string
  actionItemId: string
  authorId: string | null
  /** Author display name (query-layer `profiles` join); `null` if unresolved. */
  authorName: string | null
  updateType: ActionItemUpdateType
  body: string
  createdAt: string
}

interface ActionItemUpdateRow {
  id: string
  action_item_id: string
  author_id: string | null
  update_type: ActionItemUpdateType
  body: string
  created_at: string
  author: { full_name: string | null } | null
}

/**
 * The narrative updates on one action item, NEWEST first (a feed). RLS-scoped via
 * the satellite SELECT policy (verbatim `app.can_read_action_item`), so `[]` when
 * the parent item is unreadable. The author display name is joined from the
 * member-readable `profiles`. Returns `[]` on error (fail-closed).
 */
export async function listActionItemUpdates(
  actionItemId: string,
): Promise<ActionItemUpdate[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('action_item_updates')
    .select(
      `
      id, action_item_id, author_id, update_type, body, created_at,
      author:profiles!action_item_updates_author_id_fkey ( full_name )
    `,
    )
    .eq('action_item_id', actionItemId)
    .order('created_at', { ascending: false })
    .returns<ActionItemUpdateRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    actionItemId: r.action_item_id,
    authorId: r.author_id,
    authorName: r.author?.full_name ?? null,
    updateType: r.update_type,
    body: r.body,
    createdAt: r.created_at,
  }))
}
