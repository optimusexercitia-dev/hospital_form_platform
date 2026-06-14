"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FolderOpen,
  Layers,
  LayoutDashboard,
  ListChecks,
  Menu,
  PencilLine,
  PenLine,
  Settings2,
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
  minhasFases: number;
  casos: number;
  assinaturas: number;
}

type CountKey = keyof SidebarCounts;

interface NavItem {
  label: string;
  /** Relative path under /c/[slug] ("" = overview). */
  href: string;
  icon: typeof LayoutDashboard;
  roles: CommissionRole[];
  countKey?: CountKey;
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
        label: "Minhas fases",
        href: "minhas-fases",
        icon: Layers,
        roles: ["staff", "staff_admin"],
        countKey: "minhasFases",
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
      { label: "Gerenciar", href: "manage/members", icon: Users, roles: ["staff_admin"] },
      {
        label: "Configurações",
        href: "manage/settings",
        icon: Settings2,
        roles: ["staff_admin"],
      },
    ],
  },
];

export function AppSidebar({
  slug,
  role,
  memberships,
  commissionName,
  fullName,
  email,
  roleLabel,
  counts,
}: {
  slug: string;
  /** null when a global admin views a commission they're not a member of. */
  role: CommissionRole | null;
  memberships: Membership[];
  commissionName: string;
  fullName: string | null;
  email: string;
  roleLabel: string;
  counts: SidebarCounts;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer when a destination is chosen (cheaper + lint-clean
  // vs. a route-change effect).
  const closeDrawer = () => setOpen(false);

  const base = `/c/${slug}`;
  const multiCommission = memberships.length > 1;
  // Admins (no membership row) see the full menu; members see their role's.
  const isVisible = (item: NavItem) =>
    role === null || item.roles.includes(role);

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
            <CommissionSwitcher memberships={memberships} currentSlug={slug} />
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
                    const href = `${base}${item.href ? `/${item.href}` : ""}`;
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
