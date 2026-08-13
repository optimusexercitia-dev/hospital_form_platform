import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  GitBranchPlus,
  History,
  Pencil,
  RefreshCw,
} from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getDocument,
  listApproverCandidates,
} from "@/lib/queries/controlled-documents";
import {
  submitDocumentForApproval,
  approveDocument,
  rejectDocument,
  publishDocument,
  supersedeDocument,
  markDocumentObsolete,
  remindDocumentApprover,
} from "@/lib/controlled-documents/actions";
import {
  selectWorkingDraft,
  findMyApprovalForVersion,
} from "@/lib/controlled-documents/version-select";
import { commissionHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DocumentIdentityCard } from "@/components/controlled-documents/document-identity-card";
import { DocumentVersionHistory } from "@/components/controlled-documents/document-version-history";
import { OpenControlledVersionButton } from "@/components/controlled-documents/open-controlled-version-button";
import { DocumentDetailRail } from "@/components/controlled-documents/document-detail-rail";
import { DetailNotice } from "@/components/controlled-documents/detail-notice";
import { versionFileLabel } from "@/components/controlled-documents/format";
import { ApprovalsPanel } from "@/components/controlled-documents/approvals-panel";
import { ApprovalSignForm } from "@/components/controlled-documents/approval-sign-form";
import { SubmitForApprovalForm } from "@/components/controlled-documents/submit-for-approval-form";
import { AddVersionForm } from "@/components/controlled-documents/add-version-form";
import { PublishDocumentDialog } from "@/components/controlled-documents/publish-document-dialog";
import { DocumentActionsMenu } from "@/components/controlled-documents/document-actions-menu";

export const metadata: Metadata = {
  title: "Documento controlado",
};

