import { Download, MessageSquareReply, Paperclip } from "lucide-react";

import type { ReferralReply } from "@/lib/referrals/types";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { ReferralTypeChip } from "./referral-chips";
import { formatDateTime, formatFileSize } from "./format";

/**
 * The delivered reply A receives (Decision 10), shown on the referral detail once
 * `concluida`. A pure Server Component: `resultMd` is PHI-bearing clinical free
 * text (the audited detail door already gated it), rendered through the ONE
 * sanitizing Markdown renderer (Rule 7). The structured outcome label is a quiet
 * chip; attachments are download links (signed URLs minted server-side, passed in).
 *
 * An acknowledgment-only conclusion (no-reply-expected referrals) carries no
 * result/outcome — we render a calm "concluído com ciência" line instead.
 */
export function ReferralReplyView({
  reply,
  attachmentUrls,
}: {
  reply: ReferralReply;
  /** `attachmentId → signed URL`, minted server-side; missing/`null` = unavailable. */
  attachmentUrls: Record<string, string | null>;
}) {
  return (
    <section
      aria-labelledby="referral-reply-heading"
      className="flex flex-col gap-4 rounded-2xl border border-success/30 bg-success/8 p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquareReply aria-hidden="true" className="size-4 text-success" />
        <h2 id="referral-reply-heading" className="text-base font-semibold">
          Resposta da análise
        </h2>
        {reply.outcomeLabel && (
          <ReferralTypeChip label={reply.outcomeLabel} colorToken="success" />
        )}
      </div>

      {reply.acknowledgedOnly ? (
        <p className="text-sm text-foreground/90 text-pretty">
          Encaminhamento concluído com ciência, sem resultado a registrar.
        </p>
      ) : reply.resultMd?.trim() ? (
        <MarkdownRenderer content={reply.resultMd} />
      ) : (
        <p className="text-sm text-muted-foreground">Sem resultado registrado.</p>
      )}

      {reply.attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Paperclip
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Anexos
          </h3>
          <ul className="flex flex-col gap-2">
            {reply.attachments.map((a) => {
              const url = attachmentUrls[a.id] ?? null;
              const size = formatFileSize(a.sizeBytes);
              return (
                <li key={a.id}>
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
                          {a.title}
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
                      <span className="truncate text-sm font-medium">
                        {a.title}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {reply.repliedAt ? `Concluído em ${formatDateTime(reply.repliedAt)}` : ""}
        {reply.repliedByName ? ` por ${reply.repliedByName}` : ""}
      </p>
    </section>
  );
}
