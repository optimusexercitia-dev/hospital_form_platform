"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Menu,
  ScrollText,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { orgHref } from "@/lib/routing";
import { UserMenu } from "./user-menu";

interface OrgNavItem {
  label: string;
  /** Relative segments under `/o/[org]/manage` ("" = the manage landing). */
  segments: string[];
  icon: typeof LayoutDashboard;
  /** Render ONLY for an `org_admin` — hidden for a hospital-scoped `hospital_admin`
   * (ADR 0051 Decision 1: org-level-only surfaces). */
  orgAdminOnly?: boolean;
  /** When set, render only if this feature flag is on. */
  requiresFeature?: "audit" | "qualityIndicators";
}

interface OrgNavGroup {
  /** pt-BR uppercase eyebrow. */
  label: string;
  items: OrgNavItem[];
}

/**
 * Nav groups for the org-management sidebar — the same item set as the retired
 * `OrgManageNav` top bar MINUS "Documentos" (nav-hide only; the route stays live
 * and self-gates) and without a "Coordenação do NSP" entry (retired, ADR 0052 —
 * it remains a landing-page card only). Visibility here is convenience only;
 * every route still enforces its own server-side gate (the layout gate + RLS).
 */
const NAV_GROUPS: OrgNavGroup[] = [
  {
    label: "Geral",
    items: [{ label: "Visão geral", segments: [], icon: LayoutDashboard }],
  },
  {
    label: "Gestão",
    items: [
      // Usuários is available to a hospital_admin too — it manages its own
      // hospital's staff there (ADR 0051 Decision 7 / Q2), scoped by the page.
      { label: "Usuários", segments: ["usuarios"], icon: Users },
      { label: "Comissões", segments: ["comissoes"], icon: FolderKanban },
      {
        label: "Hospitais",
        segments: ["hospitais"],
        icon: Building2,
        orgAdminOnly: true,
      },
    ],
  },
  {
    label: "Acompanhamento",
    items: [
      { label: "Painel", segments: ["painel"], icon: BarChart3 },
      {
        label: "Indicadores",
        segments: ["indicadores"],
        icon: Gauge,
        requiresFeature: "qualityIndicators",
      },
    ],
  },
  {
    label: "Organização",
    items: [
      {
        label: "Administradores",
        segments: ["administradores"],
        icon: UserCog,
        orgAdminOnly: true,
      },
      {
        label: "Trilha de auditoria",
        segments: ["audit"],
        icon: ScrollText,
        requiresFeature: "audit",
      },
    ],
  },
];

/**
 * Side navigation for the organization-management area (`/o/[org]/manage`),
 * replacing the horizontal `OrgManageNav` top bar (no mobile fallback below
 * `sm`) with the vertical, drawer-on-mobile shell shared by the commission area
 * (`AppSidebar`). No commission switcher here — the brand block links to the
 * org's manage landing and a static "Organização" context line replaces it.
 */
export function OrgManageSidebar({
  org,
  orgName,
  fullName,
  email,
  isOrgAdmin,
  auditEnabled = false,
  qualityIndicatorsEnabled = false,
  notificationBell,
}: {
  /** The organization slug — the `/o/[org]` segment of every nav href. */
  org: string;
  orgName: string;
  fullName: string | null;
  email: string;
  /** Whether the caller is an org_admin (vs. a hospital-scoped hospital_admin);
   * hides ORG-LEVEL-ONLY entries for the latter (ADR 0051 Decision 1). Also
   * drives the `UserMenu` role label. */
  isOrgAdmin: boolean;
  /** Whether the `audit_trail` feature flag is on (gates the audit item). */
  auditEnabled?: boolean;
  /** Whether the `quality_indicators` flag is on (gates the "Indicadores" item). */
  qualityIndicatorsEnabled?: boolean;
  /**
   * The S1·N (Phase 20) notification bell, pre-rendered by the Server
   * Component parent (`OrgManageLayout`) — a Client Component like this one
   * cannot import the server-only `NotificationBell` directly (it
   * transitively value-imports `@/lib/supabase/server`, which drags
   * `next/headers` into the client bundle).
   */
  notificationBell?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer when a destination is chosen (cheaper + lint-clean
  // vs. a route-change effect).
  const closeDrawer = () => setOpen(false);

  const overviewHref = orgHref(org, "manage");

  const isVisible = (item: OrgNavItem) => {
    if (item.orgAdminOnly && !isOrgAdmin) return false;
    if (item.requiresFeature === "audit" && !auditEnabled) return false;
    if (item.requiresFeature === "qualityIndicators" && !qualityIndicatorsEnabled)
      return false;
    return true;
  };

  const roleLabel = isOrgAdmin
    ? "Administração da organização"
    : "Administração do hospital";

  return (
    <>
      {/* Mobile top bar — only below md, where the sidebar is a drawer. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu de navegação"
          aria-expanded={open}
          aria-controls="org-manage-sidebar"
          className="grid size-9 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
          >
            CH
          </span>
          <span className="truncate font-display text-sm font-semibold tracking-tight">
            {orgName}
          </span>
        </span>
        {notificationBell ? (
          <span className="ml-auto">{notificationBell}</span>
        ) : null}
      </div>

      {/* Drawer scrim (mobile only). */}
      {open ? (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* The sidebar: in-flow on desktop, sliding drawer on mobile. */}
      <aside
        id="org-manage-sidebar"
        className={cn(
          "z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "fixed inset-y-0 left-0 transition-transform duration-300 ease-out",
          "md:sticky md:inset-y-auto md:top-0 md:h-svh md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand block. */}
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-2">
          <Link
            href={overviewHref}
            onClick={closeDrawer}
            className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${orgName} — administração`}
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            >
              CH
            </span>
            <span className="truncate font-display text-base font-semibold tracking-tight">
              {orgName}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu de navegação"
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none md:hidden"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* Context line — no commission switcher in this area. */}
        <div className="px-4 pb-3">
          <span className="block max-w-full truncate px-2 py-1.5 text-sm font-medium text-sidebar-foreground/80">
            Organização
          </span>
        </div>

        {/* Grouped navigation. */}
        <nav
          aria-label="Navegação da organização"
          className="flex-1 overflow-y-auto px-3 py-1"
        >
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(isVisible);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                <p className="px-2 pb-1.5 text-[0.65rem] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const href = orgHref(org, "manage", ...item.segments);
                    const isOverview = item.segments.length === 0;
                    // Exact match for the overview (no segments), prefix match
                    // for areas with nested routes so the item stays active on
                    // detail pages.
                    const isActive = isOverview
                      ? pathname === overviewHref
                      : pathname === href || pathname.startsWith(`${href}/`);
                    const Icon = item.icon;
                    return (
                      <li key={item.label}>
                        <Link
                          href={href}
                          onClick={closeDrawer}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                            isActive
                              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                              : "font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                          )}
                        >
                          <Icon
                            aria-hidden="true"
                            className={cn(
                              "size-[1.05rem] shrink-0 transition-colors",
                              isActive
                                ? "text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                            )}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* User / account footer. */}
        <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
          {notificationBell}
          <div className="min-w-0 flex-1">
            <UserMenu fullName={fullName} email={email} roleLabel={roleLabel} />
          </div>
        </div>
      </aside>
    </>
  );
}
