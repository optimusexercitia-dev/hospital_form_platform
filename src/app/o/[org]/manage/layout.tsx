import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { qualityIndicatorsEnabled } from "@/lib/queries/feature-flags";
import { UserMenu } from "@/components/shell/user-menu";
import { OrgManageNav } from "@/components/shell/org-manage-nav";

/**
 * Organization management area shell — the customer super-user area, now
 * admitting BOTH `org_admin` (org-wide) and `hospital_admin` (own hospital(s)
 * only, ADR 0051). Server Component.
 *
 * Access is enforced HERE on the server, not by hiding the menu. The gate is
 * `is_org_admin_of(org)` OR "administers at least one hospital in this org"
 * (resolved from `context.orgAdminOf` / `context.hospitalAdminOf`, both
 * RLS-scoped reads). A platform admin is NOT an org_admin (the vendor is walled
 * off from tenant data), so it gets `notFound()` here too — consistent with the
 * org/PHI separation. RLS remains the ultimate data boundary; this gate keeps
 * non-admins out of the UI and resolves the org's display name + slug for the
 * shell. Org-level-only surfaces (hospitals registry, org role appointment, org
 * audit chain) additionally gate on `isOrgAdmin` at their own page.
 */
export default async function OrgManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();

  if (!context) {
    notFound();
  }

  // The caller must be an org_admin OF THIS ORG, or a hospital_admin of at
  // least one hospital IN this org. Both are live, RLS-scoped reads (never a
  // stale claim).
  const orgAdmin = context.orgAdminOf.find(
    (o) => o.organization.slug === org,
  );
  const hospitalAdminHere = context.hospitalAdminOf.filter(
    (h) => h.organization.slug === org,
  );
  if (!orgAdmin && hospitalAdminHere.length === 0) {
    // Unknown org OR no admin standing in it — indistinguishable by design,
    // both 404 and leak nothing about which organizations exist.
    notFound();
  }

  const organization = orgAdmin?.organization ?? hospitalAdminHere[0]!.organization;

  // The audit_trail flag gates the "Trilha de auditoria" nav entry; the
  // patient_safety flag gates the "Coordenação do NSP" entry.
  const [auditOn, patientSafetyOn, qualityIndicatorsOn] = await Promise.all([
    auditTrailEnabled(),
    patientSafetyEnabled(),
    qualityIndicatorsEnabled(),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={orgHref(organization.slug, "manage")}
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${organization.name} — administração`}
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
            Organização
          </span>
          <OrgManageNav
            org={organization.slug}
            auditEnabled={auditOn}
            patientSafetyEnabled={patientSafetyOn}
            qualityIndicatorsEnabled={qualityIndicatorsOn}
            isOrgAdmin={Boolean(orgAdmin)}
          />
          <div className="ml-auto">
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
