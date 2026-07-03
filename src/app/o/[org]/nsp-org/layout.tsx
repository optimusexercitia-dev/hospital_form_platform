import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { isNspOrgAdmin } from "@/lib/pqs/org-admin";
import { UserMenu } from "@/components/shell/user-menu";
import { OrgNspAdminNav } from "@/components/shell/org-nsp-admin-nav";

/**
 * The ORG NSP-admin console shell (`/o/[org]/nsp-org`; NSP-per-hospital, ADR 0052,
 * decision 13). Server Component. The ZERO-PHI, org-level surface for the
 * `nsp_org_admin`: per-hospital event/CAPA/roster AGGREGATES + coordinator/roster
 * curation across every hospital of the org.
 *
 * Access is enforced HERE on the server, not by hiding the menu. The gate is
 * "the caller is `nsp_org_admin` of THIS org": we resolve the org from
 * `context.nspOrgAdminOf` (RLS-scoped) for its display name + id, then confirm with
 * the `isNspOrgAdmin(orgId)` DEFINER probe (defense in depth). This console is
 * duty-separated from the hospital operator console (`/o/[org]/nsp`) and from org
 * administration (`/o/[org]/manage`); an org_admin who is NOT also `nsp_org_admin`
 * gets `notFound()`. Gated behind `patient_safety` → 404 when off. RLS + the
 * PHI-free aggregate DEFINER doors remain the ultimate boundary.
 *
 * SECURITY (Rule 12 keystone): NOTHING under this layout reads PHI. Every data door
 * it mounts is an `is_nsp_org_admin_of`-gated aggregate whose SELECT list is proven
 * PHI-free (counts / status / staff identity only).
 */
export default async function OrgNspAdminLayout({
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

  // The caller must be nsp_org_admin OF THIS ORG (RLS-scoped membership read).
  const organization = context.nspOrgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;
  if (!organization) {
    // Unknown org OR no nsp_org_admin standing in it — indistinguishable by design.
    notFound();
  }

  // Defense in depth: confirm via the DEFINER probe + require the feature flag.
  const [confirmed, patientSafetyOn] = await Promise.all([
    isNspOrgAdmin(organization.id),
    patientSafetyEnabled(),
  ]);
  if (!confirmed || !patientSafetyOn) {
    notFound();
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={orgHref(organization.slug, "nsp-org")}
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${organization.name} — administração do NSP`}
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
            NSP · organização
          </span>
          <OrgNspAdminNav org={organization.slug} />
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
