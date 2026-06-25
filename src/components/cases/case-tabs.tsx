"use client";

import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Sub-navigation for a case: switch between the default "Detalhes" tab and the
 * "Linha do tempo" (Timeline) tab. Mirrors `settings-tabs.tsx` — keyboard-operable
 * `Link`s with `aria-current` on the active tab and a visible focus ring. Lives in
 * the `(detail)` route-group layout so it shows on those two tabs only (the deeper
 * `fase`/`interviews` routes are siblings outside the group and keep their own
 * headers).
 *
 * The Timeline tab href preserves nothing from the URL; its own search params
 * (`view`/`density`/`types`) are managed by the timeline shell once there.
 */
export function CaseTabs({ org, slug, caseId }: { org: string; slug: string; caseId: string }) {
  const pathname = usePathname();
  const base = commissionHref(org, slug, "manage", "cases", caseId);
  const tabs = [
    { href: base, label: "Detalhes" },
    { href: `${base}/timeline`, label: "Linha do tempo" },
  ];

  return (
    <nav
      aria-label="Seções do caso"
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
