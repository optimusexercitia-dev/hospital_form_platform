import { getCaseTagReport } from "@/lib/queries/case-tags";

import { TagReportCard } from "./tag-report-card";

/**
 * Suspense boundary for {@link TagReportCard}: the case-tag report is a
 * secondary dashboard block that must not block the primary chart's first
 * paint (frontend-audit-2026-07 #2). Owns the `getCaseTagReport` await so the
 * page can stream it independently.
 */
export async function TagReportCardAsync({
  commissionId,
  range,
  rangeLabel,
}: {
  commissionId: string;
  range: { from?: string; to?: string } | undefined;
  rangeLabel: string;
}) {
  const rows = await getCaseTagReport(commissionId, range);
  return <TagReportCard rows={rows} rangeLabel={rangeLabel} />;
}
