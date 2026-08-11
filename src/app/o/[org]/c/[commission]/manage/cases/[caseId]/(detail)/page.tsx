import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg, canInCommission } from "@/lib/queries/session";
import {
  getCaseDetail,
  casePatientEnabled,
  casesExtrasEnabled,
  listCaseCustomFieldValues,
} from "@/lib/queries/cases";
import { caseCustomFieldsEnabled, featureEnabled } from "@/lib/queries/feature-flags";
import { listCaseOutcomes } from "@/lib/queries/case-outcomes";
import {
  listPhaseResults,
  phaseResultsEnabled,
} from "@/lib/queries/phase-results";
import { toResolvedPhaseResultOptions } from "@/components/cases/phase-result-options";
import { listMembers, listLinkableOrgUsers } from "@/lib/queries/members";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { listCaseDocuments, listCaseEvents } from "@/lib/queries/case-documents";
import { listCaseTags, listCaseTagsForCase } from "@/lib/queries/case-tags";
import { listCaseActionItems } from "@/lib/queries/case-action-items";
import { actionItemsEnabled } from "@/lib/queries/action-items";
import { listCaseInterviews, interviewsEnabled } from "@/lib/queries/interviews";
import { listCaseMeetings } from "@/lib/queries/case-timeline";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { buildCaseReferralsModule } from "@/components/referrals/build-case-referrals-module";
import { buildCaseCorrectionsData } from "@/components/cases/build-case-corrections";
import {
  getParticipantRoleVocabularyHref,
  listCaseParticipantRoles,
} from "@/lib/queries/participants";

export const metadata: Metadata = {
  title: "Detalhe do caso",
};

/**
 * The "Detalhes" tab body (default child of the `(detail)` layout): the coordinator
 * case-detail content. The case header spine + tab bar live in the layout, so this
 * page renders only the tab CONTENT — now via the SHARED, capability-gated
 * {@link CaseDetailView} (Case Access Control increment, ADR 0033 D7), the SAME
 * component the staff route mounts. The coordinator keeps full caps (the
 * `get_case_detail` envelope is coordinator-grade here) and the layout's richer
 * chrome (so `withHeader={false}`).
 *
 * Coordinator-gated + commission-scoped here too (defense in depth; the layout gates
 * identically and both reads are React `cache()`-memoized, so the repeat is free).
 */
