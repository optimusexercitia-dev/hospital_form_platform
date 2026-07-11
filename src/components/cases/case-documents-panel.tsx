import { Download, FileText } from "lucide-react";

import type { CaseDocumentWithUrl } from "@/lib/queries/case-documents";
import { cn } from "@/lib/utils";
import { attachmentsEnabled } from "@/lib/attachments/actions";
import { OpenAttachmentButton } from "@/components/attachments/open-attachment-button";
import { CaseDocumentUpload } from "./case-document-upload";
import { CaseDocumentDelete } from "./case-document-delete";
import { DOC_TYPE_LABEL } from "./case-extras-labels";
import { formatDate, formatDueDate } from "./format";

/**
 * Case DOCUMENTS panel (R1; rewired onto the centralized-attachments substrate in
 * F2 — ADR 0063): the case's file-backed artifacts (ata, scans, registries),
 * newest-first, each with a download and a soft-delete. Server-Component shell —
 * the data (incl. fresh signed URLs where available) arrives as props; the upload
 * + delete are client islands. Soft-deleted docs are already filtered out by
 * `listCaseDocuments`.
 *
 * Case documents default to the PHI tier (`containsPhi: true`, `signedUrl: null`),
 * so the common case opens via the audited {@link OpenAttachmentButton} — never
 * pre-fetched, only on click, via `openAttachment(attachmentId)`. Upload/delete AND
 * the open door are gated on the `attachments` feature flag; while off, existing
 * documents render read-only and the open control is disabled (list reads
 * themselves are never gated).
 */
export async function CaseDocumentsPanel({
  caseId,
  documents,
  variant = "default",
  canWrite = true,
}: {
  caseId: string;
  documents: CaseDocumentWithUrl[];
  /** "rail" = compact, flatter treatment for the case-detail side rail. */
  variant?: "default" | "rail";
  /**
   * Whether the viewer may upload/delete documents (`canWriteContent`; ADR 0033).
   * Default `true`; a read-only viewer keeps the downloads but loses the upload +
   * delete affordances.
   */
  canWrite?: boolean;
}) {
  const flagOn = await attachmentsEnabled();
  const canWriteNow = canWrite && flagOn;
  return (
    <section
      aria-labelledby="case-docs-heading"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card",
        variant === "rail"
          ? "border-border/70 p-4 shadow-none"
          : "border-border p-5 shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="case-docs-heading"
            className={cn(
              "font-semibold",
              variant === "rail" ? "text-sm" : "text-base",
            )}
          >
            Documentos
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {documents.length}
          </span>
        </div>
        {canWriteNow && <CaseDocumentUpload caseId={caseId} />}
      </div>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canWriteNow
            ? "Nenhum documento anexado. Envie atas, digitalizações ou registros deste caso."
            : "Nenhum documento anexado."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {doc.title}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-secondary-foreground uppercase">
                    {DOC_TYPE_LABEL[doc.docType]}
                  </span>
                </div>
                {doc.description && (
                  <p className="text-xs text-muted-foreground text-pretty">
                    {doc.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {doc.occurredAt
                    ? `Data: ${formatDueDate(doc.occurredAt)} · `
                    : ""}
                  Enviado em {formatDate(doc.createdAt)}
                  {doc.uploadedByName ? ` por ${doc.uploadedByName}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-start gap-0.5">
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Baixar ${doc.title}`}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </a>
                ) : (
                  <OpenAttachmentButton
                    attachmentId={doc.attachmentId ?? doc.id}
                    label={`Baixar ${doc.title}`}
                    disabled={!flagOn}
                  />
                )}
                {canWriteNow && (
                  <CaseDocumentDelete documentId={doc.id} title={doc.title} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
