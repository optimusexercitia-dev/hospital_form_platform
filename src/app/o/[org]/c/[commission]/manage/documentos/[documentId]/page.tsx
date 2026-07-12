import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Pencil } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getDocument,
  createSignedDownloadUrl,
  listApproverCandidates,
} from "@/lib/queries/documents";
import {
  addDocumentVersion,
  submitDocumentForApproval,
  approveDocument,
  rejectDocument,
  publishDocument,
  supersedeDocument,
  markDocumentObsolete,
} from "@/lib/documents/actions";
import { DOC_TYPE_LABELS } from "@/lib/documents/types";
import {
  selectWorkingDraft,
  findMyApprovalForVersion,
} from "@/lib/documents/version-select";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import {
  DocumentStatusChip,
  DocumentTypeBadge,
} from "@/components/documents/document-badges";
import {
  DocumentVersionsList,
  type VersionWithUrl,
} from "@/components/documents/document-versions-list";
import { ApprovalsPanel } from "@/components/documents/approvals-panel";
import { ApprovalSignForm } from "@/components/documents/approval-sign-form";
import { SubmitForApprovalForm } from "@/components/documents/submit-for-approval-form";
import { AddVersionForm } from "@/components/documents/add-version-form";
import { PublishDocumentDialog } from "@/components/documents/publish-document-dialog";
import { SupersedeDocumentButton } from "@/components/documents/supersede-document-button";
import { ObsoleteDocumentButton } from "@/components/documents/obsolete-document-button";
import { formatDateOnly } from "@/components/documents/format";

export const metadata: Metadata = {
  title: "Documento controlado",
};

/**
 * Controlled-document detail (Phase 17, F3). Coordinator view — the full lifecycle:
 * header (derived status), versions history with signed-URL downloads, the current
 * version's approvals + signature state, and the state/role-driven affordances
 * (submit / add-version / publish / supersede / obsolete). Coordinator-gated by the
 * area layout.
 *
 * A coordinator who is ALSO a named-pending approver on the version under approval
 * sees the shared `<ApprovalSignForm>` here too (the sign-own-row RPC is the real
 * authority; outside-commission approvers sign from the org-level queue-detail).
 */
