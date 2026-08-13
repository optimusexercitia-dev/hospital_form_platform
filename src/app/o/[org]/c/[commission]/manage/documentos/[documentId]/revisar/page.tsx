import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getDocument, listApproverCandidates } from "@/lib/queries/controlled-documents";
import { selectWorkingDraft } from "@/lib/controlled-documents/version-select";
import { commissionHref } from "@/lib/routing";
import {
  CreateWizard,
  type LockedIdentity,
} from "@/components/controlled-documents/create-wizard";
import type { ChosenApprover } from "@/components/controlled-documents/reviewer-picker";

export const metadata: Metadata = {
  title: "Revisar versão do documento",
};

/**
 * Revise a `changes_requested` version of a controlled document (ADR 0081 —
 * changes-requested loop). Coordinator area (flag + role gated by the layout). The
 * wizard, in `revise` mode, re-attaches the corrected file and re-submits the SAME
 * version for approval (identity locked, NO version bump).
 *
 * This is the ONE mode with no step 1 (DM3·S2): the `changes_requested` version
 * already exists, so the chain is just begin → client PUT → finalize →
 * `submitDocumentForApproval`. That also makes it the one mode where a failed
 * upload can safely be retried in place — nothing was created to duplicate.
 *
 * This Server Component resolves the working version + approver candidates and
 * derives the prior approver set to pre-fill. It no longer binds a terminal
 * action (`reviseChangesRequestedDocument` is gone).
 *
 * Precondition gate: revision only applies to a version in the `changes_requested`
 * state. If the document has no such open version (draft/in-approval/effective/
 * obsolete instead), we redirect to the detail page, where the appropriate affordance
 * lives.
 */
export default async function ReviseDocumentVersionPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; documentId: string }>;
}) {
  const { org, commission, documentId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const detail = await getDocument(documentId);
  if (!detail || detail.document.commissionId !== access.commission.id) {
    notFound();
  }

  const { document, versions, approvals } = detail;
  const detailHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    documentId,
  );

  // Only a `changes_requested` working version can be revised in place. Any other
  // state (no open version, or the open version is a plain draft / under approval) is
  // handled on the detail page — send the user there rather than render a wizard whose
  // terminal action would fail HC089.
  const workingVersion = selectWorkingDraft(versions);
  if (workingVersion == null || workingVersion.status !== "changes_requested") {
    redirect(detailHref);
  }

  const candidates = await listApproverCandidates(access.commission.id);

  // Pre-fill the approver step with the version's prior set. Guard against a stale
  // approver who is no longer an active candidate (they would be counted but not
  // toggleable in the picker) by intersecting with the current candidate ids.
  const candidateIds = new Set(candidates.map((c) => c.id));
  const initialApprovers: ChosenApprover[] = approvals
    .filter(
      (a) =>
        a.documentVersionId === workingVersion.id &&
        candidateIds.has(a.approverId),
    )
    .map((a) => ({
      approverId: a.approverId,
      approverTitle: a.approverTitle ?? "",
    }));

  const locked: LockedIdentity = {
    documentId: document.id,
    code: document.code,
    title: document.title,
    docType: document.docType,
    category: document.category,
    // Revised in place — the version number is kept (no bump); both fields reflect
    // the working version so the identity panel reads consistently.
    currentVersionNumber: workingVersion.versionNumber,
    nextVersionNumber: workingVersion.versionNumber,
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={detailHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar ao documento
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {document.code} · {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Revisar versão do documento</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Um ou mais aprovadores solicitaram alterações. Anexe o arquivo corrigido
            e confirme os aprovadores. Ao enviar, a mesma versão volta a aprovação
            com uma nova rodada de assinaturas.
          </p>
        </div>
      </header>

      <CreateWizard
        mode="revise"
        locked={locked}
        org={org}
        commission={commission}
        commissionId={access.commission.id}
        versionId={workingVersion.id}
        candidates={candidates}
        categories={[]}
        initialApprovers={initialApprovers}
      />
    </div>
  );
}
