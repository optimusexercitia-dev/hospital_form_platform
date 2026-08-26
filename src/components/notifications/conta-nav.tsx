"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ClipboardCheck, IdCard } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Secondary nav for the personal `/conta` area, linking its standalone surfaces so
 * each is reachable without the bell.
 *
 * ⚠ TWO GROUPS, DELIBERATELY NOT ONE LIST (AFF4 F5 correction, 2026-08-26). This
 * component ALWAYS renders — `conta/layout.tsx` no longer conditions the wrapper on
 * the `notifications` flag. `ALWAYS_ITEMS` (Meus dados, ADR 0151 D14) is structural,
 * not flag-gated, and unreachable if the flag is off and this were still one gated
 * list. `NOTIFICATION_ITEMS` (S1·N, ADR 0076) stays behind `notificationsEnabled`,
 * because both of ITS targets 404 when the flag is off.
 *
 * ⚠ "IT NEVER POINTS AT A DEAD ROUTE" ONLY HOLDS PER GROUP, not of the component as a
 * whole — this file's own header asserted the whole-component version until the
 * correction above, which stopped being true the moment an ungated entry sat beside a
 * gated one. Adding a new item here means deciding which group it belongs to, not
 * appending to one list.
 */
const ALWAYS_ITEMS = [
  { href: "/conta/meus-dados", label: "Meus dados", icon: IdCard },
] as const;

const NOTIFICATION_ITEMS = [
  { href: "/conta/notificacoes", label: "Notificações", icon: Bell },
  { href: "/conta/itens-de-acao", label: "Ações de CAPA", icon: ClipboardCheck },
] as const;

export function ContaNav({
  notificationsEnabled,
}: {
  /** Gates `NOTIFICATION_ITEMS` only — `ALWAYS_ITEMS` renders regardless. */
  notificationsEnabled: boolean;
}) {
  const pathname = usePathname();
  const items = notificationsEnabled
    ? [...ALWAYS_ITEMS, ...NOTIFICATION_ITEMS]
    : ALWAYS_ITEMS;

  return (
    <nav
      aria-label="Minha conta"
      className="flex items-center gap-1 overflow-x-auto"
    >
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "font-medium text-foreground/70 hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
