"use client";

import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Sub-navigation for the Construtor area: switch between the form builder
 * ("Formulários") and — when the `case_narratives` feature is on — the narrative
 * vocabulary ("Narrativas"), which moved here from Configurações. Mirrors
 * {@link SettingsTabs}: keyboard-operable links with `aria-current` on the active
 * tab.
 *
 * `narrativesEnabled` is resolved on the server by each Construtor page (the flag
 * lives in the locked-down `app` schema) and passed in, so the Narrativas tab is
 * hidden until that increment ships.
 */
export function ConstrutorTabs({
  org,
  slug,
  narrativesEnabled = false,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  narrativesEnabled?: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: commissionHref(org, slug, "manage", "forms"), label: "Formulários" },
    ...(narrativesEnabled
      ? [
          {
            href: commissionHref(org, slug, "manage", "forms", "narrativas"),
            label: "Narrativas",
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Construtor da comissão"
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
