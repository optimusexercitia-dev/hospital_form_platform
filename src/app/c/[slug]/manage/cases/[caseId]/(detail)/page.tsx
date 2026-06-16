import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { CasePhaseList } from "@/components/cases/case-phase-list";
import { CaseOutcomeSelector } from "@/components/cases/case-outcome-selector";
import { CaseDetailMotion } from "@/components/cases/case-detail-motion";
import { CaseDocumentsPanel } from "@/components/cases/case-documents-panel";
import { CaseEventsTimeline } from "@/components/cases/case-events-timeline";
import { CaseTagsPanel } from "@/components/cases/case-tags-panel";
import { CaseActionItemsPanel } from "@/components/cases/case-action-items-panel";
import { listCaseDocuments, listCaseEvents } from "@/lib/queries/case-documents";
import { listCaseTags, listCaseTagsForCase } from "@/lib/queries/case-tags";
import { listCaseActionItems } from "@/lib/queries/case-action-items";
import { listCaseInterviews, interviewsEnabled } from "@/lib/queries/interviews";
import { InterviewsPanel } from "@/components/interviews/interviews-panel";

export const metadata: Metadata = {
  title: "Detalhe do caso",
};

/**
 * The "Detalhes" tab body (default child of the `(detail)` layout): the case's
 * two-column region (phases · action items · events narrative + the tags /
 * documents / interviews rail) and the outcome card. The case header spine + tab
 * bar now live in the layout, so this page renders only the tab CONTENT.
 *
 * Coordinator-gated + commission-scoped here too (defense in depth; the layout
 * gates identically and both reads are React `cache()`-memoized, so the repeat is
 * free). Backed by the SECURITY DEFINER `get_case_detail`: `responseId` is set
 * only for SUBMITTED phases, which the coordinator deep-links to a read-only view.
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

  // Members back the assignee pickers. The Cases-Extras panels
  // (documents/events/tags/action items) load alongside. The Interviews panel
  // (Phase 11) is feature-flagged; when off we skip the read and render nothing
  // for it (the route 404s on its own detail page too).
  const interviewsOn = await interviewsEnabled();
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
  const assignees = sortMembers(members).map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));

  const c = detail.case;
  const isOpen = !isTerminalCaseStatus(c.status);
  const offersOutcomes = detail.offeredOutcomes.length > 0;
  // Phases for the action-item "origin phase" picker (id + label only).
  const phaseOptions = [...detail.phases]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ id: p.id, label: p.title || `Fase ${p.position}` }));

  return (
    <CaseDetailMotion className="flex w-full flex-col gap-8">
      {/* Two-column region: flex-col (mobile) → 2-col grid (lg). `contents` on the
          column wrappers lets mobile interleave the columns via `order-*` while
          desktop packs each column independently.

          The R1/R3/R4 panels are NOT part of the case workflow invariant (no
          state-machine guard): a coordinator may attach closing minutes, tag, or
          record follow-ups even on a concluded case. This page is already
          staff_admin-gated, so management is always available here. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:items-start">
        {/* LEFT — case narrative */}
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <div data-rise className="order-1 lg:order-none">
            <CasePhaseList
              slug={slug}
              detail={detail}
              assignees={assignees}
              isOpen={isOpen}
            />
          </div>
          <div data-rise className="order-2 lg:order-none">
            <CaseActionItemsPanel
              caseId={c.id}
              items={actionItems}
              assignees={assignees}
              phases={phaseOptions}
            />
          </div>
          <div data-rise className="order-6 lg:order-none">
            <CaseEventsTimeline caseId={c.id} events={events} />
          </div>
        </div>

        {/* RAIL — reference material (compact variant) */}
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <div data-rise className="order-3 lg:order-none">
            <CaseTagsPanel
              slug={slug}
              caseId={c.id}
              assigned={caseTags}
              vocabulary={tags}
              variant="rail"
            />
          </div>
          <div data-rise className="order-4 lg:order-none">
            <CaseDocumentsPanel
              caseId={c.id}
              documents={documents}
              variant="rail"
            />
          </div>
          {interviewsOn && (
            <div data-rise className="order-5 lg:order-none">
              <InterviewsPanel
                slug={slug}
                caseId={c.id}
                interviews={interviews}
                phases={phaseOptions}
                canCreate
                variant="rail"
              />
            </div>
          )}
        </div>
      </div>

      {isOpen && offersOutcomes && (
        <div data-rise>
          <CaseOutcomeSelector
            caseId={c.id}
            offeredOutcomes={detail.offeredOutcomes}
            current={detail.outcome}
          />
        </div>
      )}
    </CaseDetailMotion>
  );
}
