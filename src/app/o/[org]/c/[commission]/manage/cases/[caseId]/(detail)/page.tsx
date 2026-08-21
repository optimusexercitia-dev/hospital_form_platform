import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg, canInCommission } from "@/lib/queries/session";
import {
  getCaseDetail,
  canOpenCaseManagement,
  casePatientEnabled,
  casesExtrasEnabled,
  listCaseCustomFieldValues,
} from "@/lib/queries/cases";
import { caseCustomFieldsEnabled, featureEnabled } from "@/lib/queries/feature-flags";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listForms } from "@/lib/queries/forms";
import { listNarrativeTypes } from "@/lib/queries/case-narratives";
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
 * Gated + commission-scoped here too (defense in depth; the layout gates
 * IDENTICALLY — both call {@link canOpenCaseManagement} — and both reads are React
 * `cache()`-memoized, so the repeat is free). ⛔ Since ADR 0134 D3 the entrant is
 * no longer necessarily a coordinator: an appointed administrativo or a per-case
 * write-grantee reaches this body too, with `detail.viewerCapabilities` — not the
 * route — deciding what they may do. Every prop below that used to ride on the old
 * role gate now carries its door's own authority explicitly.
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

  if (!access) {
    notFound();
  }

  // ⛔ READ GATE, and it must precede the entry predicate — see the identical note
  // in the `(detail)` layout: `isAdministrativo` is independent of per-case read
  // reach until the Increment-2 S8 arm lands, so this is what stops an appointed
  // administrativo on a case they cannot read.
  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  // ADR 0134 D3 — the SAME single-point predicate the layout gates on. This page is
  // the layout's default child, so leaving a `staff_admin` copy here would 404 every
  // class the layout now admits and D3 would be a no-op. Defense in depth only
  // works when both copies are the same expression; both call the helper.
  if (
    !(await canOpenCaseManagement(access, caseId, detail.viewerCapabilities))
  ) {
    notFound();
  }

  // A terminal case is frozen (HC025), so nothing may be appended to its work list.
  // Mirrors the `(detail)` layout's own derivation.
  const isOpen = !isTerminalCaseStatus(detail.case.status);

  // The coordinator claim STRAIGHT FROM THE DB ENVELOPE — the same value the body's
  // `caps.canManageLifecycle` gates on (this host passes no `managementElsewhere`,
  // so nothing narrows it). Used below to keep coordinator-only dialog FUEL absent
  // by construction now that ADR 0134 D3 admits non-coordinators to this route.
  const canManageLifecycle = detail.viewerCapabilities.canManageLifecycle;

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
    detail.case.templateId === null && casesExtrasOn && canManageLifecycle
      ? await listCaseOutcomes(access.commission.id)
      : [];

  // Post-conclusion result correction (phase-results feature; task #10).
  //
  // ⛔ THE ROLE TEST IS LOAD-BEARING AND IS NOT A NARROWING. This prop was a bare
  // `phaseResultsOn` while the route guaranteed `staff_admin`; ADR 0134 D3 removed
  // that guarantee, which turns the bare flag into a UI over-grant for every newly
  // admitted class. Measured authority of `set_case_phase_result_override`:
  // coordinator ∨ the phase's OWN assignee — there is **no `member_can` arm**, so
  // an administrativo is refused by the door and must not see the affordance.
  //
  // ⚠ The assignee disjunct is per-PHASE and this prop is per-CASE, so it cannot be
  // expressed here; only the coordinator arm is rendered. Surfacing the assignee arm
  // is a product question (it would need a per-phase prop), deliberately NOT
  // invented in this increment.
  //
  // ⛔ This comment ended "`/casos` hand-sets the same coordinator-only test" —
  // FALSE as of the very commit that wrote it (ADR 0134 D2), which stopped the
  // reading surface passing `canManagePhaseResults` at all. `/casos` does not set
  // this test; it does not offer the affordance. A stale comment introduced by the
  // pass that was FIXING stale comments — which is the argument for keeping
  // cross-file claims out of a comment unless a gate can contradict them.
  const canManagePhaseResults = phaseResultsOn && access.role === "staff_admin";
  // The commission's full active vocabulary; the picker narrows it per phase — a
  // MANUAL phase is restricted to its allowed subset (phase-result-manual-mode).
  const phaseResultOptions = canManagePhaseResults
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
    forms,
    narrativeTypes,
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
    // The work card's ad-hoc "Adicionar fase" / "Adicionar narrativa" pickers.
    // Loaded HERE rather than in the `(detail)` layout because this page owns the
    // card, and only on an OPEN case — a terminal case is frozen (HC025), so the
    // footer never renders and the reads would be pure waste. The staff route
    // never makes them at all, which is what keeps the commission's form list and
    // narrative vocabulary off that page's payload.
    //
    // ⛔ `canManageLifecycle` joins `isOpen` since ADR 0134 D3. Both doors are
    // ROLE-LOCKED at the DB (`add_ad_hoc_narrative` gates on `app.is_staff_admin_of`;
    // `add_ad_hoc_phase` runs INVOKER under `case_phases_staff_admin_write`), so an
    // administrativo or write-grantee entering this route would refuse at the door —
    // and the pickers' data must be absent by construction, not merely unrendered.
    isOpen && canManageLifecycle
      ? listForms(access.commission.id)
      : Promise.resolve([]),
    isOpen && canManageLifecycle && narrativesOn
      ? listNarrativeTypes(access.commission.id)
      : Promise.resolve([]),
  ]);
  const adHocForms = forms
    .filter((f) => f.publishedVersionNumber != null)
    .map((f) => ({ id: f.id, title: f.title }));
  const adHocNarrativeTypes = narrativeTypes.map((t) => ({
    id: t.id,
    label: t.label,
  }));

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
      canManagePhaseResults={canManagePhaseResults}
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
      // The work card's authoring footer. Supplying these IS the opt-in — the
      // staff route passes neither, so it renders no footer and never loads them.
      adHocForms={adHocForms}
      adHocNarrativeTypes={adHocNarrativeTypes}
      caseParticipantsEnabled={caseParticipantsOn}
      organizationId={access.organization.id}
      participantRoles={participantRoles}
      participantPlatformUsers={participantPlatformUsers}
      participantRoleVocabularyHref={roleVocabularyHref}
    />
  );
}
