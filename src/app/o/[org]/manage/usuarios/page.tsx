import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import { listOrgUsers, listHospitalUsers } from "@/lib/queries/org-users";
import { orgHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { HospitalSwitcher } from "@/components/shell/hospital-switcher";
import { UserDirectorySearch } from "@/components/users/user-directory-search";
import { UserDirectoryList } from "@/components/users/user-directory-list";
import { UserPagination } from "@/components/users/user-pagination";

export const metadata: Metadata = {
  title: "Usuários",
};

const PAGE_SIZE = 20;

/**
 * User directory (FE-1). Access is enforced by the `/o/[org]/manage` layout
 * (`is_org_admin_of(org)` OR hospital_admin-of-some-hospital-here).
 *
 * An `org_admin` sees the ORG-WIDE directory (`listOrgUsers`). A `hospital_admin`
 * sees only its HOSPITAL's roster (`listHospitalUsers`), with a hospital switcher
 * (`?hospital=`) when it administers more than one. Both reads are RLS-scoped and
 * searchable/paged; each row links to the per-user management page (itself
 * RLS-scoped). "Registrar pessoa" preserves the hospital scope so a hospital_admin
 * lands on the register flow pre-locked to that hospital.
 *
 * ⚠ AFF W3/T3.2 (ADR 0097 D2): the hospital roster is now
 * "ACTIVE AFFILIATION to the hospital ∪ member of one of its commissions", replacing
 * the dropped `profiles.home_hospital_id`. **A person affiliated with ZERO committees
 * appears** — that is the whole point of the affiliation table, and the case a
 * commission-derived roster silently drops.
 */
export default async function OrgUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ search?: string; page?: string; hospital?: string }>;
}) {
  const [{ org }, context, sp] = await Promise.all([
    params,
    getSessionContext(),
    searchParams,
  ]);
  const orgAdminEntry = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  );
  const organization =
    orgAdminEntry?.organization ??
    context?.hospitalAdminOf.find((h) => h.organization.slug === org)
      ?.organization;

  // The layout already guarantees access; defensive (never expected).
  if (!organization || !context) {
    notFound();
  }

  const isOrgAdmin = Boolean(orgAdminEntry);
  const hospitals = isOrgAdmin ? [] : adminedHospitals(context, organization.id);

  const search = sp.search?.trim() ?? "";
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  // A hospital_admin MUST have a selected hospital (defaults to the first).
  const selectedHospitalId = isOrgAdmin
    ? null
    : (sp.hospital ?? hospitals[0]?.id ?? null);

  const paging = { page: pageNum - 1, pageSize: PAGE_SIZE };
  const { rows, total } = isOrgAdmin
    ? await listOrgUsers(organization.id, search, paging)
    : selectedHospitalId
      ? await listHospitalUsers(selectedHospitalId, search, paging)
      : { rows: [], total: 0 };

  // Preserve the hospital scope on the "Registrar pessoa" link for a hospital_admin.
  const registerHref =
    !isOrgAdmin && selectedHospitalId
      ? `${orgHref(org, "manage", "usuarios", "novo")}?hospital=${encodeURIComponent(selectedHospitalId)}`
      : orgHref(org, "manage", "usuarios", "novo");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {organization.name}
          </p>
          {!isOrgAdmin && hospitals.length > 1 ? (
            <HospitalSwitcher
              hospitals={hospitals}
              currentHospitalId={selectedHospitalId}
              allowAll={false}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl text-balance">Usuários</h1>
          <Button asChild size="lg">
            <Link href={registerHref}>
              <UserPlus aria-hidden="true" />
              Registrar pessoa
            </Link>
          </Button>
        </div>
        <p className="max-w-prose text-muted-foreground text-pretty">
          {isOrgAdmin
            ? "Busque, acompanhe o status e gerencie as pessoas registradas na sua organização."
            : "Busque, acompanhe o status e gerencie as pessoas registradas no seu hospital."}
        </p>
      </header>

      <UserDirectorySearch initialSearch={search} />

      <UserDirectoryList
        org={org}
        users={rows}
        filtered={Boolean(search)}
        scope={isOrgAdmin ? "org" : "hospital"}
      />

      <UserPagination total={total} page={pageNum} pageSize={PAGE_SIZE} />
    </div>
  );
}
