import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { accreditationEnabled } from "@/lib/queries/feature-flags";

/**
 * Standards Crosswalk & Readiness/Gap Engine v2 area shell (Phase 16, ADR
 * 0093). Server Component.
 *
 * Gated behind the `accreditation` flag (404 when OFF — mirrors
 * `manage/indicadores`/`manage/documentos`) AND coordinator access: only a
 * `staff_admin` of this commission (or an org/hospital-admin resolved to that
 * role) reaches this authoring surface, matching the `manage/*` convention
 * even though the underlying RLS is broader (any commission member may READ
 * frameworks/standards/evidence/assessments — D10/Amendment 1 A1·2; only
 * WRITES are staff_admin-only). RLS remains the ultimate boundary; this
 * closes the route + resolves the shell.
 */
export default async function AcreditacaoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;

  if (!(await accreditationEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  return <>{children}</>;
}
