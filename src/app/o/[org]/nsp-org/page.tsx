import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";
import {
  getNspOrgEventRollup,
  getNspOrgCapaRollup,
  getNspOrgRoster,
} from "@/lib/pqs/org-admin";
import {
  NspOrgRollups,
  NspOrgRosterSummary,
} from "@/components/org/nsp-org-rollups";

export const metadata: Metadata = {
  title: "NSP — visão da organização",
};

/** Best display label for a person: name, else email, else a neutral fallback. */
function personLabel(
  p: { fullName: string | null; email: string | null } | null,
): string | null {
  if (!p) return null;
  return p.fullName?.trim() || p.email || "Sem identificação";
}

/**
 * The org NSP-admin console OVERVIEW (NSP-per-hospital, ADR 0052, decision 13). The
 * `nsp_org_admin`'s ZERO-PHI, org-level dashboard: per-hospital event + CAPA
 * rollups and a roster summary. Access is enforced by the `/o/[org]/nsp-org` layout
 * (`nsp_org_admin` of this org + `patient_safety` flag); we re-resolve the org from
 * `context.nspOrgAdminOf` for its id.
 *
 * SECURITY (Rule 12 keystone): every read here is an `is_nsp_org_admin_of`-gated,
 * provably PHI-FREE aggregate door (counts / status / staff identity only). This
 * page NEVER fetches or renders a patient column, event title, or narrative.
 */
export default async function OrgNspOverviewPage({
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

  const [events, capa, roster] = await Promise.all([
    getNspOrgEventRollup(organization.id),
    getNspOrgCapaRollup(organization.id),
    getNspOrgRoster(organization.id),
  ]);

  const rosterSummary = roster
    .map((r) => ({
      hospitalId: r.hospitalId,
      hospitalName: r.hospitalName,
      coordinatorLabel: personLabel(r.coordinator),
      memberCount: r.members.length,
    }))
    .sort((a, b) => a.hospitalName.localeCompare(b.hospitalName, "pt-BR"));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <ShieldCheck aria-hidden="true" className="size-7 text-primary" />
          Administração do NSP
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Visão consolidada da segurança do paciente por hospital: volume de
          eventos por status e gravidade, situação dos planos de ação e as equipes
          de cada hospital. Esta visão é agregada e não exibe a identificação de
          nenhum paciente.
        </p>
      </header>

      <section aria-labelledby="nsp-org-rollups-heading" className="flex flex-col gap-4">
        <h2 id="nsp-org-rollups-heading" className="text-xl">
          Indicadores por hospital
        </h2>
        <NspOrgRollups events={events} capa={capa} />
      </section>

      <section aria-labelledby="nsp-org-roster-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="nsp-org-roster-heading" className="text-xl">
            Equipes do NSP
          </h2>
          <Link
            href={orgHref(org, "nsp-org", "coordenadores")}
            className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Gerenciar coordenação e equipes
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <NspOrgRosterSummary rosters={rosterSummary} />
      </section>
    </div>
  );
}
