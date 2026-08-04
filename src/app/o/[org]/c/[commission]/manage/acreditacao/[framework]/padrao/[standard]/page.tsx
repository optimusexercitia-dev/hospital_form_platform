import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getReadinessEvidence, getReadinessReport, listStandards } from "@/lib/queries/accreditation";
import { getStandardAssessmentDetail } from "@/lib/accreditation/actions";
import { StandardPanel } from "@/components/accreditation/standard-panel";

export const metadata: Metadata = {
  title: "Padrão de acreditação",
};

/**
 * One standard's detail: description, self-assessment form (prefilled with
 * the existing note via `getStandardAssessmentDetail` — BUG-P16-001's
 * root-cause half, closed by backend's `get_standard_assessment` door), and
 * evidence list. `ReadinessRow` (from `getReadinessReport`) deliberately
 * carries no `note` field (D8) — the note comes from this separate,
 * commission-scoped-only read instead.
 */
export default async function StandardDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; framework: string; standard: string }>;
}) {
  const { org, commission, framework: frameworkId, standard: standardId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const [standards, readiness, evidence, assessmentDetail] = await Promise.all([
    listStandards(frameworkId),
    getReadinessReport(access.commission.id, frameworkId),
    getReadinessEvidence(access.commission.id, standardId),
    getStandardAssessmentDetail(access.commission.id, standardId),
  ]);

  const standard = standards.find((s) => s.id === standardId);
  if (!standard) {
    notFound();
  }

  const row = readiness.find((r) => r.standardId === standardId);

  return (
    <StandardPanel
      standard={standard}
      assessmentStatus={row?.assessmentStatus ?? null}
      assessmentNoteMd={assessmentDetail?.noteMd ?? null}
      evidence={evidence}
      commissionId={access.commission.id}
      canEdit={access.role === "staff_admin"}
    />
  );
}
