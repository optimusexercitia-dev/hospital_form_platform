import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getReadinessReport, getStandardTree } from "@/lib/queries/accreditation";
import { computeReadinessRollups } from "@/lib/accreditation/rollups";
import { commissionHref } from "@/lib/routing";
import { ReadinessDashboard } from "@/components/accreditation/readiness-dashboard";

/**
 * A framework's landing view inside the master-detail shell — the readiness
 * dashboard (ADR 0093 D3/D5): per-level bars + cumulative "o que bloqueia o
 * Nível N?" gap lists for a leveled (ONA) framework, or per-chapter % +
 * overall % + gap lists for a non-leveled (JCI) one. All the arithmetic is
 * {@link computeReadinessRollups} (`@/lib/accreditation/rollups`,
 * Vitest-tested) — this page only fetches and renders.
 */
export default async function FrameworkOverviewPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; framework: string }>;
}) {
  const { org, commission, framework: frameworkId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const [tree, rows] = await Promise.all([
    getStandardTree(frameworkId),
    getReadinessReport(access.commission.id, frameworkId),
  ]);

  const rollups = computeReadinessRollups(rows, tree);

  return (
    <ReadinessDashboard
      rollups={rollups}
      standardHref={(standardId) =>
        commissionHref(org, commission, "manage", "acreditacao", frameworkId, "padrao", standardId)
      }
    />
  );
}
