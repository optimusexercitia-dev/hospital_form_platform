import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { getNspAccessByOrg } from "@/lib/queries/session";
import { nspHref } from "@/lib/routing";
import {
  listPqsMembers,
  listOrgEligibleUsersForPqs,
} from "@/lib/queries/pqs";
import { PqsRosterManager } from "@/components/safety/pqs-roster-manager";

export const metadata: Metadata = {
  title: "NSP — equipe",
};

/**
 * "Equipe do NSP" — the per-org PQS roster curation screen (NSP-per-org, ADR
 * 0042). Enrollment in this roster is what grants the org's PHI **read**; this
 * page is the single door that admits a reader.
 *
 * Access: COORDINATOR-ONLY. The `/o/[org]/nsp` layout admits a PQS member OR the
 * org's `nsp_coordinator`; here we additionally require `isCoordinator` (the
 * roster is the coordinator's duty — an enrolled member who is NOT the
 * coordinator gets `notFound()`). The `list`/`add`/`remove` RPCs re-gate
 * coordinator-only server-side (42501), so RLS remains the boundary.
 *
 * Three-way duty separation: the `org_admin` appoints the coordinator (the
 * focused "Coordenador(es) do NSP" surface under `/o/[org]/manage`), the
 * coordinator curates THIS roster, an enrolled member reads PHI. A coordinator is
 * NOT implicitly a reader — they enroll themselves here to read.
 *
 * PHI-FREE: a roster row is `(org, user)` + who/when; the eligible-user picker is
 * name/email for display only. No patient data appears here.
 */
export default async function NspRosterPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const access = await getNspAccessByOrg(org);
  if (!access || !access.isCoordinator) {
    // Not the coordinator of this org (or unknown org) → 404 in-shell. An
    // enrolled-but-not-coordinator member lands here too: curation is not theirs.
    notFound();
  }

  const [members, eligibleUsers] = await Promise.all([
    listPqsMembers(access.orgId),
    listOrgEligibleUsersForPqs(access.orgId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href={nspHref(org)}
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
        <p className="max-w-prose text-muted-foreground text-pretty">
          Gerencie quem compõe a equipe do Núcleo de Segurança do Paciente desta
          organização. Adicionar uma pessoa concede acesso aos dados sensíveis de
          segurança do paciente; remover revoga esse acesso. Todo acesso aos dados
          do paciente é registrado em trilha de auditoria.
        </p>
      </header>

      <PqsRosterManager
        orgId={access.orgId}
        members={members}
        eligibleUsers={eligibleUsers}
      />
    </div>
  );
}