export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string; caseId: string }>;
  searchParams: Promise<{ encaminharDe?: string }>;
}) {
  const { org, commission, caseId } = await params;
  // RV2 R3: an "Encaminhar adiante" deep-link seeds the forward wizard's parent
  // referral id (the new draft's lineage back-pointer). Absent for a normal visit.
  const { encaminharDe } = await searchParams;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  const [
    interviewsOn,
    patientSafetyOn,
    casePatientOn,
    narrativesOn,
    caseAccessOn,
    phaseResultsOn,
    casesExtrasOn,
    meetingsOn,
    actionItemsOn,
    caseCustomFieldsOn,
    caseParticipantsOn,
  ] = await Promise.all([
    interviewsEnabled(),
    patientSafetyEnabled(),
    casePatientEnabled(),
    narrativesEnabled(),
    caseAccessEnabled(),
    phaseResultsEnabled(),
    casesExtrasEnabled(),
    meetingsEnabled(),
    actionItemsEnabled(),
    caseCustomFieldsEnabled(),
    featureEnabled("case_participants"),
  ]);

  // ETH·E4 (ADR 0108) — same org-scoped roster surfaces as the staff route.
  const [participantRoles, participantPlatformUsers, roleVocabularyHref] =
    caseParticipantsOn
    ? await Promise.all([
        listCaseParticipantRoles(
          access.organization.id,
          detail.case.caseTypeId,
        ),
        // ⚠ NOT `listAddableMembers` — see the sibling staff route: that RPC
        // excludes people already in this commission, i.e. the likeliest
        // respondents (ADR 0108 D6 / the `no_account` dead end).
        listLinkableOrgUsers(access.organization.id),
        // The remedy link for the "no role accepts this type" empty state —
        // `null` unless this viewer can open the vocabulary admin.
        getParticipantRoleVocabularyHref(org),
      ])
    : [[], [], null];

  // The commission's outcome vocabulary — for the process-less offered-outcome
  // editor (processless_cases). Only needed when this case is process-less AND the
  // coordinator may edit the set; otherwise the editor never renders, so `[]`.
  const outcomes =
    detail.case.templateId === null && casesExtrasOn
      ? await listCaseOutcomes(access.commission.id)
      : [];

  // Post-conclusion result correction (phase-results feature; task #10). This route
  // is already staff_admin/admin-gated, so a coordinator here may correct a
  // concluded phase's result when the flag is on. This is the commission's full
  // active vocabulary; the picker narrows it per phase — a MANUAL phase is
  // restricted to its allowed subset (phase-result-manual-mode).
  const phaseResultOptions = phaseResultsOn
    ? toResolvedPhaseResultOptions(await listPhaseResults(access.commission.id))
    : [];
  const [
    members,
    documents,
    events,
    tags,
    caseTags,
    actionItems,
    interviews,
    meetings,
    customFields,
  ] = await Promise.all([
    listMembers(access.commission.id),
    listCaseDocuments(caseId),
    listCaseEvents(caseId),
    listCaseTags(access.commission.id),
    listCaseTagsForCase(caseId),
    listCaseActionItems(caseId),
    interviewsOn ? listCaseInterviews(caseId) : Promise.resolve([]),
    meetingsOn ? listCaseMeetings(caseId) : Promise.resolve([]),
    caseCustomFieldsOn
      ? listCaseCustomFieldValues(caseId)
      : Promise.resolve([]),
  ]);

  // The outbound-referrals card module (Phase 22; null when the flag is off). Built
  // from data already loaded — no inline supabase-js (Rule 9; UI-prop assembly).
  const referralsModule = await buildCaseReferralsModule(
    detail,
    documents,
    access.commission.hospitalId,
  );

  // Case Correction Lifecycle surface data (ADR 0085; empty when the flag is off).
  const correctionsData = await buildCaseCorrectionsData(detail);

  return (
    <CaseDetailView
      org={org} slug={slug}
      detail={detail}
      members={members}
      documents={documents}
      events={events}
      tags={tags}
      caseTags={caseTags}
      actionItems={actionItems}
      interviews={interviews}
      interviewsEnabled={interviewsOn}
      meetings={meetings}
      meetingsEnabled={meetingsOn}
      patientSafetyEnabled={patientSafetyOn}
      casePatientEnabled={casePatientOn}
      narrativesEnabled={narrativesOn}
      caseAccessEnabled={caseAccessOn}
      viewerId={access.context.userId}
      myRole="coordinator"
      withHeader={false}
      backHref={commissionHref(org, commission, "manage", "cases")}
      referralsModule={referralsModule}
      forwardParentReferralId={encaminharDe ?? null}
      canManagePhaseResults={phaseResultsOn}
      phaseResultOptions={phaseResultOptions}
      outcomes={outcomes}
      casesExtrasEnabled={casesExtrasOn}
      actionItemsEnabled={actionItemsOn}
      canAssignPhases={canInCommission(access, "assign_case_phases")}
      caseCustomFieldsEnabled={caseCustomFieldsOn}
      customFields={customFields}
      correctionsEnabled={correctionsData.enabled}
      corrections={correctionsData.requests}
      narrativeRevisions={correctionsData.narrativeRevisions}
      caseParticipantsEnabled={caseParticipantsOn}
      organizationId={access.organization.id}
      participantRoles={participantRoles}
      participantPlatformUsers={participantPlatformUsers}
      participantRoleVocabularyHref={roleVocabularyHref}
    />
  );
}
