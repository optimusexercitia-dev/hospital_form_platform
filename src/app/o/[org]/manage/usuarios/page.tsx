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
import { UserDirectoryStatusPills, parseStatusFilter } from "@/components/users/user-directory-status-pills";
import { UserPagination } from "@/components/users/user-pagination";

export const metadata: Metadata = {
  title: "Usuários",
};

const PAGE_SIZE = 20;

/**
 * User directory (FE-1, rebuilt to the AFF2 handoff §Screen 1 — ADR 0133 D14).
 * Access is enforced by the `/o/[org]/manage` layout (`is_org_admin_of(org)` OR
 * hospital_admin-of-some-hospital-here).
 *
 * An `org_admin` sees the ORG-WIDE directory (`listOrgUsers`). A `hospital_admin`
 * sees only its HOSPITAL's roster (`listHospitalUsers`), with a hospital switcher
 * (`?hospital=`) when it administers more than one. Both reads are RLS-scoped and
 * searchable/paged; each row links to the per-user management page (itself
 * RLS-scoped). "Registrar pessoa" preserves the hospital scope so a hospital_admin
 * lands on the register flow pre-locked to that hospital.
 *
 * ⚠ AFF W3/T3.2 (ADR 0097 D2): the hospital roster is
 * "ACTIVE AFFILIATION to the hospital ∪ member of one of its commissions", replacing
 * the dropped `profiles.home_hospital_id`. **A person affiliated with ZERO committees
 * appears** — that is the whole point of the affiliation table, and the case a
 * commission-derived roster silently drops.
 *
 * ⛔ TWO TRANSITIONAL GAPS ON THIS BRANCH, both backend-side and both closing before
 * the phase gate. Neither is a defect to "fix" here:
 *
 * 1. **`?status=` is parsed and rendered but NOT yet applied to the query.** The
 *    server-side status filter and the pill counts are backend task **B7**;
 *    `listOrgUsers` / `listHospitalUsers` do not accept a status argument yet. It is
 *    deliberately not derived here: doing so would need either a second copy of
 *    `deriveUserStatus` (a parallel derivation of the one authority) or an unpaged
 *    read (a broken pager). Until B7 lands the pills navigate but do not filter, and
 *    counts are absent rather than fabricated as zero.
 * 2. **The Registro column and the named Comissões chips have no data source yet**
 *    (also B7; the hospital-admin rows of Registro additionally need B2's
 *    `professional_credentials` SELECT widening, ADR 0133 D13). Each column falls
 *    back to its documented empty rendering, never to a blank cell.
 *
 * ⚠ An org_admin gets NO hospital filter today — `adminedHospitals` resolves
 * `hospital_admin` seats only, and `listOrgUsers` takes no hospital argument. The
 * handoff's "Hospital: todos" select is backend task **B8**, sequenced after B7; the
 * toolbar's right-hand group is the slot it drops into.
 */
export default async function OrgUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    search?: string;
    page?: string;
    hospital?: string;
    status?: string;
  }>;
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
  const statusFilter = parseStatusFilter(sp.status);
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  // A hospital_admin MUST have a selected hospital (defaults to the first).
  const selectedHospitalId = isOrgAdmin
    ? null
    : (sp.hospital ?? hospitals[0]?.id ?? null);

  const paging = { page: pageNum - 1, pageSize: PAGE_SIZE };
  // ⛔ `statusFilter` is NOT passed: these signatures do not accept it yet (B7).
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <UserDirectoryStatusPills
          basePath={orgHref(org, "manage", "usuarios")}
          searchParams={sp}
          current={statusFilter}
        />

        {/* The B8 org_admin hospital `<select>` slots in beside these two. */}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
          <UserDirectorySearch initialSearch={search} />
          {!isOrgAdmin && hospitals.length > 1 ? (
            <HospitalSwitcher
              hospitals={hospitals}
              currentHospitalId={selectedHospitalId}
              allowAll={false}
            />
          ) : null}
        </div>
      </div>

      <UserDirectoryList
        org={org}
        users={rows}
        total={total}
        filtered={Boolean(search)}
        statusFilter={statusFilter}
        scope={isOrgAdmin ? "org" : "hospital"}
        pagination={
          <UserPagination total={total} page={pageNum} pageSize={PAGE_SIZE} />
        }
      />
    </div>
  );
}
