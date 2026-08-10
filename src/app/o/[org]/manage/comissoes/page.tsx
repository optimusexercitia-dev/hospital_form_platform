import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import {
  listHospitalsForOrg,
  listManagedCommissionsDetailed,
} from "@/lib/queries/org";
import { chartersEnabled } from "@/lib/queries/feature-flags";
import { getCommissionCadenceOverview } from "@/lib/queries/charters";
import { HospitalSwitcher } from "@/components/shell/hospital-switcher";
import { OrgCommissionList } from "@/components/org/org-commission-list";
import { CreateCommissionDialog } from "@/components/org/create-commission-dialog";

export const metadata: Metadata = {
  title: "Comissões",
};

/**
 * Commissions registry — the relocated `/admin/comissoes` list, re-scoped to
 * the org in the URL. Access is enforced by the `/o/[org]/manage` layout
 * (`is_org_admin_of(org)` OR hospital_admin-of-some-hospital-here).
 *
 * An `org_admin` sees every commission in the org
 * (`listManagedCommissionsDetailed` with `hospitalId = null`) and a hospital
 * switcher scoping to ONE hospital (`?hospital=`, ADR 0051 Decision 7) when it
 * administers more than one; a `hospital_admin` is scoped to its own
 * hospital's commissions and its switcher (if it holds several) has no
 * "todos" option. The "Criar comissão" dialog's hospital picker is narrowed to
 * the hospitals the caller may create under.
 */
export default async function OrgCommissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ hospital?: string }>;
}) {
  const [{ org }, context] = await Promise.all([params, getSessionContext()]);
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
  // The org-admin hospital list only needs `organization.id` — independent of
  // `searchParams` — so fetch it alongside the params unwrap.
  const [hospitalsRaw, sp] = await Promise.all([
    isOrgAdmin ? listHospitalsForOrg(organization.id) : Promise.resolve(null),
    searchParams,
  ]);
  const hospitals = isOrgAdmin
    ? (hospitalsRaw ?? []).map((h) => ({
        id: h.id,
        slug: h.slug,
        name: h.name,
        organizationId: organization.id,
      }))
    : adminedHospitals(context, organization.id);

  // A hospital_admin MUST have a selected hospital (defaults to the first);
  // an org_admin's selection is optional (null = org-wide).
  const selectedHospitalId = isOrgAdmin
    ? (sp.hospital ?? null)
    : (sp.hospital ?? hospitals[0]?.id ?? null);

  // Cadence overview (PO ruling 2026-08-09, charter ③): the tenancy admin gets the
  // accreditation answer — "which of my committees are behind on meetings?" — HERE,
  // read-only, instead of being let into the coordinator's charter editor. ONE RPC for
  // the whole list; it derives its own row set from `is_tenancy_admin_of`, so a
  // commission this caller does not administer simply has no entry and renders no badge.
  // Flag-gated: with `charters` off the map is empty and the column disappears cleanly.
  const [commissions, cadence] = await Promise.all([
    listManagedCommissionsDetailed(organization.id, selectedHospitalId),
    (async () =>
      (await chartersEnabled()) ? getCommissionCadenceOverview() : {})(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {organization.name}
          </p>
          {hospitals.length > 1 ? (
            <HospitalSwitcher
              hospitals={hospitals}
              currentHospitalId={selectedHospitalId}
              allowAll={isOrgAdmin}
            />
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl text-balance">Comissões</h1>
            <p className="max-w-prose text-muted-foreground text-pretty">
              {isOrgAdmin
                ? "Crie e administre as comissões da sua organização. Abra uma comissão para editar seus dados e gerenciar a coordenação."
                : "Crie e administre as comissões do seu hospital. Abra uma comissão para editar seus dados e gerenciar a coordenação."}
            </p>
          </div>
          <CreateCommissionDialog hospitals={hospitals} />
        </div>
      </header>

      <section
        aria-labelledby="comissoes-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="comissoes-heading" className="text-lg font-semibold">
          {isOrgAdmin && !selectedHospitalId
            ? "Todas as comissões"
            : "Comissões do hospital"}
        </h2>
        <OrgCommissionList
          org={org}
          commissions={commissions}
          cadence={cadence}
        />
      </section>
    </div>
  );
}
