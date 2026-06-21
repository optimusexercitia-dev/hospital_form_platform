import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import type { CaseViewerCapabilities, MyCaseRole } from "@/lib/queries/cases";
import { listMembers } from "@/lib/queries/members";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { listCaseDocuments, listCaseEvents } from "@/lib/queries/case-documents";
import { listCaseTags, listCaseTagsForCase } from "@/lib/queries/case-tags";
import { listCaseActionItems } from "@/lib/queries/case-action-items";
import { listCaseInterviews, interviewsEnabled } from "@/lib/queries/interviews";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { buildCaseReferralsModule } from "@/components/referrals/build-case-referrals-module";

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
  params: Promise<{ slug: string; caseId: string }>;
}) {
  const { slug, caseId } = await params;
  const access = await getCommissionAccess(slug);
  if (!access) notFound();

  // Flag OFF → this staff surface does not exist yet.
  if (!(await caseAccessEnabled())) notFound();

  // RLS is the boundary: null = not readable by the caller (or absent) → 404.
  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  const caps = detail.viewerCapabilities;
  const myRole = roleFromCapabilities(caps);

  const [interviewsOn, patientSafetyOn, narrativesOn] = await Promise.all([
    interviewsEnabled(),
    patientSafetyEnabled(),
    narrativesEnabled(),
  ]);
  const [members, documents, events, tags, caseTags, actionItems, interviews] =
    await Promise.all([
      listMembers(access.commission.id),
      listCaseDocuments(caseId),
      listCaseEvents(caseId),
      listCaseTags(access.commission.id),
      listCaseTagsForCase(caseId),
      listCaseActionItems(caseId),
      interviewsOn ? listCaseInterviews(caseId) : Promise.resolve([]),
    ]);

  // The outbound-referrals card module (Phase 22; null when the flag is off). Built
  // from data already loaded — no inline supabase-js (Rule 9; UI-prop assembly).
  const referralsModule = await buildCaseReferralsModule(detail, documents);

  return (
    <CaseDetailView
      slug={slug}
      detail={detail}
      members={members}
      documents={documents}
      events={events}
      tags={tags}
      caseTags={caseTags}
      actionItems={actionItems}
      interviews={interviews}
      interviewsEnabled={interviewsOn}
      patientSafetyEnabled={patientSafetyOn}
      narrativesEnabled={narrativesOn}
      caseAccessEnabled
      viewerId={access.context.userId}
      myRole={myRole}
      withHeader
      backHref={`/c/${slug}/meus-casos`}
      referralsModule={referralsModule}
    />
  );
}
