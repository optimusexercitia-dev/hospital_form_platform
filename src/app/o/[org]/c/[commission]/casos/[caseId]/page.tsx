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
import { listMembers, listLinkableOrgUsers } from "@/lib/queries/members";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import {
  getParticipantRoleVocabularyHref,
  listCaseParticipantRoles,
} from "@/lib/queries/participants";
import { featureEnabled } from "@/lib/queries/feature-flags";
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
import {
  buildCaseReferralsModule,
  buildCaseReferralsModuleReadOnly,
} from "@/components/referrals/build-case-referrals-module";
import { qualidadeHref } from "@/lib/routing";
import { buildCaseCorrectionsData } from "@/components/cases/build-case-corrections";
import { getCaseTemplateProvenance } from "@/lib/queries/process-templates";

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
  if (!access || (access.role === null && !access.isQualityViewer)) notFound();

  // ADR 0100 D10 — the oversight reader. `role` stays `null` (never mapped to a
  // member role, or every `role === 'staff_admin'` write gate would open), so
  // this flag is what distinguishes them from the platform_admin the gate above
  // still refuses.
  const isOversight = access.isQualityViewer;

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
    caseParticipantsOn,
  ] = await Promise.all([
    interviewsEnabled(),
    patientSafetyEnabled(),
    casePatientEnabled(),
    narrativesEnabled(),
    phaseResultsEnabled(),
    meetingsEnabled(),
    actionItemsEnabled(),
    caseCustomFieldsEnabled(),
    featureEnabled("case_participants"),
  ]);

  // ETH·E4 (ADR 0108) — the participants roster's org-scoped surfaces (search,
  // role vocabulary, platform-user pick). Skipped entirely while the flag is
  // off or for the oversight reader (D7: roster affordances are member content,
  // not the read-only office view). `organizationId` and `caseTypeId` come
  // from data already loaded above (`access`, `detail`) — no extra case read.
  const [participantRoles, participantPlatformUsers, roleVocabularyHref] =
    caseParticipantsOn && !isOversight
      ? await Promise.all([
          listCaseParticipantRoles(
            access.organization.id,
            detail.case.caseTypeId,
          ),
          // ⚠ NOT `listAddableMembers` — that RPC excludes people already in this
          // commission, i.e. exactly the members most likely to be the respondent.
          // The dead end pushed coordinators to `no_account`, which makes the case
          // exclusion vacuously satisfied (ADR 0108 D6). Org-scoped, RLS-scoped.
          listLinkableOrgUsers(access.organization.id),
          // The remedy link for the dialog's "no role accepts this type" empty
          // state — `null` unless this viewer can actually open the vocabulary
          // admin (PO ruling 2026-08-11; both gates re-checked in the helper).
          getParticipantRoleVocabularyHref(org),
        ])
      : [[], [], null];

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
    templateProvenance,
  ] = await Promise.all([
    listMembers(access.commission.id),
    listCaseDocuments(caseId),
    listCaseEvents(caseId),
    listCaseTags(access.commission.id),
    listCaseTagsForCase(caseId),
    listCaseActionItems(caseId),
    // ADR 0100 D4 (lead ruling on Q4) — interviews and meetings are DELIBERATION,
    // which the oversight arm deliberately does not confer. Skipped entirely
    // rather than fetched-and-hidden: a card reading "Nenhuma reunião" would be a
    // false statement to the reviewer, and a count without content would leak the
    // very volume D4 withholds. Omission asserts nothing in either direction.
    interviewsOn && !isOversight
      ? listCaseInterviews(caseId)
      : Promise.resolve([]),
    meetingsOn && !isOversight ? listCaseMeetings(caseId) : Promise.resolve([]),
    caseCustomFieldsOn
      ? listCaseCustomFieldValues(caseId)
      : Promise.resolve([]),
    // ADR 0096 D3 — which template VERSION this case ran under. Staff are the
    // people FILLING the phases, so they are the ones most exposed to "my case is
    // running v2 while the process moved to v4". `null` = processless, a supported
    // answer the component renders as "Sem processo".
    getCaseTemplateProvenance(caseId),
  ]);

  // The outbound-referrals card module (Phase 22; null when the flag is off). Built
  // from data already loaded — no inline supabase-js (Rule 9; UI-prop assembly).
  //
  // ADR 0100 (lead ruling on Q3) — SPLIT for the oversight reader: the referral
  // LIST is case content under D3, but the wizard FUEL is not. The read-only
  // variant drops `targetCommissions` + `technicalDirectionHospitalId` by
  // construction. (Passing `hospitalId: null` to the main assembler would have
  // suppressed only the second — `listReferralTargetCommissions` is unconditional
  // there, so the obvious one-line version does half the job.)
  const referralsModule = isOversight
    ? await buildCaseReferralsModuleReadOnly(detail, documents)
    : await buildCaseReferralsModule(
        detail,
        documents,
        access.commission.hospitalId,
      );

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
      events={events}
      tags={tags}
      caseTags={caseTags}
      actionItems={actionItems}
      interviews={interviews}
      interviewsEnabled={interviewsOn && !isOversight}
      meetings={meetings}
      meetingsEnabled={meetingsOn && !isOversight}
      // Host-side half of the D7 read-only contract. `CaseDetailView` suppresses
      // these again from `viewerKind`, deliberately: a future host that forgets a
      // prop still cannot open a write path, and a future caller that forgets
      // `viewerKind` still cannot either. Neither side alone is load-bearing.
      patientSafetyEnabled={patientSafetyOn && !isOversight}
      casePatientEnabled={casePatientOn && !isOversight}
      narrativesEnabled={narrativesOn}
      caseAccessEnabled
      viewerId={access.context.userId}
      myRole={myRole}
      withHeader
      // This route is a READING surface. A coordinator who lands here (from Meus
      // Casos, a notification, an assignee link) sees the case the way a committee
      // member does; every management affordance is one click away behind the
      // header's "Gerenciar caso" link, which is gated on the UN-narrowed
      // capability so the narrowing can never strand them.
      //
      // Not a security control (Rule 1) — the same person keeps the same DB rights,
      // and every door still decides for itself. It only stops this page from
      // OFFERING two different jobs at once.
      managementElsewhere
      viewerKind={isOversight ? "oversight" : "member"}
      backHref={
        isOversight
          ? qualidadeHref(org)
          : commissionHref(org, commission, "meus-casos")
      }
      backLabel={isOversight ? "Escritório da Qualidade" : "Meus Casos"}
      templateProvenance={templateProvenance}
      referralsModule={referralsModule}
      canManagePhaseResults={canManagePhaseResults}
      phaseResultOptions={phaseResultOptions}
      actionItemsEnabled={actionItemsOn}
      canAssignPhases={canInCommission(access, "assign_case_phases")}
      canEditMeta={canEditMeta && !isOversight}
      departments={departments}
      caseCustomFieldsEnabled={caseCustomFieldsOn}
      customFields={customFields}
      correctionsEnabled={correctionsData.enabled && !isOversight}
      corrections={correctionsData.requests}
      narrativeRevisions={correctionsData.narrativeRevisions}
      caseParticipantsEnabled={caseParticipantsOn && !isOversight}
      organizationId={access.organization.id}
      participantRoles={participantRoles}
      participantPlatformUsers={participantPlatformUsers}
      participantRoleVocabularyHref={roleVocabularyHref}
    />
  );
}
