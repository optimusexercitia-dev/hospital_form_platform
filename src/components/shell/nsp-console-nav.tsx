"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { nspHref } from "@/lib/routing";

interface NspNavItem {
  label: string;
  /** Relative segments under `/o/[org]/nsp` ("" = the inbox/console landing). */
  segments: string[];
  /**
   * Visibility gate. `phi` items (the patient-safety surfaces) show only to an
   * enrolled PQS member; `roster` shows only to the org's `nsp_coordinator`.
   * The inbox landing is `phi`. Flag-gated items additionally require their flag.
   */
  scope: "phi" | "roster";
  /** When set, render only if this feature flag is on. */
  requiresFeature?: "referrals" | "patientIndex";
}

const NSP_NAV_ITEMS: NspNavItem[] = [
  { label: "Fila", segments: [], scope: "phi" },
  { label: "Triagem", segments: ["triagem"], scope: "phi" },
  {
    label: "Encaminhamentos",
    segments: ["encaminhamentos"],
    scope: "phi",
    requiresFeature: "referrals",
  },
  {
    label: "Pacientes",
    segments: ["pacientes"],
    scope: "phi",
    requiresFeature: "patientIndex",
  },
  { label: "Equipe do NSP", segments: ["equipe"], scope: "roster" },
  { label: "Configurações", segments: ["configuracoes"], scope: "phi" },
];

/**
 * Top navigation for the hospital-scoped NSP console (NSP-per-hospital, ADR 0052).
 * Visibility here is convenience only — every route still enforces access
 * server-side (the layout gate `getNspAccessByOrg` + the per-HOSPITAL DEFINER
 * doors + RLS). The PHI surfaces show while the caller operates ≥1 hospital's NSP
 * (`isPqsMember`); the roster-curation entry ("Equipe do NSP") shows while they
 * coordinate ≥1 hospital (`isCoordinator`) — the local coordinator curates their
 * own hospital's roster from here (the org-level `nsp_org_admin` curates from the
 * separate `/o/[org]/nsp-org` console). Active state is a prefix match so detail
 * pages keep their parent item highlighted.
 *
 * Every link PRESERVES the current `?hospital=` selection, so navigating the nav
 * keeps the console pinned to the same hospital (the switcher changes it).
 */
export function NspConsoleNav({
  org,
  isPqsMember,
  isCoordinator,
  referralsEnabled = false,
  patientIndexEnabled = false,
}: {
  org: string;
  isPqsMember: boolean;
  isCoordinator: boolean;
  referralsEnabled?: boolean;
  patientIndexEnabled?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const consoleBase = nspHref(org);

  // Preserve the active `?hospital=` selection on every nav link so the scope
  // survives navigation (the switcher is what changes it).
  const hospital = searchParams.get("hospital");
  const hospitalQuery = hospital
    ? `?hospital=${encodeURIComponent(hospital)}`
    : "";

  const items = NSP_NAV_ITEMS.filter((item) => {
    if (item.scope === "phi" && !isPqsMember) return false;
    if (item.scope === "roster" && !isCoordinator) return false;
    if (item.requiresFeature === "referrals" && !referralsEnabled) return false;
    if (item.requiresFeature === "patientIndex" && !patientIndexEnabled)
      return false;
    return true;
  });

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Navegação do NSP"
      className="ml-4 hidden items-center gap-1 sm:flex"
    >
      {items.map((item) => {
        const path = nspHref(org, ...item.segments);
        const href = `${path}${hospitalQuery}`;
        const isLanding = item.segments.length === 0;
        const isActive = isLanding
          ? pathname === consoleBase
          : pathname === path || pathname.startsWith(`${path}/`);
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
