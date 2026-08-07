import Link from "next/link";
import { notFound } from "next/navigation";

import { getQualidadeAccessByOrg } from "@/lib/queries/session";
import { qualidadeHref } from "@/lib/routing";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { QualityConsoleNav } from "@/components/quality/quality-console-nav";
import { QualityHospitalSwitcher } from "@/components/quality/quality-hospital-switcher";

/**
 * Escritório da Qualidade console shell (quality-office oversight, ADR 0100).
 * Server Component.
 *
 * Access is enforced HERE on the server, not by hiding the menu. The gate is
 * `getQualidadeAccessByOrg(org)` = the caller holds an unexpired
 * `quality_reviewer` membership in ≥1 hospital of THIS org. An unknown org and a
 * caller with no standing both get `notFound()` — indistinguishable by design,
 * leaking nothing about which organizations exist. A platform_admin, an
 * org_admin and a committee coordinator all get `notFound()` here unless they
 * separately hold the reviewer seat: the quality office is duty-separated from
 * both administration and committee membership.
 *
 * ⚠ Everything this console shows is re-gated at the data doors, which are the
 * real boundary (Rule 1): `quality_board_summary` 42501s a non-reviewer, and
 * every case row rides `app.can_read_case` → the S7 arm of `app._case_caps`
 * (oversight-VISIBLE commissions only; D6 keeps `explicit_grants_only` cases
 * out entirely). This layout decides console ENTRY, nothing finer.
 *
 * HOSPITAL IS NEVER A URL SEGMENT (ADR 0041 D8, restated by ADR 0100 D10) — a
 * reviewer covering several hospitals filters with `?hospital=`. Unlike the NSP
 * console's switcher there IS a "Todos os hospitais" option here: the NSP scopes
 * to one hospital because that is a PHI boundary, and this console holds no PHI
 * at all (D5 — zero PHI bits on the arm), so the cross-hospital view is a
 * legitimate default for a multi-hospital reviewer.
 */
export default async function QualityOfficeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const access = await getQualidadeAccessByOrg(org);

  if (!access) {
    notFound();
  }

  const { context, organization, hospitals } = access;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={qualidadeHref(organization.slug)}
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${organization.name} — Escritório da Qualidade`}
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            >
              CH
            </span>
            <span className="max-w-[12rem] truncate text-sm font-semibold tracking-tight">
              {organization.name}
            </span>
          </Link>
          <span
            aria-hidden="true"
            className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase"
          >
            Qualidade
          </span>
          {hospitals.length > 1 ? (
            <QualityHospitalSwitcher hospitals={hospitals} />
          ) : null}
          <QualityConsoleNav org={organization.slug} />
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <UserMenu fullName={context.fullName} email={context.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
