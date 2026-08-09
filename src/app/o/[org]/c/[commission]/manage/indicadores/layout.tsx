import { notFound } from "next/navigation";

import {
  getCommissionAccessByOrg,
  canConfigureCommission,
} from "@/lib/queries/session";
import { qualityIndicatorsEnabled } from "@/lib/queries/feature-flags";

/**
 * Quality Indicators area shell (Phase 15, F1). Server Component.
 *
 * Gated behind the `quality_indicators` flag (404 when OFF — mirrors how meetings
 * gate their coordinator area) AND coordinator access: only a `staff_admin` of
 * this commission (or an org/hospital-admin resolved to that role) reaches it.
 * RLS remains the ultimate boundary; this closes the route + resolves the shell.
 */
export default async function IndicatorsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;

  if (!(await qualityIndicatorsEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || !canConfigureCommission(access)) {
    notFound();
  }

  return <>{children}</>;
}
