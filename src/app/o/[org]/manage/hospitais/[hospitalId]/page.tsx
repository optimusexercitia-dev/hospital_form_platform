import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hospital } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { listHospitalsForOrg } from "@/lib/queries/org";
import { listDepartmentsForHospital } from "@/lib/hospitals/departments";
import { orgHref } from "@/lib/routing";
import { DepartmentsManager } from "@/components/hospitals/departments-manager";

export const metadata: Metadata = {
  title: "Setores do hospital",
};

/**
 * Hospital detail page (nested under the org hospitals registry). Manages the
 * hospital's departments ("Unidade / setor") vocabulary. The `/o/[org]/manage`
 * layout already admits both `org_admin` and `hospital_admin`; THIS page
 * additionally checks the caller may manage THIS specific hospital:
 *   - `org_admin` of the hospital's org (any hospital), OR
 *   - `hospital_admin` of exactly this hospital.
 * Anything else → `notFound()` (leaks nothing about which hospitals exist). RLS
 * on the department write actions is the ultimate authority; this gate keeps
 * non-managers out of the UI and resolves the hospital's display name.
 */
export default async function HospitalDetailPage({
  params,
}: {
  params: Promise<{ org: string; hospitalId: string }>;
}) {
  const { org, hospitalId } = await params;
  const context = await getSessionContext();
  if (!context) notFound();

  const orgAdmin = context.orgAdminOf.find(
    (o) => o.organization.slug === org,
  );
  const hospitalAdmin = context.hospitalAdminOf.find(
    (h) => h.organization.slug === org && h.hospital.id === hospitalId,
  );

  // Must administer THIS hospital: org_admin of its org, or hospital_admin of it.
  if (!orgAdmin && !hospitalAdmin) notFound();

  // Resolve the hospital's display name (org_admin only — a hospital_admin
  // already carries it in context) alongside the departments read: neither
  // depends on the other's result, only on values already resolved above.
  const [hospitals, departments] = await Promise.all([
    orgAdmin ? listHospitalsForOrg(orgAdmin.organization.id) : Promise.resolve(null),
    // Management view: include archived rows so they can be reactivated.
    listDepartmentsForHospital(hospitalId, { includeArchived: true }),
  ]);

  let hospitalName: string | null = hospitalAdmin?.hospital.name ?? null;
  if (orgAdmin) {
    const found = hospitals?.find((h) => h.id === hospitalId);
    // An org_admin URL pointing at a hospital outside their org resolves to
    // nothing → not found (never expected via the linked cards).
    if (!found) notFound();
    hospitalName = found.name;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={orgHref(org, "manage", "hospitais")}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Hospitais
        </Link>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/60 text-accent-foreground"
          >
            <Hospital className="size-5" />
          </span>
          <h1 className="text-3xl text-balance">{hospitalName ?? "Hospital"}</h1>
        </div>
      </header>

      <section
        aria-labelledby="departments-heading"
        className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
      >
        <div className="flex flex-col gap-1">
          <h2 id="departments-heading" className="text-lg font-semibold">
            Setores (unidades)
          </h2>
        </div>
        <DepartmentsManager
          hospitalId={hospitalId}
          departments={departments}
        />
      </section>
    </div>
  );
}
