import "server-only";

import {
  listCaseOutboundReferrals,
  listReferralRequestedActions,
  listReferralTargetCommissions,
  listReferralTypes,
  referralsEnabled,
} from "@/lib/queries/referrals";
import { getFeatureFlags } from "@/lib/queries/feature-flags";
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
  /**
   * ADR 0094 W4 / FUP-MEM-3 — the SOURCE commission's own hospital, taken from the
   * host's already-resolved `CommissionAccess` (`access.commission.hospitalId`)
   * rather than re-read here: a plain commission member cannot read `hospitals`, and
   * the access resolver has the id in hand for free.
   *
   * The RPC refuses any other hospital (HC071 — a Diretor Técnico is technically
   * responsible for ONE hospital's committees), so the destination is not a choice
   * the coordinator makes; it is this hospital or nothing.
   */
  sourceHospitalId?: string | null,
): Promise<CaseReferralsModule | null> {
  if (!(await referralsEnabled())) return null;

  const caseId = detail.case.id;
  const [referrals, referralTypes, requestedActions, targetCommissions, flags] =
    await Promise.all([
      listCaseOutboundReferrals(caseId),
      listReferralTypes(),
      listReferralRequestedActions(),
      listReferralTargetCommissions(detail.case.commissionId),
      getFeatureFlags(),
    ]);

  // A dark flag confers nothing: the RPC's DT arm raises before it considers any
  // authority, so offering the destination while the flag is off would be an
  // affordance that can only fail.
  const technicalDirectionHospitalId =
    flags.technical_director === true ? (sourceHospitalId ?? null) : null;

  const narratives = detail.narratives
    .filter((n) => (n.bodyMd ?? "").trim().length > 0)
    .map((n) => ({
      id: n.id,
      // ADR 0137 D10 — `CaseNarrative.typeLabel` -> `displayLabel` (the per-case
      // snapshot column `case_narratives.type_label` was renamed). ⛔ NOT a blanket
      // rename: `ProcessTemplateNarrative.typeLabel` (the LIVE join onto
      // `case_narrative_types.label`) and `case_referral.type_label` both keep the
      // old name. `detail.narratives` is `CaseNarrative[]`, so this site renames.
      label: n.title?.trim() || n.displayLabel,
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
    requestedActions,
    targetCommissions,
    technicalDirectionHospitalId,
    narratives,
    documents: pickableDocuments,
  };
  // NOTE: the safety-event PHI pre-fill is intentionally NOT assembled here — the
  // wizard loads it lazily on its patient step via the audited `loadCaseSafetyPrefill`
  // bridge, so the `event_patient.read` audit fires on intent, not on card mount.
}

/**
 * The READ-ONLY assembly, for the quality-office oversight reader (ADR 0100 D3/D7;
 * the lead's Q3 ruling). The referral LIST is case content the reviewer may read —
 * a case's cross-committee trajectory is close to why the quality office exists —
 * so the card still renders. What it must NOT carry is WIZARD FUEL.
 *
 * ⚠ WHY THIS IS A SEPARATE FUNCTION rather than a `readOnly` flag on the one above.
 * The wizard-only inputs are `targetCommissions` (an enumeration of OTHER
 * commissions) and `technicalDirectionHospitalId`. Passing `sourceHospitalId: null`
 * suppresses only the second — `listReferralTargetCommissions` is unconditional in
 * the main assembler, so the "obvious" call-site fix silently does half the job.
 * That half-application is exactly what a boolean parameter invites and what an
 * explicit variant prevents (`patterns-explicit-variants`): here the two fields are
 * empty by CONSTRUCTION, not by an argument someone has to remember to pass.
 *
 * Note the wizard is `canManageLifecycle`-gated and so never opens for a reviewer
 * anyway — this removes the reads and the enumeration, not a reachable affordance.
 * It is defence in depth plus two fewer RPCs per case-detail render.
 */
export async function buildCaseReferralsModuleReadOnly(
  detail: CaseDetail,
  documents: CaseDocumentWithUrl[],
): Promise<CaseReferralsModule | null> {
  if (!(await referralsEnabled())) return null;

  const referrals = await listCaseOutboundReferrals(detail.case.id);

  const narratives = detail.narratives
    .filter((n) => (n.bodyMd ?? "").trim().length > 0)
    .map((n) => ({
      id: n.id,
      // ADR 0137 D10 — `CaseNarrative.typeLabel` -> `displayLabel` (the per-case
      // snapshot column `case_narratives.type_label` was renamed). ⛔ NOT a blanket
      // rename: `ProcessTemplateNarrative.typeLabel` (the LIVE join onto
      // `case_narrative_types.label`) and `case_referral.type_label` both keep the
      // old name. `detail.narratives` is `CaseNarrative[]`, so this site renames.
      label: n.title?.trim() || n.displayLabel,
      bodyMd: n.bodyMd as string,
    }));

  return {
    referrals,
    // Vocabulary the LIST needs to label existing rows stays; both are PHI-free
    // per-org catalogues, not a picker of things the reviewer could act on.
    referralTypes: await listReferralTypes(),
    requestedActions: await listReferralRequestedActions(),
    // Wizard-only, empty by construction — see the header.
    targetCommissions: [],
    technicalDirectionHospitalId: null,
    narratives,
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
    })),
  };
}
