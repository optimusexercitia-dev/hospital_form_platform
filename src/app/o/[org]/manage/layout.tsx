import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { accreditationEnabled, qualityIndicatorsEnabled } from "@/lib/queries/feature-flags";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { OrgManageSidebar } from "@/components/shell/org-manage-sidebar";

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
  // quality_indicators flag gates "Indicadores"; accreditation gates
  // "Acreditação" — VISIBLE by design (ADR 0093 Amendment 1 A1·3), unlike
  // Documentos below. `controlledDocsEnabled()` and `patientSafetyEnabled()`
  // are deliberately NOT read here — both were fetched solely to feed the
  // now-deleted `OrgManageNav` (Documentos is nav-hidden only, the route
  // self-gates on `controlledDocsEnabled()`; "Coordenação do NSP" is retired
  // from the nav, ADR 0052, and patientSafety isn't a sidebar item).
  const [auditOn, qualityIndicatorsOn, accreditationOn] = await Promise.all([
    auditTrailEnabled(),
    qualityIndicatorsEnabled(),
    accreditationEnabled(),
  ]);

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <OrgManageSidebar
        org={organization.slug}
        orgName={organization.name}
        fullName={context.fullName}
        email={context.email}
        isOrgAdmin={Boolean(orgAdmin)}
        auditEnabled={auditOn}
        qualityIndicatorsEnabled={qualityIndicatorsOn}
        accreditationEnabled={accreditationOn}
        notificationBell={<NotificationBell />}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
