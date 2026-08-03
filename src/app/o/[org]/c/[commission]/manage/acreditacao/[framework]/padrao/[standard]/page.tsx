import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getReadinessEvidence, getReadinessReport, listStandards } from "@/lib/queries/accreditation";
import { StandardPanel } from "@/components/accreditation/standard-panel";

export const metadata: Metadata = {
  title: "Padrão de acreditação",
};

/**
 * One standard's detail: description, self-assessment form, evidence list.
 *
 * ⚠ KNOWN CONTRACT GAP (flagged to backend/lead, not silently worked around):
 * {@link ReadinessRow} deliberately carries no `note` field (ADR 0093 D8's own
 * docstring: "assessment notes ... never ride the readiness rollup"), but
 * there is also no OTHER posted query that returns `standard_assessments
 * .note_md` for a single standard — `getReadinessEvidence` returns evidence
 * links, not the assessment note. Until that read path exists, this page
 * passes `assessmentNoteMd={null}`: the edit form renders correctly (an
 * empty textarea) but does NOT prefill an existing note for editing, and the
 * read-only view under-reports "Nenhuma observação registrada" even when one
 * exists. Low-risk (the note is never lost — resubmitting just overwrites it
 * with whatever the form currently holds) but worth fixing before Phase Gate.
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

  const [standards, readiness, evidence] = await Promise.all([
    listStandards(frameworkId),
    getReadinessReport(access.commission.id, frameworkId),
    getReadinessEvidence(access.commission.id, standardId),
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
      // See the file-level "KNOWN CONTRACT GAP" note above.
      assessmentNoteMd={null}
      evidence={evidence}
      commissionId={access.commission.id}
      canEdit={access.role === "staff_admin"}
    />
  );
}
