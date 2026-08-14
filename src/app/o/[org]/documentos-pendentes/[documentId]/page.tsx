import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { getDocument } from "@/lib/queries/controlled-documents";
import { approveDocument, rejectDocument } from "@/lib/controlled-documents/actions";
import { DOC_TYPE_LABELS } from "@/lib/controlled-documents/types";
import {
  selectSignableVersion,
  findMyApprovalForVersion,
} from "@/lib/controlled-documents/version-select";
import { orgHref } from "@/lib/routing";
import {
  DocumentStatusChip,
  DocumentTypeBadge,
} from "@/components/controlled-documents/document-badges";
import { ApprovalsPanel } from "@/components/controlled-documents/approvals-panel";
import { ApprovalSignForm } from "@/components/controlled-documents/approval-sign-form";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { OpenControlledVersionButton } from "@/components/controlled-documents/open-controlled-version-button";
import {
  formatDateOnly,
  formatVersionNumber,
  versionFileLabel,
} from "@/components/controlled-documents/format";

export const metadata: Metadata = {
  title: "Aprovação de documento",
};

/**
 * Approver document-detail (Phase 17, F4/#E). The org-level view an outside-
 * commission approver reaches from the approval queue to SIGN a document they were
 * named on. NOT commission-gated — gated only on `getDocument(id)` returning
 * non-null, which is proof of the approver-read RLS arm (RLS is the security
 * boundary). The approve/reject RPC re-checks entitlement (HC091 for a
 * non-approver), so the shared `<ApprovalSignForm>` is safe here.
 *
 * ⚠ This comment used to add "…the storage SELECT policy carries the same
 * approver arm, so the download works too". That is FALSE as of DM3 M5, which
 * DROPPED `controlled_documents_obj_select_member`. The approver's byte access
 * survives, but it moved: it is now an arm of the KERNEL
 * (`app.can_read_document` dispatching `controlled_document` →
 * `is_member_of_for` OR `is_document_approver_of`), which is what
 * `open_document_version` authorizes against. Same outcome for this approver,
 * an entirely different gate — and the sentence is rewritten rather than
 * deleted because a reader who remembers the old one needs to be told it moved.
 *
 * Read-only apart from the sign form: the approver sees the version under approval,
 * downloads it, and records their decision. Full lifecycle stays on the
 * coordinator's commission-scoped detail (F3).
 */
export default async function ApproverDocumentPage({
  params,
}: {
  params: Promise<{ org: string; documentId: string }>;
}) {
  const { org, documentId } = await params;

  // Both reads depend only on the session cookie / the path's documentId, not
  // on each other's results — fetch concurrently.
  const [context, detail] = await Promise.all([
    getSessionContext(),
    getDocument(documentId),
  ]);
  // A valid session is required; RLS (via getDocument) is the real boundary.
  if (!context) {
    notFound();
  }
  if (!detail) {
    // Either the document does not exist or the caller holds no approval row on it
    // — indistinguishable by design, both 404 and leak nothing.
    notFound();
  }

  const { document, versions, approvals } = detail;

  // The version an approver ACTS ON is the one UNDER APPROVAL (`em_aprovacao`), NOT
  // the in-force `current_version_id` — after a supersede those differ (v1 stays
  // vigente/in-force while v2 is em_aprovacao). Selecting off the in-force pointer
  // would sign against the wrong version (BUG-DOC-005). The shared helper is the
  // single source of truth so this can't diverge from the coordinator page.
  const signableVersion = selectSignableVersion(versions);
  const signableStatus = signableVersion?.status ?? document.status;

  const userId = context.userId;
  // Resolve the caller's approval row on THIS specific version (not the first row
  // across all versions, which could be a decided row on a prior version).
  const myApproval = signableVersion
    ? findMyApprovalForVersion(approvals, signableVersion.id, userId)
    : null;
  const isPendingApprover = Boolean(myApproval && myApproval.decision == null);

  const queueHref = orgHref(org, "documentos-pendentes");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={queueHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar às aprovações pendentes
        </Link>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-primary">
              {document.code}
            </span>
            <DocumentTypeBadge docType={document.docType} />
            <DocumentStatusChip status={signableStatus} />
            {signableVersion ? (
              <span className="font-mono text-xs text-muted-foreground">
                {formatVersionNumber(signableVersion.versionNumber)}
              </span>
            ) : null}
          </div>
          <h1 className="text-3xl text-balance">{document.title}</h1>
          <p className="text-sm text-muted-foreground">
            {DOC_TYPE_LABELS[document.docType]}
          </p>
        </div>
      </header>

      {signableVersion ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Arquivo em aprovação</h2>
            {signableVersion.availability === "available" ? (
              <OpenControlledVersionButton
                versionId={signableVersion.id}
                label="Baixar arquivo"
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                {versionFileLabel(signableVersion)}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Vigência prevista</dt>
              <dd className="tabular-nums">
                {formatDateOnly(signableVersion.effectiveDate)}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Expiração</dt>
              <dd className="tabular-nums">
                {formatDateOnly(signableVersion.expiryDate)}
              </dd>
            </div>
          </dl>
          {signableVersion.summaryOfChangesMd ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Resumo das alterações
              </p>
              <MarkdownRenderer content={signableVersion.summaryOfChangesMd} />
            </div>
          ) : null}
        </section>
      ) : null}

      <ApprovalsPanel approvals={approvals} />

      {isPendingApprover && signableVersion ? (
        <ApprovalSignForm
          documentVersionId={signableVersion.id}
          approveAction={approveDocument}
          rejectAction={rejectDocument}
        />
      ) : myApproval && myApproval.decision != null ? (
        <p className="rounded-2xl border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Você já registrou sua decisão para esta versão.
        </p>
      ) : (
        <p className="rounded-2xl border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Este documento não tem uma versão aguardando sua aprovação no momento.
        </p>
      )}
    </div>
  );
}
