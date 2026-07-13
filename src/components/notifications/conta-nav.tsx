"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ClipboardCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * S1·N (ADR 0076) secondary nav for the personal `/conta` area — links the two
 * per-user surfaces (notifications + assigned CAPA actions) so both are
 * reachable without the bell. Rendered by `conta/layout.tsx` only when the
 * `notifications` flag is on (both targets 404 when off), so it never points at
 * a dead route.
 */
const ITEMS = [
  { href: "/conta/notificacoes", label: "Notificações", icon: Bell },
  { href: "/conta/itens-de-acao", label: "Ações de CAPA", icon: ClipboardCheck },
] as const;

export function ContaNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Minha conta"
      className="flex items-center gap-1 overflow-x-auto"
    >
      {ITEMS.map((item) => {
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
