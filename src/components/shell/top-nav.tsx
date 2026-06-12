import Link from "next/link";

import type {
  CommissionRole,
  Membership,
  SessionContext,
} from "@/lib/queries/session";

import { CommissionSwitcher } from "./commission-switcher";
import { NavMenu } from "./nav-menu";
import { UserMenu } from "./user-menu";

/**
 * App-shell top navigation. Server Component — driven entirely by props the
 * commission layout already loaded (one data read up there). Renders the
 * product mark, the current commission (a switcher when the user has more than
 * one), the role-aware menu, and the user/account menu with logout.
 */
export function TopNav({
  context,
  commission,
  role,
}: {
  context: SessionContext;
  commission: { id: string; name: string; slug: string };
  role: CommissionRole | null;
}) {
  const memberships: Membership[] = context.memberships;
  const multiCommission = memberships.length > 1;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Product mark → role landing. */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          aria-label="Comissões Hospitalares — início"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            CH
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Comissões
          </span>
        </Link>

        <span
          aria-hidden="true"
          className="hidden h-6 w-px bg-border sm:block"
        />

        {/* Current commission / switcher. */}
        {multiCommission ? (
          <CommissionSwitcher
            memberships={memberships}
            currentSlug={commission.slug}
          />
        ) : (
          <span className="max-w-[16rem] truncate px-1 text-sm font-medium">
            {commission.name}
          </span>
        )}

        {/* Role-aware primary menu (desktop). */}
        <div className="ml-2 hidden md:flex">
          <NavMenu slug={commission.slug} role={role} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu fullName={context.fullName} email={context.email} />
        </div>
      </div>

      {/* Role-aware menu (mobile) — wraps below the bar on narrow screens. */}
      <div className="mx-auto flex w-full max-w-7xl overflow-x-auto px-2 pb-2 md:hidden">
        <NavMenu slug={commission.slug} role={role} />
      </div>
    </header>
  );
}
