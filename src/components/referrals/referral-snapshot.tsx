import { Download, FileText, Paperclip } from "lucide-react";

import type { SharedItem } from "@/lib/referrals/types";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatFileSize } from "./format";

/**
 * The frozen SNAPSHOT B reads on the referral detail (Decision 3/9). A pure
 * Server Component: it renders the point-in-time copies the source coordinator
 * curated — narratives as sanitized Markdown (Rule 7, the ONE renderer) and
 * documents as download links.
 *
 * The snapshot is NOT A's live case — it's referral-owned frozen rows. Narrative
 * bodies (`frozenBodyMd`) are PHI-bearing clinical free text the audited detail
 * door already gated; documents reference A's existing object (Rule 6), and the
 * signed URL was minted SERVER-SIDE by the page via the DEFINER `getReferralDocumentUrl`
 * door (matches the `CaseDocumentWithUrl` pattern) and passed in as `documentUrls`.
 * A `null` URL (mint failed / out of scope) renders a disabled affordance, never
 * a broken link.
 */
export function ReferralSnapshot({
  sharedItems,
  documentUrls,
}: {
  sharedItems: SharedItem[];
  /** `sharedItemId → signed URL`, minted server-side; missing/`null` = unavailable. */
  documentUrls: Record<string, string | null>;
}) {
  const narratives = sharedItems
    .filter((i) => i.kind === "narrative")
    .sort((a, b) => a.position - b.position);
  const documents = sharedItems
    .filter((i) => i.kind === "document")
    .sort((a, b) => a.position - b.position);

  if (sharedItems.length === 0) {
    return (
      <section
        aria-labelledby="referral-snapshot-heading"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <h2 id="referral-snapshot-heading" className="text-base font-semibold">
          Conteúdo compartilhado
        </h2>
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum item foi compartilhado neste encaminhamento.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="referral-snapshot-heading"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h2 id="referral-snapshot-heading" className="text-base font-semibold">
          Conteúdo compartilhado
        </h2>
        <p className="text-xs text-muted-foreground text-pretty">
          Cópia congelada no momento do envio. Reflete o caso de origem naquele
          instante, não o estado atual.
        </p>
      </div>

      {narratives.length > 0 && (
        <div className="flex flex-col gap-4">
          {narratives.map((n) => (
            <article
              key={n.id}
              aria-label={n.frozenTitle ?? "Narrativa"}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/10 p-4"
            >
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                <FileText
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                {n.frozenTitle ?? "Narrativa"}
              </h3>
              {n.frozenBodyMd?.trim() ? (
                <MarkdownRenderer content={n.frozenBodyMd} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Narrativa sem conteúdo.
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Paperclip
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Documentos
          </h3>
          <ul className="flex flex-col gap-2">
            {documents.map((d) => {
              const url = documentUrls[d.id] ?? null;
              const size = formatFileSize(d.frozenSizeBytes);
              return (
                <li key={d.id}>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      <Download
                        aria-hidden="true"
                        className="size-4 shrink-0 text-primary"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {d.frozenTitle ?? "Documento"}
                        </span>
                        {size && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {size}
                          </span>
                        )}
                      </span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-muted-foreground">
                      <Paperclip aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {d.frozenTitle ?? "Documento"}
                        </span>
                        <span className="text-xs">Indisponível no momento.</span>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
