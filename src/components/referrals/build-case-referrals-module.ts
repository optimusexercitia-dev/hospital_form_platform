import "server-only";

import {
  listCaseOutboundReferrals,
  listReferralTargetCommissions,
  listReferralTypes,
  referralsEnabled,
} from "@/lib/queries/referrals";
import type { CaseDetail } from "@/lib/queries/cases";
import type { CaseDocumentWithUrl } from "@/lib/queries/case-documents";

import type { CaseReferralsModule } from "@/components/cases/case-detail-view";

/**
 * Assemble the {@link CaseReferralsModule} for the case-detail outbound-referrals
 * card (Phase 22 — `case_referrals`), so BOTH case-detail host pages (the
 * coordinator `(detail)` route and the staff `casos/[caseId]` route) stay DRY.
 *
 * This is UI-PROP ASSEMBLY, not data access — it only CALLS the typed query
 * functions in `@/lib/queries/referrals` (Rule 9 boundary respected; no inline
 * supabase-js) and reshapes their results into the card's prop shape. Marked
 * `server-only` so it can never be dragged into a client bundle.
 *
 * Returns `null` when the `case_referrals` flag is off → the host omits the card
 * (flag-OFF behavior unchanged).
 *
 * The pickable snapshot inputs are derived from data the host ALREADY loaded:
 *  - narratives: the case's narratives that actually have a body (only those are
 *    meaningful to freeze; empty slots are skipped).
 *  - documents: the case's documents (the storage REFERENCE freezes, never the
 *    object — Rule 6).
 *
 * `targetCommissions` (GAP-1) is the PHI-free list of other commissions a source
 * coordinator may refer TO (the RPC returns `[]` for a non-authorized caller, so
 * loading it here is harmless for plain members).
 *
 * The safety-event PHI pre-fill (GAP-2) is intentionally NOT loaded here: it is an
 * AUDITED PHI read (`event_patient.read` via the NSP door), so firing it on every
 * case-detail render — even with no intent to refer — would over-audit. The wizard
 * loads it LAZILY on its patient step via the `loadCaseSafetyPrefill` `"use server"`
 * bridge (the PHI-panel reveal-on-demand pattern), so it isn't part of this module.
 */
export async function buildCaseReferralsModule(
  detail: CaseDetail,
  documents: CaseDocumentWithUrl[],
): Promise<CaseReferralsModule | null> {
  if (!(await referralsEnabled())) return null;

  const caseId = detail.case.id;
  const [referrals, referralTypes, targetCommissions] = await Promise.all([
    listCaseOutboundReferrals(caseId),
    listReferralTypes(),
    listReferralTargetCommissions(detail.case.commissionId),
  ]);

  const narratives = detail.narratives
    .filter((n) => (n.bodyMd ?? "").trim().length > 0)
    .map((n) => ({
      id: n.id,
      label: n.title?.trim() || n.typeLabel,
      bodyMd: n.bodyMd as string,
    }));

  const pickableDocuments = documents.map((d) => ({
    id: d.id,
    title: d.title,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
  }));

  return {
    referrals,
    referralTypes,
    targetCommissions,
    narratives,
    documents: pickableDocuments,
  };
  // NOTE: the safety-event PHI pre-fill is intentionally NOT assembled here — the
  // wizard loads it lazily on its patient step via the audited `loadCaseSafetyPrefill`
  // bridge, so the `event_patient.read` audit fires on intent, not on card mount.
}
