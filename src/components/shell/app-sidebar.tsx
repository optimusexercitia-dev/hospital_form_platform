"use client";

import { commissionHref } from "@/lib/routing";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  Layers,
  LayoutDashboard,
  ListChecks,
  Menu,
  PencilLine,
  PenLine,
  ScrollText,
  Settings2,
  ShieldAlert,
  Users,
  Workflow,
  X,
} from "lucide-react";

import type { CommissionRole, Membership } from "@/lib/queries/session";
import { cn } from "@/lib/utils";
import { CommissionSwitcher } from "./commission-switcher";
import { UserMenu } from "./user-menu";

/** Live counts shown as nav badges (0 = hidden). */
export interface SidebarCounts {
  /** "Minhas fases" — the caller's active assigned phases (flag `case_access` OFF). */
  minhasFases: number;
  /**
   * "Meus Casos" — every case the caller can access, attributed or granted (flag
   * `case_access` ON; Case Access Control increment, ADR 0033). Only one of
   * `minhasFases` / `meusCasos` drives a visible nav item per the flag.
   */
  meusCasos: number;
  casos: number;
  assinaturas: number;
  /** Meetings awaiting the current user's signature (Phase 10). */
  reunioesPendentes: number;
  /**
   * Inter-committee referrals needing this commission's attention (Phase 22 —
   * `case_referrals`): incoming awaiting receive/accept/reply + outgoing drafts.
   * Drives the "Encaminhamentos" nav badge.
   */
  encaminhamentos: number;
}

type CountKey = keyof SidebarCounts;

interface NavItem {
  label: string;
  /** Relative path under /c/[slug] ("" = overview). */
  href: string;
  icon: typeof LayoutDashboard;
  roles: CommissionRole[];
  countKey?: CountKey;
  /** When set, the item only renders if this feature flag is on (Phase 10+). */
  requiresFeature?: "meetings" | "audit" | "patient_safety" | "case_referrals";
  /**
   * Gates this item on the `case_access` flag (Case Access Control, ADR 0033):
   *  - `"on"`  → render only when the flag is ON ("Meus Casos").
   *  - `"off"` → render only when the flag is OFF ("Minhas fases", today's item).
   * The two form an inverse pair so exactly one shows; OFF preserves today's nav.
   */
  caseAccess?: "on" | "off";
}

interface NavGroup {
  /** pt-BR uppercase eyebrow. */
  label: string;
  items: NavItem[];
}

