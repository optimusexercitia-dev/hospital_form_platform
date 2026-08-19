import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { getCorrectionRequest } from "@/lib/queries/corrections";
import { getSubmissionDetail } from "@/lib/queries/submissions";
import { resolveTreeImageUrls } from "@/lib/queries/forms";
import { SubmissionDetailView } from "@/components/dashboard/submission-detail-view";
import {
  CorrectionComparePanel,
  type CorrectionCompareSide,
} from "@/components/cases/correction-compare-panel";
import {
  CorrectionKindChip,
  CorrectionStatusChip,
} from "@/components/cases/correction-chips";
import { CorrectionDecisionCard } from "@/components/cases/correction-decision-card";
import { canDecideCorrection } from "@/components/cases/correction-labels";
import { formatCaseNumber } from "@/components/cases/format";

export const metadata: Metadata = {
  title: "Revisão da correção",
};

/**
 * The coordinator's REVIEW screen for one phase correction — the destination
 * "Colocar em revisão" routes to.
 *
 * Why it exists: the decision buttons ("Aprovar" / "Reprovar") sat on the case page
 * next to a request whose CONTENT was nowhere on screen. The only answer view
 * (`fase/[phaseId]/respostas`) renders the phase's CURRENT response, which before
 * approval is still the OLD one — so the approver could read what they were replacing
 * but never what they were approving. This screen shows both, one at a time, with the
 * {@link CorrectionComparePanel} to switch sides.
 *
 * Sibling of `fase/[phaseId]/respostas`, deliberately OUTSIDE the `(detail)` route
 * group so it keeps its own header instead of inheriting the case tab spine.
 *
 * Authority: `staff_admin` of the owning commission — the same gate as the sibling
 * answer route and as `approve_correction` / `reject_correction` themselves. RLS is
 * still the boundary (Rule 1): `getSubmissionDetail` returns `null` for anything
 * `responses_select` withholds, and both responses here are `submitted`, which is
 * exactly the arm that policy opens for a staff_admin.
 *
 * NARRATIVE corrections are not served here. A narrative's before/after is prose, its
 * superseded bodies live in `case_narrative_revisions`, and the revision history on
 * the narrative card already carries it — a response-tree renderer has nothing to
 * show. Those requests keep their existing "Colocar em revisão" behaviour.
 *
 * ⚠ `notFound()` under this segment's ancestor `loading.tsx` renders the not-found UI
 * with HTTP 200 — Next's streamed-notFound contract, by design.
 */
export default async function CorrectionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{
    org: string;
    commission: string;
    caseId: string;
    requestId: string;
  }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { org, commission, caseId, requestId } = await params;
  const { v } = await searchParams;

  // Independent reads — none depends on another's result.
  const [access, detail, request] = await Promise.all([
    getCommissionAccessByOrg(org, commission),
    getCaseDetail(caseId),
    getCorrectionRequest(requestId),
  ]);

  if (!access || access.role !== "staff_admin") notFound();
  if (!detail || detail.case.commissionId !== access.commission.id) notFound();
  // `null` also covers the `case_corrections` flag being off, and a request the
  // caller's RLS withholds. The case check defends a tampered path: a real request
  // id from ANOTHER case would otherwise render under this case's header.
  if (!request || request.caseId !== caseId) notFound();

  // Phase corrections only (see the narrative note above). A `void` request has no
  // successor to compare — approving it clears the phase, it does not replace it.
  const phase = request.casePhaseId
    ? detail.phases.find((p) => p.id === request.casePhaseId)
    : null;
  if (!phase || request.kind === "void") notFound();

  // Both sides must exist to compare. `predecessor_response_id` and
  // `draft_response_id` are both stamped by `start_correction_draft`, so a request
  // still in `requested` has neither — there is nothing to review yet, and the
  // "Colocar em revisão" button that leads here is only offered from `resubmitted`.
  if (!request.predecessorResponseId || !request.draftResponseId) notFound();

  const side: CorrectionCompareSide = v === "anterior" ? "anterior" : "corrigida";

  // BOTH are loaded, not just the selected one: the panel states each side's
  // submitter and submission time, which is half of what tells a reviewer the two
  // records apart. Reading both is also the honest audit trail — Rule 11 logs a
  // foreign-response read, and the approver did open both.
  const [previousDetail, correctedDetail] = await Promise.all([
    getSubmissionDetail(request.predecessorResponseId),
    getSubmissionDetail(request.draftResponseId),
  ]);

  // The corrected side is unreadable until the corrector resubmits it: while the
  // draft is `in_progress`, `responses_select` opens only for its creator (the
  // corrector) and staff_admin's arm requires `submitted`. That is a correct refusal,
  // not an error — so say so rather than 404-ing a request that genuinely exists.
  if (!previousDetail) notFound();

  const shown = side === "anterior" ? previousDetail : correctedDetail;
  const heading = phase.title || `Fase ${phase.position}`;
  const backHref = commissionHref(org, commission, "manage", "cases", caseId);

  const imageUrls = shown ? await resolveTreeImageUrls(shown.tree) : {};

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {formatCaseNumber(detail.case.caseNumber)}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl text-balance">{heading}</h1>
          <CorrectionKindChip kind={request.kind} />
          <CorrectionStatusChip status={request.status} />
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          <span className="font-medium text-foreground">Motivo: </span>
          {request.reason}
        </p>
      </header>

      {/* The picker leads on narrow screens (it is the control that changes what is
          below it) and moves to a sticky rail from `lg` up, so it stays reachable
          while the reviewer scrolls a long form. */}
      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
          {/* The decision leads the rail: it is why the reviewer is on this screen,
              and the picker below it is the means. Rendered only while the request
              actually awaits a decision — `canDecideCorrection` is the same
              predicate the case page's list uses, so the two surfaces offer the
              buttons in exactly the same states. On any other status the header's
              chip already says where the request stands, and the door would refuse
              anyway (Rule 1: it is the boundary, this is only the affordance). */}
          {canDecideCorrection(request) && (
            <CorrectionDecisionCard
              request={request}
              targetLabel={heading}
              viewerId={access.context.userId}
              caseHref={backHref}
            />
          )}

          <CorrectionComparePanel
            org={org}
            slug={commission}
            caseId={caseId}
            requestId={requestId}
            current={side}
            previous={{
              submittedAt: previousDetail.submittedAt,
              memberName: previousDetail.memberName,
            }}
            corrected={{
              submittedAt: correctedDetail?.submittedAt ?? null,
              memberName: correctedDetail?.memberName ?? null,
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {shown ? (
            <SubmissionDetailView
              tree={shown.tree}
              answersByItemId={shown.answersByItemId}
              answersByKey={shown.answersByKey}
              observationsByItemId={shown.observationsByItemId}
              otherTextByItemId={shown.otherTextByItemId}
              matrixCellsByItemId={shown.matrixCellsByItemId}
              riskMatrixByItemId={shown.riskMatrixByItemId}
              referencesByItemId={shown.referencesByItemId}
              instances={shown.instances}
              signoffs={shown.signoffs}
              imageUrls={imageUrls}
            />
          ) : (
            <p
              role="status"
              className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center text-sm text-muted-foreground text-pretty"
            >
              A correção ainda não foi reenviada pelo corretor, então não há uma
              versão corrigida para exibir. Consulte o envio anterior ao lado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
