import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import {
  listHospitalAdmins,
  listNspOrgAdmins,
  listOrgHospitals,
  type RoleHolder,
} from "@/lib/queries/org";
import { listOrgEligibleUsersForPqs } from "@/lib/queries/pqs";
import { HospitalAdminManager } from "@/components/org/hospital-admin-manager";
import { NspOrgAdminManager } from "@/components/org/nsp-org-admin-manager";

export const metadata: Metadata = {
  title: "Administradores",
};

/**
 * The org_admin-only "Administradores" surface (ADR 0051 Decision 4): appoint /
 * revoke `hospital_admin` (per hospital) and `nsp_org_admin` (per org). Access is
 * enforced HERE (org_admin only — this is an org-level-only surface per Decision
 * 1) in addition to the `/o/[org]/manage` layout gate and the actions'
 * server-side `is_org_admin_of` re-check.
 *
 * The person picker reuses `listOrgEligibleUsersForPqs` (the org's registered
 * users, DEFINER-scoped) — the same "who belongs to this org" set the NSP
 * coordinator picker uses. Current holders come from the reconciled A9 reads
 * `listHospitalAdmins(hospitalId)` (one per hospital) and `listNspOrgAdmins(orgId)`.
 */
export default async function OrgAdministratorsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const organization = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;

  // Org-level-only surface: a hospital_admin (even of every hospital in the org)
  // does NOT reach this page — only org_admin (ADR 0051 Decision 1).
  if (!organization) {
    notFound();
  }

  const [hospitals, eligibleUsers, nspOrgAdmins] = await Promise.all([
    listOrgHospitals(organization.id),
    listOrgEligibleUsersForPqs(organization.id),
    listNspOrgAdmins(organization.id),
  ]);

  // Current hospital_admin holders, one read per hospital, assembled into the
  // map the manager consumes (hospitalId → holders).
  const hospitalAdminEntries = await Promise.all(
    hospitals.map(
      async (h) => [h.id, await listHospitalAdmins(h.id)] as const,
    ),
  );
  const hospitalAdminsByHospital: Record<string, RoleHolder[]> =
    Object.fromEntries(hospitalAdminEntries);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <ShieldCheck aria-hidden="true" className="size-7 text-primary" />
          Administradores
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Nomeie administradores locais de cada hospital e a administração do
          Núcleo de Segurança do Paciente da organização. Você não pode nomear a
          si mesmo(a).
        </p>
      </header>

      <section
        aria-labelledby="hospital-admin-heading"
        className="animate-rise-in flex max-w-3xl flex-col gap-5"
      >
        <h2 id="hospital-admin-heading" className="text-lg font-semibold">
          Administradores de hospital
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Um administrador de hospital gerencia tudo dentro do hospital
          escolhido — comissões, usuários e coordenação — com as mesmas
          permissões de um administrador da organização, mas restritas a esse
          hospital.
        </p>
        <HospitalAdminManager
          hospitals={hospitals}
          eligibleUsers={eligibleUsers}
          currentAdminsByHospital={hospitalAdminsByHospital}
        />
      </section>

      <section
        aria-labelledby="nsp-org-admin-heading"
        className="animate-rise-in flex max-w-3xl flex-col gap-5"
        style={{ ["--rise-delay" as string]: "80ms" }}
      >
        <h2 id="nsp-org-admin-heading" className="text-lg font-semibold">
          Administração do NSP da organização
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          A administração do NSP da organização nomeia coordenadores do Núcleo
          de Segurança do Paciente em qualquer hospital. Este papel ainda não
          concede acesso a dados de segurança do paciente nesta fase.
        </p>
        <NspOrgAdminManager
          orgId={organization.id}
          eligibleUsers={eligibleUsers}
          currentAdmins={nspOrgAdmins}
        />
      </section>
    </div>
  );
}
