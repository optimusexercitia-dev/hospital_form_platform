import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { NarrativeEditor } from "@/components/cases/narrative-editor";
import { canEditNarrative } from "@/components/cases/narrative-access";
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
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access) notFound();

  if (!(await caseAccessEnabled())) notFound();

  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
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
    narrative.status === "aberta" &&
    (caps.canManageLifecycle || isAssignee);

  const heading = narrative.title || narrative.typeLabel;
  const backHref = commissionHref(org, commission, "casos", caseId);

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
