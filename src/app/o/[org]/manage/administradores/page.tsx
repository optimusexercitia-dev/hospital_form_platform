import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import {
  listHospitalAdminsForOrg,
  listNspOrgAdmins,
  listOrgHospitals,
} from "@/lib/queries/org";
import { listOrgEligibleUsers } from "@/lib/queries/pqs";
import { isNspOrgAdmin } from "@/lib/pqs/org-admin";
import { orgHref } from "@/lib/routing";
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
 * The person picker uses the ORG-WIDE eligible-users pool `listOrgEligibleUsers(orgId)`
 * (org-level members ∪ commission members of ANY hospital, INCLUDING org-level-only
 * users), since both roles here are appointed org-wide: `hospital_admin` (any hospital
 * in the org) and `nsp_org_admin` (org-level). The per-hospital
 * `listHospitalEligibleUsersForPqs` is NOT used here — it would miss org-level-only
 * users. Current holders come from ONE batched `listHospitalAdminsForOrg(hospitalIds)`
 * read (A3 — replaces the former per-hospital N+1 loop) and `listNspOrgAdmins(orgId)`.
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

  const [hospitals, eligibleUsers, nspOrgAdmins, viewerIsNspOrgAdmin] =
    await Promise.all([
      listOrgHospitals(organization.id),
      listOrgEligibleUsers(organization.id),
      listNspOrgAdmins(organization.id),
      // Is the VIEWER themselves an nsp_org_admin of this org? Gates the
      // discoverability link to the PHI-free org NSP-admin console (ADR 0052) — an
      // org_admin who ALSO holds the role can jump there from here.
      isNspOrgAdmin(organization.id),
    ]);

  // One batched read for every hospital's current hospital_admin holders
  // (hospitalId → holders) — replaces the former per-hospital N+1 loop.
  const hospitalAdminsByHospital = await listHospitalAdminsForOrg(
    hospitals.map((h) => h.id),
  );

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
        className="animate-rise-in flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
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
        className="animate-rise-in flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
        style={{ ["--rise-delay" as string]: "80ms" }}
      >
        <h2 id="nsp-org-admin-heading" className="text-lg font-semibold">
          Administração do NSP da organização
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          A administração do NSP da organização nomeia a coordenação do Núcleo de
          Segurança do Paciente em cada hospital e acompanha indicadores agregados
          por hospital. Não tem acesso à identificação de pacientes.
        </p>
        <NspOrgAdminManager
          orgId={organization.id}
          eligibleUsers={eligibleUsers}
          currentAdmins={nspOrgAdmins}
        />
        {viewerIsNspOrgAdmin ? (
          <Link
            href={orgHref(org, "nsp-org")}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Abrir o console de administração do NSP
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
