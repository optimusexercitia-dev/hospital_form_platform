"use client";

import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Sub-navigation for the commission settings area: switch between the outcome
 * vocabulary ("Desfechos"), the tag vocabulary ("Etiquetas"), and — when the
 * `case_phase_results` feature is on — the per-phase result vocabulary
 * ("Resultados"). The configurable status vocabulary is gone (D12 — statuses are
 * now fixed/computed), so its tab is dropped; the narrative vocabulary moved to
 * the Construtor page ("Narrativas" tab). Keyboard-operable links with
 * `aria-current` on the active tab.
 *
 * `phaseResultsEnabled` and `meetingsEnabled` are resolved on the server by each
 * settings page (the flags live in the locked-down `app` schema) and passed in, so
 * those tabs are hidden everywhere until their increment ships / the flag is on.
 */
export function SettingsTabs({
  org,
  slug,
  phaseResultsEnabled = false,
  meetingsEnabled = false,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  phaseResultsEnabled?: boolean;
  /** Whether the `meetings` flag is on (gates the "Reuniões" tab). */
  meetingsEnabled?: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: commissionHref(org, slug, "manage", "settings", "desfechos"), label: "Desfechos" },
    ...(phaseResultsEnabled
      ? [{ href: commissionHref(org, slug, "manage", "settings", "resultados"), label: "Resultados" }]
      : []),
    { href: commissionHref(org, slug, "manage", "settings", "etiquetas"), label: "Etiquetas" },
    // Committee member titles (ADR 0051 Decision 6) — always on, no feature flag.
    { href: commissionHref(org, slug, "manage", "settings", "titulos"), label: "Títulos" },
    // Meeting-type vocabulary + quorum rule (F8) — gated behind the `meetings` flag.
    ...(meetingsEnabled
      ? [{ href: commissionHref(org, slug, "manage", "settings", "reunioes"), label: "Reuniões" }]
      : []),
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
