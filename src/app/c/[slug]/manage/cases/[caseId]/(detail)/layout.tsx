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
import { CaseLifecycleActions } from "@/components/cases/case-lifecycle-actions";
import { CaseTabs } from "@/components/cases/case-tabs";
import { formatCaseNumber, formatDate } from "@/components/cases/format";
import { narrativesEnabled } from "@/lib/case-narratives/actions";

/**
 * Shared shell for a case's two tabs — **Detalhes** (default child) and **Linha
 * do tempo** (`timeline/`). Scoped to the `(detail)` ROUTE GROUP so it wraps only
 * those two pages; the deeper `fase/[phaseId]/respostas` and
 * `interviews/[interviewId]` routes are siblings OUTSIDE the group and keep their
 * own headers (a bare `[caseId]/layout.tsx` would double-header them).
 *
 * Owns the case **header spine** (back-link, case number, status/outcome badges,
 * created/closed line, lifecycle actions when open) + the **tab bar**, so both
 * tabs share one identity and the body pages render only their tab content.
 *
 * Coordinator-gated (mirrors the board + the old page): a non-coordinator, or a
 * case from another commission, gets `notFound()`. `getCommissionAccess` and
 * `getCaseDetail` are React `cache()`-wrapped, so this guard/fetch and the child
 * page's identical guard/fetch collapse to one call per request (no double fetch).
 */
export default async function CaseDetailLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string; caseId: string }>;
  children: React.ReactNode;
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

  const c = detail.case;
  const isOpen = !isTerminalCaseStatus(c.status);

  // The lifecycle-actions menu (open cases only) needs the assignee + publishable-
  // form + phase pickers. These derive from cheap commission-scoped reads; loaded
  // here in the spine so the action menu is available from BOTH tabs.
  let assignees: { userId: string; name: string }[] = [];
  let publishableForms: { id: string; title: string }[] = [];
  // Advisory soft-close warning (ADR 0032, decision 7): the labels of EXPECTED
  // narratives left empty. Non-blocking — surfaced in the conclude dialog so the
  // coordinator notices, but `close_case` is untouched. Flag-gated.
  let expectedEmptyNarrativeLabels: string[] = [];
  if (isOpen) {
    const [members, forms, narrativesOn] = await Promise.all([
      listMembers(access.commission.id),
      listForms(access.commission.id),
      narrativesEnabled(),
    ]);
    assignees = sortMembers(members).map((m) => ({
      userId: m.userId,
      name: m.fullName ?? m.email ?? "Membro",
    }));
    publishableForms = forms
      .filter((f) => f.publishedVersionNumber != null)
      .map((f) => ({ id: f.id, title: f.title }));
    if (narrativesOn) {
      expectedEmptyNarrativeLabels = detail.narratives
        .filter((n) => n.isExpected && (n.bodyMd ?? "").trim().length === 0)
        .map((n) => n.title || n.typeLabel);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
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
              expectedEmptyNarrativeLabels={expectedEmptyNarrativeLabels}
            />
          )}
        </div>

        <CaseTabs slug={slug} caseId={caseId} />
      </header>

      {children}
    </div>
  );
}
