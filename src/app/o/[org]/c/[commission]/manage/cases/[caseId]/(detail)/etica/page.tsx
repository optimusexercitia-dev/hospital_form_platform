import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import {
  getEthicsCaseProcedure,
  listCaseRecusals,
  listEthicsAllegationCategories,
  listEthicsSanctionTypes,
} from "@/lib/queries/ethics";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { EthicsCoordinatorControls } from "@/components/ethics/ethics-coordinator-controls";
import { EthicsProcedure } from "@/components/ethics/ethics-procedure";

export const metadata: Metadata = {
  title: "Processo ético",
};

/**
 * The "Processo ético" tab of a case (ETH·E2; ADR 0073) — a sibling of the
 * Detalhes/Timeline tabs inside the coordinator `(detail)` route group. Hosts the
 * five coordinator controls (Part 1) and the disciplinary procedure surface
 * (Part 2 — admissibility → allegations/findings → decision/votes → hearings →
 * notifications → appeals).
 *
 * ⛔ **STAYS `staff_admin`-ONLY — this is the one `(detail)` tab that did NOT move
 * to the ADR 0134 D3 predicate, and the divergence is deliberate.** D5's default is
 * fail-closed: every subroute not explicitly capability-mapped keeps its role gate,
 * and this page hosts five coordinator WRITE controls plus the whole disciplinary
 * procedure surface — none of it mapped to an administrativo capability. The
 * layout's `showEthics` carries the same `isCoordinator` conjunct, so the tab is
 * never OFFERED to a viewer this gate would then 404.
 *
 * Commission-scoped as well (mirrors the layout, defense in depth). The tab is only
 * linked when the case is ethics-typed; a direct hit on a non-ethics case (or the
 * `ethics` flag off) resolves to `getEthicsCaseProcedure(...) === null` →
 * `notFound()`.
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

  const [membersRaw, categories, sanctionTypes, recusals] = await Promise.all([
    listMembers(access.commission.id),
    listEthicsAllegationCategories(access.organization.id),
    listEthicsSanctionTypes(access.organization.id),
    listCaseRecusals(caseId),
  ]);
  const members = sortMembers(membersRaw).map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));

  return (
    <div className="flex flex-col gap-6">
      <EthicsCoordinatorControls
        caseId={caseId}
        confidentialityLevel={detail.confidentialityLevel}
        visibilityPolicy={detail.visibilityPolicy}
        members={members}
      />
      <EthicsProcedure
        caseId={caseId}
        procedure={procedure}
        categories={categories}
        sanctionTypes={sanctionTypes}
        recusals={recusals}
      />
    </div>
  );
}
