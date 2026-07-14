"use server";

import {
  listActionItemReminders,
  type ActionItemReminder,
} from "@/lib/queries/action-item-reminders";
import {
  listActionItemUpdates,
  type ActionItemUpdate,
} from "@/lib/queries/action-item-updates";
import {
  listActionItemChecklist,
  type ActionItemChecklistRow,
} from "@/lib/queries/action-item-checklists";

/**
 * On-demand loader for the three action-item SATELLITE lists (reminders /
 * updates / checklist), used by the client detail surface which fetches lazily
 * on expand rather than eagerly for every row of every panel.
 *
 * This is a thin composition over the backend query layer (Architecture Rule 9
 * — no raw supabase-js here; it only calls the typed `list*` functions in
 * `src/lib/queries/`). Every read is RLS-scoped by the satellite SELECT policy
 * (verbatim `app.can_read_action_item`), so an unreadable item yields three
 * empty lists — never a leak. The three reads run in parallel.
 */

export interface ActionItemSatelliteData {
  reminders: ActionItemReminder[];
  updates: ActionItemUpdate[];
  checklist: ActionItemChecklistRow[];
}

export async function loadActionItemSatellites(
  actionItemId: string,
): Promise<ActionItemSatelliteData> {
  const [reminders, updates, checklist] = await Promise.all([
    listActionItemReminders(actionItemId),
    listActionItemUpdates(actionItemId),
    listActionItemChecklist(actionItemId),
  ]);

  return { reminders, updates, checklist };
}
