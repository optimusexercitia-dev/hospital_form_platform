import { FileText, Paperclip } from "lucide-react";

import type { SharedItem } from "@/lib/referrals/types";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { ReferralOpenFileButton } from "./referral-open-file-button";
import { SNAPSHOT_UNAVAILABLE_DETAIL } from "./referral-document-labels";
import { formatFileSize } from "./format";

/**
 * The frozen SNAPSHOT B reads on the referral detail (Decision 3/9). A pure
 * Server Component: it renders the point-in-time copies the source coordinator
 * curated — narratives as sanitized Markdown (Rule 7, the ONE renderer) and
 * documents through the audited click-time byte door.
 *
 * The snapshot is NOT A's live case — it is referral-owned frozen rows.
 *
 * ## DM4 (ADR 0114 Wave C, F-14) — the document lane moved corridors
 *
 * Documents used to arrive here as a `sharedItemId → signed URL` map minted by
 * the PAGE during render, one signature per item, rendered as an `<a href>`.
 * That is retired for two independent reasons, and only the first is a bug:
 *
 * 1. **The credential outlived nothing.** PHI signatures live 120 s (ADR 0114
 *    O4). A URL minted while the page streamed was expired before a reader
 *    finished reading the referral — for the ENTITLED reader as much as anyone.
 * 2. **Signing is an authorization event.** The audited door records who opened
 *    what; pre-signing on render either records opens that never happened or
 *    (as it did) hands out bytes with no open recorded at all.
 *
 * Documents now render as a trigger for `openReferralSnapshotDocument`, called
 * at CLICK time, which re-gates `can_read_referral_phi`, audits, and only then
 * signs.
 *
 * ## What this component may and may not decide
 *
 * A `document` row carries no server-computed `canOpen` — the contract gives
 * one only for reply attachments (`ReferralReplyDocument.canOpen`). So the
 * three non-servable states below are the ONLY refusals stated before a click,
 * and each is read from a projection FACT, never derived from a permission
 * guess:
 *
 * - `frozenTombstonedAt` set → reconciled away or PHI-disposed (plan R5). The
 *   governance record survives without its bytes; that is the design.
 * - `frozenDocumentVersionId` null on a `document` row → never bound / legacy.
 *   The contract states this explicitly: "`null` on a `document` row means the
 *   snapshot is NOT servable — render the 'indisponível' state, never an open
 *   affordance."
 * - `documents_wave_c` off → the door answers `module_disabled` for everyone,
 *   so an open control here would be an affordance guaranteed to fail.
 *
 * Any OTHER refusal — including an unentitled metadata-tier reader — is the
 * door's answer to a real click, surfaced as a pt-BR sentence under the row.
 * The row itself always renders: a reader entitled to the referral's metadata is
 * entitled to know the document was shared.
 */
export function ReferralSnapshot({
  sharedItems,
  canOpenDocuments,
}: {
  sharedItems: SharedItem[];
  /**
   * DM4: whether the audited snapshot door is live for this tenant
   * (`documents_wave_c`). Resolved by the SERVER page — a client island cannot
   * read a flag, and no storage coordinate is passed to this component at all
   * any more.
   */
  canOpenDocuments: boolean;
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
              const title = d.frozenTitle ?? "Documento";
              const size = formatFileSize(d.frozenSizeBytes);

              // Resolved in cause order, most specific first. `null` = servable
              // as far as this projection can tell; the door decides the rest.
              const blocked = d.frozenTombstonedAt
                ? SNAPSHOT_UNAVAILABLE_DETAIL.tombstoned
                : !canOpenDocuments
                  ? SNAPSHOT_UNAVAILABLE_DETAIL.moduleOff
                  : !d.frozenDocumentVersionId
                    ? SNAPSHOT_UNAVAILABLE_DETAIL.unbound
                    : null;

              return (
                <li key={d.id}>
                  {blocked === null ? (
                    <ReferralOpenFileButton
                      door={{ kind: "snapshot", sharedItemId: d.id }}
                      // Distinct prefix from the reply-attachment list: a
                      // concluded referral renders BOTH lists on one page, so a
                      // shared document and an attachment sharing a title would
                      // otherwise produce two identical accessible names.
                      label={`Baixar documento compartilhado ${title}`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {title}
                        </span>
                        {size && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {size}
                          </span>
                        )}
                      </span>
                    </ReferralOpenFileButton>
                  ) : (
                    /* Visible, explained, non-interactive. The row is never
                       hidden — its presence is part of the referral's record. */
                    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-muted-foreground">
                      <Paperclip
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {title}
                        </span>
                        <span className="text-xs text-pretty">{blocked}</span>
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
