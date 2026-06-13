import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { listForms } from "@/lib/queries/forms";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { CasePhaseList } from "@/components/cases/case-phase-list";
import { CaseLifecycleActions } from "@/components/cases/case-lifecycle-actions";
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
  // (published-only — an ad-hoc phase pins a published version, P0017).
  const [members, forms] = await Promise.all([
    listMembers(access.commission.id),
    listForms(access.commission.id),
  ]);
  const assignees = sortMembers(members).map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));
  const publishableForms = forms
    .filter((f) => f.publishedVersionNumber != null)
    .map((f) => ({ id: f.id, title: f.title }));

  const c = detail.case;
  const isOpen = c.status === "aberto";

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
              <CaseStatusBadge status={c.status} />
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
              forms={publishableForms}
              phases={detail.phases}
              assignees={assignees}
            />
          )}
        </div>
      </header>

      <CasePhaseList
        slug={slug}
        detail={detail}
        assignees={assignees}
        isOpen={isOpen}
      />
    </div>
  );
}
