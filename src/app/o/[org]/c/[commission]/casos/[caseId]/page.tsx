import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg, canInCommission } from "@/lib/queries/session";
import {
  getCaseDetail,
  casePatientEnabled,
  listCaseCustomFieldValues,
} from "@/lib/queries/cases";
import type { CaseViewerCapabilities, MyCaseRole } from "@/lib/queries/cases";
import { caseCustomFieldsEnabled } from "@/lib/queries/feature-flags";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listDepartmentsForHospital } from "@/lib/hospitals/departments";
import type { Department } from "@/lib/hospitals/departments";
import {
  listPhaseResults,
  phaseResultsEnabled,
} from "@/lib/queries/phase-results";
import { toResolvedPhaseResultOptions } from "@/components/cases/phase-result-options";
import { listMembers } from "@/lib/queries/members";
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

export const metadata: Metadata = {
  title: "Caso",
};

/** Derive the viewer's role chip from their capability descriptor (ADR 0033 D7). */
function roleFromCapabilities(caps: CaseViewerCapabilities): MyCaseRole {
  if (caps.canManageLifecycle) return "coordinator";
  if (caps.canWriteContent) return "collaborator";
  return "viewer";
}

/**
 * The STAFF full-case view (Case Access Control increment, ADR 0033 D7): the SAME
 * capability-gated {@link CaseDetailView} the coordinator route mounts, opened by any
 * member who can read the case — a phase/narrative assignee (attribution-derived
 * read) or a `case_access` grantee. The view's affordances follow
 * `detail.viewerCapabilities`: a read grantee sees a pure-read case; a write grantee
 * ("collaborator") can edit un-attributed narratives + action items / docs / tags /
 * events; lifecycle stays coordinator-only.
 *
 * Security is RLS (Rule 1): `get_case_detail` returns null when the caller may not
 * read the case (BE-4 broadens its gate `is_staff_admin_of` → `can_read_case`), so a
 * member with no attribution + no grant gets `notFound()` — the restrictive boundary,
 * not UI hiding. Flag-gated: the route 404s while `case_access` is OFF (coordinator
 * detail stays at `/manage/...`). Opening as a non-coordinator emits a `case.opened`
 * audit row server-side (BE-5).
 */
export default async function StaffCaseDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; caseId: string }>;
}) {
  const { org, commission, caseId } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) notFound();

  // Flag OFF → this staff surface does not exist yet.
  if (!(await caseAccessEnabled())) notFound();

  // RLS is the boundary: null = not readable by the caller (or absent) → 404.
  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  const caps = detail.viewerCapabilities;
  const myRole = roleFromCapabilities(caps);

  const [
    interviewsOn,
    patientSafetyOn,
    casePatientOn,
    narrativesOn,
    phaseResultsOn,
    meetingsOn,
    actionItemsOn,
    caseCustomFieldsOn,
  ] = await Promise.all([
    interviewsEnabled(),
    patientSafetyEnabled(),
    casePatientEnabled(),
    narrativesEnabled(),
    phaseResultsEnabled(),
    meetingsEnabled(),
    actionItemsEnabled(),
    caseCustomFieldsEnabled(),
  ]);

  // Post-conclusion result correction (phase-results feature; task #10) is
  // staff_admin-only — a plain staff/collaborator/read-grantee at this shared staff
  // surface never sees the affordance (the RPC is staff_admin-gated by RLS too).
  const canManagePhaseResults =
    phaseResultsOn && (access.role === "staff_admin");
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
  const referralsModule = await buildCaseReferralsModule(detail, documents);

  // Case Correction Lifecycle surface data (ADR 0085; empty when the flag is off).
  const correctionsData = await buildCaseCorrectionsData(detail);

  // Edit-meta affordance (ADR 0061): a `create_cases` Administrativo (or a coordinator)
  // may edit an OPEN case's label + department here. Load the hospital's departments
  // only when the affordance can actually show (create_cases holder + case open).
  const canEditMeta = canInCommission(access, "create_cases");
  const canEditMetaNow = canEditMeta && !isTerminalCaseStatus(detail.case.status);
  const departments: Department[] =
    canEditMetaNow && access.commission.hospitalId
      ? await listDepartmentsForHospital(access.commission.hospitalId)
      : [];

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
      caseAccessEnabled
      viewerId={access.context.userId}
      myRole={myRole}
      withHeader
      backHref={commissionHref(org, commission, "meus-casos")}
      referralsModule={referralsModule}
      canManagePhaseResults={canManagePhaseResults}
      phaseResultOptions={phaseResultOptions}
      actionItemsEnabled={actionItemsOn}
      canAssignPhases={canInCommission(access, "assign_case_phases")}
      canEditMeta={canEditMeta}
      departments={departments}
      caseCustomFieldsEnabled={caseCustomFieldsOn}
      customFields={customFields}
      correctionsEnabled={correctionsData.enabled}
      corrections={correctionsData.requests}
      narrativeRevisions={correctionsData.narrativeRevisions}
    />
  );
}
