import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getRawGrants, requireUser } from "@/lib/queries/session";
import { notificationsEnabled } from "@/lib/queries/feature-flags";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ContaNav } from "@/components/notifications/conta-nav";

/**
 * Personal account settings shell (`/conta/**`) — global, NOT org-scoped
 * (mirrors `notification_preferences` being per-(user, surface), ADR 0076
 * consequence: "S1 prefs are per-(user, surface) global"). `requireUser()`
 * redirects unauthenticated callers to /login (mirrors the admin shell gate).
 *
 * "Voltar" targets `/` — the caller's role landing (their commission, or the
 * picker if they belong to several) — the same pattern the org-level utility
 * shells use (`documentos-pendentes/layout.tsx`) since this page is reached
 * from within any org/commission, not owned by one.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [context, notificationsOn, grants] = await Promise.all([
    requireUser(),
    notificationsEnabled(),
    getRawGrants(),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-border" />
          <span className="text-sm font-semibold tracking-tight">Minha conta</span>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <UserMenu
              fullName={context.fullName}
              email={context.email}
              activeRole={context.activeRole}
              grants={grants}
            />
          </div>
        </div>
        {/* Secondary nav between the two personal surfaces — only while the
            notifications feature (which owns both) is on; both 404 when off. */}
        {notificationsOn ? (
          <div className="mx-auto w-full max-w-3xl px-4 pb-2 sm:px-6">
            <ContaNav />
          </div>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
