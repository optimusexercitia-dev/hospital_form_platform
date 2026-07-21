import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, GitBranchPlus, Pencil } from "lucide-react";

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
  remindDocumentApprover,
} from "@/lib/documents/actions";
import { DOC_TYPE_LABELS } from "@/lib/documents/types";
import {
  selectWorkingDraft,
  findMyApprovalForVersion,
} from "@/lib/documents/version-select";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import {
  DerivedStatusChip,
  DocumentTypeBadge,
} from "@/components/documents/document-badges";
import {
  DocumentVersionHistory,
  type VersionWithUrl,
} from "@/components/documents/document-version-history";
import { DocumentDetailRail } from "@/components/documents/document-detail-rail";
import { DetailNotice } from "@/components/documents/detail-notice";
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
 * Controlled-document detail (Phase 17 v2, F-C). Coordinator view — two columns:
 * left carries the lifecycle affordances (submit / add-version / publish /
 * supersede / obsolete) + the version-history spine (with compare); the right rail
 * carries the "Detalhes do documento" + "Documento controlado" cards. The in-force
 * version drives the read view; the working draft drives authoring (BUG-DOC-005 —
 * resolved via the shared selector). Coordinator-gated by the area layout.
 *
 * A coordinator who is ALSO a named-pending approver on the version under approval
 * sees the shared `<ApprovalSignForm>` here too (the sign-own-row RPC is the real
 * authority). Pending approvers can be reminded via the approvals roster.
 */
export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string; documentId: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { org, commission, documentId } = await params;
  const { aviso } = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const detail = await getDocument(documentId);
  if (!detail || detail.document.commissionId !== access.commission.id) {
    notFound();
  }

  const { document, versions, approvals } = detail;

  const versionsWithUrls: VersionWithUrl[] = await Promise.all(
    versions.map(async (version) => ({
      ...version,
      downloadUrl: version.storagePath
        ? await createSignedDownloadUrl(version.storagePath)
        : null,
    })),
  );

  const currentVersion =
    versions.find((v) => v.id === document.currentVersionId) ?? versions[0] ?? null;
  const currentStatus = currentVersion?.status ?? document.status;

  const workingDraft = selectWorkingDraft(versions);
  const workingStatus = workingDraft?.status ?? null;

  // Derived "Em revisão": an in-force effective doc with an open draft above it.
  const derivedStatus =
    currentStatus === "effective" &&
    workingDraft != null &&
    workingDraft.versionNumber > (currentVersion?.versionNumber ?? 0)
      ? "revision"
      : currentStatus;

  const userId = access.context.userId;
  const myApproval = workingDraft
    ? findMyApprovalForVersion(approvals, workingDraft.id, userId)
    : null;
  const isPendingApprover = Boolean(myApproval && myApproval.decision == null);

  const candidates =
    workingStatus === "draft"
      ? await listApproverCandidates(access.commission.id)
      : [];

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
  const newVersionHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    documentId,
    "nova-versao",
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
              <span className="font-mono text-xs text-primary">{document.code}</span>
              <DocumentTypeBadge docType={document.docType} />
              <DerivedStatusChip status={derivedStatus} />
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
            {document.description ? (
              <p className="max-w-prose text-sm whitespace-pre-wrap text-foreground text-pretty">
                {document.description}
              </p>
            ) : null}
          </div>
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

      {aviso ? <DetailNotice aviso={aviso} /> : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          {/* --- Lifecycle affordances (authoring targets the working draft) --- */}
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
                  <ApprovalsPanel
                    approvals={approvals}
                    remindAction={remindDocumentApprover}
                    versionId={workingDraft.id}
                  />
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
            <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Atualizar documento</h2>
                <p className="text-sm text-muted-foreground text-pretty">
                  A versão vigente (v{currentVersion?.versionNumber}) é somente
                  leitura. Crie uma nova versão para propor alterações — o passo a
                  passo coleta o arquivo e os aprovadores. A versão atual continua
                  valendo até a nova ser publicada.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Primary: guided new-version wizard (locked identity + submit). */}
                <Button asChild size="lg">
                  <Link href={newVersionHref}>
                    <GitBranchPlus aria-hidden="true" className="size-4" />
                    Criar nova versão
                  </Link>
                </Button>
                {/* Fallback: plain supersede (blank draft, build it on this page). */}
                <SupersedeDocumentButton
                  variant="inline"
                  documentId={document.id}
                  action={supersedeDocument}
                />
                <ObsoleteDocumentButton
                  documentId={document.id}
                  action={markDocumentObsolete}
                />
              </div>
            </section>
          ) : null}

          {/* --- Version history + compare ---------------------------------- */}
          <DocumentVersionHistory
            versions={versionsWithUrls}
            currentVersionId={document.currentVersionId}
          />
        </div>

        <div className="lg:sticky lg:top-6">
          <DocumentDetailRail
            document={document}
            commissionName={access.commission.name}
            effectiveDate={currentVersion?.effectiveDate ?? null}
            reviewDueDate={currentVersion?.reviewDueDate ?? null}
          />
        </div>
      </div>
    </div>
  );
}
