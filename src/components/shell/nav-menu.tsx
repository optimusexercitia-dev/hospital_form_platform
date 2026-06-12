"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { CommissionRole } from "@/lib/queries/session";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  /** Relative path under /c/[slug], or null for a not-yet-available area. */
  href: string | null;
  /** Roles that see this item. */
  roles: CommissionRole[];
}

/**
 * Primary navigation for a commission. Items for areas that don't exist yet
 * (Phases 3–7) are rendered as present-but-inactive with an "em breve" tag —
 * never as dead `#` links — so the menu communicates the full shape without
 * navigating to nowhere. Visibility here is convenience only; every protected
 * route enforces access server-side (RLS + layout checks).
 */
const NAV_ITEMS: NavItem[] = [
  { label: "Visão geral", href: "", roles: ["staff", "staff_admin"] },
  { label: "Formulários", href: null, roles: ["staff", "staff_admin"] },
  { label: "Minhas respostas", href: null, roles: ["staff", "staff_admin"] },
  { label: "Gerenciar", href: "manage/members", roles: ["staff_admin"] },
  { label: "Painel", href: null, roles: ["staff_admin"] },
];

export function NavMenu({
  slug,
  role,
}: {
  slug: string;
  /** null when an admin views a commission they're not a member of. */
  role: CommissionRole | null;
}) {
  const pathname = usePathname();
  const base = `/c/${slug}`;

  // Admins (no membership row) see the full menu; members see their role's.
  const visible = NAV_ITEMS.filter(
    (item) => role === null || item.roles.includes(role),
  );

  return (
    <nav aria-label="Navegação da comissão" className="flex items-center gap-1">
      {visible.map((item) => {
        if (item.href === null) {
          return (
            <span
              key={item.label}
              aria-disabled="true"
              className="flex cursor-default items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/70"
              title="Disponível em uma próxima etapa"
            >
              {item.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                em breve
              </span>
            </span>
          );
        }

        const href = `${base}${item.href ? `/${item.href}` : ""}`;
        const isActive = pathname === href;
        return (
          <Link
            key={item.label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-foreground/80 hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
