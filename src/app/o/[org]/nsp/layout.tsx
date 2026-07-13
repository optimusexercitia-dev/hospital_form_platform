import Link from "next/link";
import { notFound } from "next/navigation";

import { getNspAccessByOrg } from "@/lib/queries/session";
import { nspHref } from "@/lib/routing";
import { referralsEnabled } from "@/lib/queries/referrals";
import { patientIndexEnabled } from "@/lib/queries/patient-index";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NspConsoleNav } from "@/components/shell/nsp-console-nav";
import { NspHospitalSwitcher } from "@/components/shell/nsp-hospital-switcher";

/**
 * Hospital-scoped NSP (Núcleo de Segurança do Paciente) console shell (NSP-per-
 * hospital, ADR 0052). Server Component.
 *
 * Access is enforced HERE on the server, not by hiding the menu. The gate is
 * `getNspAccessByOrg(org)` = the caller OPERATES the NSP of ≥1 hospital in THIS
 * org — an enrolled `pqs_member` OR appointed `nsp_coordinator` of some hospital
 * (the resolver reports `access.hospitals`, the caller's per-hospital grants). A
 * platform admin and an unenrolled, non-coordinator org_admin both get
 * `notFound()` — the NSP console is duty-separated from org administration. RLS +
 * the per-HOSPITAL DEFINER doors remain the ultimate data boundary; each page
 * re-resolves the specific `?hospital=` and passes that hospital id to the doors.
 *
 * When the caller operates more than one hospital's NSP, a hospital switcher
 * (`?hospital=` deep link) appears in the header. The org-level `isPqsMember` /
 * `isCoordinator` booleans drive the nav (the data doors are the real boundary):
 * the PHI surfaces show while the caller operates ≥1 hospital; the roster-curation
 * entry shows while they coordinate ≥1 hospital. The switcher/nav select which
 * hospital the surfaces act on.
 */
export default async function NspConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const access = await getNspAccessByOrg(org);

  if (!access) {
    // Unknown org OR the caller operates no hospital's NSP in it —
    // indistinguishable by design, both 404 and leak nothing about which
    // organizations exist.
    notFound();
  }

  const { context, organization, isPqsMember, isCoordinator, hospitals } =
    access;

  // Feature flags gate the flag-dependent nav entries (Encaminhamentos /
  // Pacientes). PHI-free reads; fail-closed to `false`.
  const [referralsOn, patientIndexOn] = await Promise.all([
    referralsEnabled(),
    patientIndexEnabled(),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={nspHref(organization.slug)}
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${organization.name} — Núcleo de Segurança do Paciente`}
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
            NSP
          </span>
          {hospitals.length > 1 ? (
            <NspHospitalSwitcher grants={hospitals} />
          ) : null}
          <NspConsoleNav
            org={organization.slug}
            isPqsMember={isPqsMember}
            isCoordinator={isCoordinator}
            referralsEnabled={referralsOn}
            patientIndexEnabled={patientIndexOn}
          />
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
