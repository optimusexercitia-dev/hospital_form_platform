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
  requiresFeature?: "audit" | "patientSafety" | "qualityIndicators";
  /** When true, render ONLY for an `org_admin` — hidden for a hospital-scoped
   * `hospital_admin` (ADR 0051 Decision 1: org-level-only surfaces). */
  orgAdminOnly?: boolean;
}

const ORG_NAV_ITEMS: OrgNavItem[] = [
  { label: "Visão geral", segments: [] },
  // Usuários is available to a hospital_admin too — it manages its own hospital's
  // staff there (ADR 0051 Decision 7 / Q2), scoped to its hospital by the page.
  { label: "Usuários", segments: ["usuarios"] },
  { label: "Comissões", segments: ["comissoes"] },
  { label: "Hospitais", segments: ["hospitais"], orgAdminOnly: true },
  { label: "Painel", segments: ["painel"] },
  // Indicadores — the hospital indicator scorecard (Phase 15, F6). Visible to
  // both org_admin and hospital_admin (each sees the rollup of the hospitals it
  // administers); the DEFINER rollup re-gates per hospital.
  {
    label: "Indicadores",
    segments: ["indicadores"],
    requiresFeature: "qualityIndicators",
  },
  // "Coordenação do NSP" retired under NSP-per-hospital (ADR 0052, decision 3):
  // org_admin no longer appoints coordinators. The org appoints the nsp_org_admin
  // on "Administradores"; the nsp_org_admin curates per-hospital coordinators from
  // the dedicated `/o/[org]/nsp-org` console.
  {
    label: "Administradores",
    segments: ["administradores"],
    orgAdminOnly: true,
  },
  { label: "Trilha de auditoria", segments: ["audit"], requiresFeature: "audit" },
];

/**
 * Top navigation for the org-management area. Visibility here is convenience
 * only — every route still enforces its own server-side gate (the layout gate +
 * RLS). Active state is a prefix match so detail pages keep their parent item
 * highlighted. `isOrgAdmin = false` hides ORG-LEVEL-ONLY entries (hospitals
 * registry, role appointment) for a `hospital_admin` caller (ADR 0051 Decision
 * 1); Usuários stays visible for both (a hospital_admin manages its own hospital's
 * staff — Decision 7), and the audit entry stays visible either way (a
 * hospital_admin gets its own hospital-tier chain at the same route).
 */
export function OrgManageNav({
  org,
  auditEnabled = false,
  patientSafetyEnabled = false,
  qualityIndicatorsEnabled = false,
  isOrgAdmin = true,
}: {
  org: string;
  auditEnabled?: boolean;
  patientSafetyEnabled?: boolean;
  qualityIndicatorsEnabled?: boolean;
  isOrgAdmin?: boolean;
}) {
  const pathname = usePathname();
  const manageBase = orgHref(org, "manage");

  const items = ORG_NAV_ITEMS.filter((item) => {
    if (item.orgAdminOnly && !isOrgAdmin) return false;
    if (item.requiresFeature === "audit") return auditEnabled;
    if (item.requiresFeature === "patientSafety") return patientSafetyEnabled;
    if (item.requiresFeature === "qualityIndicators")
      return qualityIndicatorsEnabled;
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
