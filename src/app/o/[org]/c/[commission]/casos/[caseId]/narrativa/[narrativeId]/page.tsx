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
import { narrowToReadingSurface } from "@/components/cases/reading-surface";
import { formatCaseNumber } from "@/components/cases/format";

export const metadata: Metadata = {
  title: "Narrativa",
};

/**
 * The FOCUSED narrative editor route (Case Access Control increment, ADR 0033 D7;
 * FE-4) — the narrative analogue of the phase-fill wizard, mirroring its single-
 * column focus shell (back-link + title, then the editor). The assignee opens it
 * from "Meus Casos" to author the body; anyone who can read the case may open it
 * read-only.
 *
 * ⭐ **A READING surface (ADR 0134 D1).** Writing here is name-attributed ONLY:
 * the caps are narrowed by {@link narrowToReadingSurface}, so a coordinator or a
 * write-grantee reads the narrative here and authors it from the mirrored MANAGE
 * route, one click away via "Gerenciar narrativa". The assignee's own authoring is
 * untouched — that is what this route is FOR, and it is the only inbound link
 * ("Meus Casos" → my narrative).
 *
 * Security is RLS (Rule 1): `get_case_detail` returns null when the caller cannot
 * read the case (BE-4 broadens its gate to `can_read_case`), so a member with no
 * access gets `notFound()`. The narrative must belong to the path's case. Write
 * authorization (Q14) is mirrored here for the affordance and re-enforced by
 * `save_narrative_body` server-side. Flag-gated: 404s while `case_access` is OFF.
 */
export default async function NarrativeEditorPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; caseId: string; narrativeId: string }>;
}) {
  const { org, commission, caseId, narrativeId } = await params;

  // All three reads depend only on path params, not on each other's results.
  const [access, flagOn, detail] = await Promise.all([
    getCommissionAccessByOrg(org, commission),
    caseAccessEnabled(),
    getCaseDetail(caseId),
  ]);
  // ADR 0100 D10 — same widening as the parent case page: a quality reviewer
  // resolves `role: null` + `isQualityViewer`, and reads the narrative body under
  // the S7 arm's `read_case_content`. Write authority below is unchanged and
  // already refuses them: `canEditNarrative` needs `caps.canWriteContent` (the arm
  // confers no write bit) or narrative assignment (a reviewer is never an
  // assignee), and `canConclude` needs lifecycle or that same assignment.
  if (!access || (access.role === null && !access.isQualityViewer)) notFound();
  if (!flagOn) notFound();
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  // The narrative must belong to THIS case (defends a tampered narrative id).
  const narrative = detail.narratives.find((n) => n.id === narrativeId);
  if (!narrative) notFound();

  // ⛔ THE READING-SURFACE NARROWING (ADR 0134 D1/D2). This route is the SECOND
  // page under `/casos`, and Increment 1 converted only the first — so a
  // coordinator (`canManageLifecycle`, any narrative) and a write-grantee
  // (`canWriteContent`, un-attributed narratives) kept CASE-WIDE narrative
  // authorship on a `/casos` URL, falsifying D1's own acceptance bullet.
  //
  // The two case-wide arms of `canEditNarrative` are zeroed here; the ASSIGNEE arm
  // is untouched and must stay so — authoring the narrative assigned to me is
  // name-attributed work, which is the half of D1's sentence `/casos` exists for
  // (ADR 0033 Q14 / CA-002). `narrowToReadingSurface` is what preserves that
  // distinction: it narrows the CAPS, and `canEditNarrative` tests the assignee
  // BEFORE it tests `canWriteContent`.
  const caps = narrowToReadingSurface(detail.viewerCapabilities);
  const caseOpen = !isTerminalCaseStatus(detail.case.status);
  const viewerId = access.context.userId;

  const canEdit = canEditNarrative(narrative, caps, caseOpen, viewerId);
  const isAssignee = narrative.assignedTo === viewerId;
  // Concluding a narrative someone ELSE wrote is a lifecycle act, so it follows
  // the narrowed caps; concluding MY OWN stays, for the same reason editing it does.
  const canConclude =
    caseOpen &&
    narrative.status === "open" &&
    (caps.canManageLifecycle || isAssignee);

  // The escape hatch (D3/D4). Offered on the UN-narrowed envelope, exactly like
  // the case page's "Gerenciar caso": gating it on the narrowed value would strand
  // the very viewers the narrowing applies to. Points at this narrative's MANAGE
  // editor rather than the case, so the exit does not cost the reader their place.
  const canOpenManagement = await canOpenCaseManagement(
    access,
    caseId,
    detail.viewerCapabilities,
  );

  const heading = narrative.title || narrative.typeLabel;
  const backHref = commissionHref(org, commission, "casos", caseId);
  const manageHref = commissionHref(
    org,
    commission,
    "manage",
    "cases",
    caseId,
    "narrativa",
    narrativeId,
  );

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="min-w-0 text-3xl text-balance">{heading}</h1>
          {canOpenManagement && (
            <Link
              href={manageHref}
              className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              Gerenciar narrativa
            </Link>
          )}
        </div>
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
