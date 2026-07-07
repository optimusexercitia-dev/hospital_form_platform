import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import { listHospitalsForOrg, listManagedCommissions } from "@/lib/queries/org";
import { HospitalSwitcher } from "@/components/shell/hospital-switcher";
import { OrgCommissionList } from "@/components/org/org-commission-list";
import { OrgCommissionCreateForm } from "@/components/org/org-commission-create-form";

export const metadata: Metadata = {
  title: "Comissões",
};

/**
 * Commissions registry — the relocated `/admin/comissoes` list, re-scoped to
 * the org in the URL. Access is enforced by the `/o/[org]/manage` layout
 * (`is_org_admin_of(org)` OR hospital_admin-of-some-hospital-here).
 *
 * An `org_admin` sees every commission in the org (`listManagedCommissions`
 * with `hospitalId = null`) and a hospital switcher scoping to ONE hospital
 * (`?hospital=`, ADR 0051 Decision 7) when it administers more than one; a
 * `hospital_admin` is scoped to its own hospital's commissions and its
 * switcher (if it holds several) has no "todos" option. The create form's
 * hospital picker is narrowed to the hospitals the caller may create under.
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

  const commissions = await listManagedCommissions(
    organization.id,
    selectedHospitalId,
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
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
        <h1 className="text-3xl text-balance">Comissões</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          {isOrgAdmin
            ? "Crie e administre as comissões da sua organização. Abra uma comissão para editar seus dados e gerenciar a coordenação."
            : "Crie e administre as comissões do seu hospital. Abra uma comissão para editar seus dados e gerenciar a coordenação."}
        </p>
      </header>

      <section
        aria-labelledby="nova-comissao-heading"
        className="animate-rise-in rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
      >
        <h2 id="nova-comissao-heading" className="text-lg font-semibold">
          Nova comissão
        </h2>
        <p className="mt-1 mb-5 max-w-prose text-sm text-muted-foreground">
          Escolha o hospital ao qual a comissão pertence. O identificador é único
          dentro da organização.
        </p>
        <OrgCommissionCreateForm hospitals={hospitals} />
      </section>

      <section
        aria-labelledby="comissoes-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="comissoes-heading" className="text-lg font-semibold">
          {isOrgAdmin && !selectedHospitalId
            ? "Todas as comissões"
            : "Comissões do hospital"}
        </h2>
        <OrgCommissionList org={org} commissions={commissions} />
      </section>
    </div>
  );
}
