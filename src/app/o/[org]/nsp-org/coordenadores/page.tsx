import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";
import { getNspOrgRoster } from "@/lib/pqs/org-admin";
import { listHospitalEligibleUsersForPqs } from "@/lib/queries/pqs";
import {
  NspOrgHospitalManager,
  type NspOrgHospitalCuration,
} from "@/components/org/nsp-org-hospital-manager";

export const metadata: Metadata = {
  title: "NSP — coordenação e equipes",
};

/**
 * The org NSP-admin's coordinator + roster CURATION screen (NSP-per-hospital, ADR
 * 0052, decisions 3/12/13). One card per hospital: appoint/revoke the hospital's
 * `nsp_coordinator` and add/remove roster members — the `nsp_org_admin` curates
 * both across every hospital of the org, while reading ZERO patient data.
 *
 * Access: enforced by the `/o/[org]/nsp-org` layout (`nsp_org_admin` of this org +
 * `patient_safety`); we re-resolve the org from `context.nspOrgAdminOf`. Every
 * appointment/roster RPC re-gates `nsp_org_admin` server-side (42501), so RLS is the
 * boundary; the UI is defense-in-depth.
 *
 * PHI-FREE: rosters are `(hospital, user)` + who/when; coordinators + eligible-user
 * pickers are staff name/email for display only. No patient data appears here.
 */
export default async function OrgNspCoordinatorsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const organization = context?.nspOrgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;

  // The layout already guarantees access; defensive (never expected).
  if (!organization) {
    notFound();
  }

  const roster = await getNspOrgRoster(organization.id);

  // Eligible-user picker per hospital (one DEFINER read each), in parallel. The
  // `nsp_org_admin` may add anyone with membership in that hospital's org.
  const eligibleByHospital = await Promise.all(
    roster.map((r) => listHospitalEligibleUsersForPqs(r.hospitalId)),
  );

  const hospitals: NspOrgHospitalCuration[] = roster
    .map((r, i) => ({
      hospitalId: r.hospitalId,
      hospitalName: r.hospitalName,
      coordinator: r.coordinator,
      members: r.members,
      eligibleUsers: eligibleByHospital[i] ?? [],
    }))
    .sort((a, b) => a.hospitalName.localeCompare(b.hospitalName, "pt-BR"));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href={orgHref(org, "nsp-org")}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Administração do NSP
        </Link>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <ShieldCheck aria-hidden="true" className="size-7 text-primary" />
          Coordenação e equipes do NSP
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Para cada hospital, nomeie a coordenação do NSP e gerencie quem compõe a
          equipe que lê os dados de segurança do paciente. Nomear a coordenação
          concede a ela a operação local do NSP; adicionar alguém à equipe concede
          acesso de leitura aos dados sensíveis daquele hospital. Todo acesso é
          registrado em trilha de auditoria.
        </p>
      </header>

      {hospitals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground text-pretty">
          Nenhum hospital disponível para gerenciar nesta organização.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {hospitals.map((hospital) => (
            <NspOrgHospitalManager
              key={hospital.hospitalId}
              hospital={hospital}
            />
          ))}
        </div>
      )}
    </div>
  );
}
