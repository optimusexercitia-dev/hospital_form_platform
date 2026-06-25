import { commissionHref } from "@/lib/routing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { listForms } from "@/lib/queries/forms";
import {
  CaseStatusBadge,
  CaseStatusBadgeFixed,
} from "@/components/cases/case-status-badge";
import { CaseLifecycleActions } from "@/components/cases/case-lifecycle-actions";
import { CaseAccessButton } from "@/components/cases/case-access-button";
import { CaseTabs } from "@/components/cases/case-tabs";
import { formatCaseNumber, formatDate } from "@/components/cases/format";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { caseAccessEnabled } from "@/lib/case-access/actions";

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
 * case from another commission, gets `notFound()`. `getCommissionAccessByOrg` and
 * `getCaseDetail` are React `cache()`-wrapped, so this guard/fetch and the child
 * page's identical guard/fetch collapse to one call per request (no double fetch).
 */
export default async function CaseDetailLayout({
  params,
  children,
}: {
  params: Promise<{ org: string; commission: string; caseId: string }>;
  children: React.ReactNode;
}) {
  const { org, commission, caseId } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  const c = detail.case;
  const isOpen = !isTerminalCaseStatus(c.status);

  // The commission roster + the `case_access` flag are needed UNCONDITIONALLY: the
  // "Acesso ao caso" button (Case Access Control, ADR 0033) shows on terminal cases
  // too (read grants are allowed there, D6), so it can't depend on `isOpen`. Loaded
  // once here in the spine and reused by both the access roster and (when open) the
  // lifecycle-actions assignee picker.
  const [members, accessEnabled] = await Promise.all([
    listMembers(access.commission.id),
    caseAccessEnabled(),
  ]);
  const sortedMembers = sortMembers(members);

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
    const [forms, narrativesOn] = await Promise.all([
      listForms(access.commission.id),
      narrativesEnabled(),
    ]);
    assignees = sortedMembers.map((m) => ({
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
          href={commissionHref(org, commission, "manage", "cases")}
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

          {(accessEnabled || isOpen) && (
            <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
              {/* Coordinator access roster (ADR 0033). Rendered INDEPENDENTLY of the
                  lifecycle actions (open-only) so it still shows — alone — on a
                  terminal case, where read grants remain allowed (D6). */}
              {accessEnabled && (
                <CaseAccessButton
                  caseId={c.id}
                  members={sortedMembers}
                  detail={detail}
                  caseOpen={isOpen}
                />
              )}
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
          )}
        </div>

        <CaseTabs org={org} slug={slug} caseId={caseId} />
      </header>

      {children}
    </div>
  );
}
