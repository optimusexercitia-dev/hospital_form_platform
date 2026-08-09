"use client";

import { commissionHref } from "@/lib/routing";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
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

/**
 * How much of the commission nav a principal gets (ADR 0100 D12 / BUG-QOB-003).
 * A single tri-state rather than two booleans, because "configuration-only AND
 * no configuration access" is not a reachable state and should not be typable.
 *
 *  - `"member"` — today's behaviour: the items their MEMBERSHIP role carries.
 *  - `"member-and-configuration"` — their membership items PLUS the KEEP
 *    configuration set: a principal who is a member here AND administers the
 *    tenancy (org_admin/hospital_admin). Without this a `staff` member who is
 *    also an org_admin would lose the builder/settings/members nav that
 *    `canConfigureCommission` still admits them to.
 *  - `"configuration"` — ONLY the KEEP configuration set: a BARE tenancy admin,
 *    who holds no membership and whom QO·B walled off every content surface.
 */
export type SidebarNavScope =
  | "member"
  | "member-and-configuration"
  | "configuration";

interface NavItem {
  label: string;
  /** Relative path under /c/[slug] ("" = overview). */
  href: string;
  icon: typeof LayoutDashboard;
  roles: CommissionRole[];
  /**
   * Marks this item as part of the PO-ratified KEEP set of ADR 0100 D12
   * (rulings Q1–Q9) — the CONFIGURATION surface a tenancy admin keeps: form
   * definitions/builder, process templates, committee taxonomy + meeting
   * settings, member management, indicator DEFINITIONS, and the audit trail.
   *
   * ⛔ This is a POSITIVE ALLOWLIST and must stay one. A `"configuration"`-scope
   * principal sees an item ONLY if it opts in here, so a nav item added later
   * defaults to INVISIBLE to them — the fail-closed direction. Never invert it
   * into a `contentOnly` flag: that would make every future item leak until
   * someone remembers to mark it.
   *
   * Gate the DESTINATION on `canConfigureCommission(access)` too — this flag
   * shapes the menu, the page's own gate is the boundary.
   */
  configuration?: boolean;
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
 *
 * Two families live in this list: CONTENT items (gated on the membership `roles`)
 * and the KEEP CONFIGURATION items (`configuration: true`, ADR 0100 D12), which a
 * tenancy admin keeps and which `navScope` selects. Keep the two distinctions
 * independent — an item is not "coordinator-only" because it is configuration,
 * nor content because a coordinator holds it.
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
        // The commission root renders a MEMBER overview for a member and a
        // CONFIGURATION landing for a bare tenancy admin (see page.tsx) — one
        // href, two bodies, so it belongs to both scopes.
        configuration: true,
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
      {
        label: "Construtor",
        href: "manage/forms",
        icon: PencilLine,
        roles: ["staff_admin"],
        // KEEP — form DEFINITIONS/builder (ADR 0100 D12, ruling Q1).
        configuration: true,
      },
      {
        label: "Processos",
        href: "manage/process-templates",
        icon: Workflow,
        roles: ["staff_admin"],
        // KEEP — process templates (ruling Q2).
        configuration: true,
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
        // KEEP — the indicator DEFINITION surfaces (ruling Q3 SPLIT). The
        // MEASUREMENT half is content and is withheld inside the detail page;
        // the list/create/edit-definition surfaces are configuration.
        configuration: true,
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
        // KEEP — `audit_log` is on the §4.5 KEEP list.
        configuration: true,
      },
      {
        label: "Gerenciar",
        href: "manage/members",
        icon: Users,
        roles: ["staff_admin"],
        // KEEP — member management (ADR 0100 §4.5).
        configuration: true,
      },
      {
        label: "Configurações",
        href: "manage/settings",
        icon: Settings2,
        roles: ["staff_admin"],
        // KEEP — committee taxonomy + meeting settings (rulings Q6/Q7).
        configuration: true,
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
  navScope = "member",
}: {
  /** The organization slug — the `/o/[org]` segment of every nav href. */
  org: string;
  /** The commission slug — the `/c/[commission]` segment of every nav href. */
  slug: string;
  /** The current commission's id — disambiguates the switcher across orgs. */
  commissionId: string;
  /**
   * The caller's MEMBERSHIP role here, or null when they hold none — today that
   * is a bare tenancy admin (`navScope: "configuration"`). A null role no longer
   * widens the menu; it narrows it to whatever `navScope` admits.
   */
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
  /**
   * Which slice of the nav this principal gets (ADR 0100 D12 / BUG-QOB-003).
   * Defaults to `"member"` — today's behaviour. See {@link SidebarNavScope}.
   */
  navScope?: SidebarNavScope;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer when a destination is chosen (cheaper + lint-clean
  // vs. a route-change effect).
  const closeDrawer = () => setOpen(false);

  const multiCommission = memberships.length > 1;
  // Which of the two item families this principal may see. A bare tenancy admin
  // gets the configuration allowlist and NOTHING else; a member who also
  // administers the tenancy gets both; everyone else gets their role's items.
  const showsConfiguration = navScope !== "member";
  const showsMemberItems = navScope !== "configuration";
  // Members see their role's items; the KEEP configuration items additionally
  // show for a principal who may configure this commission. Feature-gated items
  // also require their flag to be on.
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
    // The KEEP configuration allowlist (ADR 0100 D12) — the one family a tenancy
    // admin keeps. Checked AFTER the feature gates so a dark flag still hides it.
    if (item.configuration && showsConfiguration) return true;
    if (!showsMemberItems) return false;
    // ⛔ BUG-QOB-003: this used to read `role === null || …` — a "show the whole
    // menu" branch for any principal without a membership role. It was written
    // for platform_admin (since 404'd by the layout, BUG-MT-005) and it is the
    // exact shape that lit up every coordinator affordance for an org_admin once
    // the resolver stopped coercing them to `staff_admin`. A null role now shows
    // member items to NOBODY; standing that is not a membership role must come
    // in through `navScope`, explicitly.
    return role !== null && item.roles.includes(role);
  };

  // A `"configuration"`-scope principal is not a member of anything here, so the
  // member eyebrows ("Meu trabalho", "Coordenação") would misdescribe the menu.
  // Collapse the allowlist into one honest group, preserving NAV_GROUPS order.
  const groups: NavGroup[] =
    navScope === "configuration"
      ? [
          {
            label: "Configuração da comissão",
            items: NAV_GROUPS.flatMap((group) => group.items),
          },
        ]
      : NAV_GROUPS;

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

        {/* Commission switcher (or plain name when single-commission). For a
            configuration-scope principal there is no membership to switch
            between — they get their way OUT instead (the org administration
            area they actually live in) plus a scope badge, so the reduced menu
            below reads as deliberate rather than broken. */}
        <div className="px-4 pb-3">
          {navScope === "configuration" ? (
            <div className="flex flex-col gap-1.5">
              <Link
                href={orgHref(org, "manage")}
                onClick={closeDrawer}
                className="inline-flex w-fit items-center gap-1.5 rounded-md text-xs font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ArrowLeft aria-hidden="true" className="size-3.5" />
                Administração
              </Link>
              <span className="block max-w-full truncate px-0.5 text-sm font-medium text-sidebar-foreground/80">
                {commissionName}
              </span>
            </div>
          ) : multiCommission ? (
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
          {groups.map((group) => {
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

          {/* NSP console link — shown to PQS members and org NSP coordinators.
              Never in configuration scope: that principal's org-level navigation
              lives in the org administration sidebar, and this shell is their
              commission-configuration workspace only. */}
          {showsMemberItems && (isPqsMember || isNspCoordinator) && (() => {
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
          {showsMemberItems && isQualityReviewer && (() => {
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
          {showsMemberItems && controlledDocsEnabled && (() => {
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
