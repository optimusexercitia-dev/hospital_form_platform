import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
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
}: {
  params: Promise<{ slug: string; caseId: string }>;
}) {
  const { slug, caseId } = await params;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  const [interviewsOn, patientSafetyOn, narrativesOn, caseAccessOn] =
    await Promise.all([
      interviewsEnabled(),
      patientSafetyEnabled(),
      narrativesEnabled(),
      caseAccessEnabled(),
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
      caseAccessEnabled={caseAccessOn}
      viewerId={access.context.userId}
      myRole="coordinator"
      withHeader={false}
      backHref={`/c/${slug}/manage/cases`}
      referralsModule={referralsModule}
    />
  );
}