/**
 * Sidebar navigation, grouped under eyebrows. Mirrors the role-aware item set of
 * the former top nav. Visibility here is convenience only — every protected route
 * still enforces access server-side (RLS + layout checks).
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    items: [
      {
        label: "Visão geral",
        href: "",
        icon: LayoutDashboard,
        roles: ["staff", "staff_admin"],
      },
    ],
  },
  {
    label: "Meu trabalho",
    items: [
      {
        label: "Formulários",
        href: "forms",
        icon: ClipboardList,
        roles: ["staff", "staff_admin"],
      },
      {
        label: "Minhas respostas",
        href: "respostas",
        icon: ListChecks,
        roles: ["staff", "staff_admin"],
      },
      {
        // Flag `case_access` OFF → today's "Minhas fases" (active assigned phases).
        label: "Minhas fases",
        href: "minhas-fases",
        icon: Layers,
        roles: ["staff", "staff_admin"],
        countKey: "minhasFases",
        caseAccess: "off",
      },
      {
        // Flag `case_access` ON → "Meus Casos" (every accessible case; ADR 0033).
        label: "Meus Casos",
        href: "meus-casos",
        icon: Briefcase,
        roles: ["staff", "staff_admin"],
        countKey: "meusCasos",
        caseAccess: "on",
      },
      {
        label: "Reuniões",
        href: "meetings",
        icon: CalendarDays,
        roles: ["staff", "staff_admin"],
        countKey: "reunioesPendentes",
        requiresFeature: "meetings",
      },
      {
        label: "Eventos de segurança",
        href: "eventos",
        icon: ShieldAlert,
        roles: ["staff", "staff_admin"],
        requiresFeature: "patient_safety",
      },
      {
        label: "Encaminhamentos",
        href: "encaminhamentos",
        icon: ArrowLeftRight,
        roles: ["staff", "staff_admin"],
        countKey: "encaminhamentos",
        requiresFeature: "case_referrals",
      },
    ],
  },
  {
    label: "Coordenação",
    items: [
      { label: "Construtor", href: "manage/forms", icon: PencilLine, roles: ["staff_admin"] },
      {
        label: "Processos",
        href: "manage/process-templates",
        icon: Workflow,
        roles: ["staff_admin"],
      },
      {
        label: "Casos",
        href: "manage/cases",
        icon: FolderOpen,
        roles: ["staff_admin"],
        countKey: "casos",
      },
      {
        label: "Assinaturas",
        href: "manage/assinaturas",
        icon: PenLine,
        roles: ["staff_admin"],
        countKey: "assinaturas",
      },
      { label: "Painel", href: "dashboard", icon: BarChart3, roles: ["staff_admin"] },
      {
        label: "Trilha de auditoria",
        href: "manage/audit",
        icon: ScrollText,
        roles: ["staff_admin"],
        requiresFeature: "audit",
      },
      { label: "Gerenciar", href: "manage/members", icon: Users, roles: ["staff_admin"] },
      {
        label: "Configurações",
        href: "manage/settings",
        icon: Settings2,
        roles: ["staff_admin"],
      },
      {
        label: "Config. de reuniões",
        href: "manage/meetings",
        icon: CalendarDays,
        roles: ["staff_admin"],
        requiresFeature: "meetings",
      },
    ],
  },
];

export function AppSidebar({
  org,
  slug,
  commissionId,
  role,
  memberships,
  commissionName,
  fullName,
  email,
  roleLabel,
  counts,
  meetingsEnabled = false,
  auditEnabled = false,
  patientSafetyEnabled = false,
  referralsEnabled = false,
  caseAccessEnabled = false,
}: {
  /** The organization slug — the `/o/[org]` segment of every nav href. */
  org: string;
  /** The commission slug — the `/c/[commission]` segment of every nav href. */
  slug: string;
  /** The current commission's id — disambiguates the switcher across orgs. */
  commissionId: string;
  /** null when a global admin views a commission they're not a member of. */
  role: CommissionRole | null;
  memberships: Membership[];
  commissionName: string;
  fullName: string | null;
  email: string;
  roleLabel: string;
  counts: SidebarCounts;
  /** Whether the `meetings` feature flag is on (gates the "Reuniões" item). */
  meetingsEnabled?: boolean;
  /** Whether the `audit_trail` feature flag is on (gates the audit item). */
  auditEnabled?: boolean;
  /** Whether the `patient_safety` flag is on (gates the "Eventos de segurança" item). */
  patientSafetyEnabled?: boolean;
  /** Whether the `case_referrals` flag is on (gates the "Encaminhamentos" item). */
  referralsEnabled?: boolean;
  /**
   * Whether the `case_access` flag is on (ADR 0033). Drives the "Minhas fases"
   * (OFF) ↔ "Meus Casos" (ON) inverse swap; default `false` keeps today's nav.
   */
  caseAccessEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer when a destination is chosen (cheaper + lint-clean
  // vs. a route-change effect).
  const closeDrawer = () => setOpen(false);

  const multiCommission = memberships.length > 1;
  // Admins (no membership row) see the full menu; members see their role's.
  // Feature-gated items also require their flag to be on.
  const isVisible = (item: NavItem) => {
    if (item.requiresFeature === "meetings" && !meetingsEnabled) return false;
    if (item.requiresFeature === "audit" && !auditEnabled) return false;
    if (item.requiresFeature === "patient_safety" && !patientSafetyEnabled)
      return false;
    if (item.requiresFeature === "case_referrals" && !referralsEnabled)
      return false;
    // The "Minhas fases" / "Meus Casos" inverse pair: one shows per the flag.
    if (item.caseAccess === "on" && !caseAccessEnabled) return false;
    if (item.caseAccess === "off" && caseAccessEnabled) return false;
    return role === null || item.roles.includes(role);
  };

  return (
    <>
      {/* Mobile top bar — only below md, where the sidebar is a drawer. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu de navegação"
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="grid size-9 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
          >
            CH
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">
            Comissões
          </span>
        </span>
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
        id="app-sidebar"
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
            href="/"
            onClick={closeDrawer}
            className="flex items-center gap-2.5 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label="Comissões Hospitalares — início"
          >
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            >
              CH
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              Comissões
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu de navegação"
            className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none md:hidden"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* Commission switcher (or plain name when single-commission). */}
        <div className="px-4 pb-3">
          {multiCommission ? (
            <CommissionSwitcher
              memberships={memberships}
              currentCommissionId={commissionId}
            />
          ) : (
            <span className="block max-w-full truncate px-2 py-1.5 text-sm font-medium text-sidebar-foreground/80">
              {commissionName}
            </span>
          )}
        </div>

        {/* Grouped navigation. */}
        <nav
          aria-label="Navegação da comissão"
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
                    // `item.href` is a relative path under the commission base
                    // ("" = overview, e.g. "manage/forms"); split into segments
                    // so it routes through the canonical href builder.
                    const href = commissionHref(
                      org,
                      slug,
                      ...(item.href ? item.href.split("/") : []),
                    );
                    // Exact match for the overview (href ""), prefix match for
                    // areas with nested routes so the item stays active on
                    // detail pages.
                    const isActive =
                      pathname === href ||
                      (item.href !== "" && pathname.startsWith(`${href}/`));
                    const count = item.countKey ? counts[item.countKey] : 0;
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
                          {count > 0 ? (
                            <span
                              className={cn(
                                "ml-auto rounded-full px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums",
                                isActive
                                  ? "bg-sidebar-accent-foreground/15 text-sidebar-accent-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {count}
                            </span>
                          ) : null}
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
        <div className="border-t border-sidebar-border p-3">
          <UserMenu fullName={fullName} email={email} roleLabel={roleLabel} />
        </div>
      </aside>
    </>
  );
}
