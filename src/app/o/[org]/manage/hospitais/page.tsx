import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { listHospitalsForOrgDetailed } from "@/lib/queries/org";
import { HospitalList } from "@/components/org/hospital-list";
import { CreateHospitalDialog } from "@/components/org/create-hospital-dialog";

export const metadata: Metadata = {
  title: "Hospitais",
};

/**
 * Org-admin hospitals registry. Access is enforced by the `/o/[org]/manage`
 * layout (`is_org_admin_of(org)`); we re-resolve the org from
 * `context.orgAdminOf` (RLS-scoped) to get its id for the org-scoped read +
 * "Criar hospital" dialog. Lists the org's hospitals, each enriched with its
 * `hospital_admin` roster and user count (`listHospitalsForOrgDetailed`).
 */
export default async function OrgHospitalsPage({
  params,
}: {
  params: Promise<{ org: string }>;
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

  const hospitals = await listHospitalsForOrgDetailed(organization.id);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {organization.name}
          </p>
          <h1 className="text-3xl text-balance">Hospitais</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Cadastre e organize os hospitais da sua organização. Cada comissão
            pertence a um hospital.
          </p>
        </div>
        <CreateHospitalDialog organizationId={organization.id} />
      </header>

      <section
        aria-labelledby="hospitais-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="hospitais-heading" className="text-lg font-semibold">
          Todos os hospitais
        </h2>
        <HospitalList org={org} hospitals={hospitals} />
      </section>
    </div>
  );
}
