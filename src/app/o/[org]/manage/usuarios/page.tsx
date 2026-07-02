import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { listOrgUsers } from "@/lib/queries/org-users";
import { orgHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { UserDirectorySearch } from "@/components/users/user-directory-search";
import { UserDirectoryList } from "@/components/users/user-directory-list";
import { UserPagination } from "@/components/users/user-pagination";

export const metadata: Metadata = {
  title: "Usuários",
};

const PAGE_SIZE = 20;

/**
 * Org-admin user directory (FE-1). Access is enforced by the
 * `/o/[org]/manage` layout (`is_org_admin_of(org)`); we re-resolve the org
 * from `context.orgAdminOf` (RLS-scoped) for the org-scoped read. Searchable
 * (name/email/category) + paged via `listOrgUsers`; each row shows name,
 * email, category, status badge, home hospital, and committee count, linking
 * to the per-user management page.
 */
export default async function OrgUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const organization = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;

  // The layout already guarantees access; defensive (never expected).
  if (!organization) {
    notFound();
  }

  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total } = await listOrgUsers(organization.id, search, {
    page: pageNum - 1,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl text-balance">Usuários</h1>
          <Button asChild size="lg">
            <Link href={orgHref(org, "manage", "usuarios", "novo")}>
              <UserPlus aria-hidden="true" />
              Registrar pessoa
            </Link>
          </Button>
        </div>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Busque, acompanhe o status e gerencie as pessoas registradas na sua
          organização.
        </p>
      </header>

      <UserDirectorySearch initialSearch={search} />

      <UserDirectoryList org={org} users={rows} filtered={Boolean(search)} />

      <UserPagination total={total} page={pageNum} pageSize={PAGE_SIZE} />
    </div>
  );
}
