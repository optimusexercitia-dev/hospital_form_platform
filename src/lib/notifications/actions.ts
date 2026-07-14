'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { mapNotificationsError } from '@/lib/notifications/messages'
import type { NotificationSurface } from '@/lib/queries/notifications'

/**
 * S1·N (Phase 20; ADR 0076) server actions — every write routes through the
 * own-row RPCs (`mark_notification_read` / `mark_all_notifications_read` /
 * `set_notification_preferences`). Reads live in `queries/notifications.ts`
 * (mirrors the `signoffs.ts` / `safety/capa-actions.ts` read/write split).
 * All user-facing strings are pt-BR (`./messages.ts` via `mapNotificationsError`).
 */

export interface NotificationActionState {
  ok: boolean
  error?: string
}

// The bell/badge + center render inside the app shell across every `/o/[org]/...`
// route; a targeted revalidate would need to know the shell's exact layout path
// (frontend-owned, §2, not yet built as of this contract). Root-layout revalidate
// is the safe, simple choice — narrow it once the shell path is known.
function revalidateShell(): void {
  revalidatePath('/', 'layout')
}

/** Marks one of the caller's own notifications as read. HC0C1 if not found/not owned. */
export async function markNotificationRead(id: string): Promise<NotificationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_notification_read', { p_id: id })
  if (error) return { ok: false, error: mapNotificationsError(error) }

  revalidateShell()
  return { ok: true }
}

/** Marks every unread notification of the caller as read. */
export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) return { ok: false, error: mapNotificationsError(error) }

  revalidateShell()
  return { ok: true }
}

/** Sets the caller's own reminder toggle for one surface. HC0C0 on an invalid surface. */
export async function setNotificationPreference(
  surface: NotificationSurface,
  enabled: boolean,
): Promise<NotificationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_notification_preferences', {
    p_surface: surface,
    p_enabled: enabled,
  })
  if (error) return { ok: false, error: mapNotificationsError(error) }

  revalidateShell()
  return { ok: true }
}
