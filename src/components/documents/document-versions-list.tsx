import { Download } from "lucide-react";

import type { ControlledDocumentVersion } from "@/lib/documents/types";
import { DocumentStatusChip } from "@/components/documents/document-badges";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateOnly, formatVersionNumber } from "@/components/documents/format";

/** A version paired with a freshly-minted signed download URL (or null if none). */
export interface VersionWithUrl extends ControlledDocumentVersion {
  downloadUrl: string | null;
}

/**
 * Document versions list (Phase 17, F3). Newest-first history — each version's
 * number, status chip, effective/review/expiry dates, its Markdown summary of
 * changes (Rule 7 — sanitized renderer, never raw HTML), the author, and a
 * signed-URL download when a file is attached. Server-rendered; the page resolves
 * each `downloadUrl` (short-lived) and passes it in.
 */
export function DocumentVersionsList({
  versions,
  currentVersionId,
}: {
  versions: VersionWithUrl[];
  currentVersionId: string | null;
}) {
  return (
    <section
      aria-labelledby="versions-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="versions-heading" className="text-lg font-semibold">
        Versões
      </h2>

      {versions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma versão ainda. Envie o arquivo da primeira versão para começar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => {
            const isCurrent = version.id === currentVersionId;
            return (
              <li
                key={version.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {formatVersionNumber(version.versionNumber)}
                      </span>
                      <DocumentStatusChip status={version.status} />
                      {isCurrent ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Versão atual
                        </span>
                      ) : null}
                    </div>
                    {version.createdByName ? (
                      <p className="text-sm text-muted-foreground">
                        Por {version.createdByName} · {formatDateOnly(version.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  {version.downloadUrl ? (
                    <a
                      href={version.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      <Download aria-hidden="true" className="size-4" />
                      Baixar arquivo
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sem arquivo
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <div className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">Vigência</dt>
                    <dd className="tabular-nums">
                      {formatDateOnly(version.effectiveDate)}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">Revisão</dt>
                    <dd className="tabular-nums">
                      {formatDateOnly(version.reviewDueDate)}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">Expiração</dt>
                    <dd className="tabular-nums">
                      {formatDateOnly(version.expiryDate)}
                    </dd>
                  </div>
                </dl>

                {version.summaryOfChangesMd ? (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Resumo das alterações
                    </p>
                    <MarkdownRenderer content={version.summaryOfChangesMd} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
