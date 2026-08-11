"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { plural } from "@/lib/text";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatRelative } from "@/components/audit/audit-meta";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/actions";
// Type-only — `@/lib/queries/notifications` value-imports `@/lib/supabase/server`
// (server-only); a client component must never value-import it (design system
// §7 — the server-in-client-bundle bug).
import type { NotificationRow } from "@/lib/queries/notifications";

/**
 * S1·N (Phase 20; ADR 0076) bell + unread badge + notification center.
 *
 * Data is server-rendered on navigation (ADR 0076 decision 10 — no Realtime,
 * no client poll): `unreadCount`/`notifications` arrive as props from the
 * server-only `NotificationBell` wrapper. Read state updates optimistically
 * on interaction here for a responsive feel; `markNotificationRead` /
 * `markAllNotificationsRead` (`@/lib/notifications/actions`) revalidate the
 * shell so the next navigation reconciles with the server truth either way.
 */
export function NotificationBellClient({
  unreadCount,
  notifications,
  className,
}: {
  unreadCount: number;
  notifications: NotificationRow[];
  /** Extra classes for the trigger button (callers control placement/spacing). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();
  // Stable "now" per mount so relative times don't jitter while the popover
  // is open; recomputed each time the bell re-opens.
  const [now, setNow] = useState(() => Date.now());

  const displayUnread = Math.max(0, unreadCount - readIds.size);
  const label =
    displayUnread > 0
      ? `Notificações, ${displayUnread} não ${plural(displayUnread, "lida", "lidas")}`
      : "Notificações";
  const badgeText = displayUnread > 9 ? "9+" : String(displayUnread);

  const items = useMemo(
    () =>
      notifications.map((n) => ({
        ...n,
        isRead: Boolean(n.readAt) || readIds.has(n.id),
      })),
    [notifications, readIds],
  );

  function markOneRead(id: string) {
    if (readIds.has(id)) return;
    setReadIds((prev) => new Set(prev).add(id));
    startTransition(() => {
      void markNotificationRead(id);
    });
  }

  function markAllRead() {
    setReadIds(new Set(notifications.map((n) => n.id)));
    startTransition(() => {
      void markAllNotificationsRead();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setNow(Date.now());
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn("relative", className)}
        >
          <Bell aria-hidden="true" className="size-[1.05rem]" />
          {displayUnread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold tabular-nums text-primary-foreground ring-2 ring-background"
            >
              {badgeText}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 gap-0 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
          <h2 className="font-display text-sm font-semibold">Notificações</h2>
          {displayUnread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              disabled={isPending}
              className="rounded-md text-xs font-medium text-primary transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>

        <div className="max-h-[22rem] overflow-y-auto" role="list" aria-label="Lista de notificações">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <BellOff aria-hidden="true" className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação por aqui.
              </p>
            </div>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                role="listitem"
                onClick={() => markOneRead(n.id)}
                className={cn(
                  "block border-b border-border px-3.5 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                  !n.isRead && "bg-accent/40",
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead ? (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                    />
                  ) : (
                    <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelative(n.createdAt, now)}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="border-t border-border px-3.5 py-2.5">
          <Link
            href="/conta/notificacoes"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Preferências de notificação
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
