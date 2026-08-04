import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { listCommissionsForOrg, listHospitalsForOrg } from "@/lib/queries/org";
import { getHospitalReadiness, listFrameworks } from "@/lib/queries/accreditation";
import { accreditationEnabled } from "@/lib/queries/feature-flags";
import { orgHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { HospitalReadinessRegister } from "@/components/accreditation/hospital-readiness-register";

export const metadata: Metadata = {
  title: "Acreditação da organização",
};

/**
 * Hospital-wide consolidated accreditation readiness (Phase 16 Wave 3). The
 * hospital-admin surface — a read-only (except the ownership editor),
 * PHI-FREE per-hospital rollup, mirroring `manage/documentos/page.tsx` +
 * `hospital-document-register.tsx`.
 *
 * Access: `/o/[org]/manage/layout.tsx` already gates org_admin OR
 * hospital_admin; this page re-derives the same sets (org_admin ∪
 * hospital_admin-here) because it is NOT rendered under that shared layout's
 * data (Next.js segments fetch independently). Gated behind the
 * `accreditation` flag (404 when off).
 *
 * ⚠ CONTRACT GAP, flagged rather than silently worked around:
 * `listFrameworks(commissionId)` is the only posted way to read the global
 * framework list — there is no "list global frameworks, no commission
 * context" query, yet `getHospitalReadiness(hospital, framework)` needs a
 * framework id and a hospital-tier caller has no natural single commission.
 * Global-pack rows are identical regardless of which commission id is
 * passed (RLS: `owner IS NULL OR is_member_of(owner)`), so this seeds
 * `listFrameworks` with the FIRST commission in the org (`listCommissionsForOrg`,
 * RLS-scoped to org_admin/hospital_admin already) purely to reach the global
 * rows, then filters to `ownerCommissionId === null`. Correct today; a
 * dedicated `listGlobalFrameworks()` would remove the indirection.
 */
export default async function OrgAccreditationPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ framework?: string }>;
}) {
  const { org } = await params;
  const { framework: frameworkParam } = await searchParams;

  if (!(await accreditationEnabled())) {
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

  const organization = orgAdmin?.organization ?? hospitalAdminHere[0]!.organization;

  // Hospital set: hospital_admin's own hospitals ∪ every org hospital when org_admin.
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

  // Commissions in scope (RLS-scoped: org_admin sees the whole org, a
  // hospital_admin-only caller sees just their hospital's) — feeds BOTH the
  // global-framework lookup (see the file-level contract-gap note) and each
  // hospital's ownership-editor option list.
  const commissions = await listCommissionsForOrg(organization.id);

  const frameworks = commissions.length > 0 ? await listFrameworks(commissions[0].id) : [];
  const globalFrameworks = frameworks.filter((f) => f.ownerCommissionId === null);
  const selectedFrameworkId =
    frameworkParam && globalFrameworks.some((f) => f.id === frameworkParam)
      ? frameworkParam
      : (globalFrameworks[0]?.id ?? null);

  const registers = selectedFrameworkId
    ? await Promise.all(hospitals.map((h) => getHospitalReadiness(h.id, selectedFrameworkId)))
    : hospitals.map(() => []);

  const commissionsByHospital = new Map<string, { id: string; name: string }[]>();
  for (const c of commissions) {
    if (!c.hospitalId) continue;
    const list = commissionsByHospital.get(c.hospitalId) ?? [];
    list.push({ id: c.id, name: c.name });
    commissionsByHospital.set(c.hospitalId, list);
  }
  const commissionNameById = Object.fromEntries(commissions.map((c) => [c.id, c.name]));
  const hospitalAdminIds = new Set(hospitalAdminHere.map((h) => h.hospital.id));

  const basePath = orgHref(org, "manage", "acreditacao");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração da organização
        </p>
        <h1 className="text-3xl text-balance">Acreditação</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Prontidão consolidada de cada hospital contra os padrões de acreditação —
          pior caso entre as comissões, ou a comissão responsável quando definida.
          Somente leitura, exceto a comissão responsável por padrão.
        </p>
      </header>

      {globalFrameworks.length === 0 ? (
        <EmptyState message="Nenhum framework de acreditação disponível ainda." />
      ) : (
        <>
          <nav aria-label="Framework" className="flex flex-wrap gap-2">
            {globalFrameworks.map((f) => (
              <Link
                key={f.id}
                href={`${basePath}?framework=${f.id}`}
                aria-current={f.id === selectedFrameworkId ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-(--dur-fast) ease-(--ease-out-soft) focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                  f.id === selectedFrameworkId
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {f.name}
              </Link>
            ))}
          </nav>

          {hospitals.length === 0 ? (
            <EmptyState message="Cadastre hospitais e comissões para acompanhar a acreditação aqui." />
          ) : (
            <div className="flex flex-col gap-6">
              {hospitals.map((hospital, i) => (
                <HospitalReadinessRegister
                  key={hospital.id}
                  hospitalId={hospital.id}
                  hospitalName={hospital.name}
                  rows={registers[i] ?? []}
                  canEditOwnership={hospitalAdminIds.has(hospital.id)}
                  commissionOptions={commissionsByHospital.get(hospital.id) ?? []}
                  commissionNameById={commissionNameById}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section
      aria-label="Sem dados"
      className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Award aria-hidden="true" className="size-6" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">{message}</p>
    </section>
  );
}
