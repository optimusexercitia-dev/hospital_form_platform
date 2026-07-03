"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { orgHref } from "@/lib/routing";

interface OrgNspNavItem {
  label: string;
  /** Relative segments under `/o/[org]/nsp-org` ("" = the rollup overview). */
  segments: string[];
}

const ORG_NSP_NAV_ITEMS: OrgNspNavItem[] = [
  { label: "Visão geral", segments: [] },
  { label: "Coordenação e equipes", segments: ["coordenadores"] },
];

/**
 * Top navigation for the ORG NSP-admin console (`/o/[org]/nsp-org`; NSP-per-
 * hospital, ADR 0052, decision 13). Visibility is convenience only — the layout
 * gates the whole area on `nsp_org_admin` of this org, and every DEFINER door
 * re-gates + is provably PHI-free. This console is duty-separated from the
 * hospital-scoped operator console (`/o/[org]/nsp`) and from org administration
 * (`/o/[org]/manage`): the `nsp_org_admin` reads only per-hospital AGGREGATES and
 * curates rosters/coordinators, and reads ZERO patient data.
 */
export function OrgNspAdminNav({ org }: { org: string }) {
  const pathname = usePathname();
  const consoleBase = orgHref(org, "nsp-org");

  return (
    <nav
      aria-label="Navegação da administração do NSP"
      className="ml-4 hidden items-center gap-1 sm:flex"
    >
      {ORG_NSP_NAV_ITEMS.map((item) => {
        const href = orgHref(org, "nsp-org", ...item.segments);
        const isOverview = item.segments.length === 0;
        const isActive = isOverview
          ? pathname === consoleBase
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
