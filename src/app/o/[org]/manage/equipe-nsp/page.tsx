import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { patientSafetyEnabled } from "@/lib/queries/pqs";

export const metadata: Metadata = {
  title: "Coordenação do NSP",
};

/**
 * "Coordenação do NSP" — RETIRED under NSP-per-hospital (ADR 0052, decision 3).
 *
 * The per-org `org_admin` no longer appoints NSP coordinators. The new three-tier
 * chain is: `org_admin` appoints the org's `nsp_org_admin` (on "Administradores"),
 * and the `nsp_org_admin` appoints PER-HOSPITAL coordinators + curates rosters from
 * the dedicated org NSP-admin console (`/o/[org]/nsp-org`). This page is kept as a
 * calm pointer so any bookmarked link resolves instead of 404-ing; the actual
 * appointment UI lives in those two places.
 *
 * Access: the `/o/[org]/manage` layout guarantees admin standing; we require
 * org_admin of this org (org-level surface) + the `patient_safety` flag.
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

  if (!organization) {
    notFound();
  }
  if (!(await patientSafetyEnabled())) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <ShieldCheck aria-hidden="true" className="size-7 text-primary" />
          Coordenação do NSP
        </h1>
      </header>

      <div className="max-w-prose rounded-2xl border border-primary/25 bg-accent/50 p-6 text-sm text-accent-foreground text-pretty">
        <p>
          A nomeação de coordenadores do Núcleo de Segurança do Paciente agora é
          feita por hospital. Primeiro, nomeie a{" "}
          <strong>administração do NSP da organização</strong> em
          &ldquo;Administradores&rdquo;. A administração do NSP passa a nomear a
          coordenação de cada hospital e a gerenciar as equipes no console de
          administração do NSP.
        </p>
      </div>
    </div>
  );
}
