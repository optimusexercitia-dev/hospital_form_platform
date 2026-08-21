import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail, canOpenCaseManagement } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { NarrativeEditor } from "@/components/cases/narrative-editor";
import { canEditNarrative } from "@/components/cases/narrative-access";
import { formatCaseNumber } from "@/components/cases/format";

export const metadata: Metadata = {
  title: "Narrativa",
};

/**
 * The MANAGEMENT-side focused narrative editor — the mirror of
 * `casos/[caseId]/narrativa/[narrativeId]`, and the destination the case-wide
 * narrative arms RELOCATED to under ADR 0134 D1/D2.
 *
 * ⭐ **Why this route exists.** Narrowing the `/casos` narrative editor to
 * name-attributed authoring (D2) removed a coordinator's and a write-grantee's
 * ability to author on THAT url. Without a management-side twin, a deep link into
 * a narrative — from a notification, a bookmark, a shared url — would leave them
 * on a read-only page with no way forward, and the increment would have DELETED an
 * authority instead of MOVING it. The pair is the point: `/casos` shows the
 * narrative as the committee sees it, `/manage/...` is where case-wide authorship
 * happens.
 *
 * ⚠ Capabilities are the RAW envelope here, deliberately — this host applies no
 * narrowing. `canEditNarrative` then mirrors `app.can_write_case_narrative`
 * exactly: coordinator → any narrative · assignee → their own · write-grantee →
 * un-attributed only. An appointed administrativo holding no write grant and no
 * assignment therefore reads but does not author, which is correct — ADR 0134 D6
 * gives them READ, and "management ≠ authorship" is the ADR's own phrase.
 *
 * **Entry gate** — the same single-point predicate as the `(detail)` route group:
 * `getCaseDetail` first (RLS decides readability, and it is what stops an
 * appointed administrativo on a case they cannot read), then
 * {@link canOpenCaseManagement}. This route sits OUTSIDE the `(detail)` group —
 * like `fase/.../respostas` and `interviews/...` — so it carries its own gate and
 * its own header rather than inheriting the case spine; a shared layout would
 * double-header the focus shell.
 */
export default async function ManageNarrativeEditorPage({
  params,
}: {
  params: Promise<{
    org: string;
    commission: string;
    caseId: string;
    narrativeId: string;
  }>;
}) {
  const { org, commission, caseId, narrativeId } = await params;

  // All three reads depend only on path params, not on each other's results.
  const [access, flagOn, detail] = await Promise.all([
    getCommissionAccessByOrg(org, commission),
    caseAccessEnabled(),
    getCaseDetail(caseId),
  ]);
  if (!access) notFound();
  if (!flagOn) notFound();

  // ⛔ READ GATE, and it must precede the entry predicate — `isAdministrativo`
  // (arm 2) is independent of per-case read reach until the Increment-2 S8 arm
  // lands, so this is what stops an appointed administrativo on a case they
  // cannot read.
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  // ADR 0134 D3 — fail-closed on every non-answer.
  if (
    !(await canOpenCaseManagement(access, caseId, detail.viewerCapabilities))
  ) {
    notFound();
  }

  // The narrative must belong to THIS case (defends a tampered narrative id).
  const narrative = detail.narratives.find((n) => n.id === narrativeId);
  if (!narrative) notFound();

  const caps = detail.viewerCapabilities;
  const caseOpen = !isTerminalCaseStatus(detail.case.status);
  const viewerId = access.context.userId;

  const canEdit = canEditNarrative(narrative, caps, caseOpen, viewerId);
  const isAssignee = narrative.assignedTo === viewerId;
  const canConclude =
    caseOpen &&
    narrative.status === "open" &&
    (caps.canManageLifecycle || isAssignee);

  const heading = narrative.title || narrative.typeLabel;
  // Back to the MANAGE case detail — staying on the management surface the reader
  // deliberately came to, rather than dropping them onto the reading one.
  const backHref = commissionHref(org, commission, "manage", "cases", caseId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {formatCaseNumber(detail.case.caseNumber)}
        </Link>
        <h1 className="text-3xl text-balance">{heading}</h1>
      </header>

      <NarrativeEditor
        narrative={narrative}
        canEdit={canEdit}
        canConclude={canConclude}
        doneHref={backHref}
      />
    </div>
  );
}
