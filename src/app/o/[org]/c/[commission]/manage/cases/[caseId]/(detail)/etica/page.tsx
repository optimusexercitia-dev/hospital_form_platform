import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { getEthicsCaseProcedure } from "@/lib/queries/ethics";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { EthicsCoordinatorControls } from "@/components/ethics/ethics-coordinator-controls";

export const metadata: Metadata = {
  title: "Processo ético",
};

/**
 * The "Processo ético" tab of a case (ETH·E2; ADR 0073) — a sibling of the
 * Detalhes/Timeline tabs inside the coordinator `(detail)` route group. Hosts the
 * five coordinator controls (Part 1) and the disciplinary procedure surface
 * (Part 2 — admissibility → allegations/findings → decision/votes → hearings →
 * notifications → appeals). Coordinator-gated + commission-scoped (mirrors the
 * layout, defense in depth). The tab is only linked when the case is ethics-typed;
 * a direct hit on a non-ethics case (or the `ethics` flag off) resolves to
 * `getEthicsCaseProcedure(...) === null` → `notFound()`.
 */
export default async function EthicsProcedurePage({
  params,
}: {
  params: Promise<{ org: string; commission: string; caseId: string }>;
}) {
  const { org, commission, caseId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const [detail, procedure] = await Promise.all([
    getCaseDetail(caseId),
    getEthicsCaseProcedure(caseId),
  ]);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }
  // Not an ethics-typed case (or the `ethics` flag is off) → the procedure surface
  // does not exist for this case.
  if (!procedure) {
    notFound();
  }

  const members = sortMembers(await listMembers(access.commission.id)).map(
    (m) => ({ userId: m.userId, name: m.fullName ?? m.email ?? "Membro" }),
  );

  return (
    <div className="flex flex-col gap-6">
      <EthicsCoordinatorControls
        caseId={caseId}
        confidentialityLevel={detail.confidentialityLevel}
        visibilityPolicy={detail.visibilityPolicy}
        members={members}
      />
    </div>
  );
}