export default async function DocumentDetailPage({
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

  // Resolve a signed download URL per version (short-lived; parallel). The current
  // version drives the lifecycle affordances shown below.
  const versionsWithUrls: VersionWithUrl[] = await Promise.all(
    versions.map(async (version) => ({
      ...version,
      downloadUrl: version.storagePath
        ? await createSignedDownloadUrl(version.storagePath)
        : null,
    })),
  );

  // The IN-FORCE version (keyed by `current_version_id`) drives the read view: the
  // header status, effective/review dates, and the register/review-due semantics.
  const currentVersion =
    versions.find((v) => v.id === document.currentVersionId) ?? versions[0] ?? null;
  const currentStatus = currentVersion?.status ?? document.status;

  // The WORKING DRAFT (the single in-progress revision, if any — at most one, per the
  // HC089 single-open-draft rule) drives the AUTHORING affordances. This is separate
  // from `currentVersion`: after a supersede of a `vigente` doc the in-force v1 stays
  // `current_version_id` (readers/register/review-due depend on it) while the new v2
  // `rascunho` is the working draft the coordinator uploads + submits. When the doc
  // has never been published, the working draft IS the current version (they coincide).
  // Uses the shared selector so this can't diverge from the approver page (BUG-DOC-005).
  const workingDraft = selectWorkingDraft(versions);
  const workingStatus = workingDraft?.status ?? null;

  // A coordinator who is a named, still-pending approver ON THE WORKING DRAFT may sign
  // here too (the RPC re-checks entitlement). Scoped to the working draft's version —
  // never the first pending row across all versions.
  const userId = access.context.userId;
  const myApproval = workingDraft
    ? findMyApprovalForVersion(approvals, workingDraft.id, userId)
    : null;
  const isPendingApprover = Boolean(myApproval && myApproval.decision == null);

  // The approver picker (F3 submit) needs the active same-hospital candidates — only
  // when a `rascunho` working draft is present (the point at which submit is offered).
  const candidates =
    workingStatus === "draft"
      ? await listApproverCandidates(access.commission.id)
      : [];

  // Whether the in-force version is a published one still standing behind an
  // in-progress revision (drives the "revisão em andamento" context note + the
  // in-force download shown alongside the working-draft affordances).
  const hasPublishedInForce =
    currentVersion != null &&
    (currentVersion.status === "effective" || currentVersion.status === "obsolete");
  const currentInForceDownloadUrl =
    versionsWithUrls.find((v) => v.id === currentVersion?.id)?.downloadUrl ?? null;

  const listHref = commissionHref(org, commission, "manage", "documentos");
  const editHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    documentId,
    "editar",
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={listHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar aos documentos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {document.code}
              </span>
              <DocumentTypeBadge docType={document.docType} />
              <DocumentStatusChip status={currentStatus} />
            </div>
            <h1 className="text-3xl text-balance">{document.title}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{DOC_TYPE_LABELS[document.docType]}</span>
              {document.reviewCycleMonths != null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Revisão a cada {document.reviewCycleMonths} meses</span>
                </>
              ) : null}
              {currentVersion?.effectiveDate ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Vigente desde {formatDateOnly(currentVersion.effectiveDate)}</span>
                </>
              ) : null}
            </p>
          </div>
          {/* Header edit is allowed only while the working draft is `rascunho`
              (#D: `updateControlledDocument`; the editar page enforces + posts). */}
          {workingStatus === "draft" ? (
            <Button asChild variant="outline" size="lg">
              <Link href={editHref}>
                <Pencil aria-hidden="true" className="size-4" />
                Editar
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {/* --- Lifecycle affordances -----------------------------------------
          Authoring targets the WORKING DRAFT (the single open revision), NOT the
          in-force `currentVersion` — so a superseded doc's new draft is reachable
          for upload/submit/publish while the prior version stays in force. When no
          working draft exists, a `vigente` doc offers supersede + obsolete. */}
      {workingDraft ? (
        <div className="flex flex-col gap-6">
          {hasPublishedInForce ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 px-5 py-4">
              <p className="text-sm text-muted-foreground text-pretty">
                Revisão em andamento — v{workingDraft.versionNumber}. A versão
                vigente (v{currentVersion?.versionNumber}) continua valendo até a
                nova ser publicada.
              </p>
              {currentInForceDownloadUrl ? (
                <a
                  href={currentInForceDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <Download aria-hidden="true" className="size-4" />
                  Baixar versão vigente
                </a>
              ) : null}
            </div>
          ) : null}

          {workingStatus === "draft" ? (
            <>
              <AddVersionForm
                action={addDocumentVersion}
                commissionId={document.commissionId}
                documentId={document.id}
                versionId={workingDraft.id}
                title="Arquivo da versão"
                description="Envie ou substitua o arquivo desta versão em rascunho. Cada envio gera um arquivo novo; o anterior é preservado."
                submitLabel="Enviar arquivo"
              />
              {workingDraft.storagePath ? (
                <SubmitForApprovalForm
                  documentVersionId={workingDraft.id}
                  candidates={candidates}
                  action={submitDocumentForApproval}
                />
              ) : (
                <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  Envie o arquivo da versão para poder enviá-la para aprovação.
                </p>
              )}
            </>
          ) : (
            <>
              <ApprovalsPanel approvals={approvals} />
              {isPendingApprover ? (
                <ApprovalSignForm
                  documentVersionId={workingDraft.id}
                  approveAction={approveDocument}
                  rejectAction={rejectDocument}
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <PublishDocumentDialog
                  documentVersionId={workingDraft.id}
                  action={publishDocument}
                />
                <p className="text-sm text-muted-foreground">
                  A publicação exige a aprovação de todos os aprovadores
                  indicados.
                </p>
              </div>
            </>
          )}
        </div>
      ) : currentStatus === "effective" ? (
        <div className="flex flex-col gap-6">
          <SupersedeDocumentButton
            documentId={document.id}
            action={supersedeDocument}
          />
          <div>
            <ObsoleteDocumentButton
              documentId={document.id}
              action={markDocumentObsolete}
            />
          </div>
        </div>
      ) : null}

      {/* --- Versions history --------------------------------------------- */}
      <DocumentVersionsList
        versions={versionsWithUrls}
        currentVersionId={document.currentVersionId}
      />
    </div>
  );
}
