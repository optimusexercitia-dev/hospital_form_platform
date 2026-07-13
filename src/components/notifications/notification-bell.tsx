import { notificationsEnabled } from "@/lib/queries/feature-flags";
import { getUnreadCount, listNotifications } from "@/lib/queries/notifications";
import { NotificationBellClient } from "./notification-bell-client";

/**
 * S1·N (Phase 20; ADR 0076) app-shell bell — mounted next to `UserMenu` in
 * every `/o/[org]/...` shell (org headers + the commission `AppSidebar`).
 * Server Component: flag-gated (renders nothing when `notifications` is OFF
 * — no wrapping element, so callers can place it in a `gap`-based flex row
 * with zero layout impact when disabled) and fetches the unread count +
 * recent list server-side, once per navigation (ADR 0076 decision 10 — no
 * Realtime, no client poll). Data access via `src/lib/queries/` only (Rule 9).
 */
export async function NotificationBell({
  className,
}: {
  /** Forwarded to the trigger button — lets callers control placement/spacing. */
  className?: string;
} = {}) {
  const enabled = await notificationsEnabled();
  if (!enabled) return null;

  const [unreadCount, notifications] = await Promise.all([
    getUnreadCount(),
    listNotifications({ limit: 20 }),
  ]);

  return (
    <NotificationBellClient
      unreadCount={unreadCount}
      notifications={notifications}
      className={className}
    />
  );
}
