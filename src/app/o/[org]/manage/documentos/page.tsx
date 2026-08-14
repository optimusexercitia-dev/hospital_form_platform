import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { listHospitalsForOrg } from "@/lib/queries/org";
import { getHospitalDocumentRegister } from "@/lib/queries/controlled-documents";
import { controlledDocsEnabled } from "@/lib/queries/feature-flags";
import { HospitalDocumentRegister } from "@/components/controlled-documents/hospital-document-register";

export const metadata: Metadata = {
  title: "Documentos da organização",
};

/**
 * Hospital-wide controlled-document register (Phase 17, F6). The hospital-admin
 * surface — a read-only, PHI-FREE per-commission rollup of each administered
 * hospital's documents (metadata + review-due only), mirroring the `nsp_org_*` /
 * indicator-scorecard rollup screens.
 *
 * Access is enforced by the `/o/[org]/manage` layout (org_admin OR hospital_admin
 * of this org). The hospital set is resolved as: the caller's `hospital_admin`
 * hospitals in this org, UNION the org's hospitals when they are an org_admin
 * (`listHospitalsForOrg` is org_admin-scoped, empty otherwise). The rollup DEFINER
 * re-gates per hospital — a foreign hospital yields `[]`. Gated behind the
 * `controlled_docs` flag (404 when off).
 */
export default async function OrgDocumentsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;

  if (!(await controlledDocsEnabled())) {
    notFound();
  }

  const context = await getSessionContext();
  if (!context) {
    notFound();
  }

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

  // Fetch each hospital's register in parallel (the DEFINER re-gates per hospital).
  const registers = await Promise.all(
    hospitals.map((h) => getHospitalDocumentRegister(h.id)),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração da organização
        </p>
        <h1 className="text-3xl text-balance">Documentos controlados</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Documentos controlados das comissões de cada hospital — tipo, situação,
          vigência e revisão. Somente leitura.
        </p>
      </header>

      {hospitals.length === 0 ? (
        <section
          aria-label="Sem hospitais"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText aria-hidden="true" className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Nenhum hospital ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Cadastre hospitais e comissões para acompanhar seus documentos aqui.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {hospitals.map((hospital, i) => (
            <HospitalDocumentRegister
              key={hospital.id}
              hospitalName={hospital.name}
              rows={registers[i]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
