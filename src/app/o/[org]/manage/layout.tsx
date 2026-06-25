import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { UserMenu } from "@/components/shell/user-menu";
import { OrgManageNav } from "@/components/shell/org-manage-nav";

/**
 * Organization management area shell (org_admin — the customer super-user).
 * Server Component.
 *
 * Access is enforced HERE on the server, not by hiding the menu. The gate is
 * `is_org_admin_of(org)`: the caller must hold an `org_admin` row for THIS
 * organization (resolved from `context.orgAdminOf`, an RLS-scoped read). A
 * platform admin is NOT an org_admin (the vendor is walled off from tenant data),
 * so it gets `notFound()` here too — consistent with the org/PHI separation. RLS
 * remains the ultimate data boundary; this gate keeps non-admins out of the UI
 * and resolves the org's display name + slug for the shell.
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

  // The caller must be an org_admin of THIS org. `orgAdminOf` is the live,
  // RLS-scoped set of orgs the caller administers (never a stale claim).
  const orgAdmin = context.orgAdminOf.find(
    (o) => o.organization.slug === org,
  );
  if (!orgAdmin) {
    // Unknown org OR not an org_admin of it — indistinguishable by design, both
    // 404 and leak nothing about which organizations exist.
    notFound();
  }

  const organization = orgAdmin.organization;

  // The audit_trail flag gates the org-tier "Trilha de auditoria" nav entry.
  const auditOn = await auditTrailEnabled();

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
          <OrgManageNav org={organization.slug} auditEnabled={auditOn} />
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
