import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { listForms } from "@/lib/queries/forms";
import {
  CaseStatusBadge,
  CaseStatusBadgeFixed,
} from "@/components/cases/case-status-badge";
import { CasePhaseList } from "@/components/cases/case-phase-list";
import { CaseLifecycleActions } from "@/components/cases/case-lifecycle-actions";
import { CaseOutcomeSelector } from "@/components/cases/case-outcome-selector";
import { CaseDocumentsPanel } from "@/components/cases/case-documents-panel";
import { CaseEventsTimeline } from "@/components/cases/case-events-timeline";
import { CaseTagsPanel } from "@/components/cases/case-tags-panel";
import { CaseActionItemsPanel } from "@/components/cases/case-action-items-panel";
import { listCaseDocuments, listCaseEvents } from "@/lib/queries/case-documents";
import { listCaseTags, listCaseTagsForCase } from "@/lib/queries/case-tags";
import { listCaseActionItems } from "@/lib/queries/case-action-items";
import { formatCaseNumber, formatDate } from "@/components/cases/format";

export const metadata: Metadata = {
  title: "Detalhe do caso",
};

/**
 * Per-case detail (coordinator area): the case header + every phase, with the
 * coordinator's actions (assign + activate, skip, reassign, add ad-hoc phase,
 * close / cancel). Backed by the SECURITY DEFINER `get_case_detail`
 * (`is_staff_admin_of`-gated): `responseId`/`submittedAt` are populated ONLY for
 * SUBMITTED phases, which the coordinator deep-links to a read-only answer view.
 *
 * Coordinator-gated here too (mirrors the board): a non-coordinator gets
 * `notFound()`. The case must belong to this commission (defends a tampered id).
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

  // Members back the assignee pickers; forms back the ad-hoc phase picker
  // (published-only — an ad-hoc phase pins a published version, P0017). The
  // Cases-Extras panels (documents/events/tags/action items) load alongside. The
  // case status is now a FIXED auto-computed enum (no per-commission defs). Reads
  // of the dark-flagged R1/R3/R4 surfaces return [] until their write side is
  // enabled.
  const [members, forms, documents, events, tags, caseTags, actionItems] =
    await Promise.all([
      listMembers(access.commission.id),
      listForms(access.commission.id),
      listCaseDocuments(caseId),
      listCaseEvents(caseId),
      listCaseTags(access.commission.id),
      listCaseTagsForCase(caseId),
      listCaseActionItems(caseId),
    ]);
  const assignees = sortMembers(members).map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));
  const publishableForms = forms
    .filter((f) => f.publishedVersionNumber != null)
    .map((f) => ({ id: f.id, title: f.title }));

  const c = detail.case;
  const isOpen = !isTerminalCaseStatus(c.status);
  // Phases for the action-item "origin phase" picker (id + label only).
  const phaseOptions = [...detail.phases]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ id: p.id, label: p.title || `Fase ${p.position}` }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={`/c/${slug}/manage/cases`}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Casos
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl text-balance">
                {formatCaseNumber(c.caseNumber)}
              </h1>
              <CaseStatusBadgeFixed status={c.status} />
              {detail.outcome && (
                <CaseStatusBadge
                  label={detail.outcome.label}
                  colorToken={detail.outcome.colorToken}
                />
              )}
            </div>
            {c.label && (
              <p className="max-w-prose text-muted-foreground text-pretty">
                {c.label}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Criado em {formatDate(c.createdAt)}
              {c.closedAt ? ` · Encerrado em ${formatDate(c.closedAt)}` : ""}
            </p>
          </div>

          {isOpen && (
            <CaseLifecycleActions
              caseId={c.id}
              offeredOutcomes={detail.offeredOutcomes}
              currentOutcomeId={c.outcomeId}
              forms={publishableForms}
              phases={detail.phases}
              assignees={assignees}
            />
          )}
        </div>
      </header>

      {isOpen && (
        <CaseOutcomeSelector
          caseId={c.id}
          offeredOutcomes={detail.offeredOutcomes}
          current={detail.outcome}
        />
      )}

      <CasePhaseList
        slug={slug}
        detail={detail}
        assignees={assignees}
        isOpen={isOpen}
      />

      {/* The R1/R3/R4 panels are NOT part of the case workflow invariant (no
          state-machine guard): a coordinator may attach closing minutes, tag, or
          record follow-ups even on a concluded case. This page is already
          staff_admin-gated, so management is always available here. */}
      <CaseActionItemsPanel
        caseId={c.id}
        items={actionItems}
        assignees={assignees}
        phases={phaseOptions}
      />

      <CaseTagsPanel
        slug={slug}
        caseId={c.id}
        assigned={caseTags}
        vocabulary={tags}
      />

      <CaseDocumentsPanel caseId={c.id} documents={documents} />

      <CaseEventsTimeline caseId={c.id} events={events} />
    </div>
  );
}
