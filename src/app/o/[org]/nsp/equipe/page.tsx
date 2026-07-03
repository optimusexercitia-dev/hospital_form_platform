import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Hospital, Users } from "lucide-react";

import { getNspAccessByOrg } from "@/lib/queries/session";
import { nspHref } from "@/lib/routing";
import {
  listPqsMembers,
  listHospitalEligibleUsersForPqs,
} from "@/lib/queries/pqs";
import { PqsRosterManager } from "@/components/safety/pqs-roster-manager";
import { resolveNspHospital } from "@/components/shell/nsp-hospital-scope";

export const metadata: Metadata = {
  title: "NSP — equipe",
};

/**
 * "Equipe do NSP" — the per-HOSPITAL PQS roster curation screen (NSP-per-hospital,
 * ADR 0052). Enrollment in this roster is what grants THIS HOSPITAL's PHI **read**;
 * this page is the single door that admits a reader for the selected hospital.
 *
 * Access: LOCAL-COORDINATOR-ONLY, for the SELECTED hospital. The `/o/[org]/nsp`
 * layout admits any operator (member OR coordinator of ≥1 hospital); here we
 * additionally require that the caller COORDINATES the selected `?hospital=` (its
 * grant `role === 'coordinator'`). An enrolled-but-not-coordinator member, or a
 * coordinator of a DIFFERENT hospital, gets `notFound()`. The org-level
 * `nsp_org_admin` curates any hospital's roster from the separate
 * `/o/[org]/nsp-org` console — not here. The `list`/`add`/`remove` RPCs re-gate
 * (`nsp_org_admin OR coordinator`) server-side (42501), so RLS remains the boundary.
 *
 * Three-tier chain: the `org_admin` appoints the `nsp_org_admin`, the
 * `nsp_org_admin` appoints per-hospital coordinators, the local coordinator curates
 * THIS roster, an enrolled member reads that hospital's PHI. A coordinator is a full
 * local operator (implicit read) but still enrolls members here explicitly.
 *
 * PHI-FREE: a roster row is `(hospital, user)` + who/when; the eligible-user picker
 * is name/email for display only. No patient data appears here.
 */
export default async function NspRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ hospital?: string }>;
}) {
  const { org } = await params;
  const access = await getNspAccessByOrg(org);
  if (!access) {
    notFound();
  }

  const sp = await searchParams;
  const hospital = resolveNspHospital(access.hospitals, sp.hospital);
  // Curation is the LOCAL coordinator's duty: require the caller coordinates the
  // SELECTED hospital. A member (or a coordinator of another hospital) → 404.
  if (!hospital || hospital.role !== "coordinator") {
    notFound();
  }

  const [members, eligibleUsers] = await Promise.all([
    listPqsMembers(hospital.hospitalId),
    listHospitalEligibleUsersForPqs(hospital.hospitalId),
  ]);

  // Show the hospital name when the operator coordinates more than one hospital
  // (so it is unambiguous which roster is being curated).
  const showHospitalName = access.hospitals.length > 1;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`${nspHref(org)}?hospital=${encodeURIComponent(hospital.hospitalId)}`}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Núcleo de Segurança do Paciente
        </Link>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Núcleo de Segurança do Paciente
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <Users aria-hidden="true" className="size-7 text-primary" />
          Equipe do NSP
        </h1>
        {showHospitalName ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Hospital aria-hidden="true" className="size-4" />
            {hospital.hospitalName}
          </p>
        ) : null}
        <p className="max-w-prose text-muted-foreground text-pretty">
          Gerencie quem compõe a equipe do Núcleo de Segurança do Paciente deste
          hospital. Adicionar uma pessoa concede acesso aos dados sensíveis de
          segurança do paciente; remover revoga esse acesso. Todo acesso aos dados
          do paciente é registrado em trilha de auditoria.
        </p>
      </header>

      <PqsRosterManager
        hospitalId={hospital.hospitalId}
        members={members}
        eligibleUsers={eligibleUsers}
      />
    </div>
  );
}
