import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getCaseDetail,
  canOpenCaseManagement,
  casePatientEnabled,
  listCaseCustomFieldValues,
} from "@/lib/queries/cases";
import type { CaseViewerCapabilities, MyCaseRole } from "@/lib/queries/cases";
import { caseCustomFieldsEnabled } from "@/lib/queries/feature-flags";
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
 * {@link CaseDetailView} the manage route mounts, opened by any member who can read
 * the case — a phase/narrative assignee (attribution-derived read) or a
 * `case_access` grantee.
 *
 * ⭐ **THIS IS A READING SURFACE, and since ADR 0134 D1 that is literally true.**
 * What renders here is the case as the committee sees it, PLUS the viewer's own
 * name-attributed work (my phase, my narrative, my action item — the assignee tests
 * precede the capability tests, Q14 / CA-002). Every CASE-WIDE capability, whoever
 * holds it and however they hold it, is offered on `/manage/cases/[caseId]` behind
 * the header's single "Gerenciar caso" button. Two things enforce that jointly, and
 * neither is load-bearing alone: `managementElsewhere` zeroes `canManageLifecycle`
 * AND `canWriteContent` inside the view (D2), and this page stops resolving the
 * three role/capability-implied props that used to bypass that narrowing.
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
    meetingsOn,
    actionItemsOn,
    caseCustomFieldsOn,
    caseParticipantsOn,
  ] = await Promise.all([
    interviewsEnabled(),
    patientSafetyEnabled(),
    casePatientEnabled(),
    narrativesEnabled(),
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

  // ⛔ ADR 0134 D2 — THREE PROPS THIS PAGE NO LONGER PASSES, and the deletion is the
  // change, not an oversight: `canManagePhaseResults`, `canAssignPhases` and
  // `canEditMeta` were resolved here from the viewer's ROLE / commission
  // CAPABILITIES, which made them bypass `managementElsewhere`'s narrowing BY
  // CONSTRUCTION. They are case-wide work, so under D1 they belong on
  // `/manage/cases/[caseId]` — which D3 now opens to exactly the viewers who used to
  // need them here. Their FUEL (`listPhaseResults`, `listDepartmentsForHospital`)
  // goes with them, so this reading surface neither renders nor loads them.
  //
  // ⚠ Nothing identity-attributed is touched. The assignee tests run BEFORE the
  // capability tests (ADR 0033 Q14 / CA-002), so my phase, my narrative and my
  // action item stay writable here — that is the whole point of the surface.

  // ADR 0134 D3/D4 — the escape hatch. ONE predicate, shared verbatim with the
  // manage route's entry gate, so this button can never offer a link that 404s.
  // Fed `detail.viewerCapabilities` (the RAW, un-narrowed envelope) both to spend
  // the per-case arm without a second round trip and because gating the exit on the
  // narrowed value would strand the very viewers the narrowing applies to.
  const canOpenManagement = await canOpenCaseManagement(
    access,
    caseId,
    detail.viewerCapabilities,
  );

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
      // This route is a READING surface. A coordinator OR a write-grantee who lands
      // here (from Meus Casos, a notification, an assignee link) sees the case the
      // way a committee member does; every case-wide affordance is one click away
      // behind the header's "Gerenciar caso" link, which is gated on the UN-narrowed
      // predicate so the narrowing can never strand them.
      //
      // Not a security control (Rule 1) — the same person keeps the same DB rights,
      // and every door still decides for itself. It only stops this page from
      // OFFERING two different jobs at once.
      managementElsewhere
      canOpenManagement={canOpenManagement}
      viewerKind={isOversight ? "oversight" : "member"}
      backHref={
        isOversight
          ? qualidadeHref(org)
          : commissionHref(org, commission, "meus-casos")
      }
      backLabel={isOversight ? "Escritório da Qualidade" : "Meus Casos"}
      templateProvenance={templateProvenance}
      referralsModule={referralsModule}
      actionItemsEnabled={actionItemsOn}
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
