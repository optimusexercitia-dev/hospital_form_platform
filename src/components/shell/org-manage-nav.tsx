"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { orgHref } from "@/lib/routing";

interface OrgNavItem {
  label: string;
  /** Relative segments under `/o/[org]/manage` ("" = the manage landing). */
  segments: string[];
  /** When set, render only if this feature flag is on. */
  requiresFeature?: "audit" | "patientSafety";
}

const ORG_NAV_ITEMS: OrgNavItem[] = [
  { label: "Visão geral", segments: [] },
  { label: "Comissões", segments: ["comissoes"] },
  { label: "Hospitais", segments: ["hospitais"] },
  { label: "Painel", segments: ["painel"] },
  {
    label: "Coordenação do NSP",
    segments: ["equipe-nsp"],
    requiresFeature: "patientSafety",
  },
  { label: "Trilha de auditoria", segments: ["audit"], requiresFeature: "audit" },
];

/**
 * Top navigation for the org-management area. Visibility here is convenience
 * only — every route still enforces `is_org_admin_of(org)` server-side (the
 * layout gate + RLS). Active state is a prefix match so detail pages keep their
 * parent item highlighted.
 */
export function OrgManageNav({
  org,
  auditEnabled = false,
  patientSafetyEnabled = false,
}: {
  org: string;
  auditEnabled?: boolean;
  patientSafetyEnabled?: boolean;
}) {
  const pathname = usePathname();
  const manageBase = orgHref(org, "manage");

  const items = ORG_NAV_ITEMS.filter((item) => {
    if (item.requiresFeature === "audit") return auditEnabled;
    if (item.requiresFeature === "patientSafety") return patientSafetyEnabled;
    return true;
  });

  return (
    <nav
      aria-label="Navegação da organização"
      className="ml-4 hidden items-center gap-1 sm:flex"
    >
      {items.map((item) => {
        const href = orgHref(org, "manage", ...item.segments);
        const isOverview = item.segments.length === 0;
        const isActive = isOverview
          ? pathname === manageBase
          : pathname === href || pathname.startsWith(`${href}/`);
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
