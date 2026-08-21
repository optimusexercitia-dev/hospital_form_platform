"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { dsrHref } from "@/lib/routing";

/**
 * The single "Direitos do Titular" (DSR / LGPD Art. 18) entry point — ADR 0130.
 *
 * ⭐ WHY THIS IS A COMPONENT AND NOT SEVEN COPIES. The DSR console is org-level,
 * but nobody LIVES there: every principal it admits wears the DSR hat alongside a
 * day job and lands in some OTHER shell. Until this file existed the affordance was
 * inlined in exactly one of those shells (`app-sidebar.tsx`, member scope only), so
 * three of the four qualifying hats had no link at all and had to type the URL.
 * A console nothing links to is a door nothing can reach.
 *
 * ⛔ WHICH SHELLS MUST RENDER IT IS A MEASURED SET, NOT A GUESS. The qualifying
 * hats are exactly what `app.can_execute_dsr_task` accepts (read from the live
 * catalog, 2026-08-20) plus the Encarregado office:
 *
 *   · `staff_admin` of the task's commission        → the commission sidebar
 *   · `org_admin` / `hospital_admin` (tenancy)      → `/o/[org]/manage`, and the
 *                                                     commission shell's bare
 *                                                     `navScope: "configuration"`
 *   · `pqs_member` / `nsp_coordinator`              → `/o/[org]/nsp`
 *                                                     (and `/o/[org]/nsp-org`, where
 *                                                     an `nsp_org_admin` who is also
 *                                                     a PQS operator lands first)
 *   · the Encarregado (DPO)                         → their commission, or `/c` when
 *                                                     they hold several
 *
 * ⚠ The Encarregado is NEVER membership-less, and that is by design, not an
 * oversight to route around: `app.is_dpo_of_for` carries
 * `exists (… commissions c where c.hospital_id = … and app.has_role_any('commission',
 * c.id, uid))` as a hard conjunct, and `organizations_select` has no DPO arm — so a
 * DPO with no commission role resolves to zero hospitals and the console 404s them
 * anyway. Matches ADR 0130 Decision 2 ("a plain member of ONE commission BY DESIGN").
 * ⛔ Do NOT add a root-landing (`src/app/page.tsx`) DSR branch on the theory that
 * such a persona exists — it would be unreachable code. Whether the persona SHOULD
 * exist is a product question filed against ADR 0130 D2, not a navigation fix.
 *
 * ⛔ DELIBERATELY NOT RENDERED in `/o/[org]/qualidade`, `/o/[org]/documentos-pendentes`
 * or `/o/[org]/direcao-tecnica`. Considered and dropped: none of the qualifying hats
 * above LANDS in those shells (checked against `src/app/page.tsx`'s precedence chain —
 * every executor hat is claimed by an earlier branch), and a dual-hatted user who
 * navigates in has the org switcher and browser history. A bounded, stated omission is
 * worth more than three unbounded "cannot hurt" additions, each of which becomes
 * surface a later sweep has to re-examine.
 *
 * SAFETY OF SHOWING IT: the caller's `reaches` boolean must come from
 * `listMyDsrHospitals()` (`list_my_dsr_hospitals()`), which gates on
 * `app.feature_enabled('dsr')` and returns `'[]'` when the flag is off, and which is
 * built from the SAME predicates the console layout and the RLS policies use. So this
 * link can never appear for someone the console would 404, and never when the feature
 * is dark. Visibility is convenience only — the route re-gates server-side.
 */

/** Shared, so the two call shapes cannot drift in copy. */
const DSR_LABEL = "Direitos do Titular";

/**
 * The link itself.
 *
 * `variant` picks the surrounding shell's idiom, because the two families use
 * different token sets: `sidebar` styles against the `--sidebar-*` tokens, which only
 * exist inside an `<aside>`; `topnav` styles against the page tokens, matching
 * `OrgApprovalsNav`. It is a variant rather than a `className` override so a caller
 * cannot half-adopt one palette inside the other.
 */
export function DsrConsoleLink({
  org,
  variant = "sidebar",
  onNavigate,
}: {
  /** The organization slug — the `/o/[org]` segment of the console href. */
  org: string;
  variant?: "sidebar" | "topnav";
  /** Fired on click — sidebars pass their mobile-drawer closer. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = dsrHref(org);
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        variant === "sidebar"
          ? cn(
              "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )
          : cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-foreground/80 hover:bg-muted hover:text-foreground",
            ),
      )}
    >
      <UserCheck
        aria-hidden="true"
        className={cn(
          "shrink-0 transition-colors",
          variant === "sidebar"
            ? cn(
                "size-[1.05rem]",
                isActive
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
              )
            : "size-4",
        )}
      />
      <span className={variant === "sidebar" ? "flex-1 truncate" : undefined}>
        {DSR_LABEL}
      </span>
    </Link>
  );
}

/**
 * The header block, for the three console shells whose nav is a top bar rather than
 * a sidebar (`/o/[org]/nsp`, `/o/[org]/nsp-org`).
 *
 * `hidden sm:flex` MIRRORS the nav it sits beside — `NspConsoleNav` and
 * `OrgNspAdminNav` are both `hidden … sm:flex`, so the whole console nav row is
 * already desktop-only in these shells. Matching it keeps the row from wrapping on
 * small screens; diverging would put one lone link on a bar that has no others.
 */
export function DsrConsoleHeaderLink({ org }: { org: string }) {
  return (
    <div className="ml-1 hidden items-center sm:flex">
      <DsrConsoleLink org={org} variant="topnav" />
    </div>
  );
}

/**
 * The sidebar block — eyebrow + list + link, matching the sibling console groups
 * ("Núcleo de Segurança", "Escritório da Qualidade") so the DSR entry does not read
 * as a foreign affordance wedged into a menu.
 *
 * `label` exists because the two sidebars name the same idea differently: the
 * commission sidebar files org-level consoles under "Organização", while the org
 * administration sidebar already HAS an "Organização" group of its own (its items are
 * paths under `/manage`), and a second heading with that text there would read as a
 * duplicate rather than a sibling.
 */
export function DsrConsoleNavGroup({
  org,
  label = "Organização",
  onNavigate,
}: {
  org: string;
  /** pt-BR uppercase eyebrow for the group. */
  label?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-4">
      <p className="px-2 pb-1.5 text-[0.65rem] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase">
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">
        <li>
          <DsrConsoleLink org={org} variant="sidebar" onNavigate={onNavigate} />
        </li>
      </ul>
    </div>
  );
}
