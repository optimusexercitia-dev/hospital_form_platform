import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { listCommissionsForOrg, listHospitalsForOrg } from "@/lib/queries/org";
import { OrgCommissionList } from "@/components/org/org-commission-list";
import { OrgCommissionCreateForm } from "@/components/org/org-commission-create-form";

export const metadata: Metadata = {
  title: "Comissões",
};

/**
 * Org-admin commissions registry — the relocated `/admin/comissoes` list,
 * re-scoped to the org in the URL. Access is enforced by the `/o/[org]/manage`
 * layout (`is_org_admin_of(org)`); we re-resolve the org from
 * `context.orgAdminOf` for the org-scoped reads. The create form picks a HOSPITAL
 * (the org is auto-derived), so it needs the org's hospitals.
 */
export default async function OrgCommissionsPage({
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

  const [commissions, hospitals] = await Promise.all([
    listCommissionsForOrg(organization.id),
    listHospitalsForOrg(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="text-3xl text-balance">Comissões</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Crie e administre as comissões da sua organização. Abra uma comissão
          para editar seus dados e gerenciar a coordenação.
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
          Todas as comissões
        </h2>
        <OrgCommissionList org={org} commissions={commissions} />
      </section>
    </div>
  );
}
