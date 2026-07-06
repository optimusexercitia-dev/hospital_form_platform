import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LineChart } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { listHospitalsForOrg } from "@/lib/queries/org";
import { getHospitalIndicatorRollup } from "@/lib/queries/indicators";
import { qualityIndicatorsEnabled } from "@/lib/queries/feature-flags";
import { HospitalIndicatorScorecard } from "@/components/indicators/hospital-indicator-scorecard";

export const metadata: Metadata = {
  title: "Indicadores da organização",
};

/**
 * Hospital indicator scorecard (Phase 15, F6). The hospital-admin surface — a
 * read-only, PHI-FREE per-commission rollup of each administered hospital's
 * indicators (counts + status only), mirroring the `nsp_org_*` rollup screens.
 *
 * Access is enforced by the `/o/[org]/manage` layout (org_admin OR hospital_admin
 * of this org). The hospital set is resolved as: the caller's `hospital_admin`
 * hospitals in this org, UNION the org's hospitals when they are an org_admin
 * (`listHospitalsForOrg` is org_admin-scoped, empty otherwise). Both reads are
 * RLS-scoped, and the rollup DEFINER re-gates per hospital — a foreign hospital
 * yields `[]`. Gated behind the `quality_indicators` flag (404 when off).
 */
export default async function OrgIndicatorsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;

  if (!(await qualityIndicatorsEnabled())) {
    notFound();
  }

  const context = await getSessionContext();
  if (!context) {
    notFound();
  }

  // Resolve this org + the caller's standing (the layout already gated entry).
  const orgAdmin = context.orgAdminOf.find((o) => o.organization.slug === org);
  const hospitalAdminHere = context.hospitalAdminOf.filter(
    (h) => h.organization.slug === org,
  );
  if (!orgAdmin && hospitalAdminHere.length === 0) {
    notFound();
  }

  // Build the hospital set (de-duplicated): org_admin → all org hospitals;
  // hospital_admin → their own. Both reads are RLS-scoped.
  const hospitalMap = new Map<string, { id: string; name: string }>();
  for (const h of hospitalAdminHere) {
    hospitalMap.set(h.hospital.id, { id: h.hospital.id, name: h.hospital.name });
  }
  if (orgAdmin) {
    const orgHospitals = await listHospitalsForOrg(orgAdmin.organization.id);
    for (const h of orgHospitals) {
      hospitalMap.set(h.id, { id: h.id, name: h.name });
    }
  }
  const hospitals = [...hospitalMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  // Fetch each hospital's rollup in parallel (the DEFINER re-gates per hospital).
  const rollups = await Promise.all(
    hospitals.map((h) => getHospitalIndicatorRollup(h.id)),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração da organização
        </p>
        <h1 className="text-3xl text-balance">Indicadores</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Situação dos indicadores de qualidade das comissões de cada hospital —
          totais e classificação em relação à meta. Somente leitura.
        </p>
      </header>

      {hospitals.length === 0 ? (
        <section
          aria-label="Sem hospitais"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LineChart aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum hospital ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Cadastre hospitais e comissões para acompanhar seus indicadores aqui.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {hospitals.map((hospital, i) => (
            <HospitalIndicatorScorecard
              key={hospital.id}
              hospitalName={hospital.name}
              rows={rollups[i]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
