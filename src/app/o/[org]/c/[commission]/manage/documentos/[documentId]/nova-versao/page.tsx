import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getDocument, listApproverCandidates } from "@/lib/queries/controlled-documents";
import { supersedeAndSubmitDocument } from "@/lib/controlled-documents/actions";
import { selectWorkingDraft } from "@/lib/controlled-documents/version-select";
import { commissionHref } from "@/lib/routing";
import {
  CreateWizard,
  type LockedIdentity,
} from "@/components/documents/create-wizard";

export const metadata: Metadata = {
  title: "Nova versão do documento",
};

/**
 * New version of a controlled document (Phase 17 v2, F-B — new-version wizard).
 * Coordinator area (flag + role gated by the layout). The all-in-one wizard, in
 * `newversion` mode, supersedes the current effective version and submits the new
 * draft for approval via `supersedeAndSubmitDocument` (identity locked). Same
 * WizardRunner boundary as `novo/`: this Server Component loads the approver
 * candidates + binds the action; the client wizard receives them as props.
 *
 * Precondition gate: a new version can only be started while the document is
 * `effective` with NO open working draft (the state `supersede_document` accepts,
 * HC089 otherwise). If a draft is already open — or the doc isn't effective — we
 * redirect to the detail page, where the blank-draft supersede fallback lives.
 */
export default async function NewDocumentVersionPage({
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

  const { document, versions } = detail;
  const detailHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    documentId,
  );

  // Only an `effective` document with no open working draft can be superseded. Any
  // other state (a draft/in-approval already exists, or the doc is obsolete) is
  // handled on the detail page — send the user there rather than render a wizard
  // whose terminal action would fail HC089.
  const currentVersion =
    versions.find((v) => v.id === document.currentVersionId) ?? versions[0] ?? null;
  const workingDraft = selectWorkingDraft(versions);
  if (
    workingDraft != null ||
    currentVersion == null ||
    currentVersion.status !== "effective"
  ) {
    redirect(detailHref);
  }

  const nextVersionNumber =
    versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;

  const candidates = await listApproverCandidates(access.commission.id);

  const locked: LockedIdentity = {
    documentId: document.id,
    code: document.code,
    title: document.title,
    docType: document.docType,
    category: document.category,
    currentVersionNumber: currentVersion.versionNumber,
    nextVersionNumber,
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
          <h1 className="text-3xl text-balance">Nova versão do documento</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Anexe o arquivo revisado e indique os aprovadores. Ao enviar, a nova
            versão entra em aprovação; a versão vigente continua valendo até ela ser
            publicada.
          </p>
        </div>
      </header>

      <CreateWizard
        mode="newversion"
        locked={locked}
        org={org}
        commission={commission}
        commissionId={access.commission.id}
        candidates={candidates}
        categories={[]}
        submitAction={supersedeAndSubmitDocument}
      />
    </div>
  );
}
