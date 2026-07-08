import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import {
  getDocument,
  createSignedDownloadUrl,
} from "@/lib/queries/documents";
import { approveDocument, rejectDocument } from "@/lib/documents/actions";
import { DOC_TYPE_LABELS } from "@/lib/documents/types";
import {
  selectSignableVersion,
  findMyApprovalForVersion,
} from "@/lib/documents/version-select";
import { orgHref } from "@/lib/routing";
import {
  DocumentStatusChip,
  DocumentTypeBadge,
} from "@/components/documents/document-badges";
import { ApprovalsPanel } from "@/components/documents/approvals-panel";
import { ApprovalSignForm } from "@/components/documents/approval-sign-form";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateOnly, formatVersionNumber } from "@/components/documents/format";

export const metadata: Metadata = {
  title: "Aprovação de documento",
};

/**
 * Approver document-detail (Phase 17, F4/#E). The org-level view an outside-
 * commission approver reaches from the approval queue to SIGN a document they were
 * named on. NOT commission-gated — gated only on `getDocument(id)` returning
 * non-null, which is proof of the approver-read RLS arm (RLS is the security
 * boundary; the storage SELECT policy carries the same approver arm, so the
 * download works too). The approve/reject RPC re-checks entitlement (HC091 for a
 * non-approver), so the shared `<ApprovalSignForm>` is safe here.
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

  const downloadUrl =
    signableVersion?.storagePath != null
      ? await createSignedDownloadUrl(signableVersion.storagePath)
      : null;

  const queueHref = orgHref(org, "documentos-pendentes");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
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
            <span className="font-mono text-xs text-muted-foreground">
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
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <Download aria-hidden="true" className="size-4" />
                Baixar arquivo
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Sem arquivo</span>
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
    </main>
  );
}
