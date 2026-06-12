import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/queries/session";
import { UserMenu } from "@/components/shell/user-menu";

/**
 * Global admin area shell. Server Component.
 *
 * Access is enforced HERE on the server, not by hiding the menu: `requireUser()`
 * redirects unauthenticated users to /login, and a non-admin gets `notFound()`
 * (a 404 that reveals nothing about the admin area's existence). RLS is still
 * the ultimate boundary for data; this gate keeps non-admins out of the UI.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireUser();

  if (!context.isAdmin) {
    notFound();
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label="Administração — início"
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-foreground text-sm font-semibold text-background"
            >
              CH
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Administração
            </span>
          </Link>
          <span
            aria-hidden="true"
            className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase"
          >
            Admin global
          </span>
          <div className="ml-auto">
            <UserMenu fullName={context.fullName} email={context.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
