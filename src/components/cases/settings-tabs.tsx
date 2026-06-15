"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Sub-navigation for the commission settings area: switch between the outcome
 * vocabulary ("Desfechos") and the tag vocabulary ("Etiquetas"). The configurable
 * status vocabulary is gone (D12 — statuses are now fixed/computed), so its tab is
 * dropped. Keyboard-operable links with `aria-current` on the active tab.
 */
export function SettingsTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/c/${slug}/manage/settings/desfechos`, label: "Desfechos" },
    { href: `/c/${slug}/manage/settings/etiquetas`, label: "Etiquetas" },
  ];

  return (
    <nav
      aria-label="Configurações da comissão"
      className="flex flex-wrap items-center gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
