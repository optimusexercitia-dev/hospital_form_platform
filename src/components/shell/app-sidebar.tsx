"use client";

import { commissionHref } from "@/lib/routing";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Award,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  Gauge,
  Gavel,
  Layers,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Menu,
  PencilLine,
  PenLine,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Users,
  Workflow,
  X,
} from "lucide-react";

import type { CommissionRole, Membership } from "@/lib/queries/session";
import { cn } from "@/lib/utils";
import { nspHref, orgHref, qualidadeHref } from "@/lib/routing";
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
  /**
   * "Meus itens de ação" — action items assigned to the caller that are not yet
   * concluded, across the three sources (case / meeting / manual). Sourced from
   * `getMemberOverview().pendingActionItems`; 0 when no action-item source flag
   * is on.
   */
  meusItensDeAcao: number;
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
  requiresFeature?:
    | "meetings"
    | "audit"
    | "patient_safety"
    | "case_referrals"
    | "quality_indicators"
    | "controlled_docs"
    | "charters"
    | "accreditation";
  /**
   * When true, the item renders only if `actionItemsEnabled` is on — the composite
   * flag `cases_extras OR meetings OR action_items` resolved by the layout (the
   * three action-item sources: case items, meeting items, and standalone/manual
   * items). Not a single `requiresFeature` key because it's an OR of three flags.
   */
  requiresActionItems?: boolean;
  /**
   * Gates this item on the `case_access` flag (Case Access Control, ADR 0033):
   *  - `"on"`  → render only when the flag is ON ("Meus Casos").
   *  - `"off"` → render only when the flag is OFF ("Minhas fases", today's item).
   * The two form an inverse pair so exactly one shows; OFF preserves today's nav.
   */
  caseAccess?: "on" | "off";
  /**
   * When true, the item renders only for an actual commission MEMBER — hidden for
   * a commission-admin (org_admin/hospital_admin) whose coordinator role is
   * resolved without a membership row. Used by "Reuniões": ADR 0078 C7 gives such
   * a non-member an empty meeting record, so the member-participation surface is
   * hidden for them (their config access under Configurações is unaffected).
   */
  requiresMembership?: boolean;
  /**
   * When true, the item renders only for a caller with standing in this
   * commission's CASE CONTENT — a member OR an Administrativo (ADR 0061) — and is
   * hidden for one whose only standing is ADMINISTRATION of the commission
   * (org_admin/hospital_admin, whom the resolver maps to `staff_admin` without a
   * membership row). Used by "Casos": post-ADR-0078 Gate 2 the board filters every
   * row through `app.can_read_case`, which returns nothing for an administration-only
   * principal, so the route 404s them (see manage/cases/page.tsx) and the item must
   * not link there.
   *
   * Deliberately NOT `requiresMembership`: that predicate is membership-only and
   * would also hide the item from an Administrativo whose membership was later
   * revoked — a principal the board still admits and still serves rows to.
   */
  requiresCaseStanding?: boolean;
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
        // Shown when any action-item source is on
        // (`cases_extras` OR `meetings` OR `action_items`).
        label: "Meus itens de ação",
        href: "meus-itens-de-acao",
        icon: ListTodo,
        roles: ["staff", "staff_admin"],
        countKey: "meusItensDeAcao",
        requiresActionItems: true,
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
        requiresMembership: true,
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
        // ADR 0078 Gate-2 fallout: the board returns zero rows to an
        // administration-only principal and its route now 404s them, so the item
        // must not link there (see manage/cases/page.tsx).
        requiresCaseStanding: true,
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
        label: "Indicadores",
        href: "manage/indicadores",
        icon: Gauge,
        roles: ["staff_admin"],
        requiresFeature: "quality_indicators",
      },
      {
        label: "Documentos",
        href: "manage/documentos",
        icon: FileText,
        roles: ["staff_admin"],
        requiresFeature: "controlled_docs",
      },
      {
        label: "Regimento & Cadência",
        href: "manage/charter",
        icon: Gavel,
        roles: ["staff_admin"],
        requiresFeature: "charters",
      },
      {
        label: "Acreditação",
        href: "manage/acreditacao",
        icon: Award,
        roles: ["staff_admin"],
        requiresFeature: "accreditation",
      },
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
  notificationBell,
  isCommissionMember = true,
  hasCaseStanding = true,
  meetingsEnabled = false,
  auditEnabled = false,
  patientSafetyEnabled = false,
  referralsEnabled = false,
  caseAccessEnabled = false,
  actionItemsEnabled = false,
  qualityIndicatorsEnabled = false,
  controlledDocsEnabled = false,
  chartersEnabled = false,
  accreditationEnabled = false,
  isNspCoordinator = false,
  isPqsMember = false,
  isQualityReviewer = false,
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
  /**
   * Whether the caller actually holds a membership in this commission (vs. a
   * commission-admin whose coordinator role is resolved without a membership row).
   * Defaults `true` (fail-open — this is a convenience gate, not a security
   * boundary). Gates `requiresMembership` items (currently "Reuniões", ADR 0078 C7).
   */
  isCommissionMember?: boolean;
  /**
   * Whether the caller has standing in this commission's CASE CONTENT: a
   * membership OR an Administrativo appointment (ADR 0061). False for a principal
   * whose only standing is ADMINISTRATION (an org_admin/hospital_admin resolved to
   * `staff_admin` without a membership row) — the cases board 404s exactly those.
   * Defaults `true` (fail-open — a convenience gate, not a security boundary).
   * Gates `requiresCaseStanding` items (currently "Casos").
   */
  hasCaseStanding?: boolean;
  /**
   * The S1·N (Phase 20) notification bell, pre-rendered by the Server
   * Component parent (`CommissionLayout`) — a Client Component like this one
   * cannot import the server-only `NotificationBell` directly (it
   * transitively value-imports `@/lib/supabase/server`, which drags
   * `next/headers` into the client bundle). `undefined` when the caller
   * doesn't pass one; flag-gating happens inside `NotificationBell` itself,
   * so this is `null`/empty whenever the `notifications` flag is off.
   */
  notificationBell?: React.ReactNode;
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
  /**
   * Whether the "Meus itens de ação" item shows — the composite `cases_extras OR
   * meetings OR action_items` flag resolved by the layout (its three action-item
   * sources: case, meeting, and standalone/manual items).
   */
  actionItemsEnabled?: boolean;
  /** Whether the `quality_indicators` flag is on (gates the "Indicadores" item, Phase 15). */
  qualityIndicatorsEnabled?: boolean;
  /** Whether the `controlled_docs` flag is on (gates the "Documentos" item, Phase 17). */
  controlledDocsEnabled?: boolean;
  /** Whether the `charters` flag is on (gates the "Regimento & Cadência" item, Phase 21). */
  chartersEnabled?: boolean;
  /** Whether the `accreditation` flag is on (gates the "Acreditação" item, Phase 16). */
  accreditationEnabled?: boolean;
  /** Whether the current user is the org's NSP coordinator (curates the PQS roster). */
  isNspCoordinator?: boolean;
  /** Whether the current user is enrolled as a PQS member (may read PHI in the console). */
  isPqsMember?: boolean;
  /**
   * Whether the current user holds a `quality_reviewer` seat in THIS commission's
   * org (ADR 0100). Shows the "Escritório da Qualidade" console link.
   *
   * ⚠ Only ever true for a reviewer who is ALSO a member/coordinator here — a bare
   * reviewer never reaches this sidebar at all: the commission layout returns the
   * reduced `QualityViewerShell` for them, precisely because `role === null` makes
   * `isVisible()` below show EVERY item. This link exists so the dual-hatted user
   * (who lands on their commission, not the console) still has a way in.
   */
  isQualityReviewer?: boolean;
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
    if (
      item.requiresFeature === "quality_indicators" &&
      !qualityIndicatorsEnabled
    )
      return false;
    if (item.requiresFeature === "controlled_docs" && !controlledDocsEnabled)
      return false;
    if (item.requiresFeature === "charters" && !chartersEnabled) return false;
    if (item.requiresFeature === "accreditation" && !accreditationEnabled)
      return false;
    if (item.requiresActionItems && !actionItemsEnabled) return false;
    // The "Minhas fases" / "Meus Casos" inverse pair: one shows per the flag.
    if (item.caseAccess === "on" && !caseAccessEnabled) return false;
    if (item.caseAccess === "off" && caseAccessEnabled) return false;
    // Member-participation items (Reuniões) hide for a resolved-but-not-held
    // coordinator (ADR 0078 C7). Scoped strictly to items that opt in.
    if (item.requiresMembership && !isCommissionMember) return false;
    // Case-content items (Casos) hide for an administration-only principal, whose
    // board is empty and whose route 404s (ADR 0078 Gate 2).
    if (item.requiresCaseStanding && !hasCaseStanding) return false;
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

          {/* NSP console link — shown to PQS members and org NSP coordinators. */}
          {(isPqsMember || isNspCoordinator) && (() => {
            const href = nspHref(org);
            const isActive = pathname.startsWith(href);
            return (
              <div className="mb-4">
                <p className="px-2 pb-1.5 text-[0.65rem] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase">
                  Organização
                </p>
                <ul className="flex flex-col gap-0.5">
                  <li>
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
                      <ShieldCheck
                        aria-hidden="true"
                        className={cn(
                          "size-[1.05rem] shrink-0 transition-colors",
                          isActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                        )}
                      />
                      <span className="flex-1 truncate">Núcleo de Segurança</span>
                    </Link>
                  </li>
                </ul>
              </div>
            );
          })()}

          {/* Quality-office console — shown to a member who ALSO holds a
              `quality_reviewer` seat in this org (ADR 0100). Org-level href. */}
          {isQualityReviewer && (() => {
            const href = qualidadeHref(org);
            const isActive = pathname.startsWith(href);
            return (
              <div className="mb-4">
                <p className="px-2 pb-1.5 text-[0.65rem] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase">
                  Organização
                </p>
                <ul className="flex flex-col gap-0.5">
                  <li>
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
                      <ClipboardCheck
                        aria-hidden="true"
                        className={cn(
                          "size-[1.05rem] shrink-0 transition-colors",
                          isActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                        )}
                      />
                      <span className="flex-1 truncate">
                        Escritório da Qualidade
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            );
          })()}

          {/* Per-user document-approval queue — shown to any member when the
              controlled-documents feature is on, since an approver may be named
              from OUTSIDE their own commission (Phase 17, F4). Org-level href. */}
          {controlledDocsEnabled && (() => {
            const href = orgHref(org, "documentos-pendentes");
            const isActive = pathname.startsWith(href);
            return (
              <div className="mb-4">
                <p className="px-2 pb-1.5 text-[0.65rem] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase">
                  Organização
                </p>
                <ul className="flex flex-col gap-0.5">
                  <li>
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
                      <ClipboardCheck
                        aria-hidden="true"
                        className={cn(
                          "size-[1.05rem] shrink-0 transition-colors",
                          isActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                        )}
                      />
                      <span className="flex-1 truncate">
                        Aprovações pendentes
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            );
          })()}
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
