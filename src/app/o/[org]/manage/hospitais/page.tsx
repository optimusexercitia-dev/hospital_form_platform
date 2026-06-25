import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { listHospitalsForOrg } from "@/lib/queries/org";
import { HospitalList } from "@/components/org/hospital-list";
import { OrgHospitalCreateForm } from "@/components/org/org-hospital-create-form";

export const metadata: Metadata = {
  title: "Hospitais",
};

/**
 * Org-admin hospitals registry. Access is enforced by the `/o/[org]/manage`
 * layout (`is_org_admin_of(org)`); we re-resolve the org from
 * `context.orgAdminOf` (RLS-scoped) to get its id for the org-scoped read +
 * create form. Lists the org's hospitals and offers a "Novo hospital" form.
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

  const hospitals = await listHospitalsForOrg(organization.id);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="text-3xl text-balance">Hospitais</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Cadastre e organize os hospitais da sua organização. Cada comissão
          pertence a um hospital.
        </p>
      </header>

      <section
        aria-labelledby="novo-hospital-heading"
        className="animate-rise-in rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
      >
        <h2 id="novo-hospital-heading" className="text-lg font-semibold">
          Novo hospital
        </h2>
        <p className="mt-1 mb-5 max-w-prose text-sm text-muted-foreground">
          O identificador é único dentro da organização.
        </p>
        <OrgHospitalCreateForm organizationId={organization.id} />
      </section>

      <section
        aria-labelledby="hospitais-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="hospitais-heading" className="text-lg font-semibold">
          Todos os hospitais
        </h2>
        <HospitalList hospitals={hospitals} />
      </section>
    </div>
  );
}
