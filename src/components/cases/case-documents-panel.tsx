import { Download, FileText } from "lucide-react";

import type { CaseDocumentWithUrl } from "@/lib/queries/case-documents";
import { cn } from "@/lib/utils";
import { CaseDocumentUpload } from "./case-document-upload";
import { CaseDocumentDelete } from "./case-document-delete";
import { DOC_TYPE_LABEL } from "./case-extras-labels";
import { formatDate, formatDueDate } from "./format";

/**
 * Case DOCUMENTS panel (R1): the case's file-backed artifacts (ata, scans,
 * registries), newest-first, each with a signed-URL download and a soft-delete.
 * Server-Component shell — the data (incl. fresh signed URLs) arrives as props;
 * the upload + delete are client islands. Soft-deleted docs are already filtered
 * out by `listCaseDocuments`.
 */
export function CaseDocumentsPanel({
  caseId,
  documents,
  variant = "default",
}: {
  caseId: string;
  documents: CaseDocumentWithUrl[];
  /** "rail" = compact, flatter treatment for the case-detail side rail. */
  variant?: "default" | "rail";
}) {
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
        <CaseDocumentUpload caseId={caseId} />
      </div>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum documento anexado. Envie atas, digitalizações ou registros deste
          caso.
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

              <div className="flex shrink-0 items-center gap-0.5">
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
                  <span className="text-xs text-muted-foreground/70 italic">
                    indisponível
                  </span>
                )}
                <CaseDocumentDelete documentId={doc.id} title={doc.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
