import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import {
  listNspCoordinators,
  listOrgEligibleUsersForPqs,
} from "@/lib/queries/pqs";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { NspCoordinatorManager } from "@/components/admin/nsp-coordinator-manager";

export const metadata: Metadata = {
  title: "Coordenação do NSP",
};

/**
 * The focused "Coordenação do NSP" surface (NSP-per-org, ADR 0042) — where an
 * `org_admin` appoints / revokes the per-org `nsp_coordinator` grant. Access is
 * enforced by the `/o/[org]/manage` layout (`is_org_admin_of(org)`); we re-resolve
 * the org from `context.orgAdminOf` (RLS-scoped) for its id. Gated behind
 * `patient_safety` → 404 when off (no NSP, no coordination).
 *
 * Deliberately NARROW — this toggles ONE role, not a general org-member UI. It is
 * the first of the three-way duty separation: org_admin → appoints the
 * coordinator → who curates the NSP roster → whose members read PHI. Appointing a
 * coordinator does NOT grant PHI access (they must enroll into the roster).
 * PHI-FREE: only names/emails of org members + the role grant.
 */
export default async function OrgNspCoordinationPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const organization = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;

  // The layout already guarantees org_admin access; defensive (never expected).
  if (!organization) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  const [coordinators, eligibleUsers] = await Promise.all([
    listNspCoordinators(organization.id),
    listOrgEligibleUsersForPqs(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <ShieldCheck aria-hidden="true" className="size-7 text-primary" />
          Coordenação do NSP
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Nomeie quem coordena o Núcleo de Segurança do Paciente desta
          organização. O(a) coordenador(a) gerencia a equipe do NSP — quem tem
          acesso aos dados de segurança do paciente. Nomear a coordenação não
          concede, por si só, acesso aos dados sensíveis.
        </p>
      </header>

      <section
        aria-labelledby="nsp-coordination-heading"
        className="animate-rise-in flex max-w-3xl flex-col gap-5"
      >
        <h2 id="nsp-coordination-heading" className="sr-only">
          Gerenciar a coordenação do NSP
        </h2>
        <NspCoordinatorManager
          orgId={organization.id}
          coordinators={coordinators}
          eligibleUsers={eligibleUsers}
        />
      </section>
    </div>
  );
}