/**
 * Controlled-document detail (doc-detail redesign, approved mockup — supersedes
 * the Phase 17 v2 F-C layout). A full-width identity card (code/type/status,
 * title, meta, description, and a STATE-DEPENDENT action cluster) sits above a
 * two-column grid: the version-history spine (with compare) on the left, and the
 * "Detalhes do documento" / "Documento controlado" rail on the right. The
 * working draft's lifecycle affordances (upload → submit → approvals → sign →
 * publish) are hosted INSIDE that draft's own version card via the
 * `activeDraftSlot` RSC-slot pattern, rather than as standalone panels above the
 * spine — so the eye never has to jump between "which version is this for" and
 * "what can I do about it".
 *
 * The in-force version drives the read view; the working draft drives authoring
 * (BUG-DOC-005 — resolved via the shared `version-select` helpers). Coordinator-
 * gated by the area layout. A coordinator who is ALSO a named-pending approver on
 * the version under approval sees the shared `<ApprovalSignForm>` here too (the
 * sign-own-row RPC is the real authority). Pending approvers can be reminded via
 * the nested approvals roster.
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

  // DM3·S2: no signed URLs are minted here any more. Rendering this page used to
  // mint one PER VERSION — an authority check at render time, then a bearer URL
  // valid for its whole TTL with no download-time re-check and no audit row.
  // Bytes now move only through the audited on-click door.
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
  const reviseHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    documentId,
    "revisar",
  );

  // Offered only when the door would actually serve: `available` is the shared
  // predicate's one servable state. A version whose bytes are still scanning,
  // failed verification, or were disposed gets no control rather than one that
  // can only refuse. The door re-checks on every call regardless (Rule 1) —
  // this decides what is on screen, never what is permitted.
  const downloadCurrentLink =
    currentVersion != null && currentVersion.availability === "available" ? (
      <OpenControlledVersionButton
        versionId={currentVersion.id}
        label="Baixar versão vigente"
      />
    ) : null;

  // --- Identity-card action cluster — STATE-DEPENDENT ----------------------
  let identityActions: React.ReactNode = null;
  if (workingDraft) {
    // A revision is already open: create/supersede/obsolete don't apply mid-
    // revision. Offer the last in-force download plus a quiet status hint (not
    // a button — the revise CTA lives in the working-draft card below). A
    // `changes_requested` version reads amber to signal it needs attention.
    const isChangesRequested = workingStatus === "changes_requested";
    identityActions = (
      <>
        {hasPublishedInForce ? downloadCurrentLink : null}
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-sm",
            isChangesRequested
              ? "border-warning/30 bg-warning/12 text-warning"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {isChangesRequested ? (
            <AlertTriangle aria-hidden="true" className="size-3.5" />
          ) : (
            <History aria-hidden="true" className="size-3.5" />
          )}
          {isChangesRequested
            ? `Alterações solicitadas — v${workingDraft.versionNumber}`
            : `Revisão em andamento — v${workingDraft.versionNumber}`}
        </span>
      </>
    );
  } else if (currentStatus === "effective") {
    identityActions = (
      <>
        <Button asChild size="lg">
          <Link href={newVersionHref}>
            <GitBranchPlus aria-hidden="true" className="size-4" />
            Criar nova versão
          </Link>
        </Button>
        {hasPublishedInForce ? downloadCurrentLink : null}
        <DocumentActionsMenu
          documentId={document.id}
          supersedeAction={supersedeDocument}
          obsoleteAction={markDocumentObsolete}
        />
      </>
    );
  } else if (hasPublishedInForce) {
    // No open draft and not currently in-force (e.g. fully obsoleted) — still
    // let the coordinator pull the last in-force file for reference.
    identityActions = downloadCurrentLink;
  }

  // --- Working-draft slot — hosted INSIDE its own version card -------------
  let draftSlot: React.ReactNode = null;
  if (workingDraft) {
    if (workingStatus === "draft") {
      draftSlot = (
        <>
          <Link
            href={editHref}
            className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            Editar rascunho
          </Link>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <AddVersionForm
              commissionId={document.commissionId}
              documentId={document.id}
              versionId={workingDraft.id}
              title="Arquivo da versão"
              description="Envie ou substitua o arquivo desta versão em rascunho. Cada envio gera um arquivo novo; o anterior é preservado."
              submitLabel="Enviar arquivo"
            />
          </div>
          {/* Gated on `availability === "available"`, NOT on the pointer being
              non-null (DM3·S2).

              `coreDocumentVersionId != null` only says a file was BOUND. A bound
              file is still unservable while its bytes are scanning (`pending`),
              after they fail verification (`failed`), once the document leaves
              `active` (`unavailable`), or after disposal (`disposed`). Offering
              "enviar para aprovação" in any of those states invites a submit the
              server would refuse — and hiding it whenever the pointer is null
              would ALSO be wrong in the other direction once a re-upload is in
              flight.

              `available` is the one state that means a usable file is present:
              it comes from `documentVersionAvailability`, the same predicate
              Wave A uses, written to agree with `open_document_version` branch
              for branch. Gating here therefore reads the same answer the door
              would give rather than a parallel UI opinion of it. */}
          {workingDraft.availability === "available" ? (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <SubmitForApprovalForm
                documentVersionId={workingDraft.id}
                candidates={candidates}
                action={submitDocumentForApproval}
              />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              {workingDraft.coreDocumentVersionId == null
                ? "Envie o arquivo da versão para poder enviá-la para aprovação."
                : `Arquivo em processamento (${versionFileLabel(workingDraft).toLowerCase()}). A versão poderá ser enviada para aprovação assim que o arquivo estiver disponível.`}
            </p>
          )}
        </>
      );
    } else if (workingStatus === "changes_requested") {
      // A reviewer requested changes: the version is revised IN PLACE (no bump).
      // Keep the full roster visible (verdicts + each rejector's note), and route
      // the coordinator to the revise wizard instead of the upload/submit forms.
      draftSlot = (
        <>
          <ApprovalsPanel approvals={approvals} variant="nested" />
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/12 px-4 py-3.5">
            <p className="flex flex-1 items-center gap-2 text-sm text-pretty text-foreground">
              <AlertTriangle
                aria-hidden="true"
                className="size-4 shrink-0 text-warning"
              />
              Esta versão recebeu solicitações de alteração de um ou mais
              aprovadores.
            </p>
            <Button asChild size="lg">
              <Link href={reviseHref}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Enviar versão revisada
              </Link>
            </Button>
          </div>
        </>
      );
    } else {
      const allApproved =
        approvals.length > 0 &&
        approvals.every((a) => a.decision === "approved");
      draftSlot = (
        <>
          <ApprovalsPanel
            approvals={approvals}
            remindAction={remindDocumentApprover}
            versionId={workingDraft.id}
            variant="nested"
          />
          {isPendingApprover ? (
            <ApprovalSignForm
              documentVersionId={workingDraft.id}
              approveAction={approveDocument}
              rejectAction={rejectDocument}
            />
          ) : null}
          {allApproved ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/35 bg-accent px-4 py-3.5">
              <p className="flex flex-1 items-center gap-2 text-sm text-pretty text-foreground">
                <CheckCircle2
                  aria-hidden="true"
                  className="size-4 shrink-0 text-primary"
                />
                Todos os aprovadores assinaram. Defina a vigência e publique.
              </p>
              <PublishDocumentDialog
                documentVersionId={workingDraft.id}
                action={publishDocument}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/12 px-4 py-3.5">
              <p className="flex flex-1 items-center gap-2 text-sm text-pretty text-foreground">
                <AlertTriangle
                  aria-hidden="true"
                  className="size-4 shrink-0 text-warning"
                />
                A publicação exige a aprovação de todos os aprovadores
                indicados.
              </p>
              <Button type="button" size="lg" disabled aria-disabled="true">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                Publicar
              </Button>
            </div>
          )}
        </>
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={listHref}
        className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Voltar aos documentos
      </Link>

      <DocumentIdentityCard
        code={document.code}
        docType={document.docType}
        derivedStatus={derivedStatus}
        title={document.title}
        reviewCycleMonths={document.reviewCycleMonths}
        effectiveDate={currentVersion?.effectiveDate ?? null}
        effectiveVersionNumber={currentVersion?.versionNumber ?? null}
        description={document.description}
        actions={identityActions}
      />

      {aviso ? <DetailNotice aviso={aviso} /> : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DocumentVersionHistory
          versions={versions}
          currentVersionId={document.currentVersionId}
          activeDraftId={workingDraft?.id ?? null}
          activeDraftSlot={draftSlot}
        />

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
