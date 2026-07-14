import { createClient } from '@/lib/supabase/server'
import { notificationHref } from '@/lib/routing'
import { resolveCommissionSlugs } from '@/lib/notifications/routing-context'

/**
 * S1·N Notifications data-access (Phase 20; ADR 0076; Architecture Rule 9 —
 * all reads through `src/lib/queries/`). READS ONLY: mutations
 * (mark-read/mark-all-read/set-preference, each an RPC call) live in
 * `src/lib/notifications/actions.ts` (mirrors the `signoffs.ts` /
 * `safety/capa-actions.ts` read/write split elsewhere in this codebase).
 *
 * `notifications`/`notification_preferences` are own-row RLS (Rule 1) — every
 * query here is implicitly scoped to the calling user; no explicit
 * `user_id` filter is ever needed or applied.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type NotificationKind = 'capa' | 'signoff' | 'meeting' | 'action_item'

/**
 * The suppressible reminder SURFACES — a strict subset of {@link NotificationKind}.
 * `action_item` is a kind but deliberately NOT a preference surface (S1 deferral,
 * BE-6·N): action-item reminders are opt-in-by-config (a staff_admin creates the
 * rule), so a global per-user mute is low-value and deferred. Preferences are
 * keyed by this narrower type, not by NotificationKind.
 */
export type NotificationSurface = 'capa' | 'signoff' | 'meeting'

export type NotificationMilestone =
  | 'assigned'
  | 'requested'
  | 'convoked'
  | 'due_soon'
  | 'overdue'
  | 'pending'
  | 'still_open'
  | 'upcoming'

export type NotificationEntityType =
  | 'capa_action'
  | 'response_section_signoff'
  | 'meeting'
  | 'action_item'

/** One notification, ready to render — `href` is pre-resolved (see module header). */
export interface NotificationRow {
  id: string
  kind: NotificationKind
  milestone: NotificationMilestone
  /** false = event-driven assignment (non-suppressible, persists as history). true = a suppressible, auto-resolvable reminder. */
  isReminder: boolean
  entityType: NotificationEntityType
  entityId: string
  /** pt-BR snapshot, config-level only (Rule 12) — never PHI/answer/event content. */
  title: string
  body: string | null
  readAt: string | null
  resolvedAt: string | null
  createdAt: string
  /** Deep-link target, pre-resolved via `notificationHref` + batched org/commission/CAPA-plan lookups. '#' if unresolvable. */
  href: string
}

export interface NotificationPreferenceRow {
  surface: NotificationSurface
  /** Absence of a row means enabled — always returns all 3 surfaces, defaulting missing ones to true. */
  remindersEnabled: boolean
}

// ---------------------------------------------------------------------------
// Row shape from the DB (Rule 8 — internal to this module; callers use NotificationRow)
// ---------------------------------------------------------------------------

interface RawNotificationRow {
  id: string
  commission_id: string | null
  kind: string
  milestone: string
  is_reminder: boolean
  entity_type: string
  entity_id: string
  title: string
  body: string | null
  read_at: string | null
  resolved_at: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The caller's own UNRESOLVED notifications, most recent first, `href`
 * pre-resolved. Own-row RLS scopes this implicitly. `unreadOnly` further
 * filters to `read_at IS NULL`.
 *
 * Resolved rows (`resolved_at IS NOT NULL`) are excluded: `resolved_at` is set
 * only by `app.resolve_notifications_for` on task completion (BUG-N-002; ADR
 * 0076 decision 9 — "auto-resolve reminders on task completion"), so a resolved
 * reminder is a done task that must drop out of the center. Only REMINDERS ever
 * get `resolved_at`; assignments (`is_reminder = false`) never do, so they are
 * unaffected and persist as history.
 */
export async function listNotifications(
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationRow[]> {
  const { limit = 25, unreadOnly = false } = options
  const supabase = await createClient()

  let query = supabase
    .from('notifications')
    .select(
      'id, commission_id, kind, milestone, is_reminder, entity_type, entity_id, title, body, read_at, resolved_at, created_at',
    )
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.is('read_at', null)
  }

  const { data, error } = await query.returns<RawNotificationRow[]>()
  if (error || !data) return []

  return resolveHrefs(data)
}

/**
 * Unread, UNRESOLVED notification count for the caller — drives the shell
 * badge. Own-row RLS scoped. Excludes resolved reminders (BUG-N-002; ADR 0076
 * decision 9 + plan §3 — "complete the action → its reminder clears from the
 * badge") so a completed-task reminder stops counting the instant
 * `app.resolve_notifications_for` stamps it.
 */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .is('resolved_at', null)

  if (error || count == null) return 0
  return count
}

/**
 * The caller's reminder preferences, ALWAYS all 3 surfaces (capa/signoff/
 * meeting) — a surface with no row defaults to `remindersEnabled: true`, so
 * the settings UI can render 3 toggles unconditionally.
 */
export async function getPreferences(): Promise<NotificationPreferenceRow[]> {
  const ALL_SURFACES: NotificationSurface[] = ['capa', 'signoff', 'meeting']

  const supabase = await createClient()
  const { data } = await supabase
    .from('notification_preferences')
    .select('surface, reminders_enabled')
    .returns<{ surface: string; reminders_enabled: boolean }[]>()

  const bySurface = new Map((data ?? []).map((r) => [r.surface, r.reminders_enabled]))

  return ALL_SURFACES.map((surface) => ({
    surface,
    remindersEnabled: bySurface.get(surface) ?? true,
  }))
}

// ---------------------------------------------------------------------------
// href resolution (batched — see @/lib/notifications/routing-context)
// ---------------------------------------------------------------------------

async function resolveHrefs(rows: RawNotificationRow[]): Promise<NotificationRow[]> {
  // Only signoff/meeting need a slug lookup; capa_action + action_item route to
  // a STATIC page (/conta/itens-de-acao) with no per-row resolution — an
  // assignee may lack workspace access, so the personal list is the safe target.
  const commissionIds = rows
    .filter((r) => r.commission_id !== null)
    .map((r) => r.commission_id as string)

  const commissionSlugs = await resolveCommissionSlugs(commissionIds)

  return rows.map((r) => {
    const entityType = r.entity_type as NotificationEntityType
    let href = '#'

    if (entityType === 'capa_action' || entityType === 'action_item') {
      // Static route — reachable by any assignee regardless of workspace access.
      href = notificationHref({ entityType, entityId: r.entity_id })
    } else if (r.commission_id) {
      const ctx = commissionSlugs.get(r.commission_id)
      if (ctx) {
        href = notificationHref({
          entityType,
          entityId: r.entity_id,
          orgSlug: ctx.orgSlug,
          commissionSlug: ctx.commissionSlug,
        })
      }
    }

    return {
      id: r.id,
      kind: r.kind as NotificationKind,
      milestone: r.milestone as NotificationMilestone,
      isReminder: r.is_reminder,
      entityType,
      entityId: r.entity_id,
      title: r.title,
      body: r.body,
      readAt: r.read_at,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
      href,
    }
  })
}
