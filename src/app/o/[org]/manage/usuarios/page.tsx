import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import { listOrgUsers, listHospitalUsers } from "@/lib/queries/org-users";
import { listOrgHospitals } from "@/lib/queries/org";
import { orgHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { HospitalSwitcher } from "@/components/shell/hospital-switcher";
import { UserDirectorySearch } from "@/components/users/user-directory-search";
import { UserDirectoryList } from "@/components/users/user-directory-list";
import { parseUserDirectoryStatusFilter } from "@/lib/users/types";
import { UserDirectoryStatusPills } from "@/components/users/user-directory-status-pills";
import { UserDirectoryEndedToggle } from "@/components/users/user-directory-ended-toggle";
import { parseIncludeEnded } from "@/components/users/user-directory-ended-filter";
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
 * ⚠ `?status=` is parsed by `parseUserDirectoryStatusFilter` — the SINGLE owner of that
 * vocabulary, in `src/lib/users/types.ts`. The page deliberately does not parse it
 * itself: the pill counts come from a different code path, and two parses of one query
 * parameter is how a directory filters by one thing and counts by another.
 *
 * ⚠ THE HOSPITAL CONTROL DIFFERS BY ROLE, and both arms are real. An `org_admin`
 * filters the org-wide directory across `listOrgHospitals` (RLS-scoped, "Todos os
 * hospitais" = no filter); a `hospital_admin` SWITCHES between the hospitals it
 * administers and must always have one selected. Same component, different meaning:
 * `allowAll` is what separates a filter from a switcher.
 *
 * ⚠ `?hospital=` NARROWS the org roster and can never widen it (B8): someone visible at
 * hospital H but not anchored to this org stays absent, which is intended rather than a
 * dropped row. It is passed only on the org_admin arm — `listHospitalUsers` is
 * hospital-scoped by construction, and a second expression of one scope is how the two
 * come to disagree.
 *
 * ⛔ AFF4 F6 — `?includeEnded=` IS THE ONE WIDENER ON THIS PAGE, AND IT IS ORG-ONLY.
 * PO-ruled 2026-08-26. The default roster is people holding an ACTIVE org affiliation
 * (B6b); the toggle admits the ended ones. It is parsed ONLY for an org_admin and the
 * control renders ONLY for an org_admin — absent, never present-and-inert — because a
 * `hospital_admin` cannot read `organization_affiliations` at all (ADR 0151 D1; pgTAP
 * `375` §4.1 pins that absence deliberately; measured 2026-08-26: 1 row, their own,
 * against an org_admin's 29). Filtering that roster on the table would blank the page for
 * the only role it serves, and a control that silently does nothing is worse than a
 * missing one — it asserts a filter is being applied.
 *
 * ⚠ THE TOGGLE AND THE CHIP ARE A PAIR, and neither is complete alone. Widening the
 * roster without marking who was brought in lists departed people indistinguishably from
 * current ones; the chip is what makes the widening legible. `OrgUserListItem` carries
 * `orgAffiliationStatus` (B6b) and `UserDirectoryList` renders it through the shared
 * `AffiliationStatusBadge`.
 *
 * ⛔ NEVER DERIVE THE TENSE FROM `OrgUserListItem.status`. That field is the ACCOUNT
 * lifecycle (`deriveUserStatus` over `is_active` / `suspended_until` /
 * `email_confirmed_at`); the tense is an ORG-AFFILIATION fact from a different table with
 * a different visibility. Conflating them renders a deactivated-but-still-affiliated
 * person as departed, and a departed-but-active-account person as present.
 *
 * ⛔ A `null` TENSE FROM THE ORG ARM IS A FINDING, NOT A CASE TO HANDLE. `listOrgUsers`
 * cannot return one — its roster predicate IS an org affiliation, so a row without one
 * cannot appear — and `listHospitalUsers` always returns null because it never reads
 * `organization_affiliations` at all. Both directions are pinned in
 * `src/lib/queries/org-roster-predicate.test.ts`. Do not add a fallback here that quietly
 * absorbs a null: it would review as defensive and would silently stop the chip
 * appearing, with nothing able to say why.
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
    includeEnded?: string;
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
  // ⚠ `adminedHospitals` reads `ctx.hospitalAdminOf` ONLY, so it is structurally empty
  // for an org_admin — the org-wide list has to come from `listOrgHospitals`, which is
  // RLS-scoped and already used by the Administradores page.
  const hospitals = isOrgAdmin
    ? await listOrgHospitals(organization.id)
    : adminedHospitals(context, organization.id);

  const search = sp.search?.trim() ?? "";
  const statusFilter = parseUserDirectoryStatusFilter(sp.status);
  // ⛔ THE ORG-ONLY RULE LIVES HERE, ONCE. Gating the PARSE (rather than only the
  // control) is what makes a hand-typed `?includeEnded=1` inert for a hospital_admin
  // instead of half-honoured, and it means the value handed to `options` below is already
  // correct for both arms — so no call site has to restate the condition.
  const includeEnded = isOrgAdmin && parseIncludeEnded(sp.includeEnded);
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  // An org_admin's hospital is an OPTIONAL FILTER — `null` legitimately means "todos".
  // A hospital_admin MUST have one selected (defaults to the first): there is no
  // cross-hospital view for them, so `null` would be an empty directory, not "all".
  const selectedHospitalId = isOrgAdmin
    ? (sp.hospital ?? null)
    : (sp.hospital ?? hospitals[0]?.id ?? null);

  // ⚠ An OPTIONS OBJECT, not a fourth positional argument. `search` and `status` are
  // both nullable-ish strings, so positionally they are one transposition away from
  // silently filtering by the wrong thing — a bug nothing would type-check.
  const options = {
    search,
    status: statusFilter,
    paging: { page: pageNum - 1, pageSize: PAGE_SIZE },
    // Org-wide only (B8). `listHospitalUsers` is hospital-scoped by construction, so
    // passing it there would be a second, weaker expression of the same scope — and
    // two expressions of one scope is how they come to disagree.
    hospital: isOrgAdmin ? selectedHospitalId : undefined,
    // AFF4 F6 — THE WIDENING, SPELLED OUT AT THE CALL SITE rather than defaulted inside
    // the query. `ListDirectoryOptions.includeEnded` defaults to false at the data-access
    // boundary on purpose: the safe set is the default and every widener is visible where
    // it is chosen. This is that one place on this page.
    includeEnded,
  };
  const { rows, total, statusCounts } = isOrgAdmin
    ? await listOrgUsers(organization.id, options)
    : selectedHospitalId
      ? await listHospitalUsers(selectedHospitalId, options)
      : {
          rows: [],
          total: 0,
          // A hospital_admin with no selected hospital sees nothing — so the pills must
          // read zero rather than be absent, which would imply "not counted yet".
          statusCounts: { all: 0, active: 0, attention: 0, deactivated: 0 },
        };

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
          counts={statusCounts}
        />

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
          {/* ⛔ ABSENT, not hidden and not disabled, for a hospital_admin — see the
              `?includeEnded=` note in this page's header. `isOrgAdmin` is the ONLY gate;
              the component takes no `scope` prop so the choice cannot be made twice. */}
          {isOrgAdmin ? (
            <UserDirectoryEndedToggle includeEnded={includeEnded} />
          ) : null}
          <UserDirectorySearch initialSearch={search} />
          {hospitals.length > 1 ? (
            <HospitalSwitcher
              hospitals={hospitals}
              currentHospitalId={selectedHospitalId}
              // An org_admin may stand outside any one hospital; a hospital_admin may not.
              allowAll={isOrgAdmin}
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
