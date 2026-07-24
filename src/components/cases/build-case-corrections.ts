import "server-only";

import {
  listCaseCorrectionRequests,
  listNarrativeRevisions,
  type CorrectionRequest,
  type NarrativeRevision,
} from "@/lib/queries/corrections";
import { caseCorrectionsEnabled } from "@/lib/queries/feature-flags";
import type { CaseDetail } from "@/lib/queries/cases";

/**
 * Everything the Case Correction Lifecycle surface (ADR 0085) needs, assembled once
 * on the server so BOTH case-detail host pages (the coordinator `(detail)` route and
 * the staff `casos/[caseId]` route) stay DRY.
 *
 * UI-PROP ASSEMBLY, not data access — it only CALLS the typed readers in
 * `@/lib/queries/corrections` (Rule 9 boundary respected; no inline supabase-js) and
 * reshapes them. Marked `server-only` so it can never reach a client bundle.
 *
 * `enabled=false` (flag off) short-circuits to empty data → the host threads a
 * `null` capability descriptor and no correction chrome renders (flag-OFF behavior
 * unchanged).
 */
export interface CaseCorrectionsData {
  /** Whether the `case_corrections` flag is on (gates the whole surface). */
  enabled: boolean;
  /** Every correction request for the case, newest-first (RLS-scoped to readers). */
  requests: CorrectionRequest[];
  /**
   * narrativeId → its revision history (superseded bodies, newest-first). Only
   * narratives that actually have revisions appear; a lookup miss means `[]`.
   */
  narrativeRevisions: Record<string, NarrativeRevision[]>;
}

const EMPTY: CaseCorrectionsData = {
  enabled: false,
  requests: [],
  narrativeRevisions: {},
};

export async function buildCaseCorrectionsData(
  detail: CaseDetail,
): Promise<CaseCorrectionsData> {
  if (!(await caseCorrectionsEnabled())) return EMPTY;

  // Revisions only ever exist for narratives corrected AFTER conclusion, so an
  // `open` narrative can be skipped — this trims the per-narrative fan-out to the
  // (few) concluded/voided ones.
  const revisionNarratives = detail.narratives.filter(
    (n) => n.status === "completed" || n.status === "voided",
  );

  const [requests, revisionLists] = await Promise.all([
    listCaseCorrectionRequests(detail.case.id),
    Promise.all(revisionNarratives.map((n) => listNarrativeRevisions(n.id))),
  ]);

  const narrativeRevisions: Record<string, NarrativeRevision[]> = {};
  revisionNarratives.forEach((n, i) => {
    const revs = revisionLists[i];
    if (revs.length > 0) narrativeRevisions[n.id] = revs;
  });

  return { enabled: true, requests, narrativeRevisions };
}
