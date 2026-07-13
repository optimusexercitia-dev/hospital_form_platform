/**
 * S1·N (Phase 20; ADR 0076) pt-BR message catalog + SQLSTATE -> friendly-text
 * mapping (Architecture Rule 9 — data access centralized; Rule 10 — user-
 * facing text pt-BR; CLAUDE.md §8 — raw Supabase/Postgres errors NEVER reach
 * the UI). Mirrors the `src/lib/safety/messages.ts` convention.
 *
 * SQLSTATE allocation: `HC0C·` reserved for notifications (ADR 0076).
 * HC0C0 = invalid preference surface. HC0C1 = notification not found / not
 * owned by the caller.
 */

export const HC_NOTIFICATIONS_INVALID_SURFACE = 'HC0C0'
export const HC_NOTIFICATION_NOT_FOUND = 'HC0C1'

/** Generic Postgres SQLSTATEs the notifications RPCs may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_NO_DATA_FOUND = 'P0002'

export const NOTIFICATIONS_MESSAGES = {
  generic: 'Não foi possível concluir. Tente novamente.',
  unavailable: 'Este recurso ainda não está disponível.',
  notFound: 'Notificação não encontrada.',
  invalidSurface: 'Superfície de notificação inválida.',
}

/**
 * Maps a raised SQLSTATE from a notifications RPC (mark_notification_read /
 * mark_all_notifications_read / set_notification_preferences) to a pt-BR
 * string. Unknown codes fall back to the generic message — raw Postgres text
 * never reaches the UI.
 */
export function mapNotificationsError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return NOTIFICATIONS_MESSAGES.generic
  switch (error.code) {
    case HC_NOTIFICATION_NOT_FOUND:
      return error.message || NOTIFICATIONS_MESSAGES.notFound
    case HC_NOTIFICATIONS_INVALID_SURFACE:
      return error.message || NOTIFICATIONS_MESSAGES.invalidSurface
    case PG_NO_DATA_FOUND:
      return NOTIFICATIONS_MESSAGES.notFound
    case PG_CHECK_VIOLATION:
      return NOTIFICATIONS_MESSAGES.unavailable
    default:
      return NOTIFICATIONS_MESSAGES.generic
  }
}
